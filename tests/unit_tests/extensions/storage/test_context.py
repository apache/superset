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

"""Tests for extension context management."""

import pytest
from superset_core.extensions.types import Manifest

from superset.extensions.context import (
    ConcreteExtensionContext,
    extension_context,
    get_context,
    get_current_extension_context,
    use_context,
)


def _create_test_manifest(
    publisher: str = "test-org", name: str = "test-extension"
) -> Manifest:
    """Create a test manifest with minimal required fields."""
    return Manifest.model_validate(
        {
            "id": f"{publisher}.{name}",
            "publisher": publisher,
            "name": name,
            "displayName": f"Test {name}",
        }
    )


def test_get_context_raises_outside_context():
    """get_context() raises RuntimeError when called outside extension context."""
    with pytest.raises(
        RuntimeError, match="must be called within an extension context"
    ):
        get_context()


def test_get_current_extension_context_returns_none_outside_context():
    """get_current_extension_context() returns None when called outside context."""
    assert get_current_extension_context() is None


def test_use_context_sets_and_restores_context():
    """use_context() sets context during execution and restores None after."""
    manifest = _create_test_manifest()
    ctx = ConcreteExtensionContext(manifest)

    assert get_current_extension_context() is None

    with use_context(ctx):
        assert get_current_extension_context() is ctx
        assert get_context() is ctx

    assert get_current_extension_context() is None


def test_use_context_supports_nesting():
    """use_context() properly handles nested context switches."""
    manifest1 = _create_test_manifest("org1", "ext1")
    manifest2 = _create_test_manifest("org2", "ext2")
    ctx1 = ConcreteExtensionContext(manifest1)
    ctx2 = ConcreteExtensionContext(manifest2)

    with use_context(ctx1):
        assert get_context().manifest.id == "org1.ext1"

        with use_context(ctx2):
            assert get_context().manifest.id == "org2.ext2"

        # ctx1 is restored after inner context exits
        assert get_context().manifest.id == "org1.ext1"

    assert get_current_extension_context() is None


def test_extension_context_creates_and_sets_context():
    """extension_context() creates context from manifest and sets it."""
    manifest = _create_test_manifest("my-org", "my-ext")

    with extension_context(manifest) as ctx:
        assert ctx.manifest is manifest
        assert get_context() is ctx
        assert get_context().manifest.id == "my-org.my-ext"

    assert get_current_extension_context() is None


def test_context_provides_extension_property():
    """Context provides extension property as alias for manifest."""
    manifest = _create_test_manifest()
    ctx = ConcreteExtensionContext(manifest)

    with use_context(ctx):
        assert get_context().extension is manifest
        assert get_context().extension.id == manifest.id


def test_context_provides_storage_property():
    """Context provides storage property with ephemeral tier."""
    manifest = _create_test_manifest()
    ctx = ConcreteExtensionContext(manifest)

    with use_context(ctx):
        storage = get_context().storage
        assert storage is not None
        assert hasattr(storage, "ephemeral")


def test_context_exception_still_restores():
    """Context is properly restored even when exception occurs."""
    manifest = _create_test_manifest()
    ctx = ConcreteExtensionContext(manifest)

    def raise_in_context() -> None:
        with use_context(ctx):
            assert get_current_extension_context() is ctx
            raise ValueError("test error")

    with pytest.raises(ValueError, match="test error"):
        raise_in_context()

    assert get_current_extension_context() is None
