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

"""Pydantic schemas for annotation layer and annotation responses."""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
)

from superset.daos.base import ColumnOperator, ColumnOperatorEnum
from superset.mcp_service.common.pagination_schemas import (
    PaginatedListRequest,
    PaginatedResponse,
)
from superset.mcp_service.utils import sanitize_for_llm_context
from superset.utils import json as json_utils

DEFAULT_LAYER_COLUMNS = ["id", "name", "descr"]
DEFAULT_ANNOTATION_COLUMNS = ["id", "short_descr", "start_dttm", "end_dttm", "layer_id"]


class AnnotationLayerFilter(ColumnOperator):
    """Filter object for annotation layer listing."""

    col: Literal["name"] = Field(
        ...,
        description="Column to filter on. Supported: 'name'.",
    )
    opr: ColumnOperatorEnum = Field(..., description="Filter operator.")
    value: str | int | float | bool | list[str | int | float | bool] = Field(
        ..., description="Value to filter by."
    )


class AnnotationFilter(ColumnOperator):
    """Filter object for annotation listing."""

    col: Literal["short_descr"] = Field(
        ...,
        description="Column to filter on. Supported: 'short_descr'.",
    )
    opr: ColumnOperatorEnum = Field(..., description="Filter operator.")
    value: str | int | float | bool | list[str | int | float | bool] = Field(
        ..., description="Value to filter by."
    )


class AnnotationLayerInfo(BaseModel):
    id: int | None = Field(None, description="Annotation layer ID")
    name: str | None = Field(None, description="Annotation layer name")
    descr: str | None = Field(None, description="Annotation layer description")
    changed_on: str | datetime | None = Field(
        None, description="Last modification timestamp"
    )
    created_on: str | datetime | None = Field(None, description="Creation timestamp")
    model_config = ConfigDict(from_attributes=True, ser_json_timedelta="iso8601")


class AnnotationLayerList(PaginatedResponse[AnnotationLayerFilter]):
    annotation_layers: list[AnnotationLayerInfo]


class ListAnnotationLayersRequest(PaginatedListRequest[AnnotationLayerFilter]):
    """Request schema for list_annotation_layers."""


class GetAnnotationLayerInfoRequest(BaseModel):
    """Request schema for get_annotation_layer_info."""

    id: Annotated[int, Field(description="Annotation layer ID.")]


class AnnotationInfo(BaseModel):
    id: int | None = Field(None, description="Annotation ID")
    short_descr: str | None = Field(None, description="Short description")
    long_descr: str | None = Field(None, description="Long description")
    start_dttm: str | datetime | None = Field(None, description="Start datetime")
    end_dttm: str | datetime | None = Field(None, description="End datetime")
    json_metadata: str | None = Field(None, description="JSON metadata")
    layer_id: int | None = Field(None, description="Parent annotation layer ID")
    model_config = ConfigDict(from_attributes=True, ser_json_timedelta="iso8601")


class AnnotationList(PaginatedResponse[ColumnOperator]):
    # Parametrized by ColumnOperator (not AnnotationFilter) because
    # list_layer_annotations prepends a "layer_id" scoping filter to
    # filters_applied, and "layer_id" is outside AnnotationFilter's col
    # Literal (which only allows "short_descr").
    annotations: list[AnnotationInfo]
    # layer_id defaults to 0; the tool sets it after ModelListCore constructs this
    # object. ModelListCore does not know about this domain-specific field.
    layer_id: int = 0


class ListLayerAnnotationsRequest(PaginatedListRequest[AnnotationFilter]):
    """Request schema for list_layer_annotations."""

    layer_id: Annotated[
        int, Field(description="Annotation layer ID to list annotations for.")
    ]


class GetLayerAnnotationInfoRequest(BaseModel):
    """Request schema for get_layer_annotation_info."""

    layer_id: Annotated[int, Field(description="Annotation layer ID.")]
    annotation_id: Annotated[int, Field(description="Annotation ID.")]


class AnnotationLayerError(BaseModel):
    error: str = Field(..., description="Error message")
    error_type: str = Field(..., description="Type of error")
    timestamp: str | datetime | None = Field(None, description="Error timestamp")
    model_config = ConfigDict(ser_json_timedelta="iso8601")

    @classmethod
    def create(cls, error: str, error_type: str) -> "AnnotationLayerError":
        from datetime import timezone

        return cls(
            error=error,
            error_type=error_type,
            timestamp=datetime.now(timezone.utc),
        )


def _sanitize_annotation_layer_for_llm_context(
    info: AnnotationLayerInfo,
) -> AnnotationLayerInfo:
    payload = info.model_dump(mode="python")
    for field_name in ("name", "descr"):
        payload[field_name] = sanitize_for_llm_context(
            payload.get(field_name), field_path=(field_name,)
        )
    return AnnotationLayerInfo.model_validate(payload)


def _sanitize_annotation_json_metadata(raw: Any) -> str | None:
    """Canonicalize and sanitize the json_metadata blob before LLM exposure.

    Serializing to a canonical JSON string first prevents dict-key injection:
    keys are rendered as quoted string literals inside the wrapped value rather
    than being able to escape the delimiter context.
    """
    if raw is None:
        return None
    if isinstance(raw, str):
        try:
            canonical: str = json_utils.dumps(json_utils.loads(raw))
        except (ValueError, TypeError):
            canonical = raw
    else:
        try:
            canonical = json_utils.dumps(raw)
        except (ValueError, TypeError):
            canonical = str(raw)
    return sanitize_for_llm_context(
        canonical,
        field_path=("json_metadata",),
        excluded_field_names=frozenset(),
    )


def _sanitize_annotation_for_llm_context(info: AnnotationInfo) -> AnnotationInfo:
    payload = info.model_dump(mode="python")
    for field_name in ("short_descr", "long_descr"):
        payload[field_name] = sanitize_for_llm_context(
            payload.get(field_name), field_path=(field_name,)
        )
    payload["json_metadata"] = _sanitize_annotation_json_metadata(
        payload.get("json_metadata")
    )
    return AnnotationInfo.model_validate(payload)


def serialize_annotation_layer(obj: Any) -> AnnotationLayerInfo | None:
    if not obj:
        return None
    return _sanitize_annotation_layer_for_llm_context(
        AnnotationLayerInfo(
            id=getattr(obj, "id", None),
            name=getattr(obj, "name", None),
            descr=getattr(obj, "descr", None),
            changed_on=getattr(obj, "changed_on", None),
            created_on=getattr(obj, "created_on", None),
        )
    )


def serialize_annotation(obj: Any) -> AnnotationInfo | None:
    if not obj:
        return None
    return _sanitize_annotation_for_llm_context(
        AnnotationInfo(
            id=getattr(obj, "id", None),
            short_descr=getattr(obj, "short_descr", None),
            long_descr=getattr(obj, "long_descr", None),
            start_dttm=getattr(obj, "start_dttm", None),
            end_dttm=getattr(obj, "end_dttm", None),
            json_metadata=getattr(obj, "json_metadata", None),
            layer_id=getattr(obj, "layer_id", None),
        )
    )
