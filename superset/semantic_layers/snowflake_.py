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

from typing import Any, Literal, Union

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from pydantic import BaseModel, ConfigDict, create_model, Field, SecretStr
from snowflake.connector import connect
from snowflake.connector.connection import SnowflakeConnection


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

        connection_parameters = cls._get_connection_parameters(configuration)
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

        connection_parameters = cls._get_connection_parameters(configuration)
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
        query = "SHOW DATABASES"
        cursor.execute(query)
        return {row[1] for row in cursor.fetchall()}

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
        cursor.execute(query, (database,))
        return {row[0] for row in cursor.fetchall()}

    @classmethod
    def _get_connection_parameters(
        cls,
        configuration: SnowflakeConfiguration,
    ) -> dict[str, Any]:
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

    def __init__(self, configuration: SnowflakeConfiguration):
        self.configuration = configuration

    def get_explorables(self) -> list[SnowflakeExplorable]:
        """
        Get a list of available explorables (databases/schemas).
        """
        pass


class SnowflakeExplorable:
    pass


if __name__ == "__main__":
    from superset.utils.json import dumps

    print(dumps(SnowflakeSemanticLayer.get_configuration_schema(None)))
    partial_schema = SnowflakeConfiguration.model_validate(
        {
            "account_identifier": "KFTRUWN-VX32922",
            "role": "ACCOUNTADMIN",
            "warehouse": "COMPUTE_WH",
            "database": "SAMPLE_DATA",
            "auth": {
                "auth_type": "user_password",
                "username": "vavila",
                "password": "V!tor1995V!tor1995",
            },
        }
    )
    print(dumps(SnowflakeSemanticLayer.get_configuration_schema(partial_schema)))
