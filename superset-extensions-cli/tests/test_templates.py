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

import json
from pathlib import Path

import pytest
from jinja2 import Environment, FileSystemLoader


@pytest.fixture
def templates_dir():
    """Get the templates directory path."""
    return (
        Path(__file__).parent.parent / "src" / "superset_extensions_cli" / "templates"
    )


@pytest.fixture
def jinja_env(templates_dir):
    """Create a Jinja2 environment for testing templates."""
    return Environment(loader=FileSystemLoader(templates_dir))


@pytest.fixture
def template_context():
    """Default template context for testing."""
    return {
        "id": "test_extension",
        "name": "Test Extension",
        "version": "0.1.0",
        "license": "Apache-2.0",
        "include_frontend": True,
        "include_backend": True,
    }


# Extension JSON Template Tests
@pytest.mark.unit
def test_extension_json_template_renders_with_both_frontend_and_backend(
    jinja_env, template_context
):
    """Test extension.json template renders correctly with both frontend and backend."""
    template = jinja_env.get_template("extension.json.j2")
    rendered = template.render(template_context)

    # Parse the rendered JSON to ensure it's valid
    parsed = json.loads(rendered)

    # Verify basic fields
    assert parsed["id"] == "test_extension"
    assert parsed["name"] == "Test Extension"
    assert parsed["version"] == "0.1.0"
    assert parsed["license"] == "Apache-2.0"
    assert parsed["permissions"] == []

    # Verify frontend section exists
    assert "frontend" in parsed
    frontend = parsed["frontend"]
    assert "contributions" in frontend
    assert "moduleFederation" in frontend
    assert frontend["contributions"] == {"commands": [], "views": [], "menus": []}
    assert frontend["moduleFederation"] == {"exposes": ["./index"]}

    # Verify backend section exists
    assert "backend" in parsed
    backend = parsed["backend"]
    assert backend["entryPoints"] == ["test_extension.entrypoint"]
    assert backend["files"] == ["backend/src/test_extension/**/*.py"]


@pytest.mark.unit
@pytest.mark.parametrize(
    "include_frontend,include_backend,expected_sections",
    [
        (True, False, ["frontend"]),
        (False, True, ["backend"]),
        (False, False, []),
    ],
)
def test_extension_json_template_renders_with_different_configurations(
    jinja_env, template_context, include_frontend, include_backend, expected_sections
):
    """Test extension.json template renders correctly with different configurations."""
    template_context["include_frontend"] = include_frontend
    template_context["include_backend"] = include_backend

    template = jinja_env.get_template("extension.json.j2")
    rendered = template.render(template_context)

    parsed = json.loads(rendered)

    # Check for expected sections
    for section in expected_sections:
        assert section in parsed, f"Expected section '{section}' not found"

    # Check that unexpected sections are not present
    all_sections = ["frontend", "backend"]
    for section in all_sections:
        if section not in expected_sections:
            assert section not in parsed, f"Unexpected section '{section}' found"


# Frontend Package JSON Template Tests
@pytest.mark.unit
def test_frontend_package_json_template_renders_correctly(jinja_env, template_context):
    """Test frontend/package.json template renders correctly."""
    template = jinja_env.get_template("frontend/package.json.j2")
    rendered = template.render(template_context)

    parsed = json.loads(rendered)

    # Verify basic package info
    assert parsed["name"] == "test_extension"
    assert parsed["version"] == "0.1.0"
    assert parsed["license"] == "Apache-2.0"
    assert parsed["private"] is True

    # Verify scripts section
    assert "scripts" in parsed
    scripts = parsed["scripts"]
    assert "start" in scripts
    assert "build" in scripts
    assert "webpack" in scripts["build"]

    # Verify dependencies
    assert "peerDependencies" in parsed
    peer_deps = parsed["peerDependencies"]
    assert "@apache-superset/core" in peer_deps
    assert "react" in peer_deps
    assert "react-dom" in peer_deps

    # Verify dev dependencies
    assert "devDependencies" in parsed
    dev_deps = parsed["devDependencies"]
    assert "webpack" in dev_deps
    assert "typescript" in dev_deps


# Backend Pyproject TOML Template Tests
@pytest.mark.unit
def test_backend_pyproject_toml_template_renders_correctly(jinja_env, template_context):
    """Test backend/pyproject.toml template renders correctly."""
    template = jinja_env.get_template("backend/pyproject.toml.j2")
    rendered = template.render(template_context)

    # Basic content verification (without full TOML parsing)
    assert "test_extension" in rendered
    assert "0.1.0" in rendered
    assert "Apache-2.0" in rendered


