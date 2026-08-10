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
Tests for db.session isolation across concurrent asyncio tasks.

MCP tool calls are asyncio tasks, and each of them runs inside its own Flask
app context. ``flask-sqlalchemy`` scopes the session on the current greenlet,
which does not tell tasks apart — so without a task-aware scope function they
all share one session, and the first app context torn down removes it from
under the calls still in flight.

These tests verify that:
- the scope function returns the running task, and falls back to the greenlet
  identity off the event loop (unchanged web tier / Celery / thread pool)
- concurrent tasks keep working instances when a sibling's context is torn down
- the default greenlet scoping loses them (the bug being fixed)
"""

import asyncio
from typing import Any, Callable, Optional

import pytest
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm.exc import DetachedInstanceError
from sqlalchemy.pool import StaticPool

from superset.extensions import _greenlet_ident, _session_scope_ident


def _make_app(scopefunc: Optional[Callable[[], Any]]) -> tuple[Flask, SQLAlchemy, Any]:
    """A minimal app owning one row per task, scoped with the given function."""
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite://"
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    db = SQLAlchemy(
        app,
        session_options={"scopefunc": scopefunc} if scopefunc else None,
        # One shared in-memory connection, so every session sees the same rows.
        engine_options={"poolclass": StaticPool},
    )

    class Thing(db.Model):  # type: ignore[name-defined, misc]
        id = db.Column(db.Integer, primary_key=True)
        name = db.Column(db.String(16))

    with app.app_context():
        db.create_all()
        db.session.add_all([Thing(id=1, name="chart-1"), Thing(id=2, name="chart-2")])
        db.session.commit()

    return app, db, Thing


async def _read_after_sibling_teardown(
    scopefunc: Optional[Callable[[], Any]],
) -> str:
    """Read an instance after a concurrent task tore its app context down.

    Mirrors a tool call that commits and then reports what it wrote, while
    another call — working on its own row, as two concurrent calls creating
    their own chart would — finishes first. This is the shape of the
    DetachedInstanceError reported in apache/superset#42567.
    """
    app, db, model = _make_app(scopefunc)
    loaded = asyncio.Event()
    torn_down = asyncio.Event()

    async def reader() -> str:
        with app.app_context():
            thing = db.session.query(model).filter_by(id=1).one()
            db.session.commit()  # expires attributes, as a command commit does
            loaded.set()
            await torn_down.wait()
            return str(thing.name)  # needs a live session to refresh

    async def sibling() -> None:
        with app.app_context():
            db.session.query(model).filter_by(id=2).one()
            await loaded.wait()
        # leaving the context fires teardown_appcontext → session.remove()
        torn_down.set()

    read, _ = await asyncio.gather(reader(), sibling())
    return read


def test_scope_ident_falls_back_to_greenlet_off_the_event_loop() -> None:
    """No running loop — the identity flask-sqlalchemy would have used."""
    assert _session_scope_ident() == _greenlet_ident()


async def _ident_of_this_task() -> Any:
    await asyncio.sleep(0)
    return _session_scope_ident()


async def test_scope_ident_returns_the_running_task() -> None:
    """Inside a task — the task itself, so sibling tasks never collide."""
    assert _session_scope_ident() is asyncio.current_task()

    first, second = await asyncio.gather(_ident_of_this_task(), _ident_of_this_task())
    assert first is not second


async def test_task_scoping_keeps_the_instance_alive() -> None:
    """A sibling's teardown no longer removes this task's session."""
    assert await _read_after_sibling_teardown(_session_scope_ident) == "chart-1"


async def test_greenlet_scoping_detaches_the_instance() -> None:
    """The bug: with the library default both tasks share one session."""
    with pytest.raises(DetachedInstanceError):
        await _read_after_sibling_teardown(None)
