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

"""
Semantic layer DAO interfaces for superset-core.

Provides abstract DAO classes for semantic layers and views that define the
interface contract. Host implementations replace these with concrete classes
backed by SQLAlchemy during initialization.

Usage:
    from superset_core.semantic_layers.daos import (
        AbstractSemanticLayerDAO,
        AbstractSemanticViewDAO,
    )
"""

from __future__ import annotations

from abc import abstractmethod
from typing import Any, ClassVar

from superset_core.common.daos import BaseDAO
from superset_core.semantic_layers.models import SemanticLayerModel, SemanticViewModel


class AbstractSemanticLayerDAO(BaseDAO[SemanticLayerModel]):
    """
    Abstract DAO interface for SemanticLayer.

    Host implementations will replace this class during initialization
    with a concrete DAO providing actual database access.
    """

    model_cls: ClassVar[type[Any] | None] = None
    base_filter = None
    id_column_name = "uuid"
    uuid_column_name = "uuid"

    @classmethod
    @abstractmethod
    def validate_uniqueness(cls, name: str) -> bool:
        """
        Validate that a semantic layer name is unique.

        :param name: Semantic layer name to validate
        :return: True if the name is unique, False otherwise
        """
        ...

    @classmethod
    @abstractmethod
    def validate_update_uniqueness(cls, layer_uuid: str, name: str) -> bool:
        """
        Validate that a semantic layer name is unique for an update operation,
        excluding the layer being updated.

        :param layer_uuid: UUID of the semantic layer being updated
        :param name: New name to validate
        :return: True if the name is unique, False otherwise
        """
        ...

    @classmethod
    @abstractmethod
    def find_by_name(cls, name: str) -> SemanticLayerModel | None:
        """
        Find a semantic layer by name.

        :param name: Semantic layer name
        :return: SemanticLayerModel instance or None
        """
        ...

    @classmethod
    @abstractmethod
    def get_semantic_views(cls, layer_uuid: str) -> list[SemanticViewModel]:
        """
        Get all semantic views associated with a semantic layer.

        :param layer_uuid: UUID of the semantic layer
        :return: List of SemanticViewModel instances
        """
        ...


class AbstractSemanticViewDAO(BaseDAO[SemanticViewModel]):
    """
    Abstract DAO interface for SemanticView.

    Host implementations will replace this class during initialization
    with a concrete DAO providing actual database access.
    """

    model_cls: ClassVar[type[Any] | None] = None
    base_filter = None
    id_column_name = "id"
    uuid_column_name = "uuid"

    @classmethod
    @abstractmethod
    def validate_uniqueness(
        cls,
        name: str,
        layer_uuid: str,
        configuration: dict[str, Any],
    ) -> bool:
        """
        Validate that a semantic view is unique within a semantic layer.

        Uniqueness is determined by the combination of name, layer UUID, and
        configuration.

        :param name: View name
        :param layer_uuid: UUID of the parent semantic layer
        :param configuration: Configuration dict to compare
        :return: True if unique, False otherwise
        """
        ...

    @classmethod
    @abstractmethod
    def validate_update_uniqueness(
        cls,
        view_uuid: str,
        name: str,
        layer_uuid: str,
        configuration: dict[str, Any],
    ) -> bool:
        """
        Validate that a semantic view is unique within a semantic layer for an
        update operation, excluding the view being updated.

        :param view_uuid: UUID of the view being updated
        :param name: New name to validate
        :param layer_uuid: UUID of the parent semantic layer
        :param configuration: Configuration dict to compare
        :return: True if unique, False otherwise
        """
        ...

    @classmethod
    @abstractmethod
    def find_by_name(cls, name: str, layer_uuid: str) -> SemanticViewModel | None:
        """
        Find a semantic view by name within a semantic layer.

        :param name: View name
        :param layer_uuid: UUID of the parent semantic layer
        :return: SemanticViewModel instance or None
        """
        ...


__all__ = ["AbstractSemanticLayerDAO", "AbstractSemanticViewDAO"]
