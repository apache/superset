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

"""Bounded, input-free diagnostics for MCP argument validation."""

from collections.abc import Iterator
from functools import lru_cache
from typing import Any

from fastmcp.exceptions import ValidationError as FastMCPValidationError
from fastmcp.server.middleware import MiddlewareContext
from pydantic import ValidationError

# Bound eager extraction independently of the eight-detail response limit.
_MAX_EXTRACTED_ERRORS = 128

# Never render Pydantic's msg, ctx, input, or arbitrary error type: custom
# validators can put secrets in any of them. These reasons are server-owned.
# value_error is intentionally absent: custom validator messages may carry input.
_REASONS = {
    "missing": "Field required",
    "unsafe_text": (
        "Contains disallowed content (HTML, script or data: URL, event handler, "
        "or SQL keyword); a 'data:' label must not be followed by a comma"
    ),
    "empty_text": "Text must not be empty",
    "empty_certification_text": (
        'No content remains after sanitization; pass an explicit empty string ("") '
        "to clear the field"
    ),
    "bullet_label_comma": (
        "Bullet labels cannot contain commas; use labels without commas"
    ),
    "missing_argument": "Field required",
    "missing_keyword_only_argument": "Field required",
    "unexpected_keyword_argument": "Unexpected argument",
    "extra_forbidden": "Unexpected field",
    "int_type": "Expected an integer",
    "int_parsing": "Expected an integer",
    "int_from_float": "Expected an integer without a fractional part",
    "float_type": "Expected a number",
    "float_parsing": "Expected a number",
    "bool_type": "Expected a boolean",
    "bool_parsing": "Expected a boolean",
    "string_type": "Expected a string",
    "list_type": "Expected a list",
    "dict_type": "Expected an object",
    "model_type": "Expected an object",
    "model_attributes_type": "Expected an object",
    "greater_than": "Must be greater than the allowed minimum",
    "greater_than_equal": "Must be at least the allowed minimum",
    "less_than": "Must be less than the allowed maximum",
    "less_than_equal": "Must be at most the allowed maximum",
    "string_too_short": "String is shorter than the allowed minimum",
    "string_too_long": "String exceeds the allowed maximum length",
    "too_short": "Too few items",
    "too_long": "Too many items",
    "literal_error": "Expected one of the allowed values",
    "enum": "Expected one of the allowed values",
    "union_tag_invalid": "Invalid variant",
    "union_tag_not_found": "Variant required",
    "finite_number": "Expected a finite number",
    "uuid_parsing": "Expected a UUID",
    "uuid_type": "Expected a UUID",
    "date_type": "Expected a date",
    "datetime_type": "Expected a datetime",
}


def _schema_nodes(
    schema: dict[str, Any], nodes: list[dict[str, Any]]
) -> Iterator[dict[str, Any]]:
    """Expand local references and composition branches at one path position."""
    pending = list(nodes)
    seen: set[int] = set()
    while pending:
        node = pending.pop()
        if id(node) in seen:
            continue
        seen.add(id(node))
        if "$ref" in node:
            ref = node["$ref"]
            if not isinstance(ref, str) or not ref.startswith("#/"):
                continue
            target: Any = schema
            for part in ref[2:].split("/"):
                if not isinstance(target, dict):
                    break
                target = target.get(part.replace("~1", "/").replace("~0", "~"))
            if not isinstance(target, dict):
                continue
            pending.append(target)
        yield node
        for keyword in ("anyOf", "oneOf", "allOf"):
            branches = node.get(keyword)
            if isinstance(branches, list):
                pending.extend(
                    branch for branch in branches if isinstance(branch, dict)
                )


@lru_cache(maxsize=1)
def _chart_config_diagnostic_schema() -> dict[str, Any]:
    """Keep full chart field metadata server-side for compact tool schemas."""
    from pydantic import TypeAdapter

    from superset.mcp_service.chart.schemas import ChartConfig

    return TypeAdapter(ChartConfig).json_schema()


@lru_cache(maxsize=1)
def _chart_config_union_marker() -> str | None:
    """Obtain Pydantic's server-generated outer union label, without parsing it.

    Update requests accept both the tagged chart union and a partial Treemap
    config. Pydantic inserts an additional branch label into their locations.
    A constant invalid discriminator identifies that label across versions.
    """
    from pydantic import TypeAdapter

    from superset.mcp_service.chart.schemas import UpdateChartRequest

    adapter = TypeAdapter(UpdateChartRequest.model_fields["config"].annotation)
    try:
        adapter.validate_python({"chart_type": "__diagnostic_unknown__"})
    except ValidationError as error:
        for item in error.errors(include_input=False, include_context=False):
            if item["type"] == "union_tag_invalid" and len(item["loc"]) == 1:
                marker = item["loc"][0]
                return marker if isinstance(marker, str) else None
    return None


