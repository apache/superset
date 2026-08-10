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

import logging
import re
from datetime import datetime, timezone
from typing import Any, cast, TYPE_CHECKING
from urllib import parse

from flask import current_app as app
from flask_babel import gettext as __
from marshmallow import fields, Schema
from marshmallow.validate import Range
from sqlalchemy import func, types
from sqlalchemy.engine.url import URL
from sqlalchemy.sql.expression import ColumnElement
from urllib3.exceptions import NewConnectionError

from superset.databases.utils import make_url_safe
from superset.db_engine_specs.base import (
    BaseEngineSpec,
    BasicParametersMixin,
    BasicParametersType,
    BasicPropertiesType,
    DatabaseCategory,
)
from superset.db_engine_specs.exceptions import SupersetDBAPIDatabaseError
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.extensions import cache_manager
from superset.utils.core import GenericDataType
from superset.utils.network import is_hostname_valid, is_port_open

if TYPE_CHECKING:
    from superset.models.core import Database
    from superset.sql.parse import Table

logger = logging.getLogger(__name__)


class ClickHouseBaseEngineSpec(BaseEngineSpec):
    """Shared engine spec for ClickHouse."""

    time_groupby_inline = True
    supports_multivalues_insert = True
    supports_multivalue_columns = True

    # ClickHouse doesn't support IS true/false syntax, use = true/false instead
    use_equality_for_boolean_filters = True

    # ClickHouse enforces max_rows_to_read against a pre-execution estimate
    # that ignores LIMIT, so bounded sampling queries on large tables are
    # rejected with TOO_MANY_ROWS before reading begins. Break mode keeps the
    # operator's row cap as the read bound and returns the partial result
    # instead of erroring. The clause is applied on its own line because the
    # retry operates on the final statement text, which SQL mutators may have
    # terminated with a single-line comment.
    sampling_read_limit_override_suffix = "\nSETTINGS read_overflow_mode='break'"

    @classmethod
    def apply_sampling_read_limit_override(cls, sql: str) -> str | None:
        """Append a read-overflow override so bounded sampling SQL succeeds.

        Returns ``None`` when no retry should be attempted: the SQL already
        carries the override, or it contains a SETTINGS clause from another
        source (ClickHouse permits only one per statement, so appending a
        second would produce invalid SQL — including subquery SETTINGS in
        this check merely degrades to the engine's normal rejection). The
        guard matches the clause shape ``SETTINGS <key> = ...`` rather than
        the bare token, and string literals, quoted identifiers, and comments
        are blanked out before matching, so a column named ``settings`` or a
        literal/comment merely containing that text does not suppress the
        retry. A trailing statement terminator is stripped so the SETTINGS
        clause attaches to the statement itself.
        """
        code_only = re.sub(
            r"'(?:[^']|'')*'"  # single-quoted string literals ('' escape)
            r'|"(?:[^"]|"")*"'  # double-quoted identifiers
            r"|`[^`]*`"  # backtick-quoted identifiers
            r"|--[^\n]*"  # single-line comments
            r"|/\*.*?\*/",  # block comments
            " ",
            sql,
            flags=re.DOTALL,
        )
        if re.search(r"\bSETTINGS\s+\w+\s*=", code_only, re.IGNORECASE):
            return None
        stripped = sql.rstrip().rstrip(";").rstrip()
        return f"{stripped}{cls.sampling_read_limit_override_suffix}"

    @classmethod
    def is_read_limit_error(cls, ex: Exception) -> bool:
        """Recognize ClickHouse's max_rows_to_read rejection (TOO_MANY_ROWS).

        Anchored to the error-code tokens ClickHouse emits ("Code: 158" /
        "TOO_MANY_ROWS") rather than the setting name, so unrelated errors
        that merely mention the setting are not misclassified.
        """
        message = str(ex)
        return "TOO_MANY_ROWS" in message or "Code: 158" in message

    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "toStartOfSecond(toDateTime64({col}, 3))",
        "PT1M": "toStartOfMinute(toDateTime({col}))",
        "PT5M": "toDateTime(intDiv(toUInt32(toDateTime({col})), 300)*300)",
        "PT10M": "toDateTime(intDiv(toUInt32(toDateTime({col})), 600)*600)",
        "PT15M": "toDateTime(intDiv(toUInt32(toDateTime({col})), 900)*900)",
        "PT30M": "toDateTime(intDiv(toUInt32(toDateTime({col})), 1800)*1800)",
        "PT1H": "toStartOfHour(toDateTime({col}))",
        "P1D": "toStartOfDay(toDateTime({col}))",
        "P1W": "toMonday(toDateTime({col}))",
        "P1M": "toStartOfMonth(toDateTime({col}))",
        "P3M": "toStartOfQuarter(toDateTime({col}))",
        "P1Y": "toStartOfYear(toDateTime({col}))",
    }

    column_type_mappings = (
        (
            # Anchor to the start so only top-level arrays match. This must be
            # ordered before the ``Enum`` entry below: ``Array(Enum8(...))`` is a
            # real array and should classify as MULTI_VALUE, not STRING. The
            # anchor also prevents over-matching nested arrays such as
            # ``Map(String, Array(String))`` or ``Tuple(Array(String))``, which
            # are not themselves array columns and must keep their own type.
            re.compile(r"^Array\(", re.IGNORECASE),
            types.String(),
            GenericDataType.MULTI_VALUE,
        ),
        (
            re.compile(r".*Enum.*", re.IGNORECASE),
            types.String(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r".*UUID.*", re.IGNORECASE),
            types.String(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r".*Bool.*", re.IGNORECASE),
            types.Boolean(),
            GenericDataType.BOOLEAN,
        ),
        (
            re.compile(r".*String.*", re.IGNORECASE),
            types.String(),
            GenericDataType.STRING,
        ),
        (
            re.compile(r".*Int\d+.*", re.IGNORECASE),
            types.INTEGER(),
            GenericDataType.NUMERIC,
        ),
        (
            re.compile(r".*Decimal.*", re.IGNORECASE),
            types.DECIMAL(),
            GenericDataType.NUMERIC,
        ),
        (
            re.compile(r".*DateTime.*", re.IGNORECASE),
            types.DateTime(),
            GenericDataType.TEMPORAL,
        ),
        (
            re.compile(r".*Date.*", re.IGNORECASE),
            types.Date(),
            GenericDataType.TEMPORAL,
        ),
    )

    @classmethod
    def array_contains_any(cls, col: ColumnElement, values: list[Any]) -> ColumnElement:
        # ClickHouse: hasAny(arr, [v1, v2]) -> 1 if arr shares any element.
        # func.array(*values) renders as array(v1, v2) == [v1, v2].
        return func.hasAny(col, func.array(*values))

    @classmethod
    def array_contains_all(cls, col: ColumnElement, values: list[Any]) -> ColumnElement:
        # ClickHouse: hasAll(arr, [v1, v2]) -> 1 if arr contains all elements.
        return func.hasAll(col, func.array(*values))

    @classmethod
    def array_length(cls, col: ColumnElement) -> ColumnElement:
        # ClickHouse: length(arr) -> number of elements
        return func.length(col)

    @classmethod
    def array_literal(cls, values: list[Any]) -> ColumnElement:
        # ClickHouse: array(v1, v2) is equivalent to the literal [v1, v2].
        return func.array(*values)

    @classmethod
    def array_explode(cls, col: ColumnElement) -> ColumnElement:
        # ClickHouse: arrayJoin(arr) yields one row per element, so
        # SELECT DISTINCT arrayJoin(arr) returns the distinct elements.
        return func.arrayJoin(col)

    # Matches the element type inside a top-level ``Array(...)`` column, e.g.
    # ``Array(Int32)`` -> ``Int32``, ``Array(Nullable(String))`` -> ``String``.
    _ARRAY_ELEMENT_RE = re.compile(r"^Array\((?P<inner>.+)\)$", re.IGNORECASE)
    # Element-type wrappers that don't change the underlying generic type.
    _ELEMENT_WRAPPER_RE = re.compile(
        r"^(?:Nullable|LowCardinality)\((?P<inner>.+)\)$", re.IGNORECASE
    )

    @classmethod
    def get_array_element_type(cls, native_type: str | None) -> GenericDataType | None:
        if not native_type:
            return None
        match = cls._ARRAY_ELEMENT_RE.match(native_type.strip())
        if not match:
            return None
        inner = match.group("inner").strip()
        # Peel wrappers (Nullable/LowCardinality) that don't alter the generic
        # type so the inner scalar type drives classification.
        while wrapper := cls._ELEMENT_WRAPPER_RE.match(inner):
            inner = wrapper.group("inner").strip()
        spec = cls.get_column_spec(inner)
        return spec.generic_type if spec else None

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "{col}"

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: dict[str, Any] | None = None
    ) -> str | None:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, types.Date):
            return f"toDate('{dttm.date().isoformat()}')"
        if isinstance(sqla_type, types.DateTime):
            if dttm.tzinfo is not None and dttm.utcoffset() is not None:
                dttm = dttm.astimezone(timezone.utc).replace(tzinfo=None)
            formatted_dttm: str = dttm.isoformat(sep=" ", timespec="seconds")
            return f"toDateTime('{formatted_dttm}', 'UTC')"
        return None


