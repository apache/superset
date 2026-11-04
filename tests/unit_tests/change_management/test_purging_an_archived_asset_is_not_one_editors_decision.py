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
"""Purge is the unreviewed half of a reviewed delete, and the irreversible one.

Archiving is held for review and can be undone by a reviewed restore. The
REST purge that follows nulls ``datasource_id``/``perm`` on the live charts of
a dataset, or removes the restore a dashboard would have come back through, and
until now it answered 200 on the editor's say-so alone. Core cannot know
whether a delete was reviewed (that is the extension's table), so core still
asks for editorship and the extension refuses the route while review is on.
These tests hold both halves: editorship in core, review in the bound command.
"""

from typing import Any

import pytest
from asset_approval import gate
from asset_approval.exceptions import UnreviewableWriteRefusedError
from pytest_mock import MockerFixture

from superset.commands.purge import PurgeArchivedCommand
from superset.exceptions import SupersetSecurityException


def _bindings() -> list[tuple[str, Any]]:
    from superset.dashboards.api import _DASHBOARD_PURGE_BINDING
    from superset.datasets.api import _DATASET_PURGE_BINDING

    return [("dataset", _DATASET_PURGE_BINDING), ("dashboard", _DASHBOARD_PURGE_BINDING)]


@pytest.mark.parametrize("which", ["dataset", "dashboard"])
def test_a_purge_while_review_is_on_is_refused_before_anything_is_removed(
    app_context: None, mocker: MockerFixture, which: str
) -> None:
    mocker.patch.object(gate, "is_enabled", return_value=True)
    mocker.patch.object(gate, "is_replaying", return_value=False)
    mocker.patch.object(gate, "unlisted_writes_allowed", return_value=False)
    purge = mocker.patch(
        "superset.commands.purge.ForcePurgeCommand"
    )
    binding = dict(_bindings())[which]
    with pytest.raises(UnreviewableWriteRefusedError):
        PurgeArchivedCommand("0" * 32, binding, confirmed_impact_token="t").run()
    purge.assert_not_called()


def test_a_purge_with_review_off_is_unchanged(
    app_context: None, mocker: MockerFixture
) -> None:
    mocker.patch.object(gate, "is_enabled", return_value=False)
    purge = mocker.patch("superset.commands.purge.ForcePurgeCommand")
    purge.return_value.run.return_value = {"purged": True}
    command = PurgeArchivedCommand("0" * 32, dict(_bindings())["dashboard"])
    mocker.patch.object(command, "validate")
    command._model = mocker.MagicMock()
    command.run()
    purge.return_value.run.assert_called_once()


@pytest.mark.parametrize("which", ["dataset", "dashboard"])
def test_a_non_editor_cannot_purge_an_archived_asset(
    app_context: None, mocker: MockerFixture, which: str
) -> None:
    binding = dict(_bindings())[which]
    archived = mocker.MagicMock(deleted_at="2026-11-01")
    mocker.patch.object(binding.dao, "find_by_id", return_value=archived)
    mocker.patch("superset.commands.purge.is_feature_enabled", return_value=True)
    mocker.patch(
        "superset.commands.purge.security_manager.raise_for_editorship",
        side_effect=SupersetSecurityException(mocker.MagicMock()),
    )
    purge = mocker.patch("superset.commands.purge.ForcePurgeCommand")
    mocker.patch.object(gate, "is_enabled", return_value=False)
    with pytest.raises(binding.forbidden):
        PurgeArchivedCommand("0" * 32, binding, confirmed_impact_token="t").run()
    purge.assert_not_called()
