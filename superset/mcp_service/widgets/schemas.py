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
"""Schemas for the embeddable-widget data MCP tools."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from superset.mcp_service.utils import sanitize_for_llm_context


class WidgetSpec(BaseModel):
    """An inline widget definition, validated by the widget registry."""

    type: str = Field(..., description="Widget type, e.g. 'echarts' or 'metric-tile'.")
    props: Dict[str, Any] = Field(
        default_factory=dict,
        description="Widget props, as produced by get_widget_control_schema.",
    )


class ResolvedFilter(BaseModel):
    """A structured narrowing ANDed onto the widget's own query."""

    column: str = Field(..., description="Column on the widget's dataset.")
    operator: Literal["EQUALS", "NOT_EQUALS", "IN", "NOT_IN", "RANGE", "TIME_RANGE"]
    value: Any = Field(
        default=None,
        description=(
            "Scalar for EQUALS/NOT_EQUALS, list for IN/NOT_IN, {min, max} for "
            "RANGE, {start, end} for TIME_RANGE."
        ),
    )


class WidgetSelectorRequest(BaseModel):
    """Exactly one of an inline ``widget`` or a saved widget ``id``."""

    widget: WidgetSpec | None = Field(default=None, description="Inline widget.")
    id: str | None = Field(default=None, description="Saved widget uuid.")

    @model_validator(mode="after")
    def exactly_one_selector(self) -> "WidgetSelectorRequest":
        if (self.widget is None) == (self.id is None):
            raise ValueError("Provide exactly one of 'widget' or 'id'.")
        return self

    def selector(self) -> Dict[str, Any]:
        """The selector shape the widget commands expect."""
        if self.id is not None:
            return {"id": self.id}
        assert self.widget is not None
        return {"widget": self.widget.model_dump()}


class GetWidgetDataRequest(WidgetSelectorRequest):
    filters: List[ResolvedFilter] = Field(
        default_factory=list,
        description="Optional filters, e.g. from a host filter or cross-filter.",
    )


class GetWidgetValuesRequest(WidgetSelectorRequest):
    pass


class GetSavedWidgetRequest(BaseModel):
    id: str = Field(..., description="Saved widget uuid.")


class WidgetDataResponse(BaseModel):
    columns: List[str] = Field(default_factory=list)
    rows: List[Dict[str, Any]] = Field(default_factory=list)


class WidgetValuesResponse(BaseModel):
    values: List[Any] = Field(default_factory=list)


class SavedWidgetResponse(BaseModel):
    uuid: str
    widget_type: str
    title: str | None = None
    props: Dict[str, Any] = Field(default_factory=dict)
    dataset_id: int | None = None
    changed_on: datetime | None = None


class WidgetToolError(BaseModel):
    error: str = Field(..., description="Error message")
    error_type: str = Field(
        ...,
        description="NotFound, Forbidden, ValidationError, or UnexpectedError",
    )
    errors: Any = Field(
        default=None, description="Field-level validation errors, when present."
    )
    timestamp: datetime | None = None

    @field_validator("error")
    @classmethod
    def sanitize_error_for_llm_context(cls, value: str) -> str:
        return sanitize_for_llm_context(value, field_path=("error",))

    @classmethod
    def create(
        cls, error: str, error_type: str, errors: Any = None
    ) -> "WidgetToolError":
        return cls(
            error=error,
            error_type=error_type,
            errors=errors,
            timestamp=datetime.now(timezone.utc),
        )
