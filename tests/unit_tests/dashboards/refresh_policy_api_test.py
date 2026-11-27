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
from typing import Any, Callable

import pytest
from flask import current_app
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import db, security_manager
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.utils import json

VALID_POLICY = {
    "auto_refresh_allowed": True,
    "minimum_refresh_interval": 30,
    "maximum_refresh_interval": 3600,
}
PROHIBITED = {"auto_refresh_allowed": False}
USER_ID = 7


def without(value: int) -> list[list[Any]]:
    """Without."""
    return [
        [v, str(v)]
        for v in [0, 10, 30, 60, 300, 1800, 3600, 21600, 43200, 86400]
        if v != value
    ]


@pytest.fixture
def make_dashboard(session: Session, mocker: MockerFixture) -> Callable[..., Any]:
    """Make dashboard."""
    from superset.models.dashboard import Dashboard

    mocker.patch(
        "superset.commands.dashboard.update.security_manager.raise_for_editorship"
    )
    mocker.patch("superset.commands.utils.security_manager.is_admin", return_value=True)
    mocker.patch(
        "superset.dashboards.api.DashboardDAO.get_by_id_or_slug",
        side_effect=lambda id_or_slug: db.session.get(Dashboard, int(id_or_slug)),
    )
    Dashboard.metadata.create_all(db.session.get_bind())  # pylint: disable=no-member
    user = security_manager.user_model(
        id=USER_ID, username="owner", first_name="o", last_name="o", email="o@o.o"
    )
    db.session.add(user)
    db.session.commit()
    mocker.patch("flask_login.utils._get_user", return_value=user)

    def make(metadata: dict[str, Any] | None = None) -> Dashboard:
        """Make."""
        dashboard = Dashboard(
            dashboard_title="my dashboard",
            json_metadata=json.dumps(metadata) if metadata is not None else None,
        )
        db.session.add(dashboard)
        db.session.commit()
        return dashboard

    return make


def history() -> list[dict[str, Any]]:
    """History."""
    from superset.models.core import Log

    rows = (
        db.session.query(Log)
        .filter_by(action="dashboard_refresh_policy_changed")
        .order_by(Log.id)
        .all()
    )
    return [
        {
            "user_id": row.user_id,
            "dashboard_id": row.dashboard_id,
            **json.loads(row.json),
        }
        for row in rows
    ]


def stored(dashboard: Any) -> dict[str, Any]:
    """Stored."""
    db.session.refresh(dashboard)
    return json.loads(dashboard.json_metadata or "{}")


def put(client: Any, dashboard: Any, metadata: Any, **body: Any) -> Any:
    """Put."""
    return client.put(
        f"/api/v1/dashboard/{dashboard.id}",
        json={"json_metadata": json.dumps(metadata), **body},
    )


def copy(client: Any, dashboard: Any, metadata: dict[str, Any]) -> Any:
    """Copy."""
    return client.post(
        f"/api/v1/dashboard/{dashboard.id}/copy/",
        json={"dashboard_title": "copy", "json_metadata": json.dumps(metadata)},
    )


def post(client: Any, metadata: Any) -> Any:
    """Post."""
    return client.post(
        "/api/v1/dashboard/",
        json={"dashboard_title": "new", "json_metadata": json.dumps(metadata)},
    )


def error_codes(response: Any) -> list[tuple[str, str]]:
    """Error codes."""
    return [(error["field"], error["code"]) for error in response.json["errors"]]


@pytest.mark.parametrize("policy", [{}, {"auto_refresh_policy": None}])
@pytest.mark.parametrize("frequency", ["60", 60.5, -5, 45])
def test_no_policy_behaves_as_before(
    make_dashboard: Callable[..., Any],
    client: Any,
    full_api_access: None,
    policy: dict[str, Any],
    frequency: Any,
) -> None:
    """Check no policy behaves as before."""
    dashboard = make_dashboard({})
    metadata = {**policy, "refresh_frequency": frequency}

    assert put(client, dashboard, metadata).status_code == 200
    assert stored(dashboard)["refresh_frequency"] == frequency
    assert "auto_refresh_policy" not in stored(dashboard)
    assert copy(client, dashboard, metadata).status_code == 200
    assert post(client, metadata).status_code == 201
    assert history() == []


def test_policy_examples(
    make_dashboard: Callable[..., Any], client: Any, full_api_access: None
) -> None:
    """Check policy examples."""
    dashboard = make_dashboard({})
    valid = {"refresh_frequency": 60, "auto_refresh_policy": VALID_POLICY}
    assert put(client, dashboard, valid).status_code == 200
    assert stored(dashboard)["auto_refresh_policy"] == VALID_POLICY

    response = put(client, dashboard, {**valid, "refresh_frequency": 10})

    assert response.status_code == 422
    assert response.json["errors"] == [
        {
            "field": "json_metadata.refresh_frequency",
            "code": "below_minimum",
            "message": "Refresh frequency must be 30 seconds or greater.",
        }
    ]
    assert response.json["message"] == {
        "json_metadata.refresh_frequency": [
            "Refresh frequency must be 30 seconds or greater."
        ]
    }
    assert stored(dashboard)["refresh_frequency"] == 60


MIN = "json_metadata.auto_refresh_policy.minimum_refresh_interval"
MAX = "json_metadata.auto_refresh_policy.maximum_refresh_interval"
FREQ = "json_metadata.refresh_frequency"
POLICY = "json_metadata.auto_refresh_policy"


