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
keyword/pattern denylist checks and HTML-entity decoding in
``sanitize_user_input``, ``sanitize_filter_value``, and
``sanitize_sql_expression``.

All three functions now run ``_remove_dangerous_unicode`` *both* before and
after HTML-entity decoding happens (entity decoding is internal to
``_strip_html_tags`` for the first two functions, and an explicit loop in
the third). Zero-width characters (e.g. U+200B ZERO WIDTH SPACE) can sit in
the middle of a denylisted keyword and break a ``\\b(KEYWORD)\\b`` style
match, whether they appear as a raw character or as an HTML entity
(``&#8203;`` / ``&#x200b;``) that only becomes the raw character after
decoding. Stripping only before decoding catches the raw form but lets an
entity-encoded one survive decoding and reach the denylist checks intact;
stripping again after decoding closes that gap.
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

# Decimal and hex HTML entity encodings of ZERO WIDTH SPACE (U+200B) --
# distinct textual forms that both decode to the same raw character.
ZERO_WIDTH_SPACE_ENTITIES = [
    "&#8203;",
    "&#x200b;",
    "&#x200B;",
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


@pytest.mark.parametrize("entity", ZERO_WIDTH_SPACE_ENTITIES)
def test_sanitize_user_input_rejects_entity_encoded_split_keyword_payload(entity):
    """
    An HTML-entity-encoded zero-width character only becomes the raw
    character once ``_strip_html_tags`` decodes it -- if nothing re-checks
    for dangerous Unicode after that decoding step, the reconstructed
    keyword reaches the denylist check without ever having been
    canonicalized, and the entity-encoded payload slips through where the
    raw-character form (above) is caught. Stripping again after decoding
    closes that gap.
    """
    obfuscated = f"DR{entity}OP TABLE users"

    with pytest.raises(ValueError, match="unsafe SQL keywords"):
        sanitize_user_input(obfuscated, "Column name", check_sql_keywords=True)


def test_sanitize_user_input_still_removes_a_raw_dangerous_unicode_char():
    """
    Regression check: the second Unicode-strip pass must not stop the
    function from silently removing a dangerous character that arrives
    HTML-entity-encoded and isn't part of a denylisted keyword -- e.g.
    U+2028 LINE SEPARATOR, a statement terminator on some SQL drivers per
    this module's own docstring. This should sanitize to plain text, not
    raise, matching the documented "removes dangerous Unicode" contract.
    """
    assert sanitize_user_input("a&#8232;b", "Column name") == "ab"


def test_sanitize_user_input_tag_only_payload_reduces_to_empty_string():
    """
    Regression check: a tag-heavy input that nh3 legitimately strips down
    to "" (e.g. "<script>...</script>") must sanitize to an empty string,
    not raise -- there is deliberately no emptiness recheck immediately
    after ``_strip_html_tags`` (only before it), since reducing to "" here
    is the correct sanitized result of intentionally-stripped content, not
    an error case like an all-zero-width input would be.
    """
    assert (
        sanitize_user_input(
            "<script>alert(1)</script>", "Column name", allow_empty=True
        )
        == ""
    )


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


@pytest.mark.parametrize("entity", ZERO_WIDTH_SPACE_ENTITIES)
def test_sanitize_filter_value_rejects_entity_encoded_split_union_select_payload(
    entity,
):
    """Entity-encoded counterpart of the raw zero-width case above."""
    obfuscated = f"UNI{entity}ON SELECT password FROM users"  # noqa: S608

    with pytest.raises(ValueError, match="malicious SQL patterns"):
        sanitize_filter_value(obfuscated)


# --- sanitize_sql_expression ---


def test_sanitize_sql_expression_rejects_same_split_keyword_payload():
    """
    ``sanitize_sql_expression`` strips dangerous Unicode both before and
    after decoding HTML entities, so the same zero-width obfuscation
    technique used against the two functions above does not defeat it
    either: the value is canonicalized, decoded, then canonicalized again,
    and the reconstructed ``DROP`` keyword is caught by the denylist check
    as normal.
    """
    obfuscated = f"DR{ZERO_WIDTH_CHARS[0]}OP TABLE users"

    with pytest.raises(ValueError, match="disallowed SQL keyword"):
        sanitize_sql_expression(obfuscated, "SQL expression")


@pytest.mark.parametrize("entity", ZERO_WIDTH_SPACE_ENTITIES)
def test_sanitize_sql_expression_rejects_entity_encoded_split_keyword_payload(entity):
    """
    Entity-encoded counterpart of the raw zero-width case above: decoding
    happens between the two Unicode-strip passes, so a zero-width character
    that only exists as an HTML entity until decoded is still caught.
    """
    obfuscated = f"DR{entity}OP TABLE users"

    with pytest.raises(ValueError, match="disallowed SQL keyword"):
        sanitize_sql_expression(obfuscated, "SQL expression")
