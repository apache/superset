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
Enhanced error schemas for MCP chart generation with contextual information
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List

from pydantic import BaseModel, computed_field, ConfigDict, Field, model_validator


class MCPBaseError(BaseModel):
    """Base error shape for all MCP tool responses.

    Provides a consistent set of fields that every error response includes,
    allowing LLM clients to handle errors uniformly regardless of which tool
    produced them.
    """

    error_type: str = Field(
        ..., description="Type of error (validation, execution, etc.)"
    )
    message: str = Field(..., description="Human-readable error message")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="Error timestamp",
    )
    details: str | None = Field(None, description="Detailed error explanation")
    suggestions: list[str] = Field(
        default_factory=list, description="Actionable suggestions to fix the error"
    )
    error_code: str | None = Field(
        None, description="Unique error code for support reference"
    )

    model_config = ConfigDict(ser_json_timedelta="iso8601")

    @model_validator(mode="before")
    @classmethod
    def _compat_error_to_message(cls, data: Any) -> Any:
        """Allow construction with error= kwarg for backward compatibility."""
        if isinstance(data, dict) and "error" in data and "message" not in data:
            data["message"] = data.pop("error")
        return data

    @computed_field  # type: ignore[prop-decorator]
    @property
    def error(self) -> str:
        """Backward-compatible field: mirrors 'message' in serialized output."""
        return self.message


class ColumnSuggestion(BaseModel):
    """Suggested column with context"""

    name: str = Field(..., description="Column name")
    type: str = Field(..., description="Column data type")
    similarity_score: float = Field(..., description="Similarity score (0-1)")
    description: str | None = Field(None, description="Column description")


class ValidationError(BaseModel):
    """Individual validation error with context"""

    field: str = Field(..., description="Field that failed validation")
    provided_value: Any = Field(..., description="Value that was provided")
    error_type: str = Field(..., description="Type of validation error")
    message: str = Field(..., description="Human-readable error message")
    suggestions: List[ColumnSuggestion] = Field(
        default_factory=list, description="Suggested alternatives"
    )


class DatasetContext(BaseModel):
    """Dataset information for error context"""

    model_config = {"populate_by_name": True}

    id: int = Field(..., description="Dataset ID")
    table_name: str = Field(..., description="Table name")
    schema_name: str | None = Field(
        None,
        alias="schema",
        serialization_alias="schema",
        description="Schema name",
    )
    database_name: str = Field(..., description="Database name")
    available_columns: List[Dict[str, Any]] = Field(
        default_factory=list, description="Available columns with metadata"
    )
    available_metrics: List[Dict[str, Any]] = Field(
        default_factory=list, description="Available metrics with metadata"
    )


class ChartGenerationError(MCPBaseError):
    """Enhanced error response for chart generation failures"""

    details: str = Field(..., description="Detailed error explanation")
    validation_errors: List[ValidationError] = Field(
        default_factory=list, description="Specific field validation errors"
    )
    dataset_context: DatasetContext | None = Field(
        None, description="Dataset information for context"
    )
    query_info: Dict[str, Any] | None = Field(
        None, description="Query execution details"
    )
    help_url: str | None = Field(
        None, description="URL to documentation for this error type"
    )


class ChartGenerationResponse(BaseModel):
    """Enhanced chart generation response with detailed error handling"""

    success: bool = Field(..., description="Whether chart generation succeeded")
    chart: Dict[str, Any] | None = Field(
        None, description="Chart information if successful"
    )
    error: ChartGenerationError | None = Field(
        None, description="Error details if failed"
    )
    performance: Dict[str, Any] | None = Field(None, description="Performance metadata")
    schema_version: str = Field(default="2.0", description="Response schema version")
    api_version: str = Field(default="v1", description="API version")
