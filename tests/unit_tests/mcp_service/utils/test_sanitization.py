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

import pytest

from superset.mcp_service.utils.sanitization import (
    _check_dangerous_patterns,
    _check_sql_patterns,
    _remove_dangerous_unicode,
    _strip_html_tags,
    sanitize_filter_value,
    sanitize_user_input,
)

# --- _strip_html_tags tests ---


def test_strip_html_tags_plain_text():
    assert _strip_html_tags("hello world") == "hello world"


def test_strip_html_tags_preserves_ampersand():
    assert _strip_html_tags("A & B") == "A & B"


def test_strip_html_tags_preserves_multiple_ampersands():
    assert _strip_html_tags("A & B & C") == "A & B & C"


def test_strip_html_tags_strips_bold_tags():
    assert _strip_html_tags("<b>hello</b>") == "hello"


def test_strip_html_tags_strips_script_tags():
    result = _strip_html_tags("<script>alert(1)</script>")
    assert "<script>" not in result
    assert "</script>" not in result


def test_strip_html_tags_strips_entity_encoded_script():
    """Entity-encoded tags must be decoded and stripped, not passed through."""
    result = _strip_html_tags("&lt;script&gt;alert(1)&lt;/script&gt;")
    assert "<script>" not in result
    assert "&lt;script&gt;" not in result


def test_strip_html_tags_strips_double_encoded_script():
    """Double-encoded entities must also be decoded and stripped."""
    result = _strip_html_tags("&amp;lt;script&amp;gt;alert(1)&amp;lt;/script&amp;gt;")
    assert "<script>" not in result
    assert "&lt;script&gt;" not in result


def test_strip_html_tags_strips_img_onerror():
    result = _strip_html_tags('<img src=x onerror="alert(1)">')
    assert "<img" not in result
    assert "onerror" not in result


def test_strip_html_tags_strips_div_tags():
    assert _strip_html_tags("<div>content</div>") == "content"


def test_strip_html_tags_preserves_less_than_in_text():
    """A bare < not forming a tag should be preserved."""
    result = _strip_html_tags("5 < 10")
    assert "5" in result
    assert "10" in result


def test_strip_html_tags_empty_string():
    assert _strip_html_tags("") == ""


def test_strip_html_tags_triple_encoded_script():
    """Triple-encoded entities must also be decoded and stripped."""
    result = _strip_html_tags(
        "&amp;amp;lt;script&amp;amp;gt;alert(1)&amp;amp;lt;/script&amp;amp;gt;"
    )
    assert "<script>" not in result


def test_strip_html_tags_mixed_encoded_and_raw():
    """Both raw and entity-encoded tags should be stripped."""
    result = _strip_html_tags("<b>bold</b> and &lt;i&gt;italic&lt;/i&gt;")
    assert "<b>" not in result
    assert "<i>" not in result
    assert "bold" in result
    assert "italic" in result


def test_strip_html_tags_deep_encoding_terminates():
    """Verify the iterative decode loop terminates on many encoding layers."""
    value = "<script>alert(1)</script>"
    for _ in range(10):
        value = value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    result = _strip_html_tags(value)
    assert "<script>" not in result


def test_strip_html_tags_entity_ampersand():
    """&amp; in input should become & in output."""
    assert _strip_html_tags("A &amp; B") == "A & B"


# --- _check_dangerous_patterns tests ---


def test_check_dangerous_patterns_safe_input():
    _check_dangerous_patterns("hello world", "test")


def test_check_dangerous_patterns_javascript_scheme():
    with pytest.raises(ValueError, match="malicious URL scheme"):
        _check_dangerous_patterns("javascript:alert(1)", "test")


def test_check_dangerous_patterns_vbscript_scheme():
    with pytest.raises(ValueError, match="malicious URL scheme"):
        _check_dangerous_patterns("vbscript:MsgBox", "test")


def test_check_dangerous_patterns_data_scheme():
    with pytest.raises(ValueError, match="malicious URL scheme"):
        _check_dangerous_patterns("data:text/html,<script>", "test")


def test_check_dangerous_patterns_case_insensitive():
    with pytest.raises(ValueError, match="malicious URL scheme"):
        _check_dangerous_patterns("JAVASCRIPT:alert(1)", "test")


def test_check_dangerous_patterns_onclick():
    with pytest.raises(ValueError, match="malicious event handler"):
        _check_dangerous_patterns("onclick=alert(1)", "test")


def test_check_dangerous_patterns_onerror():
    with pytest.raises(ValueError, match="malicious event handler"):
        _check_dangerous_patterns("onerror = alert(1)", "test")


def test_check_dangerous_patterns_onload():
    with pytest.raises(ValueError, match="malicious event handler"):
        _check_dangerous_patterns("onload=fetch('x')", "test")


# --- _check_sql_patterns tests ---


def test_check_sql_patterns_safe_input():
    _check_sql_patterns("revenue_total", "test")


def test_check_sql_patterns_drop_table():
    with pytest.raises(ValueError, match="unsafe SQL keywords"):
        _check_sql_patterns("DROP TABLE users", "test")


