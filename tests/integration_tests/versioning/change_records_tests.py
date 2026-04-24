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
"""Integration tests for ``version_changes`` capture (T052, partial).

Covers in this file:
  (a) saving a chart with three field changes produces three rows
  (f) baseline / INSERT transactions produce zero records *for that entity*
  + unchanged-save / dashboard / params-classification cases

Deferred:
  (b) ``GET /versions/`` response includes ``changes`` array — lands with
      T050 (API integration).
  (c) FK cascade — exercisable in principle (the migration declares
      ``ON DELETE CASCADE``) but can't be isolated in a unit-style test
      because ``version_transaction`` is referenced by non-cascading FKs
      from slices_version / dashboards_version / etc. Covered instead
      by (d) below once it lands, and by the structural declaration in
      T046's migration.
  (d) retention prune drops change records alongside the pruned
      version — will land when T049 extends ``VersionDAO.prune_versions``
      to include ``version_changes`` alongside the shadow-row delete.
  (e) ``kind`` index query plan on Postgres — deferred to T053 perf
      validation.
"""

from __future__ import annotations

from typing import Any

import pytest
import sqlalchemy as sa
from sqlalchemy_continuum import version_class

from superset.extensions import db
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import json as _json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.birth_names_dashboard import (  # noqa: F401
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)

_VERSION_CHANGES = sa.table(
    "version_changes",
    sa.column("id"),
    sa.column("transaction_id"),
    sa.column("entity_kind"),
    sa.column("entity_id"),
    sa.column("sequence"),
    sa.column("kind"),
    sa.column("path"),
    sa.column("from_value"),
    sa.column("to_value"),
)


def _change_rows_for(
    tx_id: int,
    *,
    entity_kind: str | None = None,
    entity_id: int | None = None,
) -> list[dict[str, Any]]:
    """Raw fetch of ``version_changes`` rows for a tx + optional entity filter."""
    query = sa.select(_VERSION_CHANGES).where(
        _VERSION_CHANGES.c.transaction_id == tx_id
    )
    if entity_kind is not None:
        query = query.where(_VERSION_CHANGES.c.entity_kind == entity_kind)
    if entity_id is not None:
        query = query.where(_VERSION_CHANGES.c.entity_id == entity_id)
    query = query.order_by(_VERSION_CHANGES.c.sequence.asc())
    result = db.session.connection().execute(query)
    return [dict(row._mapping) for row in result]


def _persist_fixture_state() -> None:
    """Commit fixture INSERTs so the baseline row exists before the test edits.

    Without this, the test's first commit batches the fixture's pending
    INSERTs with the test's UPDATE into a single Continuum transaction
    and no diff records are emitted (no pre-state).
    """
    db.session.commit()


