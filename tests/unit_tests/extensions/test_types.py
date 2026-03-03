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

"""Tests for extension configuration and manifest Pydantic models."""

import pytest
from pydantic import ValidationError
from superset_core.extensions.types import (
    ExtensionConfig,
    ExtensionConfigBackend,
    Manifest,
    ManifestBackend,
)

# =============================================================================
# ExtensionConfig (extension.json) tests
# =============================================================================


def test_extension_config_minimal():
    """Test ExtensionConfig with minimal required fields."""
    config = ExtensionConfig.model_validate(
        {
            "publisher": "my-org",
            "name": "my-extension",
            "displayName": "My Extension",
        }
    )
    assert config.publisher == "my-org"
    assert config.name == "my-extension"
    assert config.displayName == "My Extension"
    assert config.version == "0.0.0"
    assert config.dependencies == []
    assert config.permissions == []
    assert config.backend is None


def test_extension_config_full():
    """Test ExtensionConfig with all fields populated."""
    config = ExtensionConfig.model_validate(
        {
            "publisher": "acme-corp",
            "name": "query-insights",
            "displayName": "Query Insights",
            "version": "1.0.0",
            "license": "Apache-2.0",
            "description": "A query insights extension",
            "dependencies": ["other-extension"],
            "permissions": ["can_read", "can_view"],
            "backend": {
                "files": ["backend/src/query_insights/**/*.py"],
            },
        }
    )
    assert config.publisher == "acme-corp"
    assert config.name == "query-insights"
    assert config.displayName == "Query Insights"
    assert config.version == "1.0.0"
    assert config.license == "Apache-2.0"
    assert config.description == "A query insights extension"
    assert config.dependencies == ["other-extension"]
    assert config.permissions == ["can_read", "can_view"]
    assert config.backend is not None
    assert config.backend.files == ["backend/src/query_insights/**/*.py"]


def test_extension_config_missing_publisher():
    """Test ExtensionConfig raises error when publisher is missing."""
    with pytest.raises(ValidationError) as exc_info:
        ExtensionConfig.model_validate(
            {"name": "my-extension", "displayName": "My Extension"}
        )
    assert "publisher" in str(exc_info.value)


def test_extension_config_missing_name():
    """Test ExtensionConfig raises error when name is missing."""
    with pytest.raises(ValidationError) as exc_info:
        ExtensionConfig.model_validate(
            {"publisher": "my-org", "displayName": "My Extension"}
        )
    assert "name" in str(exc_info.value)


def test_extension_config_missing_display_name():
    """Test ExtensionConfig raises error when displayName is missing."""
    with pytest.raises(ValidationError) as exc_info:
        ExtensionConfig.model_validate({"publisher": "my-org", "name": "my-extension"})
    assert "displayName" in str(exc_info.value)


def test_extension_config_empty_publisher():
    """Test ExtensionConfig raises error when publisher is empty."""
    with pytest.raises(ValidationError) as exc_info:
        ExtensionConfig.model_validate(
            {"publisher": "", "name": "my-extension", "displayName": "My Extension"}
        )
    assert "publisher" in str(exc_info.value)


def test_extension_config_invalid_version():
    """Test ExtensionConfig raises error for invalid version format."""
    with pytest.raises(ValidationError) as exc_info:
        ExtensionConfig.model_validate(
            {
                "publisher": "my-org",
                "name": "my-extension",
                "displayName": "My Extension",
                "version": "invalid",
            }
        )
    assert "version" in str(exc_info.value)


def test_extension_config_valid_versions():
    """Test ExtensionConfig accepts valid semantic versions (major.minor.patch only)."""
    for version in ["1.0.0", "0.1.0", "10.20.30"]:
        config = ExtensionConfig.model_validate(
            {
                "publisher": "my-org",
                "name": "my-extension",
                "displayName": "My Extension",
                "version": version,
            }
        )
        assert config.version == version


