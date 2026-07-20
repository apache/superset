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

Token counting strategy:

1. ``tiktoken`` with the ``cl100k_base`` encoding when the package is
   installed (it is shipped as part of the ``fastmcp`` extra). This is a
   real BPE tokenizer trained on a similar vocabulary to Claude's; for
   English and JSON-heavy MCP payloads it tracks Claude's tokenizer
   within roughly ±10%, which is far more accurate than the legacy
   character heuristic.
2. A character-based fallback (``CHARS_PER_TOKEN``) when tiktoken is not
   importable. The fallback uses a slightly more conservative ratio than
   before (3.0 chars/token instead of 3.5) so that JSON-heavy responses
   are not under-counted, which previously let oversized payloads slip
   past the response-size guard.

The exact-Claude tokenizer is only available via Anthropic's network
``count_tokens`` API; calling it from a synchronous middleware on every
tool result is too slow and adds an external dependency on every
response. ``tiktoken`` is the closest approximation we can ship without
that risk.
"""

from __future__ import annotations

import logging
from typing import Any, Callable, Dict, List, Union

from pydantic import BaseModel
from typing_extensions import TypeAlias

from superset.mcp_service.constants import DEFAULT_MAX_LIST_ITEMS

logger = logging.getLogger(__name__)

# Type alias for MCP tool responses (Pydantic models, dicts, lists, strings, bytes)
ToolResponse: TypeAlias = Union[BaseModel, Dict[str, Any], List[Any], str, bytes]

# Measures the token size of a candidate payload dict. Callers that re-wrap
# the payload before returning it (e.g. back into a ToolResult) can supply a
# size function that measures the *wrapped* size, so truncation converges on
# a result that fits after re-wrapping, not just before it.
SizeFn: TypeAlias = Callable[[Dict[str, Any]], int]

# Fallback character-to-token ratio used when tiktoken is unavailable.
# 3.0 is conservative for JSON content (the previous 3.5 under-counted
# JSON-heavy payloads relative to Claude's actual tokenizer, which let
# oversized responses slip past the response-size guard).
CHARS_PER_TOKEN = 3.0

# Encoding used when tiktoken is available. cl100k_base is OpenAI's
# tokenizer for GPT-3.5/4; it is BPE-based with a vocabulary similar to
# Claude's and tracks Claude's token counts within roughly ±10% for
# English and JSON-heavy MCP responses.
_TIKTOKEN_ENCODING_NAME = "cl100k_base"


def _load_tiktoken_encoding() -> Any:
    """Return a tiktoken encoding instance, or None if tiktoken is unavailable.

    Imported lazily so the module can be used in environments without
    tiktoken installed. The encoding is small (~1 MB) so we cache it on
    first use.
    """
    try:
        import tiktoken
    except ImportError:
        logger.info(
            "tiktoken not installed; falling back to char-based token "
            "estimation (CHARS_PER_TOKEN=%s). Install the 'fastmcp' extra "
            "for accurate counts.",
            CHARS_PER_TOKEN,
        )
        return None

    try:
        return tiktoken.get_encoding(_TIKTOKEN_ENCODING_NAME)
    except (KeyError, ValueError) as exc:
        # tiktoken installed but the requested encoding is missing — this
        # only happens on partial installs. Treat as no tokenizer rather
        # than crashing on every tool call.
        logger.warning(
            "tiktoken encoding '%s' unavailable: %s; falling back to "
            "char-based token estimation",
            _TIKTOKEN_ENCODING_NAME,
            exc,
        )
        return None


# Cached encoding instance (None if tiktoken not importable).
_ENCODING = _load_tiktoken_encoding()


def estimate_token_count(text: str | bytes) -> int:
    """
    Estimate the token count for a given text.

    Uses tiktoken's ``cl100k_base`` encoding when available for
    Claude-aligned accuracy (within ~10%), falling back to a
    character-based heuristic otherwise.

    Args:
        text: The text to estimate tokens for (string or bytes)

    Returns:
        Estimated number of tokens
    """
    if isinstance(text, bytes):
        text = text.decode("utf-8", errors="replace")

    if not text:
        return 0

    if _ENCODING is not None:
        try:
            return len(_ENCODING.encode(text))
        except (ValueError, UnicodeError) as exc:
            # Defensive: if tiktoken chokes on a specific input, fall
            # back to the char heuristic for this call rather than
            # raising — the response size guard must never fail-open.
            logger.warning("tiktoken encode failed (%s); using fallback", exc)

    return max(1, int(len(text) / CHARS_PER_TOKEN))


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
            "Add filters to narrow down results (e.g., date range, search term, "
            "or specific non-user attributes)"
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

# Data-query tools that return tabular results.  When the response exceeds the
# token limit, these tools are truncated by dropping tail rows rather than
# raising a hard ToolError.  A truncation note is appended so the caller
# knows the result is partial and how to narrow the query.
DATA_QUERY_TOOLS = frozenset(
    {
        "execute_sql",
        "query_dataset",
        "get_chart_data",
    }
)

# Data field names used by the three query tools (in priority order).
# ``rows`` is used by execute_sql; ``data`` by query_dataset and get_chart_data.
_DATA_ROW_FIELDS = ("rows", "data")

# Maximum character length for string fields before truncation
_MAX_STRING_CHARS = 500
# Maximum keys to keep when summarizing large dict fields
_MAX_DICT_KEYS = 20


def _truncate_strings(
    data: Dict[str, Any], notes: List[str], max_chars: int = _MAX_STRING_CHARS
) -> bool:
    """Truncate string fields exceeding max_chars at the top level only."""
    changed = False
    for key, value in data.items():
        if isinstance(value, str) and len(value) > max_chars:
            original_len = len(value)
            data[key] = value[:max_chars] + f"... [truncated from {original_len} chars]"
            notes.append(f"Field '{key}' truncated from {original_len} chars")
            changed = True
    return changed


def _truncate_strings_recursive(
    data: Any,
    notes: List[str],
    max_chars: int = _MAX_STRING_CHARS,
    path: str = "",
    _depth: int = 0,
) -> bool:
    """Recursively truncate strings throughout the entire data tree.

    Walks nested dicts and list items to catch strings like
    ``charts[0].description`` that top-level truncation misses.
    Depth is capped at 10 to avoid runaway recursion.
    """
    if _depth > 10:
        return False
    changed = False
    if isinstance(data, dict):
        for key, value in data.items():
            field_path = f"{path}.{key}" if path else key
            if isinstance(value, str) and len(value) > max_chars:
                original_len = len(value)
                data[key] = (
                    value[:max_chars] + f"... [truncated from {original_len} chars]"
                )
                notes.append(
                    f"Field '{field_path}' truncated from {original_len} chars"
                )
                changed = True
            elif isinstance(value, (dict, list)):
                changed |= _truncate_strings_recursive(
                    value, notes, max_chars, field_path, _depth + 1
                )
    elif isinstance(data, list):
        for i, item in enumerate(data):
            if isinstance(item, (dict, list)):
                changed |= _truncate_strings_recursive(
                    item, notes, max_chars, f"{path}[{i}]", _depth + 1
                )
    return changed


def _truncate_lists(data: Dict[str, Any], notes: List[str], max_items: int) -> bool:
    """Truncate list fields exceeding max_items. Returns True if any truncated.

    Does NOT append marker objects into the list to preserve the element type
    contract (e.g. ``List[TableColumnInfo]`` stays homogeneous).  Truncation
    metadata is communicated through the *notes* list and top-level response
    fields ``_response_truncated`` / ``_truncation_notes``.
    """
    max_items = max(1, max_items)
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


def _default_size_fn(data: Dict[str, Any]) -> int:
    """Estimate tokens for a bare payload dict (no re-wrap overhead)."""
    from superset.utils import json as utils_json

    return estimate_token_count(utils_json.dumps(data))


def _is_under_limit(
    data: Dict[str, Any], token_limit: int, size_fn: SizeFn = _default_size_fn
) -> bool:
    """Check if the serialized data fits within the token limit."""
    return size_fn(data) <= token_limit


def truncate_oversized_response(
    response: ToolResponse,
    token_limit: int,
    # Configurable via MCP_RESPONSE_SIZE_CONFIG["max_list_items"]
    max_list_items: int = DEFAULT_MAX_LIST_ITEMS,
    size_fn: SizeFn = _default_size_fn,
) -> tuple[ToolResponse, bool, list[str]]:
    """
    Dynamically truncate large fields in a response to fit within the token limit.

    Applies five progressive phases of truncation:
    1. Truncate long top-level string fields
    2. Truncate large list fields to max_list_items (configurable)
    3. Recursively truncate strings in nested structures (list items, nested dicts)
    4. Aggressively reduce lists to 10 items and summarize large dicts
    5. Replace all collections with empty values

    Args:
        response: The tool response (Pydantic model, dict, or other).
        token_limit: Maximum estimated tokens allowed.
        max_list_items: Maximum items to keep in list fields during Phase 2.
        size_fn: Measures the token size of a candidate payload dict. Defaults
            to measuring the bare dict; callers that re-wrap the payload
            before returning it (e.g. back into a ToolResult) should pass a
            function that measures the *wrapped* size, so truncation
            converges on a result that still fits after re-wrapping.

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
    if _is_under_limit(data, token_limit, size_fn):
        return data, was_truncated, notes

    # Phase 2: Truncate large list fields
    was_truncated |= _truncate_lists(data, notes, max_list_items)
    if _is_under_limit(data, token_limit, size_fn):
        return data, was_truncated, notes

    # Phase 3: Recursively truncate strings inside nested structures
    # (e.g. charts[i].description, native_filters[i].config, etc.)
    was_truncated |= _truncate_strings_recursive(data, notes)
    if _is_under_limit(data, token_limit, size_fn):
        return data, was_truncated, notes

    # Phase 4: Aggressively reduce lists and summarize large dicts
    was_truncated |= _truncate_lists(data, notes, max_items=10)
    was_truncated |= _summarize_large_dicts(data, notes)
    if _is_under_limit(data, token_limit, size_fn):
        return data, was_truncated, notes

    # Phase 5: Nuclear — replace all collections with empty values
    was_truncated |= _replace_collections_with_summaries(data, notes)

    return data, was_truncated, notes


