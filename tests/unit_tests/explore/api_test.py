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

from typing import Any
from unittest.mock import patch

from superset.commands.temporary_cache.exceptions import (
    TemporaryCacheAccessDeniedError,
)


def test_explore_datasource_not_found(client: Any, full_api_access: None) -> None:
    # validating the payload for a dataset that doesn't exist
    # user should be expecting missing_datasource view
    response = client.get(
        "/api/v1/explore/?datasource_id=50000&datasource_type=table",
    )
    response.json["result"]["dataset"]["name"] == "[Missing Dataset]"  # noqa: B015
    assert response.status_code == 200


def test_temporary_cache_access_denied_echoes_exception_message(
    client: Any, full_api_access: None
) -> None:
    """The cached form data denial must report its own translatable message.

    ``check_access`` raises ``TemporaryCacheAccessDeniedError`` for chart
    denials as well as dataset denials, so the response cannot claim the
    datasource was the reason, and a hardcoded string would drop the
    ``lazy_gettext`` the exception carries.
    """
    with patch(
        "superset.explore.api.GetExploreCommand.run",
        side_effect=TemporaryCacheAccessDeniedError(),
    ):
        response = client.get("/api/v1/explore/?form_data_key=abc")

    assert response.status_code == 403
    assert response.json["message"] == str(TemporaryCacheAccessDeniedError.message)
    assert "datasource" not in response.json["message"].lower()


def test_temporary_cache_access_denied_omits_inert_access_flag(
    client: Any, full_api_access: None
) -> None:
    """No ``is_access_denial`` without the ``error_type``/``level`` to use it.

    ``ErrorMessageWithStackTrace`` dispatches on ``error_type``; a bare
    ``extra`` flag cannot reach ``DatasourceSecurityAccessErrorMessage`` and
    would only add a payload the frontend never reads.
    """
    with patch(
        "superset.explore.api.GetExploreCommand.run",
        side_effect=TemporaryCacheAccessDeniedError(),
    ):
        response = client.get("/api/v1/explore/?form_data_key=abc")

    assert "extra" not in response.json
