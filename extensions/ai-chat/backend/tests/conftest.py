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
"""Test wiring for the gateway.

The backend is loaded by the host through an in-memory importer at runtime,
so it is not on the path the way an installed package would be; ``src`` is
added here to make ``enx_dev.ai_chat`` importable under pytest.

These tests exercise Flask routes and the metadata database, so they need a
Superset application. Rather than standing up a second one, they borrow the
fixtures from Superset's own unit-test suite, located through the installed
``superset`` package -- which means running them requires a Superset source
checkout (a development install), not just the wheel.

A host configured to load this extension imports the backend out of
``dist/`` through its own importer, which wins over the ``src`` entry added
below -- so the routes under test are the built copy. Rather than quietly
pass on code nobody changed, :func:`dist_matches_source` refuses to run
against a stale build.
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

import pytest

import superset

#: Where the host mounts this extension's API, from extension.json.
EXTENSION_ROUTE = "/extensions/enx-dev/ai-chat"

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
sys.path.insert(0, str(Path(superset.__file__).resolve().parents[2]))

from tests.unit_tests.conftest import (  # noqa: E402
    app,  # noqa: F401
    app_context,  # noqa: F401
    client,  # noqa: F401
    full_api_access,  # noqa: F401
)


@pytest.fixture(scope="session", autouse=True)
def dist_matches_source() -> None:
    """Refuse to run against a build that no longer matches the source.

    Only a mismatch is an error; no build at all is fine, since then nothing
    shadows the working tree.
    """
    source = Path(__file__).resolve().parents[1] / "src" / "enx_dev" / "ai_chat"
    built = (
        Path(__file__).resolve().parents[2]
        / "dist"
        / "backend"
        / "src"
        / "enx_dev"
        / "ai_chat"
    )
    if not built.is_dir():
        return

    # Both directions: a module the build failed to prune is invisible when
    # walking the source, and would keep serving a route that no longer has
    # a definition.
    in_source = {path.relative_to(source) for path in source.rglob("*.py")}
    in_build = {path.relative_to(built) for path in built.rglob("*.py")}
    stale = {
        path
        for path in in_source & in_build
        if (source / path).read_bytes() != (built / path).read_bytes()
    }
    stale |= in_source ^ in_build

    if stale:
        pytest.exit(
            "extensions/ai-chat/dist does not match backend/src, and the host "
            "serves the built copy, so these tests would exercise stale "
            "code. Run `superset-extensions build`. Differing: "
            f"{', '.join(sorted(str(path) for path in stale))}",
            returncode=1,
        )


@pytest.fixture(autouse=True)
def gateway_routes(app: Any) -> None:  # noqa: F811
    """Register the gateway's routes on this test's application.

    The host imports an extension's entry point once per process, and it is
    that import which registers the routes. A process only ever builds one
    application in production, but the test suite builds one per module, and
    every application after the first sees the entry point already in
    ``sys.modules`` and so never re-runs the registration.
    """
    from enx_dev.ai_chat.api import AiChatRestApi

    from superset.extensions import appbuilder

    if any(str(rule).startswith(EXTENSION_ROUTE) for rule in app.url_map.iter_rules()):
        return
    with app.app_context():
        view = appbuilder.add_api(AiChatRestApi)
        appbuilder._add_permission(view, True)  # noqa: SLF001


@pytest.fixture(autouse=True)
def key_value_table(app_context: None) -> None:  # noqa: F811
    """Create the table approvals are stored in.

    The unit-test app runs against an empty in-memory database, and the
    tables that do exist are the ones Flask-AppBuilder happens to create
    from whatever models were registered by import time. Approvals live in
    the host's shared key-value table, which nothing in this extension
    imports early enough to be caught by that, so it is created here rather
    than left to depend on the host's import order.
    """
    from superset_core.common import models as core_models

    core_models.KeyValue.__table__.create(
        bind=core_models.get_session().get_bind(), checkfirst=True
    )
