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

from __future__ import annotations

from pathlib import Path

import pytest
from superset_extensions_cli.cli import app

from tests.utils import (
    assert_directory_exists,
    assert_directory_structure,
    assert_file_exists,
    assert_file_structure,
    assert_json_content,
    create_test_extension_structure,
    load_json_file,
)


# Init Command Tests
@pytest.mark.cli
def test_init_creates_extension_with_both_frontend_and_backend(
    cli_runner, isolated_filesystem, cli_input_both
):
    """Test that init creates a complete extension with both frontend and backend."""
    result = cli_runner.invoke(app, ["init"], input=cli_input_both)

    assert result.exit_code == 0, f"Command failed with output: {result.output}"
    assert (
        "🎉 Extension Test Extension (ID: test-extension) initialized" in result.output
    )

    # Verify directory structure
    extension_path = isolated_filesystem / "test-extension"
    assert_directory_exists(extension_path, "main extension directory")

    expected_structure = create_test_extension_structure(
        isolated_filesystem,
        "test-extension",
        include_frontend=True,
        include_backend=True,
    )

    # Check directories
    assert_directory_structure(extension_path, expected_structure["expected_dirs"])

    # Check files
    assert_file_structure(extension_path, expected_structure["expected_files"])


@pytest.mark.cli
def test_init_creates_extension_with_frontend_only(
    cli_runner, isolated_filesystem, cli_input_frontend_only
):
    """Test that init creates extension with only frontend components."""
    result = cli_runner.invoke(app, ["init"], input=cli_input_frontend_only)

    assert result.exit_code == 0, f"Command failed with output: {result.output}"

    extension_path = isolated_filesystem / "test-extension"
    assert_directory_exists(extension_path)

    # Should have frontend directory and package.json
    assert_directory_exists(extension_path / "frontend")
    assert_file_exists(extension_path / "frontend" / "package.json")

    # Should NOT have backend directory
    backend_path = extension_path / "backend"
    assert not backend_path.exists(), (
        "Backend directory should not exist for frontend-only extension"
    )


@pytest.mark.cli
def test_init_creates_extension_with_backend_only(
    cli_runner, isolated_filesystem, cli_input_backend_only
):
    """Test that init creates extension with only backend components."""
    result = cli_runner.invoke(app, ["init"], input=cli_input_backend_only)

    assert result.exit_code == 0, f"Command failed with output: {result.output}"

    extension_path = isolated_filesystem / "test-extension"
    assert_directory_exists(extension_path)

    # Should have backend directory and pyproject.toml
    assert_directory_exists(extension_path / "backend")
    assert_file_exists(extension_path / "backend" / "pyproject.toml")

    # Should NOT have frontend directory
    frontend_path = extension_path / "frontend"
    assert not frontend_path.exists(), (
        "Frontend directory should not exist for backend-only extension"
    )


@pytest.mark.cli
def test_init_creates_extension_with_neither_frontend_nor_backend(
    cli_runner, isolated_filesystem, cli_input_neither
):
    """Test that init creates minimal extension with neither frontend nor backend."""
    result = cli_runner.invoke(app, ["init"], input=cli_input_neither)

    assert result.exit_code == 0, f"Command failed with output: {result.output}"

    extension_path = isolated_filesystem / "test-extension"
    assert_directory_exists(extension_path)

    # Should only have extension.json
    assert_file_exists(extension_path / "extension.json")

    # Should NOT have frontend or backend directories
    assert not (extension_path / "frontend").exists()
    assert not (extension_path / "backend").exists()


@pytest.mark.cli
def test_init_accepts_any_display_name(cli_runner, isolated_filesystem):
    """Test that init accepts any display name and generates proper ID."""
    cli_input = "My Awesome Extension!\n\n0.1.0\nApache-2.0\ny\ny\n"
    result = cli_runner.invoke(app, ["init"], input=cli_input)

    assert result.exit_code == 0, f"Should accept display name: {result.output}"
    assert Path("my-awesome-extension").exists(), (
        "Directory for generated ID should be created"
    )


