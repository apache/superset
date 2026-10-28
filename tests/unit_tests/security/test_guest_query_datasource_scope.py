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
    slice_datasource_type: str = DatasourceType.QUERY,
    modified: bool = False,
    guest_has_dashboard: bool = True,
    stored_chart: bool = True,
) -> MagicMock:
    """A chart-data request for a query-backed chart on an embedded dashboard."""
    slc = MagicMock()
    slc.id = SLICE_ID
    slc.datasource_id = QUERY_ID
    slc.datasource_type = slice_datasource_type
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


def test_guest_reads_query_backed_chart_on_authorized_dashboard(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """A query-backed chart on an embedded dashboard the token authorizes is
    reachable, subject to the usual table-level checks."""
    sm = _security_manager(mocker, _guest_user())
    query = _query(99)
    query_context = _bound_query_context(mocker, sm, query)
    sm.raise_for_access(
        query=query, query_context=query_context, allow_editorship=False
    )


def test_guest_bound_query_still_needs_table_access(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """The dashboard binding does not replace the table-level checks."""
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
    assert (
        excinfo.value.error.error_type == SupersetErrorType.TABLE_SECURITY_ACCESS_ERROR
    )


@pytest.mark.parametrize(
    "kwargs, datasets",
    [
        pytest.param({}, [3], id="datasets-claim"),
        pytest.param({"modified": True}, None, id="modified-payload"),
        pytest.param({"guest_has_dashboard": False}, None, id="dashboard-not-granted"),
        pytest.param({"stored_chart": False}, None, id="no-stored-chart"),
        pytest.param(
            {"slice_datasource_type": DatasourceType.TABLE},
            None,
            id="chart-on-other-datasource",
        ),
    ],
)
def test_guest_bound_query_refused_outside_token_scope(
    mocker: MockerFixture,
    app_context: None,
    kwargs: dict[str, Any],
    datasets: Optional[list[int]],
) -> None:
    """The dashboard binding only holds when the token authorizes that
    dashboard, the chart reads this exact query, the payload is the saved one,
    and the token carries no dataset allowlist (which names SQL datasets only).
    """
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


def test_chart_data_passes_query_context_for_query_datasource(
    mocker: MockerFixture,
) -> None:
    """The chart-data processor hands the request to ``raise_for_access`` so the
    guest dashboard binding can be checked for a query datasource."""
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
        query_context=query_context,
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
        pytest.param(None, True, 200, id="saved-chart-on-authorized-dashboard"),
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
    """HTTP chart-data enforces query scope and preserves the saved-chart path."""
    from superset import security_manager
    from superset.models.slice import Slice

    guest = _guest_user(datasets)
    load_guest = mocker.patch.object(
        security_manager, "get_guest_user_from_request", return_value=guest
    )
    # Give the guest both the route permission and access to the query's tables;
    # neither grant authorizes this query outside an embedded dashboard.
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
            datasource_type=DatasourceType.QUERY,
            params="{}",
            query_context=json.dumps(payload),
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
    if expected_status == 403:
        assert response.json == {"message": "Forbidden"}
        get_data.assert_not_called()
    else:
        get_data.assert_called_once()
