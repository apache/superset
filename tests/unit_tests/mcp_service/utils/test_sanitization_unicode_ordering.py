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
Ordering-dependent behavior of the zero-width-character removal step relative
to the keyword/pattern denylist checks in ``sanitize_user_input`` and
``sanitize_filter_value``.

Both functions run their regex-based denylist checks *before*
``_remove_dangerous_unicode``, whereas ``sanitize_sql_expression`` runs
``_remove_dangerous_unicode`` *first*. Because zero-width characters (e.g.
U+200B ZERO WIDTH SPACE) can sit in the middle of a denylisted keyword and
break a ``\\b(KEYWORD)\\b`` style match, a keyword split by such a character
slips past the regex checks in the first two functions. The trailing
``_remove_dangerous_unicode`` call then strips the zero-width character out
of the *already-accepted* value, so the string these functions return is the
reconstructed, unsplit keyword — not a raised ``ValueError`` and not a value
with the keyword neutralized.
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
def test_sanitize_user_input_returns_reconstructed_keyword_for_split_input(zwc):
    """
    A zero-width character placed inside the denylisted keyword ``DROP``
    prevents the ``\\b(DROP|...)\\b`` regex from matching, so no
    ``ValueError`` is raised. The function's own trailing unicode-removal
    step then deletes the zero-width character from the value it is about
    to return, so the returned string is ``"DROP TABLE users"`` — the exact
    keyword the function's docstring says it blocks.
    """
    obfuscated = f"DR{zwc}OP TABLE users"

    result = sanitize_user_input(obfuscated, "Column name", check_sql_keywords=True)

    assert result == "DROP TABLE users"


# --- sanitize_filter_value ---


def test_sanitize_filter_value_rejects_unsplit_union_select():
    """Baseline: an un-obfuscated ``UNION SELECT`` pattern is rejected as documented."""
    with pytest.raises(ValueError, match="malicious SQL patterns"):
        sanitize_filter_value("UNION SELECT password FROM users")


@pytest.mark.parametrize("zwc", ZERO_WIDTH_CHARS)
def test_sanitize_filter_value_returns_reconstructed_union_select_for_split_input(zwc):
    """
    Same ordering issue as ``sanitize_user_input``: splitting ``UNION`` with
    a zero-width character defeats the ``UNION\\s+SELECT`` pattern check, and
    the function's own unicode-removal step reassembles the denylisted
    pattern in the value it returns.
    """
    obfuscated = f"UNI{zwc}ON SELECT password FROM users"  # noqa: S608

    result = sanitize_filter_value(obfuscated)

    assert result == "UNION SELECT password FROM users"


# --- sanitize_sql_expression (contrast case: correct ordering) ---


def test_sanitize_sql_expression_rejects_same_split_keyword_payload():
    """
    ``sanitize_sql_expression`` removes dangerous unicode *before* running
    its keyword/pattern checks (the opposite order from the two functions
    above), so the same zero-width obfuscation technique does not defeat it:
    the value is canonicalized first and the reconstructed ``DROP`` keyword
    is then caught by the denylist check as normal.
    """
    obfuscated = f"DR{ZERO_WIDTH_CHARS[0]}OP TABLE users"

    with pytest.raises(ValueError, match="disallowed SQL keyword"):
        sanitize_sql_expression(obfuscated, "SQL expression")
