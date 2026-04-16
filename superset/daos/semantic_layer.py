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

"""DAOs for semantic layer models."""

from __future__ import annotations

from typing import Any

from superset_core.semantic_layers.daos import (
    AbstractSemanticLayerDAO,
    AbstractSemanticViewDAO,
)

from superset.extensions import db
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.utils import json


class SemanticLayerDAO(AbstractSemanticLayerDAO):
    """
    Data Access Object for SemanticLayer model.
    """

    model_cls = SemanticLayer

    @classmethod
    def validate_uniqueness(cls, name: str) -> bool:
        """
        Validate that semantic layer name is unique.

        :param name: Semantic layer name
        :return: True if name is unique, False otherwise
        """
        query = db.session.query(SemanticLayer).filter(SemanticLayer.name == name)
        return not db.session.query(query.exists()).scalar()

    @classmethod
    def validate_update_uniqueness(cls, layer_uuid: str, name: str) -> bool:
        """
        Validate that semantic layer name is unique for updates.

        :param layer_uuid: UUID of the semantic layer being updated
        :param name: New name to validate
        :return: True if name is unique, False otherwise
        """
        query = db.session.query(SemanticLayer).filter(
            SemanticLayer.name == name,
            SemanticLayer.uuid != layer_uuid,
        )
        return not db.session.query(query.exists()).scalar()

    @classmethod
    def find_by_name(cls, name: str) -> SemanticLayer | None:
        """
        Find semantic layer by name.

        :param name: Semantic layer name
        :return: SemanticLayer instance or None
        """
        return (
            db.session.query(SemanticLayer)
            .filter(SemanticLayer.name == name)
            .one_or_none()
        )

    @classmethod
    def get_semantic_views(cls, layer_uuid: str) -> list[SemanticView]:
        """
        Get all semantic views for a semantic layer.

        :param layer_uuid: UUID of the semantic layer
        :return: List of SemanticView instances
        """
        return (
            db.session.query(SemanticView)
            .filter(SemanticView.semantic_layer_uuid == layer_uuid)
            .all()
        )


class SemanticViewDAO(AbstractSemanticViewDAO):
    """Data Access Object for SemanticView model."""

    model_cls = SemanticView

    @classmethod
    def validate_uniqueness(
        cls,
        name: str,
        layer_uuid: str,
        configuration: dict[str, Any],
    ) -> bool:
        """
        Validate that view is unique within a semantic layer.

        Uniqueness is determined by name, layer, and configuration.
        The configuration column is encrypted (non-deterministic
        ciphertext), so it cannot be compared at the DB level. Instead,
        we filter by name + layer in SQL and compare decrypted
        configuration dicts in Python.

        :param name: View name
        :param layer_uuid: UUID of the semantic layer
        :param configuration: Configuration dict to compare
        :return: True if unique, False otherwise
        """
        candidates = (
            db.session.query(SemanticView)
            .filter(
                SemanticView.name == name,
                SemanticView.semantic_layer_uuid == layer_uuid,
            )
            .all()
        )
        return not any(json.loads(c.configuration) == configuration for c in candidates)

    @classmethod
    def validate_update_uniqueness(
        cls,
        view_uuid: str,
        name: str,
        layer_uuid: str,
        configuration: dict[str, Any],
    ) -> bool:
        """
        Validate that view is unique within a semantic layer for updates.

        Same logic as ``validate_uniqueness`` but excludes the view
        being updated.

        :param view_uuid: UUID of the view being updated
        :param name: New name to validate
        :param layer_uuid: UUID of the semantic layer
        :param configuration: Configuration dict to compare
        :return: True if unique, False otherwise
        """
        candidates = (
            db.session.query(SemanticView)
            .filter(
                SemanticView.name == name,
                SemanticView.semantic_layer_uuid == layer_uuid,
                SemanticView.uuid != view_uuid,
            )
            .all()
        )
        return not any(json.loads(c.configuration) == configuration for c in candidates)

    @classmethod
    def find_by_name(cls, name: str, layer_uuid: str) -> SemanticView | None:
        """
        Find semantic view by name within a semantic layer.

        :param name: View name
        :param layer_uuid: UUID of the semantic layer
        :return: SemanticView instance or None
        """
        return (
            db.session.query(SemanticView)
            .filter(
                SemanticView.name == name,
                SemanticView.semantic_layer_uuid == layer_uuid,
            )
            .one_or_none()
        )
