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

# ruff: noqa: S608

from __future__ import annotations

import itertools
import re
from collections import defaultdict
from textwrap import dedent
from typing import Any, Literal, Sequence, Union

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from pandas import DataFrame
from pydantic import (
    BaseModel,
    ConfigDict,
    create_model,
    Field,
    model_validator,
    SecretStr,
)
from snowflake.connector import connect, DictCursor
from snowflake.connector.connection import SnowflakeConnection
from snowflake.sqlalchemy.snowdialect import SnowflakeDialect

from superset.exceptions import SupersetParseError
from superset.semantic_layers.types import (
    AdhocExpression,
    AdhocFilter,
    BINARY,
    BOOLEAN,
    DATE,
    DATETIME,
    DECIMAL,
    Dimension,
    Filter,
    FilterValues,
    GroupLimit,
    INTEGER,
    Metric,
    NUMBER,
    OBJECT,
    Operator,
    OrderDirection,
    OrderTuple,
    PredicateType,
    SemanticRequest,
    SemanticResult,
    SemanticViewFeature,
    STRING,
    TIME,
    Type,
)
from superset.sql.parse import SQLStatement

REQUEST_TYPE = "snowflake"


def substitute_parameters(query: str, parameters: Sequence[Any] | None) -> str:
    """Substitute parametereters for logging only - NOT for execution"""
    if not parameters:
        return query

    result = query
    for parameter in parameters:
        if parameter is None:
            replacement = "NULL"
        elif isinstance(parameter, (int, float)):
            replacement = str(parameter)
        elif isinstance(parameter, bool):
            replacement = str(parameter).upper()
        else:
            # String - escape single quotes
            quoted = str(parameter).replace("'", "''")
            replacement = f"'{quoted}'"

        result = result.replace("?", replacement, 1)

    return result


def validate_order_by(definition: str) -> None:
    """
    Validate that an ORDER BY expression is safe to use.

    Note that `definition` could contain multiple expressions separated by commas.
    """
    try:
        # this ensures that we have a single statement, preventing SQL injection via a
        # semicolon in the order by clause
        SQLStatement(f"SELECT 1 ORDER BY {definition}", "snowflake")
    except SupersetParseError as ex:
        raise ValueError("Invalid ORDER BY expression") from ex


class UserPasswordAuth(BaseModel):
    """
    Username and password authentication.
    """

    model_config = ConfigDict(title="Username and password")

    auth_type: Literal["user_password"] = "user_password"
    username: str = Field(description="The username to authenticate as.")
    password: SecretStr = Field(
        description="The password to authenticate with.",
        repr=False,
    )


class PrivateKeyAuth(BaseModel):
    """
    Private key authentication.
    """

    model_config = ConfigDict(title="Private key")

    auth_type: Literal["private_key"] = "private_key"
    private_key: SecretStr = Field(
        description="The private key to authenticate with, in PEM format.",
        repr=False,
    )
    private_key_password: SecretStr = Field(
        description="The password to decrypt the private key with.",
        repr=False,
    )


class SnowflakeConfiguration(BaseModel):
    """
    Parameters needed to connect to Snowflake.
    """

    # account is the only required parameter
    account_identifier: str = Field(
        description="The Snowflake account identifier.",
        json_schema_extra={"examples": ["abc12345"]},
    )

    role: str | None = Field(
        default=None,
        description="The default role to use.",
        json_schema_extra={"examples": ["myrole"]},
    )
    warehouse: str | None = Field(
        default=None,
        description="The default warehouse to use.",
        json_schema_extra={"examples": ["testwh"]},
    )

    auth: Union[UserPasswordAuth, PrivateKeyAuth] = Field(
        discriminator="auth_type",
        description="Authentication method",
    )

    # database and schema can be optionally provided; if not provided the user
    # will be able to browse databases/schemas
    database: str | None = Field(
        default=None,
        description="The default database to use.",
        json_schema_extra={
            "examples": ["testdb"],
            "x-dynamic": True,
            "x-dependsOn": ["account_identifier", "auth"],
        },
    )
    allow_changing_database: bool = Field(
        default=False,
        description="Allow changing the default database.",
    )
    schema_: str | None = Field(
        default=None,
        description="The default schema to use.",
        json_schema_extra={
            "examples": ["public"],
            "x-dynamic": True,
            "x-dependsOn": ["account_identifier", "auth", "database"],
        },
        # `schema` is an attribute of `BaseModel` so it needs to be aliased
        alias="schema",
    )
    allow_changing_schema: bool = Field(
        default=False,
        description="Allow changing the default schema.",
    )

    @model_validator(mode="after")
    def validate_database_schema_settings(self) -> SnowflakeConfiguration:
        """
        Validate that if database or schema is not specified, the corresponding
        allow_changing flag must be true.
        """
        if not self.database and not self.allow_changing_database:
            raise ValueError(
                "If no database is specified, allow_changing_database must be true"
            )
        if not self.schema_ and not self.allow_changing_schema:
            raise ValueError(
                "If no schema is specified, allow_changing_schema must be true"
            )
        return self


