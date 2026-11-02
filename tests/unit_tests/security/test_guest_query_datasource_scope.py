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
"""Embedded guests and SQL Lab ``query`` datasources.

An embedded guest token only grants the data sources reachable through the
embedded dashboards it authorizes. The SQL Lab query branch of
``raise_for_access`` must therefore not let a guest read a stored query (its
own or another user's) merely because the guest role happens to hold access to
the tables that query touches.
"""

from __future__ import annotations

from typing import Any, Optional, TYPE_CHECKING
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.common.db_query_status import QueryStatus
from superset.errors import SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.extensions import appbuilder
from superset.security.guest_token import (
    GuestToken,
    GuestTokenResourceType,
    GuestUser,
)
from superset.security.manager import SupersetSecurityManager
from superset.utils import json
from superset.utils.core import DatasourceType

if TYPE_CHECKING:
    from superset.app import SupersetApp

QUERY_ID = 1
DASHBOARD_ID = 10
SLICE_ID = 20
GUEST_DENIED = SupersetErrorType.QUERY_SECURITY_ACCESS_ERROR


def _guest_user(datasets: Optional[list[int]] = None) -> GuestUser:
    token: GuestToken = {
        "user": {},
        "resources": [
            {"type": GuestTokenResourceType.DASHBOARD, "id": str(DASHBOARD_ID)}
        ],
        "rls_rules": [],
        "iat": 0,
        "exp": 9999999999,
    }
    if datasets is not None:
        token["datasets"] = datasets
    return GuestUser(token=token, roles=[])


def _query(user_id: Optional[int]) -> MagicMock:
    """A persisted SQL Lab query over ``public.sales``."""
    database = MagicMock()
    database.get_default_catalog.return_value = None
    database.get_default_schema_for_query.return_value = "public"
    database.db_engine_spec.supports_catalog = True
    query = MagicMock()
    query.id = QUERY_ID
    query.type = DatasourceType.QUERY
    query.catalog = None
    query.schema = "public"
    query.database = database
    query.sql = "SELECT * FROM sales"
    query.executed_sql = None
    query.user_id = user_id
    query.status = QueryStatus.SUCCESS
    return query


def _security_manager(
    mocker: MockerFixture, guest: Optional[GuestUser]
) -> SupersetSecurityManager:
    """A security manager whose role grants access to the ``sales`` table."""
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "get_schema_perm", return_value="[db].[public]")
    mocker.patch.object(sm, "can_access", return_value=True)
    mocker.patch.object(sm, "is_guest_user", return_value=guest is not None)
    mocker.patch.object(sm, "get_current_guest_user_if_guest", return_value=guest)
    mocker.patch("superset.security.manager.get_user_id", return_value=None)
    return sm


def _bound_query_context(
    mocker: MockerFixture,
    sm: SupersetSecurityManager,
    query: MagicMock,
    *,
    modified: bool = False,
    guest_has_dashboard: bool = True,
    stored_chart: bool = True,
) -> MagicMock:
    """A query request naming a dataset-backed chart on an embedded dashboard."""
    slc = MagicMock()
    slc.id = SLICE_ID
    slc.datasource_id = QUERY_ID
    slc.datasource_type = DatasourceType.TABLE
    dashboard = MagicMock()
    dashboard.id = DASHBOARD_ID
    dashboard.slices = [slc]

    session = MagicMock()
    session.query.return_value.filter.return_value.one_or_none.return_value = dashboard
    mocker.patch.object(
        SupersetSecurityManager, "session", new_callable=mocker.PropertyMock
    ).return_value = session
    mocker.patch.object(sm, "has_guest_access", return_value=guest_has_dashboard)
    mocker.patch(
        "superset.security.manager.query_context_modified", return_value=modified
    )

    query_context = MagicMock()
    query_context.datasource = query
    query_context.slice_ = slc if stored_chart else None
    query_context.form_data = {"dashboardId": DASHBOARD_ID, "slice_id": SLICE_ID}
    return query_context


