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
"""Tests for per-tool-call SQLAlchemy session scoping in the MCP service.

db.session is keyed by greenlet ident, so concurrent async tool calls on
one event-loop greenlet share a single Session; the first call's app-context
teardown removes it and detaches the other calls' instances (issue #42622).
The MCP scopefunc keys the registry on a per-call ContextVar token instead.
"""

import asyncio
from collections.abc import Iterator
from typing import Any

import pytest
from sqlalchemy import text

from superset.extensions import db
from superset.mcp_service.auth import _mcp_tool_call_context
from superset.mcp_service.session_scope import (
    install_mcp_session_scoping,
    mcp_session_scopefunc,
)

# NOTE: most tests enter tool-call contexts via _mcp_tool_call_context()
# directly rather than _get_app_context_manager(). The latter consults
# Flask state (request/app context) to pick a context manager, while these
# tests exercise the token mechanics in isolation. Request-backed tool
# calls go through _request_tool_call_context(), covered by
# test_request_context_tool_calls_get_isolated_sessions below.


@pytest.fixture
def mcp_scoping() -> Iterator[Any]:
    """Install the MCP scopefunc and restore the original one afterwards."""
    registry = db.session.registry
    original_scopefunc = registry.scopefunc
    install_mcp_session_scoping()
    yield registry
    registry.scopefunc = original_scopefunc


def test_install_swaps_scopefunc_and_is_idempotent(mcp_scoping: Any) -> None:
    assert mcp_scoping.scopefunc is mcp_session_scopefunc
    install_mcp_session_scoping()
    assert mcp_scoping.scopefunc is mcp_session_scopefunc


def test_scopefunc_falls_back_to_greenlet_outside_tool_calls(
    mcp_scoping: Any,
) -> None:
    # No per-call token set: the key must be the greenlet ident, exactly
    # what flask-sqlalchemy uses by default, so web/CLI/Celery paths are
    # unaffected.
    import greenlet

    assert mcp_session_scopefunc() is greenlet.getcurrent()


@pytest.mark.asyncio
async def test_concurrent_tool_calls_get_isolated_sessions(
    mcp_scoping: Any,
) -> None:
    """Each async tool call gets its own Session; one call's app-context
    teardown removes only that call's session, leaving the other usable."""
    a_ready = asyncio.Event()
    b_done = asyncio.Event()
    outcome: dict[str, Any] = {}

    async def call_a() -> None:
        with _mcp_tool_call_context():
            session_a = db.session()
            outcome["a"] = session_a
            a_ready.set()
            await b_done.wait()
            # B has fully torn down; A's session must still resolve and work.
            assert db.session() is session_a
            session_a.execute(text("SELECT 1"))
            outcome["a_alive"] = True

    async def call_b() -> None:
        await a_ready.wait()
        with _mcp_tool_call_context():
            outcome["b"] = db.session()
        # Leaving the context pops it, so teardown removes B's session here.
        b_done.set()

    await asyncio.gather(call_a(), call_b())

    assert outcome["a"] is not outcome["b"]
    assert outcome.get("a_alive") is True


@pytest.mark.asyncio
async def test_shared_session_teardown_breaks_other_call_without_fix(
    mcp_scoping: Any,
) -> None:
    """Counterfactual: with the default greenlet scope restored, concurrent
    calls resolve to the SAME Session and the first teardown breaks the
    survivor — the exact failure this change prevents."""
    registry = db.session.registry
    original = registry.scopefunc
    try:
        import greenlet

        registry.scopefunc = greenlet.getcurrent

        a_ready = asyncio.Event()
        b_done = asyncio.Event()
        outcome: dict[str, Any] = {}

        async def call_a() -> None:
            with _mcp_tool_call_context():
                outcome["a"] = db.session()
                a_ready.set()
                await b_done.wait()
                outcome["a_has_session"] = db.session.registry.has()

        async def call_b() -> None:
            await a_ready.wait()
            with _mcp_tool_call_context():
                outcome["b"] = db.session()
            b_done.set()

        await asyncio.gather(call_a(), call_b())

        assert outcome["a"] is outcome["b"]
        # B's teardown removed the shared session out from under A.
        assert outcome["a_has_session"] is False
    finally:
        registry.scopefunc = original


def test_create_mcp_app_installs_session_scoping() -> None:
    """Direct factory callers get per-call scoping without a server entry point.

    Deployments that serve the app straight from ``create_mcp_app()`` never
    pass through ``init_fastmcp_server()`` or ``run_server()``; the factory
    itself must swap the scopefunc or concurrent tool calls share one
    greenlet-scoped session again.
    """
    import greenlet

    from superset.mcp_service.app import create_mcp_app

    registry = db.session.registry
    original_scopefunc = registry.scopefunc
    try:
        registry.scopefunc = greenlet.getcurrent
        create_mcp_app(name="scoping-test")
        assert registry.scopefunc is mcp_session_scopefunc
    finally:
        registry.scopefunc = original_scopefunc


@pytest.mark.asyncio
async def test_nested_tool_calls_keep_separate_sessions(mcp_scoping: Any) -> None:
    """A nested tool-call context gets its own session and its teardown does
    not disturb the enclosing call's session."""
    with _mcp_tool_call_context():
        outer = db.session()
        with _mcp_tool_call_context():
            inner = db.session()
            assert inner is not outer
        # inner context popped: outer session untouched
        assert db.session() is outer
        outer.execute(text("SELECT 1"))


@pytest.mark.asyncio
async def test_request_context_tool_calls_get_isolated_sessions(
    mcp_scoping: Any,
) -> None:
    """WorkspaceContextMiddleware path: with a request context active,
    _get_app_context_manager() reuses it but must still give each tool
    call its own session token — request-backed calls would otherwise
    share the greenlet-scoped session, the same race fixed elsewhere.
    Exiting a call removes only that call's session; the request's own
    session belongs to the request lifecycle.
    """
    from superset.mcp_service.auth import _get_app_context_manager
    from superset.mcp_service.flask_singleton import get_flask_app

    app = get_flask_app()
    with app.test_request_context(path="/mcp"):
        request_session = db.session()
        a_ready = asyncio.Event()
        b_done = asyncio.Event()
        outcome: dict[str, Any] = {}

        async def call_a() -> None:
            with _get_app_context_manager():
                session_a = db.session()
                outcome["a"] = session_a
                a_ready.set()
                await b_done.wait()
                # B has fully torn down; A's session must still resolve.
                assert db.session() is session_a
                session_a.execute(text("SELECT 1"))
                outcome["a_alive"] = True

        async def call_b() -> None:
            await a_ready.wait()
            with _get_app_context_manager():
                outcome["b"] = db.session()
                outcome["b_key"] = mcp_session_scopefunc()
            # Exiting deregistered B's per-call session from the registry.
            outcome["b_removed"] = outcome["b_key"] not in db.session.registry.registry
            b_done.set()

        await asyncio.gather(call_a(), call_b())

        assert outcome["a"] is not outcome["b"]
        assert outcome["a"] is not request_session
        assert outcome["b"] is not request_session
        assert outcome.get("a_alive") is True
        assert outcome["b_removed"] is True
        # The request's own greenlet-scoped session is untouched.
        assert db.session() is request_session
