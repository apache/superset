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
"""The time range limits on the dashboard and dataset write paths, the
restore paths, the REST API and the audit rows, against a real database."""

from __future__ import annotations

import copy
from collections.abc import Iterator
from io import BytesIO
from typing import Any
from unittest.mock import patch, PropertyMock
from uuid import uuid4
from zipfile import ZipFile

import prison
import pytest
import yaml
from sqlalchemy_continuum import version_class

from superset import db, security_manager
from superset.commands.dashboard.exceptions import DashboardUpdateFailedError
from superset.commands.dashboard.importers import v0 as dashboard_v0
from superset.commands.dataset.importers import v0 as dataset_v0
from superset.commands.exceptions import CommandInvalidError, ImportFailedError
from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.daos.dashboard import DashboardDAO
from superset.daos.version import derive_version_uuid
from superset.extensions import feature_flag_manager
from superset.models.core import Database, Log
from superset.models.dashboard import Dashboard
from superset.models.helpers import SKIP_VISIBILITY_FILTER_CLASSES
from superset.models.slice import Slice
from superset.models.sql_lab import Query
from superset.time_range_limits.audit import AUDIT_ACTION
from superset.time_range_limits.policy import FEATURE_FLAG
from superset.utils import json
from superset.utils.core import override_user
from superset.utils.database import get_example_database
from tests.integration_tests.base_tests import subjects_from_users, SupersetTestCase
from tests.integration_tests.conftest import LimitsTestCase, with_feature_flags
from tests.integration_tests.constants import (
    ADMIN_USERNAME,
    ALPHA_USERNAME,
    GAMMA_USERNAME,
)
from tests.integration_tests.fixtures.birth_names_dashboard import (  # noqa: F401
    load_birth_names_dashboard_with_slices,
    load_birth_names_data,
)
from tests.integration_tests.fixtures.importexport import (
    chart_config,
    dashboard_config,
    dashboard_export,
    dashboard_metadata_config,
    database_config,
    dataset_config,
    dataset_metadata_config,
    dataset_ui_export,
)
from tests.integration_tests.fixtures.public_role import (  # noqa: F401
    public_role_like_gamma_scoped,
)
from tests.integration_tests.test_app import app
from tests.integration_tests.time_range_limits_utils import (
    GLOBAL_90_DAYS,
    query_context,
    TABLE_NAME as DATA_TABLE_NAME,
)
from tests.integration_tests.time_range_limits_write_utils import (
    KEY,
    metadata,
)

FLAG_ON = {FEATURE_FLAG: True}
TABLE_NAME = "time_range_limits_writes"
DATA_TABLE_SQL = f"SELECT * FROM {DATA_TABLE_NAME}"  # noqa: S608


def span_policy(days: int) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "max_span": {"quantity": days, "time_grain": "P1D"},
        "max_look_back": None,
        "max_look_forward": None,
    }


GLOBAL_14_DAYS = {"TIME_RANGE_LIMITS_GLOBAL": span_policy(14)}
INVALID_GLOBAL = {"TIME_RANGE_LIMITS_GLOBAL": {"schema_version": 1}}
DASHBOARD_LOOSER = {
    f"json_metadata.{KEY}.max_span.quantity": [
        "Dashboard maximum span must be 14 days or less."
    ]
}
DATASET_LOOSER = {
    f"extra.{KEY}.max_span.quantity": ["Dataset maximum span must be 14 days or less."]
}
SHAPE_ONLY = {"schema_version": 1}


def stored_policy(text: str | None) -> Any:
    return json.loads(text or "{}").get(KEY)


def audit_rows(level: str, object_id: int) -> list[dict[str, Any]]:
    rows = (
        db.session.query(Log).filter(Log.action == AUDIT_ACTION).order_by(Log.id).all()
    )
    return [
        body
        for body in (json.loads(row.json) for row in rows)
        if body.get("level") == level and body.get(f"{level}_id") == object_id
    ]


def zip_bundle(metadata_config: dict[str, Any], files: dict[str, Any]) -> BytesIO:
    buf = BytesIO()
    with ZipFile(buf, "w") as bundle:
        with bundle.open("export/metadata.yaml", "w") as fp:
            fp.write(yaml.safe_dump(metadata_config).encode())
        for path, config in files.items():
            with bundle.open(f"export/{path}", "w") as fp:
                fp.write(yaml.safe_dump(config).encode())
    buf.seek(0)
    return buf


@pytest.fixture
def limits_table() -> Iterator[int]:
    with app.app_context():
        table = SqlaTable(
            table_name=TABLE_NAME,
            database=get_example_database(),
            extra=json.dumps({KEY: span_policy(30)}),
        )
        db.session.add(table)
        db.session.commit()
        table_id = table.id
    yield table_id
    with app.app_context():
        db.session.rollback()
        for row in db.session.query(SqlaTable).filter_by(table_name=TABLE_NAME):
            db.session.delete(row)
        db.session.commit()


