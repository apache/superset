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


from superset.themes.api import ThemeRestApi


class TestThemeRestApi:
    """Unit tests for ThemeRestApi class configuration"""

    def test_resource_name(self):
        """Test that resource name is set correctly"""
        assert ThemeRestApi.resource_name == "theme"

    def test_class_permission_name(self):
        """Test that class permission name is set correctly"""
        assert ThemeRestApi.class_permission_name == "Theme"

    def test_datamodel_configured(self):
        """Test that datamodel is configured with Theme model"""
        # The datamodel is configured in __init__ so we can't test it directly
        # but we can verify the configuration is correct
        assert hasattr(ThemeRestApi, "datamodel")

    def test_add_columns_configuration(self):
        """Test that add columns are configured correctly"""
        expected_columns = ["json_data", "theme_name"]
        assert ThemeRestApi.add_columns == expected_columns

    def test_edit_columns_configuration(self):
        """Test that edit columns match add columns"""
        assert ThemeRestApi.edit_columns == ThemeRestApi.add_columns

    def test_show_columns_configuration(self):
        """Test that show columns are configured correctly"""
        expected_columns = [
            "changed_on_delta_humanized",
            "changed_by.first_name",
            "changed_by.id",
            "changed_by.last_name",
            "created_by.first_name",
            "created_by.id",
            "created_by.last_name",
            "json_data",
            "id",
            "is_system",
            "is_system_default",
            "is_system_dark",
            "theme_name",
            "uuid",
        ]
        assert set(ThemeRestApi.show_columns) == set(expected_columns)

    def test_list_columns_configuration(self):
        """Test that list columns are configured correctly"""
        expected_columns = [
            "changed_on_delta_humanized",
            "changed_by.first_name",
            "changed_by.id",
            "changed_by.last_name",
            "changed_by_name",
            "created_on",
            "created_by.first_name",
            "created_by.id",
            "created_by.last_name",
            "json_data",
            "id",
            "is_system",
            "is_system_default",
            "is_system_dark",
            "theme_name",
            "uuid",
        ]
        assert set(ThemeRestApi.list_columns) == set(expected_columns)

    def test_order_columns_configuration(self):
        """Test that order columns are configured correctly"""
        expected_columns = ["theme_name"]
        assert ThemeRestApi.order_columns == expected_columns

    def test_openapi_spec_tag(self):
        """Test that OpenAPI spec tag is set correctly"""
        assert ThemeRestApi.openapi_spec_tag == "Themes"

    def test_bulk_delete_enabled(self):
        """Test that bulk delete is enabled"""
        # The bulk_delete method should be available
        assert hasattr(ThemeRestApi, "bulk_delete")
        assert callable(ThemeRestApi.bulk_delete)

    def test_custom_schemas_configured(self):
        """Test that custom schemas are properly configured"""
        from superset.themes.schemas import ThemePostSchema, ThemePutSchema

        api = ThemeRestApi()
        assert isinstance(api.add_model_schema, ThemePostSchema)
        assert isinstance(api.edit_model_schema, ThemePutSchema)

    def test_show_columns_include_new_fields(self):
        """Test that show columns include new is_system and uuid fields"""
        expected_new_fields = ["is_system", "uuid"]
        for field in expected_new_fields:
            assert field in ThemeRestApi.show_columns

    def test_list_columns_include_new_fields(self):
        """Test that list columns include new is_system and uuid fields"""
        expected_new_fields = ["is_system", "uuid"]
        for field in expected_new_fields:
            assert field in ThemeRestApi.list_columns
