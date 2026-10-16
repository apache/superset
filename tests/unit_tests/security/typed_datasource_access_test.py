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

"""Typed datasource identity contracts for contextual authorization."""

from typing import Any
from unittest.mock import MagicMock, PropertyMock

import pytest
from flask import current_app
from pytest_mock import MockerFixture

from superset.common.query_object import QueryObject
from superset.connectors.sqla.models import SqlaTable
from superset.exceptions import SupersetSecurityException
from superset.extensions import appbuilder
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.security.guest_token import GuestToken, GuestUser
from superset.security.manager import (
    _datasource_matches,
    query_context_modified,
    SupersetSecurityManager,
)
from superset.semantic_layers.models import SemanticView
from superset.utils import json


def datasource(kind: str) -> SqlaTable | SemanticView:
    """Return persisted identities from independently allocated ID spaces."""
    if kind == "table":
        return SqlaTable(id=7, table_name="region", perm="table-perm")
    return SemanticView(id=7, name="region", perm="semantic-perm")


@pytest.mark.parametrize(
    "source_id,dataset_id",
    [
        pytest.param(1, True, id="bool-id"),
        pytest.param(7, 7.0, id="float-id"),
        pytest.param(None, 7, id="missing-datasource"),
    ],
)
def test_datasource_match_rejects_invalid_inputs(
    source_id: int | None, dataset_id: bool | float | int
) -> None:
    """Malformed IDs and missing datasource objects do not match."""
    source: SqlaTable | None = (
        SqlaTable(id=source_id, table_name="region") if source_id is not None else None
    )
    assert _datasource_matches(source, dataset_id, "table") is False


@pytest.fixture
def manager(app_context: None, mocker: MockerFixture) -> SupersetSecurityManager:
    """Leave contextual authorization real while isolating unrelated grants."""
    sm: SupersetSecurityManager = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_schema", return_value=False)
    mocker.patch.object(sm, "can_access", return_value=False)
    mocker.patch.object(sm, "is_editor", return_value=False)
    mocker.patch.object(sm, "is_viewer", return_value=True)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    mocker.patch.object(sm, "get_current_guest_user_if_guest", return_value=None)
    mocker.patch.object(sm, "can_access_dashboard", return_value=True)
    mocker.patch("superset.is_feature_enabled", return_value=True)
    mocker.patch.dict(current_app.config, {"VIEWER_PROMISCUOUS_MODE": True})
    return sm


@pytest.mark.parametrize("chart_type", ["table", "semantic_view"])
@pytest.mark.parametrize("requested_type", ["table", "semantic_view"])
def test_chart_viewer_requires_typed_datasource_identity(
    manager: SupersetSecurityManager,
    mocker: MockerFixture,
    chart_type: str,
    requested_type: str,
) -> None:
    """Chart-viewer access is bound to the chart datasource's type and id."""
    source: SqlaTable | SemanticView = datasource(requested_type)
    chart: Slice = Slice(id=10, datasource_id=7, datasource_type=chart_type)
    mocker.patch.object(
        manager.session, "query"
    ).return_value.filter.return_value.one_or_none.return_value = chart
    context: MagicMock = MagicMock(
        datasource=source, form_data={"slice_id": 10}, queries=[], slice_=chart
    )
    if chart_type == requested_type:
        manager.raise_for_access(query_context=context)
    else:
        with pytest.raises(SupersetSecurityException):
            manager.raise_for_access(query_context=context)


def native_filter_context(
    mocker: MockerFixture,
    manager: SupersetSecurityManager,
    requested_type: str,
    target_type: str | None,
) -> MagicMock:
    """Bind a query to a stored native-filter target, including legacy tables."""
    source: SqlaTable | SemanticView = datasource(requested_type)
    target: dict[str, Any] = {"datasetId": 7, "column": {"name": "region"}}
    if target_type == "null":
        target["datasourceType"] = None
    elif target_type is not None:
        target["datasourceType"] = target_type
    dashboard: Dashboard = Dashboard(
        id=20,
        json_metadata=json.dumps(
            {
                "native_filter_configuration": [
                    {
                        "id": "F1",
                        "targets": [target],
                        "controlValues": {"sortMetric": "total"},
                    }
                ]
            }
        ),
    )
    mocker.patch.object(
        manager.session, "query"
    ).return_value.filter.return_value.one_or_none.return_value = dashboard
    # Observe eager metadata access without invoking a provider.
    mocker.patch.object(
        type(source), "data", new_callable=PropertyMock, return_value={"id": 7}
    )
    return MagicMock(
        datasource=source,
        slice_=None,
        form_data={
            "dashboardId": 20,
            "type": "NATIVE_FILTER",
            "native_filter_id": "F1",
        },
        queries=[QueryObject(columns=["region"])],
    )