class TestDashboardWrites(LimitsTestCase):
    @with_feature_flags(**FLAG_ON)
    def test_create_says_which_unit_family_to_use(self) -> None:
        self.login(ADMIN_USERNAME)
        sub_day = span_policy(14)
        sub_day["max_span"] = {"quantity": 48, "time_grain": "PT1H"}
        with patch.dict(app.config, GLOBAL_14_DAYS):
            response = self.client.post(
                "/api/v1/dashboard/",
                json={"dashboard_title": "x", "json_metadata": metadata(sub_day)},
            )
        assert response.status_code == 422, response.json
        assert response.json["message"] == {
            f"json_metadata.{KEY}.max_span.time_grain": [
                "Dashboard maximum span must be 14 days or less. "
                "Use a unit of a day or longer."
            ]
        }

    @with_feature_flags(**FLAG_ON)
    def test_create_names_the_missing_key_of_a_given_rule_first(self) -> None:
        self.login(ADMIN_USERNAME)
        partial = {"schema_version": 1, "max_span": {"quantity": 5}}
        response = self.client.post(
            "/api/v1/dashboard/",
            json={"dashboard_title": "x", "json_metadata": metadata(partial)},
        )
        assert response.status_code == 400, response.json
        assert response.json["message"] == {
            f"json_metadata.{KEY}.max_span.time_grain": [
                "Missing time range limits key(s): max_span.time_grain, "
                "max_look_back, max_look_forward"
            ]
        }

    @with_feature_flags(**FLAG_ON)
    def test_update_merges_the_policy_key_omitted_null_or_set(self) -> None:
        dashboard = self.dashboard(span_policy(30))
        self.login(ADMIN_USERNAME)
        uri = f"/api/v1/dashboard/{dashboard.id}"
        with patch.dict(app.config, GLOBAL_14_DAYS):
            omitted = self.client.put(
                uri, json={"json_metadata": metadata(color_scheme="x")}
            )
            db.session.expire_all()
            kept = stored_policy(db.session.get(Dashboard, dashboard.id).json_metadata)
            removed = self.client.put(
                uri, json={"json_metadata": json.dumps({KEY: None})}
            )
            db.session.expire_all()
            after_null = stored_policy(
                db.session.get(Dashboard, dashboard.id).json_metadata
            )
            stricter = self.client.put(
                uri, json={"json_metadata": metadata(span_policy(7))}
            )
        assert omitted.status_code == 200, omitted.json
        assert kept == span_policy(30)
        assert removed.status_code == 200, removed.json
        assert after_null is None
        assert stricter.status_code == 200, stricter.json
        db.session.expire_all()
        assert stored_policy(
            db.session.get(Dashboard, dashboard.id).json_metadata
        ) == span_policy(7)

    def test_flag_off_update_without_the_key_is_unchanged(self) -> None:
        dashboard = self.dashboard()
        self.login(ADMIN_USERNAME)
        response = self.client.put(
            f"/api/v1/dashboard/{dashboard.id}",
            json={"json_metadata": metadata(color_scheme="x")},
        )
        assert response.status_code == 200, response.json

    @with_feature_flags(**FLAG_ON)
    def test_copy_refuses_a_looser_policy_and_takes_the_body_policy(self) -> None:
        dashboard = self.dashboard(span_policy(7))
        self.login(ADMIN_USERNAME)
        uri = f"/api/v1/dashboard/{dashboard.id}/copy/"
        with patch.dict(app.config, GLOBAL_14_DAYS):
            looser = self.client.post(
                uri,
                json={
                    "dashboard_title": "copy",
                    "json_metadata": metadata(span_policy(30)),
                },
            )
            shape = self.client.post(
                uri,
                json={"dashboard_title": "copy", "json_metadata": metadata(SHAPE_ONLY)},
            )
            ok = self.client.post(
                uri, json={"dashboard_title": "copy", "json_metadata": metadata()}
            )
        assert looser.status_code == 422, looser.json
        assert looser.json["message"] == DASHBOARD_LOOSER
        assert shape.status_code == 400, shape.json
        assert ok.status_code == 200, ok.json
        copied = db.session.get(Dashboard, ok.json["result"]["id"])
        self.track(copied)
        assert stored_policy(copied.json_metadata) == span_policy(7)

    def test_copy_keeps_an_omitted_stored_policy(self) -> None:
        """An omitted override inherits the source on either flag setting."""
        dashboard = self.dashboard(span_policy(7))
        self.login(ADMIN_USERNAME)
        for flag_on in (False, True):
            with (
                patch.object(
                    feature_flag_manager, "is_feature_enabled", return_value=flag_on
                ),
                patch.dict(app.config, GLOBAL_14_DAYS),
            ):
                response = self.client.post(
                    f"/api/v1/dashboard/{dashboard.id}/copy/",
                    json={"dashboard_title": "copy", "json_metadata": metadata()},
                )
            assert response.status_code == 200, response.json
            copied = db.session.get(Dashboard, response.json["result"]["id"])
            self.track(copied)
            assert stored_policy(copied.json_metadata) == span_policy(7)

    @with_feature_flags(**FLAG_ON)
    def test_copy_validates_an_inherited_policy(self) -> None:
        """Inheritance must not bypass validation of a new dashboard policy."""
        dashboard = self.dashboard(span_policy(30))
        self.login(ADMIN_USERNAME)
        with patch.dict(app.config, GLOBAL_14_DAYS):
            response = self.client.post(
                f"/api/v1/dashboard/{dashboard.id}/copy/",
                json={"dashboard_title": "copy", "json_metadata": metadata()},
            )
        if response.status_code == 200:
            self.track(db.session.get(Dashboard, response.json["result"]["id"]))
        assert response.status_code == 422, response.json
        assert response.json["message"] == DASHBOARD_LOOSER


class TestDatasetWrites(LimitsTestCase):
    @pytest.fixture(autouse=True)
    def _table(self, limits_table: int) -> None:
        self.table_id = limits_table

    def legacy_save(self, extra: dict[str, Any]) -> Any:
        table = db.session.get(SqlaTable, self.table_id)
        payload = {
            "id": table.id,
            "type": "table",
            "database": {"id": table.database_id},
            "table_name": table.table_name,
            "datasource_name": table.table_name,
            "schema": table.schema,
            "sql": table.sql,
            "columns": [],
            "metrics": [],
            "extra": json.dumps(extra),
        }
        return self.client.post("/datasource/save/", data={"data": json.dumps(payload)})

    @with_feature_flags(**FLAG_ON)
    def test_legacy_datasource_save_refuses_bad_and_looser_policies(self) -> None:
        self.login(ADMIN_USERNAME)
        with patch.dict(app.config, GLOBAL_14_DAYS):
            looser = self.legacy_save({KEY: span_policy(40)})
            shape = self.legacy_save({KEY: SHAPE_ONLY})
            stricter = self.legacy_save({KEY: span_policy(7)})
        assert looser.status_code == 422, looser.json
        assert looser.json["message"] == DATASET_LOOSER
        assert shape.status_code == 400, shape.json
        assert stricter.status_code == 200, stricter.json


