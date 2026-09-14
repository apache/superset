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
"""sc-120488: the activity stream renders the starting version as its
oldest row — a synthetic ``__creation__`` record derived from the op=0
shadow row, labelled by ``creation_kind`` (pre_tracking / created /
imported)."""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa
from sqlalchemy_continuum import version_class, versioning_manager

from superset.extensions import db
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.versioning.activity.orchestrator import get_activity
from superset.versioning.changes import ACTION_KIND_IMPORT, ACTION_KIND_KEY
from superset.versioning.queries import derive_version_uuid
from tests.integration_tests.base_tests import SupersetTestCase


def _admin_user() -> Any:
    # pylint: disable=import-outside-toplevel
    from superset import security_manager

    return (
        db.session.query(security_manager.user_model)
        .filter_by(username="admin")
        .one_or_none()
    ) or security_manager.add_user(
        "admin",
        "admin",
        "user",
        "admin@fab.org",
        security_manager.find_role("Admin"),
        password="general",  # noqa: S106 — test-only fixture credential
    )


def _creation_records(records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [r for r in records if r["kind"] == "__creation__"]


def _delete_all_version_rows(model_cls: type, entity_id: int) -> None:
    """Erase an entity's shadow rows AND their transactions, so the next
    save re-baselines it the way a pre-tracking entity would be."""
    shadow = version_class(model_cls).__table__
    tx_tbl = versioning_manager.transaction_cls.__table__
    tx_ids = [
        row[0]
        for row in db.session.execute(
            sa.select(shadow.c.transaction_id).where(shadow.c.id == entity_id)
        )
    ]
    db.session.execute(sa.delete(shadow).where(shadow.c.id == entity_id))
    if tx_ids:
        db.session.execute(sa.delete(tx_tbl).where(tx_tbl.c.id.in_(tx_ids)))


class TestActivityCreationRow(SupersetTestCase):
    def _make_chart(self, name: str) -> Slice:
        slc = Slice(
            slice_name=name, datasource_type="table", datasource_id=1, params="{}"
        )
        db.session.add(slc)
        db.session.commit()
        return slc

    def _cleanup(self, entity: Any) -> None:
        db.session.delete(entity)
        db.session.commit()

    def test_new_chart_has_one_created_row(self) -> None:
        slc = self._make_chart("sc120488_new_chart")
        try:
            records, count, truncated = get_activity(
                Slice, slc.uuid, resolved_entity=slc
            )
            assert not truncated
            creations = _creation_records(records)
            assert len(creations) == 1
            creation = creations[0]
            assert creation["creation_kind"] == "created"
            assert creation["source"] == "self"
            assert creation["entity_name"] == "sc120488_new_chart"
            # Previewable/restorable: the version_uuid is the one the
            # /versions/ family resolves for the creation transaction.
            assert creation["version_uuid"] == str(
                derive_version_uuid(slc.uuid, creation["transaction_id"])
            )
            # The row is the OLDEST entry and the count includes it.
            assert records[-1] is creation
            assert count == len(records)
        finally:
            self._cleanup(slc)

    def test_new_dashboard_has_one_created_row(self) -> None:
        dash = Dashboard(dashboard_title="sc120488_new_dash", slug=None)
        db.session.add(dash)
        db.session.commit()
        try:
            records, count, _ = get_activity(Dashboard, dash.uuid, resolved_entity=dash)
            creations = _creation_records(records)
            assert len(creations) == 1
            assert creations[0]["creation_kind"] == "created"
            assert count == len(records)
        finally:
            self._cleanup(dash)

    def test_pre_tracking_entity_gets_original_version_row(self) -> None:
        """An entity re-baselined by the retroactive writer is labelled
        pre_tracking: its op=0 transaction carries the writer's
        action_kind='baseline' stamp."""
        slc = self._make_chart("sc120488_pre_tracking")
        try:
            # Simulate an entity that predates versioning: no shadow rows.
            _delete_all_version_rows(Slice, slc.id)
            db.session.commit()

            # First save under versioning mints the retroactive baseline.
            slc.slice_name = "sc120488_pre_tracking_edited"
            db.session.commit()

            # pylint: disable=import-outside-toplevel
            from superset.utils.core import override_user

            with override_user(_admin_user()):
                records, _, _ = get_activity(Slice, slc.uuid, resolved_entity=slc)
            creations = _creation_records(records)
            assert len(creations) == 1
            assert creations[0]["creation_kind"] == "pre_tracking"
            # The edit's own records are present too — baseline + edit.
            assert any(r["kind"] != "__creation__" for r in records)
            assert records[-1] is creations[0]
        finally:
            self._cleanup(slc)

    def test_imported_chart_gets_imported_row(self) -> None:
        """An INSERT transaction stamped ACTION_KIND_IMPORT (the importer
        command's stamp) classifies as imported."""
        db.session.info[ACTION_KIND_KEY] = ACTION_KIND_IMPORT
        slc = self._make_chart("sc120488_imported")
        try:
            records, _, _ = get_activity(Slice, slc.uuid, resolved_entity=slc)
            creations = _creation_records(records)
            assert len(creations) == 1
            assert creations[0]["creation_kind"] == "imported"
        finally:
            self._cleanup(slc)

    def test_pruned_baseline_omits_the_row_cleanly(self) -> None:
        """Retention pruned the op=0 row (sc-115615 baseline expiry): no
        synthetic row — the timeline just starts at the oldest survivor."""
        slc = self._make_chart("sc120488_pruned")
        try:
            slc.slice_name = "sc120488_pruned_edited"
            db.session.commit()
            shadow = version_class(Slice).__table__
            db.session.execute(
                sa.delete(shadow).where(
                    shadow.c.id == slc.id, shadow.c.operation_type == 0
                )
            )
            db.session.commit()

            # pylint: disable=import-outside-toplevel
            from superset.utils.core import override_user

            with override_user(_admin_user()):
                records, count, _ = get_activity(Slice, slc.uuid, resolved_entity=slc)
            assert not _creation_records(records)
            assert count == len(records)
        finally:
            self._cleanup(slc)

    def test_include_related_never_synthesizes(self) -> None:
        slc = self._make_chart("sc120488_related_only")
        try:
            records, _, _ = get_activity(
                Slice, slc.uuid, resolved_entity=slc, include="related"
            )
            assert not _creation_records(records)
        finally:
            self._cleanup(slc)
