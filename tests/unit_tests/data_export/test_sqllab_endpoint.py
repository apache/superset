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
"""Requesting an uncapped export of a SQL Lab query's results."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.data_export.enqueue import EnqueueAccepted, EnqueueRefusal
from superset.exceptions import SupersetSecurityException
from superset.utils import json

MODULE = "superset.sqllab.api"
URL = "/api/v1/sqllab/full_export/abc123/"


@pytest.fixture
def stored_query(mocker: MockerFixture) -> MagicMock:
    query = MagicMock()
    query.tab_name = "Untitled Query 3"
    mocker.patch(
        f"{MODULE}.db.session.query"
    ).return_value.filter_by.return_value.one_or_none.return_value = query
    return query


@pytest.fixture
def queued(mocker: MockerFixture, stored_query: MagicMock) -> MagicMock:
    mocker.patch(f"{MODULE}.is_feature_enabled", return_value=True)
    return mocker.patch(
        f"{MODULE}.enqueue_full_export", return_value=EnqueueAccepted("job-2")
    )


def test_a_queued_export_answers_with_a_job_id_to_poll(
    session: Session, client: Any, full_api_access: None, queued: MagicMock
) -> None:
    response = client.post(URL)

    assert response.status_code == 202
    assert json.loads(response.data)["job_id"] == "job-2"


def test_the_export_is_named_and_keyed_by_the_query(
    session: Session, client: Any, full_api_access: None, queued: MagicMock
) -> None:
    client.post(URL)

    kwargs = queued.call_args.kwargs
    assert kwargs["payload"] == {
        "client_id": "abc123",
        "label": "Untitled Query 3",
        "format": "csv",
    }
    assert kwargs["target"] == "abc123"


def test_an_untitled_tab_still_gets_a_readable_name(
    session: Session,
    client: Any,
    full_api_access: None,
    queued: MagicMock,
    stored_query: MagicMock,
) -> None:
    stored_query.tab_name = None

    client.post(URL)

    assert queued.call_args.kwargs["payload"]["label"] == "SQL Lab query"


def test_a_query_that_no_longer_exists_is_not_found(
    session: Session,
    client: Any,
    full_api_access: None,
    queued: MagicMock,
    mocker: MockerFixture,
) -> None:
    """Results expire out of the results backend; the record can be gone too."""
    mocker.patch(
        f"{MODULE}.db.session.query"
    ).return_value.filter_by.return_value.one_or_none.return_value = None

    response = client.post(URL)

    assert response.status_code == 404
    queued.assert_not_called()


def test_a_user_without_access_to_the_query_is_refused(
    session: Session,
    client: Any,
    full_api_access: None,
    queued: MagicMock,
    stored_query: MagicMock,
) -> None:
    """The same gate the buffered and streaming exports apply, run before
    anything is queued rather than only in the worker."""
    stored_query.raise_for_access.side_effect = SupersetSecurityException(
        MagicMock(message="nope")
    )

    response = client.post(URL)

    assert response.status_code == 403
    queued.assert_not_called()


def test_the_endpoint_is_invisible_with_the_feature_flag_off(
    session: Session,
    client: Any,
    full_api_access: None,
    queued: MagicMock,
    mocker: MockerFixture,
) -> None:
    mocker.patch(f"{MODULE}.is_feature_enabled", return_value=False)

    response = client.post(URL)

    assert response.status_code == 404
    queued.assert_not_called()


def test_a_refusal_from_the_enqueue_guards_is_passed_through(
    session: Session, client: Any, full_api_access: None, queued: MagicMock
) -> None:
    queued.return_value = EnqueueRefusal(
        400, "Uncapped data exports need background exports."
    )

    response = client.post(URL)

    assert response.status_code == 400
    assert "background exports" in json.loads(response.data)["message"]


def test_the_format_defaults_to_csv_for_an_empty_body(
    session: Session, client: Any, full_api_access: None, queued: MagicMock
) -> None:
    """The button sends no body; a missing format must not fail the request."""
    client.post(URL)

    assert queued.call_args.kwargs["payload"]["format"] == "csv"


def test_an_excel_export_can_be_requested(
    session: Session, client: Any, full_api_access: None, queued: MagicMock
) -> None:
    client.post(URL, json={"format": "xlsx"})

    assert queued.call_args.kwargs["payload"]["format"] == "xlsx"


def test_an_unknown_format_is_rejected(
    session: Session, client: Any, full_api_access: None, queued: MagicMock
) -> None:
    """Rejected at the door rather than in the worker, where it would cost a
    queued job and a failure email."""
    response = client.post(URL, json={"format": "parquet"})

    assert response.status_code == 400
    queued.assert_not_called()
