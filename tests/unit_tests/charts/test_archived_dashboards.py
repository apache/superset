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
"""Archived dashboard expansion with real ORM queries and chart-list requests."""

from __future__ import annotations

import copy
from contextlib import AbstractContextManager, ExitStack
from datetime import datetime
from types import TracebackType
from typing import Any
from unittest.mock import patch

import pytest
from flask import Response
from flask.testing import FlaskClient
from flask_appbuilder.security.sqla.models import User
from pytest_mock import MockerFixture
from sqlalchemy import event
from sqlalchemy.orm.session import Session

from tests.unit_tests.conftest import with_feature_flags

ARCHIVED = datetime(2026, 1, 1)
CHART_EDITOR, DASH_EDITOR, GAMMA = 2, 3, 4


@pytest.fixture
def memberships(session: Session) -> dict[str, Any]:
    """Seed live and archived memberships with distinct editors and viewers."""
    from superset import db
    from superset.connectors.sqla.models import Database, SqlaTable
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.subjects.models import Subject
    from superset.subjects.types import SubjectType

    Dashboard.metadata.create_all(session.get_bind())
    subj = {
        uid: Subject(label=f"u{uid}", type=SubjectType.USER, user_id=uid)
        for uid in (CHART_EDITOR, DASH_EDITOR, GAMMA)
    }
    ds = SqlaTable(
        table_name="t",
        database=Database(database_name="d", sqlalchemy_uri="sqlite://"),
    )
    db.session.add_all([ds, *subj.values()])
    db.session.flush()
    live_c = Slice(slice_name="live_c", datasource_id=ds.id, datasource_type="table")
    arch_c = Slice(
        slice_name="arch_c",
        datasource_id=ds.id,
        datasource_type="table",
        deleted_at=ARCHIVED,
        editors=[subj[CHART_EDITOR], subj[DASH_EDITOR]],
    )
    both = [live_c, arch_c]
    d_live = Dashboard(dashboard_title="d_live", slices=both, published=True)
    # archived, edited by DASH_EDITOR, published, no viewers
    d_arch_b = Dashboard(
        dashboard_title="b_arch_ed",
        slices=both,
        published=True,
        editors=[subj[DASH_EDITOR]],
        deleted_at=ARCHIVED,
    )
    # archived, GAMMA is a viewer (read access) but not an editor
    d_arch_a = Dashboard(
        dashboard_title="a_arch_viewed",
        slices=both,
        published=True,
        editors=[subj[DASH_EDITOR]],
        viewers=[subj[GAMMA]],
        deleted_at=ARCHIVED,
    )
    # Archived, published, only archived member charts, no editors.
    d_arch_orphan = Dashboard(
        dashboard_title="c_arch_orphan",
        slices=[arch_c],
        published=True,
        deleted_at=ARCHIVED,
    )
    # archived, edited by DASH_EDITOR, whose ONLY chart is archived
    d_arch_only = Dashboard(
        dashboard_title="d_arch_only",
        slices=[arch_c],
        published=False,
        editors=[subj[DASH_EDITOR]],
        deleted_at=ARCHIVED,
    )
    db.session.add_all(
        [live_c, arch_c, d_live, d_arch_a, d_arch_b, d_arch_orphan, d_arch_only]
    )
    db.session.flush()
    ids = {
        "live_c": live_c.id,
        "arch_c": arch_c.id,
        "d_live": d_live.id,
        "a": d_arch_a.id,
        "b": d_arch_b.id,
        "orphan": d_arch_orphan.id,
        "only": d_arch_only.id,
    }
    db.session.expunge_all()
    return ids


def _payload(w: dict[str, Any], *, leftover: bool = False) -> dict[str, Any]:
    """Build FAB's serialized chart rows before archived dashboard expansion."""
    live = [{"id": w["d_live"], "dashboard_title": "d_live"}]
    if leftover:  # flag-off shape: FAB already serialized archived dashboards
        live = live + [{"id": w["b"], "dashboard_title": "b_arch_ed"}]
    return {
        "ids": [w["live_c"], w["arch_c"]],
        "result": [
            {"slice_name": "live_c", "dashboards": copy.deepcopy(live)},
            {"slice_name": "arch_c", "dashboards": copy.deepcopy(live)},
        ],
        "count": 2,
    }


class _Principal:
    """Model independent dashboard read access and archive editorship grants."""

    def __init__(
        self,
        *,
        admin: bool = False,
        user_id: int | None = None,
        guest_clause: Any = None,
    ) -> None:
        """Configure the principal without granting dataset-wide read access."""
        self.admin, self.user_id, self.guest_clause = admin, user_id, guest_clause
        self._patches = ExitStack()

    def __enter__(self) -> None:
        """Install the principal's permissions for the query under test."""
        from superset.extensions import security_manager as sm

        cls = type(sm._get_current_object())
        patches: list[AbstractContextManager[Any]] = [
            patch.object(cls, "is_admin", lambda *_a, **_k: self.admin),
            patch.object(cls, "can_access_all_datasources", lambda *_a: False),
            patch.object(cls, "get_accessible_databases", lambda *_a: []),
            patch.object(cls, "user_view_menu_names", lambda *_a: set()),
            patch("superset.views.filters.get_user_id", lambda: self.user_id),
            patch("superset.dashboards.filters.get_user_id", lambda: self.user_id),
            patch(
                "superset.dashboards.filters.guest_embedded_dashboard_filter",
                lambda: self.guest_clause,
            ),
        ]
        for permission in patches:
            self._patches.enter_context(permission)

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        """Restore security methods after each principal check."""
        self._patches.close()


