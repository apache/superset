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
"""A dataset refresh has nothing an approval could replay, so it is refused."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest
from asset_approval import gate
from asset_approval.exceptions import UnreviewableWriteRefusedError
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.commands.dataset.refresh import RefreshDatasetCommand


@pytest.fixture
def dataset(mocker: MockerFixture) -> MagicMock:
    model = MagicMock(id=3, table_name="t")

    def validate(self: RefreshDatasetCommand) -> None:
        self._model = model

    mocker.patch.object(RefreshDatasetCommand, "validate", validate)
    mocker.patch(
        "superset.commands.dataset.refresh.DatetimeFormatDetector", MagicMock()
    )
    return model


def test_refresh_applies_directly_with_review_on(
    mocker: MockerFixture, session: Session, dataset: MagicMock
) -> None:
    """Sync columns from source is exempt, so review does not hold it.

    SOW 5.2, criterion 5: it does not author a change, it re-reads what the
    database already says. It used to be refused with a 422, which left no
    way to do it at all while review was on (129073).
    """
    mocker.patch.object(gate, "is_enabled", return_value=True)

    assert RefreshDatasetCommand(3).run() is dataset
    dataset.fetch_metadata.assert_called_once()


def test_refresh_unchanged_with_flag_off(
    mocker: MockerFixture, session: Session, dataset: MagicMock
) -> None:
    mocker.patch.object(gate, "is_enabled", return_value=False)

    assert RefreshDatasetCommand(3).run() is dataset
    dataset.fetch_metadata.assert_called_once()


def test_refresh_runs_during_replay(
    mocker: MockerFixture, session: Session, dataset: MagicMock
) -> None:
    mocker.patch.object(gate, "is_enabled", return_value=True)

    with gate.replaying():
        RefreshDatasetCommand(3).run()
    dataset.fetch_metadata.assert_called_once()


def test_refresh_api_answers_refusal_with_422(
    mocker: MockerFixture, client: Any, full_api_access: None
) -> None:
    command = mocker.patch("superset.datasets.api.RefreshDatasetCommand")
    command.return_value.run.side_effect = UnreviewableWriteRefusedError(
        "Refreshing a dataset's columns", "Save instead."
    )

    response = client.put("/api/v1/dataset/3/refresh")

    assert response.status_code == 422
    assert response.json["message"].startswith(
        "Refreshing a dataset's columns needs review"
    )
