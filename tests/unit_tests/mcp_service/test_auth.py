from datetime import datetime
from types import SimpleNamespace

import pytest
from pydantic import BaseModel
from superset.mcp_service.auth import mcp_auth_hook


# Dummy Pydantic output schema
class DummyOutputSchema(BaseModel):
    id: int
    name: str

# Dummy list schema
class DummyListSchema(BaseModel):
    items: list
    count: int
    total_count: int
    page: int
    page_size: int
    total_pages: int
    has_previous: bool
    has_next: bool
    columns_requested: list
    columns_loaded: list
    filters_applied: list
    pagination: object
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

# All ModelListTool and ModelGetInfoTool tests have been moved to test_model_tools.py 
