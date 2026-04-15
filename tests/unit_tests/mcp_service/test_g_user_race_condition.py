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
Tests for g.user isolation across concurrent MCP tool calls.

The MCP server pushes a parent app_context at startup (__main__.py).
asyncio.create_task() copies the ContextVar VALUE — a reference to the
SAME AppContext object. Without pushing a fresh app_context() per tool
call, concurrent tasks share one g namespace and g.user mutations race.

These tests verify that:
- Always pushing a new app_context() per task isolates g.user (SAFE)
- Reusing a shared parent context via nullcontext() causes races (UNSAFE)
- When a request context is active, nullcontext() is safe (middleware path)
"""

import asyncio
from types import SimpleNamespace

import pytest
from flask import Flask, g


def _make_user(user_id: int, username: str) -> SimpleNamespace:
    return SimpleNamespace(id=user_id, username=username)


ALICE = _make_user(1, "alice")
BOB = _make_user(2, "bob")


def _get_user_id() -> int | None:
    """Mirrors superset.utils.core.get_user_id."""
    try:
        return g.user.id
    except AttributeError:
        return None


@pytest.mark.asyncio
async def test_fresh_app_context_per_task_isolates_g_user():
    """
    Each task pushes its own app_context(). g.user is isolated.
    This is the fixed code path in _get_app_context_manager() when
    no request context is active (app-context-only mode).
    """
    app = Flask(__name__)

    async def tool_call(user, results, key):
        with app.app_context():
            g.user = user
            await asyncio.sleep(0)  # yield to other tasks
            results[key] = _get_user_id()

    # Parent context exists (like __main__.py:138)
    with app.app_context():
        for _ in range(200):
            results: dict[str, int | None] = {}
            await asyncio.gather(
                tool_call(ALICE, results, "alice"),
                tool_call(BOB, results, "bob"),
            )
            assert results["alice"] == ALICE.id
            assert results["bob"] == BOB.id


@pytest.mark.asyncio
async def test_nullcontext_shared_context_causes_race():
    """
    Both tasks reuse the parent's app context (nullcontext path).
    g.user is shared — one task overwrites the other's identity.
    Uses asyncio.Event for deterministic interleaving.
    """
    app = Flask(__name__)

    alice_set = asyncio.Event()
    bob_set = asyncio.Event()

    async def alice_task(results):
        g.user = ALICE
        alice_set.set()  # Signal: Alice has set g.user
        await bob_set.wait()  # Wait for Bob to overwrite g.user
        results["alice"] = _get_user_id()

    async def bob_task(results):
        await alice_set.wait()  # Wait for Alice to set g.user first
        g.user = BOB  # Overwrite the shared g.user
        bob_set.set()  # Signal: Bob has overwritten
        results["bob"] = _get_user_id()

    with app.app_context():
        results: dict[str, int | None] = {}
        await asyncio.gather(
            alice_task(results),
            bob_task(results),
        )
        # Alice reads Bob's ID because they share the same g
        assert (
            results["alice"] == BOB.id
        ), "Expected Alice to see Bob's ID due to shared g"
        assert results["bob"] == BOB.id


@pytest.mark.asyncio
async def test_request_context_preserves_g_user():
    """
    When a request context is active (middleware set g.user), each task
    pushes its own test_request_context. The per-task app_context +
    request_context provides isolation even with nullcontext() in the
    auth hook.
    """
    app = Flask(__name__)

    async def tool_call(user, results, key):
        with app.app_context():
            with app.test_request_context(path="/mcp"):
                g.user = user
                await asyncio.sleep(0)
                results[key] = _get_user_id()

    with app.app_context():
        for _ in range(200):
            results: dict[str, int | None] = {}
            await asyncio.gather(
                tool_call(ALICE, results, "alice"),
                tool_call(BOB, results, "bob"),
            )
            assert results["alice"] == ALICE.id
            assert results["bob"] == BOB.id


@pytest.mark.asyncio
async def test_high_contention_isolation():
    """10 concurrent users, 50 iterations — stress test."""
    app = Flask(__name__)
    users = [_make_user(i, f"user_{i}") for i in range(10)]

    async def tool_call(user, results, key):
        with app.app_context():
            g.user = user
            await asyncio.sleep(0)
            await asyncio.sleep(0)
            results[key] = _get_user_id()

    with app.app_context():
        for _ in range(50):
            results: dict[str, int | None] = {}
            await asyncio.gather(*(tool_call(u, results, u.username) for u in users))
            for u in users:
                assert results[u.username] == u.id
