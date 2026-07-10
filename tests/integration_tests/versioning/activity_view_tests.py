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
"""Integration tests for the cross-entity activity-view API (sc-107283).

US1 — dashboard activity stream: ``GET /api/v1/dashboard/<uuid>/activity/``.
Tests for US2 (chart activity) and US3 (dataset activity) come in later
phases.

Per spec T053 / sc-103156 T062, every test that mutates a fixture entity
wraps the test body in ``try``/``finally`` with
``metadata_db.session.rollback()`` in the ``finally``. The rationale is
documented in the spec — Continuum captures dirty mappers during
autoflush, so leaving an instrumented attribute dirty pollutes
downstream tests via the shadow tables.
"""

from __future__ import annotations

from typing import Any
from uuid import uuid4

import pytest

from superset.connectors.sqla.models import SqlaTable
from superset.extensions import db
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import json as _json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import (
    ADMIN_USERNAME,
    ALPHA_USERNAME,
    GAMMA_USERNAME,
)
from tests.integration_tests.fixtures.birth_names_dashboard import (  # noqa: F401
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)


def _get_birth_names_dataset() -> SqlaTable:
    return (
        db.session.query(SqlaTable)
        .filter(SqlaTable.table_name == "birth_names")
        .first()
    )


def _persist_fixture_state() -> None:
    """Force the fixture's pending INSERTs to commit so subsequent edits
    produce *new* version rows instead of being batched into the
    creation transaction. Mirrors the same helper in
    ``tests/integration_tests/dashboards/version_history_tests.py``.
    """
    db.session.commit()


def _get_birth_names_dashboard() -> Dashboard:
    return (
        db.session.query(Dashboard)
        .filter(Dashboard.dashboard_title == "USA Births Names")
        .first()
    )


