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
"""Marshmallow schemas for the datasource list and query endpoints."""

from __future__ import annotations

from marshmallow import fields, Schema, validates_schema, ValidationError
from marshmallow.validate import OneOf, Range

from superset.charts.schemas import ChartDataFilterSchema
from superset.common.chart_data import ChartDataResultFormat
from superset.connectors.sqla.models import SqlaTable
from superset.semantic_layers.models import SemanticView
from superset.subjects.schemas import SubjectResponseSchema

# Matches the MCP query tools' ceiling so the two surfaces agree. The server
# additionally clamps via apply_max_row_limit against ROW_LIMIT.
MAX_ROW_LIMIT = 50_000


class _ChangedBySchema(Schema):
    first_name = fields.String()
    last_name = fields.String()


class _DatabaseSchema(Schema):
    id = fields.Integer()
    database_name = fields.String()


class DatasetListSchema(Schema):
    """Serializes a SqlaTable ORM object for the combined list response."""

    id = fields.Integer()
    uuid = fields.Method("get_uuid")
    table_name = fields.String()
    kind = fields.String()
    source_type = fields.Constant("database")
    description = fields.String(allow_none=True)
    explore_url = fields.String()
    database = fields.Method("get_database")
    catalog = fields.String(allow_none=True)
    schema = fields.String(allow_none=True)
    sql = fields.String(allow_none=True)
    extra = fields.Raw(allow_none=True)
    default_endpoint = fields.String(allow_none=True)
    is_sqllab_view = fields.Boolean(allow_none=True)
    is_managed_externally = fields.Boolean(allow_none=True)
    editors = fields.List(fields.Nested(SubjectResponseSchema))
    changed_by_name = fields.String()
    changed_by = fields.Method("get_changed_by")
    changed_on_delta_humanized = fields.Method("get_changed_on_delta_humanized")
    changed_on_utc = fields.Method("get_changed_on_utc")

    def get_uuid(self, obj: SqlaTable) -> str:
        return str(obj.uuid)

    def get_database(self, obj: SqlaTable) -> dict[str, object] | None:
        if not obj.database:
            return None
        return _DatabaseSchema().dump(
            {"id": obj.database_id, "database_name": obj.database.database_name}
        )

    def get_changed_by(self, obj: SqlaTable) -> dict[str, object] | None:
        if not obj.changed_by:
            return None
        return _ChangedBySchema().dump(
            {
                "first_name": obj.changed_by.first_name,
                "last_name": obj.changed_by.last_name,
            }
        )

    def get_changed_on_delta_humanized(self, obj: SqlaTable) -> str:
        return obj.changed_on_delta_humanized()

    def get_changed_on_utc(self, obj: SqlaTable) -> str:
        return obj.changed_on_utc()


class SemanticViewListSchema(Schema):
    """Serializes a SemanticView ORM object for the combined list response."""

    id = fields.Integer()
    uuid = fields.Method("get_uuid")
    table_name = fields.Method("get_table_name")
    kind = fields.Constant("semantic_view")
    source_type = fields.Constant("semantic_layer")
    description = fields.String(allow_none=True)
    explore_url = fields.String()
    database = fields.Method("get_database")
    catalog = fields.Constant(None)
    schema = fields.Constant(None)
    sql = fields.Constant(None)
    extra = fields.Constant(None)
    default_endpoint = fields.Constant(None)
    is_sqllab_view = fields.Constant(False)
    is_managed_externally = fields.Constant(False)
    editors = fields.Constant([])
    changed_by_name = fields.String()
    changed_by = fields.Method("get_changed_by")
    changed_on_delta_humanized = fields.Method("get_changed_on_delta_humanized")
    changed_on_utc = fields.Method("get_changed_on_utc")
    cache_timeout = fields.Integer(allow_none=True)

    def get_uuid(self, obj: SemanticView) -> str:
        return str(obj.uuid)

    def get_table_name(self, obj: SemanticView) -> str:
        return obj.name

    def get_database(self, obj: SemanticView) -> dict[str, object] | None:
        if not obj.semantic_layer:
            return None
        return {
            "id": str(obj.semantic_layer_uuid),
            "database_name": obj.semantic_layer.name,
        }

    def get_changed_by(self, obj: SemanticView) -> dict[str, object] | None:
        if not obj.changed_by:
            return None
        return _ChangedBySchema().dump(
            {
                "first_name": obj.changed_by.first_name,
                "last_name": obj.changed_by.last_name,
            }
        )

    def get_changed_on_delta_humanized(self, obj: SemanticView) -> str:
        return obj.changed_on_delta_humanized()

    def get_changed_on_utc(self, obj: SemanticView) -> str:
        return obj.changed_on_utc()


