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

"""Shared fixtures and helpers for extension storage tests."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from flask import Flask, g
from superset_core.extensions.types import Manifest

from superset.extensions.context import ConcreteExtensionContext


@pytest.fixture
def app() -> Flask:
    """Minimal Flask app for storage tests."""
    flask_app = Flask(__name__)
    flask_app.config["TESTING"] = True
    # Mirrors the defaults set in superset/config.py, which are always
    # present in a real Superset app.
    flask_app.config["EXTENSIONS_EPHEMERAL_STORAGE"] = {}
    flask_app.config["EXTENSIONS_PERSISTENT_STORAGE"] = {}
    return flask_app


def create_manifest(publisher: str = "test-org", name: str = "test-ext") -> Manifest:
    """Create a test Manifest with the given publisher and name."""
    return Manifest.model_validate(
        {
            "id": f"{publisher}.{name}",
            "publisher": publisher,
            "name": name,
            "displayName": f"Test {name}",
        }
    )


def create_context(
    publisher: str = "test-org", name: str = "test-ext"
) -> ConcreteExtensionContext:
    """Create a ConcreteExtensionContext for the given publisher and name."""
    return ConcreteExtensionContext(create_manifest(publisher, name))


def set_user(user_id: int) -> None:
    """Set a mock authenticated user on Flask's g object."""
    g.user = MagicMock(id=user_id)