@pytest.mark.parametrize(
    "datasets",
    [pytest.param([3], id="scoped-token"), pytest.param(None, id="unscoped-token")],
)
@pytest.mark.parametrize(
    "owner_id",
    [pytest.param(None, id="guest-own-query"), pytest.param(99, id="other-user")],
)
def test_guest_cannot_read_query_datasource_outside_token_scope(
    mocker: MockerFixture,
    app_context: None,
    datasets: Optional[list[int]],
    owner_id: Optional[int],
) -> None:
    """A guest is refused a stored query even when the guest role can read
    the tables it touches, whatever the token scope and query author."""
    sm = _security_manager(mocker, _guest_user(datasets))
    with pytest.raises(SupersetSecurityException) as excinfo:
        sm.raise_for_access(query=_query(owner_id), allow_editorship=False)
    assert excinfo.value.error.error_type == GUEST_DENIED


def test_guest_refused_query_even_with_authorship_bypass(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """The Explore GET shape cannot grant query access to a guest author."""
    sm = _security_manager(mocker, _guest_user())
    query = _query(None)
    with pytest.raises(SupersetSecurityException) as excinfo:
        sm.raise_for_access(
            query=query,
            datasource=query,
            allow_query_authorship_bypass=True,
            allow_editorship=False,
        )
    assert excinfo.value.error.error_type == GUEST_DENIED


@pytest.mark.parametrize(
    "kwargs",
    [
        pytest.param({}, id="tag-query-defaults"),
        pytest.param(
            {"allow_query_authorship_bypass": True, "allow_editorship": False},
            id="explore-check-query-access",
        ),
        pytest.param({"force_dataset_match": True}, id="query-model"),
        pytest.param(
            {"force_dataset_match": True, "template_params": {"value": 1}},
            id="sql-lab-validator",
        ),
    ],
)
def test_guest_refused_query_call_shapes(
    mocker: MockerFixture,
    app_context: None,
    kwargs: dict[str, Any],
) -> None:
    """Explore, query-model and SQL Lab validator flags cannot exempt guests."""
    sm = _security_manager(mocker, _guest_user())
    with pytest.raises(SupersetSecurityException) as excinfo:
        sm.raise_for_access(query=_query(None), **kwargs)
    assert excinfo.value.error.error_type == GUEST_DENIED


def test_guest_cannot_read_query_datasource_with_unbound_query_context(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """A chart-data request that is not tied to a chart on an embedded
    dashboard does not authorize a query datasource for a guest."""
    sm = _security_manager(mocker, _guest_user())
    query = _query(99)
    query_context = MagicMock()
    query_context.datasource = query
    query_context.slice_ = None
    query_context.form_data = {}
    mocker.patch("superset.security.manager.query_context_modified", return_value=False)
    with pytest.raises(SupersetSecurityException) as excinfo:
        sm.raise_for_access(
            query=query, query_context=query_context, allow_editorship=False
        )
    assert excinfo.value.error.error_type == GUEST_DENIED


def test_guest_cannot_run_ad_hoc_sql(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """A guest token carries no SQL execution capability."""
    sm = _security_manager(mocker, _guest_user())
    database = _query(None).database
    with pytest.raises(SupersetSecurityException) as excinfo:
        sm.raise_for_access(database=database, sql="SELECT * FROM sales")
    assert excinfo.value.error.error_type == GUEST_DENIED


def test_guest_cannot_read_query_despite_authorized_dashboard_chart_payload(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """Naming an authorized dashboard's chart never grants query access."""
    sm = _security_manager(mocker, _guest_user())
    query = _query(99)
    query_context = _bound_query_context(mocker, sm, query)
    with pytest.raises(SupersetSecurityException) as excinfo:
        sm.raise_for_access(
            query=query, query_context=query_context, allow_editorship=False
        )
    assert excinfo.value.error.error_type == GUEST_DENIED


def test_guest_bound_query_refused_without_table_access(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """Guests are refused queries before table-level permission checks."""
    sm = _security_manager(mocker, _guest_user())
    mocker.patch.object(sm, "can_access", return_value=False)
    sales = MagicMock()
    sales.perm = "[db].[sales](id:3)"
    mocker.patch(
        "superset.connectors.sqla.models.SqlaTable.query_datasources_by_name",
        return_value=[sales],
    )
    query = _query(99)
    query_context = _bound_query_context(mocker, sm, query)
    with pytest.raises(SupersetSecurityException) as excinfo:
        sm.raise_for_access(
            query=query, query_context=query_context, allow_editorship=False
        )
    assert excinfo.value.error.error_type == GUEST_DENIED


@pytest.mark.parametrize(
    "kwargs, datasets",
    [
        pytest.param({}, [3], id="datasets-claim"),
        pytest.param({"modified": True}, None, id="modified-payload"),
        pytest.param({"guest_has_dashboard": False}, None, id="dashboard-not-granted"),
        pytest.param({"stored_chart": False}, None, id="no-stored-chart"),
    ],
)
def test_guest_bound_query_refused_outside_token_scope(
    mocker: MockerFixture,
    app_context: None,
    kwargs: dict[str, Any],
    datasets: Optional[list[int]],
) -> None:
    """Token claims, chart payloads and dashboard membership cannot grant queries."""
    sm = _security_manager(mocker, _guest_user(datasets))
    query = _query(99)
    query_context = _bound_query_context(mocker, sm, query, **kwargs)
    with pytest.raises(SupersetSecurityException) as excinfo:
        sm.raise_for_access(
            query=query, query_context=query_context, allow_editorship=False
        )
    assert excinfo.value.error.error_type == GUEST_DENIED


def test_non_guest_query_access_unchanged(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """Positive control: a regular user with access to the query's tables keeps
    reading a stored query, and the author keeps the explore bypass."""
    sm = _security_manager(mocker, None)
    sm.raise_for_access(query=_query(99), allow_editorship=False)

    mocker.patch.object(sm, "can_access", return_value=False)
    mocker.patch(
        "superset.connectors.sqla.models.SqlaTable.query_datasources_by_name",
        return_value=[],
    )
    mocker.patch("superset.security.manager.get_user_id", return_value=7)
    sm.raise_for_access(query=_query(7), allow_query_authorship_bypass=True)
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query=_query(7))


def test_chart_data_checks_query_datasource_access(
    mocker: MockerFixture,
) -> None:
    """The chart-data processor checks query access without chart binding."""
    from superset.common.query_context_processor import QueryContextProcessor

    raise_for_access = mocker.patch(
        "superset.common.query_context_processor.security_manager.raise_for_access"
    )
    query_context = MagicMock()
    query_context.datasource.type = DatasourceType.QUERY
    query_context.queries = []
    QueryContextProcessor(query_context).raise_for_access()
    raise_for_access.assert_called_once_with(
        query=query_context.datasource,
        allow_editorship=False,
    )


@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"EMBEDDED_SUPERSET": True}}], indirect=True
)
@pytest.mark.parametrize(
    "datasets, bound_chart, expected_status",
    [
        pytest.param(None, False, 403, id="unbound-query"),
        pytest.param([QUERY_ID], False, 403, id="dataset-claim-is-not-query-access"),
        pytest.param(None, True, 403, id="chart-on-authorized-dashboard"),
        pytest.param([QUERY_ID], True, 403, id="bound-query-with-dataset-claim"),
    ],
)
def test_chart_data_api_scopes_guest_query_datasource(
    mocker: MockerFixture,
    app: "SupersetApp",
    datasets: Optional[list[int]],
    bound_chart: bool,
    expected_status: int,
) -> None:
    """HTTP chart-data refuses queries even when an authorized chart is named."""
    from superset import security_manager
    from superset.models.slice import Slice

    guest = _guest_user(datasets)
    load_guest = mocker.patch.object(
        security_manager, "get_guest_user_from_request", return_value=guest
    )
    # Give the guest both the route permission and access to the query's tables;
    # neither grant authorizes a query datasource for an embedded guest.
    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch.object(security_manager, "can_access_database", return_value=False)
    mocker.patch.object(
        security_manager, "get_schema_perm", return_value="[db].[public]"
    )
    mocker.patch.object(security_manager, "has_access", return_value=True)
    mocker.patch.object(security_manager, "is_item_public", return_value=False)
    get_datasource = mocker.patch(
        "superset.common.query_context_factory.DatasourceDAO.get_datasource",
        return_value=_query(99),
    )
    # Stop before execution if authorization erroneously succeeds. The response
    # then becomes 200, so this test cannot pass on an unrelated execution error.
    get_data = mocker.patch(
        "superset.charts.data.api.ChartDataRestApi._get_data_response",
        return_value=app.response_class("{}", status=200, mimetype="application/json"),
    )
    mocker.patch(
        "superset.charts.data.api.ChartDataRestApi._should_run_async",
        return_value=False,
    )

    payload = {
        "datasource": {"id": QUERY_ID, "type": "query"},
        "queries": [{"columns": ["sales"], "metrics": [], "row_limit": 10}],
        "form_data": {},
        "result_type": "full",
        "result_format": "json",
    }
    if bound_chart:
        payload["form_data"] = {"slice_id": SLICE_ID, "dashboardId": DASHBOARD_ID}
        chart = Slice(
            id=SLICE_ID,
            datasource_id=QUERY_ID,
            datasource_type=DatasourceType.TABLE,
            params="{}",
            query_context=json.dumps(
                {**payload, "datasource": {"id": QUERY_ID, "type": "table"}}
            ),
        )
        mocker.patch(
            "superset.common.query_context_factory.ChartDAO.find_by_id",
            return_value=chart,
        )
        dashboard = MagicMock(id=DASHBOARD_ID, slices=[chart], embedded=[MagicMock()])
        session = MagicMock()
        session.query.return_value.filter.return_value.one_or_none.return_value = (
            dashboard
        )
        mocker.patch.object(
            SupersetSecurityManager, "session", new_callable=mocker.PropertyMock
        ).return_value = session

    with app.test_client() as client:
        response = client.post(
            "/api/v1/chart/data",
            headers={app.config["GUEST_TOKEN_HEADER_NAME"]: "test-guest-token"},
            json=payload,
        )

    assert response.status_code == expected_status, response.get_data(as_text=True)
    load_guest.assert_called_once()
    get_datasource.assert_called_once_with(
        datasource_type=DatasourceType.QUERY, database_id_or_uuid=QUERY_ID
    )
    assert response.json == {"message": "Forbidden"}
    get_data.assert_not_called()


@pytest.mark.parametrize("via", ["datasource", "query_context"])
def test_guest_cannot_read_query_passed_as_datasource(
    mocker: MockerFixture,
    app_context: None,
    via: str,
) -> None:
    """A query handed over as a ``datasource`` (or as a query context's
    datasource) is refused like one passed as ``query``, before the generic
    schema and ``datasource_access`` checks can authorize it."""
    sm = _security_manager(mocker, _guest_user())
    mocker.patch.object(sm, "can_access_schema", return_value=True)
    query = _query(99)
    if via == "datasource":
        kwargs: dict[str, Any] = {"datasource": query}
    else:
        query_context = MagicMock()
        query_context.datasource = query
        query_context.form_data = {}
        mocker.patch(
            "superset.security.manager.query_context_modified", return_value=False
        )
        kwargs = {"query_context": query_context}
    with pytest.raises(SupersetSecurityException) as excinfo:
        sm.raise_for_access(**kwargs)
    assert excinfo.value.error.error_type == GUEST_DENIED


def test_non_guest_query_passed_as_datasource_unchanged(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """Positive control: a regular user with schema access keeps reading a
    query handed over as a ``datasource``."""
    sm = _security_manager(mocker, None)
    mocker.patch.object(sm, "can_access_schema", return_value=True)
    sm.raise_for_access(datasource=_query(99))


@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"EMBEDDED_SUPERSET": True}}], indirect=True
)
@pytest.mark.parametrize(
    "path",
    [
        pytest.param(f"/datasource/get/query/{QUERY_ID}/", id="get"),
        pytest.param(
            f"/datasource/external_metadata/query/{QUERY_ID}/", id="external-metadata"
        ),
    ],
)
def test_legacy_datasource_views_refuse_guest_query(
    mocker: MockerFixture,
    app: "SupersetApp",
    path: str,
) -> None:
    """The legacy datasource views resolve ``query`` datasources and check them
    as a ``datasource``; a guest with schema access must still get a 403 and
    never the stored SQL."""
    from superset import security_manager

    mocker.patch.object(
        security_manager, "get_guest_user_from_request", return_value=_guest_user()
    )
    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch.object(security_manager, "can_access_schema", return_value=True)
    mocker.patch.object(security_manager, "can_access_database", return_value=False)
    mocker.patch.object(security_manager, "has_access", return_value=True)
    mocker.patch.object(security_manager, "is_item_public", return_value=False)
    query = _query(99)
    query.data = {"id": QUERY_ID, "type": "query", "sql": query.sql}
    query.external_metadata.return_value = [{"name": "sales", "type": "INT"}]
    get_datasource = mocker.patch(
        "superset.views.datasource.views.DatasourceDAO.get_datasource",
        return_value=query,
    )

    with app.test_client() as client:
        response = client.get(
            path, headers={app.config["GUEST_TOKEN_HEADER_NAME"]: "test-guest-token"}
        )

    body = response.get_data(as_text=True)
    assert response.status_code == 403, body
    assert "SELECT" not in body
    get_datasource.assert_called_once_with(DatasourceType.QUERY, str(QUERY_ID))
    query.external_metadata.assert_not_called()


