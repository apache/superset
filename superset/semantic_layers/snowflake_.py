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
import re
from collections import defaultdict
from typing import Any, Literal, Union

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
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

from superset.semantic_layers.types import (
    BINARY,
    BOOLEAN,
    DATE,
    DATETIME,
    DECIMAL,
    Dimension,
    Filter,
    INTEGER,
    Metric,
    NativeFilter,
    NUMBER,
    OBJECT,
    STRING,
    TIME,
    Type,
)


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
        explorables.
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

            if all(
                getattr(configuration, dependency)
                for dependency in properties["schema"].get("x-dependsOn", [])
            ):
                options = cls._fetch_schemas(connection, configuration.database)
                properties["schema"]["enum"] = list(options)

        return schema

    @classmethod
    def get_runtime_schema(
        cls,
        configuration: SnowflakeConfiguration,
    ) -> dict[str, Any]:
        """
        Get the JSON schema for the runtime parameters needed to load explorables.
        """
        fields: dict[str, tuple[type, Field]] = {}

        connection_parameters = get_connection_parameters(configuration)
        with connect(**connection_parameters) as connection:
            if not configuration.database or configuration.allow_changing_database:
                options = cls._fetch_databases(connection)
                fields["database"] = (
                    Literal[*options],
                    Field(description="The default database to use."),
                )

            if not configuration.schema_ or configuration.allow_changing_schema:
                options = cls._fetch_schemas(connection, configuration.database)
                fields["schema_"] = (
                    Literal[*options],
                    Field(description="The default schema to use.", alias="schema"),
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
        """
        if not database:
            return set()

        cursor = connection.cursor()
        query = """
            SELECT SCHEMA_NAME
            FROM INFORMATION_SCHEMA.SCHEMATA
            WHERE CATALOG_NAME = ?
        """
        return {row[0] for row in cursor.execute(query, (database,))}

    def __init__(self, configuration: SnowflakeConfiguration):
        self.configuration = configuration

    def get_explorables(
        self,
        runtime_configuration: BaseModel,
    ) -> set[SnowflakeExplorable]:
        """
        Get a list of available explorables (databases/schemas).
        """
        # create a new configuration with the runtime parameters
        configuration = self.configuration.model_copy(
            update=runtime_configuration.model_dump()
        )

        connection_parameters = get_connection_parameters(configuration)
        with connect(**connection_parameters) as connection:
            cursor = connection.cursor()
            query = """
                SHOW SEMANTIC VIEWS
                    ->> SELECT "name" FROM $1;
            """
            return {
                SnowflakeExplorable(configuration, row[0])
                for row in cursor.execute(query)
            }


class SnowflakeExplorable:
    def __init__(self, configuration: SnowflakeConfiguration, name: str):
        self.configuration = configuration
        self.name = name

        self._quote = SnowflakeDialect().identifier_preparer.quote

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
        Get the dimensions defined in the explorable.

        Even though Snowflake supports `SHOW SEMANTIC DIMENSIONS IN my_semantic_view`,
        it doesn't return the expression of dimensions, so we use a slightly more
        complicated query to get all the information we need in one go.
        """
        dimensions: set[Dimension] = set()

        query = f"""
            DESC SEMANTIC VIEW {self.uid()}
                ->> SELECT "object_name", "property", "property_value"
                    FROM $1
                    WHERE
                        "object_kind" = 'DIMENSION' AND
                        "property" IN ('COMMENT', 'DATA_TYPE', 'EXPRESSION', 'TABLE');
        """  # noqa: S608

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
        Get the metrics defined in the explorable.
        """
        metrics: set[Metric] = set()

        query = f"""
            DESC SEMANTIC VIEW {self.uid()}
                ->> SELECT "object_name", "property", "property_value"
                    FROM $1
                    WHERE
                        "object_kind" = 'METRIC' AND
                        "property" IN ('COMMENT', 'DATA_TYPE', 'EXPRESSION', 'TABLE');
        """  # noqa: S608

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

    def get_values(
        self,
        dimension: Dimension,
        filters: set[Filter | NativeFilter] | None = None,
    ) -> set[Any]:
        """
        Return distinct values for a dimension.
        """
        native_filters = {
            (
                filter_
                if isinstance(filter_, NativeFilter)
                else self._build_native_filter(filter_)
            )
            for filter_ in (filters or set())
        }
        parenthesized = {f"({filter_.definition})" for filter_ in native_filters}
        predicates = f"WHERE {' AND '.join(parenthesized)}" if parenthesized else ""

        query = f"""
            SELECT {self._quote(dimension.name)}
            FROM
                SEMANTIC_VIEW(
                    {self.uid()}
                    DIMENSIONS {self._quote(dimension.id)}
                )
            {predicates}
        """  # noqa: S608
        connection_parameters = get_connection_parameters(self.configuration)
        with connect(**connection_parameters) as connection:
            cursor = connection.cursor(DictCursor)
            return {row[0] for row in cursor.execute(query)}

    def _build_native_filter_(self, filter_: Filter) -> NativeFilter:
        """
        Convert a Filter to a NativeFilter.
        """

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
    explorables = semantic_layer.get_explorables(runtime_configuration)
    print(explorables)
    explorable = next(iter(explorables))
    print("DIMENSIONS")
    print("==========")
    for dimension in explorable.get_dimensions():
        print(dimension)
    print("METRICS")
    print("=======")
    for metric in explorable.get_metrics():
        print(metric)
