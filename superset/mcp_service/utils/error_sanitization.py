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
Shared error sanitization utilities for MCP service.

SECURITY: These functions sanitize validation errors to prevent information
disclosure (e.g., SQL fragments, schema names, table names) while preserving
actionable error messages for LLM callers.
"""

import re


def _redact_sql_select(error_str: str, error_str_upper: str) -> str:
    """Redact SELECT...FROM clause content to prevent data disclosure."""
    if "SELECT" in error_str_upper and "FROM" in error_str_upper:
        select_idx = error_str_upper.find("SELECT")
        from_idx = error_str_upper.find("FROM", select_idx)
        if select_idx != -1 and from_idx != -1:
            return error_str[: select_idx + 7] + " [REDACTED] " + error_str[from_idx:]
    return error_str


def _redact_sql_where(error_str: str, error_str_upper: str) -> str:
    """Redact WHERE clause content to prevent data disclosure."""
    if "WHERE" not in error_str_upper:
        return error_str

    where_idx = error_str_upper.find("WHERE")
    terminators = ["ORDER", "GROUP", "LIMIT", "UNION", "EXCEPT", "INTERSECT"]
    term_idx = len(error_str)
    for term in terminators:
        idx = error_str_upper.find(term, where_idx)
        if idx != -1 and idx < term_idx:
            term_idx = idx
    return error_str[: where_idx + 6] + " [REDACTED]" + error_str[term_idx:]


def _get_generic_error_message(error_str: str) -> str | None:
    """Return generic message for common error types, or None."""
    error_lower = error_str.lower()
    if "permission" in error_lower or "access" in error_lower:
        return "Validation failed due to access restrictions"
    if "database" in error_lower or "connection" in error_lower:
        return "Validation failed due to database connectivity"
    if "timeout" in error_lower:
        return "Validation timed out"
    return None


def _sanitize_validation_error(error: Exception) -> str:
    """SECURITY FIX: Sanitize validation errors to prevent disclosure."""
    error_str = str(error)

    # Pydantic tagged-union errors prefix the message with a long
    # ``1 validation error for tagged-union[...]`` header before the
    # per-field body (e.g. ``Value error, ...``, ``Field required``,
    # ``Input should be ...``). The body always lives on a line indented
    # by exactly two spaces — pull it out so the 200-char truncation
    # below doesn't swallow the actionable part. The pydantic footer
    # ``\n    For further information ...`` uses four-space indent and
    # is dropped here.
    if "tagged-union[" in error_str:
        body_match = re.search(r"\n  (?! )", error_str)
        if body_match:
            idx = body_match.end()
            footer_idx = error_str.find("\n    For further information", idx)
            end = footer_idx if footer_idx != -1 else len(error_str)
            error_str = error_str[idx:end].strip()

    # SECURITY FIX: Limit length FIRST to prevent ReDoS attacks
    if len(error_str) > 200:
        error_str = error_str[:200] + "...[truncated]"

    # Remove potentially sensitive schema information
    sensitive_patterns = [
        (r'\btable\s+[\'"`]?(\w+)[\'"`]?', "table [REDACTED]"),
        (r'\bcolumn\s+[\'"`]?(\w+)[\'"`]?', "column [REDACTED]"),
        (r'\bdatabase\s+[\'"`]?(\w+)[\'"`]?', "database [REDACTED]"),
        (r'\bschema\s+[\'"`]?(\w+)[\'"`]?', "schema [REDACTED]"),
    ]
    for pattern, replacement in sensitive_patterns:
        error_str = re.sub(pattern, replacement, error_str, flags=re.IGNORECASE)

    # SECURITY FIX: SQL sanitization without ReDoS-vulnerable patterns
    error_str_upper = error_str.upper()
    error_str = _redact_sql_select(error_str, error_str_upper)
    error_str = _redact_sql_where(error_str, error_str_upper)

    # Return generic message for common error types
    if generic := _get_generic_error_message(error_str):
        return generic

    return error_str
