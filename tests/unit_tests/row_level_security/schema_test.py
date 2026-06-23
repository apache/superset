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
"""Tests for row-level security marshmallow schemas."""

from typing import Any

import pytest
from marshmallow import ValidationError

from superset.row_level_security.schemas import RLSPostSchema, RLSPutSchema


def _post_payload(**overrides: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "name": "rule",
        "filter_type": "Regular",
        "tables": [1],
        "roles": [1],
        "clause": "client_id = 9",
    }
    payload.update(overrides)
    return payload


@pytest.mark.parametrize("clause", ["", "   ", "\t\n"])
def test_rls_post_schema_rejects_blank_clause(clause: str) -> None:
    """An empty or whitespace-only clause is rejected on create."""
    with pytest.raises(ValidationError) as exc:
        RLSPostSchema().load(_post_payload(clause=clause))
    assert "clause" in exc.value.messages


def test_rls_post_schema_accepts_non_blank_clause() -> None:
    """A non-blank clause is accepted on create."""
    result = RLSPostSchema().load(_post_payload(clause="1 = 0"))
    assert result["clause"] == "1 = 0"


@pytest.mark.parametrize("clause", ["", "   ", "\t\n"])
def test_rls_put_schema_rejects_blank_clause(clause: str) -> None:
    """An empty or whitespace-only clause is rejected on update."""
    with pytest.raises(ValidationError) as exc:
        RLSPutSchema().load({"clause": clause})
    assert "clause" in exc.value.messages


def test_rls_put_schema_omitted_clause_is_allowed() -> None:
    """A partial update that omits clause is still valid."""
    result = RLSPutSchema().load({"name": "new name"})
    assert "clause" not in result
