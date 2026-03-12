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

from datetime import datetime
from types import SimpleNamespace
from typing import Any, Dict, List

import pytest
from pydantic import BaseModel

from superset.mcp_service.mcp_core import (
    ModelGetInfoCore,
    ModelGetSchemaCore,
    ModelListCore,
)


# Dummy Pydantic output schema
class DummyOutputSchema(BaseModel):
    id: int
    name: str


# Dummy list schema
class DummyListSchema(BaseModel):
    items: List[Any]
    count: int
    total_count: int
    page: int
    page_size: int
    total_pages: int
    has_previous: bool
    has_next: bool
    columns_requested: List[str]
    columns_loaded: List[str]
    columns_available: List[str]
    sortable_columns: List[str]
    filters_applied: List[Any]
    pagination: Any
    timestamp: datetime


# Dummy error schema
class DummyErrorSchema(BaseModel):
    error: str
    error_type: str
    timestamp: datetime


# Dummy DAO
class DummyDAO:
    @classmethod
    def list(cls, **kwargs):
        # Return a list of dummy objects and a total count
        return [SimpleNamespace(id=1, name="foo"), SimpleNamespace(id=2, name="bar")], 2

    @classmethod
    def find_by_id(cls, id, **kwargs):
        if id == 1:
            return SimpleNamespace(id=1, name="foo")
        return None


def dummy_serializer(obj, columns=None):
    # Serialize mock object to DummyOutputSchema
    return DummyOutputSchema(id=obj.id, name=obj.name)


def test_model_list_tool_basic():
    tool = ModelListCore(
        dao_class=DummyDAO,
        output_schema=DummyOutputSchema,
        item_serializer=dummy_serializer,
        filter_type=None,
        default_columns=["id", "name"],
        search_columns=["name"],
        list_field_name="items",
        output_list_schema=DummyListSchema,
    )
    result = tool.run_tool(page=1, page_size=2)
    assert result.count == 2
    assert result.total_count == 2
    assert isinstance(result.items[0], DummyOutputSchema)
    assert result.page == 1
    assert result.page_size == 2
    assert result.total_pages == 1
    # For page=1, ModelListCore sets has_previous=True
    assert result.has_previous is True
    assert result.has_next is False
    assert result.columns_requested == ["id", "name"]
    assert set(result.columns_loaded) == {"id", "name"}
    assert isinstance(result.timestamp, datetime)


def test_model_list_tool_with_filters_and_columns():
    tool = ModelListCore(
        dao_class=DummyDAO,
        output_schema=DummyOutputSchema,
        item_serializer=dummy_serializer,
        filter_type=None,
        default_columns=["id", "name"],
        search_columns=["name"],
        list_field_name="items",
        output_list_schema=DummyListSchema,
    )
    result = tool.run_tool(
        filters=[{"col": "name", "opr": "eq", "value": "foo"}], select_columns=["id"]
    )
    assert result.columns_requested == ["id"]
    assert "id" in result.columns_loaded


def test_model_list_tool_empty_result():
    class EmptyDAO:
        @classmethod
        def list(cls, **kwargs):
            return [], 0

    tool = ModelListCore(
        dao_class=EmptyDAO,
        output_schema=DummyOutputSchema,
        item_serializer=dummy_serializer,
        filter_type=None,
        default_columns=["id", "name"],
        search_columns=["name"],
        list_field_name="items",
        output_list_schema=DummyListSchema,
    )
    result = tool.run_tool(page=1, page_size=10)
    assert result.count == 0
    assert result.total_count == 0
    assert result.items == []
    assert result.total_pages == 0
    assert result.has_next is False
    # For page=1 and no results, has_previous is True by ModelListCore logic
    assert result.has_previous is True


def test_model_list_tool_invalid_filters_json():
    tool = ModelListCore(
        dao_class=DummyDAO,
        output_schema=DummyOutputSchema,
        item_serializer=dummy_serializer,
        filter_type=None,
        default_columns=["id", "name"],
        search_columns=["name"],
        list_field_name="items",
        output_list_schema=DummyListSchema,
    )
    # Should parse JSON string filters
    result = tool.run_tool(filters='[{"col": "name", "opr": "eq", "value": "foo"}]')
    assert result.count == 2


def test_model_get_info_tool_found():
    tool = ModelGetInfoCore(
        dao_class=DummyDAO,
        output_schema=DummyOutputSchema,
        error_schema=DummyErrorSchema,
        serializer=lambda obj: DummyOutputSchema(id=obj.id, name=obj.name),
    )
    result = tool.run_tool(1)
    assert isinstance(result, DummyOutputSchema)
    assert result.id == 1
    assert result.name == "foo"


def test_model_get_info_tool_not_found():
    tool = ModelGetInfoCore(
        dao_class=DummyDAO,
        output_schema=DummyOutputSchema,
        error_schema=DummyErrorSchema,
        serializer=lambda obj: DummyOutputSchema(id=obj.id, name=obj.name),
    )
    result = tool.run_tool(999)
    assert isinstance(result, DummyErrorSchema)
    assert result.error_type == "not_found"
    assert "not found" in result.error
    assert isinstance(result.timestamp, datetime)


