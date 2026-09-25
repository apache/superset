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

"""Unit tests for the marshmallow compatibility shim."""

from unittest.mock import patch

import pytest
from marshmallow import fields, Schema

from superset.marshmallow_compatibility import patch_marshmallow_for_flask_appbuilder


@pytest.fixture(autouse=True)
def restore_schema_init_fields():
    """Restore Schema._init_fields after each test."""
    original_method = Schema._init_fields
    try:
        yield
    finally:
        Schema._init_fields = original_method


class TestMarshmallowCompatibility:
    """Test cases for the marshmallow 4.x compatibility module."""

    def test_patch_marshmallow_for_flask_appbuilder_applies_patch(self):
        """Test that the patch function correctly replaces Schema._init_fields."""
        original_method = Schema._init_fields

        patch_marshmallow_for_flask_appbuilder()

        assert callable(Schema._init_fields)
        assert getattr(Schema._init_fields, "__superset_compat_patched__", False)
        if not getattr(original_method, "__superset_compat_patched__", False):
            assert Schema._init_fields != original_method

    def test_patch_functionality_with_real_schema_creation(self):
        """Test that the patch works with actual schema creation scenarios."""
        patch_marshmallow_for_flask_appbuilder()

        class TestSchema(Schema):
            name = fields.Str()
            age = fields.Int()

        schema = TestSchema()
        assert "name" in schema.declared_fields
        assert "age" in schema.declared_fields
        assert isinstance(schema.declared_fields["name"], fields.Str)
        assert isinstance(schema.declared_fields["age"], fields.Int)

    def test_patch_handles_schema_with_no_fields(self):
        """Test that the patch works with schemas that have no declared fields."""
        patch_marshmallow_for_flask_appbuilder()

        class EmptySchema(Schema):
            pass

        schema = EmptySchema()
        assert hasattr(schema, "declared_fields")

    def test_patch_pre_stubs_missing_fab_fields_before_initialization(self):
        """Test that FAB-looking missing fields are stubbed before init runs."""

        def fake_init_fields(self: Schema):
            assert "missing_field" in self.declared_fields
            return "initialized"

        with patch.object(Schema, "_init_fields", fake_init_fields):
            patch_marshmallow_for_flask_appbuilder()

            schema = object.__new__(Schema)
            schema.declared_fields = {}
            schema.opts = type(
                "Opts",
                (),
                {"fields": ("missing_field",), "additional": ()},
            )()

            result = Schema._init_fields(schema)

        assert result == "initialized"
        assert isinstance(schema.declared_fields["missing_field"], fields.Raw)
        assert schema.declared_fields["missing_field"].allow_none is True
        assert schema.declared_fields["missing_field"].load_default is None

    def test_raw_field_creation_and_configuration(self):
        """Test that Raw fields can be created with the expected configuration."""
        # Test creating a Raw field with our configuration
        raw_field = fields.Raw(allow_none=True, load_default=None)

        assert isinstance(raw_field, fields.Raw)
        assert raw_field.allow_none is True
        assert raw_field.load_default is None

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
            allow_none=True, load_default=None
        )

        # Verify the new field was added
        assert "new_field" in schema.declared_fields
        assert isinstance(schema.declared_fields["new_field"], fields.Raw)
        assert schema.declared_fields["new_field"].allow_none is True
        assert schema.declared_fields["new_field"].load_default is None

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
        patch_marshmallow_for_flask_appbuilder()
        patched_method = Schema._init_fields

        patch_marshmallow_for_flask_appbuilder()
        patch_marshmallow_for_flask_appbuilder()

        assert Schema._init_fields is patched_method

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
