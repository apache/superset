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
Pydantic schemas for dataset-related responses
"""
from datetime import datetime
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field, ConfigDict
from .dashboard_schemas import UserInfo, TagInfo, PaginationInfo

class DatasetListItem(BaseModel):
    """Dataset item for list responses"""
    id: int = Field(..., description="Dataset ID")
    table_name: str = Field(..., description="Table name")
    db_schema: Optional[str] = Field(None, alias="schema", description="Schema name")
    database_name: Optional[str] = Field(None, description="Database name")
    description: Optional[str] = Field(None, description="Dataset description")
    changed_by: Optional[str] = Field(None, description="Last modifier (username)")
    changed_by_name: Optional[str] = Field(None, description="Last modifier (display name)")
    changed_on: Optional[Union[str, datetime]] = Field(None, description="Last modification timestamp")
    changed_on_humanized: Optional[str] = Field(None, description="Humanized modification time")
    created_by: Optional[str] = Field(None, description="Dataset creator (username)")
    created_on: Optional[Union[str, datetime]] = Field(None, description="Creation timestamp")
    created_on_humanized: Optional[str] = Field(None, description="Humanized creation time")
    tags: List[TagInfo] = Field(default_factory=list, description="Dataset tags")
    owners: List[UserInfo] = Field(default_factory=list, description="Dataset owners")
    is_virtual: Optional[bool] = Field(None, description="Whether the dataset is virtual (uses SQL)")
    database_id: Optional[int] = Field(None, description="Database ID")
    schema_perm: Optional[str] = Field(None, description="Schema permission string")
    url: Optional[str] = Field(None, description="Dataset URL")
    model_config = ConfigDict(from_attributes=True, ser_json_timedelta="iso8601")

class DatasetListResponse(BaseModel):
    """Response for dataset list operations"""
    datasets: List[DatasetListItem] = Field(..., description="List of datasets")
    count: int = Field(..., description="Number of datasets in current page")
    total_count: int = Field(..., description="Total number of datasets")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Page size")
    total_pages: int = Field(..., description="Total number of pages")
    has_previous: bool = Field(..., description="Whether there is a previous page")
    has_next: bool = Field(..., description="Whether there is a next page")
    columns_requested: List[str] = Field(..., description="Columns that were requested")
    columns_loaded: List[str] = Field(..., description="Columns that were actually loaded")
    filters_applied: Dict[str, Any] = Field(..., description="Filters that were applied")
    pagination: PaginationInfo = Field(..., description="Pagination information")
    timestamp: datetime = Field(..., description="Response timestamp")
    model_config = ConfigDict(ser_json_timedelta="iso8601")

class DatasetSimpleFilters(BaseModel):
    table_name: Optional[str] = Field(None, description="Filter by table name (partial match)")
    db_schema: Optional[str] = Field(None, alias="schema", description="Filter by schema name")
    database_name: Optional[str] = Field(None, description="Filter by database name")
    changed_by: Optional[str] = Field(None, description="Filter by last modifier (username)")
    created_by: Optional[str] = Field(None, description="Filter by creator (username)")
    owner: Optional[str] = Field(None, description="Filter by owner (username)")
    is_virtual: Optional[bool] = Field(None, description="Filter by whether the dataset is virtual (uses SQL)")
    tags: Optional[str] = Field(None, description="Filter by tags (comma-separated)")

class DatasetAvailableFiltersResponse(BaseModel):
    filters: Dict[str, Any] = Field(..., description="Available filters and their metadata")
    operators: List[str] = Field(..., description="Supported filter operators")
    columns: List[str] = Field(..., description="Available columns for filtering")

def serialize_dataset_object(dataset) -> Optional[DatasetListItem]:
    if not dataset:
        return None
    return DatasetListItem(
        id=getattr(dataset, 'id', None),
        table_name=getattr(dataset, 'table_name', None),
        db_schema=getattr(dataset, 'schema', None),
        database_name=getattr(dataset.database, 'database_name', None) if getattr(dataset, 'database', None) else None,
        description=getattr(dataset, 'description', None),
        changed_by=getattr(dataset, 'changed_by_name', None) or (str(dataset.changed_by) if getattr(dataset, 'changed_by', None) else None),
        changed_by_name=getattr(dataset, 'changed_by_name', None) or (str(dataset.changed_by) if getattr(dataset, 'changed_by', None) else None),
        changed_on=getattr(dataset, 'changed_on', None),
        changed_on_humanized=getattr(dataset, 'changed_on_humanized', None),
        created_by=getattr(dataset, 'created_by_name', None) or (str(dataset.created_by) if getattr(dataset, 'created_by', None) else None),
        created_on=getattr(dataset, 'created_on', None),
        created_on_humanized=getattr(dataset, 'created_on_humanized', None),
        tags=[TagInfo.model_validate(tag, from_attributes=True) for tag in getattr(dataset, 'tags', [])] if getattr(dataset, 'tags', None) else [],
        owners=[UserInfo.model_validate(owner, from_attributes=True) for owner in getattr(dataset, 'owners', [])] if getattr(dataset, 'owners', None) else [],
        is_virtual=getattr(dataset, 'is_virtual', None),
        database_id=getattr(dataset, 'database_id', None),
        schema_perm=getattr(dataset, 'schema_perm', None),
        url=getattr(dataset, 'url', None),
    )

class DatasetInfoResponse(BaseModel):
    """Detailed dataset information response - maps exactly to Dataset model"""
    id: int = Field(..., description="Dataset ID")
    table_name: str = Field(..., description="Table name")
    db_schema: Optional[str] = Field(None, alias="schema", description="Schema name")
    database_name: Optional[str] = Field(None, description="Database name")
    description: Optional[str] = Field(None, description="Dataset description")
    changed_by: Optional[str] = Field(None, description="Last modifier (username)")
    changed_on: Optional[Union[str, datetime]] = Field(None, description="Last modification timestamp")
    changed_on_humanized: Optional[str] = Field(None, description="Humanized modification time")
    created_by: Optional[str] = Field(None, description="Dataset creator (username)")
    created_on: Optional[Union[str, datetime]] = Field(None, description="Creation timestamp")
    created_on_humanized: Optional[str] = Field(None, description="Humanized creation time")
    tags: List[TagInfo] = Field(default_factory=list, description="Dataset tags")
    owners: List[UserInfo] = Field(default_factory=list, description="Dataset owners")
    is_virtual: Optional[bool] = Field(None, description="Whether the dataset is virtual (uses SQL)")
    database_id: Optional[int] = Field(None, description="Database ID")
    schema_perm: Optional[str] = Field(None, description="Schema permission string")
    url: Optional[str] = Field(None, description="Dataset URL")
    sql: Optional[str] = Field(None, description="SQL for virtual datasets")
    main_dttm_col: Optional[str] = Field(None, description="Main datetime column")
    offset: Optional[int] = Field(None, description="Offset")
    cache_timeout: Optional[int] = Field(None, description="Cache timeout")
    params: Optional[Dict[str, Any]] = Field(None, description="Extra params")
    template_params: Optional[Dict[str, Any]] = Field(None, description="Template params")
    extra: Optional[Dict[str, Any]] = Field(None, description="Extra metadata")
    model_config = ConfigDict(from_attributes=True, ser_json_timedelta="iso8601")

class DatasetErrorResponse(BaseModel):
    error: str = Field(..., description="Error message")
    error_type: str = Field(..., description="Type of error")
    timestamp: Optional[Union[str, datetime]] = Field(None, description="Error timestamp")
    model_config = ConfigDict(ser_json_timedelta="iso8601") 