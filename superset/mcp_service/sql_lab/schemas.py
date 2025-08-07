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

from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator


class ExecuteSqlRequest(BaseModel):
    """Request schema for executing SQL queries."""

    database_id: int = Field(
        ..., description="Database connection ID to execute query against"
    )
    sql: str = Field(..., description="SQL query to execute")
    schema_name: Optional[str] = Field(
        None, description="Schema to use for query execution", alias="schema"
    )
    limit: int = Field(
        default=1000,
        description="Maximum number of rows to return",
        ge=1,
        le=10000,
    )
    timeout: int = Field(
        default=30, description="Query timeout in seconds", ge=1, le=300
    )
    parameters: Optional[dict[str, Any]] = Field(
        None, description="Parameters for query substitution"
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
    is_nullable: Optional[bool] = Field(None, description="Whether column allows NULL")


class ExecuteSqlResponse(BaseModel):
    """Response schema for SQL execution results."""

    success: bool = Field(..., description="Whether query executed successfully")
    rows: Optional[Any] = Field(
        None, description="Query result rows as list of dictionaries"
    )
    columns: Optional[list[ColumnInfo]] = Field(
        None, description="Column metadata information"
    )
    row_count: Optional[int] = Field(None, description="Number of rows returned")
    affected_rows: Optional[int] = Field(
        None, description="Number of rows affected (for DML queries)"
    )
    query_id: Optional[str] = Field(None, description="Query tracking ID")
    execution_time: Optional[float] = Field(
        None, description="Query execution time in seconds"
    )
    error: Optional[str] = Field(None, description="Error message if query failed")
    error_type: Optional[str] = Field(None, description="Type of error if failed")


class OpenSqlLabRequest(BaseModel):
    """Request schema for opening SQL Lab with context."""

    database_connection_id: int = Field(
        ..., description="Database connection ID to use in SQL Lab"
    )
    schema_name: Optional[str] = Field(
        None, description="Default schema to select in SQL Lab", alias="schema"
    )
    dataset_in_context: Optional[str] = Field(
        None, description="Dataset name/table to provide as context"
    )
    sql: Optional[str] = Field(
        None, description="SQL query to pre-populate in the editor"
    )
    title: Optional[str] = Field(None, description="Title for the SQL Lab tab/query")


class SqlLabResponse(BaseModel):
    """Response schema for SQL Lab URL generation."""

    url: str = Field(..., description="URL to open SQL Lab with context")
    database_id: int = Field(..., description="Database ID used")
    schema_name: Optional[str] = Field(
        None, description="Schema selected", alias="schema"
    )
    title: Optional[str] = Field(None, description="Query title")
    error: Optional[str] = Field(None, description="Error message if failed")
