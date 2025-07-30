# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
from __future__ import annotations

import itertools
import logging
import re
from collections import defaultdict
from datetime import datetime
from re import Pattern
from typing import Any, Iterator, Optional, TYPE_CHECKING, TypedDict
from urllib import parse

from apispec import APISpec
from apispec.ext.marshmallow import MarshmallowPlugin
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from flask import current_app
from flask_babel import gettext as __
from marshmallow import fields, Schema
from sqlalchemy import text, types
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.engine.url import URL
from sqlglot import exp, parse_one

from superset.constants import TimeGrain
from superset.databases.utils import make_url_safe
from superset.db_engine_specs.base import BaseEngineSpec, BasicPropertiesType
from superset.db_engine_specs.postgres import PostgresBaseEngineSpec
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.extensions.semantic_layer import (
    BINARY,
    BOOLEAN,
    Column as SemanticColumn,
    DATE,
    DATETIME,
    DECIMAL,
    Dimension as SemanticDimension,
    Filter as SemanticFilter,
    INTEGER,
    Metric as SemanticMetric,
    NoSort,
    NUMBER,
    OBJECT,
    Query as SemanticQuery,
    SemanticView,
    Sort as SemanticSort,
    SortDirectionEnum,
    STRING,
    Table as SemanticTable,
    TIME,
    Type as SemanticType,
)
from superset.models.sql_lab import Query
from superset.sql.parse import Table
from superset.utils import json
from superset.utils.core import get_user_agent, QuerySource

if TYPE_CHECKING:
    from sqlalchemy.engine.base import Engine

    from superset.models.core import Database

# Regular expressions to catch custom errors
OBJECT_DOES_NOT_EXIST_REGEX = re.compile(
    r"Object (?P<object>.*?) does not exist or not authorized."
)

SYNTAX_ERROR_REGEX = re.compile(
    "syntax error line (?P<line>.+?) at position (?P<position>.+?) "
    "unexpected '(?P<syntax_error>.+?)'."
)

logger = logging.getLogger(__name__)


class SnowflakeParametersSchema(Schema):
    username = fields.Str(required=True)
    password = fields.Str(required=True)
    account = fields.Str(required=True)
    database = fields.Str(required=True)
    role = fields.Str(required=True)
    warehouse = fields.Str(required=True)


class SnowflakeParametersType(TypedDict):
    username: str
    password: str
    account: str
    database: str
    role: str
    warehouse: str


