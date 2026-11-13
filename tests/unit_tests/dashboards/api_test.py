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

from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset import db, security_manager
from superset.dashboards.schemas import DashboardGetResponseSchema
from superset.time_range_limits.policy import FEATURE_FLAG
from superset.utils import json


@pytest.fixture
def mock_dashboard() -> MagicMock:
    dash = MagicMock()
    # Real Dashboard objects are not subscriptable. Without this, marshmallow's
    # get_value reads ``dash["changed_on"]`` (which a MagicMock happily returns
    # as another mock) instead of the attribute, and marshmallow 4's DateTime
    # field then fails serializing the mock via datetime.isoformat().
    dash.__getitem__.side_effect = TypeError
    dash.id = 1
    dash.slug = "test-slug"
    dash.url = "/superset/dashboard/test-slug/"
    dash.dashboard_title = "Test Dashboard"
    dash.thumbnail_url = "http://example.com/thumb.png"
    dash.published = True
    dash.css = ""
    dash.theme = None
    dash.json_metadata = "{}"
    dash.position_json = "{}"
    dash.certified_by = None
    dash.certification_details = None
    dash.changed_by_name = "admin"
    dash.changed_by = MagicMock(id=1, first_name="admin", last_name="user")
    dash.changed_on = None
    dash.changed_on_humanized = "2 days ago"
    dash.created_by = MagicMock(id=1, first_name="admin", last_name="user")
    dash.created_on_humanized = "5 days ago"
    dash.charts = []
    dash.editors = []
    dash.viewers = []
    dash.tags = []
    dash.custom_tags = []
    dash.is_managed_externally = False
    dash.uuid = None
    return dash


def test_schema_column_selection_excludes_thumbnail(
    mock_dashboard: MagicMock,
) -> None:
    schema = DashboardGetResponseSchema(only=["id", "dashboard_title"])
    result = schema.dump(mock_dashboard)
    assert "id" in result
    assert "dashboard_title" in result
    assert "thumbnail_url" not in result
    assert "slug" not in result


def test_schema_column_selection_with_data_key(
    mock_dashboard: MagicMock,
) -> None:
    """Fields with data_key should work when using the internal field name."""
    schema = DashboardGetResponseSchema(only=["id", "changed_on_humanized"])
    result = schema.dump(mock_dashboard)
    assert "id" in result
    assert "changed_on_delta_humanized" in result
    assert "dashboard_title" not in result


def test_schema_full_response_includes_thumbnail(
    mock_dashboard: MagicMock,
) -> None:
    schema = DashboardGetResponseSchema()
    result = schema.dump(mock_dashboard)
    assert "thumbnail_url" in result
    assert "id" in result
    assert "dashboard_title" in result


def test_data_key_mapping_logic() -> None:
    """The key_to_name mapping used in the API correctly maps data_key to field name."""
    schema = DashboardGetResponseSchema()
    key_to_name = {
        field.data_key or name: name for name, field in schema.fields.items()
    }
    # changed_on_delta_humanized is the data_key for changed_on_humanized
    assert key_to_name["changed_on_delta_humanized"] == "changed_on_humanized"
    assert key_to_name["created_on_delta_humanized"] == "created_on_humanized"
    # fields without data_key map to themselves
    assert key_to_name["id"] == "id"
    assert key_to_name["thumbnail_url"] == "thumbnail_url"


def test_schema_strips_sensitive_fields_for_guest_user(
    mock_dashboard: MagicMock,
) -> None:
    """Guest users should not see editors, viewers, or changed_by."""
    schema = DashboardGetResponseSchema()

    with patch("superset.dashboards.schemas.security_manager") as mock_sm:
        mock_sm.is_guest_user = MagicMock(return_value=True)
        result = schema.dump(mock_dashboard)

    assert "editors" not in result
    assert "viewers" not in result
    assert "changed_by_name" not in result
    assert "changed_by" not in result
    assert "id" in result
    assert "dashboard_title" in result


def test_schema_includes_all_fields_for_regular_user(
    mock_dashboard: MagicMock,
) -> None:
    """Regular users should see editors, viewers, and changed_by."""
    schema = DashboardGetResponseSchema()

    with patch("superset.dashboards.schemas.security_manager") as mock_sm:
        mock_sm.is_guest_user = MagicMock(return_value=False)
        result = schema.dump(mock_dashboard)

    assert "editors" in result
    assert "viewers" in result
    assert "changed_by_name" in result
    assert "changed_by" in result


ROOT = {"id": "ROOT_ID", "type": "ROOT", "children": ["GRID_ID"]}
GRID = {"id": "GRID_ID", "type": "GRID", "children": ["TABS-1"]}
TAB_1 = {"id": "TAB-1", "type": "TAB", "meta": {"text": "Kept"}, "children": []}


def _layout(tabs_children: list[str]) -> dict[str, Any]:
    return {
        "ROOT_ID": ROOT,
        "GRID_ID": GRID,
        "TABS-1": {"id": "TABS-1", "type": "TABS", "children": tabs_children},
        "TAB-1": TAB_1,
    }


def _store_dashboard(position_json: str) -> int:
    from superset.models.dashboard import Dashboard

    Dashboard.metadata.create_all(db.session.get_bind())
    dashboard = Dashboard(
        dashboard_title="broken layout",
        position_json=position_json,
        json_metadata="{}",
    )
    db.session.add(dashboard)
    db.session.flush()
    return dashboard.id


