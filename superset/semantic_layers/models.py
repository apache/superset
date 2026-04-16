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

import pyarrow as pa
from flask_appbuilder import Model
from sqlalchemy import Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy_utils import UUIDType
from sqlalchemy_utils.types.json import JSONType
from superset_core.semantic_layers.layer import (
    SemanticLayer as SemanticLayerABC,
)
from superset_core.semantic_layers.view import (
    SemanticView as SemanticViewABC,
)

from superset.common.query_object import QueryObject
from superset.explorables.base import TimeGrainDict
from superset.extensions import encrypted_field_factory
from superset.models.helpers import AuditMixinNullable, QueryResult
from superset.semantic_layers.mapper import get_results
from superset.semantic_layers.registry import registry
from superset.utils import json
from superset.utils.core import GenericDataType

if TYPE_CHECKING:
    from superset.superset_typing import ExplorableData, QueryObjectDict


def get_column_type(semantic_type: pa.DataType) -> GenericDataType:
    """
    Map Arrow data types to generic data types.
    """
    if pa.types.is_date(semantic_type) or pa.types.is_timestamp(semantic_type):
        return GenericDataType.TEMPORAL
    if pa.types.is_time(semantic_type):
        return GenericDataType.TEMPORAL
    if (
        pa.types.is_integer(semantic_type)
        or pa.types.is_floating(semantic_type)
        or pa.types.is_decimal(semantic_type)
        or pa.types.is_duration(semantic_type)
    ):
        return GenericDataType.NUMERIC
    if pa.types.is_boolean(semantic_type):
        return GenericDataType.BOOLEAN
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

    configuration = Column(encrypted_field_factory.create(JSONType), default="{}")
    # Tracks the schema version of the configuration JSON field to aid with
    # migrations as the configuration schema evolves over time.
    configuration_version = Column(Integer, nullable=False, default=1)
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
    ) -> SemanticLayerABC[Any, SemanticViewABC]:
        """
        Return semantic layer implementation.
        """
        # TODO (betodealmeida):
        # return extension_manager.get_contribution("semanticLayers", self.type)
        class_ = registry[self.type]
        return class_.from_configuration(json.loads(self.configuration))


class SemanticView(AuditMixinNullable, Model):
    """
    Semantic view model.

    A semantic view represents a queryable view within a semantic layer.
    """

    __tablename__ = "semantic_views"

    # Use integer as the primary key for cross-database auto-increment
    # compatibility (sa.Identity() is not supported in MySQL or SQLite).
    # The uuid column is a secondary unique identifier used in URLs and perms.
    id = Column(Integer, primary_key=True, autoincrement=True)
    uuid = Column(UUIDType(binary=True), unique=True, default=uuid.uuid4)

    # Core fields
    name = Column(String(250), nullable=False)
    description = Column(Text, nullable=True)

    configuration = Column(encrypted_field_factory.create(JSONType), default="{}")
    # Tracks the schema version of the configuration JSON field to aid with
    # migrations as the configuration schema evolves over time.
    configuration_version = Column(Integer, nullable=False, default=1)
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
    def implementation(self) -> SemanticViewABC:
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
                expression=metric.definition,
                description=metric.description,
            )
            for metric in self.implementation.get_metrics()
        ]

    @property
    def columns(self) -> list[ColumnMetadata]:
        return [
            ColumnMetadata(
                column_name=dimension.name,
                type=str(dimension.type),
                is_dttm=pa.types.is_date(dimension.type)
                or pa.types.is_time(dimension.type)
                or pa.types.is_timestamp(dimension.type),
                description=dimension.description,
                expression=dimension.definition,
                extra=json.dumps(
                    {"grain": dimension.grain.name if dimension.grain else None}
                ),
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
            "id": self.id,
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
                    "is_dttm": pa.types.is_date(dimension.type)
                    or pa.types.is_time(dimension.type)
                    or pa.types.is_timestamp(dimension.type),
                    "python_date_format": None,
                    "type": str(dimension.type),
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
            "offset": self.offset,
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
            "edit_url": "",
            "default_endpoint": None,
            "folders": [],
            "health_check_message": None,
        }

    def data_for_slices(self, slices: list[Any]) -> ExplorableData:
        return self.data

    def get_extra_cache_keys(self, query_obj: QueryObjectDict) -> list[Hashable]:
        return []

    @property
    def perm(self) -> str:
        return self.semantic_layer_uuid.hex + "::" + self.uuid.hex

    @property
    def catalog_perm(self) -> str | None:
        return None

    @property
    def schema_perm(self) -> str | None:
        return None

    @property
    def schema(self) -> str | None:
        return None

    @property
    def url(self) -> str:
        return f"/semantic_view/{self.uuid}/"

    @property
    def explore_url(self) -> str:
        return f"/explore/?datasource_type=semantic_view&datasource_id={self.id}"

    @property
    def offset(self) -> int:
        # always return datetime as UTC
        return 0

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