@pytest.mark.cli
def test_init_accepts_mixed_alphanumeric_name(cli_runner, isolated_filesystem):
    """Test that init accepts mixed alphanumeric display names."""
    cli_input = "Tool 123\n\n0.1.0\nApache-2.0\ny\ny\n"
    result = cli_runner.invoke(app, ["init"], input=cli_input)

    assert result.exit_code == 0, (
        f"Mixed alphanumeric display name should be valid: {result.output}"
    )
    assert Path("tool-123").exists(), "Directory for 'tool-123' should be created"


@pytest.mark.cli
@pytest.mark.parametrize(
    "display_name,expected_id",
    [
        ("Test Extension", "test-extension"),
        ("My Tool v2", "my-tool-v2"),
        ("Dashboard Helper", "dashboard-helper"),
        ("Chart Builder Pro", "chart-builder-pro"),
    ],
)
def test_init_with_various_display_names(cli_runner, display_name, expected_id):
    """Test that init accepts various display names and generates proper IDs."""
    with cli_runner.isolated_filesystem():
        cli_input = f"{display_name}\n\n0.1.0\nApache-2.0\ny\ny\n"
        result = cli_runner.invoke(app, ["init"], input=cli_input)

        assert result.exit_code == 0, (
            f"Valid display name '{display_name}' was rejected: {result.output}"
        )
        assert Path(expected_id).exists(), (
            f"Directory for '{expected_id}' was not created"
        )


@pytest.mark.cli
def test_init_fails_when_directory_already_exists(
    cli_runner, isolated_filesystem, cli_input_both
):
    """Test that init fails gracefully when target directory already exists."""
    # Create the directory first
    existing_dir = isolated_filesystem / "test-extension"
    existing_dir.mkdir()

    result = cli_runner.invoke(app, ["init"], input=cli_input_both)

    assert result.exit_code == 1, "Command should fail when directory already exists"
    assert "already exists" in result.output


@pytest.mark.cli
def test_extension_json_content_is_correct(
    cli_runner, isolated_filesystem, cli_input_both
):
    """Test that the generated extension.json has the correct content."""
    result = cli_runner.invoke(app, ["init"], input=cli_input_both)
    assert result.exit_code == 0

    extension_path = isolated_filesystem / "test-extension"
    extension_json_path = extension_path / "extension.json"

    # Verify the JSON structure and values
    assert_json_content(
        extension_json_path,
        {
            "id": "test-extension",
            "name": "Test Extension",
            "version": "0.1.0",
            "license": "Apache-2.0",
            "permissions": [],
        },
    )

    # Load and verify more complex nested structures
    content = load_json_file(extension_json_path)

    # Verify frontend section exists and has correct structure
    assert "frontend" in content
    frontend = content["frontend"]
    assert "contributions" in frontend
    assert "moduleFederation" in frontend
    assert frontend["contributions"] == {"commands": [], "views": {}, "menus": {}}
    assert frontend["moduleFederation"] == {
        "exposes": ["./index"],
        "name": "testExtension",
    }

    # Verify backend section exists and has correct structure
    assert "backend" in content
    backend = content["backend"]
    assert "entryPoints" in backend
    assert "files" in backend
    assert backend["entryPoints"] == ["superset_extensions.test_extension.entrypoint"]
    assert backend["files"] == [
        "backend/src/superset_extensions/test_extension/**/*.py"
    ]


@pytest.mark.cli
def test_frontend_package_json_content_is_correct(
    cli_runner, isolated_filesystem, cli_input_both
):
    """Test that the generated frontend/package.json has the correct content."""
    result = cli_runner.invoke(app, ["init"], input=cli_input_both)
    assert result.exit_code == 0

    extension_path = isolated_filesystem / "test-extension"
    package_json_path = extension_path / "frontend" / "package.json"

    # Verify the package.json structure and values
    assert_json_content(
        package_json_path,
        {
            "name": "test-extension",
            "version": "0.1.0",
            "license": "Apache-2.0",
        },
    )

    # Verify more complex structures
    content = load_json_file(package_json_path)
    assert "scripts" in content
    assert "build" in content["scripts"]
    assert "peerDependencies" in content
    assert "@apache-superset/core" in content["peerDependencies"]