def _linked_statement_row_lists(data: Dict[str, Any]) -> list[list[Any]]:
    """Find per-statement row lists duplicated from an ``execute_sql`` response.

    ``ExecuteSqlResponse.rows`` is a copy of the last data-bearing
    statement's ``data.rows`` (see ``_convert_to_response`` in
    ``sql_lab/tool/execute_sql.py``), and every data-bearing statement's
    rows are additionally serialised under ``statements[*].data.rows``. If
    only the top-level ``rows`` field is bisected, these nested copies keep
    the full untruncated payload, which can leave the response oversized
    even after "truncation". Returns the mutable row lists (if any) so the
    caller can shrink them in lockstep with the top-level field.
    """
    statements = data.get("statements")
    if not isinstance(statements, list):
        return []

    linked = []
    for statement in statements:
        if not isinstance(statement, dict):
            continue
        statement_data = statement.get("data")
        if isinstance(statement_data, dict) and isinstance(
            statement_data.get("rows"), list
        ):
            linked.append(statement_data["rows"])
    return linked


def _bisect_row_limit(
    data: Dict[str, Any],
    row_field: str,
    original_rows: List[Any],
    token_limit: int,
    size_fn: SizeFn = _default_size_fn,
) -> int:
    """Binary-search for the largest row prefix that keeps data under limit.

    Mutates ``data[row_field]`` during the search and leaves it at the final
    kept count on return.  Returns the number of rows kept (>= 1 if the
    original list was non-empty).

    When ``data`` is an ``execute_sql`` response, per-statement row lists
    under ``statements[*].data.rows`` duplicate ``data[row_field]`` (see
    ``_linked_statement_row_lists``) and are shrunk to the same length at
    each step, so the size measured during the search — and the response
    ultimately returned — reflects the truncated nested data too, not just
    the top-level field.

    ``size_fn`` measures each candidate; pass a function that re-wraps the
    payload (e.g. back into a ToolResult) before measuring so the search
    converges on a prefix that still fits the limit after re-wrapping.
    """
    linked_rows = [list(rows) for rows in _linked_statement_row_lists(data)]

    def _apply(count: int) -> None:
        data[row_field] = original_rows[:count]
        for original_linked, mutable_linked in zip(
            linked_rows, _linked_statement_row_lists(data), strict=False
        ):
            mutable_linked[:] = original_linked[: min(count, len(original_linked))]

    lo, hi = 0, len(original_rows)
    while lo < hi:
        mid = (lo + hi + 1) // 2
        _apply(mid)
        if size_fn(data) <= token_limit:
            lo = mid
        else:
            hi = mid - 1

    kept = lo
    if kept == 0 and original_rows:
        # Even a single row is too large — keep it anyway so the caller gets
        # at least some data rather than an empty list.
        kept = 1

    _apply(kept)
    return kept


