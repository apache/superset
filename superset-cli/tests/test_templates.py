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


@pytest.mark.unit
class TestTemplateRendering:
    """Unit tests for Jinja2 template rendering functionality."""

    @pytest.fixture
    def templates_dir(self):
        """Get the templates directory path."""
        return Path(__file__).parent.parent / "src" / "superset_cli" / "templates"

    @pytest.fixture
    def jinja_env(self, templates_dir):
        """Create a Jinja2 environment for testing templates."""
        return Environment(loader=FileSystemLoader(templates_dir))

    @pytest.fixture
    def template_context(self):
        """Default template context for testing."""
        return {
            "id": "test_extension",
            "name": "Test Extension",
            "version": "0.1.0",
            "license": "Apache-2.0",
            "include_frontend": True,
            "include_backend": True,
        }

    def test_extension_json_template_renders_with_both_frontend_and_backend(
        self, jinja_env, template_context
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

    def test_extension_json_template_renders_with_frontend_only(
        self, jinja_env, template_context
    ):
        """Test extension.json template renders correctly with frontend only."""
        template_context["include_backend"] = False

        template = jinja_env.get_template("extension.json.j2")
        rendered = template.render(template_context)

        parsed = json.loads(rendered)

        # Should have frontend section
        assert "frontend" in parsed

        # Should NOT have backend section
        assert "backend" not in parsed

    def test_extension_json_template_renders_with_backend_only(
        self, jinja_env, template_context
    ):
        """Test extension.json template renders correctly with backend only."""
        template_context["include_frontend"] = False

        template = jinja_env.get_template("extension.json.j2")
        rendered = template.render(template_context)

        parsed = json.loads(rendered)

        # Should have backend section
        assert "backend" in parsed

        # Should NOT have frontend section
        assert "frontend" not in parsed

    def test_extension_json_template_renders_with_neither(
        self, jinja_env, template_context
    ):
        """Test extension.json template renders correctly with neither frontend nor backend."""
        template_context["include_frontend"] = False
        template_context["include_backend"] = False

        template = jinja_env.get_template("extension.json.j2")
        rendered = template.render(template_context)

        parsed = json.loads(rendered)

        # Should have basic fields only
        assert parsed["id"] == "test_extension"
        assert parsed["name"] == "Test Extension"
        assert parsed["version"] == "0.1.0"
        assert parsed["license"] == "Apache-2.0"
        assert parsed["permissions"] == []

        # Should NOT have frontend or backend sections
        assert "frontend" not in parsed
        assert "backend" not in parsed

    def test_frontend_package_json_template_renders_correctly(
        self, jinja_env, template_context
    ):
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

    def test_backend_pyproject_toml_template_renders_correctly(
        self, jinja_env, template_context
    ):
        """Test backend/pyproject.toml template renders correctly."""
        template = jinja_env.get_template("backend/pyproject.toml.j2")
        rendered = template.render(template_context)

        # Basic content verification (without full TOML parsing)
        assert "test_ext" in rendered
        assert "0.1.0" in rendered
        assert "Apache-2.0" in rendered

    def test_template_rendering_with_different_ids(self, jinja_env):
        """Test templates render correctly with various extension ids/names."""
        test_cases = [
            ("simple_extension", "Simple Extension"),
            ("MyExtension123", "My Extension 123"),
            ("complex_extension_name_123", "Complex Extension Name 123"),
            ("ext", "Ext"),
        ]

        for id_, name in test_cases:
            context = {
                "id": id_,
                "name": f"{name}",
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

    def test_template_rendering_with_different_versions(self, jinja_env):
        """Test templates render correctly with various version formats."""
        test_versions = ["0.1.0", "1.0.0", "2.1.3-alpha", "10.20.30"]

        for version in test_versions:
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

    def test_template_rendering_with_different_licenses(self, jinja_env):
        """Test templates render correctly with various license types."""
        test_licenses = [
            "Apache-2.0",
            "MIT",
            "BSD-3-Clause",
            "GPL-3.0",
            "Custom License",
        ]

        for license_type in test_licenses:
            context = {
                "name": "test_ext",
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

    def test_templates_produce_valid_json(self, jinja_env, template_context):
        """Test that all templates produce valid JSON output."""
        json_templates = ["extension.json.j2", "frontend/package.json.j2"]

        for template_name in json_templates:
            template = jinja_env.get_template(template_name)
            rendered = template.render(template_context)

            # This will raise an exception if the JSON is invalid
            try:
                json.loads(rendered)
            except json.JSONDecodeError as e:
                pytest.fail(f"Template {template_name} produced invalid JSON: {e}")

    def test_template_whitespace_handling(self, jinja_env, template_context):
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
