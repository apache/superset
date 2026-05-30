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
Centralized sanitization utilities for MCP service user inputs.

This module uses the nh3 library (Rust-based HTML sanitizer) to strip malicious
HTML tags and protocols from user inputs. nh3 is faster and safer than manual
regex-based sanitization.

Key features:
- Strips all HTML tags using nh3.clean() with no allowed tags
- Blocks dangerous URL schemes (javascript:, vbscript:, data:)
- Preserves safe text content (e.g., '&' stays as '&', not '&amp;')
- Additional SQL injection protection for database-facing inputs
"""

import html
import re
from typing import Any

import nh3

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


def _strip_html_tags(value: str) -> str:
    """
    Strip all HTML tags from the input using nh3.

    Decodes all layers of HTML entity encoding BEFORE passing to nh3,
    so entity-encoded tags (e.g., ``&lt;script&gt;``) are decoded into
    real tags that nh3 can detect and strip. After nh3 removes all tags,
    we only restore ``&amp;`` back to ``&`` (not a full html.unescape)
    to preserve ampersands in display text without risking XSS from
    re-introducing angle brackets or other HTML-significant characters.

    Args:
        value: The input string that may contain HTML

    Returns:
        String with all HTML tags removed and ampersands preserved
    """
    # Decode all layers of HTML entity encoding to prevent bypass
    # via entity-encoded tags (e.g., &lt;script&gt; or &amp;lt;script&amp;gt;)
    # The loop terminates when unescape produces no change (idempotent on decoded text).
    # Max iterations cap provides defense-in-depth against pathological inputs.
    max_iterations = 100
    decoded = value
    prev = None
    iterations = 0
    while prev != decoded and iterations < max_iterations:
        prev = decoded
        decoded = html.unescape(decoded)
        iterations += 1

    # nh3.clean with tags=set() strips ALL HTML tags from the decoded input
    # url_schemes=set() blocks all URL schemes in any remaining attributes
    cleaned = nh3.clean(decoded, tags=set(), url_schemes=set())

    # Only restore &amp; → & to preserve ampersands in display text (e.g. "A & B").
    # Do NOT use html.unescape() here: nh3 may pass through HTML entities from
    # the input (e.g. &lt;script&gt;), and a full unescape would re-introduce
    # raw angle brackets, creating an XSS vector.
    return cleaned.replace("&amp;", "&")


_DANGEROUS_URL_SCHEME_RE = re.compile(r"\b(javascript|vbscript|data):", re.IGNORECASE)


def _check_dangerous_url_scheme(value: str, field_name: str) -> None:
    """Raise if ``value`` contains a ``javascript:`` / ``vbscript:`` / ``data:``
    URL scheme."""
    if _DANGEROUS_URL_SCHEME_RE.search(value):
        raise ValueError(f"{field_name} contains potentially malicious URL scheme")


def _check_dangerous_stored_procedures(value: str, field_name: str) -> None:
    """Raise if ``value`` references SQL Server's ``xp_cmdshell`` or
    ``sp_executesql``."""
    v_lower = value.lower()
    if "xp_cmdshell" in v_lower or "sp_executesql" in v_lower:
        raise ValueError(f"{field_name} contains potentially malicious SQL procedures.")


def _check_dangerous_patterns(value: str, field_name: str) -> None:
    """
    Check for dangerous patterns that nh3 doesn't catch.

    This includes URL schemes in plain text (not in HTML attributes),
    event handler patterns, and dangerous Unicode characters.

    Args:
        value: The input string to check
        field_name: Name of the field (for error messages)

    Raises:
        ValueError: If dangerous patterns are found
    """
    _check_dangerous_url_scheme(value, field_name)

    # NOTE: this regex false-positives on SQL like ``monthly = 12`` (matches
    # ``on``+``thly``+``=``); ``sanitize_sql_expression`` skips this check.
    if re.search(r"on\w+\s*=", value, re.IGNORECASE):
        raise ValueError(f"{field_name} contains potentially malicious event handler")


def _check_sql_patterns(value: str, field_name: str) -> None:
    """
    Check for SQL injection patterns.

    Args:
        value: The input string to check
        field_name: Name of the field (for error messages)

    Raises:
        ValueError: If SQL injection patterns are found
    """
    # Check for dangerous SQL keywords
    if re.search(
        r"\b(DROP|DELETE|INSERT|UPDATE|CREATE|ALTER|EXEC|EXECUTE)\b",
        value,
        re.IGNORECASE,
    ):
        raise ValueError(f"{field_name} contains potentially unsafe SQL keywords")

    # Check for shell metacharacters and SQL comments
    if re.search(r"[;|&$`]|--", value):
        raise ValueError(f"{field_name} contains potentially unsafe characters")

    # Check for SQL comment start
    if "/*" in value:
        raise ValueError(f"{field_name} contains potentially unsafe SQL comment syntax")


def _remove_dangerous_unicode(value: str) -> str:
    """Strip zero-width chars, C0 controls, and line/paragraph separators.

    Zero-widths (U+200B-U+200D, U+FEFF) can be smuggled between letters
    of a forbidden SQL keyword to bypass ``\\b(KEYWORD)\\b``. Line
    terminators (U+0085, U+2028, U+2029) are statement-ending on some
    SQL drivers.
    """
    return re.sub(
        r"[\u200B-\u200D\uFEFF\u0000-\u0008\u000B\u000C\u000E-\u001F"
        r"\u0085\u2028\u2029]",
        "",
        value,
    )


def sanitize_user_input_with_changes(
    value: str | None,
    field_name: str,
    max_length: int = 255,
    check_sql_keywords: bool = False,
    allow_empty: bool = False,
) -> tuple[str | None, bool]:
    """
    Sanitize and report whether the value was modified.

    Same security guarantees as ``sanitize_user_input`` — returns both
    the sanitized value and a boolean indicating whether any characters
    were stripped or altered. Callers that need to surface a warning
    when user-provided content is silently removed (e.g. XSS payloads)
    should use this variant instead of ``sanitize_user_input``.
    """
    original_stripped = value.strip() if isinstance(value, str) else value
    sanitized = sanitize_user_input(
        value,
        field_name,
        max_length=max_length,
        check_sql_keywords=check_sql_keywords,
        allow_empty=allow_empty,
    )
    was_modified = original_stripped != (sanitized or "") and bool(original_stripped)
    return sanitized, was_modified


def sanitize_user_input(
    value: str | None,
    field_name: str,
    max_length: int = 255,
    check_sql_keywords: bool = False,
    allow_empty: bool = False,
) -> str | None:
    """
    Centralized sanitization for user-provided text inputs.

    Uses nh3 to strip HTML tags and performs additional security checks.

    Args:
        value: The input string to sanitize
        field_name: Name of the field (for error messages)
        max_length: Maximum allowed length
        check_sql_keywords: Whether to check for SQL injection keywords
        allow_empty: Whether to allow empty/None values

    Returns:
        Sanitized string, or None if allow_empty=True and value is empty

    Raises:
        ValueError: If value fails security validation

    Security checks performed:
        - Strips all HTML tags using nh3 (Rust-based sanitizer)
        - Blocks JavaScript/VBScript/data URL schemes
        - Blocks event handlers (onclick=, onerror=, etc.)
        - Removes dangerous Unicode characters (zero-width, control chars)
        - SQL keywords and shell metacharacters (when check_sql_keywords=True)
    """
    if value is None:
        if allow_empty:
            return None
        raise ValueError(f"{field_name} cannot be empty")

    value = value.strip()

    if not value:
        if allow_empty:
            return None
        raise ValueError(f"{field_name} cannot be empty")

    # Length check first to prevent ReDoS attacks
    if len(value) > max_length:
        raise ValueError(
            f"{field_name} too long ({len(value)} characters). "
            f"Maximum allowed length is {max_length} characters."
        )

    # Strip all HTML tags using nh3
    value = _strip_html_tags(value)

    # Check for dangerous patterns (URL schemes, event handlers)
    _check_dangerous_patterns(value, field_name)

    # SQL keyword and shell metacharacter checks (for column names, etc.)
    if check_sql_keywords:
        _check_sql_patterns(value, field_name)

    # Remove dangerous Unicode characters
    value = _remove_dangerous_unicode(value)

    return value


def sanitize_filter_value(
    value: str | int | float | bool,
    max_length: int = 1000,
) -> str | int | float | bool:
    """
    Sanitize filter values which can be strings or other types.

    For non-string values, returns as-is (no sanitization needed).
    For strings, uses nh3 to strip HTML and applies security validation.

    Args:
        value: The filter value (string, int, float, or bool)
        max_length: Maximum length for string values

    Returns:
        Sanitized value

    Raises:
        ValueError: If string value fails security validation
    """
    if not isinstance(value, str):
        return value

    value = value.strip()

    # Length check first
    if len(value) > max_length:
        raise ValueError(
            f"Filter value too long ({len(value)} characters). "
            f"Maximum allowed length is {max_length} characters."
        )

    # Strip all HTML tags using nh3
    value = _strip_html_tags(value)

    # Check for dangerous patterns
    _check_dangerous_patterns(value, "Filter value")

    _check_dangerous_stored_procedures(value, "Filter value")

    # SQL injection patterns specific to filter values
    sql_patterns = [
        r";\s*(DROP|DELETE|INSERT|UPDATE|CREATE|ALTER|EXEC|EXECUTE)\b",
        r"'\s*OR\s*'",
        r"'\s*AND\s*'",
        r"--\s*",
        r"/\*",
        r"UNION\s+SELECT",
    ]
    for pattern in sql_patterns:
        if re.search(pattern, value, re.IGNORECASE):
            raise ValueError(
                "Filter value contains potentially malicious SQL patterns."
            )

    # Check for shell metacharacters that could indicate injection attempts
    # Note: We allow '&' alone as it's common in text ("A & B") and is only
    # dangerous in shell contexts, not in database queries
    if re.search(r"[;|`$()]", value):
        raise ValueError("Filter value contains potentially unsafe shell characters.")

    # Check for hex encoding
    if re.search(r"\\x[0-9a-fA-F]{2}", value):
        raise ValueError("Filter value contains hex encoding which is not allowed.")

    # Remove dangerous Unicode characters
    value = _remove_dangerous_unicode(value)

    return value


# SELECT/UNION deliberately omitted: subquery policy is in Superset core's
# ALLOW_ADHOC_SUBQUERY flag, exercised by the Tier-2 compile check.
_SQL_EXPR_DDL_DML_RE = re.compile(
    r"\b(DROP|DELETE|INSERT|UPDATE|CREATE|ALTER|EXEC|EXECUTE|GRANT|REVOKE|"
    r"TRUNCATE|MERGE)\b",
    re.IGNORECASE,
)

# Tag-shaped: `<` + tagname (letter start) + close-bracket / attribute / `/>`.
# `col_a<col_b` (no close, no attr) and `<>` (no letter) are NOT matched.
_HTML_TAG_LIKE_RE = re.compile(
    r"<\s*/?\s*[a-zA-Z][\w-]*\s*(?:>|\s+[\w-]+\s*=|/>)",
    re.IGNORECASE,
)


def sanitize_sql_expression(  # noqa: C901
    value: str | None,
    field_name: str,
    max_length: int = 2000,
    allow_empty: bool = False,
) -> str | None:
    """Sanitize a custom SQL aggregate expression.

    Blocks HTML tag constructs, statement stacking, SQL comments,
    state-mutating DDL/DML, and dangerous Unicode. Preserves ``<``/``>``
    (including compact ``col_a<col_b``), ``<>``, backticks, and subqueries
    (the latter gated by core's ``ALLOW_ADHOC_SUBQUERY``).
    """
    if value is None:
        if allow_empty:
            return None
        raise ValueError(f"{field_name} cannot be empty")

    value = value.strip()
    if not value:
        if allow_empty:
            return None
        raise ValueError(f"{field_name} cannot be empty")

    if len(value) > max_length:
        raise ValueError(
            f"{field_name} too long ({len(value)} characters). "
            f"Maximum allowed length is {max_length} characters."
        )

    # Strip + decode entities BEFORE any check so zero-widths and entity
    # encoding can't smuggle past the tag-pattern / keyword scans.
    value = _remove_dangerous_unicode(value)
    prev: str | None = None
    iterations = 0
    while prev != value and iterations < 100:
        prev = value
        value = html.unescape(value)
        iterations += 1

    if _HTML_TAG_LIKE_RE.search(value):
        raise ValueError(
            f"{field_name} contains an HTML tag-like construct "
            f"(SQL expressions cannot embed HTML)"
        )

    if ";" in value:
        raise ValueError(
            f"{field_name} contains ';' — statement stacking is not allowed"
        )
    if "--" in value or "/*" in value or "*/" in value:
        raise ValueError(f"{field_name} contains SQL comment syntax")

    if _SQL_EXPR_DDL_DML_RE.search(value):
        raise ValueError(
            f"{field_name} contains a disallowed SQL keyword "
            f"(DDL/DML statements are not permitted in metrics)"
        )

    _check_dangerous_stored_procedures(value, field_name)

    return value
