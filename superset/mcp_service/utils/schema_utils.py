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
Generic utilities for flexible schema input handling in MCP tools.

This module provides utilities to accept both JSON string and object formats
for input parameters, making MCP tools more flexible for different clients.
"""

from __future__ import annotations

import asyncio
import logging
from functools import wraps
from typing import Any, Callable, List, Type, TypeVar

from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)

T = TypeVar("T")


class JSONParseError(ValueError):
    """Raised when JSON parsing fails with helpful context."""

    def __init__(self, value: Any, error: Exception, param_name: str = "parameter"):
        self.value = value
        self.original_error = error
        self.param_name = param_name
        super().__init__(
            f"Failed to parse {param_name} from JSON string: {error}. "
            f"Received value: {value!r}"
        )


def parse_json_or_passthrough(
    value: Any, param_name: str = "parameter", strict: bool = False
) -> Any:
    """
    Parse a value that can be either a JSON string or a native Python object.

    This function handles the common pattern where API parameters can be provided
    as either:
    - A JSON string (e.g., from CLI tools or tests): '{"key": "value"}'
    - A native Python object (e.g., from LLM clients): {"key": "value"}

    Args:
        value: The input value to parse. Can be a string, list, dict, or any JSON-
            serializable type.
        param_name: Name of the parameter for error messages (default: "parameter")
        strict: If True, raises JSONParseError on parse failures. If False, logs
            warning and returns original value (default: False)

    Returns:
        Parsed Python object if value was a JSON string, otherwise returns value
        unchanged.

    Raises:
        JSONParseError: If strict=True and JSON parsing fails.

    Examples:
        >>> parse_json_or_passthrough('[1, 2, 3]', 'numbers')
        [1, 2, 3]

        >>> parse_json_or_passthrough([1, 2, 3], 'numbers')
        [1, 2, 3]

        >>> parse_json_or_passthrough('{"key": "value"}', 'config')
        {'key': 'value'}

        >>> parse_json_or_passthrough({'key': 'value'}, 'config')
        {'key': 'value'}
    """
    # If not a string, return as-is (already in object form)
    if not isinstance(value, str):
        return value

    # Try to parse as JSON
    try:
        from superset.utils import json

        parsed = json.loads(value)
        logger.debug("Successfully parsed %s from JSON string", param_name)
        return parsed
    except (ValueError, TypeError) as e:
        error_msg = (
            f"Failed to parse {param_name} from JSON string: {e}. Received: {value!r}"
        )

        if strict:
            raise JSONParseError(value, e, param_name) from None

        logger.warning("%s. Returning original value.", error_msg)
        return value


def parse_json_or_list(
    value: Any, param_name: str = "parameter", item_separator: str = ","
) -> List[Any]:
    """
    Parse a value into a list, accepting JSON string, list, or comma-separated string.

    This function provides maximum flexibility for list parameters by accepting:
    - JSON array string: '["item1", "item2"]'
    - Python list: ["item1", "item2"]
    - Comma-separated string: "item1, item2, item3"
    - Empty/None: returns empty list

    Args:
        value: Input value to parse into a list
        param_name: Name of the parameter for error messages
        item_separator: Separator for comma-separated strings (default: ",")

    Returns:
        List of items. Returns empty list if value is None or empty.

    Examples:
        >>> parse_json_or_list('["a", "b"]', 'items')
        ['a', 'b']

        >>> parse_json_or_list(['a', 'b'], 'items')
        ['a', 'b']

        >>> parse_json_or_list('a, b, c', 'items')
        ['a', 'b', 'c']

        >>> parse_json_or_list(None, 'items')
        []
    """
    # Handle None and empty values
    if value is None or value == "":
        return []

    # Already a list, return as-is
    if isinstance(value, list):
        return value

    # Try to parse as JSON
    if isinstance(value, str):
        try:
            from superset.utils import json

            parsed = json.loads(value)
            # If successfully parsed and it's a list, return it
            if isinstance(parsed, list):
                logger.debug("Successfully parsed %s from JSON string", param_name)
                return parsed

            # If parsed to non-list (e.g., single value), wrap in list
            logger.debug(
                "Parsed %s from JSON to non-list, wrapping in list", param_name
            )
            return [parsed]
        except (ValueError, TypeError):
            # Not valid JSON, try comma-separated parsing
            logger.debug(
                "Could not parse %s as JSON, trying comma-separated", param_name
            )
            items = [
                item.strip() for item in value.split(item_separator) if item.strip()
            ]
            return items

    # For any other type, wrap in a list
    logger.debug("Wrapping %s value in list", param_name)
    return [value]


def parse_json_or_model(
    value: Any, model_class: Type[BaseModel], param_name: str = "parameter"
) -> BaseModel:
    """
    Parse a value into a Pydantic model, accepting JSON string or dict.

    Args:
        value: Input value to parse (JSON string, dict, or model instance)
        model_class: Pydantic model class to validate against
        param_name: Name of the parameter for error messages

    Returns:
        Validated Pydantic model instance

    Raises:
        ValidationError: If the value cannot be parsed or validated

    Examples:
        >>> class MyModel(BaseModel):
        ...     name: str
        ...     value: int

        >>> parse_json_or_model('{"name": "test", "value": 42}', MyModel)
        MyModel(name='test', value=42)

        >>> parse_json_or_model({"name": "test", "value": 42}, MyModel)
        MyModel(name='test', value=42)
    """
    # If already an instance of the model, return as-is
    if isinstance(value, model_class):
        return value

    # Parse JSON string if needed
    parsed_value = parse_json_or_passthrough(value, param_name, strict=True)

    # Validate and construct the model
    try:
        return model_class.model_validate(parsed_value)
    except ValidationError:
        logger.error(
            "Failed to validate %s against %s", param_name, model_class.__name__
        )
        raise


def parse_json_or_model_list(
    value: Any,
    model_class: Type[BaseModel],
    param_name: str = "parameter",
) -> List[BaseModel]:
    """
    Parse a value into a list of Pydantic models, accepting JSON string or list.

    Args:
        value: Input value to parse (JSON string, list of dicts, or list of models)
        model_class: Pydantic model class for list items
        param_name: Name of the parameter for error messages

    Returns:
        List of validated Pydantic model instances

    Raises:
        ValidationError: If any item cannot be parsed or validated

    Examples:
        >>> class Item(BaseModel):
        ...     name: str

        >>> parse_json_or_model_list('[{"name": "a"}, {"name": "b"}]', Item)
        [Item(name='a'), Item(name='b')]

        >>> parse_json_or_model_list([{"name": "a"}, {"name": "b"}], Item)
        [Item(name='a'), Item(name='b')]
    """
    # Handle None and empty
    if value is None or value == "":
        return []

    # Parse to list first
    items = parse_json_or_list(value, param_name)

    # Validate each item against the model
    validated_items = []
    for i, item in enumerate(items):
        try:
            if isinstance(item, model_class):
                validated_items.append(item)
            else:
                validated_items.append(model_class.model_validate(item))
        except ValidationError:
            logger.error(
                "Failed to validate %s[%s] against %s",
                param_name,
                i,
                model_class.__name__,
            )
            # Re-raise original validation error
            raise

    return validated_items


# Pydantic validator decorators for common use cases
def json_or_passthrough_validator(
    param_name: str | None = None, strict: bool = False
) -> Callable[[Type[BaseModel], Any, Any], Any]:
    """
    Decorator factory for Pydantic field validators that accept JSON or objects.

    This creates a validator that can be used with Pydantic's @field_validator
    decorator to automatically parse JSON strings.

    Args:
        param_name: Parameter name for error messages (uses field name if None)
        strict: Whether to raise errors on parse failures

    Returns:
        Validator function compatible with @field_validator

    Example:
        >>> class MySchema(BaseModel):
        ...     config: dict
        ...
        ...     @field_validator('config', mode='before')
        ...     @classmethod
        ...     def parse_config(cls, v):
        ...         return parse_json_or_passthrough(v, 'config')
    """

    def validator(cls: Type[BaseModel], v: Any, info: Any = None) -> Any:
        # Use field name from validation info if param_name not provided
        field_name = param_name or (info.field_name if info else "field")
        return parse_json_or_passthrough(v, field_name, strict)

    return validator


def json_or_list_validator(
    param_name: str | None = None, item_separator: str = ","
) -> Callable[[Type[BaseModel], Any, Any], List[Any]]:
    """
    Decorator factory for Pydantic validators that parse values into lists.

    Args:
        param_name: Parameter name for error messages
        item_separator: Separator for comma-separated strings

    Returns:
        Validator function compatible with @field_validator

    Example:
        >>> class MySchema(BaseModel):
        ...     items: List[str]
        ...
        ...     @field_validator('items', mode='before')
        ...     @classmethod
        ...     def parse_items(cls, v):
        ...         return parse_json_or_list(v, 'items')
    """

    def validator(cls: Type[BaseModel], v: Any, info: Any = None) -> List[Any]:
        field_name = param_name or (info.field_name if info else "field")
        return parse_json_or_list(v, field_name, item_separator)

    return validator


def json_or_model_list_validator(
    model_class: Type[BaseModel], param_name: str | None = None
) -> Callable[[Type[BaseModel], Any, Any], List[BaseModel]]:
    """
    Decorator factory for Pydantic validators that parse lists of models.

    Args:
        model_class: Pydantic model class for list items
        param_name: Parameter name for error messages

    Returns:
        Validator function compatible with @field_validator

    Example:
        >>> class FilterModel(BaseModel):
        ...     col: str
        ...     value: str
        ...
        >>> class MySchema(BaseModel):
        ...     filters: List[FilterModel]
        ...
        ...     @field_validator('filters', mode='before')
        ...     @classmethod
        ...     def parse_filters(cls, v):
        ...         return parse_json_or_model_list(v, FilterModel, 'filters')
    """

    def validator(cls: Type[BaseModel], v: Any, info: Any = None) -> List[BaseModel]:
        field_name = param_name or (info.field_name if info else "field")
        return parse_json_or_model_list(v, model_class, field_name)

    return validator


def _is_parse_request_enabled() -> bool:
    """Check if parse_request decorator is enabled via config."""
    try:
        from flask import current_app, has_app_context

        if has_app_context():
            return bool(current_app.config["MCP_PARSE_REQUEST_ENABLED"])
    except (ImportError, RuntimeError, KeyError):
        pass
    try:
        from superset.mcp_service.flask_singleton import app as flask_app

        return bool(flask_app.config["MCP_PARSE_REQUEST_ENABLED"])
    except (ImportError, RuntimeError, AttributeError, KeyError):
        pass
    return True


def parse_request(
    request_class: Type[BaseModel],
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """
    Decorator to handle Claude Code bug where requests are double-serialized as strings.

    Automatically parses string requests to Pydantic models before calling
    the tool function. Also modifies the function's type annotations to accept
    str | RequestModel to pass FastMCP validation.

    Can be disabled by setting MCP_PARSE_REQUEST_ENABLED = False in config.
    When disabled, string-to-model parsing is skipped but ctx injection and
    signature stripping still apply.

    See: https://github.com/anthropics/claude-code/issues/5504

    Args:
        request_class: The Pydantic model class for the request

    Returns:
        Decorator function that wraps the tool function

    Usage:
        @mcp.tool
        @mcp_auth_hook
        @parse_request(ListChartsRequest)
        async def list_charts(
            request: ListChartsRequest, ctx: Context  # Keep clean type hint
        ) -> ChartList:
            # Decorator handles string conversion and type annotation
            await ctx.info(f"Listing charts: page={request.page}")
            ...

    Note:
        - Works with both async and sync functions
        - Request must be the first positional argument
        - Modifies __annotations__ to accept str | RequestModel for FastMCP
        - Function implementation can use clean RequestModel type hint
        - If request is already a model instance, it passes through unchanged
        - Handles JSON string parsing with helpful error messages
    """

    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:
        import types

        def _maybe_parse(request: Any) -> Any:
            if _is_parse_request_enabled():
                return parse_json_or_model(request, request_class, "request")
            return request

        if asyncio.iscoroutinefunction(func):

            @wraps(func)
            async def async_wrapper(request: Any, *args: Any, **kwargs: Any) -> Any:
                from fastmcp.server.dependencies import get_context

                ctx = get_context()
                return await func(_maybe_parse(request), ctx, *args, **kwargs)

            wrapper = async_wrapper
        else:

            @wraps(func)
            def sync_wrapper(request: Any, *args: Any, **kwargs: Any) -> Any:
                from fastmcp.server.dependencies import get_context

                ctx = get_context()
                return func(_maybe_parse(request), ctx, *args, **kwargs)

            wrapper = sync_wrapper

        # Merge original function's __globals__ into wrapper's __globals__
        # This allows get_type_hints() to resolve type annotations from the
        # original module (e.g., Context from fastmcp)
        # FastMCP 2.13.2+ uses get_type_hints() which needs access to these types
        merged_globals = {**wrapper.__globals__, **func.__globals__}  # type: ignore[attr-defined]
        new_wrapper = types.FunctionType(
            wrapper.__code__,  # type: ignore[attr-defined]
            merged_globals,
            wrapper.__name__,
            wrapper.__defaults__,  # type: ignore[attr-defined]
            wrapper.__closure__,  # type: ignore[attr-defined]
        )
        # Copy __dict__ but exclude __wrapped__
        # NOTE: We intentionally do NOT preserve __wrapped__ here.
        # Setting __wrapped__ causes inspect.signature() to follow the chain
        # and find 'ctx' in the original function's signature, even after
        # FastMCP's create_function_without_params removes it from annotations.
        # This breaks Pydantic's TypeAdapter which expects signature params
        # to match type_hints.
        new_wrapper.__dict__.update(
            {k: v for k, v in wrapper.__dict__.items() if k != "__wrapped__"}
        )
        new_wrapper.__module__ = wrapper.__module__
        new_wrapper.__qualname__ = wrapper.__qualname__
        # Copy docstring from original function (not wrapper, which has no docstring)
        new_wrapper.__doc__ = func.__doc__

        request_annotation = str | request_class
        _apply_signature_for_fastmcp(new_wrapper, func, request_annotation)

        return new_wrapper

    return decorator


def _apply_signature_for_fastmcp(
    wrapper: Any,
    original_func: Callable[..., Any],
    request_annotation: Any,
) -> None:
    """Apply annotations and signature to wrapper, stripping ctx for FastMCP.

    FastMCP injects ctx via dependency injection, so it must not appear in
    the function's annotations or signature. This helper copies annotations
    from the original function, swaps the request type, and removes ctx.
    """
    import inspect as sig_inspect

    from fastmcp import Context as FMContext

    # Copy annotations, remove ctx, set request type
    if hasattr(original_func, "__annotations__"):
        wrapper.__annotations__ = {
            k: v for k, v in original_func.__annotations__.items() if k != "ctx"
        }
        wrapper.__annotations__["request"] = request_annotation
    else:
        wrapper.__annotations__ = {"request": request_annotation}

    # Build signature without ctx parameter
    orig_sig = sig_inspect.signature(original_func)
    new_params = []
    for name, param in orig_sig.parameters.items():
        if _is_context_param(param, name, FMContext):
            continue
        if name == "request":
            new_params.append(param.replace(annotation=request_annotation))
        else:
            new_params.append(param)
    wrapper.__signature__ = orig_sig.replace(parameters=new_params)


def _is_context_param(param: Any, name: str, context_type: Any) -> bool:
    """Check if a parameter is a FastMCP Context parameter."""
    return (
        param.annotation is context_type
        or (
            hasattr(param.annotation, "__name__")
            and param.annotation.__name__ == "Context"
        )
        or (
            isinstance(param.annotation, str)
            and (param.annotation == "Context" or param.annotation.endswith(".Context"))
        )
        or name == "ctx"
    )