# Template Rendering with Different Parameters Tests
@pytest.mark.unit
@pytest.mark.parametrize(
    "id_,name",
    [
        ("simple_extension", "Simple Extension"),
        ("MyExtension123", "My Extension 123"),
        ("complex_extension_name_123", "Complex Extension Name 123"),
        ("ext", "Ext"),
    ],
)
def test_template_rendering_with_different_ids(jinja_env, id_, name):
    """Test templates render correctly with various extension ids/names."""
    context = {
        "id": id_,
        "name": name,
        "version": "1.0.0",
        "license": "MIT",
        "include_frontend": True,
        "include_backend": True,
    }

    # Test extension.json template
    template = jinja_env.get_template("extension.json.j2")
    rendered = template.render(context)
    parsed = json.loads(rendered)

    assert parsed["id"] == id_
    assert parsed["name"] == name
    assert parsed["backend"]["entryPoints"] == [f"{id_}.entrypoint"]
    assert parsed["backend"]["files"] == [f"backend/src/{id_}/**/*.py"]

    # Test package.json template
    template = jinja_env.get_template("frontend/package.json.j2")
    rendered = template.render(context)
    parsed = json.loads(rendered)

    assert parsed["name"] == id_

    # Test pyproject.toml template
    template = jinja_env.get_template("backend/pyproject.toml.j2")
    rendered = template.render(context)

    assert id_ in rendered


@pytest.mark.unit
@pytest.mark.parametrize("version", ["0.1.0", "1.0.0", "2.1.3-alpha", "10.20.30"])
def test_template_rendering_with_different_versions(jinja_env, version):
    """Test templates render correctly with various version formats."""
    context = {
        "id": "test_ext",
        "name": "Test Extension",
        "version": version,
        "license": "Apache-2.0",
        "include_frontend": True,
        "include_backend": False,
    }

    template = jinja_env.get_template("extension.json.j2")
    rendered = template.render(context)
    parsed = json.loads(rendered)

    assert parsed["version"] == version


@pytest.mark.unit
@pytest.mark.parametrize(
    "license_type",
    [
        "Apache-2.0",
        "MIT",
        "BSD-3-Clause",
        "GPL-3.0",
        "Custom License",
    ],
)
def test_template_rendering_with_different_licenses(jinja_env, license_type):
    """Test templates render correctly with various license types."""
    context = {
        "id": "test_ext",
        "name": "Test Extension",
        "version": "1.0.0",
        "license": license_type,
        "include_frontend": True,
        "include_backend": True,
    }

    # Test extension.json template
    template = jinja_env.get_template("extension.json.j2")
    rendered = template.render(context)
    parsed = json.loads(rendered)

    assert parsed["license"] == license_type

    # Test package.json template
    template = jinja_env.get_template("frontend/package.json.j2")
    rendered = template.render(context)
    parsed = json.loads(rendered)

    assert parsed["license"] == license_type


# Template Validation Tests
@pytest.mark.unit
@pytest.mark.parametrize(
    "template_name", ["extension.json.j2", "frontend/package.json.j2"]
)
def test_templates_produce_valid_json(jinja_env, template_context, template_name):
    """Test that all JSON templates produce valid JSON output."""
    template = jinja_env.get_template(template_name)
    rendered = template.render(template_context)

    # This will raise an exception if the JSON is invalid
    try:
        json.loads(rendered)
    except json.JSONDecodeError as e:
        pytest.fail(f"Template {template_name} produced invalid JSON: {e}")


@pytest.mark.unit
def test_template_whitespace_handling(jinja_env, template_context):
    """Test that templates handle whitespace correctly and produce clean output."""
    template = jinja_env.get_template("extension.json.j2")
    rendered = template.render(template_context)

    # Should not have excessive empty lines
    lines = rendered.split("\n")
    empty_line_count = sum(1 for line in lines if line.strip() == "")

    # Some empty lines are OK for formatting, but not excessive
    assert empty_line_count < len(lines) / 2, (
        "Too many empty lines in rendered template"
    )

    # Should be properly formatted JSON
    parsed = json.loads(rendered)
    # Re-serialize to check it's valid structure
    json.dumps(parsed, indent=2)


@pytest.mark.unit
def test_template_context_edge_cases(jinja_env):
    """Test template rendering with edge case contexts."""
    # Test with minimal context
    minimal_context = {
        "id": "minimal",
        "name": "Minimal",
        "version": "1.0.0",
        "license": "MIT",
        "include_frontend": False,
        "include_backend": False,
    }

    template = jinja_env.get_template("extension.json.j2")
    rendered = template.render(minimal_context)
    parsed = json.loads(rendered)

    # Should still be valid JSON with basic fields
    assert parsed["id"] == "minimal"
    assert parsed["name"] == "Minimal"
    assert "frontend" not in parsed
    assert "backend" not in parsed
