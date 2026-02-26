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

"""Tests for REST API decorators in BUILD mode."""

from superset_core.api.rest_api import extension_api, RestApi
from superset_core.extensions.context import get_context, RegistrationMode


def test_extension_api_decorator_stores_metadata():
    """Test that @extension_api decorator stores metadata."""
    ctx = get_context()
    ctx.set_mode(RegistrationMode.BUILD)

    try:

        @extension_api(id="test_api", name="Test API")
        class TestAPI(RestApi):
            """Test API class."""

            pass

        # Should have metadata attached
        assert hasattr(TestAPI, "__rest_api_metadata__")
        meta = TestAPI.__rest_api_metadata__
        assert meta.id == "test_api"
        assert meta.name == "Test API"
        assert meta.description == "Test API class."
        assert meta.base_path == "/test_api"
        assert "TestAPI" in meta.module

    finally:
        ctx.set_mode(RegistrationMode.HOST)


def test_extension_api_decorator_with_custom_metadata():
    """Test @extension_api decorator with custom metadata."""
    ctx = get_context()
    ctx.set_mode(RegistrationMode.BUILD)

    try:

        @extension_api(
            id="custom_api",
            name="Custom API",
            description="Custom description",
            base_path="/custom/path",
        )
        class CustomAPI(RestApi):
            """Original docstring."""

            pass

        meta = CustomAPI.__rest_api_metadata__
        assert meta.id == "custom_api"
        assert meta.name == "Custom API"
        assert meta.description == "Custom description"
        assert meta.base_path == "/custom/path"

    finally:
        ctx.set_mode(RegistrationMode.HOST)


def test_extension_api_decorator_auto_infers_flask_fields():
    """Test that @extension_api auto-infers Flask-AppBuilder fields."""
    ctx = get_context()
    ctx.set_mode(RegistrationMode.BUILD)

    try:

        @extension_api(id="infer_api", name="Infer API")
        class InferAPI(RestApi):
            """Test auto-inference."""

            pass

        meta = InferAPI.__rest_api_metadata__
        # Check auto-inferred fields
        assert meta.resource_name == "infer_api"
        assert meta.openapi_spec_tag == "Infer API"
        assert meta.class_permission_name == "infer_api"

    finally:
        ctx.set_mode(RegistrationMode.HOST)


def test_extension_api_decorator_custom_flask_fields():
    """Test @extension_api with custom Flask-AppBuilder fields."""
    ctx = get_context()
    ctx.set_mode(RegistrationMode.BUILD)

    try:

        @extension_api(
            id="custom_flask_api",
            name="Custom Flask API",
            resource_name="custom_resource",
            openapi_spec_tag="Custom Tag",
            class_permission_name="custom_permission",
        )
        class CustomFlaskAPI(RestApi):
            """Custom Flask fields."""

            pass

        meta = CustomFlaskAPI.__rest_api_metadata__
        assert meta.resource_name == "custom_resource"
        assert meta.openapi_spec_tag == "Custom Tag"
        assert meta.class_permission_name == "custom_permission"

    finally:
        ctx.set_mode(RegistrationMode.HOST)


def test_extension_api_decorator_does_not_register_in_build_mode():
    """Test that @extension_api doesn't attempt registration in BUILD mode."""
    ctx = get_context()
    ctx.set_mode(RegistrationMode.BUILD)

    try:
        # This should not raise an exception even though no registration mechanism
        # is available
        @extension_api(id="build_api", name="Build API")
        class BuildAPI(RestApi):
            """Build mode API."""

            pass

        # Should have metadata
        assert hasattr(BuildAPI, "__rest_api_metadata__")

    finally:
        ctx.set_mode(RegistrationMode.HOST)
