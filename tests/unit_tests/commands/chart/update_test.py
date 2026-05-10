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

from superset.commands.chart.exceptions import ChartForbiddenError
from superset.exceptions import SupersetSecurityException


@patch("superset.commands.chart.update.ChartDAO.find_by_id")
@patch("superset.commands.chart.update.security_manager")
def test_update_chart_ownership_enforced_for_query_context_update(
    mock_sm: MagicMock,
    mock_find_by_id: MagicMock,
) -> None:
    """Non-owners must not be able to update a chart via query_context payload."""
    from superset.commands.chart.update import UpdateChartCommand
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType

    mock_find_by_id.return_value = MagicMock(id=1, tags=[], dashboards=[])
    exc = SupersetSecurityException(
        SupersetError(
            error_type=SupersetErrorType.MISSING_OWNERSHIP_ERROR,
            message="User does not own this chart",
            level=ErrorLevel.ERROR,
        )
    )
    mock_sm.raise_for_ownership = MagicMock(side_effect=exc)

    command = UpdateChartCommand(
        1, {"query_context": "{}", "query_context_generation": True}
    )

    with pytest.raises(ChartForbiddenError):
        command.validate()
