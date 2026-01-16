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

This module provides a single source of truth for sanitizing user-provided
text inputs across all MCP tools and schemas.

IMPORTANT: This module intentionally does NOT use html.escape() because:
1. Data is stored in a database and returned via JSON API
2. React handles its own XSS escaping when rendering text content
3. Using html.escape() causes characters like '&' to display as '&amp;' in the UI
4. The security checks here (blocking script tags, JS URLs, event handlers)
   are sufficient for preventing XSS attacks
"""

import re


def sanitize_user_input(  # noqa: C901
    value: str | None,
    field_name: str,
    max_length: int = 255,
    check_sql_keywords: bool = False,
    allow_empty: bool = False,
) -> str | None:
    """
    Centralized sanitization for user-provided text inputs.

    Performs security validation without html.escape() to prevent
    display issues like '&' becoming '&amp;'.

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
        - Dangerous HTML tags (<script>, <iframe>, <object>, <embed>, etc.)
        - JavaScript/VBScript/data URL schemes
        - Event handlers (onclick=, onerror=, etc.)
        - Dangerous Unicode characters (zero-width, control chars)
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

    v_lower = value.lower()

    # Block dangerous HTML tags using substring checks (safe, no regex)
    dangerous_tags = [
        "<script",
        "</script>",
        "<iframe",
        "</iframe>",
        "<object",
        "</object>",
        "<embed",
        "</embed>",
        "<link",
        "<meta",
    ]
    for tag in dangerous_tags:
        if tag in v_lower:
            raise ValueError(
                f"{field_name} contains potentially malicious content. "
                f"HTML tags are not allowed."
            )

    # Block dangerous URL schemes with word boundaries
    if re.search(r"\b(javascript|vbscript|data):", value, re.IGNORECASE):
        raise ValueError(f"{field_name} contains potentially malicious URL scheme")

    # Block event handlers
    if re.search(r"on\w+\s*=", value, re.IGNORECASE):
        raise ValueError(f"{field_name} contains potentially malicious event handler")

    # SQL keyword and shell metacharacter checks (for column names, etc.)
    if check_sql_keywords:
        # Check for SQL keywords
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
            raise ValueError(
                f"{field_name} contains potentially unsafe SQL comment syntax"
            )

    # Remove dangerous Unicode characters (zero-width, control chars)
    value = re.sub(
        r"[\u200B-\u200D\uFEFF\u0000-\u0008\u000B\u000C\u000E-\u001F]", "", value
    )

    # Return sanitized value WITHOUT html.escape()
    return value


def sanitize_filter_value(  # noqa: C901
    value: str | int | float | bool,
    max_length: int = 1000,
) -> str | int | float | bool:
    """
    Sanitize filter values which can be strings or other types.

    For non-string values, returns as-is (no sanitization needed).
    For strings, applies security validation without html.escape().

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

    v_lower = value.lower()

    # Check for dangerous HTML tags and SQL procedures
    dangerous_substrings = [
        "<script",
        "</script>",
        "<iframe",
        "<object",
        "<embed",
        "xp_cmdshell",
        "sp_executesql",
    ]
    for substring in dangerous_substrings:
        if substring in v_lower:
            raise ValueError(
                "Filter value contains potentially malicious content. "
                "HTML tags and JavaScript are not allowed."
            )

    # Check URL schemes
    if re.search(r"\b(javascript|vbscript|data):", value, re.IGNORECASE):
        raise ValueError("Filter value contains potentially malicious URL scheme")

    # SQL injection patterns
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

    # Check for shell metacharacters
    if re.search(r"[;&|`$()]", value):
        raise ValueError("Filter value contains potentially unsafe shell characters.")

    # Check for event handlers
    if re.search(r"on\w+\s*=", value, re.IGNORECASE):
        raise ValueError("Filter value contains potentially malicious event handlers.")

    # Check for hex encoding
    if re.search(r"\\x[0-9a-fA-F]{2}", value):
        raise ValueError("Filter value contains hex encoding which is not allowed.")

    # Remove dangerous Unicode characters
    value = re.sub(
        r"[\u200B-\u200D\uFEFF\u0000-\u0008\u000B\u000C\u000E-\u001F]", "", value
    )

    # Return WITHOUT html.escape()
    return value
