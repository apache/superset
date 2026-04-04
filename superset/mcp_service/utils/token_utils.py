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
Token counting and response size utilities for MCP service.

This module provides utilities to estimate token counts and generate smart
suggestions when responses exceed configured limits. This prevents large
responses from overwhelming LLM clients like Claude Desktop.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Union

from pydantic import BaseModel
from typing_extensions import TypeAlias

logger = logging.getLogger(__name__)

# Type alias for MCP tool responses (Pydantic models, dicts, lists, strings, bytes)
ToolResponse: TypeAlias = Union[BaseModel, Dict[str, Any], List[Any], str, bytes]

# Approximate characters per token for estimation
# Claude tokenizer averages ~4 chars per token for English text
# JSON tends to be more verbose, so we use a slightly lower ratio
CHARS_PER_TOKEN = 3.5


def estimate_token_count(text: str | bytes) -> int:
    """
    Estimate the token count for a given text.

    Uses a character-based heuristic since we don't have direct access to
    the actual tokenizer. This is conservative to avoid underestimating.

    Args:
        text: The text to estimate tokens for (string or bytes)

    Returns:
        Estimated number of tokens
    """
    if isinstance(text, bytes):
        text = text.decode("utf-8", errors="replace")

    # Simple heuristic: ~3.5 characters per token for JSON/code
    text_length = len(text)
    if text_length == 0:
        return 0
    return max(1, int(text_length / CHARS_PER_TOKEN))


def estimate_response_tokens(response: ToolResponse) -> int:
    """
    Estimate token count for an MCP tool response.

    Handles various response types including Pydantic models, dicts, and strings.

    Args:
        response: The response object to estimate

    Returns:
        Estimated number of tokens
    """
    try:
        from superset.utils import json

        # Convert response to JSON string for accurate estimation
        if hasattr(response, "model_dump"):
            # Pydantic model
            response_str = json.dumps(response.model_dump())
        elif isinstance(response, (dict, list)):
            response_str = json.dumps(response)
        elif isinstance(response, bytes):
            # Delegate to estimate_token_count which handles decoding safely
            return estimate_token_count(response)
        elif isinstance(response, str):
            response_str = response
        else:
            response_str = str(response)

        return estimate_token_count(response_str)
    except Exception as e:  # noqa: BLE001
        logger.warning("Failed to estimate response tokens: %s", e)
        # Return a high estimate to be safe (conservative fallback)
        return 100000


def get_response_size_bytes(response: ToolResponse) -> int:
    """
    Get the size of a response in bytes.

    Args:
        response: The response object

    Returns:
        Size in bytes
    """
    try:
        from superset.utils import json

        if hasattr(response, "model_dump"):
            response_str = json.dumps(response.model_dump())
        elif isinstance(response, (dict, list)):
            response_str = json.dumps(response)
        elif isinstance(response, bytes):
            return len(response)
        elif isinstance(response, str):
            return len(response.encode("utf-8"))
        else:
            response_str = str(response)

        return len(response_str.encode("utf-8"))
    except Exception as e:  # noqa: BLE001
        logger.warning("Failed to get response size: %s", e)
        # Return a conservative large value to avoid allowing oversized responses
        # to bypass size checks (returning 0 would underestimate)
        return 1_000_000  # 1MB fallback


def extract_query_params(params: Dict[str, Any] | None) -> Dict[str, Any]:
    """
    Extract relevant query parameters from tool params for suggestions.

    Args:
        params: The tool parameters dict

    Returns:
        Extracted parameters relevant for size reduction suggestions
    """
    if not params:
        return {}

    # Handle nested request object (common pattern in MCP tools)
    if "request" in params and isinstance(params["request"], dict):
        params = params["request"]

    # Keys to extract from params
    extract_keys = [
        # Pagination
        "page_size",
        "limit",
        # Column selection
        "select_columns",
        "columns",
        # Filters
        "filters",
        # Search
        "search",
    ]
    return {k: params[k] for k in extract_keys if k in params}


