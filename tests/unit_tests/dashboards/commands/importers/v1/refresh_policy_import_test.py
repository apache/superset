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
import copy
from io import BytesIO
from typing import Any
from zipfile import ZipFile

import pytest
import yaml
from flask import current_app
from marshmallow import ValidationError
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import db, security_manager
from superset.commands.dashboard.importers.v1.utils import import_dashboard
from superset.dashboards.schemas import ImportV1DashboardSchema
from superset.models.core import Log
from superset.models.dashboard import Dashboard
from superset.utils import json
from tests.integration_tests.fixtures.importexport import dashboard_config

POLICY = {
    "auto_refresh_allowed": True,
    "minimum_refresh_interval": {"value": 30, "unit": "seconds"},
}
BAD_POLICY = {"minimum_refresh_interval": {"value": 45, "unit": "seconds"}}
MIN = "auto_refresh_policy.minimum_refresh_interval"
BAD_MESSAGE = "45 seconds isn't a standard interval. Select one from the list."
FILE = "dashboards/test.yaml"


def config(policy: Any = None, frequency: Any = 0) -> dict[str, Any]:
    """Config."""
    metadata: dict[str, Any] = {"refresh_frequency": frequency}
    if policy is not None:
        metadata["auto_refresh_policy"] = copy.deepcopy(policy)
    return {
        "dashboard_title": dashboard_config["dashboard_title"],
        "uuid": dashboard_config["uuid"],
        "version": "1.0.0",
        "position": {},
        "metadata": metadata,
    }


@pytest.fixture
def schema(session: Session, mocker: MockerFixture) -> Session:
    """Schema."""
    Dashboard.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    mocker.patch.object(security_manager, "can_access", return_value=True)
    user = security_manager.user_model(
        username="importer", first_name="i", last_name="i", email="i@i.i"
    )
    session.add(user)
    session.commit()
    mocker.patch("flask_login.utils._get_user", return_value=user)
    return session


def history() -> list[dict[str, Any]]:
    """History."""
    rows = (
        db.session.query(Log)
        .filter_by(action="dashboard_refresh_policy_changed")
        .order_by(Log.id)
        .all()
    )
    return [{"dashboard_id": row.dashboard_id, **json.loads(row.json)} for row in rows]


def bundle(kind: str, dashboard: dict[str, Any]) -> BytesIO:
    """Bundle."""
    buf = BytesIO()
    with ZipFile(buf, "w") as zip_file:
        zip_file.writestr(
            "export/metadata.yaml",
            yaml.safe_dump(
                {"version": "1.0.0", "type": kind, "timestamp": "2020-11-04T21:27:44"}
            ),
        )
        zip_file.writestr(f"export/{FILE}", yaml.safe_dump(dashboard))
    buf.seek(0)
    return buf


def test_schema_rejects_an_invalid_policy() -> None:
    """Check schema rejects an invalid policy."""
    with pytest.raises(ValidationError) as excinfo:
        ImportV1DashboardSchema().load(config(BAD_POLICY))
    assert excinfo.value.messages == {"metadata": {MIN: [BAD_MESSAGE]}}


@pytest.mark.parametrize("policy", [None, {"auto_refresh_policy": None}])
@pytest.mark.parametrize("frequency", ["60", -5, 45])
def test_schema_without_policy_behaves_as_before(policy: Any, frequency: Any) -> None:
    """Check schema without policy behaves as before."""
    data = config(frequency=frequency)
    if policy:
        data["metadata"].update(policy)
    ImportV1DashboardSchema().load(data)


def test_schema_checks_against_no_stored_policy(mocker: MockerFixture) -> None:
    """Check schema checks against no stored policy."""
    mocker.patch.dict(
        current_app.config,
        {"DASHBOARD_AUTO_REFRESH_INTERVALS": [[30, "30 s"], [120, "2 min"]]},
    )
    policy = {
        "minimum_refresh_interval": {"value": 60, "unit": "seconds"},
        "maximum_refresh_interval": {"value": 60, "unit": "seconds"},
    }
    with pytest.raises(ValidationError) as excinfo:
        ImportV1DashboardSchema().load(config(policy))
    assert set(excinfo.value.messages["metadata"]) == {
        MIN,
        "auto_refresh_policy.maximum_refresh_interval",
    }