@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"EMBEDDED_SUPERSET": True}}], indirect=True
)
@pytest.mark.parametrize(
    "datasource_type", [DatasourceType.QUERY, DatasourceType.TABLE]
)
def test_form_data_refuses_guest_query_like_denied_dataset(
    mocker: MockerFixture,
    app: "SupersetApp",
    datasource_type: DatasourceType,
) -> None:
    """Form-data creation returns 403, not 500, for an unauthorized source."""
    from superset import security_manager

    mocker.patch.object(
        security_manager, "get_guest_user_from_request", return_value=_guest_user()
    )
    mocker.patch.object(security_manager, "has_access", return_value=True)
    mocker.patch.object(security_manager, "is_item_public", return_value=False)
    mocker.patch.object(security_manager, "can_access_datasource", return_value=False)
    query = _query(None)
    mocker.patch("superset.explore.utils.QueryDAO.find_by_id", return_value=query)
    mocker.patch(
        "superset.explore.utils.DatasetDAO.find_by_id", return_value=MagicMock()
    )
    cache_set = mocker.patch(
        "superset.commands.explore.form_data.create.cache_manager.explore_form_data_cache.set"
    )

    with app.test_client() as client:
        response = client.post(
            "/api/v1/explore/form_data",
            headers={app.config["GUEST_TOKEN_HEADER_NAME"]: "test-guest-token"},
            json={
                "datasource_id": QUERY_ID,
                "datasource_type": datasource_type,
                "form_data": json.dumps(
                    {"datasource": f"{QUERY_ID}__{datasource_type}"}
                ),
            },
        )

    assert response.status_code == 403, response.get_data(as_text=True)
    cache_set.assert_not_called()