class TestImports(LimitsTestCase):
    def tearDown(self) -> None:
        db.session.rollback()
        for model_cls, uuid in (
            (Dashboard, dashboard_config["uuid"]),
            (Slice, chart_config["uuid"]),
            (SqlaTable, dataset_config["uuid"]),
            (Database, database_config["uuid"]),
        ):
            for row in (
                db.session.query(model_cls)
                .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {model_cls}})
                .filter_by(uuid=uuid)
            ):
                if isinstance(row, Dashboard):
                    row.slices = []
                db.session.delete(row)
        for title in ("Births 2", "Limits slug"):
            for row in db.session.query(Dashboard).filter_by(dashboard_title=title):
                db.session.delete(row)
        for row in db.session.query(Slice).filter_by(
            slice_name="Number of California Births"
        ):
            db.session.delete(row)
        for row in db.session.query(SqlaTable).filter_by(table_name="birth_names_2"):
            db.session.delete(row)
        db.session.commit()
        super().tearDown()

    def dashboard_bundle(self, policy: Any, **overrides: Any) -> BytesIO:
        dashboard = copy.deepcopy(dashboard_config)
        dashboard["metadata"][KEY] = policy
        dashboard.update(overrides)
        return zip_bundle(
            dashboard_metadata_config,
            {
                "databases/db.yaml": database_config,
                "datasets/ds.yaml": dataset_config,
                "charts/chart.yaml": chart_config,
                "dashboards/dash.yaml": dashboard,
            },
        )

    def dataset_bundle(self, policy: Any, **overrides: Any) -> BytesIO:
        dataset = copy.deepcopy(dataset_config)
        dataset["extra"] = json.dumps({KEY: policy})
        dataset.update(overrides)
        return zip_bundle(
            dataset_metadata_config,
            {"databases/db.yaml": database_config, "datasets/ds.yaml": dataset},
        )

    def import_dashboard(self, buf: BytesIO) -> Any:
        return self.client.post(
            "/api/v1/dashboard/import/",
            data={"formData": (buf, "export.zip"), "overwrite": "true"},
            content_type="multipart/form-data",
        )

    def import_dataset(self, buf: BytesIO) -> Any:
        return self.client.post(
            "/api/v1/dataset/import/",
            data={"formData": (buf, "export.zip"), "overwrite": "true"},
            content_type="multipart/form-data",
        )

    def soft_delete(self, model: type, uuid: str) -> None:
        row = db.session.query(model).filter_by(uuid=uuid).one()
        resource = "dashboard" if model is Dashboard else "dataset"
        response = self.client.delete(f"/api/v1/{resource}/{row.id}")
        assert response.status_code == 200, response.json
        db.session.expire_all()

    def test_v0_dashboard_import_refuses_a_looser_policy(self) -> None:
        content = copy.deepcopy(dashboard_export)
        content["datasources"][0]["__SqlaTable__"]["extra"] = json.dumps(
            {KEY: span_policy(30)}
        )
        content["dashboards"][0]["__Dashboard__"]["json_metadata"] = metadata(
            span_policy(30), remote_id=1
        )
        with with_flag_and_global():
            with pytest.raises(CommandInvalidError) as excinfo:
                dashboard_v0.ImportDashboardsCommand(
                    {"v0.json": json.dumps(content)}
                ).run()
        messages = excinfo.value.normalized_messages()["v0.json"]
        assert messages["dashboards"] == {
            0: {
                "json_metadata": {
                    f"{KEY}.max_span.quantity": [
                        "Dashboard maximum span must be 14 days or less."
                    ]
                }
            }
        }
        assert messages["datasources"] == {
            "examples.birth_names_2": {
                "extra": {
                    f"{KEY}.max_span.quantity": [
                        "Dataset maximum span must be 14 days or less."
                    ]
                }
            }
        }

    def test_flag_off_v0_imports_store_a_bad_shape(self) -> None:
        content = copy.deepcopy(dashboard_export)
        content["datasources"][0]["__SqlaTable__"]["extra"] = json.dumps(
            {KEY: SHAPE_ONLY}
        )
        content["dashboards"][0]["__Dashboard__"]["json_metadata"] = metadata(
            SHAPE_ONLY, remote_id=1
        )
        dashboard_v0.ImportDashboardsCommand({"v0.json": json.dumps(content)}).run()
        config = copy.deepcopy(dataset_ui_export)
        config[0]["extra"] = json.dumps({KEY: SHAPE_ONLY})
        dataset_v0.ImportDatasetsCommand({"v0.yaml": yaml.safe_dump(config)}).run()
        db.session.expire_all()
        table = db.session.query(SqlaTable).filter_by(table_name="birth_names_2").one()
        assert stored_policy(table.extra) == SHAPE_ONLY

    def test_v0_dataset_import_refuses_a_looser_policy(self) -> None:
        config = copy.deepcopy(dataset_ui_export)
        config[0]["extra"] = json.dumps({KEY: span_policy(30)})
        with with_flag_and_global():
            with pytest.raises(CommandInvalidError) as excinfo:
                dataset_v0.ImportDatasetsCommand(
                    {"v0.yaml": yaml.safe_dump(config)}
                ).run()
        assert excinfo.value.normalized_messages() == {
            "v0.yaml": {
                "examples.birth_names_2": {
                    "extra": {
                        f"{KEY}.max_span.quantity": [
                            "Dataset maximum span must be 14 days or less."
                        ]
                    }
                }
            }
        }

    def test_v0_dashboard_import_with_a_user_checks_the_policy_before_permissions(
        self,
    ) -> None:
        def contents(policy: dict[str, Any]) -> dict[str, str]:
            content = copy.deepcopy(dashboard_export)
            content["datasources"][0]["__SqlaTable__"]["extra"] = json.dumps(
                {KEY: policy}
            )
            content["dashboards"][0]["__Dashboard__"]["json_metadata"] = metadata(
                policy, remote_id=1
            )
            return {"v0.json": json.dumps(content)}

        with (
            with_flag_and_global(),
            override_user(security_manager.find_user(GAMMA_USERNAME)),
        ):
            with pytest.raises(CommandInvalidError) as looser:
                dashboard_v0.ImportDashboardsCommand(contents(span_policy(30))).run()
            with pytest.raises(ImportFailedError) as stricter:
                dashboard_v0.ImportDashboardsCommand(contents(span_policy(7))).run()
        assert f"{KEY}.max_span.quantity" in json.dumps(
            looser.value.normalized_messages()
        )
        assert "permission to create or update datasets" in str(stricter.value)


class with_flag_and_global:  # noqa: N801
    """The flag on and a 14-day global span, for part of a test."""

    def __init__(self, config: dict[str, Any] | None = None) -> None:
        self._flags = patch(
            "superset.extensions.feature_flag_manager.get_feature_flags",
            return_value={
                **(feature_flag_manager._feature_flags or {}),
                FEATURE_FLAG: True,
                "SOFT_DELETE": True,
            },
        )
        self._config = patch.dict(app.config, config or GLOBAL_14_DAYS)

    def __enter__(self) -> None:
        self._flags.__enter__()
        self._config.__enter__()

    def __exit__(self, *args: Any) -> None:
        self._config.__exit__(*args)
        self._flags.__exit__(*args)


