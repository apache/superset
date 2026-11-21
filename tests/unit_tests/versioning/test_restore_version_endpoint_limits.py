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
"""``restore_version_endpoint`` answers a time range limits refusal of a
version restore like the entity's own writes do, never with a 500."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock
from uuid import uuid4

from marshmallow import ValidationError

from superset.commands.exceptions import TimeRangeLimitsRestoreError
from superset.time_range_limits.policy import unavailable_error
from superset.versioning.api_helpers import restore_version_endpoint


class _NotFoundError(Exception):
    pass


class _ForbiddenError(Exception):
    pass


class _FailedError(Exception):
    pass


def _endpoint(error: Exception) -> tuple[MagicMock, Any]:
    command_cls = MagicMock(
        not_found_exc=_NotFoundError,
        forbidden_exc=_ForbiddenError,
        failed_exc=_FailedError,
    )
    command_cls.return_value.run.side_effect = error
    api = MagicMock()
    response = restore_version_endpoint(
        api, MagicMock(__name__="Dashboard"), command_cls, str(uuid4()), str(uuid4())
    )
    return api, response


def test_looser_restored_limits_answer_422_keyed_by_field(
    app_context: None,
) -> None:
    messages = {
        "json_metadata.time_range_limits.max_span.quantity": [
            "Dashboard maximum span must be 12 weeks or less."
        ]
    }
    api, response = _endpoint(
        TimeRangeLimitsRestoreError(exceptions=[ValidationError(messages)])
    )

    api.response_422.assert_called_once_with(message=messages)
    assert response is api.response_422.return_value


def test_unverifiable_limits_answer_503(app_context: None) -> None:
    from superset.time_range_limits.policy import TimeRangeLimitsUnavailableError

    error = TimeRangeLimitsUnavailableError(source="global", field="max_span.quantity")
    api, response = _endpoint(error)

    assert response.status_code == 503
    assert response.get_json()["errors"][0]["error_type"] == (
        unavailable_error(source="global").error_type
    )
    api.response_422.assert_not_called()