class TestDashboardActivityView(SupersetTestCase):
    """T017–T026 — ``GET /api/v1/dashboard/<uuid>/activity/`` (US1)."""

    @pytest.fixture(autouse=True)
    def _load_data(self, load_birth_names_dashboard_with_slices):  # noqa: PT004, F811
        pass

    def _activity(self, dashboard_uuid: str, **query: Any) -> Any:
        return self.client.get(
            f"/api/v1/dashboard/{dashboard_uuid}/activity/",
            query_string=query,
        )

    # ---- 4xx boundary cases ----

    def test_activity_returns_404_for_unknown_uuid(self) -> None:
        """AV-009: unknown path entity → 404."""
        self.login(ADMIN_USERNAME)
        rv = self._activity("00000000-0000-0000-0000-000000000000")
        assert rv.status_code == 404

    def test_activity_returns_400_for_invalid_uuid(self) -> None:
        """A malformed UUID is rejected by the endpoint, not by Werkzeug."""
        self.login(ADMIN_USERNAME)
        rv = self._activity("not-a-uuid")
        assert rv.status_code == 400

    def test_activity_returns_400_for_invalid_include(self) -> None:
        _persist_fixture_state()
        dashboard = _get_birth_names_dashboard()
        assert dashboard is not None
        self.login(ADMIN_USERNAME)
        rv = self._activity(str(dashboard.uuid), include="sibling")
        assert rv.status_code == 400

    def test_activity_returns_400_for_invalid_since(self) -> None:
        _persist_fixture_state()
        dashboard = _get_birth_names_dashboard()
        assert dashboard is not None
        self.login(ADMIN_USERNAME)
        rv = self._activity(str(dashboard.uuid), since="yesterday")
        assert rv.status_code == 400

    def test_activity_allows_read_non_owner(self) -> None:
        """Activity is a read endpoint: a non-owner with read access (Alpha,
        which carries broad read + datasource access) can read a dashboard's
        activity stream — ``raise_for_access(dashboard=)`` does not reject —
        so the endpoint returns 200. Visibility of *related* rows is filtered
        separately, inside the activity layer."""
        _persist_fixture_state()
        dashboard = _get_birth_names_dashboard()
        assert dashboard is not None
        dashboard_uuid = str(dashboard.uuid)

        self.login(ALPHA_USERNAME)
        rv = self._activity(dashboard_uuid)
        assert rv.status_code == 200

    def test_visibility_filter_silently_drops_inaccessible_related(self) -> None:
        """AV-008 security control: a related record whose entity the caller
        cannot read is *silently* dropped — absent from the result, no
        placeholder, no contribution to count. Exercises the real
        enforcement point (``filter_records_by_visibility`` →
        ``DashboardAccessFilter``) with a restricted Gamma principal.

        Setup uses two dashboards (no datasource needed): one owned by
        Gamma (readable), and an admin-owned one Gamma may not read.
        """
        from superset import security_manager
        from superset.subjects.utils import get_user_subject
        from superset.versioning.activity.visibility import (
            filter_records_by_visibility,
        )

        admin = security_manager.find_user(ADMIN_USERNAME)
        gamma = security_manager.find_user(GAMMA_USERNAME)
        # Access control is subject-based (``editors``) since the Subject
        # work replaced ``owners``; grant read via each user's Subject.
        visible = Dashboard(
            dashboard_title=f"vis-probe-owned {uuid4().hex[:8]}",
            slug=f"vis-owned-{uuid4().hex[:8]}",
            published=False,
            editors=[get_user_subject(gamma.id)],
        )
        hidden = Dashboard(
            dashboard_title=f"vis-probe-hidden {uuid4().hex[:8]}",
            slug=f"vis-hidden-{uuid4().hex[:8]}",
            published=False,
            editors=[get_user_subject(admin.id)],
        )
        db.session.add_all([visible, hidden])
        db.session.commit()
        visible_id, hidden_id = visible.id, hidden.id
        try:
            records = [
                {"entity_kind": "dashboard", "entity_id": visible_id},
                {"entity_kind": "dashboard", "entity_id": hidden_id},
            ]
            self.login(GAMMA_USERNAME)
            filtered = filter_records_by_visibility(records)
            kept_ids = {r["entity_id"] for r in filtered}

            assert visible_id in kept_ids, (
                "gamma-owned dashboard must stay visible to Gamma"
            )
            assert hidden_id not in kept_ids, (
                "unpublished admin-owned dashboard must be dropped for Gamma"
            )
            # Silent: the dropped record leaves nothing behind (no placeholder).
            assert len(filtered) == 1
        finally:
            db.session.rollback()
            for did in (visible_id, hidden_id):
                obj = db.session.query(Dashboard).filter(Dashboard.id == did).first()
                if obj is not None:
                    db.session.delete(obj)
            db.session.commit()

    # ---- 200 happy paths ----

    def test_activity_returns_200_with_envelope_shape(self) -> None:
        """Smoke test: the endpoint returns the documented envelope shape
        (``result`` list + ``count`` integer) even when the dashboard has
        no activity yet."""
        _persist_fixture_state()
        dashboard = _get_birth_names_dashboard()
        assert dashboard is not None
        dashboard_uuid = str(dashboard.uuid)

        self.login(ADMIN_USERNAME)
        rv = self._activity(dashboard_uuid)
        assert rv.status_code == 200
        body = _json.loads(rv.data.decode("utf-8"))
        assert "result" in body
        assert "count" in body
        assert isinstance(body["result"], list)
        assert isinstance(body["count"], int)

    def test_activity_includes_chart_edit_as_related(self) -> None:
        """T018 / AS-1 of US1: editing a chart on the dashboard surfaces
        the chart-edit record with ``entity_kind=Slice`` and
        ``source=related``."""
        _persist_fixture_state()
        dashboard = _get_birth_names_dashboard()
        assert dashboard is not None
        dashboard_uuid = str(dashboard.uuid)
        chart_on_dashboard = next(iter(dashboard.slices), None)
        assert chart_on_dashboard is not None
        chart_id = chart_on_dashboard.id
        original_name = chart_on_dashboard.slice_name

        try:
            chart_on_dashboard.slice_name = f"{original_name} (edited)"
            db.session.commit()

            self.login(ADMIN_USERNAME)
            rv = self._activity(dashboard_uuid)
            assert rv.status_code == 200
            body = _json.loads(rv.data.decode("utf-8"))
            related = [
                r
                for r in body["result"]
                if r["entity_kind"] == "chart" and r["source"] == "related"
            ]
            assert related, (
                "Expected at least one Slice/related record from the chart "
                "edit; got: "
                f"{[(r['entity_kind'], r['source']) for r in body['result']]}"
            )
            # Spot-check the carry-through of denormalized fields
            sample = related[0]
            assert sample["entity_uuid"] is not None
            assert "transaction_id" in sample
            assert "issued_at" in sample
        finally:
            db.session.rollback()
            chart = db.session.query(Slice).filter(Slice.id == chart_id).one()
            chart.slice_name = original_name
            db.session.commit()

    def test_activity_include_self_excludes_related(self) -> None:
        """T023 / AV-016: ``?include=self`` filters out related records."""
        _persist_fixture_state()
        dashboard = _get_birth_names_dashboard()
        assert dashboard is not None
        dashboard_uuid = str(dashboard.uuid)
        chart_on_dashboard = next(iter(dashboard.slices), None)
        assert chart_on_dashboard is not None
        chart_id = chart_on_dashboard.id
        original_name = chart_on_dashboard.slice_name

        try:
            chart_on_dashboard.slice_name = f"{original_name} (edited self)"
            db.session.commit()

            self.login(ADMIN_USERNAME)
            rv = self._activity(dashboard_uuid, include="self")
            assert rv.status_code == 200
            body = _json.loads(rv.data.decode("utf-8"))
            for record in body["result"]:
                assert record["source"] == "self", (
                    f"include=self leaked a non-self record: {record}"
                )
                assert record["entity_kind"] == "dashboard"
        finally:
            db.session.rollback()
            chart = db.session.query(Slice).filter(Slice.id == chart_id).one()
            chart.slice_name = original_name
            db.session.commit()

    def test_activity_include_related_excludes_self(self) -> None:
        """T024 / AV-016: ``?include=related`` returns only related records."""
        _persist_fixture_state()
        dashboard = _get_birth_names_dashboard()
        assert dashboard is not None
        dashboard_uuid = str(dashboard.uuid)
        original_title = dashboard.dashboard_title
        dashboard_id = dashboard.id
        chart_id: int | None = None
        chart_original_name: str | None = None

        try:
            # Edit the dashboard's own field so we have a self record to
            # filter out, and edit a chart on it so we have a related
            # record to keep.
            dashboard.dashboard_title = f"{original_title} (edited dash)"
            db.session.commit()
            chart_on_dashboard = next(iter(dashboard.slices), None)
            assert chart_on_dashboard is not None
            chart_id = chart_on_dashboard.id
            chart_original_name = chart_on_dashboard.slice_name
            chart_on_dashboard.slice_name = f"{chart_original_name} (edited chart)"
            db.session.commit()

            self.login(ADMIN_USERNAME)
            rv = self._activity(dashboard_uuid, include="related")
            assert rv.status_code == 200
            body = _json.loads(rv.data.decode("utf-8"))
            for record in body["result"]:
                assert record["source"] == "related", (
                    f"include=related leaked a self record: {record}"
                )
                assert record["entity_kind"] != "dashboard"
        finally:
            db.session.rollback()
            dashboard = (
                db.session.query(Dashboard).filter(Dashboard.id == dashboard_id).one()
            )
            dashboard.dashboard_title = original_title
            if chart_id is not None and chart_original_name is not None:
                chart = db.session.query(Slice).filter(Slice.id == chart_id).one()
                chart.slice_name = chart_original_name
            db.session.commit()

    def test_activity_pagination_clamps_oversized_page_size(self) -> None:
        """``?page_size=500`` is silently clamped to the contract max
        (200) rather than rejected with 400."""
        _persist_fixture_state()
        dashboard = _get_birth_names_dashboard()
        assert dashboard is not None
        self.login(ADMIN_USERNAME)
        rv = self._activity(str(dashboard.uuid), page_size="500")
        assert rv.status_code == 200

    def test_activity_ordering_is_stable_by_issued_at_then_transaction_id(self) -> None:
        """T040 / AV-006: records are ordered ``(issued_at DESC,
        transaction_id DESC)``. When two records share ``issued_at`` the
        tie-break is ``transaction_id`` — never random. We verify this by
        asserting the result list is monotonically non-increasing on the
        composite key, which would only hold under deterministic
        ordering."""
        _persist_fixture_state()
        dashboard = _get_birth_names_dashboard()
        assert dashboard is not None
        self.login(ADMIN_USERNAME)
        rv = self._activity(str(dashboard.uuid))
        assert rv.status_code == 200
        body = _json.loads(rv.data.decode("utf-8"))
        records = body["result"]
        # Each pair of adjacent records must satisfy (prev >= cur) on the
        # composite (issued_at, transaction_id) — DESC ordering.
        # ``records[1:]`` is intentionally one element shorter than
        # ``records``; strict=False is the correct semantic for an
        # adjacent-pair iteration.
        for prev, cur in zip(records, records[1:], strict=False):
            assert (prev["issued_at"], prev["transaction_id"]) >= (
                cur["issued_at"],
                cur["transaction_id"],
            ), (
                f"Ordering broke at adjacent pair: "
                f"prev=({prev['issued_at']}, {prev['transaction_id']}) "
                f"cur=({cur['issued_at']}, {cur['transaction_id']})"
            )

    def test_activity_page_size_caps_returned_records_at_200(self) -> None:
        """T041: ``?page_size=500`` must return *at most* 200 records.
        Pairs with the no-400 check above: that test confirms the
        oversized request is accepted, this test confirms the response
        is bounded as the contract guarantees (AV-019 / spec
        ActivityResponseSchema documentation)."""
        _persist_fixture_state()
        dashboard = _get_birth_names_dashboard()
        assert dashboard is not None
        self.login(ADMIN_USERNAME)
        rv = self._activity(str(dashboard.uuid), page_size="500")
        assert rv.status_code == 200
        body = _json.loads(rv.data.decode("utf-8"))
        assert len(body["result"]) <= 200, (
            f"page_size=500 returned {len(body['result'])} records; "
            "cap is 200 per the OpenAPI schema"
        )

    def test_activity_marks_hard_deleted_chart_with_tombstone(self) -> None:
        """T042 / D-15: when a chart was on the dashboard and has since
        been hard-deleted, the chart's historical change records still
        surface in the dashboard's activity stream, marked with
        ``entity_deleted: true`` and ``entity_uuid: null``. Because a
        tombstoned related entity has no live row to access-gate, its
        identifying metadata is redacted: ``entity_name`` is blanked,
        ``summary`` collapses to a generic "(deleted) <kind>" marker, and
        ``changed_by`` (plus the diff values) are dropped — the record
        still marks WHEN a change happened without disclosing WHAT, WHO,
        or WHICH entity to a requester entitled only to the dashboard.

        Hard-delete pattern: edit the chart (creates a Slice change
        record), commit, then ``db.session.delete(chart); commit``.
        Continuum end-stamps the M2M row but does not cascade-delete
        the shadow rows, so the history is still reachable. The
        activity-view's tombstone check (``_check_entity_tombstones``)
        detects the missing live row and stamps the record."""
        _persist_fixture_state()
        dashboard = _get_birth_names_dashboard()
        assert dashboard is not None
        dashboard_uuid = str(dashboard.uuid)
        chart_to_delete = (
            db.session.query(Slice).filter(Slice.slice_name == "Girls").first()
        )
        assert chart_to_delete is not None
        original_name = chart_to_delete.slice_name

        try:
            # Step 1: generate a chart-edit change record for "Girls".
            chart_to_delete.slice_name = f"{original_name} (pre-delete edit)"
            db.session.commit()

            # Step 2: hard-delete the chart. The fixture's _cleanup will
            # tolerate this — its `Slice.id.in_(slice_ids)` filter
            # silently skips the missing row.
            db.session.delete(chart_to_delete)
            db.session.commit()

            self.login(ADMIN_USERNAME)
            rv = self._activity(dashboard_uuid)
            assert rv.status_code == 200
            body = _json.loads(rv.data.decode("utf-8"))
            tombstoned = [
                r
                for r in body["result"]
                if r["entity_kind"] == "chart" and r["entity_deleted"] is True
            ]
            seen = [
                (r["entity_kind"], r["entity_deleted"]) for r in body["result"][:10]
            ]
            assert tombstoned, (
                "Expected ≥1 tombstoned Slice record after the chart was "
                f"hard-deleted; got entity_deleted values: {seen}"
            )
            sample = tombstoned[0]
            got_uuid = sample["entity_uuid"]
            assert got_uuid is None, (
                f"Hard-deleted entity should have null entity_uuid; got {got_uuid!r}"
            )
            # A tombstoned related entity cannot be access-gated, so its
            # identifying metadata is redacted rather than recovered.
            assert sample["entity_name"] == "", (
                f"deleted entity_name should be redacted to ''; got {sample!r}"
            )
            assert sample["summary"].startswith("(deleted)"), (
                "deleted record should carry a generic '(deleted) <kind>' "
                f"headline; got {sample!r}"
            )
            assert sample["changed_by"] is None, (
                f"deleted record should redact changed_by; got {sample!r}"
            )
        finally:
            db.session.rollback()

    def test_check_entity_tombstones_handles_multiple_kinds(self) -> None:
        """Regression for the v4 indent slip in ``check_entity_tombstones``:
        when called with ``distinct_entities`` spanning multiple kinds,
        every kind must get its tombstone-state result, not just the
        one iterated last.

        Pre-fix, the per-entity result-population block sat outside the
        ``for api_kind in by_kind.items():`` loop, so all but the
        last-iterated kind silently fell through to the call-site
        default ``{"deleted": True}`` in ``render.apply_record_decoration``
        — live entities were rendered as tombstoned in the API response.
        The previous tombstone test exercised only one kind, so dict
        iteration order made the bug invisible.
        """
        # pylint: disable=import-outside-toplevel
        from superset.versioning.activity.queries import check_entity_tombstones

        _persist_fixture_state()
        chart = db.session.query(Slice).filter(Slice.slice_name == "Girls").first()
        dataset = _get_birth_names_dataset()
        assert chart is not None
        assert dataset is not None

        distinct = {("Slice", chart.id), ("SqlaTable", dataset.id)}
        result = check_entity_tombstones(distinct)

        assert ("Slice", chart.id) in result, (
            "Multi-kind call must populate every kind; got keys: "
            f"{sorted(result.keys())}"
        )
        assert ("SqlaTable", dataset.id) in result
        assert result[("Slice", chart.id)] == {
            "deleted": False,
            "deletion_state": None,
        }, f"Live chart should report deleted=False; got {result[('Slice', chart.id)]}"
        assert result[("SqlaTable", dataset.id)] == {
            "deleted": False,
            "deletion_state": None,
        }, (
            f"Live dataset should report deleted=False; "
            f"got {result[('SqlaTable', dataset.id)]}"
        )

    @pytest.mark.skip(
        reason="Depends on the retention prune (_prune_old_versions_impl), which "
        "was extracted to sc-111099-version-history-retention. This test "
        "exercises activity-view + retention together and runs once both PRs "
        "merge; un-skip then."
    )
    def test_activity_excludes_records_after_retention_prune(self) -> None:
        """T051 / AV-010: retention bounds the activity feed. After
        ``_prune_old_versions_impl`` drops shadow / change-record rows
        whose ``version_transaction.issued_at`` is older than the
        retention cutoff, the activity stream stops surfacing them.

        Test pattern: capture the highest ``version_transaction.id``
        before our edits, edit a chart (creating a new transaction),
        backdate that transaction's ``issued_at`` past the retention
        cutoff, run the prune, and assert the chart-edit no longer
        appears in the activity stream."""
        # pylint: disable=import-outside-toplevel
        from datetime import datetime, timedelta

        import sqlalchemy as sa
        from sqlalchemy_continuum import versioning_manager

        from superset.tasks.version_history_retention import (
            _prune_old_versions_impl,
        )

        _persist_fixture_state()
        dashboard = _get_birth_names_dashboard()
        assert dashboard is not None
        dashboard_uuid = str(dashboard.uuid)
        chart = db.session.query(Slice).filter(Slice.slice_name == "Boys").first()
        assert chart is not None
        chart_id = chart.id
        original_name = chart.slice_name

        tx_table = versioning_manager.transaction_cls.__table__

        # Capture pre-edit max tx_id so we can identify the rows produced
        # by THIS test (and not backdate anything else).
        max_tx_before = (
            db.session.connection()
            .execute(sa.select(sa.func.max(tx_table.c.id)))
            .scalar()
            or 0
        )

        try:
            chart.slice_name = f"{original_name} (retention test)"
            db.session.commit()

            # Backdate the new transactions to before the 30-day cutoff.
            old_timestamp = datetime.utcnow() - timedelta(days=60)
            db.session.connection().execute(
                sa.update(tx_table)
                .where(tx_table.c.id > max_tx_before)
                .values(issued_at=old_timestamp)
            )
            db.session.commit()

            # Snapshot the activity-record count BEFORE the prune. With
            # ?page_size=200 + the highest possible page coverage, the
            # count field is the post-visibility filtered total.
            self.login(ADMIN_USERNAME)
            rv_before = self._activity(dashboard_uuid, page_size="200")
            assert rv_before.status_code == 200
            count_before = _json.loads(rv_before.data.decode("utf-8"))["count"]

            # Run the prune. The backdated tx rows are now > 30 days old
            # and should be deleted. AV-010 requires the prune to remove
            # at least the backdated transaction(s) we created.
            stats = _prune_old_versions_impl(retention_days=30)
            assert stats.get("pruned_transactions", 0) >= 1, (
                f"Prune should have removed our backdated tx; stats={stats}"
            )

            # After the prune, the activity endpoint still works and the
            # filtered count has DROPPED — change records joined to the
            # pruned transactions are no longer in the result set (the
            # join in _fetch_change_records drops them).
            rv_after = self._activity(dashboard_uuid, page_size="200")
            assert rv_after.status_code == 200
            count_after = _json.loads(rv_after.data.decode("utf-8"))["count"]
            assert count_after < count_before, (
                f"Activity count should decrease after prune; "
                f"before={count_before} after={count_after}"
            )
        finally:
            db.session.rollback()
            chart = db.session.query(Slice).filter(Slice.id == chart_id).one()
            chart.slice_name = original_name
            db.session.commit()

    def test_activity_pagination_is_deterministic_and_disjoint(self) -> None:
        """T039 / SC-AV-002 (pragmatic interpretation): two consecutive
        requests for the same page return identical results, and
        consecutive pages do not overlap.

        The spec's stricter "no skip/duplicate under concurrent writes"
        is unprovable with offset pagination — new top-inserted records
        shift every later page by one. Cursor pagination would solve
        this and is deferred per plan §D-10. Under THIS pagination
        scheme, the testable guarantees are: (a) the same request fired
        twice produces the same page (request determinism), and (b)
        page N and page N+1 share no record under the same request
        round. Both come from the stable
        ``(issued_at DESC, transaction_id DESC, sequence DESC)`` sort.
        """
        _persist_fixture_state()
        dashboard = _get_birth_names_dashboard()
        assert dashboard is not None
        dashboard_uuid = str(dashboard.uuid)
        self.login(ADMIN_USERNAME)

        rv1a = self._activity(dashboard_uuid, page="0", page_size="25")
        rv1b = self._activity(dashboard_uuid, page="0", page_size="25")
        rv2 = self._activity(dashboard_uuid, page="1", page_size="25")
        assert rv1a.status_code == 200
        assert rv1b.status_code == 200
        assert rv2.status_code == 200

        page0_first = _json.loads(rv1a.data.decode("utf-8"))["result"]
        page0_second = _json.loads(rv1b.data.decode("utf-8"))["result"]
        page1 = _json.loads(rv2.data.decode("utf-8"))["result"]

        # (a) Request determinism: same page twice → same records in same
        #     order. Use (entity_kind, entity_id_internal_proxy, tx, seq)
        #     fingerprint — entity_uuid + transaction_id is sufficient
        #     since entity_id isn't in the API contract.
        fingerprint = lambda r: (  # noqa: E731
            r["entity_kind"],
            r["entity_uuid"],
            r["transaction_id"],
            r["kind"],
            tuple(r["path"]) if r["path"] else (),
        )
        assert [fingerprint(r) for r in page0_first] == [
            fingerprint(r) for r in page0_second
        ], "page=0 fired twice returned different records"

        # (b) Page 0 and page 1 are disjoint under one request round.
        page0_keys = {fingerprint(r) for r in page0_first}
        page1_keys = {fingerprint(r) for r in page1}
        overlap = page0_keys & page1_keys
        assert not overlap, f"page=0 and page=1 returned overlapping records: {overlap}"

    @pytest.mark.skip(
        reason="Restore endpoint ships in a later PR; re-enable when restore "
        "lands. The activity layer's restore-event rendering is unit-tested."
    )
    def test_activity_surfaces_dashboard_restore_event(self) -> None:
        """T044 / AV-015: restoring a dashboard to a prior version surfaces
        a synthetic ``kind='__meta__'`` headline record (path
        ``['__meta__', 'restore']``, ``to_value`` carrying the restored-to
        version_uuid) in the dashboard's own activity stream
        (``source='self'``). The headline is emitted by the restore
        command via the listener's ACTION_META_KEY (PR #40988 feedback);
        the activity layer passes it through without special-casing.

        Uses a fresh dashboard: the shared fixture dashboard accumulates
        membership history on a persistent DB, so its restore transaction
        can carry more records than one page — burying the headline
        (sequence 0 sorts last under the stream's sequence-DESC order).
        """
        _persist_fixture_state()
        dashboard = Dashboard(
            dashboard_title=f"restore probe {uuid4().hex[:8]}", published=False
        )
        db.session.add(dashboard)
        db.session.commit()
        dashboard_uuid = str(dashboard.uuid)
        dashboard_id = dashboard.id
        original_title = dashboard.dashboard_title

        try:
            # Two edits → at least two restorable prior versions.
            dashboard.dashboard_title = f"{original_title} v1"
            db.session.commit()
            dashboard.dashboard_title = f"{original_title} v2"
            db.session.commit()

            self.login(ADMIN_USERNAME)
            # Find a prior version to restore to (version_number 0 is the
            # baseline; we restore to whichever earlier version the list
            # endpoint surfaces).
            versions_rv = self.client.get(
                f"/api/v1/dashboard/{dashboard_uuid}/versions/"
            )
            assert versions_rv.status_code == 200, versions_rv.data
            versions = _json.loads(versions_rv.data.decode("utf-8"))["result"]
            assert len(versions) >= 2, f"expected ≥2 versions, got {versions}"
            target_version_uuid = versions[0]["version_uuid"]  # earliest

            # Restore. The endpoint commits; finally clean up below.
            restore_rv = self.client.post(
                f"/api/v1/dashboard/{dashboard_uuid}"
                f"/versions/{target_version_uuid}/restore"
            )
            assert restore_rv.status_code == 200, restore_rv.data

            # Activity stream should now show the restore headline on the
            # dashboard itself.
            rv = self._activity(dashboard_uuid, include="self")
            assert rv.status_code == 200
            body = _json.loads(rv.data.decode("utf-8"))
            restore_records = [
                r
                for r in body["result"]
                if r["kind"] == "__meta__"
                and r["path"] == ["__meta__"]
                and r["entity_kind"] == "dashboard"
            ]
            assert restore_records, (
                "Expected a __meta__ restore headline record; "
                f"got kinds: {[r['kind'] for r in body['result'][:10]]}"
            )
            assert restore_records[0]["to_value"]["version_uuid"] == target_version_uuid
            # The headline is the one self record whose summary renders:
            # "restored to version N" must be visible on include=self.
            assert "restored to version" in restore_records[0]["summary"]
        finally:
            db.session.rollback()
            dashboard = (
                db.session.query(Dashboard)
                .filter(Dashboard.id == dashboard_id)
                .one_or_none()
            )
            if dashboard is not None:
                db.session.delete(dashboard)
                db.session.commit()

    def test_activity_marks_first_tracked_save(self) -> None:
        """Every record carries ``first_tracked_save``: True only on the
        entity's FIRST tracked save. Clients collapse such transactions —
        a legacy chart's first Explore save can replay ~74 params-
        normalization deltas against the retroactive baseline
        (PR #40988 feedback).

        Uses a fresh dashboard so the entity's history is fully
        controlled by this test (the shared fixture dashboard's first
        save belongs to whichever suite ran first on a persistent DB).
        """
        _persist_fixture_state()
        dashboard = Dashboard(
            dashboard_title=f"fts probe {uuid4().hex[:8]}", published=False
        )
        db.session.add(dashboard)
        db.session.commit()  # op=0 INSERT baseline — no change records
        dashboard_uuid = str(dashboard.uuid)
        dashboard_id = dashboard.id

        try:
            dashboard.dashboard_title = f"{dashboard.dashboard_title} v1"
            db.session.commit()  # first tracked save
            dashboard.dashboard_title = f"{dashboard.dashboard_title} v2"
            db.session.commit()  # second save

            self.login(ADMIN_USERNAME)
            rv = self._activity(dashboard_uuid, include="self")
            assert rv.status_code == 200
            records = _json.loads(rv.data.decode("utf-8"))["result"]
            assert len(records) >= 2
            assert all("first_tracked_save" in r for r in records), (
                "every record must carry the first_tracked_save marker"
            )
            # Newest-first ordering: the latest save (v2) is never the
            # entity's first tracked save.
            assert records[0]["first_tracked_save"] is False
            # The v1 save's transaction IS flagged. Assert by transaction
            # rather than stream position: under id reuse on a persistent
            # test DB the stream can also carry a previously-deleted
            # entity's records for the same integer id (the marker itself
            # is uuid-aware and immune; the stream's positional tail is
            # not).
            flagged_txs = {
                r["transaction_id"] for r in records if r["first_tracked_save"]
            }
            assert flagged_txs, "no record flagged as the first tracked save"
            newest_tx = records[0]["transaction_id"]
            assert newest_tx not in flagged_txs
        finally:
            db.session.rollback()
            dashboard = (
                db.session.query(Dashboard)
                .filter(Dashboard.id == dashboard_id)
                .one_or_none()
            )
            if dashboard is not None:
                db.session.delete(dashboard)
                db.session.commit()

    def test_activity_q_filters_server_side(self) -> None:
        """``?q=`` searches the FULL history server-side, pre-pagination
        (PR #40988: the panel's client-side search only covered loaded
        pages); ``count`` reflects the matches."""
        _persist_fixture_state()
        dashboard = _get_birth_names_dashboard()
        assert dashboard is not None
        dashboard_uuid = str(dashboard.uuid)
        dashboard_id = dashboard.id
        original_title = dashboard.dashboard_title
        needle = f"qprobe{uuid4().hex[:6]}"

        try:
            dashboard.dashboard_title = f"{original_title} {needle}"
            db.session.commit()

            self.login(ADMIN_USERNAME)
            rv = self._activity(dashboard_uuid, q=needle)
            assert rv.status_code == 200
            body = _json.loads(rv.data.decode("utf-8"))
            assert body["count"] >= 1
            assert all(needle in _json.dumps(r).lower() for r in body["result"]), (
                f"non-matching record returned for q={needle!r}"
            )

            # A needle that matches nothing returns an empty, zero-count
            # envelope — not an error.
            rv_none = self._activity(dashboard_uuid, q="zz-no-such-needle-zz")
            body_none = _json.loads(rv_none.data.decode("utf-8"))
            assert body_none == {"result": [], "count": 0, "truncated": False}
        finally:
            db.session.rollback()
            dashboard = (
                db.session.query(Dashboard).filter(Dashboard.id == dashboard_id).one()
            )
            dashboard.dashboard_title = original_title
            db.session.commit()


