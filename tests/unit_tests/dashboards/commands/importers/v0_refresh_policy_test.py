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
from io import BytesIO
from typing import Any

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import db, security_manager
from superset.commands.dashboard.importers.v0 import ImportDashboardsCommand
from superset.commands.exceptions import CommandInvalidError
from superset.connectors.sqla.models import SqlaTable
from superset.models.core import Log
from superset.models.dashboard import Dashboard
from superset.utils import json

POLICY = {"minimum_refresh_interval": {"value": 30, "unit": "seconds"}}
FILE = "dashboard_export.json"


def export(policy: Any = None, frequency: Any = 0, with_dataset: bool = False) -> str:
    """Export."""
    metadata: dict[str, Any] = {"refresh_frequency": frequency, "remote_id": 1}
    if policy is not None:
        metadata["auto_refresh_policy"] = policy
    return json.dumps(
        {
            "dashboards": [
                {
                    "__Dashboard__": {
                        "id": 1,
                        "dashboard_title": "Imported",
                        "json_metadata": json.dumps(metadata),
                        "position_json": None,
                        "slices": [],
                    }
                }
            ],
            "datasources": [
                {
                    "__SqlaTable__": {
                        "table_name": "never_imported",
                        "params": json.dumps({"remote_id": 3, "database_name": "x"}),
                        "columns": [],
                        "metrics": [],
                    }
                }
            ]
            if with_dataset
            else [],
        }
    )


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


def test_v0_rejects_an_invalid_policy_before_writing(schema: Session) -> None:
    """Check v0 rejects an invalid policy before writing."""
    bad = {"minimum_refresh_interval": {"value": 45, "unit": "seconds"}}
    with pytest.raises(CommandInvalidError) as excinfo:
        ImportDashboardsCommand({FILE: export(bad, 10, with_dataset=True)}).run()

    assert excinfo.value.normalized_messages() == {
        FILE: {
            "json_metadata": {
                "auto_refresh_policy.minimum_refresh_interval": [
                    "45 seconds isn't a standard interval. Select one from the list."
                ],
            }
        }
    }
    assert db.session.query(Dashboard).count() == 0
    assert db.session.query(SqlaTable).count() == 0


@pytest.mark.parametrize("policy", [None, {}])
def test_v0_without_policy_or_valid_policy_imports(
    schema: Session, policy: Any
) -> None:
    """Check v0 without policy or valid policy imports."""
    frequency = 45 if policy is None else 60
    ImportDashboardsCommand({FILE: export(policy, frequency)}).run()
    metadata = json.loads(db.session.query(Dashboard).one().json_metadata)
    assert metadata["refresh_frequency"] == frequency
    assert metadata.get("auto_refresh_policy") == policy


def test_v0_format_is_not_exposed_by_http(
    schema: Session, client: Any, full_api_access: None
) -> None:
    """Check v0 format is not exposed by http."""
    bad = {"auto_refresh_allowed": False}
    response = client.post(
        "/api/v1/dashboard/import/",
        data={"formData": (BytesIO(export(bad, 60, True).encode()), FILE)},
        content_type="multipart/form-data",
    )
    assert response.status_code == 422
    assert db.session.query(Dashboard).count() == 0
    assert db.session.query(SqlaTable).count() == 0


def test_v0_history_rows(schema: Session) -> None:
    """Check v0 history rows."""
    ImportDashboardsCommand({FILE: export(POLICY, 60)}).run()
    ImportDashboardsCommand({FILE: export(POLICY, 30)}).run()
    ImportDashboardsCommand({FILE: export()}).run()

    dashboard_id = db.session.query(Dashboard).one().id
    assert history() == [
        {
            "dashboard_id": dashboard_id,
            "old": None,
            "new": POLICY,
            "source": "import_v0",
        },
        {
            "dashboard_id": dashboard_id,
            "old": POLICY,
            "new": None,
            "source": "import_v0",
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
    ImportDashboardsCommand({FILE: export("invalid", 45)}).run()
    assert (
        db.session.query(Dashboard).one().params_dict["auto_refresh_policy"]
        == "invalid"
    )
    assert history() == []


@pytest.mark.parametrize(
    "entry",
    [
        "invalid",
        1,
        [],
        {"__Dashboard__": "invalid"},
        {"__Dashboard__": {"json_metadata": "{"}},
        {"__Dashboard__": {"json_metadata": "[]"}},
    ],
)
def test_v0_malformed_dashboard_is_a_validation_error(
    schema: Session, entry: Any
) -> None:
    """Malformed legacy entries fail validation before any writes."""
    with pytest.raises(CommandInvalidError) as excinfo:
        ImportDashboardsCommand({FILE: json.dumps({"dashboards": [entry]})}).validate()
    assert excinfo.value.normalized_messages() == {
        FILE: {"json_metadata": {"json_metadata": ["Invalid dashboard metadata."]}}
    }
    assert db.session.query(Dashboard).count() == 0
