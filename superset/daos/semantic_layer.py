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

from superset.daos.base import BaseDAO
from superset.extensions import db
from superset.semantic_layers.models import SemanticLayer, SemanticView


class SemanticLayerDAO(BaseDAO[SemanticLayer]):
    """
    Data Access Object for SemanticLayer model.
    """

    @staticmethod
    def find_by_uuid(uuid_str: str) -> SemanticLayer | None:
        return (
            db.session.query(SemanticLayer)
            .filter(SemanticLayer.uuid == uuid_str)
            .one_or_none()
        )

    @staticmethod
    def find_all() -> list[SemanticLayer]:
        return db.session.query(SemanticLayer).all()

    @staticmethod
    def validate_uniqueness(name: str) -> bool:
        """
        Validate that semantic layer name is unique.

        :param name: Semantic layer name
        :return: True if name is unique, False otherwise
        """
        query = db.session.query(SemanticLayer).filter(SemanticLayer.name == name)
        return not db.session.query(query.exists()).scalar()

    @staticmethod
    def validate_update_uniqueness(layer_uuid: str, name: str) -> bool:
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

    @staticmethod
    def find_by_name(name: str) -> SemanticLayer | None:
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


class SemanticViewDAO(BaseDAO[SemanticView]):
    """Data Access Object for SemanticView model."""

    @staticmethod
    def find_by_semantic_layer(layer_uuid: str) -> list[SemanticView]:
        """
        Find all views for a semantic layer.

        :param layer_uuid: UUID of the semantic layer
        :return: List of SemanticView instances
        """
        return (
            db.session.query(SemanticView)
            .filter(SemanticView.semantic_layer_uuid == layer_uuid)
            .all()
        )

    @staticmethod
    def validate_uniqueness(name: str, layer_uuid: str) -> bool:
        """
        Validate that view name is unique within semantic layer.

        :param name: View name
        :param layer_uuid: UUID of the semantic layer
        :return: True if name is unique within layer, False otherwise
        """
        query = db.session.query(SemanticView).filter(
            SemanticView.name == name,
            SemanticView.semantic_layer_uuid == layer_uuid,
        )
        return not db.session.query(query.exists()).scalar()

    @staticmethod
    def validate_update_uniqueness(view_uuid: str, name: str, layer_uuid: str) -> bool:
        """
        Validate that view name is unique within semantic layer for updates.

        :param view_uuid: UUID of the view being updated
        :param name: New name to validate
        :param layer_uuid: UUID of the semantic layer
        :return: True if name is unique within layer, False otherwise
        """
        query = db.session.query(SemanticView).filter(
            SemanticView.name == name,
            SemanticView.semantic_layer_uuid == layer_uuid,
            SemanticView.uuid != view_uuid,
        )
        return not db.session.query(query.exists()).scalar()

    @staticmethod
    def find_by_name(name: str, layer_uuid: str) -> SemanticView | None:
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
