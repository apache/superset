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
from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from superset.utils import json


@pytest.mark.parametrize(
    "params_value",
    [
        pytest.param('"foo"', id="json_string"),
        pytest.param("[1, 2]", id="json_array"),
        pytest.param("42", id="json_integer"),
    ],
)
def test_apply_client_processing_crashes_on_non_dict_form_data(
    params_value: str,
) -> None:
    """Prove that apply_client_processing raises AttributeError on non-dict input.

    This is the downstream crash that the isinstance guard in get_data prevents.
    ``null`` (None) is excluded because it is falsy and caught by the existing
    ``form_data or {}`` fallback.
    """
    from superset.charts.client_processing import apply_client_processing

    parsed = json.loads(params_value)
    result: dict[str, Any] = {"queries": [], "query_context": MagicMock()}
    with pytest.raises(AttributeError):
        apply_client_processing(result, parsed, None)


@pytest.mark.parametrize(
    "params_value",
    [
        pytest.param('"foo"', id="json_string"),
        pytest.param("[1, 2]", id="json_array"),
        pytest.param("42", id="json_integer"),
        pytest.param("null", id="json_null"),
    ],
)
def test_get_data_falls_back_for_non_dict_params(
    params_value: str,
    full_api_access: None,
) -> None:
    """get_data must not pass a non-dict form_data to _get_data_response.

    When chart.params is valid JSON that decodes to something other than a dict,
    the isinstance guard must coerce it to {} so downstream callers like
    apply_client_processing never see a non-dict.
    """
    from flask import current_app

    from superset.charts.data.api import ChartDataRestApi

    chart = MagicMock()
    chart.params = params_value
    chart.query_context = json.dumps(
        {
            "datasource": {"id": 1, "type": "table"},
            "queries": [],
            "result_format": "json",
            "result_type": "post_processed",
        }
    )

    api = ChartDataRestApi()
    api.datamodel = MagicMock()
    api.datamodel.get.return_value = chart

    sentinel = MagicMock(name="response", status_code=200)
    captured_form_data: list[Any] = []

    def fake_get_data_response(**kwargs: Any) -> Any:
        captured_form_data.append(kwargs["form_data"])
        return sentinel

    with current_app.test_request_context("/?type=post_processed"):
        with (
            patch.object(api, "_create_query_context_from_form") as mock_create,
            patch.object(api, "_get_data_response", side_effect=fake_get_data_response),
            patch.object(api, "_should_run_async", return_value=False),
            patch("superset.charts.data.api.ChartDataCommand") as mock_cmd_cls,
            patch("superset.charts.data.api.set_form_data"),
        ):
            mock_query_context = MagicMock()
            mock_create.return_value = mock_query_context
            mock_cmd = MagicMock()
            mock_cmd_cls.return_value = mock_cmd
            mock_cmd.query_context = mock_query_context

            result = api.get_data(pk=1)

    assert result is sentinel
    assert len(captured_form_data) == 1
    assert captured_form_data[0] == {}
    assert isinstance(captured_form_data[0], dict)
