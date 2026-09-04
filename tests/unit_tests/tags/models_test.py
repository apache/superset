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
"""Unit tests for tag models, specifically testing the MySQL fix for tag creation."""

from unittest.mock import MagicMock

from markupsafe import Markup
from sqlalchemy.orm import Session

from superset.tags.models import get_tag, Tag, TagType


def test_get_tag_returns_plain_string_not_markup() -> None:
    """
    Test that get_tag() returns a Tag with a plain string name, not a Markup object.

    This verifies the fix for issue #32484 where escape() was wrapping tag names
    in Markup objects, causing MySQL driver errors.
    """
    # Setup
    mock_session = MagicMock(spec=Session)
    mock_query = MagicMock()
    mock_session.query.return_value = mock_query
    mock_query.filter_by.return_value.one_or_none.return_value = None

    tag_name = "test-tag-name"
    tag_type = TagType.custom

    # Execute
    result = get_tag(tag_name, mock_session, tag_type)

    # Verify
    assert isinstance(result.name, str), "Tag name should be a plain string"
    assert not isinstance(result.name, Markup), "Tag name should NOT be a Markup object"
    assert result.name == tag_name, f"Tag name should be '{tag_name}'"
    assert result.type == tag_type, f"Tag type should be {tag_type}"


def test_get_tag_with_special_characters() -> None:
    """
    Test that get_tag() correctly handles tag names with special characters
    without converting them to Markup objects.
    """
    mock_session = MagicMock(spec=Session)
    mock_query = MagicMock()
    mock_session.query.return_value = mock_query
    mock_query.filter_by.return_value.one_or_none.return_value = None

    # Test with various special characters that might trigger HTML escaping
    tag_names = [
        "tag-with-dashes",
        "tag_with_underscores",
        "tag.with.dots",
        "tag:with:colons",
        "tag/with/slashes",
        "tag with spaces",
        "mysql-fix-verification-20251111",
    ]

    for tag_name in tag_names:
        result = get_tag(tag_name, mock_session, TagType.custom)

        assert isinstance(result.name, str), (
            f"Tag name '{tag_name}' should be a plain string"
        )
        assert not isinstance(result.name, Markup), (
            f"Tag name '{tag_name}' should NOT be a Markup object"
        )
        assert result.name == tag_name, f"Tag name should match input: '{tag_name}'"


def test_get_tag_with_html_characters() -> None:
    """
    Test that get_tag() handles HTML special characters correctly.

    Even though these characters might have been escaped before, they should
    now be stored as plain strings to avoid MySQL driver issues.
    """
    mock_session = MagicMock(spec=Session)
    mock_query = MagicMock()
    mock_session.query.return_value = mock_query
    mock_query.filter_by.return_value.one_or_none.return_value = None

    # Test with HTML special characters
    tag_names = [
        "tag<with>brackets",
        "tag&with&ampersands",
        'tag"with"quotes',
        "tag'with'apostrophes",
    ]

    for tag_name in tag_names:
        result = get_tag(tag_name, mock_session, TagType.custom)

        assert isinstance(result.name, str), (
            f"Tag name '{tag_name}' should be a plain string"
        )
        assert not isinstance(result.name, Markup), (
            f"Tag name '{tag_name}' should NOT be a Markup object"
        )
        # Name should remain unchanged (not HTML-escaped)
        assert result.name == tag_name, f"Tag name should not be escaped: '{tag_name}'"


def test_get_tag_strips_whitespace() -> None:
    """Test that get_tag() strips leading and trailing whitespace from tag names."""
    mock_session = MagicMock(spec=Session)
    mock_query = MagicMock()
    mock_session.query.return_value = mock_query
    mock_query.filter_by.return_value.one_or_none.return_value = None

    tag_names_with_whitespace = [
        ("  tag-with-leading-spaces", "tag-with-leading-spaces"),
        ("tag-with-trailing-spaces  ", "tag-with-trailing-spaces"),
        ("  tag-with-both  ", "tag-with-both"),
        ("\ttag-with-tabs\t", "tag-with-tabs"),
        ("\ntag-with-newlines\n", "tag-with-newlines"),
    ]

    for input_name, expected_name in tag_names_with_whitespace:
        result = get_tag(input_name, mock_session, TagType.custom)

        assert isinstance(result.name, str), "Tag name should be a plain string"
        assert not isinstance(result.name, Markup), (
            "Tag name should NOT be a Markup object"
        )
        assert result.name == expected_name, (
            f"Tag name should be stripped: '{expected_name}'"
        )