@pytest.mark.parametrize(
    "policy, frequency, expected",
    [
        ("x", 0, [("json_metadata.auto_refresh_policy", "invalid_policy")]),
        ({"zz": 1}, 45, [("json_metadata.auto_refresh_policy.zz", "invalid_policy")]),
        (
            {"auto_refresh_allowed": "true"},
            45,
            [
                (
                    "json_metadata.auto_refresh_policy.auto_refresh_allowed",
                    "invalid_policy",
                )
            ],
        ),
        ({"minimum_refresh_interval": 0}, 0, [(MIN, "invalid_boundary")]),
        ({"minimum_refresh_interval": -1}, 0, [(MIN, "invalid_boundary")]),
        ({"minimum_refresh_interval": 1.5}, 0, [(MIN, "invalid_boundary")]),
        ({"minimum_refresh_interval": "30"}, 0, [(MIN, "invalid_boundary")]),
        ({"minimum_refresh_interval": True}, 0, [(MIN, "invalid_boundary")]),
        (
            {"maximum_refresh_interval": {"value": 30, "unit": "seconds"}},
            0,
            [(MAX, "invalid_boundary")],
        ),
        (
            {"maximum_refresh_interval": {"value": 1, "unit": "days"}},
            0,
            [(MAX, "invalid_boundary")],
        ),
        (
            {"maximum_refresh_interval": {"value": 30, "unit": "seconds", "x": 1}},
            0,
            [(MAX, "invalid_boundary")],
        ),
        ({"minimum_refresh_interval": 45}, 0, [(MIN, "invalid_boundary")]),
        (
            {"maximum_refresh_interval": 7200},
            0,
            [(MAX, "invalid_boundary")],
        ),
        (
            {
                "minimum_refresh_interval": 3600,
                "maximum_refresh_interval": 30,
            },
            0,
            [
                (MIN, "minimum_greater_than_maximum"),
                (MAX, "minimum_greater_than_maximum"),
            ],
        ),
        (
            {
                "auto_refresh_allowed": False,
                "minimum_refresh_interval": 3600,
                "maximum_refresh_interval": 30,
            },
            0,
            [
                (MIN, "minimum_greater_than_maximum"),
                (MAX, "minimum_greater_than_maximum"),
            ],
        ),
        (PROHIBITED, 60, [(FREQ, "auto_refresh_prohibited")]),
        ({}, "60", [(FREQ, "invalid_refresh_frequency")]),
        ({}, 60.0, []),
        ({}, 60.5, [(FREQ, "invalid_refresh_frequency")]),
        ({}, -5, [(FREQ, "invalid_refresh_frequency")]),
        ({}, 45, [(FREQ, "custom_not_allowed")]),
        ({"minimum_refresh_interval": 30}, 10, [(FREQ, "below_minimum")]),
        (
            {"maximum_refresh_interval": 3600},
            21600,
            [(FREQ, "above_maximum")],
        ),
        ({"minimum_refresh_interval": 60}, 60, []),
    ],
)
def test_put_rules(
    make_dashboard: Callable[..., Any],
    client: Any,
    full_api_access: None,
    policy: Any,
    frequency: Any,
    expected: list[tuple[str, str]],
) -> None:
    """Check put rules."""
    dashboard = make_dashboard({})
    response = put(
        client,
        dashboard,
        {"auto_refresh_policy": policy, "refresh_frequency": frequency},
    )

    if expected:
        assert response.status_code == 422
        assert error_codes(response) == expected
        assert stored(dashboard) == {}
    else:
        assert response.status_code == 200
        assert stored(dashboard)["auto_refresh_policy"] == policy


def test_equal_bounds_are_accepted(
    make_dashboard: Callable[..., Any], client: Any, full_api_access: None
) -> None:
    """Equal minimum and maximum bounds are accepted."""
    dashboard = make_dashboard({})
    policy = {
        "minimum_refresh_interval": 60,
        "maximum_refresh_interval": 60,
    }
    response = put(
        client, dashboard, {"auto_refresh_policy": policy, "refresh_frequency": 60}
    )
    assert response.status_code == 200


@pytest.mark.parametrize("frequency, status", [(45, 422), (60, 200)])
def test_empty_policy_defaults(
    make_dashboard: Callable[..., Any],
    client: Any,
    full_api_access: None,
    frequency: int,
    status: int,
) -> None:
    """Check empty policy defaults."""
    dashboard = make_dashboard({})
    response = put(
        client, dashboard, {"auto_refresh_policy": {}, "refresh_frequency": frequency}
    )
    assert response.status_code == status
    if status == 422:
        assert error_codes(response) == [(FREQ, "custom_not_allowed")]


def test_prohibited_keeps_bounds_and_rechecks_them(
    make_dashboard: Callable[..., Any], client: Any, full_api_access: None
) -> None:
    """Check prohibited keeps bounds and rechecks them."""
    dashboard = make_dashboard({})
    off = {"auto_refresh_allowed": False, "minimum_refresh_interval": 45}

    assert (
        put(client, dashboard, {"auto_refresh_policy": PROHIBITED}).status_code == 200
    )
    response = put(
        client, dashboard, {"auto_refresh_policy": PROHIBITED, "refresh_frequency": 60}
    )
    assert error_codes(response) == [(FREQ, "auto_refresh_prohibited")]
    assert put(client, dashboard, {"auto_refresh_policy": off}).status_code == 200

    response = put(
        client,
        dashboard,
        {"auto_refresh_policy": {**off, "auto_refresh_allowed": True}},
    )
    assert response.status_code == 422
    assert error_codes(response) == [(MIN, "invalid_boundary")]


def test_put_merges_the_stored_policy(
    make_dashboard: Callable[..., Any], client: Any, full_api_access: None
) -> None:
    """Check put merges the stored policy."""
    policy = {"minimum_refresh_interval": 30}
    dashboard = make_dashboard({"auto_refresh_policy": policy, "stagger_time": 5})

    assert put(client, dashboard, {"color_scheme": "blue"}).status_code == 200
    metadata = stored(dashboard)
    assert metadata["auto_refresh_policy"] == policy
    assert metadata["color_scheme"] == "blue"
    assert metadata["stagger_time"] == 5

    response = put(client, dashboard, {"refresh_frequency": 10})
    assert error_codes(response) == [(FREQ, "below_minimum")]

    assert put(client, dashboard, {"auto_refresh_policy": None}).status_code == 200
    assert "auto_refresh_policy" not in stored(dashboard)
    assert put(client, dashboard, {"refresh_frequency": 45}).status_code == 200


