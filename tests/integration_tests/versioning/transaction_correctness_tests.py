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
"""Transaction-level correctness tests for entity version history."""

from unittest.mock import patch

import pytest
import sqlalchemy as sa

from superset import db
from superset.connectors.sqla.models import SqlaTable
from superset.models.slice import Slice
from superset.utils import json
from superset.versioning.changes import listener
from superset.versioning.changes.listener import ACTION_KIND_KEY
from superset.versioning.changes.table import version_changes_table
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.fixtures.birth_names_dashboard import (  # noqa: F401
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)


def _latest_transaction_id() -> int:
    """Return the latest semantic-history transaction boundary."""
    return db.session.scalar(
        sa.select(
            sa.func.coalesce(sa.func.max(version_changes_table.c.transaction_id), 0)
        )
    )


def _changes_for_chart(
    chart_id: int, *, after_transaction_id: int
) -> list[dict[str, object]]:
    """Return ordered semantic changes captured for one chart."""
    rows = db.session.execute(
        sa.select(version_changes_table)
        .where(version_changes_table.c.entity_kind == "chart")
        .where(version_changes_table.c.entity_id == chart_id)
        .where(version_changes_table.c.transaction_id > after_transaction_id)
        .order_by(
            version_changes_table.c.transaction_id,
            version_changes_table.c.sequence,
        )
    ).mappings()
    return [dict(row) for row in rows]