def _archived_titles(data: dict[str, Any]) -> list[list[str]]:
    """Read archive titles while preserving chart and dashboard ordering."""
    return [
        [d["dashboard_title"] for d in row["dashboards"] if d.get("archived")]
        for row in data["result"]
    ]


def _expand_dashboard_memberships(data: dict[str, Any]) -> dict[str, Any]:
    """Expand the dashboard fields selected by dataset Usage."""
    from superset.charts.api import ChartRestApi

    ChartRestApi._append_archived_dashboards(data, frozenset({"id", "dashboard_title"}))
    return data


@pytest.mark.parametrize(
    "principal,expected",
    [
        ({"admin": True}, ["a_arch_viewed", "b_arch_ed"]),
        ({"user_id": CHART_EDITOR}, []),
        ({"user_id": DASH_EDITOR}, ["a_arch_viewed", "b_arch_ed"]),
        ({"user_id": GAMMA}, []),
        ({"user_id": None}, []),
    ],
    ids=["admin", "chart-editor", "dash-editor", "gamma-viewer", "no-user"],
)
@with_feature_flags(SOFT_DELETE=True)
def test_expansion_requires_independent_dashboard_editorship(
    memberships: dict[str, int], principal: dict[str, Any], expected: Any
) -> None:
    """Expansion audience."""
    data = _payload(memberships)
    with _Principal(**principal):
        _expand_dashboard_memberships(data)
    arch_only = {
        "admin": ["c_arch_orphan", "d_arch_only"],
        DASH_EDITOR: ["d_arch_only"],
    }.get("admin" if principal.get("admin") else principal.get("user_id"), [])
    # live chart: archived dashboards it belongs to; the archived chart also
    # belongs to dashboards whose only member is that archived chart
    assert _archived_titles(data) == [expected, expected + arch_only]
    # live entries preserved and marked, first, unchanged order
    for row in data["result"]:
        assert row["dashboards"][0] == {
            "id": memberships["d_live"],
            "dashboard_title": "d_live",
            "archived": False,
        }
        assert all("url" not in d for d in row["dashboards"])
    assert data["count"] == 2
    assert [r["slice_name"] for r in data["result"]] == [
        "live_c",
        "arch_c",
    ]


@with_feature_flags(SOFT_DELETE=True, EMBEDDED_SUPERSET=True)
def test_expansion_guest_token_covering_archived_dashboard(
    memberships: dict[str, int],
) -> None:
    """Expansion guest token covering archived dashboard."""
    from superset.models.dashboard import Dashboard

    data = _payload(memberships)
    with _Principal(user_id=None, guest_clause=Dashboard.id.in_([memberships["b"]])):
        _expand_dashboard_memberships(data)
    assert _archived_titles(data) == [[], []]


@with_feature_flags(SOFT_DELETE=True)
def test_access_subqueries_see_archived_dashboards_and_session_untouched(
    memberships: dict[str, int], session: Session
) -> None:
    """Statement-level skip reaches DashboardAccessFilter subqueries; no
    session bypass, no Dashboard entity in the identity map."""
    from superset.connectors.sqla.models import SqlaTable
    from superset.constants import SKIP_VISIBILITY_FILTER_CLASSES
    from superset.models.dashboard import Dashboard

    statements: list[str] = []

    def capture(
        conn: Any,
        cursor: Any,
        statement: str,
        params: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        """Capture."""
        statements.append(statement)

    session.info[SKIP_VISIBILITY_FILTER_CLASSES] = {SqlaTable}  # caller-owned
    before = set(session.info[SKIP_VISIBILITY_FILTER_CLASSES])
    data = _payload(memberships)
    event.listen(session.get_bind(), "before_cursor_execute", capture)
    try:
        with _Principal(user_id=DASH_EDITOR):
            _expand_dashboard_memberships(data)
    finally:
        event.remove(session.get_bind(), "before_cursor_execute", capture)
    assert session.info[SKIP_VISIBILITY_FILTER_CLASSES] == before
    assert not [o for o in session.identity_map.values() if isinstance(o, Dashboard)]
    sql = [s for s in statements if "dashboard_slices" in s]
    assert len(sql) == 1
    # no Dashboard soft-delete criteria anywhere (incl. subqueries) ...
    assert "dashboards.deleted_at IS NULL" not in sql[0]
    # ... while Slice criteria still apply inside the no-viewer subquery
    assert "slices.deleted_at IS NULL" in sql[0]
    assert _archived_titles(data)[0] == ["a_arch_viewed", "b_arch_ed"]


@with_feature_flags(SOFT_DELETE=True)
def test_control_editor_subquery_needs_dashboard_skip(
    memberships: dict[str, int],
) -> None:
    """The editor-branch subquery on its own drops archived
    dashboards unless the Dashboard skip reaches it, so the statement-level
    skip covering DashboardAccessFilter's subqueries is required."""
    from superset import db
    from superset.constants import SKIP_VISIBILITY_FILTER_CLASSES
    from superset.models.dashboard import Dashboard
    from superset.subjects.models import dashboard_editors, Subject

    q = (
        db.session.query(Dashboard.id)
        .join(dashboard_editors, Dashboard.id == dashboard_editors.c.dashboard_id)
        .join(Subject, Subject.id == dashboard_editors.c.subject_id)
        .filter(Subject.user_id == DASH_EDITOR)
    )
    assert q.all() == []
    skipped = q.execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {Dashboard}})
    assert {i for (i,) in skipped.all()} == {
        memberships["a"],
        memberships["b"],
        memberships["only"],
    }


