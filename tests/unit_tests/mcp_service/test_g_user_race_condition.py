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
    except Exception:
        return None


@pytest.mark.asyncio()
async def test_fresh_app_context_per_task_isolates_g_user():
    """
    Each task pushes its own app_context(). g.user is isolated.
    This is the fixed code path in _get_app_context_manager().
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


@pytest.mark.asyncio()
async def test_nullcontext_shared_context_causes_race():
    """
    Both tasks reuse the parent's app context (nullcontext path).
    g.user is shared — one task overwrites the other's identity.
    This is the bug that existed before the fix.
    """
    app = Flask(__name__)

    async def tool_call(user, results, key):
        # No per-task app_context — nullcontext() reuses parent's g
        g.user = user
        await asyncio.sleep(0)
        results[key] = _get_user_id()

    with app.app_context():
        results: dict[str, int | None] = {}
        await asyncio.gather(
            tool_call(ALICE, results, "alice"),
            tool_call(BOB, results, "bob"),
        )
        # At least one user sees the wrong ID
        alice_wrong = results["alice"] != ALICE.id
        bob_wrong = results["bob"] != BOB.id
        assert (
            alice_wrong or bob_wrong
        ), "Expected race — both tasks share g via parent context"


@pytest.mark.asyncio()
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
