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

"""
Extension Context Management - provides ambient context during extension loading.

This module provides a thread-local context system that allows decorators to
automatically detect whether they are being called in host or extension code
during extension loading.
"""

from __future__ import annotations

import contextlib
from threading import local
from typing import Any, Generator

from superset_core.extensions.types import Manifest

# Thread-local storage for extension context
_extension_context: local = local()


class ExtensionContext:
    """Manages ambient extension context during loading."""

    def __init__(self, manifest: Manifest):
        self.manifest = manifest

    def __enter__(self) -> "ExtensionContext":
        if getattr(_extension_context, "current", None) is not None:
            current_extension = _extension_context.current.manifest.id
            raise RuntimeError(
                f"Cannot initialize extension {self.manifest.id} while extension "
                f"{current_extension} is already being initialized. "
                f"Nested extension initialization is not supported."
            )

        _extension_context.current = self
        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        # Clear the current context
        _extension_context.current = None


class ExtensionContextWrapper:
    """Wrapper for extension context with extensible properties."""

    def __init__(self, manifest: Manifest):
        self._manifest = manifest

    @property
    def manifest(self) -> Manifest:
        """Get the extension manifest."""
        return self._manifest

    # Future: Add other context properties here
    # @property
    # def security_context(self) -> SecurityContext: ...
    # @property
    # def build_info(self) -> BuildInfo: ...


def get_current_extension_context() -> ExtensionContextWrapper | None:
    """Get the currently active extension context wrapper, or None if in host code."""
    if context := getattr(_extension_context, "current", None):
        return ExtensionContextWrapper(context.manifest)
    return None


@contextlib.contextmanager
def extension_context(manifest: Manifest) -> Generator[None, None, None]:
    """Context manager for setting extension context during loading."""
    with ExtensionContext(manifest):
        yield
