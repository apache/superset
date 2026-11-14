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

# pylint: disable=invalid-name, unused-argument, redefined-outer-name

import json  # noqa: TID251
import logging
from types import SimpleNamespace
from typing import Any, Optional
from unittest.mock import MagicMock

import pytest
from flask import current_app
from flask_appbuilder.actions import ActionItem
from flask_appbuilder.const import (
    AUTH_DB,
    AUTH_LDAP,
    AUTH_OAUTH,
    AUTH_REMOTE_USER,
    AUTH_SAML,
)
from flask_appbuilder.security.sqla.models import (
    assoc_group_role,
    assoc_permissionview_role,
    assoc_user_group,
    assoc_user_role,
    Group,
    Permission,
    PermissionView,
    Role,
    User,
    ViewMenu,
)
from flask_appbuilder.security.views import ResetMyPasswordView, ResetPasswordView
from pytest_mock import MockerFixture
from sqlalchemy.orm import Session
from werkzeug.exceptions import NotFound

from superset.common.chart_data import ChartDataResultType
from superset.common.query_object import QueryObject
from superset.connectors.sqla.models import Database, SqlaTable
from superset.errors import SupersetErrorType
from superset.exceptions import SupersetParseError, SupersetSecurityException
from superset.extensions import appbuilder
from superset.models.slice import Slice
from superset.security.manager import (
    _collect_sortable_identifiers,
    freeze_value,
    query_context_modified,
    SupersetSecurityManager,
)
from superset.sql.parse import SQLScript, Table
from superset.superset_typing import AdhocColumn, AdhocMetric
from superset.utils.core import DatasourceName, override_user


def test_security_manager(app_context: None) -> None:
    """
    Test that the security manager can be built.
    """
    sm = SupersetSecurityManager(appbuilder)
    assert sm


def test_is_guest_user_no_jwt_returns_false_without_raising(
    app_context: None, mocker: MockerFixture
) -> None:
    """
    ``is_guest_user`` must not propagate ``NoAuthorizationError``.

    Resolving the current user on a request with no JWT and no guest token
    invokes the app's request loader, which lets ``verify_jwt_in_request``
    raise ``NoAuthorizationError``. When ``is_guest_user`` runs before auth
    (e.g. error sanitization while handling an unrelated HTTPException) that
    raise would escape as an unhandled exception. Such a request cannot be an
    embedded guest viewer, so the method must return ``False`` instead.
    """
    from flask_jwt_extended.exceptions import NoAuthorizationError

    mocker.patch(
        "superset.is_feature_enabled",
        side_effect=lambda feature: feature == "EMBEDDED_SUPERSET",
    )
    mocker.patch(
        "superset.security.manager.get_current_user",
        side_effect=NoAuthorizationError("Missing JWT in cookies or headers"),
    )

    assert SupersetSecurityManager.is_guest_user() is False


def _register_views_with_mock_appbuilder(
    mocker: MockerFixture,
    auth_type: int,
    auth_user_registration: bool = False,
    register_superset_registeruser_view: bool = False,
) -> MagicMock:
    """
    Build a SupersetSecurityManager bound to a fresh mock appbuilder and call
    register_views() on it, with FlaskAppBuilder's own register_views (the
    super() call, which does its own large auth_type dispatch and permission
    registration) stubbed out so the test stays scoped to just the override.
    Returns the mock appbuilder so the caller can inspect what got registered.
    """
    from flask import current_app

    # patch.dict restores the previous config values on teardown, so these
    # overrides don't leak into other tests sharing the module-scoped app.
    mocker.patch.dict(
        current_app.config,
        {
            "AUTH_TYPE": auth_type,
            "AUTH_USER_REGISTRATION": auth_user_registration,
            "AUTH_RATE_LIMITED": False,
        },
    )

    mock_appbuilder = mocker.MagicMock()
    mock_appbuilder.baseviews = []
    mock_appbuilder.menu.get_list.return_value = []

    sm = SupersetSecurityManager.__new__(SupersetSecurityManager)
    sm.appbuilder = mock_appbuilder
    sm.register_superset_auth_view = True
    sm.register_superset_registeruser_view = register_superset_registeruser_view
    sm.userstatschartview = None

    mocker.patch(
        "flask_appbuilder.security.sqla.manager.SecurityManager.register_views",
        autospec=True,
    )

    sm.register_views()
    return mock_appbuilder


def test_register_views_does_not_shadow_auth_remote_user(
    app_context: None, mocker: MockerFixture
) -> None:
    """
    AUTH_REMOTE_USER must not register SupersetAuthView at "/login/".

    AuthRemoteUserView performs a silent, header-driven login with no
    interactive UI. SupersetAuthView (the SPA login shell) previously
    registered at the same route unconditionally and always won the routing
    dispatch, so the remote-user header was never even checked -- reported in
    apache/superset#36117 as a regression from the frontend login migration
    (#31590). See also the related opt-out added in #39098.
    """
    from superset.views.auth import SupersetAuthView

    mock_appbuilder = _register_views_with_mock_appbuilder(mocker, AUTH_REMOTE_USER)

    registered = [
        call.args[0] for call in mock_appbuilder.add_view_no_menu.call_args_list
    ]
    assert SupersetAuthView not in registered


def test_register_views_still_registers_superset_auth_view_for_db_auth(
    app_context: None, mocker: MockerFixture
) -> None:
    """
    Control case: AUTH_DB (the common, interactive case) is unaffected --
    SupersetAuthView still registers at "/login/" as before.
    """
    from superset.views.auth import SupersetAuthView

    mock_appbuilder = _register_views_with_mock_appbuilder(mocker, AUTH_DB)

    registered = [
        call.args[0] for call in mock_appbuilder.add_view_no_menu.call_args_list
    ]
    assert SupersetAuthView in registered


@pytest.mark.parametrize(
    "auth_type,auth_user_registration",
    [
        (AUTH_LDAP, True),
        (AUTH_REMOTE_USER, True),
        (AUTH_SAML, True),
        (AUTH_DB, False),
    ],
)
def test_register_views_does_not_register_registeruser_view(
    app_context: None,
    mocker: MockerFixture,
    auth_type: int,
    auth_user_registration: bool,
) -> None:
    """
    SupersetRegisterUserView must only register where self-registration works.

    FlaskAppBuilder wires the "/register/form" handler that the page posts to
    only for AUTH_DB and AUTH_OAUTH, and only when AUTH_USER_REGISTRATION is
    set. LDAP/SAML/AUTH_REMOTE_USER deployments must set AUTH_USER_REGISTRATION
    anyway so users get provisioned on first login, which used to publish a
    public "/register/" form that submits to a 404 -- reported in
    apache/superset#37100.
    """
    from superset.views.auth import SupersetRegisterUserView

    mock_appbuilder = _register_views_with_mock_appbuilder(
        mocker,
        auth_type,
        auth_user_registration=auth_user_registration,
        register_superset_registeruser_view=True,
    )

    registered = [
        call.args[0] for call in mock_appbuilder.add_view_no_menu.call_args_list
    ]
    assert SupersetRegisterUserView not in registered


@pytest.mark.parametrize("auth_type", [AUTH_DB, AUTH_OAUTH])
def test_register_views_registers_registeruser_view_for_self_registration(
    app_context: None, mocker: MockerFixture, auth_type: int
) -> None:
    """
    Control case: the auth types FlaskAppBuilder registers a register-user view
    for still get the "/register/" page when AUTH_USER_REGISTRATION is set.
    """
    from superset.views.auth import SupersetRegisterUserView

    mock_appbuilder = _register_views_with_mock_appbuilder(
        mocker,
        auth_type,
        auth_user_registration=True,
        register_superset_registeruser_view=True,
    )

    registered = [
        call.args[0] for call in mock_appbuilder.add_view_no_menu.call_args_list
    ]
    assert SupersetRegisterUserView in registered


@pytest.fixture
def stored_metrics() -> list[AdhocMetric]:
    """
    Return a list of metrics.
    """
    return [
        {
            "column": None,
            "expressionType": "SQL",
            "hasCustomLabel": False,
            "label": "COUNT(*) + 1",
            "sqlExpression": "COUNT(*) + 1",
        },
    ]


@pytest.fixture
def stored_columns() -> list[AdhocColumn]:
    """
    Return a list of columns.
    """
    return [
        {
            "label": "My column",
            "sqlExpression": "UPPER(name)",
        },
    ]


def test_raise_for_access_guest_user_ok(
    mocker: MockerFixture,
    app_context: None,
    stored_metrics: list[AdhocMetric],
    stored_columns: list[AdhocColumn],
) -> None:
    """
    Test that guest user can submit an unmodified chart payload.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "metrics": stored_metrics,
        "columns": stored_columns,
    }

    query_context.form_data = {
        "slice_id": 42,
        "metrics": stored_metrics,
        "columns": stored_columns,
    }
    query_context.queries = [QueryObject(metrics=stored_metrics)]  # type: ignore
    sm.raise_for_access(query_context=query_context)


def test_raise_for_access_guest_user_ok_subset(
    mocker: MockerFixture,
    app_context: None,
    stored_metrics: list[AdhocMetric],
    stored_columns: list[AdhocColumn],
) -> None:
    """
    Test that guest user can submit a request of a subset of the metrics/columns.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "metrics": stored_metrics,
        "columns": stored_columns,
    }

    query_context.form_data = {
        "slice_id": 42,
        "metrics": [],
        "columns": [],
    }
    query_context.queries = [QueryObject(metrics=stored_metrics)]  # type: ignore
    sm.raise_for_access(query_context=query_context)


def test_raise_for_access_guest_user_deck_multi_child_requires_child_datasource(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    The deck.gl multi-layer child leg must bind the requested datasource to
    the child chart: a valid parent/child pair does not authorize querying
    an arbitrary dataset.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=False)
    mocker.patch.object(sm, "can_access_schema", return_value=False)
    mocker.patch.object(sm, "is_editor", return_value=False)
    mocker.patch.object(sm, "can_access_dashboard", return_value=True)
    mocker.patch.object(sm, "get_current_guest_user_if_guest", return_value=None)
    mocker.patch(
        "superset.is_feature_enabled",
        side_effect=lambda feature: feature == "EMBEDDED_SUPERSET",
    )
    mocker.patch(
        "superset.security.manager.query_context_modified",
        return_value=False,
    )

    child_datasource: MagicMock = mocker.MagicMock(id=7, type="table")
    other_datasource: MagicMock = mocker.MagicMock(id=8, type="table")

    parent_slc = mocker.MagicMock()
    parent_slc.params = json.dumps({"viz_type": "deck_multi", "deck_slices": [42]})
    child_slc = mocker.MagicMock()
    child_slc.datasource = child_datasource
    child_slc.datasource_id = 7
    child_slc.datasource_type = "table"

    dashboard = mocker.MagicMock()
    dashboard.slices = [parent_slc]

    query_mock = mocker.patch.object(sm.session, "query")
    query_mock.return_value.filter.return_value.one_or_none.side_effect = [
        dashboard,
        parent_slc,
        child_slc,
        dashboard,
        parent_slc,
        child_slc,
    ]

    query_context = mocker.MagicMock()
    query_context.form_data = {
        "dashboardId": 10,
        "slice_id": 42,
        "parent_slice_id": 41,
    }

    # Requesting the child's own datasource is allowed.
    query_context.datasource = child_datasource
    sm.raise_for_access(query_context=query_context)

    # The same chart context with any other datasource is rejected.
    query_context.datasource = other_datasource
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query_context=query_context)


def test_raise_for_access_guest_user_tampered_id(
    mocker: MockerFixture,
    app_context: None,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    Test that guest user cannot modify the chart ID.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "metrics": stored_metrics,
    }

    query_context.form_data = {
        "slice_id": 43,
        "metrics": stored_metrics,
    }
    query_context.queries = [QueryObject(metrics=stored_metrics)]  # type: ignore
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query_context=query_context)


def test_raise_for_access_guest_user_tampered_form_data_metrics(
    mocker: MockerFixture,
    app_context: None,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    Test that guest user cannot modify metrics in the form data.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "metrics": stored_metrics,
    }

    tampered_metrics = [
        {
            "column": None,
            "expressionType": "SQL",
            "hasCustomLabel": False,
            "label": "COUNT(*) + 2",
            "sqlExpression": "COUNT(*) + 2",
        }
    ]

    query_context.form_data = {
        "slice_id": 42,
        "metrics": tampered_metrics,
    }
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query_context=query_context)


def test_raise_for_access_guest_user_tampered_form_data_columns(
    mocker: MockerFixture,
    app_context: None,
    stored_columns: list[AdhocColumn],
) -> None:
    """
    Test that guest user cannot modify columns in the form data.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": stored_columns,
    }

    tampered_columns = [
        {
            "label": "My column",
            "sqlExpression": "list_secret()",
            "expressionType": "SQL",
        },
    ]

    query_context.form_data = {
        "slice_id": 42,
        "columns": tampered_columns,
    }
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query_context=query_context)


def test_raise_for_access_guest_user_tampered_form_data_groupby(
    mocker: MockerFixture,
    app_context: None,
    stored_columns: list[AdhocColumn],
) -> None:
    """
    Test that guest user cannot modify groupby in the form data.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "groupby": stored_columns,
    }

    tampered_columns = [
        {
            "label": "My column",
            "sqlExpression": "list_secret()",
            "expressionType": "SQL",
        },
    ]

    query_context.form_data = {
        "slice_id": 42,
        "columns": tampered_columns,
    }
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query_context=query_context)


def test_raise_for_access_guest_user_tampered_queries_metrics(
    mocker: MockerFixture,
    app_context: None,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    Test that guest user cannot modify metrics in the queries.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "metrics": stored_metrics,
    }

    tampered_metrics = [
        {
            "column": None,
            "expressionType": "SQL",
            "hasCustomLabel": False,
            "label": "COUNT(*) + 2",
            "sqlExpression": "COUNT(*) + 2",
        }
    ]

    query_context.form_data = {
        "slice_id": 42,
        "metrics": stored_metrics,
    }
    query_context.queries = [QueryObject(metrics=tampered_metrics)]  # type: ignore
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query_context=query_context)


def test_raise_for_access_guest_user_tampered_queries_columns(
    mocker: MockerFixture,
    app_context: None,
    stored_columns: list[AdhocColumn],
) -> None:
    """
    Test that guest user cannot modify columns in the queries.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": stored_columns,
    }

    tampered_columns = [
        {
            "label": "My column",
            "sqlExpression": "list_secret()",
            "expressionType": "SQL",
        }
    ]

    query_context.form_data = {
        "slice_id": 42,
        "columns": stored_columns,
    }
    query_context.queries = [QueryObject(metrics=tampered_columns)]  # type: ignore
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query_context=query_context)


def _base_axis_physical_column(name: str, time_grain: str = "P1D") -> dict[str, Any]:
    """
    The synthesized x-axis column ``normalizeTimeColumn`` emits for a *physical*
    x-axis (see superset-ui-core ``normalizeTimeColumn.ts``): a pure column
    reference wrapped with the BASE_AXIS markers and the chart's time grain.
    """
    return {
        "timeGrain": time_grain,
        "columnType": "BASE_AXIS",
        "sqlExpression": name,
        "label": name,
        "expressionType": "SQL",
        "isColumnReference": True,
    }


def _guest_query(columns: list[Any], metrics: list[AdhocMetric]) -> QueryObject:
    """A QueryObject carrying the given columns/metrics, as a guest request would."""
    return QueryObject(columns=columns, metrics=metrics)  # type: ignore[arg-type]


def test_raise_for_access_guest_user_ok_base_axis_physical_x_axis(
    mocker: MockerFixture,
    app_context: None,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    A guest may load a chart whose saved ``query_context`` is NULL and whose
    x-axis is a physical column. ``normalizeTimeColumn`` sends the x-axis as a
    synthesized ``BASE_AXIS`` column that never appears verbatim in the stored
    ``params`` (the x-axis lives under its own ``x_axis`` control), so before the
    carve-out this legitimate load was rejected with a 403.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "x_axis": "order_date",
        "metrics": stored_metrics,
        "columns": [],
    }
    query_context.form_data = {
        "slice_id": 42,
        "x_axis": "order_date",
        "metrics": stored_metrics,
        "columns": [],
    }
    query_context.queries = [
        _guest_query([_base_axis_physical_column("order_date")], stored_metrics)
    ]
    sm.raise_for_access(query_context=query_context)


def test_raise_for_access_guest_user_ok_base_axis_adhoc_x_axis(
    mocker: MockerFixture,
    app_context: None,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    Same as above for an *adhoc* x-axis: ``normalizeTimeColumn`` copies the saved
    adhoc column and adds the BASE_AXIS markers, so the request carries the saved
    x-axis plus synthesized decorations and must not read as tampering.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    adhoc_x_axis: dict[str, Any] = {
        "label": "order month",
        "sqlExpression": "DATE_TRUNC('month', order_date)",
        "expressionType": "SQL",
    }
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "x_axis": adhoc_x_axis,
        "metrics": stored_metrics,
        "columns": [],
    }
    query_context.form_data = {
        "slice_id": 42,
        "x_axis": adhoc_x_axis,
        "metrics": stored_metrics,
        "columns": [],
    }
    synthesized = {"timeGrain": "P1M", "columnType": "BASE_AXIS", **adhoc_x_axis}
    query_context.queries = [_guest_query([synthesized], stored_metrics)]
    sm.raise_for_access(query_context=query_context)


def test_raise_for_access_guest_user_base_axis_forged_column_reference(
    mocker: MockerFixture,
    app_context: None,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    The BASE_AXIS carve-out must not become a smuggling channel: a column tagged
    ``BASE_AXIS`` that references a column the chart never exposed is still
    rejected. Here the forged reference points at ``secret_col`` while the stored
    x-axis is ``order_date``.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "x_axis": "order_date",
        "metrics": stored_metrics,
        "columns": [],
    }
    query_context.form_data = {
        "slice_id": 42,
        "x_axis": "order_date",
        "metrics": stored_metrics,
        "columns": [],
    }
    query_context.queries = [
        _guest_query([_base_axis_physical_column("secret_col")], stored_metrics)
    ]
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query_context=query_context)


def test_raise_for_access_guest_user_base_axis_forged_adhoc_expression(
    mocker: MockerFixture,
    app_context: None,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    A BASE_AXIS-tagged adhoc column whose SQL body differs from the saved x-axis
    is rejected: tagging free-form SQL as BASE_AXIS must not authorize it.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    adhoc_x_axis: dict[str, Any] = {
        "label": "order month",
        "sqlExpression": "DATE_TRUNC('month', order_date)",
        "expressionType": "SQL",
    }
    forged = {
        "timeGrain": "P1M",
        "columnType": "BASE_AXIS",
        "label": "order month",
        "sqlExpression": "list_secret()",
        "expressionType": "SQL",
    }
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "x_axis": adhoc_x_axis,
        "metrics": stored_metrics,
        "columns": [],
    }
    query_context.form_data = {
        "slice_id": 42,
        "x_axis": adhoc_x_axis,
        "metrics": stored_metrics,
        "columns": [],
    }
    query_context.queries = [_guest_query([forged], stored_metrics)]
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query_context=query_context)


def test_raise_for_access_guest_user_ok_base_axis_stale_query_context(
    mocker: MockerFixture,
    app_context: None,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    A chart with a *stale* (non-NULL) saved ``query_context`` from an older
    frontend that predates the BASE_AXIS column still loads: the x-axis carve-out
    is sourced from ``params`` rather than the stored ``query_context``, so a
    stored context that lacks the synthesized column does not reject the guest.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = json.dumps(
        {"queries": [{"columns": [], "metrics": stored_metrics}]}
    )
    query_context.slice_.params_dict = {
        "x_axis": "order_date",
        "metrics": stored_metrics,
        "columns": [],
    }
    query_context.form_data = {
        "slice_id": 42,
        "x_axis": "order_date",
        "metrics": stored_metrics,
        "columns": [],
    }
    query_context.queries = [
        _guest_query([_base_axis_physical_column("order_date")], stored_metrics)
    ]
    sm.raise_for_access(query_context=query_context)


def test_raise_for_access_guest_user_ok_base_axis_orderby(
    mocker: MockerFixture,
    app_context: None,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    A guest may sort an embedded chart by its own temporal x-axis, which the
    frontend sends as the synthesized BASE_AXIS column in the order-by term.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    base_axis = _base_axis_physical_column("order_date")
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "x_axis": "order_date",
        "metrics": stored_metrics,
        "columns": [],
    }
    query_context.form_data = {
        "slice_id": 42,
        "x_axis": "order_date",
        "metrics": stored_metrics,
        "columns": [],
        "orderby": [[base_axis, True]],
    }
    query_context.queries = [_guest_query([base_axis], stored_metrics)]
    sm.raise_for_access(query_context=query_context)


def test_raise_for_access_guest_user_base_axis_orderby_forged(
    mocker: MockerFixture,
    app_context: None,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    The order-by carve-out is bounded: sorting by a BASE_AXIS-tagged column that
    references a column the chart never exposed is still rejected.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "x_axis": "order_date",
        "metrics": stored_metrics,
        "columns": [],
    }
    query_context.form_data = {
        "slice_id": 42,
        "x_axis": "order_date",
        "metrics": stored_metrics,
        "columns": [],
        "orderby": [[_base_axis_physical_column("secret_col"), True]],
    }
    query_context.queries = [
        _guest_query([_base_axis_physical_column("order_date")], stored_metrics)
    ]
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query_context=query_context)


def test_raise_for_access_guest_user_ok_base_axis_multiple_queries(
    mocker: MockerFixture,
    app_context: None,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    The carve-out applies across every query in the request: a chart that issues
    more than one query (each carrying the synthesized BASE_AXIS x-axis) loads.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    base_axis = _base_axis_physical_column("order_date")
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "x_axis": "order_date",
        "metrics": stored_metrics,
        "columns": [],
    }
    query_context.form_data = {
        "slice_id": 42,
        "x_axis": "order_date",
        "metrics": stored_metrics,
        "columns": [],
    }
    query_context.queries = [
        _guest_query([base_axis], stored_metrics),
        _guest_query([base_axis], stored_metrics),
    ]
    sm.raise_for_access(query_context=query_context)


def test_raise_for_access_guest_user_ok_x_axis_reused_in_columns(
    mocker: MockerFixture,
    app_context: None,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    The stored x-axis is an allowed column even when requested verbatim (not
    BASE_AXIS-wrapped): the x-axis dimension is not listed under ``columns`` in
    ``params`` but is a legitimate selectable dimension.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    adhoc_x_axis: dict[str, Any] = {
        "label": "order month",
        "sqlExpression": "DATE_TRUNC('month', order_date)",
        "expressionType": "SQL",
    }
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "x_axis": adhoc_x_axis,
        "metrics": stored_metrics,
        "columns": [],
    }
    query_context.form_data = {
        "slice_id": 42,
        "x_axis": adhoc_x_axis,
        "metrics": stored_metrics,
        "columns": [adhoc_x_axis],
    }
    query_context.queries = [_guest_query([adhoc_x_axis], stored_metrics)]
    sm.raise_for_access(query_context=query_context)


def test_raise_for_access_guest_user_base_axis_non_string_sql_rejected(
    mocker: MockerFixture,
    app_context: None,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    A BASE_AXIS column with a non-string ``sqlExpression`` does not take the
    physical-reference shortcut; it falls back to the dict comparison, matches no
    stored value, and is rejected without raising an unexpected error.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    forged = {
        "columnType": "BASE_AXIS",
        "isColumnReference": True,
        "sqlExpression": ["order_date"],
        "label": "order_date",
    }
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "x_axis": "order_date",
        "metrics": stored_metrics,
        "columns": [],
    }
    query_context.form_data = {
        "slice_id": 42,
        "x_axis": "order_date",
        "metrics": stored_metrics,
        "columns": [],
    }
    query_context.queries = [_guest_query([forged], stored_metrics)]
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query_context=query_context)


def test_raise_for_access_guest_user_logs_rejection_reason(
    mocker: MockerFixture,
    app_context: None,
    caplog: pytest.LogCaptureFixture,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    A rejected guest payload is logged server-side with which comparator objected
    and whether the stored query_context was present, and without any payload
    values (so column names / SQL are not leaked into logs).
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {"columns": [], "metrics": stored_metrics}
    query_context.form_data = {
        "slice_id": 42,
        "columns": [
            {
                "label": "secret",
                "sqlExpression": "secret_col",
                "expressionType": "SQL",
            }
        ],
        "metrics": stored_metrics,
    }
    query_context.queries = [_guest_query([], stored_metrics)]

    with caplog.at_level(logging.WARNING, logger="superset.security.manager"):
        with pytest.raises(SupersetSecurityException):
            sm.raise_for_access(query_context=query_context)

    assert "columns/metrics/group-by" in caplog.text
    assert "stored query_context missing" in caplog.text
    # The rejected column name / SQL must not be logged.
    assert "secret_col" not in caplog.text


def test_raise_for_access_guest_user_ok_base_axis_in_form_data(
    mocker: MockerFixture,
    app_context: None,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    The carve-out applies to the ``form_data`` comparison too, not only the
    per-query one: a BASE_AXIS x-axis carried in ``form_data["columns"]`` is
    recognized as the stored x-axis.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    base_axis = _base_axis_physical_column("order_date")
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "x_axis": "order_date",
        "metrics": stored_metrics,
        "columns": [],
    }
    query_context.form_data = {
        "slice_id": 42,
        "x_axis": "order_date",
        "metrics": stored_metrics,
        "columns": [base_axis],
    }
    query_context.queries = [_guest_query([base_axis], stored_metrics)]
    sm.raise_for_access(query_context=query_context)


def test_raise_for_access_guest_user_ok_base_axis_groupby(
    mocker: MockerFixture,
    app_context: None,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    The x-axis carve-out also applies to the ``groupby`` key, not only
    ``columns``.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    base_axis = _base_axis_physical_column("order_date")
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "x_axis": "order_date",
        "metrics": stored_metrics,
        "groupby": [],
    }
    query_context.form_data = {
        "slice_id": 42,
        "x_axis": "order_date",
        "metrics": stored_metrics,
        "groupby": [base_axis],
    }
    query_context.queries = [_guest_query([], stored_metrics)]
    sm.raise_for_access(query_context=query_context)


def test_raise_for_access_guest_user_ok_bare_string_x_axis_in_columns(
    mocker: MockerFixture,
    app_context: None,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    A physical (bare-string) x-axis requested verbatim as a column is allowed by
    the x_axis carve-out, without any BASE_AXIS wrapping.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "x_axis": "order_date",
        "metrics": stored_metrics,
        "columns": [],
    }
    query_context.form_data = {
        "slice_id": 42,
        "x_axis": "order_date",
        "metrics": stored_metrics,
        "columns": ["order_date"],
    }
    query_context.queries = [_guest_query(["order_date"], stored_metrics)]
    sm.raise_for_access(query_context=query_context)


def test_raise_for_access_guest_user_base_axis_in_metrics_rejected(
    mocker: MockerFixture,
    app_context: None,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    The carve-out is column-only: a metric tagged BASE_AXIS is not collapsed, so
    it must exact-match a stored metric and an unrelated one is still rejected.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mocker.patch.object(sm, "can_access", return_value=True)

    forged_metric = {
        "columnType": "BASE_AXIS",
        "isColumnReference": True,
        "sqlExpression": "SUM(revenue)",
        "label": "SUM(revenue)",
        "expressionType": "SQL",
    }
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "x_axis": "order_date",
        "metrics": stored_metrics,
        "columns": [],
    }
    query_context.form_data = {
        "slice_id": 42,
        "metrics": [forged_metric],
    }
    query_context.queries = [_guest_query([], stored_metrics)]
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query_context=query_context)


def test_raise_for_access_query_default_schema(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that the DB default schema is used in non-qualified table names.

    For example, in Postgres, for the following query:

        > SELECT * FROM foo;

    We should check that the user has access to the `public` schema, regardless of the
    schema set in the query.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "get_schema_perm", return_value="[PostgreSQL].[public]")
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")  # noqa: N806
    SqlaTable.query_datasources_by_name.return_value = []

    database = mocker.MagicMock()
    database.get_default_catalog.return_value = None
    database.get_default_schema_for_query.return_value = "public"
    query = mocker.MagicMock()
    query.catalog = None
    query.database = database
    query.sql = "SELECT * FROM ab_user"

    # user has access to `public` schema
    mocker.patch.object(sm, "can_access", return_value=True)
    assert (
        sm.raise_for_access(  # type: ignore
            database=None,
            datasource=None,
            query=query,
            query_context=None,
            table=None,
        )
        is None
    )
    sm.can_access.assert_called_with("schema_access", "[PostgreSQL].[public]")  # type: ignore

    # user has only access to `secret` schema
    mocker.patch.object(sm, "can_access", return_value=False)
    with pytest.raises(SupersetSecurityException) as excinfo:
        sm.raise_for_access(
            database=None,
            datasource=None,
            query=query,
            query_context=None,
            table=None,
        )
    assert (
        str(excinfo.value)
        == 'You need access to the following tables: "public.ab_user", '
        "'all_database_access' or 'all_datasource_access' permission"
    )


def test_raise_for_access_jinja_sql(mocker: MockerFixture, app_context: None) -> None:
    """
    Test that Jinja gets rendered to SQL.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "get_schema_perm", return_value="[PostgreSQL].[public]")
    mocker.patch.object(sm, "can_access", return_value=False)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    get_table_access_error_object = mocker.patch.object(
        sm, "get_table_access_error_object"
    )
    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")  # noqa: N806
    SqlaTable.query_datasources_by_name.return_value = []

    database = mocker.MagicMock()
    database.get_default_catalog.return_value = None
    database.get_default_schema_for_query.return_value = "public"
    query = mocker.MagicMock()
    query.catalog = None
    query.database = database
    query.sql = "SELECT * FROM {% if True %}ab_user{% endif %} WHERE 1=1"

    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(
            database=None,
            datasource=None,
            query=query,
            query_context=None,
            table=None,
        )

    get_table_access_error_object.assert_called_with({Table("ab_user", "public", None)})