@with_feature_flags(SOFT_DELETE=True)
def test_deleted_at_humanized_present_regardless_of_columns(
    memberships: dict[str, int],
) -> None:
    """The injected archive fields don't depend on requested columns."""
    from flask_appbuilder.models.sqla.interface import SQLAInterface

    from superset import db
    from superset.charts import api as chart_api
    from superset.charts.filters import ChartDeletedStateFilter
    from superset.models.slice import Slice

    with _Principal(admin=True):
        ChartDeletedStateFilter("id", SQLAInterface(Slice)).apply(
            db.session.query(Slice), "include"
        )
        data: dict[str, Any] = {
            "ids": [memberships["live_c"], memberships["arch_c"]],
            "result": [{"slice_name": "live_c"}, {"slice_name": "arch_c"}],
        }
        object.__new__(chart_api.ChartRestApi).pre_get_list(data)
    live, arch = data["result"]
    assert live["deleted_at"] is None
    assert live["deleted_at_delta_humanized"] is None
    assert arch["deleted_at"]
    assert arch["deleted_at_delta_humanized"]


@with_feature_flags(SOFT_DELETE=False)
def test_flag_off_leftover_archived_no_duplicates(memberships: dict[str, int]) -> None:
    """Flag off leftover archived no duplicates."""
    from superset.charts import api as chart_api

    api = object.__new__(chart_api.ChartRestApi)
    data = _payload(memberships, leftover=True)
    expected = copy.deepcopy(data)
    token = chart_api._include_archived_dashboards.set(
        frozenset({"id", "dashboard_title"})
    )
    try:
        with _Principal(admin=True):
            api.pre_get_list(data)
    finally:
        chart_api._include_archived_dashboards.reset(token)
    assert data == expected


@with_feature_flags(SOFT_DELETE=True)
def test_opt_out_leaves_payload_untouched(memberships: dict[str, int]) -> None:
    """Opt out leaves payload untouched."""
    from superset.charts import api as chart_api

    api = object.__new__(chart_api.ChartRestApi)
    data = _payload(memberships)
    expected = copy.deepcopy(data)
    with _Principal(admin=True):
        api.pre_get_list(data)
    assert data == expected


@pytest.mark.parametrize("viz_path", [False, True])
@pytest.mark.parametrize("opt", [True, False])
def test_contextvar_restored_on_exception_both_paths(viz_path: bool, opt: bool) -> None:
    """Contextvar restored on exception both paths."""
    from superset.charts import api as chart_api
    from superset.views.base_api import BaseSupersetModelRestApi

    seen: list[tuple[frozenset[str] | None, dict[str, int] | None]] = []

    def boom(self: Any, **kwargs: Any) -> None:
        """Boom."""
        seen.append(
            (
                chart_api._include_archived_dashboards.get(),
                chart_api._viz_type_order.get(),
            )
        )
        raise RuntimeError("mid-augmentation")

    rison: dict[str, Any] = {"include_archived_dashboards": opt}
    if viz_path:
        rison |= {"order_column": "viz_type", "viz_type_order": ["table"]}
    api = object.__new__(chart_api.ChartRestApi)
    outer_value = frozenset({"caller"})  # pre-existing caller state
    outer = chart_api._include_archived_dashboards.set(outer_value)
    try:
        with patch.object(BaseSupersetModelRestApi, "get_list_headless", boom):
            with pytest.raises(RuntimeError):
                chart_api.ChartRestApi.get_list_headless(api, rison=rison)
        assert (seen[0][0] == frozenset({"id", "dashboard_title"})) is opt
        assert (seen[0][0] is None) is (not opt)
        assert (seen[0][1] is not None) is viz_path
        assert chart_api._include_archived_dashboards.get() == outer_value
        assert chart_api._viz_type_order.get() is None
    finally:
        chart_api._include_archived_dashboards.reset(outer)


@with_feature_flags(SOFT_DELETE=True)
def test_exception_in_expansion_leaves_session_info(
    memberships: dict[str, int], session: Session
) -> None:
    """Exception in expansion leaves session info."""
    from superset.charts import api as chart_api
    from superset.constants import SKIP_VISIBILITY_FILTER_CLASSES

    before = copy.copy(session.info.get(SKIP_VISIBILITY_FILTER_CLASSES))
    api = object.__new__(chart_api.ChartRestApi)
    token = chart_api._include_archived_dashboards.set(
        frozenset({"id", "dashboard_title"})
    )
    try:
        with (
            _Principal(admin=True),
            patch(
                "superset.charts.api.scope_query_to_restore_audience",
                side_effect=RuntimeError("boom"),
            ),
        ):
            with pytest.raises(RuntimeError):
                api.pre_get_list(_payload(memberships))
    finally:
        chart_api._include_archived_dashboards.reset(token)
    assert session.info.get(SKIP_VISIBILITY_FILTER_CLASSES) == before


def test_schema_accepts_bool_rejects_other_types() -> None:
    """Schema accepts bool rejects other types."""
    import jsonschema

    from superset.charts.schemas import chart_get_list_schema

    jsonschema.validate({"include_archived_dashboards": True}, chart_get_list_schema)
    invalid_values: list[Any] = ["true", 1, None, []]
    for bad in invalid_values:
        with pytest.raises(jsonschema.ValidationError):
            jsonschema.validate(
                {"include_archived_dashboards": bad}, chart_get_list_schema
            )