def test_check_sql_patterns_delete():
    with pytest.raises(ValueError, match="unsafe SQL keywords"):
        _check_sql_patterns("DELETE FROM users", "test")


def test_check_sql_patterns_semicolon():
    with pytest.raises(ValueError, match="unsafe characters"):
        _check_sql_patterns("value; other", "test")


def test_check_sql_patterns_sql_comment_dash():
    with pytest.raises(ValueError, match="unsafe characters"):
        _check_sql_patterns("value -- comment", "test")


def test_check_sql_patterns_sql_comment_block():
    with pytest.raises(ValueError, match="unsafe SQL comment"):
        _check_sql_patterns("value /* comment */", "test")


def test_check_sql_patterns_pipe():
    with pytest.raises(ValueError, match="unsafe characters"):
        _check_sql_patterns("value | other", "test")


def test_check_sql_patterns_case_insensitive():
    with pytest.raises(ValueError, match="unsafe SQL keywords"):
        _check_sql_patterns("drop table users", "test")


# --- _remove_dangerous_unicode tests ---


def test_remove_dangerous_unicode_plain_text():
    assert _remove_dangerous_unicode("hello") == "hello"


def test_remove_dangerous_unicode_zero_width_space():
    assert _remove_dangerous_unicode("he\u200bllo") == "hello"


def test_remove_dangerous_unicode_zero_width_joiner():
    assert _remove_dangerous_unicode("he\u200dllo") == "hello"


def test_remove_dangerous_unicode_bom():
    assert _remove_dangerous_unicode("\ufeffhello") == "hello"


def test_remove_dangerous_unicode_null_byte():
    assert _remove_dangerous_unicode("he\x00llo") == "hello"


def test_remove_dangerous_unicode_preserves_normal_unicode():
    assert _remove_dangerous_unicode("café résumé") == "café résumé"


# --- sanitize_user_input tests ---


def test_sanitize_user_input_plain_text():
    assert sanitize_user_input("hello", "test") == "hello"


def test_sanitize_user_input_preserves_ampersand():
    assert sanitize_user_input("A & B", "test") == "A & B"


def test_sanitize_user_input_strips_html():
    assert sanitize_user_input("<b>hello</b>", "test") == "hello"


def test_sanitize_user_input_none_not_allowed():
    with pytest.raises(ValueError, match="cannot be empty"):
        sanitize_user_input(None, "test")


def test_sanitize_user_input_none_allowed():
    assert sanitize_user_input(None, "test", allow_empty=True) is None


def test_sanitize_user_input_empty_string_not_allowed():
    with pytest.raises(ValueError, match="cannot be empty"):
        sanitize_user_input("", "test")


def test_sanitize_user_input_empty_string_allowed():
    assert sanitize_user_input("", "test", allow_empty=True) is None


def test_sanitize_user_input_whitespace_only():
    with pytest.raises(ValueError, match="cannot be empty"):
        sanitize_user_input("   ", "test")


def test_sanitize_user_input_strips_whitespace():
    assert sanitize_user_input("  hello  ", "test") == "hello"


def test_sanitize_user_input_too_long():
    with pytest.raises(ValueError, match="too long"):
        sanitize_user_input("a" * 256, "test", max_length=255)


def test_sanitize_user_input_max_length_ok():
    result = sanitize_user_input("a" * 255, "test", max_length=255)
    assert result == "a" * 255


def test_sanitize_user_input_blocks_javascript():
    with pytest.raises(ValueError, match="malicious URL scheme"):
        sanitize_user_input("javascript:alert(1)", "test")


def test_sanitize_user_input_blocks_event_handler():
    with pytest.raises(ValueError, match="malicious event handler"):
        sanitize_user_input("onclick=alert(1)", "test")


def test_sanitize_user_input_sql_keywords_not_checked_by_default():
    result = sanitize_user_input("DROP TABLE", "test")
    assert result == "DROP TABLE"


def test_sanitize_user_input_sql_keywords_checked_when_enabled():
    with pytest.raises(ValueError, match="unsafe SQL keywords"):
        sanitize_user_input("DROP TABLE users", "test", check_sql_keywords=True)


def test_sanitize_user_input_removes_zero_width_chars():
    result = sanitize_user_input("hel\u200blo", "test")
    assert result == "hello"


def test_sanitize_user_input_xss_entity_encoded():
    """Entity-encoded XSS attempts must be neutralized."""
    result = sanitize_user_input("&lt;script&gt;alert(1)&lt;/script&gt;", "test")
    assert "<script>" not in result


def test_sanitize_user_input_entity_encoded_javascript():
    """Entity-encoded javascript: scheme should be caught after decoding."""
    with pytest.raises(ValueError, match="malicious URL scheme"):
        sanitize_user_input("&#106;avascript:alert(1)", "test")


# --- sanitize_filter_value tests ---


def test_sanitize_filter_value_integer():
    assert sanitize_filter_value(42) == 42


def test_sanitize_filter_value_float():
    assert sanitize_filter_value(3.14) == 3.14


def test_sanitize_filter_value_bool():
    assert sanitize_filter_value(True) is True


def test_sanitize_filter_value_plain_string():
    assert sanitize_filter_value("hello") == "hello"