def test_extension_config_prerelease_version_rejected():
    """Test ExtensionConfig rejects prerelease versions."""
    with pytest.raises(ValidationError) as exc_info:
        ExtensionConfig.model_validate(
            {
                "publisher": "my-org",
                "name": "my-extension",
                "displayName": "My Extension",
                "version": "1.0.0-beta",
            }
        )
    assert "version" in str(exc_info.value)


# =============================================================================
# Manifest (manifest.json) tests
# =============================================================================


def test_manifest_minimal():
    """Test Manifest with minimal required fields."""
    manifest = Manifest.model_validate(
        {
            "id": "my-org.my-extension",
            "publisher": "my-org",
            "name": "my-extension",
            "displayName": "My Extension",
        }
    )
    assert manifest.id == "my-org.my-extension"
    assert manifest.publisher == "my-org"
    assert manifest.name == "my-extension"
    assert manifest.displayName == "My Extension"
    assert manifest.frontend is None
    assert manifest.backend is None


def test_manifest_with_frontend():
    """Test Manifest frontend section requires remoteEntry and moduleFederationName."""
    manifest = Manifest.model_validate(
        {
            "id": "my-org.my-extension",
            "publisher": "my-org",
            "name": "my-extension",
            "displayName": "My Extension",
            "frontend": {
                "remoteEntry": "remoteEntry.abc123.js",
                "moduleFederationName": "myOrg_myExtension",
            },
        }
    )
    assert manifest.frontend is not None
    assert manifest.frontend.remoteEntry == "remoteEntry.abc123.js"
    assert manifest.frontend.moduleFederationName == "myOrg_myExtension"


def test_manifest_frontend_missing_remote_entry():
    """Test Manifest raises error when frontend is missing remoteEntry."""
    with pytest.raises(ValidationError) as exc_info:
        Manifest.model_validate(
            {
                "id": "my-org.my-extension",
                "publisher": "my-org",
                "name": "my-extension",
                "displayName": "My Extension",
                "frontend": {"moduleFederationName": "myOrg_myExtension"},
            }
        )
    assert "remoteEntry" in str(exc_info.value)


def test_manifest_with_backend():
    """Test Manifest with backend section."""
    manifest = Manifest.model_validate(
        {
            "id": "my-org.my-extension",
            "publisher": "my-org",
            "name": "my-extension",
            "displayName": "My Extension",
            "backend": {
                "entrypoint": "superset_extensions.my_org.my_extension.entrypoint"
            },
        }
    )
    assert manifest.backend is not None
    assert (
        manifest.backend.entrypoint
        == "superset_extensions.my_org.my_extension.entrypoint"
    )


def test_manifest_backend_no_files_field():
    """Test ManifestBackend does not have files field (only in ExtensionConfig)."""
    manifest = Manifest.model_validate(
        {
            "id": "my-org.my-extension",
            "publisher": "my-org",
            "name": "my-extension",
            "displayName": "My Extension",
            "backend": {
                "entrypoint": "superset_extensions.my_org.my_extension.entrypoint"
            },
        }
    )
    # ManifestBackend should not have a 'files' field
    assert not hasattr(manifest.backend, "files")


def test_extension_config_backend_defaults():
    """Test ExtensionConfigBackend has correct defaults."""
    backend = ExtensionConfigBackend.model_validate({})
    assert backend.files == []


def test_manifest_backend_required_entrypoint():
    """Test ManifestBackend requires entrypoint field."""
    # Test positive case - entrypoint provided
    backend = ManifestBackend.model_validate(
        {"entrypoint": "superset_extensions.test_org.test_extension.entrypoint"}
    )
    assert (
        backend.entrypoint == "superset_extensions.test_org.test_extension.entrypoint"
    )

    # Test negative case - entrypoint missing should raise ValidationError
    with pytest.raises(ValidationError) as exc_info:
        ManifestBackend.model_validate({})
    assert "entrypoint" in str(exc_info.value)