def generate_size_reduction_suggestions(
    tool_name: str,
    params: Dict[str, Any] | None,
    estimated_tokens: int,
    token_limit: int,
    response: ToolResponse | None = None,
) -> List[str]:
    """
    Generate smart suggestions for reducing response size.

    Analyzes the tool and parameters to provide actionable recommendations.

    Args:
        tool_name: Name of the MCP tool
        params: The tool parameters
        estimated_tokens: Estimated token count of the response
        token_limit: Configured token limit
        response: Optional response object for additional analysis

    Returns:
        List of suggestion strings
    """
    suggestions = []
    query_params = extract_query_params(params)
    reduction_needed = estimated_tokens - token_limit
    reduction_pct = (
        int((reduction_needed / estimated_tokens) * 100) if estimated_tokens else 0
    )

    # Suggestion 1: Reduce page_size or limit
    raw_page_size = query_params.get("page_size") or query_params.get("limit")
    try:
        current_page_size = int(raw_page_size) if raw_page_size is not None else None
    except (TypeError, ValueError):
        current_page_size = None
    if current_page_size and current_page_size > 0:
        # Calculate suggested new limit based on reduction needed
        suggested_limit = max(
            1,
            int(current_page_size * (token_limit / estimated_tokens))
            if estimated_tokens
            else 1,
        )
        suggestions.append(
            f"Reduce page_size/limit from {current_page_size} to {suggested_limit} "
            f"(need ~{reduction_pct}% reduction)"
        )
    else:
        # No limit specified - suggest adding one
        if "list_" in tool_name or tool_name.startswith("get_chart_data"):
            suggestions.append(
                f"Add a 'limit' or 'page_size' parameter (suggested: 10-25 items) "
                f"to reduce response size by ~{reduction_pct}%"
            )
        elif tool_name == "execute_sql":
            suggestions.append(
                f"Use the 'limit' parameter (e.g., limit=100) to cap the number "
                f"of rows returned — need ~{reduction_pct}% reduction"
            )

    # Suggestion 2: Use select_columns to reduce fields
    current_columns = query_params.get("select_columns") or query_params.get("columns")
    if current_columns and len(current_columns) > 5:
        preview = ", ".join(str(c) for c in current_columns[:3])
        suffix = "..." if len(current_columns) > 3 else ""
        suggestions.append(
            f"Reduce select_columns from {len(current_columns)} columns to only "
            f"essential fields (currently: {preview}{suffix})"
        )
    elif not current_columns and "list_" in tool_name:
        # Analyze response to suggest specific columns to exclude
        large_fields = _identify_large_fields(response)
        if large_fields:
            fields_preview = ", ".join(large_fields[:3])
            suffix = "..." if len(large_fields) > 3 else ""
            suggestions.append(
                f"Use 'select_columns' to exclude large fields: "
                f"{fields_preview}{suffix}. Only request the columns you need."
            )
        else:
            suggestions.append(
                "Use 'select_columns' to request only the specific columns you need "
                "instead of fetching all fields"
            )

    # Suggestion 3: Add filters to reduce result set
    current_filters = query_params.get("filters")
    if not current_filters and "list_" in tool_name:
        suggestions.append(
            "Add filters to narrow down results (e.g., filter by owner, "
            "date range, or specific attributes)"
        )

    # Suggestion 4: Tool-specific suggestions
    tool_suggestions = _get_tool_specific_suggestions(tool_name, query_params, response)
    suggestions.extend(tool_suggestions)

    # Suggestion 5: Use search instead of listing all
    if "list_" in tool_name and not query_params.get("search"):
        suggestions.append(
            "Use the 'search' parameter to find specific items instead of "
            "listing all and filtering client-side"
        )

    return suggestions


def _identify_large_fields(response: ToolResponse) -> List[str]:
    """
    Identify fields that contribute most to response size.

    Args:
        response: The response object to analyze

    Returns:
        List of field names that are particularly large
    """
    large_fields: List[str] = []

    try:
        from superset.utils import json

        if hasattr(response, "model_dump"):
            data = response.model_dump()
        elif isinstance(response, dict):
            data = response
        else:
            return large_fields

        # Check for list responses (e.g., charts, dashboards)
        items_key = None
        for key in ["charts", "dashboards", "datasets", "data", "items", "results"]:
            if key in data and isinstance(data[key], list) and data[key]:
                items_key = key
                break

        if items_key and data[items_key]:
            first_item = data[items_key][0]
            if isinstance(first_item, dict):
                # Analyze field sizes in first item
                field_sizes = {}
                for field, value in first_item.items():
                    if value is not None:
                        field_sizes[field] = len(json.dumps(value))

                # Sort by size and identify large fields (>500 chars)
                sorted_fields = sorted(
                    field_sizes.items(), key=lambda x: x[1], reverse=True
                )
                large_fields = [
                    f
                    for f, size in sorted_fields
                    if size > 500 and f not in ("id", "uuid", "name", "slice_name")
                ]

    except Exception as e:  # noqa: BLE001
        logger.debug("Failed to identify large fields: %s", e)

    return large_fields