def _bisect_csv_row_limit(
    data: Dict[str, Any],
    field: str,
    original_value: str,
    token_limit: int,
    size_fn: SizeFn = _default_size_fn,
) -> int:
    """Binary-search for the largest whole-record prefix of a CSV string.

    Cuts on CSV record boundaries (via the ``csv`` module, which
    understands quoted fields and embedded delimiters/newlines) rather than
    an arbitrary character offset, so the result is always parseable CSV.
    The header row (record 0) is always kept when present, since
    ``get_chart_data`` always writes one via ``csv.DictWriter.writeheader()``.

    Mutates ``data[field]`` during the search and leaves it at the final
    kept CSV text on return.

    ``size_fn`` measures each candidate; pass a function that re-wraps the
    payload before measuring so the search converges on a prefix that still
    fits the limit after re-wrapping.

    Returns:
        The number of records kept, including the header row.
    """
    import csv
    import io

    records = list(csv.reader(io.StringIO(original_value)))
    total = len(records)
    if total <= 1:
        # No data rows to trim (just a header, or unparseable) — nothing to
        # cut on a record boundary; leave the field untouched.
        return total

    def _render(count: int) -> str:
        buf = io.StringIO()
        csv.writer(buf).writerows(records[:count])
        return buf.getvalue()

    lo, hi = 1, total  # always keep at least the header row
    while lo < hi:
        mid = (lo + hi + 1) // 2
        data[field] = _render(mid)
        if size_fn(data) <= token_limit:
            lo = mid
        else:
            hi = mid - 1

    data[field] = _render(lo)
    return lo