@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"EMBEDDED_SUPERSET": True}}], indirect=True
)
def test_form_data_gamma_with_table_access_still_creates_query_state(
    mocker: MockerFixture,
    app: "SupersetApp",
) -> None:
    """A Gamma user with access to the query's tables keeps the 201 path."""
    from flask_appbuilder.security.sqla.models import Role, User

    from superset import security_manager

    gamma = User(id=7, username="gamma", roles=[Role(name="Gamma")])
    mocker.patch.object(app.login_manager, "_user_callback", return_value=gamma)
    mocker.patch.object(security_manager, "has_access", return_value=True)
    mocker.patch.object(security_manager, "can_access_database", return_value=False)
    mocker.patch.object(security_manager, "can_access", return_value=True)
    mocker.patch.object(
        security_manager, "get_schema_perm", return_value="[db].[public]"
    )
    mocker.patch("superset.security.manager.get_user_id", return_value=7)
    mocker.patch("superset.explore.utils.QueryDAO.find_by_id", return_value=_query(99))
    mocker.patch(
        "superset.commands.explore.form_data.create.cache_manager.explore_form_data_cache.get",
        return_value=None,
    )
    cache_set = mocker.patch(
        "superset.commands.explore.form_data.create.cache_manager.explore_form_data_cache.set"
    )

    with app.test_client() as client:
        with client.session_transaction() as session:
            session["_user_id"] = "7"
            session["_fresh"] = True
        response = client.post(
            "/api/v1/explore/form_data",
            json={
                "datasource_id": QUERY_ID,
                "datasource_type": "query",
                "form_data": json.dumps({"datasource": f"{QUERY_ID}__query"}),
            },
        )

    assert response.status_code == 201, response.get_data(as_text=True)
    assert cache_set.call_count == 2