def _get_tool_specific_suggestions(
    tool_name: str,
    query_params: Dict[str, Any],
    response: ToolResponse,
) -> List[str]:
    """
    Generate tool-specific suggestions based on the tool being called.

    Args:
        tool_name: Name of the MCP tool
        query_params: Extracted query parameters
        response: The response object

    Returns:
        List of tool-specific suggestions
    """
    suggestions = []

    if tool_name == "get_chart_data":
        suggestions.append(
            "For get_chart_data, use 'limit' parameter to restrict rows returned, "
            "or use 'format=csv' for more compact output"
        )

    elif tool_name == "execute_sql":
        suggestions.append(
            "Add a LIMIT clause to your SQL query (e.g., SELECT * FROM table LIMIT 100)"
        )
        if not query_params.get("limit"):
            suggestions.append(
                "Use the execute_sql 'limit' parameter to cap rows returned "
                "(e.g., limit=100) — this overrides any SQL LIMIT clause"
            )

    elif tool_name in ("get_chart_info", "get_dashboard_info", "get_dataset_info"):
        suggestions.append(
            f"For {tool_name}, use 'select_columns' to fetch only specific metadata "
            "fields instead of the full object"
        )

    elif tool_name == "list_charts":
        suggestions.append(
            "For list_charts, exclude 'params' and 'query_context' columns which "
            "contain large JSON blobs - use select_columns to pick specific fields"
        )

    elif tool_name == "list_datasets":
        suggestions.append(
            "For list_datasets, exclude 'columns' and 'metrics' from select_columns "
            "if you only need basic dataset info"
        )

    return suggestions


# Tools eligible for dynamic response truncation instead of hard blocking.
# These tools return single objects (not paginated lists) where truncation
# is preferable to returning an error.
INFO_TOOLS = frozenset(
    {
        "get_chart_info",
        "get_dataset_info",
        "get_dashboard_info",
        "get_instance_info",
    }
)

# Maximum character length for string fields before truncation
_MAX_STRING_CHARS = 500
# Maximum items to keep in list fields before truncation
_MAX_LIST_ITEMS = 30
# Maximum keys to keep when summarizing large dict fields
_MAX_DICT_KEYS = 20


def _truncate_strings(
    data: Dict[str, Any], notes: List[str], max_chars: int = _MAX_STRING_CHARS
) -> bool:
    """Truncate string fields exceeding max_chars. Returns True if any truncated."""
    changed = False
    for key, value in data.items():
        if isinstance(value, str) and len(value) > max_chars:
            original_len = len(value)
            data[key] = value[:max_chars] + f"... [truncated from {original_len} chars]"
            notes.append(f"Field '{key}' truncated from {original_len} chars")
            changed = True
    return changed


def _truncate_lists(data: Dict[str, Any], notes: List[str], max_items: int) -> bool:
    """Truncate list fields exceeding max_items. Returns True if any truncated.

    Does NOT append marker objects into the list to preserve the element type
    contract (e.g. ``List[TableColumnInfo]`` stays homogeneous).  Truncation
    metadata is communicated through the *notes* list and top-level response
    fields ``_response_truncated`` / ``_truncation_notes``.
    """
    changed = False
    for key, value in data.items():
        if isinstance(value, list) and len(value) > max_items:
            original_len = len(value)
            data[key] = value[:max_items]
            notes.append(
                f"Field '{key}' truncated from {original_len} to {max_items} items"
            )
            changed = True
    return changed


def _summarize_large_dicts(
    data: Dict[str, Any], notes: List[str], max_keys: int = _MAX_DICT_KEYS
) -> bool:
    """Replace large dict fields with key summaries. Returns True if any changed."""
    changed = False
    for key, value in data.items():
        if isinstance(value, dict) and len(value) > max_keys:
            keys_list = list(value.keys())[:max_keys]
            data[key] = {
                "_truncated": True,
                "_message": (
                    f"Dict with {len(value)} keys truncated. "
                    f"Keys: {', '.join(str(k) for k in keys_list)}..."
                ),
            }
            notes.append(f"Field '{key}' dict summarized ({len(value)} keys)")
            changed = True
    return changed


