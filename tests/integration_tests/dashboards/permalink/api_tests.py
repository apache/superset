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
from collections.abc import Iterator
from unittest.mock import patch
from uuid import uuid3

import pytest
from flask_appbuilder.security.sqla.models import User  # noqa: F401
from sqlalchemy.orm import Session  # noqa: F401

from superset import db
from superset.commands.dashboard.exceptions import (
    DashboardAccessDeniedError,  # noqa: F401
)
from superset.key_value.models import KeyValueEntry
from superset.key_value.types import KeyValueResource
from superset.key_value.utils import decode_permalink_id
from superset.models.dashboard import Dashboard
from tests.integration_tests.fixtures.world_bank_dashboard import (
    load_world_bank_dashboard_with_slices,  # noqa: F401
    load_world_bank_data,  # noqa: F401
)
from tests.integration_tests.test_app import app  # noqa: F401

STATE = {
    "dataMask": {"FILTER_1": "foo"},
    "activeTabs": ["my-anchor"],
}


@pytest.fixture
def dashboard_id(load_world_bank_dashboard_with_slices) -> int:  # noqa: F811
    dashboard = db.session.query(Dashboard).filter_by(slug="world_health").one()
    return dashboard.id


@pytest.fixture
def permalink_salt() -> Iterator[str]:
    from superset.key_value.shared_entries import get_permalink_salt, get_uuid_namespace
    from superset.key_value.types import SharedKey

    key = SharedKey.DASHBOARD_PERMALINK_SALT
    salt = get_permalink_salt(key)
    yield salt
    namespace = get_uuid_namespace(salt)
    db.session.query(KeyValueEntry).filter_by(
        resource=KeyValueResource.APP,
        uuid=uuid3(namespace, key),
    )
    db.session.commit()


def test_post(
    dashboard_id: int, permalink_salt: str, test_client, login_as_admin
) -> None:
    resp = test_client.post(f"api/v1/dashboard/{dashboard_id}/permalink", json=STATE)
    assert resp.status_code == 201
    data = resp.json
    key = data["key"]
    url = data["url"]
    assert key in url
    id_ = decode_permalink_id(key, permalink_salt)

    assert (
        data
        == test_client.post(
            f"api/v1/dashboard/{dashboard_id}/permalink", json=STATE
        ).json
    ), "Should always return the same permalink key for the same payload"

    db.session.query(KeyValueEntry).filter_by(id=id_).delete()
    db.session.commit()


def test_post_access_denied(test_client, login_as, dashboard_id: int):
    login_as("gamma")
    resp = test_client.post(f"api/v1/dashboard/{dashboard_id}/permalink", json=STATE)
    assert resp.status_code == 404


def test_post_invalid_schema(dashboard_id: int, test_client, login_as_admin):
    resp = test_client.post(
        f"api/v1/dashboard/{dashboard_id}/permalink", json={"foo": "bar"}
    )
    assert resp.status_code == 400


def test_get(dashboard_id: int, permalink_salt: str, test_client, login_as_admin):
    key = test_client.post(
        f"api/v1/dashboard/{dashboard_id}/permalink", json=STATE
    ).json["key"]
    resp = test_client.get(f"api/v1/dashboard/permalink/{key}")
    assert resp.status_code == 200
    result = resp.json
    dashboard_uuid = result["dashboardId"]
    assert Dashboard.get(dashboard_uuid).id == dashboard_id
    assert result["state"] == STATE
    id_ = decode_permalink_id(key, permalink_salt)
    db.session.query(KeyValueEntry).filter_by(id=id_).delete()
    db.session.commit()


@pytest.fixture
def standalone_dashboard_id(app_context) -> Iterator[int]:
    dashboard = Dashboard(dashboard_title="permalink_denial", published=True)
    db.session.add(dashboard)
    db.session.commit()
    yield dashboard.id
    db.session.delete(dashboard)
    db.session.commit()


def test_get_access_denied_keeps_generic_message(
    standalone_dashboard_id: int, permalink_salt: str, test_client, login_as_admin
) -> None:
    """
    A custom security manager's specific denial reason must not reach the
    requester of a permalink: the report executor recovers it separately.
    """
    from superset import security_manager
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetSecurityException

    specific_reason = "Dashboard is in a folder you cannot read."

    def raise_for_access(**kwargs) -> None:
        if kwargs.get("dashboard") is not None:
            raise SupersetSecurityException(
                SupersetError(
                    error_type=SupersetErrorType.DASHBOARD_SECURITY_ACCESS_ERROR,
                    message=specific_reason,
                    level=ErrorLevel.WARNING,
                )
            )

    key = test_client.post(
        f"api/v1/dashboard/{standalone_dashboard_id}/permalink", json=STATE
    ).json["key"]
    with patch.object(security_manager, "raise_for_access", raise_for_access):
        api_resp = test_client.get(f"api/v1/dashboard/permalink/{key}")
        view_resp = test_client.get(f"/dashboard/p/{key}/")

    assert api_resp.status_code == 403
    assert api_resp.json["message"] == "You don't have access to this dashboard."
    assert view_resp.status_code == 404
    assert specific_reason not in view_resp.get_data(as_text=True)
    assert "You don't have access to this dashboard." in view_resp.get_data(
        as_text=True
    )
    id_ = decode_permalink_id(key, permalink_salt)
    db.session.query(KeyValueEntry).filter_by(id=id_).delete()
    db.session.commit()