class TestChartChangeRecords(SupersetTestCase):
    """Change-record capture for chart (Slice) saves."""

    @pytest.fixture(autouse=True)
    def _load_data(self, load_birth_names_dashboard_with_slices):  # noqa: F811, PT004
        pass

    def test_single_scalar_edit_produces_one_change_record(self) -> None:
        """(a) — one field changed, one ``version_changes`` row."""
        _persist_fixture_state()

        chart = db.session.query(Slice).first()
        assert chart is not None
        chart.slice_name = f"{chart.slice_name[:64]}_renamed"
        db.session.commit()

        # The save produces one new version row (the UPDATE). Fetch its tx_id.
        ver_cls = version_class(Slice)
        update_tx_id = (
            db.session.query(ver_cls.transaction_id)
            .filter(ver_cls.id == chart.id)
            .filter(ver_cls.operation_type == 1)
            .order_by(ver_cls.transaction_id.desc())
            .first()
            .transaction_id
        )

        rows = _change_rows_for(update_tx_id, entity_kind="chart", entity_id=chart.id)
        assert len(rows) == 1
        assert rows[0]["kind"] == "field"
        path = (
            _json.loads(rows[0]["path"])
            if isinstance(rows[0]["path"], str)
            else rows[0]["path"]
        )
        assert path == ["slice_name"]
        assert rows[0]["sequence"] == 0

    def test_three_scalar_edits_produce_three_records_in_sequence(self) -> None:
        """(a) — three fields changed, three rows, ``sequence`` 0..2."""
        _persist_fixture_state()

        chart = db.session.query(Slice).first()
        assert chart is not None
        # Derive from CURRENT values so every run guarantees a real
        # change even against a persistent test DB where prior runs
        # have already mutated the chart.
        chart.slice_name = f"{chart.slice_name[:60]}_x"
        chart.description = f"{chart.description or ''}_x"
        chart.cache_timeout = (chart.cache_timeout or 0) + 1
        db.session.commit()

        ver_cls = version_class(Slice)
        update_tx_id = (
            db.session.query(ver_cls.transaction_id)
            .filter(ver_cls.id == chart.id)
            .filter(ver_cls.operation_type == 1)
            .order_by(ver_cls.transaction_id.desc())
            .first()
            .transaction_id
        )
        rows = _change_rows_for(update_tx_id, entity_kind="chart", entity_id=chart.id)
        assert len(rows) == 3
        assert [r["sequence"] for r in rows] == [0, 1, 2]
        # Sorted by field name (diff engine emits in sorted field order)
        paths = [
            _json.loads(r["path"]) if isinstance(r["path"], str) else r["path"]
            for r in rows
        ]
        assert paths == [["cache_timeout"], ["description"], ["slice_name"]]

    def test_params_filter_add_produces_filter_kind_record(self) -> None:
        """(a) — params classification still flows through the listener.

        Adds an adhoc_filter with a natural key (``subject``) derived
        from the chart id so it's unique across test runs on a
        persistent DB. Whatever was in ``adhoc_filters`` before stays;
        we only want to confirm at least one ``kind='filter'`` record
        is emitted.
        """
        _persist_fixture_state()

        chart = db.session.query(Slice).first()
        assert chart is not None
        unique_subject = (
            f"col_{chart.id}_{db.session.connection().engine.url.database[-8:]}"
        )
        params = _json.loads(chart.params or "{}")
        existing = params.get("adhoc_filters", []) or []
        params["adhoc_filters"] = [
            *existing,
            {
                "subject": unique_subject,
                "operator": "==",
                "comparator": "x",
                "expressionType": "SIMPLE",
            },
        ]
        chart.params = _json.dumps(params)
        db.session.commit()

        ver_cls = version_class(Slice)
        update_tx_id = (
            db.session.query(ver_cls.transaction_id)
            .filter(ver_cls.id == chart.id)
            .filter(ver_cls.operation_type == 1)
            .order_by(ver_cls.transaction_id.desc())
            .first()
            .transaction_id
        )
        rows = _change_rows_for(update_tx_id, entity_kind="chart", entity_id=chart.id)
        filter_rows = [r for r in rows if r["kind"] == "filter"]
        assert len(filter_rows) >= 1, (
            f"expected at least one filter record, got rows: {rows}"
        )

    def test_unchanged_save_produces_zero_change_records(self) -> None:
        """An edit that sets fields to identical values emits nothing."""
        _persist_fixture_state()

        chart = db.session.query(Slice).first()
        ver_cls = version_class(Slice)
        # Capture the latest tx_id BEFORE this test's save so we can
        # distinguish "the no-op save produced nothing new" (the intent)
        # from "prior tests left tx rows with records on them" (noise).
        pre_save_tx_row = (
            db.session.query(ver_cls.transaction_id)
            .filter(ver_cls.id == chart.id)
            .filter(ver_cls.operation_type == 1)
            .order_by(ver_cls.transaction_id.desc())
            .first()
        )
        pre_save_tx_id = pre_save_tx_row.transaction_id if pre_save_tx_row else 0

        # Touch the object (mark dirty) but assign the same value.
        current_name = chart.slice_name
        chart.slice_name = current_name
        db.session.commit()

        post_save_tx_row = (
            db.session.query(ver_cls.transaction_id)
            .filter(ver_cls.id == chart.id)
            .filter(ver_cls.operation_type == 1)
            .filter(ver_cls.transaction_id > pre_save_tx_id)
            .order_by(ver_cls.transaction_id.desc())
            .first()
        )
        # Either no new tx at all (nothing dirty, best case), or a new
        # tx with zero change records for this chart.
        if post_save_tx_row is not None:
            assert (
                _change_rows_for(
                    post_save_tx_row.transaction_id,
                    entity_kind="chart",
                    entity_id=chart.id,
                )
                == []
            )