class TestRestore(LimitsTestCase):
    def version_uuid(self, model: Any, column: str, policy: Any) -> str:
        ver_cls = version_class(type(model))
        rows = (
            db.session.query(ver_cls)
            .filter(ver_cls.id == model.id, ver_cls.uuid == model.uuid)
            .order_by(ver_cls.transaction_id.asc())
            .all()
        )
        row = next(r for r in rows if stored_policy(getattr(r, column)) == policy)
        return str(derive_version_uuid(model.uuid, row.transaction_id))

    def restore_dashboard(self, dashboard: Dashboard, version: str) -> Any:
        return self.client.post(
            f"/api/v1/dashboard/{dashboard.uuid}/versions/{version}/restore"
        )

    def edit(self, dashboard: Dashboard, policy: Any, **extra: Any) -> None:
        dashboard.json_metadata = metadata(policy, **extra)
        db.session.commit()

    def test_version_restore_refuses_a_looser_dashboard_policy(self) -> None:
        dashboard = self.dashboard(span_policy(30))
        self.edit(dashboard, span_policy(7))
        version = self.version_uuid(dashboard, "json_metadata", span_policy(30))
        self.login(ADMIN_USERNAME)
        with with_flag_and_global():
            before = len(audit_rows("dashboard", dashboard.id))
            response = self.restore_dashboard(dashboard, version)
            db.session.expire_all()
            after = len(audit_rows("dashboard", dashboard.id))
        assert response.status_code == 422, response.json
        assert response.json["message"] == DASHBOARD_LOOSER
        assert stored_policy(
            db.session.get(Dashboard, dashboard.id).json_metadata
        ) == span_policy(7)
        assert after == before

    def test_version_restore_accepts_a_policy_equal_to_the_live_one(self) -> None:
        dashboard = self.dashboard(span_policy(30))
        self.edit(dashboard, span_policy(30), color_scheme="x")
        version = self.version_uuid(dashboard, "json_metadata", span_policy(30))
        self.login(ADMIN_USERNAME)
        with with_flag_and_global():
            response = self.restore_dashboard(dashboard, version)
        assert response.status_code == 200, response.json

    def test_version_restore_of_a_stricter_policy_writes_one_audit_row(self) -> None:
        dashboard = self.dashboard(span_policy(7))
        self.edit(dashboard, span_policy(10))
        version = self.version_uuid(dashboard, "json_metadata", span_policy(7))
        self.login(ADMIN_USERNAME)
        with with_flag_and_global():
            before = audit_rows("dashboard", dashboard.id)
            response = self.restore_dashboard(dashboard, version)
            db.session.expire_all()
            after = audit_rows("dashboard", dashboard.id)
        assert response.status_code == 200, response.json
        new_rows = after[len(before) :]
        assert len(new_rows) == 1
        assert new_rows[0]["old"] == span_policy(10)
        assert new_rows[0]["new"] == span_policy(7)
        assert new_rows[0]["path"].endswith("/restore")

    def test_version_restore_answers_503_when_the_global_is_invalid(self) -> None:
        dashboard = self.dashboard(span_policy(30))
        self.edit(dashboard, span_policy(7))
        version = self.version_uuid(dashboard, "json_metadata", span_policy(30))
        self.login(ADMIN_USERNAME)
        with with_flag_and_global(INVALID_GLOBAL):
            response = self.restore_dashboard(dashboard, version)
        self.assert_unavailable(response)

    def test_flag_off_version_restore_brings_back_a_looser_policy(self) -> None:
        dashboard = self.dashboard(span_policy(30))
        self.edit(dashboard, span_policy(7))
        version = self.version_uuid(dashboard, "json_metadata", span_policy(30))
        self.login(ADMIN_USERNAME)
        with patch.dict(app.config, GLOBAL_14_DAYS):
            response = self.restore_dashboard(dashboard, version)
        assert response.status_code == 200, response.json

    @pytest.mark.usefixtures("load_birth_names_dashboard_with_slices")
    def test_version_restore_refuses_a_looser_dataset_policy(self) -> None:
        # an existing dataset, as the versioning tests use: SQLite reuses the id
        # of a deleted table, and a new table would inherit its column history
        table = db.session.query(SqlaTable).filter_by(table_name="birth_names").one()
        table_id, original_extra = table.id, table.extra
        try:
            table.extra = json.dumps({KEY: span_policy(30)})
            db.session.commit()
            table.extra = json.dumps({KEY: span_policy(7)})
            db.session.commit()
            version = self.version_uuid(table, "extra", span_policy(30))
            self.login(ADMIN_USERNAME)
            with with_flag_and_global():
                response = self.client.post(
                    f"/api/v1/dataset/{table.uuid}/versions/{version}/restore"
                )
            assert response.status_code == 422, response.json
            assert response.json["message"] == DATASET_LOOSER
            db.session.expire_all()
            assert stored_policy(
                db.session.get(SqlaTable, table_id).extra
            ) == span_policy(7)
        finally:
            db.session.rollback()
            restored = db.session.get(SqlaTable, table_id)
            restored.extra = original_extra
            db.session.commit()

    def test_soft_delete_restore_keeps_a_stale_looser_dashboard_policy(self) -> None:
        dashboard = self.dashboard(span_policy(30))
        self.login(ADMIN_USERNAME)
        with with_flag_and_global():
            deleted = self.client.delete(f"/api/v1/dashboard/{dashboard.id}")
            before = len(audit_rows("dashboard", dashboard.id))
            restored = self.client.post(f"/api/v1/dashboard/{dashboard.uuid}/restore")
            db.session.expire_all()
            after = len(audit_rows("dashboard", dashboard.id))
        assert deleted.status_code == 200, deleted.json
        assert restored.status_code == 200, restored.json
        assert stored_policy(
            db.session.get(Dashboard, dashboard.id).json_metadata
        ) == span_policy(30)
        assert after == before

    def test_soft_delete_restore_keeps_a_stale_looser_dataset_policy(self) -> None:
        table = SqlaTable(
            table_name=f"{TABLE_NAME}_{uuid4().hex[:6]}",
            database=get_example_database(),
            extra=json.dumps({KEY: span_policy(30)}),
        )
        db.session.add(table)
        db.session.commit()
        self.track(table)
        self.login(ADMIN_USERNAME)
        with with_flag_and_global():
            deleted = self.client.delete(f"/api/v1/dataset/{table.id}")
            restored = self.client.post(f"/api/v1/dataset/{table.uuid}/restore")
        assert deleted.status_code == 200, deleted.json
        assert restored.status_code == 200, restored.json
        db.session.expire_all()
        assert stored_policy(db.session.get(SqlaTable, table.id).extra) == span_policy(
            30
        )

    def test_soft_delete_restore_filter_cleanup_keeps_the_policy_without_audit(
        self,
    ) -> None:
        dashboard = self.dashboard()
        dashboard.json_metadata = metadata(
            span_policy(30),
            native_filter_configuration=[
                {
                    "id": "NATIVE_FILTER-semantic",
                    "targets": [
                        {"datasourceType": "semantic_view", "datasetId": 2**31 - 1}
                    ],
                },
                {"id": "NATIVE_FILTER-kept", "targets": []},
            ],
        )
        db.session.commit()
        self.login(ADMIN_USERNAME)
        with with_flag_and_global():
            deleted = self.client.delete(f"/api/v1/dashboard/{dashboard.id}")
            before = len(audit_rows("dashboard", dashboard.id))
            restored = self.client.post(f"/api/v1/dashboard/{dashboard.uuid}/restore")
            db.session.expire_all()
            after = len(audit_rows("dashboard", dashboard.id))
        assert deleted.status_code == 200, deleted.json
        assert restored.status_code == 200, restored.json
        assert "removed 1 dashboard filter" in restored.json["message"]
        stored = json.loads(db.session.get(Dashboard, dashboard.id).json_metadata)
        assert [f["id"] for f in stored["native_filter_configuration"]] == [
            "NATIVE_FILTER-kept"
        ]
        assert stored[KEY] == span_policy(30)
        assert after == before

    def test_soft_delete_restore_of_a_dataset_writes_no_audit_row(self) -> None:
        table = SqlaTable(
            table_name=f"{TABLE_NAME}_{uuid4().hex[:6]}",
            database=get_example_database(),
            extra=json.dumps({KEY: span_policy(30)}),
        )
        db.session.add(table)
        db.session.commit()
        self.track(table)
        self.login(ADMIN_USERNAME)
        with with_flag_and_global():
            deleted = self.client.delete(f"/api/v1/dataset/{table.id}")
            before = len(audit_rows("dataset", table.id))
            restored = self.client.post(f"/api/v1/dataset/{table.uuid}/restore")
            db.session.expire_all()
            after = len(audit_rows("dataset", table.id))
        assert deleted.status_code == 200, deleted.json
        assert restored.status_code == 200, restored.json
        assert after == before


class TestAudit(LimitsTestCase):
    @with_feature_flags(**FLAG_ON)
    def test_one_audit_row_per_real_change_and_none_when_unchanged(self) -> None:
        dashboard = self.dashboard(span_policy(10))
        self.login(ADMIN_USERNAME)
        uri = f"/api/v1/dashboard/{dashboard.id}"
        with patch.dict(app.config, GLOBAL_14_DAYS):
            start = len(audit_rows("dashboard", dashboard.id))
            self.client.put(uri, json={"json_metadata": metadata(span_policy(7))})
            db.session.expire_all()
            changed = audit_rows("dashboard", dashboard.id)[start:]
            self.client.put(
                uri, json={"json_metadata": metadata(span_policy(7), color_scheme="y")}
            )
            db.session.expire_all()
            unchanged = audit_rows("dashboard", dashboard.id)[start + 1 :]
        assert len(changed) == 1
        assert changed[0]["old"] == span_policy(10)
        assert changed[0]["new"] == span_policy(7)
        assert unchanged == []


