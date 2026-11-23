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

from superset.extensions.context import (
    bind_context,
    ConcreteExtensionContext,
    extension_context,
    get_context,
    get_current_extension_context,
    restore_context,
    use_context,
)
from tests.unit_tests.extensions.storage.conftest import create_manifest


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
    manifest = create_manifest()
    ctx = ConcreteExtensionContext(manifest)

    assert get_current_extension_context() is None

    with use_context(ctx):
        assert get_current_extension_context() is ctx
        assert get_context() is ctx

    assert get_current_extension_context() is None


def test_use_context_supports_nesting():
    """use_context() properly handles nested context switches."""
    manifest1 = create_manifest("org1", "ext1")
    manifest2 = create_manifest("org2", "ext2")
    ctx1 = ConcreteExtensionContext(manifest1)
    ctx2 = ConcreteExtensionContext(manifest2)

    with use_context(ctx1):
        assert get_context().extension.id == "org1.ext1"

        with use_context(ctx2):
            assert get_context().extension.id == "org2.ext2"

        # ctx1 is restored after inner context exits
        assert get_context().extension.id == "org1.ext1"

    assert get_current_extension_context() is None


def test_extension_context_creates_and_sets_context():
    """extension_context() creates context from manifest and sets it."""
    manifest = create_manifest("my-org", "my-ext")

    with extension_context(manifest) as ctx:
        assert ctx.extension is manifest
        assert get_context() is ctx
        assert get_context().extension.id == "my-org.my-ext"

    assert get_current_extension_context() is None


def test_context_provides_extension_property():
    """Context provides extension property as alias for manifest."""
    manifest = create_manifest()
    ctx = ConcreteExtensionContext(manifest)

    with use_context(ctx):
        assert get_context().extension is manifest
        assert get_context().extension.id == manifest.id


def test_context_provides_storage_property():
    """Context provides storage property with ephemeral tier."""
    manifest = create_manifest()
    ctx = ConcreteExtensionContext(manifest)

    with use_context(ctx):
        storage = get_context().storage
        assert storage is not None
        assert hasattr(storage, "ephemeral")


def test_context_exception_still_restores():
    """Context is properly restored even when exception occurs."""
    manifest = create_manifest()
    ctx = ConcreteExtensionContext(manifest)

    def raise_in_context() -> None:
        with use_context(ctx):
            assert get_current_extension_context() is ctx
            raise ValueError("test error")

    with pytest.raises(ValueError, match="test error"):
        raise_in_context()

    assert get_current_extension_context() is None


def test_restore_context_gives_each_call_a_context_of_its_own():
    """What an extension registered runs later in a context made for the call."""
    manifest = create_manifest("acme", "tools")
    with extension_context(manifest) as loading:
        captured = get_current_extension_context()

    assert get_current_extension_context() is None
    with restore_context(captured):
        ctx = get_context()
        assert ctx.extension.id == "acme.tools"
        assert ctx is not loading
    assert get_current_extension_context() is None

    # The host's own code (no context captured) runs as it is.
    with restore_context(None):
        assert get_current_extension_context() is None


def test_bind_context_runs_the_function_in_the_captured_context():
    """A bound function finds its extension wherever it is called."""
    manifest = create_manifest("acme", "tools")

    def whoami(greeting: str) -> str:
        return f"{greeting} {get_context().extension.id}"

    with extension_context(manifest):
        bound = bind_context(whoami, get_current_extension_context())

    assert bound("hello") == "hello acme.tools"
    assert bound.__name__ == "whoami"
    assert get_current_extension_context() is None
    assert bind_context(whoami, None) is whoami