@pytest.mark.cli
def test_backend_pyproject_toml_is_created(
    cli_runner, isolated_filesystem, cli_input_both
):
    """Test that the generated backend/pyproject.toml file is created."""
    result = cli_runner.invoke(app, ["init"], input=cli_input_both)
    assert result.exit_code == 0

    extension_path = isolated_filesystem / "test-extension"
    pyproject_path = extension_path / "backend" / "pyproject.toml"

    assert_file_exists(pyproject_path, "backend pyproject.toml")

    # Basic content verification (without parsing TOML for now)
    content = pyproject_path.read_text()
    assert "superset_extensions.test_extension" in content
    assert "0.1.0" in content
    assert "Apache-2.0" in content


@pytest.mark.cli
def test_init_command_output_messages(cli_runner, isolated_filesystem, cli_input_both):
    """Test that init command produces expected output messages."""
    result = cli_runner.invoke(app, ["init"], input=cli_input_both)

    assert result.exit_code == 0
    output = result.output

    # Check for expected success messages
    assert "Created extension.json" in output
    assert "Created .gitignore" in output
    assert "Created frontend folder structure" in output
    assert "Created backend folder structure" in output
    assert "Extension Test Extension (ID: test-extension) initialized" in output


@pytest.mark.cli
def test_gitignore_content_is_correct(cli_runner, isolated_filesystem, cli_input_both):
    """Test that the generated .gitignore has the correct content."""
    result = cli_runner.invoke(app, ["init"], input=cli_input_both)
    assert result.exit_code == 0

    extension_path = isolated_filesystem / "test-extension"
    gitignore_path = extension_path / ".gitignore"

    assert_file_exists(gitignore_path, ".gitignore")

    content = gitignore_path.read_text()

    # Verify key patterns are present
    assert "node_modules/" in content
    assert "dist/" in content
    assert "*.supx" in content
    assert "__pycache__" in content
    assert ".venv/" in content
    assert ".DS_Store" in content
    assert ".env" in content


@pytest.mark.cli
def test_init_with_custom_version_and_license(cli_runner, isolated_filesystem):
    """Test init with custom version and license parameters."""
    cli_input = "My Extension\n\n2.1.0\nMIT\ny\nn\n"
    result = cli_runner.invoke(app, ["init"], input=cli_input)

    assert result.exit_code == 0

    extension_path = isolated_filesystem / "my-extension"
    extension_json_path = extension_path / "extension.json"

    assert_json_content(
        extension_json_path,
        {
            "id": "my-extension",
            "name": "My Extension",
            "version": "2.1.0",
            "license": "MIT",
        },
    )


@pytest.mark.integration
@pytest.mark.cli
def test_full_init_workflow_integration(cli_runner, isolated_filesystem):
    """Integration test for the complete init workflow."""
    # Test the complete flow with realistic user input
    cli_input = "Awesome Charts\n\n1.0.0\nApache-2.0\ny\ny\n"
    result = cli_runner.invoke(app, ["init"], input=cli_input)

    # Verify success
    assert result.exit_code == 0

    # Verify complete directory structure
    extension_path = isolated_filesystem / "awesome-charts"
    expected_structure = create_test_extension_structure(
        isolated_filesystem,
        "awesome-charts",
        include_frontend=True,
        include_backend=True,
    )

    # Comprehensive structure verification
    assert_directory_structure(extension_path, expected_structure["expected_dirs"])
    assert_file_structure(extension_path, expected_structure["expected_files"])

    # Verify all generated files have correct content
    extension_json = load_json_file(extension_path / "extension.json")
    assert extension_json["id"] == "awesome-charts"
    assert extension_json["name"] == "Awesome Charts"
    assert extension_json["version"] == "1.0.0"
    assert extension_json["license"] == "Apache-2.0"

    package_json = load_json_file(extension_path / "frontend" / "package.json")
    assert package_json["name"] == "awesome-charts"

    pyproject_content = (extension_path / "backend" / "pyproject.toml").read_text()
    assert "superset_extensions.awesome_charts" in pyproject_content