class ClickHouseEngineSpec(ClickHouseBaseEngineSpec):
    """Engine spec for clickhouse_sqlalchemy connector (legacy)"""

    engine = "clickhouse"
    engine_name = "ClickHouse (sqlalchemy)"  # Internal name for legacy connector

    _show_functions_column = "name"
    supports_file_upload = False

    # Note: Primary metadata is in ClickHouseConnectEngineSpec which consolidates
    # both drivers. This spec exists for backwards compatibility with existing
    # connections using the clickhouse-sqlalchemy driver.

    @classmethod
    def get_dbapi_exception_mapping(cls) -> dict[type[Exception], type[Exception]]:
        return {NewConnectionError: SupersetDBAPIDatabaseError}

    @classmethod
    def get_dbapi_mapped_exception(cls, exception: Exception) -> Exception:
        new_exception = cls.get_dbapi_exception_mapping().get(type(exception))
        if new_exception == SupersetDBAPIDatabaseError:
            return SupersetDBAPIDatabaseError("Connection failed")
        if not new_exception:
            return exception
        return new_exception(str(exception))

    @classmethod
    @cache_manager.cache.memoize()
    def get_function_names(cls, database: Database) -> list[str]:
        """
        Get a list of function names that are able to be called on the database.
        Used for SQL Lab autocomplete.

        :param database: The database to get functions for
        :return: A list of function names usable in the database
        """
        system_functions_sql = "SELECT name FROM system.functions"
        try:
            df = database.get_df(system_functions_sql)
            if cls._show_functions_column in df:
                return df[cls._show_functions_column].tolist()
            columns = df.columns.values.tolist()
            logger.error(
                "Payload from `%s` has the incorrect format. "
                "Expected column `%s`, found: %s.",
                system_functions_sql,
                cls._show_functions_column,
                ", ".join(columns),
                exc_info=True,
            )
            # if the results have a single column, use that
            if len(columns) == 1:
                return df[columns[0]].tolist()
        except Exception as ex:  # pylint: disable=broad-except
            logger.error(
                "Query `%s` fire error %s. ",
                system_functions_sql,
                str(ex),
                exc_info=True,
            )
            return []

        # otherwise, return no function names to prevent errors
        return []


