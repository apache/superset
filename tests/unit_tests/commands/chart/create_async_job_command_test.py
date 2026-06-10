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
from unittest.mock import MagicMock, patch

import pytest

from superset.commands.chart.data.create_async_job_command import (
    CreateAsyncChartDataJobCommand,
)


def test_run_without_validate_raises_clear_error():
    """run() must raise a clear error when validate() was not called first."""
    command = CreateAsyncChartDataJobCommand()

    with pytest.raises(RuntimeError, match="called before validate"):
        command.run(form_data={}, user_id=1)


def test_run_after_validate_submits_job():
    """run() submits the job using the channel id captured during validate()."""
    command = CreateAsyncChartDataJobCommand()

    with patch(
        "superset.commands.chart.data.create_async_job_command.async_query_manager",
        new=MagicMock(),
    ) as mock_manager:
        mock_manager.parse_channel_id_from_request.return_value = "channel-123"
        mock_manager.submit_chart_data_job.return_value = {"job_id": "abc"}

        command.validate(request=MagicMock())
        result = command.run(form_data={"k": "v"}, user_id=42)

        mock_manager.submit_chart_data_job.assert_called_once_with(
            "channel-123", {"k": "v"}, 42
        )
        assert result == {"job_id": "abc"}
