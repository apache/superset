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

from superset.utils import json

QUERY_URL = "/api/v1/query/"
VALID_DATASOURCE = {"id": 1, "type": "table"}


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
        QUERY_URL,
        data={
            "query_context": json.dumps({"datasource": VALID_DATASOURCE, "queries": []})
        },
    )

    assert response.status_code == 200
    create.assert_called_once_with(datasource=VALID_DATASOURCE, queries=[])
    query_context.raise_for_access.assert_called_once()


@pytest.mark.parametrize(
    "query_context",
    [
        {},
        {"datasource": {"id": 1, "type": "table"}},
        {"queries": []},
        {"datasource": {"id": 1, "type": "table"}, "queries": [], "bogus": 1},
        {"datasource": "not-an-object", "queries": []},
        {"datasource": [1], "queries": []},
        {"datasource": {}, "queries": []},
        {"datasource": {"id": 1}, "queries": []},
        {"datasource": {"type": "table"}, "queries": []},
        {"datasource": {"id": 1, "type": "bogus"}, "queries": []},
        {"datasource": {"id": 1, "type": None}, "queries": []},
        {"datasource": {"id": 1, "type": "table"}, "queries": {"a": 1}},
        {"datasource": {"id": 1, "type": "table"}, "queries": ["not-an-object"]},
    ],
    ids=[
        "empty_object",
        "missing_queries",
        "missing_datasource",
        "unknown_key",
        "datasource_string",
        "datasource_list",
        "datasource_empty",
        "datasource_missing_type",
        "datasource_missing_id",
        "datasource_invalid_type",
        "datasource_null_type",
        "queries_object",
        "queries_non_object_item",
    ],
)
def test_query_returns_400_for_malformed_query_context_shape(
    client: Any,
    full_api_access: None,
    query_context: dict[str, Any],
) -> None:
    """A JSON object that does not match the factory's signature, or whose
    ``datasource``/``queries`` have the wrong type, is a user-fixable input error
    and yields a 400 rather than a raw ``TypeError`` surfacing as a 500.
    """
    response = client.post(QUERY_URL, data={"query_context": json.dumps(query_context)})

    assert response.status_code == 400, response.get_data(as_text=True)