class ClickHouseParametersSchema(Schema):
    username = fields.String(allow_none=True, metadata={"description": __("Username")})
    password = fields.String(allow_none=True, metadata={"description": __("Password")})
    host = fields.String(
        required=True, metadata={"description": __("Hostname or IP address")}
    )
    port = fields.Integer(
        allow_none=True,
        metadata={"description": __("Database port")},
        validate=Range(min=0, max=65535),
    )
    database = fields.String(
        allow_none=True, metadata={"description": __("Database name")}
    )
    encryption = fields.Boolean(
        dump_default=True,
        metadata={"description": __("Use an encrypted connection to the database")},
    )
    query = fields.Dict(
        keys=fields.Str(),
        values=fields.Raw(),
        metadata={"description": __("Additional parameters")},
    )
    ssh = fields.Boolean(
        required=False,
        metadata={"description": __("Use an ssh tunnel connection to the database")},
    )


try:
    from clickhouse_connect.common import set_setting
    from clickhouse_connect.datatypes.format import set_default_formats

    # override default formats for compatibility
    set_default_formats(
        "FixedString",
        "string",
        "IPv*",
        "string",
        "UInt64",
        "signed",
        "UUID",
        "string",
        "*Int256",
        "string",
        "*Int128",
        "string",
    )
    set_setting(
        "product_name",
        f"superset/{app.config.get('VERSION_STRING', 'dev')}",
    )