class TestDashboardChangeRecords(SupersetTestCase):
    """Same flow for dashboards — all scalar fields land in ``kind='field'``."""

    @pytest.fixture(autouse=True)
    def _load_data(self, load_birth_names_dashboard_with_slices):  # noqa: F811, PT004
        pass

    def test_dashboard_title_edit_produces_field_record(self) -> None:
        _persist_fixture_state()

        dashboard = db.session.query(Dashboard).first()
        assert dashboard is not None
        dashboard.dashboard_title = f"{dashboard.dashboard_title}_rev"
        db.session.commit()

        ver_cls = version_class(Dashboard)
        update_tx_id = (
            db.session.query(ver_cls.transaction_id)
            .filter(ver_cls.id == dashboard.id)
            .filter(ver_cls.operation_type == 1)
            .order_by(ver_cls.transaction_id.desc())
            .first()
            .transaction_id
        )
        rows = _change_rows_for(
            update_tx_id, entity_kind="dashboard", entity_id=dashboard.id
        )
        assert len(rows) >= 1
        field_rows = [r for r in rows if r["kind"] == "field"]
        paths = [
            _json.loads(r["path"]) if isinstance(r["path"], str) else r["path"]
            for r in field_rows
        ]
        assert ["dashboard_title"] in paths


class TestDatasetChildChangeRecords(SupersetTestCase):
    """T048b — column and metric diff records for dataset saves.

    Two snapshots must exist for any child diff to emit: the prior
    save's and the current one. The fixture ``load_birth_names_data``
    has already created the dataset before these tests run; their
    first commit produces snapshot #1. The test's edit produces
    snapshot #2, and the listener diffs the two.
    """

    @pytest.fixture(autouse=True)
    def _load_data(self, load_birth_names_dashboard_with_slices):  # noqa: F811, PT004
        pass

    def test_column_description_change_produces_column_record(self) -> None:
        # pylint: disable=import-outside-toplevel
        from sqlalchemy_continuum import version_class

        from superset.connectors.sqla.models import SqlaTable

        _persist_fixture_state()

        dataset = (
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name == "birth_names")
            .first()
        )
        assert dataset is not None
        assert dataset.columns, "birth_names fixture should produce columns"
        # First save establishes snapshot #1 (the pre-edit state).
        # Scalar + child diffs won't emit anything yet because there's
        # no prior snapshot to diff against.
        dataset.description = f"{dataset.description or ''}_v1"
        db.session.commit()
        # Second save: edit a column AND touch a dataset scalar so
        # the parent SqlaTable ends up in session.dirty. In real
        # flows DatasetDAO.update_columns() marks the parent via its
        # individual session.add / session.delete calls (T011); the
        # direct-ORM test here needs an explicit parent touch.
        column = dataset.columns[0]
        column.description = f"{column.description or ''}_edited"
        dataset.description = f"{dataset.description}_v2"
        db.session.commit()

        ver_cls = version_class(SqlaTable)
        latest_tx_id = (
            db.session.query(ver_cls.transaction_id)
            .filter(ver_cls.id == dataset.id)
            .filter(ver_cls.operation_type == 1)
            .order_by(ver_cls.transaction_id.desc())
            .first()
            .transaction_id
        )
        rows = _change_rows_for(
            latest_tx_id, entity_kind="dataset", entity_id=dataset.id
        )
        column_rows = [r for r in rows if r["kind"] == "column"]
        assert len(column_rows) >= 1, (
            f"expected at least one kind='column' record, got {rows}"
        )


class TestBaselineProducesZeroChangeRecords(SupersetTestCase):
    """(f) — operation_type=0 (baseline / INSERT) transactions emit no records."""

    @pytest.fixture(autouse=True)
    def _load_data(self, load_birth_names_dashboard_with_slices):  # noqa: F811, PT004
        pass

    def test_baseline_transaction_has_no_change_records_for_this_entity(
        self,
    ) -> None:
        """(f) — baseline tx produces zero records *for that entity*.

        A single transaction can touch multiple entities (fixture loads,
        import pipelines). A tx that's a baseline for this chart might
        still legitimately carry update records for some *other* entity
        that shared the flush. The spec's M4 clarification means:
        records filtered to this entity's (tx, entity_kind, entity_id)
        are empty for its baseline tx.
        """
        _persist_fixture_state()

        chart = db.session.query(Slice).first()
        chart.slice_name = f"{chart.slice_name[:64]}_force_baseline"
        db.session.commit()

        ver_cls = version_class(Slice)
        rows_by_tx = (
            db.session.query(ver_cls.transaction_id, ver_cls.operation_type)
            .filter(ver_cls.id == chart.id)
            .order_by(ver_cls.transaction_id.asc())
            .all()
        )
        baseline_tx_ids = [tx for tx, op in rows_by_tx if op == 0]
        assert baseline_tx_ids, "expected at least one baseline version row"

        for tx_id in baseline_tx_ids:
            records_for_this_chart = _change_rows_for(
                tx_id, entity_kind="chart", entity_id=chart.id
            )
            assert records_for_this_chart == [], (
                f"baseline tx {tx_id} unexpectedly has change records for "
                f"chart id={chart.id}: {records_for_this_chart}"
            )