class TestChartActivityView(SupersetTestCase):
    """T028–T032 — ``GET /api/v1/chart/<uuid>/activity/`` (US2).

    Chart activity = chart's own edits + datasets the chart pointed at
    during association. **No** dashboard records — even when the chart
    is on a dashboard, sibling-traversal is excluded per the spec's
    Relationship Traversal section (T032).
    """

    @pytest.fixture(autouse=True)
    def _load_data(self, load_birth_names_dashboard_with_slices):  # noqa: PT004, F811
        pass

    def _activity(self, chart_uuid: str, **query: Any) -> Any:
        return self.client.get(
            f"/api/v1/chart/{chart_uuid}/activity/",
            query_string=query,
        )

    def _get_birth_names_chart(self) -> Slice:
        return db.session.query(Slice).filter(Slice.slice_name == "Girls").first()

    # ---- 4xx boundary cases ----

    def test_chart_activity_returns_404_for_unknown_uuid(self) -> None:
        self.login(ADMIN_USERNAME)
        rv = self._activity("00000000-0000-0000-0000-000000000000")
        assert rv.status_code == 404

    def test_chart_activity_returns_400_for_invalid_uuid(self) -> None:
        self.login(ADMIN_USERNAME)
        rv = self._activity("not-a-uuid")
        assert rv.status_code == 400

    def test_chart_activity_returns_400_for_invalid_include(self) -> None:
        _persist_fixture_state()
        chart = self._get_birth_names_chart()
        assert chart is not None
        self.login(ADMIN_USERNAME)
        rv = self._activity(str(chart.uuid), include="upstream")
        assert rv.status_code == 400

    def test_chart_activity_allows_read_non_owner(self) -> None:
        """Same shape as the dashboard endpoint: a read-access non-owner
        (Alpha) can read a chart's activity, so ``raise_for_access(chart=)``
        does not reject and the endpoint returns 200."""
        _persist_fixture_state()
        chart = self._get_birth_names_chart()
        assert chart is not None
        self.login(ALPHA_USERNAME)
        rv = self._activity(str(chart.uuid))
        assert rv.status_code == 200

    # ---- 200 happy paths ----

    def test_chart_activity_returns_200_with_envelope_shape(self) -> None:
        _persist_fixture_state()
        chart = self._get_birth_names_chart()
        assert chart is not None
        self.login(ADMIN_USERNAME)
        rv = self._activity(str(chart.uuid))
        assert rv.status_code == 200
        body = _json.loads(rv.data.decode("utf-8"))
        assert isinstance(body["result"], list)
        assert isinstance(body["count"], int)

    def test_chart_activity_self_edit_appears_as_self_record(self) -> None:
        """Editing the chart itself surfaces a ``source=self``,
        ``entity_kind=Slice`` record."""
        _persist_fixture_state()
        chart = self._get_birth_names_chart()
        assert chart is not None
        chart_id = chart.id
        chart_uuid = str(chart.uuid)
        original_name = chart.slice_name

        try:
            chart.slice_name = f"{original_name} (edited self)"
            db.session.commit()

            self.login(ADMIN_USERNAME)
            rv = self._activity(chart_uuid)
            assert rv.status_code == 200
            body = _json.loads(rv.data.decode("utf-8"))
            self_records = [
                r
                for r in body["result"]
                if r["entity_kind"] == "chart" and r["source"] == "self"
            ]
            got = [(r["entity_kind"], r["source"]) for r in body["result"]]
            assert self_records, (
                f"Expected ≥1 Slice/self record from the chart edit; got: {got}"
            )
        finally:
            db.session.rollback()
            chart = db.session.query(Slice).filter(Slice.id == chart_id).one()
            chart.slice_name = original_name
            db.session.commit()

    def test_chart_activity_includes_dataset_edit_as_related(self) -> None:
        """T030 / AS-1 of US2: editing the chart's dataset surfaces a
        ``source=related``, ``entity_kind=SqlaTable`` record."""
        _persist_fixture_state()
        chart = self._get_birth_names_chart()
        dataset = _get_birth_names_dataset()
        assert chart is not None
        assert dataset is not None
        chart_uuid = str(chart.uuid)
        dataset_id = dataset.id
        original_description = dataset.description

        try:
            dataset.description = "edited for activity-view test"
            db.session.commit()

            self.login(ADMIN_USERNAME)
            rv = self._activity(chart_uuid)
            assert rv.status_code == 200
            body = _json.loads(rv.data.decode("utf-8"))
            related = [
                r
                for r in body["result"]
                if r["entity_kind"] == "dataset" and r["source"] == "related"
            ]
            assert related, (
                "Expected at least one SqlaTable/related record from the "
                "dataset edit; got: "
                f"{[(r['entity_kind'], r['source']) for r in body['result']]}"
            )
        finally:
            db.session.rollback()
            dataset = (
                db.session.query(SqlaTable).filter(SqlaTable.id == dataset_id).one()
            )
            dataset.description = original_description
            db.session.commit()

    def test_chart_activity_excludes_sibling_dashboards(self) -> None:
        """T032: Even when the chart is on a dashboard, dashboard edits
        do NOT appear in the chart's activity. Per the spec's Relationship
        Traversal section: charts don't see "sideways" to the dashboards
        they happen to be on."""
        _persist_fixture_state()
        chart = self._get_birth_names_chart()
        dashboard = _get_birth_names_dashboard()
        assert chart is not None
        assert dashboard is not None
        chart_uuid = str(chart.uuid)
        dashboard_id = dashboard.id
        original_title = dashboard.dashboard_title

        try:
            # Mutate the dashboard the chart is on — that edit MUST NOT
            # appear in the chart's activity stream.
            dashboard.dashboard_title = f"{original_title} (edited sibling)"
            db.session.commit()

            self.login(ADMIN_USERNAME)
            rv = self._activity(chart_uuid)
            assert rv.status_code == 200
            body = _json.loads(rv.data.decode("utf-8"))
            for record in body["result"]:
                assert record["entity_kind"] != "dashboard", (
                    f"Dashboard edit leaked into chart's activity stream: {record}"
                )
        finally:
            db.session.rollback()
            dashboard = (
                db.session.query(Dashboard).filter(Dashboard.id == dashboard_id).one()
            )
            dashboard.dashboard_title = original_title
            db.session.commit()

    def test_chart_activity_include_self_excludes_related(self) -> None:
        """``?include=self`` filters out the dataset records."""
        _persist_fixture_state()
        chart = self._get_birth_names_chart()
        dataset = _get_birth_names_dataset()
        assert chart is not None
        assert dataset is not None
        chart_uuid = str(chart.uuid)
        dataset_id = dataset.id
        original_description = dataset.description

        try:
            dataset.description = "edited (self filter test)"
            db.session.commit()

            self.login(ADMIN_USERNAME)
            rv = self._activity(chart_uuid, include="self")
            assert rv.status_code == 200
            body = _json.loads(rv.data.decode("utf-8"))
            for record in body["result"]:
                assert record["source"] == "self"
                assert record["entity_kind"] == "chart"
        finally:
            db.session.rollback()
            dataset = (
                db.session.query(SqlaTable).filter(SqlaTable.id == dataset_id).one()
            )
            dataset.description = original_description
            db.session.commit()


