from datetime import datetime
from types import SimpleNamespace
from typing import Any, List

import pytest
from pydantic import BaseModel

from superset.mcp_service.model_tools import ModelGetInfoTool, ModelListTool


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
    def find_by_id(cls, id):
        if id == 1:
            return SimpleNamespace(id=1, name="foo")
        return None


def dummy_serializer(obj, columns=None):
    # Serialize mock object to DummyOutputSchema
    return DummyOutputSchema(id=obj.id, name=obj.name)


def test_model_list_tool_basic():
    tool = ModelListTool(
        dao_class=DummyDAO,
        output_schema=DummyOutputSchema,
        item_serializer=dummy_serializer,
        filter_type=None,
        default_columns=["id", "name"],
        search_columns=["name"],
        list_field_name="items",
        output_list_schema=DummyListSchema,
    )
    result = tool.run(page=1, page_size=2)
    assert result.count == 2
    assert result.total_count == 2
    assert isinstance(result.items[0], DummyOutputSchema)
    assert result.page == 1
    assert result.page_size == 2
    assert result.total_pages == 1
    # For page=1, ModelListTool sets has_previous=True
    assert result.has_previous is True
    assert result.has_next is False
    assert result.columns_requested == ["id", "name"]
    assert set(result.columns_loaded) == {"id", "name"}
    assert isinstance(result.timestamp, datetime)


def test_model_list_tool_with_filters_and_columns():
    tool = ModelListTool(
        dao_class=DummyDAO,
        output_schema=DummyOutputSchema,
        item_serializer=dummy_serializer,
        filter_type=None,
        default_columns=["id", "name"],
        search_columns=["name"],
        list_field_name="items",
        output_list_schema=DummyListSchema,
    )
    result = tool.run(
        filters=[{"col": "name", "opr": "eq", "value": "foo"}], select_columns=["id"]
    )
    assert result.columns_requested == ["id"]
    assert "id" in result.columns_loaded


def test_model_list_tool_empty_result():
    class EmptyDAO:
        @classmethod
        def list(cls, **kwargs):
            return [], 0

    tool = ModelListTool(
        dao_class=EmptyDAO,
        output_schema=DummyOutputSchema,
        item_serializer=dummy_serializer,
        filter_type=None,
        default_columns=["id", "name"],
        search_columns=["name"],
        list_field_name="items",
        output_list_schema=DummyListSchema,
    )
    result = tool.run(page=1, page_size=10)
    assert result.count == 0
    assert result.total_count == 0
    assert result.items == []
    assert result.total_pages == 0
    assert result.has_next is False
    # For page=1 and no results, has_previous is True by ModelListTool logic
    assert result.has_previous is True


def test_model_list_tool_invalid_filters_json():
    tool = ModelListTool(
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
    result = tool.run(filters='[{"col": "name", "opr": "eq", "value": "foo"}]')
    assert result.count == 2


def test_model_get_info_tool_found():
    tool = ModelGetInfoTool(
        dao_class=DummyDAO,
        output_schema=DummyOutputSchema,
        error_schema=DummyErrorSchema,
        serializer=lambda obj: DummyOutputSchema(id=obj.id, name=obj.name),
    )
    result = tool.run(1)
    assert isinstance(result, DummyOutputSchema)
    assert result.id == 1
    assert result.name == "foo"


def test_model_get_info_tool_not_found():
    tool = ModelGetInfoTool(
        dao_class=DummyDAO,
        output_schema=DummyOutputSchema,
        error_schema=DummyErrorSchema,
        serializer=lambda obj: DummyOutputSchema(id=obj.id, name=obj.name),
    )
    result = tool.run(999)
    assert isinstance(result, DummyErrorSchema)
    assert result.error_type == "not_found"
    assert "not found" in result.error
    assert isinstance(result.timestamp, datetime)


def test_model_get_info_tool_exception():
    class FailingDAO:
        @classmethod
        def find_by_id(cls, id):
            raise Exception("fail")

    tool = ModelGetInfoTool(
        dao_class=FailingDAO,
        output_schema=DummyOutputSchema,
        error_schema=DummyErrorSchema,
        serializer=lambda obj: DummyOutputSchema(id=obj.id, name=obj.name),
    )
    with pytest.raises(Exception, match="fail") as exc:
        tool.run(1)
    assert "fail" in str(exc.value)
