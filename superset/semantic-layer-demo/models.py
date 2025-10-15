"""
Pydantic models demonstrating dynamic schema generation with x-dynamic and x-dependsOn.

This is a simplified version of the Snowflake semantic layer configuration,
using mock data instead of actual Snowflake connections.
"""

from __future__ import annotations

from typing import Any, Literal, Union

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization
from pydantic import BaseModel, ConfigDict, create_model, Field, SecretStr
from snowflake.connector import connect


class UserPasswordAuth(BaseModel):
    """Username and password authentication."""

    model_config = ConfigDict(title="Username and password")

    auth_type: Literal["user_password"] = "user_password"
    username: str = Field(description="The username to authenticate as.")
    password: SecretStr = Field(
        description="The password to authenticate with.",
        repr=False,
    )


class PrivateKeyAuth(BaseModel):
    """Private key authentication."""

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
    """Parameters needed to connect to Snowflake."""

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
        alias="schema",
    )
    allow_changing_schema: bool = Field(
        default=False,
        description="Allow changing the default schema.",
    )


def get_connection_parameters(configuration: SnowflakeConfiguration) -> dict[str, Any]:
    """Convert the configuration to connection parameters for the Snowflake connector."""
    params = {
        "account": configuration.account_identifier,
        "application": "Superset Semantic Layer Demo",
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
            auth.private_key.get_secret_value().encode(),
            password=(
                auth.private_key_password.get_secret_value().encode()
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


def fetch_databases(configuration: SnowflakeConfiguration) -> list[str]:
    """Fetch the list of databases available in the Snowflake account."""
    try:
        connection_parameters = get_connection_parameters(configuration)
        with connect(**connection_parameters) as connection:
            cursor = connection.cursor()
            cursor.execute("SHOW DATABASES")
            return sorted([row[1] for row in cursor])
    except Exception as e:
        print(f"Error fetching databases: {e}")
        return []


def fetch_schemas(
    configuration: SnowflakeConfiguration, database: str | None
) -> list[str]:
    """Fetch the list of schemas available in a given database."""
    if not database:
        return []

    try:
        connection_parameters = get_connection_parameters(configuration)
        # Override the database in connection params to query the specific database
        connection_parameters["database"] = database

        with connect(**connection_parameters) as connection:
            cursor = connection.cursor()
            query = """
                SELECT SCHEMA_NAME
                FROM INFORMATION_SCHEMA.SCHEMATA
                WHERE CATALOG_NAME = ?
                ORDER BY SCHEMA_NAME
            """
            cursor.execute(query, (database,))
            return [row[0] for row in cursor]
    except Exception as e:
        print(f"Error fetching schemas: {e}")
        return []


def get_configuration_schema(
    configuration: SnowflakeConfiguration | None = None,
) -> dict[str, Any]:
    """
    Get the JSON schema for the configuration.

    When a partial configuration is provided, this function enriches the schema
    with actual options for dynamic fields (database, schema).
    """
    schema = SnowflakeConfiguration.model_json_schema()
    properties = schema["properties"]

    if configuration is None:
        # Initial state - set these to empty arrays
        properties["database"]["enum"] = []
        properties["schema"]["enum"] = []
        return schema

    # Check if we can populate database options
    database_depends_on = properties["database"].get("x-dependsOn", [])
    if all(getattr(configuration, dep, None) for dep in database_depends_on):
        # Fetch real databases from Snowflake
        databases = fetch_databases(configuration)
        properties["database"]["enum"] = databases

    # Check if we can populate schema options
    schema_depends_on = properties["schema"].get("x-dependsOn", [])
    if all(getattr(configuration, dep, None) for dep in schema_depends_on):
        # Fetch real schemas from Snowflake
        if configuration.database:
            schemas = fetch_schemas(configuration, configuration.database)
            properties["schema"]["enum"] = schemas

    return schema


def get_runtime_schema(
    configuration: SnowflakeConfiguration, runtime_data: dict[str, Any] | None = None
) -> dict[str, Any]:
    """
    Get the JSON schema for runtime parameters.

    This creates a dynamic schema based on what the user needs to provide at runtime.
    If database/schema weren't specified in config, or if changing is allowed,
    they become required runtime parameters.

    The schema can be enriched with actual values when runtime_data is provided.
    """
    fields: dict[str, tuple[type, Field]] = {}

    # If database not specified or changing is allowed, add it to runtime schema
    if not configuration.database or configuration.allow_changing_database:
        databases = fetch_databases(configuration)
        if databases:
            fields["database"] = (
                Literal[tuple(databases)],  # type: ignore
                Field(description="The database to use."),
            )

    # If schema not specified or changing is allowed, add it to runtime schema
    if not configuration.schema_ or configuration.allow_changing_schema:
        # Get schemas based on the database (from config or runtime data)
        db = configuration.database or (runtime_data.get("database") if runtime_data else None)

        # Determine if schema field should be dynamic
        is_dynamic = "database" in fields or not configuration.database

        if db:
            schemas = fetch_schemas(configuration, db)
            if schemas:
                fields["schema_"] = (
                    Literal[tuple(schemas)],  # type: ignore
                    Field(
                        description="The schema to use.",
                        alias="schema",
                        json_schema_extra={
                            "x-dynamic": True,
                            "x-dependsOn": ["database"],
                        } if is_dynamic else {},
                    ),
                )
        else:
            # Database not provided yet, add schema as empty (will be populated dynamically)
            fields["schema_"] = (
                str | None,
                Field(
                    default=None,
                    description="The schema to use.",
                    alias="schema",
                    json_schema_extra={
                        "x-dynamic": True,
                        "x-dependsOn": ["database"],
                    },
                ),
            )

    if not fields:
        # No runtime parameters needed
        return {"type": "object", "properties": {}}

    return create_model("RuntimeParameters", **fields).model_json_schema()
