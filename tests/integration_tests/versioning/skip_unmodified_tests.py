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
"""FR-026 — ``SkipUnmodifiedPlugin`` integration tests.

Locks in the behavior that owners-only saves and content-equivalent
re-saves do *not* mint version rows. Exercises the plugin's
``_matches_previous_version`` comparator across the Dashboard's three
column-type families (String, Text, MediumText) so a future column-type
change can't silently regress to "always create version rows".
"""

from __future__ import annotations

from typing import Any

import pytest
from sqlalchemy_continuum import version_class

from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.extensions import db
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import json as _json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME
from tests.integration_tests.fixtures.birth_names_dashboard import (  # noqa: F401
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)


def _dashboard_version_count(dashboard_id: int) -> int:
    ver_cls = version_class(Dashboard)
    return db.session.query(ver_cls).filter(ver_cls.id == dashboard_id).count()


def _slice_version_count(slice_id: int) -> int:
    ver_cls = version_class(Slice)
    return db.session.query(ver_cls).filter(ver_cls.id == slice_id).count()


def _dataset_version_count(dataset_id: int) -> int:
    ver_cls = version_class(SqlaTable)
    return db.session.query(ver_cls).filter(ver_cls.id == dataset_id).count()


class TestSkipUnmodifiedPlugin(SupersetTestCase):
    """FR-026 — version rows are not minted for content-equivalent updates."""

    @pytest.fixture(autouse=True)
    def _load_data(self, load_birth_names_dashboard_with_slices):  # noqa: PT004, F811
        pass

    def _get_dashboard(self) -> Dashboard:
        db.session.commit()
        dash = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "USA Births Names")
            .first()
        )
        assert dash is not None
        return dash

    def _put(self, pk: int, body: dict[str, Any]) -> None:
        rv = self.client.put(f"/api/v1/dashboard/{pk}", json=body)
        assert rv.status_code == 200, rv.data

    def test_owners_only_edit_does_not_create_version(self) -> None:
        """Saving a dashboard with only owner changes is a no-op for
        version-row creation."""
        dash = self._get_dashboard()
        dash_id = dash.id
        title = dash.dashboard_title
        original_owner_ids = [o.id for o in dash.owners]

        self.login(ADMIN_USERNAME)
        # Force a known baseline state with one save.
        self._put(dash_id, {"dashboard_title": title})
        db.session.expire_all()
        before = _dashboard_version_count(dash_id)

        try:
            # Now save with only ``owners`` changed (toggle: drop one,
            # then put it back). String / Text / MediumText columns are
            # unchanged so the plugin should skip both saves.
            new_owners = [oid for oid in original_owner_ids if oid != 1] or []
            self._put(dash_id, {"dashboard_title": title, "owners": new_owners})
            db.session.expire_all()
            mid = _dashboard_version_count(dash_id)
            assert mid == before, (
                f"owners-only edit minted a version row (before={before}, after={mid})"
            )

            self._put(dash_id, {"dashboard_title": title, "owners": original_owner_ids})
            db.session.expire_all()
            after = _dashboard_version_count(dash_id)
            assert after == before, (
                f"second owners-only edit minted a version row "
                f"(before={before}, after={after})"
            )
        finally:
            # Always restore original ownership.
            self._put(dash_id, {"dashboard_title": title, "owners": original_owner_ids})

    def test_re_save_with_identical_values_does_not_create_version(self) -> None:
        """Submitting the same scalar values back through PUT is a no-op
        for version creation — exercises the json_metadata re-serialize
        case (``set_dash_metadata`` rewrites the column with a different
        byte sequence; plugin must compare against the prior shadow row
        and skip)."""
        dash = self._get_dashboard()
        dash_id = dash.id
        title = dash.dashboard_title
        existing_metadata = dash.json_metadata or "{}"

        self.login(ADMIN_USERNAME)
        # Prime: one real save to ensure the json_metadata is in canonical
        # post-set_dash_metadata form.
        self._put(
            dash_id,
            {"dashboard_title": title, "json_metadata": existing_metadata},
        )
        db.session.expire_all()
        before = _dashboard_version_count(dash_id)

        # Re-submit identical content. set_dash_metadata will round-trip
        # the json — the resulting byte sequence might differ from the
        # request body but must equal the previous stored value.
        self._put(
            dash_id,
            {"dashboard_title": title, "json_metadata": existing_metadata},
        )
        db.session.expire_all()
        after = _dashboard_version_count(dash_id)
        assert after == before, (
            f"identical re-save minted a version row (before={before}, after={after})"
        )

    def test_actual_change_creates_version(self) -> None:
        """A real scalar change MUST mint a version row — the plugin
        only suppresses no-ops, never legitimate edits."""
        dash = self._get_dashboard()
        dash_id = dash.id
        original_title = dash.dashboard_title

        self.login(ADMIN_USERNAME)
        before = _dashboard_version_count(dash_id)
        try:
            self._put(dash_id, {"dashboard_title": "fr-026-modified-title"})
            db.session.expire_all()
            after = _dashboard_version_count(dash_id)
            assert after == before + 1, (
                f"real edit failed to mint a version row "
                f"(before={before}, after={after})"
            )
        finally:
            self._put(dash_id, {"dashboard_title": original_title})

    def test_chart_slice_name_change_creates_version(self) -> None:
        """Same assertion for ``Slice`` (covers the ``String`` column path
        on a different entity type)."""
        db.session.commit()
        chart = db.session.query(Slice).filter(Slice.slice_name == "Girls").first()
        assert chart is not None
        chart_id = chart.id

        self.login(ADMIN_USERNAME)
        before = _slice_version_count(chart_id)
        try:
            rv = self.client.put(
                f"/api/v1/chart/{chart_id}",
                json={"slice_name": "fr-026-renamed"},
            )
            assert rv.status_code == 200
            db.session.expire_all()
            after = _slice_version_count(chart_id)
            assert after == before + 1
        finally:
            self.client.put(f"/api/v1/chart/{chart_id}", json={"slice_name": "Girls"})

    def test_dashboard_json_metadata_subkey_change_creates_version(self) -> None:
        """Editing a non-audit key inside ``json_metadata`` MUST mint a
        version row — exercises the MediumText column path past the
        plugin's content-equality check."""
        dash = self._get_dashboard()
        dash_id = dash.id
        title = dash.dashboard_title
        original_metadata = dash.json_metadata or "{}"

        self.login(ADMIN_USERNAME)
        before = _dashboard_version_count(dash_id)
        try:
            md = _json.loads(original_metadata)
            md["color_scheme"] = "fr026TestPalette"
            self._put(
                dash_id,
                {"dashboard_title": title, "json_metadata": _json.dumps(md)},
            )
            db.session.expire_all()
            after = _dashboard_version_count(dash_id)
            assert after == before + 1, (
                f"json_metadata edit failed to mint a version row "
                f"(before={before}, after={after})"
            )
        finally:
            self._put(
                dash_id,
                {"dashboard_title": title, "json_metadata": original_metadata},
            )

    def test_map_label_colors_only_change_does_not_create_version(self) -> None:
        """Re-stamped ``map_label_colors`` (and other frontend-derived
        audit sub-keys) inside ``json_metadata`` MUST NOT mint a version
        row. The frontend regenerates this map from the
        ``LabelsColorMap`` singleton on every save, so two saves with no
        user-authored change emit different bytes for the column. The
        diff engine drops these sub-keys via
        ``DASHBOARD_JSON_METADATA_AUDIT_KEYS``; the skip-plugin's
        comparator must apply the same filter or every save mints an
        empty-changes "Baseline" row in the UI.
        """
        dash = self._get_dashboard()
        dash_id = dash.id
        title = dash.dashboard_title
        original_metadata = dash.json_metadata or "{}"

        self.login(ADMIN_USERNAME)
        # Prime with the existing metadata so the next save's only
        # delta is the re-stamped ``map_label_colors``.
        self._put(
            dash_id,
            {"dashboard_title": title, "json_metadata": original_metadata},
        )
        db.session.expire_all()
        before = _dashboard_version_count(dash_id)
        try:
            md = _json.loads(original_metadata)
            md["map_label_colors"] = {
                "test-label-fr026": "#abcdef",
                "another-label": "#123456",
            }
            self._put(
                dash_id,
                {"dashboard_title": title, "json_metadata": _json.dumps(md)},
            )
            db.session.expire_all()
            after = _dashboard_version_count(dash_id)
            assert after == before, (
                f"map_label_colors-only edit minted a version row "
                f"(before={before}, after={after})"
            )
        finally:
            self._put(
                dash_id,
                {"dashboard_title": title, "json_metadata": original_metadata},
            )

    def test_dataset_column_edit_creates_parent_version(self) -> None:
        """Editing a ``TableColumn`` description MUST mint a parent
        ``tables_version`` row even though the parent's own scalars are
        unchanged. Without the force-touch in
        ``baseline._force_parent_dirty_on_child_change``, child-only
        edits leave the dataset's version-history dropdown empty.
        """
        db.session.commit()
        dataset = (
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name == "birth_names")
            .first()
        )
        assert dataset is not None
        dataset_id = dataset.id
        column = (
            db.session.query(TableColumn)
            .filter(TableColumn.table_id == dataset_id)
            .order_by(TableColumn.id)
            .first()
        )
        assert column is not None
        original_description = column.description

        self.login(ADMIN_USERNAME)
        before = _dataset_version_count(dataset_id)
        try:
            rv = self.client.put(
                f"/api/v1/dataset/{dataset_id}",
                json={
                    "columns": [
                        {
                            "id": column.id,
                            "column_name": column.column_name,
                            "description": "fr-026 child-edit forces parent shadow",
                        },
                    ],
                },
            )
            assert rv.status_code == 200, rv.data
            db.session.expire_all()
            after = _dataset_version_count(dataset_id)
            assert after == before + 1, (
                f"column edit did not force a parent dataset shadow row "
                f"(before={before}, after={after})"
            )
        finally:
            self.client.put(
                f"/api/v1/dataset/{dataset_id}",
                json={
                    "columns": [
                        {
                            "id": column.id,
                            "column_name": column.column_name,
                            "description": original_description,
                        },
                    ],
                },
            )