def test_put_without_metadata_preserves_stored_policy(
    make_dashboard: Callable[..., Any], client: Any, full_api_access: None
) -> None:
    """Unrelated writes preserve an outdated stored policy."""
    dashboard = make_dashboard(
        {"auto_refresh_policy": PROHIBITED, "refresh_frequency": 60}
    )
    response = client.put(
        f"/api/v1/dashboard/{dashboard.id}", json={"dashboard_title": "renamed"}
    )
    assert response.status_code == 200
    assert history() == []


def test_colors_endpoint_retains_policy(
    make_dashboard: Callable[..., Any], client: Any, full_api_access: None
) -> None:
    """Check colors endpoint retains policy."""
    dashboard = make_dashboard(
        {"auto_refresh_policy": PROHIBITED, "refresh_frequency": 0}
    )
    response = client.put(
        f"/api/v1/dashboard/{dashboard.id}/colors",
        json={"color_scheme": "blue"},
    )
    assert response.status_code == 200
    assert stored(dashboard)["refresh_frequency"] == 0
    assert stored(dashboard)["auto_refresh_policy"] == PROHIBITED


def test_colors_sync_skips_a_stored_policy_that_no_longer_passes(
    make_dashboard: Callable[..., Any], client: Any, full_api_access: None
) -> None:
    """Background colors sync saves on a dashboard whose stored policy fails."""
    policy = {
        "minimum_refresh_interval": 120,
        "maximum_refresh_interval": 240,
    }
    dashboard = make_dashboard({"auto_refresh_policy": policy})

    response = client.put(
        f"/api/v1/dashboard/{dashboard.id}/colors?mark_updated=false",
        json={"color_scheme": "blue"},
    )
    assert response.status_code == 200
    assert stored(dashboard)["color_scheme"] == "blue"
    assert stored(dashboard)["auto_refresh_policy"] == policy
    assert history() == []

    response = put(client, dashboard, {"color_scheme": "red"})
    assert response.status_code == 200
    assert stored(dashboard)["color_scheme"] == "red"


def test_filters_and_chart_customizations_retain_policy(
    make_dashboard: Callable[..., Any], client: Any, full_api_access: None
) -> None:
    """Check filters and chart customizations retain policy."""
    dashboard = make_dashboard(
        {"auto_refresh_policy": PROHIBITED, "refresh_frequency": 0}
    )
    for path in ("filters", "chart_customizations"):
        response = client.put(
            f"/api/v1/dashboard/{dashboard.id}/{path}",
            json={"modified": [], "deleted": [], "reordered": []},
        )
        assert response.status_code == 200, path
        assert stored(dashboard)["auto_refresh_policy"] == PROHIBITED


@pytest.mark.parametrize("path", ["filters", "chart_customizations"])
def test_filter_saves_skip_a_stored_policy_that_no_longer_passes(
    path: str, make_dashboard: Callable[..., Any], client: Any, full_api_access: None
) -> None:
    """Filter and chart customization saves work on a stored policy that fails."""
    policy = {
        "minimum_refresh_interval": 120,
        "maximum_refresh_interval": 240,
    }
    dashboard = make_dashboard({"auto_refresh_policy": policy})

    response = client.put(
        f"/api/v1/dashboard/{dashboard.id}/{path}",
        json={"modified": [], "deleted": [], "reordered": []},
    )
    assert response.status_code == 200
    assert stored(dashboard)["auto_refresh_policy"] == policy
    assert history() == []


