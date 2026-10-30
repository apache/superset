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
"""A captured write must not be cleaned up as if it had failed.

``create_virtual_dataset`` creates the dataset, then updates it to add
metrics and calculated columns. The create is not gated; the update is.
With review on, the update raised a capture, a blanket ``except
Exception`` read that as a failed update and deleted the dataset -- which
was already created and committed. The delete was captured in turn, so it
replaced the author's edit request with a delete request against an asset
they had just made, and the caller was told creation had failed.

The rule the fix pins: a capture means the write is waiting on a person,
so the work already done stands.
"""

from importlib import import_module
from typing import Any

import pytest
from asset_approval.exceptions import ChangeRequestCreated
from pytest_mock import MockerFixture

# The package re-exports the tool function under its module's name, so the
# module itself is only reachable through ``import_module``.
tool = import_module("superset.mcp_service.dataset.tool.create_virtual_dataset")


@pytest.fixture
def cleanup(mocker: MockerFixture) -> Any:
    return mocker.patch.object(tool, "_cleanup_failed_dataset")


def _run_update_raising(mocker: MockerFixture, error: BaseException) -> None:
    command = mocker.patch(
        "superset.commands.dataset.update.UpdateDatasetCommand",
    )
    command.return_value.run.side_effect = error


def test_a_captured_update_leaves_the_dataset_alone(
    mocker: MockerFixture, cleanup: Any
) -> None:
    _run_update_raising(
        mocker,
        ChangeRequestCreated(change_request_id=7, asset_type="dataset", asset_id=42),
    )

    with pytest.raises(ChangeRequestCreated):
        tool._update_virtual_dataset(42, {"metrics": []})

    cleanup.assert_not_called()


def test_the_capture_reaches_the_caller_unwrapped(
    mocker: MockerFixture, cleanup: Any
) -> None:
    # Rewrapping it as DatasetUpdateFailedError would hide it from
    # ``is_review_signal``, so the caller would be told the write failed
    # and would retry a write that had in fact been accepted.
    signal = ChangeRequestCreated(
        change_request_id=7, asset_type="dataset", asset_id=42
    )
    _run_update_raising(mocker, signal)

    with pytest.raises(ChangeRequestCreated) as raised:
        tool._update_virtual_dataset(42, {"metrics": []})

    assert raised.value is signal


def test_a_real_failure_still_cleans_up(
    mocker: MockerFixture, cleanup: Any
) -> None:
    # The cleanup exists for a reason; only the capture is exempt from it.
    _run_update_raising(mocker, RuntimeError("the database went away"))

    with pytest.raises(Exception):
        tool._update_virtual_dataset(42, {"metrics": []})

    cleanup.assert_called_once_with(42)


def test_the_response_reports_both_facts() -> None:
    # The dataset exists and the rest is waiting on a reviewer. Reporting
    # only one of the two is what made this look like a failed creation.
    from superset.mcp_service.dataset.schemas import CreateVirtualDatasetResponse

    held = CreateVirtualDatasetResponse(
        id=42,
        dataset_name="sales",
        sql="SELECT 1",
        database_id=1,
        columns=["a"],
        url="http://example.invalid/explore/",
        review_required=True,
        review_message="change request 7",
    )

    assert held.id == 42
    assert held.error is None
    assert held.review_required is True

    plain = CreateVirtualDatasetResponse(
        id=42,
        dataset_name="sales",
        sql="SELECT 1",
        database_id=1,
        columns=["a"],
        url="http://example.invalid/explore/",
    )
    assert plain.review_required is False
    assert plain.review_message is None


def test_an_unused_name_is_not_left_behind() -> None:
    # Guard the shape of the fix rather than only its effect: the branch
    # has to come before the cleanup call, not after it.
    import inspect

    source = inspect.getsource(tool._update_virtual_dataset)
    assert source.index("is_review_signal") < source.index(
        "_cleanup_failed_dataset"
    ), "the capture must be re-raised before the cleanup runs"