@pytest.mark.parametrize("target_type", [None, "null", "table", "semantic_view"])
@pytest.mark.parametrize("requested_type", ["table", "semantic_view"])
@pytest.mark.parametrize("guest", [False, True])
def test_native_filter_access_requires_typed_target(
    manager: SupersetSecurityManager,
    mocker: MockerFixture,
    target_type: str | None,
    requested_type: str,
    guest: bool,
) -> None:
    """Guest and dashboard-viewer access respects the stored target's type."""
    context: MagicMock = native_filter_context(
        mocker, manager, requested_type, target_type
    )
    mocker.patch.object(manager, "is_guest_user", return_value=guest)
    # A missing or null target type refers to a SQL dataset.
    effective_type: str = "table" if target_type in (None, "null") else str(target_type)
    if effective_type == requested_type:
        manager.raise_for_access(query_context=context)
    else:
        with pytest.raises(SupersetSecurityException):
            manager.raise_for_access(query_context=context)


@pytest.mark.parametrize("requested_type", ["table", "semantic_view"])
@pytest.mark.parametrize("target_type", [None, "table", "semantic_view"])
def test_native_filter_sort_metric_requires_matching_target(
    manager: SupersetSecurityManager,
    mocker: MockerFixture,
    requested_type: str,
    target_type: str | None,
) -> None:
    """A saved sort metric applies only to a filter target of the same type and id."""
    context: MagicMock = native_filter_context(
        mocker, manager, requested_type, target_type
    )
    context.queries = [QueryObject(columns=[], metrics=["total"])]
    assert query_context_modified(context) == (
        (target_type or "table") != requested_type
    )


@pytest.mark.parametrize("chart_type", ["table", "semantic_view"])
@pytest.mark.parametrize("requested_type", ["table", "semantic_view"])
@pytest.mark.parametrize("dashboard_allowed", [False, True])
def test_guest_member_chart_access_preserves_typed_membership(
    manager: SupersetSecurityManager,
    mocker: MockerFixture,
    chart_type: str,
    requested_type: str,
    dashboard_allowed: bool,
) -> None:
    """An authorized guest can read a member semantic chart like a SQL chart."""
    source: SqlaTable | SemanticView = datasource(requested_type)
    chart: Slice = Slice(
        id=10, datasource_id=7, datasource_type=chart_type, params="{}"
    )
    if chart_type == "table" and isinstance(source, SqlaTable):
        chart.table = source
    dashboard: Dashboard = Dashboard(id=20, slices=[chart])
    lookup: MagicMock = mocker.patch.object(manager.session, "query")
    lookup.side_effect = lambda model: MagicMock(
        **{
            "filter.return_value.one_or_none.return_value": dashboard
            if model is Dashboard
            else chart
        }
    )
    mocker.patch.object(manager, "is_guest_user", return_value=True)
    mocker.patch.object(manager, "is_viewer", return_value=False)
    mocker.patch.object(manager, "can_access_dashboard", return_value=dashboard_allowed)
    context: MagicMock = MagicMock(
        datasource=source,
        form_data={"slice_id": 10, "dashboardId": 20},
        queries=[],
        slice_=chart,
    )
    if dashboard_allowed and chart_type == requested_type:
        manager.raise_for_access(query_context=context)
    else:
        with pytest.raises(SupersetSecurityException):
            manager.raise_for_access(query_context=context)


@pytest.mark.parametrize("kind", ["table", "semantic_view"])
@pytest.mark.parametrize("allowed_datasets", [None, [], [7]])
def test_guest_dataset_allowlist_remains_in_sql_dataset_id_space(
    manager: SupersetSecurityManager,
    mocker: MockerFixture,
    kind: str,
    allowed_datasets: list[int] | None,
) -> None:
    """The guest-token dataset allowlist applies to SQL datasets only."""
    context: MagicMock = native_filter_context(mocker, manager, kind, kind)
    token: GuestToken = {
        "user": {},
        "resources": [],
        "rls_rules": [],
        "iat": 0,
        "exp": 1,
    }
    if allowed_datasets is not None:
        token["datasets"] = allowed_datasets
    guest: GuestUser = GuestUser(token=token, roles=[])
    mocker.patch.object(manager, "is_guest_user", return_value=True)
    mocker.patch.object(manager, "get_current_guest_user_if_guest", return_value=guest)
    if allowed_datasets is None or (kind == "table" and allowed_datasets == [7]):
        manager.raise_for_access(query_context=context)
    else:
        with pytest.raises(SupersetSecurityException):
            manager.raise_for_access(query_context=context)


