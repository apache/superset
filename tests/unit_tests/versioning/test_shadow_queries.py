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
"""Unit tests for the change-record shadow queries (sc-120007).

``_dashboard_slice_uuids_at_tx`` takes a dashboard's precomputed attachment
windows (from :func:`charts_attached_to_dashboard`, which pairs the
``dashboard_slices_version`` INSERT/DELETE rows into ``[attach, detach)``
intervals) and keeps only the charts whose window contains the target tx. The
raw association-shadow validity predicate must NOT be used: Continuum never
closes ``end_transaction_id`` on the M2M association shadow, so it over-reports
a removed chart as still a member. Third consumer of the pattern fixed for
restore/impact in #44010.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

from sqlalchemy.dialects import sqlite

from superset.versioning.activity.kinds import ENTITY_ID_CHUNK_SIZE, Window
from superset.versioning.changes.shadow_queries import (
    _dashboard_child_records_for_tx_from_shadows,
    _dashboard_slice_uuids_at_tx,
)

# Chart ids in the small fixtures; distinguishes them from the other binds
# (tx, operation_type) so the fake result can echo only the queried chart ids
# back as uuids — the returned rows then reflect the real filter rather than a
# constant, so a broken membership filter changes the result.
_CHART_IDS = {101, 202, 303}


class _EchoResult:
    def __init__(self, ids: set[int]) -> None:
        self._ids = ids

    def all(self) -> list[tuple[str]]:
        return [(f"uuid-{i}",) for i in sorted(self._ids)]


def _session_echoing_queried_ids(
    captured: list[Any], id_predicate: Any = None
) -> MagicMock:
    """Build a session whose execute() echoes back one uuid row per queried id.

    Each returned row is ``uuid-<id>`` for every chart id actually bound into
    the statement's ``IN`` clause, so the result reflects the real filter.
    """
    predicate = id_predicate or (lambda v: v in _CHART_IDS)

    def _execute(stmt: Any) -> _EchoResult:
        captured.append(stmt)
        compiled = stmt.compile(
            dialect=sqlite.dialect(), compile_kwargs={"render_postcompile": True}
        )
        queried = {v for v in compiled.params.values() if predicate(v)}
        return _EchoResult(queried)

    session = MagicMock()
    session.connection.return_value.execute.side_effect = _execute
    return session


def test_dashboard_slice_uuids_excludes_chart_detached_before_tx(
    app_context: None,
) -> None:
    """A chart removed before the target tx is not resolved as a member.

    sc-120007: a chart attached@1 and removed@5 (window ``[1, 5)``) is NOT a
    member at tx=10, while a still-attached chart (open-ended window) is — so
    only the live chart is resolved. The never-closed association-shadow row
    would pass a naive validity filter; the ``window.contains(tx)`` resolution
    is what excludes it.
    """
    attached = [(101, Window(1, 5)), (202, Window(1, None))]  # 101 detached, 202 live
    captured: list[Any] = []
    session = _session_echoing_queried_ids(captured)

    result = _dashboard_slice_uuids_at_tx(session, attached, tx=10)

    assert result == ["uuid-202"]
    assert captured, "expected a slices_version uuid query"
    compiled = captured[0].compile(
        dialect=sqlite.dialect(), compile_kwargs={"render_postcompile": True}
    )
    bind_values = set(compiled.params.values())
    assert 202 in bind_values, "still-attached chart must be resolved"
    assert 101 not in bind_values, (
        "a chart removed before the target tx must not be resolved as a member "
        "(sc-120007: never-closed association shadow must not over-report)"
    )


def test_dashboard_slice_uuids_empty_when_nothing_attached_at_tx(
    app_context: None,
) -> None:
    """No uuid query is issued when every window excludes the target tx.

    The caller's diff then sees zero members, not a stale set.
    """
    attached = [(101, Window(1, 5)), (202, Window(2, 6))]  # both closed before 10
    session = MagicMock()

    result = _dashboard_slice_uuids_at_tx(session, attached, tx=10)

    assert result == []
    session.connection.return_value.execute.assert_not_called()


def test_dashboard_slice_uuids_includes_chart_reattached_before_tx(
    app_context: None,
) -> None:
    """A re-attached chart is a member if any of its windows contains tx.

    The two windows collapse to one id in the resolved set (resolved once).
    """
    attached = [(101, Window(1, 5)), (101, Window(8, None))]  # re-attached at 8
    captured: list[Any] = []
    session = _session_echoing_queried_ids(captured)

    result = _dashboard_slice_uuids_at_tx(session, attached, tx=10)

    assert result == ["uuid-101"]


def test_dashboard_slice_uuids_drops_null_uuid_rows(app_context: None) -> None:
    """A content-shadow row with a NULL uuid is filtered out, not emitted."""
    attached = [(202, Window(1, None))]

    class _NullThenReal:
        def all(self) -> list[tuple[Any]]:
            return [(None,), ("uuid-202",)]

    session = MagicMock()
    session.connection.return_value.execute.return_value = _NullThenReal()

    result = _dashboard_slice_uuids_at_tx(session, attached, tx=10)

    assert result == ["uuid-202"]


def test_dashboard_slice_uuids_chunks_wide_membership_under_bind_floor(
    app_context: None,
) -> None:
    """A wide dashboard's membership IN is chunked to stay under the bind floor.

    sc-120007 MEDIUM: with more than ``ENTITY_ID_CHUNK_SIZE`` attached charts a
    single IN would exceed SQLite's ~999 bind-variable floor. The read chunks
    the id set; assert multiple statements are issued, each compiles to well
    under 999 binds, and every id is resolved across the chunks. Dropping the
    chunking would emit one statement whose bind count exceeds the floor.
    """
    count = 2 * ENTITY_ID_CHUNK_SIZE + 50  # spans three chunks
    ids = list(range(1000, 1000 + count))  # >= 1000 so tx/op binds never collide
    attached = [(i, Window(1, None)) for i in ids]  # all attached at tx=10
    captured: list[Any] = []
    session = _session_echoing_queried_ids(captured, id_predicate=lambda v: v >= 1000)

    result = _dashboard_slice_uuids_at_tx(session, attached, tx=10)

    assert sorted(result) == sorted(f"uuid-{i}" for i in ids)
    assert len(captured) >= 2, "wide membership must be split across statements"
    for stmt in captured:
        compiled = stmt.compile(
            dialect=sqlite.dialect(), compile_kwargs={"render_postcompile": True}
        )
        assert len(compiled.params) < 999, "each statement must stay under the floor"


def test_child_records_threads_committing_session_into_membership(
    app_context: None,
) -> None:
    """The membership read runs on the committing session, not global db.session.

    sc-120007 HIGH regression guard: ``_dashboard_child_records_for_tx_from_shadows``
    runs during commit finalization, when the current transaction's association
    rows are flushed-but-not-committed and visible only on the committing
    connection. It must pass that session to ``charts_attached_to_dashboard``;
    reading via ``db.session`` would miss those rows on a non-scoped committing
    session and silently drop the change record. Asserted at the call site so
    dropping ``session=session`` fails here even though the direct-window tests
    above stay green.
    """
    committing_session = MagicMock(name="committing_session")
    # The prior-tx lookup runs on the same session; give it a value.
    prior_tx_result = committing_session.connection.return_value.execute.return_value
    prior_tx_result.scalar.return_value = 5
    spy = MagicMock(return_value=[])  # no attached members -> no uuid query

    with (
        patch(
            "superset.versioning.changes.shadow_queries._affected_dashboard_ids_at_tx",
            return_value={7},
        ),
        patch(
            "superset.versioning.membership.charts_attached_to_dashboard",
            spy,
        ),
    ):
        _dashboard_child_records_for_tx_from_shadows(
            committing_session, transaction_id=10
        )

    spy.assert_called_once_with(7, session=committing_session)


def test_charts_attached_to_dashboard_uses_the_passed_session(
    app_context: None,
) -> None:
    """The membership helper reads on the passed session, never db.session."""
    from superset.versioning.membership import charts_attached_to_dashboard

    passed = MagicMock(name="passed_session")
    passed.connection.return_value.execute.return_value.all.return_value = []

    with patch("superset.versioning.membership.db") as mock_db:
        charts_attached_to_dashboard(1, session=passed)

    passed.connection.assert_called_once_with()
    mock_db.session.connection.assert_not_called()


def test_charts_attached_to_dashboard_defaults_to_db_session(
    app_context: None,
) -> None:
    """With no session, the helper falls back to the Flask-scoped db.session."""
    from superset.versioning.membership import charts_attached_to_dashboard

    with patch("superset.versioning.membership.db") as mock_db:
        db_result = mock_db.session.connection.return_value.execute.return_value
        db_result.all.return_value = []
        charts_attached_to_dashboard(1)

    mock_db.session.connection.assert_called_once_with()