except ImportError:  # ClickHouse Connect not installed, do nothing
    pass


class ClickHouseConnectEngineSpec(BasicParametersMixin, ClickHouseEngineSpec):
    """Engine spec for clickhouse-connect connector (recommended)"""

    engine = "clickhousedb"
    engine_name = "ClickHouse"

    default_driver = "connect"
    _function_names: list[str] = []

    # The clickhouse-connect driver supports inserting data, so re-enable the
    # file upload flow that the parent ClickHouseEngineSpec disables.
    supports_file_upload = True

    sqlalchemy_uri_placeholder = (
        "clickhousedb://user:password@host[:port][/dbname][?secure=value&=value...]"
    )
    parameters_schema = ClickHouseParametersSchema()
    encryption_parameters = {"secure": "true"}

    supports_dynamic_schema = True

    metadata = {
        "description": (
            "ClickHouse is an open-source column-oriented database for real-time "
            "analytics using SQL. It's known for extremely fast query performance "
            "on large datasets."
        ),
        "logo": "clickhouse.png",
        "homepage_url": "https://clickhouse.com/",
        "categories": [
            DatabaseCategory.ANALYTICAL_DATABASES,
            DatabaseCategory.OPEN_SOURCE,
        ],
        "pypi_packages": ["clickhouse-connect>=0.13.0"],
        "connection_string": "clickhousedb://{username}:{password}@{host}:{port}/{database}",
        "default_port": 8123,
        "drivers": [
            {
                "name": "clickhouse-connect (Recommended)",
                "pypi_package": "clickhouse-connect>=0.13.0",
                "connection_string": (
                    "clickhousedb://{username}:{password}@{host}:{port}/{database}"
                ),
                "is_recommended": True,
                "notes": (
                    "Official ClickHouse Python driver with native protocol support."
                ),
            },
            {
                "name": "clickhouse-sqlalchemy (Legacy)",
                "pypi_package": "clickhouse-sqlalchemy",
                "connection_string": (
                    "clickhouse://{username}:{password}@{host}:{port}/{database}"
                ),
                "is_recommended": False,
                "notes": (
                    "Older driver using HTTP interface. Use clickhouse-connect "
                    "for new deployments."
                ),
            },
        ],
        "connection_examples": [
            {
                "description": "Altinity Cloud",
                "connection_string": (
                    "clickhousedb://demo:demo@github.demo.trial.altinity.cloud"
                    "/default?secure=true"
                ),
            },
            {
                "description": "Local (no auth, no SSL)",
                "connection_string": "clickhousedb://localhost/default",
            },
        ],
        "install_instructions": (
            'echo "clickhouse-connect>=0.13.0" >> ./docker/requirements-local.txt'
        ),
        "compatible_databases": [
            {
                "name": "ClickHouse Cloud",
                "description": (
                    "ClickHouse Cloud is the official fully-managed cloud service "
                    "for ClickHouse. It provides automatic scaling, built-in "
                    "backups, and enterprise security features."
                ),
                "logo": "clickhouse.png",
                "homepage_url": "https://clickhouse.cloud/",
                "categories": [
                    DatabaseCategory.ANALYTICAL_DATABASES,
                    DatabaseCategory.CLOUD_DATA_WAREHOUSES,
                    DatabaseCategory.HOSTED_OPEN_SOURCE,
                ],
                "pypi_packages": ["clickhouse-connect>=0.13.0"],
                "connection_string": (
                    "clickhousedb://{username}:{password}@{host}:8443/{database}?secure=true"
                ),
                "parameters": {
                    "username": "ClickHouse Cloud username",
                    "password": "ClickHouse Cloud password",
                    "host": "Your ClickHouse Cloud hostname",
                    "database": "Database name (default)",
                },
                "docs_url": "https://clickhouse.com/docs/en/cloud",
            },
            {
                "name": "Altinity.Cloud",
                "description": (
                    "Altinity.Cloud is a managed ClickHouse service providing "
                    "Kubernetes-native deployments with enterprise support."
                ),
                "logo": "altinity.png",
                "homepage_url": "https://altinity.cloud/",
                "categories": [
                    DatabaseCategory.ANALYTICAL_DATABASES,
                    DatabaseCategory.CLOUD_DATA_WAREHOUSES,
                    DatabaseCategory.HOSTED_OPEN_SOURCE,
                ],
                "pypi_packages": ["clickhouse-connect>=0.13.0"],
                "connection_string": (
                    "clickhousedb://{username}:{password}@{host}/{database}?secure=true"
                ),
                "docs_url": "https://docs.altinity.com/",
            },
        ],
    }

    @classmethod
    def get_dbapi_exception_mapping(cls) -> dict[type[Exception], type[Exception]]:
        return {}

    @classmethod
    def get_dbapi_mapped_exception(cls, exception: Exception) -> Exception:
        new_exception = cls.get_dbapi_exception_mapping().get(type(exception))
        if new_exception == SupersetDBAPIDatabaseError:
            return SupersetDBAPIDatabaseError("Connection failed")
        if not new_exception:
            return exception
        return new_exception(str(exception))

    @classmethod
    def get_function_names(cls, database: Database) -> list[str]:
        # pylint: disable=import-outside-toplevel, import-error
        from clickhouse_connect.driver.exceptions import ClickHouseError

        if cls._function_names:
            return cls._function_names
        try:
            names = database.get_df(
                "SELECT name FROM system.functions UNION ALL "  # noqa: S608
                + "SELECT name FROM system.table_functions LIMIT 10000"
            )["name"].tolist()
            cls._function_names = names
            return names
        except ClickHouseError:
            logger.exception("Error retrieving system.functions")
            return []

    @classmethod
    def get_datatype(cls, type_code: str) -> str:
        # keep it lowercase, as ClickHouse types aren't typical SHOUTCASE ANSI SQL
        return type_code

    @classmethod
    def df_to_sql(
        cls,
        database: Database,
        table: Table,
        df: Any,
        to_sql_kwargs: dict[str, Any],
    ) -> None:
        """Upload a DataFrame to ClickHouse.

        ClickHouse requires every table to declare a table engine, which the
        `CREATE TABLE` that pandas' ``to_sql`` emits does not — so instead of
        letting pandas create the table we create it ourselves with a MergeTree
        engine and then append the rows.

        The engine can be tuned per database through its ``extra`` JSON::

            {"clickhouse_file_upload": {
                "order_by": ["col1", "col2"],
                "partition_by": "toYYYYMM(col1)",
                "primary_key": "col1",
                "settings": {"index_granularity": 8192}
            }}

        ``order_by`` defaults to ``tuple()`` (no sort key) so any upload works
        without configuration.
        """
        # pylint: disable=import-outside-toplevel, import-error
        import pandas as pd
        from clickhouse_connect.cc_sqlalchemy.ddl.tableengine import MergeTree
        from sqlalchemy import (
            Column,
            inspect,
            MetaData,
            Table as SqlaTable,
            text,
            types as sqltypes,
        )

        if_exists = to_sql_kwargs.get("if_exists", "fail")

        if to_sql_kwargs.get("index"):
            # Fold the index into columns so the table we create matches what
            # gets inserted; we always append with index=False below. Preserve
            # the uploader's requested index_label as the new column name(s).
            df = df.reset_index(names=to_sql_kwargs.get("index_label"))

        config = (database.get_extra() or {}).get("clickhouse_file_upload", {})
        order_by = config.get("order_by")
        if order_by:
            key_columns = set(
                order_by if isinstance(order_by, (list, tuple)) else [order_by]
            )
            engine_kwargs: dict[str, Any] = {"order_by": order_by}
        else:
            # MergeTree still requires an ORDER BY; an empty tuple means "none".
            key_columns = set()
            engine_kwargs = {"order_by": text("tuple()")}
        for key in ("partition_by", "primary_key", "settings"):
            if config.get(key):
                engine_kwargs[key] = config[key]

        def _column_type(series: Any) -> sqltypes.TypeEngine:
            dtype = series.dtype
            if pd.api.types.is_bool_dtype(dtype):
                return sqltypes.Boolean()
            if pd.api.types.is_integer_dtype(dtype):
                return sqltypes.BigInteger()
            if pd.api.types.is_float_dtype(dtype):
                return sqltypes.Float()
            if pd.api.types.is_datetime64_any_dtype(dtype):
                return sqltypes.DateTime()
            # Object columns may still hold temporal values (e.g. parsed dates),
            # so map those to DateTime to keep date operations working. Anything
            # else falls back to String, matching pandas' default to_sql mapping.
            if pd.api.types.infer_dtype(series, skipna=True) in {
                "datetime",
                "datetime64",
                "date",
            }:
                return sqltypes.DateTime()
            return sqltypes.String()

        with cls.get_engine(
            database, catalog=table.catalog, schema=table.schema
        ) as engine:
            has_table = inspect(engine).has_table(table.table, schema=table.schema)
            if has_table and if_exists == "fail":
                # Raise ValueError so the uploader surfaces its friendly
                # "table already exists" message (see UploadCommand).
                raise ValueError(f"Table {table.table} already exists.")
            if has_table and if_exists == "replace":
                SqlaTable(table.table, MetaData(), schema=table.schema).drop(
                    engine, checkfirst=True
                )
                has_table = False

            if not has_table:
                columns = [
                    Column(
                        str(name),
                        _column_type(df[name]),
                        nullable=str(name) not in key_columns,
                    )
                    for name in df.columns
                ]
                SqlaTable(
                    table.table,
                    MetaData(),
                    *columns,
                    schema=table.schema,
                    clickhouse_engine=MergeTree(**engine_kwargs),
                ).create(engine, checkfirst=True)

            insert_kwargs = {
                **to_sql_kwargs,
                "name": table.table,
                "if_exists": "append",
                "index": False,
            }
            insert_kwargs.pop("index_label", None)
            if table.schema:
                insert_kwargs["schema"] = table.schema
            if (
                engine.dialect.supports_multivalues_insert
                or cls.supports_multivalues_insert
            ):
                insert_kwargs["method"] = "multi"
            df.to_sql(con=engine, **insert_kwargs)

    @classmethod
    def build_sqlalchemy_uri(
        cls,
        parameters: BasicParametersType,
        encrypted_extra: dict[str, str] | None = None,
    ) -> str:
        url_params = parameters.copy()
        if url_params.get("encryption"):
            query = parameters.get("query", {}).copy()
            query.update(cls.encryption_parameters)
            url_params["query"] = query
        if not url_params.get("database"):
            url_params["database"] = "__default__"

        # SQLAlchemy 2.0 made URL.__str__() hide the password by default
        # (it rendered in full under 1.4); render_as_string(hide_password=
        # False) is required here since this URI is stored/used to actually
        # connect, not just displayed.
        return URL.create(
            f"{cls.engine}+{cls.default_driver}",
            username=url_params.get("username"),
            password=url_params.get("password"),
            host=url_params.get("host"),
            port=url_params.get("port"),
            database=url_params.get("database"),
            query=url_params.get("query"),
        ).render_as_string(hide_password=False)

    @classmethod
    def get_parameters_from_uri(
        cls, uri: str, encrypted_extra: dict[str, Any] | None = None
    ) -> BasicParametersType:
        url = make_url_safe(uri)
        query = dict(url.query)
        if "secure" in query:
            encryption = query.get("secure") == "true"
            query.pop("secure")
        else:
            encryption = False
        return BasicParametersType(
            username=url.username,
            password=url.password,
            host=url.host,
            port=url.port,
            database="" if url.database == "__default__" else cast(str, url.database),
            query=query,
            encryption=encryption,
        )

    @classmethod
    def validate_parameters(
        cls, properties: BasicPropertiesType
    ) -> list[SupersetError]:
        # pylint: disable=import-outside-toplevel, import-error
        from clickhouse_connect.driver import default_port

        parameters = properties.get("parameters", {})
        host = parameters.get("host", None)
        if not host:
            return [
                SupersetError(
                    "Hostname is required",
                    SupersetErrorType.CONNECTION_MISSING_PARAMETERS_ERROR,
                    ErrorLevel.WARNING,
                    {"missing": ["host"]},
                )
            ]
        if not is_hostname_valid(host):
            return [
                SupersetError(
                    "The hostname provided can't be resolved.",
                    SupersetErrorType.CONNECTION_INVALID_HOSTNAME_ERROR,
                    ErrorLevel.ERROR,
                    {"invalid": ["host"]},
                )
            ]
        port = parameters.get("port")
        if port is None:
            port = default_port("http", parameters.get("encryption", False))
        try:
            port = int(port)
        except (ValueError, TypeError):
            port = -1
        if port <= 0 or port >= 65535:
            return [
                SupersetError(
                    "Port must be a valid integer between 0 and 65535 (inclusive).",
                    SupersetErrorType.CONNECTION_INVALID_PORT_ERROR,
                    ErrorLevel.ERROR,
                    {"invalid": ["port"]},
                )
            ]
        if not is_port_open(host, port):
            return [
                SupersetError(
                    "The port is closed.",
                    SupersetErrorType.CONNECTION_PORT_CLOSED_ERROR,
                    ErrorLevel.ERROR,
                    {"invalid": ["port"]},
                )
            ]
        return []

    @classmethod
    def adjust_engine_params(
        cls,
        uri: URL,
        connect_args: dict[str, Any],
        catalog: str | None = None,
        schema: str | None = None,
    ) -> tuple[URL, dict[str, Any]]:
        if schema:
            uri = uri.set(database=parse.quote(schema, safe=""))
        return uri, connect_args

    @classmethod
    def get_column_description_retry_sql(cls, sql: str) -> str | None:
        # clickhouse-connect's cursor only backfills `cursor.description` for
        # a zero-row result -- e.g. the `WHERE false` probe used to detect an
        # adhoc column's type without scanning any rows -- when the operation
        # string starts with SELECT/WITH after stripping whitespace. Leading
        # SQL comments inserted by SQL_QUERY_MUTATOR (e.g. query attribution)
        # defeat that check, so wrap the untouched, already-mutated SQL in a
        # bare outer SELECT to satisfy it without altering or dropping any of
        # the mutator's comments.
        return f"SELECT * FROM (\n{sql}\n) AS __superset_type_probe LIMIT 0"  # noqa: S608