def test_get_tag_returns_existing_tag() -> None:
    """
    Test that get_tag() returns existing tag from database.

    Verifies it doesn't create a new one.
    """
    mock_session = MagicMock(spec=Session)

    # Create an existing tag
    existing_tag = Tag(name="existing-tag", type=TagType.custom)
    existing_tag.id = 42

    mock_query = MagicMock()
    mock_session.query.return_value = mock_query
    mock_query.filter_by.return_value.one_or_none.return_value = existing_tag

    # Execute
    result = get_tag("existing-tag", mock_session, TagType.custom)

    # Verify
    assert result is existing_tag, "Should return the existing tag"
    assert result.id == 42, "Should have the existing tag's ID"
    mock_session.add.assert_not_called()
    mock_session.commit.assert_not_called()


def test_get_tag_creates_new_tag() -> None:
    """Test that get_tag() creates and commits a new tag when it doesn't exist."""
    mock_session = MagicMock(spec=Session)
    mock_query = MagicMock()
    mock_session.query.return_value = mock_query
    mock_query.filter_by.return_value.one_or_none.return_value = None

    tag_name = "new-tag"
    tag_type = TagType.custom

    # Execute
    get_tag(tag_name, mock_session, tag_type)

    # Verify
    mock_session.add.assert_called_once()
    mock_session.commit.assert_called_once()

    # Check the tag object that was added
    added_tag = mock_session.add.call_args[0][0]
    assert isinstance(added_tag, Tag), "Should add a Tag object"
    assert isinstance(added_tag.name, str), "Tag name should be a plain string"
    assert not isinstance(added_tag.name, Markup), (
        "Tag name should NOT be a Markup object"
    )
    assert added_tag.name == tag_name, "Tag name should match"
    assert added_tag.type == tag_type, "Tag type should match"


def test_get_tag_with_different_tag_types() -> None:
    """Test that get_tag() works correctly with all TagType values."""
    mock_session = MagicMock(spec=Session)
    mock_query = MagicMock()
    mock_session.query.return_value = mock_query
    mock_query.filter_by.return_value.one_or_none.return_value = None

    tag_types = [
        TagType.custom,
        TagType.type,
        TagType.owner,
        TagType.favorited_by,
    ]

    for tag_type in tag_types:
        tag_name = f"tag-{tag_type.name}"
        result = get_tag(tag_name, mock_session, tag_type)

        assert isinstance(result.name, str), (
            f"Tag name for {tag_type} should be a plain string"
        )
        assert not isinstance(result.name, Markup), (
            f"Tag name for {tag_type} should NOT be a Markup object"
        )
        assert result.type == tag_type, f"Tag type should be {tag_type}"


def test_tag_name_type_after_database_operation() -> None:
    """
    Simulate the complete flow to ensure tag name remains a string
    throughout the database operation lifecycle.
    """
    mock_session = MagicMock(spec=Session)
    mock_query = MagicMock()
    mock_session.query.return_value = mock_query
    mock_query.filter_by.return_value.one_or_none.return_value = None

    tag_name = "mysql-compatibility-test"

    # Execute
    result = get_tag(tag_name, mock_session, TagType.custom)

    # Verify the tag object before database operations
    assert isinstance(result.name, str), (
        "Tag name should be a string before DB operations"
    )
    assert not isinstance(result.name, Markup), (
        "Tag name should NOT be Markup before DB operations"
    )

    # Verify that session.add was called with the correct tag
    mock_session.add.assert_called_once()
    added_tag = mock_session.add.call_args[0][0]

    # The critical check: ensure the name passed to the database is a plain string
    assert isinstance(added_tag.name, str), (
        "Tag name should be a plain string when added to session"
    )
    assert not isinstance(added_tag.name, Markup), (
        "Tag name should NOT be Markup when added to session"
    )
    assert added_tag.name.__class__ is str, (
        "Tag name should be exactly str type, not a subclass"
    )
