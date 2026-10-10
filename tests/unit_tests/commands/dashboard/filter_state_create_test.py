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
from unittest.mock import patch

from flask import current_app

from superset.commands.dashboard.filter_state.create import CreateFilterStateCommand
from superset.commands.temporary_cache.parameters import CommandParameters


def test_run_calls_validate_before_create():
    """The BaseCommand contract requires validate() to run before create()."""
    cmd_params = CommandParameters(resource_id=1, value='{"a": 1}')
    command = CreateFilterStateCommand(cmd_params)

    with (
        current_app.test_request_context(),
        patch.object(command, "validate") as mock_validate,
        patch.object(command, "create", return_value="key") as mock_create,
    ):
        command.run()

        mock_validate.assert_called_once()
        mock_create.assert_called_once()


def test_run_sets_cache_with_explicit_timeout():
    """cache.set must receive an explicit timeout sourced from config."""
    cmd_params = CommandParameters(resource_id=1, value='{"a": 1}')
    command = CreateFilterStateCommand(cmd_params)

    expected_timeout = current_app.config["FILTER_STATE_CACHE_CONFIG"].get(
        "CACHE_DEFAULT_TIMEOUT"
    )

    with (
        current_app.test_request_context(),
        patch("superset.commands.dashboard.filter_state.create.check_access"),
        patch("superset.commands.dashboard.filter_state.create.cache_key"),
        patch(
            "superset.commands.dashboard.filter_state.create.cache_manager"
        ) as mock_cache_manager,
        patch(
            "superset.commands.dashboard.filter_state.create.random_key",
            return_value="random-key",
        ),
        patch(
            "superset.commands.dashboard.filter_state.create.get_user_id",
            return_value=1,
        ),
    ):
        mock_cache_manager.filter_state_cache.get.return_value = None

        command.run()

        assert mock_cache_manager.filter_state_cache.set.call_count >= 1
        for call in mock_cache_manager.filter_state_cache.set.call_args_list:
            assert call.kwargs.get("timeout") == expected_timeout