def test_can_access_datasource_refuses_guest_query(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """The boolean datasource wrapper translates the guest refusal to False."""
    sm = _security_manager(mocker, _guest_user())
    assert not sm.can_access_datasource(_query(None))


@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"EMBEDDED_SUPERSET": True}}], indirect=True
)
@pytest.mark.parametrize("method", ["POST", "GET"])
@pytest.mark.parametrize(
    "datasource_type", [DatasourceType.QUERY, DatasourceType.TABLE]
)
def test_permalink_refuses_guest_query_like_denied_dataset(
    mocker: MockerFixture,
    app: "SupersetApp",
    method: str,
    datasource_type: DatasourceType,
) -> None:
    """Both permalink routes refuse guests without storing or returning state."""
    from superset import security_manager

    mocker.patch.object(
        security_manager, "get_guest_user_from_request", return_value=_guest_user()
    )
    mocker.patch.object(security_manager, "has_access", return_value=True)
    mocker.patch.object(security_manager, "is_item_public", return_value=False)
    mocker.patch.object(security_manager, "can_access_datasource", return_value=False)
    mocker.patch(
        "superset.explore.utils.QueryDAO.find_by_id", return_value=_query(None)
    )
    mocker.patch(
        "superset.explore.utils.DatasetDAO.find_by_id", return_value=MagicMock()
    )
    state = {"formData": {"datasource": f"{QUERY_ID}__{datasource_type}"}}
    create_entry = mocker.patch("superset.daos.key_value.KeyValueDAO.create_entry")
    mocker.patch(
        "superset.commands.explore.permalink.get.decode_permalink_id", return_value=1
    )
    mocker.patch(
        "superset.commands.explore.permalink.base.get_permalink_salt",
        return_value="test-salt",
    )
    mocker.patch(
        "superset.daos.key_value.KeyValueDAO.get_value",
        return_value={
            "datasourceId": QUERY_ID,
            "datasourceType": datasource_type,
            "state": state,
        },
    )

    with app.test_client() as client:
        response = client.open(
            "/api/v1/explore/permalink" + ("/test-key" if method == "GET" else ""),
            method=method,
            headers={app.config["GUEST_TOKEN_HEADER_NAME"]: "test-guest-token"},
            json=state if method == "POST" else None,
        )

    assert response.status_code == 403, response.get_data(as_text=True)
    assert "state" not in response.json
    create_entry.assert_not_called()