class SnowflakeSemanticLayer:
    def __init__(self, engine: Engine) -> None:
        self.engine = engine

    def execute(
        self,
        sql: str,
        **kwargs: Any,
    ) -> Iterator[dict[str, Any]]:
        with self.engine.connect() as connection:
            for row in connection.execute(text(sql), kwargs).mappings():
                yield dict(row)

    def get_semantic_views(self) -> set[SemanticView]:
        sql = """
SHOW SEMANTIC VIEWS
    ->> SELECT "name" FROM $1;
        """
        return {SemanticView(row["name"]) for row in self.execute(sql)}

    def get_type(self, snowflake_type: str | None) -> type[SemanticType]:
        if snowflake_type is None:
            return STRING

        type_map = {
            STRING: {r"VARCHAR\(\d+\)$", "STRING$", "TEXT$", r"CHAR\(\d+\)$"},
            INTEGER: {r"NUMBER\(38,\s?0\)$", "INT$", "INTEGER$", "BIGINT$"},
            DECIMAL: {r"NUMBER\(10,\s?2\)$"},
            NUMBER: {r"NUMBER\(\d+,\s?\d+\)$", "FLOAT$", "DOUBLE$"},
            BOOLEAN: {"BOOLEAN$"},
            DATE: {"DATE$"},
            DATETIME: {"TIMESTAMP_TZ$", "TIMESTAMP__NTZ$"},
            TIME: {"TIME$"},
            OBJECT: {"OBJECT$"},
            BINARY: {r"BINARY\(\d+\)$", r"VARBINARY\(\d+\)$"},
        }
        for semantic_type, patterns in type_map.items():
            if any(
                re.match(pattern, snowflake_type, re.IGNORECASE) for pattern in patterns
            ):
                return semantic_type

        return STRING

    @classmethod
    def quote_table(cls, table: Table, dialect: Dialect) -> str:
        """
        Fully quote a table name, including the schema and catalog.
        """
        quoters = {
            "catalog": dialect.identifier_preparer.quote_schema,
            "schema": dialect.identifier_preparer.quote_schema,
            "table": dialect.identifier_preparer.quote,
        }

        return ".".join(
            function(getattr(table, key))
            for key, function in quoters.items()
            if getattr(table, key)
        )

    def get_metrics(self, semantic_view: SemanticView) -> set[SemanticMetric]:
        quoted_semantic_view_name = self.quote_table(
            Table(semantic_view.name),
            self.engine.dialect,
        )
        sql = f"""
DESC SEMANTIC VIEW {quoted_semantic_view_name}
    ->> SELECT "object_name", "property", "property_value"
        FROM $1
        WHERE
            "object_kind" = 'METRIC' AND
            "property" IN ('DATA_TYPE', 'TABLE');
        """  # noqa: S608 (semantic_view.name is quoted)
        rows = self.execute(sql)

        metrics: set[SemanticMetric] = set()
        for name, group in itertools.groupby(rows, key=lambda x: x["object_name"]):
            attributes = defaultdict(set)
            for row in group:
                attributes[row["property"]].add(row["property_value"])

            table = next(iter(attributes["TABLE"]))
            metric_name = table + "." + name
            type_ = self.get_type(next(iter(attributes["DATA_TYPE"])))
            sql = self.engine.dialect.identifier_preparer.quote(metric_name)
            tables = frozenset(attributes["TABLE"])
            join_columns = frozenset()

            metrics.add(SemanticMetric(metric_name, type_, sql, tables, join_columns))

        return metrics

    def get_dimensions(self, semantic_view: SemanticView) -> set[SemanticDimension]:
        quoted_semantic_view_name = self.quote_table(
            Table(semantic_view.name),
            self.engine.dialect,
        )
        sql = f"""
DESC SEMANTIC VIEW {quoted_semantic_view_name}
    ->> SELECT "object_name", "property", "property_value"
        FROM $1
        WHERE
            "object_kind" = 'DIMENSION' AND
            "property" IN ('DATA_TYPE', 'TABLE');
        """  # noqa: S608 (semantic_view.name is quoted)
        rows = self.execute(sql)

        dimensions: set[SemanticDimension] = set()
        for name, group in itertools.groupby(rows, key=lambda x: x["object_name"]):
            attributes = defaultdict(set)
            for row in group:
                attributes[row["property"]].add(row["property_value"])

            table = next(iter(attributes["TABLE"]))
            dimension_name = table + "." + name
            column = SemanticColumn(SemanticTable(table), name)
            type_ = self.get_type(next(iter(attributes["DATA_TYPE"])))

            dimensions.add(SemanticDimension(column, dimension_name, type_))

        return dimensions

    def get_valid_metrics(
        self,
        semantic_view: SemanticView,
        metrics: set[SemanticMetric],
        dimensions: set[SemanticDimension],
    ) -> set[SemanticMetric]:
        # all metrics and dimensions are valid inside a given semantic view
        return self.get_metrics(semantic_view)

    def get_valid_dimensions(
        self,
        semantic_view: SemanticView,
        metrics: set[SemanticMetric],
        dimensions: set[SemanticDimension],
    ) -> set[SemanticDimension]:
        # all metrics and dimensions are valid inside a given semantic view
        return self.get_dimensions(semantic_view)

    def get_query(
        self,
        semantic_view: SemanticView,
        metrics: set[SemanticMetric],
        dimensions: set[SemanticDimension],
        filters: set[SemanticFilter],
        sort: SemanticSort = NoSort,
        limit: int | None = None,
        offset: int | None = None,
    ) -> SemanticQuery:
        ast = self.build_query(
            semantic_view,
            metrics,
            dimensions,
            filters,
            sort,
            limit,
            offset,
        )
        return SemanticQuery(sql=ast.sql(dialect="snowflake", pretty=True))

    def build_query(
        self,
        semantic_view: SemanticView,
        metrics: set[SemanticMetric],
        dimensions: set[SemanticDimension],
        filters: set[SemanticFilter],
        sort: SemanticSort = NoSort,
        limit: int | None = None,
        offset: int | None = None,
    ) -> exp.Select:
        semantic_view = exp.SemanticView(
            this=exp.Table(this=exp.Identifier(this=semantic_view.name, quoted=True)),
            dimensions=[
                exp.Column(
                    this=exp.Identifier(this=dimension.column.name, quoted=True),
                    table=exp.Identifier(
                        this=dimension.column.relation.name,
                        quoted=True,
                    ),
                )
                for dimension in dimensions
            ],
            metrics=[
                exp.Column(
                    this=exp.Identifier(this=column, quoted=True),
                    table=exp.Identifier(this=table, quoted=True),
                )
                for table, column in (
                    metric.name.split(".", 1)
                    for metric in metrics
                    if "." in metric.name
                )
            ],
        )
        query = exp.Select(
            expressions=[exp.Star()],
            **{"from": exp.From(this=exp.Table(this=semantic_view))},
        )

        if sort.items:
            order = [
                exp.Ordered(
                    this=exp.Column(this=exp.Identifier(this=item.field.name)),
                    desc=item.direction == SortDirectionEnum.DESC,
                    nulls_first=item.nulls_first,
                )
                for item in sort.items
            ]
            query.args["order"] = exp.Order(expressions=order)

        if offset:
            query = query.offset(offset)

        if limit:
            query = query.limit(limit)

        return query

    def get_query_from_standard_sql(self, sql: str) -> SemanticQuery:
        """
        Convert the Explore query into a proper query.

        Explore will produce a pseudo-SQL query that references metrics and dimensions
        as if they were columns in a table. This method replaces the table name with a
        call to `SEMANTIC_VIEW`, and removes the `GROUP BY` clause, since all the
        aggregations happen inside the `SEMANTIC_VIEW` call.
        """
        ast = parse_one(sql, "snowflake")
        table = ast.find(exp.Table)
        if not table:
            return SemanticQuery(sql=sql)

        semantic_views = self.get_semantic_views()
        if table.name not in {semantic_view.name for semantic_view in semantic_views}:
            return SemanticQuery(sql=sql)

        # collect all metric and dimensions
        semantic_view = SemanticView(table.name)
        all_metrics = self.get_metrics(semantic_view)
        all_dimensions = self.get_dimensions(semantic_view)

        # collect metrics and dimensions used in the query
        columns = {column.name for column in ast.find_all(exp.Column)}
        metrics = [metric for metric in all_metrics if metric.name in columns]
        dimensions = [
            dimension for dimension in all_dimensions if dimension.name in columns
        ]

        # now replace table with a call to `SEMANTIC_VIEW`
        udtf = exp.Table(
            this=exp.SemanticView(
                this=exp.Table(
                    this=exp.Identifier(this=semantic_view.name, quoted=True)
                ),
                metrics=[
                    exp.Column(
                        this=exp.Identifier(this=column, quoted=True),
                        table=exp.Identifier(this=table, quoted=True),
                    )
                    for table, column in (
                        metric.name.split(".", 1)
                        for metric in metrics
                        if "." in metric.name
                    )
                ],
                dimensions=[
                    exp.Column(
                        this=exp.Identifier(this=column, quoted=True),
                        table=exp.Identifier(this=table, quoted=True),
                    )
                    for table, column in (
                        dimension.name.split(".", 1)
                        for dimension in dimensions
                        if "." in dimension.name
                    )
                ],
            ),
            alias=exp.TableAlias(
                this=exp.Identifier(this="table_alias", quoted=False),
                columns=[
                    exp.Identifier(this=column.name, quoted=True)
                    for column in metrics + dimensions
                ],
            ),
        )
        table.replace(udtf)

        # remove group by, since aggregations are done inside the `SEMANTIC_VIEW` call
        del ast.args["group"]

        print("BETO")
        print(ast.sql(dialect="snowflake", pretty=True))
        return SemanticQuery(sql=ast.sql(dialect="snowflake", pretty=True))


