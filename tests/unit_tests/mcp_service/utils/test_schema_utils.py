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
Unit tests for MCP service schema utilities.
"""

import asyncio
import inspect
from typing import Annotated, List

import pytest
from pydantic import BaseModel, Field, ValidationError

from superset.mcp_service.utils.schema_utils import (
    JSONParseError,
    parse_json_or_list,
    parse_json_or_model,
    parse_json_or_model_list,
    parse_json_or_passthrough,
    parse_request,
)


class TestParseJsonOrPassthrough:
    """Test parse_json_or_passthrough function."""

    def test_parse_valid_json_string(self):
        """Should parse valid JSON string to Python object."""
        result = parse_json_or_passthrough('{"key": "value"}', "config")
        assert result == {"key": "value"}

    def test_parse_json_array(self):
        """Should parse JSON array string to Python list."""
        result = parse_json_or_passthrough("[1, 2, 3]", "numbers")
        assert result == [1, 2, 3]

    def test_passthrough_dict(self):
        """Should return dict as-is without parsing."""
        input_dict = {"key": "value"}
        result = parse_json_or_passthrough(input_dict, "config")
        assert result is input_dict

    def test_passthrough_list(self):
        """Should return list as-is without parsing."""
        input_list = [1, 2, 3]
        result = parse_json_or_passthrough(input_list, "numbers")
        assert result is input_list

    def test_passthrough_none(self):
        """Should return None as-is."""
        result = parse_json_or_passthrough(None, "value")
        assert result is None

    def test_invalid_json_non_strict(self):
        """Should return original value when JSON parsing fails (non-strict)."""
        result = parse_json_or_passthrough("not valid json", "config", strict=False)
        assert result == "not valid json"

    def test_invalid_json_strict(self):
        """Should raise JSONParseError when parsing fails (strict mode)."""
        with pytest.raises(JSONParseError) as exc_info:
            parse_json_or_passthrough("not valid json", "config", strict=True)

        assert exc_info.value.param_name == "config"
        assert exc_info.value.value == "not valid json"

    def test_parse_json_number(self):
        """Should parse numeric JSON string."""
        result = parse_json_or_passthrough("42", "number")
        assert result == 42

    def test_parse_json_boolean(self):
        """Should parse boolean JSON string."""
        result = parse_json_or_passthrough("true", "flag")
        assert result is True

    def test_parse_nested_json(self):
        """Should parse nested JSON structures."""
        json_str = '{"outer": {"inner": [1, 2, 3]}}'
        result = parse_json_or_passthrough(json_str, "nested")
        assert result == {"outer": {"inner": [1, 2, 3]}}


class TestParseJsonOrList:
    """Test parse_json_or_list function."""

    def test_parse_json_array(self):
        """Should parse JSON array string to list."""
        result = parse_json_or_list('["a", "b", "c"]', "items")
        assert result == ["a", "b", "c"]

    def test_passthrough_list(self):
        """Should return list as-is."""
        input_list = ["a", "b", "c"]
        result = parse_json_or_list(input_list, "items")
        assert result is input_list

    def test_parse_comma_separated(self):
        """Should parse comma-separated string to list."""
        result = parse_json_or_list("a, b, c", "items")
        assert result == ["a", "b", "c"]

    def test_parse_comma_separated_with_whitespace(self):
        """Should handle whitespace in comma-separated strings."""
        result = parse_json_or_list("  a  ,  b  ,  c  ", "items")
        assert result == ["a", "b", "c"]

    def test_empty_string_returns_empty_list(self):
        """Should return empty list for empty string."""
        result = parse_json_or_list("", "items")
        assert result == []

    def test_none_returns_empty_list(self):
        """Should return empty list for None."""
        result = parse_json_or_list(None, "items")
        assert result == []

    def test_single_json_value_wrapped_in_list(self):
        """Should wrap single JSON value in list."""
        result = parse_json_or_list('"single"', "items")
        assert result == ["single"]

    def test_custom_separator(self):
        """Should use custom separator when provided."""
        result = parse_json_or_list("a|b|c", "items", item_separator="|")
        assert result == ["a", "b", "c"]

    def test_non_list_wrapped(self):
        """Should wrap non-list types in a list."""
        result = parse_json_or_list(42, "items")
        assert result == [42]

    def test_parse_empty_items_in_csv(self):
        """Should ignore empty items in comma-separated string."""
        result = parse_json_or_list("a,,b,,c", "items")
        assert result == ["a", "b", "c"]


class TestParseJsonOrModel:
    """Test parse_json_or_model function."""

    class TestModel(BaseModel):
        """Test Pydantic model."""

        name: str
        value: int

    def test_parse_json_string(self):
        """Should parse JSON string to model instance."""
        result = parse_json_or_model(
            '{"name": "test", "value": 42}', self.TestModel, "config"
        )
        assert isinstance(result, self.TestModel)
        assert result.name == "test"
        assert result.value == 42

    def test_parse_dict(self):
        """Should parse dict to model instance."""
        result = parse_json_or_model(
            {"name": "test", "value": 42}, self.TestModel, "config"
        )
        assert isinstance(result, self.TestModel)
        assert result.name == "test"
        assert result.value == 42

    def test_passthrough_model_instance(self):
        """Should return model instance as-is."""
        instance = self.TestModel(name="test", value=42)
        result = parse_json_or_model(instance, self.TestModel, "config")
        assert result is instance

    def test_invalid_json_raises_error(self):
        """Should raise JSONParseError for invalid JSON."""
        with pytest.raises(JSONParseError):
            parse_json_or_model("not valid json", self.TestModel, "config")

    def test_invalid_model_data_raises_validation_error(self):
        """Should raise ValidationError for invalid model data."""
        with pytest.raises(ValidationError):
            parse_json_or_model({"name": "test"}, self.TestModel, "config")

    def test_wrong_type_raises_validation_error(self):
        """Should raise ValidationError for wrong data types."""
        with pytest.raises(ValidationError):
            parse_json_or_model(
                {"name": "test", "value": "not_a_number"}, self.TestModel, "config"
            )


class TestParseJsonOrModelList:
    """Test parse_json_or_model_list function."""

    class ItemModel(BaseModel):
        """Test Pydantic model for list items."""

        name: str
        value: int

    def test_parse_json_array(self):
        """Should parse JSON array to list of models."""
        json_str = '[{"name": "a", "value": 1}, {"name": "b", "value": 2}]'
        result = parse_json_or_model_list(json_str, self.ItemModel, "items")
        assert len(result) == 2
        assert all(isinstance(item, self.ItemModel) for item in result)
        assert result[0].name == "a"
        assert result[1].value == 2

    def test_parse_list_of_dicts(self):
        """Should parse list of dicts to list of models."""
        input_list = [{"name": "a", "value": 1}, {"name": "b", "value": 2}]
        result = parse_json_or_model_list(input_list, self.ItemModel, "items")
        assert len(result) == 2
        assert all(isinstance(item, self.ItemModel) for item in result)

    def test_passthrough_list_of_models(self):
        """Should return list of models as-is."""
        input_list = [
            self.ItemModel(name="a", value=1),
            self.ItemModel(name="b", value=2),
        ]
        result = parse_json_or_model_list(input_list, self.ItemModel, "items")
        assert len(result) == 2
        assert result[0] is input_list[0]
        assert result[1] is input_list[1]

    def test_empty_returns_empty_list(self):
        """Should return empty list for empty input."""
        assert parse_json_or_model_list(None, self.ItemModel, "items") == []
        assert parse_json_or_model_list("", self.ItemModel, "items") == []
        assert parse_json_or_model_list([], self.ItemModel, "items") == []

    def test_invalid_item_raises_validation_error(self):
        """Should raise ValidationError for invalid item in list."""
        input_list = [{"name": "a", "value": 1}, {"name": "b"}]  # Missing value
        with pytest.raises(ValidationError):
            parse_json_or_model_list(input_list, self.ItemModel, "items")

    def test_mixed_models_and_dicts(self):
        """Should handle mixed list of models and dicts."""
        input_list = [
            self.ItemModel(name="a", value=1),
            {"name": "b", "value": 2},
        ]
        result = parse_json_or_model_list(input_list, self.ItemModel, "items")
        assert len(result) == 2
        assert all(isinstance(item, self.ItemModel) for item in result)


class TestPydanticIntegration:
    """Test integration with Pydantic validators."""

    def test_field_validator_with_json_string(self):
        """Should work with Pydantic field validators for JSON strings."""
        from pydantic import field_validator

        class TestSchema(BaseModel):
            """Test schema with field validator."""

            config: dict

            @field_validator("config", mode="before")
            @classmethod
            def parse_config(cls, v):
                """Parse config from JSON or dict."""
                return parse_json_or_passthrough(v, "config")

        # Test with JSON string
        schema = TestSchema.model_validate({"config": '{"key": "value"}'})
        assert schema.config == {"key": "value"}

        # Test with dict
        schema = TestSchema.model_validate({"config": {"key": "value"}})
        assert schema.config == {"key": "value"}

    def test_field_validator_with_list(self):
        """Should work with Pydantic field validators for lists."""
        from pydantic import field_validator

        class TestSchema(BaseModel):
            """Test schema with list field validator."""

            items: list

            @field_validator("items", mode="before")
            @classmethod
            def parse_items(cls, v):
                """Parse items from various formats."""
                return parse_json_or_list(v, "items")

        # Test with JSON array
        schema = TestSchema.model_validate({"items": '["a", "b", "c"]'})
        assert schema.items == ["a", "b", "c"]

        # Test with list
        schema = TestSchema.model_validate({"items": ["a", "b", "c"]})
        assert schema.items == ["a", "b", "c"]

        # Test with CSV string
        schema = TestSchema.model_validate({"items": "a, b, c"})
        assert schema.items == ["a", "b", "c"]


class TestEdgeCases:
    """Test edge cases and error conditions."""

    def test_empty_json_object(self):
        """Should handle empty JSON objects."""
        result = parse_json_or_passthrough("{}", "config")
        assert result == {}

    def test_empty_json_array(self):
        """Should handle empty JSON arrays."""
        result = parse_json_or_list("[]", "items")
        assert result == []

    def test_whitespace_only_string(self):
        """Should handle whitespace-only strings."""
        result = parse_json_or_list("   ", "items")
        assert result == []

    def test_malformed_json(self):
        """Should handle malformed JSON gracefully."""
        result = parse_json_or_passthrough('{"key": invalid}', "config", strict=False)
        assert result == '{"key": invalid}'

    def test_unicode_in_json(self):
        """Should handle Unicode characters in JSON."""
        result = parse_json_or_passthrough('{"name": "测试"}', "config")
        assert result == {"name": "测试"}

    def test_special_characters_in_csv(self):
        """Should handle special characters in CSV strings."""
        result = parse_json_or_list("item-1, item_2, item.3", "items")
        assert result == ["item-1", "item_2", "item.3"]


class TestParseRequestDecorator:
    """Test parse_request decorator for MCP tools."""

    class RequestModel(BaseModel):
        """Test request model."""

        name: str
        count: int

    @pytest.fixture(autouse=True)
    def _enable_parse_request(self):
        """Ensure MCP_PARSE_REQUEST_ENABLED=True for all parsing tests."""
        from unittest.mock import patch

        with patch(
            "superset.mcp_service.utils.schema_utils._is_parse_request_enabled",
            return_value=True,
        ):
            yield

    def test_decorator_with_json_string_async(self):
        """Should parse JSON string request in async function."""
        from unittest.mock import MagicMock, patch

        @parse_request(self.RequestModel)
        async def async_tool(request, ctx=None):
            return f"{request.name}:{request.count}"

        import asyncio

        mock_ctx = MagicMock()
        with patch("fastmcp.server.dependencies.get_context", return_value=mock_ctx):
            result = asyncio.run(async_tool('{"name": "test", "count": 5}'))
        assert result == "test:5"

    def test_decorator_with_json_string_sync(self):
        """Should parse JSON string request in sync function."""
        from unittest.mock import MagicMock, patch

        @parse_request(self.RequestModel)
        def sync_tool(request, ctx=None):
            return f"{request.name}:{request.count}"

        mock_ctx = MagicMock()
        with patch("fastmcp.server.dependencies.get_context", return_value=mock_ctx):
            result = sync_tool('{"name": "test", "count": 5}')
        assert result == "test:5"

    def test_decorator_with_dict_async(self):
        """Should handle dict request in async function."""
        from unittest.mock import MagicMock, patch

        @parse_request(self.RequestModel)
        async def async_tool(request, ctx=None):
            return f"{request.name}:{request.count}"

        import asyncio

        mock_ctx = MagicMock()
        with patch("fastmcp.server.dependencies.get_context", return_value=mock_ctx):
            result = asyncio.run(async_tool({"name": "test", "count": 5}))
        assert result == "test:5"

    def test_decorator_with_dict_sync(self):
        """Should handle dict request in sync function."""
        from unittest.mock import MagicMock, patch

        @parse_request(self.RequestModel)
        def sync_tool(request, ctx=None):
            return f"{request.name}:{request.count}"

        mock_ctx = MagicMock()
        with patch("fastmcp.server.dependencies.get_context", return_value=mock_ctx):
            result = sync_tool({"name": "test", "count": 5})
        assert result == "test:5"

    def test_decorator_with_model_instance_async(self):
        """Should pass through model instance in async function."""
        from unittest.mock import MagicMock, patch

        @parse_request(self.RequestModel)
        async def async_tool(request, ctx=None):
            return f"{request.name}:{request.count}"

        import asyncio

        mock_ctx = MagicMock()
        instance = self.RequestModel(name="test", count=5)
        with patch("fastmcp.server.dependencies.get_context", return_value=mock_ctx):
            result = asyncio.run(async_tool(instance))
        assert result == "test:5"

    def test_decorator_with_model_instance_sync(self):
        """Should pass through model instance in sync function."""
        from unittest.mock import MagicMock, patch

        @parse_request(self.RequestModel)
        def sync_tool(request, ctx=None):
            return f"{request.name}:{request.count}"

        mock_ctx = MagicMock()
        instance = self.RequestModel(name="test", count=5)
        with patch("fastmcp.server.dependencies.get_context", return_value=mock_ctx):
            result = sync_tool(instance)
        assert result == "test:5"

    def test_decorator_preserves_function_signature_async(self):
        """Should preserve original async function signature."""
        from unittest.mock import MagicMock, patch

        @parse_request(self.RequestModel)
        async def async_tool(request, ctx=None, extra=None):
            return f"{request.name}:{request.count}:{extra}"

        import asyncio

        mock_ctx = MagicMock()
        with patch("fastmcp.server.dependencies.get_context", return_value=mock_ctx):
            result = asyncio.run(
                async_tool('{"name": "test", "count": 5}', extra="data")
            )
        assert result == "test:5:data"

    def test_decorator_preserves_function_signature_sync(self):
        """Should preserve original sync function signature."""
        from unittest.mock import MagicMock, patch

        @parse_request(self.RequestModel)
        def sync_tool(request, ctx=None, extra=None):
            return f"{request.name}:{request.count}:{extra}"

        mock_ctx = MagicMock()
        with patch("fastmcp.server.dependencies.get_context", return_value=mock_ctx):
            result = sync_tool('{"name": "test", "count": 5}', extra="data")
        assert result == "test:5:data"

    def test_decorator_raises_validation_error_async(self):
        """Should raise ToolError for invalid data in async function."""
        from unittest.mock import MagicMock, patch

        from fastmcp.exceptions import ToolError

        @parse_request(self.RequestModel)
        async def async_tool(request, ctx=None):
            return f"{request.name}:{request.count}"

        import asyncio

        mock_ctx = MagicMock()
        with patch("fastmcp.server.dependencies.get_context", return_value=mock_ctx):
            with pytest.raises(ToolError):
                asyncio.run(async_tool('{"name": "test"}'))  # Missing count

    def test_decorator_raises_validation_error_sync(self):
        """Should raise ToolError for invalid data in sync function."""
        from unittest.mock import MagicMock, patch

        from fastmcp.exceptions import ToolError

        @parse_request(self.RequestModel)
        def sync_tool(request, ctx=None):
            return f"{request.name}:{request.count}"

        mock_ctx = MagicMock()
        with patch("fastmcp.server.dependencies.get_context", return_value=mock_ctx):
            with pytest.raises(ToolError):
                sync_tool('{"name": "test"}')  # Missing count

    def test_decorator_with_complex_model_async(self):
        """Should handle complex nested models in async function."""
        from unittest.mock import MagicMock, patch

        class NestedModel(BaseModel):
            """Nested model."""

            value: int

        class ComplexModel(BaseModel):
            """Complex request model."""

            name: str
            nested: NestedModel

        @parse_request(ComplexModel)
        async def async_tool(request, ctx=None):
            return f"{request.name}:{request.nested.value}"

        import asyncio

        mock_ctx = MagicMock()
        json_str = '{"name": "test", "nested": {"value": 42}}'
        with patch("fastmcp.server.dependencies.get_context", return_value=mock_ctx):
            result = asyncio.run(async_tool(json_str))
        assert result == "test:42"

    def test_decorator_with_complex_model_sync(self):
        """Should handle complex nested models in sync function."""
        from unittest.mock import MagicMock, patch

        class NestedModel(BaseModel):
            """Nested model."""

            value: int

        class ComplexModel(BaseModel):
            """Complex request model."""

            name: str
            nested: NestedModel

        @parse_request(ComplexModel)
        def sync_tool(request, ctx=None):
            return f"{request.name}:{request.nested.value}"

        mock_ctx = MagicMock()
        json_str = '{"name": "test", "nested": {"value": 42}}'
        with patch("fastmcp.server.dependencies.get_context", return_value=mock_ctx):
            result = sync_tool(json_str)
        assert result == "test:42"


class TestParseRequestFlattenedDecorator:
    """Test parse_request decorator when MCP_PARSE_REQUEST_ENABLED=False.

    In this mode the decorator produces a "flattened" wrapper that exposes
    individual Pydantic model fields as function parameters instead of a
    single opaque ``request`` parameter.
    """

    class SimpleRequest(BaseModel):
        """Request with required and optional fields."""

        name: str = Field(description="The name")
        count: int = Field(description="Item count")
        tag: str | None = Field(default=None, description="Optional tag")

    class EmptyRequest(BaseModel):
        """Request with no fields (like GetSupersetInstanceInfoRequest)."""

    class ParentModel(BaseModel):
        """Base model with inherited fields."""

        use_cache: bool = Field(default=True, description="Use cache")

    class ChildRequest(ParentModel):
        """Child inherits use_cache from ParentModel."""

        page: int = Field(default=1, description="Page number")

    class ListDefaultRequest(BaseModel):
        """Request with default_factory fields."""

        items: List[str] = Field(default_factory=list, description="List of items")
        label: str = Field(default="default", description="A label")

    @pytest.fixture(autouse=True)
    def _disable_parse_request(self):
        """Ensure MCP_PARSE_REQUEST_ENABLED=False for flattened tests."""
        from unittest.mock import patch

        with patch(
            "superset.mcp_service.utils.schema_utils._is_parse_request_enabled",
            return_value=False,
        ):
            yield

    def test_flattened_signature_has_individual_params(self):
        """Decorated function should expose model fields, not 'request'."""

        @parse_request(self.SimpleRequest)
        async def my_tool(request, ctx=None):
            pass

        sig = inspect.signature(my_tool)
        param_names = list(sig.parameters.keys())
        assert "request" not in param_names
        assert "ctx" not in param_names
        assert "name" in param_names
        assert "count" in param_names
        assert "tag" in param_names

    def test_flattened_signature_defaults(self):
        """Required fields have no default; optional fields keep their defaults."""

        @parse_request(self.SimpleRequest)
        async def my_tool(request, ctx=None):
            pass

        sig = inspect.signature(my_tool)
        assert sig.parameters["name"].default is inspect.Parameter.empty
        assert sig.parameters["count"].default is inspect.Parameter.empty
        assert sig.parameters["tag"].default is None

    def test_flattened_async_constructs_model(self):
        """Async flattened wrapper should construct model from kwargs."""
        from unittest.mock import MagicMock, patch

        @parse_request(self.SimpleRequest)
        async def my_tool(request, ctx=None):
            return f"{request.name}:{request.count}:{request.tag}"

        mock_ctx = MagicMock()
        with patch("fastmcp.server.dependencies.get_context", return_value=mock_ctx):
            result = asyncio.run(my_tool(name="hello", count=7, tag="x"))
        assert result == "hello:7:x"

    def test_flattened_sync_constructs_model(self):
        """Sync flattened wrapper should construct model from kwargs."""
        from unittest.mock import MagicMock, patch

        @parse_request(self.SimpleRequest)
        def my_tool(request, ctx=None):
            return f"{request.name}:{request.count}:{request.tag}"

        mock_ctx = MagicMock()
        with patch("fastmcp.server.dependencies.get_context", return_value=mock_ctx):
            result = my_tool(name="hello", count=7)
        assert result == "hello:7:None"

    def test_flattened_empty_model(self):
        """Empty request model should produce zero parameters."""

        @parse_request(self.EmptyRequest)
        async def my_tool(request, ctx=None):
            return "ok"

        sig = inspect.signature(my_tool)
        assert len(sig.parameters) == 0

    def test_flattened_empty_model_callable(self):
        """Tool with empty model should be callable with no args."""
        from unittest.mock import MagicMock, patch

        @parse_request(self.EmptyRequest)
        async def my_tool(request, ctx=None):
            return "ok"

        mock_ctx = MagicMock()
        with patch("fastmcp.server.dependencies.get_context", return_value=mock_ctx):
            result = asyncio.run(my_tool())
        assert result == "ok"

    def test_flattened_inherited_fields(self):
        """Inherited fields from base model should appear in the signature."""

        @parse_request(self.ChildRequest)
        async def my_tool(request, ctx=None):
            return f"{request.use_cache}:{request.page}"

        sig = inspect.signature(my_tool)
        assert "use_cache" in sig.parameters
        assert "page" in sig.parameters
        assert sig.parameters["use_cache"].default is True
        assert sig.parameters["page"].default == 1

    def test_flattened_inherited_fields_callable(self):
        """Tool with inherited fields should be callable."""
        from unittest.mock import MagicMock, patch

        @parse_request(self.ChildRequest)
        async def my_tool(request, ctx=None):
            return f"{request.use_cache}:{request.page}"

        mock_ctx = MagicMock()
        with patch("fastmcp.server.dependencies.get_context", return_value=mock_ctx):
            result = asyncio.run(my_tool(use_cache=False, page=3))
        assert result == "False:3"

    def test_flattened_default_factory_fields(self):
        """Fields with default_factory should get the factory result as default."""

        @parse_request(self.ListDefaultRequest)
        def my_tool(request, ctx=None):
            return f"{request.items}:{request.label}"

        sig = inspect.signature(my_tool)
        assert sig.parameters["items"].default == []
        assert sig.parameters["label"].default == "default"

    def test_flattened_preserves_docstring(self):
        """Flattened wrapper should preserve the original function's docstring."""

        @parse_request(self.SimpleRequest)
        async def my_tool(request, ctx=None):
            """My tool docstring."""
            pass

        assert my_tool.__doc__ == "My tool docstring."

    def test_flattened_preserves_function_name(self):
        """Flattened wrapper should preserve the original function's name."""

        @parse_request(self.SimpleRequest)
        async def my_tool(request, ctx=None):
            pass

        assert my_tool.__name__ == "my_tool"

    def test_flattened_params_are_keyword_only(self):
        """All parameters should be keyword-only."""

        @parse_request(self.SimpleRequest)
        async def my_tool(request, ctx=None):
            pass

        sig = inspect.signature(my_tool)
        for param in sig.parameters.values():
            assert param.kind == inspect.Parameter.KEYWORD_ONLY

    def test_flattened_validation_error(self):
        """Pydantic validation errors should propagate when constructing model."""
        from unittest.mock import MagicMock, patch

        @parse_request(self.SimpleRequest)
        def my_tool(request, ctx=None):
            return "ok"

        mock_ctx = MagicMock()
        with patch("fastmcp.server.dependencies.get_context", return_value=mock_ctx):
            with pytest.raises(ValidationError):
                my_tool(name="test", count="not_a_number")

    def test_flattened_annotations_have_descriptions(self):
        """Annotations should include Field descriptions for FastMCP schema."""
        from typing import get_origin

        @parse_request(self.SimpleRequest)
        async def my_tool(request, ctx=None):
            pass

        sig = inspect.signature(my_tool)
        name_param = sig.parameters["name"]
        # Should be Annotated[str, Field(description="The name")]
        assert get_origin(name_param.annotation) is not None or hasattr(
            name_param.annotation, "__metadata__"
        )

    def test_flattened_annotations_forward_constraints(self):
        """Constraint metadata (ge, le, min_length, pattern, etc.) should be
        forwarded into the Annotated type so FastMCP includes them in the
        JSON schema."""
        from typing import get_args, get_origin

        from annotated_types import Ge, Le, MaxLen, MinLen

        class ConstrainedRequest(BaseModel):
            page: int = Field(1, description="Page number", ge=1, le=1000)
            name: str = Field(..., description="Name", min_length=1, max_length=255)

        @parse_request(ConstrainedRequest)
        async def my_tool(request, ctx=None):
            pass

        sig = inspect.signature(my_tool)

        # Check page param has ge/le constraints in metadata
        page_ann = sig.parameters["page"].annotation
        assert get_origin(page_ann) is Annotated
        page_metadata = get_args(page_ann)[1:]  # skip base type
        metadata_types = [type(m) for m in page_metadata]
        assert Ge in metadata_types, f"Missing Ge in {page_metadata}"
        assert Le in metadata_types, f"Missing Le in {page_metadata}"

        # Check name param has min_length/max_length constraints
        name_ann = sig.parameters["name"].annotation
        assert get_origin(name_ann) is Annotated
        name_metadata = get_args(name_ann)[1:]
        metadata_types = [type(m) for m in name_metadata]
        assert MinLen in metadata_types, f"Missing MinLen in {name_metadata}"
        assert MaxLen in metadata_types, f"Missing MaxLen in {name_metadata}"

    def test_flattened_uses_alias_as_param_name(self):
        """When a field has an alias, the flattened param name should be the alias,
        not the Python field name. This ensures model_validate() works for models
        without populate_by_name=True."""

        class AliasedRequest(BaseModel):
            schema_name: str | None = Field(None, description="Schema", alias="schema")
            database_id: int = Field(..., description="DB ID")

        @parse_request(AliasedRequest)
        async def my_tool(request, ctx=None):
            return {"schema": request.schema_name, "db": request.database_id}

        sig = inspect.signature(my_tool)
        param_names = list(sig.parameters.keys())
        # alias "schema" should be used instead of field name "schema_name"
        assert "schema" in param_names
        assert "schema_name" not in param_names
        # non-aliased field keeps its name
        assert "database_id" in param_names

    def test_flattened_alias_callable(self):
        """Flattened wrapper with aliased fields should construct model correctly."""
        from unittest.mock import MagicMock, patch

        class AliasedRequest(BaseModel):
            schema_name: str | None = Field(None, description="Schema", alias="schema")
            database_id: int = Field(..., description="DB ID")

        @parse_request(AliasedRequest)
        def my_tool(request, ctx=None):
            return {"schema": request.schema_name, "db": request.database_id}

        mock_ctx = MagicMock()
        with patch("fastmcp.server.dependencies.get_context", return_value=mock_ctx):
            result = my_tool(schema="public", database_id=1)
        assert result == {"schema": "public", "db": 1}