def test_model_get_info_tool_exception():
    class FailingDAO:
        @classmethod
        def find_by_id(cls, id, **kwargs):
            raise Exception("fail")

    tool = ModelGetInfoCore(
        dao_class=FailingDAO,
        output_schema=DummyOutputSchema,
        error_schema=DummyErrorSchema,
        serializer=lambda obj: DummyOutputSchema(id=obj.id, name=obj.name),
    )
    with pytest.raises(Exception, match="fail") as exc:
        tool.run_tool(1)
    assert "fail" in str(exc.value)


# Schema output model for ModelGetSchemaCore tests
class DummySchemaInfo(BaseModel):
    model_type: str
    select_columns: List[Any]
    filter_columns: Dict[str, List[str]]
    sortable_columns: List[str]
    default_select: List[str]
    default_sort: str
    default_sort_direction: str
    search_columns: List[str]


class DummyColumnMetadata(BaseModel):
    name: str
    description: str | None = None
    type: str | None = None
    is_default: bool = False


# DAO with filterable columns for schema tests
class SchemaDAO:
    @classmethod
    def get_filterable_columns_and_operators(cls):
        return {"name": ["eq", "sw", "ilike"], "id": ["eq", "gt", "lt"]}


class FailingSchemaDAO:
    @classmethod
    def get_filterable_columns_and_operators(cls):
        raise Exception("Database connection failed")


def test_model_get_schema_core_basic():
    """Test basic ModelGetSchemaCore functionality."""
    select_columns = [
        DummyColumnMetadata(name="id", description="ID", type="int", is_default=True),
        DummyColumnMetadata(
            name="name", description="Name", type="str", is_default=True
        ),
        DummyColumnMetadata(
            name="description", description="Description", type="str", is_default=False
        ),
    ]

    tool = ModelGetSchemaCore(
        model_type="chart",
        dao_class=SchemaDAO,
        output_schema=DummySchemaInfo,
        select_columns=select_columns,
        sortable_columns=["id", "name"],
        default_columns=["id", "name"],
        search_columns=["name", "description"],
        default_sort="id",
        default_sort_direction="desc",
    )

    result = tool.run_tool()

    assert isinstance(result, DummySchemaInfo)
    assert result.model_type == "chart"
    assert len(result.select_columns) == 3
    assert result.filter_columns == {
        "name": ["eq", "sw", "ilike"],
        "id": ["eq", "gt", "lt"],
    }
    assert result.sortable_columns == ["id", "name"]
    assert result.default_select == ["id", "name"]
    assert result.default_sort == "id"
    assert result.default_sort_direction == "desc"
    assert result.search_columns == ["name", "description"]


def test_model_get_schema_core_dao_exception_returns_empty_filters():
    """Test that DAO exception in _get_filter_columns returns empty dict."""
    select_columns = [
        DummyColumnMetadata(name="id", description="ID", type="int", is_default=True),
    ]

    tool = ModelGetSchemaCore(
        model_type="dataset",
        dao_class=FailingSchemaDAO,
        output_schema=DummySchemaInfo,
        select_columns=select_columns,
        sortable_columns=["id"],
        default_columns=["id"],
        search_columns=["id"],
        default_sort="id",
        default_sort_direction="asc",
    )

    result = tool.run_tool()

    # Should succeed but with empty filter_columns due to DAO exception
    assert isinstance(result, DummySchemaInfo)
    assert result.filter_columns == {}
    assert result.sortable_columns == ["id"]


def test_model_get_schema_core_empty_columns():
    """Test ModelGetSchemaCore with empty select columns."""
    tool = ModelGetSchemaCore(
        model_type="dashboard",
        dao_class=SchemaDAO,
        output_schema=DummySchemaInfo,
        select_columns=[],
        sortable_columns=[],
        default_columns=[],
        search_columns=[],
        default_sort="changed_on",
        default_sort_direction="desc",
    )

    result = tool.run_tool()

    assert isinstance(result, DummySchemaInfo)
    assert result.model_type == "dashboard"
    assert result.select_columns == []
    assert result.sortable_columns == []
    assert result.default_select == []


def test_model_get_schema_core_all_model_types():
    """Test ModelGetSchemaCore works for all model types."""
    select_columns = [DummyColumnMetadata(name="id", description="ID", type="int")]

    for model_type in ["chart", "dataset", "dashboard"]:
        tool = ModelGetSchemaCore(
            model_type=model_type,
            dao_class=SchemaDAO,
            output_schema=DummySchemaInfo,
            select_columns=select_columns,
            sortable_columns=["id"],
            default_columns=["id"],
            search_columns=["id"],
            default_sort="id",
            default_sort_direction="desc",
        )

        result = tool.run_tool()
        assert result.model_type == model_type
