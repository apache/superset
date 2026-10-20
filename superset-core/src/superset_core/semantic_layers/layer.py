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

import enum
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, ClassVar, Generic, Mapping, TypeVar

from pydantic import BaseModel

from superset_core.semantic_layers.context import (
    ExecutionMethod,
    SemanticCredentials,
    SemanticExecutionContext,
)
from superset_core.semantic_layers.view import SemanticView

ConfigT = TypeVar("ConfigT", bound=BaseModel)
SemanticViewT = TypeVar("SemanticViewT", bound="SemanticView")


class SemanticCacheResponsibility(str, enum.Enum):
    """Component responsible for caching semantic provider results."""

    PROVIDER = "provider"
    SUPERSET = "superset"


class SemanticCacheScope(str, enum.Enum):
    """Execution scope in which a semantic result may be reused."""

    EXECUTION_CONTEXT = "execution_context"
    GLOBAL = "global"


@dataclass(frozen=True)
class SemanticCacheCapabilities:
    """Provider guarantees for equivalent cached post-processing semantics."""

    comparisons: bool = False
    membership: bool = False
    nulls: bool = False
    pattern_escape: str | None = None


@dataclass(frozen=True)
class SemanticCacheExecutionContext:
    """Typed host principal context offered to provider identity policy."""

    principal_id: str | None
    role_ids: tuple[str, ...]
    host_identity: str


@dataclass(frozen=True)
class SemanticCacheIdentityMaterial:
    """Explicit secret-free, result-affecting provider identity material."""

    values: Mapping[str, object]


class SemanticLayer(ABC, Generic[ConfigT, SemanticViewT]):
    """
    Abstract base class for semantic layers.

    Providers store the parsed configuration instance on the writable
    ``self.configuration`` attribute. Assigning a raw dictionary is a type error
    by design; exposing configuration as a read-only property is not supported.
    """

    # Parsed settings read by the host when requesting the runtime schema.
    # Providers supply this instance attribute; the SDK does not initialize it.
    configuration: ConfigT
    configuration_class: type[BaseModel]
    semantic_cache_responsibility: SemanticCacheResponsibility = (
        SemanticCacheResponsibility.PROVIDER
    )
    semantic_cache_scope: SemanticCacheScope = SemanticCacheScope.EXECUTION_CONTEXT
    supported_execution_methods: ClassVar[frozenset[ExecutionMethod]] = frozenset(
        {ExecutionMethod.CONNECTION}
    )
    semantic_cache_capabilities: SemanticCacheCapabilities = SemanticCacheCapabilities()

    def get_semantic_cache_provider_identity(
        self,
    ) -> SemanticCacheIdentityMaterial | None:
        """Return explicit secret-free provider identity, or bypass containment."""
        return None

    def get_semantic_cache_context_identity(
        self,
        context: SemanticCacheExecutionContext,
    ) -> SemanticCacheIdentityMaterial | None:
        """Return complete request-context identity, or bypass containment."""
        return None

    # Opt in only when all result methods enforce the advertised guarantee.
    # None preserves legacy result-cache keys without constructing the provider.
    result_cache_version: ClassVar[str | None] = None

    @classmethod
    @abstractmethod
    def from_configuration(
        cls,
        configuration: dict[str, Any],
        *,
        cache_token: str,
        context: SemanticExecutionContext,
        credentials: SemanticCredentials | None = None,
    ) -> SemanticLayer[ConfigT, SemanticViewT]:
        """Bind this layer and its views to one host execution identity.

        Under CONNECTION, results and catalogs must not depend on the context.
        Store the supplied context and cache_token; partition provider caches on
        cache_token, never secrets. Non-connection credentials arrive exclusively
        through credentials; never fall back to connection credentials.
        """
        raise NotImplementedError(
            "Semantic layers must implement the from_configuration method"
        )

    @classmethod
    @abstractmethod
    def get_configuration_schema(
        cls,
        configuration: ConfigT | None = None,
    ) -> dict[str, Any]:
        """
        Get the JSON schema for the configuration needed to add the semantic layer.

        Calling with no arguments (or ``None``) must return a static schema
        without I/O: no connections, network discovery or credential lookup.
        The host uses this form before configuration exists, including for
        secret masking. It must not require a constructed provider instance.

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
        raise NotImplementedError(
            "Semantic layers must implement the get_configuration_schema method"
        )

    @classmethod
    @abstractmethod
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
        raise NotImplementedError(
            "Semantic layers must implement the get_runtime_schema method"
        )

    @abstractmethod
    def get_semantic_views(
        self,
        runtime_configuration: dict[str, Any],
    ) -> set[SemanticViewT]:
        """
        Get the semantic views available in the semantic layer.

        The runtime configuration can provide information like a given project or
        schema, used to restrict the semantic views returned.
        """

    @abstractmethod
    def get_semantic_view(
        self,
        name: str,
        additional_configuration: dict[str, Any],
    ) -> SemanticViewT:
        """
        Get a specific semantic view by its name and additional configuration.
        """