def test_sanitize_filter_value_preserves_ampersand():
    assert sanitize_filter_value("A & B") == "A & B"


def test_sanitize_filter_value_strips_html():
    assert sanitize_filter_value("<b>hello</b>") == "hello"


def test_sanitize_filter_value_too_long():
    with pytest.raises(ValueError, match="too long"):
        sanitize_filter_value("a" * 1001)


def test_sanitize_filter_value_blocks_javascript():
    with pytest.raises(ValueError, match="malicious URL scheme"):
        sanitize_filter_value("javascript:alert(1)")


def test_sanitize_filter_value_blocks_xp_cmdshell():
    with pytest.raises(ValueError, match="malicious SQL procedures"):
        sanitize_filter_value("xp_cmdshell('dir')")


def test_sanitize_filter_value_blocks_sp_executesql():
    with pytest.raises(ValueError, match="malicious SQL procedures"):
        sanitize_filter_value("sp_executesql @stmt")


def test_sanitize_filter_value_blocks_union_select():
    with pytest.raises(ValueError, match="malicious SQL patterns"):
        sanitize_filter_value("' UNION SELECT * FROM users")


def test_sanitize_filter_value_blocks_sql_comment():
    with pytest.raises(ValueError, match="malicious SQL patterns"):
        sanitize_filter_value("value -- drop")


def test_sanitize_filter_value_blocks_shell_semicolon():
    with pytest.raises(ValueError, match="unsafe shell characters"):
        sanitize_filter_value("value;rm -rf")


def test_sanitize_filter_value_blocks_shell_pipe():
    with pytest.raises(ValueError, match="unsafe shell characters"):
        sanitize_filter_value("value|cat /etc/passwd")


def test_sanitize_filter_value_blocks_backtick():
    with pytest.raises(ValueError, match="unsafe shell characters"):
        sanitize_filter_value("`whoami`")


def test_sanitize_filter_value_blocks_hex_encoding():
    with pytest.raises(ValueError, match="hex encoding"):
        sanitize_filter_value("\\x41\\x42")


def test_sanitize_filter_value_allows_ampersand_alone():
    """Ampersand is safe in filter values (only dangerous in shell contexts)."""
    assert sanitize_filter_value("AT&T") == "AT&T"


def test_sanitize_filter_value_removes_zero_width_chars():
    result = sanitize_filter_value("hel\u200blo")
    assert result == "hello"


def test_sanitize_filter_value_blocks_or_injection():
    with pytest.raises(ValueError, match="malicious SQL patterns"):
        sanitize_filter_value("' OR '1'='1")


def test_sanitize_filter_value_blocks_and_injection():
    with pytest.raises(ValueError, match="malicious SQL patterns"):
        sanitize_filter_value("' AND '1'='1")


def test_sanitize_filter_value_blocks_block_comment():
    with pytest.raises(ValueError, match="malicious SQL patterns"):
        sanitize_filter_value("value /* comment */")


def test_sanitize_filter_value_blocks_semicolon_drop():
    with pytest.raises(ValueError, match="malicious SQL patterns"):
        sanitize_filter_value("; DROP TABLE users")


def test_sanitize_filter_value_blocks_parentheses():
    with pytest.raises(ValueError, match="unsafe shell characters"):
        sanitize_filter_value("$(whoami)")


def test_sanitize_filter_value_blocks_dollar_sign():
    with pytest.raises(ValueError, match="unsafe shell characters"):
        sanitize_filter_value("$HOME")


def test_sanitize_filter_value_blocks_event_handler():
    with pytest.raises(ValueError, match="malicious event handler"):
        sanitize_filter_value("onerror=alert(1)")


def test_sanitize_filter_value_xss_entity_encoded():
    """Entity-encoded XSS in filter values must be neutralized."""
    result = sanitize_filter_value("&lt;img src=x onerror=alert(1)&gt;")
    assert "<img" not in result


# --- Defense-in-depth: verify html.unescape is not used after nh3 ---


def test_strip_html_tags_does_not_unescape_angle_brackets():
    """Ensure nh3 entity output is not fully unescaped back to raw HTML.

    nh3.clean may pass through HTML entities (e.g. &lt;script&gt;) from
    the input without stripping them. A full html.unescape() on nh3's
    output could reintroduce raw angle brackets, creating an XSS vector.
    """
    # Plain text passes through unchanged
    result = _strip_html_tags("safe text")
    assert result == "safe text"

    # Verify ampersand preservation still works
    result = _strip_html_tags("A & B")
    assert result == "A & B"

    # Verify real tags are stripped
    result = _strip_html_tags("<script>alert(1)</script>")
    assert "<script>" not in result

    # Entity-encoded script tags must not become real tags in the output
    result = _strip_html_tags("&lt;script&gt;alert(1)&lt;/script&gt;")
    assert "<script>" not in result
    assert "</script>" not in result


def test_strip_html_tags_img_onerror_entity_bypass():
    """Entity-encoded img/onerror should not survive sanitization."""
    result = _strip_html_tags("&lt;img src=x onerror=alert(1)&gt;")
    assert "<img" not in result
    assert "onerror" not in result
