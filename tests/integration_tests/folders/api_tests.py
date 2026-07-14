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
"""Integration tests for the folders REST API and DAO."""

from typing import Any

import pytest

import tests.integration_tests.test_app  # noqa: F401
from superset import db
from superset.daos.folder import FolderDAO
from superset.folders.models import Folder, FolderObject
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME

DASH_PREFIX = "folders_test_dash_"
CHART_PREFIX = "folders_test_chart_"


class TestFolderApi(SupersetTestCase):
    @pytest.fixture(autouse=True)
    def cleanup_folders(self):
        yield
        db.session.query(FolderObject).delete()
        db.session.query(Folder).delete()
        for dashboard in (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title.like(f"{DASH_PREFIX}%"))
            .all()
        ):
            db.session.delete(dashboard)
        for chart in (
            db.session.query(Slice)
            .filter(Slice.slice_name.like(f"{CHART_PREFIX}%"))
            .all()
        ):
            db.session.delete(chart)
        db.session.commit()

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #
    def _create_folder(self, **payload: Any) -> dict[str, Any]:
        payload.setdefault("name", "Folder")
        response = self.client.post("/api/v1/folders/", json=payload)
        assert response.status_code == 201, response.json
        return response.json["result"]

    def _create_dashboard(self, title: str) -> Dashboard:
        admin = self.get_user(ADMIN_USERNAME)
        dashboard = Dashboard(
            dashboard_title=f"{DASH_PREFIX}{title}",
            created_by=admin,
            changed_by=admin,
        )
        db.session.add(dashboard)
        db.session.commit()
        return dashboard

    def _create_chart(
        self, name: str, viz_type: str = "bar", datasource_id: int = 1
    ) -> Slice:
        admin = self.get_user(ADMIN_USERNAME)
        chart = Slice(
            slice_name=f"{CHART_PREFIX}{name}",
            viz_type=viz_type,
            datasource_id=datasource_id,
            datasource_type="table",
            owners=[admin],
            created_by=admin,
            changed_by=admin,
        )
        db.session.add(chart)
        db.session.commit()
        return chart

    # ------------------------------------------------------------------ #
    # CRUD
    # ------------------------------------------------------------------ #
    def test_create_get_update_delete(self):
        self.login(ADMIN_USERNAME)
        created = self._create_folder(name="Quarterly", description="Q reports")
        assert created["name"] == "Quarterly"
        assert created["folder_type"] == "analytics"
        assert created["parent_uuid"] is None
        uuid = created["uuid"]

        # get
        response = self.client.get(f"/api/v1/folders/{uuid}")
        assert response.status_code == 200
        assert response.json["result"]["description"] == "Q reports"

        # update (rename + describe)
        response = self.client.put(
            f"/api/v1/folders/{uuid}", json={"name": "Yearly", "description": None}
        )
        assert response.status_code == 200
        assert response.json["result"]["name"] == "Yearly"
        assert response.json["result"]["description"] is None

        # delete
        response = self.client.delete(f"/api/v1/folders/{uuid}")
        assert response.status_code == 200
        assert FolderDAO.get_by_uuid(uuid) is None

    def test_get_missing_returns_404(self):
        self.login(ADMIN_USERNAME)
        response = self.client.get("/api/v1/folders/does-not-exist")
        assert response.status_code == 404

    def test_duplicate_sibling_name_rejected(self):
        self.login(ADMIN_USERNAME)
        self._create_folder(name="Dup")
        response = self.client.post("/api/v1/folders/", json={"name": "Dup"})
        assert response.status_code == 422

    def test_create_with_parent(self):
        self.login(ADMIN_USERNAME)
        parent = self._create_folder(name="Parent")
        child = self._create_folder(name="Child", parent_uuid=parent["uuid"])
        assert child["parent_uuid"] == parent["uuid"]

    def test_create_with_unknown_parent_rejected(self):
        self.login(ADMIN_USERNAME)
        response = self.client.post(
            "/api/v1/folders/", json={"name": "Orphan", "parent_uuid": "missing"}
        )
        assert response.status_code == 422

    # ------------------------------------------------------------------ #
    # Move / tree integrity
    # ------------------------------------------------------------------ #
    def test_move_into_own_descendant_rejected(self):
        self.login(ADMIN_USERNAME)
        parent = self._create_folder(name="P")
        child = self._create_folder(name="C", parent_uuid=parent["uuid"])
        # moving the parent under its own child would create a cycle
        response = self.client.put(
            f"/api/v1/folders/{parent['uuid']}",
            json={"parent_uuid": child["uuid"]},
        )
        assert response.status_code == 422

    def test_move_to_root(self):
        self.login(ADMIN_USERNAME)
        parent = self._create_folder(name="P")
        child = self._create_folder(name="C", parent_uuid=parent["uuid"])
        response = self.client.put(
            f"/api/v1/folders/{child['uuid']}", json={"parent_uuid": None}
        )
        assert response.status_code == 200
        assert response.json["result"]["parent_uuid"] is None

    def test_delete_reparents_children(self):
        self.login(ADMIN_USERNAME)
        grandparent = self._create_folder(name="GP")
        parent = self._create_folder(name="P", parent_uuid=grandparent["uuid"])
        child = self._create_folder(name="C", parent_uuid=parent["uuid"])

        # delete the middle folder -> child should re-parent to grandparent
        response = self.client.delete(f"/api/v1/folders/{parent['uuid']}")
        assert response.status_code == 200

        moved = FolderDAO.get_by_uuid(child["uuid"])
        assert moved is not None
        assert moved.parent_id == grandparent["id"]

    # ------------------------------------------------------------------ #
    # Listing
    # ------------------------------------------------------------------ #
    def test_list_filtered_by_type(self):
        self.login(ADMIN_USERNAME)
        self._create_folder(name="Analytics one")
        self._create_folder(name="Other one", folder_type="custom")

        response = self.client.get("/api/v1/folders/?folder_type=analytics")
        assert response.status_code == 200
        names = {folder["name"] for folder in response.json["result"]}
        assert "Analytics one" in names
        assert "Other one" not in names

    # ------------------------------------------------------------------ #
    # Assets
    # ------------------------------------------------------------------ #
    def test_root_view_lists_unfoldered_assets(self):
        self.login(ADMIN_USERNAME)
        dashboard = self._create_dashboard("root")
        response = self.client.get("/api/v1/folders/assets")
        assert response.status_code == 200
        asset_ids = {(a["type"], a["id"]) for a in response.json["result"]}
        assert ("dashboard", dashboard.id) in asset_ids

    def test_assign_asset_moves_it_out_of_root(self):
        self.login(ADMIN_USERNAME)
        folder = self._create_folder(name="Bucket")
        dashboard = self._create_dashboard("assign")

        response = self.client.put(
            f"/api/v1/folders/{folder['uuid']}/assets",
            json={"assets": [{"type": "dashboard", "id": dashboard.id}]},
        )
        assert response.status_code == 200
        contents_ids = {(a["type"], a["id"]) for a in response.json["result"]}
        assert ("dashboard", dashboard.id) in contents_ids

        # no longer unfoldered
        root = self.client.get("/api/v1/folders/assets").json
        assert ("dashboard", dashboard.id) not in {
            (a["type"], a["id"]) for a in root["result"]
        }

        # contents endpoint agrees
        contents = self.client.get(f"/api/v1/folders/{folder['uuid']}/assets").json
        assert ("dashboard", dashboard.id) in {
            (a["type"], a["id"]) for a in contents["result"]
        }

    def test_assign_moves_between_folders(self):
        self.login(ADMIN_USERNAME)
        first = self._create_folder(name="First")
        second = self._create_folder(name="Second")
        dashboard = self._create_dashboard("move")

        body = {"assets": [{"type": "dashboard", "id": dashboard.id}]}
        self.client.put(f"/api/v1/folders/{first['uuid']}/assets", json=body)
        self.client.put(f"/api/v1/folders/{second['uuid']}/assets", json=body)

        first_contents = self.client.get(f"/api/v1/folders/{first['uuid']}/assets").json
        second_contents = self.client.get(
            f"/api/v1/folders/{second['uuid']}/assets"
        ).json
        assert first_contents["result"] == []
        assert ("dashboard", dashboard.id) in {
            (a["type"], a["id"]) for a in second_contents["result"]
        }

    def test_set_membership_removes_unlisted_assets(self):
        self.login(ADMIN_USERNAME)
        folder = self._create_folder(name="Bucket")
        kept = self._create_dashboard("kept")
        dropped = self._create_dashboard("dropped")

        # Put both in the folder.
        self.client.put(
            f"/api/v1/folders/{folder['uuid']}/assets",
            json={
                "assets": [
                    {"type": "dashboard", "id": kept.id},
                    {"type": "dashboard", "id": dropped.id},
                ]
            },
        )
        # Re-set membership to only ``kept`` -> ``dropped`` moves back to root.
        response = self.client.put(
            f"/api/v1/folders/{folder['uuid']}/assets",
            json={"assets": [{"type": "dashboard", "id": kept.id}]},
        )
        assert response.status_code == 200
        folder_ids = {(a["type"], a["id"]) for a in response.json["result"]}
        assert ("dashboard", kept.id) in folder_ids
        assert ("dashboard", dropped.id) not in folder_ids

        root_ids = {
            (a["type"], a["id"])
            for a in self.client.get("/api/v1/folders/assets").json["result"]
        }
        assert ("dashboard", dropped.id) in root_ids

        # An empty list empties the folder entirely.
        self.client.put(
            f"/api/v1/folders/{folder['uuid']}/assets", json={"assets": []}
        )
        contents = self.client.get(f"/api/v1/folders/{folder['uuid']}/assets").json
        assert all(a["type"] == "folder" for a in contents["result"])

    def test_assign_unknown_asset_rejected(self):
        self.login(ADMIN_USERNAME)
        folder = self._create_folder(name="Bucket")
        response = self.client.put(
            f"/api/v1/folders/{folder['uuid']}/assets",
            json={"assets": [{"type": "dashboard", "id": 999999}]},
        )
        assert response.status_code == 422

    def test_assign_unknown_asset_type_rejected(self):
        self.login(ADMIN_USERNAME)
        folder = self._create_folder(name="Bucket")
        response = self.client.put(
            f"/api/v1/folders/{folder['uuid']}/assets",
            json={"assets": [{"type": "report", "id": 1}]},
        )
        # unknown type -> schema validation error
        assert response.status_code == 400

    def test_assign_disallowed_asset_type_rejected(self):
        self.login(ADMIN_USERNAME)
        folder = self._create_folder(name="Bucket")
        response = self.client.put(
            f"/api/v1/folders/{folder['uuid']}/assets",
            json={"assets": [{"type": "dataset", "id": 1}]},
        )
        # valid type, but datasets do not belong in an analytics folder
        assert response.status_code == 422

    def test_delete_folder_unfolders_assets(self):
        self.login(ADMIN_USERNAME)
        folder = self._create_folder(name="Bucket")
        dashboard = self._create_dashboard("unfolder")
        self.client.put(
            f"/api/v1/folders/{folder['uuid']}/assets",
            json={"assets": [{"type": "dashboard", "id": dashboard.id}]},
        )

        self.client.delete(f"/api/v1/folders/{folder['uuid']}")

        # the dashboard survives and is unfoldered again
        assert db.session.get(Dashboard, dashboard.id) is not None
        root = self.client.get("/api/v1/folders/assets").json
        assert ("dashboard", dashboard.id) in {
            (a["type"], a["id"]) for a in root["result"]
        }

    # ------------------------------------------------------------------ #
    # Filtering & pagination (scoped to a folder for deterministic counts)
    # ------------------------------------------------------------------ #
    def _assign(self, folder_uuid: str, assets: list[dict[str, Any]]) -> None:
        resp = self.client.put(
            f"/api/v1/folders/{folder_uuid}/assets", json={"assets": assets}
        )
        assert resp.status_code == 200, resp.json

    def test_contents_response_shape(self):
        self.login(ADMIN_USERNAME)
        folder = self._create_folder(name="Shape")
        resp = self.client.get(f"/api/v1/folders/{folder['uuid']}/assets").json
        for key in ("folder", "result", "count", "page", "page_size"):
            assert key in resp

    def test_contents_search_by_name(self):
        self.login(ADMIN_USERNAME)
        folder = self._create_folder(name="Box")
        alpha = self._create_dashboard("Alpha")
        beta = self._create_dashboard("Beta")
        self._assign(
            folder["uuid"],
            [
                {"type": "dashboard", "id": alpha.id},
                {"type": "dashboard", "id": beta.id},
            ],
        )
        resp = self.client.get(
            f"/api/v1/folders/{folder['uuid']}/assets?search={DASH_PREFIX}Alpha"
        ).json
        names = {r["name"] for r in resp["result"]}
        assert any("Alpha" in n for n in names)
        assert not any("Beta" in n for n in names)

    def test_contents_type_filter(self):
        self.login(ADMIN_USERNAME)
        folder = self._create_folder(name="Mix")
        self._create_folder(name="Sub", parent_uuid=folder["uuid"])
        dash = self._create_dashboard("d")
        self._assign(folder["uuid"], [{"type": "dashboard", "id": dash.id}])
        resp = self.client.get(
            f"/api/v1/folders/{folder['uuid']}/assets?types=dashboard"
        ).json
        assert {r["type"] for r in resp["result"]} == {"dashboard"}

    def test_contents_pagination(self):
        self.login(ADMIN_USERNAME)
        folder = self._create_folder(name="Paged")
        dashboards = [self._create_dashboard(f"p{i}") for i in range(3)]
        self._assign(
            folder["uuid"],
            [{"type": "dashboard", "id": d.id} for d in dashboards],
        )
        page0 = self.client.get(
            f"/api/v1/folders/{folder['uuid']}/assets?page=0&page_size=2"
        ).json
        assert page0["count"] == 3
        assert page0["page_size"] == 2
        assert len(page0["result"]) == 2
        page1 = self.client.get(
            f"/api/v1/folders/{folder['uuid']}/assets?page=1&page_size=2"
        ).json
        assert len(page1["result"]) == 1

    def test_contents_viz_type_filter_and_columns(self):
        self.login(ADMIN_USERNAME)
        folder = self._create_folder(name="Viz")
        bar = self._create_chart("bar", viz_type="bar")
        area = self._create_chart("area", viz_type="area")
        self._assign(
            folder["uuid"],
            [{"type": "chart", "id": bar.id}, {"type": "chart", "id": area.id}],
        )
        resp = self.client.get(
            f"/api/v1/folders/{folder['uuid']}/assets?viz_types=area"
        ).json
        rows = {(r["type"], r["id"]): r for r in resp["result"]}
        assert ("chart", area.id) in rows
        assert ("chart", bar.id) not in rows
        # column data is serialized on asset rows
        row = rows[("chart", area.id)]
        assert row["viz_type"] == "area"
        assert any(o["id"] for o in row["owners"])

    def test_asset_only_filter_excludes_folders(self):
        self.login(ADMIN_USERNAME)
        folder = self._create_folder(name="Excl")
        self._create_folder(name="SubExcl", parent_uuid=folder["uuid"])
        chart = self._create_chart("bar2", viz_type="bar")
        self._assign(folder["uuid"], [{"type": "chart", "id": chart.id}])
        resp = self.client.get(
            f"/api/v1/folders/{folder['uuid']}/assets?viz_types=bar"
        ).json
        types = {r["type"] for r in resp["result"]}
        assert "folder" not in types
        assert ("chart", chart.id) in {(r["type"], r["id"]) for r in resp["result"]}

    # ------------------------------------------------------------------ #
    # Auth
    # ------------------------------------------------------------------ #
    def test_requires_authentication(self):
        response = self.client.get("/api/v1/folders/")
        assert response.status_code == 401
