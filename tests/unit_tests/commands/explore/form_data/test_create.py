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

from superset.commands.explore.form_data.create import CreateFormDataCommand
from superset.commands.explore.form_data.parameters import CommandParameters
from superset.utils.core import DatasourceType


def test_get_session_id_can_be_overridden():
    """Test that _get_session_id can be overridden in subclasses for custom behavior."""

    class CustomCreateFormDataCommand(CreateFormDataCommand):
        def _get_session_id(self) -> str:
            """Override to return custom session ID."""
            return "custom-session-id"

    cmd_params = CommandParameters(
        datasource_id=1,
        datasource_type=DatasourceType.TABLE,
        chart_id=1,
        tab_id=1,
        form_data='{"test": "data"}',
    )
    command = CustomCreateFormDataCommand(cmd_params)

    # Should return custom session ID without accessing Flask session
    session_id = command._get_session_id()
    assert session_id == "custom-session-id"


def test_run_uses_get_session_id():
    """Test that run() method uses _get_session_id for cache key generation."""
    cmd_params = CommandParameters(
        datasource_id=1,
        datasource_type=DatasourceType.TABLE,
        chart_id=1,
        tab_id=1,
        form_data='{"test": "data"}',
    )
    command = CreateFormDataCommand(cmd_params)

    with (
        patch("superset.commands.explore.form_data.create.check_access"),
        patch("superset.commands.explore.form_data.create.cache_key") as mock_cache_key,
        patch(
            "superset.commands.explore.form_data.create.cache_manager"
        ) as mock_cache_manager,
        patch(
            "superset.commands.explore.form_data.create.random_key"
        ) as mock_random_key,
        patch(
            "superset.commands.explore.form_data.create.get_user_id"
        ) as mock_get_user_id,
        patch.object(
            command, "_get_session_id", return_value="test-session-id"
        ) as mock_get_session_id,
    ):
        mock_cache_manager.explore_form_data_cache.get.return_value = None
        mock_random_key.return_value = "random-key"
        mock_get_user_id.return_value = 1

        command.run()

        # Verify that _get_session_id was called
        mock_get_session_id.assert_called_once()

        # Verify that cache_key was called with the session ID from _get_session_id
        mock_cache_key.assert_called_once_with(
            "test-session-id", 1, 1, 1, DatasourceType.TABLE
        )
