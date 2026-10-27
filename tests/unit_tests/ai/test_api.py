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
"""API response contracts for AI commands."""

import pytest
from flask.testing import FlaskClient
from pytest_mock import MockerFixture

from superset.commands.ai.exceptions import (
    AIChatFeedbackInvalidError,
    AIChatMessageNotFoundError,
)


@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"AI_ASSISTANT": True}}], indirect=True
)
@pytest.mark.usefixtures("full_api_access")
@pytest.mark.parametrize(
    "command_error,status_code",
    [
        (AIChatFeedbackInvalidError("Only assistant messages can be rated."), 422),
        (AIChatMessageNotFoundError(), 404),
        (None, 200),
    ],
    ids=["invalid-target", "missing-or-foreign-target", "accepted"],
)
def test_feedback_command_response(
    client: FlaskClient,
    mocker: MockerFixture,
    command_error: Exception | None,
    status_code: int,
) -> None:
    """Validation errors remain 422; hidden targets remain 404, not server errors."""
    mocker.patch("superset.ai.api.AIRestApi._reject_if_unconfigured", return_value=None)
    mocker.patch("superset.ai.api.AIRestApi._user_id", return_value=1)
    command = mocker.patch("superset.commands.ai.SubmitAIChatFeedbackCommand")
    command.return_value.run.side_effect = command_error

    response = client.post(
        "/api/v1/ai/feedback", json={"message_uuid": "test-message", "liked": True}
    )

    assert response.status_code == status_code
    command.assert_called_once_with("test-message", 1, liked=True, comment=None)