def _replace_collections_with_summaries(data: Dict[str, Any], notes: List[str]) -> bool:
    """Replace all non-empty list/dict fields with empty/minimal values.

    Lists are emptied (preserving the list type) rather than replaced with
    marker objects to avoid breaking typed list contracts.
    """
    changed = False
    for key, value in list(data.items()):
        if not isinstance(value, (list, dict)) or not value:
            continue
        count = len(value)
        if isinstance(value, list):
            data[key] = []
            notes.append(f"Field '{key}' list ({count} items) cleared to fit limit")
        else:
            data[key] = {}
            notes.append(f"Field '{key}' dict ({count} keys) cleared to fit limit")
        changed = True
    return changed


def _is_under_limit(data: Dict[str, Any], token_limit: int) -> bool:
    """Check if the serialized data fits within the token limit."""
    from superset.utils import json as utils_json

    return estimate_token_count(utils_json.dumps(data)) <= token_limit


def truncate_oversized_response(
    response: ToolResponse,
    token_limit: int,
) -> tuple[ToolResponse, bool, list[str]]:
    """
    Dynamically truncate large fields in a response to fit within the token limit.

    Applies four progressive phases of truncation:
    1. Truncate long string fields
    2. Truncate large list fields to _MAX_LIST_ITEMS
    3. Aggressively reduce lists to 10 items and summarize large dicts
    4. Replace all collections with summary markers

    Args:
        response: The tool response (Pydantic model, dict, or other).
        token_limit: Maximum estimated tokens allowed.

    Returns:
        A tuple of (possibly-truncated response, was_truncated, list of notes).
    """
    notes: list[str] = []

    # Convert to a mutable dict for manipulation
    if hasattr(response, "model_dump"):
        data = response.model_dump()
    elif isinstance(response, dict):
        data = dict(response)
    else:
        return response, False, notes

    was_truncated = False

    # Phase 1: Truncate long string fields
    was_truncated |= _truncate_strings(data, notes)
    if _is_under_limit(data, token_limit):
        return data, was_truncated, notes

    # Phase 2: Truncate large list fields
    was_truncated |= _truncate_lists(data, notes, _MAX_LIST_ITEMS)
    if _is_under_limit(data, token_limit):
        return data, was_truncated, notes

    # Phase 3: Aggressively reduce lists and summarize large dicts
    was_truncated |= _truncate_lists(data, notes, max_items=10)
    was_truncated |= _summarize_large_dicts(data, notes)
    if _is_under_limit(data, token_limit):
        return data, was_truncated, notes

    # Phase 4: Nuclear — replace all collections with summaries
    was_truncated |= _replace_collections_with_summaries(data, notes)

    return data, was_truncated, notes


def format_size_limit_error(
    tool_name: str,
    params: Dict[str, Any] | None,
    estimated_tokens: int,
    token_limit: int,
    response: ToolResponse | None = None,
) -> str:
    """
    Format a user-friendly error message when response exceeds token limit.

    Args:
        tool_name: Name of the MCP tool
        params: The tool parameters
        estimated_tokens: Estimated token count
        token_limit: Configured token limit
        response: Optional response for analysis

    Returns:
        Formatted error message with suggestions
    """
    suggestions = generate_size_reduction_suggestions(
        tool_name, params, estimated_tokens, token_limit, response
    )

    error_lines = [
        f"Response too large: ~{estimated_tokens:,} tokens (limit: {token_limit:,})",
        "",
        "This response would overwhelm the LLM context window.",
        "Please modify your query to reduce the response size:",
        "",
    ]

    for i, suggestion in enumerate(suggestions[:5], 1):  # Limit to top 5 suggestions
        error_lines.append(f"{i}. {suggestion}")

    reduction_pct = (
        (estimated_tokens - token_limit) / estimated_tokens * 100
        if estimated_tokens
        else 0
    )
    error_lines.extend(
        [
            "",
            f"Tool: {tool_name}",
            f"Reduction needed: ~{reduction_pct:.0f}%",
        ]
    )

    return "\n".join(error_lines)
