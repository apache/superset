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
"""A deployment that meets a false refusal has a way out that is not a code change.

``FEATURE_FLAGS['CHANGE_MANAGEMENT_ALLOW_UNLISTED_WRITES'] = True`` puts the
deny-by-default guard, and the creation rules that arrived with it, back to
what they were: only the writes the gate names are held, and the rest apply.
It does not touch the gate itself -- a write that is captured is still
captured -- and it is read like every other flag, so no new setting is
introduced for an operator to misspell.
"""

from typing import Any

import pytest
from asset_approval import bindings, gate
from asset_approval.exceptions import UnreviewableWriteRefusedError
from types import SimpleNamespace

from tests.unit_tests.change_management.guard_world import (  # noqa: F401
    commit_or_raise,
    guarded_world,
)


def test_with_the_switch_on_an_unlisted_write_applies(guarded_world: Any) -> None:
    guarded_world.state.allowed = True
    guarded_world.chart.viz_type = "pie"

    assert commit_or_raise(guarded_world.session) is None
    assert guarded_world.chart.viz_type == "pie"


def test_with_the_switch_on_a_bulk_write_applies(guarded_world: Any) -> None:
    from superset.models.slice import Slice

    guarded_world.state.allowed = True

    guarded_world.session.query(Slice).update(
        {Slice.viz_type: "pie"}, synchronize_session=False
    )


def test_with_the_switch_on_a_dashboard_is_born_as_asked(guarded_world: Any) -> None:
    from superset.models.dashboard import Dashboard

    guarded_world.state.allowed = True
    dashboard = Dashboard(dashboard_title="old behaviour", published=True)
    guarded_world.session.add(dashboard)

    assert commit_or_raise(guarded_world.session) is None
    assert dashboard.published is True
    guarded_world.filed.assert_not_called()


def test_with_the_switch_on_the_creation_rules_stand_down_too(
    guarded_world: Any,
) -> None:
    guarded_world.state.allowed = True
    on_a_live_dashboard = SimpleNamespace(
        _properties={"dashboards": [guarded_world.live]}
    )
    publishing = SimpleNamespace(_properties={"published": True})

    bindings._gate_chart_create(on_a_live_dashboard)
    bindings._gate_dashboard_create(publishing)
    bindings._refuse_rest_purge()

    assert publishing._properties["published"] is True


def test_with_the_switch_off_all_of_that_is_refused(guarded_world: Any) -> None:
    on_a_live_dashboard = SimpleNamespace(
        _properties={"dashboards": [guarded_world.live]}
    )

    with pytest.raises(UnreviewableWriteRefusedError):
        bindings._gate_chart_create(on_a_live_dashboard)
    with pytest.raises(UnreviewableWriteRefusedError):
        bindings._refuse_rest_purge()


def test_the_switch_does_not_switch_the_gate_off(guarded_world: Any, mocker: Any) -> None:
    """A captured write is still captured: only unlisted writes are let by."""
    guarded_world.state.allowed = True
    capture = mocker.patch.object(bindings, "gate_write")
    command = SimpleNamespace(
        _model=SimpleNamespace(id=1, published=True),
        _captured_payload={"dashboard_title": "x"},
    )
    mocker.patch.object(bindings, "has_ever_been_published", return_value=True)

    bindings._gate_dashboard_update(command)

    capture.assert_called_once()


def test_the_switch_is_an_ordinary_feature_flag(mocker: Any) -> None:
    """Read through the flag manager, so ``FEATURE_FLAGS`` is where it lives."""
    asked: list[str] = []

    def is_feature_enabled(name: str) -> bool:
        asked.append(name)
        return name == gate.ALLOW_UNLISTED_FLAG

    mocker.patch(
        "superset.extensions.feature_flag_manager.is_feature_enabled",
        side_effect=is_feature_enabled,
    )

    assert gate.unlisted_writes_allowed() is True
    assert asked == ["CHANGE_MANAGEMENT_ALLOW_UNLISTED_WRITES"]


def test_the_switch_defaults_to_off(mocker: Any) -> None:
    mocker.patch(
        "superset.extensions.feature_flag_manager.is_feature_enabled",
        return_value=False,
    )

    assert gate.unlisted_writes_allowed() is False


def test_the_switch_is_not_named_like_a_setting_the_extension_audits() -> None:
    """The boot log warns about an ``ASSET_APPROVAL_*`` key it does not read."""
    assert not gate.ALLOW_UNLISTED_FLAG.startswith("ASSET_APPROVAL_")
    assert gate.ALLOW_UNLISTED_FLAG.startswith("CHANGE_MANAGEMENT")