class TestDatasetActivityView(SupersetTestCase):
    """T033–T036 — ``GET /api/v1/dataset/<uuid>/activity/`` (US3).

    Dataset activity = dataset's own edits only. **No** transitive layer
    in V2 (AV-004) — even when charts use the dataset, those chart edits
    do NOT appear here. ``?include=related`` and ``?include=all``
    collapse to the same self-only stream as ``?include=self``.
    """

    @pytest.fixture(autouse=True)
    def _load_data(self, load_birth_names_dashboard_with_slices):  # noqa: PT004, F811
        pass

    def _activity(self, dataset_uuid: str, **query: Any) -> Any:
        return self.client.get(
            f"/api/v1/dataset/{dataset_uuid}/activity/",
            query_string=query,
        )

    # ---- 4xx boundary cases ----

    def test_dataset_activity_returns_404_for_unknown_uuid(self) -> None:
        self.login(ADMIN_USERNAME)
        rv = self._activity("00000000-0000-0000-0000-000000000000")
        assert rv.status_code == 404

    def test_dataset_activity_returns_400_for_invalid_uuid(self) -> None:
        self.login(ADMIN_USERNAME)
        rv = self._activity("not-a-uuid")
        assert rv.status_code == 400

    def test_dataset_activity_returns_400_for_invalid_include(self) -> None:
        _persist_fixture_state()
        dataset = _get_birth_names_dataset()
        assert dataset is not None
        self.login(ADMIN_USERNAME)
        rv = self._activity(str(dataset.uuid), include="upstream")
        assert rv.status_code == 400

    def test_dataset_activity_allows_read_non_owner(self) -> None:
        """A read-access non-owner (Alpha) can read a dataset's activity
        stream, so the read endpoint returns 200."""
        _persist_fixture_state()
        dataset = _get_birth_names_dataset()
        assert dataset is not None
        self.login(ALPHA_USERNAME)
        rv = self._activity(str(dataset.uuid))
        assert rv.status_code == 200

    # ---- 200 happy paths ----

    def test_dataset_activity_returns_200_with_envelope_shape(self) -> None:
        _persist_fixture_state()
        dataset = _get_birth_names_dataset()
        assert dataset is not None
        self.login(ADMIN_USERNAME)
        rv = self._activity(str(dataset.uuid))
        assert rv.status_code == 200
        body = _json.loads(rv.data.decode("utf-8"))
        assert isinstance(body["result"], list)
        assert isinstance(body["count"], int)

    def test_dataset_activity_includes_dataset_self_edits(self) -> None:
        """T036: the dataset's own scalar edits appear as ``source=self``,
        ``entity_kind=SqlaTable``."""
        _persist_fixture_state()
        dataset = _get_birth_names_dataset()
        assert dataset is not None
        dataset_id = dataset.id
        dataset_uuid = str(dataset.uuid)
        original_description = dataset.description

        try:
            dataset.description = "edited self for dataset activity"
            db.session.commit()

            self.login(ADMIN_USERNAME)
            rv = self._activity(dataset_uuid)
            assert rv.status_code == 200
            body = _json.loads(rv.data.decode("utf-8"))
            self_records = [
                r
                for r in body["result"]
                if r["entity_kind"] == "dataset" and r["source"] == "self"
            ]
            got = [(r["entity_kind"], r["source"]) for r in body["result"]]
            assert self_records, (
                f"Expected ≥1 SqlaTable/self record from the dataset edit; got: {got}"
            )
        finally:
            db.session.rollback()
            dataset = (
                db.session.query(SqlaTable).filter(SqlaTable.id == dataset_id).one()
            )
            dataset.description = original_description
            db.session.commit()

    def test_dataset_activity_excludes_chart_edits(self) -> None:
        """T035 / AS-1 / AV-004: When a chart that uses the dataset is
        edited, that edit does NOT appear in the dataset's activity stream.
        Datasets are read-only upstream in V2."""
        _persist_fixture_state()
        dataset = _get_birth_names_dataset()
        chart = db.session.query(Slice).filter(Slice.slice_name == "Girls").first()
        assert dataset is not None
        assert chart is not None
        dataset_uuid = str(dataset.uuid)
        chart_id = chart.id
        chart_original_name = chart.slice_name

        try:
            # Edit the chart — generates a Slice change record. The
            # dataset's activity MUST NOT surface it.
            chart.slice_name = f"{chart_original_name} (edited from dataset test)"
            db.session.commit()

            self.login(ADMIN_USERNAME)
            rv = self._activity(dataset_uuid)
            assert rv.status_code == 200
            body = _json.loads(rv.data.decode("utf-8"))
            for record in body["result"]:
                assert record["entity_kind"] == "dataset", (
                    "Non-dataset record leaked into dataset's activity "
                    f"stream: {record}"
                )
                assert record["source"] == "self", (
                    f"Dataset activity contains a related record: {record}"
                )
        finally:
            db.session.rollback()
            chart = db.session.query(Slice).filter(Slice.id == chart_id).one()
            chart.slice_name = chart_original_name
            db.session.commit()

    def test_dataset_activity_related_only_returns_empty(self) -> None:
        """AV-004: datasets have no transitive layer. ``?include=related``
        returns an empty result list because there are no related entities
        to draw from."""
        _persist_fixture_state()
        dataset = _get_birth_names_dataset()
        assert dataset is not None
        self.login(ADMIN_USERNAME)
        rv = self._activity(str(dataset.uuid), include="related")
        assert rv.status_code == 200
        body = _json.loads(rv.data.decode("utf-8"))
        assert body["result"] == []
        assert body["count"] == 0


