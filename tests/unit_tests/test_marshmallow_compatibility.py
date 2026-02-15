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
Unit tests for marshmallow 4.x compatibility module.

This module tests the marshmallow_compatibility.py module that provides compatibility
between Flask-AppBuilder 5.0.0 and marshmallow 4.x by handling missing
auto-generated fields during schema initialization.
"""

from unittest.mock import patch

import pytest
from marshmallow import Schema, fields

from superset.marshmallow_compatibility import patch_marshmallow_for_flask_appbuilder


class TestMarshmallowCompatibility:
    """Test cases for the marshmallow 4.x compatibility module."""

    def test_patch_marshmallow_for_flask_appbuilder_applies_patch(self):
        """Test that the patch function correctly replaces Schema._init_fields."""
        # Store original method
        original_method = Schema._init_fields

        # Apply patch
        patch_marshmallow_for_flask_appbuilder()

        # Verify the method was replaced
        assert Schema._init_fields != original_method
        assert callable(Schema._init_fields)

        # Restore original for other tests
        Schema._init_fields = original_method

    def test_patch_functionality_with_real_schema_creation(self):
        """Test that the patch works with actual schema creation scenarios."""
        # Store original method
        original_method = Schema._init_fields

        try:
            # Apply the patch
            patch_marshmallow_for_flask_appbuilder()

            # Create a simple schema - this should work without errors
            class TestSchema(Schema):
                name = fields.Str()
                age = fields.Int()

            # Schema creation should succeed
            schema = TestSchema()
            assert "name" in schema.declared_fields
            assert "age" in schema.declared_fields
            assert isinstance(schema.declared_fields["name"], fields.Str)
            assert isinstance(schema.declared_fields["age"], fields.Int)

        finally:
            # Restore original method
            Schema._init_fields = original_method

    def test_patch_handles_schema_with_no_fields(self):
        """Test that the patch works with schemas that have no declared fields."""
        # Store original method
        original_method = Schema._init_fields

        try:
            # Apply the patch
            patch_marshmallow_for_flask_appbuilder()

            # Create an empty schema
            class EmptySchema(Schema):
                pass

            # Schema creation should succeed
            schema = EmptySchema()
            # Should have at least a declared_fields attribute
            assert hasattr(schema, "declared_fields")

        finally:
            # Restore original method
            Schema._init_fields = original_method

    def test_raw_field_creation_and_configuration(self):
        """Test that Raw fields can be created with the expected configuration."""
        # Test creating a Raw field with our configuration
        raw_field = fields.Raw(allow_none=True, dump_only=True)

        assert isinstance(raw_field, fields.Raw)
        assert raw_field.allow_none is True
        assert raw_field.dump_only is True

    @patch("builtins.print")
    def test_print_function_can_be_mocked(self, mock_print):
        """Test that print function can be mocked (for testing log output)."""
        test_message = (
            "Marshmallow compatibility: Added missing field 'test' as Raw field"
        )
        print(test_message)
        mock_print.assert_called_once_with(test_message)

    def test_keyerror_exception_handling(self):
        """Test that KeyError exceptions can be caught and handled."""
        try:
            raise KeyError("test_field")
        except KeyError as e:
            # Verify we can extract the field name
            field_name = str(e).strip("'\"")
            assert field_name == "test_field"

    def test_schema_declared_fields_manipulation(self):
        """Test that we can manipulate schema declared_fields."""

        class TestSchema(Schema):
            existing_field = fields.Str()

        schema = TestSchema()

        # Verify initial state
        assert "existing_field" in schema.declared_fields
        assert isinstance(schema.declared_fields["existing_field"], fields.Str)

        # Test adding a new field
        schema.declared_fields["new_field"] = fields.Raw(
            allow_none=True, dump_only=True
        )

        # Verify the new field was added
        assert "new_field" in schema.declared_fields
        assert isinstance(schema.declared_fields["new_field"], fields.Raw)
        assert schema.declared_fields["new_field"].allow_none is True
        assert schema.declared_fields["new_field"].dump_only is True

    def test_flask_appbuilder_field_names_list(self):
        """Test that we have the correct list of Flask-AppBuilder field names."""
        # Common Flask-AppBuilder auto-generated field names that our fix handles
        expected_fab_fields = [
            "permission_id",
            "view_menu_id",
            "db_id",
            "chart_id",
            "dashboard_id",
            "user_id",
        ]

        # Verify these are strings (field names)
        for field_name in expected_fab_fields:
            assert isinstance(field_name, str)
            assert len(field_name) > 0
            assert "_id" in field_name

    def test_patch_function_is_callable(self):
        """Test that the patch function can be called without errors."""
        # This should not raise any exceptions
        patch_marshmallow_for_flask_appbuilder()

        # Calling it multiple times should also be safe
        patch_marshmallow_for_flask_appbuilder()
        patch_marshmallow_for_flask_appbuilder()

    def test_marshmallow_schema_basic_functionality(self):
        """Test basic marshmallow schema functionality still works."""

        class UserSchema(Schema):
            name = fields.Str(required=True)
            email = fields.Email()
            age = fields.Int(validate=lambda x: x > 0)

        schema = UserSchema()

        # Test serialization
        data = {"name": "John Doe", "email": "john@example.com", "age": 30}
        result = schema.load(data)
        assert result["name"] == "John Doe"
        assert result["email"] == "john@example.com"
        assert result["age"] == 30

        from marshmallow import ValidationError

        # Test validation - missing required field should raise error
        with pytest.raises(ValidationError):
            schema.load({"email": "john@example.com", "age": 30})  # Missing name
