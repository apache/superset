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

"""Public completeness error and opt-in provider contract controls."""

from typing import Any, cast, Literal

import pytest
from pytest_mock import MockerFixture
from superset_core.semantic_layers.layer import SemanticLayer

from superset import exceptions


def test_result_cache_version_default_is_declared_and_inert() -> None:
    assert hasattr(SemanticLayer, "result_cache_version")
    assert SemanticLayer.result_cache_version is None


@pytest.mark.parametrize("reason", ["incomplete", "unverified"])
def test_completeness_error_has_safe_actionable_client_contract(
    reason: Literal["incomplete", "unverified"],
) -> None:
    error: exceptions.SemanticResultCompletenessError = (
        exceptions.SemanticResultCompletenessError(reason)
    )
    assert isinstance(error, exceptions.QueryObjectValidationError)
    assert error.status == 400
    assert "retry" in str(error).lower()
    assert error.reason == reason


def test_completeness_error_rejects_untrusted_reason_text() -> None:
    invalid_reason: Literal["incomplete", "unverified"] = cast(
        Literal["incomplete", "unverified"], "raw upstream diagnostics"
    )
    with pytest.raises(ValueError, match="Unknown completeness reason"):
        exceptions.SemanticResultCompletenessError(invalid_reason)


@pytest.mark.parametrize("result_format", ["json", "csv", "xlsx"])
def test_chart_data_http_failure_cannot_export_partial_result(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
    result_format: str,
) -> None:
    from unittest.mock import MagicMock

    context: MagicMock = MagicMock()
    context.get_payload_result.side_effect = exceptions.SemanticResultCompletenessError(
        "incomplete"
    )
    mocker.patch(
        "superset.charts.data.api.ChartDataRestApi._create_query_context_from_form",
        return_value=context,
    )
    mocker.patch(
        "superset.charts.data.api.ChartDataRestApi._should_run_async",
        return_value=False,
    )
    mocker.patch(
        "superset.charts.data.api.ChartDataRestApi._should_stream_before_execution",
        return_value=False,
    )
    response: Any = client.post(
        "/api/v1/chart/data", json={"result_format": result_format}
    )
    assert response.status_code == 400
    assert "only part" in str(response.get_json())
    assert "Content-Disposition" not in response.headers
    assert response.get_json().get("result") is None
