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
from collections.abc import Hashable
from dataclasses import dataclass
from functools import cached_property
from typing import Any, TYPE_CHECKING

from flask_appbuilder import Model
from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy_utils import UUIDType
from sqlalchemy_utils.types.json import JSONType

from superset.common.query_object import QueryObject
from superset.explorables.base import TimeGrainDict
from superset.extensions import encrypted_field_factory
from superset.models.helpers import AuditMixinNullable, QueryResult
from superset.semantic_layers.mapper import get_results
from superset.semantic_layers.registry import get_semantic_layer
from superset.semantic_layers.types import (
    BINARY,
    BOOLEAN,
    DATE,
    DATETIME,
    DECIMAL,
    INTEGER,
    INTERVAL,
    NUMBER,
    OBJECT,
    SemanticLayerImplementation,
    SemanticViewImplementation,
    STRING,
    TIME,
    Type,
)
from superset.utils import json
from superset.utils.core import GenericDataType

if TYPE_CHECKING:
    from superset.superset_typing import ExplorableData, QueryObjectDict


def get_column_type(semantic_type: type[Type]) -> GenericDataType:
    """
    Map semantic layer types to generic data types.
    """
    if semantic_type in {DATE, DATETIME, TIME}:
        return GenericDataType.TEMPORAL
    if semantic_type in {INTEGER, NUMBER, DECIMAL, INTERVAL}:
        return GenericDataType.NUMERIC
    if semantic_type is BOOLEAN:
        return GenericDataType.BOOLEAN
    if semantic_type in {STRING, OBJECT, BINARY}:
        return GenericDataType.STRING
    return GenericDataType.STRING


@dataclass(frozen=True)
class MetricMetadata:
    metric_name: str
    expression: str
    verbose_name: str | None = None
    description: str | None = None
    d3format: str | None = None
    currency: dict[str, Any] | None = None
    warning_text: str | None = None
    certified_by: str | None = None
    certification_details: str | None = None


@dataclass(frozen=True)
class ColumnMetadata:
    column_name: str
    type: str
    is_dttm: bool
    verbose_name: str | None = None
    description: str | None = None
    groupby: bool = True
    filterable: bool = True
    expression: str | None = None
    python_date_format: str | None = None
    advanced_data_type: str | None = None
    extra: str | None = None


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
    type = Column(String(250), nullable=False)  # snowflake, etc

    configuration = Column(encrypted_field_factory.create(JSONType), default=dict)
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

    @cached_property
    def implementation(
        self,
    ) -> SemanticLayerImplementation[Any, SemanticViewImplementation]:
        """
        Return semantic layer implementation.
        """
        implementation_class = get_semantic_layer(self.type)

        if not issubclass(implementation_class, SemanticLayerImplementation):
            raise TypeError(
                f"Semantic layer type '{self.type}' "
                "must be a subclass of SemanticLayerImplementation"
            )

        return implementation_class.from_configuration(json.loads(self.configuration))


