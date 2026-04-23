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


from superset.models.core import Theme


class TestThemeModel:
    """Unit tests for Theme model"""

    def test_theme_model_attributes(self):
        """Test that Theme model has correct attributes"""
        assert hasattr(Theme, "id")
        assert hasattr(Theme, "theme_name")
        assert hasattr(Theme, "json_data")
        assert hasattr(Theme, "uuid")  # from UUIDMixin
        assert hasattr(Theme, "created_by_fk")  # from AuditMixinNullable
        assert hasattr(Theme, "changed_by_fk")  # from AuditMixinNullable
        assert hasattr(Theme, "created_on")  # from AuditMixinNullable
        assert hasattr(Theme, "changed_on")  # from AuditMixinNullable

    def test_theme_model_tablename(self):
        """Test that Theme model has correct table name"""
        assert Theme.__tablename__ == "themes"

    def test_theme_model_docstring(self):
        """Test that Theme model has correct docstring"""
        assert Theme.__doc__ == "Themes for dashboards"

    def test_theme_model_inheritance(self):
        """Test that Theme model inherits from correct mixins"""
        from flask_appbuilder import Model

        from superset.models.helpers import AuditMixinNullable, UUIDMixin

        # Check that Theme inherits from the expected classes
        assert issubclass(Theme, AuditMixinNullable)
        assert issubclass(Theme, UUIDMixin)
        assert issubclass(Theme, Model)
