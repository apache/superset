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

"""Chart-data responses for the fixed semantic-view guest RLS refusal."""

from __future__ import annotations

from typing import Any, Literal
from unittest.mock import MagicMock, patch

import pytest
from flask import Response
from flask.testing import FlaskClient
from werkzeug.test import TestResponse

from superset import security_manager
from superset.charts.data.api import ChartDataRestApi
from superset.commands.chart.data.get_data_command import ChartDataCommand
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetSecurityException
from superset.models.slice import Slice
from superset.security.guest_token import (
    GuestToken,
    GuestTokenResourceType,
    GuestTokenRlsRule,
    GuestUser,
)
from superset.utils import json
from superset.utils.core import DatasourceType
from tests.integration_tests.test_app import app  # noqa: F401

GUEST_RLS_MESSAGE: str = "Semantic views cannot enforce guest row-level security rules."
CHART_DATA_PAYLOAD: dict[str, Any] = {
    "datasource": {"id": 17, "type": "semantic_view"},
    "queries": [],
}


def _guest(rules: list[GuestTokenRlsRule]) -> GuestUser:
    """Build the guest context consulted by the real RLS guard."""
    token: GuestToken = {
        "user": {},
        "resources": [
            {"type": GuestTokenResourceType.DASHBOARD, "id": "dashboard-uuid"}
        ],
        "rls_rules": rules,
        "iat": 10,
        "exp": 20,
    }
    return GuestUser(token=token, roles=[])


def _request_with_guest_rules(
    test_client: FlaskClient[Any],
    rules: list[GuestTokenRlsRule],
    method: Literal["GET", "POST"],
) -> TestResponse:
    """Run chart-data validation with the real guard and a guest RLS context."""
    view: MagicMock = MagicMock(id=17, type=DatasourceType.SEMANTIC_VIEW)
    chart: Slice = Slice(
        id=17,
        datasource_id=17,
        datasource_type="semantic_view",
        params="{}",
        query_context=json.dumps(CHART_DATA_PAYLOAD),
    )

    def validate(_command: ChartDataCommand) -> None:
        security_manager.raise_for_unsupported_guest_rls(view)

    with (
        patch.object(
            security_manager,
            "get_current_guest_user_if_guest",
            return_value=_guest(rules),
        ),
        patch.object(
            ChartDataRestApi,
            "_create_query_context_from_form",
            return_value=MagicMock(datasource=view),
        ),
        patch.object(ChartDataCommand, "validate", validate),
        patch(
            "flask_appbuilder.models.sqla.interface.SQLAInterface.get",
            return_value=chart,
        ),
        patch.object(
            ChartDataRestApi,
            "_get_data_response",
            return_value=Response('{"result":[]}', mimetype="application/json"),
        ),
    ):
        response: TestResponse = (
            test_client.get("/api/v1/chart/17/data/")
            if method == "GET"
            else test_client.post("/api/v1/chart/data", json=CHART_DATA_PAYLOAD)
        )
    return response


@pytest.mark.parametrize("method", ["GET", "POST"])
def test_restricted_guest_gets_fixed_rls_reason(
    test_client: FlaskClient[Any],
    login_as_admin: None,
    method: Literal["GET", "POST"],
) -> None:
    """A semantic guest RLS denial stays a 403 with its safe explanation."""
    rules: list[GuestTokenRlsRule] = [
        GuestTokenRlsRule(dataset=None, clause="tenant_id = 7")
    ]
    response: TestResponse = _request_with_guest_rules(test_client, rules, method)
    assert response.status_code == 403
    assert response.json["message"] == GUEST_RLS_MESSAGE
    assert "result" not in response.json


@pytest.mark.parametrize("method", ["GET", "POST"])
def test_unrestricted_guest_still_reaches_chart_data(
    test_client: FlaskClient[Any],
    login_as_admin: None,
    method: Literal["GET", "POST"],
) -> None:
    """Without guest RLS the same path keeps its successful response."""
    response: TestResponse = _request_with_guest_rules(test_client, [], method)
    assert response.status_code == 200
    assert response.json == {"result": []}


@pytest.mark.parametrize("method", ["GET", "POST"])
def test_unrelated_security_reason_stays_generic(
    test_client: FlaskClient[Any],
    login_as_admin: None,
    method: Literal["GET", "POST"],
) -> None:
    """Other security exceptions cannot expose their private text."""
    error: SupersetSecurityException = SupersetSecurityException(
        SupersetError(
            error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
            message="private security detail",
            level=ErrorLevel.WARNING,
        )
    )
    chart: Slice = Slice(
        id=17,
        datasource_id=17,
        datasource_type="semantic_view",
        params="{}",
        query_context=json.dumps(CHART_DATA_PAYLOAD),
    )
    with (
        patch.object(
            ChartDataRestApi,
            "_create_query_context_from_form",
            return_value=MagicMock(),
        ),
        patch.object(ChartDataCommand, "validate", side_effect=error),
        patch(
            "flask_appbuilder.models.sqla.interface.SQLAInterface.get",
            return_value=chart,
        ),
    ):
        response: TestResponse = (
            test_client.get("/api/v1/chart/17/data/")
            if method == "GET"
            else test_client.post("/api/v1/chart/data", json=CHART_DATA_PAYLOAD)
        )
    assert response.status_code == 403
    assert "private security detail" not in response.get_data(as_text=True)
    assert GUEST_RLS_MESSAGE not in response.get_data(as_text=True)