class TestLimitsApi(LimitsTestCase):
    @with_feature_flags(**FLAG_ON)
    def test_global_get_is_admin_only(self) -> None:
        responses = {}
        for username in (ADMIN_USERNAME, ALPHA_USERNAME, GAMMA_USERNAME):
            self.login(username)
            with patch.dict(app.config, GLOBAL_14_DAYS):
                responses[username] = self.client.get("/api/v1/time_range_limits/")
            self.logout()
        assert responses[ADMIN_USERNAME].status_code == 200
        assert responses[ADMIN_USERNAME].json["result"]["policy"] == {
            "max_span": {"quantity": 14, "time_grain": "P1D"},
            "max_look_back": None,
            "max_look_forward": None,
        }
        assert responses[ALPHA_USERNAME].status_code == 403
        assert responses[GAMMA_USERNAME].status_code == 403

    @with_feature_flags(**FLAG_ON)
    def test_global_get_answers_503_when_the_global_is_invalid(self) -> None:
        self.login(ADMIN_USERNAME)
        with patch.dict(app.config, INVALID_GLOBAL):
            response = self.client.get("/api/v1/time_range_limits/")
        self.assert_unavailable(response)

    @with_feature_flags(**FLAG_ON)
    def test_chart_ranges_caps_the_number_of_charts(self) -> None:
        self.login(ADMIN_USERNAME)
        uri = "/api/v1/time_range_limits/chart_ranges/"
        too_many = self.client.post(
            uri, json={"charts": [{"key": str(i)} for i in range(51)]}
        )
        ok = self.client.post(uri, json={"charts": [{"key": "a", "query_context": {}}]})
        assert too_many.status_code == 400, too_many.json
        assert ok.status_code == 200, ok.json
        (answer,) = ok.json["result"]["charts"]
        assert answer["key"] == "a"
        assert answer["status"] == "error"

    @with_feature_flags(**FLAG_ON)
    def test_dashboard_limits_endpoints_need_an_editor_to_change(self) -> None:
        dashboard = self.dashboard(span_policy(7))
        alpha = security_manager.find_user(ALPHA_USERNAME)
        own = self.dashboard(span_policy(7), title="Alpha's")
        own.editors = subjects_from_users([alpha])
        db.session.commit()
        self.login(ALPHA_USERNAME)
        base = f"/api/v1/dashboard/{dashboard.id}/time_range_limits/"
        own_base = f"/api/v1/dashboard/{own.id}/time_range_limits/"
        with patch.dict(app.config, GLOBAL_14_DAYS):
            get = self.client.get(base)
            put = self.client.put(base, json={"policy": span_policy(5)})
            charts = self.client.get(f"{base}charts/")
            own_put = self.client.put(own_base, json={"policy": span_policy(5)})
            own_looser = self.client.put(own_base, json={"policy": span_policy(30)})
            own_charts = self.client.get(f"{own_base}charts/")
        assert get.status_code == 200, get.json
        assert get.json["result"]["dashboard"]["max_span"] == {
            "quantity": 7,
            "time_grain": "P1D",
        }
        assert put.status_code == 403, put.json
        assert charts.status_code == 403, charts.json
        assert own_put.status_code == 200, own_put.json
        assert own_looser.status_code == 422, own_looser.json
        assert own_looser.json["message"] == {
            "policy.max_span.quantity": [
                "Dashboard maximum span must be 14 days or less."
            ]
        }
        assert own_charts.status_code == 200, own_charts.json

    @with_feature_flags(**FLAG_ON)
    def test_limits_put_refuses_an_externally_managed_dashboard(self) -> None:
        dashboard = self.dashboard(span_policy(7), is_managed_externally=True)
        self.login(ADMIN_USERNAME)
        with patch.dict(app.config, GLOBAL_14_DAYS):
            response = self.client.put(
                f"/api/v1/dashboard/{dashboard.id}/time_range_limits/",
                json={"policy": span_policy(5)},
            )
        assert response.status_code == 403, response.json
        db.session.expire_all()
        assert stored_policy(db.session.get(Dashboard, dashboard.id).json_metadata) == (
            span_policy(7)
        )

    @with_feature_flags(**FLAG_ON)
    def test_dashboard_get_names_the_stored_value_only_to_editors(self) -> None:
        bad = {**span_policy(7), "max_span": {"quantity": 2, "time_grain": "P1W-old"}}
        dashboard = self.dashboard(bad)
        url = f"/api/v1/dashboard/{dashboard.id}/time_range_limits/"
        with patch.dict(app.config, GLOBAL_14_DAYS):
            self.login(ALPHA_USERNAME)
            viewer = self.client.get(url)
            self.logout()
            self.login(ADMIN_USERNAME)
            editor = self.client.get(url)
        self.assert_unavailable(viewer)
        self.assert_unavailable(editor)
        assert "value" not in viewer.json["errors"][0]["extra"]
        assert viewer.json["errors"][0]["extra"]["field"] == "max_span.time_grain"
        assert editor.json["errors"][0]["extra"]["value"] == "P1W-old"

        dashboard.json_metadata = metadata(span_policy(7))
        table = SqlaTable(
            table_name=f"{TABLE_NAME}_{uuid4().hex[:6]}",
            database=get_example_database(),
            extra=json.dumps({KEY: bad}),
        )
        db.session.add(table)
        db.session.commit()
        self.track(table)
        chart = Slice(
            slice_name="Limits writes chart",
            datasource_type="table",
            datasource_id=table.id,
            viz_type="table",
            params="{}",
        )
        db.session.add(chart)
        db.session.commit()
        self.track(chart)
        dashboard.slices = [chart]
        db.session.commit()
        dashboard_id = dashboard.id
        self.logout()
        with (
            patch.dict(app.config, GLOBAL_14_DAYS),
            self.temporary_user(
                clone_user=security_manager.find_user(GAMMA_USERNAME), login=True
            ) as dashboard_editor,
        ):
            dashboard = db.session.get(Dashboard, dashboard_id)
            dashboard.editors = subjects_from_users([dashboard_editor])
            db.session.commit()
            no_dataset_access = [
                self.client.get(url),
                self.client.get(f"{url}charts/"),
            ]
            self.logout()
            self.login(ADMIN_USERNAME)
            dataset_editor = [
                self.client.get(url),
                self.client.get(f"{url}charts/"),
            ]
            dashboard = db.session.get(Dashboard, dashboard_id)
            dashboard.editors = []
            db.session.commit()
        assert no_dataset_access[0].status_code == 200, no_dataset_access[0].json
        assert no_dataset_access[0].json["result"]["datasets"] == []
        for response in dataset_editor[1:]:
            self.assert_unavailable(response)
            assert response.json["errors"][0]["extra"]["source"] == "dataset"
            assert response.json["errors"][0]["extra"]["dataset_id"] == table.id
        assert no_dataset_access[1].status_code == 200, no_dataset_access[1].json
        assert no_dataset_access[1].json["result"]["charts"] == []
        assert no_dataset_access[1].json["result"]["unchecked"] == []
        for response in dataset_editor[1:]:
            assert response.json["errors"][0]["extra"]["value"] == "P1W-old"
        assert dataset_editor[0].status_code == 200, dataset_editor[0].json
        (entry,) = dataset_editor[0].json["result"]["datasets"]
        assert entry["id"] == table.id
        assert entry["policy"] is None
        assert entry["error"]["extra"]["source"] == "dataset"
        assert entry["error"]["extra"]["dataset_id"] == table.id
        assert entry["error"]["extra"]["value"] == "P1W-old"

    @with_feature_flags(**FLAG_ON)
    def test_dashboard_dataset_error_is_isolated_and_private(self) -> None:
        """Readers keep healthy policies while stored values stay editor-only."""
        dashboard = self.dashboard(span_policy(14))
        bad = {**span_policy(7), "max_span": {"quantity": 2, "time_grain": "P1W-old"}}
        tables = []
        for policy in (span_policy(7), bad):
            table = SqlaTable(
                table_name=f"{TABLE_NAME}_{uuid4().hex[:6]}",
                database=get_example_database(),
                extra=json.dumps({KEY: policy}),
            )
            db.session.add(table)
            db.session.commit()
            self.track(table)
            tables.append(table)
            chart = Slice(
                slice_name="Limits policy check",
                datasource_type="table",
                datasource_id=table.id,
                viz_type="table",
                params="{}",
            )
            db.session.add(chart)
            db.session.commit()
            self.track(chart)
            dashboard.slices.append(chart)
        db.session.commit()
        for username in (ALPHA_USERNAME, ADMIN_USERNAME):
            self.login(username)
            with patch.dict(app.config, GLOBAL_90_DAYS):
                response = self.client.get(
                    f"/api/v1/dashboard/{dashboard.id}/time_range_limits/"
                )
            assert response.status_code == 200, response.json
            datasets = {
                item["id"]: item for item in response.json["result"]["datasets"]
            }
            assert datasets[tables[0].id]["policy"]["max_span"]["quantity"] == 7
            assert datasets[tables[1].id]["policy"] is None
            extra = datasets[tables[1].id]["error"]["extra"]
            assert extra["reason_code"] == "POLICY_UNAVAILABLE"
            if username == ADMIN_USERNAME:
                assert extra["value"] == "P1W-old"
            else:
                assert "value" not in extra
            self.logout()

    @pytest.mark.usefixtures("public_role_like_gamma_scoped")
    @with_feature_flags(**{**FLAG_ON, "EMBEDDED_SUPERSET": True})
    def test_guest_dataset_policies_follow_dashboard_and_token_access(self) -> None:
        """Guest policies follow dashboard membership and the token allowlist."""
        from superset.daos.dashboard import EmbeddedDashboardDAO
        from superset.security.guest_token import GuestTokenResourceType

        dashboard = self.dashboard(span_policy(14))
        other = self.dashboard(span_policy(14))
        tables = []
        for target in (dashboard, other):
            table = SqlaTable(
                table_name=f"{TABLE_NAME}_{uuid4().hex[:6]}",
                database=get_example_database(),
                extra=json.dumps({KEY: span_policy(7)}),
            )
            db.session.add(table)
            db.session.commit()
            self.track(table)
            tables.append(table)
            chart = Slice(
                slice_name="Limits guest policy",
                datasource_type="table",
                datasource_id=table.id,
                viz_type="table",
                params="{}",
            )
            db.session.add(chart)
            db.session.commit()
            self.track(chart)
            target.slices.append(chart)
        embedded = EmbeddedDashboardDAO.upsert(dashboard, [])
        EmbeddedDashboardDAO.upsert(other, [])
        db.session.commit()
        dashboard_id, other_id = dashboard.id, other.id
        table_ids = [table.id for table in tables]
        embedded_uuid = str(embedded.uuid)
        guest_client = app.test_client()
        for resource, allowlist, expected in (
            (embedded_uuid, None, [table_ids[0]]),
            (embedded_uuid, table_ids, [table_ids[0]]),
            (embedded_uuid, [table_ids[1]], []),
        ):
            token = security_manager.create_guest_access_token(
                {"username": "limits_guest"},
                [{"type": GuestTokenResourceType.DASHBOARD, "id": resource}],
                [],
                datasets=allowlist,
            )
            headers = {
                app.config["GUEST_TOKEN_HEADER_NAME"]: token.decode("utf-8")
                if isinstance(token, bytes)
                else token
            }
            with (
                app.app_context(),
                patch.dict(app.config, GLOBAL_90_DAYS),
                patch.object(
                    Dashboard,
                    "datasources",
                    new_callable=PropertyMock,
                    return_value={db.session.get(SqlaTable, id_) for id_ in table_ids},
                ),
            ):
                response = guest_client.get(
                    f"/api/v1/dashboard/{dashboard_id}/time_range_limits/",
                    headers=headers,
                )
                denied = guest_client.get(
                    f"/api/v1/dashboard/{other_id}/time_range_limits/",
                    headers=headers,
                )
            assert response.status_code == 200, response.json
            entries = response.json["result"]["datasets"]
            assert [entry["id"] for entry in entries] == expected
            if expected:
                assert entries[0]["policy"]["max_span"]["quantity"] == 7
            assert denied.status_code in (403, 404), denied.json
        db.session.get(Dashboard, dashboard_id).embedded = []
        db.session.get(Dashboard, other_id).embedded = []
        db.session.commit()

    def test_limits_put_log_line_names_the_dashboard(self) -> None:
        dashboard = self.dashboard(span_policy(7))
        self.login(ADMIN_USERNAME)
        with (
            with_flag_and_global(),
            patch(
                "superset.commands.dashboard.time_range_limits."
                "UpdateDashboardTimeRangeLimitsCommand.run",
                side_effect=DashboardUpdateFailedError(),
            ),
            patch("superset.dashboards.api.logger.error") as log,
        ):
            response = self.client.put(
                f"/api/v1/dashboard/{dashboard.id}/time_range_limits/",
                json={"policy": span_policy(5)},
            )
        assert response.status_code == 422
        assert log.call_args.args[1] == dashboard.id

    @with_feature_flags(**FLAG_ON)
    def test_dataset_limits_endpoints(self) -> None:
        table = SqlaTable(
            table_name=f"{TABLE_NAME}_{uuid4().hex[:6]}",
            database=get_example_database(),
            extra=json.dumps({KEY: span_policy(7)}),
        )
        db.session.add(table)
        db.session.commit()
        self.track(table)
        base = f"/api/v1/dataset/{table.id}/time_range_limits/"
        with patch.dict(app.config, GLOBAL_14_DAYS):
            self.login(ADMIN_USERNAME)
            get = self.client.get(base)
            charts = self.client.get(f"{base}charts/")
            self.logout()
            self.login(ALPHA_USERNAME)
            alpha_charts = self.client.get(f"{base}charts/")
        assert get.status_code == 200, get.json
        assert get.json["result"]["dataset"]["max_span"] == {
            "quantity": 7,
            "time_grain": "P1D",
        }
        assert get.json["result"]["time_grain_labels"]["P1D"] == "Day"
        assert charts.status_code == 200, charts.json
        assert alpha_charts.status_code == 403, alpha_charts.json

    @with_feature_flags(**FLAG_ON)
    def test_global_stored_value_is_named_only_to_an_admin_editor(self) -> None:
        bad_global = {
            "TIME_RANGE_LIMITS_GLOBAL": {
                **span_policy(14),
                "max_span": {"quantity": 2, "time_grain": "P1W-old"},
            }
        }
        alpha = security_manager.find_user(ALPHA_USERNAME)
        own = self.dashboard(span_policy(7), title="Alpha's")
        own.editors = subjects_from_users([alpha])
        table = SqlaTable(
            table_name=f"{TABLE_NAME}_{uuid4().hex[:6]}",
            database=get_example_database(),
            extra=json.dumps({KEY: span_policy(7)}),
        )
        table.editors = subjects_from_users([alpha])
        db.session.add(table)
        db.session.commit()
        self.track(table)
        dashboard_url = f"/api/v1/dashboard/{own.id}/time_range_limits/"
        dataset_url = f"/api/v1/dataset/{table.id}/time_range_limits/charts/"
        urls = [dashboard_url, f"{dashboard_url}charts/", dataset_url]
        with patch.dict(app.config, bad_global):
            self.login(ALPHA_USERNAME)
            editor = [self.client.get(url) for url in urls]
            self.logout()
            self.login(ADMIN_USERNAME)
            admin = [self.client.get(url) for url in urls]
        for response in editor + admin:
            self.assert_unavailable(response)
            assert response.json["errors"][0]["extra"]["source"] == "global"
        for response in editor:
            assert "value" not in response.json["errors"][0]["extra"]
        for response in admin:
            assert response.json["errors"][0]["extra"]["value"] == "P1W-old"

    def test_openapi_lists_503_on_the_guarded_writes(self) -> None:
        self.login(ADMIN_USERNAME)
        spec = self.client.get("/api/v1/_openapi").json
        paths = spec["paths"]
        assert "503" in paths["/api/v1/dashboard/"]["post"]["responses"]
        assert "503" in paths["/api/v1/dashboard/{pk}"]["put"]["responses"]
        copy_path = next(
            path
            for path in paths
            if path.startswith("/api/v1/dashboard/{id_or_slug}/copy")
        )
        assert "503" in paths[copy_path]["post"]["responses"]
        assert "503" in paths["/api/v1/dataset/{pk}"]["put"]["responses"]


