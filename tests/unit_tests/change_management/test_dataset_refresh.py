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
"""A dataset refresh applies directly, and what it writes is the point.

The module docstring used to say a refresh "is refused", which every test
under it contradicts. It is exempt (SOW 5.2, criterion 5, 129073).

Being exempt is exactly why what it writes matters. An exempt write is not
shown to a reviewer and raises no change request, so anything it touches is
applied with nobody looking. The tests here asserted only that
``fetch_metadata`` was *called* -- on a ``MagicMock`` dataset, which is to
say they mocked away the function that does the writing. So the refresh
resetting ``groupby``/``filterable`` to True on every column it matched was
invisible to this file, and an editor's deliberate restriction was silently
reversed by a resync, with no record of it anywhere.

The last test here is the real one: a dataset the refresh can actually
write to.
"""

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


def test_a_resync_leaves_the_editors_own_column_choices_alone(
    mocker: MockerFixture, session: Session
) -> None:
    """On a real dataset, not a mock. ``groupby`` and ``filterable`` are
    editor choices and the source has no opinion about either, so matching a
    column against the source is not a reason to change them.

    The counterweight is in the same assertion: a column the refresh has
    just *added* has never been configured by anyone, and has to arrive
    usable.
    """
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.models.core import Database
    from superset import db

    SqlaTable.metadata.create_all(db.session.get_bind())
    database = Database(database_name="source", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()
    dataset = SqlaTable(table_name="orders", database=database)
    db.session.add(dataset)
    db.session.flush()
    db.session.add(
        TableColumn(
            column_name="restricted",
            type="INT",
            table_id=dataset.id,
            groupby=False,
            filterable=False,
        )
    )
    db.session.commit()

    mocker.patch.object(  # noqa: PT008
        SqlaTable,
        "external_metadata",
        lambda self: [
            {"column_name": "restricted", "type": "INT"},
            {"column_name": "fresh", "type": "INT"},
        ],
    )
    mocker.patch.object(  # noqa: PT008
        Database, "get_metrics", lambda self, table: []
    )
    mocker.patch(
        "superset.commands.dataset.refresh.DatetimeFormatDetector", MagicMock()
    )

    def validate(self: RefreshDatasetCommand) -> None:
        self._model = dataset

    mocker.patch.object(RefreshDatasetCommand, "validate", validate)
    mocker.patch.object(gate, "is_enabled", return_value=True)

    RefreshDatasetCommand(dataset.id).run()

    db.session.expire_all()
    by_name = {column.column_name: column for column in dataset.columns}
    assert (by_name["restricted"].groupby, by_name["restricted"].filterable) == (
        False,
        False,
    ), "the resync re-enabled grouping and filtering nobody asked it to"
    assert (by_name["fresh"].groupby, by_name["fresh"].filterable) == (True, True)
