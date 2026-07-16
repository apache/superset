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
"""Shared base + self-contained builders for deletion-retention tests.

These tests do not depend on the example datasets — each builds its own
``Database`` + ``SqlaTable`` so they run on a bare (schema-only) test DB.
Everything created is torn down (bypassing the soft-delete visibility
filter) so a leftover soft-deleted row never trips a later test.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Optional

import sqlalchemy as sa

from superset import db
from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.constants import SKIP_VISIBILITY_FILTER_CLASSES
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from tests.integration_tests.base_tests import SupersetTestCase

_PREFIX = "retention_it_"


def _bypass(model: type) -> dict[str, Any]:
    return {"execution_options": {SKIP_VISIBILITY_FILTER_CLASSES: {model}}}


class DeletionRetentionTestBase(SupersetTestCase):
    """Builds an isolated database + dataset and cleans up after itself."""

    def setUp(self) -> None:
        super().setUp()
        self._cleanup()
        self.database = Database(
            database_name=f"{_PREFIX}db", sqlalchemy_uri="sqlite://"
        )
        db.session.add(self.database)
        db.session.commit()
        self.dataset = self.make_dataset("ds")

    def tearDown(self) -> None:
        self._cleanup()
        super().tearDown()

    # -- builders -----------------------------------------------------------

    def make_dataset(self, name: str, with_children: bool = False) -> SqlaTable:
        ds = SqlaTable(table_name=f"{_PREFIX}{name}", database=self.database)
        db.session.add(ds)
        db.session.commit()
        if with_children:
            db.session.add(TableColumn(column_name=f"{_PREFIX}col", table=ds))
            db.session.add(
                SqlMetric(
                    metric_name=f"{_PREFIX}metric", expression="count(*)", table=ds
                )
            )
            db.session.commit()
        return ds

    def make_chart(self, name: str, dataset: Optional[SqlaTable] = None) -> Slice:
        dataset = dataset or self.dataset
        chart = Slice(
            slice_name=f"{_PREFIX}{name}",
            datasource_type="table",
            datasource_id=dataset.id,
            viz_type="table",
        )
        db.session.add(chart)
        db.session.commit()
        return chart

    def make_dashboard(
        self, name: str, slices: Optional[list[Slice]] = None
    ) -> Dashboard:
        dash = Dashboard(
            dashboard_title=f"{_PREFIX}{name}",
            slug=f"{_PREFIX}{name}",
            slices=slices or [],
        )
        db.session.add(dash)
        db.session.commit()
        return dash

    def soft_delete(self, entity: Any, days_ago: int) -> None:
        """Mark *entity* soft-deleted with a backdated ``deleted_at``."""
        entity.deleted_at = datetime.now() - timedelta(days=days_ago)
        db.session.add(entity)
        db.session.commit()

    # -- assertions / lookups ----------------------------------------------

    def exists(
        self,
        model: type[Slice] | type[Dashboard] | type[SqlaTable],
        entity_id: int,
    ) -> bool:
        row = (
            db.session.query(model)
            .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {model}})
            .filter(model.id == entity_id)
            .one_or_none()
        )
        return row is not None

    def count(self, sql: str, params: dict[str, Any]) -> int:
        return db.session.execute(sa.text(sql), params).scalar() or 0

    # -- version-history forging (Stage 2) ---------------------------------

    def forge_version_row(
        self,
        model: type[Slice] | type[Dashboard] | type[SqlaTable],
        entity_id: int,
        tx_id: int,
    ) -> None:
        """Insert a version_transaction + parent shadow + version_changes row
        for *entity_id* anchored at *tx_id* (so a purge has history to remove
        without needing live capture to be enabled)."""
        from superset.versioning.changes import ENTITY_KIND_BY_CLASS_NAME

        shadow = {
            Slice: "slices_version",
            Dashboard: "dashboards_version",
            SqlaTable: "tables_version",
        }[model]
        kind = ENTITY_KIND_BY_CLASS_NAME[model.__name__]
        # The transaction may be shared across entities — insert it once.
        exists = db.session.execute(
            sa.text("SELECT 1 FROM version_transaction WHERE id = :t"), {"t": tx_id}
        ).first()
        if not exists:
            db.session.execute(
                sa.text(
                    "INSERT INTO version_transaction (id, issued_at) VALUES (:t, :ts)"
                ),
                {"t": tx_id, "ts": datetime.utcnow()},
            )
        db.session.execute(
            sa.text(
                f"INSERT INTO {shadow} (id, transaction_id, operation_type) "  # noqa: S608
                "VALUES (:i, :t, 0)"
            ),
            {"i": entity_id, "t": tx_id},
        )
        db.session.execute(
            sa.text(
                "INSERT INTO version_changes "
                "(transaction_id, entity_kind, entity_id, sequence, kind, "
                "operation, path) VALUES (:t, :k, :i, 1, 'set', 0, :p)"
            ),
            {"t": tx_id, "k": kind, "i": entity_id, "p": '["x"]'},
        )
        db.session.commit()

    # -- cleanup ------------------------------------------------------------

    def _cleanup(self) -> None:
        db.session.rollback()
        for model in (Dashboard, Slice, SqlaTable):
            rows = (
                db.session.query(model)
                .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {model}})
                .all()
            )
            for row in rows:
                name = (
                    getattr(row, "slice_name", None)
                    or getattr(row, "dashboard_title", None)
                    or getattr(row, "table_name", "")
                )
                if str(name).startswith(_PREFIX):
                    db.session.delete(row)
        for d in db.session.query(Database).filter(
            Database.database_name.like(f"{_PREFIX}%")
        ):
            db.session.delete(d)
        db.session.commit()
        # prefix-named tags + their tagged_object rows
        from superset.tags.models import Tag, TaggedObject

        tag_ids = [
            t.id for t in db.session.query(Tag).filter(Tag.name.like(f"{_PREFIX}%"))
        ]
        if tag_ids:
            db.session.query(TaggedObject).filter(
                TaggedObject.tag_id.in_(tag_ids)
            ).delete(synchronize_session=False)
            db.session.query(Tag).filter(Tag.id.in_(tag_ids)).delete(
                synchronize_session=False
            )
            db.session.commit()
        # Clear all version-capture rows (the test DB runs with capture ON, so
        # creating/deleting entities above also writes shadow rows) and audit
        # rows. Children before version_transaction for FK safety.
        for tbl in (
            "dashboard_slices_version",
            "slices_version",
            "dashboards_version",
            "tables_version",
            "table_columns_version",
            "sql_metrics_version",
            "version_changes",
            "version_transaction",
        ):
            db.session.execute(sa.text(f"DELETE FROM {tbl}"))  # noqa: S608
        db.session.execute(sa.text("DELETE FROM purge_audit_log"))
        db.session.commit()