def _changes_for_dataset(
    dataset_id: int, *, after_transaction_id: int
) -> list[dict[str, object]]:
    """Return ordered semantic changes captured for one dataset."""
    rows = db.session.execute(
        sa.select(version_changes_table)
        .where(version_changes_table.c.entity_kind == "dataset")
        .where(version_changes_table.c.entity_id == dataset_id)
        .where(version_changes_table.c.transaction_id > after_transaction_id)
        .order_by(
            version_changes_table.c.transaction_id,
            version_changes_table.c.sequence,
        )
    ).mappings()
    return [dict(row) for row in rows]


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
class TestVersionHistoryTransactionCorrectness(SupersetTestCase):
    """Verify semantic projections span every flush in one transaction."""

    @staticmethod
    def _chart(name: str) -> Slice:
        chart = db.session.query(Slice).filter(Slice.slice_name == name).one()
        db.session.commit()
        return chart

    def test_same_entity_multiple_flushes_produce_one_net_change(self) -> None:
        """Only the initial-to-final scalar transition is materialized."""
        chart = self._chart("Girls")
        chart_id = chart.id
        boundary = _latest_transaction_id()
        try:
            chart.slice_name = "Girls intermediate"
            db.session.flush()
            chart.slice_name = "Girls final"
            db.session.commit()

            changes = _changes_for_chart(chart_id, after_transaction_id=boundary)
            name_changes = [row for row in changes if row["path"] == ["slice_name"]]
            assert len(name_changes) == 1
            assert name_changes[0]["from_value"] == "Girls"
            assert name_changes[0]["to_value"] == "Girls final"
        finally:
            chart = db.session.get(Slice, chart_id)
            assert chart is not None
            chart.slice_name = "Girls"
            db.session.commit()

    def test_different_entities_across_flushes_share_complete_history(self) -> None:
        """A later entity flush is not discarded from the transaction."""
        girls = self._chart("Girls")
        boys = self._chart("Boys")
        boundary = _latest_transaction_id()
        try:
            girls.slice_name = "Girls transaction edit"
            db.session.flush()
            boys.slice_name = "Boys transaction edit"
            db.session.commit()

            girls_changes = [
                row
                for row in _changes_for_chart(girls.id, after_transaction_id=boundary)
                if row["to_value"] == "Girls transaction edit"
            ]
            boys_changes = [
                row
                for row in _changes_for_chart(boys.id, after_transaction_id=boundary)
                if row["to_value"] == "Boys transaction edit"
            ]
            assert len(girls_changes) == 1
            assert len(boys_changes) == 1
            assert (
                girls_changes[0]["transaction_id"] == boys_changes[0]["transaction_id"]
            )
        finally:
            girls.slice_name = "Girls"
            boys.slice_name = "Boys"
            db.session.commit()

    def test_return_to_initial_state_produces_no_duplicate_change(self) -> None:
        """Intermediate-only edits disappear from the net projection."""
        chart = self._chart("Girls")
        boundary = _latest_transaction_id()
        chart.slice_name = "Girls temporary"
        db.session.flush()
        chart.slice_name = "Girls"
        db.session.commit()

        assert not [
            row
            for row in _changes_for_chart(chart.id, after_transaction_id=boundary)
            if row["path"] == ["slice_name"]
        ]

    def test_child_changes_across_flushes_use_final_shadow_state(self) -> None:
        """A child-only edit projects the final child state on its parent."""
        dataset = (
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name == "birth_names")
            .first()
        )
        assert dataset is not None
        assert dataset.columns
        column = dataset.columns[0]
        original = column.description
        db.session.commit()
        boundary = _latest_transaction_id()
        try:
            column.description = "intermediate child description"
            db.session.flush()
            column.description = "final child description"
            db.session.commit()

            serialized = json.dumps(
                _changes_for_dataset(dataset.id, after_transaction_id=boundary)
            )
            assert "final child description" in serialized
            assert "intermediate child description" not in serialized
        finally:
            column.description = original
            db.session.commit()

    def _assert_nested_transaction_preserves_outer_initial_state(
        self, nested_outcome: str
    ) -> None:
        """SAVEPOINT completion does not clear the outer transaction registry."""
        chart = self._chart("Girls")
        chart_id = chart.id
        boundary = _latest_transaction_id()
        try:
            chart.slice_name = "Girls outer edit"
            db.session.flush()

            nested = db.session.begin_nested()
            chart.slice_name = "Girls nested edit"
            db.session.flush()
            getattr(nested, nested_outcome)()
            db.session.commit()

            changes = [
                row
                for row in _changes_for_chart(chart_id, after_transaction_id=boundary)
                if row["path"] == ["slice_name"]
            ]
            assert len(changes) == 1
            assert changes[0]["from_value"] == "Girls"
            assert changes[0]["to_value"] == (
                "Girls nested edit"
                if nested_outcome == "commit"
                else "Girls outer edit"
            )
        finally:
            chart = db.session.get(Slice, chart_id)
            assert chart is not None
            chart.slice_name = "Girls"
            db.session.commit()

    def test_nested_commit_preserves_outer_initial_state(self) -> None:
        """Committing a SAVEPOINT keeps the outer transaction registry."""
        self._assert_nested_transaction_preserves_outer_initial_state("commit")

    def test_nested_rollback_preserves_outer_initial_state(self) -> None:
        """Rolling back a SAVEPOINT keeps the outer transaction registry."""
        self._assert_nested_transaction_preserves_outer_initial_state("rollback")

    def test_action_kind_sql_failure_is_isolated_and_consumed(self) -> None:
        """Failed descriptive metadata cannot poison or leak from the save."""
        chart = self._chart("Girls")
        chart_id = chart.id
        boundary = db.session.scalar(
            sa.text("SELECT coalesce(max(id), 0) FROM version_transaction")
        )

        def fail_action_kind(*_args: object, **_kwargs: object) -> None:
            db.session.connection().execute(
                sa.text("UPDATE __missing_action_kind_target__ SET value = 1")
            )

        try:
            db.session.info[ACTION_KIND_KEY] = "restore"
            chart.slice_name = "Girls survives action metadata failure"
            with patch.object(listener, "_write_action_kind", fail_action_kind):
                db.session.commit()

            db.session.expire_all()
            saved = db.session.get(Slice, chart_id)
            assert saved is not None
            assert saved.slice_name == "Girls survives action metadata failure"
            assert ACTION_KIND_KEY not in db.session.info

            first_rows = db.session.execute(
                sa.text(
                    "SELECT sv.transaction_id, vt.action_kind "
                    "FROM slices_version sv "
                    "JOIN version_transaction vt ON vt.id = sv.transaction_id "
                    "WHERE sv.id = :id AND sv.operation_type = 1 "
                    "AND sv.slice_name = :name "
                    "AND sv.transaction_id > :boundary"
                ),
                {
                    "id": chart_id,
                    "name": "Girls survives action metadata failure",
                    "boundary": boundary,
                },
            ).all()
            assert len(first_rows) == 1
            assert first_rows[0].action_kind is None
            failed_metadata_tx_id = first_rows[0].transaction_id

            semantic_changes = _changes_for_chart(
                chart_id, after_transaction_id=boundary
            )
            name_changes = [
                row
                for row in semantic_changes
                if row["path"] == ["slice_name"]
                and row["to_value"] == "Girls survives action metadata failure"
            ]
            assert len(name_changes) == 1
            assert name_changes[0]["transaction_id"] == failed_metadata_tx_id

            saved.slice_name = "Girls next transaction"
            db.session.commit()
            next_rows = db.session.execute(
                sa.text(
                    "SELECT vt.action_kind FROM slices_version sv "
                    "JOIN version_transaction vt ON vt.id = sv.transaction_id "
                    "WHERE sv.id = :id AND sv.operation_type = 1 "
                    "AND sv.slice_name = :name "
                    "AND sv.transaction_id > :boundary"
                ),
                {
                    "id": chart_id,
                    "name": "Girls next transaction",
                    "boundary": failed_metadata_tx_id,
                },
            ).all()
            assert len(next_rows) == 1
            assert next_rows[0].action_kind is None
        finally:
            chart = db.session.get(Slice, chart_id)
            assert chart is not None
            chart.slice_name = "Girls"
            db.session.commit()