def test_dashboard_import_endpoint_rejects_an_invalid_policy(
    schema: Session, client: Any, full_api_access: None
) -> None:
    """Check dashboard import endpoint rejects an invalid policy."""
    response = client.post(
        "/api/v1/dashboard/import/",
        data={"formData": (bundle("Dashboard", config(BAD_POLICY)), "export.zip")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 422
    extra = response.json["errors"][0]["extra"]
    assert extra[FILE]["metadata"] == {MIN: [BAD_MESSAGE]}
    assert db.session.query(Dashboard).count() == 0
    assert history() == []


def test_assets_import_endpoint_rejects_an_invalid_policy(
    schema: Session, client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    """Check assets import endpoint rejects an invalid policy."""
    validate = mocker.spy(ImportV1DashboardSchema, "validate_refresh_policy")
    response = client.post(
        "/api/v1/assets/import/",
        data={"bundle": (bundle("assets", config(BAD_POLICY)), "export.zip")},
        content_type="multipart/form-data",
    )

    # A follow-up fix changes the generic assets error mapping to 422.
    assert response.status_code == 500
    assert validate.call_count == 1
    assert db.session.query(Dashboard).count() == 0
    assert history() == []

    response = client.post(
        "/api/v1/assets/import/",
        data={"bundle": (bundle("assets", config(POLICY, 60)), "export.zip")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 200
    dashboard = db.session.query(Dashboard).one()
    assert json.loads(dashboard.json_metadata)["auto_refresh_policy"] == POLICY
    assert [row["source"] for row in history()] == ["import_v1"]


def test_import_endpoint_stores_a_valid_policy(
    schema: Session, client: Any, full_api_access: None
) -> None:
    """Check import endpoint stores a valid policy."""
    response = client.post(
        "/api/v1/dashboard/import/",
        data={"formData": (bundle("Dashboard", config(POLICY, 60)), "export.zip")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    dashboard = db.session.query(Dashboard).one()
    assert json.loads(dashboard.json_metadata)["auto_refresh_policy"] == POLICY
    assert history() == [
        {
            "dashboard_id": dashboard.id,
            "old": None,
            "new": POLICY,
            "source": "import_v1",
        }
    ]


def test_import_history_rows(schema: Session, mocker: MockerFixture) -> None:
    """Check import history rows."""
    from superset.utils.core import override_user

    mocker.patch.object(security_manager, "can_access_dashboard", return_value=True)
    mocker.patch.object(security_manager, "is_admin", return_value=True)
    admin = security_manager.user_model(
        username="admin", first_name="a", last_name="a", email="a@a.a"
    )
    db.session.add(admin)
    db.session.flush()

    dashboard = import_dashboard(config())
    assert history() == []

    with override_user(admin):
        import_dashboard(config(POLICY, 60), overwrite=True)
        import_dashboard(config(POLICY, 30), overwrite=True)
        import_dashboard(config(), overwrite=True)

    assert history() == [
        {
            "dashboard_id": dashboard.id,
            "old": None,
            "new": POLICY,
            "source": "import_v1",
        },
        {
            "dashboard_id": dashboard.id,
            "old": POLICY,
            "new": None,
            "source": "import_v1",
        },
    ]


@pytest.fixture(autouse=True)
def enable_policy(mocker: MockerFixture) -> None:
    """Enable policy enforcement for the policy contract tests."""
    from superset.extensions import feature_flag_manager

    mocker.patch.dict(
        feature_flag_manager._feature_flags, {"AUTO_REFRESH_POLICY": True}
    )


def test_flag_off_import_preserves_invalid_policy(
    schema: Session, mocker: MockerFixture
) -> None:
    """Disabled import enforcement stores policy metadata and emits no history."""
    from superset.extensions import feature_flag_manager

    mocker.patch.dict(
        feature_flag_manager._feature_flags, {"AUTO_REFRESH_POLICY": False}
    )
    imported = ImportV1DashboardSchema().load(config("invalid", 45))
    import_dashboard(imported, overwrite=True, ignore_permissions=True)
    assert (
        db.session.query(Dashboard).one().params_dict["auto_refresh_policy"]
        == "invalid"
    )
    assert history() == []
