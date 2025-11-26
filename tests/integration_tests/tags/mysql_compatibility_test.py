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
"""Integration tests for tag creation with MySQL compatibility."""

import pytest
from markupsafe import Markup
from sqlalchemy.exc import ProgrammingError

from superset import db
from superset.tags.models import get_tag, Tag, TagType
from tests.integration_tests.base_tests import SupersetTestCase


class TestTagCreationMySQLCompatibility(SupersetTestCase):
    """Test suite to verify the MySQL compatibility fix for tag creation."""

    def setUp(self) -> None:
        """Set up test fixtures."""
        super().setUp()
        # Clean up any existing test tags
        self.cleanup_test_tags()

    def tearDown(self):
        """Clean up after tests."""
        self.cleanup_test_tags()
        super().tearDown()

    def cleanup_test_tags(self):
        """Remove test tags from the database."""
        test_tag_prefixes = [
            "mysql-fix-verification",
            "test-tag",
            "integration-test",
        ]
        for prefix in test_tag_prefixes:
            tags = db.session.query(Tag).filter(Tag.name.like(f"{prefix}%")).all()
            for tag in tags:
                db.session.delete(tag)
        db.session.commit()

    def test_create_tag_returns_string_not_markup(self) -> None:
        """
        Test that creating a tag results in a plain string name, not Markup.

        This is the core test for issue #32484 - ensures tag names are
        compatible with MySQL driver requirements.
        """
        tag_name = "mysql-fix-verification-20251111"

        # Create tag using get_tag function
        tag = get_tag(tag_name, db.session, TagType.custom)

        # Verify the tag was created
        assert tag is not None, "Tag should be created"
        assert tag.id is not None, "Tag should have an ID after creation"

        # Critical checks for MySQL compatibility
        assert isinstance(tag.name, str), "Tag name should be a plain string"
        assert not isinstance(tag.name, Markup), (
            "Tag name should NOT be a Markup object"
        )
        assert tag.name.__class__ is str, "Tag name should be exactly str type"
        assert tag.name == tag_name, f"Tag name should be '{tag_name}'"

        # Verify the tag persists correctly in the database
        db.session.commit()

        # Retrieve the tag from database to ensure it was stored correctly
        retrieved_tag = db.session.query(Tag).filter_by(name=tag_name).first()
        assert retrieved_tag is not None, "Tag should be retrievable from database"
        assert isinstance(retrieved_tag.name, str), (
            "Retrieved tag name should be a string"
        )
        assert not isinstance(retrieved_tag.name, Markup), (
            "Retrieved tag name should NOT be Markup"
        )
        assert retrieved_tag.name == tag_name, (
            "Retrieved tag name should match original"
        )

    def test_create_multiple_tags_no_sql_error(self) -> None:
        """
        Test creating multiple tags in sequence without SQL errors.

        This ensures the fix works consistently across multiple operations.
        """
        tag_names = [
            "integration-test-tag-1",
            "integration-test-tag-2",
            "integration-test-tag-3",
        ]

        created_tags = []
        try:
            for tag_name in tag_names:
                tag = get_tag(tag_name, db.session, TagType.custom)
                created_tags.append(tag)

                assert isinstance(tag.name, str), (
                    f"Tag '{tag_name}' name should be a string"
                )
                assert not isinstance(tag.name, Markup), (
                    f"Tag '{tag_name}' should NOT be Markup"
                )
        except ProgrammingError as e:
            pytest.fail(
                f"ProgrammingError should not occur when creating tags: {e}",
            )

        db.session.commit()

        # Verify all tags were created successfully
        assert len(created_tags) == len(tag_names), "All tags should be created"

        for tag_name in tag_names:
            tag = db.session.query(Tag).filter_by(name=tag_name).first()
            assert tag is not None, f"Tag '{tag_name}' should exist in database"
            assert isinstance(tag.name, str), (
                f"Tag '{tag_name}' should have string name"
            )

    def test_create_tag_with_special_characters(self) -> None:
        """
        Test creating tags with special characters that might trigger HTML escaping.

        Ensures these characters don't cause the tag name to become a Markup object.
        """
        tag_names = [
            "test-tag-with-dashes",
            "test_tag_with_underscores",
            "test.tag.with.dots",
            "test:tag:with:colons",
            "test tag with spaces",
        ]

        for tag_name in tag_names:
            try:
                tag = get_tag(tag_name, db.session, TagType.custom)

                assert isinstance(tag.name, str), f"Tag '{tag_name}' should be a string"
                assert not isinstance(tag.name, Markup), (
                    f"Tag '{tag_name}' should NOT be Markup"
                )
                assert tag.name == tag_name, (
                    f"Tag name should match input: '{tag_name}'"
                )

                db.session.commit()

                # Verify database persistence
                retrieved_tag = db.session.query(Tag).filter_by(name=tag_name).first()
                assert retrieved_tag is not None, (
                    f"Tag '{tag_name}' should be in database"
                )
                assert retrieved_tag.name == tag_name, (
                    f"Retrieved tag name should match: '{tag_name}'"
                )

            except ProgrammingError as e:
                pytest.fail(
                    f"ProgrammingError should not occur for tag '{tag_name}': {e}"
                )

    def test_get_existing_tag_returns_string(self) -> None:
        """Test that retrieving an existing tag also returns a string name."""
        tag_name = "test-tag-for-retrieval"

        # Create tag first
        original_tag = get_tag(tag_name, db.session, TagType.custom)
        db.session.commit()

        # Retrieve the same tag
        retrieved_tag = get_tag(tag_name, db.session, TagType.custom)

        assert retrieved_tag.id == original_tag.id, "Should retrieve the same tag"
        assert isinstance(retrieved_tag.name, str), (
            "Retrieved tag name should be a string"
        )
        assert not isinstance(retrieved_tag.name, Markup), (
            "Retrieved tag name should NOT be Markup"
        )

    def test_tag_with_whitespace_handling(self) -> None:
        """Test that tags with leading/trailing whitespace are handled correctly."""
        input_name = "  test-tag-with-whitespace  "
        expected_name = "test-tag-with-whitespace"

        tag = get_tag(input_name, db.session, TagType.custom)

        assert isinstance(tag.name, str), "Tag name should be a string"
        assert not isinstance(tag.name, Markup), "Tag name should NOT be Markup"
        assert tag.name == expected_name, "Tag name should be stripped of whitespace"

        db.session.commit()

        # Verify in database
        retrieved_tag = db.session.query(Tag).filter_by(name=expected_name).first()
        assert retrieved_tag is not None, "Tag should exist with stripped name"

    def test_tag_type_variations(self) -> None:
        """Test creating tags with different TagType values."""
        tag_types = [
            (TagType.custom, "test-custom-tag"),
            (TagType.type, "type:chart"),
            (TagType.owner, "owner:123"),
            (TagType.favorited_by, "favorited_by:456"),
        ]

        for tag_type, tag_name in tag_types:
            try:
                tag = get_tag(tag_name, db.session, tag_type)

                assert isinstance(tag.name, str), (
                    f"Tag name for {tag_type} should be a string"
                )
                assert not isinstance(tag.name, Markup), (
                    f"Tag name for {tag_type} should NOT be Markup"
                )
                assert tag.type == tag_type, f"Tag type should be {tag_type}"

                db.session.commit()

            except ProgrammingError as e:
                pytest.fail(f"ProgrammingError for {tag_type} tag '{tag_name}': {e}")

    def test_no_sql_syntax_error_on_commit(self) -> None:
        """
        Test that committing a tag to the database doesn't cause SQL syntax errors.

        This is the main error that occurred in issue #32484 with MySQL.
        """
        tag_name = "mysql-compatibility-test"

        try:
            get_tag(tag_name, db.session, TagType.custom)

            # This commit should not raise a ProgrammingError
            db.session.commit()

            # Verify the tag exists in the database
            retrieved_tag = db.session.query(Tag).filter_by(name=tag_name).first()
            assert retrieved_tag is not None, "Tag should exist after commit"
            assert isinstance(retrieved_tag.name, str), (
                "Retrieved tag should have string name"
            )

        except ProgrammingError as e:
            pytest.fail(f"ProgrammingError should not occur during commit: {e}")
        except Exception as e:
            pytest.fail(f"Unexpected error during tag creation and commit: {e}")

    def test_tag_name_is_pure_string_type(self) -> None:
        """
        Test that tag name is exactly of type 'str', not a subclass like Markup.

        This is critical for MySQL compatibility as the driver cannot handle
        Markup objects in SQL queries.
        """
        tag_name = "test-tag-type-check"
        tag = get_tag(tag_name, db.session, TagType.custom)

        # Check that it's exactly a str, not a subclass
        assert tag.name.__class__ is str, (
            f"Tag name type should be exactly 'str', got {type(tag.name)}"
        )
        assert not isinstance(tag.name, Markup), (
            "Tag name should not be a Markup instance"
        )

        # Markup is a subclass of str, so this additional check is important
        assert tag.name.__class__.__name__ == "str", "Tag name class should be 'str'"