@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"EMBEDDED_SUPERSET": True}}], indirect=True
)
def test_permalink_gamma_with_table_access_still_reads_query_state(
    mocker: MockerFixture,
    app: "SupersetApp",
) -> None:
    """A Gamma user with table access keeps the POST 201 and GET 200 paths."""
    from flask_appbuilder.security.sqla.models import Role, User

    from superset import security_manager

    gamma = User(id=7, username="gamma", roles=[Role(name="Gamma")])
    mocker.patch.object(app.login_manager, "_user_callback", return_value=gamma)
    mocker.patch.object(security_manager, "has_access", return_value=True)
    mocker.patch.object(security_manager, "can_access_database", return_value=False)
    mocker.patch.object(
        security_manager,
        "can_access",
        side_effect=lambda permission, resource: (
            (permission, resource) == ("datasource_access", "sales-grant")
        ),
    )
    table_lookup = mocker.patch(
        "superset.connectors.sqla.models.SqlaTable.query_datasources_by_name",
        return_value=[MagicMock(perm="sales-grant")],
    )
    mocker.patch.object(
        security_manager, "get_schema_perm", return_value="[db].[public]"
    )
    mocker.patch("superset.security.manager.get_user_id", return_value=7)
    mocker.patch("superset.explore.utils.QueryDAO.find_by_id", return_value=_query(99))
    state = {"formData": {"datasource": f"{QUERY_ID}__query"}}
    create_entry = mocker.patch(
        "superset.daos.key_value.KeyValueDAO.create_entry", return_value=MagicMock(id=1)
    )
    mocker.patch("superset.commands.explore.permalink.create.db.session.flush")
    mocker.patch(
        "superset.commands.explore.permalink.create.encode_permalink_key",
        return_value="test-key",
    )
    mocker.patch(
        "superset.commands.explore.permalink.get.decode_permalink_id", return_value=1
    )
    mocker.patch(
        "superset.commands.explore.permalink.base.get_permalink_salt",
        return_value="test-salt",
    )
    mocker.patch(
        "superset.daos.key_value.KeyValueDAO.get_value",
        return_value={
            "datasourceId": QUERY_ID,
            "datasourceType": DatasourceType.QUERY,
            "state": state,
        },
    )

    with app.test_client() as client:
        with client.session_transaction() as session:
            session["_user_id"] = "7"
            session["_fresh"] = True
        response = client.post("/api/v1/explore/permalink", json=state)
        assert response.status_code == 201, response.get_data(as_text=True)
        assert response.json["key"] == "test-key"
        response = client.get("/api/v1/explore/permalink/test-key")

    assert response.status_code == 200, response.get_data(as_text=True)
    assert response.json["state"] == state
    create_entry.assert_called_once()
    assert table_lookup.call_count == 2