@pytest.mark.parametrize("mode", ["include", "only"])
@pytest.mark.parametrize(
    "principal",
    [
        {"admin": True},
        {"user_id": CHART_EDITOR},
        {"user_id": GAMMA},
        {"user_id": None},
    ],
    ids=["admin", "chart-editor", "gamma", "no-user"],
)
@with_feature_flags(SOFT_DELETE=True)
def test_chart_deleted_state_filter_unchanged(
    memberships: dict[str, int], mode: str, principal: dict[str, Any]
) -> None:
    """Chart deleted state filter unchanged."""
    from flask import g
    from flask_appbuilder.models.sqla.interface import SQLAInterface

    from superset import db
    from superset.charts.filters import ChartDeletedStateFilter
    from superset.constants import SKIP_VISIBILITY_FILTER_CLASSES
    from superset.models.slice import Slice

    with _Principal(**principal):
        q = ChartDeletedStateFilter("id", SQLAInterface(Slice)).apply(
            db.session.query(Slice.slice_name), mode
        )
        names = sorted(n for (n,) in q.all())
    db.session.info.get(SKIP_VISIBILITY_FILTER_CLASSES, set()).discard(Slice)
    g.pop("_deleted_state_added_classes", None)
    g.pop("_augment_response_with_deleted_at", None)
    sees_arch = principal.get("admin") or principal.get("user_id") == CHART_EDITOR
    expected = (["arch_c"] if sees_arch else []) + (
        ["live_c"] if mode == "include" else []
    )
    assert names == sorted(expected)


@with_feature_flags(SOFT_DELETE=True)
def test_viewerless_all_archived_charts_passes_access_filter_alone(
    memberships: dict[str, int],
) -> None:
    """GAMMA (non-editor, no data grants) passes DashboardAccessFilter for
    the published viewer-less archived dashboard whose charts are all archived
    (Slice criteria empty the outer join -> 'no charts' branch); the restore
    audience hides it."""
    from flask_appbuilder.models.sqla.interface import SQLAInterface

    from superset import db
    from superset.constants import SKIP_VISIBILITY_FILTER_CLASSES
    from superset.dashboards.filters import DashboardAccessFilter
    from superset.models.dashboard import Dashboard
    from superset.views.filters import scope_query_to_restore_audience

    with _Principal(user_id=GAMMA):
        q = (
            db.session.query(Dashboard.id)
            .filter(Dashboard.deleted_at.is_not(None))
            .execution_options(**{SKIP_VISIBILITY_FILTER_CLASSES: {Dashboard}})
        )
        q = DashboardAccessFilter("id", SQLAInterface(Dashboard)).apply(q, None)
        access_only = {i for (i,) in q.all()}
        gated = {
            i for (i,) in scope_query_to_restore_audience(q, Dashboard, "only").all()
        }
    # a_arch_viewed via viewer branch, c_arch_orphan via the no-charts fallback
    assert access_only == {memberships["a"], memberships["orphan"]}
    assert gated == set()


@pytest.mark.parametrize(
    "columns,expected_keys",
    [
        (["slice_name"], None),
        (["slice_name", "dashboards.id"], {"id", "archived"}),
        (["slice_name", "dashboards.dashboard_title"], {"dashboard_title", "archived"}),
        (["slice_name", "dashboards.url"], None),  # not a list column: dropped
    ],
)
@with_feature_flags(SOFT_DELETE=True)
def test_requested_columns_respected(
    memberships: dict[str, int], columns: list[str], expected_keys: set[str] | None
) -> None:
    """Requested columns respected."""
    from superset.charts import api as chart_api

    api = object.__new__(chart_api.ChartRestApi)
    fields = api._requested_dashboard_fields(
        {"columns": columns, "include_archived_dashboards": True}
    )
    # Simulate FAB's serialization of only the requested nested fields.
    sub = {
        c.split(".", 1)[1]
        for c in columns
        if c in api.list_columns and c.startswith("dashboards.")
    }
    data = _payload(memberships)
    for row in data["result"]:
        if not sub:
            del row["dashboards"]
        else:
            row["dashboards"] = [
                {k: v for k, v in d.items() if k in sub} for d in row["dashboards"]
            ]
    expected = copy.deepcopy(data)
    token = chart_api._include_archived_dashboards.set(fields)
    try:
        with _Principal(admin=True):
            api.pre_get_list(data)
    finally:
        chart_api._include_archived_dashboards.reset(token)
    if expected_keys is None:
        assert data == expected
        return
    for row in data["result"]:
        assert row["dashboards"], row
        for d in row["dashboards"]:
            assert set(d) == expected_keys, d
    assert sum(d["archived"] for d in data["result"][1]["dashboards"]) == 4


@with_feature_flags(SOFT_DELETE=True, EMBEDDED_SUPERSET=True)
def test_real_guest_user_denied_explicitly(memberships: dict[str, int]) -> None:
    """Real GuestUser on g (no id attribute); token covers an archived dashboard.
    Denied by the explicit is_guest_user short-circuit; without it the result
    is still empty only because get_user_id() is None (accidental)."""
    from flask import g

    from superset.charts import api as chart_api
    from superset.security.guest_token import GuestTokenResourceType, GuestUser
    from superset.utils.core import get_user_id

    guest = GuestUser(
        token={
            "iat": 0,
            "exp": 9999999999,
            "rls_rules": [],
            "user": {},
            "resources": [
                {"type": GuestTokenResourceType.DASHBOARD, "id": str(memberships["b"])}
            ],
        },
        roles=[],
    )
    prev = getattr(g, "user", None)
    g.user = guest
    try:
        assert get_user_id() is None
        data = _payload(memberships)
        chart_api.ChartRestApi._append_archived_dashboards(
            data, frozenset({"id", "dashboard_title"})
        )
        assert _archived_titles(data) == [[], []]
        assert all("archived" not in d for r in data["result"] for d in r["dashboards"])
        # Accidental path: drop the explicit deny and confirm it still fails closed.
        from superset.extensions import security_manager as sm

        with patch.object(
            type(sm._get_current_object()), "is_guest_user", lambda *_a, **_k: False
        ):
            data2 = _payload(memberships)
            chart_api.ChartRestApi._append_archived_dashboards(
                data2, frozenset({"id", "dashboard_title"})
            )
        assert _archived_titles(data2) == [[], []]
    finally:
        g.user = prev


