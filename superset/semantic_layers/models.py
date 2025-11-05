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

"""Semantic layer models."""

from __future__ import annotations

import uuid
from importlib.metadata import entry_points
from typing import Any

from flask_appbuilder import Model
from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy_utils import UUIDType

from superset.models.helpers import AuditMixinNullable
from superset.semantic_layers.types import (
    SemanticLayerImplementation,
    SemanticViewImplementation,
)
from superset.utils import core as utils


class SemanticLayer(AuditMixinNullable, Model):
    """
    Semantic layer model.

    A semantic layer provides an abstraction over data sources,
    allowing users to query data through a semantic interface.
    """

    __tablename__ = "semantic_layers"

    uuid = Column(UUIDType(binary=True), primary_key=True, default=uuid.uuid4)

    # Core fields
    name = Column(String(250), nullable=False)
    description = Column(Text, nullable=True)
    type = Column(String(250), nullable=False)

    # XXX: encrypt at rest
    configuration = Column(utils.MediumText(), default="{}")
    cache_timeout = Column(Integer, nullable=True)

    # Semantic views relationship
    semantic_views: list[SemanticView] = relationship(
        "SemanticView",
        back_populates="semantic_layer",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return self.name or str(self.uuid)

    @property
    def implementation(self) -> SemanticLayerImplementation[Any]:
        """
        Return semantic layer implementation.
        """
        entry_point = next(
            iter(
                entry_points(
                    group="superset.semantic_layers",
                    name=self.type,
                )
            )
        )
        implementation_class = entry_point.load()

        if not issubclass(implementation_class, SemanticLayerImplementation):
            raise TypeError(
                f"Entry point for semantic layer type '{self.type}' "
                "must be a subclass of SemanticLayerImplementation"
            )

        return implementation_class.from_configuration(self.configuration)


class SemanticView(AuditMixinNullable, Model):
    """
    Semantic view model.

    A semantic view represents a queryable view within a semantic layer.
    """

    __tablename__ = "semantic_views"

    uuid = Column(UUIDType(binary=True), primary_key=True, default=uuid.uuid4)

    # Core fields
    name = Column(String(250), nullable=False)

    # XXX: encrypt at rest
    configuration = Column(utils.MediumText(), default="{}")
    cache_timeout = Column(Integer, nullable=True)

    # Semantic layer relationship
    semantic_layer_uuid = Column(
        UUIDType(binary=True),
        ForeignKey("semantic_layers.uuid", ondelete="CASCADE"),
        nullable=False,
    )
    semantic_layer: SemanticLayer = relationship(
        "SemanticLayer",
        back_populates="semantic_views",
        foreign_keys=[semantic_layer_uuid],
    )

    def __repr__(self) -> str:
        return self.name or str(self.uuid)

    @property
    def implementation(self) -> SemanticViewImplementation:
        """
        Return semantic view implementation.
        """
        return self.semantic_layer.implementation.get_semantic_view(
            self.name,
            self.configuration,
        )

    # =========================================================================
    # Explorable protocol implementation
    # =========================================================================
