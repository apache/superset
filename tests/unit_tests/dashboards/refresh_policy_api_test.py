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
    "minimum_refresh_interval": {"value": 30, "unit": "seconds"},
    "maximum_refresh_interval": {"value": 1, "unit": "hours"},
}
PROHIBITED = {"auto_refresh_allowed": False}
USER_ID = 7


def bound(value: Any, unit: Any = "seconds") -> dict[str, Any]:
    """Bound."""
    return {"value": value, "unit": unit}


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
        ({"minimum_refresh_interval": bound(0)}, 0, [(MIN, "invalid_boundary")]),
        ({"minimum_refresh_interval": bound(-1)}, 0, [(MIN, "invalid_boundary")]),
        ({"minimum_refresh_interval": bound(1.5)}, 0, [(MIN, "invalid_boundary")]),
        ({"minimum_refresh_interval": bound("30")}, 0, [(MIN, "invalid_boundary")]),
        ({"minimum_refresh_interval": bound(True)}, 0, [(MIN, "invalid_boundary")]),
        (
            {"maximum_refresh_interval": bound(30, "second")},
            0,
            [(MAX, "invalid_boundary")],
        ),
        (
            {"maximum_refresh_interval": bound(1, "days")},
            0,
            [(MAX, "invalid_boundary")],
        ),
        (
            {"maximum_refresh_interval": {**bound(30), "x": 1}},
            0,
            [(MAX, "invalid_boundary")],
        ),
        ({"minimum_refresh_interval": bound(45)}, 0, [(MIN, "invalid_boundary")]),
        (
            {"maximum_refresh_interval": bound(2, "hours")},
            0,
            [(MAX, "invalid_boundary")],
        ),
        (
            {
                "minimum_refresh_interval": bound(1, "hours"),
                "maximum_refresh_interval": bound(30),
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
                "minimum_refresh_interval": bound(1, "hours"),
                "maximum_refresh_interval": bound(30),
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
        ({"minimum_refresh_interval": bound(30)}, 10, [(FREQ, "below_minimum")]),
        (
            {"maximum_refresh_interval": bound(1, "hours")},
            21600,
            [(FREQ, "above_maximum")],
        ),
        ({"minimum_refresh_interval": bound(60)}, 60, []),
        ({"minimum_refresh_interval": bound(1, "minutes")}, 60, []),
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


def test_equal_bounds_in_different_units(
    make_dashboard: Callable[..., Any], client: Any, full_api_access: None
) -> None:
    """Check equal bounds in different units."""
    dashboard = make_dashboard({})
    policy = {
        "minimum_refresh_interval": bound(60),
        "maximum_refresh_interval": bound(1, "minutes"),
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
    off = {"auto_refresh_allowed": False, "minimum_refresh_interval": bound(45)}

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
    policy = {"minimum_refresh_interval": bound(30)}
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
        "minimum_refresh_interval": bound(2, "minutes"),
        "maximum_refresh_interval": bound(4, "minutes"),
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
        "minimum_refresh_interval": bound(2, "minutes"),
        "maximum_refresh_interval": bound(4, "minutes"),
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
    policy = {"minimum_refresh_interval": bound(60)}
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
                "maximum_refresh_interval": bound(1, "hours"),
            }
        },
    )
    assert error_codes(response) == [(MIN, "invalid_boundary")]

    response = put(
        client,
        dashboard,
        {
            "auto_refresh_policy": {"maximum_refresh_interval": bound(1, "hours")},
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
    policy = {"minimum_refresh_interval": bound(24, "hours")}
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
        "minimum_refresh_interval": bound(60),
        "maximum_refresh_interval": bound(60),
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
        {"auto_refresh_policy": {"minimum_refresh_interval": bound(45)}},
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

    response = post(
        client, {"auto_refresh_policy": {"minimum_refresh_interval": bound(45)}}
    )
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
        assert '"unit": "seconds" | "minutes" | "hours"' in description


@pytest.fixture(autouse=True)
def enable_policy(mocker: MockerFixture) -> None:
    """Enable policy enforcement for the policy contract tests."""
    from superset.extensions import feature_flag_manager

    mocker.patch.dict(
        feature_flag_manager._feature_flags, {"AUTO_REFRESH_POLICY": True}
    )


@pytest.mark.parametrize("policy", ["invalid", {"auto_refresh_allowed": False}, None])
def test_flag_off_stores_policy_without_validation_or_history(
    make_dashboard: Callable[..., Any],
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
    policy: Any,
) -> None:
    """Disabled policy enforcement accepts raw metadata on all REST write paths."""
    from superset.extensions import feature_flag_manager
    from superset.models.dashboard import Dashboard

    mocker.patch.dict(
        feature_flag_manager._feature_flags, {"AUTO_REFRESH_POLICY": False}
    )
    dashboard = make_dashboard({"auto_refresh_policy": "previous"})
    metadata = {"auto_refresh_policy": policy, "refresh_frequency": 45}
    assert put(client, dashboard, metadata).status_code == 200
    assert stored(dashboard)["auto_refresh_policy"] == policy
    copied = copy(client, dashboard, metadata)
    assert copied.status_code == 200
    created = post(client, metadata)
    assert created.status_code == 201
    assert (
        db.session.get(Dashboard, created.json["id"]).params_dict["auto_refresh_policy"]
        == policy
    )
    assert history() == []


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
        {"auto_refresh_policy": {"minimum_refresh_interval": bound(45)}},
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