class DatasourceQueryOrderSchema(Schema):
    """One ordering term, mirroring SemanticQuery's OrderTuple."""

    column = fields.String(
        required=True,
        metadata={"description": "Metric or dimension name to sort by."},
    )
    descending = fields.Boolean(
        load_default=True,
        metadata={"description": "Sort this column descending."},
    )


class DatasourceQuerySchema(Schema):
    """Name-based query request for POST /datasource/<type>/<id>/query.

    Field names mirror the semantic-layer vocabulary (``dimensions``,
    ``metrics``) rather than Explore's (``columns``); translation to the
    QueryObject shape happens in ``superset.common.tabular_query``.
    """

    # Raw, not String: Metric/Column are `AdhocMetric | str` and
    # `AdhocColumn | str`, so ad-hoc expressions are accepted for datasets
    # exactly as ChartDataQueryObjectSchema accepts them. Semantic views
    # reject ad-hoc metrics downstream, in the mapper that owns that rule.
    metrics = fields.List(
        fields.Raw(),
        load_default=list,
        metadata={
            "description": "Saved metric names, or ad-hoc metric objects "
            "(datasets only). See ChartDataAdhocMetricSchema."
        },
    )
    dimensions = fields.List(
        fields.Raw(),
        load_default=list,
        metadata={"description": "Dimension/column names to group by."},
    )
    filters = fields.List(
        fields.Nested(ChartDataFilterSchema),
        load_default=list,
        metadata={"description": "Filters to apply, AND-ed together."},
    )
    time_range = fields.String(
        allow_none=True,
        load_default=None,
        metadata={"description": "e.g. 'Last 30 days' or '2024-01-01 : 2024-12-31'."},
    )
    time_column = fields.String(
        allow_none=True,
        load_default=None,
        metadata={
            "description": "Temporal column the time range applies to. Inferred "
            "from the datasource when omitted."
        },
    )
    time_grain = fields.String(
        allow_none=True,
        load_default=None,
        metadata={"description": "ISO 8601 duration, e.g. 'P1D' or 'PT1H'."},
    )
    limit = fields.Integer(
        allow_none=True,
        load_default=None,
        validate=[Range(min=1, max=MAX_ROW_LIMIT)],
        metadata={
            "description": "Rows to return. Also clamped server-side by ROW_LIMIT."
        },
    )
    offset = fields.Integer(
        load_default=0,
        validate=[Range(min=0)],
        metadata={"description": "Rows to skip, for pagination."},
    )
    order = fields.List(
        fields.Nested(DatasourceQueryOrderSchema),
        load_default=list,
        metadata={
            "description": "Ordering terms, applied in sequence. Each carries its "
            "own direction."
        },
    )
    result_format = fields.Enum(
        ChartDataResultFormat,
        by_value=True,
        load_default=ChartDataResultFormat.JSON,
        validate=OneOf([ChartDataResultFormat.JSON, ChartDataResultFormat.ARROW]),
        metadata={
            "description": "'json' (default) or 'arrow' for an Arrow IPC stream."
        },
    )
    use_cache = fields.Boolean(load_default=True)
    force = fields.Boolean(load_default=False)
    cache_timeout = fields.Integer(
        allow_none=True,
        load_default=None,
        # -1 is CACHE_DISABLED_TIMEOUT; anything below it is meaningless and
        # would reach the cache backend as an arbitrary negative timeout.
        validate=[Range(min=-1)],
        metadata={"description": "Seconds to cache for; -1 disables caching."},
    )

    @validates_schema
    def validate_not_empty(self, data: dict[str, object], **_kwargs: object) -> None:
        if not data.get("metrics") and not data.get("dimensions"):
            raise ValidationError("Provide at least one metric or dimension.")