def test_can_access_schema_query_schema_access(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """A schema_access holder can access a Query's schema via can_access_schema.

    Regression test for the widened isinstance gate: Query is not a
    BaseDatasource but exposes ``database`` and ``schema_perm``, so the
    catalog/schema hierarchy checks must still run for it. Previously the
    6.1.0 Explorable refactor's ``isinstance(datasource, BaseDatasource)``
    gate caused ``can_access_schema(Query)`` to always return False.
    """
    from superset.models.sql_lab import Query

    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_all_datasources", return_value=False)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(
        sm,
        "can_access",
        side_effect=lambda perm, view: (
            perm == "schema_access" and view == "[examples].[main]"
        ),
    )

    database = mocker.MagicMock()
    database.database_name = "examples"
    database.get_default_catalog.return_value = None
    query = Query(sql="SELECT * FROM t1", schema="main", catalog=None)
    query.database = database

    assert sm.can_access_schema(query) is True


def test_can_access_schema_query_denied_ungranted_schema(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """can_access_schema(Query) is False when the schema is not granted."""
    from superset.models.sql_lab import Query

    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_all_datasources", return_value=False)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "can_access", return_value=False)

    database = mocker.MagicMock()
    database.database_name = "examples"
    database.get_default_catalog.return_value = None
    query = Query(sql="SELECT * FROM t1", schema="other", catalog=None)
    query.database = database

    assert sm.can_access_schema(query) is False


def test_can_access_schema_transient_query_no_database(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """can_access_schema(Query) must not crash when database is None.

    A transient Query built from just a ``database_id`` (the ORM relationship
    was never loaded) has ``database = None``.  The widened gate must reject
    it rather than passing it through to ``can_access_database(None)``, which
    would crash.
    """
    from superset.models.sql_lab import Query

    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_all_datasources", return_value=False)

    query = Query(sql="SELECT * FROM t1", schema="main", catalog=None, database_id=1)
    query.database = None

    assert sm.can_access_schema(query) is False


def test_raise_for_access_chart_for_datasource_permission(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that the security manager can raise an exception for chart access,
    when the user does not have access to the chart datasource
    """
    sm = SupersetSecurityManager(appbuilder)
    session = sm.session

    engine = session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member

    alpha = User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="admin",
        roles=[Role(name="Alpha")],
    )

    dataset = SqlaTable(
        table_name="test_table",
        metrics=[],
        main_dttm_col=None,
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
    )
    session.add(dataset)
    session.flush()

    slice = Slice(
        id=1,
        datasource_id=dataset.id,
        datasource_type="table",
        datasource_name="tmp_perm_table",
        slice_name="slice_name",
    )
    session.add(slice)
    session.flush()

    mocker.patch.object(sm, "can_access_datasource", return_value=False)
    with override_user(alpha):
        with pytest.raises(SupersetSecurityException) as excinfo:
            sm.raise_for_access(
                chart=slice,
            )
        assert str(excinfo.value) == "You don't have access to this chart."

    mocker.patch.object(sm, "can_access_datasource", return_value=True)
    with override_user(alpha):
        sm.raise_for_access(
            chart=slice,
        )


def test_raise_for_access_chart_on_admin(
    app_context: None,
) -> None:
    """
    Test that the security manager can raise an exception for chart access,
    when the user does not have access to the chart datasource
    """
    from flask_appbuilder.security.sqla.models import Role, User

    from superset.models.slice import Slice
    from superset.utils.core import override_user

    sm = SupersetSecurityManager(appbuilder)
    session = sm.session

    engine = session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member

    admin = User(
        first_name="Alice",
        last_name="Doe",
        email="adoe@example.org",
        username="admin",
        roles=[Role(name="Admin")],
    )

    slice = Slice(
        id=1,
        datasource_id=1,
        datasource_type="table",
        datasource_name="tmp_perm_table",
        slice_name="slice_name",
    )
    session.add(slice)
    session.flush()

    with override_user(admin):
        sm.raise_for_access(
            chart=slice,
        )


def test_raise_for_access_chart_editor(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that the security manager allows chart access for editors,
    even when the user does not have direct datasource access.
    """
    from tests.integration_tests.base_tests import subjects_from_users

    sm = SupersetSecurityManager(appbuilder)
    session = sm.session

    engine = session.get_bind()
    Slice.metadata.create_all(engine)  # pylint: disable=no-member

    # Check if Alpha role already exists
    alpha_role = session.query(Role).filter_by(name="Alpha").first()
    if not alpha_role:
        alpha_role = Role(name="Alpha")
        session.add(alpha_role)
        session.commit()

    # Check if user already exists
    alpha = session.query(User).filter_by(username="test_chart_owner_user").first()
    if not alpha:
        alpha = User(
            first_name="Alice",
            last_name="Doe",
            email="adoe@example.org",
            username="test_chart_owner_user",
            roles=[alpha_role],
        )
        session.add(alpha)
        session.commit()
    else:
        # Ensure the user has the Alpha role
        if alpha_role not in alpha.roles:
            alpha.roles.append(alpha_role)
            session.commit()

    # Sync the Subject row for alpha (same as production hook)
    from superset.subjects.sync import sync_user_subject

    sync_user_subject(alpha)
    session.commit()

    slice = Slice(
        id=1,
        datasource_id=1,
        datasource_type="table",
        datasource_name="tmp_perm_table",
        slice_name="slice_name",
        editors=subjects_from_users([alpha]),
    )
    session.add(slice)

    with override_user(alpha):
        sm.raise_for_access(
            chart=slice,
        )


def test_query_context_modified(
    mocker: MockerFixture,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    Test the `query_context_modified` function.

    The function is used to ensure guest users are not modifying the request payload on
    embedded dashboard, preventing users from modifying it to access metrics different
    from the ones stored in dashboard charts.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "metrics": stored_metrics,
    }

    query_context.form_data = {
        "slice_id": 42,
        "metrics": stored_metrics,
    }
    query_context.queries = [QueryObject(metrics=stored_metrics)]  # type: ignore
    assert not query_context_modified(query_context)


def test_query_context_modified_tampered(
    mocker: MockerFixture,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    Test the `query_context_modified` function when the request is tampered with.

    The function is used to ensure guest users are not modifying the request payload on
    embedded dashboard, preventing users from modifying it to access metrics different
    from the ones stored in dashboard charts.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "metrics": stored_metrics,
    }

    tampered_metrics = [
        {
            "column": None,
            "expressionType": "SQL",
            "hasCustomLabel": False,
            "label": "COUNT(*) + 2",
            "sqlExpression": "COUNT(*) + 2",
        }
    ]

    query_context.form_data = {
        "slice_id": 42,
        "metrics": tampered_metrics,
    }
    query_context.queries = [QueryObject(metrics=tampered_metrics)]  # type: ignore
    assert query_context_modified(query_context)


def test_query_context_modified_malformed_stored_query_context(
    mocker: MockerFixture,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    A stored ``query_context`` that is not valid JSON (which the query-context-only
    chart update path can persist) must be treated as modified/tampered rather than
    crashing with a raw ``JSONDecodeError``. Returning ``True`` lets
    ``raise_for_access`` deny the guest with the intended 403.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = "not valid json"
    query_context.slice_.params_dict = {
        "metrics": stored_metrics,
    }

    query_context.form_data = {
        "slice_id": 42,
        "metrics": stored_metrics,
    }
    query_context.queries = [QueryObject(metrics=stored_metrics)]  # type: ignore
    assert query_context_modified(query_context)


def test_query_context_modified_injected_annotation_layer(
    mocker: MockerFixture,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    A guest must not be able to inject annotation layers the stored chart
    does not carry: native annotation layers resolve all their annotations
    with no further access check. Replaying the chart's own stored layers is
    not tampering.
    """
    layer = {
        "annotationType": "INTERVAL",
        "sourceType": "NATIVE",
        "value": 1,
        "name": "Incidents",
    }

    # replaying the stored layer is allowed
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "metrics": stored_metrics,
        "annotation_layers": [layer],
    }
    query_context.form_data = {
        "slice_id": 42,
        "metrics": stored_metrics,
        "annotation_layers": [layer],
    }
    query_context.queries = [
        QueryObject(metrics=stored_metrics, annotation_layers=[layer])  # type: ignore
    ]
    assert not query_context_modified(query_context)

    # injecting a layer the chart was not saved with is tampering
    injected = {**layer, "value": 2}
    query_context.slice_.params_dict = {
        "metrics": stored_metrics,
    }
    query_context.form_data = {
        "slice_id": 42,
        "metrics": stored_metrics,
        "annotation_layers": [injected],
    }
    query_context.queries = [
        QueryObject(metrics=stored_metrics, annotation_layers=[injected])  # type: ignore
    ]
    assert query_context_modified(query_context)


def test_query_context_modified_stale_annotation_layer_in_query_context(
    mocker: MockerFixture,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    A layer removed from the chart's current ``params`` is tampering even if
    it still lingers in the chart's cached ``query_context``: a params-only
    chart update can drop a layer without refreshing that stale snapshot, so
    authorization must go by ``params`` alone.
    """
    layer = {
        "annotationType": "INTERVAL",
        "sourceType": "NATIVE",
        "value": 1,
        "name": "Incidents",
    }

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = json.dumps(
        {"queries": [{"annotation_layers": [layer]}]}
    )
    query_context.slice_.params_dict = {
        "metrics": stored_metrics,
    }
    query_context.form_data = {
        "slice_id": 42,
        "metrics": stored_metrics,
        "annotation_layers": [layer],
    }
    query_context.queries = [
        QueryObject(metrics=stored_metrics, annotation_layers=[layer])  # type: ignore
    ]
    assert query_context_modified(query_context)


def test_query_context_modified_result_type_expansion(
    mocker: MockerFixture,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    Requesting the ``samples``/``drill_detail`` result types is tampering:
    the server-side preparers expand those queries to every datasource
    column after the subset checks on columns/metrics have run.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "metrics": stored_metrics,
    }
    query_context.form_data = {
        "slice_id": 42,
        "metrics": stored_metrics,
    }
    query_context.queries = [QueryObject(metrics=stored_metrics)]  # type: ignore

    # Top-level result type rewritten to samples.
    query_context.result_type = ChartDataResultType.SAMPLES
    assert query_context_modified(query_context)

    # Per-query result type rewritten to drill_detail.
    query_context.result_type = ChartDataResultType.FULL
    query_context.queries[0].result_type = ChartDataResultType.DRILL_DETAIL
    assert query_context_modified(query_context)

    # The chart's own result type is not tampering.
    query_context.queries[0].result_type = None
    assert not query_context_modified(query_context)


def test_query_context_modified_result_type_per_query_position(
    mocker: MockerFixture,
    stored_metrics: list[AdhocMetric],
) -> None:
    """
    A chart's queries are validated by position: only the query stored with
    ``samples``/``drill_detail`` may request it, and swapping which query
    index carries that result type is tampering even though the type itself
    is used somewhere on the stored chart.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.params_dict = {"metrics": stored_metrics}
    query_context.slice_.query_context = json.dumps(
        {
            "result_type": "full",
            "queries": [
                {"metrics": stored_metrics, "result_type": "full"},
                {"metrics": stored_metrics, "result_type": "samples"},
            ],
        }
    )
    query_context.form_data = {"slice_id": 42, "metrics": stored_metrics}
    query_context.result_type = ChartDataResultType.FULL

    # Replaying each query's own stored result type, in the stored order, is
    # not tampering.
    query_context.queries = [
        QueryObject(
            metrics=stored_metrics,  # type: ignore
            result_type=ChartDataResultType.FULL,
        ),
        QueryObject(
            metrics=stored_metrics,  # type: ignore
            result_type=ChartDataResultType.SAMPLES,
        ),
    ]
    assert not query_context_modified(query_context)

    # Requesting `samples` for the query stored at index 0 - a position the
    # chart never renders with raw datasource rows - is tampering, even
    # though `samples` is the stored result type of a different query.
    query_context.queries = [
        QueryObject(
            metrics=stored_metrics,  # type: ignore
            result_type=ChartDataResultType.SAMPLES,
        ),
        QueryObject(
            metrics=stored_metrics,  # type: ignore
            result_type=ChartDataResultType.FULL,
        ),
    ]
    assert query_context_modified(query_context)

    # Neither the query nor the query context names a result type: nothing
    # resolves to a row-expanding type, so this is not tampering.
    query_context.result_type = None
    query_context.queries = [
        QueryObject(metrics=stored_metrics),  # type: ignore
        QueryObject(metrics=stored_metrics),  # type: ignore
    ]
    assert not query_context_modified(query_context)


def test_query_context_modified_singular_metric_param(
    mocker: MockerFixture,
) -> None:
    """
    A chart storing its metric under the singular ``metric`` params key (big
    number, world map, ...) generates a payload with a plural ``metrics`` list;
    replaying the chart's own metric is not tampering.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "metric": "sum__SP_POP_TOTL",
        "groupby": [],
    }

    query_context.form_data = {
        "slice_id": 42,
        "metric": "sum__SP_POP_TOTL",
    }
    query_context.queries = [QueryObject(metrics=["sum__SP_POP_TOTL"])]
    assert not query_context_modified(query_context)


def test_query_context_modified_control_specific_column_params(
    mocker: MockerFixture,
) -> None:
    """
    Charts store their queried columns under control-specific params keys
    (``entity``/``series`` for bubble, ``groupby`` for most, the temporal
    column under ``granularity_sqla``); the generated payload carries them in
    ``columns``, which must not read as tampering.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "entity": "country_name",
        "series": "region",
        "granularity_sqla": "year",
        "x": "sum__SP_RUR_TOTL_ZS",
        "y": "sum__SP_DYN_LE00_IN",
        "size": "sum__SP_POP_TOTL",
    }

    query_context.form_data = {"slice_id": 42}
    query_context.queries = [
        QueryObject(
            columns=["country_name", "region", "year"],
            metrics=[
                "sum__SP_RUR_TOTL_ZS",
                "sum__SP_DYN_LE00_IN",
                "sum__SP_POP_TOTL",
            ],
        )
    ]
    assert not query_context_modified(query_context)


def test_query_context_modified_novel_values_still_tampered(
    mocker: MockerFixture,
) -> None:
    """
    The control-specific params equivalence only authorizes exact stored
    values: a metric or column the chart does not reference anywhere is still
    rejected, as is an adhoc expression label-spoofing a stored column.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "metric": "sum__SP_POP_TOTL",
        "entity": "country_code",
        "granularity_sqla": "year",
    }
    query_context.form_data = {"slice_id": 42}

    query_context.queries = [QueryObject(metrics=["sum__SH_DYN_AIDS"])]
    assert query_context_modified(query_context)

    query_context.queries = [QueryObject(columns=["some_other_column"])]
    assert query_context_modified(query_context)

    query_context.queries = [
        QueryObject(
            columns=[
                {"label": "country_code", "sqlExpression": "(select 1)"},
            ],
        )
    ]
    assert query_context_modified(query_context)


def test_query_context_modified_scalar_control_value_not_tampered(
    mocker: MockerFixture,
) -> None:
    """
    Some viz types (e.g. heatmap_v2's ``groupby`` control) store a single
    value as a bare string rather than a one-item list. A guest replaying
    the chart's own stored value for such a control must not be treated as
    tampering.

    Regression test: the comparison iterated ``form_data.get(key)``/
    ``getattr(query, key, [])`` directly without checking whether the value
    was a list. Iterating a Python string yields its individual characters,
    so the requested set never matched anything stored and every such chart
    was permanently rejected for guest users with "Guest user cannot modify
    chart payload", even when nothing was actually modified.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "groupby": "string_column_name",
    }

    query_context.form_data = {
        "slice_id": 42,
        "groupby": "string_column_name",
    }
    query_context.queries = [QueryObject(columns=["string_column_name"])]
    assert not query_context_modified(query_context)


def test_query_context_modified_scalar_control_value_tampered(
    mocker: MockerFixture,
) -> None:
    """
    The scalar-control leniency above only authorizes the chart's own
    stored value: a different single value is still rejected.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "groupby": "string_column_name",
    }

    query_context.form_data = {
        "slice_id": 42,
        "groupby": "some_other_column",
    }
    query_context.queries = [QueryObject(columns=["some_other_column"])]
    assert query_context_modified(query_context)


def test_query_context_modified_unset_scalar_control_not_tampered(
    mocker: MockerFixture,
) -> None:
    """
    An unset scalar control (empty string, or simply absent) must be
    treated as "no value" on the requested side too — symmetric with how
    _stored_param_values treats an unset control on the stored side.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {}  # no groupby saved at all

    query_context.form_data = {
        "slice_id": 42,
        "groupby": "",  # unset control, sent as empty string
    }
    query_context.queries = [QueryObject(columns=[])]
    assert not query_context_modified(query_context)


def _native_filter_ctx(
    mocker: MockerFixture,
    queries: list[Any],
    *,
    native_filter_id: str | None = "F1",
    dashboard_id: int | None = 10,
    dataset_id: int = 20,
    targets: list[Any] | None = None,
    control_values: dict[str, Any] | None = None,
) -> Any:
    """Build a native-filter query context (no slice_) + patched dashboard."""
    if targets is None:
        targets = [{"datasetId": dataset_id, "column": {"name": "region"}}]
    qc = mocker.MagicMock()
    qc.slice_ = None
    qc.form_data = {
        "type": "NATIVE_FILTER",
        "native_filter_id": native_filter_id,
        "dashboardId": dashboard_id,
    }
    qc.datasource.id = dataset_id
    qc.datasource.type = "table"
    qc.queries = queries
    dash = mocker.MagicMock()
    dash.json_metadata = json.dumps(
        {
            "native_filter_configuration": [
                {
                    "id": "F1",
                    "targets": targets,
                    "controlValues": control_values or {},
                }
            ]
        }
    )
    query_chain = mocker.patch("superset.db.session.query")
    query_chain.return_value.filter.return_value.one_or_none.return_value = dash
    return qc


def test_query_context_modified_native_filter_target_column_allowed(
    mocker: MockerFixture,
) -> None:
    """A native-filter request reading only its target column is allowed."""
    query = SimpleNamespace(columns=["region"], metrics=[], groupby=[])
    qc = _native_filter_ctx(mocker, [query])
    assert not query_context_modified(qc)


def test_query_context_modified_native_filter_arbitrary_column_blocked(
    mocker: MockerFixture,
) -> None:
    """A native-filter request reading a non-target column is modified."""
    query = SimpleNamespace(columns=["ssn"], metrics=[], groupby=[])
    qc = _native_filter_ctx(mocker, [query])
    assert query_context_modified(qc)


def test_query_context_modified_native_filter_simple_metric_on_target_allowed(
    mocker: MockerFixture,
) -> None:
    """A range-style request (simple aggregate over the target column) is allowed."""
    query = SimpleNamespace(
        columns=[],
        metrics=[
            {
                "expressionType": "SIMPLE",
                "column": {"column_name": "region"},
                "aggregate": "MIN",
            }
        ],
        groupby=[],
    )
    qc = _native_filter_ctx(mocker, [query])
    assert not query_context_modified(qc)


def test_query_context_modified_native_filter_adhoc_metric_blocked(
    mocker: MockerFixture,
) -> None:
    """A free-form SQL metric on the native-filter path is modified."""
    query = SimpleNamespace(
        columns=[],
        metrics=[{"expressionType": "SQL", "sqlExpression": "SUM(salary)"}],
        groupby=[],
    )
    qc = _native_filter_ctx(mocker, [query])
    assert query_context_modified(qc)


def test_query_context_modified_native_filter_adhoc_column_blocked(
    mocker: MockerFixture,
) -> None:
    """An adhoc (free-form SQL) column on the native-filter path is modified."""
    query = SimpleNamespace(
        columns=[{"sqlExpression": "ssn", "label": "x"}], metrics=[], groupby=[]
    )
    qc = _native_filter_ctx(mocker, [query])
    assert query_context_modified(qc)


def test_query_context_modified_native_filter_no_filter_context_blocked(
    mocker: MockerFixture,
) -> None:
    """Without a native_filter_id / dashboardId the request fails closed."""
    query = SimpleNamespace(columns=["region"], metrics=[], groupby=[])
    qc = _native_filter_ctx(mocker, [query], native_filter_id=None)
    assert query_context_modified(qc)


def test_query_context_modified_native_filter_configured_sort_metric_allowed(
    mocker: MockerFixture,
) -> None:
    """A value lookup sorted by the filter's configured saved metric is allowed."""
    query = SimpleNamespace(
        columns=["region"],
        metrics=["total"],
        groupby=[],
        orderby=[["total", True]],
    )
    qc = _native_filter_ctx(mocker, [query], control_values={"sortMetric": "total"})
    assert not query_context_modified(qc)


def test_query_context_modified_native_filter_arbitrary_saved_metric_blocked(
    mocker: MockerFixture,
) -> None:
    """A saved metric other than the filter's configured sort metric is modified."""
    query = SimpleNamespace(columns=["region"], metrics=["salary_total"], groupby=[])
    qc = _native_filter_ctx(mocker, [query], control_values={"sortMetric": "total"})
    assert query_context_modified(qc)


def test_query_context_modified_native_filter_series_limit_terms_blocked(
    mocker: MockerFixture,
) -> None:
    """A series-limit metric or series column beyond the target is modified."""
    query = SimpleNamespace(
        columns=["region"],
        metrics=[],
        groupby=[],
        series_columns=["region"],
        series_limit=5,
        series_limit_metric={
            "expressionType": "SIMPLE",
            "column": {"column_name": "salary"},
            "aggregate": "MAX",
        },
    )
    qc = _native_filter_ctx(mocker, [query])
    assert query_context_modified(qc)

    query = SimpleNamespace(
        columns=["region"], metrics=[], groupby=[], series_columns=["ssn"]
    )
    qc = _native_filter_ctx(mocker, [query])
    assert query_context_modified(qc)


def test_query_context_modified_native_filter_orderby_arbitrary_column_blocked(
    mocker: MockerFixture,
) -> None:
    """Ordering by a non-target column on the native-filter path is modified."""
    query = SimpleNamespace(
        columns=["region"], metrics=[], groupby=[], orderby=[["ssn", True]]
    )
    qc = _native_filter_ctx(mocker, [query])
    assert query_context_modified(qc)


def test_query_context_modified_native_filter_orderby_adhoc_blocked(
    mocker: MockerFixture,
) -> None:
    """Ordering by a free-form SQL expression on the native-filter path is modified."""
    query = SimpleNamespace(
        columns=["region"],
        metrics=[],
        groupby=[],
        orderby=[[{"sqlExpression": "ssn"}, True]],
    )
    qc = _native_filter_ctx(mocker, [query])
    assert query_context_modified(qc)


def test_query_context_modified_chartless_non_native_filter_allowed(
    mocker: MockerFixture,
) -> None:
    """
    A chartless request that is not a native filter (drill-to-detail, drill-by,
    samples) is validated by the datasource-access checks in raise_for_access and
    is not constrained here.
    """
    qc = mocker.MagicMock()
    qc.slice_ = None
    qc.form_data = {"dashboardId": 10, "slice_id": 0, "groupby": ["ssn"]}
    assert not query_context_modified(qc)


def test_query_context_modified_drill_by_row_expanding_result_type_blocked(
    mocker: MockerFixture,
) -> None:
    """
    A Drill By request (``slice_id`` 0 sentinel + source ``chart_id``) is
    rejected when it asks for a row-expanding result type: that would bypass
    the drillable-dimension allowlist raise_for_access already checked for it
    and return every column instead.
    """
    query = SimpleNamespace(
        columns=[], metrics=[], groupby=["region"], result_type="samples"
    )
    qc = mocker.MagicMock()
    qc.slice_ = None
    qc.form_data = {
        "dashboardId": 10,
        "slice_id": 0,
        "chart_id": 5,
        "groupby": ["region"],
    }
    qc.queries = [query]
    assert query_context_modified(qc)

    query.result_type = "drill_detail"
    assert query_context_modified(qc)


def test_query_context_modified_drill_to_detail_row_expanding_result_type_allowed(
    mocker: MockerFixture,
) -> None:
    """
    Drill to Detail (no ``slice_id``/``chart_id`` at all) is unaffected: it is
    already meant to expose every column of a dataset attached to the
    dashboard, and is validated by raise_for_access rather than here.
    """
    query = SimpleNamespace(
        columns=[], metrics=[], groupby=[], result_type="drill_detail"
    )
    qc = mocker.MagicMock()
    qc.slice_ = None
    qc.form_data = {"dashboardId": 10}
    qc.queries = [query]
    assert not query_context_modified(qc)


def test_query_context_modified_native_filter_row_expanding_result_type_blocked(
    mocker: MockerFixture,
) -> None:
    """
    A native-filter request limited to its target column is still rejected
    when it asks for a row-expanding result type (``samples``/``drill_detail``):
    those preparers replace the column list with every datasource column,
    which would bypass the target-column allowlist entirely.
    """
    query = SimpleNamespace(
        columns=["region"], metrics=[], groupby=[], result_type="samples"
    )
    qc = _native_filter_ctx(mocker, [query])
    assert query_context_modified(qc)

    query = SimpleNamespace(
        columns=["region"], metrics=[], groupby=[], result_type="drill_detail"
    )
    qc = _native_filter_ctx(mocker, [query])
    assert query_context_modified(qc)


def test_query_context_modified_native_filter_without_type_marker_blocked(
    mocker: MockerFixture,
) -> None:
    """
    A request identified by native_filter_id is constrained even when the
    NATIVE_FILTER type marker is absent.
    """
    query = SimpleNamespace(columns=["ssn"], metrics=[], groupby=[])
    qc = _native_filter_ctx(mocker, [query])
    del qc.form_data["type"]
    assert query_context_modified(qc)


def test_query_context_modified_mixed_chart(mocker: MockerFixture) -> None:
    """
    Test the `query_context_modified` function for a mixed chart request.

    The metrics in the mixed chart are a nested dictionary (due to `columns`), and need
    to be serialized to JSON with the keys sorted in order to compare the request
    metrics with the chart metrics.
    """
    stored_metrics = [
        {
            "optionName": "metric_vgops097wej_g8uff99zhk7",
            "label": "AVG(num)",
            "expressionType": "SIMPLE",
            "column": {"column_name": "num", "type": "BIGINT(20)"},
            "aggregate": "AVG",
        }
    ]
    # different order (remember, dicts have order!)
    requested_metrics = [
        {
            "aggregate": "AVG",
            "column": {"column_name": "num", "type": "BIGINT(20)"},
            "expressionType": "SIMPLE",
            "label": "AVG(num)",
            "optionName": "metric_vgops097wej_g8uff99zhk7",
        }
    ]

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "metrics": stored_metrics,
    }

    query_context.form_data = {
        "slice_id": 42,
        "metrics": requested_metrics,
    }
    query_context.queries = [QueryObject(metrics=requested_metrics)]  # type: ignore
    assert not query_context_modified(query_context)


def test_query_context_modified_sankey_tampered(mocker: MockerFixture) -> None:
    """
    Test the `query_context_modified` function for a sankey chart request.
    """
    query_context = mocker.MagicMock()
    query_context.queries = [
        QueryObject(
            apply_fetch_values_predicate=False,
            columns=["bot_id", "channel_id"],
            extras={"having": "", "where": ""},
            filter=[
                {
                    "col": "bot_profile__updated",
                    "op": "TEMPORAL_RANGE",
                    "val": "No filter",
                }
            ],
            from_dttm=None,
            granularity=None,
            inner_from_dttm=None,
            inner_to_dttm=None,
            is_rowcount=False,
            is_timeseries=False,
            metrics=["count"],
            order_desc=True,
            orderby=[],
            row_limit=10000,
            row_offset=0,
            series_columns=[],
            series_limit=0,
            series_limit_metric=None,
            time_shift=None,
            to_dttm=None,
        ),
    ]
    query_context.form_data = {
        "datasource": "12__table",
        "viz_type": "sankey_v2",
        "slice_id": 97,
        "url_params": {},
        "source": "bot_id",
        "target": "channel_id",
        "metric": "count",
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": "No filter",
                "expressionType": "SIMPLE",
                "operator": "TEMPORAL_RANGE",
                "subject": "bot_profile__updated",
            }
        ],
        "row_limit": 10000,
        "color_scheme": "supersetColors",
        "dashboards": [11],
        "extra_form_data": {},
        "label_colors": {},
        "shared_label_colors": [],
        "map_label_colors": {},
        "extra_filters": [],
        "dashboardId": 11,
        "force": False,
        "result_format": "json",
        "result_type": "full",
    }
    query_context.slice_.id = 97
    query_context.slice_.params_dict = {
        "datasource": "12__table",
        "viz_type": "sankey_v2",
        "slice_id": 97,
        "source": "bot_id",
        "target": "channel_id",
        "metric": "count",
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": "No filter",
                "expressionType": "SIMPLE",
                "operator": "TEMPORAL_RANGE",
                "subject": "bot_profile__updated",
            }
        ],
        "row_limit": 10000,
        "color_scheme": "supersetColors",
        "extra_form_data": {},
        "dashboards": [11],
    }
    query_context.slice_.query_context = json.dumps(
        {
            "datasource": {"id": 12, "type": "table"},
            "force": False,
            "queries": [
                {
                    "filters": [
                        {
                            "col": "bot_profile__updated",
                            "op": "TEMPORAL_RANGE",
                            "val": "No filter",
                        }
                    ],
                    "extras": {"having": "", "where": ""},
                    "applied_time_extras": {},
                    "columns": [],
                    "metrics": ["count"],
                    "annotation_layers": [],
                    "row_limit": 10000,
                    "series_limit": 0,
                    "order_desc": True,
                    "url_params": {},
                    "custom_params": {},
                    "custom_form_data": {},
                    "groupby": ["bot_id", "channel_id"],
                }
            ],
            "form_data": {
                "datasource": "12__table",
                "viz_type": "sankey_v2",
                "slice_id": 97,
                "source": "bot_id",
                "target": "channel_id",
                "metric": "count",
                "adhoc_filters": [
                    {
                        "clause": "WHERE",
                        "comparator": "No filter",
                        "expressionType": "SIMPLE",
                        "operator": "TEMPORAL_RANGE",
                        "subject": "bot_profile__updated",
                    }
                ],
                "row_limit": 10000,
                "color_scheme": "supersetColors",
                "extra_form_data": {},
                "dashboards": [11],
                "force": False,
                "result_format": "json",
                "result_type": "full",
            },
            "result_format": "json",
            "result_type": "full",
        }
    )
    assert not query_context_modified(query_context)


