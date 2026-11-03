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
"""``super().validate()`` walks past an instance attribute.

The gate has to run after a command's authorization checks, so the
extension validates ahead of it and then shadows ``validate`` on the
instance so the host's own call stands down. That works because
``self.validate()`` finds the instance attribute first.

Two commands do not call ``self.validate()``. ``UpdateDashboardNativeFiltersCommand``
and ``UpdateDashboardChartCustomizationsCommand`` call ``super().validate()``,
which resolves on the MRO and never sees the shadow -- so they validated
twice, and validating twice is not validating once: ``validate`` resolves
editor ids into ``Subject`` objects *in place*, so the second pass was
handed its own output and tried to resolve objects that were already
resolved.

What an author saw: open the native filter modal, change nothing, press
Save, and get a 422 with ``can't adapt type 'Subject'`` in the log. Nothing
was lost -- the write was a no-op either way -- but they were shown an
error for doing nothing.

Read off the source rather than kept as a list of class names, so a command
that starts calling ``super().validate()`` is covered the day it does.
"""

from __future__ import annotations

from typing import Any

from asset_approval.install import _revalidates_on_the_class, _validate_once


class _ShadowWorks:
    """An ordinary command: ``run`` defers to ``self.validate()``."""

    def __init__(self) -> None:
        self._properties: dict[str, Any] = {"editors": [7, 8]}
        self.validations = 0

    def validate(self) -> None:
        self.validations += 1
        # The real thing resolves ids into objects, in place.
        self._properties["editors"] = [
            f"Subject<{value}>" for value in self._properties["editors"]
        ]

    def run(self) -> None:
        self.validate()


class _ShadowDefeated(_ShadowWorks):
    """The real shape of the two dashboard sub-commands."""

    def run(self) -> None:
        super().validate()


def test_the_two_shapes_are_told_apart_by_their_source() -> None:
    assert _revalidates_on_the_class(_ShadowDefeated) is True
    assert _revalidates_on_the_class(_ShadowWorks) is False


def test_an_ordinary_command_still_validates_exactly_once() -> None:
    command = _ShadowWorks()

    _validate_once(command)
    command.run()

    assert command.validations == 1
    assert command._properties["editors"] == ["Subject<7>", "Subject<8>"]


def test_a_command_that_revalidates_is_given_back_its_own_request() -> None:
    """The fix. It validates twice -- wasteful, and correct -- but the
    second pass reads the request the author sent, not the first pass's
    output, so nothing is resolved a second time."""
    command = _ShadowDefeated()

    _validate_once(command)
    assert command._properties["editors"] == [7, 8], "the request is restored"

    command.run()

    assert command.validations == 2
    assert command._properties["editors"] == ["Subject<7>", "Subject<8>"]


def test_the_real_superset_commands_are_the_ones_this_is_for() -> None:
    """Named here so the claim is checked against the host, not asserted.

    If Superset stops calling ``super().validate()`` in these, this test
    fails and the special case can go.
    """
    from superset.commands.dashboard.update import (  # noqa: PLC0415
        UpdateDashboardChartCustomizationsCommand,
        UpdateDashboardNativeFiltersCommand,
    )

    assert _revalidates_on_the_class(UpdateDashboardNativeFiltersCommand) is True
    assert (
        _revalidates_on_the_class(UpdateDashboardChartCustomizationsCommand) is True
    )