def _user(uid: int) -> User:
    """Build an authenticated principal for an isolated API request."""
    from flask_appbuilder.security.sqla.models import User

    user = User()
    user.id, user.username, user.active = uid, f"u{uid}", True
    return user


def _get(client: FlaskClient, principal: Any, q: dict[str, Any]) -> Response:
    """Run chart-list GET with a principal scoped to this request."""
    import prison
    from flask import g

    for attr in ("_login_user", "user"):
        g.pop(attr, None)
    g._login_user = principal
    try:
        return client.get("/api/v1/chart/", query_string={"q": prison.dumps(q)})
    finally:
        for attr in ("_login_user", "user"):
            g.pop(attr, None)


INCLUDE = [{"col": "id", "opr": "chart_deleted_state", "value": "include"}]
USAGE_COLS = ["slice_name", "dashboards.id", "dashboards.dashboard_title"]


def _titles(resp: Any) -> dict[str, list[str] | None]:
    """Extract archived memberships keyed by chart name."""
    return {
        row["slice_name"]: (
            None
            if "dashboards" not in row
            else [
                d.get("dashboard_title", d.get("id"))
                for d in row["dashboards"]
                if d.get("archived")
            ]
        )
        for row in resp.json["result"]
    }


@pytest.fixture
def http(
    client: FlaskClient,
    full_api_access: None,
    mocker: MockerFixture,
    session: Session,
    memberships: dict[str, int],
) -> FlaskClient:
    """Use real chart-list routing, serialization and queries on isolated data."""
    from superset.charts.api import ChartRestApi
    from superset.extensions import security_manager as sm

    mocker.patch.object(ChartRestApi.datamodel, "_session", session)
    mocker.patch.object(sm, "can_access_all_datasources", return_value=True)
    return client


def _admin(mocker: MockerFixture) -> User:
    """Grant the administrator branch for the supplied principal."""
    from superset.extensions import security_manager as sm

    mocker.patch.object(type(sm._get_current_object()), "is_admin", return_value=True)
    return _user(1)


@with_feature_flags(SOFT_DELETE=True)
def test_http_admin_usage_shape(
    http: FlaskClient,
    mocker: MockerFixture,
    memberships: dict[str, int],
    session: Session,
) -> None:
    """Http admin usage shape."""
    from flask import g

    from superset.constants import SKIP_VISIBILITY_FILTER_CLASSES
    from superset.models.dashboard import Dashboard

    resp = _get(
        http,
        _admin(mocker),
        {
            "columns": USAGE_COLS,
            "filters": INCLUDE,
            "include_archived_dashboards": True,
        },
    )
    assert resp.status_code == 200, resp.json
    assert resp.json["count"] == 2
    assert _titles(resp) == {
        "live_c": ["a_arch_viewed", "b_arch_ed"],
        "arch_c": ["a_arch_viewed", "b_arch_ed", "c_arch_orphan", "d_arch_only"],
    }
    for row in resp.json["result"]:
        live = [d for d in row["dashboards"] if not d["archived"]]
        assert live == [
            {
                "id": memberships["d_live"],
                "dashboard_title": "d_live",
                "archived": False,
            }
        ]
        assert all("url" not in d for d in row["dashboards"])
    # cleanup before teardown
    assert Dashboard not in session.info.get(SKIP_VISIBILITY_FILTER_CLASSES, set())
    assert not getattr(g, "_augment_response_with_deleted_at", False)
    assert not getattr(g, "_deleted_state_added_classes", set())
    assert {d.dashboard_title for d in session.query(Dashboard).all()} == {"d_live"}


@pytest.mark.parametrize(
    "uid,expected",
    [
        # dashboard editor (also edits arch_c): sees its archived dashboards,
        # including d_arch_only whose only chart is archived
        (
            DASH_EDITOR,
            {
                "live_c": ["a_arch_viewed", "b_arch_ed"],
                "arch_c": ["a_arch_viewed", "b_arch_ed", "d_arch_only"],
            },
        ),
        # chart editor, not a dashboard editor: sees arch_c, but no archived
        # dashboards -- incl. c_arch_orphan (published, viewer-less, all charts
        # archived) which DashboardAccessFilter alone admits (the no-charts fallback)
        (CHART_EDITOR, {"live_c": [], "arch_c": []}),
        # non-editor viewer of a_arch_viewed: archived chart hidden, nothing
        (GAMMA, {"live_c": []}),
    ],
    ids=["dash-editor", "chart-editor", "gamma"],
)
@with_feature_flags(SOFT_DELETE=True)
def test_http_audiences(http: FlaskClient, uid: int, expected: Any) -> None:
    """Http audiences."""
    resp = _get(
        http,
        _user(uid),
        {
            "columns": USAGE_COLS,
            "filters": INCLUDE,
            "include_archived_dashboards": True,
        },
    )
    assert resp.status_code == 200, resp.json
    assert _titles(resp) == expected