@pytest.mark.parametrize("kind", ["table", "semantic_view"])
def test_guest_native_filter_authorization_does_not_load_datasource_data(
    manager: SupersetSecurityManager,
    mocker: MockerFixture,
    kind: str,
) -> None:
    """Authorization needs identity only, not a provider-backed serialization."""
    context: MagicMock = native_filter_context(mocker, manager, kind, kind)
    metadata: PropertyMock = mocker.patch.object(
        type(context.datasource),
        "data",
        new_callable=PropertyMock,
        side_effect=AssertionError("Provider metadata must not be loaded"),
    )
    mocker.patch.object(manager, "is_guest_user", return_value=True)
    manager.raise_for_access(query_context=context)
    metadata.assert_not_called()


@pytest.mark.parametrize("child_type", ["table", "semantic_view"])
@pytest.mark.parametrize("requested_type", ["table", "semantic_view"])
def test_guest_multilayer_child_requires_typed_datasource(
    manager: SupersetSecurityManager,
    mocker: MockerFixture,
    child_type: str,
    requested_type: str,
) -> None:
    """Parent membership grants only the child chart's typed datasource."""
    source: SqlaTable | SemanticView = datasource(requested_type)
    child: Slice = Slice(
        id=11, datasource_id=7, datasource_type=child_type, params="{}"
    )
    if child_type == "table" and isinstance(source, SqlaTable):
        child.table = source
    parent: Slice = Slice(
        id=10, params=json.dumps({"viz_type": "deck_multi", "deck_slices": [11]})
    )
    dashboard: Dashboard = Dashboard(id=20, slices=[parent])
    lookup: MagicMock = mocker.patch.object(manager.session, "query")
    lookup.return_value.filter.return_value.one_or_none.side_effect = [
        dashboard,
        parent,
        child,
    ]
    mocker.patch.object(manager, "is_guest_user", return_value=True)
    mocker.patch.object(manager, "is_viewer", return_value=False)
    mocker.patch.dict(current_app.config, {"VIEWER_PROMISCUOUS_MODE": False})
    context: MagicMock = MagicMock(
        datasource=source,
        queries=[],
        slice_=child,
        form_data={"slice_id": 11, "parent_slice_id": 10, "dashboardId": 20},
    )
    if child_type == requested_type:
        manager.raise_for_access(query_context=context)
    else:
        with pytest.raises(SupersetSecurityException):
            manager.raise_for_access(query_context=context)


@pytest.mark.parametrize("chart_type", ["table", "semantic_view"])
@pytest.mark.parametrize("requested_type", ["table", "semantic_view"])
def test_drill_by_requires_typed_chart_datasource(
    manager: SupersetSecurityManager,
    mocker: MockerFixture,
    chart_type: str,
    requested_type: str,
) -> None:
    """Drill By is bound to the source chart datasource's type and id."""
    source: SqlaTable | SemanticView = datasource(requested_type)
    chart: Slice = Slice(id=10, datasource_id=7, datasource_type=chart_type)
    if chart_type == "table" and isinstance(source, SqlaTable):
        chart.table = source
    dashboard: Dashboard = Dashboard(id=20, slices=[chart])
    mocker.patch.object(
        manager.session, "query"
    ).return_value.filter.return_value.one_or_none.return_value = chart
    mocker.patch.object(type(source), "has_drill_by_columns", return_value=True)
    form_data: dict[str, Any] = {"slice_id": 0, "chart_id": 10, "groupby": ["region"]}
    assert manager.has_drill_access(form_data, dashboard, source) == (
        chart_type == requested_type
    )


@pytest.mark.parametrize("kind", ["table", "semantic_view"])
@pytest.mark.parametrize("allowed_datasets", [None, [7]])
def test_guest_token_minting_checks_only_datasources_the_token_grants(
    manager: SupersetSecurityManager,
    mocker: MockerFixture,
    kind: str,
    allowed_datasets: list[int] | None,
) -> None:
    """Minting requires access to each member datasource the token can grant;
    a dataset allowlist grants SQL datasets only."""
    source: SqlaTable | SemanticView = datasource(kind)
    chart: Slice = Slice(id=10, datasource_id=7, datasource_type=kind)
    dashboard: Dashboard = Dashboard(id=20, slices=[chart])
    mocker.patch.object(manager, "is_admin", return_value=False)
    mocker.patch.object(
        Slice, "resolved_datasource", new_callable=PropertyMock, return_value=source
    )
    mocker.patch.object(manager, "can_access_datasource", return_value=False)
    mocker.patch.object(
        manager, "get_datasource_access_error_object", return_value=MagicMock()
    )
    grants_datasource: bool = allowed_datasets is None or kind == "table"
    if grants_datasource:
        with pytest.raises(SupersetSecurityException):
            manager._raise_for_guest_token_datasource_access(  # noqa: SLF001
                dashboard, allowed_datasets
            )
    else:
        manager._raise_for_guest_token_datasource_access(  # noqa: SLF001
            dashboard, allowed_datasets
        )
