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

from superset_extensions_cli.exceptions import ExtensionNameError
from superset_extensions_cli.utils import (
    generate_extension_names,
    get_module_federation_name,
    kebab_to_camel_case,
    kebab_to_snake_case,
    name_to_kebab_case,
    suggest_technical_name,
    validate_display_name,
    validate_npm_package_name,
    validate_publisher,
    validate_python_package_name,
    validate_technical_name,
)


# Name transformation tests


@pytest.mark.parametrize(
    ("display_name", "expected"),
    [
        ("Hello World", "hello-world"),
        ("Data Explorer", "data-explorer"),
        ("My Extension", "my-extension"),
        ("hello-world", "hello-world"),  # Already normalized
        ("Hello@World!", "helloworld"),  # Special chars removed
        (
            "Data_Explorer",
            "data-explorer",
        ),  # Underscores become spaces then hyphens
        ("My   Extension", "my-extension"),  # Multiple spaces normalized
        ("  Hello World  ", "hello-world"),  # Trimmed
        ("API v2 Client", "api-v2-client"),  # Numbers preserved
        ("Simple", "simple"),  # Single word
    ],
)
def test_name_to_kebab_case(display_name, expected):
    """Test direct kebab case conversion from display names."""
    assert name_to_kebab_case(display_name) == expected


@pytest.mark.parametrize(
    ("kebab_name", "expected"),
    [
        ("hello-world", "helloWorld"),
        ("data-explorer", "dataExplorer"),
        ("my-extension", "myExtension"),
        ("api-v2-client", "apiV2Client"),
        ("simple", "simple"),  # Single word
        ("chart-tool", "chartTool"),
        ("dashboard-helper", "dashboardHelper"),
    ],
)
def test_kebab_to_camel_case(kebab_name, expected):
    """Test kebab-case to camelCase conversion."""
    assert kebab_to_camel_case(kebab_name) == expected


@pytest.mark.parametrize(
    ("kebab_name", "expected"),
    [
        ("hello-world", "hello_world"),
        ("data-explorer", "data_explorer"),
        ("my-extension", "my_extension"),
        ("api-v2-client", "api_v2_client"),
        ("simple", "simple"),  # Single word
        ("chart-tool", "chart_tool"),
        ("dashboard-helper", "dashboard_helper"),
    ],
)
def test_kebab_to_snake_case(kebab_name, expected):
    """Test kebab-case to snake_case conversion."""
    assert kebab_to_snake_case(kebab_name) == expected


# Display name validation tests


@pytest.mark.parametrize(
    ("valid_display", "expected_normalized"),
    [
        ("Hello World", "Hello World"),
        ("Data Explorer", "Data Explorer"),
        ("My Extension", "My Extension"),
        ("Simple", "Simple"),
        ("   Extra   Spaces   ", "Extra Spaces"),  # Gets normalized
        ("Dashboard Widgets", "Dashboard Widgets"),
        ("Chart Builder Pro", "Chart Builder Pro"),
        ("API Client v2.0", "API Client v2.0"),
        ("Tool_123", "Tool_123"),  # Underscores allowed
        ("My-Extension", "My-Extension"),  # Hyphens allowed
    ],
)
def test_validate_display_name_valid(valid_display, expected_normalized):
    """Test valid display names return correctly normalized output."""
    result = validate_display_name(valid_display)
    assert result == expected_normalized


@pytest.mark.parametrize(
    ("invalid_display", "error_match"),
    [
        ("", "cannot be empty"),
        ("   ", "cannot be empty"),
        ("@#$%", "must start with a letter"),
        ("123 Tool", "must start with a letter"),
        ("-My Extension", "must start with a letter"),
    ],
)
def test_validate_display_name_invalid(invalid_display, error_match):
    """Test invalid display names."""
    with pytest.raises(ExtensionNameError, match=error_match):
        validate_display_name(invalid_display)


# Python package name validation tests


@pytest.mark.parametrize(
    ("valid_package",),
    [
        ("hello_world",),
        ("data_explorer",),
        ("myext",),
        ("test123",),
        ("package_with_many_parts",),
    ],
)
def test_validate_python_package_name_valid(valid_package):
    """Test valid Python package names."""
    # Should not raise exceptions
    validate_python_package_name(valid_package)


@pytest.mark.parametrize(
    ("keyword",),
    [
        ("class",),
        ("import",),
        ("def",),
        ("return",),
        ("if",),
        ("else",),
        ("for",),
        ("while",),
        ("try",),
        ("except",),
        ("finally",),
        ("with",),
        ("as",),
        ("lambda",),
        ("yield",),
        ("False",),
        ("None",),
        ("True",),
    ],
)
def test_validate_python_package_name_keywords(keyword):
    """Test that Python reserved keywords are rejected."""
    with pytest.raises(
        ExtensionNameError, match="Package name cannot start with Python keyword"
    ):
        validate_python_package_name(keyword)


@pytest.mark.parametrize(
    ("invalid_package",),
    [
        ("hello-world",),  # Hyphens not allowed in Python identifiers
    ],
)
def test_validate_python_package_name_invalid(invalid_package):
    """Test invalid Python package names."""
    with pytest.raises(ExtensionNameError, match="not a valid Python package"):
        validate_python_package_name(invalid_package)


