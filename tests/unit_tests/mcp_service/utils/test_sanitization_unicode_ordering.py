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
Ordering of the zero-width-character removal step relative to the
keyword/pattern denylist checks in ``sanitize_user_input`` and
``sanitize_filter_value``.

Both functions now run ``_remove_dangerous_unicode`` *before* their
regex-based denylist checks, matching ``sanitize_sql_expression``'s existing
order. Zero-width characters (e.g. U+200B ZERO WIDTH SPACE) can sit in the
middle of a denylisted keyword and break a ``\\b(KEYWORD)\\b`` style match;
canonicalizing first means the reconstructed keyword is what the denylist
checks see, so a keyword split by such a character is caught rather than
slipping through and being silently reassembled in the returned value.
"""

import pytest

from superset.mcp_service.utils.sanitization import (
    sanitize_filter_value,
    sanitize_sql_expression,
    sanitize_user_input,
)

ZERO_WIDTH_CHARS = [
    "​",  # ZERO WIDTH SPACE
    "‌",  # ZERO WIDTH NON-JOINER
    "‍",  # ZERO WIDTH JOINER
    "﻿",  # ZERO WIDTH NO-BREAK SPACE / BOM
]


# --- sanitize_user_input(check_sql_keywords=True) ---


def test_sanitize_user_input_rejects_unsplit_sql_keyword():
    """Baseline: an un-obfuscated denylisted keyword is rejected as documented."""
    with pytest.raises(ValueError, match="unsafe SQL keywords"):
        sanitize_user_input("DROP TABLE users", "Column name", check_sql_keywords=True)


@pytest.mark.parametrize("zwc", ZERO_WIDTH_CHARS)
def test_sanitize_user_input_rejects_split_keyword_payload(zwc):
    """
    A zero-width character placed inside the denylisted keyword ``DROP``
    no longer defeats the ``\\b(DROP|...)\\b`` regex: unicode canonicalization
    now runs before the keyword check, so the reconstructed keyword is what
    the denylist check sees and a ``ValueError`` is raised, same as the
    unobfuscated baseline.
    """
    obfuscated = f"DR{zwc}OP TABLE users"

    with pytest.raises(ValueError, match="unsafe SQL keywords"):
        sanitize_user_input(obfuscated, "Column name", check_sql_keywords=True)


# --- sanitize_filter_value ---


def test_sanitize_filter_value_rejects_unsplit_union_select():
    """Baseline: an un-obfuscated ``UNION SELECT`` pattern is rejected as documented."""
    with pytest.raises(ValueError, match="malicious SQL patterns"):
        sanitize_filter_value("UNION SELECT password FROM users")


@pytest.mark.parametrize("zwc", ZERO_WIDTH_CHARS)
def test_sanitize_filter_value_rejects_split_union_select_payload(zwc):
    """
    Same ordering fix as ``sanitize_user_input``: splitting ``UNION`` with a
    zero-width character no longer defeats the ``UNION\\s+SELECT`` pattern
    check, since canonicalization now runs first and the pattern check sees
    the reconstructed value.
    """
    obfuscated = f"UNI{zwc}ON SELECT password FROM users"  # noqa: S608

    with pytest.raises(ValueError, match="malicious SQL patterns"):
        sanitize_filter_value(obfuscated)


# --- sanitize_sql_expression (reference case: this ordering already existed here) ---


def test_sanitize_sql_expression_rejects_same_split_keyword_payload():
    """
    ``sanitize_sql_expression`` has always removed dangerous unicode *before*
    running its keyword/pattern checks — the ordering the two functions above
    were brought in line with — so the same zero-width obfuscation technique
    does not defeat it: the value is canonicalized first and the
    reconstructed ``DROP`` keyword is then caught by the denylist check as
    normal.
    """
    obfuscated = f"DR{ZERO_WIDTH_CHARS[0]}OP TABLE users"

    with pytest.raises(ValueError, match="disallowed SQL keyword"):
        sanitize_sql_expression(obfuscated, "SQL expression")