def _compact_chart_location(
    node: dict[str, Any], location: tuple[str | int, ...]
) -> str | None:
    """Resolve only the exact server-owned compact chart schema and known tags."""
    if (
        node.get("required") != ["chart_type"]
        or node.get("additionalProperties") is not True
    ):
        return None
    from superset.mcp_service.chart.schemas import CHART_CONFIG_REFERENCE_SCHEMA

    if (
        {
            key: value
            for key, value in node.items()
            if key not in {"description", "title"}
        }
        != CHART_CONFIG_REFERENCE_SCHEMA
        or not location
        or not isinstance(location[0], str)
    ):
        return None
    if location[0] == _chart_config_union_marker():
        location = location[1:]
    if not location or not isinstance(location[0], str):
        return None
    schema = _chart_config_diagnostic_schema()
    reference = schema.get("discriminator", {}).get("mapping", {}).get(location[0])
    if not isinstance(reference, str) or not reference.startswith("#/$defs/"):
        return None
    # The tag is Pydantic's union branch marker, not an input field. Resolve
    # subsequent fields against that branch, never against arbitrary dict keys.
    branch_schema = {"$ref": reference, "$defs": schema.get("$defs", {})}
    return _schema_location(branch_schema, location[1:])


def _schema_location(schema: dict[str, Any], location: tuple[str | int, ...]) -> str:
    """Expose only declared fields and array indices along the schema path.

    Never follow additionalProperties: dictionary keys, unknown union tags and
    other unresolved positions mask the remainder of the path, even if a name
    is declared elsewhere in the schema.
    """
    nodes = [schema]
    parts = []
    for index, part in enumerate(location[:8]):
        children: list[dict[str, Any]] = []
        for node in _schema_nodes(schema, nodes):
            chart_location = _compact_chart_location(node, location[index:8])
            if chart_location is not None:
                return ".".join([*parts, chart_location])
            child: Any = None
            if isinstance(part, str):
                properties = node.get("properties")
                if isinstance(properties, dict):
                    child = properties.get(part)
            elif isinstance(part, int) and part >= 0:
                prefix_items = node.get("prefixItems")
                if isinstance(prefix_items, list) and part < len(prefix_items):
                    child = prefix_items[part]
                else:
                    child = node.get("items")
            if isinstance(child, dict):
                children.append(child)
            elif isinstance(child, bool):
                children.append({})
        parts.append(str(part) if children and len(str(part)) <= 64 else "[field]")
        nodes = children
    return ".".join(parts) or "arguments"


def _is_unwrapped_request_field(
    schema: dict[str, Any], location: tuple[str | int, ...]
) -> bool:
    """Recognize only a top-level key published directly under request.

    This exception to path masking never applies to dictionary keys, union
    tags, or nested extras, even when they collide with declared field names.
    """
    if len(location) != 1 or not isinstance(location[0], str):
        return False
    field = location[0]
    if len(field) > 64:
        return False
    requests: list[dict[str, Any]] = []
    for node in _schema_nodes(schema, [schema]):
        properties = node.get("properties")
        if not isinstance(properties, dict):
            continue
        if field in properties:
            return False
        request = properties.get("request")
        if isinstance(request, dict):
            requests.append(request)
    for node in _schema_nodes(schema, requests):
        properties = node.get("properties")
        if isinstance(properties, dict) and field in properties:
            return True
    return False


async def validation_message(
    error: Exception,
    context: MiddlewareContext,
) -> str:
    """Format locations from the published schema and reasons from a vocabulary.

    Unknown locations (extra arguments, dict keys, union tags) are masked.
    Misplaced top-level request fields get a schema-backed wrapper hint.
    Errors without Pydantic's structured API fail closed rather than parsing
    exception text, which can contain input or backend diagnostics.
    """
    schema: dict[str, Any] = {}
    prefix = "Request validation failed"
    try:
        if context.fastmcp_context is not None:
            tool = await context.fastmcp_context.fastmcp.get_tool(context.message.name)
            if tool is not None:
                schema = tool.parameters
                prefix = f"Validation error in {tool.name}"
    except Exception:  # noqa: BLE001
        # Discovery failures must not replace the original validation failure.
        schema = {}

    if isinstance(error, FastMCPValidationError) and isinstance(
        error.__cause__, ValidationError
    ):
        # FastMCP preserves the structured argument error as the direct cause.
        error = error.__cause__
    # Pydantic has no bounded/lazy errors API; even with optional fields disabled,
    # errors() allocates dictionaries and renders messages for every error.
    if (
        not isinstance(error, ValidationError)
        or error.error_count() > _MAX_EXTRACTED_ERRORS
    ):
        return f"{prefix}: arguments: Invalid arguments; check the input schema"

    details = []
    errors = error.errors(include_url=False, include_context=False, include_input=False)
    for item in errors[:8]:
        reason = _REASONS.get(item["type"], "Invalid value; check the field schema")
        try:
            location = _schema_location(schema, item["loc"])
            if item["type"] == "unexpected_keyword_argument" and (
                _is_unwrapped_request_field(schema, item["loc"])
            ):
                location = f"request.{item['loc'][0]}"
                reason = "Unexpected top-level argument (place under request)"
        except Exception:  # noqa: BLE001
            # Malformed schemas must not expose unchecked location segments.
            location = _schema_location({}, item["loc"])
        details.append(f"{location}: {reason}")
    if len(errors) > 8:
        details.append("Additional validation errors omitted")
    return f"{prefix}: {'; '.join(details)}"
