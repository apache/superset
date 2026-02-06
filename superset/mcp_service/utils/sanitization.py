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

import nh3


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
    # Block dangerous URL schemes in plain text (word boundary check)
    if re.search(r"\b(javascript|vbscript|data):", value, re.IGNORECASE):
        raise ValueError(f"{field_name} contains potentially malicious URL scheme")

    # Block event handler patterns (onclick=, onerror=, etc.)
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
    """
    Remove dangerous Unicode characters (zero-width, control chars).

    Args:
        value: The input string

    Returns:
        String with dangerous Unicode characters removed
    """
    return re.sub(
        r"[\u200B-\u200D\uFEFF\u0000-\u0008\u000B\u000C\u000E-\u001F]", "", value
    )


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

    # Check for dangerous SQL procedures (filter-specific)
    v_lower = value.lower()
    if "xp_cmdshell" in v_lower or "sp_executesql" in v_lower:
        raise ValueError("Filter value contains potentially malicious SQL procedures.")

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