# Non-interactive mode tests
@pytest.mark.cli
def test_init_non_interactive_with_all_options(cli_runner, isolated_filesystem):
    """Test that init works in non-interactive mode with all CLI options."""
    result = cli_runner.invoke(
        app,
        [
            "init",
            "--id",
            "my-ext",
            "--name",
            "My Extension",
            "--version",
            "1.0.0",
            "--license",
            "MIT",
            "--frontend",
            "--backend",
        ],
    )

    assert result.exit_code == 0, f"Command failed with output: {result.output}"
    assert "🎉 Extension My Extension (ID: my-ext) initialized" in result.output

    extension_path = isolated_filesystem / "my-ext"
    assert_directory_exists(extension_path)
    assert_directory_exists(extension_path / "frontend")
    assert_directory_exists(extension_path / "backend")

    extension_json = load_json_file(extension_path / "extension.json")
    assert extension_json["id"] == "my-ext"
    assert extension_json["name"] == "My Extension"
    assert extension_json["version"] == "1.0.0"
    assert extension_json["license"] == "MIT"


@pytest.mark.cli
def test_init_frontend_only_with_cli_options(cli_runner, isolated_filesystem):
    """Test init with frontend only using CLI options."""
    result = cli_runner.invoke(
        app,
        [
            "init",
            "--id",
            "frontend-ext",
            "--name",
            "Frontend Extension",
            "--version",
            "1.0.0",
            "--license",
            "MIT",
            "--frontend",
            "--no-backend",
        ],
    )

    assert result.exit_code == 0, f"Command failed with output: {result.output}"

    extension_path = isolated_filesystem / "frontend-ext"
    assert_directory_exists(extension_path / "frontend")
    assert not (extension_path / "backend").exists()


@pytest.mark.cli
def test_init_backend_only_with_cli_options(cli_runner, isolated_filesystem):
    """Test init with backend only using CLI options."""
    result = cli_runner.invoke(
        app,
        [
            "init",
            "--id",
            "backend-ext",
            "--name",
            "Backend Extension",
            "--version",
            "1.0.0",
            "--license",
            "MIT",
            "--no-frontend",
            "--backend",
        ],
    )

    assert result.exit_code == 0, f"Command failed with output: {result.output}"

    extension_path = isolated_filesystem / "backend-ext"
    assert not (extension_path / "frontend").exists()
    assert_directory_exists(extension_path / "backend")


@pytest.mark.cli
def test_init_prompts_for_missing_options(cli_runner, isolated_filesystem):
    """Test that init prompts for options not provided via CLI and uses defaults."""
    # Provide id and name via CLI, but version/license will be prompted (accept defaults)
    result = cli_runner.invoke(
        app,
        [
            "init",
            "--id",
            "default-ext",
            "--name",
            "Default Extension",
            "--frontend",
            "--backend",
        ],
        input="\n\n",  # Accept defaults for version and license prompts
    )

    assert result.exit_code == 0, f"Command failed with output: {result.output}"

    extension_path = isolated_filesystem / "default-ext"
    extension_json = load_json_file(extension_path / "extension.json")
    assert extension_json["version"] == "0.1.0"
    assert extension_json["license"] == "Apache-2.0"


@pytest.mark.cli
def test_init_non_interactive_validates_id(cli_runner, isolated_filesystem):
    """Test that non-interactive mode validates extension ID."""
    result = cli_runner.invoke(
        app,
        [
            "init",
            "--id",
            "invalid_name",
            "--name",
            "Invalid Extension",
            "--frontend",
            "--backend",
        ],
    )

    assert result.exit_code == 1
    assert "Use lowercase letters, numbers, and hyphens only" in result.output