class SnowflakeEngineSpec(PostgresBaseEngineSpec):
    engine = "snowflake"
    engine_name = "Snowflake"
    force_column_alias_quotes = True
    max_column_name_length = 256

    # Snowflake doesn't support IS true/false syntax, use = true/false instead
    use_equality_for_boolean_filters = True

    parameters_schema = SnowflakeParametersSchema()
    default_driver = "snowflake"
    sqlalchemy_uri_placeholder = "snowflake://"

    semantic_layer = SnowflakeSemanticLayer

    supports_dynamic_schema = True
    supports_catalog = supports_dynamic_catalog = supports_cross_catalog_queries = True

    # pylint: disable=invalid-name
    encrypted_extra_sensitive_fields = {
        "$.auth_params.privatekey_body",
        "$.auth_params.privatekey_pass",
    }

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "DATE_TRUNC('SECOND', {col})",
        TimeGrain.MINUTE: "DATE_TRUNC('MINUTE', {col})",
        TimeGrain.FIVE_MINUTES: "DATEADD(MINUTE, \
            FLOOR(DATE_PART(MINUTE, {col}) / 5) * 5, DATE_TRUNC('HOUR', {col}))",
        TimeGrain.TEN_MINUTES: "DATEADD(MINUTE,  \
            FLOOR(DATE_PART(MINUTE, {col}) / 10) * 10, DATE_TRUNC('HOUR', {col}))",
        TimeGrain.FIFTEEN_MINUTES: "DATEADD(MINUTE, \
            FLOOR(DATE_PART(MINUTE, {col}) / 15) * 15, DATE_TRUNC('HOUR', {col}))",
        TimeGrain.THIRTY_MINUTES: "DATEADD(MINUTE, \
            FLOOR(DATE_PART(MINUTE, {col}) / 30) * 30, DATE_TRUNC('HOUR', {col}))",
        TimeGrain.HOUR: "DATE_TRUNC('HOUR', {col})",
        TimeGrain.DAY: "DATE_TRUNC('DAY', {col})",
        TimeGrain.WEEK: "DATE_TRUNC('WEEK', {col})",
        TimeGrain.MONTH: "DATE_TRUNC('MONTH', {col})",
        TimeGrain.QUARTER: "DATE_TRUNC('QUARTER', {col})",
        TimeGrain.YEAR: "DATE_TRUNC('YEAR', {col})",
    }

    custom_errors: dict[Pattern[str], tuple[str, SupersetErrorType, dict[str, Any]]] = {
        OBJECT_DOES_NOT_EXIST_REGEX: (
            __("%(object)s does not exist in this database."),
            SupersetErrorType.OBJECT_DOES_NOT_EXIST_ERROR,
            {},
        ),
        SYNTAX_ERROR_REGEX: (
            __(
                "Please check your query for syntax errors at or "
                'near "%(syntax_error)s". Then, try running your query again.'
            ),
            SupersetErrorType.SYNTAX_ERROR,
            {},
        ),
    }

    @staticmethod
    def get_extra_params(
        database: Database, source: QuerySource | None = None
    ) -> dict[str, Any]:
        """
        Add a user agent to be used in the requests.
        """
        extra: dict[str, Any] = BaseEngineSpec.get_extra_params(database)
        engine_params: dict[str, Any] = extra.setdefault("engine_params", {})
        connect_args: dict[str, Any] = engine_params.setdefault("connect_args", {})
        user_agent = get_user_agent(database, source)

        connect_args.setdefault("application", user_agent)

        return extra

    @classmethod
    def adjust_engine_params(
        cls,
        uri: URL,
        connect_args: dict[str, Any],
        catalog: Optional[str] = None,
        schema: Optional[str] = None,
    ) -> tuple[URL, dict[str, Any]]:
        if "/" in uri.database:
            current_catalog, current_schema = uri.database.split("/", 1)
        else:
            current_catalog, current_schema = uri.database, None

        adjusted_database = "/".join(
            [
                catalog or current_catalog,
                schema or current_schema or "",
            ]
        ).rstrip("/")

        uri = uri.set(database=adjusted_database)

        return uri, connect_args

    @classmethod
    def get_schema_from_engine_params(
        cls,
        sqlalchemy_uri: URL,
        connect_args: dict[str, Any],
    ) -> Optional[str]:
        """
        Return the configured schema.
        """
        database = sqlalchemy_uri.database.strip("/")

        if "/" not in database:
            return None

        return parse.unquote(database.split("/")[1])

    @classmethod
    def get_default_catalog(cls, database: "Database") -> str:
        """
        Return the default catalog.
        """
        return database.url_object.database.split("/")[0]

    @classmethod
    def get_catalog_names(
        cls,
        database: "Database",
        inspector: Inspector,
    ) -> set[str]:
        """
        Return all catalogs.

        In Snowflake, a catalog is called a "database".
        """
        return {
            catalog
            for (catalog,) in inspector.bind.execute(
                "SELECT DATABASE_NAME from information_schema.databases"
            )
        }

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "DATEADD(S, {col}, '1970-01-01')"

    @classmethod
    def epoch_ms_to_dttm(cls) -> str:
        return "DATEADD(MS, {col}, '1970-01-01')"

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[dict[str, Any]] = None
    ) -> Optional[str]:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, types.Date):
            return f"TO_DATE('{dttm.date().isoformat()}')"
        if isinstance(sqla_type, types.TIMESTAMP):
            return f"""TO_TIMESTAMP('{dttm.isoformat(timespec="microseconds")}')"""
        if isinstance(sqla_type, types.DateTime):
            return f"""CAST('{dttm.isoformat(timespec="microseconds")}' AS DATETIME)"""
        return None

    @staticmethod
    def mutate_db_for_connection_test(database: "Database") -> None:
        """
        By default, snowflake doesn't validate if the user/role has access to the chosen
        database.

        :param database: instance to be mutated
        """
        extra = json.loads(database.extra or "{}")
        engine_params = extra.get("engine_params", {})
        connect_args = engine_params.get("connect_args", {})
        connect_args["validate_default_parameters"] = True
        engine_params["connect_args"] = connect_args
        extra["engine_params"] = engine_params
        database.extra = json.dumps(extra)

    @classmethod
    def get_cancel_query_id(cls, cursor: Any, query: Query) -> Optional[str]:
        """
        Get Snowflake session ID that will be used to cancel all other running
        queries in the same session.

        :param cursor: Cursor instance in which the query will be executed
        :param query: Query instance
        :return: Snowflake Session ID
        """
        cursor.execute("SELECT CURRENT_SESSION()")
        row = cursor.fetchone()
        return row[0]

    @classmethod
    def cancel_query(cls, cursor: Any, query: Query, cancel_query_id: str) -> bool:
        """
        Cancel query in the underlying database.

        :param cursor: New cursor instance to the db of the query
        :param query: Query instance
        :param cancel_query_id: Snowflake Session ID
        :return: True if query cancelled successfully, False otherwise
        """
        try:
            cursor.execute(f"SELECT SYSTEM$CANCEL_ALL_QUERIES({cancel_query_id})")
        except Exception:  # pylint: disable=broad-except
            return False

        return True

    @classmethod
    def build_sqlalchemy_uri(
        cls,
        parameters: SnowflakeParametersType,
        encrypted_extra: Optional[  # pylint: disable=unused-argument
            dict[str, Any]
        ] = None,
    ) -> str:
        return str(
            URL.create(
                "snowflake",
                username=parameters.get("username"),
                password=parameters.get("password"),
                host=parameters.get("account"),
                database=parameters.get("database"),
                query={
                    "role": parameters.get("role"),
                    "warehouse": parameters.get("warehouse"),
                },
            )
        )

    @classmethod
    def get_parameters_from_uri(
        cls,
        uri: str,
        encrypted_extra: Optional[  # pylint: disable=unused-argument
            dict[str, str]
        ] = None,
    ) -> Any:
        url = make_url_safe(uri)
        query = dict(url.query.items())
        return {
            "username": url.username,
            "password": url.password,
            "account": url.host,
            "database": url.database,
            "role": query.get("role"),
            "warehouse": query.get("warehouse"),
        }

    @classmethod
    def validate_parameters(
        cls, properties: BasicPropertiesType
    ) -> list[SupersetError]:
        errors: list[SupersetError] = []
        required = {
            "warehouse",
            "username",
            "database",
            "account",
            "role",
            "password",
        }
        parameters = properties.get("parameters", {})
        present = {key for key in parameters if parameters.get(key, ())}

        if missing := sorted(required - present):
            errors.append(
                SupersetError(
                    message=f"One or more parameters are missing: {', '.join(missing)}",
                    error_type=SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR,
                    level=ErrorLevel.WARNING,
                    extra={"missing": missing},
                ),
            )
        return errors

    @classmethod
    def parameters_json_schema(cls) -> Any:
        """
        Return configuration parameters as OpenAPI.
        """
        if not cls.parameters_schema:
            return None

        ma_plugin = MarshmallowPlugin()
        spec = APISpec(
            title="Database Parameters",
            version="1.0.0",
            openapi_version="3.0.0",
            plugins=[ma_plugin],
        )

        spec.components.schema(cls.__name__, schema=cls.parameters_schema)
        return spec.to_dict()["components"]["schemas"][cls.__name__]

    @staticmethod
    def update_params_from_encrypted_extra(
        database: "Database",
        params: dict[str, Any],
    ) -> None:
        if not database.encrypted_extra:
            return
        try:
            encrypted_extra = json.loads(database.encrypted_extra)
        except json.JSONDecodeError as ex:
            logger.error(ex, exc_info=True)
            raise
        auth_method = encrypted_extra.get("auth_method", None)
        auth_params = encrypted_extra.get("auth_params", {})
        if not auth_method:
            return
        connect_args = params.setdefault("connect_args", {})
        if auth_method == "keypair":
            privatekey_body = auth_params.get("privatekey_body", None)
            key = None
            if privatekey_body:
                key = privatekey_body.encode()
            else:
                with open(auth_params["privatekey_path"], "rb") as key_temp:
                    key = key_temp.read()
            privatekey_pass = auth_params.get("privatekey_pass", None)
            password = privatekey_pass.encode() if privatekey_pass is not None else None
            p_key = serialization.load_pem_private_key(
                key,
                password=password,
                backend=default_backend(),
            )
            pkb = p_key.private_bytes(
                encoding=serialization.Encoding.DER,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
            connect_args["private_key"] = pkb
        else:
            allowed_extra_auths = current_app.config[
                "ALLOWED_EXTRA_AUTHENTICATIONS"
            ].get("snowflake", {})
            if auth_method in allowed_extra_auths:
                snowflake_auth = allowed_extra_auths.get(auth_method)
            else:
                raise ValueError(
                    f"For security reason, custom authentication '{auth_method}' "
                    f"must be listed in 'ALLOWED_EXTRA_AUTHENTICATIONS' config"
                )
            connect_args["auth"] = snowflake_auth(**auth_params)