class SemanticView(AuditMixinNullable, Model):
    """
    Semantic view model.

    A semantic view represents a queryable view within a semantic layer.
    """

    __tablename__ = "semantic_views"

    uuid = Column(UUIDType(binary=True), primary_key=True, default=uuid.uuid4)

    # Core fields
    name = Column(String(250), nullable=False)
    description = Column(Text, nullable=True)

    configuration = Column(encrypted_field_factory.create(JSONType), default=dict)
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

    @cached_property
    def implementation(self) -> SemanticViewImplementation:
        """
        Return semantic view implementation.
        """
        return self.semantic_layer.implementation.get_semantic_view(
            self.name,
            json.loads(self.configuration),
        )

    # =========================================================================
    # Explorable protocol implementation
    # =========================================================================

    def get_query_result(self, query_object: QueryObject) -> QueryResult:
        return get_results(query_object)

    def get_query_str(self, query_obj: QueryObjectDict) -> str:
        return "Not implemented for semantic layers"

    @property
    def uid(self) -> str:
        return self.implementation.uid()

    @property
    def type(self) -> str:
        return "semantic_view"

    @property
    def metrics(self) -> list[MetricMetadata]:
        return [
            MetricMetadata(
                metric_name=metric.name,
                expression=metric.definition or "",
                description=metric.description,
            )
            for metric in self.implementation.get_metrics()
        ]

    @property
    def columns(self) -> list[ColumnMetadata]:
        return [
            ColumnMetadata(
                column_name=dimension.name,
                type=dimension.type.__name__,
                is_dttm=dimension.type in {DATE, TIME, DATETIME},
                description=dimension.description,
                expression=dimension.definition,
                extra=json.dumps({"grain": dimension.grain}),
            )
            for dimension in self.implementation.get_dimensions()
        ]

    @property
    def column_names(self) -> list[str]:
        return [dimension.name for dimension in self.implementation.get_dimensions()]

    @property
    def data(self) -> ExplorableData:
        return {
            # core
            "id": self.uuid.hex,
            "uid": self.uid,
            "type": "semantic_view",
            "name": self.name,
            "columns": [
                {
                    "advanced_data_type": None,
                    "certification_details": None,
                    "certified_by": None,
                    "column_name": dimension.name,
                    "description": dimension.description,
                    "expression": dimension.definition,
                    "filterable": True,
                    "groupby": True,
                    "id": None,
                    "uuid": None,
                    "is_certified": False,
                    "is_dttm": dimension.type in {DATE, TIME, DATETIME},
                    "python_date_format": None,
                    "type": dimension.type.__name__,
                    "type_generic": get_column_type(dimension.type),
                    "verbose_name": None,
                    "warning_markdown": None,
                }
                for dimension in self.implementation.get_dimensions()
            ],
            "metrics": [
                {
                    "certification_details": None,
                    "certified_by": None,
                    "d3format": None,
                    "description": metric.description,
                    "expression": metric.definition,
                    "id": None,
                    "uuid": None,
                    "is_certified": False,
                    "metric_name": metric.name,
                    "warning_markdown": None,
                    "warning_text": None,
                    "verbose_name": None,
                }
                for metric in self.implementation.get_metrics()
            ],
            "database": {},
            # UI features
            "verbose_map": {},
            "order_by_choices": [],
            "filter_select": True,
            "filter_select_enabled": True,
            "sql": None,
            "select_star": None,
            "owners": [],
            "description": self.description,
            "table_name": self.name,
            "column_types": [
                get_column_type(dimension.type)
                for dimension in self.implementation.get_dimensions()
            ],
            "column_names": [
                dimension.name for dimension in self.implementation.get_dimensions()
            ],
            # rare
            "column_formats": {},
            "datasource_name": self.name,
            "perm": self.perm,
            "offset": None,
            "cache_timeout": self.cache_timeout,
            "params": None,
            # sql-specific
            "schema": None,
            "catalog": None,
            "main_dttm_col": None,
            "time_grain_sqla": [],
            "granularity_sqla": [],
            "fetch_values_predicate": None,
            "template_params": None,
            "is_sqllab_view": False,
            "extra": None,
            "always_filter_main_dttm": False,
            "normalize_columns": False,
            # TODO XXX
            # "owners": [owner.id for owner in self.owners],
            "edit_url": "",
            "default_endpoint": None,
            "folders": [],
            "health_check_message": None,
        }

    def get_extra_cache_keys(self, query_obj: QueryObjectDict) -> list[Hashable]:
        return []

    @property
    def perm(self) -> str:
        return self.semantic_layer_uuid.hex + "::" + self.uuid.hex

    @property
    def offset(self) -> int:
        # always return datetime as UTC
        return 0

    @property
    def get_time_grains(self) -> list[TimeGrainDict]:
        return [
            {
                "name": dimension.grain.name,
                "function": "",
                "duration": dimension.grain.representation,
            }
            for dimension in self.implementation.get_dimensions()
            if dimension.grain
        ]

    def has_drill_by_columns(self, column_names: list[str]) -> bool:
        dimension_names = {
            dimension.name for dimension in self.implementation.get_dimensions()
        }
        return all(column_name in dimension_names for column_name in column_names)

    @property
    def is_rls_supported(self) -> bool:
        return False

    @property
    def query_language(self) -> str | None:
        return None
