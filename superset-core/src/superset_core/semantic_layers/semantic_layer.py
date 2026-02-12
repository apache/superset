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

from typing import Any, Protocol, runtime_checkable, TypeVar

from pydantic import BaseModel
from superset_core.semantic_layers.semantic_view import SemanticView

ConfigT = TypeVar("ConfigT", bound=BaseModel, contravariant=True)
SemanticViewT = TypeVar("SemanticViewT", bound="SemanticView")


# TODO (betodealmeida): convert to ABC
@runtime_checkable
class SemanticLayer(Protocol[ConfigT, SemanticViewT]):
    """
    A protocol for semantic layers.
    """

    @classmethod
    def from_configuration(
        cls,
        configuration: dict[str, Any],
    ) -> SemanticLayer[ConfigT, SemanticViewT]:
        """
        Create a semantic layer from its configuration.
        """

    @classmethod
    def get_configuration_schema(
        cls,
        configuration: ConfigT | None = None,
    ) -> dict[str, Any]:
        """
        Get the JSON schema for the configuration needed to add the semantic layer.

        A partial configuration `configuration` can be sent to improve the schema,
        allowing for progressive validation and better UX. For example, a semantic
        layer might require:

            - auth information
            - a database

        If the user provides the auth information, a client can send the partial
        configuration to this method, and the resulting JSON schema would include
        the list of databases the user has access to, allowing a dropdown to be
        populated.

        The Snowflake semantic layer has an example implementation of this method, where
        database and schema names are populated based on the provided connection info.
        """

    @classmethod
    def get_runtime_schema(
        cls,
        configuration: ConfigT,
        runtime_data: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Get the JSON schema for the runtime parameters needed to load semantic views.

        This returns the schema needed to connect to a semantic view given the
        configuration for the semantic layer. For example, a semantic layer might
        be configured by:

            - auth information
            - an optional database

        If the user does not provide a database when creating the semantic layer, the
        runtime schema would require the database name to be provided before loading any
        semantic views. This allows users to create semantic layers that connect to a
        specific database (or project, account, etc.), or that allow users to select it
        at query time.

        The Snowflake semantic layer has an example implementation of this method, where
        database and schema names are required if they were not provided in the initial
        configuration.
        """

    def get_semantic_views(
        self,
        runtime_configuration: dict[str, Any],
    ) -> set[SemanticViewT]:
        """
        Get the semantic views available in the semantic layer.

        The runtime configuration can provide information like a given project or
        schema, used to restrict the semantic views returned.
        """

    def get_semantic_view(
        self,
        name: str,
        additional_configuration: dict[str, Any],
    ) -> SemanticViewT:
        """
        Get a specific semantic view by its name and additional configuration.
        """