@pytest.mark.usefixtures("limits_data")
class TestLimitsApiWithData(SupersetTestCase):
    @pytest.fixture(autouse=True)
    def _ids(self, limits_data: dict[str, int]) -> None:  # noqa: F811
        self.ids = limits_data

    @with_feature_flags(**FLAG_ON)
    def test_chart_ranges_reads_each_chart_range_without_running_it(self) -> None:
        self.login(ADMIN_USERNAME)
        with patch.dict(app.config, GLOBAL_14_DAYS):
            response = self.client.post(
                "/api/v1/time_range_limits/chart_ranges/",
                json={
                    "charts": [
                        {
                            "key": "chart",
                            "query_context": query_context(
                                self.ids["table"],
                                "Last 60 days",
                                dashboardId=self.ids["dashboard"],
                                slice_id=self.ids["chart"],
                            ),
                        }
                    ]
                },
            )
        assert response.status_code == 200, response.json
        (answer,) = response.json["result"]["charts"]
        assert answer["status"] == "ok", answer
        assert answer["dataset_id"] == self.ids["table"]
        assert answer["dashboard_id"] == self.ids["dashboard"]
        (found,) = answer["ranges"]
        assert found["source"][0]["kind"] in {"time_range", "adhoc_filter"}

    @with_feature_flags(**FLAG_ON)
    def test_dashboard_charts_check_lists_a_chart_the_policy_would_refuse(
        self,
    ) -> None:
        self.login(ADMIN_USERNAME)
        base = f"/api/v1/dashboard/{self.ids['dashboard']}/time_range_limits/"
        with patch.dict(app.config, GLOBAL_90_DAYS):
            stricter = self.client.get(
                f"{base}charts/?q={prison.dumps({'policy': span_policy(14)})}"
            )
            looser = self.client.get(
                f"{base}charts/?q={prison.dumps({'policy': span_policy(120)})}"
            )
        assert stricter.status_code == 200, stricter.json
        assert [chart["id"] for chart in stricter.json["result"]["charts"]] == [
            self.ids["chart"]
        ]
        assert stricter.json["result"]["charts"][0]["reason_code"] == (
            "MAX_SPAN_EXCEEDED"
        )
        assert looser.status_code == 422, looser.json

    @with_feature_flags(**FLAG_ON)
    def test_dashboard_charts_check_leaves_out_charts_the_editor_cannot_access(
        self,
    ) -> None:
        dashboard = db.session.get(Dashboard, self.ids["dashboard"])
        base = f"/api/v1/dashboard/{dashboard.id}/time_range_limits/"
        with (
            self.temporary_user(
                clone_user=security_manager.find_user(GAMMA_USERNAME), login=True
            ) as editor,
            patch.dict(app.config, GLOBAL_90_DAYS),
        ):
            dashboard.editors = subjects_from_users([editor])
            db.session.commit()
            response = self.client.get(
                f"{base}charts/?q={prison.dumps({'policy': span_policy(14)})}"
            )
            dashboard.editors = []
            db.session.commit()
        assert response.status_code == 200, response.json
        assert response.json["result"]["charts"] == []
        assert response.json["result"]["unchecked"] == []

    @with_feature_flags(**FLAG_ON)
    def test_dashboard_charts_check_caps_saved_chart_evaluation(self) -> None:
        """Only fifty readable charts are evaluated, with an explicit overflow flag."""
        dashboard = db.session.get(Dashboard, self.ids["dashboard"])
        source = db.session.get(Slice, self.ids["chart"])
        charts = [
            Slice(
                slice_name=f"Saved range {index}",
                viz_type=source.viz_type,
                datasource_type=source.datasource_type,
                datasource_id=source.datasource_id,
                params=source.params,
                query_context=source.query_context,
            )
            for index in range(50)
        ]
        original = list(dashboard.slices)
        dashboard.slices = [*original, *charts]
        db.session.add_all(charts)
        db.session.commit()
        self.login(ADMIN_USERNAME)
        expected_ids = sorted(chart.id for chart in [*original, *charts])[:50]
        lookup = DashboardDAO.get_by_id_or_slug

        def load_dashboard_in_reverse_order(id_or_slug: str) -> Dashboard:
            """Expose the real dashboard with an adverse relationship order."""
            loaded = lookup(id_or_slug)
            loaded.slices.sort(key=lambda chart: chart.id, reverse=True)
            return loaded

        try:
            with patch.object(
                DashboardDAO,
                "get_by_id_or_slug",
                side_effect=load_dashboard_in_reverse_order,
            ):
                response = self.client.get(
                    f"/api/v1/dashboard/{dashboard.id}/time_range_limits/charts/"
                    f"?q={prison.dumps({'policy': span_policy(14)})}"
                )
            assert response.status_code == 200, response.json
            assert response.json["result"]["truncated"] is True
            assert len(response.json["result"]["charts"]) == 50
            assert sorted(
                chart["id"] for chart in response.json["result"]["charts"]
            ) == (expected_ids)
            dashboard.slices = original
            db.session.commit()
            response = self.client.get(
                f"/api/v1/dashboard/{dashboard.id}/time_range_limits/charts/"
            )
            assert response.status_code == 200, response.json
            assert response.json["result"]["truncated"] is False
        finally:
            dashboard.slices = original
            for chart in charts:
                db.session.delete(chart)
            db.session.commit()

    @with_feature_flags(**FLAG_ON)
    def test_dashboard_charts_check_ignores_an_unreadable_dataset_policy(self) -> None:
        """An inaccessible chart's broken stored policy cannot fail the check."""
        dashboard = db.session.get(Dashboard, self.ids["dashboard"])
        table = db.session.get(SqlaTable, self.ids["table"])
        original_extra = table.extra
        original_editors = list(dashboard.editors)
        self.login(GAMMA_USERNAME)
        dashboard.editors = subjects_from_users(
            [security_manager.find_user(GAMMA_USERNAME)]
        )
        table.extra = json.dumps({KEY: SHAPE_ONLY})
        db.session.commit()
        try:
            response = self.client.get(
                f"/api/v1/dashboard/{dashboard.id}/time_range_limits/charts/"
            )
            assert response.status_code == 200, response.json
            assert response.json["result"]["charts"] == []
            assert response.json["result"]["unchecked"] == []
        finally:
            table.extra = original_extra
            dashboard.editors = original_editors
            db.session.commit()

    @with_feature_flags(**FLAG_ON)
    def test_chart_data_and_explore_unavailable_errors_have_no_stored_value(
        self,
    ) -> None:
        table = db.session.get(SqlaTable, self.ids["table"])
        saved_extra = table.extra
        bad = {**span_policy(7), "max_span": {"quantity": 2, "time_grain": "P1W-old"}}
        table.extra = json.dumps({KEY: bad})
        db.session.commit()
        self.login(ADMIN_USERNAME)
        try:
            with patch.dict(app.config, GLOBAL_14_DAYS):
                chart_data = self.client.post(
                    "/api/v1/chart/data",
                    json=query_context(self.ids["table"], "Last 7 days"),
                )
                explore = self.client.get(
                    f"/api/v1/explore/?slice_id={self.ids['chart']}"
                )
        finally:
            table = db.session.get(SqlaTable, self.ids["table"])
            table.extra = saved_extra
            db.session.commit()
        assert chart_data.status_code == 503, chart_data.json
        assert "value" not in chart_data.json["errors"][0]["extra"]
        assert explore.status_code == 200, explore.json
        error = explore.json["result"]["time_range_limits"]["error"]
        assert error["extra"]["reason_code"] == "POLICY_UNAVAILABLE"
        assert error["extra"]["field"] == "max_span.time_grain"
        assert "value" not in error["extra"]

    @with_feature_flags(**FLAG_ON)
    def test_dashboard_limits_put_unavailable_error_has_no_stored_value(
        self,
    ) -> None:
        table = db.session.get(SqlaTable, self.ids["table"])
        dashboard = db.session.get(Dashboard, self.ids["dashboard"])
        saved_extra, saved_metadata = table.extra, dashboard.json_metadata
        bad = {**span_policy(7), "max_span": {"quantity": 2, "time_grain": "P1W-old"}}
        table.extra = json.dumps({KEY: bad})
        db.session.commit()
        self.login(ADMIN_USERNAME)
        try:
            with patch.dict(app.config, GLOBAL_90_DAYS):
                response = self.client.put(
                    f"/api/v1/dashboard/{dashboard.id}/time_range_limits/",
                    json={"policy": span_policy(14)},
                )
        finally:
            table = db.session.get(SqlaTable, self.ids["table"])
            dashboard = db.session.get(Dashboard, self.ids["dashboard"])
            table.extra, dashboard.json_metadata = saved_extra, saved_metadata
            db.session.commit()
        assert response.status_code == 200, response.json
        (entry,) = response.json["result"]["datasets"]
        assert entry["id"] == table.id
        assert entry["policy"] is None
        extra = entry["error"]["extra"]
        assert extra["reason_code"] == "POLICY_UNAVAILABLE"
        assert extra["field"] == "max_span.time_grain"
        assert "value" not in extra

    @with_feature_flags(**FLAG_ON)
    def test_dataset_charts_check_lists_a_chart_the_policy_would_refuse(
        self,
    ) -> None:
        self.login(ADMIN_USERNAME)
        base = f"/api/v1/dataset/{self.ids['table']}/time_range_limits/"
        with patch.dict(app.config, GLOBAL_90_DAYS):
            response = self.client.get(
                f"{base}charts/?q={prison.dumps({'policy': span_policy(14)})}"
            )
        assert response.status_code == 200, response.json
        assert self.ids["chart"] in [
            chart["id"] for chart in response.json["result"]["charts"]
        ]

    @with_feature_flags(**FLAG_ON)
    def test_chart_ranges_answers_403_for_a_chart_the_user_cannot_access(
        self,
    ) -> None:
        database = get_example_database()
        readable = SqlaTable(
            table_name=f"{DATA_TABLE_NAME}_readable_{uuid4().hex[:6]}",
            database=database,
            sql=DATA_TABLE_SQL,
            main_dttm_col="ds",
            columns=[
                TableColumn(column_name="ds", is_dttm=True, type="TIMESTAMP"),
                TableColumn(column_name="name", type="VARCHAR(10)"),
            ],
            metrics=[SqlMetric(metric_name="count", expression="COUNT(*)")],
        )
        admin = security_manager.find_user(ADMIN_USERNAME)
        saved_query = Query(
            client_id=uuid4().hex[:11],
            database=database,
            sql=DATA_TABLE_SQL,
            user_id=admin.id,
        )
        db.session.add_all([readable, saved_query])
        db.session.commit()
        readable_id = readable.id
        query_body = query_context(0, "Last 60 days")
        query_body["datasource"] = {"id": saved_query.id, "type": "query"}
        try:
            with (
                self.temporary_user(
                    clone_user=security_manager.find_user(GAMMA_USERNAME),
                    extra_pvms=[("datasource_access", readable.perm)],
                    login=True,
                ),
                patch.dict(app.config, GLOBAL_14_DAYS),
            ):
                response = self.client.post(
                    "/api/v1/time_range_limits/chart_ranges/",
                    json={
                        "charts": [
                            {
                                "key": "denied",
                                "query_context": query_context(
                                    self.ids["table"], "Last 60 days"
                                ),
                            },
                            {"key": "query", "query_context": query_body},
                            {
                                "key": "readable",
                                "query_context": query_context(
                                    readable_id, "Last 60 days"
                                ),
                            },
                        ]
                    },
                )
        finally:
            db.session.delete(saved_query)
            db.session.delete(readable)
            db.session.commit()
        assert response.status_code == 200, response.json
        denied, query, ok = response.json["result"]["charts"]
        for answer in (denied, query):
            assert answer["status"] == "error", answer
            assert "ranges" not in answer
            assert answer["error"]["status"] == 403, answer
            (error,) = answer["error"]["body"]["errors"]
            assert error["error_type"] in {
                "DATASOURCE_SECURITY_ACCESS_ERROR",
                "TABLE_SECURITY_ACCESS_ERROR",
                "QUERY_SECURITY_ACCESS_ERROR",
            }, error
        assert ok["status"] == "ok", ok
        assert ok["dataset_id"] == readable_id
        assert ok["ranges"]