@with_feature_flags(SOFT_DELETE=True, EMBEDDED_SUPERSET=True)
def test_http_real_guest(
    http: FlaskClient, session: Session, memberships: dict[str, int]
) -> None:
    """Http real guest."""
    from superset import db
    from superset.models.embedded_dashboard import EmbeddedDashboard
    from superset.security.guest_token import GuestTokenResourceType, GuestUser

    embedded = EmbeddedDashboard(dashboard_id=memberships["d_live"])
    db.session.add(embedded)
    db.session.flush()
    guest = GuestUser(
        token={
            "iat": 0,
            "exp": 9999999999,
            "rls_rules": [],
            "user": {},
            "resources": [
                {"type": GuestTokenResourceType.DASHBOARD, "id": str(embedded.uuid)},
                {"type": GuestTokenResourceType.DASHBOARD, "id": str(memberships["b"])},
            ],
        },
        roles=[],
    )
    resp = _get(
        http,
        guest,
        {
            "columns": USAGE_COLS,
            "filters": INCLUDE,
            "include_archived_dashboards": True,
        },
    )
    assert resp.status_code == 200, resp.json
    assert [r["slice_name"] for r in resp.json["result"]] == ["live_c"]
    (row,) = resp.json["result"]
    # guard skips the whole expansion: no archived entries, no annotation
    assert row["dashboards"] == [
        {"id": memberships["d_live"], "dashboard_title": "d_live"}
    ]


@pytest.mark.parametrize(
    "q,expected",
    [
        ({"columns": ["slice_name", "dashboards.id"]}, {"id", "archived"}),
        (
            {"columns": ["slice_name", "dashboards.dashboard_title"]},
            {"dashboard_title", "archived"},
        ),
        # select_columns narrower than Slice's load needs 500s on master too
        # (NoSuchColumnError slices.datasource_type), so keep the datasource
        # identity columns in the selection.
        (
            {
                "select_columns": [
                    "slice_name",
                    "datasource_id",
                    "datasource_type",
                    "dashboards.id",
                ]
            },
            {"id", "archived"},
        ),
        ({"columns": ["slice_name"]}, None),
        ({"columns": ["slice_name", "dashboards.url"]}, None),
        # FAB fallback: empty/all-invalid selection -> default list schema
        ({"columns": []}, {"id", "dashboard_title", "archived"}),
        ({"columns": ["bogus"]}, {"id", "dashboard_title", "archived"}),
        ({}, {"id", "dashboard_title", "archived"}),
    ],
    ids=[
        "id-only",
        "title-only",
        "select-id-only",
        "chart-only",
        "url-only",
        "empty",
        "all-invalid",
        "omitted",
    ],
)
@with_feature_flags(SOFT_DELETE=True)
def test_http_field_selection(
    http: FlaskClient, mocker: MockerFixture, q: dict[str, Any], expected: Any
) -> None:
    """Http field selection."""
    resp = _get(
        http,
        _admin(mocker),
        {**q, "filters": INCLUDE, "include_archived_dashboards": True},
    )
    assert resp.status_code == 200, resp.json
    rows = {r["slice_name"]: r for r in resp.json["result"]}
    if expected is None:
        assert all("dashboards" not in r for r in rows.values()), rows
        return
    for row in rows.values():
        assert {frozenset(d) for d in row["dashboards"]} == {frozenset(expected)}
    assert sum(d["archived"] for d in rows["arch_c"]["dashboards"]) == 4


@with_feature_flags(SOFT_DELETE=True)
def test_http_both_selections_400(http: FlaskClient, mocker: MockerFixture) -> None:
    """Http both selections 400."""
    resp = _get(
        http,
        _admin(mocker),
        {
            "columns": ["slice_name"],
            "select_columns": ["slice_name"],
            "include_archived_dashboards": True,
        },
    )
    assert resp.status_code == 400


@pytest.mark.parametrize("bad", ["true", 1, None, []])
@with_feature_flags(SOFT_DELETE=True)
def test_http_invalid_option_types_400(
    http: FlaskClient, mocker: MockerFixture, bad: Any
) -> None:
    """Http invalid option types 400."""
    resp = _get(http, _admin(mocker), {"include_archived_dashboards": bad})
    assert resp.status_code == 400, resp.json


@with_feature_flags(SOFT_DELETE=True)
def test_http_option_omitted_is_false(http: FlaskClient, mocker: MockerFixture) -> None:
    """Http option omitted is false."""
    resp = _get(http, _admin(mocker), {"columns": USAGE_COLS, "filters": INCLUDE})
    assert resp.status_code == 200
    assert all(
        "archived" not in d for r in resp.json["result"] for d in r["dashboards"]
    )


@with_feature_flags(SOFT_DELETE=False)
def test_http_flag_off_direct_opt_in(
    http: FlaskClient, mocker: MockerFixture, memberships: dict[str, int]
) -> None:
    """Http flag off direct opt in."""
    resp = _get(
        http,
        _admin(mocker),
        {
            "columns": USAGE_COLS,
            "filters": INCLUDE,
            "include_archived_dashboards": True,
        },
    )
    assert resp.status_code == 200, resp.json
    for row in resp.json["result"]:
        ids = [d["id"] for d in row["dashboards"]]
        assert len(ids) == len(set(ids))  # leftover archived listed once
        assert all("archived" not in d for d in row["dashboards"])


