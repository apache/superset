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
"""Tests for ``superset/utils/schema.py``."""

from __future__ import annotations

import pytest
from marshmallow import ValidationError

from superset.utils.schema import (
    is_query_context_metadata_complete,
    validate_query_context_metadata,
)

VALID_QUERY_CONTEXT = (
    '{"datasource": {"id": 1, "type": "table"}, "queries": [{"metrics": ["count"]}]}'
)


def test_validate_query_context_metadata_accepts_complete_payload() -> None:
    """A query_context with both 'datasource' and 'queries' passes."""
    validate_query_context_metadata(VALID_QUERY_CONTEXT)


def test_validate_query_context_metadata_rejects_invalid_json() -> None:
    """Malformed JSON is still rejected (parity with the plain validate_json)."""
    with pytest.raises(ValidationError):
        validate_query_context_metadata("{not valid json")


@pytest.mark.parametrize(
    "payload",
    [
        '{"queries": [{"metrics": ["count"]}]}',  # missing datasource
        '{"datasource": {"id": 1, "type": "table"}}',  # missing queries
        '{"datasource": null, "queries": [{"metrics": ["count"]}]}',  # null datasource
        '{"datasource": {"id": 1, "type": "table"}, "queries": []}',  # empty queries
        "{}",  # neither
    ],
)
def test_validate_query_context_metadata_rejects_missing_fields(
    payload: str,
) -> None:
    """apache/superset#35774: QueryContextFactory.create() requires 'datasource'
    and 'queries' as keyword-only arguments; a saved query_context missing
    either fails every read with a raw TypeError instead of a clear error at
    save time. Both must be present and non-empty."""
    with pytest.raises(ValidationError) as exc_info:
        validate_query_context_metadata(payload)
    assert "query_context" in str(exc_info.value).lower()


@pytest.mark.parametrize(
    "payload",
    ["false", "0", "null", "[]", '"a string"'],
)
def test_validate_query_context_metadata_rejects_non_object_json(
    payload: str,
) -> None:
    """A syntactically valid but non-object JSON value (e.g. a JSON-encoded
    ``false``/``0``/``null``) must not silently bypass the required-fields
    check -- it is falsy as a raw string check would miss it, but it is never
    a valid query_context."""
    with pytest.raises(ValidationError):
        validate_query_context_metadata(payload)


def test_is_query_context_metadata_complete_accepts_dict_with_both_fields() -> None:
    assert is_query_context_metadata_complete(
        {"datasource": {"id": 1, "type": "table"}, "queries": [{}]}
    )


@pytest.mark.parametrize(
    "value",
    [
        None,
        False,
        0,
        [],
        "a string",
        {},
        {"datasource": {"id": 1}},
        {"queries": [{}]},
        {"datasource": {}, "queries": [{}]},
        {"datasource": {"id": 1}, "queries": []},
    ],
)
def test_is_query_context_metadata_complete_rejects_incomplete_values(value):
    assert not is_query_context_metadata_complete(value)