def test_query_context_modified_orderby(mocker: MockerFixture) -> None:
    """
    Test the `query_context_modified` function when the ORDER BY is modified.
    """
    tampered_groupby: AdhocMetric = {
        "aggregate": "",
        "column": None,
        "expressionType": "SQL",
        "hasCustomLabel": False,
        "label": "random()",
        "sqlExpression": "random()",
    }

    query_context = mocker.MagicMock()
    query_context.queries = [
        QueryObject(
            apply_fetch_values_predicate=False,
            columns=["gender"],
            extras={"having": "", "where": ""},
            filter=[{"col": "ds", "op": "TEMPORAL_RANGE", "val": "No filter"}],
            from_dttm=None,
            granularity=None,
            inner_from_dttm=None,
            inner_to_dttm=None,
            is_rowcount=False,
            is_timeseries=False,
            metrics=["count"],
            order_desc=True,
            orderby=[(tampered_groupby, False)],
            row_limit=1000,
            row_offset=0,
            series_columns=[],
            series_limit=0,
            series_limit_metric=tampered_groupby,
            time_shift=None,
            to_dttm=None,
        ),
    ]
    query_context.form_data = {
        "datasource": "2__table",
        "viz_type": "table",
        "slice_id": 101,
        "url_params": {
            "datasource_id": "2",
            "datasource_type": "table",
            "save_action": "saveas",
            "slice_id": "101",
        },
        "query_mode": "aggregate",
        "groupby": ["gender"],
        "time_grain_sqla": "P1D",
        "temporal_columns_lookup": {"ds": True},
        "metrics": ["count"],
        "all_columns": [],
        "percent_metrics": [],
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": "No filter",
                "expressionType": "SIMPLE",
                "operator": "TEMPORAL_RANGE",
                "subject": "ds",
            }
        ],
        "timeseries_limit_metric": {
            "aggregate": None,
            "column": None,
            "datasourceWarning": False,
            "expressionType": "SQL",
            "hasCustomLabel": False,
            "label": "random()",
            "optionName": "metric_3kwbghgzkv9_wz84h9j1p5d",
            "sqlExpression": "random()",
        },
        "order_by_cols": [],
        "row_limit": 1000,
        "server_page_length": 10,
        "order_desc": True,
        "table_timestamp_format": "smart_date",
        "allow_render_html": True,
        "show_cell_bars": True,
        "color_pn": True,
        "comparison_color_scheme": "Green",
        "comparison_type": "values",
        "extra_form_data": {},
        "force": False,
        "result_format": "json",
        "result_type": "full",
    }
    query_context.slice_.id = 101
    query_context.slice_.params_dict = {
        "datasource": "2__table",
        "viz_type": "table",
        "query_mode": "aggregate",
        "groupby": ["gender"],
        "time_grain_sqla": "P1D",
        "temporal_columns_lookup": {"ds": True},
        "metrics": ["count"],
        "all_columns": [],
        "percent_metrics": [],
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "subject": "ds",
                "operator": "TEMPORAL_RANGE",
                "comparator": "No filter",
                "expressionType": "SIMPLE",
            }
        ],
        "order_by_cols": [],
        "row_limit": 1000,
        "server_page_length": 10,
        "order_desc": True,
        "table_timestamp_format": "smart_date",
        "allow_render_html": True,
        "show_cell_bars": True,
        "color_pn": True,
        "comparison_color_scheme": "Green",
        "comparison_type": "values",
        "extra_form_data": {},
        "dashboards": [],
    }
    query_context.slice_.query_context = json.dumps(
        {
            "datasource": {"id": 2, "type": "table"},
            "force": False,
            "queries": [
                {
                    "filters": [
                        {"col": "ds", "op": "TEMPORAL_RANGE", "val": "No filter"}
                    ],
                    "extras": {"having": "", "where": ""},
                    "applied_time_extras": {},
                    "columns": ["gender"],
                    "metrics": ["count"],
                    "orderby": [],
                    "annotation_layers": [],
                    "row_limit": 1000,
                    "series_limit": 0,
                    "order_desc": True,
                    "url_params": {},
                    "custom_params": {},
                    "custom_form_data": {},
                    "post_processing": [],
                    "time_offsets": [],
                }
            ],
            "form_data": {
                "datasource": "2__table",
                "viz_type": "table",
                "query_mode": "aggregate",
                "groupby": ["gender"],
                "time_grain_sqla": "P1D",
                "temporal_columns_lookup": {"ds": True},
                "metrics": ["count"],
                "all_columns": [],
                "percent_metrics": [],
                "adhoc_filters": [
                    {
                        "clause": "WHERE",
                        "subject": "ds",
                        "operator": "TEMPORAL_RANGE",
                        "comparator": "No filter",
                        "expressionType": "SIMPLE",
                    }
                ],
                "order_by_cols": [],
                "row_limit": 1000,
                "server_page_length": 10,
                "order_desc": True,
                "table_timestamp_format": "smart_date",
                "allow_render_html": True,
                "show_cell_bars": True,
                "color_pn": True,
                "comparison_color_scheme": "Green",
                "comparison_type": "values",
                "extra_form_data": {},
                "dashboards": [],
                "force": False,
                "result_format": "json",
                "result_type": "full",
            },
            "result_format": "json",
            "result_type": "full",
        }
    )
    assert query_context_modified(query_context)


def _table_sort_query_context(
    mocker: MockerFixture,
    orderby: list[Any],
    *,
    stored_metrics: Optional[list[Any]] = None,
    with_stored_query_context: bool = True,
) -> Any:
    """
    Build a minimal table-chart query context for a guest that sorts by
    ``orderby``. The stored chart groups by ``gender`` and aggregates ``count``.
    """
    metrics: list[Any] = stored_metrics if stored_metrics is not None else ["count"]
    query_context = mocker.MagicMock()
    query_context.queries = [
        QueryObject(columns=["gender"], metrics=metrics, orderby=orderby),
    ]
    query_context.form_data = {"slice_id": 101, "groupby": ["gender"]}
    query_context.slice_.id = 101
    query_context.slice_.params_dict = {"groupby": ["gender"], "metrics": metrics}
    query_context.slice_.query_context = (
        json.dumps({"queries": [{"columns": ["gender"], "metrics": metrics}]})
        if with_stored_query_context
        else None
    )
    return query_context


def _series_limit_metric_query_context(
    mocker: MockerFixture,
    requested_metric: Any,
    *,
    stored_metrics: Optional[list[Any]] = None,
    form_metric_key: str = "series_limit_metric",
) -> Any:
    """
    Build a minimal chart query context with a series-limit metric selector.
    """
    metrics: list[Any] = stored_metrics if stored_metrics is not None else ["count"]
    query_kwargs: dict[str, Any] = {"metrics": metrics}
    if form_metric_key == "series_limit_metric":
        query_kwargs["series_limit_metric"] = requested_metric

    query_context = mocker.MagicMock()
    query_context.queries = [
        QueryObject(**query_kwargs),
    ]
    query_context.form_data = {
        "slice_id": 101,
        "metrics": metrics,
        form_metric_key: requested_metric,
    }
    query_context.slice_.id = 101
    query_context.slice_.params_dict = {
        "metrics": metrics,
    }
    query_context.slice_.query_context = json.dumps({"queries": [{"metrics": metrics}]})
    return query_context


def test_query_context_modified_orderby_sort_by_column(mocker: MockerFixture) -> None:
    """A guest sorting an embedded table by an existing column is allowed."""
    query_context = _table_sort_query_context(mocker, orderby=[("gender", True)])
    assert not query_context_modified(query_context)


def test_query_context_modified_orderby_sort_by_metric(mocker: MockerFixture) -> None:
    """A guest sorting by an existing metric is allowed."""
    query_context = _table_sort_query_context(mocker, orderby=[("count", False)])
    assert not query_context_modified(query_context)


def test_query_context_modified_orderby_sort_by_adhoc_metric(
    mocker: MockerFixture,
) -> None:
    """A guest sorting by an existing adhoc metric definition is allowed."""
    adhoc_metric: AdhocMetric = {
        "aggregate": "SUM",
        "column": {"column_name": "num"},
        "expressionType": "SIMPLE",
        "hasCustomLabel": False,
        "label": "SUM(num)",
    }
    query_context = _table_sort_query_context(
        mocker,
        orderby=[(adhoc_metric, False)],
        stored_metrics=[adhoc_metric],
    )
    assert not query_context_modified(query_context)


def test_query_context_modified_orderby_unknown_column(mocker: MockerFixture) -> None:
    """A guest sorting by a column the chart does not reference is rejected."""
    query_context = _table_sort_query_context(mocker, orderby=[("salary", True)])
    assert query_context_modified(query_context)


def test_query_context_modified_orderby_empty(mocker: MockerFixture) -> None:
    """An empty order-by is not a modification."""
    query_context = _table_sort_query_context(mocker, orderby=[])
    assert not query_context_modified(query_context)


def test_query_context_modified_orderby_legacy_singular_metric(
    mocker: MockerFixture,
) -> None:
    """A guest sorting by a legacy ``metric`` (singular) field is allowed."""
    query_context = _table_sort_query_context(
        mocker,
        orderby=[("num_sold", False)],
        stored_metrics=[],
        with_stored_query_context=False,
    )
    query_context.slice_.params_dict = {
        "columns": ["gender"],
        "groupby": ["gender"],
        "metric": "num_sold",
    }
    assert not query_context_modified(query_context)


def test_query_context_modified_orderby_malformed_entry(
    mocker: MockerFixture,
) -> None:
    """A malformed order-by entry (not a ``(term, bool)`` pair) is rejected."""
    query_context = _table_sort_query_context(mocker, orderby=[["gender"]])
    assert query_context_modified(query_context)


def test_query_context_modified_orderby_sort_by_stored_qc_only_column(
    mocker: MockerFixture,
) -> None:
    """A column present only in the stored query context is an allowed sort target."""
    query_context = _table_sort_query_context(mocker, orderby=[("age", True)])
    # "age" is absent from params_dict but exposed via the stored query context,
    # so sorting by it must be allowed.
    query_context.slice_.params_dict = {"groupby": ["gender"], "metrics": ["count"]}
    query_context.slice_.query_context = json.dumps(
        {"queries": [{"columns": ["gender", "age"], "metrics": ["count"]}]}
    )
    assert not query_context_modified(query_context)


def test_collect_sortable_identifiers_includes_stored_qc_all_columns(
    mocker: MockerFixture,
) -> None:
    """``all_columns`` exposed via the stored query context is a valid sort target."""
    stored_chart = mocker.MagicMock()
    stored_chart.params_dict = {"groupby": ["gender"], "metrics": ["count"]}
    allowed = _collect_sortable_identifiers(
        stored_chart,
        {"queries": [{"all_columns": ["gender", "age"], "metrics": ["count"]}]},
    )
    assert freeze_value("age") in allowed


def test_query_context_modified_time_grain_native_filter(
    mocker: MockerFixture,
) -> None:
    """
    Test `query_context_modified` when a guest applies a Time Grain native filter.

    Reproduces https://github.com/apache/superset/issues/32768.

    On a chart that uses a generic x-axis, the selected time grain is baked into the
    ``BASE_AXIS`` adhoc column as a ``timeGrain`` property (see
    ``normalizeTimeColumn`` on the frontend, which copies ``extras.time_grain_sqla``
    onto the column). A Time Grain native filter is a supported, read-only guest
    interaction: it only changes the granularity at which the *same* dimension is
    bucketed, never which metrics or columns are queried.

    Previously, because the changed time grain travels inside the ``columns``
    payload, the subset comparison treated the request as tampering and
    ``query_context_modified`` returned ``True`` -- so guests hit "Guest user cannot
    modify chart payload" whenever they picked a grain other than the chart default.

    ``freeze_value`` now drops the guest-overridable ``timeGrain`` key before
    comparing, so a pure time-grain change is no longer flagged as a modification.
    This test guards that behavior.
    """
    # The chart was saved with a monthly grain on its x-axis column.
    stored_axis_column: AdhocColumn = {
        "label": "order_date",
        "sqlExpression": "order_date",
        "columnType": "BASE_AXIS",
        "timeGrain": "P1M",
    }
    # The guest picked a daily grain via the dashboard Time Grain native filter;
    # `normalizeTimeColumn` rewrote the otherwise-identical column accordingly.
    requested_axis_column: AdhocColumn = {
        **stored_axis_column,
        "timeGrain": "P1D",
    }

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.params_dict = {
        "metrics": ["count"],
    }
    query_context.slice_.query_context = json.dumps(
        {
            "queries": [
                {
                    "columns": [stored_axis_column],
                    "metrics": ["count"],
                }
            ],
        }
    )
    # Native-filter data requests don't carry the mutated columns at the top level;
    # the grain change only shows up inside the query's columns.
    query_context.form_data = {
        "slice_id": 42,
        "metrics": ["count"],
    }
    query_context.queries = [
        QueryObject(
            columns=[requested_axis_column],
            metrics=["count"],
        ),
    ]

    assert not query_context_modified(query_context)


def test_query_context_modified_orderby_visible_column_allowed(
    mocker: MockerFixture,
) -> None:
    """
    Test that guest user can sort by a visible column (whitelist approach).
    """
    query_context: MagicMock = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": ["name", "country"],
        "groupby": [],
        "metrics": ["count"],
    }
    query_context.form_data = {
        "slice_id": 42,
        "columns": ["name"],
        "metrics": ["count"],
        "orderby": [["name", True]],  # Sort by visible column
    }
    query_context.queries = []

    assert not query_context_modified(query_context)


def test_query_context_modified_time_grain_with_tampered_column(
    mocker: MockerFixture,
) -> None:
    """
    Test that relaxing the time grain comparison does not open a tamper hole.

    Only the ``timeGrain`` key is guest-overridable. A request that changes the
    grain *and* also swaps a non-overridable attribute (here ``sqlExpression``,
    which selects which column is queried) must still be flagged as tampering --
    otherwise a guest could query an arbitrary column under cover of a Time Grain
    filter.
    """
    stored_axis_column: AdhocColumn = {
        "label": "order_date",
        "sqlExpression": "order_date",
        "columnType": "BASE_AXIS",
        "timeGrain": "P1M",
    }
    # Guest changes the grain (allowed) but also rewrites the SQL expression to a
    # different column (not allowed) -- this must still read as a modification.
    tampered_axis_column: AdhocColumn = {
        **stored_axis_column,
        "sqlExpression": "secret_column",
        "timeGrain": "P1D",
    }

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.params_dict = {
        "metrics": ["count"],
    }
    query_context.slice_.query_context = json.dumps(
        {
            "queries": [
                {
                    "columns": [stored_axis_column],
                    "metrics": ["count"],
                }
            ],
        }
    )
    query_context.form_data = {
        "slice_id": 42,
        "metrics": ["count"],
    }
    query_context.queries = [
        QueryObject(
            columns=[tampered_axis_column],
            metrics=["count"],
        ),
    ]

    assert query_context_modified(query_context)


def test_query_context_modified_orderby_hidden_column_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that guest user cannot sort by a hidden column (data exfiltration prevention).
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": ["name"],
        "groupby": [],
        "metrics": ["count"],
    }
    query_context.form_data = {
        "slice_id": 42,
        "columns": ["name"],
        "metrics": ["count"],
        "orderby": [["credit_card_number", True]],  # Hidden column - blocked!
    }
    query_context.queries = []

    assert query_context_modified(query_context)


def test_query_context_modified_time_grain_in_orderby(
    mocker: MockerFixture,
) -> None:
    """
    Test `query_context_modified` when the time grain travels inside `orderby`.

    Each ``orderby`` entry is an ``(column, bool)`` tuple, so a temporal x-axis
    adhoc column carrying the guest-overridable ``timeGrain`` is nested one level
    deep rather than sitting at the top level. The overridable key must still be
    stripped before comparing, otherwise sorting by the temporal axis would make
    a pure time-grain change read as tampering.
    """
    stored_axis_column: AdhocColumn = {
        "label": "order_date",
        "sqlExpression": "order_date",
        "columnType": "BASE_AXIS",
        "timeGrain": "P1M",
    }
    requested_axis_column: AdhocColumn = {
        **stored_axis_column,
        "timeGrain": "P1D",
    }

    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.params_dict = {
        "metrics": ["count"],
    }
    query_context.slice_.query_context = json.dumps(
        {
            "queries": [
                {
                    "orderby": [[stored_axis_column, True]],
                    "metrics": ["count"],
                }
            ],
        }
    )
    query_context.form_data = {
        "slice_id": 42,
        "metrics": ["count"],
    }
    query_context.queries = [
        QueryObject(
            orderby=[(requested_axis_column, True)],
            metrics=["count"],
        ),
    ]

    assert not query_context_modified(query_context)


def test_query_context_modified_orderby_direction_change_allowed(
    mocker: MockerFixture,
) -> None:
    """
    Test that changing sort direction (ASC/DESC) is allowed for visible columns.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": ["name"],
        "groupby": [],
        "metrics": ["count"],
        "orderby": [["name", True]],  # Original: ASC
    }
    query_context.form_data = {
        "slice_id": 42,
        "columns": ["name"],
        "metrics": ["count"],
        "orderby": [["name", False]],  # Changed to DESC - should be allowed
    }
    query_context.queries = []

    assert not query_context_modified(query_context)


def test_query_context_modified_orderby_raw_table_all_columns_allowed(
    mocker: MockerFixture,
) -> None:
    """
    Test that a raw-records Table chart can be sorted by its `all_columns`.

    The Table plugin's raw "Query mode" stores its selected columns under
    `all_columns` rather than `columns`, so guests must be able to sort by them.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "query_mode": "raw",
        "all_columns": ["name", "country"],
        "orderby": [],
    }
    query_context.form_data = {
        "slice_id": 42,
        "orderby": [["country", True]],  # Sort by a raw-mode column
    }
    query_context.queries = []

    assert not query_context_modified(query_context)


def test_query_context_modified_orderby_column_config_hidden_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that hidden Table columns cannot be used for guest sorting.

    Table renders only columns whose column_config entry is not visible=false,
    so a manually supplied sort by a hidden-but-selected column must be blocked.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "query_mode": "raw",
        "all_columns": ["name", "secret_column"],
        "column_config": {
            "secret_column": {
                "visible": False,
            },
        },
    }
    query_context.form_data = {
        "slice_id": 42,
        "orderby": [["secret_column", True]],
    }
    query_context.queries = [
        QueryObject(
            orderby=[("secret_column", True)],
        ),
    ]

    assert query_context_modified(query_context)


def test_query_context_modified_orderby_adhoc_metric_without_label_allowed(
    mocker: MockerFixture,
) -> None:
    """
    Test that guests may sort by a visible adhoc SIMPLE metric without a label.
    """
    metric: AdhocMetric = {
        "expressionType": "SIMPLE",
        "column": {"column_name": "sales", "type": "BIGINT"},
        "aggregate": "SUM",
    }
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": ["name"],
        "metrics": [metric],
        "orderby": [],
    }
    query_context.form_data = {
        "slice_id": 42,
        "columns": ["name"],
        "metrics": [metric],
        "orderby": [["SUM(sales)", True]],
    }
    query_context.queries = [
        QueryObject(
            columns=["name"],
            metrics=[metric],
            orderby=[("SUM(sales)", True)],
        ),
    ]

    assert not query_context_modified(query_context)


def test_query_context_modified_orderby_simple_metric_reused_metric_label_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that dict-shaped orderby terms cannot pass by reusing a metric label.
    """
    metric: AdhocMetric = {
        "expressionType": "SIMPLE",
        "column": {"column_name": "secret_sales"},
        "aggregate": "SUM",
        "label": "count",
    }
    query_context = _table_sort_query_context(
        mocker,
        orderby=[(metric, True)],
        stored_metrics=["count"],
    )

    assert query_context_modified(query_context)


def test_query_context_modified_orderby_simple_metric_reused_column_label_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that dict-shaped orderby terms cannot pass by reusing a column label.
    """
    metric: AdhocMetric = {
        "expressionType": "SIMPLE",
        "column": {"column_name": "secret_sales"},
        "aggregate": "SUM",
        "label": "name",
    }
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": ["name"],
        "metrics": ["count"],
    }
    query_context.form_data = {
        "slice_id": 42,
        "columns": ["name"],
        "metrics": ["count"],
        "orderby": [[metric, True]],
    }
    query_context.queries = [
        QueryObject(
            columns=["name"],
            metrics=["count"],
            orderby=[(metric, True)],
        ),
    ]

    assert query_context_modified(query_context)


def test_query_context_modified_orderby_simple_metric_bad_aggregate_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that malformed SIMPLE metric orderby cannot pass through label spoofing.
    """
    metric: AdhocMetric = {
        "expressionType": "SIMPLE",
        "column": {"column_name": "secret_sales"},
        "label": "count",
    }
    query_context = _table_sort_query_context(
        mocker,
        orderby=[(metric, True)],
        stored_metrics=["count"],
    )

    assert query_context_modified(query_context)


def test_query_context_modified_orderby_adhoc_column_label_allowed(
    mocker: MockerFixture,
) -> None:
    """
    Test that guests may sort by a visible adhoc column result key.
    """
    column: AdhocColumn = {
        "label": "Full Name",
        "sqlExpression": "CONCAT(first_name, last_name)",
    }
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": [column],
        "metrics": ["count"],
    }
    query_context.form_data = {
        "slice_id": 42,
        "columns": [column],
        "metrics": ["count"],
        "orderby": [["Full Name", True]],
    }
    query_context.queries = [
        QueryObject(
            columns=[column],
            metrics=["count"],
            orderby=[("Full Name", True)],
        ),
    ]

    assert not query_context_modified(query_context)


def test_query_context_modified_orderby_hidden_stored_orderby_replay_allowed(
    mocker: MockerFixture,
) -> None:
    """
    Test that replaying an exact owner-defined orderby is not tampering.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "all_columns": ["name", "secret_column"],
        "column_config": {
            "secret_column": {
                "visible": False,
            },
        },
        "orderby": [["secret_column", True]],
    }
    query_context.form_data = {
        "slice_id": 42,
        "orderby": [["secret_column", True]],
    }
    query_context.queries = [
        QueryObject(
            orderby=[("secret_column", True)],
        ),
    ]

    assert not query_context_modified(query_context)


def test_query_context_modified_orderby_hidden_stored_orderby_direction_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that guests cannot change direction on a hidden owner-defined sort.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "all_columns": ["name", "secret_column"],
        "column_config": {
            "secret_column": {
                "visible": False,
            },
        },
        "orderby": [["secret_column", True]],
    }
    query_context.form_data = {
        "slice_id": 42,
        "orderby": [["secret_column", False]],
    }
    query_context.queries = [
        QueryObject(
            orderby=[("secret_column", False)],
        ),
    ]

    assert query_context_modified(query_context)


def test_query_context_modified_orderby_sql_expression_reused_label_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that a new SQL expression object cannot pass by reusing a visible label.
    """
    sql_expression: AdhocColumn = {
        "label": "name",
        "sqlExpression": "random()",
    }
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": ["name"],
        "metrics": ["count"],
    }
    query_context.form_data = {
        "slice_id": 42,
        "columns": ["name"],
        "metrics": ["count"],
        "orderby": [[sql_expression, True]],
    }
    query_context.queries = [
        QueryObject(
            columns=["name"],
            metrics=["count"],
            orderby=[(sql_expression, True)],
        ),
    ]

    assert query_context_modified(query_context)


def test_query_context_modified_series_limit_metric_stored_metric_allowed(
    mocker: MockerFixture,
) -> None:
    """
    Test that a stored metric can be reused as the series-limit selector.
    """
    query_context = _series_limit_metric_query_context(
        mocker,
        requested_metric="count",
        stored_metrics=["count"],
    )

    assert not query_context_modified(query_context)


def test_query_context_modified_timeseries_limit_metric_stored_metric_allowed(
    mocker: MockerFixture,
) -> None:
    """
    Test that the deprecated form-data control name follows the same guard.
    """
    query_context = _series_limit_metric_query_context(
        mocker,
        requested_metric="count",
        stored_metrics=["count"],
        form_metric_key="timeseries_limit_metric",
    )

    assert not query_context_modified(query_context)


def test_query_context_modified_series_limit_metric_exact_adhoc_metric_allowed(
    mocker: MockerFixture,
) -> None:
    """
    Test that a stored adhoc metric can be reused as the series-limit selector.
    """
    metric: AdhocMetric = {
        "expressionType": "SIMPLE",
        "column": {"column_name": "sales"},
        "aggregate": "SUM",
        "label": "SUM(sales)",
    }
    query_context = _series_limit_metric_query_context(
        mocker,
        requested_metric=metric,
        stored_metrics=[metric],
    )

    assert not query_context_modified(query_context)


def test_query_context_modified_series_limit_metric_off_chart_metric_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that a guest cannot introduce an off-chart series-limit metric.
    """
    query_context = _series_limit_metric_query_context(
        mocker,
        requested_metric="revenue",
        stored_metrics=["count"],
    )

    assert query_context_modified(query_context)


def test_query_context_modified_series_limit_metric_sql_expression_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that a guest cannot introduce a SQL expression as series-limit metric.
    """
    metric: AdhocMetric = {
        "expressionType": "SQL",
        "sqlExpression": "random()",
        "label": "count",
    }
    query_context = _series_limit_metric_query_context(
        mocker,
        requested_metric=metric,
        stored_metrics=["count"],
    )

    assert query_context_modified(query_context)


def test_query_context_modified_series_limit_metric_bad_aggregate_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that malformed series-limit metrics cannot pass through label spoofing.
    """
    metric: AdhocMetric = {
        "expressionType": "SIMPLE",
        "column": {"column_name": "secret_sales"},
        "label": "count",
    }
    query_context = _series_limit_metric_query_context(
        mocker,
        requested_metric=metric,
        stored_metrics=["count"],
    )

    assert query_context_modified(query_context)


def test_get_catalog_perm() -> None:
    """
    Test the `get_catalog_perm` method.
    """
    sm = SupersetSecurityManager(appbuilder)

    assert sm.get_catalog_perm("my_db", None) is None
    assert sm.get_catalog_perm("my_db", "my_catalog") == "[my_db].[my_catalog]"


def test_get_schema_perm() -> None:
    """
    Test the `get_schema_perm` method.
    """
    sm = SupersetSecurityManager(appbuilder)

    assert sm.get_schema_perm("my_db", None, "my_schema") == "[my_db].[my_schema]"
    assert (
        sm.get_schema_perm("my_db", "my_catalog", "my_schema")
        == "[my_db].[my_catalog].[my_schema]"
    )
    assert sm.get_schema_perm("my_db", None, None) is None
    assert sm.get_schema_perm("my_db", "my_catalog", None) is None