@with_feature_flags(SOFT_DELETE=True)
def test_http_extra_access_exclusion_withholds_archived_dashboard(
    http: FlaskClient,
    mocker: MockerFixture,
    memberships: dict[str, int],
) -> None:
    """The only result-visible contribution of DashboardAccessFilter here:
    an operator exclusion hook withholds an archived dashboard, even from an
    admin. The hook's own Dashboard query is inside the statement, so the
    statement-level skip keeps it from being emptied by archive criteria."""
    from flask import current_app

    from superset import db
    from superset.models.dashboard import Dashboard

    def hook(user_id: Any) -> Any:
        """Hook."""
        return db.session.query(Dashboard.id).filter(Dashboard.id == memberships["b"])

    mocker.patch.dict(
        current_app.config, {"EXTRA_ACCESS_QUERY_EXCLUSIONS": {"dashboards": hook}}
    )
    resp = _get(
        http,
        _admin(mocker),
        {
            "columns": USAGE_COLS,
            "filters": INCLUDE,
            "include_archived_dashboards": True,
        },
    )
    assert resp.status_code == 200, resp.json
    assert _titles(resp) == {
        "live_c": ["a_arch_viewed"],
        "arch_c": ["a_arch_viewed", "c_arch_orphan", "d_arch_only"],
    }


@with_feature_flags(SOFT_DELETE=True)
def test_mixed_rows_preserve_result_id_pairing(memberships: dict[str, int]) -> None:
    """Skipping a row without dashboards must not shift the next chart's id."""
    data = _payload(memberships)
    del data["result"][0]["dashboards"]
    with _Principal(admin=True):
        _expand_dashboard_memberships(data)
    assert "dashboards" not in data["result"][0]
    assert [
        dashboard["dashboard_title"]
        for dashboard in data["result"][1]["dashboards"]
        if dashboard["archived"]
    ] == ["a_arch_viewed", "b_arch_ed", "c_arch_orphan", "d_arch_only"]


@with_feature_flags(SOFT_DELETE=True)
def test_preloaded_relationship_does_not_hide_archived_membership(
    memberships: dict[str, int], session: Session
) -> None:
    """Projection ignores cached live-only relationships and loads no entities."""
    from superset.charts.api import ChartRestApi
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

    chart = session.query(Slice).filter_by(id=memberships["live_c"]).one()
    assert [dashboard.id for dashboard in chart.dashboards] == [memberships["d_live"]]
    before = set(session.identity_map)
    data = _payload(memberships)
    # Empty nested data must not be used to infer requested fields.
    data["result"][0]["dashboards"] = []
    with _Principal(admin=True):
        ChartRestApi._append_archived_dashboards(data, frozenset({"id"}))
    assert data["result"][0]["dashboards"] == [
        {"id": memberships["a"], "archived": True},
        {"id": memberships["b"], "archived": True},
    ]
    assert set(session.identity_map) == before
    assert [dashboard.id for dashboard in chart.dashboards] == [memberships["d_live"]]
    assert all(
        dashboard.deleted_at is None
        for dashboard in session.identity_map.values()
        if isinstance(dashboard, Dashboard)
    )


@pytest.mark.parametrize("fields", [None, frozenset()])
@with_feature_flags(SOFT_DELETE=True)
def test_disabled_expansion_does_not_query(
    memberships: dict[str, int], mocker: MockerFixture, fields: frozenset[str] | None
) -> None:
    """No opt-in or no nested fields leaves data untouched without a query."""
    from superset.charts import api as chart_api

    data = _payload(memberships)
    expected = copy.deepcopy(data)
    query = mocker.patch("superset.charts.api.db.session.query")
    token = chart_api._include_archived_dashboards.set(fields)
    try:
        object.__new__(chart_api.ChartRestApi).pre_get_list(data)
    finally:
        chart_api._include_archived_dashboards.reset(token)
    query.assert_not_called()
    assert data == expected


@pytest.mark.parametrize("viz_path", [False, True])
@pytest.mark.parametrize("opt", [False, True])
def test_success_restores_context_before_next_call(
    viz_path: bool, opt: bool, mocker: MockerFixture
) -> None:
    """Successful requests restore caller contexts on both sorting paths."""
    from superset.charts import api as chart_api
    from superset.views.base_api import BaseSupersetModelRestApi

    observed: list[frozenset[str] | None] = []

    def respond(self: Any, **kwargs: Any) -> Response:
        """Capture request state at the serialization boundary."""
        observed.append(chart_api._include_archived_dashboards.get())
        return Response("{}")

    mocker.patch.object(BaseSupersetModelRestApi, "get_list_headless", respond)
    api = object.__new__(chart_api.ChartRestApi)
    outer_value = frozenset({"caller"})
    outer = chart_api._include_archived_dashboards.set(outer_value)
    rison: dict[str, Any] = {"include_archived_dashboards": opt}
    if viz_path:
        rison.update(order_column="viz_type", viz_type_order=["table"])
    try:
        api.get_list_headless(rison=rison)
        assert chart_api._include_archived_dashboards.get() == outer_value
        assert chart_api._viz_type_order.get() is None
        api.get_list_headless(rison={})
        assert observed == [frozenset({"id", "dashboard_title"}) if opt else None, None]
        assert chart_api._include_archived_dashboards.get() == outer_value
    finally:
        chart_api._include_archived_dashboards.reset(outer)