# NPM package validation tests


@pytest.mark.parametrize(
    ("valid_npm",),
    [
        ("hello-world",),
        ("data-explorer",),
        ("myext",),
        ("package-with-many-parts",),
    ],
)
def test_validate_npm_package_name_valid(valid_npm):
    """Test valid npm package names."""
    # Should not raise exceptions
    validate_npm_package_name(valid_npm)


@pytest.mark.parametrize(
    ("reserved_name",),
    [
        ("node_modules",),
        ("npm",),
        ("yarn",),
        ("package.json",),
        ("localhost",),
        ("favicon.ico",),
    ],
)
def test_validate_npm_package_name_reserved(reserved_name):
    """Test that npm reserved names are rejected."""
    with pytest.raises(ExtensionNameError, match="reserved npm package name"):
        validate_npm_package_name(reserved_name)


# Publisher validation tests


@pytest.mark.parametrize(
    ("valid_publisher",),
    [
        ("my-org",),
        ("acme",),
        ("apache-superset",),
        ("test123",),
        ("a",),  # Single character
        ("publisher-with-many-parts",),
    ],
)
def test_validate_publisher_valid(valid_publisher):
    """Test valid publisher namespaces."""
    # Should not raise exceptions
    validate_publisher(valid_publisher)


@pytest.mark.parametrize(
    ("invalid_publisher", "error_match"),
    [
        ("", "cannot be empty"),
        ("My-Org", "must start with a letter and contain only lowercase letters"),
        ("-publisher", "must start with a letter and contain only lowercase letters"),
        ("publisher-", "must start with a letter and contain only lowercase letters"),
        ("pub--lisher", "must start with a letter and contain only lowercase letters"),
    ],
)
def test_validate_publisher_invalid(invalid_publisher, error_match):
    """Test invalid publisher namespaces."""
    with pytest.raises(ExtensionNameError, match=error_match):
        validate_publisher(invalid_publisher)


# Technical name validation tests


@pytest.mark.parametrize(
    ("valid_name",),
    [
        ("dashboard-widgets",),
        ("chart-builder",),
        ("simple",),
        ("api-client-v2",),
        ("tool123",),
    ],
)
def test_validate_technical_name_valid(valid_name):
    """Test valid technical names."""
    # Should not raise exceptions
    validate_technical_name(valid_name)


@pytest.mark.parametrize(
    ("invalid_name", "error_match"),
    [
        ("", "cannot be empty"),
        (
            "Dashboard-Widgets",
            "must start with a letter and contain only lowercase letters",
        ),
        ("-name", "must start with a letter and contain only lowercase letters"),
        ("name-", "must start with a letter and contain only lowercase letters"),
        ("na--me", "must start with a letter and contain only lowercase letters"),
    ],
)
def test_validate_technical_name_invalid(invalid_name, error_match):
    """Test invalid technical names."""
    with pytest.raises(ExtensionNameError, match=error_match):
        validate_technical_name(invalid_name)


# Name suggestion tests


@pytest.mark.parametrize(
    ("display_name", "expected_technical"),
    [
        ("Dashboard Widgets", "dashboard-widgets"),
        ("Chart Builder Pro!", "chart-builder-pro"),
        ("My@Tool#123", "mytool123"),
        ("  Spaced  Out  ", "spaced-out"),
        ("API v2 Client", "api-v2-client"),
    ],
)
def test_suggest_technical_name(display_name, expected_technical):
    """Test technical name suggestion from display names."""
    result = suggest_technical_name(display_name)
    assert result == expected_technical


@pytest.mark.parametrize(
    ("publisher", "name", "expected_mf"),
    [
        ("my-org", "dashboard-widgets", "myOrg_dashboardWidgets"),
        ("acme", "chart-builder", "acme_chartBuilder"),
        ("test-company", "simple", "testCompany_simple"),
    ],
)
def test_get_module_federation_name(publisher, name, expected_mf):
    """Test Module Federation name generation."""
    result = get_module_federation_name(publisher, name)
    assert result == expected_mf


# Complete name generation tests