# Row-truncation advice, keyed by tool name. ``get_chart_data`` and
# ``query_dataset`` cap output via a row/page-size parameter, not a SQL
# clause, so the generic "Add a LIMIT clause" wording is wrong for them.
_ROW_LIMIT_ADVICE = {
    "get_chart_data": "Use the 'limit' parameter to restrict rows returned.",
    "query_dataset": "Use the 'row_limit' parameter to restrict rows returned.",
}
_DEFAULT_ROW_LIMIT_ADVICE = (
    "Add a LIMIT clause or reduce selected columns to get all rows."
)


def _truncate_rows_field(
    data: Dict[str, Any],
    row_field: str,
    token_limit: int,
    advice: str,
    size_fn: SizeFn = _default_size_fn,
) -> list[str] | None:
    """Try to bisect ``data[row_field]`` down to fit the limit.

    Returns the truncation notes on success, or ``None`` if no rows were
    (or could be) dropped, in which case ``data`` is left unmodified.
    """
    original_rows: list[Any] = data[row_field]
    original_count = len(original_rows)
    if not original_rows:
        return None

    # Reserve space for the truncation-note metadata *before* bisecting so
    # the search already accounts for it, rather than measuring fit on bare
    # row data and finding out only afterward that appending the note
    # pushed the payload back over the limit. The placeholder uses
    # original_count for both halves of "X of Y rows", which is the
    # longest the real note can ever be (kept <= original_count).
    placeholder_note = (
        f"Result truncated: {original_count} of {original_count} rows returned "
        f"(limit ~{token_limit:,} tokens). {advice}"
    )
    data["_response_truncated"] = True
    data["_truncation_notes"] = [placeholder_note]

    kept = _bisect_row_limit(data, row_field, original_rows, token_limit, size_fn)

    if kept < original_count:
        notes = [
            f"Result truncated: {kept} of {original_count} rows returned "
            f"(limit ~{token_limit:,} tokens). {advice}"
        ]
        data["_truncation_notes"] = notes
        if "row_count" in data:
            data["row_count"] = kept
        return notes

    # Reserving headroom turned out not to be needed after all — no rows
    # were actually dropped, so undo the placeholder metadata.
    del data["_response_truncated"]
    del data["_truncation_notes"]
    return None