@pytest.mark.parametrize("order_column", ["slice_name", "changed_on_delta_humanized"])
@pytest.mark.parametrize("order_direction", ["asc", "desc"])
@with_feature_flags(SOFT_DELETE=True)
def test_http_pagination_and_sort_are_unchanged(
    http: FlaskClient,
    mocker: MockerFixture,
    order_column: str,
    order_direction: str,
) -> None:
    """Expanding many dashboard memberships preserves chart order and count."""
    principal = _admin(mocker)
    query = {
        "columns": USAGE_COLS,
        "filters": INCLUDE,
        "order_column": order_column,
        "order_direction": order_direction,
    }
    baseline = _get(http, principal, query)
    assert baseline.status_code == 200
    pages = [
        _get(
            http,
            principal,
            {
                **query,
                "page": page,
                "page_size": 1,
                "include_archived_dashboards": True,
            },
        )
        for page in range(2)
    ]
    assert all(response.status_code == 200 for response in pages)
    assert all(
        response.json["count"] == baseline.json["count"] == 2 for response in pages
    )
    assert [response.json["ids"][0] for response in pages] == baseline.json["ids"]


@with_feature_flags(SOFT_DELETE=True)
def test_http_dataset_owner_cannot_enumerate_other_editors_archives(
    http: FlaskClient, memberships: dict[str, int], session: Session
) -> None:
    """Dataset ownership does not grant chart or dashboard archive editorship."""
    from superset.connectors.sqla.models import SqlaTable
    from superset.subjects.models import Subject

    dataset = session.query(SqlaTable).one()
    dataset.editors = [session.query(Subject).filter_by(user_id=GAMMA).one()]
    session.flush()
    response = _get(
        http,
        _user(GAMMA),
        {
            "columns": USAGE_COLS,
            "filters": INCLUDE,
            "include_archived_dashboards": True,
        },
    )
    assert response.status_code == 200
    assert _titles(response) == {"live_c": []}


@with_feature_flags(SOFT_DELETE=True)
def test_projection_failure_occurs_after_chart_bypass_release(
    http: FlaskClient, mocker: MockerFixture, session: Session
) -> None:
    """Expansion failure preserves unrelated caller bypasses after list cleanup."""
    from flask import g

    from superset.charts import api as chart_api
    from superset.connectors.sqla.models import SqlaTable
    from superset.constants import SKIP_VISIBILITY_FILTER_CLASSES

    session.info[SKIP_VISIBILITY_FILTER_CLASSES] = {SqlaTable}

    def fail(*args: Any, **kwargs: Any) -> None:
        """Assert cleanup at the failure point, before HTTP request teardown."""
        assert session.info[SKIP_VISIBILITY_FILTER_CLASSES] == {SqlaTable}
        assert not getattr(g, "_augment_response_with_deleted_at", False)
        assert not getattr(g, "_deleted_state_added_classes", set())
        raise RuntimeError("projection failed")

    mocker.patch(
        "superset.charts.api.scope_query_to_restore_audience", side_effect=fail
    )
    response = _get(
        http,
        _admin(mocker),
        {
            "columns": USAGE_COLS,
            "filters": INCLUDE,
            "include_archived_dashboards": True,
        },
    )
    assert response.status_code == 500
    assert session.info[SKIP_VISIBILITY_FILTER_CLASSES] == {SqlaTable}
    assert chart_api._include_archived_dashboards.get() is None


def test_list_openapi_documents_optional_dashboard_archive_state() -> None:
    """Document expansion metadata without changing FAB's default list fields."""
    from superset.charts.api import ChartRestApi

    api = object.__new__(ChartRestApi)
    operations: dict[str, Any] = {}
    api.operation_helper(
        path="/api/v1/chart/",
        operations=operations,
        methods=["GET"],
        func=api.get_list,
    )
    response_schema = operations["get"]["responses"][200]["content"][
        "application/json"
    ]["schema"]
    default_row, expansion = response_schema["properties"]["result"]["items"]["allOf"]
    assert default_row == {"$ref": "#/components/schemas/ChartRestApi.get_list"}
    dashboard_schema = expansion["properties"]["dashboards"]["items"]
    assert dashboard_schema["properties"]["archived"]["type"] == "boolean"
    assert "archived" not in dashboard_schema.get("required", [])
    assert "dashboards" not in expansion.get("required", [])
    assert "dashboards.archived" not in api.list_columns


@with_feature_flags(SOFT_DELETE=True)
def test_chart_read_exposes_eligible_dashboard_metadata_without_dashboard_read(
    http: FlaskClient,
    mocker: MockerFixture,
    memberships: dict[str, int],
) -> None:
    """Chart relationship metadata does not grant Dashboard endpoint access."""
    from flask import g

    from superset import security_manager

    mocker.patch.object(security_manager, "is_item_public", return_value=False)
    access = mocker.patch.object(
        security_manager,
        "has_access",
        side_effect=lambda permission, resource: (
            permission == "can_read" and resource == "Chart"
        ),
    )
    user = _user(DASH_EDITOR)
    response = _get(
        http,
        user,
        {
            "columns": USAGE_COLS,
            "filters": INCLUDE,
            "include_archived_dashboards": True,
        },
    )
    assert response.status_code == 200
    live_chart = next(
        row for row in response.json["result"] if row["slice_name"] == "live_c"
    )
    assert live_chart["dashboards"] == [
        {
            "id": memberships["d_live"],
            "dashboard_title": "d_live",
            "archived": False,
        },
        {
            "id": memberships["a"],
            "dashboard_title": "a_arch_viewed",
            "archived": True,
        },
        {
            "id": memberships["b"],
            "dashboard_title": "b_arch_ed",
            "archived": True,
        },
    ]
    g._login_user = user
    try:
        dashboard_response = http.get("/api/v1/dashboard/")
    finally:
        for attr in ("_login_user", "user"):
            g.pop(attr, None)
    assert dashboard_response.status_code == 403
    access.assert_any_call("can_read", "Chart")
    access.assert_any_call("can_read", "Dashboard")
