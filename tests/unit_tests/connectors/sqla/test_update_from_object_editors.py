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
"""``update_from_object`` must resolve editors, not assign raw dicts.

``SqlaTable.data`` emits editors as plain ``{id, label, type}`` dicts, and
the legacy datasource editor posts that same shape back, so
``"editors" in obj`` holds on an ordinary round-trip. Assigning those dicts
to a ``secondary`` relationship scheduled a DELETE of the association rows
and then failed downstream -- and the legacy view had no transaction, so
the cleared editors were what survived. Editorship is the access-control
source of truth, so the dataset lost its owners (QA-02).
"""

from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.connectors.sqla.models import SqlaTable


@pytest.fixture
def table(mocker: MockerFixture) -> Any:
    """A ``SqlaTable`` with just enough on it to run the editor branch."""
    model = SqlaTable.__new__(SqlaTable)
    existing = [MagicMock(id=1), MagicMock(id=2)]
    object.__setattr__(model, "_existing_editors", existing)
    # The relationship, stubbed: reading gives the current rows, writing
    # records what was assigned.
    mocker.patch.object(
        SqlaTable,
        "editors",
        property(
            lambda self: self._existing_editors,
            lambda self, value: object.__setattr__(self, "_existing_editors", value),
        ),
    )
    return model


def test_dicts_are_resolved_to_subjects_by_id(
    table: Any, mocker: MockerFixture
) -> None:
    resolved = [MagicMock(id=3)]
    compute = mocker.patch(
        "superset.commands.utils.compute_subject_list", return_value=resolved
    )

    result = table._resolve_editors([{"id": 3, "label": "ann", "type": "user"}])

    assert result is resolved
    # The ids, not the dicts: handing the dicts on is the defect itself.
    assert compute.call_args.args[1] == [3]


def test_an_omitted_list_keeps_the_current_editors(
    table: Any, mocker: MockerFixture
) -> None:
    compute = mocker.patch(
        "superset.commands.utils.compute_subject_list", return_value=[]
    )

    table._resolve_editors(None)

    # ``None`` means "not specified", which compute_subject_list preserves.
    assert compute.call_args.args[1] is None


def test_subject_objects_are_accepted_too(table: Any, mocker: MockerFixture) -> None:
    compute = mocker.patch(
        "superset.commands.utils.compute_subject_list", return_value=[]
    )

    table._resolve_editors([MagicMock(id=7)])

    assert compute.call_args.args[1] == [7]


def test_update_from_object_no_longer_assigns_raw_dicts(
    table: Any, mocker: MockerFixture
) -> None:
    resolved = [MagicMock(id=9)]
    mocker.patch(
        "superset.commands.utils.compute_subject_list", return_value=resolved
    )
    mocker.patch.object(SqlaTable, "update_from_object_fields", [])
    mocker.patch.object(SqlaTable, "get_fk_many_from_list", return_value=[])
    mocker.patch.object(
        SqlaTable, "metrics", property(lambda s: [], lambda s, v: None)
    )
    mocker.patch.object(
        SqlaTable, "columns", property(lambda s: [], lambda s, v: None)
    )

    table.update_from_object({"editors": [{"id": 9, "label": "ann", "type": "user"}]})

    assert table.editors == resolved
    assert not any(isinstance(editor, dict) for editor in table.editors)
