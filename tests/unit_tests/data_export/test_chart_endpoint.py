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
"""Requesting an uncapped export of a chart's data."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.charts.data.api import ChartDataRestApi
from superset.common.chart_data import ChartDataResultType
from superset.data_export.enqueue import EnqueueAccepted, EnqueueRefusal
from superset.exceptions import SupersetSecurityException
from superset.utils import json

MODULE = "superset.charts.data.api"
URL = "/api/v1/chart/data/full_export/"

QUERY_CONTEXT = {
    "datasource": {"type": "table", "id": 3},
    "queries": [{"columns": ["a"], "row_limit": 50_000}],
    "result_format": "csv",
    "result_type": "full",
}


@pytest.fixture
def queued(mocker: MockerFixture) -> MagicMock:
    """A request that reaches the enqueue step."""
    mocker.patch(f"{MODULE}.is_feature_enabled", return_value=True)
    mocker.patch.object(ChartDataRestApi, "_has_export_permission", return_value=True)
    query_context = MagicMock()
    query_context.result_type = ChartDataResultType.FULL
    query_context.queries = [MagicMock()]
    query_context.slice_ = MagicMock(id=12, slice_name="Sales by region")
    mocker.patch.object(
        ChartDataRestApi, "_create_query_context_from_form", return_value=query_context
    )
    mocker.patch(f"{MODULE}.ChartDataCommand")
    mocker.patch(
        f"{MODULE}.serialize_query",
        return_value={
            "datasource": QUERY_CONTEXT["datasource"],
            "query": {"columns": ["a"], "row_limit": 50_000},
            "form_data": None,
            "result_type": "full",
            "result_format": "csv",
            "force": False,
            "custom_cache_timeout": None,
        },
    )
    return mocker.patch(
        f"{MODULE}.enqueue_full_export",
        return_value=EnqueueAccepted("job-1"),
    )


def _post(client: Any, body: dict[str, Any] | None = None) -> Any:
    return client.post(
        URL, json={"query_context": body if body is not None else QUERY_CONTEXT}
    )


def test_a_queued_export_answers_with_a_job_id_to_poll(
    session: Session, client: Any, full_api_access: None, queued: MagicMock
) -> None:
    response = _post(client)

    assert response.status_code == 202
    assert json.loads(response.data)["job_id"] == "job-1"


def test_the_queued_query_carries_no_row_limit(
    session: Session, client: Any, full_api_access: None, queued: MagicMock
) -> None:
    """The one thing that makes the export uncapped: a null limit plus
    ``preserve_null_row_limit``, so the worker's rebuilt query does not fall
    back to ``ROW_LIMIT`` and the SQL gets no ``LIMIT`` clause."""
    _post(client)

    payload = queued.call_args.kwargs["payload"]["query_context"]
    assert payload["query"]["row_limit"] is None
    assert payload["preserve_null_row_limit"] is True


def test_the_export_is_named_and_keyed_by_the_chart(
    session: Session, client: Any, full_api_access: None, queued: MagicMock
) -> None:
    _post(client)

    assert queued.call_args.kwargs["payload"]["label"] == "Sales by region"
    assert queued.call_args.kwargs["payload"]["slice_id"] == 12
    # The in-flight lock is per chart, so the same chart cannot be queued twice.
    assert queued.call_args.kwargs["target"] == "slice:12"


def test_an_unsaved_chart_is_keyed_by_its_datasource(
    session: Session,
    client: Any,
    full_api_access: None,
    queued: MagicMock,
    mocker: MockerFixture,
) -> None:
    """Explore can export a chart that was never saved, which has no id."""
    context = (
        ChartDataRestApi._create_query_context_from_form.return_value  # noqa: SLF001
    )
    context.slice_ = None

    _post(client)

    assert queued.call_args.kwargs["target"].startswith("datasource:")
    assert queued.call_args.kwargs["payload"]["slice_id"] is None


def test_a_chart_with_several_queries_says_what_the_file_holds(
    session: Session, client: Any, full_api_access: None, queued: MagicMock
) -> None:
    """A table with totals, or a time comparison, runs more than one query and
    there is one file. Dropping the rest silently is the thing to avoid."""
    context = (
        ChartDataRestApi._create_query_context_from_form.return_value  # noqa: SLF001
    )
    context.queries = [MagicMock(), MagicMock()]

    _post(client)

    assert "main result set" in queued.call_args.kwargs["payload"]["partial_note"]


def test_a_post_processed_result_is_refused_with_an_explanation(
    session: Session, client: Any, full_api_access: None, queued: MagicMock
) -> None:
    """A pivot or a forecast is computed from the whole frame in memory, which
    is exactly what an uncapped export cannot do."""
    context = (
        ChartDataRestApi._create_query_context_from_form.return_value  # noqa: SLF001
    )
    context.result_type = ChartDataResultType.POST_PROCESSED

    response = _post(client)

    assert response.status_code == 400
    assert "post-processed" in json.loads(response.data)["message"]
    queued.assert_not_called()


def test_the_endpoint_is_invisible_with_the_feature_flag_off(
    session: Session,
    client: Any,
    full_api_access: None,
    queued: MagicMock,
    mocker: MockerFixture,
) -> None:
    mocker.patch(f"{MODULE}.is_feature_enabled", return_value=False)

    response = _post(client)

    assert response.status_code == 404
    queued.assert_not_called()


def test_a_user_who_may_not_export_data_is_refused(
    session: Session,
    client: Any,
    full_api_access: None,
    queued: MagicMock,
    mocker: MockerFixture,
) -> None:
    """The same export permission a normal CSV download needs."""
    mocker.patch.object(ChartDataRestApi, "_has_export_permission", return_value=False)

    response = _post(client)

    assert response.status_code == 403
    queued.assert_not_called()


def test_a_user_without_access_to_the_data_is_refused(
    session: Session,
    client: Any,
    full_api_access: None,
    queued: MagicMock,
    mocker: MockerFixture,
) -> None:
    """Dataset access is checked before anything is queued, not only in the
    worker."""
    command = mocker.patch(f"{MODULE}.ChartDataCommand")
    command.return_value.validate.side_effect = SupersetSecurityException(
        MagicMock(message="nope")
    )

    response = _post(client)

    assert response.status_code == 403
    queued.assert_not_called()


def test_a_refusal_from_the_enqueue_guards_is_passed_through(
    session: Session, client: Any, full_api_access: None, queued: MagicMock
) -> None:
    """Storage missing, no signed-in user, or an export already running."""
    queued.return_value = EnqueueRefusal(409, "Already in progress.")

    response = _post(client)

    assert response.status_code == 409
    assert json.loads(response.data)["message"] == "Already in progress."


def test_a_request_without_a_query_context_is_rejected(
    session: Session, client: Any, full_api_access: None, queued: MagicMock
) -> None:
    response = client.post(URL, json={})

    assert response.status_code == 400
    queued.assert_not_called()


def test_the_format_defaults_to_csv(
    session: Session, client: Any, full_api_access: None, queued: MagicMock
) -> None:
    _post(client)

    assert queued.call_args.kwargs["payload"]["format"] == "csv"


def test_an_excel_export_can_be_requested(
    session: Session, client: Any, full_api_access: None, queued: MagicMock
) -> None:
    client.post(URL, json={"query_context": QUERY_CONTEXT, "format": "xlsx"})

    assert queued.call_args.kwargs["payload"]["format"] == "xlsx"


def test_an_unknown_format_is_rejected(
    session: Session, client: Any, full_api_access: None, queued: MagicMock
) -> None:
    """Rejected at the door rather than in the worker, where it would cost a
    queued job and a failure email."""
    response = client.post(
        URL, json={"query_context": QUERY_CONTEXT, "format": "parquet"}
    )

    assert response.status_code == 400
    queued.assert_not_called()
