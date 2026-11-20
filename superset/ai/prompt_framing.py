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

"""Prompt framing for user-controlled values consumed by the native AI client."""

from typing import Any

LLM_CONTEXT_OPEN_DELIMITER = "<UNTRUSTED-CONTENT>"
LLM_CONTEXT_CLOSE_DELIMITER = "</UNTRUSTED-CONTENT>"
LLM_CONTEXT_ESCAPED_OPEN_DELIMITER = "[ESCAPED-UNTRUSTED-CONTENT-OPEN]"
LLM_CONTEXT_ESCAPED_CLOSE_DELIMITER = "[ESCAPED-UNTRUSTED-CONTENT-CLOSE]"
LLM_CONTEXT_EXCLUDED_FIELD_NAMES = frozenset(
    {
        "cache_key",
        "database",
        "database_name",
        "schema",
        "schema_name",
        "slug",
        "url",
        "urls",
        "uuid",
    }
)


def _normalize_field_name(field_name: str) -> str:
    """Normalize a field name for exclusion matching."""
    return field_name.strip().lower().replace("-", "_")


def _escape_llm_context_delimiters(value: str) -> str:
    """Escape delimiter tokens without wrapping the value."""
    return value.replace(
        LLM_CONTEXT_OPEN_DELIMITER,
        LLM_CONTEXT_ESCAPED_OPEN_DELIMITER,
    ).replace(
        LLM_CONTEXT_CLOSE_DELIMITER,
        LLM_CONTEXT_ESCAPED_CLOSE_DELIMITER,
    )


def _escape_llm_context_dict_key(key: Any) -> Any:
    """Escape delimiter tokens in string dict keys."""
    if isinstance(key, str):
        return _escape_llm_context_delimiters(key)
    return key


def escape_llm_context_delimiters(value: Any) -> Any:
    """Escape delimiter tokens in operational values that should not be wrapped."""
    if isinstance(value, str):
        return _escape_llm_context_delimiters(value)
    if isinstance(value, dict):
        return {
            _escape_llm_context_dict_key(key): escape_llm_context_delimiters(
                nested_value
            )
            for key, nested_value in value.items()
        }
    if isinstance(value, list):
        return [escape_llm_context_delimiters(item) for item in value]
    if isinstance(value, tuple):
        return tuple(escape_llm_context_delimiters(item) for item in value)
    return value


def _wrap_llm_context_string(value: str) -> str:
    """Wrap an untrusted string with explicit LLM-context delimiters."""
    wrapped_prefix = f"{LLM_CONTEXT_OPEN_DELIMITER}\n"
    wrapped_suffix = f"\n{LLM_CONTEXT_CLOSE_DELIMITER}"
    if value.startswith(wrapped_prefix) and value.endswith(wrapped_suffix):
        inner_value = value[len(wrapped_prefix) : -len(wrapped_suffix)]
        return (
            f"{wrapped_prefix}"
            f"{_escape_llm_context_delimiters(inner_value)}"
            f"{wrapped_suffix}"
        )

    escaped_value = _escape_llm_context_delimiters(value)
    return (
        f"{LLM_CONTEXT_OPEN_DELIMITER}\n{escaped_value}\n{LLM_CONTEXT_CLOSE_DELIMITER}"
    )


def sanitize_for_llm_context(
    value: Any,
    *,
    field_path: tuple[str, ...] = (),
    excluded_field_names: frozenset[str] | None = None,
) -> Any:
    """
    Recursively wrap user-controlled strings before placing them in LLM context.

    Strings are wrapped in explicit untrusted-content delimiters unless the
    current field name is part of the shared operational exclusion policy.
    Container shapes and non-string values are preserved.  String dict keys
    are only delimiter-escaped (not wrapped) to keep the original structure
    navigable; any UNTRUSTED-CONTENT tokens embedded in a key are replaced
    with their escaped forms so they cannot prematurely close a value wrapper.

    Args:
        value: The value to sanitize.
        field_path: Tuple of field name segments leading to this value.
        excluded_field_names: Field names whose values are only delimiter-escaped
            rather than wrapped.  Defaults to LLM_CONTEXT_EXCLUDED_FIELD_NAMES.
            Pass ``frozenset()`` to wrap every string leaf without exclusions.
    """
    excluded_names = (
        LLM_CONTEXT_EXCLUDED_FIELD_NAMES
        if excluded_field_names is None
        else excluded_field_names
    )
    normalized_exclusions = frozenset(
        _normalize_field_name(field_name) for field_name in excluded_names
    )

    def _sanitize(current_value: Any, current_path: tuple[str, ...]) -> Any:
        current_field_name = current_path[-1] if current_path else ""
        if current_field_name and (
            _normalize_field_name(current_field_name) in normalized_exclusions
        ):
            return escape_llm_context_delimiters(current_value)

        if isinstance(current_value, str):
            return _wrap_llm_context_string(current_value)

        if isinstance(current_value, dict):
            return {
                _escape_llm_context_dict_key(key): _sanitize(
                    nested_value,
                    (*current_path, str(key)),
                )
                for key, nested_value in current_value.items()
            }

        if isinstance(current_value, list):
            return [
                _sanitize(item, (*current_path, str(index)))
                for index, item in enumerate(current_value)
            ]

        if isinstance(current_value, tuple):
            return tuple(
                _sanitize(item, (*current_path, str(index)))
                for index, item in enumerate(current_value)
            )

        return current_value

    return _sanitize(value, field_path)
