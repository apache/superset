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

"""Schemas for SQL Lab MCP tools."""

from typing import Any, Dict

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_serializer,
)


class ExecuteSqlRequest(BaseModel):
    """Request schema for executing SQL queries."""

    model_config = ConfigDict(populate_by_name=True)

    database_id: int = Field(
        ..., description="Database connection ID to execute query against"
    )
    sql: str = Field(
        ...,
        description="SQL query to execute (supports Jinja2 {{ var }} template syntax)",
        validation_alias=AliasChoices("sql", "query"),
    )
    schema_name: str | None = Field(
        None, description="Schema to use for query execution", alias="schema"
    )
    catalog: str | None = Field(None, description="Catalog name for query execution")
    limit: int | None = Field(
        default=None,
        description=(
            "Maximum number of rows to return. "
            "If not specified, respects the LIMIT in your SQL query. "
            "If specified, overrides any SQL LIMIT clause."
        ),
        ge=1,
        le=10000,
    )
    timeout: int = Field(
        default=30, description="Query timeout in seconds", ge=1, le=300
    )
    template_params: dict[str, Any] | None = Field(
        None, description="Jinja2 template parameters for SQL rendering"
    )
    dry_run: bool = Field(
        default=False,
        description="Return transformed SQL without executing (for debugging)",
    )
    force_refresh: bool = Field(
        default=False,
        description=(
            "Bypass cache and re-execute query. "
            "IMPORTANT: Only set to true when the user EXPLICITLY requests "
            "fresh/updated data (e.g., 'refresh', 'get latest', 're-run'). "
            "Default to false to reduce database load."
        ),
    )

    @field_validator("sql")
    @classmethod
    def sql_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("SQL query cannot be empty")
        return v.strip()


class ColumnInfo(BaseModel):
    """Column metadata information."""

    name: str = Field(..., description="Column name")
    type: str = Field(..., description="Column data type")
    is_nullable: bool | None = Field(None, description="Whether column allows NULL")


class StatementData(BaseModel):
    """Row data and column metadata for a single SQL statement."""

    rows: list[dict[str, Any]] = Field(
        ..., description="Result rows as list of dictionaries"
    )
    columns: list[ColumnInfo] = Field(..., description="Column metadata information")


class StatementInfo(BaseModel):
    """Information about a single SQL statement execution."""

    original_sql: str = Field(..., description="Original SQL as submitted")
    executed_sql: str = Field(
        ..., description="SQL after transformations (RLS, mutations, limits)"
    )
    row_count: int = Field(..., description="Number of rows returned/affected")
    execution_time_ms: float | None = Field(
        None, description="Statement execution time in milliseconds"
    )
    data: StatementData | None = Field(
        None,
        description=(
            "Row data and column metadata for this statement. "
            "Present for data-bearing statements (e.g., SELECT), "
            "absent for DML/DDL statements (e.g., SET, UPDATE)."
        ),
    )


class ExecuteSqlResponse(BaseModel):
    """Response schema for SQL execution results."""

    success: bool = Field(..., description="Whether query executed successfully")
    rows: list[dict[str, Any]] | None = Field(
        None, description="Query result rows as list of dictionaries"
    )
    columns: list[ColumnInfo] | None = Field(
        None, description="Column metadata information"
    )
    row_count: int | None = Field(None, description="Number of rows returned")
    affected_rows: int | None = Field(
        None, description="Number of rows affected (for DML queries)"
    )
    execution_time: float | None = Field(
        None, description="Query execution time in seconds"
    )
    error: str | None = Field(None, description="Error message if query failed")
    error_type: str | None = Field(None, description="Type of error if failed")
    statements: list[StatementInfo] | None = Field(
        None, description="Per-statement execution info (for multi-statement queries)"
    )
    multi_statement_warning: str | None = Field(
        None,
        description=(
            "Warning when multiple data-bearing statements were executed. "
            "The top-level rows/columns contain only the last "
            "data-bearing statement's results. "
            "Check each entry in the statements array for per-statement data."
        ),
    )


class SaveSqlQueryRequest(BaseModel):
    """Request schema for saving a SQL query."""

    model_config = ConfigDict(populate_by_name=True)

    database_id: int = Field(
        ..., description="Database connection ID the query runs against"
    )
    label: str = Field(
        ...,
        description="Name for the saved query (shown in Saved Queries list)",
        min_length=1,
        max_length=256,
    )
    sql: str = Field(
        ...,
        description="SQL query text to save",
    )
    schema_name: str | None = Field(
        None,
        description="Schema the query targets",
        alias="schema",
    )
    catalog: str | None = Field(None, description="Catalog name (if applicable)")
    description: str | None = Field(
        None, description="Optional description of the query"
    )

    @field_validator("sql")
    @classmethod
    def sql_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("SQL query cannot be empty")
        return v.strip()

    @field_validator("label")
    @classmethod
    def label_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Label cannot be empty")
        return v.strip()


class SaveSqlQueryResponse(BaseModel):
    """Response schema for a saved SQL query."""

    model_config = ConfigDict(populate_by_name=True)

    id: int = Field(..., description="Saved query ID")
    label: str = Field(..., description="Query name")
    sql: str = Field(..., description="SQL query text")
    database_id: int = Field(..., description="Database ID")
    schema_name: str | None = Field(None, description="Schema name", alias="schema")
    catalog: str | None = Field(None, description="Catalog name (if applicable)")
    description: str | None = Field(None, description="Query description")
    url: str = Field(
        ...,
        description=(
            "URL to open this saved query in SQL Lab (e.g., /sqllab?savedQueryId=42)"
        ),
    )

    @model_serializer(mode="wrap", when_used="json")
    def _normalize_schema_field(self, serializer: Any, info: Any) -> Dict[str, Any]:
        """Rename schema_name → schema so the JSON key matches the alias."""
        data = serializer(self)
        if "schema_name" in data:
            data["schema"] = data.pop("schema_name")
        return data


class OpenSqlLabRequest(BaseModel):
    """Request schema for opening SQL Lab with context."""

    model_config = ConfigDict(populate_by_name=True)

    database_connection_id: int = Field(
        ...,
        description="Database connection ID to use in SQL Lab",
        validation_alias=AliasChoices("database_connection_id", "database_id"),
    )
    schema_name: str | None = Field(
        None, description="Default schema to select in SQL Lab", alias="schema"
    )
    dataset_in_context: str | None = Field(
        None, description="Dataset name/table to provide as context"
    )
    sql: str | None = Field(
        None,
        description="SQL to pre-populate in the editor",
        validation_alias=AliasChoices("sql", "query"),
    )
    title: str | None = Field(None, description="Title for the SQL Lab tab/query")


class SqlLabResponse(BaseModel):
    """Response schema for SQL Lab URL generation."""

    model_config = ConfigDict(populate_by_name=True)

    url: str = Field(..., description="URL to open SQL Lab with context")
    database_id: int = Field(..., description="Database ID used")
    schema_name: str | None = Field(None, description="Schema selected", alias="schema")
    title: str | None = Field(None, description="Query title")
    error: str | None = Field(None, description="Error message if failed")

    @model_serializer(mode="wrap", when_used="json")
    def _normalize_schema_field(self, serializer: Any, info: Any) -> Dict[str, Any]:
        """Rename schema_name → schema so the JSON key matches the alias."""
        data = serializer(self)
        if "schema_name" in data:
            data["schema"] = data.pop("schema_name")
        return data
