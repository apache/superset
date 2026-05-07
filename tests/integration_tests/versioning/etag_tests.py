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
"""T055 — ``ETag`` header emission on entity GETs / PUTs / version endpoints."""

from __future__ import annotations

import pytest

from superset.connectors.sqla.models import SqlaTable
from superset.daos.version import VersionDAO
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


def _expected_etag(model_cls: type, entity_id: int, entity_uuid) -> str:
    version_uuid = VersionDAO.current_live_version_uuid(
        model_cls, entity_id, entity_uuid
    )
    return f'"{version_uuid}"'


class TestETagEmission(SupersetTestCase):
    """ETag header on entity detail, save response, and version endpoints."""

    @pytest.fixture(autouse=True)
    def _load_data(self, load_birth_names_dashboard_with_slices):  # noqa: PT004, F811
        pass

    def test_chart_get_emits_etag_matching_current_live_version(self) -> None:
        db.session.commit()
        chart: Slice = (
            db.session.query(Slice).filter(Slice.slice_name == "Girls").first()
        )
        assert chart is not None
        expected = _expected_etag(Slice, chart.id, chart.uuid)

        self.login(ADMIN_USERNAME)
        rv = self.client.get(f"/api/v1/chart/{chart.id}")
        assert rv.status_code == 200
        assert rv.headers.get("ETag") == expected

    def test_chart_put_emits_etag_matching_new_live_version(self) -> None:
        db.session.commit()
        chart: Slice = (
            db.session.query(Slice).filter(Slice.slice_name == "Girls").first()
        )
        assert chart is not None
        chart_id = chart.id
        original_name = chart.slice_name

        self.login(ADMIN_USERNAME)
        rv = self.client.put(
            f"/api/v1/chart/{chart_id}",
            json={"slice_name": "etag-put-test"},
        )
        assert rv.status_code == 200
        body = _json.loads(rv.data.decode("utf-8"))
        assert body["new_version_uuid"] is not None
        assert rv.headers.get("ETag") == f'"{body["new_version_uuid"]}"'

        # Cleanup
        chart.slice_name = original_name
        db.session.commit()

    def test_chart_list_versions_emits_etag(self) -> None:
        db.session.commit()
        chart: Slice = (
            db.session.query(Slice).filter(Slice.slice_name == "Girls").first()
        )
        assert chart is not None
        expected = _expected_etag(Slice, chart.id, chart.uuid)

        self.login(ADMIN_USERNAME)
        rv = self.client.get(f"/api/v1/chart/{chart.uuid}/versions/")
        assert rv.status_code == 200
        assert rv.headers.get("ETag") == expected

    def test_chart_get_version_emits_etag(self) -> None:
        db.session.commit()
        chart: Slice = (
            db.session.query(Slice).filter(Slice.slice_name == "Girls").first()
        )
        assert chart is not None
        expected = _expected_etag(Slice, chart.id, chart.uuid)

        self.login(ADMIN_USERNAME)
        rv = self.client.get(f"/api/v1/chart/{chart.uuid}/versions/")
        body = _json.loads(rv.data.decode("utf-8"))
        version_uuid = body["result"][0]["version_uuid"]

        rv = self.client.get(f"/api/v1/chart/{chart.uuid}/versions/{version_uuid}/")
        assert rv.status_code == 200
        # ETag reflects the live version, not the queried version.
        assert rv.headers.get("ETag") == expected

    def test_dashboard_get_emits_etag_matching_current_live_version(self) -> None:
        db.session.commit()
        dashboard: Dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title == "USA Births Names")
            .first()
        )
        assert dashboard is not None
        expected = _expected_etag(Dashboard, dashboard.id, dashboard.uuid)

        self.login(ADMIN_USERNAME)
        rv = self.client.get(f"/api/v1/dashboard/{dashboard.id}")
        assert rv.status_code == 200
        assert rv.headers.get("ETag") == expected

    def test_dataset_get_emits_etag_matching_current_live_version(self) -> None:
        db.session.commit()
        dataset: SqlaTable = (
            db.session.query(SqlaTable)
            .filter(SqlaTable.table_name == "birth_names")
            .first()
        )
        assert dataset is not None
        expected = _expected_etag(SqlaTable, dataset.id, dataset.uuid)

        self.login(ADMIN_USERNAME)
        rv = self.client.get(f"/api/v1/dataset/{dataset.id}")
        assert rv.status_code == 200
        assert rv.headers.get("ETag") == expected

    def test_etag_absent_when_entity_has_no_version_rows(self) -> None:
        """``set_version_etag`` is a no-op when the entity has no version rows."""
        from sqlalchemy_continuum import version_class

        db.session.commit()
        chart: Slice = (
            db.session.query(Slice).filter(Slice.slice_name == "Girls").first()
        )
        assert chart is not None
        chart_id = chart.id
        chart_uuid = chart.uuid

        ver_cls = version_class(Slice)
        db.session.query(ver_cls).filter(ver_cls.id == chart_id).delete(
            synchronize_session=False
        )
        db.session.commit()

        try:
            self.login(ADMIN_USERNAME)
            rv = self.client.get(f"/api/v1/chart/{chart_id}")
            assert rv.status_code == 200
            assert rv.headers.get("ETag") is None
        finally:
            # Always restore the chart's name + version rows so downstream
            # tests in this class don't see corrupted fixture state, even
            # if the assertions above fail.
            self.client.put(
                f"/api/v1/chart/{chart_id}",
                json={"slice_name": "Girls"},
            )

        # Sanity-check that version rows came back.
        assert (
            VersionDAO.current_live_version_uuid(Slice, chart_id, chart_uuid)
            is not None
        )