def test_raise_for_access_catalog(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test catalog-level permissions.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(
        sm,
        "get_catalog_perm",
        return_value="[PostgreSQL].[db1]",
    )
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")  # noqa: N806
    SqlaTable.query_datasources_by_name.return_value = []

    database = mocker.MagicMock()
    database.db_engine_spec.case_insensitive_catalogs = False
    database.get_default_catalog.return_value = "db1"
    database.get_default_schema_for_query.return_value = "public"
    query = mocker.MagicMock()
    query.catalog = "db1"
    query.database = database
    query.sql = "SELECT * FROM ab_user"

    can_access = mocker.patch.object(sm, "can_access", return_value=True)
    sm.raise_for_access(query=query)
    can_access.assert_called_with("catalog_access", "[PostgreSQL].[db1]")

    mocker.patch.object(sm, "can_access", return_value=False)
    with pytest.raises(SupersetSecurityException) as excinfo:
        sm.raise_for_access(query=query)
    assert (
        str(excinfo.value)
        == 'You need access to the following tables: "db1.public.ab_user", '
        "'all_database_access' or 'all_datasource_access' permission"
    )

    query.sql = "SELECT * FROM db2.public.ab_user"
    with pytest.raises(SupersetSecurityException) as excinfo:
        sm.raise_for_access(query=query)
    assert (
        str(excinfo.value)
        == 'You need access to the following tables: "db2.public.ab_user", '
        "'all_database_access' or 'all_datasource_access' permission"
    )


MSSQL_CONN_NAME = "my_mssql_conn"


def _mssql_database(
    mocker: MockerFixture,
    sqlalchemy_uri: str,
    extra: dict[str, Any] | None = None,
) -> Database:
    """
    Build a *real* ``Database`` instance -- not a mock -- so URL parsing and
    ``db_engine_spec`` resolution (including the real MSSQL dialect used to
    parse T-SQL) go through the genuine code path this fix relies on, per
    review feedback that a mock with a hardcoded ``url_object.database``
    doesn't actually exercise ``make_url``.

    ``database_name`` (``MSSQL_CONN_NAME``) is deliberately *not* any of the
    database names used in test SQL (``abcm``, ``another_db``, ...) -- the
    normalization this fix implements must not depend on it at all (see the
    rename-hazard finding: ``database_name`` is a user-renameable Superset
    label with no guaranteed relationship to the actual connected database).
    """
    database = Database(
        sqlalchemy_uri=sqlalchemy_uri,
        database_name=MSSQL_CONN_NAME,
        extra=json.dumps(extra) if extra else None,
    )
    # Schema resolution (which schema an unqualified table falls back to) is
    # orthogonal to what these tests verify, and MSSQL's default -- probing a
    # live connection -- has nothing to connect to here. Every test query
    # below fully qualifies its schema, so this is never actually consulted
    # for its return value; it's stubbed purely to avoid the live-connection
    # attempt.
    mocker.patch.object(database, "get_default_schema_for_query", return_value=None)
    return database


def test_raise_for_access_mssql_path_database_self_reference_allowed(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Regression test for GH #31406: a catalog-qualified query against MSSQL,
    connected via its own recommended connection-string form (database in
    the URL path), is authorized by a plain ``[conn].[schema]`` permission
    when the qualifier merely restates the connection's own database -- not
    denied because ``get_schema_perm`` was asked to check a spurious
    ``[conn].[db].[schema]`` permission that was never granted.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")  # noqa: N806
    SqlaTable.query_datasources_by_name.return_value = []

    database = _mssql_database(mocker, "mssql+pymssql://user:pw@host:1433/abcm")
    query = mocker.MagicMock(
        database=database,
        schema=None,
        catalog=None,
        sql="SELECT * FROM abcm.dbo.temp",
    )

    # The user only has the historical 2-part schema permission -- no
    # catalog_access, no 3-part schema_access, no database_access.
    mocker.patch.object(
        sm,
        "can_access",
        side_effect=lambda perm, vm: vm == f"[{MSSQL_CONN_NAME}].[dbo]",
    )

    sm.raise_for_access(query=query)  # must not raise


def test_raise_for_access_mssql_self_reference_still_requires_own_schema_perm(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Security regression guard: normalizing a self-referential catalog only
    removes the catalog component -- it must not widen the schema check.
    A query against the connection's own database but a *different* schema
    than the one granted must still be denied.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")  # noqa: N806
    SqlaTable.query_datasources_by_name.return_value = []

    database = _mssql_database(mocker, "mssql+pymssql://user:pw@host:1433/abcm")
    query = mocker.MagicMock(
        database=database,
        schema=None,
        catalog=None,
        sql="SELECT * FROM abcm.other_schema.temp",
    )

    # Only the "dbo" schema is granted -- "other_schema" must stay denied
    # even though "abcm" is correctly recognized as the connection's own
    # database.
    mocker.patch.object(
        sm,
        "can_access",
        side_effect=lambda perm, vm: vm == f"[{MSSQL_CONN_NAME}].[dbo]",
    )

    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query=query)


def test_raise_for_access_mssql_self_reference_case_mismatch_still_denied(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Security regression guard for the deliberate exact-match decision: a
    differently-cased restatement of the connection's own, statically
    configured database (``ABCM`` vs. the configured ``abcm``) must remain
    denied. The comparison is intentionally not case-folded -- see the
    comment in raise_for_access for why a false negative here is preferred
    over a false positive.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")  # noqa: N806
    SqlaTable.query_datasources_by_name.return_value = []

    database = _mssql_database(mocker, "mssql+pymssql://user:pw@host:1433/abcm")
    query = mocker.MagicMock(
        database=database,
        schema=None,
        catalog=None,
        sql="SELECT * FROM ABCM.dbo.temp",
    )
    mocker.patch.object(
        sm,
        "can_access",
        side_effect=lambda perm, vm: vm == f"[{MSSQL_CONN_NAME}].[dbo]",
    )

    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query=query)


def test_raise_for_access_mssql_bracketed_tsql_dialect_authorized(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    The bracketed T-SQL form must parse under the real MSSQL/TSQL sqlglot
    dialect (the generic dialect raises ParseError on bracketed identifiers)
    and be authorized the same as the unbracketed form.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")  # noqa: N806
    SqlaTable.query_datasources_by_name.return_value = []

    database = _mssql_database(mocker, "mssql+pymssql://user:pw@host:1433/abcm")
    assert database.db_engine_spec.engine == "mssql"
    query = mocker.MagicMock(
        database=database,
        schema=None,
        catalog=None,
        sql="SELECT * FROM [abcm].[dbo].[temp]",
    )
    mocker.patch.object(
        sm,
        "can_access",
        side_effect=lambda perm, vm: vm == f"[{MSSQL_CONN_NAME}].[dbo]",
    )

    sm.raise_for_access(query=query)  # must not raise


def test_raise_for_access_mssql_connect_args_database_self_reference_allowed(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    A database configured via ``connect_args`` (the "Extra" field in the UI)
    rather than the URL path is resolved and normalized the same way.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")  # noqa: N806
    SqlaTable.query_datasources_by_name.return_value = []

    database = _mssql_database(
        mocker,
        "mssql+pyodbc://user:pw@host",
        extra={"engine_params": {"connect_args": {"database": "abcm"}}},
    )
    query = mocker.MagicMock(
        database=database,
        schema=None,
        catalog=None,
        sql="SELECT * FROM abcm.dbo.temp",
    )
    mocker.patch.object(
        sm,
        "can_access",
        side_effect=lambda perm, vm: vm == f"[{MSSQL_CONN_NAME}].[dbo]",
    )

    sm.raise_for_access(query=query)  # must not raise


def test_raise_for_access_mssql_odbc_connect_database_self_reference_allowed(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    The documented, non-default pyodbc driver bundles the database inside a
    single opaque ``odbc_connect`` query parameter. This must be parsed out
    and normalized the same way as a path- or connect_args-configured one.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")  # noqa: N806
    SqlaTable.query_datasources_by_name.return_value = []

    database = _mssql_database(
        mocker,
        "mssql+pyodbc:///?odbc_connect="
        "Driver%3D%7BODBC+Driver+17+for+SQL+Server%7D%3B"
        "Server%3Dtcp%3Amyhost%2C1433%3B"
        "Database%3Dabcm%3B"
        "Uid%3DSuperSet%3BPwd%3Dpw%3BEncrypt%3Dyes",
    )
    assert database.url_object.database == ""  # not None -- must be handled
    query = mocker.MagicMock(
        database=database,
        schema=None,
        catalog=None,
        sql="SELECT * FROM abcm.dbo.temp",
    )
    mocker.patch.object(
        sm,
        "can_access",
        side_effect=lambda perm, vm: vm == f"[{MSSQL_CONN_NAME}].[dbo]",
    )

    sm.raise_for_access(query=query)  # must not raise


def test_raise_for_access_mssql_odbc_connect_wins_over_conflicting_connect_args(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Security regression guard for the odbc_connect/connect_args precedence
    fix: the connection is configured with odbc_connect's Database=abcm
    *and* a conflicting connect_args["database"]="another_db". Per the
    verified runtime precedence (odbc_connect wins -- see
    MssqlEngineSpec.get_catalog_from_engine_params), the connection
    actually points to abcm, not another_db.

    A query referencing abcm.dbo.temp is a genuine self-reference and must
    still be authorized via the plain schema-level grant. A query
    referencing another_db.dbo.secret must NOT be treated as a
    self-reference just because connect_args claims "another_db" -- it's a
    genuinely different catalog from what the connection actually uses, and
    must still be denied without a catalog-level grant for it.

    Before the precedence fix, get_catalog_from_engine_params checked
    connect_args first and would have (incorrectly) reported "another_db"
    as the connection's own catalog -- which would have flipped this test's
    outcome: abcm.dbo.temp wrongly denied, another_db.dbo.secret wrongly
    granted.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")  # noqa: N806
    SqlaTable.query_datasources_by_name.return_value = []

    database = _mssql_database(
        mocker,
        "mssql+pyodbc:///?odbc_connect="
        "Driver%3D%7BODBC+Driver+17+for+SQL+Server%7D%3B"
        "Server%3Dtcp%3Amyhost%2C1433%3B"
        "Database%3Dabcm%3B"
        "Uid%3DSuperSet%3BPwd%3Dpw",
        extra={"engine_params": {"connect_args": {"database": "another_db"}}},
    )
    query = mocker.MagicMock(
        database=database,
        schema=None,
        catalog=None,
        sql=(
            "SELECT * FROM abcm.dbo.temp a JOIN another_db.dbo.secret b ON a.id = b.id"
        ),
    )
    # Only the plain schema-level grant exists -- no catalog-qualified grant
    # for another_db, matching an admin who never intended to grant
    # cross-database access to it at all.
    mocker.patch.object(
        sm,
        "can_access",
        side_effect=lambda perm, vm: vm == f"[{MSSQL_CONN_NAME}].[dbo]",
    )

    with pytest.raises(SupersetSecurityException) as excinfo:
        sm.raise_for_access(query=query)
    assert "another_db.dbo.secret" in str(excinfo.value)
    assert "abcm.dbo.temp" not in str(excinfo.value)


def test_raise_for_access_mssql_malformed_connect_args_denies_cleanly(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Robustness regression guard: an explicit JSON `null` for
    "connect_args" (a malformed but not-impossible admin "Extra" config)
    must not crash raise_for_access with an AttributeError/TypeError -- it
    should behave exactly as if connect_args were simply absent, i.e. fall
    back to a clean permission denial.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")  # noqa: N806
    SqlaTable.query_datasources_by_name.return_value = []

    database = _mssql_database(
        mocker,
        "mssql+pyodbc://user:pw@host",
        extra={"engine_params": {"connect_args": None}},
    )
    query = mocker.MagicMock(
        database=database,
        schema=None,
        catalog=None,
        sql="SELECT * FROM abcm.dbo.temp",
    )
    mocker.patch.object(
        sm,
        "can_access",
        side_effect=lambda perm, vm: vm == f"[{MSSQL_CONN_NAME}].[dbo]",
    )

    # No statically-known database exists here (connect_args resolves to
    # {}, no odbc_connect, no URL path) -- clean denial, not a crash.
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query=query)


def test_raise_for_access_mssql_reporter_uri_still_denied(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    The literal GH #31406 reporter URI (a bare host/DSN, no path, no
    connect_args, no odbc_connect) has no statically-determinable database
    anywhere in it -- the actual database is only known to SQL Server itself,
    via the login's server-side default, at connect time. This PR
    deliberately does not add a live query to resolve it, so this specific
    connection shape remains denied even with the correct schema permission
    granted. This documents the known, disclosed limitation -- it is not a
    bug in the surrounding test coverage.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")  # noqa: N806
    SqlaTable.query_datasources_by_name.return_value = []

    database = _mssql_database(mocker, "mssql+pyodbc://SuperSet:pw@abcm")
    assert database.url_object.host == "abcm"
    assert database.url_object.database is None
    query = mocker.MagicMock(
        database=database,
        schema=None,
        catalog=None,
        sql="SELECT * FROM abcm.dbo.temp",
    )
    mocker.patch.object(
        sm,
        "can_access",
        side_effect=lambda perm, vm: vm == f"[{MSSQL_CONN_NAME}].[dbo]",
    )

    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query=query)


def test_raise_for_access_mssql_self_reference_matches_registered_dataset(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Regression test for the dataset-lookup half of GH #31406: under SQL Lab's
    strict ``force_dataset_match=True`` scoping, a catalog-qualified query
    against a statically-resolvable MSSQL connection must find a registered
    dataset stored with ``catalog=None`` (the only form dataset creation ever
    produces for such engines) -- not miss it because
    ``query_datasources_by_name`` was filtered by the redundant,
    self-referential catalog parsed from the SQL text.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "is_editor", return_value=False)
    mocker.patch.object(sm, "is_guest_user", return_value=False)

    database = _mssql_database(mocker, "mssql+pymssql://user:pw@host:1433/abcm")
    query = mocker.MagicMock(
        database=database,
        schema=None,
        catalog=None,
        sql="SELECT * FROM abcm.dbo.temp",
    )

    # No schema/catalog/database-level grant at all -- access must come
    # entirely from the registered dataset's `datasource_access` permission.
    mocker.patch.object(
        sm, "can_access", side_effect=lambda perm, vm: perm == "datasource_access"
    )

    # Registered MSSQL dataset, stored with catalog=None -- the only shape
    # dataset creation ever produces for an engine without catalog support.
    registered_dataset = mocker.Mock(perm=f"[{MSSQL_CONN_NAME}].[temp](id:1)")

    def fake_query_datasources_by_name(
        _database: object,
        table_name: str,
        catalog: str | None = None,
        schema: str | None = None,
    ) -> list[object]:
        # SqlaTable.query_datasources_by_name's real implementation only adds
        # a `catalog` filter when `catalog` is truthy (`if catalog:
        # filters["catalog"] = catalog`); a falsy `catalog` applies no
        # catalog filter at all, rather than matching a stored `catalog=None`
        # specifically. This fake narrows that to require `catalog is None`
        # outright, which is stricter than the real behavior but still
        # correctly proves the property this test cares about: the dataset
        # is only found once the caller has normalized the redundant,
        # self-referential catalog away.
        if table_name == "temp" and schema == "dbo" and catalog is None:
            return [registered_dataset]
        return []

    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")  # noqa: N806
    SqlaTable.query_datasources_by_name.side_effect = fake_query_datasources_by_name

    sm.raise_for_access(query=query, force_dataset_match=True)  # must not raise


def test_raise_for_access_mssql_unqualified_still_allowed(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    The unqualified form of the same query (``dbo.temp``, relying on the
    connection's default database) must keep working exactly as before.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")  # noqa: N806
    SqlaTable.query_datasources_by_name.return_value = []

    database = _mssql_database(mocker, "mssql+pymssql://user:pw@host:1433/abcm")
    query = mocker.MagicMock(
        database=database,
        schema=None,
        catalog=None,
        sql="SELECT * FROM dbo.temp",
    )
    mocker.patch.object(
        sm,
        "can_access",
        side_effect=lambda perm, vm: vm == f"[{MSSQL_CONN_NAME}].[dbo]",
    )

    sm.raise_for_access(query=query)  # must not raise


def test_raise_for_access_mssql_different_database_still_denied(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Security regression guard: a query qualified with a *different* database
    name than the one the connection actually points to must still be denied.
    The fix must not broaden schema access into cross-database access just
    because the engine doesn't support catalogs.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")  # noqa: N806
    SqlaTable.query_datasources_by_name.return_value = []

    database = _mssql_database(mocker, "mssql+pymssql://user:pw@host:1433/abcm")
    query = mocker.MagicMock(
        database=database,
        schema=None,
        catalog=None,
        sql="SELECT * FROM another_db.dbo.temp",
    )
    mocker.patch.object(
        sm,
        "can_access",
        side_effect=lambda perm, vm: vm == f"[{MSSQL_CONN_NAME}].[dbo]",
    )

    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query=query)


def test_raise_for_access_mssql_cross_catalog_join_partially_denied(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    A join across the connection's own database and a different one must
    still be denied for the unauthorized side, even though the self-
    referential side is now correctly authorized.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")  # noqa: N806
    SqlaTable.query_datasources_by_name.return_value = []

    database = _mssql_database(mocker, "mssql+pymssql://user:pw@host:1433/abcm")
    query = mocker.MagicMock(
        database=database,
        schema=None,
        catalog=None,
        sql=(
            "SELECT * FROM abcm.dbo.temp a JOIN another_db.dbo.secret b ON a.id = b.id"
        ),
    )
    mocker.patch.object(
        sm,
        "can_access",
        side_effect=lambda perm, vm: vm == f"[{MSSQL_CONN_NAME}].[dbo]",
    )

    with pytest.raises(SupersetSecurityException) as excinfo:
        sm.raise_for_access(query=query)
    assert "another_db.dbo.secret" in str(excinfo.value)
    assert "abcm.dbo.temp" not in str(excinfo.value)


def test_raise_for_access_catalog_supporting_engine_still_requires_catalog(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Control test: for a DB engine spec that *does* support catalogs (e.g.
    Postgres), the fix must not kick in. A legacy 2-part `[db].[schema]`
    permission must NOT satisfy a catalog-qualified query -- the 3-part
    `[db].[catalog].[schema]` permission is still required, preserving
    SIP-95 semantics for engines where catalogs are real, distinct,
    independently-authorizable resources.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")  # noqa: N806
    SqlaTable.query_datasources_by_name.return_value = []

    database = mocker.MagicMock()
    database.db_engine_spec.case_insensitive_catalogs = False
    database.database_name = "examples"
    database.db_engine_spec.supports_catalog = True
    database.get_default_catalog.return_value = "examples"
    database.get_default_schema_for_query.return_value = None
    database.url_object.database = "examples"
    query = mocker.MagicMock(
        database=database,
        schema=None,
        catalog=None,
        sql="SELECT * FROM examples.public.covid_vaccines",
    )

    # Only the legacy 2-part permission is granted -- should NOT be enough.
    mocker.patch.object(
        sm, "can_access", side_effect=lambda perm, vm: vm == "[examples].[public]"
    )
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query=query)

    # The correct 3-part catalog-qualified permission works, as before.
    mocker.patch.object(
        sm,
        "can_access",
        side_effect=lambda perm, vm: vm == "[examples].[examples].[public]",
    )
    sm.raise_for_access(query=query)  # must not raise


def test_raise_for_access_catalog_self_reference_does_not_weaken_sqllab_strict_mode(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    The catalog self-reference normalization must not interact with SQL
    Lab's stricter ``force_dataset_match`` mode (#40409): schema_access
    alone -- self-referential catalog or not -- must remain insufficient to
    execute a raw SQL Lab query without a matching registered dataset.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "is_editor", return_value=False)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")  # noqa: N806
    SqlaTable.query_datasources_by_name.return_value = []

    database = _mssql_database(mocker, "mssql+pymssql://user:pw@host:1433/abcm")
    query = mocker.MagicMock(
        database=database,
        schema=None,
        catalog=None,
        sql="SELECT * FROM abcm.dbo.temp",
    )
    mocker.patch.object(
        sm,
        "can_access",
        side_effect=lambda perm, vm: vm == f"[{MSSQL_CONN_NAME}].[dbo]",
    )

    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query=query, force_dataset_match=True)


def test_raise_for_access_editorship_denied_in_strict_mode(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Editorship of a registered dataset for the referenced table
    must not authorize a raw query on the strict ``force_dataset_match`` path
    (SQL Lab, MetaDB, MCP execute_sql). Any dataset-creating principal can
    make themselves an editor of a dataset named after an arbitrary table, so
    accepting editorship here would let dataset creation stand in for data
    access and would outlive revocation of every real grant. The same
    editorship stays sufficient on the non-strict path (the dataset-owner
    "explore your own dataset" grant, #20382).
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "can_access", return_value=False)
    mocker.patch.object(sm, "is_editor", return_value=True)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")  # noqa: N806
    # A registered dataset exists for the referenced table and the user is its
    # editor, but holds no datasource_access (nor any catalog/schema grant).
    SqlaTable.query_datasources_by_name.return_value = [
        mocker.MagicMock(perm=f"[{MSSQL_CONN_NAME}].[dbo].[foo](id:1)")
    ]

    # Real Database so the SQL parse / engine-spec path is genuinely
    # exercised, like the catalog-self-reference test above.
    database = _mssql_database(mocker, "mssql+pymssql://user:pw@host:1433/abcm")
    query = mocker.MagicMock(
        database=database,
        schema=None,
        catalog=None,
        sql="SELECT * FROM dbo.foo",
    )

    # Strict mode (SQL Lab / MetaDB / MCP): editorship alone is not enough.
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query=query, force_dataset_match=True)

    # allow_editorship=False (dataset create/update validation): also not enough.
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query=query, allow_editorship=False)

    # Non-strict mode: editorship still authorizes access (#20382).
    sm.raise_for_access(query=query)


def test_raise_for_access_allow_editorship_false_keeps_schema_access(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    allow_editorship=False must not drop the schema_access fallthrough: a
    user with schema_access can still DEFINE a dataset over the table (unlike
    force_dataset_match=True, which requires a registered dataset match).
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "is_editor", return_value=False)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")  # noqa: N806
    SqlaTable.query_datasources_by_name.return_value = []

    database = _mssql_database(mocker, "mssql+pymssql://user:pw@host:1433/abcm")
    query = mocker.MagicMock(
        database=database, schema=None, catalog=None, sql="SELECT * FROM dbo.foo"
    )
    # Only schema_access holds (the dbo schema on this connection).
    mocker.patch.object(
        sm,
        "can_access",
        side_effect=lambda perm, vm: vm == f"[{MSSQL_CONN_NAME}].[dbo]",
    )

    # allow_editorship=False still passes on schema_access ...
    sm.raise_for_access(query=query, allow_editorship=False)
    # ... whereas the strict flag would deny it (no registered dataset).
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(query=query, force_dataset_match=True)


def test_raise_for_access_allow_editorship_false_keeps_catalog_access(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    allow_editorship=False must not drop the catalog_access fallthrough either:
    a user with catalog_access on the referenced catalog is not over-blocked
    when defining a dataset over a table in it.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "is_editor", return_value=False)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")  # noqa: N806
    SqlaTable.query_datasources_by_name.return_value = []

    database = _mssql_database(mocker, "mssql+pymssql://user:pw@host:1433/abcm")
    mocker.patch.object(database.db_engine_spec, "supports_catalog", True)
    query = mocker.MagicMock(
        database=database, schema="dbo", catalog="other", sql="SELECT * FROM dbo.foo"
    )
    # Only catalog_access holds (the "other" catalog on this connection).
    mocker.patch.object(
        sm,
        "can_access",
        side_effect=lambda perm, vm: (
            perm == "catalog_access" and vm == f"[{MSSQL_CONN_NAME}].[other]"
        ),
    )

    sm.raise_for_access(query=query, allow_editorship=False)


def test_raise_for_access_allow_editorship_false_keeps_datasource_access(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    End-to-end ALLOW guard: a holder of real ``datasource_access`` on a
    registered dataset for the referenced table passes even with
    ``allow_editorship=False`` -- the define/repoint paths never over-block a
    principal with genuine data access (only editorship-as-access is removed).
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "is_editor", return_value=False)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    SqlaTable = mocker.patch("superset.connectors.sqla.models.SqlaTable")  # noqa: N806
    SqlaTable.query_datasources_by_name.return_value = [
        mocker.MagicMock(
            perm=f"[{MSSQL_CONN_NAME}].[dbo].[foo](id:1)", sql=None, catalog=None
        )
    ]

    database = _mssql_database(mocker, "mssql+pymssql://user:pw@host:1433/abcm")
    query = mocker.MagicMock(
        database=database, schema=None, catalog=None, sql="SELECT * FROM dbo.foo"
    )
    # Only datasource_access on the registered dataset holds.
    mocker.patch.object(
        sm,
        "can_access",
        side_effect=lambda perm, vm: (
            perm == "datasource_access"
            and vm == f"[{MSSQL_CONN_NAME}].[dbo].[foo](id:1)"
        ),
    )

    sm.raise_for_access(query=query, allow_editorship=False)


def test_raise_for_access_datasource_branch_honors_allow_editorship(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    The ``datasource=`` branch honors ``allow_editorship`` like the per-table
    branch: an editor holding no schema, datasource or semantic-layer grant is
    refused when the caller opts out of the editorship accept, and keeps the
    #20382 accept by default.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_schema", return_value=False)
    mocker.patch.object(sm, "can_access", return_value=False)
    mocker.patch.object(sm, "_semantic_layer_grant_allows", return_value=False)
    mocker.patch.object(sm, "is_editor", return_value=True)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    datasource = mocker.MagicMock(perm="[db].[orders](id:1)")

    with pytest.raises(SupersetSecurityException):
        sm.raise_for_access(datasource=datasource, allow_editorship=False)

    sm.raise_for_access(datasource=datasource)


def test_get_datasources_accessible_by_user_schema_access(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that `get_datasources_accessible_by_user` works with schema permissions.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)

    database = mocker.MagicMock()
    database.db_engine_spec.case_insensitive_catalogs = False
    database.database_name = "db1"
    database.get_default_catalog.return_value = "catalog2"

    # False for catalog_access, True for schema_access
    can_access = mocker.patch.object(sm, "can_access", side_effect=[False, True])

    datasource_names = [
        DatasourceName("table1", "schema1", "catalog2"),
        DatasourceName("table2", "schema1", "catalog2"),
    ]

    assert sm.get_datasources_accessible_by_user(
        database,
        datasource_names,
        catalog=None,
        schema="schema1",
    ) == [
        DatasourceName("table1", "schema1", "catalog2"),
        DatasourceName("table2", "schema1", "catalog2"),
    ]

    # Even though we passed `catalog=None,` the schema check uses the default catalog
    # when building the schema permission, since the DB supports catalog.
    can_access.assert_has_calls(
        [
            mocker.call("catalog_access", "[db1].[catalog2]"),
            mocker.call("schema_access", "[db1].[catalog2].[schema1]"),
        ]
    )


def test_get_catalogs_accessible_by_user_schema_access(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that `get_catalogs_accessible_by_user` works with schema permissions.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(
        sm,
        "user_view_menu_names",
        side_effect=[
            set(),  # catalog_access
            {"[db1].[catalog2].[schema1]"},  # schema_access
            set(),  # datasource_access
        ],
    )

    database = mocker.MagicMock()
    database.database_name = "db1"
    database.get_default_catalog.return_value = "catalog2"

    catalogs = {"catalog1", "catalog2"}

    assert sm.get_catalogs_accessible_by_user(database, catalogs) == {"catalog2"}


def test_get_schemas_accessible_by_user_cached_list(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that `get_schemas_accessible_by_user` handles candidate names that a cache
    serializer deserialized as a list instead of a set. Before normalization this
    raised `TypeError: unsupported operand type(s) for &: 'list' and 'set'` for users
    with only schema-level access.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(
        sm,
        "user_view_menu_names",
        side_effect=[
            {"[db1].[schema2]"},  # schema_access
            set(),  # datasource_access
        ],
    )

    database = mocker.MagicMock()
    database.database_name = "db1"
    database.get_default_catalog.return_value = None
    database.get_default_schema.return_value = None

    schemas = ["schema1", "schema2"]

    assert sm.get_schemas_accessible_by_user(database, None, schemas) == {"schema2"}


def test_get_schemas_accessible_by_user_hierarchical_cached_list(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that the hierarchical early return normalizes a list-typed candidate
    collection to a set, so callers always receive a `set` regardless of the cache
    serializer.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=True)

    database = mocker.MagicMock()
    database.database_name = "db1"
    database.get_default_catalog.return_value = None
    database.get_default_schema.return_value = None

    schemas = ["schema1", "schema2"]

    result = sm.get_schemas_accessible_by_user(database, None, schemas)
    assert result == {"schema1", "schema2"}
    assert isinstance(result, set)


def test_get_catalogs_accessible_by_user_cached_list(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that `get_catalogs_accessible_by_user` handles candidate names that a cache
    serializer deserialized as a list instead of a set.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(
        sm,
        "user_view_menu_names",
        side_effect=[
            set(),  # catalog_access
            {"[db1].[catalog2].[schema1]"},  # schema_access
            set(),  # datasource_access
        ],
    )

    database = mocker.MagicMock()
    database.database_name = "db1"
    database.get_default_catalog.return_value = "catalog2"

    catalogs = ["catalog1", "catalog2"]

    assert sm.get_catalogs_accessible_by_user(database, catalogs) == {"catalog2"}


def test_get_catalogs_accessible_by_user_hierarchical_cached_list(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that the hierarchical early return for catalogs normalizes a list-typed
    candidate collection to a set.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=True)

    database = mocker.MagicMock()
    database.database_name = "db1"
    database.get_default_catalog.return_value = "catalog2"

    catalogs = ["catalog1", "catalog2"]

    result = sm.get_catalogs_accessible_by_user(database, catalogs)
    assert result == {"catalog1", "catalog2"}
    assert isinstance(result, set)


def test_get_rls_filters_uses_table_id_directly(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that get_rls_filters() uses table.id directly instead of table.data["id"].

    Accessing table.data triggers the full data property chain including select_star,
    which requires a live database engine connection. When the DB is unreachable, this
    causes the entire dashboard GET endpoint to fail with a 500 error.

    This test ensures we use the direct .id attribute and never access .data,
    preventing regressions that would break dashboard loading when DBs are unavailable.
    """
    sm = SupersetSecurityManager(appbuilder)

    # Create a mock table where .data raises an exception if accessed
    table = mocker.MagicMock()
    table.id = 42
    type(table).data = mocker.PropertyMock(
        side_effect=Exception(
            "table.data should not be accessed - use table.id directly"
        )
    )

    # Mock user context
    mock_user = mocker.MagicMock()
    mock_user.id = 1
    mock_user.roles = [mocker.MagicMock(id=1)]
    mocker.patch("superset.security.manager.g", user=mock_user)
    mocker.patch("superset.subjects.utils.get_user_subject_ids", return_value=[1])

    # Call get_rls_filters - if it accesses table.data, the PropertyMock will raise
    # If it uses table.id directly (correct behavior), it will complete successfully
    result = sm.get_rls_filters(table)
    assert isinstance(result, list)


def test_get_rls_filters_returns_cached_result(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that get_rls_filters() returns cached results on subsequent calls
    for the same user and table, avoiding redundant DB queries.
    """
    sm = SupersetSecurityManager(appbuilder)

    mock_user = mocker.MagicMock()
    mock_user.id = 1
    mock_user.username = "admin"
    mock_user.roles = [mocker.MagicMock(id=1)]
    mock_g = SimpleNamespace(user=mock_user)
    mocker.patch("superset.security.manager.g", new=mock_g)
    mocker.patch("superset.security.manager.get_username", return_value="admin")
    mocker.patch("superset.subjects.utils.get_user_subject_ids", return_value=[1])

    table = mocker.MagicMock()
    table.id = 42

    # First call populates the cache
    result1 = sm.get_rls_filters(table)

    # Verify cache was populated keyed by (username, table_id)
    assert ("admin", 42) in mock_g._rls_filter_cache

    # Replace session query with something that would fail if called
    mocker.patch.object(
        sm.session,
        "query",
        side_effect=AssertionError("DB should not be queried on cache hit"),
    )

    # Second call should return cached result without querying DB
    result2 = sm.get_rls_filters(table)
    assert result1 == result2


def test_prefetch_rls_filters_populates_cache(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that prefetch_rls_filters() populates the cache for all provided
    table_ids, including empty results for tables with no matching filters.
    """
    sm = SupersetSecurityManager(appbuilder)

    mock_user = mocker.MagicMock()
    mock_user.id = 1
    mock_user.username = "admin"
    mock_user.roles = [mocker.MagicMock(id=10)]
    mock_g = SimpleNamespace(user=mock_user)
    mocker.patch("superset.security.manager.g", new=mock_g)
    mocker.patch("superset.security.manager.get_username", return_value="admin")
    mocker.patch("superset.subjects.utils.get_user_subject_ids", return_value=[10])

    # Mock the batch query to return filters for table 1 but not table 2
    mock_query = mocker.MagicMock()
    mock_query.join.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.all.return_value = [
        (1, 100, "group_a", "id > 0"),  # table_id=1
        (1, 101, None, "active = 1"),  # table_id=1
    ]
    mocker.patch.object(sm.session, "query", return_value=mock_query)

    sm.prefetch_rls_filters([1, 2])

    # Table 1 should have 2 filters with named attribute access
    cached = mock_g._rls_filter_cache[("admin", 1)]
    assert len(cached) == 2
    assert cached[0].id == 100
    assert cached[0].group_key == "group_a"
    assert cached[0].clause == "id > 0"
    assert cached[1].id == 101
    assert cached[1].group_key is None
    assert cached[1].clause == "active = 1"
    # Table 2 should have empty list
    assert mock_g._rls_filter_cache[("admin", 2)] == []


def test_prefetch_rls_filters_skips_cached_ids(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that prefetch_rls_filters() skips table_ids already in cache
    and returns early when all ids are cached.
    """
    sm = SupersetSecurityManager(appbuilder)

    mock_user = mocker.MagicMock()
    mock_user.id = 1
    mock_user.username = "admin"
    mock_user.roles = [mocker.MagicMock(id=10)]
    mock_g = SimpleNamespace(
        user=mock_user,
        _rls_filter_cache={("admin", 1): [(100, "group_a", "id > 0")]},
    )
    mocker.patch("superset.security.manager.g", new=mock_g)
    mocker.patch("superset.security.manager.get_username", return_value="admin")
    mocker.patch.object(sm, "get_user_roles", return_value=mock_user.roles)

    # If it queries the DB, this will fail
    mocker.patch.object(
        sm.session,
        "query",
        side_effect=AssertionError("DB should not be queried for cached ids"),
    )

    # All ids already cached -> should return immediately
    sm.prefetch_rls_filters([1])


def test_prefetch_rls_filters_no_user(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that prefetch_rls_filters() returns early when no user is present.
    """
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch("superset.security.manager.g", new=SimpleNamespace())

    # Should not attempt any DB queries
    mocker.patch.object(
        sm.session,
        "query",
        side_effect=AssertionError("DB should not be queried without a user"),
    )
    sm.prefetch_rls_filters([1, 2])


def test_get_rls_filters_cache_works_for_guest_user(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that get_rls_filters() caches results for guest users
    using the same (username, table_id) cache key as regular users.
    """
    sm = SupersetSecurityManager(appbuilder)

    mock_guest = mocker.MagicMock()
    mock_guest.id = 1
    mock_guest.username = "guest_user"
    mock_guest.roles = [mocker.MagicMock(id=99)]

    mock_g = SimpleNamespace(user=mock_guest)
    mocker.patch("superset.security.manager.g", new=mock_g)
    mocker.patch("superset.security.manager.get_username", return_value="guest_user")
    mocker.patch.object(sm, "get_user_roles", return_value=mock_guest.roles)

    table = mocker.MagicMock()
    table.id = 42

    # First call runs the query
    result1 = sm.get_rls_filters(table)

    # Verify cache was populated with (username, table_id) key
    assert ("guest_user", 42) in mock_g._rls_filter_cache

    # Replace session query to detect if it's called again
    mocker.patch.object(
        sm.session,
        "query",
        side_effect=AssertionError("DB should not be queried on cache hit"),
    )

    # Second call should use cache
    result2 = sm.get_rls_filters(table)
    assert result1 == result2


def test_prefetch_rls_filters_works_for_guest_user(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that prefetch_rls_filters() works for guest users using the
    same (username, table_id) cache key as regular users.
    """
    sm = SupersetSecurityManager(appbuilder)

    mock_guest = mocker.MagicMock()
    mock_guest.id = 1
    mock_guest.username = "guest_user"
    mock_guest.roles = [mocker.MagicMock(id=99)]

    mock_g = SimpleNamespace(user=mock_guest)
    mocker.patch("superset.security.manager.g", new=mock_g)
    mocker.patch("superset.security.manager.get_username", return_value="guest_user")
    mocker.patch.object(sm, "get_user_roles", return_value=mock_guest.roles)

    # Mock the batch query returning no filters
    mock_query = mocker.MagicMock()
    mock_query.join.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.all.return_value = []
    mocker.patch.object(sm.session, "query", return_value=mock_query)

    sm.prefetch_rls_filters([10, 20])

    # Cache should be populated with (username, table_id) keys and empty lists
    assert mock_g._rls_filter_cache[("guest_user", 10)] == []
    assert mock_g._rls_filter_cache[("guest_user", 20)] == []


def test_validate_child_in_parent_multilayer_valid(
    app_context: None, mocker: MockerFixture
) -> None:
    """Test validation succeeds for valid multi-layer child"""
    sm = SupersetSecurityManager(appbuilder)

    parent_slice = mocker.MagicMock(spec=Slice)
    parent_slice.params = json.dumps(
        {"viz_type": "deck_multi", "deck_slices": [1, 2, 3]}
    )

    # Child 2 is in parent's deck_slices
    assert sm._validate_child_in_parent_multilayer(
        child_slice_id=2, parent_slice=parent_slice
    )


def test_validate_child_in_parent_multilayer_invalid_child(
    app_context: None, mocker: MockerFixture
) -> None:
    """Test validation fails for child not in parent config"""
    sm = SupersetSecurityManager(appbuilder)

    parent_slice = mocker.MagicMock(spec=Slice)
    parent_slice.params = json.dumps(
        {"viz_type": "deck_multi", "deck_slices": [1, 2, 3]}
    )

    # Child 5 is NOT in parent's deck_slices
    assert not sm._validate_child_in_parent_multilayer(
        child_slice_id=5, parent_slice=parent_slice
    )


def test_validate_child_in_parent_multilayer_wrong_viz_type(
    app_context: None, mocker: MockerFixture
) -> None:
    """Test validation fails for non-multilayer charts"""
    sm = SupersetSecurityManager(appbuilder)

    parent_slice = mocker.MagicMock(spec=Slice)
    parent_slice.params = json.dumps(
        {
            "viz_type": "line",  # Not deck_multi
            "deck_slices": [1, 2, 3],
        }
    )

    assert not sm._validate_child_in_parent_multilayer(
        child_slice_id=2, parent_slice=parent_slice
    )


def test_validate_child_in_parent_multilayer_empty_deck_slices(
    app_context: None, mocker: MockerFixture
) -> None:
    """Test validation fails when deck_slices is empty"""
    sm = SupersetSecurityManager(appbuilder)

    parent_slice = mocker.MagicMock(spec=Slice)
    parent_slice.params = json.dumps({"viz_type": "deck_multi", "deck_slices": []})

    assert not sm._validate_child_in_parent_multilayer(
        child_slice_id=1, parent_slice=parent_slice
    )


def test_validate_child_in_parent_multilayer_no_deck_slices(
    app_context: None, mocker: MockerFixture
) -> None:
    """Test validation fails when deck_slices is missing"""
    sm = SupersetSecurityManager(appbuilder)

    parent_slice = mocker.MagicMock(spec=Slice)
    parent_slice.params = json.dumps(
        {
            "viz_type": "deck_multi"
            # No deck_slices key
        }
    )

    assert not sm._validate_child_in_parent_multilayer(
        child_slice_id=1, parent_slice=parent_slice
    )


def test_validate_child_in_parent_multilayer_malformed_json(
    app_context: None, mocker: MockerFixture
) -> None:
    """Test validation fails gracefully with malformed JSON"""
    sm = SupersetSecurityManager(appbuilder)

    parent_slice = mocker.MagicMock(spec=Slice)
    parent_slice.params = "not valid json {{"

    assert not sm._validate_child_in_parent_multilayer(
        child_slice_id=1, parent_slice=parent_slice
    )


def test_validate_child_in_parent_multilayer_null_params(
    app_context: None, mocker: MockerFixture
) -> None:
    """Test validation fails gracefully with null params"""
    sm = SupersetSecurityManager(appbuilder)

    parent_slice = mocker.MagicMock(spec=Slice)
    parent_slice.params = None

    assert not sm._validate_child_in_parent_multilayer(
        child_slice_id=1, parent_slice=parent_slice
    )


def test_user_view_menu_names_for_guest_user(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that user_view_menu_names resolves permissions from the guest
    user's roles instead of querying by user_id (which is None for guests).
    """
    sm = SupersetSecurityManager(appbuilder)

    mock_role = mocker.MagicMock(spec=Role)
    mock_role.id = 99

    mock_guest = mocker.MagicMock()
    mock_guest.is_anonymous = False
    mock_guest.roles = [mock_role]

    mock_g = SimpleNamespace(user=mock_guest)
    mocker.patch("superset.security.manager.g", new=mock_g)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    # The regression: guest path must NEVER fall through to get_user_id().
    # Patching it as an error means an accidental fall-through fails loudly.
    mock_get_user_id = mocker.patch(
        "superset.security.manager.get_user_id",
        side_effect=AssertionError("get_user_id must not be called for guest users"),
    )

    mock_result = [SimpleNamespace(name="[PostgreSQL].[my_table](id:1)")]
    mock_query = mocker.MagicMock()
    mock_query.join.return_value = mock_query
    mock_query.filter.return_value = mock_query
    mock_query.all.return_value = mock_result
    mocker.patch.object(sm.session, "query", return_value=mock_query)

    result = sm.user_view_menu_names("datasource_access")

    assert result == {"[PostgreSQL].[my_table](id:1)"}
    mock_get_user_id.assert_not_called()
    mock_query.filter.assert_called()


def test_user_view_menu_names_for_guest_user_no_roles(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Test that user_view_menu_names returns empty set when guest user has
    no roles with valid IDs.
    """
    sm = SupersetSecurityManager(appbuilder)

    mock_role = mocker.MagicMock(spec=Role)
    mock_role.id = None

    mock_guest = mocker.MagicMock()
    mock_guest.is_anonymous = False
    mock_guest.roles = [mock_role]

    mock_g = SimpleNamespace(user=mock_guest)
    mocker.patch("superset.security.manager.g", new=mock_g)
    mocker.patch.object(sm, "is_guest_user", return_value=True)
    mock_get_user_id = mocker.patch(
        "superset.security.manager.get_user_id",
        side_effect=AssertionError("get_user_id must not be called for guest users"),
    )

    result = sm.user_view_menu_names("datasource_access")

    assert result == set()
    mock_get_user_id.assert_not_called()


def test_request_loader_rejects_invalid_guest_token_before_bearer(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Invalid guest tokens must not fall through to Bearer JWT auth.
    """
    sm = SupersetSecurityManager(appbuilder)
    header_name = current_app.config["GUEST_TOKEN_HEADER_NAME"]
    request = SimpleNamespace(
        headers={header_name: "invalid-guest-token", "Authorization": "Bearer valid"},
        form={},
    )

    mocker.patch(
        "superset.extensions.feature_flag_manager.is_feature_enabled",
        return_value=True,
    )
    mocker.patch.object(sm, "get_guest_user_from_request", return_value=None)
    verify_jwt = mocker.patch("superset.security.manager.verify_jwt_in_request")

    assert sm.request_loader(request) is None

    verify_jwt.assert_not_called()


def test_reset_password_self_service_clears_flag(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """A user resetting their own password clears the forced-change flag."""
    sm = SupersetSecurityManager(appbuilder)
    # The target user (id 5) is the same as the acting user -> self-service.
    mock_g = SimpleNamespace(user=SimpleNamespace(id=5))
    mocker.patch("superset.security.manager.g", new=mock_g)
    # Avoid touching the real DB in the FAB base implementation.
    mocker.patch(
        "flask_appbuilder.security.manager.BaseSecurityManager.reset_password",
        return_value=None,
    )
    mock_clear = mocker.patch(
        "superset.security.password_change.clear_password_must_change"
    )

    sm.reset_password(5, "new-password")

    mock_clear.assert_called_once_with(5)


def test_reset_password_admin_does_not_clear_flag(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """An admin-initiated reset must preserve the forced-change requirement.

    FAB's ``ResetPasswordView`` passes the target as the ``pk`` request-arg
    string while ``g.user`` remains the admin, so the acting user differs from
    the target and the flag must NOT be cleared.
    """
    sm = SupersetSecurityManager(appbuilder)
    # Acting user is admin (id 1); target is a different user ("5" as a string,
    # as FAB passes it from request args).
    mock_g = SimpleNamespace(user=SimpleNamespace(id=1))
    mocker.patch("superset.security.manager.g", new=mock_g)
    mocker.patch(
        "flask_appbuilder.security.manager.BaseSecurityManager.reset_password",
        return_value=None,
    )
    mock_clear = mocker.patch(
        "superset.security.password_change.clear_password_must_change"
    )

    sm.reset_password("5", "temp-password")

    mock_clear.assert_not_called()


def test_reset_password_self_service_pk_string_clears_flag(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """Self-service identity holds even if ids arrive as mixed int/str types."""
    sm = SupersetSecurityManager(appbuilder)
    mock_g = SimpleNamespace(user=SimpleNamespace(id=5))
    mocker.patch("superset.security.manager.g", new=mock_g)
    mocker.patch(
        "flask_appbuilder.security.manager.BaseSecurityManager.reset_password",
        return_value=None,
    )
    mock_clear = mocker.patch(
        "superset.security.password_change.clear_password_must_change"
    )

    sm.reset_password("5", "new-password")

    # Coerced to int when clearing, regardless of the inbound id type.
    mock_clear.assert_called_once_with(5)


# -----------------------------------------------------------------------------
# Tests for orderby with invalid formats - unit tests
# -----------------------------------------------------------------------------


def test_query_context_modified_orderby_sql_expression_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that SQL expressions in orderby are blocked.

    Security: prevents SQL injection via sorting.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": ["name"],
        "groupby": [],
        "metrics": ["count"],
    }
    query_context.form_data = {
        "slice_id": 42,
        "columns": ["name"],
        "metrics": ["count"],
        "orderby": [[{"expressionType": "SQL", "sqlExpression": "random()"}, True]],
    }
    query_context.queries = []

    assert query_context_modified(query_context)


def test_query_context_modified_orderby_invalid_format_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that invalid orderby formats are blocked (not crash).

    The invalid format {"column": "string"} should be blocked,
    not cause AttributeError.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": ["name"],
        "groupby": [],
        "metrics": ["count"],
    }
    query_context.form_data = {
        "slice_id": 42,
        "columns": ["name"],
        "metrics": ["count"],
        # Invalid format - should be blocked, not crash
        "orderby": [[{"column": "country"}, True]],
    }
    query_context.queries = []

    # Should return True (modified/blocked), not raise exception
    assert query_context_modified(query_context)


def test_query_context_modified_orderby_string_instead_of_list_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that orderby as string (instead of list) is blocked.

    Defensive barrier: if orderby is not a list, block (fail-closed).
    Without this barrier, iterating over string would yield characters,
    each would be skipped, and the check would pass (fail-open).
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": ["name"],
        "groupby": [],
        "metrics": ["count"],
    }
    query_context.form_data = {
        "slice_id": 42,
        "columns": ["name"],
        "metrics": ["count"],
        # Invalid: string instead of list
        "orderby": "malicious_string",
    }
    query_context.queries = []

    # Should return True (blocked), not pass through
    assert query_context_modified(query_context)


def test_query_context_modified_orderby_element_not_tuple_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that orderby element that is not tuple/list is blocked.

    Defensive barrier: each orderby element must be [column, bool].
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": ["name"],
        "groupby": [],
        "metrics": ["count"],
    }
    query_context.form_data = {
        "slice_id": 42,
        "columns": ["name"],
        "metrics": ["count"],
        # Invalid: element is string, not tuple
        "orderby": ["name"],
    }
    query_context.queries = []

    # Should return True (blocked)
    assert query_context_modified(query_context)


def test_query_context_modified_orderby_empty_tuple_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that empty orderby tuple is blocked.

    Defensive barrier: empty tuples are invalid.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": ["name"],
        "groupby": [],
        "metrics": ["count"],
    }
    query_context.form_data = {
        "slice_id": 42,
        "columns": ["name"],
        "metrics": ["count"],
        # Invalid: empty tuple
        "orderby": [[]],
    }
    query_context.queries = []

    # Should return True (blocked)
    assert query_context_modified(query_context)


def test_query_context_modified_orderby_missing_direction_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that orderby entries without a direction are blocked.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": ["name"],
        "groupby": [],
        "metrics": ["count"],
    }
    query_context.form_data = {
        "slice_id": 42,
        "columns": ["name"],
        "metrics": ["count"],
        "orderby": [["name"]],
    }
    query_context.queries = []

    assert query_context_modified(query_context)


def test_query_context_modified_orderby_non_bool_direction_blocked(
    mocker: MockerFixture,
) -> None:
    """
    Test that orderby direction must be a boolean for new guest sort terms.
    """
    query_context = mocker.MagicMock()
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {
        "columns": ["name"],
        "groupby": [],
        "metrics": ["count"],
    }
    query_context.form_data = {
        "slice_id": 42,
        "columns": ["name"],
        "metrics": ["count"],
        "orderby": [["name", "true"]],
    }
    query_context.queries = []

    assert query_context_modified(query_context)


def test_validate_guest_token_resources_rejects_non_embedded_int_id(
    app_context: None, mocker: MockerFixture
) -> None:
    """A raw int dashboard id must reference an embedded dashboard, else a guest
    token could be scoped to a non-embedded dashboard."""
    from superset.commands.dashboard.embedded.exceptions import (
        EmbeddedDashboardNotFoundError,
    )
    from superset.security.guest_token import GuestTokenResourceType

    sm = SupersetSecurityManager(appbuilder)
    non_embedded = MagicMock()
    non_embedded.embedded = []  # not embedded
    mocker.patch("superset.models.dashboard.Dashboard.get", return_value=non_embedded)

    with pytest.raises(EmbeddedDashboardNotFoundError):
        sm.validate_guest_token_resources(
            [{"type": GuestTokenResourceType.DASHBOARD, "id": 5}]
        )


def test_validate_guest_token_resources_accepts_embedded_int_id(
    app_context: None, mocker: MockerFixture
) -> None:
    """A raw int id for an embedded dashboard is accepted when the caller
    minting the token is entitled to it."""
    from superset.security.guest_token import GuestTokenResourceType

    sm = SupersetSecurityManager(appbuilder)
    embedded_dash = MagicMock()
    embedded_dash.embedded = [MagicMock()]  # embedded
    mocker.patch("superset.models.dashboard.Dashboard.get", return_value=embedded_dash)
    raise_for_access = mocker.patch.object(sm, "raise_for_access")
    # An admin's dashboard entitlement covers every member datasource, so the
    # per-datasource minting check is skipped (see the dedicated tests below).
    mocker.patch.object(sm, "is_admin", return_value=True)

    sm.validate_guest_token_resources(
        [{"type": GuestTokenResourceType.DASHBOARD, "id": 5}]
    )

    raise_for_access.assert_called_once_with(dashboard=embedded_dash)


def test_validate_guest_token_resources_rejects_unauthorized_dashboard(
    app_context: None, mocker: MockerFixture
) -> None:
    """
    Minting a guest token for a dashboard the calling principal is not
    themselves entitled to must be refused. Without this, a non-Admin role
    granted only the coarse `can_grant_guest_token` permission (a realistic
    "embedding backend service" grant, since SECURITY.md treats an
    operator-narrowed permission as shifting the boundary, not redefining
    the model) could mint a valid guest token scoped to *any* embedded
    dashboard in the instance, not just ones it can see.
    """
    from superset.commands.dashboard.embedded.exceptions import (
        EmbeddedDashboardAccessDeniedError,
    )
    from superset.exceptions import SupersetSecurityException
    from superset.security.guest_token import GuestTokenResourceType

    sm = SupersetSecurityManager(appbuilder)
    embedded_dash = MagicMock()
    embedded_dash.embedded = [MagicMock()]  # embedded
    mocker.patch("superset.models.dashboard.Dashboard.get", return_value=embedded_dash)
    mocker.patch.object(
        sm,
        "raise_for_access",
        side_effect=SupersetSecurityException(mocker.MagicMock()),
    )

    with pytest.raises(EmbeddedDashboardAccessDeniedError):
        sm.validate_guest_token_resources(
            [{"type": GuestTokenResourceType.DASHBOARD, "id": 5}]
        )


def _guest_token_dashboard_with_datasources(
    mocker: MockerFixture, ids: list[int]
) -> MagicMock:
    """A published, non-RBAC dashboard whose slices resolve to datasources ``ids``."""
    dashboard = MagicMock()
    dashboard.embedded = [MagicMock()]
    dashboard.viewers = []
    dashboard.published = True
    slices = []
    for ds_id in ids:
        slc = MagicMock()
        slc.datasource_type = "table"
        slc.datasource_id = ds_id
        slc.resolved_datasource = MagicMock(id=ds_id)
        slices.append(slc)
    dashboard.slices = slices
    mocker.patch("superset.models.dashboard.Dashboard.get", return_value=dashboard)
    return dashboard


def test_validate_guest_token_resources_requires_every_granted_datasource(
    app_context: None, mocker: MockerFixture
) -> None:
    """
    A dashboard-scoped guest token grants every member datasource, but
    ``raise_for_access(dashboard=...)`` passes on a non-RBAC dashboard as soon
    as the caller can read any ONE of them. Minting must therefore require
    access to each datasource the token will grant.
    """
    from superset.commands.dashboard.embedded.exceptions import (
        EmbeddedDashboardAccessDeniedError,
    )
    from superset.security.guest_token import GuestTokenResourceType

    sm = SupersetSecurityManager(appbuilder)
    _guest_token_dashboard_with_datasources(mocker, [1, 2])
    mocker.patch.object(sm, "raise_for_access", return_value=None)
    mocker.patch.object(sm, "is_admin", return_value=False)
    mocker.patch.object(sm, "is_editor", return_value=False)
    mocker.patch.object(sm, "is_viewer", return_value=False)
    # Can read datasource 1 only.
    mocker.patch.object(sm, "can_access_datasource", side_effect=lambda ds: ds.id == 1)

    with pytest.raises(EmbeddedDashboardAccessDeniedError):
        sm.validate_guest_token_resources(
            [{"type": GuestTokenResourceType.DASHBOARD, "id": 5}]
        )


def test_validate_guest_token_resources_datasets_claim_limits_the_check(
    app_context: None, mocker: MockerFixture
) -> None:
    """
    When the token carries a ``datasets`` allowlist, only those datasources
    are granted, so only those need to be accessible to the minting caller.
    """
    from superset.security.guest_token import GuestTokenResourceType

    sm = SupersetSecurityManager(appbuilder)
    _guest_token_dashboard_with_datasources(mocker, [1, 2])
    mocker.patch.object(sm, "raise_for_access", return_value=None)
    mocker.patch.object(sm, "is_admin", return_value=False)
    mocker.patch.object(sm, "is_editor", return_value=False)
    mocker.patch.object(sm, "is_viewer", return_value=False)
    mocker.patch.object(sm, "can_access_datasource", side_effect=lambda ds: ds.id == 1)

    # Restricted to datasource 1, which the caller can read: allowed.
    sm.validate_guest_token_resources(
        [{"type": GuestTokenResourceType.DASHBOARD, "id": 5}], datasets=[1]
    )


def test_validate_guest_token_resources_rbac_viewer_skips_datasource_check(
    app_context: None, mocker: MockerFixture
) -> None:
    """
    A viewer of a published RBAC dashboard is entitled to every member chart
    through the dashboard itself, so no per-datasource check applies.
    """
    from superset.security.guest_token import GuestTokenResourceType

    sm = SupersetSecurityManager(appbuilder)
    dashboard = _guest_token_dashboard_with_datasources(mocker, [1, 2])
    dashboard.viewers = [MagicMock()]
    mocker.patch.object(sm, "raise_for_access", return_value=None)
    mocker.patch.object(sm, "is_admin", return_value=False)
    mocker.patch.object(sm, "is_editor", return_value=False)
    mocker.patch.object(sm, "is_viewer", return_value=True)
    can_access = mocker.patch.object(sm, "can_access_datasource", return_value=False)

    sm.validate_guest_token_resources(
        [{"type": GuestTokenResourceType.DASHBOARD, "id": 5}]
    )
    can_access.assert_not_called()


def test_validate_guest_token_resources_checks_access_via_embedded_dao_fallback(
    app_context: None, mocker: MockerFixture
) -> None:
    """
    The same access check applies on the EmbeddedDashboardDAO lookup path
    (a resource id that isn't a plain dashboard id -- e.g. the embedded
    config's own uuid), not just the `Dashboard.get` path.
    """
    from superset.exceptions import SupersetSecurityException
    from superset.security.guest_token import GuestTokenResourceType

    sm = SupersetSecurityManager(appbuilder)
    mocker.patch("superset.models.dashboard.Dashboard.get", return_value=None)
    target_dashboard = MagicMock()
    embedded = MagicMock()
    embedded.dashboard = target_dashboard
    mocker.patch(
        "superset.daos.dashboard.EmbeddedDashboardDAO.find_by_id",
        return_value=embedded,
    )
    raise_for_access = mocker.patch.object(
        sm,
        "raise_for_access",
        side_effect=SupersetSecurityException(mocker.MagicMock()),
    )

    from superset.commands.dashboard.embedded.exceptions import (
        EmbeddedDashboardAccessDeniedError,
    )

    with pytest.raises(EmbeddedDashboardAccessDeniedError):
        sm.validate_guest_token_resources(
            [{"type": GuestTokenResourceType.DASHBOARD, "id": "some-uuid"}]
        )

    raise_for_access.assert_called_once_with(dashboard=target_dashboard)


def test_is_editor_query_owner(mocker: MockerFixture, app_context: None) -> None:
    """
    Test that a Query owner is considered an editor via Subject resolution.
    """
    from superset.models.sql_lab import Query

    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_admin", return_value=False)
    mocker.patch(
        "superset.security.manager.get_user_id",
        return_value=100,
    )
    mocker.patch(
        "superset.subjects.utils.get_user_subject_ids",
        return_value={1000},
    )
    mocker.patch(
        "superset.security.manager.get_extra_editor_subject_ids",
        return_value=set(),
    )

    subject_user_100 = mocker.MagicMock(id=1000)
    subject_user_200 = mocker.MagicMock(id=2000)

    def mock_get_user_subject(uid: int):
        if uid == 100:
            return subject_user_100
        if uid == 200:
            return subject_user_200
        return None

    mocker.patch(
        "superset.subjects.utils.get_user_subject",
        side_effect=mock_get_user_subject,
    )

    query = Query(user_id=100)
    assert sm.is_editor(query) is True

    other_query = Query(user_id=200)
    assert sm.is_editor(other_query) is False


def test_is_editor_saved_query_owner(mocker: MockerFixture, app_context: None) -> None:
    """
    Test that a SavedQuery owner is considered an editor via Subject resolution.
    """
    from superset.models.sql_lab import SavedQuery

    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_admin", return_value=False)
    mocker.patch(
        "superset.security.manager.get_user_id",
        return_value=100,
    )
    mocker.patch(
        "superset.subjects.utils.get_user_subject_ids",
        return_value={1000},
    )
    mocker.patch(
        "superset.security.manager.get_extra_editor_subject_ids",
        return_value=set(),
    )

    subject_user_100 = mocker.MagicMock(id=1000)
    subject_user_200 = mocker.MagicMock(id=2000)

    def mock_get_user_subject(uid: int):
        if uid == 100:
            return subject_user_100
        if uid == 200:
            return subject_user_200
        return None

    mocker.patch(
        "superset.subjects.utils.get_user_subject",
        side_effect=mock_get_user_subject,
    )

    saved_query = SavedQuery(user_id=100)
    assert sm.is_editor(saved_query) is True

    other_saved_query = SavedQuery(user_id=200)
    assert sm.is_editor(other_saved_query) is False


def test_is_editor_other_model_with_user_id_not_editor(
    mocker: MockerFixture, app_context: None
) -> None:
    """
    Test that a model with user_id that is NOT Query or SavedQuery
    does NOT receive the fallback and is not considered an editor.
    """
    from superset.models.sql_lab import TabState

    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_admin", return_value=False)
    mocker.patch(
        "superset.security.manager.get_user_id",
        return_value=100,
    )
    mocker.patch(
        "superset.subjects.utils.get_user_subject_ids",
        return_value={1000},
    )
    mocker.patch(
        "superset.security.manager.get_extra_editor_subject_ids",
        return_value=set(),
    )

    subject_user_100 = mocker.MagicMock(id=1000)
    mocker.patch(
        "superset.subjects.utils.get_user_subject",
        return_value=subject_user_100,
    )

    tab_state = TabState(user_id=100)
    assert sm.is_editor(tab_state) is False


def _pvm(permission: str, view_menu: str) -> SimpleNamespace:
    """A minimal PermissionView stand-in for the role classifiers."""
    return SimpleNamespace(
        permission=SimpleNamespace(name=permission),
        view_menu=SimpleNamespace(name=view_menu),
    )


def _classifier() -> SupersetSecurityManager:
    """An uninitialized manager: the classifiers read only class-level sets."""
    return SupersetSecurityManager.__new__(SupersetSecurityManager)


def test_semantic_layer_classified_like_database() -> None:
    """A semantic layer is a credentialed connection: Database parity.

    Writes are admin-only; reads are not admin-only (they reach Gamma with
    the configuration masked). Membership is asserted alongside behaviour
    so a set refactor cannot silently drop the classification.
    """
    sm = _classifier()
    assert "SemanticLayer" in sm.READ_ONLY_MODEL_VIEWS
    assert sm._is_admin_only(_pvm("can_write", "SemanticLayer"))
    assert not sm._is_admin_only(_pvm("can_read", "SemanticLayer"))
    assert not sm._is_alpha_only(_pvm("can_read", "SemanticLayer"))
    # Same rule that governs Database:
    assert sm._is_admin_only(_pvm("can_write", "Database"))


def test_semantic_view_classified_like_dataset() -> None:
    """A semantic view carries no credentials: Dataset parity.

    Writes are Alpha-tier (alpha-only, not admin-only); reads reach Gamma.
    """
    sm = _classifier()
    assert "SemanticView" in sm.GAMMA_READ_ONLY_MODEL_VIEWS
    assert sm._is_alpha_only(_pvm("can_write", "SemanticView"))
    assert not sm._is_admin_only(_pvm("can_write", "SemanticView"))
    assert not sm._is_alpha_only(_pvm("can_read", "SemanticView"))
    # Same rule that governs Dataset:
    assert sm._is_alpha_only(_pvm("can_write", "Dataset"))


def test_gamma_receives_no_semantic_write_pvm() -> None:
    """Negative control for the Gamma role classifier.

    ``sync_role_definitions`` builds Gamma from ``_is_gamma_pvm``; neither
    write pvm may pass it, while both read pvms must (reads return masked
    configurations for layers).
    """
    sm = _classifier()
    assert not sm._is_gamma_pvm(_pvm("can_write", "SemanticLayer"))
    assert not sm._is_gamma_pvm(_pvm("can_write", "SemanticView"))
    assert sm._is_gamma_pvm(_pvm("can_read", "SemanticLayer"))
    assert sm._is_gamma_pvm(_pvm("can_read", "SemanticView"))


def test_skip_legacy_fab_password_view_registration_refuses_reset_views(
    app_context: None,
) -> None:
    """The patched ``add_view_no_menu`` drops both legacy reset views, whether
    FAB hands over an instance (as ``register_views`` does) or the class, and
    passes everything else through to the original."""

    class NonPasswordView:
        pass

    registered: list[Any] = []

    def add_view_no_menu(baseview: Any, *args: Any, **kwargs: Any) -> Any:
        registered.append(baseview)
        return baseview

    fake_appbuilder = SimpleNamespace(add_view_no_menu=add_view_no_menu)
    sm = SupersetSecurityManager.__new__(SupersetSecurityManager)
    sm.appbuilder = fake_appbuilder

    original = sm._skip_legacy_fab_password_view_registration()
    assert original is add_view_no_menu

    fake_appbuilder.add_view_no_menu(ResetPasswordView())
    fake_appbuilder.add_view_no_menu(ResetMyPasswordView())
    fake_appbuilder.add_view_no_menu(ResetPasswordView)
    fake_appbuilder.add_view_no_menu(ResetMyPasswordView)
    fake_appbuilder.add_view_no_menu(NonPasswordView)

    assert registered == [NonPasswordView]


def test_register_views_never_registers_legacy_password_views(
    app_context: None, mocker: MockerFixture
) -> None:
    """End to end through ``register_views``: the reset views FAB adds for
    ``AUTH_DB`` never reach the appbuilder, other views do, and the appbuilder's
    ``add_view_no_menu`` is restored once FAB's registration is done."""
    mocker.patch.dict(
        current_app.config,
        {
            "AUTH_TYPE": AUTH_DB,
            "AUTH_USER_REGISTRATION": False,
            "AUTH_RATE_LIMITED": False,
        },
    )
    mock_appbuilder = mocker.MagicMock()
    mock_appbuilder.baseviews = []
    mock_appbuilder.menu.get_list.return_value = []
    original_add_view_no_menu = mock_appbuilder.add_view_no_menu

    sm = SupersetSecurityManager.__new__(SupersetSecurityManager)
    sm.appbuilder = mock_appbuilder
    sm.register_superset_auth_view = True
    sm.register_superset_registeruser_view = False
    sm.userstatschartview = None

    class NonPasswordView:
        pass

    def fab_register_views(fab_sm: SupersetSecurityManager) -> None:
        # What FAB's ``register_views`` does for AUTH_DB, reduced to the calls
        # that matter here.
        fab_sm.appbuilder.add_view_no_menu(ResetPasswordView())
        fab_sm.appbuilder.add_view_no_menu(ResetMyPasswordView())
        fab_sm.appbuilder.add_view_no_menu(NonPasswordView)

    mocker.patch(
        "flask_appbuilder.security.sqla.manager.SecurityManager.register_views",
        autospec=True,
        side_effect=fab_register_views,
    )

    sm.register_views()

    registered = [call.args[0] for call in original_add_view_no_menu.call_args_list]
    assert NonPasswordView in registered
    assert not any(
        isinstance(view, (ResetPasswordView, ResetMyPasswordView))
        or view in (ResetPasswordView, ResetMyPasswordView)
        for view in registered
    )
    assert mock_appbuilder.add_view_no_menu is original_add_view_no_menu


def test_disable_legacy_password_reset_launchers(app_context: None) -> None:
    """The user view's two reset buttons are hidden and answer 404, while
    unrelated actions on the same view are left alone.

    FAB's ``UserDBModelView`` actions redirect to the reset views via
    ``url_for``, which would raise ``BuildError`` (a 500) since those views are
    never registered.
    """

    def launcher(item: Any) -> str:
        return "redirect"

    actions = {
        name: ActionItem(name, name, None, "fa-lock", False, True, launcher)
        for name in ("resetpasswords", "resetmypassword", "userinfoedit")
    }
    sm = SupersetSecurityManager.__new__(SupersetSecurityManager)
    sm.user_view = SimpleNamespace(actions=actions)

    sm._disable_legacy_password_reset_launchers()

    for name in ("resetpasswords", "resetmypassword"):
        assert actions[name].single is False
        assert actions[name].multiple is False
        with pytest.raises(NotFound):
            actions[name].func(None)
    assert actions["userinfoedit"].single is True
    assert actions["userinfoedit"].func(None) == "redirect"


def test_disable_legacy_password_reset_launchers_without_user_view() -> None:
    """Auth backends other than AUTH_DB have no reset launchers to hide."""
    sm = SupersetSecurityManager.__new__(SupersetSecurityManager)
    sm.user_view = None

    sm._disable_legacy_password_reset_launchers()


@pytest.mark.parametrize(
    "permission,view_menu,expected",
    [
        ("can_this_form_get", "ResetPasswordView", True),
        ("can_this_form_post", "ResetPasswordView", True),
        ("can_this_form_get", "ResetMyPasswordView", True),
        ("can_this_form_post", "ResetMyPasswordView", True),
        ("resetpasswords", "UserDBModelView", True),
        ("resetmypassword", "UserDBModelView", True),
        ("userinfoedit", "UserDBModelView", False),
        ("can_userinfo", "UserDBModelView", False),
        ("resetmypassword", "SomeOtherView", False),
        ("can_read", "Dashboard", False),
    ],
)
def test_is_legacy_password_pvm(
    permission: str, view_menu: str, expected: bool
) -> None:
    assert (
        SupersetSecurityManager._is_legacy_password_pvm(_pvm(permission, view_menu))
        is expected
    )


def test_sync_role_definitions_excludes_stale_legacy_password_pvms(
    mocker: MockerFixture, app_context: None
) -> None:
    """Upgraded installs must not have any role retain the removed views.

    The reset views' permission rows (and the user-view launcher actions that
    redirected to them) persist in the metadata database of an installation
    that ran them before, and ``_get_all_pvms`` still returns them;
    ``sync_role_definitions`` has to leave them out of every role.
    """
    sm = SupersetSecurityManager(appbuilder)
    stale_pvms = [
        _pvm("can_this_form_get", "ResetPasswordView"),
        _pvm("can_this_form_post", "ResetMyPasswordView"),
        _pvm("resetpasswords", "UserDBModelView"),
        _pvm("resetmypassword", "UserDBModelView"),
    ]
    other_pvm = _pvm("can_read", "Dashboard")

    mocker.patch.object(sm, "create_custom_permissions")
    mocker.patch.object(sm, "_get_all_pvms", return_value=[*stale_pvms, other_pvm])
    mock_set_role = mocker.patch.object(sm, "set_role")
    mocker.patch.object(sm, "create_missing_perms")
    mocker.patch.object(sm, "clean_perms")
    mocker.patch.dict(current_app.config, {"PUBLIC_ROLE_LIKE": None})

    sm.sync_role_definitions()

    assert mock_set_role.call_args_list
    for call in mock_set_role.call_args_list:
        role_name, _classifier_fn, synced_pvms = call.args
        for stale_pvm in stale_pvms:
            assert stale_pvm not in synced_pvms, role_name
        assert other_pvm in synced_pvms, role_name


def test_reset_password_self_service_commits_cleared_flag(
    mocker: MockerFixture, app_context: None
) -> None:
    """``clear_password_must_change`` no longer commits on its own, so the
    self-service branch of ``reset_password`` has to."""
    sm = SupersetSecurityManager(appbuilder)
    mocker.patch(
        "superset.security.manager.g", new=SimpleNamespace(user=SimpleNamespace(id=5))
    )
    mocker.patch(
        "flask_appbuilder.security.manager.BaseSecurityManager.reset_password",
        return_value=None,
    )
    mock_clear = mocker.patch(
        "superset.security.password_change.clear_password_must_change"
    )
    mock_commit = mocker.patch("superset.db.session.commit")

    sm.reset_password(5, "new-password")

    mock_clear.assert_called_once_with(5)
    # One commit for the session-invalidation stamp, one for the cleared flag.
    assert mock_commit.call_count == 2


@pytest.mark.parametrize("granted", [True, False])
def test_raise_for_access_never_reads_queries_for_non_guest(
    mocker: MockerFixture,
    app_context: None,
    granted: bool,
) -> None:
    """
    Pin the invariant the chart-data semantic preflight relies on: for a
    non-guest caller, ``raise_for_access`` decides from the datasource and form
    data alone and never reads ``query_context.queries``.
    """
    sm: SupersetSecurityManager = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    mocker.patch.object(sm, "can_access", return_value=granted)
    mocker.patch.object(sm, "can_access_schema", return_value=False)
    mocker.patch.object(sm, "_semantic_layer_grant_allows", return_value=False)
    mocker.patch.object(sm, "is_editor", return_value=False)

    query_context: MagicMock = mocker.MagicMock()
    # A consistent saved chart, so a payload comparison would reach the queries
    # rather than stopping at a slice mismatch.
    query_context.slice_.id = 42
    query_context.slice_.query_context = None
    query_context.slice_.params_dict = {}
    query_context.form_data = {"slice_id": 42}
    type(query_context).queries = mocker.PropertyMock(
        side_effect=AssertionError("raise_for_access read query_context.queries")
    )

    if granted:
        sm.raise_for_access(query_context=query_context)
    else:
        with pytest.raises(SupersetSecurityException):
            sm.raise_for_access(query_context=query_context)


_DASHBOARD_ID: int = 7
_VIEW_ID: int = 1
_OTHER_VIEW_ID: int = 2


def _chart(mocker: MockerFixture, chart_id: int, datasource_id: int) -> MagicMock:
    """A saved chart on the given semantic view."""
    chart: MagicMock = mocker.MagicMock(
        id=chart_id, datasource_id=datasource_id, datasource_type="semantic_view"
    )
    return chart


@pytest.mark.parametrize(
    "path",
    ["native-filter", "chart", "multilayer-child", "drill-to-detail", "drill-by"],
)
def test_raise_for_access_dashboard_paths_never_read_queries_for_non_guest(
    mocker: MockerFixture,
    app_context: None,
    path: str,
) -> None:
    """
    Extend the non-guest invariant to the dashboard, viewer and drill branches.

    Each case passes every earlier check on its branch and is refused only by
    that branch's last check, which a spy proves was reached, so a read of
    ``query_context.queries`` anywhere along the branch would fail the test.
    """
    from superset.models.dashboard import Dashboard
    from superset.security import manager as manager_module

    sm: SupersetSecurityManager = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    mocker.patch.object(sm, "can_access", return_value=False)
    mocker.patch.object(sm, "can_access_schema", return_value=False)
    mocker.patch.object(sm, "_semantic_layer_grant_allows", return_value=False)
    mocker.patch.object(sm, "is_editor", return_value=False)
    mocker.patch.object(sm, "is_viewer", return_value=True)
    mocker.patch.object(sm, "has_promiscuous_dashboard_access", return_value=True)
    mocker.patch.object(sm, "can_access_dashboard", return_value=True)
    mocker.patch.object(sm, "_validate_child_in_parent_multilayer", return_value=True)
    mocker.patch("superset.is_feature_enabled", return_value=True)
    mocker.patch.dict(current_app.config, {"VIEWER_PROMISCUOUS_MODE": True})
    matches: MagicMock = mocker.patch.object(
        manager_module,
        "_datasource_matches",
        wraps=manager_module._datasource_matches,
    )

    datasource: MagicMock = mocker.MagicMock(
        id=_VIEW_ID, type="semantic_view", perm="[view](id:1)"
    )
    datasource.has_drill_by_columns.return_value = False
    own_chart: MagicMock = _chart(mocker, 42, _VIEW_ID)
    foreign_chart: MagicMock = _chart(mocker, 42, _OTHER_VIEW_ID)
    parent_chart: MagicMock = _chart(mocker, 43, _OTHER_VIEW_ID)
    native_filters: list[dict[str, Any]] = [
        {
            "id": "f",
            "targets": [
                {"datasetId": _OTHER_VIEW_ID, "datasourceType": "semantic_view"}
            ],
        }
    ]

    form_data: dict[str, Any]
    charts: dict[int, MagicMock]
    if path == "native-filter":
        form_data = {
            "dashboardId": _DASHBOARD_ID,
            "type": "NATIVE_FILTER",
            "native_filter_id": "f",
        }
        charts = {}
    elif path == "chart":
        form_data = {"dashboardId": _DASHBOARD_ID, "slice_id": 42}
        charts = {42: foreign_chart}
    elif path == "multilayer-child":
        form_data = {
            "dashboardId": _DASHBOARD_ID,
            "slice_id": 42,
            "parent_slice_id": 43,
        }
        charts = {42: foreign_chart, 43: parent_chart}
    elif path == "drill-to-detail":
        form_data = {"dashboardId": _DASHBOARD_ID}
        charts = {}
    else:
        form_data = {
            "dashboardId": _DASHBOARD_ID,
            "slice_id": 0,
            "chart_id": 42,
            "groupby": ["a"],
        }
        charts = {42: own_chart}

    dashboard: MagicMock = mocker.MagicMock(
        id=_DASHBOARD_ID,
        json_metadata=json.dumps({"native_filter_configuration": native_filters}),
        slices=list(charts.values()),
    )
    dashboard.has_member_datasource.return_value = False

    def query(model: Any) -> MagicMock:
        """Resolve ``Model.id == <value>`` lookups against the fixtures."""
        rows: dict[int, MagicMock] = (
            {_DASHBOARD_ID: dashboard} if model is Dashboard else charts
        )
        chain: MagicMock = mocker.MagicMock()
        chain.filter.side_effect = lambda clause: mocker.MagicMock(
            one_or_none=lambda: rows.get(clause.right.value)
        )
        return chain

    mocker.patch.object(
        SupersetSecurityManager,
        "session",
        new_callable=mocker.PropertyMock,
        return_value=mocker.MagicMock(query=query),
    )

    query_context: MagicMock = mocker.MagicMock()
    query_context.datasource = datasource
    query_context.form_data = form_data
    type(query_context).queries = mocker.PropertyMock(
        side_effect=AssertionError("raise_for_access read query_context.queries")
    )

    excinfo: pytest.ExceptionInfo[SupersetSecurityException]
    with pytest.raises(SupersetSecurityException) as excinfo:
        sm.raise_for_access(query_context=query_context)

    assert (
        excinfo.value.error.error_type
        == SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR
    )
    # Prove each case reached its branch's final check.
    if path == "drill-by":
        datasource.has_drill_by_columns.assert_called_once_with(["a"])
    elif path == "drill-to-detail":
        dashboard.has_member_datasource.assert_called_once_with(datasource)
    else:
        matches.assert_any_call(datasource, _OTHER_VIEW_ID, "semantic_view")


@pytest.mark.parametrize("dashboard_granted", [True, False])
@pytest.mark.parametrize("path", ["drill-to-detail", "drill-by"])
def test_raise_for_access_dashboard_final_check_never_reads_queries_for_non_guest(
    mocker: MockerFixture,
    app_context: None,
    path: str,
    dashboard_granted: bool,
) -> None:
    """
    Carry the non-guest invariant through a successful drill to the shared final
    ``can_access_dashboard`` check.

    The drill's membership or dimension check passes, so the final dashboard
    check alone decides the outcome; a spy proves it was reached, and a read of
    ``query_context.queries`` on the way there or around it fails the test.
    """
    from superset.models.dashboard import Dashboard

    sm: SupersetSecurityManager = SupersetSecurityManager(appbuilder)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    mocker.patch.object(sm, "can_access", return_value=False)
    mocker.patch.object(sm, "can_access_schema", return_value=False)
    mocker.patch.object(sm, "_semantic_layer_grant_allows", return_value=False)
    mocker.patch.object(sm, "is_editor", return_value=False)
    mocker.patch.object(sm, "is_viewer", return_value=True)
    mocker.patch.object(sm, "has_promiscuous_dashboard_access", return_value=True)
    final_check: MagicMock = mocker.patch.object(
        sm, "can_access_dashboard", return_value=dashboard_granted
    )
    mocker.patch("superset.is_feature_enabled", return_value=True)
    mocker.patch.dict(current_app.config, {"VIEWER_PROMISCUOUS_MODE": True})

    datasource: MagicMock = mocker.MagicMock(
        id=_VIEW_ID, type="semantic_view", perm="[view](id:1)"
    )
    datasource.has_drill_by_columns.return_value = True

    form_data: dict[str, Any]
    charts: dict[int, MagicMock]
    if path == "drill-to-detail":
        form_data = {"dashboardId": _DASHBOARD_ID}
        charts = {}
    else:
        form_data = {
            "dashboardId": _DASHBOARD_ID,
            "slice_id": 0,
            "chart_id": 42,
            "groupby": ["a"],
        }
        charts = {42: _chart(mocker, 42, _VIEW_ID)}

    dashboard: MagicMock = mocker.MagicMock(
        id=_DASHBOARD_ID, json_metadata=None, slices=list(charts.values())
    )
    dashboard.has_member_datasource.return_value = True

    def query(model: Any) -> MagicMock:
        """Resolve ``Model.id == <value>`` lookups against the fixtures."""
        rows: dict[int, MagicMock] = (
            {_DASHBOARD_ID: dashboard} if model is Dashboard else charts
        )
        chain: MagicMock = mocker.MagicMock()
        chain.filter.side_effect = lambda clause: mocker.MagicMock(
            one_or_none=lambda: rows.get(clause.right.value)
        )
        return chain

    mocker.patch.object(
        SupersetSecurityManager,
        "session",
        new_callable=mocker.PropertyMock,
        return_value=mocker.MagicMock(query=query),
    )

    query_context: MagicMock = mocker.MagicMock()
    query_context.datasource = datasource
    query_context.form_data = form_data
    type(query_context).queries = mocker.PropertyMock(
        side_effect=AssertionError("raise_for_access read query_context.queries")
    )

    if dashboard_granted:
        sm.raise_for_access(query_context=query_context)
    else:
        excinfo: pytest.ExceptionInfo[SupersetSecurityException]
        with pytest.raises(SupersetSecurityException) as excinfo:
            sm.raise_for_access(query_context=query_context)
        assert (
            excinfo.value.error.error_type
            == SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR
        )

    # The drill succeeded, so the final dashboard check made the decision.
    if path == "drill-by":
        datasource.has_drill_by_columns.assert_called_once_with(["a"])
    else:
        dashboard.has_member_datasource.assert_called_once_with(datasource)
    final_check.assert_called_once_with(dashboard)


def test_dataset_delete_uses_stored_permission_identity(
    mocker: MockerFixture, app_context: None
) -> None:
    """The delete hook must retire the PVM actually stored on the dataset."""
    sm: SupersetSecurityManager = SupersetSecurityManager(appbuilder)
    target: MagicMock = MagicMock()
    target.perm = "[stored](id:42)"
    mapper: MagicMock = MagicMock()
    connection: MagicMock = MagicMock()
    mocker.patch.object(sm, "get_dataset_perm", return_value="[derived](id:42)")
    owned_elsewhere: MagicMock = mocker.patch.object(
        sm, "_datasource_perm_owned_elsewhere", return_value=False
    )
    delete_pvm: MagicMock = mocker.patch.object(sm, "_delete_pvm_on_sqla_event")

    sm.dataset_after_delete(mapper, connection, target)

    owned_elsewhere.assert_called_once_with(connection, "[stored](id:42)", None)
    delete_pvm.assert_called_once_with(
        mapper, connection, "datasource_access", "[stored](id:42)"
    )


def test_dataset_delete_derives_missing_stored_permission(
    mocker: MockerFixture, app_context: None
) -> None:
    """Legacy rows without a stored permission still clean up their grant."""
    sm: SupersetSecurityManager = SupersetSecurityManager(appbuilder)
    target: MagicMock = MagicMock()
    target.perm = None
    mapper: MagicMock = MagicMock()
    connection: MagicMock = MagicMock()
    mocker.patch.object(sm, "get_dataset_perm", return_value="[derived](id:42)")
    mocker.patch.object(sm, "_datasource_perm_owned_elsewhere", return_value=False)
    delete_pvm: MagicMock = mocker.patch.object(sm, "_delete_pvm_on_sqla_event")

    sm.dataset_after_delete(mapper, connection, target)

    delete_pvm.assert_called_once_with(
        mapper, connection, "datasource_access", "[derived](id:42)"
    )


def test_shared_permission_owner_probe_locks_permission_first(
    app_context: None,
) -> None:
    """Competing final-owner deletes must serialize before checking owners."""
    from sqlalchemy.dialects import postgresql

    sm: SupersetSecurityManager = SupersetSecurityManager(appbuilder)
    connection: MagicMock = MagicMock()
    connection.execute.return_value.scalar_one_or_none.return_value = 1
    connection.execute.return_value.first.return_value = None

    assert (
        sm._datasource_perm_owned_elsewhere(  # pylint: disable=protected-access
            connection, "[shared](id:42)", None
        )
        is False
    )

    first_statement: Any = connection.execute.call_args_list[0].args[0]
    sql: str = str(first_statement.compile(dialect=postgresql.dialect()))
    assert "ab_view_menu" in sql
    assert "FOR UPDATE" in sql


def test_semantic_layer_delete_locks_child_permission_before_owner_probe(
    app_context: None,
) -> None:
    """A cascading child delete must use the shared owner-deletion lock."""
    from sqlalchemy.dialects import postgresql

    sm: SupersetSecurityManager = SupersetSecurityManager(appbuilder)
    connection: MagicMock = MagicMock()
    connection.execute.side_effect = [
        MagicMock(scalars=MagicMock(return_value=["[shared](id:42)"])),
        MagicMock(all=MagicMock(return_value=[1])),
        MagicMock(scalars=MagicMock(return_value=[])),
        MagicMock(scalars=MagicMock(return_value=[])),
    ]
    target: MagicMock = MagicMock()
    target.uuid = "layer-uuid"

    sm.semantic_layer_before_delete(MagicMock(), connection, target)

    child_statement: Any = connection.execute.call_args_list[0].args[0]
    child_sql: str = str(child_statement.compile(dialect=postgresql.dialect()))
    assert "semantic_views" in child_sql
    assert "ORDER BY semantic_views.id" in child_sql
    assert "FOR UPDATE" in child_sql

    lock_statement: Any = connection.execute.call_args_list[1].args[0]
    sql: str = str(lock_statement.compile(dialect=postgresql.dialect()))
    assert "ab_view_menu" in sql
    assert "ORDER BY" in sql
    assert "FOR UPDATE" in sql


@pytest.mark.parametrize("dialect_name", ["mysql", "mariadb"])
@pytest.mark.parametrize("isolation", ["REPEATABLE READ", "SERIALIZABLE", None])
def test_shared_permission_cleanup_retains_on_unsafe_mysql_isolation(
    dialect_name: str, isolation: str | None, mocker: MockerFixture, app_context: None
) -> None:
    """An untrusted MySQL snapshot must not retire a shared grant."""
    sm: SupersetSecurityManager = SupersetSecurityManager(appbuilder)
    connection: MagicMock = MagicMock()
    connection.dialect.name = dialect_name
    connection.get_isolation_level.return_value = isolation
    warning: MagicMock = mocker.patch("superset.security.manager.logger.warning")

    assert (
        sm._datasource_perm_owned_elsewhere(  # pylint: disable=protected-access
            connection, "[shared](id:42)", None
        )
        is True
    )
    connection.execute.assert_not_called()
    warning.assert_called_once()


@pytest.mark.parametrize("dialect_name", ["mysql", "mariadb"])
def test_shared_permission_cleanup_retains_when_mysql_isolation_cannot_be_read(
    dialect_name: str, mocker: MockerFixture, app_context: None
) -> None:
    """Isolation lookup failure must leave the grant in place."""
    sm: SupersetSecurityManager = SupersetSecurityManager(appbuilder)
    connection: MagicMock = MagicMock()
    connection.dialect.name = dialect_name
    connection.get_isolation_level.side_effect = RuntimeError("unavailable")
    warning: MagicMock = mocker.patch("superset.security.manager.logger.warning")

    assert (
        sm._datasource_perm_owned_elsewhere(  # pylint: disable=protected-access
            connection, "[shared](id:42)", None
        )
        is True
    )
    connection.execute.assert_not_called()
    warning.assert_called_once()


@pytest.mark.parametrize("dialect_name", ["mysql", "mariadb"])
def test_dataset_delete_retains_grant_on_mysql_repeatable_read(
    dialect_name: str, mocker: MockerFixture, app_context: None
) -> None:
    """The ORM delete hook must not revoke a possibly shared grant."""
    sm: SupersetSecurityManager = SupersetSecurityManager(appbuilder)
    connection: MagicMock = MagicMock()
    connection.dialect.name = dialect_name
    connection.get_isolation_level.return_value = "REPEATABLE READ"
    target: MagicMock = MagicMock()
    target.perm = "[shared](id:42)"
    delete_pvm: MagicMock = mocker.patch.object(sm, "_delete_pvm_on_sqla_event")

    sm.dataset_after_delete(MagicMock(), connection, target)

    connection.execute.assert_not_called()
    delete_pvm.assert_not_called()


@pytest.mark.parametrize("dialect_name", ["mysql", "mariadb"])
def test_shared_permission_cleanup_proceeds_on_mysql_read_committed(
    dialect_name: str,
    app_context: None,
) -> None:
    """The configured safe isolation still permits final-owner cleanup."""
    sm: SupersetSecurityManager = SupersetSecurityManager(appbuilder)
    connection: MagicMock = MagicMock()
    connection.dialect.name = dialect_name
    connection.get_isolation_level.return_value = "READ COMMITTED"
    connection.execute.return_value.first.return_value = None

    assert (
        sm._datasource_perm_owned_elsewhere(  # pylint: disable=protected-access
            connection, "[shared](id:42)", None
        )
        is False
    )
    connection.get_isolation_level.assert_called_once_with()
    assert connection.execute.call_count == 3


@pytest.mark.parametrize("dialect_name", ["mysql", "mariadb"])
def test_semantic_layer_delete_retains_child_grant_on_mysql_repeatable_read(
    dialect_name: str, mocker: MockerFixture, app_context: None
) -> None:
    """The unloaded-child cascade uses the same fail-safe isolation gate."""
    sm: SupersetSecurityManager = SupersetSecurityManager(appbuilder)
    connection: MagicMock = MagicMock()
    connection.dialect.name = dialect_name
    connection.get_isolation_level.return_value = "REPEATABLE READ"
    connection.execute.return_value.scalars.return_value = ["[shared](id:42)"]
    target: MagicMock = MagicMock()
    target.uuid = "layer-uuid"
    delete_pvm: MagicMock = mocker.patch.object(sm, "_delete_pvm_on_sqla_event")

    sm.semantic_layer_before_delete(MagicMock(), connection, target)

    connection.execute.assert_called_once()
    delete_pvm.assert_not_called()


def _create_fab_security_tables(session: Session) -> None:
    """
    The shared in-memory SQLite ``session`` fixture only creates Superset's own
    metadata; FAB's security tables live on a separate declarative base, so
    they have to be created explicitly before they can be populated.
    """
    Permission.metadata.create_all(
        session.get_bind(),
        tables=[
            Permission.__table__,
            ViewMenu.__table__,
            PermissionView.__table__,
            Role.__table__,
            User.__table__,
            Group.__table__,
            assoc_permissionview_role,
            assoc_user_role,
            assoc_user_group,
            assoc_group_role,
        ],
        checkfirst=True,
    )


def _build_rbac_graph(session: Session) -> dict[str, int]:
    """
    Build a small RBAC graph exercising both ways a user can hold a role:
    granted directly, and granted via a group.

        direct_user  --role--> role_direct --pvm--> [db].[direct_schema]
        group_user   --group--> grp --role--> role_group --pvm--> [db].[group_schema]
        no_access_user holds neither.

    An extra ``schema_access`` pvm attached to no role at all guards against
    the query returning permissions nobody was granted.
    """
    perm = Permission(name="schema_access")
    session.add(perm)

    vm_direct = ViewMenu(name="[db].[direct_schema]")
    vm_group = ViewMenu(name="[db].[group_schema]")
    vm_orphan = ViewMenu(name="[db].[ungranted_schema]")
    session.add_all([vm_direct, vm_group, vm_orphan])
    session.flush()

    pvm_direct = PermissionView(permission=perm, view_menu=vm_direct)
    pvm_group = PermissionView(permission=perm, view_menu=vm_group)
    pvm_orphan = PermissionView(permission=perm, view_menu=vm_orphan)
    session.add_all([pvm_direct, pvm_group, pvm_orphan])
    session.flush()

    role_direct = Role(name="role_direct", permissions=[pvm_direct])
    role_group = Role(name="role_group", permissions=[pvm_group])
    session.add_all([role_direct, role_group])
    session.flush()

    grp = Group(name="grp", roles=[role_group])
    session.add(grp)
    session.flush()

    users = {}
    for name, roles, groups in (
        ("direct_user", [role_direct], []),
        ("group_user", [], [grp]),
        ("both_user", [role_direct], [grp]),
        ("no_access_user", [], []),
    ):
        user = User(
            first_name=name,
            last_name="t",
            username=name,
            email=f"{name}@example.invalid",
            roles=roles,
            groups=groups,
        )
        session.add(user)
        session.flush()
        users[name] = user.id
    session.commit()
    return users


@pytest.mark.parametrize(
    "username,expected",
    [
        ("direct_user", {"[db].[direct_schema]"}),
        ("group_user", {"[db].[group_schema]"}),
        ("both_user", {"[db].[direct_schema]", "[db].[group_schema]"}),
        ("no_access_user", set()),
    ],
)
def test_user_view_menu_names_resolves_direct_and_group_roles(
    mocker: MockerFixture,
    app_context: None,
    session: Session,
    username: str,
    expected: set[str],
) -> None:
    """
    ``user_view_menu_names`` must resolve permissions from roles held directly
    *and* from roles inherited through a group, and must never return a
    permission that no role was granted.
    """
    _create_fab_security_tables(session)
    users = _build_rbac_graph(session)

    sm = SupersetSecurityManager(appbuilder)
    mocker.patch.object(
        type(sm), "session", new_callable=mocker.PropertyMock, return_value=session
    )
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    mocker.patch(
        "superset.security.manager.g",
        new=SimpleNamespace(user=SimpleNamespace(is_anonymous=False)),
    )
    mocker.patch("superset.security.manager.get_user_id", return_value=users[username])

    assert sm.user_view_menu_names("schema_access") == expected


_GRANTED_PERM = "[PostgreSQL].[public].[granted](id:1)"
_DENIED_PERM = "[PostgreSQL].[public].[denied](id:2)"
_STAGING_PERM = "[PostgreSQL].[staging].[registered_t](id:3)"
_STAGING_SCHEMA_PERM = "[PostgreSQL].[staging]"
_ROLLUP_PERM = "[PostgreSQL].[scratch].[my_rollup](id:4)"
_ORDERS_PERM = "[PostgreSQL].[public].[orders](id:5)"
_CTE_NAME_PERM = "[PostgreSQL].[public].[d](id:6)"
_MIXED_CASE_SCHEMA_PERM = "[PostgreSQL].[MySchema].[t](id:7)"
_TOP_PERM = "[PostgreSQL].[public].[top](id:8)"
_PERCENT_PERM = "[PostgreSQL].[public].[percent](id:9)"


def _write_target_scoping_sm_and_query(
    mocker: MockerFixture,
    sql: str,
    staging_schema_access: bool = False,
    default_schema: str | None = "public",
    engine: str | None = None,
    orders_virtual: bool = False,
    default_catalog: str | None = None,
    sm_class: type[SupersetSecurityManager] = SupersetSecurityManager,
) -> tuple[SupersetSecurityManager, Any]:
    """
    Build a SupersetSecurityManager (or ``sm_class``) and query for write/DDL
    target scoping tests.

    Registered physical datasets: ``public.granted`` (the user holds
    ``datasource_access``), ``public.denied`` (no grant),
    ``staging.registered_t`` (no ``datasource_access``),
    ``scratch.my_rollup`` (no grant, but the user is its owner/editor),
    ``public.orders`` (no grant; virtual instead with ``orders_virtual``),
    ``public.d`` (the user holds ``datasource_access``) and ``MySchema.t`` (no
    grant), ``public.top`` and ``public.percent`` (no grant). All are
    registered without a catalog, with the schema permission ``[PostgreSQL].[<schema>]``
    stored on the dataset. ``public.unregistered`` has no
    dataset. The user has no database or catalog grant; with
    ``staging_schema_access`` the user also holds ``schema_access`` on
    ``staging``. ``engine`` selects the SQL dialect used for parsing. The
    database models catalogs only when ``default_catalog`` is set (an engine
    that models catalogs and has no default one leaves a catalog-less target
    unchecked).
    """
    sm = sm_class(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    mocker.patch.object(
        sm,
        "is_editor",
        side_effect=lambda resource: resource.perm == _ROLLUP_PERM,
    )

    def fake_can_access(permission: str, view_menu: str) -> bool:
        if permission == "datasource_access":
            return view_menu in {_GRANTED_PERM, _CTE_NAME_PERM}
        if permission == "schema_access":
            return staging_schema_access and view_menu == _STAGING_SCHEMA_PERM
        return False

    mocker.patch.object(sm, "can_access", side_effect=fake_can_access)

    SqlaTable = mocker.patch(  # noqa: N806
        "superset.connectors.sqla.models.SqlaTable"
    )
    datasets = {
        ("public", "granted"): (_GRANTED_PERM, False),
        ("public", "denied"): (_DENIED_PERM, False),
        ("staging", "registered_t"): (_STAGING_PERM, False),
        ("scratch", "my_rollup"): (_ROLLUP_PERM, False),
        ("public", "orders"): (_ORDERS_PERM, orders_virtual),
        ("public", "d"): (_CTE_NAME_PERM, False),
        ("MySchema", "t"): (_MIXED_CASE_SCHEMA_PERM, False),
        ("public", "top"): (_TOP_PERM, False),
        ("public", "percent"): (_PERCENT_PERM, False),
    }

    def fake_query_datasources_by_name(
        database: Any, table_name: str, schema: Any = None, catalog: Any = None
    ) -> list[Any]:
        # Mirrors ``SqlaTable.query_datasources_by_name``: a falsy catalog
        # applies no catalog filter, and every dataset here has no catalog.
        if catalog:
            return []
        if dataset := datasets.get((schema, table_name)):
            perm, virtual = dataset
            return [
                mocker.MagicMock(
                    perm=perm,
                    schema_perm=f"[PostgreSQL].[{schema}]",
                    catalog_perm=None,
                    is_virtual=virtual,
                    catalog=None,
                )
            ]
        return []

    SqlaTable.query_datasources_by_name.side_effect = fake_query_datasources_by_name

    database = mocker.MagicMock()
    database.database_name = "PostgreSQL"
    database.get_default_catalog.return_value = default_catalog
    database.get_default_schema_for_query.return_value = default_schema
    database.db_engine_spec.supports_catalog = default_catalog is not None
    database.db_engine_spec.get_catalog_from_engine_params.return_value = None
    if engine is not None:
        database.db_engine_spec.engine = engine
    query = mocker.MagicMock(
        database=database,
        schema=default_schema,
        catalog=None,
        sql=sql,
        executed_sql=None,
    )
    return sm, query


def _authorize_execution(sm: SupersetSecurityManager, query: Any) -> None:
    """
    Authorize ``query`` the way the query execution paths do: the strict
    per-table check, then the write or DDL target check.
    """
    sm.raise_for_access(query=query, force_dataset_match=True)
    sm.raise_for_write_target_access(query=query)


_WRITE_STATEMENT_TEMPLATES = [
    "DROP TABLE <target>",
    "DELETE FROM <target> WHERE 1 = 1",
    "UPDATE <target> SET value = 1",
    "TRUNCATE TABLE <target>",
    "INSERT INTO <target> SELECT * FROM public.granted",
    (
        "MERGE INTO <target> USING public.granted "
        "ON <target>.id = public.granted.id "
        "WHEN MATCHED THEN UPDATE SET value = 1"
    ),
    "ALTER TABLE <target> ADD COLUMN c INT",
    "ALTER TABLE <target> RENAME TO public.whatever",
    "CREATE INDEX idx ON <target>(a)",
    "CREATE OR REPLACE TABLE <target> AS SELECT * FROM public.granted",
]


def _write_statements(target: str) -> list[str]:
    """
    Return the write/DDL statements exercised against ``target``.
    """
    return [
        template.replace("<target>", target) for template in _WRITE_STATEMENT_TEMPLATES
    ]


@pytest.mark.parametrize("sql", _write_statements("public.denied"))
def test_write_target_access_scopes_write_and_ddl_targets(
    mocker: MockerFixture,
    app_context: None,
    sql: str,
) -> None:
    """
    A write/DDL target that is a registered dataset outside all of the user's
    grants (no ``datasource_access``, no schema or catalog access) is refused.
    """
    sm, query = _write_target_scoping_sm_and_query(mocker, sql)

    with pytest.raises(SupersetSecurityException):
        _authorize_execution(sm, query)


@pytest.mark.parametrize(
    "sql",
    [
        # Unregistered tables (scratch / staging) are unchanged.
        *_write_statements("public.unregistered"),
        # Writes on a dataset the user holds ``datasource_access`` on.
        *_write_statements("public.granted"),
        # Unqualified unregistered target resolved in the default schema.
        "DROP TABLE unregistered",
        # New-object creation.
        "CREATE TABLE public.newt (id INT)",
        "CREATE TABLE public.newt AS SELECT * FROM public.granted",
        "CREATE OR REPLACE TABLE public.newt AS SELECT * FROM public.granted",
        "ALTER TABLE public.granted RENAME TO public.newname",
        # Copying the structure of a table does not write to it.
        "CREATE TABLE mine LIKE public.denied",
        "CREATE TABLE mine (LIKE public.denied)",
        # Non-base-table DDL.
        "CREATE SCHEMA s",
        "CREATE DATABASE d",
        "CREATE VIEW v AS SELECT * FROM public.granted",
        # Plain read of a granted dataset.
        "SELECT * FROM public.granted",
    ],
)
def test_write_target_access_allows_write_targets_within_grants(
    mocker: MockerFixture,
    app_context: None,
    sql: str,
) -> None:
    """
    Write/DDL targets that are unregistered, granted, or new objects, and
    non-base-table DDL, keep working exactly as before.
    """
    sm, query = _write_target_scoping_sm_and_query(mocker, sql)

    _authorize_execution(sm, query)


@pytest.mark.parametrize(
    "sql",
    [
        "INSERT INTO staging.registered_t SELECT * FROM public.granted",
        "DROP TABLE staging.registered_t",
    ],
)
def test_write_target_access_covered_by_schema_access(
    mocker: MockerFixture,
    app_context: None,
    sql: str,
) -> None:
    """
    ``schema_access`` on the target's schema covers a registered write target
    even without ``datasource_access`` on its dataset.
    """
    sm, query = _write_target_scoping_sm_and_query(
        mocker, sql, staging_schema_access=True
    )

    _authorize_execution(sm, query)


def test_write_target_access_outside_schema_access(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Without ``schema_access`` on ``staging``, the registered ungranted target
    ``staging.registered_t`` is refused.
    """
    sm, query = _write_target_scoping_sm_and_query(
        mocker, "DROP TABLE staging.registered_t"
    )

    with pytest.raises(SupersetSecurityException):
        _authorize_execution(sm, query)


@pytest.mark.parametrize("sql", ["DROP TABLE denied", "DELETE FROM denied"])
def test_write_target_access_without_schema_left_alone(
    mocker: MockerFixture,
    app_context: None,
    sql: str,
) -> None:
    """
    A write target whose schema cannot be resolved is not matched against
    datasets, so the statement is handled as before.
    """
    sm, query = _write_target_scoping_sm_and_query(mocker, sql, default_schema=None)

    _authorize_execution(sm, query)


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT * FROM public.denied",
        "SELECT * FROM public.unregistered",
        "CREATE TABLE public.newt AS SELECT * FROM public.denied",
    ],
)
def test_write_target_access_read_sources_unchanged(
    mocker: MockerFixture,
    app_context: None,
    sql: str,
) -> None:
    """
    Read sources keep their strict per-table semantics: an ungranted or
    unregistered read source is refused.
    """
    sm, query = _write_target_scoping_sm_and_query(mocker, sql)

    with pytest.raises(SupersetSecurityException):
        _authorize_execution(sm, query)


@pytest.mark.parametrize(
    "sql",
    [
        "TRUNCATE scratch.my_rollup",
        "INSERT INTO scratch.my_rollup SELECT * FROM public.granted",
        "DROP TABLE scratch.my_rollup",
        "UPDATE scratch.my_rollup SET value = 1",
        "DELETE FROM scratch.my_rollup WHERE 1 = 1",
    ],
)
def test_write_target_access_owned_dataset(
    mocker: MockerFixture,
    app_context: None,
    sql: str,
) -> None:
    """
    The owner/editor of a registered physical dataset keeps writing to the
    table behind it under strict scoping, without ``datasource_access`` or
    ``schema_access``.
    """
    sm, query = _write_target_scoping_sm_and_query(mocker, sql)

    _authorize_execution(sm, query)


@pytest.mark.parametrize(
    "sql",
    ["INSERT INTO public.orders VALUES (1)", "DROP TABLE public.orders"],
)
def test_write_target_access_matching_only_virtual_dataset(
    mocker: MockerFixture,
    app_context: None,
    sql: str,
) -> None:
    """
    A table that only shares its name and schema with a virtual dataset is
    not a registered physical dataset, so writes to it are unchanged.
    """
    sm, query = _write_target_scoping_sm_and_query(mocker, sql, orders_virtual=True)

    _authorize_execution(sm, query)


@pytest.mark.parametrize(
    "sql, engine",
    [
        (
            "CREATE TEMP TABLE orders AS SELECT * FROM public.granted; "
            "INSERT INTO orders SELECT * FROM public.granted; "
            "DROP TABLE orders",
            None,
        ),
        ("CREATE VIEW newv AS SELECT * FROM public.granted", None),
        ("CREATE OR REPLACE VIEW newv AS SELECT * FROM public.granted", None),
        ("COPY INTO public.unregistered FROM @stage", "snowflake"),
        (
            "INSERT ALL INTO public.unregistered SELECT * FROM public.granted",
            "snowflake",
        ),
        ("COPY INTO @stage FROM public.granted", "snowflake"),
        (
            "DELETE t1 FROM public.t1 AS t1 JOIN public.denied AS d ON t1.id = d.id",
            "mysql",
        ),
        (
            "UPDATE public.t1 AS t1 JOIN public.denied AS d ON t1.id = d.id "
            "SET t1.value = 1",
            "mysql",
        ),
    ],
)
def test_write_target_access_new_or_script_local_objects(
    mocker: MockerFixture,
    app_context: None,
    sql: str,
    engine: str | None,
) -> None:
    """
    Tables created earlier in the same script, new views, loads into an
    unregistered table, unloads to a stage, and tables that a multi-table
    statement only joins to are unchanged.
    """
    sm, query = _write_target_scoping_sm_and_query(mocker, sql, engine=engine)

    _authorize_execution(sm, query)


@pytest.mark.parametrize(
    "sql, engine",
    [
        ("DELETE t1, denied FROM t1 JOIN denied ON t1.id = denied.id", "mysql"),
        (
            "UPDATE t1 JOIN denied ON t1.id = denied.id SET denied.value = 1",
            "mysql",
        ),
        ("DROP VIEW public.denied", None),
        ("DROP MATERIALIZED VIEW public.denied", None),
        ("CREATE OR REPLACE VIEW public.denied AS SELECT 1", None),
        ("ALTER VIEW public.denied RENAME TO public.x", None),
        (
            "INSERT ALL INTO public.denied SELECT * FROM public.granted",
            "snowflake",
        ),
        ("COPY INTO public.denied FROM @stage", "snowflake"),
        ("ALTER TABLE public.granted SWAP WITH public.denied", "snowflake"),
        (
            "CREATE TEMP TABLE orders AS SELECT * FROM public.granted; "
            "DELETE FROM public.orders",
            None,
        ),
        (
            "CREATE TEMP TABLE orders AS SELECT * FROM public.granted; "
            "DROP TABLE orders; DELETE FROM orders",
            None,
        ),
        # A CTE defined in a subquery, or in another dialect than T-SQL, does
        # not stand for the target.
        (
            "DELETE FROM denied WHERE id IN "
            "(WITH denied AS (SELECT 1 AS id) SELECT id FROM denied)",
            "snowflake",
        ),
        (
            "INSERT INTO denied SELECT * FROM "
            "(WITH denied AS (SELECT 1 AS id) SELECT * FROM denied) AS z",
            "mysql",
        ),
        (
            "INSERT INTO denied WITH denied AS (SELECT 1 AS id) SELECT * FROM denied",
            "trino",
        ),
        # A T-SQL ``TOP (n)`` modifier is not the target.
        ("DELETE TOP (10) FROM public.denied", "mssql"),
        # A FROM alias that differs from the target once quoting is taken
        # into account does not stand for it.
        ('UPDATE denied SET value = 1 FROM (SELECT 1 AS x) AS "DENIED"', "postgresql"),
        (
            'UPDATE denied SET value = 1 FROM public.granted AS "Denied" WHERE TRUE',
            "postgresql",
        ),
        # The only table of a MySQL multi-table UPDATE (the other sources being
        # derived tables) is the target of its unqualified SET columns.
        (
            "UPDATE public.denied JOIN (SELECT 1 AS x) AS d ON 1 = 1 SET value = 0",
            "mysql",
        ),
        ("UPDATE public.denied, (SELECT 1 AS x) AS d SET value = 0", "mysql"),
        # A MySQL ``LOW_PRIORITY`` modifier is not the target.
        ("UPDATE LOW_PRIORITY denied SET value = 0", "mysql"),
    ],
)
def test_write_target_access_scopes_additional_write_targets(
    mocker: MockerFixture,
    app_context: None,
    sql: str,
    engine: str | None,
) -> None:
    """
    Every table a statement modifies (each target of a multi-table DELETE or
    UPDATE, each INSERT ALL target, a COPY INTO table, both sides of a SWAP),
    and a view being dropped, replaced or altered, is refused when it is a
    registered physical dataset outside all of the user's grants. A
    differently qualified name, or one used after the script's own table of
    that name was dropped, still refers to the registered table.
    """
    sm, query = _write_target_scoping_sm_and_query(mocker, sql, engine=engine)

    with pytest.raises(SupersetSecurityException):
        _authorize_execution(sm, query)


def test_write_target_access_dataset_without_catalog(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    On a catalog-aware database, a target qualified with the default catalog
    matches a dataset registered without a catalog.
    """
    sm, query = _write_target_scoping_sm_and_query(
        mocker,
        "DROP TABLE main.public.denied",
        default_catalog="main",
    )

    with pytest.raises(SupersetSecurityException):
        _authorize_execution(sm, query)


def test_write_target_access_other_catalog_not_matched(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    A target in a catalog other than the default one does not match a dataset
    registered without a catalog.
    """
    sm, query = _write_target_scoping_sm_and_query(
        mocker,
        "DROP TABLE other.public.denied",
        default_catalog="main",
    )

    _authorize_execution(sm, query)


@pytest.mark.parametrize(
    "sql, engine",
    [
        # T-SQL ``UPDATE <alias> ... FROM <table> <alias>`` writes to the table.
        ("UPDATE a SET value = 1 FROM public.denied a", "mssql"),
        # Data-modifying statements nested in a CTE.
        ("WITH d AS (DELETE FROM public.denied RETURNING *) SELECT * FROM d", None),
        (
            "WITH d AS (DELETE FROM public.denied RETURNING *) SELECT * FROM d",
            "postgresql",
        ),
        (
            "WITH d AS (UPDATE public.denied SET value = 1 RETURNING *) "
            "SELECT * FROM d",
            "postgresql",
        ),
        (
            "WITH d AS (INSERT INTO public.denied VALUES (1) RETURNING *) "
            "SELECT * FROM d",
            "postgresql",
        ),
    ],
)
def test_write_target_access_scopes_aliased_and_nested_write_targets(
    mocker: MockerFixture,
    app_context: None,
    sql: str,
    engine: str | None,
) -> None:
    """
    The table behind a T-SQL target alias, and the target of a data-modifying
    statement nested in a CTE, are refused when they are registered physical
    datasets outside all of the user's grants. (The CTE name ``d`` is itself
    a granted dataset here, so only the nested target is refused.)
    """
    sm, query = _write_target_scoping_sm_and_query(mocker, sql, engine=engine)

    with pytest.raises(SupersetSecurityException):
        _authorize_execution(sm, query)


@pytest.mark.parametrize(
    "sql",
    [
        "INSERT INTO public.denied VALUES (1)",
        "DROP TABLE public.denied",
        "DELETE FROM public.denied",
    ],
)
@pytest.mark.parametrize("force_dataset_match", [False, True])
def test_raise_for_access_alone_does_not_check_write_targets(
    mocker: MockerFixture,
    app_context: None,
    sql: str,
    force_dataset_match: bool,
) -> None:
    """
    Callers that do not execute the statement (e.g. tagging a saved query, or
    re-validating a query that already ran when fetching or exporting its
    results, which calls ``raise_for_access(query=..., force_dataset_match=True)``)
    keep their behavior: ``raise_for_access`` does not check write or DDL
    targets, which only the execution paths check, through
    ``raise_for_write_target_access``.
    """
    sm, query = _write_target_scoping_sm_and_query(mocker, sql)

    sm.raise_for_access(query=query, force_dataset_match=force_dataset_match)


def test_tag_saved_query_with_write_statement_not_refused(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Tagging a saved query whose SQL writes to a registered dataset outside the
    user's grants authorizes through ``raise_for_access(query=saved_query)``,
    which is not a query-execution path, so the tag command is not refused.
    """
    from superset.commands.tag.create import CreateCustomTagCommand
    from superset.tags.models import ObjectType

    sm, query = _write_target_scoping_sm_and_query(
        mocker, "INSERT INTO public.denied VALUES (1)"
    )
    mocker.patch("superset.commands.tag.create.to_object_model", return_value=query)
    mocker.patch("superset.commands.tag.create.security_manager", sm)
    raise_for_access = mocker.spy(sm, "raise_for_access")

    CreateCustomTagCommand(ObjectType.query, 1, ["tag"]).validate()

    raise_for_access.assert_called_once_with(query=query)


# Registered datasets of the no-regression corpus below, as
# (catalog, schema, table, virtual, owned). Stored permissions follow
# Superset's format for database ``db``.
_CORPUS_DATASETS = [
    # The no-grant physical dataset every corpus statement shares a name with.
    (None, "public", "denied", False, False),
    (None, "public", "granted", False, False),
    (None, "public", "owned", False, True),
    (None, "public", "vorders", True, False),
    (None, "schema_ok", "events", False, False),
    (None, "schema_ok", "legacy", False, False),
    ("cat2", "public", "metrics", False, False),
    ("main", "public", "facts", False, False),
    ("cat3", "s", "t", False, False),
]
_CORPUS_GRANTS = {
    ("datasource_access", "[db].[public].[granted](id:2)"),
    ("schema_access", "[db].[schema_ok]"),
    ("catalog_access", "[db].[cat2]"),
    ("schema_access", "[db].[main].[public]"),
}


def _corpus_sm_and_query(
    mocker: MockerFixture,
    sql: str,
    engine: str,
    default_catalog: str | None,
    supports_catalog: bool | None = None,
    stored_schema_perms: dict[tuple[str, str], str | None] | None = None,
    sm_class: type[SupersetSecurityManager] = SupersetSecurityManager,
) -> tuple[SupersetSecurityManager, Any]:
    """
    Build a SupersetSecurityManager (or ``sm_class``) and query over
    ``_CORPUS_DATASETS``.

    The user holds ``datasource_access`` on ``public.granted``,
    ``schema_access`` on ``schema_ok`` and on ``main.public``,
    ``catalog_access`` on ``cat2``, and owns ``public.owned``; nothing on
    ``public.denied``, ``public.vorders`` (virtual) or ``cat3.s.t``. The
    database models catalogs when ``supports_catalog`` is set, by default only
    when ``default_catalog`` is set. ``stored_schema_perms`` overrides the
    schema permission stored on the dataset ``(schema, table)``.
    """
    sm = sm_class(appbuilder)
    mocker.patch.object(sm, "can_access_database", return_value=False)
    mocker.patch.object(sm, "is_guest_user", return_value=False)
    mocker.patch.object(
        sm,
        "can_access",
        side_effect=lambda permission, view_menu: (
            (permission, view_menu) in _CORPUS_GRANTS
        ),
    )
    mocker.patch.object(sm, "is_editor", side_effect=lambda resource: resource.owned)

    datasets = []
    for id_, (catalog, schema, name, virtual, owned) in enumerate(
        _CORPUS_DATASETS, start=1
    ):
        prefix = f"[db].[{catalog}]" if catalog else "[db]"
        schema_perm: str | None = f"{prefix}.[{schema}]"
        if stored_schema_perms and (schema, name) in stored_schema_perms:
            schema_perm = stored_schema_perms[(schema, name)]
        datasets.append(
            mocker.MagicMock(
                table_name=name,
                schema=schema,
                catalog=catalog,
                is_virtual=virtual,
                owned=owned,
                perm=f"{prefix}.[{schema}].[{name}](id:{id_})",
                schema_perm=schema_perm,
                catalog_perm=f"[db].[{catalog}]" if catalog else None,
            )
        )

    def fake_query_datasources_by_name(
        database: Any, table_name: str, schema: Any = None, catalog: Any = None
    ) -> list[Any]:
        # Mirrors ``SqlaTable.query_datasources_by_name``: a falsy catalog or
        # schema applies no filter on it.
        return [
            dataset
            for dataset in datasets
            if dataset.table_name == table_name
            and (not schema or dataset.schema == schema)
            and (not catalog or dataset.catalog == catalog)
        ]

    SqlaTable = mocker.patch(  # noqa: N806
        "superset.connectors.sqla.models.SqlaTable"
    )
    SqlaTable.query_datasources_by_name.side_effect = fake_query_datasources_by_name

    database = mocker.MagicMock()
    database.database_name = "db"
    database.get_default_catalog.return_value = default_catalog
    database.get_default_schema_for_query.return_value = "public"
    database.db_engine_spec.supports_catalog = (
        default_catalog is not None if supports_catalog is None else supports_catalog
    )
    database.db_engine_spec.get_catalog_from_engine_params.return_value = None
    database.db_engine_spec.engine = engine
    query = mocker.MagicMock(
        database=database,
        schema="public",
        catalog=None,
        sql=sql,
        executed_sql=None,
    )
    return sm, query


# Legitimate statements and scripts whose modified object is NOT a registered
# physical dataset outside the user's grants, although ``public.denied`` (a
# no-grant physical dataset) exists in the default schema. Each one must keep
# working on query-execution paths, as it did before write targets were
# checked.
_NO_REGRESSION_CORPUS = [
    # PostgreSQL
    (
        "postgresql",
        "CREATE TEMP TABLE denied AS SELECT * FROM public.granted; "
        "INSERT INTO denied SELECT * FROM public.granted; "
        "UPDATE denied SET value = 1; DELETE FROM denied; DROP TABLE denied",
        None,
    ),
    (
        "postgresql",
        "CREATE TEMPORARY TABLE denied (id INT); INSERT INTO denied VALUES (1)",
        None,
    ),
    (
        "postgresql",
        "CREATE TEMP TABLE IF NOT EXISTS denied (id INT); TRUNCATE denied",
        None,
    ),
    (
        "postgresql",
        "CREATE TEMP TABLE IF NOT EXISTS denied (id INT); "
        "INSERT INTO denied VALUES (1); DROP TABLE denied",
        None,
    ),
    (
        "postgresql",
        "CREATE TEMP VIEW denied AS SELECT * FROM public.granted; DROP VIEW denied",
        None,
    ),
    (
        "postgresql",
        "CREATE OR REPLACE TEMP VIEW denied AS SELECT * FROM public.granted",
        None,
    ),
    (
        "postgresql",
        "CREATE OR REPLACE TEMP VIEW denied AS SELECT 1; "
        "CREATE OR REPLACE TEMP VIEW denied AS SELECT 2; DROP VIEW denied",
        None,
    ),
    (
        "postgresql",
        "SELECT * INTO TEMP denied FROM public.granted; UPDATE denied SET value = 1",
        None,
    ),
    (
        "postgresql",
        "SELECT * INTO denied FROM public.granted; DELETE FROM denied WHERE id = 1",
        None,
    ),
    (
        "postgresql",
        "CREATE TEMP TABLE scratch_t AS SELECT * FROM public.granted; "
        "ALTER TABLE scratch_t RENAME TO denied; DELETE FROM denied",
        None,
    ),
    (
        "postgresql",
        "CREATE VIEW denied AS SELECT * FROM public.granted; DROP VIEW denied",
        None,
    ),
    (
        "postgresql",
        "CREATE VIEW denied AS SELECT * FROM public.granted; "
        "ALTER VIEW denied RENAME TO denied_v; DROP VIEW denied_v",
        None,
    ),
    (
        "postgresql",
        "CREATE VIEW denied AS SELECT 1; "
        "CREATE OR REPLACE VIEW denied AS SELECT * FROM public.granted",
        None,
    ),
    (
        "postgresql",
        "WITH denied AS (SELECT * FROM public.granted) SELECT * FROM denied",
        None,
    ),
    ("postgresql", "INSERT INTO public.granted SELECT * FROM public.granted", None),
    ("postgresql", "INSERT INTO public.unregistered_t VALUES (1)", None),
    ("postgresql", "DROP TABLE IF EXISTS public.unregistered_t", None),
    ("postgresql", "INSERT INTO schema_ok.events VALUES (1)", None),
    ("postgresql", "DELETE FROM public.owned WHERE id = 1", None),
    ("postgresql", "TRUNCATE public.owned", None),
    ("postgresql", "INSERT INTO public.vorders VALUES (1)", None),
    ("postgresql", "CREATE TABLE public.denied_new (LIKE public.granted)", None),
    ("postgresql", "CREATE INDEX idx ON public.granted (id)", None),
    ("postgresql", "INSERT INTO cat2.public.metrics VALUES (1)", None),
    # Catalog-less statement on a catalog engine, covered by ``schema_access``
    # on the dataset's own catalog.
    ("postgresql", "INSERT INTO public.facts VALUES (1)", None),
    ("postgresql", "DELETE FROM main.schema_ok.legacy", "main"),
    ("postgresql", "UPDATE main.public.facts SET value = 1", "main"),
    # MySQL
    (
        "mysql",
        "CREATE TEMPORARY TABLE denied (id INT); INSERT INTO denied VALUES (1); "
        "UPDATE denied SET value = 1; DELETE FROM denied; "
        "DROP TEMPORARY TABLE denied",
        None,
    ),
    (
        "mysql",
        "CREATE TEMPORARY TABLE IF NOT EXISTS denied (id INT); TRUNCATE TABLE denied",
        None,
    ),
    ("mysql", "DROP TEMPORARY TABLE IF EXISTS denied", None),
    (
        "mysql",
        "CREATE TEMPORARY TABLE denied LIKE public.granted; "
        "INSERT INTO denied SELECT * FROM public.granted",
        None,
    ),
    (
        "mysql",
        "UPDATE public.granted AS g JOIN public.granted AS h ON g.id = h.id "
        "SET g.value = 1",
        None,
    ),
    (
        "mysql",
        "DELETE g FROM public.granted AS g JOIN public.granted AS h ON g.id = h.id",
        None,
    ),
    (
        "mysql",
        "INSERT INTO public.unregistered_t VALUES (1) ON DUPLICATE KEY UPDATE id = 1",
        None,
    ),
    # T-SQL
    (
        "mssql",
        "SELECT * INTO #denied FROM public.granted; "
        "UPDATE #denied SET value = 1; DROP TABLE #denied",
        None,
    ),
    (
        "mssql",
        "CREATE TABLE #denied (id INT); INSERT INTO #denied VALUES (1); "
        "DELETE FROM #denied",
        None,
    ),
    (
        "mssql",
        "CREATE TABLE ##denied (id INT); TRUNCATE TABLE ##denied; DROP TABLE ##denied",
        None,
    ),
    ("mssql", "DROP TABLE IF EXISTS #denied", None),
    ("mssql", "INSERT INTO @denied VALUES (1)", None),
    ("mssql", "UPDATE @denied SET value = 1", None),
    ("mssql", "DELETE FROM @denied", None),
    (
        "mssql",
        "SELECT * INTO denied FROM public.granted; UPDATE denied SET value = 1",
        None,
    ),
    ("mssql", "UPDATE denied SET value = 1 FROM public.granted denied", None),
    (
        "mssql",
        "UPDATE denied SET value = 1 FROM public.granted AS denied "
        "JOIN public.granted AS g ON denied.id = g.id",
        None,
    ),
    ("mssql", "DELETE denied FROM public.granted denied WHERE denied.id = 1", None),
    (
        "mssql",
        "DELETE d FROM public.granted d JOIN public.granted g ON d.id = g.id",
        None,
    ),
    (
        "mssql",
        "WITH denied AS (SELECT * FROM public.granted) UPDATE denied SET value = 1",
        None,
    ),
    (
        "mssql",
        "WITH denied AS (SELECT * FROM public.granted) DELETE FROM denied",
        None,
    ),
    # Snowflake
    (
        "snowflake",
        "CREATE TEMPORARY TABLE denied (id INT); INSERT INTO denied VALUES (1); "
        "DELETE FROM denied",
        None,
    ),
    (
        "snowflake",
        "CREATE OR REPLACE TEMPORARY TABLE denied AS SELECT * FROM public.granted; "
        "UPDATE denied SET value = 1",
        None,
    ),
    ("snowflake", "CREATE OR REPLACE TEMP TABLE denied (id INT)", None),
    (
        "snowflake",
        "CREATE TEMP TABLE IF NOT EXISTS denied (id INT); "
        "MERGE INTO denied USING public.granted AS g ON denied.id = g.id "
        "WHEN MATCHED THEN UPDATE SET value = 1",
        None,
    ),
    (
        "snowflake",
        "CREATE OR REPLACE TEMPORARY VIEW denied AS SELECT * FROM public.granted",
        None,
    ),
    (
        "snowflake",
        "CREATE TEMPORARY TABLE scratch_t (id INT); "
        "ALTER TABLE scratch_t RENAME TO denied; TRUNCATE TABLE denied",
        None,
    ),
    ("snowflake", "COPY INTO public.unregistered_t FROM @stage", None),
    # Databricks / Spark
    (
        "databricks",
        "CREATE OR REPLACE TEMP VIEW denied AS SELECT * FROM public.granted",
        None,
    ),
    (
        "databricks",
        "CREATE OR REPLACE TEMPORARY VIEW denied AS SELECT * FROM public.granted; "
        "DROP VIEW denied",
        None,
    ),
    (
        "databricks",
        "CREATE TEMPORARY VIEW denied AS SELECT 1; "
        "CREATE OR REPLACE TEMPORARY VIEW denied AS SELECT 2",
        None,
    ),
    (
        "spark",
        "CREATE TEMPORARY VIEW denied AS SELECT * FROM public.granted; "
        "DROP VIEW IF EXISTS denied",
        None,
    ),
    (
        "spark",
        "CREATE GLOBAL TEMPORARY VIEW denied AS SELECT * FROM public.granted",
        None,
    ),
    (
        "spark",
        "INSERT OVERWRITE TABLE public.granted SELECT * FROM public.granted",
        None,
    ),
    # BigQuery
    (
        "bigquery",
        "CREATE TEMP TABLE denied AS SELECT * FROM public.granted; "
        "INSERT INTO denied SELECT * FROM public.granted; "
        "DELETE FROM denied WHERE TRUE",
        None,
    ),
    (
        "bigquery",
        "CREATE TEMPORARY TABLE denied (id INT64); UPDATE denied SET value = 1 "
        "WHERE TRUE",
        None,
    ),
    ("bigquery", "CREATE OR REPLACE TEMP TABLE denied AS SELECT 1 AS id", None),
    ("bigquery", "INSERT INTO public.unregistered_t (id) VALUES (1)", None),
    # Trino
    (
        "trino",
        "CREATE TABLE scratch_t AS SELECT * FROM public.granted; "
        "ALTER TABLE scratch_t RENAME TO denied; "
        "INSERT INTO denied SELECT * FROM public.granted",
        None,
    ),
    ("trino", "CREATE TABLE denied_new AS SELECT * FROM public.granted", None),
    ("trino", "INSERT INTO public.unregistered_t SELECT * FROM public.granted", None),
    (
        "trino",
        "CREATE VIEW denied AS SELECT * FROM public.granted; DROP VIEW denied",
        None,
    ),
    ("trino", "DELETE FROM public.facts WHERE id = 1", None),
    # SQLite
    (
        "sqlite",
        "CREATE TEMP TABLE denied (id INTEGER); INSERT INTO denied VALUES (1); "
        "DELETE FROM denied; DROP TABLE denied",
        None,
    ),
    (
        "sqlite",
        "CREATE TEMPORARY TABLE IF NOT EXISTS denied (id INTEGER); "
        "UPDATE denied SET value = 1",
        None,
    ),
    (
        "sqlite",
        "CREATE TEMP VIEW denied AS SELECT * FROM public.granted; DROP VIEW denied",
        None,
    ),
    (
        "sqlite",
        "CREATE TEMP TABLE denied AS SELECT * FROM public.granted; "
        "ALTER TABLE denied RENAME TO denied2; DELETE FROM denied2",
        None,
    ),
    # Copying the structure of a table does not write to it.
    ("mysql", "CREATE TEMPORARY TABLE tmp LIKE public.denied", None),
    ("postgresql", "CREATE TEMP TABLE tmp (LIKE public.denied)", None),
    ("mysql", "CREATE TABLE mine LIKE public.denied", None),
    ("postgresql", "CREATE TABLE mine (LIKE public.denied)", None),
    # A table created qualified and written unqualified, and vice versa.
    (
        "postgresql",
        "CREATE TABLE public.denied AS SELECT * FROM public.granted; "
        "INSERT INTO denied SELECT * FROM public.granted",
        None,
    ),
    (
        "postgresql",
        "CREATE TABLE denied AS SELECT * FROM public.granted; "
        "DELETE FROM public.denied WHERE id = 1",
        None,
    ),
    (
        "mysql",
        "CREATE TEMPORARY TABLE denied (id INT); UPDATE public.denied SET value = 1",
        None,
    ),
    # Renames of a table created by the script, to an unqualified and to a
    # qualified new name.
    (
        "postgresql",
        "CREATE TABLE public.scratch_t (id INT); "
        "ALTER TABLE public.scratch_t RENAME TO denied; "
        "INSERT INTO public.denied VALUES (1)",
        None,
    ),
    (
        "snowflake",
        "CREATE TABLE scratch_t (id INT); "
        "ALTER TABLE scratch_t RENAME TO public.denied; DELETE FROM denied",
        None,
    ),
    # A MySQL multi-table UPDATE only writes to the tables its SET columns are
    # qualified with, compared case-insensitively.
    (
        "mysql",
        "UPDATE public.denied AS d JOIN public.granted AS g ON d.id = g.id "
        "SET g.value = d.value",
        None,
    ),
    (
        "mysql",
        "UPDATE public.denied AS d JOIN public.granted AS g ON d.id = g.id "
        "SET G.value = 1",
        None,
    ),
    # An unqualified SET column of a MySQL multi-table UPDATE is attributed to
    # no table.
    (
        "mysql",
        "UPDATE public.denied JOIN public.granted "
        "ON public.denied.id = public.granted.id SET note = 'x'",
        None,
    ),
    # A T-SQL updatable CTE over a granted dataset.
    (
        "mssql",
        "WITH c AS (SELECT * FROM public.granted) UPDATE c SET value = 1",
        None,
    ),
    # An unqualified SET column of a MySQL multi-table UPDATE over two tables
    # is attributed to no table.
    (
        "mysql",
        "UPDATE public.denied AS d, public.granted AS g SET value = 0 "
        "WHERE d.id = g.id",
        None,
    ),
    # The only table of a MySQL multi-table UPDATE, granted.
    (
        "mysql",
        "UPDATE public.granted JOIN (SELECT 1 AS x) AS d ON 1 = 1 SET value = 0",
        None,
    ),
    ("mysql", "UPDATE LOW_PRIORITY granted SET value = 0", None),
    # A quoted FROM alias that differs from a granted target.
    (
        "postgresql",
        'UPDATE granted SET value = 1 FROM (SELECT 1 AS x) AS "GRANTED"',
        None,
    ),
]


@pytest.mark.parametrize("engine, sql, default_catalog", _NO_REGRESSION_CORPUS)
def test_write_target_access_no_regression_corpus(
    mocker: MockerFixture,
    app_context: None,
    engine: str,
    sql: str,
    default_catalog: str | None,
) -> None:
    """
    Temporary and session objects, objects created earlier in the same script,
    T-SQL target aliases and updatable CTEs, unregistered and virtual-only
    names, and targets covered by datasource, schema or catalog access or by
    ownership are not refused under strict scoping, although a same-named
    no-grant physical dataset exists in the default schema.
    """
    sm, query = _corpus_sm_and_query(mocker, sql, engine, default_catalog)

    _authorize_execution(sm, query)


def test_query_revalidation_skips_write_targets_of_executed_script(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    A script authorized at execution keeps being authorized when its results
    are fetched or exported. SQL Lab stores only the last block of a
    multi-statement script in ``executed_sql``, so re-validation
    (``Query.raise_for_access``, used by the results, CSV export and streaming
    export commands) no longer sees the temporary table the script created;
    it does not check write targets, since nothing is written there.
    """
    from superset.models.sql_lab import Query
    from superset.sqllab.validators import CanAccessQueryValidatorImpl

    sm, query = _write_target_scoping_sm_and_query(
        mocker,
        "CREATE TEMP TABLE orders AS SELECT * FROM public.granted; "
        "UPDATE orders SET value = 1",
    )
    mocker.patch("superset.sqllab.validators.security_manager", sm)
    mocker.patch("superset.models.sql_lab.security_manager", sm)

    # Execution: the whole script is authorized; ``orders`` is the script's
    # own temporary table, not the registered ``public.orders``.
    CanAccessQueryValidatorImpl().validate(query)

    # After execution, ``executed_sql`` holds the last block only.
    query.executed_sql = "UPDATE orders SET value = 1"
    Query.raise_for_access(query)

    # The same block executed on its own would write to ``public.orders``.
    with pytest.raises(SupersetSecurityException):
        CanAccessQueryValidatorImpl().validate(query)


def test_write_target_access_exact_mixed_case_default_schema(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    With a quoted, mixed-case default schema (e.g. PostgreSQL ``search_path``
    ``"MySchema"``), a table the script creates unqualified is recognized when
    written qualified with that schema, although ``MySchema.t`` is a registered
    physical dataset outside the user's grants.
    """
    sm, query = _write_target_scoping_sm_and_query(
        mocker,
        'CREATE TABLE t (a INT); INSERT INTO "MySchema".t VALUES (1)',
        default_schema="MySchema",
        engine="postgresql",
    )

    _authorize_execution(sm, query)


def test_write_target_access_exact_mixed_case_default_schema_registered(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Without the script's own table, ``"MySchema".t`` is the registered physical
    dataset outside the user's grants and is refused.
    """
    sm, query = _write_target_scoping_sm_and_query(
        mocker,
        'INSERT INTO "MySchema".t VALUES (1)',
        default_schema="MySchema",
        engine="postgresql",
    )

    with pytest.raises(SupersetSecurityException):
        _authorize_execution(sm, query)


class _CustomSecurityManager(SupersetSecurityManager):
    """
    A custom ``SupersetSecurityManager`` subclass overriding
    ``raise_for_access`` with its historical signature (no ``**kwargs``), as
    deployments setting ``CUSTOM_SECURITY_MANAGER`` may do.
    """

    def raise_for_access(  # noqa: PLR0913
        # pylint: disable=too-many-arguments
        self,
        dashboard: Any = None,
        chart: Any = None,
        database: Any = None,
        datasource: Any = None,
        query: Any = None,
        query_context: Any = None,
        table: Any = None,
        sql: str | None = None,
        catalog: str | None = None,
        schema: str | None = None,
        template_params: dict[str, Any] | None = None,
        force_dataset_match: bool = False,
        allow_query_authorship_bypass: bool = False,
        allow_editorship: bool = True,
    ) -> None:
        super().raise_for_access(
            dashboard=dashboard,
            chart=chart,
            database=database,
            datasource=datasource,
            query=query,
            query_context=query_context,
            table=table,
            sql=sql,
            catalog=catalog,
            schema=schema,
            template_params=template_params,
            force_dataset_match=force_dataset_match,
            allow_query_authorship_bypass=allow_query_authorship_bypass,
            allow_editorship=allow_editorship,
        )


@pytest.mark.parametrize(
    "sql",
    [
        "SELECT * FROM public.granted",
        "INSERT INTO public.granted SELECT * FROM public.granted",
        "INSERT INTO public.unregistered VALUES (1)",
    ],
)
def test_sql_lab_validation_with_custom_security_manager(
    mocker: MockerFixture,
    app_context: None,
    sql: str,
) -> None:
    """
    SQL Lab execution validation keeps working with a custom
    ``SupersetSecurityManager`` subclass whose ``raise_for_access`` override
    has the historical signature: no new argument is passed to it.
    """
    from superset.sqllab.validators import CanAccessQueryValidatorImpl

    sm, query = _write_target_scoping_sm_and_query(
        mocker, sql, sm_class=_CustomSecurityManager
    )
    mocker.patch("superset.sqllab.validators.security_manager", sm)

    CanAccessQueryValidatorImpl().validate(query)


def _alert_validation_sm_and_database(
    mocker: MockerFixture,
) -> tuple[SupersetSecurityManager, Any]:
    """
    Build the write-target scoping ``SupersetSecurityManager`` for alert query
    validation, which authorizes a ``sql`` string through an ephemeral query.
    """
    sm, query = _write_target_scoping_sm_and_query(mocker, "SELECT 1")
    database = query.database
    database.backend = "postgresql"
    database.db_engine_spec.engine = "postgresql"
    database.allow_dml = True
    mocker.patch.object(
        type(sm), "session", new_callable=mocker.PropertyMock, return_value=MagicMock()
    )

    def ephemeral_query(**kwargs: Any) -> Any:
        return MagicMock(executed_sql=None, **kwargs)

    mocker.patch("superset.models.sql_lab.Query", side_effect=ephemeral_query)
    mocker.patch("superset.commands.report.base.security_manager", sm)
    return sm, database


def test_alert_query_validation_refuses_denied_write_target(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Alert create/update validation applies the same write or DDL target check
    as the alert run, so alert SQL writing to a registered physical dataset
    outside the user's grants fails validation.
    """
    from superset.commands.report.base import BaseReportScheduleCommand
    from superset.commands.report.exceptions import (
        AlertQueryDataAccessValidationError,
    )

    _, database = _alert_validation_sm_and_database(mocker)

    exceptions: list[Any] = []
    BaseReportScheduleCommand().validate_alert_query(
        database, "INSERT INTO public.denied VALUES (1)", exceptions
    )

    assert len(exceptions) == 1
    assert isinstance(exceptions[0], AlertQueryDataAccessValidationError)


def test_alert_query_validation_allows_granted_write_target(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Alert SQL writing to a dataset the user is granted keeps passing
    validation.
    """
    from superset.commands.report.base import BaseReportScheduleCommand

    _, database = _alert_validation_sm_and_database(mocker)

    exceptions: list[Any] = []
    BaseReportScheduleCommand().validate_alert_query(
        database, "INSERT INTO public.granted VALUES (1)", exceptions
    )

    assert exceptions == []


class _EarlyReturnManager(SupersetSecurityManager):
    """
    A custom ``SupersetSecurityManager`` whose ``raise_for_access`` grants
    everything (e.g. through an external system).
    """

    def raise_for_access(self, **kwargs: Any) -> None:  # type: ignore[override]
        return None


class _PlainSubclassManager(SupersetSecurityManager):
    """
    A custom ``SupersetSecurityManager`` that does not override
    ``raise_for_access``.
    """


@pytest.mark.parametrize(
    "sm_class",
    [_EarlyReturnManager, _CustomSecurityManager],
)
def test_sql_lab_validation_custom_raise_for_access_keeps_its_semantics(
    mocker: MockerFixture,
    app_context: None,
    sm_class: type[SupersetSecurityManager],
) -> None:
    """
    A ``SupersetSecurityManager`` subclass that overrides ``raise_for_access``
    keeps its own semantics: the write or DDL target check adds no refusal on
    top of it.
    """
    from superset.sqllab.validators import CanAccessQueryValidatorImpl

    sm, query = _write_target_scoping_sm_and_query(
        mocker, "INSERT INTO public.denied VALUES (1)", sm_class=sm_class
    )
    mocker.patch("superset.sqllab.validators.security_manager", sm)

    CanAccessQueryValidatorImpl().validate(query)


def test_sql_lab_validation_subclass_without_override_checks_write_targets(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    A ``SupersetSecurityManager`` subclass that does not override
    ``raise_for_access`` keeps the write or DDL target check.
    """
    from superset.sqllab.validators import CanAccessQueryValidatorImpl

    sm, query = _write_target_scoping_sm_and_query(
        mocker, "INSERT INTO public.denied VALUES (1)", sm_class=_PlainSubclassManager
    )
    mocker.patch("superset.sqllab.validators.security_manager", sm)

    with pytest.raises(SupersetSecurityException):
        CanAccessQueryValidatorImpl().validate(query)


@pytest.mark.parametrize(
    "sql",
    ["DELETE FROM schema_ok.legacy", "INSERT INTO schema_ok.events VALUES (1)"],
)
def test_write_target_access_missing_or_outdated_stored_schema_perm(
    mocker: MockerFixture,
    app_context: None,
    sql: str,
) -> None:
    """
    ``schema_access`` on the schema permission computed for the target covers
    it when the dataset's stored schema permission is missing or outdated.
    """
    sm, query = _corpus_sm_and_query(
        mocker,
        sql,
        "postgresql",
        None,
        stored_schema_perms={
            ("schema_ok", "legacy"): None,
            ("schema_ok", "events"): "[old_name].[schema_ok]",
        },
    )

    _authorize_execution(sm, query)


def test_write_target_access_unknown_catalog_left_alone(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    On an engine that models catalogs, a target without a catalog, when
    neither the query nor the database supplies one, is not matched against
    datasets: the catalog it refers to is not known.
    """
    sm, query = _corpus_sm_and_query(
        mocker, "INSERT INTO s.t VALUES (1)", "trino", None, supports_catalog=True
    )

    _authorize_execution(sm, query)


def test_write_target_access_explicit_catalog_checked(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    The same target qualified with its catalog is checked and refused.
    """
    sm, query = _corpus_sm_and_query(
        mocker, "INSERT INTO cat3.s.t VALUES (1)", "trino", None, supports_catalog=True
    )

    with pytest.raises(SupersetSecurityException):
        _authorize_execution(sm, query)


@pytest.mark.parametrize(
    "sql",
    [
        "UPDATE LOW_PRIORITY public.denied SET value = 0",
        "UPDATE IGNORE public.denied SET value = 0",
    ],
)
def test_write_target_access_unparsed_mysql_update_modifiers_refused(
    mocker: MockerFixture,
    app_context: None,
    sql: str,
) -> None:
    """
    MySQL ``UPDATE`` modifier forms the parser does not support are refused:
    they cannot be parsed, so they are not authorized.
    """
    sm, query = _write_target_scoping_sm_and_query(mocker, sql, engine="mysql")

    with pytest.raises((SupersetSecurityException, SupersetParseError)):
        _authorize_execution(sm, query)


@pytest.mark.parametrize("sql", ["SELECT * FROM public.granted", "SELECT 1"])
def test_write_target_access_without_targets_returns_early(
    mocker: MockerFixture,
    app_context: None,
    sql: str,
) -> None:
    """
    SQL without any write or DDL target candidate returns before the extension
    hook, Jinja rendering and default schema resolution.
    """
    sm, query = _write_target_scoping_sm_and_query(mocker, sql)
    hook = MagicMock(return_value=False)
    mocker.patch.dict(current_app.config, {"EXTRA_RAISE_FOR_ACCESS_BYPASS": hook})
    process_jinja_sql = mocker.patch("superset.security.manager.process_jinja_sql")

    sm.raise_for_write_target_access(query=query)

    hook.assert_not_called()
    process_jinja_sql.assert_not_called()
    query.database.get_default_schema_for_query.assert_not_called()


@pytest.mark.parametrize("hook_result", [True, False])
def test_write_target_access_skipped_with_extension_hook(
    mocker: MockerFixture,
    app_context: None,
    hook_result: bool,
) -> None:
    """
    With the ``EXTRA_RAISE_FOR_ACCESS_BYPASS`` hook configured, the deployment
    keeps its own semantics: the write or DDL target check is skipped, and the
    hook is called once per authorization, by ``raise_for_access`` only.
    """
    sm, query = _write_target_scoping_sm_and_query(
        mocker, "INSERT INTO public.denied VALUES (1)"
    )
    hook = MagicMock(return_value=hook_result)
    mocker.patch.dict(current_app.config, {"EXTRA_RAISE_FOR_ACCESS_BYPASS": hook})

    _authorize_execution(sm, query)

    hook.assert_called_once()


@pytest.mark.parametrize(
    "sql",
    ["INSERT INTO top VALUES (1)", "DROP TABLE percent", "TRUNCATE top"],
)
def test_write_target_access_tables_named_like_modifiers(
    mocker: MockerFixture,
    app_context: None,
    sql: str,
) -> None:
    """
    A registered physical dataset whose name is also a statement modifier
    keyword (``top``, ``percent``) is a write or DDL target outside DELETE /
    UPDATE target lists, and is checked like any other.
    """
    sm, query = _write_target_scoping_sm_and_query(mocker, sql, engine="postgresql")

    with pytest.raises(SupersetSecurityException):
        _authorize_execution(sm, query)


def test_write_target_access_delete_top_modifier_not_a_target(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    The T-SQL ``DELETE TOP (n)`` modifier is not the target, even with a
    registered ``top`` dataset outside the user's grants: only the ``FROM``
    table is checked.
    """
    sm, query = _write_target_scoping_sm_and_query(
        mocker, "DELETE TOP (10) FROM public.granted", engine="mssql"
    )

    _authorize_execution(sm, query)


def test_write_target_access_skipped_with_instance_raise_for_access(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    A ``raise_for_access`` replaced on the instance keeps its own semantics:
    the write or DDL target check is skipped.
    """
    sm, query = _write_target_scoping_sm_and_query(
        mocker, "INSERT INTO public.denied VALUES (1)"
    )
    sm.raise_for_access = lambda **kwargs: None  # type: ignore[method-assign]

    sm.raise_for_write_target_access(query=query)


def test_sql_lab_validation_with_mocked_raise_for_access(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    SQL Lab validation with ``raise_for_access`` patched by a mock does not
    fail in the write or DDL target check.
    """
    from superset.sqllab.validators import CanAccessQueryValidatorImpl

    sm, query = _write_target_scoping_sm_and_query(
        mocker, "INSERT INTO public.denied VALUES (1)"
    )
    raise_for_access = mocker.patch.object(sm, "raise_for_access")
    mocker.patch("superset.sqllab.validators.security_manager", sm)

    CanAccessQueryValidatorImpl().validate(query)

    raise_for_access.assert_called_once()


def test_write_target_access_mocked_query(app_context: None) -> None:
    """
    A mocked query, whose SQL is not a string, is not checked and does not
    fail.
    """
    sm = SupersetSecurityManager(appbuilder)

    sm.raise_for_write_target_access(query=MagicMock())
    sm.raise_for_write_target_access(
        query=MagicMock(sql=None, executed_sql=None, catalog=None)
    )


def test_write_target_access_templated_sql_left_to_rendered_check(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    SQL Lab validates a query before rendering it and again on the rendered
    SQL. With ``rendered_check_follows``, templated SQL is not rendered by the
    first check; the rendered SQL is checked by the second one.
    """
    sm, query = _write_target_scoping_sm_and_query(
        mocker, "INSERT INTO {{ 'public' }}.denied VALUES (1)", engine="postgresql"
    )
    process_jinja_sql = mocker.patch("superset.security.manager.process_jinja_sql")

    sm.raise_for_write_target_access(
        query=query, template_params={}, rendered_check_follows=True
    )
    process_jinja_sql.assert_not_called()

    process_jinja_sql.side_effect = lambda sql, database, template_params: (
        SimpleNamespace(script=SQLScript(sql, "postgresql"))
    )
    query.executed_sql = "INSERT INTO public.denied VALUES (1)"
    with pytest.raises(SupersetSecurityException):
        sm.raise_for_write_target_access(
            query=query, template_params={}, rendered_check_follows=True
        )
    process_jinja_sql.assert_called_once()


def test_write_target_access_templated_sql_rendered_without_follow_up(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    Without a later check of the rendered SQL (MCP ``execute_sql``, alert
    query validation), templated SQL is rendered once and its write targets
    are checked.
    """
    sm, query = _write_target_scoping_sm_and_query(
        mocker, "INSERT INTO {{ 'public' }}.denied VALUES (1)", engine="postgresql"
    )
    process_jinja_sql = mocker.patch(
        "superset.security.manager.process_jinja_sql",
        return_value=SimpleNamespace(
            script=SQLScript("INSERT INTO public.denied VALUES (1)", "postgresql")
        ),
    )

    with pytest.raises(SupersetSecurityException):
        sm.raise_for_write_target_access(query=query, template_params={})
    process_jinja_sql.assert_called_once()


def test_write_target_access_database_access_skips_parsing(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    A user with database-level access is granted before the SQL is parsed.
    """
    sm, query = _write_target_scoping_sm_and_query(
        mocker, "INSERT INTO public.denied VALUES (1)"
    )
    mocker.patch.object(sm, "can_access_database", return_value=True)
    may_have_write_targets = mocker.spy(sm, "_may_have_write_targets")

    sm.raise_for_write_target_access(query=query)

    may_have_write_targets.assert_not_called()
