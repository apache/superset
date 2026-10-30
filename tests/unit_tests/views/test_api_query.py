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
"""Tests for input validation on the legacy ``POST /api/v1/query/`` endpoint.

A malformed ``query_context`` form value is a user-fixable input error and must
surface as ``400``, not fall through ``handle_api_exception`` as a ``500``.
"""

from __future__ import annotations

from typing import Any

import pytest
from pytest_mock import MockerFixture

QUERY_URL = "/api/v1/query/"


@pytest.mark.parametrize(
    "body",
    ["{not json", "[1, 2]", "5", '"a string"', "null"],
    ids=["malformed_json", "list", "number", "string", "null"],
)
def test_query_returns_400_for_invalid_query_context(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
    body: str,
) -> None:
    """Unparseable or non-object ``query_context`` values yield a 400 with a
    clear message, and never reach the query context factory.
    """
    create = mocker.patch(
        "superset.common.query_context_factory.QueryContextFactory.create"
    )

    response = client.post(QUERY_URL, data={"query_context": body})

    assert response.status_code == 400
    assert "query_context" in response.get_data(as_text=True)
    create.assert_not_called()


def test_query_valid_query_context_reaches_factory(
    client: Any,
    full_api_access: None,
    mocker: MockerFixture,
) -> None:
    """A valid JSON object is parsed and forwarded to the factory unchanged."""
    query_context = mocker.MagicMock()
    query_context.get_payload.return_value = {"queries": [{"data": []}]}
    create = mocker.patch(
        "superset.common.query_context_factory.QueryContextFactory.create",
        return_value=query_context,
    )

    response = client.post(
        QUERY_URL, data={"query_context": '{"datasource": {"id": 1}, "queries": []}'}
    )

    assert response.status_code == 200
    create.assert_called_once_with(datasource={"id": 1}, queries=[])
    query_context.raise_for_access.assert_called_once()