def get_connection_parameters(configuration: SnowflakeConfiguration) -> dict[str, Any]:
    """
    Convert the configuration to connection parameters for the Snowflake connector.
    """
    params = {
        "account": configuration.account_identifier,
        "application": "Apache Superset",
        "paramstyle": "qmark",
        "insecure_mode": True,
    }

    if configuration.role:
        params["role"] = configuration.role
    if configuration.warehouse:
        params["warehouse"] = configuration.warehouse
    if configuration.database:
        params["database"] = configuration.database
    if configuration.schema_:
        params["schema"] = configuration.schema_

    auth = configuration.auth
    if isinstance(auth, UserPasswordAuth):
        params["user"] = auth.username
        params["password"] = auth.password.get_secret_value()
    elif isinstance(auth, PrivateKeyAuth):
        pem_private_key = serialization.load_pem_private_key(
            auth.private_key.encode(),
            password=(
                auth.private_key_password.encode()
                if auth.private_key_password
                else None
            ),
            backend=default_backend(),
        )
        params["private_key"] = pem_private_key.private_bytes(
            encoding=serialization.Encoding.DER,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        )
    else:
        raise ValueError("Unsupported authentication method")

    return params


class SnowflakeSemanticLayer:
    configuration_schema = SnowflakeConfiguration

    @classmethod
    def get_configuration_schema(
        cls,
        configuration: SnowflakeConfiguration | None = None,
    ) -> dict[str, Any]:
        """
        Get the JSON schema for the configuration needed to add the semantic layer.

        A partial configuration can be sent to improve the schema. For example,
        providing account and auth will allow the schema to provide a list of
        databases; providing a database will allow the schema to provide a list of
        schemas.

        Note that database and schema can both be left empty when the semantic layer is
        added to Superset; the user will then have to provide them when loading
        semantic views.
        """
        schema = cls.configuration_schema.model_json_schema()
        properties = schema["properties"]

        if configuration is None:
            # set these to empty; they will be populated when a partial configuration is
            # passed
            properties["database"]["enum"] = []
            properties["schema"]["enum"] = []

            return schema

        connection_parameters = get_connection_parameters(configuration)
        with connect(**connection_parameters) as connection:
            if all(
                getattr(configuration, dependency)
                for dependency in properties["database"].get("x-dependsOn", [])
            ):
                options = cls._fetch_databases(connection)
                properties["database"]["enum"] = list(options)

            if (
                all(
                    getattr(configuration, dependency)
                    for dependency in properties["schema"].get("x-dependsOn", [])
                )
                and configuration.database
            ):
                options = cls._fetch_schemas(connection, configuration.database)
                properties["schema"]["enum"] = list(options)

        return schema

    @classmethod
    def get_runtime_schema(
        cls,
        configuration: SnowflakeConfiguration,
        runtime_data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Get the JSON schema for the runtime parameters needed to load semantic views.

        The schema can be enriched with actual values when `runtime_data` is provided,
        enabling dynamic schema updates (e.g., populating schema dropdown after
        database is selected).
        """
        fields: dict[str, tuple[Any, Field]] = {}

        # update configuration with runtime data, for example, to select a schema after
        # the database has been selected
        configuration = configuration.model_copy(update=runtime_data)

        connection_parameters = get_connection_parameters(configuration)
        with connect(**connection_parameters) as connection:
            if not configuration.database or configuration.allow_changing_database:
                options = cls._fetch_databases(connection)
                fields["database"] = (
                    Literal[*options],
                    Field(description="The default database to use."),
                )

            if not configuration.schema_ or configuration.allow_changing_schema:
                if configuration.database:
                    options = cls._fetch_schemas(connection, configuration.database)
                    fields["schema_"] = (
                        Literal[*options],
                        Field(
                            description="The default schema to use.",
                            alias="schema",
                            json_schema_extra=(
                                {
                                    "x-dynamic": True,
                                    "x-dependsOn": ["database"],
                                }
                                if "database" in fields
                                else {}
                            ),
                        ),
                    )
                else:
                    # Database not provided yet, add schema as empty
                    # (will be populated dynamically)
                    fields["schema_"] = (
                        str | None,
                        Field(
                            default=None,
                            description="The default schema to use.",
                            alias="schema",
                            json_schema_extra={
                                "x-dynamic": True,
                                "x-dependsOn": ["database"],
                            },
                        ),
                    )

        return create_model("RuntimeParameters", **fields).model_json_schema()

    @classmethod
    def _fetch_databases(cls, connection: SnowflakeConnection) -> set[str]:
        """
        Fetch the list of databases available in the Snowflake account.

        We use `SHOW DATABASES` instead of querying the information schema since it
        allows to retrieve the list of databases without having to specify a database
        when connecting.
        """
        cursor = connection.cursor()
        cursor.execute("SHOW DATABASES")
        return {row[1] for row in cursor}

    @classmethod
    def _fetch_schemas(
        cls,
        connection: SnowflakeConnection,
        database: str | None,
    ) -> set[str]:
        """
        Fetch the list of schemas available in a given database.

        The connection should already have the database set in its context.
        """
        if not database:
            return set()

        cursor = connection.cursor()
        query = dedent(
            """
            SELECT SCHEMA_NAME
            FROM INFORMATION_SCHEMA.SCHEMATA
            WHERE CATALOG_NAME = ?
            """
        )
        return {row[0] for row in cursor.execute(query, (database,))}

    def __init__(self, configuration: SnowflakeConfiguration):
        self.configuration = configuration

    def get_semantic_views(
        self,
        runtime_configuration: BaseModel,
    ) -> set[SnowflakeSemanticView]:
        """
        Get the semantic views available in the semantic layer.
        """
        # create a new configuration with the runtime parameters
        configuration = self.configuration.model_copy(
            update=runtime_configuration.model_dump()
        )

        connection_parameters = get_connection_parameters(configuration)
        with connect(**connection_parameters) as connection:
            cursor = connection.cursor()
            query = dedent(
                """
                SHOW SEMANTIC VIEWS
                    ->> SELECT "name" FROM $1;
                """
            )
            return {
                SnowflakeSemanticView(configuration, row[0])
                for row in cursor.execute(query)
            }


class SnowflakeSemanticView:

    features = frozenset(
        {
            SemanticViewFeature.ADHOC_EXPRESSIONS_IN_ORDERBY,
            SemanticViewFeature.GROUP_LIMIT,
            SemanticViewFeature.GROUP_OTHERS,
        }
    )

    def __init__(self, configuration: SnowflakeConfiguration, name: str):
        self.configuration = configuration
        self.name = name

        self._quote = SnowflakeDialect().identifier_preparer.quote

        self.dimensions = self.get_dimensions()
        self.metrics = self.get_metrics()

    def uid(self) -> str:
        return ".".join(
            self._quote(part)
            for part in (
                self.configuration.database,
                self.configuration.schema_,
                self.name,
            )
        )

    def get_dimensions(self) -> set[Dimension]:
        """
        Get the dimensions defined in the semantic view.

        Even though Snowflake supports `SHOW SEMANTIC DIMENSIONS IN my_semantic_view`,
        it doesn't return the expression of dimensions, so we use a slightly more
        complicated query to get all the information we need in one go.
        """
        dimensions: set[Dimension] = set()

        query = dedent(
            f"""
            DESC SEMANTIC VIEW {self.uid()}
                ->> SELECT "object_name", "property", "property_value"
                    FROM $1
                    WHERE
                        "object_kind" = 'DIMENSION' AND
                        "property" IN ('COMMENT', 'DATA_TYPE', 'EXPRESSION', 'TABLE');
            """
        )

        connection_parameters = get_connection_parameters(self.configuration)
        with connect(**connection_parameters) as connection:
            cursor = connection.cursor(DictCursor)
            rows = cursor.execute(query).fetchall()

        for name, group in itertools.groupby(rows, key=lambda x: x["object_name"]):
            attributes = defaultdict(set)
            for row in group:
                attributes[row["property"]].add(row["property_value"])

            table = next(iter(attributes["TABLE"]))
            id_ = table + "." + name
            type_ = self._get_type(next(iter(attributes["DATA_TYPE"])))
            description = next(iter(attributes["COMMENT"]), None)
            definition = next(iter(attributes["EXPRESSION"]), None)

            dimensions.add(Dimension(id_, name, type_, description, definition))

        return dimensions

    def get_metrics(self) -> set[Metric]:
        """
        Get the metrics defined in the semantic view.
        """
        metrics: set[Metric] = set()

        query = dedent(
            f"""
            DESC SEMANTIC VIEW {self.uid()}
                ->> SELECT "object_name", "property", "property_value"
                    FROM $1
                    WHERE
                        "object_kind" = 'METRIC' AND
                        "property" IN ('COMMENT', 'DATA_TYPE', 'EXPRESSION', 'TABLE');
            """
        )

        connection_parameters = get_connection_parameters(self.configuration)
        with connect(**connection_parameters) as connection:
            cursor = connection.cursor(DictCursor)
            rows = cursor.execute(query).fetchall()

        for name, group in itertools.groupby(rows, key=lambda x: x["object_name"]):
            attributes = defaultdict(set)
            for row in group:
                attributes[row["property"]].add(row["property_value"])

            table = next(iter(attributes["TABLE"]))
            id_ = table + "." + name
            type_ = self._get_type(next(iter(attributes["DATA_TYPE"])))
            description = next(iter(attributes["COMMENT"]), None)
            definition = next(iter(attributes["EXPRESSION"]), None)

            metrics.add(Metric(id_, name, type_, definition, description))

        return metrics

    def _get_type(self, snowflake_type: str | None) -> type[Type]:
        """
        Return the semantic type corresponding to a Snowflake type.
        """
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

    def _build_predicates(
        self,
        filters: set[Filter | AdhocFilter],
    ) -> tuple[str, tuple[FilterValues]]:
        """
        Convert a set of filters to a single `AND`ed predicate.

        Caller should check the types of filters beforehand, as this method does not
        differentiate between `WHERE` and `HAVING` predicates.
        """
        if not filters:
            return "", ()

        # convert filters predicate with associated parameters; native filters are
        # already strings, so we keep them as-is
        unary_operators = {Operator.IS_NULL, Operator.IS_NOT_NULL}
        predicates: list[str] = []
        parameters: list[FilterValues] = []
        for filter_ in filters or set():
            if isinstance(filter_, AdhocFilter):
                predicates.append(f"({filter_.definition})")
            else:
                predicates.append(f"({self._build_native_filter(filter_)})")
                if filter_.operator not in unary_operators:
                    parameters.extend(
                        [filter_.value]
                        if not isinstance(filter_.value, frozenset)
                        else filter_.value
                    )

        return " AND ".join(predicates), tuple(parameters)

    def get_values(
        self,
        dimension: Dimension,
        filters: set[Filter | AdhocFilter] | None = None,
    ) -> SemanticResult:
        """
        Return distinct values for a dimension.
        """
        where_clause, parameters = self._build_predicates(
            {
                filter_
                for filter_ in (filters or [])
                if filter_.type == PredicateType.WHERE
            }
        )
        query = dedent(
            f"""
            SELECT {self._quote(dimension.name)}
            FROM SEMANTIC_VIEW(
                {self.uid()}
                DIMENSIONS {dimension.id}
                {"WHERE " + where_clause if where_clause else ""}
            )
            """
        )
        connection_parameters = get_connection_parameters(self.configuration)
        with connect(**connection_parameters) as connection:
            df = connection.cursor().execute(query, parameters).fetch_pandas_all()

        return SemanticResult(
            requests=[
                SemanticRequest(
                    REQUEST_TYPE,
                    substitute_parameters(query, parameters),
                )
            ],
            results=df,
        )

    def _build_native_filter(self, filter_: Filter) -> str:
        """
        Convert a Filter to a AdhocFilter.
        """
        column = filter_.column
        operator = filter_.operator
        value = filter_.value

        column_name = self._quote(column.name)

        # Handle IS NULL and IS NOT NULL operators (no value needed)
        if operator in {Operator.IS_NULL, Operator.IS_NOT_NULL}:
            return f"{column_name} {operator.value}"

        # Handle IN and NOT IN operators (set values)
        if operator in {Operator.IN, Operator.NOT_IN}:
            if not isinstance(value, frozenset):
                value = {value}
            formatted_values = ", ".join("?" for _ in value)
            return f"{column_name} {operator.value} ({formatted_values})"

        return f"{column_name} {operator.value} ?"

    def get_dataframe(
        self,
        metrics: list[Metric],
        dimensions: list[Dimension],
        filters: set[Filter | AdhocFilter] | None = None,
        order: list[OrderTuple] | None = None,
        limit: int | None = None,
        offset: int | None = None,
        *,
        group_limit: GroupLimit | None = None,
    ) -> SemanticResult:
        """
        Execute a query and return the results as a Pandas DataFrame.
        """
        if not metrics and not dimensions:
            return DataFrame()

        query, parameters = self._get_query(
            metrics,
            dimensions,
            filters,
            order,
            limit,
            offset,
            group_limit,
        )
        connection_parameters = get_connection_parameters(self.configuration)
        with connect(**connection_parameters) as connection:
            df = connection.cursor().execute(query, parameters).fetch_pandas_all()

        return SemanticResult(
            requests=[
                SemanticRequest(
                    REQUEST_TYPE,
                    substitute_parameters(query, parameters),
                )
            ],
            results=df,
        )

    def get_row_count(
        self,
        metrics: list[Metric],
        dimensions: list[Dimension],
        filters: set[Filter | AdhocFilter] | None = None,
        order: list[OrderTuple] | None = None,
        limit: int | None = None,
        offset: int | None = None,
        *,
        group_limit: GroupLimit | None = None,
    ) -> int:
        """
        Execute a query and return the number of rows the result would have.
        """
        if not metrics and not dimensions:
            return 0

        query, parameters = self._get_query(
            metrics,
            dimensions,
            filters,
            order,
            limit,
            offset,
            group_limit,
        )
        query = f"SELECT COUNT(*) FROM ({query}) AS subquery"
        connection_parameters = get_connection_parameters(self.configuration)
        with connect(**connection_parameters) as connection:
            df = connection.cursor().execute(query, parameters).fechone()[0]

        return SemanticResult(
            requests=[
                SemanticRequest(
                    REQUEST_TYPE,
                    substitute_parameters(query, parameters),
                )
            ],
            results=df,
        )

    def _get_query(
        self,
        metrics: list[Metric],
        dimensions: list[Dimension],
        filters: set[Filter | AdhocFilter] | None = None,
        order: list[OrderTuple] | None = None,
        limit: int | None = None,
        offset: int | None = None,
        group_limit: GroupLimit | None = None,
    ) -> tuple[str, tuple[FilterValues]]:
        """
        Build a query to fetch data from the semantic view.

        This also returns the parameters need to run `cursor.execute()`, passed
        separately to prevent SQL injection.
        """
        filters = filters or set()
        where_clause, where_parameters = self._build_predicates(
            {filter_ for filter_ in filters if filter_.type == PredicateType.WHERE}
        )
        having_clause, having_parameters = self._build_predicates(
            {filter_ for filter_ in filters if filter_.type == PredicateType.HAVING}
        )

        if group_limit:
            query = self._build_query_with_group_limit(
                metrics,
                dimensions,
                where_clause,
                having_clause,
                order,
                limit,
                offset,
                group_limit,
            )
        else:
            query = self._build_simple_query(
                metrics,
                dimensions,
                where_clause,
                having_clause,
                order,
                limit,
                offset,
            )

        return query, where_parameters + having_parameters

    def _alias_element(self, element: Metric | Dimension) -> str:
        """
        Generate an aliased column expression for a metric or dimension.
        """
        return f"{element.id} AS {self._quote(element.id)}"

    def _build_order_clause(
        self,
        order: list[OrderTuple] | None = None,
    ) -> str:
        """
        Build the ORDER BY clause from a list of (element, direction) tuples.

        Note that for adhoc expressions, Superset will still add `ASC` or `DESC` to the
        end, which means adhoc expressions can contain multiple columns as long as the
        last one has no direction specified.

        This is fine:

            gender ASC, COUNT(*)

        But this is not

            gender ASC, COUNT(*) DESC

        The latter will produce a query that looks like this:

            ... ORDER BY gender ASC, COUNT(*) DESC DESC

        """
        if not order:
            return ""

        def build_element(element: Metric | Dimension | AdhocExpression) -> str:
            if isinstance(element, AdhocExpression):
                validate_order_by(element.definition)
                return element.definition
            return self._quote(element.id)

        return ", ".join(
            f"{build_element(element)} {direction.value}"
            for element, direction in order
        )

    def _build_simple_query(
        self,
        metrics: list[Metric],
        dimensions: list[Dimension],
        where_clause: str,
        having_clause: str,
        order: list[OrderTuple] | None,
        limit: int | None,
        offset: int | None,
    ) -> str:
        """
        Build a query without group limiting.
        """
        dimension_arguments = ", ".join(
            self._alias_element(dimension) for dimension in dimensions
        )
        metric_arguments = ", ".join(self._alias_element(metric) for metric in metrics)
        order_clause = self._build_order_clause(order)

        return dedent(
            f"""
            SELECT * FROM SEMANTIC_VIEW(
                {self.uid()}
                {"DIMENSIONS " + dimension_arguments if dimension_arguments else ""}
                {"METRICS " + metric_arguments if metric_arguments else ""}
                {"WHERE " + where_clause if where_clause else ""}
            )
            {"HAVING " + having_clause if having_clause else ""}
            {"ORDER BY " + order_clause if order_clause else ""}
            {"LIMIT " + str(limit) if limit is not None else ""}
            {"OFFSET " + str(offset) if offset is not None else ""}
            """
        )

    def _build_top_groups_cte(
        self,
        group_limit: GroupLimit,
        where_clause: str,
        having_clause: str,
    ) -> str:
        """
        Build a CTE that finds the top N combinations of limited dimensions.
        """
        limited_dimension_arguments = ", ".join(
            self._alias_element(dimension) for dimension in group_limit.dimensions
        )
        limited_dimension_names = ", ".join(
            self._quote(dimension.id) for dimension in group_limit.dimensions
        )

        return dedent(
            f"""
            WITH top_groups AS (
                SELECT {limited_dimension_names}
                FROM SEMANTIC_VIEW(
                    {self.uid()}
                    DIMENSIONS {limited_dimension_arguments}
                    METRICS {group_limit.metric.id}
                        AS {self._quote(group_limit.metric.id)}
                    {"WHERE " + where_clause if where_clause else ""}
                )
                {"HAVING " + having_clause if having_clause else ""}
                ORDER BY
                    {self._quote(group_limit.metric.id)} {group_limit.direction.value}
                LIMIT {group_limit.top}
            )
            """
        )

    def _build_group_filter(self, group_limit: GroupLimit) -> str:
        """
        Build a WHERE filter that restricts results to top N groups.
        """
        if len(group_limit.dimensions) == 1:
            dimension_id = self._quote(group_limit.dimensions[0].id)
            return f"{dimension_id} IN (SELECT {dimension_id} FROM top_groups)"

        # Multi-column IN clause
        dimension_tuple = ", ".join(
            self._quote(dim.id) for dim in group_limit.dimensions
        )
        return f"({dimension_tuple}) IN (SELECT {dimension_tuple} FROM top_groups)"

    def _build_case_expression(
        self,
        dimension: Dimension,
        group_condition: str,
    ) -> str:
        """
        Build a CASE expression that replaces non-top values with 'Other'.

        Args:
            dimension: The dimension to build the CASE for
            group_condition: The condition to check if value is in top groups
                            (e.g., "staff_id IN (SELECT staff_id FROM top_groups)")

        Returns:
            SQL CASE expression
        """
        dimension_id = self._quote(dimension.id)
        return f"""CASE
            WHEN {group_condition} THEN {dimension_id}
            ELSE CAST('Other' AS VARCHAR)
        END"""

    def _build_query_with_others(
        self,
        metrics: list[Metric],
        dimensions: list[Dimension],
        where_clause: str,
        having_clause: str,
        order: list[OrderTuple] | None,
        limit: int | None,
        offset: int | None,
        group_limit: GroupLimit,
    ) -> str:
        """
        Build a query that groups non-top N values as 'Other'.

        This uses a two-stage approach:
        1. CTE to find top N groups
        2. Subquery with CASE expressions to replace non-top values with 'Other'
        3. Outer query to re-aggregate with the new grouping
        """
        top_groups_cte = self._build_top_groups_cte(
            group_limit,
            where_clause,
            having_clause,
        )

        # Determine which dimensions are limited vs non-limited
        limited_dimension_ids = {dim.id for dim in group_limit.dimensions}
        non_limited_dimensions = [
            dim for dim in dimensions if dim.id not in limited_dimension_ids
        ]

        # Build the group condition for CASE expressions
        if len(group_limit.dimensions) == 1:
            dimension_id = self._quote(group_limit.dimensions[0].id)
            group_condition = (
                f"{dimension_id} IN (SELECT {dimension_id} FROM top_groups)"
            )
        else:
            dimension_tuple = ", ".join(
                self._quote(dim.id) for dim in group_limit.dimensions
            )
            group_condition = (
                f"({dimension_tuple}) IN (SELECT {dimension_tuple} FROM top_groups)"
            )

        # Build CASE expressions for limited dimensions
        case_expressions = []
        case_expressions_for_groupby = []
        for dim in group_limit.dimensions:
            case_expr = self._build_case_expression(dim, group_condition)
            alias = self._quote(dim.id)
            case_expressions.append(f"{case_expr} AS {alias}")
            # Store the full CASE expression for GROUP BY (not just alias)
            case_expressions_for_groupby.append(case_expr)

        # Build SELECT for non-limited dimensions (pass through)
        non_limited_selects = [
            f"{self._quote(dim.id)} AS {self._quote(dim.id)}"
            for dim in non_limited_dimensions
        ]

        # Build metric aggregations
        metric_aggregations = [
            f"SUM({self._quote(metric.id)}) AS {self._quote(metric.id)}"
            for metric in metrics
        ]

        # Build the subquery that gets raw data from SEMANTIC_VIEW
        dimension_arguments = ", ".join(
            self._alias_element(dimension) for dimension in dimensions
        )
        metric_arguments = ", ".join(self._alias_element(metric) for metric in metrics)

        subquery = dedent(
            f"""
            raw_data AS (
                SELECT * FROM SEMANTIC_VIEW(
                    {self.uid()}
                    DIMENSIONS {dimension_arguments}
                    METRICS {metric_arguments}
                    {"WHERE " + where_clause if where_clause else ""}
                )
                {"HAVING " + having_clause if having_clause else ""}
            )
            """
        )

        # Build GROUP BY clause (full CASE expressions + non-limited dimensions)
        # We need to repeat the full CASE expressions, not use aliases, because
        # Snowflake may interpret the alias as the original column reference
        group_by_columns = case_expressions_for_groupby + [
            self._quote(dim.id) for dim in non_limited_dimensions
        ]
        group_by_clause = ", ".join(group_by_columns)

        # Build final SELECT columns
        select_columns = case_expressions + non_limited_selects + metric_aggregations
        select_clause = ",\n    ".join(select_columns)

        # Build ORDER BY clause (need to reference the aliased columns)
        order_clause = self._build_order_clause(order)

        return dedent(
            f"""
            {top_groups_cte},
            {subquery}
            SELECT
                {select_clause}
            FROM raw_data
            GROUP BY {group_by_clause}
            {"ORDER BY " + order_clause if order_clause else ""}
            {"LIMIT " + str(limit) if limit is not None else ""}
            {"OFFSET " + str(offset) if offset is not None else ""}
            """
        )

    def _build_query_with_group_limit(
        self,
        metrics: list[Metric],
        dimensions: list[Dimension],
        where_clause: str,
        having_clause: str,
        order: list[OrderTuple] | None,
        limit: int | None,
        offset: int | None,
        group_limit: GroupLimit,
    ) -> str:
        """
        Build a query with group limiting (top N groups).

        If group_others is True, groups non-top values as 'Other'.
        Otherwise, filters to show only top N groups.
        """
        if group_limit.group_others:
            return self._build_query_with_others(
                metrics,
                dimensions,
                where_clause,
                having_clause,
                order,
                limit,
                offset,
                group_limit,
            )

        # Standard group limiting: just filter to top N groups
        # We can't use CTE references inside SEMANTIC_VIEW(), so we wrap it
        dimension_arguments = ", ".join(
            self._alias_element(dimension) for dimension in dimensions
        )
        metric_arguments = ", ".join(self._alias_element(metric) for metric in metrics)
        order_clause = self._build_order_clause(order)

        top_groups_cte = self._build_top_groups_cte(
            group_limit,
            where_clause,
            having_clause,
        )
        group_filter = self._build_group_filter(group_limit)

        return dedent(
            f"""
            {top_groups_cte}
            SELECT * FROM (
                SELECT * FROM SEMANTIC_VIEW(
                    {self.uid()}
                    {"DIMENSIONS " + dimension_arguments if dimension_arguments else ""}
                    {"METRICS " + metric_arguments if metric_arguments else ""}
                    {"WHERE " + where_clause if where_clause else ""}
                )
                {"HAVING " + having_clause if having_clause else ""}
            ) AS subquery
            WHERE {group_filter}
            {"ORDER BY " + order_clause if order_clause else ""}
            {"LIMIT " + str(limit) if limit is not None else ""}
            {"OFFSET " + str(offset) if offset is not None else ""}
            """
        )

    __repr__ = uid


if __name__ == "__main__":
    import os

    configuration = SnowflakeConfiguration.model_validate(
        {
            "account_identifier": "hxjhxcj-oxc09268",
            "role": "ACCOUNTADMIN",
            "warehouse": "COMPUTE_WH",
            "database": "SAMPLE_DATA",
            "schema": "TPCDS_SF10TCL",
            "auth": {
                "auth_type": "user_password",
                "username": os.environ["SNOWFLAKE_USER"],
                "password": os.environ["SNOWFLAKE_PASSWORD"],
            },
            "allow_changing_database": True,
            "allow_changing_schema": True,
        }
    )
    semantic_layer = SnowflakeSemanticLayer(configuration)
    runtime_configuration = create_model(
        "RuntimeParameters",
        database=(Literal["SAMPLE_DATA"], Field()),
        schema_=(Literal["TPCDS_SF10TCL"], Field(alias="schema")),
    ).model_validate(
        {
            "database": "SAMPLE_DATA",
            "schema": "TPCDS_SF10TCL",
        }
    )
    semantic_views = semantic_layer.get_semantic_views(runtime_configuration)
    print(semantic_views)
    semantic_view = next(iter(semantic_views))
    print("DIMENSIONS")
    print("==========")
    for dimension in semantic_view.get_dimensions():
        print(dimension)
    print("METRICS")
    print("=======")
    for metric in semantic_view.get_metrics():
        print(metric)
    print("VALUES")
    print("======")
    dimension = Dimension(
        id="ITEM.CATEGORY",
        name="CATEGORY",
        type=STRING,
        description=None,
        definition="I_CATEGORY",
        grain=None,
    )
    print(semantic_view.get_values(dimension))
    filters = {
        Filter(PredicateType.WHERE, dimension, Operator.IS_NOT_NULL, None),
        Filter(PredicateType.WHERE, dimension, Operator.NOT_EQUALS, "Books"),
    }
    print(semantic_view.get_values(dimension, filters))
    import sys

    sys.exit()
    filters = {
        Filter(
            PredicateType.WHERE,
            dimension,
            Operator.IN,
            frozenset({"Children", "Electronics"}),
        ),
    }
    print(semantic_view.get_values(dimension, filters))
    print(
        semantic_view.get_dataframe(
            [
                Metric(
                    "STORESALES.TOTALSALESPRICE",
                    "TOTALSALESPRICE",
                    NUMBER,
                    None,
                    None,
                ),
            ],
            [
                Dimension(
                    id="DATE.YEAR",
                    name="YEAR",
                    type=INTEGER,
                    description=None,
                    definition=None,
                    grain=None,
                ),
                Dimension(
                    id="ITEM.CATEGORY",
                    name="CATEGORY",
                    type=STRING,
                    description=None,
                    definition="I_CATEGORY",
                    grain=None,
                ),
            ],
            {
                AdhocFilter(PredicateType.WHERE, "Year = '2002'"),
                AdhocFilter(PredicateType.WHERE, "Month = '12'"),
            },
        )
    )

    # Example 1: Group limiting without group_others
    print("\n" + "=" * 80)
    print("EXAMPLE 1: Group Limiting (group_others=False)")
    print("Top 3 categories by total sales price")
    print("=" * 80)

    year_dim = Dimension(
        id="DATE.YEAR",
        name="YEAR",
        type=INTEGER,
        description=None,
        definition=None,
        grain=None,
    )
    category_dim = Dimension(
        id="ITEM.CATEGORY",
        name="CATEGORY",
        type=STRING,
        description=None,
        definition="I_CATEGORY",
        grain=None,
    )
    sales_metric = Metric(
        "STORESALES.TOTALSALESPRICE",
        "TOTALSALESPRICE",
        NUMBER,
        None,
        None,
    )

    query_without_others, _ = semantic_view._get_query(
        metrics=[sales_metric],
        dimensions=[year_dim, category_dim],
        filters={
            AdhocFilter(PredicateType.WHERE, "Year = '2002'"),
            AdhocFilter(PredicateType.WHERE, "Month = '12'"),
        },
        group_limit=GroupLimit(
            dimensions=[category_dim],
            top=3,
            metric=sales_metric,
            direction=OrderDirection.DESC,
            group_others=False,
        ),
    )
    print(query_without_others)

    # Example 2: Group limiting with group_others
    print("\n" + "=" * 80)
    print("EXAMPLE 2: Group Limiting (group_others=True)")
    print("Top 3 categories by total sales price + 'Other'")
    print("=" * 80)

    query_with_others, _ = semantic_view._get_query(
        metrics=[sales_metric],
        dimensions=[year_dim, category_dim],
        filters={
            AdhocFilter(PredicateType.WHERE, "Year = '2002'"),
            AdhocFilter(PredicateType.WHERE, "Month = '12'"),
        },
        group_limit=GroupLimit(
            dimensions=[category_dim],
            top=3,
            metric=sales_metric,
            direction=OrderDirection.DESC,
            group_others=True,
        ),
    )
    print(query_with_others)
