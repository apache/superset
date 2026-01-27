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

from textwrap import dedent
from typing import Any, Literal

from pydantic import create_model, Field
from snowflake.connector import connect
from snowflake.connector.connection import SnowflakeConnection

from snowflake_semantic_layer.schemas import SnowflakeConfiguration
from snowflake_semantic_layer.semantic_view import SnowflakeSemanticView
from snowflake_semantic_layer.utils import get_connection_parameters
from superset.semantic_layers.types import (
    SemanticLayerImplementation,
)


class SnowflakeSemanticLayer(
    SemanticLayerImplementation[SnowflakeConfiguration, SnowflakeSemanticView]
):
    id = "snowflake"
    name = "Snowflake Semantic Layer"
    description = "Connect to semantic views stored in Snowflake."

    @classmethod
    def from_configuration(
        cls,
        configuration: dict[str, Any],
    ) -> SnowflakeSemanticLayer:
        """
        Create a SnowflakeSemanticLayer from a configuration dictionary.
        """
        config = SnowflakeConfiguration.model_validate(configuration)
        return cls(config)

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
        schema = SnowflakeConfiguration.model_json_schema()
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
        ).strip()
        return {row[0] for row in cursor.execute(query, (database,))}

    def __init__(self, configuration: SnowflakeConfiguration):
        self.configuration = configuration

    def get_semantic_views(
        self,
        runtime_configuration: dict[str, Any],
    ) -> set[SnowflakeSemanticView]:
        """
        Get the semantic views available in the semantic layer.
        """
        from snowflake_semantic_layer.semantic_view import SnowflakeSemanticView

        # create a new configuration with the runtime parameters
        configuration = self.configuration.model_copy(update=runtime_configuration)

        connection_parameters = get_connection_parameters(configuration)
        with connect(**connection_parameters) as connection:
            cursor = connection.cursor()
            query = dedent(
                """
                SHOW SEMANTIC VIEWS
                    ->> SELECT "name" FROM $1;
                """
            ).strip()
            views = {
                SnowflakeSemanticView(row[0], configuration)
                for row in cursor.execute(query)
            }

        return views

    def get_semantic_view(
        self,
        name: str,
        additional_configuration: dict[str, Any],
    ) -> SnowflakeSemanticView:
        """
        Get a specific semantic view by name.
        """
        from snowflake_semantic_layer.semantic_view import SnowflakeSemanticView

        # create a new configuration with the additional parameters
        configuration = self.configuration.model_copy(update=additional_configuration)
        return SnowflakeSemanticView(name, configuration)

        # check that the semantic view exists
        connection_parameters = get_connection_parameters(configuration)
        with connect(**connection_parameters) as connection:
            cursor = connection.cursor()
            query = dedent(
                """
                SHOW SEMANTIC VIEWS
                    ->> SELECT "name" FROM $1 WHERE "name" = ?;
                """
            ).strip()
            cursor.execute(query, (name,))
            rows = cursor.fetchall()
            if not rows:
                raise ValueError(f'Semantic view "{name}" does not exist.')

        return SnowflakeSemanticView(name, configuration)
