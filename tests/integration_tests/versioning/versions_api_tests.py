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
"""Endpoint tests for the entity version-history REST API.

Exercises the wired surface (the ``capture_disabled_tests`` prove the
kill-switch; these prove the read endpoints and the PUT version fields):

* ``GET /api/v1/{chart,dashboard,dataset}/<uuid>/versions/`` — list
* ``GET /api/v1/{chart,dashboard,dataset}/<uuid>/versions/<version_uuid>/`` — single
* the six ``old_*``/``new_*`` version fields on the entity ``PUT`` responses

The suite runs with ``ENABLE_VERSIONING_CAPTURE=True`` (see
``tests/integration_tests/superset_test_config.py``); ``conftest.py``'s
autouse fixture clears the version tables around each test.
"""

from unittest.mock import patch
from uuid import uuid4

import pytest
import sqlalchemy as sa
from sqlalchemy.engine import Connection
from sqlalchemy.orm import Session

from superset import db
from superset.connectors.sqla.models import SqlaTable
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import (
    ADMIN_USERNAME,
    ALPHA_USERNAME,
    GAMMA_USERNAME,
)
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)
from tests.integration_tests.versioning.conftest import clear_version_tables

# A syntactically valid UUID that matches no entity / version.
MISSING_UUID = str(uuid4())


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
class TestChartVersionsApi(SupersetTestCase):
    """The chart ``/versions/`` endpoints, covered end to end; the dashboard
    and dataset variants share the same helper layer, so only their wiring +
    entity-specific paths are re-checked in the classes below."""

    def _girls_chart(self) -> Slice:
        db.session.commit()
        chart = db.session.query(Slice).filter(Slice.slice_name == "Girls").one()
        return chart

    def test_list_versions_happy_path_and_etag_and_ordering(self) -> None:
        """A chart with history returns an ordered, well-shaped list + an ETag."""
        chart = self._girls_chart()
        chart_uuid, chart_id = str(chart.uuid), chart.id
        self.login(ADMIN_USERNAME)
        try:
            # Two edits → at least a baseline (op 0) plus update rows.
            assert (
                self.client.put(
                    f"/api/v1/chart/{chart_id}", json={"slice_name": "Girls v2"}
                ).status_code
                == 200
            )
            assert (
                self.client.put(
                    f"/api/v1/chart/{chart_id}", json={"slice_name": "Girls v3"}
                ).status_code
                == 200
            )

            rv = self.get_assert_metric(
                f"/api/v1/chart/{chart_uuid}/versions/", "list_versions"
            )
            assert rv.status_code == 200, rv.data
            assert rv.headers.get("ETag"), "list response must carry an ETag"

            body = json.loads(rv.data.decode("utf-8"))
            assert set(body) >= {"result", "count"}
            assert body["count"] == len(body["result"]) >= 2
            for item in body["result"]:
                assert set(item) >= {
                    "version_uuid",
                    "version_number",
                    "transaction_id",
                    "operation_type",
                    "issued_at",
                    "changes",
                }
                for change in item["changes"]:
                    # The verb column we surface explicitly on the read side.
                    assert "operation" in change
                    assert "kind" in change

            # version_number is 0-based, oldest first; the baseline sits at 0.
            numbers = [i["version_number"] for i in body["result"]]
            assert numbers == sorted(numbers)
            assert numbers[0] == 0
            assert body["result"][0]["operation_type"] == "baseline"
        finally:
            self.client.put(f"/api/v1/chart/{chart_id}", json={"slice_name": "Girls"})

    def test_get_single_version_happy_path(self) -> None:
        """A single version resolves to a snapshot carrying a ``_version`` block."""
        chart = self._girls_chart()
        chart_uuid, chart_id = str(chart.uuid), chart.id
        self.login(ADMIN_USERNAME)
        try:
            self.client.put(
                f"/api/v1/chart/{chart_id}", json={"slice_name": "Girls edited"}
            )
            listing = json.loads(
                self.client.get(f"/api/v1/chart/{chart_uuid}/versions/").data
            )
            version_uuid = listing["result"][0]["version_uuid"]

            rv = self.get_assert_metric(
                f"/api/v1/chart/{chart_uuid}/versions/{version_uuid}/", "get_version"
            )
            assert rv.status_code == 200, rv.data
            assert rv.headers.get("ETag")
            snapshot = json.loads(rv.data.decode("utf-8"))["result"]
            assert "_version" in snapshot
            assert set(snapshot["_version"]) >= {
                "version_uuid",
                "version_number",
                "operation_type",
            }
        finally:
            self.client.put(f"/api/v1/chart/{chart_id}", json={"slice_name": "Girls"})

    def test_list_versions_400_on_invalid_entity_uuid(self) -> None:
        self.login(ADMIN_USERNAME)
        rv = self.client.get("/api/v1/chart/not-a-uuid/versions/")
        assert rv.status_code == 400, rv.data

    def test_list_versions_404_on_unknown_entity(self) -> None:
        self.login(ADMIN_USERNAME)
        rv = self.client.get(f"/api/v1/chart/{MISSING_UUID}/versions/")
        assert rv.status_code == 404, rv.data

    def test_get_version_400_on_invalid_version_uuid(self) -> None:
        chart_uuid = str(self._girls_chart().uuid)
        self.login(ADMIN_USERNAME)
        rv = self.client.get(f"/api/v1/chart/{chart_uuid}/versions/not-a-uuid/")
        assert rv.status_code == 400, rv.data

    def test_get_version_404_on_unknown_version(self) -> None:
        chart_uuid = str(self._girls_chart().uuid)
        self.login(ADMIN_USERNAME)
        rv = self.client.get(f"/api/v1/chart/{chart_uuid}/versions/{MISSING_UUID}/")
        assert rv.status_code == 404, rv.data

    def test_list_versions_denies_unauthorized_user(self) -> None:
        """The per-object editorship gate (``raise_for_editorship``) must
        refuse a user who is no editor — as a 403, or 404 if the object
        isn't even visible to them."""
        chart_uuid = str(self._girls_chart().uuid)
        self.login(GAMMA_USERNAME)
        rv = self.client.get(f"/api/v1/chart/{chart_uuid}/versions/")
        assert rv.status_code in (403, 404), rv.data

    def test_list_versions_denies_read_only_non_editor_chart(self) -> None:
        """sc-120001 pin: version history is EDIT-gated. Alpha carries broad
        read + datasource access — the OLD read gate admitted it — but is no
        editor/owner of this chart, so the endpoint must refuse with 403.
        (Reverted-gate control: with the read gate restored this test fails
        with a 200.)"""
        chart_uuid = str(self._girls_chart().uuid)
        self.login(ALPHA_USERNAME)
        rv = self.client.get(f"/api/v1/chart/{chart_uuid}/versions/")
        assert rv.status_code == 403, rv.data

    def test_list_versions_denies_read_only_non_editor_dashboard(self) -> None:
        """sc-120001 pin, dashboard flavour — the same edit gate refuses a
        read-capable non-editor on the dashboard endpoint (this is QA
        TC-062/TC-066's leak, closed)."""
        db.session.commit()
        dashboard = db.session.query(Dashboard).filter(Dashboard.slug == "births").one()
        self.login(ALPHA_USERNAME)
        rv = self.client.get(f"/api/v1/dashboard/{dashboard.uuid}/versions/")
        assert rv.status_code == 403, rv.data

    def test_list_versions_allows_object_editor(self) -> None:
        """sc-120001 matrix: object-level editorship admits — Gamma made an
        EDITOR of this one chart reads its history, while remaining unable
        to read other charts' history (object-level, not model-level
        can_write)."""
        # pylint: disable=import-outside-toplevel
        from superset import security_manager
        from superset.subjects.utils import get_user_subject

        chart = self._girls_chart()
        chart_uuid = str(chart.uuid)
        gamma = security_manager.find_user(GAMMA_USERNAME)
        original_editors = list(chart.editors)
        chart.editors = [get_user_subject(gamma.id)]
        db.session.commit()
        try:
            self.login(GAMMA_USERNAME)
            rv = self.client.get(f"/api/v1/chart/{chart_uuid}/versions/")
            assert rv.status_code == 200, rv.data
        finally:
            chart = self._girls_chart()
            chart.editors = original_editors
            db.session.commit()

    def test_editorship_gate_refuses_guest_principal(self) -> None:
        """sc-120001 / M10 pin: an embedded guest-token principal is never
        an editor, so the editorship gate the version endpoints run refuses
        it outright — guests read embedded dashboards, never their change
        logs."""
        # pylint: disable=import-outside-toplevel
        from unittest.mock import patch as mock_patch

        from superset import security_manager
        from superset.exceptions import SupersetSecurityException
        from superset.security.guest_token import GuestTokenResourceType
        from superset.utils.core import override_user

        dashboard = db.session.query(Dashboard).filter(Dashboard.slug == "births").one()
        with mock_patch.dict(
            "superset.extensions.feature_flag_manager._feature_flags",
            EMBEDDED_SUPERSET=True,
        ):
            guest = security_manager.get_guest_user_from_token(
                {
                    "user": {},
                    "iat": 0,
                    "exp": 9999999999,
                    "rls_rules": [],
                    "resources": [
                        {
                            "type": GuestTokenResourceType.DASHBOARD,
                            "id": str(dashboard.uuid),
                        }
                    ],
                }
            )
            with override_user(guest):
                with pytest.raises(SupersetSecurityException):
                    security_manager.raise_for_editorship(dashboard)

    def test_put_non_numeric_pk_does_not_500_with_capture_on(self) -> None:
        """The PUT route is ``/<pk>`` (a string); with capture on, a
        non-numeric pk must not raise a raw SQL type-cast error from the
        pre-update version lookup — it should resolve to a clean 4xx."""
        self.login(ADMIN_USERNAME)
        rv = self.client.put("/api/v1/chart/not-a-number", json={"slice_name": "x"})
        assert rv.status_code < 500, rv.data

    def test_put_returns_version_fields_when_capture_on(self) -> None:
        """A capture-on chart PUT surfaces the six version fields, populated."""
        chart_id = self._girls_chart().id
        self.login(ADMIN_USERNAME)
        try:
            rv = self.client.put(
                f"/api/v1/chart/{chart_id}", json={"slice_name": "Girls versioned"}
            )
            assert rv.status_code == 200, rv.data
            body = json.loads(rv.data.decode("utf-8"))
            assert set(body) >= {
                "old_version",
                "new_version",
                "old_transaction_id",
                "new_transaction_id",
                "old_version_uuid",
                "new_version_uuid",
            }
            # Capture is on, so the post-save fields are populated.
            assert body["new_version"] is not None
            assert body["new_version_uuid"] is not None
        finally:
            self.client.put(f"/api/v1/chart/{chart_id}", json={"slice_name": "Girls"})

    def test_parent_baseline_sql_failure_does_not_break_save(self) -> None:
        """A failed optional parent baseline leaves the save committable."""
        chart_id = self._girls_chart().id
        clear_version_tables()
        self.login(ADMIN_USERNAME)

        def fail_parent_baseline(
            conn: Connection, *args: object, **kwargs: object
        ) -> None:
            conn.execute(
                sa.text("INSERT INTO __missing_parent_shadow__ (x) VALUES (1)")
            )

        try:
            with patch(
                "superset.versioning.baseline.insertion.insert_baseline_shadow_row",
                side_effect=fail_parent_baseline,
            ):
                rv = self.client.put(
                    f"/api/v1/chart/{chart_id}",
                    json={"slice_name": "Girls survives parent baseline failure"},
                )

            assert rv.status_code == 200, rv.data
            got = json.loads(self.client.get(f"/api/v1/chart/{chart_id}").data)[
                "result"
            ]
            assert got["slice_name"] == "Girls survives parent baseline failure"
            baseline_count = db.session.scalar(
                sa.text(
                    "SELECT count(*) FROM slices_version "
                    "WHERE id = :id AND operation_type = 0"
                ),
                {"id": chart_id},
            )
            assert baseline_count == 0
            canonical_updates = db.session.scalar(
                sa.text(
                    "SELECT count(*) FROM slices_version "
                    "WHERE id = :id AND operation_type = 1 "
                    "AND slice_name = :name"
                ),
                {
                    "id": chart_id,
                    "name": "Girls survives parent baseline failure",
                },
            )
            assert canonical_updates == 1
            assert (
                db.session.scalar(sa.text("SELECT count(*) FROM version_transaction"))
                == 1
            )

            listing = json.loads(
                self.client.get(f"/api/v1/chart/{got['uuid']}/versions/").data
            )
            assert listing["count"] == 1
            assert listing["result"][0]["operation_type"] == "update"

            follow_up = self.client.put(
                f"/api/v1/chart/{chart_id}",
                json={"slice_name": "Girls session remains usable"},
            )
            assert follow_up.status_code == 200, follow_up.data
        finally:
            self.client.put(f"/api/v1/chart/{chart_id}", json={"slice_name": "Girls"})


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
class TestDashboardVersionsApi(SupersetTestCase):
    def _dashboard(self) -> Dashboard:
        db.session.commit()
        return self.get_dash_by_slug("births")

    def test_list_versions_happy_path(self) -> None:
        dash = self._dashboard()
        dash_uuid, dash_id = str(dash.uuid), dash.id
        self.login(ADMIN_USERNAME)
        original = dash.dashboard_title
        try:
            assert (
                self.client.put(
                    f"/api/v1/dashboard/{dash_id}",
                    json={"dashboard_title": "Births versioned"},
                ).status_code
                == 200
            )
            rv = self.get_assert_metric(
                f"/api/v1/dashboard/{dash_uuid}/versions/", "list_versions"
            )
            assert rv.status_code == 200, rv.data
            assert rv.headers.get("ETag")
            body = json.loads(rv.data.decode("utf-8"))
            assert body["count"] == len(body["result"]) >= 1
            assert body["result"][0]["version_number"] == 0
        finally:
            self.client.put(
                f"/api/v1/dashboard/{dash_id}",
                json={"dashboard_title": original},
            )

    def test_list_versions_404_on_unknown_dashboard(self) -> None:
        self.login(ADMIN_USERNAME)
        rv = self.client.get(f"/api/v1/dashboard/{MISSING_UUID}/versions/")
        assert rv.status_code == 404, rv.data


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
class TestDatasetVersionsApi(SupersetTestCase):
    def _dataset(self) -> SqlaTable:
        db.session.commit()
        return (
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name == "birth_names")
            .one()
        )

    def test_list_versions_happy_path(self) -> None:
        dataset = self._dataset()
        ds_uuid, ds_id = str(dataset.uuid), dataset.id
        self.login(ADMIN_USERNAME)
        original = dataset.description
        try:
            assert (
                self.client.put(
                    f"/api/v1/dataset/{ds_id}",
                    json={"description": "versioned description"},
                ).status_code
                == 200
            )
            rv = self.get_assert_metric(
                f"/api/v1/dataset/{ds_uuid}/versions/", "list_versions"
            )
            assert rv.status_code == 200, rv.data
            assert rv.headers.get("ETag")
            body = json.loads(rv.data.decode("utf-8"))
            assert body["count"] == len(body["result"]) >= 1
        finally:
            self.client.put(
                f"/api/v1/dataset/{ds_id}",
                json={"description": original},
            )

    def test_put_override_columns_returns_version_fields(self) -> None:
        """The ``override_columns`` save is two commits / two Continuum
        transactions (update + refresh); the PUT still returns populated
        version fields and the response is a clean 200."""
        dataset = self._dataset()
        ds_id = dataset.id
        self.login(ADMIN_USERNAME)
        # Round-trip the dataset's own columns back through an override save.
        existing = json.loads(self.client.get(f"/api/v1/dataset/{ds_id}").data)[
            "result"
        ]
        columns = [
            {"column_name": c["column_name"], "type": c.get("type")}
            for c in existing["columns"]
        ]
        rv = self.client.put(
            f"/api/v1/dataset/{ds_id}?override_columns=true",
            json={"columns": columns},
        )
        assert rv.status_code == 200, rv.data
        body = json.loads(rv.data.decode("utf-8"))
        assert set(body) >= {"old_version", "new_version", "new_version_uuid"}
        assert body["new_version_uuid"] is not None

    def test_child_baseline_sql_failure_rolls_back_complete_optional_unit(
        self,
    ) -> None:
        """A child failure preserves the save without partial baseline rows."""
        dataset = self._dataset()
        dataset_id = dataset.id
        original = dataset.description
        clear_version_tables()
        self.login(ADMIN_USERNAME)

        def fail_children(session: Session, _parent: object, _tx_id: int) -> None:
            session.connection().execute(
                sa.text("INSERT INTO __missing_child_shadow__ (x) VALUES (1)")
            )

        try:
            with patch.dict(
                "superset.versioning.baseline.insertion.CHILD_BASELINE_HANDLERS",
                {"SqlaTable": fail_children},
            ):
                rv = self.client.put(
                    f"/api/v1/dataset/{dataset_id}",
                    json={"description": "survives child baseline failure"},
                )

            assert rv.status_code == 200, rv.data
            got = json.loads(self.client.get(f"/api/v1/dataset/{dataset_id}").data)[
                "result"
            ]
            assert got["description"] == "survives child baseline failure"

            parent_baselines = db.session.scalar(
                sa.text(
                    "SELECT count(*) FROM tables_version "
                    "WHERE id = :id AND operation_type = 0"
                ),
                {"id": dataset_id},
            )
            child_baselines = db.session.scalar(
                sa.text(
                    "SELECT count(*) FROM table_columns_version "
                    "WHERE table_id = :id AND operation_type = 0"
                ),
                {"id": dataset_id},
            )
            metric_baselines = db.session.scalar(
                sa.text(
                    "SELECT count(*) FROM sql_metrics_version "
                    "WHERE table_id = :id AND operation_type = 0"
                ),
                {"id": dataset_id},
            )
            assert parent_baselines == 0
            assert child_baselines == 0
            assert metric_baselines == 0
            canonical_updates = db.session.scalar(
                sa.text(
                    "SELECT count(*) FROM tables_version "
                    "WHERE id = :id AND operation_type = 1 "
                    "AND description = :description"
                ),
                {
                    "id": dataset_id,
                    "description": "survives child baseline failure",
                },
            )
            assert canonical_updates == 1
            assert (
                db.session.scalar(sa.text("SELECT count(*) FROM version_transaction"))
                == 1
            )

            listing = json.loads(
                self.client.get(f"/api/v1/dataset/{got['uuid']}/versions/").data
            )
            assert listing["count"] == 1
            assert listing["result"][0]["operation_type"] == "update"
        finally:
            self.client.put(
                f"/api/v1/dataset/{dataset_id}",
                json={"description": original},
            )