class TestActivityOpenApiSpec(SupersetTestCase):
    """T049 — confirm the three ``/activity/`` endpoints are surfaced by
    FAB-generated OpenAPI at ``/api/v1/_openapi``.

    ``base_api_tests.py::TestOpenApiSpec::test_open_api_spec`` already
    validates the full spec's YAML correctness on every CI run. This
    class adds activity-specific assertions: the paths exist, are
    documented with the expected query parameters, and reference an
    ``ActivityResponse``-shaped 200 response.
    """

    def _spec(self) -> dict[str, Any]:
        self.login(ADMIN_USERNAME)
        rv = self.client.get("/api/v1/_openapi")
        assert rv.status_code == 200, rv.status_code
        return _json.loads(rv.data.decode("utf-8"))

    def test_three_activity_paths_appear_in_openapi(self) -> None:
        """One path per endpoint family. Paths are keyed by the URL
        template, not the method name, so the FAB-generated keys are
        the ``/<uuid_str>/activity/`` route templates."""
        spec = self._spec()
        paths = spec.get("paths", {})
        # FAB templates the path-arg as ``{uuid_str}`` in the OpenAPI dict.
        expected = {
            "/api/v1/dashboard/{uuid_str}/activity/",
            "/api/v1/chart/{uuid_str}/activity/",
            "/api/v1/dataset/{uuid_str}/activity/",
        }
        missing = expected - paths.keys()
        assert not missing, f"missing activity paths in OpenAPI: {missing}"

    def test_activity_endpoints_document_query_params(self) -> None:
        """Each endpoint declares since / until / include / page /
        page_size as query parameters. Spot-check on the dashboard
        endpoint — the YAML docstring is the same shape across all
        three so this assertion is sufficient."""
        spec = self._spec()
        op = spec["paths"]["/api/v1/dashboard/{uuid_str}/activity/"]["get"]
        params = {p["name"]: p for p in op.get("parameters", [])}
        for expected in ("since", "until", "include", "page", "page_size"):
            assert expected in params, (
                f"query param {expected!r} missing from dashboard /activity/"
            )
        # include enum is the published contract — verify it's correct.
        include_param = params["include"]
        assert include_param["in"] == "query"
        assert set(include_param["schema"]["enum"]) == {"self", "related", "all"}

    def test_activity_endpoints_declare_200_response(self) -> None:
        """Each endpoint declares a 200 response. The exact schema
        reference depends on how FAB resolves ``schema: ActivityResponseSchema``
        in the YAML docstring; here we just confirm the 200 + the 4xx
        error responses are all present."""
        spec = self._spec()
        op = spec["paths"]["/api/v1/dashboard/{uuid_str}/activity/"]["get"]
        responses = op.get("responses", {})
        for code in ("200", "400", "401", "403", "404"):
            assert code in responses, (
                f"response code {code} missing on dashboard /activity/"
            )