def test_unchanged_policy_skips_the_list_check(
    make_dashboard: Callable[..., Any],
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """An unchanged policy preserves bounds removed from the interval list."""
    policy = {"minimum_refresh_interval": 60}
    dashboard = make_dashboard({"auto_refresh_policy": policy})
    mocker.patch.dict(
        current_app.config, {"DASHBOARD_AUTO_REFRESH_INTERVALS": without(60)}
    )

    assert (
        put(
            client, dashboard, {"auto_refresh_policy": policy, "refresh_frequency": 0}
        ).status_code
        == 200
    )

    response = put(
        client,
        dashboard,
        {
            "auto_refresh_policy": {
                **policy,
                "maximum_refresh_interval": 3600,
            }
        },
    )
    assert error_codes(response) == [(MIN, "invalid_boundary")]

    response = put(
        client,
        dashboard,
        {
            "auto_refresh_policy": {"maximum_refresh_interval": 3600},
            "refresh_frequency": 60,
        },
    )
    assert error_codes(response) == [(FREQ, "custom_not_allowed")]

    response = put(client, dashboard, {"refresh_frequency": 30})
    assert error_codes(response) == [(FREQ, "below_minimum")]


def test_outdated_bounds_allow_unrelated_saves(
    make_dashboard: Callable[..., Any],
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Outdated bounds allow unrelated saves."""
    policy = {"minimum_refresh_interval": 86400}
    dashboard = make_dashboard({"auto_refresh_policy": policy})
    mocker.patch.dict(
        current_app.config, {"DASHBOARD_AUTO_REFRESH_INTERVALS": without(86400)}
    )

    response = put(
        client,
        dashboard,
        {"auto_refresh_policy": policy, "refresh_frequency": 0, "color_scheme": "x"},
    )
    assert response.status_code == 200

    response = put(client, dashboard, {"auto_refresh_policy": {**policy, **PROHIBITED}})
    assert response.status_code == 200


def test_equal_bounds_left_the_list_on_put_and_copy(
    make_dashboard: Callable[..., Any],
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Unrelated updates preserve outdated equal bounds; copy validates them."""
    policy = {
        "minimum_refresh_interval": 60,
        "maximum_refresh_interval": 60,
    }
    dashboard = make_dashboard({"auto_refresh_policy": policy})
    mocker.patch.dict(
        current_app.config, {"DASHBOARD_AUTO_REFRESH_INTERVALS": without(60)}
    )
    expected = [(MIN, "no_standard_interval"), (MAX, "no_standard_interval")]

    assert put(client, dashboard, {"auto_refresh_policy": policy}).status_code == 200
    response = copy(client, dashboard, {})
    assert response.status_code == 422
    assert error_codes(response) == expected


def test_copy_checks_the_original_policy(
    make_dashboard: Callable[..., Any], client: Any, full_api_access: None
) -> None:
    """Check copy checks the original policy."""
    from superset.models.dashboard import Dashboard

    dashboard = make_dashboard({"auto_refresh_policy": PROHIBITED})

    response = copy(client, dashboard, {"refresh_frequency": 10})
    assert response.status_code == 422
    assert error_codes(response) == [(FREQ, "auto_refresh_prohibited")]

    before = db.session.query(Dashboard).count()
    response = copy(
        client,
        dashboard,
        {"auto_refresh_policy": {"minimum_refresh_interval": 45}},
    )
    assert response.status_code == 422
    assert error_codes(response) == [(MIN, "invalid_boundary")]
    assert db.session.query(Dashboard).count() == before

    response = copy(
        client,
        dashboard,
        {"auto_refresh_policy": VALID_POLICY, "refresh_frequency": 60},
    )
    assert response.status_code == 200
    new = db.session.get(Dashboard, response.json["result"]["id"])
    assert json.loads(new.json_metadata)["auto_refresh_policy"] == VALID_POLICY

    response = copy(
        client, dashboard, {"auto_refresh_policy": None, "refresh_frequency": 10}
    )
    assert response.status_code == 200
    new = db.session.get(Dashboard, response.json["result"]["id"])
    assert "auto_refresh_policy" not in json.loads(new.json_metadata)
    assert json.loads(new.json_metadata)["refresh_frequency"] == 10


def test_copy_keeps_the_original_policy(
    make_dashboard: Callable[..., Any], client: Any, full_api_access: None
) -> None:
    """Check copy keeps the original policy."""
    from superset.models.dashboard import Dashboard

    dashboard = make_dashboard({"auto_refresh_policy": VALID_POLICY})
    response = copy(client, dashboard, {"refresh_frequency": 60})
    new = db.session.get(Dashboard, response.json["result"]["id"])
    assert json.loads(new.json_metadata)["auto_refresh_policy"] == VALID_POLICY


def test_copy_invalid_parameters_are_422(
    make_dashboard: Callable[..., Any], client: Any, full_api_access: None
) -> None:
    """Check copy invalid parameters are 422."""
    dashboard = make_dashboard({})
    response = client.post(
        f"/api/v1/dashboard/{dashboard.id}/copy/",
        json={"dashboard_title": "", "json_metadata": "{}"},
    )
    assert response.status_code == 422


def test_post_checks_the_policy(
    make_dashboard: Callable[..., Any], client: Any, full_api_access: None
) -> None:
    """Check post checks the policy."""
    from superset.models.dashboard import Dashboard

    existing = make_dashboard({})
    assert existing.id
    before = db.session.query(Dashboard).count()

    response = post(
        client, {"auto_refresh_policy": VALID_POLICY, "refresh_frequency": 10}
    )
    assert response.status_code == 422
    assert error_codes(response) == [(FREQ, "below_minimum")]
    assert db.session.query(Dashboard).count() == before

    response = post(client, {"auto_refresh_policy": {"minimum_refresh_interval": 45}})
    assert response.status_code == 422
    assert error_codes(response) == [(MIN, "invalid_boundary")]
    assert db.session.query(Dashboard).count() == before


def test_post_stores_valid_policy(
    make_dashboard: Callable[..., Any], client: Any, full_api_access: None
) -> None:
    """Create stores an accepted policy unchanged."""
    from superset.models.dashboard import Dashboard

    existing = make_dashboard({})
    assert existing.id
    response = post(
        client, {"auto_refresh_policy": VALID_POLICY, "refresh_frequency": 60}
    )
    assert response.status_code == 201
    new = db.session.get(Dashboard, response.json["id"])
    assert json.loads(new.json_metadata)["auto_refresh_policy"] == VALID_POLICY


def test_history_rows(
    make_dashboard: Callable[..., Any], client: Any, full_api_access: None
) -> None:
    """Check history rows."""
    dashboard = make_dashboard({})

    assert (
        put(client, dashboard, {"auto_refresh_policy": PROHIBITED}).status_code == 200
    )
    assert (
        put(client, dashboard, {"auto_refresh_policy": PROHIBITED}).status_code == 200
    )
    assert put(client, dashboard, {"refresh_frequency": 60}).status_code == 422
    assert put(client, dashboard, {"color_scheme": "x"}).status_code == 200
    assert (
        put(
            client, dashboard, {"auto_refresh_policy": {}, "refresh_frequency": 60}
        ).status_code
        == 200
    )
    assert (
        put(
            client, dashboard, {"auto_refresh_policy": {}, "refresh_frequency": 10}
        ).status_code
        == 200
    )
    copied = copy(client, dashboard, {}).json["result"]["id"]
    created = post(client, {"auto_refresh_policy": PROHIBITED}).json["id"]
    assert post(client, {"auto_refresh_policy": None}).status_code == 201

    common = {"user_id": USER_ID}
    assert history() == [
        {
            **common,
            "dashboard_id": dashboard.id,
            "old": None,
            "new": PROHIBITED,
            "source": "put",
        },
        {
            **common,
            "dashboard_id": dashboard.id,
            "old": PROHIBITED,
            "new": {},
            "source": "put",
        },
        {**common, "dashboard_id": copied, "old": None, "new": {}, "source": "copy"},
        {
            **common,
            "dashboard_id": created,
            "old": None,
            "new": PROHIBITED,
            "source": "post",
        },
    ]


@pytest.mark.parametrize("wipe", ["", None])
def test_empty_metadata_preserves_stored_policy(
    make_dashboard: Callable[..., Any],
    client: Any,
    full_api_access: None,
    wipe: Any,
) -> None:
    """Check empty metadata preserves stored policy."""
    dashboard = make_dashboard({"auto_refresh_policy": PROHIBITED})
    response = client.put(
        f"/api/v1/dashboard/{dashboard.id}", json={"json_metadata": wipe}
    )
    assert response.status_code == 200
    assert stored(dashboard)["auto_refresh_policy"] == PROHIBITED
    assert history() == []


def test_non_owner_put_is_forbidden_and_changes_nothing(
    make_dashboard: Callable[..., Any],
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Check non owner put is forbidden and changes nothing."""
    mocker.patch(
        "superset.commands.dashboard.update.security_manager.raise_for_editorship",
        side_effect=SupersetSecurityException(
            SupersetError(
                error_type=SupersetErrorType.MISSING_OWNERSHIP_ERROR,
                message="You don't have the rights to alter this dashboard",
                level=ErrorLevel.ERROR,
            )
        ),
    )
    before = {"refresh_frequency": 0, "auto_refresh_policy": PROHIBITED}
    dashboard = make_dashboard(before)

    response = put(
        client,
        dashboard,
        {"refresh_frequency": 30, "auto_refresh_policy": VALID_POLICY},
    )

    assert response.status_code == 403
    assert stored(dashboard) == before
    assert history() == []


def test_mixed_errors(
    make_dashboard: Callable[..., Any],
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Check mixed errors."""
    mocker.patch.object(security_manager, "get_user_by_id", return_value=None)
    dashboard = make_dashboard({})
    response = put(
        client,
        dashboard,
        {"auto_refresh_policy": PROHIBITED, "refresh_frequency": 60},
        editors=[{"type": "user", "id": 9999}],
    )
    assert response.status_code == 422
    assert set(response.json["message"]) == {"editors", FREQ}
    assert error_codes(response) == [(FREQ, "auto_refresh_prohibited")]


def test_openapi_documents_the_policy(client: Any, full_api_access: None) -> None:
    """Check openapi documents the policy."""
    from superset.dashboards.schemas import (
        DashboardCopySchema,
        DashboardPostSchema,
        DashboardPutSchema,
    )

    for schema in (DashboardPostSchema(), DashboardPutSchema(), DashboardCopySchema()):
        description = schema.fields["json_metadata"].metadata["description"]
        assert "auto_refresh_policy" in description
        assert "each null or a positive whole number of seconds" in description


@pytest.fixture(autouse=True)
def enable_policy(mocker: MockerFixture) -> None:
    """Enable policy enforcement for the policy contract tests."""
    from superset.extensions import feature_flag_manager

    mocker.patch.dict(
        feature_flag_manager._feature_flags, {"AUTO_REFRESH_POLICY": True}
    )


@pytest.fixture
def disable_policy(mocker: MockerFixture) -> None:
    """Turn the feature flag off."""
    from superset.extensions import feature_flag_manager

    mocker.patch.dict(
        feature_flag_manager._feature_flags, {"AUTO_REFRESH_POLICY": False}
    )


@pytest.mark.parametrize(
    "policy, expected",
    [
        ("invalid", [(POLICY, "invalid_policy")]),
        (
            {"auto_refresh_allowed": "no"},
            [(f"{POLICY}.auto_refresh_allowed", "invalid_policy")],
        ),
        ({"minimum_refresh_interval": 1.5}, [(MIN, "invalid_boundary")]),
        (
            {"minimum_refresh_interval": {"value": 1, "unit": "minutes"}},
            [(MIN, "invalid_boundary")],
        ),
    ],
)
def test_flag_off_rejects_a_malformed_policy_on_writes(
    make_dashboard: Callable[..., Any],
    client: Any,
    full_api_access: None,
    disable_policy: None,
    policy: Any,
    expected: list[tuple[str, str]],
) -> None:
    """With the flag off a malformed policy is refused on every REST write path."""
    from superset.models.dashboard import Dashboard

    before = {"auto_refresh_policy": PROHIBITED, "refresh_frequency": 0}
    dashboard = make_dashboard(before)
    count = db.session.query(Dashboard).count()
    metadata = {"auto_refresh_policy": policy, "refresh_frequency": 45}

    for response in (
        put(client, dashboard, metadata),
        copy(client, dashboard, metadata),
        post(client, metadata),
    ):
        assert response.status_code == 422
        assert error_codes(response) == expected
    assert stored(dashboard) == before
    assert db.session.query(Dashboard).count() == count
    assert history() == []


@pytest.mark.parametrize(
    "policy",
    [
        {"minimum_refresh_interval": 45},
        {"auto_refresh_allowed": False},
        {
            "minimum_refresh_interval": 7200,
            "maximum_refresh_interval": 3600,
        },
        None,
    ],
)
def test_flag_off_stores_a_well_formed_policy_without_rules_or_history(
    make_dashboard: Callable[..., Any],
    client: Any,
    full_api_access: None,
    disable_policy: None,
    policy: Any,
) -> None:
    """With the flag off a well-formed policy is stored as sent, unchecked by rules."""
    from superset.models.dashboard import Dashboard

    dashboard = make_dashboard({"auto_refresh_policy": "previous"})
    metadata = {"auto_refresh_policy": policy, "refresh_frequency": 45}
    assert put(client, dashboard, metadata).status_code == 200
    assert stored(dashboard)["auto_refresh_policy"] == policy
    copied = copy(client, dashboard, metadata)
    assert copied.status_code == 200
    assert (
        db.session.get(Dashboard, copied.json["result"]["id"]).params_dict[
            "auto_refresh_policy"
        ]
        == policy
    )
    created = post(client, metadata)
    assert created.status_code == 201
    assert (
        db.session.get(Dashboard, created.json["id"]).params_dict["auto_refresh_policy"]
        == policy
    )
    assert history() == []


@pytest.mark.parametrize(
    "malformed",
    [
        {"custom_refresh_allowed": False},
        {"minimum_refresh_interval": {"value": 1, "unit": "minutes"}},
    ],
)
def test_flag_off_keeps_a_stored_malformed_policy(
    make_dashboard: Callable[..., Any],
    client: Any,
    full_api_access: None,
    disable_policy: None,
    malformed: dict[str, Any],
) -> None:
    """A malformed policy stored earlier loads, exports and allows unrelated saves."""
    from superset.models.dashboard import Dashboard

    dashboard = make_dashboard(
        {"auto_refresh_policy": malformed, "refresh_frequency": 45}
    )
    response = client.get(f"/api/v1/dashboard/{dashboard.id}")
    assert response.status_code == 200
    assert (
        json.loads(response.json["result"]["json_metadata"])["auto_refresh_policy"]
        == malformed
    )
    assert put(client, dashboard, {}, dashboard_title="renamed").status_code == 200
    assert (
        put(
            client,
            dashboard,
            {
                "auto_refresh_policy": malformed,
                "refresh_frequency": 60,
                "positions": {},
            },
        ).status_code
        == 200
    )
    assert put(client, dashboard, {"refresh_frequency": 300}).status_code == 200
    copied = copy(
        client, dashboard, {"auto_refresh_policy": malformed, "refresh_frequency": 300}
    )
    assert copied.status_code == 200
    assert (
        db.session.get(Dashboard, copied.json["result"]["id"]).params_dict[
            "auto_refresh_policy"
        ]
        == malformed
    )
    assert copy(client, dashboard, {}).status_code == 200
    assert stored(dashboard)["auto_refresh_policy"] == malformed
    assert stored(dashboard)["refresh_frequency"] == 300

    response = put(client, dashboard, {"auto_refresh_policy": "invalid"})
    assert response.status_code == 422
    assert error_codes(response) == [(POLICY, "invalid_policy")]
    assert stored(dashboard)["auto_refresh_policy"] == malformed
    assert history() == []


@pytest.mark.parametrize(
    "malformed",
    [
        {"custom_refresh_allowed": False},
        {"minimum_refresh_interval": {"value": 1, "unit": "minutes"}},
    ],
)
def test_flag_off_exports_a_stored_malformed_policy(
    make_dashboard: Callable[..., Any],
    disable_policy: None,
    malformed: dict[str, Any],
) -> None:
    """A malformed policy stored earlier is exported as stored."""
    import yaml

    from superset.commands.dashboard.export import ExportDashboardsCommand

    dashboard = make_dashboard({"auto_refresh_policy": malformed})
    content = yaml.safe_load(ExportDashboardsCommand._file_content(dashboard))
    assert content["metadata"]["auto_refresh_policy"] == malformed


@pytest.mark.parametrize(
    "stored_policy, submitted, field, code",
    [
        (
            {"auto_refresh_allowed": True},
            {"auto_refresh_allowed": 1},
            f"{POLICY}.auto_refresh_allowed",
            "invalid_policy",
        ),
        (
            {"auto_refresh_allowed": False},
            {"auto_refresh_allowed": 0},
            f"{POLICY}.auto_refresh_allowed",
            "invalid_policy",
        ),
        (
            {"minimum_refresh_interval": 60},
            {"minimum_refresh_interval": True},
            MIN,
            "invalid_boundary",
        ),
    ],
)
def test_flag_off_a_boolean_number_swap_is_refused(
    make_dashboard: Callable[..., Any],
    client: Any,
    full_api_access: None,
    disable_policy: None,
    stored_policy: dict[str, Any],
    submitted: dict[str, Any],
    field: str,
    code: str,
) -> None:
    """With the flag off a boolean turned into a number is a new malformed policy."""
    from superset.models.dashboard import Dashboard

    before = {"auto_refresh_policy": stored_policy}
    dashboard = make_dashboard(before)
    count = db.session.query(Dashboard).count()
    for response in (
        put(client, dashboard, {"auto_refresh_policy": submitted}),
        copy(client, dashboard, {"auto_refresh_policy": submitted}),
    ):
        assert response.status_code == 422
        assert error_codes(response) == [(field, code)]
    assert stored(dashboard) == before
    assert db.session.query(Dashboard).count() == count


BIG = 9007199254740993
BIG_AS_DOUBLE = 9007199254740992
HUGE = 10**400
ROUND_TRIPS = [(BIG, BIG_AS_DOUBLE), (HUGE, None)]


@pytest.mark.parametrize("value, browser_value", ROUND_TRIPS, ids=["big", "overflow"])
@pytest.mark.parametrize(
    "body",
    [
        {"dashboard_title": "renamed"},
        {"json_metadata_extra": {"positions": {}, "color_scheme": "x"}},
    ],
)
def test_flag_off_a_browser_round_trip_keeps_the_stored_policy(
    make_dashboard: Callable[..., Any],
    client: Any,
    full_api_access: None,
    disable_policy: None,
    body: dict[str, Any],
    value: int,
    browser_value: int | None,
) -> None:
    """An unrelated save that resends the policy as a browser parsed it passes."""
    policy = {"custom_refresh_allowed": value}
    dashboard = make_dashboard({"auto_refresh_policy": policy, "refresh_frequency": 0})
    metadata = {
        "auto_refresh_policy": {"custom_refresh_allowed": browser_value},
        "refresh_frequency": 0,
        **body.pop("json_metadata_extra", {}),
    }
    response = put(client, dashboard, metadata, **body)
    assert response.status_code == 200
    assert stored(dashboard)["auto_refresh_policy"] == policy

    for different in (BIG + 2, 1):
        response = put(
            client,
            dashboard,
            {"auto_refresh_policy": {"custom_refresh_allowed": different}},
        )
        assert response.status_code == 422
        assert error_codes(response) == [
            (f"{POLICY}.custom_refresh_allowed", "invalid_policy")
        ]
    assert stored(dashboard)["auto_refresh_policy"] == policy
    assert history() == []


@pytest.mark.parametrize("value, browser_value", ROUND_TRIPS, ids=["big", "overflow"])
def test_flag_off_a_browser_round_trip_copy_keeps_the_source_policy(
    make_dashboard: Callable[..., Any],
    client: Any,
    full_api_access: None,
    disable_policy: None,
    value: int,
    browser_value: int | None,
) -> None:
    """A copy that resends the policy as a browser parsed it stores the source's."""
    from superset.models.dashboard import Dashboard

    policy = {"custom_refresh_allowed": value}
    dashboard = make_dashboard({"auto_refresh_policy": policy})
    response = copy(
        client,
        dashboard,
        {"auto_refresh_policy": {"custom_refresh_allowed": browser_value}},
    )
    assert response.status_code == 200
    copied = db.session.get(Dashboard, response.json["result"]["id"])
    assert copied.params_dict["auto_refresh_policy"] == policy
    assert stored(dashboard)["auto_refresh_policy"] == policy

    response = copy(
        client, dashboard, {"auto_refresh_policy": {"custom_refresh_allowed": 1}}
    )
    assert response.status_code == 422


def test_merged_frequency_is_checked_before_update_side_effects(
    make_dashboard: Callable[..., Any],
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """A policy-only update validates the frequency kept from the stored metadata."""
    dashboard = make_dashboard({"refresh_frequency": 60})
    process = mocker.spy(
        __import__(
            "superset.commands.dashboard.update", fromlist=["UpdateDashboardCommand"]
        ).UpdateDashboardCommand,
        "process_tab_diff",
    )
    response = put(client, dashboard, {"auto_refresh_policy": PROHIBITED})
    assert response.status_code == 422
    assert error_codes(response) == [(FREQ, "auto_refresh_prohibited")]
    assert stored(dashboard) == {"refresh_frequency": 60}
    assert history() == []
    process.assert_not_called()


@pytest.mark.parametrize(
    "payload",
    [
        {"dashboard_title": "renamed"},
        {"published": True},
        {"json_metadata": json.dumps({"refresh_frequency": 60, "positions": {}})},
    ],
)
@pytest.mark.parametrize("frequency", [45, 60])
def test_unrelated_put_preserves_removed_default(
    make_dashboard: Callable[..., Any],
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
    payload: dict[str, Any],
    frequency: int,
) -> None:
    """An interval configuration change does not block ordinary saves."""
    dashboard = make_dashboard(
        {"auto_refresh_policy": {}, "refresh_frequency": frequency}
    )
    mocker.patch.dict(
        current_app.config, {"DASHBOARD_AUTO_REFRESH_INTERVALS": without(60)}
    )
    if "json_metadata" in payload:
        payload = {
            "json_metadata": json.dumps(
                {"refresh_frequency": frequency, "positions": {}}
            )
        }
    response = client.put(f"/api/v1/dashboard/{dashboard.id}", json=payload)
    assert response.status_code == 200
    assert stored(dashboard)["refresh_frequency"] == frequency


def test_layout_without_frequency_preserves_implicit_zero(
    make_dashboard: Callable[..., Any],
    client: Any,
    full_api_access: None,
) -> None:
    """Omitting a previously absent frequency does not change refresh settings."""
    dashboard = make_dashboard({"auto_refresh_policy": {"auto_refresh_allowed": False}})
    response = client.put(
        f"/api/v1/dashboard/{dashboard.id}",
        json={
            "json_metadata": json.dumps({"positions": {}}),
        },
    )
    assert response.status_code == 200


def test_stored_removed_key_is_rejected_on_refresh_change(
    make_dashboard: Callable[..., Any],
    client: Any,
    full_api_access: None,
) -> None:
    """A refresh edit requires removing unsupported stored policy fields."""
    dashboard = make_dashboard(
        {"auto_refresh_policy": {"custom_refresh_allowed": False}}
    )
    response = put(client, dashboard, {"refresh_frequency": 60})
    assert response.status_code == 422
    assert response.json["errors"][0]["message"] == "Unknown field."


@pytest.mark.parametrize(
    "metadata",
    [
        {"refresh_frequency": 45},
        {"auto_refresh_policy": {"minimum_refresh_interval": 45}},
    ],
)
def test_refresh_setting_changes_still_validate(
    make_dashboard: Callable[..., Any],
    client: Any,
    full_api_access: None,
    metadata: dict[str, Any],
) -> None:
    """Changing frequency or policy still enforces the refresh contract."""
    dashboard = make_dashboard({"auto_refresh_policy": {}, "refresh_frequency": 60})
    assert put(client, dashboard, metadata).status_code == 422


def refresh_settings(policy: Any, frequency: Any = 0) -> dict[str, Any]:
    """Metadata with a policy and a refresh frequency."""
    return {"auto_refresh_policy": policy, "refresh_frequency": frequency}


def minimum(value: Any) -> dict[str, Any]:
    """Policy with a shortest interval."""
    return {"minimum_refresh_interval": value}


WITHOUT_ONE_MINUTE = [[0, "Off"], [30, "30 seconds"], [300, "5 minutes"]]
BOOLEAN_NUMBER_SWAPS = [
    pytest.param(
        refresh_settings({"auto_refresh_allowed": False}),
        refresh_settings({"auto_refresh_allowed": 0}),
        None,
        "invalid_policy",
        id="switch-false-to-0",
    ),
    pytest.param(
        refresh_settings({"auto_refresh_allowed": 0}, 60),
        refresh_settings({"auto_refresh_allowed": False}, 60),
        None,
        "auto_refresh_prohibited",
        id="switch-0-to-false-refreshing",
    ),
    pytest.param(
        refresh_settings({"auto_refresh_allowed": 0}),
        refresh_settings({"auto_refresh_allowed": False}),
        None,
        "log",
        id="switch-0-to-false",
    ),
    pytest.param(
        refresh_settings({"auto_refresh_allowed": True}),
        refresh_settings({"auto_refresh_allowed": 1}),
        None,
        "invalid_policy",
        id="switch-true-to-1",
    ),
    pytest.param(
        refresh_settings({"auto_refresh_allowed": 1}),
        refresh_settings({"auto_refresh_allowed": True}),
        None,
        "log",
        id="switch-1-to-true",
    ),
    pytest.param(
        refresh_settings(minimum(1), 60),
        refresh_settings(minimum(True), 60),
        None,
        "invalid_boundary",
        id="bound-1-to-true",
    ),
    pytest.param(
        refresh_settings(minimum(True), 30),
        refresh_settings(minimum(60), 30),
        None,
        "below_minimum",
        id="bound-true-to-60-too-short",
    ),
    pytest.param(
        refresh_settings(minimum(True), 60),
        refresh_settings(minimum(1), 60),
        [[1, "1 second"], [60, "1 minute"]],
        "log",
        id="bound-true-to-1",
    ),
    pytest.param(
        refresh_settings(minimum(True)),
        refresh_settings(minimum(1)),
        WITHOUT_ONE_MINUTE,
        "invalid_boundary",
        id="bound-true-to-1-not-standard",
    ),
    pytest.param(
        refresh_settings({}),
        refresh_settings({}, False),
        None,
        "invalid_refresh_frequency",
        id="frequency-0-to-false",
    ),
    pytest.param(
        refresh_settings(minimum(60), 60),
        refresh_settings(minimum(60.0), 60),
        None,
        "same",
        id="bound-60-to-60.0",
    ),
    pytest.param(
        refresh_settings(minimum(60.0), 60),
        refresh_settings(minimum(60), 60.0),
        None,
        "same",
        id="bound-60.0-to-60",
    ),
]


@pytest.mark.parametrize(
    "current, submitted, intervals, expected",
    [case for case in BOOLEAN_NUMBER_SWAPS if case.id != "frequency-0-to-false"],
)
def test_flag_on_a_boolean_number_swap_is_a_change(
    make_dashboard: Callable[..., Any],
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
    current: dict[str, Any],
    submitted: dict[str, Any],
    intervals: list[list[Any]] | None,
    expected: str,
) -> None:
    """A boolean turned into a number, or back, is validated and logged on PUT."""
    if intervals:
        mocker.patch.dict(
            current_app.config, {"DASHBOARD_AUTO_REFRESH_INTERVALS": intervals}
        )
    dashboard = make_dashboard(current)
    response = put(client, dashboard, submitted)
    policy = stored(dashboard)["auto_refresh_policy"]
    if expected in ("log", "same"):
        assert response.status_code == 200
        assert json.dumps(policy) == json.dumps(submitted["auto_refresh_policy"])
        rows = history()
        assert len(rows) == (expected == "log")
        if rows:
            assert json.dumps(rows[0]["old"]) == json.dumps(
                current["auto_refresh_policy"]
            )
            assert json.dumps(rows[0]["new"]) == json.dumps(policy)
    else:
        assert response.status_code == 422
        assert expected in [code for _, code in error_codes(response)]
        assert json.dumps(policy) == json.dumps(current["auto_refresh_policy"])
        assert history() == []


ODD_STORED_METADATA = ["[]", "null", "{broken"]


def make_odd_dashboard(make_dashboard: Callable[..., Any], raw: str) -> Any:
    """Make a dashboard whose stored json_metadata isn't a JSON object."""
    dashboard = make_dashboard()
    dashboard.json_metadata = raw
    db.session.commit()
    return dashboard


@pytest.mark.parametrize("raw", ODD_STORED_METADATA)
@pytest.mark.parametrize("enabled", [True, False])
@pytest.mark.parametrize(
    "body",
    [
        {"dashboard_title": "renamed"},
        {"published": True},
        {"position_json": json.dumps({"ROOT_ID": {"type": "ROOT"}})},
    ],
    ids=str,
)
def test_put_over_odd_stored_metadata_behaves_as_before(
    make_dashboard: Callable[..., Any],
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
    raw: str,
    enabled: bool,
    body: dict[str, Any],
) -> None:
    """A title or publish save keeps working over stored metadata of any shape."""
    from superset.extensions import feature_flag_manager

    mocker.patch.dict(
        feature_flag_manager._feature_flags, {"AUTO_REFRESH_POLICY": enabled}
    )
    dashboard = make_odd_dashboard(make_dashboard, raw)
    response = client.put(f"/api/v1/dashboard/{dashboard.id}", json=body)
    assert response.status_code == 200
    db.session.refresh(dashboard)
    for key, value in body.items():
        assert getattr(dashboard, key) == value
    assert dashboard.json_metadata == raw
    assert history() == []


@pytest.mark.parametrize("raw", ODD_STORED_METADATA)
@pytest.mark.parametrize("enabled", [True, False])
def test_copy_with_replaced_metadata_over_odd_stored_metadata(
    make_dashboard: Callable[..., Any],
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
    raw: str,
    enabled: bool,
) -> None:
    """A copy that replaces the metadata doesn't read the source's metadata."""
    from superset.extensions import feature_flag_manager
    from superset.models.dashboard import Dashboard

    mocker.patch.dict(
        feature_flag_manager._feature_flags, {"AUTO_REFRESH_POLICY": enabled}
    )
    dashboard = make_odd_dashboard(make_dashboard, raw)
    response = client.post(
        f"/api/v1/dashboard/{dashboard.id}/copy/",
        json={
            "dashboard_title": "copy",
            "json_metadata": json.dumps({"refresh_frequency": 60}),
            "replace_metadata": True,
        },
    )
    assert response.status_code == 200
    new = db.session.get(Dashboard, response.json["result"]["id"])
    assert new.params_dict["refresh_frequency"] == 60
    assert history() == []


DEEP_LEGACY_METADATA = (
    '{"auto_refresh_policy": {"legacy": ' + "[" * 550 + "0" + "]" * 550 + "}}"
)


@pytest.mark.parametrize("enabled", [True, False])
def test_saves_and_copy_keep_a_deeply_nested_stored_policy(
    make_dashboard: Callable[..., Any],
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
    enabled: bool,
) -> None:
    """Unrelated saves and a copy work over a deeply nested stored policy."""
    from superset.extensions import feature_flag_manager
    from superset.models.dashboard import Dashboard

    mocker.patch.dict(
        feature_flag_manager._feature_flags, {"AUTO_REFRESH_POLICY": enabled}
    )
    dashboard = make_odd_dashboard(make_dashboard, DEEP_LEGACY_METADATA)
    response = client.put(
        f"/api/v1/dashboard/{dashboard.id}", json={"dashboard_title": "renamed"}
    )
    assert response.status_code == 200
    assert put(client, dashboard, {"refresh_frequency": 0}).status_code == 200
    expected = json.loads(DEEP_LEGACY_METADATA)["auto_refresh_policy"]
    assert stored(dashboard)["auto_refresh_policy"] == expected

    response = copy(client, dashboard, {})
    if enabled:
        assert response.status_code == 422
        assert error_codes(response) == [(f"{POLICY}.legacy", "invalid_policy")]
    else:
        assert response.status_code == 200
        new = db.session.get(Dashboard, response.json["result"]["id"])
        assert new.params_dict["auto_refresh_policy"] == expected
