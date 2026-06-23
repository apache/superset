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
from unittest.mock import MagicMock

import pytest
from flask import current_app

from superset.commands.temporary_cache.create import CreateTemporaryCacheCommand
from superset.commands.temporary_cache.parameters import CommandParameters


def test_run_invokes_validate_before_create():
    """run() must call validate() before create() per the BaseCommand contract."""
    order = []

    class _Command(CreateTemporaryCacheCommand):
        def validate(self) -> None:
            order.append("validate")

        def create(self, cmd_params: CommandParameters) -> str:
            order.append("create")
            return "key"

    command = _Command(CommandParameters(resource_id=1))
    with current_app.test_request_context():
        result = command.run()

    assert result == "key"
    assert order == ["validate", "create"]


def test_run_short_circuits_when_validate_raises():
    """If validate() raises, create() must not be reached."""

    class _Command(CreateTemporaryCacheCommand):
        def validate(self) -> None:
            raise ValueError("invalid")

        create = MagicMock()

    command = _Command(CommandParameters(resource_id=1))

    with (
        current_app.test_request_context(),
        pytest.raises(ValueError, match="invalid"),
    ):
        command.run()

    command.create.assert_not_called()
