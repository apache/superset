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

from typing import Any

from fastmcp.exceptions import ValidationError as FastMCPValidationError
from fastmcp.server.middleware import MiddlewareContext
from pydantic import ValidationError

# Never render Pydantic's msg, ctx, input, or arbitrary error type: custom
# validators can put secrets in any of them. These reasons are server-owned.
_REASONS = {
    "missing": "Field required",
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


def _schema_fields(schema: dict[str, Any]) -> set[str]:
    """Allow only declared property names, never input-supplied dict keys."""
    fields: set[str] = set()
    pending = [schema]
    while pending:
        node = pending.pop()
        for keyword in ("properties", "$defs", "definitions"):
            children = node.get(keyword)
            if isinstance(children, dict):
                if keyword == "properties":
                    fields.update(name for name in children if len(name) <= 64)
                pending.extend(
                    child for child in children.values() if isinstance(child, dict)
                )
        for keyword in ("items", "additionalProperties"):
            child = node.get(keyword)
            if isinstance(child, dict):
                pending.append(child)
        for keyword in ("anyOf", "oneOf", "allOf", "prefixItems"):
            children = node.get(keyword)
            if isinstance(children, list):
                pending.extend(child for child in children if isinstance(child, dict))
    return fields


async def validation_message(
    error: Exception,
    context: MiddlewareContext,
) -> str:
    """Format locations from the published schema and reasons from a vocabulary.

    Unknown locations (extra arguments, dict keys, union tags) are masked.
    Errors without Pydantic's structured API fail closed rather than parsing
    exception text, which can contain input or backend diagnostics.
    """
    fields: set[str] = set()
    prefix = "Request validation failed"
    try:
        if context.fastmcp_context is not None:
            tool = await context.fastmcp_context.fastmcp.get_tool(context.message.name)
            if tool is not None:
                fields = _schema_fields(tool.parameters)
                prefix = f"Validation error in {tool.name}"
    except Exception:  # noqa: BLE001
        # Discovery failures must not replace the original validation failure.
        fields = set()

    if isinstance(error, FastMCPValidationError) and isinstance(
        error.__cause__, ValidationError
    ):
        # FastMCP preserves the structured argument error as the direct cause.
        error = error.__cause__
    if not isinstance(error, ValidationError):
        return f"{prefix}: arguments: Invalid arguments; check the input schema"

    details = []
    errors = error.errors(include_url=False, include_context=False, include_input=False)
    for item in errors[:8]:
        location = (
            ".".join(
                str(part) if isinstance(part, int) or part in fields else "[field]"
                for part in item["loc"][:8]
            )
            or "arguments"
        )
        reason = _REASONS.get(item["type"], "Invalid value; check the field schema")
        details.append(f"{location}: {reason}")
    if len(errors) > 8:
        details.append("Additional validation errors omitted")
    return f"{prefix}: {'; '.join(details)}"