def _truncate_csv_data_field(
    data: Dict[str, Any],
    token_limit: int,
    advice: str,
    size_fn: SizeFn = _default_size_fn,
) -> list[str] | None:
    """Try to trim the scalar ``csv_data`` field down to fit the limit.

    Used when there are no rows to trim — e.g. a CSV export where ``data``
    is empty and the actual payload lives in ``csv_data``. Truncation cuts
    on CSV record boundaries (see ``_bisect_csv_row_limit``) rather than an
    arbitrary character offset, so the result is always parseable CSV; the
    header row is always preserved. ``excel_data`` is base64-encoded binary
    and is intentionally left alone: cutting it would produce a corrupt
    file, so oversized Excel exports still fall through to the hard
    size-limit error.

    Returns the truncation notes on success, or ``None`` if nothing could
    be trimmed, in which case ``data`` is left unmodified.
    """
    import csv
    import io

    csv_data = data.get("csv_data")
    if not isinstance(csv_data, str) or not csv_data:
        return None

    total_records = sum(1 for _ in csv.reader(io.StringIO(csv_data)))
    original_data_rows = max(total_records - 1, 0)
    if original_data_rows == 0:
        # Just a header (or unparseable) — nothing to cut on a record
        # boundary.
        return None

    # Same reservation trick as ``_truncate_rows_field``, keyed on the
    # data-row count rather than the raw character count.
    placeholder_note = (
        f"CSV content truncated: {original_data_rows} of {original_data_rows} "
        f"data rows returned (limit ~{token_limit:,} tokens). {advice}"
    )
    data["_response_truncated"] = True
    data["_truncation_notes"] = [placeholder_note]

    kept_records = _bisect_csv_row_limit(
        data, "csv_data", csv_data, token_limit, size_fn
    )
    if (kept_data_rows := max(kept_records - 1, 0)) < original_data_rows:
        notes = [
            f"CSV content truncated: {kept_data_rows} of {original_data_rows} "
            f"data rows returned (limit ~{token_limit:,} tokens). {advice}"
        ]
        data["_truncation_notes"] = notes
        return notes

    del data["_response_truncated"]
    del data["_truncation_notes"]
    return None


def truncate_query_result(
    response: ToolResponse,
    token_limit: int,
    tool_name: str | None = None,
    size_fn: SizeFn = _default_size_fn,
) -> tuple[ToolResponse, bool, list[str]]:
    """Truncate a data-query tool response to fit within the token limit.

    Unlike ``truncate_oversized_response`` (which targets info-tool dict
    fields), this function targets the rows/data list directly: it performs
    a binary search to find the largest prefix of rows that keeps the
    serialised payload under the limit, then records a truncation note so
    the caller knows the result is partial.

    Handles both dict responses and Pydantic models (e.g. ExecuteSqlResponse,
    QueryDatasetResponse, GetChartDataResponse) that contain a ``rows`` or
    ``data`` field. Note that summary/column-level statistics (e.g.
    ``summary``, per-column ``null_count``/``unique_count``, ``insights``)
    describe the pre-truncation dataset and are not recomputed here; callers
    rely on ``_truncation_notes`` and the true ``total_rows`` to catch this.

    For ``execute_sql``, per-statement row lists under
    ``statements[*].data.rows`` are shrunk alongside the top-level field
    (see ``_linked_statement_row_lists``) so a duplicate, untruncated copy
    of the same rows can't leave the response oversized after "truncation".

    Args:
        response: The tool response containing tabular row data.
        token_limit: Maximum estimated tokens allowed.
        tool_name: Name of the calling tool, used to tailor the truncation
            advice (e.g. ``limit`` vs. ``row_limit`` vs. SQL ``LIMIT``).
        size_fn: Measures the token size of a candidate payload dict.
            Defaults to measuring the bare dict; callers that re-wrap the
            payload before returning it (e.g. back into a ToolResult) should
            pass a function that measures the *wrapped* size, so the binary
            search converges on a result that still fits after re-wrapping.

    Returns:
        A tuple of (possibly-truncated response, was_truncated, list of notes).
    """
    advice = _ROW_LIMIT_ADVICE.get(tool_name or "", _DEFAULT_ROW_LIMIT_ADVICE)

    if hasattr(response, "model_dump"):
        data = response.model_dump()
    elif isinstance(response, dict):
        data = dict(response)
    else:
        return response, False, []

    # Find which field holds the row list.
    row_field: str | None = None
    for field in _DATA_ROW_FIELDS:
        if field in data and isinstance(data[field], list):
            row_field = field
            break

    if row_field is None:
        # No recognised row field — fall back to generic field truncation.
        return truncate_oversized_response(response, token_limit, size_fn=size_fn)

    if size_fn(data) <= token_limit:
        return data, False, []

    notes = _truncate_rows_field(data, row_field, token_limit, advice, size_fn)
    if notes is None:
        notes = _truncate_csv_data_field(data, token_limit, advice, size_fn)

    return data, notes is not None, notes or []


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