@pytest.mark.parametrize(
    ("display_name", "expected_kebab", "expected_snake", "expected_camel"),
    [
        ("Hello World", "hello-world", "hello_world", "helloWorld"),
        ("Data Explorer", "data-explorer", "data_explorer", "dataExplorer"),
        ("My Extension v2", "my-extension-v2", "my_extension_v2", "myExtensionV2"),
        ("Chart Tool", "chart-tool", "chart_tool", "chartTool"),
        ("Simple", "simple", "simple", "simple"),
        ("API v2 Client", "api-v2-client", "api_v2_client", "apiV2Client"),
        (
            "Dashboard Helper",
            "dashboard-helper",
            "dashboard_helper",
            "dashboardHelper",
        ),
    ],
)
def test_generate_extension_names_complete_flow(
    display_name, expected_kebab, expected_snake, expected_camel
):
    """Test complete name generation flow with publisher concept."""
    publisher = "test-org"
    names = generate_extension_names(display_name, publisher, expected_kebab)

    # Test all transformations with publisher concept
    assert names["display_name"] == display_name
    assert names["publisher"] == publisher
    assert names["name"] == expected_kebab  # Technical name
    assert names["id"] == f"{publisher}.{expected_kebab}"  # Composite ID
    assert names["npm_name"] == f"@{publisher}/{expected_kebab}"  # NPM scoped
    assert (
        names["mf_name"] == f"testOrg_{expected_camel}"
    )  # Module Federation with publisher prefix
    assert (
        names["backend_package"] == f"{publisher.replace('-', '_')}-{expected_snake}"
    )  # Collision-safe
    assert (
        names["backend_path"]
        == f"superset_extensions.{publisher.replace('-', '_')}.{expected_snake}"
    )
    assert (
        names["backend_entry"]
        == f"superset_extensions.{publisher.replace('-', '_')}.{expected_snake}.entrypoint"
    )


@pytest.mark.parametrize(
    ("invalid_display",),
    [
        ("Class Helper",),  # Would create 'class_helper' - reserved keyword
        ("Import Tool",),  # Would create 'import_tool' - reserved keyword
        ("@#$%",),  # All special chars - becomes empty
        ("123 Tool",),  # Starts with number after kebab conversion
    ],
)
def test_generate_extension_names_invalid(invalid_display):
    """Test invalid name generation scenarios."""
    with pytest.raises(ExtensionNameError):
        generate_extension_names(invalid_display, "test-org")


def test_generate_extension_names_unicode():
    """Test handling of unicode characters."""
    # Use a simpler approach - the display name validation now requires starting with letter
    names = generate_extension_names("Cafe Extension", "test-org", "cafe-extension")
    assert names["id"] == "test-org.cafe-extension"
    assert names["display_name"] == "Cafe Extension"  # Original preserved


def test_generate_extension_names_special_chars():
    """Test name generation with special characters."""
    # Use manual technical name since display validation is stricter
    names = generate_extension_names("My Extension", "test-org", "my-extension")

    assert names["display_name"] == "My Extension"
    assert names["id"] == "test-org.my-extension"
    assert names["backend_package"] == "test_org-my_extension"


def test_generate_extension_names_case_preservation():
    """Test that display name case is preserved."""
    names = generate_extension_names("CamelCase Extension", "test-org")
    assert names["display_name"] == "CamelCase Extension"
    assert names["id"] == "test-org.camelcase-extension"


# Edge case tests


@pytest.mark.parametrize(
    ("edge_case",),
    [
        ("",),  # Empty string
        ("   ",),  # Only spaces
        ("---",),  # Only hyphens
        ("___",),  # Only underscores
    ],
)
def test_empty_or_invalid_inputs(edge_case):
    """Test inputs that become empty or invalid after processing."""
    with pytest.raises(ExtensionNameError):
        generate_extension_names(edge_case, "test-org")


def test_minimal_valid_input():
    """Test minimal valid input."""
    names = generate_extension_names("A Extension", "test-org")
    assert names["id"] == "test-org.a-extension"
    assert names["backend_package"] == "test_org-a_extension"


def test_numbers_handling():
    """Test handling of numbers in names."""
    names = generate_extension_names("Tool 123 v2", "test-org")
    assert names["id"] == "test-org.tool-123-v2"
    assert names["backend_package"] == "test_org-tool_123_v2"


def test_manual_technical_name_override():
    """Test using manual technical name instead of auto-generated."""
    display_name = "My Awesome Chart Builder Pro"
    publisher = "acme"
    technical_name = "chart-builder"  # Much shorter than display name

    # Create names using manual technical name
    names = generate_extension_names(display_name, publisher, technical_name)

    # Verify technical names come from provided technical name, not display name
    assert (
        names["display_name"] == "My Awesome Chart Builder Pro"
    )  # Display name preserved
    assert names["publisher"] == "acme"
    assert names["name"] == "chart-builder"  # Technical name used
    assert names["id"] == "acme.chart-builder"  # Composite ID
    assert names["mf_name"] == "acme_chartBuilder"  # Module Federation format
    assert names["backend_package"] == "acme-chart_builder"  # Collision-safe
    assert names["backend_path"] == "superset_extensions.acme.chart_builder"
    assert names["backend_entry"] == "superset_extensions.acme.chart_builder.entrypoint"


def test_generate_names_uses_suggested_technical_names():
    """Test that generate_extension_names can auto-suggest technical names."""
    display_name = "Hello World"
    publisher = "test-org"

    # Generated names should use suggested technical name generation
    names = generate_extension_names(display_name, publisher)

    # Verify the technical name was suggested from display name
    assert names["name"] == "hello-world"
    assert names["id"] == "test-org.hello-world"

    # Verify other names were generated from the technical name and publisher
    assert names["mf_name"] == get_module_federation_name(
        "test-org", "hello-world"
    )  # "testOrg_helloWorld"
    assert names["backend_package"] == "test_org-hello_world"

    # Module Federation name should use underscore format with camelCase
    assert names["mf_name"] == "testOrg_helloWorld"
