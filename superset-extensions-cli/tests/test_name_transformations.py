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
    kebab_to_camel_case,
    kebab_to_snake_case,
    name_to_kebab_case,
    to_snake_case,  # Keep this for backward compatibility testing only
    validate_extension_name,
    validate_extension_id,
    validate_npm_package_name,
    validate_python_package_name,
)


class TestNameTransformations:
    """Test name transformation functions."""

    @pytest.mark.parametrize(
        "display_name,expected",
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
    def test_name_to_kebab_case(self, display_name, expected):
        """Test direct kebab case conversion from display names."""
        assert name_to_kebab_case(display_name) == expected

    @pytest.mark.parametrize(
        "kebab_name,expected",
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
    def test_kebab_to_camel_case(self, kebab_name, expected):
        """Test kebab-case to camelCase conversion."""
        assert kebab_to_camel_case(kebab_name) == expected

    @pytest.mark.parametrize(
        "kebab_name,expected",
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
    def test_kebab_to_snake_case(self, kebab_name, expected):
        """Test kebab-case to snake_case conversion."""
        assert kebab_to_snake_case(kebab_name) == expected

    # Backward compatibility test for remaining legacy function
    @pytest.mark.parametrize(
        "input_name,expected",
        [
            ("hello-world", "hello_world"),
            ("data-explorer", "data_explorer"),
            ("my-extension-name", "my_extension_name"),
        ],
    )
    def test_to_snake_case_legacy(self, input_name, expected):
        """Test legacy kebab-to-snake conversion function."""
        assert to_snake_case(input_name) == expected


class TestValidation:
    """Test validation functions."""

    @pytest.mark.parametrize(
        "valid_display",
        [
            "Hello World",
            "Data Explorer",
            "My Extension",
            "Simple",
            "   Extra   Spaces   ",  # Gets normalized
        ],
    )
    def test_validate_extension_name_valid(self, valid_display):
        """Test valid display names."""
        result = validate_extension_name(valid_display)
        assert result  # Should return normalized name
        assert "  " not in result  # No double spaces

    @pytest.mark.parametrize(
        "invalid_display,error_match",
        [
            ("", "cannot be empty"),
            ("   ", "cannot be empty"),
            ("@#$%", "must contain at least one letter or number"),
        ],
    )
    def test_validate_extension_name_invalid(self, invalid_display, error_match):
        """Test invalid extension names."""
        with pytest.raises(ExtensionNameError, match=error_match):
            validate_extension_name(invalid_display)

    @pytest.mark.parametrize(
        "valid_id",
        [
            "hello-world",
            "data-explorer",
            "myext",
            "chart123",
            "my-tool-v2",
            "a",  # Single character
            "extension-with-many-parts",
        ],
    )
    def test_validate_extension_id_valid(self, valid_id):
        """Test valid extension IDs."""
        # Should not raise exceptions
        validate_extension_id(valid_id)

    @pytest.mark.parametrize(
        "invalid_id,error_match",
        [
            ("", "cannot be empty"),
            ("Hello-World", "Use lowercase"),
            ("-hello", "cannot start with hyphens"),
            ("hello-", "cannot end with hyphens"),
            ("hello--world", "consecutive hyphens"),
        ],
    )
    def test_validate_extension_id_invalid(self, invalid_id, error_match):
        """Test invalid extension IDs."""
        with pytest.raises(ExtensionNameError, match=error_match):
            validate_extension_id(invalid_id)

    @pytest.mark.parametrize(
        "valid_package",
        [
            "hello_world",
            "data_explorer",
            "myext",
            "test123",
            "package_with_many_parts",
        ],
    )
    def test_validate_python_package_name_valid(self, valid_package):
        """Test valid Python package names."""
        # Should not raise exceptions
        validate_python_package_name(valid_package)

    @pytest.mark.parametrize(
        "keyword",
        [
            "class",
            "import",
            "def",
            "return",
            "if",
            "else",
            "for",
            "while",
            "try",
            "except",
            "finally",
            "with",
            "as",
            "lambda",
            "yield",
            "False",
            "None",
            "True",
        ],
    )
    def test_validate_python_package_name_keywords(self, keyword):
        """Test that Python reserved keywords are rejected."""
        with pytest.raises(
            ExtensionNameError, match="Package name cannot start with Python keyword"
        ):
            validate_python_package_name(keyword)

    @pytest.mark.parametrize(
        "invalid_package",
        [
            "hello-world",  # Hyphens not allowed in Python identifiers
        ],
    )
    def test_validate_python_package_name_invalid(self, invalid_package):
        """Test invalid Python package names."""
        with pytest.raises(ExtensionNameError, match="not a valid Python package"):
            validate_python_package_name(invalid_package)

    @pytest.mark.parametrize(
        "valid_npm",
        [
            "hello-world",
            "data-explorer",
            "myext",
            "package-with-many-parts",
        ],
    )
    def test_validate_npm_package_name_valid(self, valid_npm):
        """Test valid npm package names."""
        # Should not raise exceptions
        validate_npm_package_name(valid_npm)

    @pytest.mark.parametrize(
        "reserved_name",
        ["node_modules", "npm", "yarn", "package.json", "localhost", "favicon.ico"],
    )
    def test_validate_npm_package_name_reserved(self, reserved_name):
        """Test that npm reserved names are rejected."""
        with pytest.raises(ExtensionNameError, match="reserved npm package name"):
            validate_npm_package_name(reserved_name)


class TestNameGeneration:
    """Test complete name generation."""

    @pytest.mark.parametrize(
        "display_name,expected_kebab,expected_snake,expected_camel",
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
        self, display_name, expected_kebab, expected_snake, expected_camel
    ):
        """Test complete name generation flow from display name to all variants."""
        names = generate_extension_names(display_name)

        # Test all transformations from single source
        assert names["name"] == display_name
        assert names["id"] == expected_kebab  # Extension ID (kebab-case)
        assert names["mf_name"] == expected_camel  # Module Federation (camelCase)
        assert names["backend_name"] == expected_snake  # Python package (snake_case)
        assert names["backend_package"] == f"superset_extensions.{expected_snake}"
        assert (
            names["backend_entry"] == f"superset_extensions.{expected_snake}.entrypoint"
        )

    @pytest.mark.parametrize(
        "invalid_display",
        [
            "Class Helper",  # Would create 'class_helper' - reserved keyword
            "Import Tool",  # Would create 'import_tool' - reserved keyword
            "@#$%",  # All special chars - becomes empty
            "123 Tool",  # Starts with number after kebab conversion
        ],
    )
    def test_generate_extension_names_invalid(self, invalid_display):
        """Test invalid name generation scenarios."""
        with pytest.raises(ExtensionNameError):
            generate_extension_names(invalid_display)

    def test_generate_extension_names_unicode(self):
        """Test handling of unicode characters."""
        names = generate_extension_names("Café Extension")
        assert "é" not in names["id"]
        assert names["id"] == "caf-extension"
        assert names["name"] == "Café Extension"  # Original preserved

    def test_generate_extension_names_special_chars(self):
        """Test name generation with special characters."""
        names = generate_extension_names("My@Extension!")

        assert names["name"] == "My@Extension!"
        assert names["id"] == "myextension"
        assert names["backend_name"] == "myextension"

    def test_generate_extension_names_case_preservation(self):
        """Test that display name case is preserved."""
        names = generate_extension_names("CamelCase Extension")
        assert names["name"] == "CamelCase Extension"
        assert names["id"] == "camelcase-extension"


class TestEdgeCases:
    """Test edge cases and boundary conditions."""

    @pytest.mark.parametrize(
        "edge_case",
        [
            "",  # Empty string
            "   ",  # Only spaces
            "---",  # Only hyphens
            "___",  # Only underscores
        ],
    )
    def test_empty_or_invalid_inputs(self, edge_case):
        """Test inputs that become empty or invalid after processing."""
        with pytest.raises(ExtensionNameError):
            generate_extension_names(edge_case)

    def test_minimal_valid_input(self):
        """Test minimal valid input."""
        names = generate_extension_names("A Extension")
        assert names["id"] == "a-extension"
        assert names["backend_name"] == "a_extension"

    def test_numbers_handling(self):
        """Test handling of numbers in names."""
        names = generate_extension_names("Tool 123 v2")
        assert names["id"] == "tool-123-v2"
        assert names["backend_name"] == "tool_123_v2"

    def test_id_based_name_generation(self):
        """Test that technical names are derived from ID, not display name."""
        # Simulate manual ExtensionNames construction with custom ID
        display_name = "My Awesome Chart Builder Pro"
        extension_id = "chart-builder"  # Much shorter than display name

        # Create names using ID-based generation (new behavior)
        from superset_extensions_cli.types import ExtensionNames

        names = ExtensionNames(
            name=display_name,
            id=extension_id,
            mf_name=kebab_to_camel_case(extension_id),  # From ID: "chartBuilder"
            backend_name=kebab_to_snake_case(extension_id),  # From ID: "chart_builder"
            backend_package=f"superset_extensions.{kebab_to_snake_case(extension_id)}",
            backend_entry=f"superset_extensions.{kebab_to_snake_case(extension_id)}.entrypoint",
        )

        # Verify technical names come from ID, not display name
        assert names["name"] == "My Awesome Chart Builder Pro"  # Display name preserved
        assert names["id"] == "chart-builder"  # Extension ID
        assert (
            names["mf_name"] == "chartBuilder"
        )  # From ID, not "myAwesomeChartBuilderPro"
        assert (
            names["backend_name"] == "chart_builder"
        )  # From ID, not "my_awesome_chart_builder_pro"
        assert names["backend_package"] == "superset_extensions.chart_builder"
        assert names["backend_entry"] == "superset_extensions.chart_builder.entrypoint"

    def test_generate_names_uses_id_based_technical_names(self):
        """Test that generate_extension_names uses ID-based generation for technical names."""
        display_name = "Hello World"

        # Generated names should use ID-based technical name generation
        names = generate_extension_names(display_name)

        # Verify the ID was generated from display name
        assert names["id"] == "hello-world"

        # Verify technical names were generated from the ID, not original display name
        assert names["mf_name"] == kebab_to_camel_case("hello-world")  # "helloWorld"
        assert names["backend_name"] == kebab_to_snake_case(
            "hello-world"
        )  # "hello_world"

        # For this simple case, the results are the same as before, but the path is different:
        # Old path: Display Name -> camelCase directly
        # New path: Display Name -> ID -> camelCase from ID
        assert names["mf_name"] == "helloWorld"
        assert names["backend_name"] == "hello_world"