@pytest.mark.parametrize(
    "stored",
    [
        # A tab bar pointing at a tab the layout does not hold. Walking it is
        # what used to raise, so the dashboard could not be written again.
        pytest.param(_layout(["TAB-1", "TAB-2"]), id="dangling child"),
        # A layout that reaches a node it has already reached. Walking it used
        # to never finish, so the request hung instead of failing.
        pytest.param({"ROOT_ID": {**ROOT, "children": ["ROOT_ID"]}}, id="cycle"),
    ],
)
def test_put_repairs_a_stored_layout_that_cannot_be_walked(
    stored: dict[str, Any],
    session: Session,
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """A dashboard stored with an unwalkable layout can still be repaired.

    The layouts here are JSON-parseable, so they pass validation and reach the
    metadata database. Reading the tabs off them is what fails, and an update
    reads the stored tabs to find the deleted ones, so before this change the
    repair request itself failed and the dashboard stayed unwritable.
    """
    from superset.models.dashboard import Dashboard

    # ``full_api_access`` stops at the route decorators, so the row filter and
    # the editorship check still need a user the request does not have.
    mocker.patch.object(security_manager, "is_admin", return_value=True)
    mocker.patch.object(security_manager, "raise_for_editorship")

    dashboard_id = _store_dashboard(json.dumps(stored))
    repaired = json.dumps(_layout(["TAB-1"]))

    response = client.put(
        f"/api/v1/dashboard/{dashboard_id}",
        json={"position_json": repaired},
    )

    assert response.status_code == 200
    assert json.loads(
        db.session.query(Dashboard).get(dashboard_id).position_json
    ) == json.loads(repaired)


def test_export_bundle_is_refused_without_a_user_id(
    session: Session,
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """Enabling Excel export for guests or the Public role means granting
    ``can_export`` on Dashboard, which also authorizes this endpoint (and, for
    Public, lets FAB serve it unauthenticated). The bundle carries dataset SQL
    and database metadata a viewer never sees."""
    mocker.patch("superset.dashboards.api.get_user_id", return_value=None)

    response = client.get("/api/v1/dashboard/export/?q=!(1)")

    assert response.status_code == 403


def test_export_as_example_is_refused_without_a_user_id(
    session: Session,
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """``export_as_example`` carries ``@permission_name("export")``, so the same
    grant reaches it, and it emits dataset YAML plus Parquet rows."""
    mocker.patch("superset.dashboards.api.get_user_id", return_value=None)

    response = client.get("/api/v1/dashboard/1/export_as_example/")

    assert response.status_code == 403


def test_export_bundle_is_not_refused_for_logged_in_users(
    session: Session,
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    # 404 for the missing id, but the identity guard must not be what stops it.
    mocker.patch("superset.dashboards.api.get_user_id", return_value=1)

    response = client.get("/api/v1/dashboard/export/?q=!(1)")

    assert response.status_code != 403


def test_download_xlsx_is_never_cached(
    session: Session,
    client: Any,
    mocker: MockerFixture,
) -> None:
    """The login-free download URL is a bearer credential with a lifetime
    enforced by the link record; a shared cache must not outlive it."""
    from flask import current_app

    mocker.patch(
        "superset.dashboards.api.resolve_download_link",
        return_value=("bucket", "key", "unittest.mock.MagicMock"),
    )
    backend = MagicMock()
    backend.download.return_value = (2, iter([b"PK"]))
    with patch.dict(current_app.config["EXPORT_STORAGE"], {"backend": backend}):
        response = client.get(
            "/api/v1/dashboard/export_xlsx/download/00000000-0000-0000-0000-0000000000ab/"
        )

    assert response.status_code == 200
    cache_control = response.headers["Cache-Control"]
    assert "no-store" in cache_control
    assert "private" in cache_control
    assert response.headers["Pragma"] == "no-cache"


def test_download_xlsx_answers_head_without_a_body(
    session: Session,
    client: Any,
    mocker: MockerFixture,
) -> None:
    """The frontend confirms a link with HEAD before navigating to it, so an
    expired link becomes a toast rather than a navigation to an error page."""
    from flask import current_app

    mocker.patch(
        "superset.dashboards.api.resolve_download_link",
        return_value=("bucket", "key", "unittest.mock.MagicMock"),
    )
    backend = MagicMock()
    backend.download.return_value = (2, iter([b"PK"]))
    with patch.dict(current_app.config["EXPORT_STORAGE"], {"backend": backend}):
        response = client.head(
            "/api/v1/dashboard/export_xlsx/download/00000000-0000-0000-0000-0000000000ab/"
        )

    assert response.status_code == 200
    assert response.data == b""
    assert response.headers["Content-Length"] == "2"
    assert "attachment" in response.headers["Content-Disposition"]


def test_export_status_is_never_cached(
    session: Session,
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    # A cached "pending" would strand a poller on a stale answer.
    mocker.patch("superset.dashboards.api.get_export_status", return_value=None)

    response = client.get(
        "/api/v1/dashboard/export_xlsx/status/00000000-0000-0000-0000-0000000000ab/"
    )

    assert response.status_code == 200
    assert "no-store" in response.headers["Cache-Control"]


LIMITS = {
    "schema_version": 1,
    "max_span": {"quantity": 90, "time_grain": "P1D"},
    "max_look_back": {"quantity": 13, "time_grain": "P1M"},
    "max_look_forward": {"quantity": 0, "time_grain": "P1D"},
}
GRAIN_UNAVAILABLE = (
    "max_span.time_grain: Time grain P1W is not available. Select a supported unit."
)


@pytest.fixture(params=[False, True], ids=["flag-off", "flag-on"])
def limits_flag(request: Any, mocker: MockerFixture) -> bool:
    from superset.extensions import feature_flag_manager

    flags = feature_flag_manager._feature_flags or {}
    mocker.patch.object(
        feature_flag_manager,
        "get_feature_flags",
        return_value={**flags, FEATURE_FLAG: request.param},
    )
    return request.param


@pytest.fixture
def dashboard_for_put(session: Session, mocker: MockerFixture) -> Any:
    from superset.models.dashboard import Dashboard

    mocker.patch(
        "superset.commands.dashboard.update.security_manager.raise_for_editorship"
    )
    mocker.patch("superset.commands.utils.security_manager.is_admin", return_value=True)
    Dashboard.metadata.create_all(db.session.get_bind())  # pylint: disable=no-member

    dashboard = Dashboard(dashboard_title="my dashboard", slug="my-dashboard")
    db.session.add(dashboard)
    db.session.flush()
    return dashboard


def test_put_dashboard_keeps_time_range_limits(
    dashboard_for_put: Any,
    client: Any,
    full_api_access: None,
    limits_flag: bool,
) -> None:
    json_metadata = json.dumps(
        {"time_range_limits": LIMITS, "color_scheme": "supersetColors"}
    )

    response = client.put(
        f"/api/v1/dashboard/{dashboard_for_put.id}",
        json={"json_metadata": json_metadata},
    )

    assert response.status_code == 200
    db.session.refresh(dashboard_for_put)
    assert json.loads(dashboard_for_put.json_metadata)["time_range_limits"] == LIMITS

    response = client.put(
        f"/api/v1/dashboard/{dashboard_for_put.id}",
        json={"json_metadata": dashboard_for_put.json_metadata},
    )

    assert response.status_code == 200
    db.session.refresh(dashboard_for_put)
    assert json.loads(dashboard_for_put.json_metadata)["time_range_limits"] == LIMITS


BAD_LIMITS_FIELDS = [
    (
        {**LIMITS, "max_span": {"quantity": 0, "time_grain": "P1D"}},
        "max_span.quantity",
    ),
    ({**LIMITS, "max_range_day": 90}, "max_range_day"),
    ({**LIMITS, "max_look_back": {"quantity": 13}}, "max_look_back.time_grain"),
    (
        {**LIMITS, "max_look_forward": {"quantity": 1, "time_grain": "tomorrow"}},
        "max_look_forward.time_grain",
    ),
    ({**LIMITS, "schema_version": 2}, "schema_version"),
    ({"max_range": "90 days"}, "max_look_back"),
    ({}, "max_look_back"),
    ([], None),
]


@pytest.mark.parametrize(("limits", "field"), BAD_LIMITS_FIELDS)
def test_put_dashboard_rejects_bad_time_range_limits(
    dashboard_for_put: Any,
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
    limits_on: None,
    limits: Any,
    field: str | None,
) -> None:
    from superset.daos.dashboard import DashboardDAO

    update = mocker.patch.object(DashboardDAO, "update")

    response = client.put(
        f"/api/v1/dashboard/{dashboard_for_put.id}",
        json={"json_metadata": json.dumps({"time_range_limits": limits})},
    )

    assert response.status_code == 400
    key = "json_metadata.time_range_limits"
    assert list(response.json["message"]) == [f"{key}.{field}" if field else key]
    update.assert_not_called()


@pytest.mark.parametrize(
    ("limits", "field"),
    [case for case in BAD_LIMITS_FIELDS if case[1] != "max_look_forward.time_grain"],
)
def test_put_dashboard_rejects_a_bad_shape_with_the_flag_off(
    dashboard_for_put: Any,
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
    limits: Any,
    field: str | None,
) -> None:
    from superset.daos.dashboard import DashboardDAO

    set_flag(mocker, False)
    update = mocker.patch.object(DashboardDAO, "update")

    response = client.put(
        f"/api/v1/dashboard/{dashboard_for_put.id}",
        json={"json_metadata": json.dumps({"time_range_limits": limits})},
    )

    assert response.status_code == 400
    key = "json_metadata.time_range_limits"
    assert list(response.json["message"]) == [f"{key}.{field}" if field else key]
    update.assert_not_called()


def test_put_dashboard_rejects_the_old_key(
    dashboard_for_put: Any,
    client: Any,
    full_api_access: None,
    limits_flag: bool,
) -> None:
    old_key = "_".join(("date", "range", "limits"))

    response = client.put(
        f"/api/v1/dashboard/{dashboard_for_put.id}",
        json={"json_metadata": json.dumps({old_key: LIMITS})},
    )

    assert response.status_code == 400
    assert response.json["message"] == {
        "json_metadata": [{old_key: ["Unknown field."]}]
    }


def test_put_dashboard_with_a_unit_denylisted_after_the_save(
    dashboard_for_put: Any,
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
    limits_flag: bool,
) -> None:
    from flask import current_app

    limits = {**LIMITS, "max_span": {"quantity": 9, "time_grain": "P1W"}}
    stored = json.dumps({"time_range_limits": limits})
    response = client.put(
        f"/api/v1/dashboard/{dashboard_for_put.id}", json={"json_metadata": stored}
    )
    assert response.status_code == 200
    mocker.patch.dict(current_app.config, {"TIME_GRAIN_DENYLIST": ["P1W"]})

    for body in (
        {"json_metadata": stored},
        {"dashboard_title": "renamed", "json_metadata": stored},
    ):
        response = client.put(f"/api/v1/dashboard/{dashboard_for_put.id}", json=body)
        if not limits_flag:
            # with the flag off, an unchanged stored unit is kept.
            assert response.status_code == 200
            continue
        assert response.status_code == 400
        assert response.json["message"] == {
            "json_metadata.time_range_limits.max_span.time_grain": [GRAIN_UNAVAILABLE]
        }

    for replaced in (
        {**limits, "max_span": None},
        {**limits, "max_span": {"quantity": 63, "time_grain": "P1D"}},
    ):
        response = client.put(
            f"/api/v1/dashboard/{dashboard_for_put.id}",
            json={"json_metadata": json.dumps({"time_range_limits": replaced})},
        )
        assert response.status_code == 200
        db.session.refresh(dashboard_for_put)
        assert (
            json.loads(dashboard_for_put.json_metadata)["time_range_limits"] == replaced
        )

    if limits_flag:
        stored_limits = limits_policy((9, "P1W"))
        store(dashboard_for_put, stored_limits)
        db.session.commit()
        mocker.patch.dict(current_app.config, {"TIME_GRAIN_DENYLIST": ["P1W"]})
        unit_error = {f"{SPAN}.time_grain": [GRAIN_UNAVAILABLE]}

        response = put(
            client, dashboard_for_put, stored_limits, dashboard_title="renamed"
        )
        assert response.status_code == 400
        assert response.json["message"] == unit_error

        changed = limits_policy((8, "P1W"))
        for response in (
            put(client, dashboard_for_put, changed),
            put(client, dashboard_for_put, changed, editors=[999999]),
            post(client, changed),
            client.post(
                f"/api/v1/dashboard/{dashboard_for_put.id}/copy/",
                json={
                    "dashboard_title": "copy",
                    "json_metadata": metadata_with(changed),
                },
            ),
        ):
            assert response.status_code == 400
            assert response.json == {"message": unit_error}

        response = put(client, dashboard_for_put, limits_policy((0, "P1D")))
        assert response.status_code == 400
        assert list(response.json["message"]) == [f"{SPAN}.quantity"]

        response = client.put(
            "/api/v1/dashboard/999999", json={"json_metadata": metadata_with(changed)}
        )
        assert response.status_code == 400
        assert stored_policy(dashboard_for_put) == stored_limits


Rule = tuple[int, str]
SPAN = "json_metadata.time_range_limits.max_span"
LOOK_FORWARD = "json_metadata.time_range_limits.max_look_forward"
ZERO_WINDOW = "Look-back and look-forward can't both be 0: no time range would fit."


def limits_policy(
    max_span: Rule | None = None,
    max_look_back: Rule | None = None,
    max_look_forward: Rule | None = None,
) -> dict[str, Any]:
    def rule(value: Rule | None) -> dict[str, Any] | None:
        return None if value is None else {"quantity": value[0], "time_grain": value[1]}

    return {
        "schema_version": 1,
        "max_span": rule(max_span),
        "max_look_back": rule(max_look_back),
        "max_look_forward": rule(max_look_forward),
    }


DEMO_GLOBAL = limits_policy((12, "P1W"), (12, "P1M"), (3, "P1M"))


def set_flag(mocker: MockerFixture, enabled: bool) -> None:
    from superset.extensions import feature_flag_manager

    flags = feature_flag_manager._feature_flags or {}
    mocker.patch.object(
        feature_flag_manager,
        "get_feature_flags",
        return_value={**flags, FEATURE_FLAG: enabled},
    )


def set_global(mocker: MockerFixture, limits: Any) -> None:
    from flask import current_app

    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": limits})


@pytest.fixture
def limits_on(mocker: MockerFixture) -> None:
    set_flag(mocker, True)
    set_global(mocker, DEMO_GLOBAL)


@pytest.fixture
def saved_dashboard(dashboard_for_put: Any, mocker: MockerFixture) -> Any:
    # A rejected write rolls the session back, so the dashboard must be committed.
    db.session.commit()
    mocker.patch("superset.commands.dashboard.create.populate_subjects")
    return dashboard_for_put


def post(client: Any, limits: Any) -> Any:
    return client.post(
        "/api/v1/dashboard/",
        json={"dashboard_title": "new", "json_metadata": metadata_with(limits)},
    )


def metadata_with(limits: Any, **metadata: Any) -> str:
    return json.dumps({"time_range_limits": limits, **metadata})


def put(client: Any, dashboard: Any, limits: Any, **body: Any) -> Any:
    return client.put(
        f"/api/v1/dashboard/{dashboard.id}",
        json={"json_metadata": metadata_with(limits), **body},
    )


def stored_policy(dashboard: Any) -> Any:
    db.session.refresh(dashboard)
    return json.loads(dashboard.json_metadata or "{}").get("time_range_limits")


def store(dashboard: Any, limits: Any) -> None:
    dashboard.json_metadata = metadata_with(limits)
    db.session.flush()


def test_put_dashboard_must_be_stricter_than_the_global(
    saved_dashboard: Any, client: Any, full_api_access: None, limits_on: None
) -> None:
    allowed = limits_policy((9, "P1W"))
    assert put(client, saved_dashboard, allowed).status_code == 200
    assert stored_policy(saved_dashboard) == allowed

    response = put(client, saved_dashboard, limits_policy((13, "P1W")))
    assert response.status_code == 422
    assert response.json == {
        "message": {
            f"{SPAN}.quantity": ["Dashboard maximum span must be 12 weeks or less."]
        }
    }
    assert stored_policy(saved_dashboard) == allowed

    response = put(client, saved_dashboard, limits_policy((3, "P1M")))
    assert response.status_code == 422
    assert response.json == {
        "message": {
            f"{SPAN}.quantity": ["Dashboard maximum span must be 12 weeks or less."]
        }
    }
    assert stored_policy(saved_dashboard) == allowed

    response = put(client, saved_dashboard, limits_policy((2017, "PT1H")))
    assert response.status_code == 422
    assert response.json == {
        "message": {
            f"{SPAN}.quantity": ["Dashboard maximum span must be 12 weeks or less."]
        }
    }
    assert stored_policy(saved_dashboard) == allowed

    hours = limits_policy((72, "PT1H"))
    assert put(client, saved_dashboard, hours).status_code == 200
    assert stored_policy(saved_dashboard) == hours

    other_unit = limits_policy((2, "P1M"))
    assert put(client, saved_dashboard, other_unit).status_code == 200
    assert stored_policy(saved_dashboard) == other_unit


def test_put_dashboard_after_the_global_got_stricter(
    saved_dashboard: Any,
    client: Any,
    full_api_access: None,
    limits_on: None,
    mocker: MockerFixture,
) -> None:
    saved = limits_policy((9, "P1W"))
    assert put(client, saved_dashboard, saved).status_code == 200
    set_global(mocker, limits_policy((2, "P1M")))

    shuffled = {key: saved[key] for key in reversed(list(saved))}
    shuffled["max_span"] = {"time_grain": "P1W", "quantity": 9}
    response = put(client, saved_dashboard, shuffled, dashboard_title="renamed")
    assert response.status_code == 200
    assert stored_policy(saved_dashboard) == saved
    assert saved_dashboard.dashboard_title == "renamed"

    response = put(client, saved_dashboard, limits_policy((10, "P1W")))
    assert response.status_code == 422
    assert response.json == {
        "message": {
            f"{SPAN}.quantity": ["Dashboard maximum span must be 2 months or less."]
        }
    }
    assert stored_policy(saved_dashboard) == saved

    for limits in (
        limits_policy(),
        None,
        limits_policy((1, "P1M")),
        limits_policy((8, "P1W")),
    ):
        assert put(client, saved_dashboard, limits).status_code == 200
        assert stored_policy(saved_dashboard) == limits

    # The update merges json_metadata: an empty or keyless one keeps the stored
    # (stale) policy unchecked, and null removes it.
    store(saved_dashboard, saved)
    db.session.commit()
    for body in ({"json_metadata": ""}, {"json_metadata": '{"color_scheme": "x"}'}):
        response = client.put(f"/api/v1/dashboard/{saved_dashboard.id}", json=body)
        assert response.status_code == 200
        assert stored_policy(saved_dashboard) == saved
    assert put(client, saved_dashboard, None).status_code == 200
    assert stored_policy(saved_dashboard) is None


def test_post_dashboard_must_be_stricter_than_the_global(
    saved_dashboard: Any, client: Any, full_api_access: None, limits_on: None
) -> None:
    from superset.models.dashboard import Dashboard

    response = post(client, limits_policy((13, "P1W")))
    assert response.status_code == 422
    assert response.json == {
        "message": {
            f"{SPAN}.quantity": ["Dashboard maximum span must be 12 weeks or less."]
        }
    }
    assert db.session.query(Dashboard).count() == 1

    allowed = limits_policy((12, "P1W"), (1, "P1M"))
    response = post(client, allowed)
    assert response.status_code == 201
    created = db.session.get(Dashboard, response.json["id"])
    assert stored_policy(created) == allowed


def time_range_filter(filter_id: str, value: str | None) -> dict[str, Any]:
    return {
        "id": filter_id,
        "name": filter_id,
        "filterType": "filter_time",
        "targets": [{}],
        "scope": {"rootPath": ["ROOT_ID"], "excluded": []},
        "defaultDataMask": {
            "filterState": {"value": value},
            "extraFormData": {"time_range": value} if value else {},
        },
    }


def stored_filter_values(dashboard: Any) -> dict[str, Any]:
    db.session.refresh(dashboard)
    return {
        native_filter["id"]: native_filter["defaultDataMask"]["filterState"]["value"]
        for native_filter in json.loads(dashboard.json_metadata or "{}").get(
            "native_filter_configuration", []
        )
    }


@pytest.mark.parametrize(
    ("value", "message"),
    [
        ("No filter", "Choose a start and an end date. Time range limits are on."),
        (None, "Choose a start and an end date. Time range limits are on."),
        (
            "Last year",
            "Range can't be longer than 12 weeks. This one is 52 weeks and 1 day.",
        ),
    ],
    ids=["no_filter", "no_default", "too_long"],
)
def test_put_filters_refuses_a_time_range_default_outside_the_limits(
    saved_dashboard: Any,
    client: Any,
    full_api_access: None,
    limits_on: None,
    value: str | None,
    message: str,
) -> None:
    stale = time_range_filter("NATIVE_FILTER-stale", "Last year")
    saved_dashboard.json_metadata = json.dumps(
        {
            "native_filter_configuration": [
                stale,
                time_range_filter("NATIVE_FILTER-time", "Last week"),
            ]
        }
    )
    db.session.commit()

    response = client.put(
        f"/api/v1/dashboard/{saved_dashboard.id}/filters",
        json={"modified": [time_range_filter("NATIVE_FILTER-time", value)]},
    )

    assert response.status_code == 422
    assert response.json == {
        "message": {"modified.NATIVE_FILTER-time.defaultDataMask": [message]}
    }
    assert stored_filter_values(saved_dashboard) == {
        "NATIVE_FILTER-stale": "Last year",
        "NATIVE_FILTER-time": "Last week",
    }

    response = client.put(
        f"/api/v1/dashboard/{saved_dashboard.id}/filters",
        json={"modified": [time_range_filter("NATIVE_FILTER-time", "Last month")]},
    )

    assert response.status_code == 200
    assert stored_filter_values(saved_dashboard) == {
        "NATIVE_FILTER-stale": "Last year",
        "NATIVE_FILTER-time": "Last month",
    }


@pytest.mark.parametrize("limits", [None, "flag_off"], ids=["no_limits", "flag_off"])
def test_put_filters_stores_any_default_without_limits(
    saved_dashboard: Any,
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
    limits: str | None,
) -> None:
    set_flag(mocker, limits is None)
    set_global(mocker, None if limits is None else DEMO_GLOBAL)

    response = client.put(
        f"/api/v1/dashboard/{saved_dashboard.id}/filters",
        json={"modified": [time_range_filter("NATIVE_FILTER-time", "No filter")]},
    )

    assert response.status_code == 200
    assert stored_filter_values(saved_dashboard) == {"NATIVE_FILTER-time": "No filter"}


def test_put_filters_answers_503_when_the_global_is_invalid(
    saved_dashboard: Any,
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    set_flag(mocker, True)
    set_global(mocker, {"max_span": "junk"})

    response = client.put(
        f"/api/v1/dashboard/{saved_dashboard.id}/filters",
        json={"modified": [time_range_filter("NATIVE_FILTER-time", "Last week")]},
    )

    assert response.status_code == 503
    (error,) = response.json["errors"]
    assert error["extra"]["reason_code"] == "POLICY_UNAVAILABLE"
    assert "value" not in error["extra"]
    assert stored_filter_values(saved_dashboard) == {}


@pytest.mark.parametrize(
    ("path", "body"),
    [
        ("filters", {"modified": [], "deleted": [], "reordered": []}),
        ("chart_customizations", {"modified": [], "deleted": [], "reordered": []}),
        ("colors", {"color_scheme": "supersetColors"}),
    ],
)
def test_partial_writers_keep_the_override(
    saved_dashboard: Any,
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
    path: str,
    body: dict[str, Any],
) -> None:
    mocker.patch(
        "superset.commands.dashboard.update.security_manager.raise_for_editorship"
    )
    set_flag(mocker, True)
    set_global(mocker, limits_policy((2, "P1M")))
    stale = limits_policy((9, "P1W"))
    store(saved_dashboard, stale)
    before = json.dumps(stored_policy(saved_dashboard))

    response = client.put(f"/api/v1/dashboard/{saved_dashboard.id}/{path}", json=body)

    assert response.status_code == 200
    assert json.dumps(stored_policy(saved_dashboard)) == before


def test_flag_off_accepts_looser_values(
    saved_dashboard: Any, client: Any, full_api_access: None, mocker: MockerFixture
) -> None:
    set_flag(mocker, False)
    set_global(mocker, DEMO_GLOBAL)

    for limits in (
        limits_policy((13, "P1W")),
        limits_policy((2, "P1M")),
        limits_policy(None, (0, "P1D"), (0, "PT1H")),
    ):
        assert put(client, saved_dashboard, limits).status_code == 200
        assert stored_policy(saved_dashboard) == limits
    response = post(client, limits_policy((13, "P1W")))
    assert response.status_code == 201

    unknown_unit = limits_policy((9, "tomorrow"))
    assert put(client, saved_dashboard, unknown_unit).status_code == 200
    assert stored_policy(saved_dashboard) == unknown_unit
    bad_policies: list[Any] = [limits_policy((0, "P1W")), []]
    for bad in bad_policies:
        assert put(client, saved_dashboard, bad).status_code == 400
        assert stored_policy(saved_dashboard) == unknown_unit
    assert post(client, limits_policy((0, "P1W"))).status_code == 400


@pytest.mark.parametrize(
    "global_policy, details",
    [
        ({}, {"source": "global", "field": "max_look_back"}),
        (limits_policy(None, (0, "P1D"), (0, "P1D")), {"source": "global"}),
        (
            limits_policy((12, "P1W")),
            {"source": "global", "field": "max_span.time_grain"},
        ),
    ],
    ids=["empty", "zero-zero", "denylisted"],
)
def test_bad_global_is_a_503(
    saved_dashboard: Any,
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
    global_policy: Any,
    details: dict[str, str],
) -> None:
    from flask import current_app

    from superset.models.dashboard import Dashboard

    set_flag(mocker, True)
    set_global(mocker, global_policy)
    mocker.patch.dict(current_app.config, {"TIME_GRAIN_DENYLIST": ["P1W"]})
    limits = limits_policy((1, "P1D"))

    for response in (
        put(client, saved_dashboard, limits),
        post(client, limits),
    ):
        assert response.status_code == 503
        assert response.json == {
            "errors": [
                {
                    "message": "Time range limits could not be verified. "
                    "Retry the request.",
                    "error_type": "TIME_RANGE_LIMIT_ERROR",
                    "level": "error",
                    "extra": {
                        "reason_code": "POLICY_UNAVAILABLE",
                        **details,
                        "issue_codes": [
                            {
                                "code": 1042,
                                "message": "Issue 1042 - The time range is outside "
                                "the allowed limits, or the limits can't "
                                "be verified.",
                            }
                        ],
                    },
                }
            ]
        }
    assert stored_policy(saved_dashboard) is None
    assert db.session.query(Dashboard).count() == 1

    response = client.put(
        f"/api/v1/dashboard/{saved_dashboard.id}",
        json={"dashboard_title": "renamed", "json_metadata": json.dumps({})},
    )
    assert response.status_code == 200

    set_flag(mocker, False)
    assert put(client, saved_dashboard, limits).status_code == 200


@pytest.mark.parametrize(
    "global_policy",
    [{}, limits_policy(None, (0, "P1D"), (0, "P1D")), limits_policy((12, "P1W"))],
    ids=["empty", "zero-zero", "denylisted"],
)
def test_bad_global_only_blocks_a_changed_policy(
    saved_dashboard: Any,
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
    global_policy: Any,
) -> None:
    from flask import current_app

    stored = limits_policy((9, "P1D"), (2, "P1M"))
    store(saved_dashboard, stored)
    db.session.commit()
    set_flag(mocker, True)
    set_global(mocker, global_policy)
    mocker.patch.dict(current_app.config, {"TIME_GRAIN_DENYLIST": ["P1W"]})

    response = put(client, saved_dashboard, stored, dashboard_title="renamed")
    assert response.status_code == 200
    db.session.refresh(saved_dashboard)
    assert saved_dashboard.dashboard_title == "renamed"

    for changed in (limits_policy((8, "P1D"), (2, "P1M")), limits_policy((9, "P1D"))):
        response = put(client, saved_dashboard, changed, dashboard_title="other")
        assert response.status_code == 503
        assert response.json["errors"][0]["extra"]["reason_code"] == (
            "POLICY_UNAVAILABLE"
        )
    assert stored_policy(saved_dashboard) == stored
    assert saved_dashboard.dashboard_title == "renamed"


def test_dashboard_writes_with_a_denylisted_unit_and_the_flag_off(
    saved_dashboard: Any,
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    from flask import current_app

    set_flag(mocker, False)
    stored = limits_policy((9, "P1W"))
    store(saved_dashboard, stored)
    db.session.commit()
    mocker.patch.dict(current_app.config, {"TIME_GRAIN_DENYLIST": ["P1W"]})

    changed = limits_policy((8, "P1W"))
    assert put(client, saved_dashboard, changed).status_code == 200
    assert stored_policy(saved_dashboard) == changed
    assert post(client, changed).status_code == 201
    response = client.put(
        "/api/v1/dashboard/999999", json={"json_metadata": metadata_with(changed)}
    )
    assert response.status_code == 404


@pytest.mark.parametrize(
    ("limits", "key"),
    [
        (limits_policy((0, "P1D")), f"{SPAN}.quantity"),
        ({"max_span": None}, "json_metadata.time_range_limits.max_look_back"),
        ([], "json_metadata.time_range_limits"),
    ],
)
def test_post_dashboard_rejects_bad_time_range_limits(
    saved_dashboard: Any,
    client: Any,
    full_api_access: None,
    limits_on: None,
    limits: Any,
    key: str,
) -> None:
    response = post(client, limits)
    assert response.status_code == 400
    assert list(response.json["message"]) == [key]


# GET /api/v1/dashboard/<id_or_slug>/time_range_limits/charts/


def _dashboard_check(client: Any, objects: dict[str, Any], query: str = "") -> Any:
    from tests.fixtures.time_range_save_check import DASHBOARD_URL

    return client.get(DASHBOARD_URL.format(objects["dashboard"].id) + query)


def _store_dashboard_policy(objects: dict[str, Any], limits: Any) -> None:
    objects["dashboard"].json_metadata = json.dumps(
        {
            **json.loads(objects["dashboard"].json_metadata),
            "time_range_limits": limits,
        }
    )
    db.session.commit()


@pytest.mark.parametrize("case", ["absent", "null", "malformed", "looser", "bad_rison"])
def test_policy_param_dashboard(
    save_check_objects: dict[str, Any],  # noqa: F811
    client: Any,
    mocker: MockerFixture,
    case: str,
) -> None:
    from flask import current_app
    from freezegun import freeze_time

    from superset.extensions import feature_flag_manager
    from tests.fixtures.time_range_save_check import FLAG_ON, NOW, P, rison, snapshot

    mocker.patch.object(feature_flag_manager, "get_feature_flags", return_value=FLAG_ON)
    _store_dashboard_policy(save_check_objects, P(span=30))
    query = {
        "absent": "",
        "null": rison(None),
        "malformed": rison(
            {**P(span=90), "max_span": {"quantity": -1, "time_grain": "P1D"}}
        ),
        "looser": rison(P(span=60)),
        "bad_rison": "?q=(a:b",
    }[case]
    if case == "looser":
        current_app.config["TIME_RANGE_LIMITS_GLOBAL"] = P(span=45)
    before = snapshot(save_check_objects)

    with freeze_time(NOW):
        response = _dashboard_check(client, save_check_objects, query)

    assert snapshot(save_check_objects) == before
    if case == "absent":
        assert response.status_code == 200
        assert {item["source"] for item in response.json["result"]["charts"]} == {
            "dashboard"
        }
    elif case == "null":
        assert response.status_code == 200
        assert [
            (item["slice_name"], item["source"])
            for item in response.json["result"]["charts"]
        ] == [("Calls by queue", "dataset"), ("Form data line", "dataset")]
    elif case == "malformed":
        assert response.status_code == 400
        assert response.json == {
            "message": {
                "policy.max_span.quantity": [
                    "max_span.quantity: must be a whole number from 1 to 9999"
                ]
            }
        }
    elif case == "looser":
        assert response.status_code == 422
        assert response.json == {
            "message": {
                "policy.max_span.quantity": [
                    "Dashboard maximum span must be 45 days or less."
                ]
            }
        }
    else:
        assert response.status_code == 400
        assert response.json == {"message": "Not a valid rison/json argument"}


def test_unchanged_needs_review_policy_not_422_dashboard(
    save_check_objects: dict[str, Any],  # noqa: F811
    client: Any,
    mocker: MockerFixture,
) -> None:
    from flask import current_app

    from superset.extensions import feature_flag_manager
    from tests.fixtures.time_range_save_check import FLAG_ON, P, rison

    mocker.patch.object(feature_flag_manager, "get_feature_flags", return_value=FLAG_ON)
    _store_dashboard_policy(save_check_objects, P(span=60))
    current_app.config["TIME_RANGE_LIMITS_GLOBAL"] = P(span=30)

    unchanged = _dashboard_check(client, save_check_objects, rison(P(span=60)))
    changed = _dashboard_check(client, save_check_objects, rison(P(span=50)))

    assert unchanged.status_code == 200
    assert changed.status_code == 422


def test_save_check_dashboard_prefetches_chart_access(
    save_check_objects: dict[str, Any],  # noqa: F811
    client: Any,
    mocker: MockerFixture,
) -> None:
    from sqlalchemy import inspect

    from superset.extensions import feature_flag_manager
    from superset.models.dashboard import Dashboard
    from tests.fixtures.time_range_save_check import FLAG_ON

    mocker.patch.object(feature_flag_manager, "get_feature_flags", return_value=FLAG_ON)
    mocker.patch.object(security_manager, "is_admin", return_value=False)
    dashboard_id = save_check_objects["dashboard"].id
    db.session.expunge_all()
    mocker.patch(
        "superset.dashboards.api.DashboardDAO.get_by_id_or_slug",
        side_effect=lambda _: db.session.get(Dashboard, dashboard_id),
    )
    unloaded: list[set[str]] = []

    def can_access_chart(chart: Any) -> bool:
        unloaded.append(inspect(chart).unloaded)
        return True

    mocker.patch.object(
        security_manager, "can_access_chart", side_effect=can_access_chart
    )

    response = _dashboard_check(client, save_check_objects)

    assert response.status_code == 200
    assert len(unloaded) == 3
    assert all({"editors", "viewers"}.isdisjoint(names) for names in unloaded)


@pytest.mark.parametrize("who", ["editor", "admin", "not_editor", "cannot_see"])
def test_save_check_editor_only_dashboard(
    save_check_objects: dict[str, Any],  # noqa: F811
    client: Any,
    mocker: MockerFixture,
    who: str,
) -> None:
    from superset.commands.dashboard.exceptions import DashboardNotFoundError
    from superset.exceptions import SupersetSecurityException
    from superset.extensions import feature_flag_manager, security_manager
    from tests.fixtures.time_range_save_check import FLAG_ON

    mocker.patch.object(feature_flag_manager, "get_feature_flags", return_value=FLAG_ON)
    if who == "editor":
        mocker.patch.object(security_manager, "is_admin", return_value=False)
        mocker.patch(
            "superset.dashboards.api.DashboardDAO.get_by_id_or_slug",
            return_value=save_check_objects["dashboard"],
        )
    elif who == "not_editor":
        mocker.patch.object(
            security_manager,
            "raise_for_editorship",
            side_effect=SupersetSecurityException(MagicMock()),
        )
    elif who == "cannot_see":
        mocker.patch(
            "superset.dashboards.api.DashboardDAO.get_by_id_or_slug",
            side_effect=DashboardNotFoundError(),
        )

    response = _dashboard_check(client, save_check_objects)

    assert (
        response.status_code
        == {
            "editor": 200,
            "admin": 200,
            "not_editor": 403,
            "cannot_see": 404,
        }[who]
    )
