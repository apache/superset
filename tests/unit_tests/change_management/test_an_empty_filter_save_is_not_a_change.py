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
"""Saving native filters without changing one is not a change (R4-08).

129076 stopped a full-state save that altered nothing from creating a
request. The dashboard's filter and chart-customization endpoints post a
*diff* instead, which cannot be compared with the asset field by field, so
they went on paying that cost: opening the filter modal and pressing Save
posts every filter back as "modified" whether or not any was touched, and
each such save locked the dashboard behind an empty draft.
"""

from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from asset_approval import gate
from asset_approval.changes import config_diff_changes_nothing
from asset_approval.exceptions import ChangeRequestCreated
from superset.commands.dashboard.update import (
    UpdateDashboardCommand,
    UpdateDashboardNativeFiltersCommand,
)
from superset.utils import json

KEY = "native_filter_configuration"


def _metadata(*filters: dict[str, Any]) -> str:
    return json.dumps({KEY: list(filters), "color_scheme": "supersetColors"})


def _filter(id_: str = "F1", name: str = "Region") -> dict[str, Any]:
    return {"id": id_, "name": name, "filterType": "filter_select"}


def _diff(**parts: Any) -> dict[str, Any]:
    return {"modified": [], "deleted": [], "reordered": [], **parts}


def test_resaving_every_filter_untouched_changes_nothing() -> None:
    stored = _metadata(_filter("F1"), _filter("F2", "Country"))
    posted = _diff(modified=[_filter("F1"), _filter("F2", "Country")])

    assert config_diff_changes_nothing(stored, posted, metadata_key=KEY) is True


def test_an_entirely_empty_diff_changes_nothing() -> None:
    assert (
        config_diff_changes_nothing(_metadata(_filter()), _diff(), metadata_key=KEY)
        is True
    )


def test_a_renamed_filter_is_a_change() -> None:
    stored = _metadata(_filter("F1", "Region"))
    posted = _diff(modified=[_filter("F1", "Territory")])

    assert config_diff_changes_nothing(stored, posted, metadata_key=KEY) is False


def test_a_new_filter_is_a_change() -> None:
    stored = _metadata(_filter("F1"))
    posted = _diff(modified=[_filter("F2", "Country")])

    assert config_diff_changes_nothing(stored, posted, metadata_key=KEY) is False


def test_deleting_a_filter_that_exists_is_a_change() -> None:
    stored = _metadata(_filter("F1"))

    assert (
        config_diff_changes_nothing(stored, _diff(deleted=["F1"]), metadata_key=KEY)
        is False
    )


def test_deleting_one_that_is_already_gone_changes_nothing() -> None:
    stored = _metadata(_filter("F1"))

    assert (
        config_diff_changes_nothing(stored, _diff(deleted=["F9"]), metadata_key=KEY)
        is True
    )


def test_a_real_reorder_is_a_change() -> None:
    stored = _metadata(_filter("F1"), _filter("F2", "Country"))

    assert (
        config_diff_changes_nothing(
            stored, _diff(reordered=["F2", "F1"]), metadata_key=KEY
        )
        is False
    )


def test_the_order_it_already_has_changes_nothing() -> None:
    stored = _metadata(_filter("F1"), _filter("F2", "Country"))

    assert (
        config_diff_changes_nothing(
            stored, _diff(reordered=["F1", "F2"]), metadata_key=KEY
        )
        is True
    )


def test_a_filter_whose_scope_moved_is_a_change() -> None:
    stored = _metadata({**_filter(), "scope": {"rootPath": ["ROOT_ID"]}})
    posted = _diff(modified=[{**_filter(), "scope": {"rootPath": ["TAB-1"]}}])

    assert config_diff_changes_nothing(stored, posted, metadata_key=KEY) is False


def test_unreadable_metadata_counts_as_a_change() -> None:
    """A gate may only be wrong in the direction of capturing too much."""
    posted = _diff(modified=[_filter()])

    assert config_diff_changes_nothing(None, posted, metadata_key=KEY) is False
    assert config_diff_changes_nothing("{{{", posted, metadata_key=KEY) is False


def test_a_body_that_is_not_a_config_diff_is_left_alone() -> None:
    stored = _metadata(_filter())

    assert (
        config_diff_changes_nothing(stored, {"json_metadata": "{}"}, metadata_key=KEY)
        is False
    )


def test_chart_customizations_use_their_own_key() -> None:
    stored = json.dumps({"chart_customization_config": [{"id": "C1", "x": 1}]})
    posted = _diff(modified=[{"id": "C1", "x": 1}])

    assert (
        config_diff_changes_nothing(
            stored, posted, metadata_key="chart_customization_config"
        )
        is True
    )
    assert config_diff_changes_nothing(stored, posted, metadata_key=KEY) is False


# --------------------------------------------------------------- end to end


UNTOUCHED = {"id": "NATIVE_FILTER-1", "name": "Region"}


@pytest.fixture
def dashboard(mocker: MockerFixture) -> MagicMock:
    """A dashboard holding one native filter, bound to the real command."""
    model = MagicMock(
        id=1, json_metadata=json.dumps({KEY: [UNTOUCHED]}), is_managed_externally=False
    )

    def validate(self: UpdateDashboardCommand) -> None:
        self._model = model

    mocker.patch.object(UpdateDashboardCommand, "validate", validate)
    return model


@pytest.fixture
def capture(mocker: MockerFixture) -> MagicMock:
    mocker.patch.object(gate, "is_enabled", return_value=True)
    mocker.patch.object(gate, "get_user_id", return_value=5)
    mocker.patch.object(gate, "find_open_request", return_value=None)
    return mocker.patch.object(gate, "_insert_request", return_value=7)


@pytest.fixture
def dao(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("superset.commands.dashboard.update.DashboardDAO")


def test_an_untouched_filter_save_is_applied_not_captured(
    session: Session, dashboard: MagicMock, dao: MagicMock, capture: MagicMock
) -> None:
    """The write reaches the DAO and no request is created."""
    UpdateDashboardNativeFiltersCommand(
        1, {"modified": [UNTOUCHED], "deleted": [], "reordered": []}
    ).run()

    capture.assert_not_called()
    dao.update_native_filters_config.assert_called_once()


def test_a_real_filter_edit_is_still_captured(
    session: Session, dashboard: MagicMock, dao: MagicMock, capture: MagicMock
) -> None:
    with pytest.raises(ChangeRequestCreated):
        UpdateDashboardNativeFiltersCommand(
            1,
            {
                "modified": [{**UNTOUCHED, "name": "Territory"}],
                "deleted": [],
                "reordered": [],
            },
        ).run()

    capture.assert_called_once()
    dao.update_native_filters_config.assert_not_called()
