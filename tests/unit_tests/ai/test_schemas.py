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
"""Bound the complete client context before it can be stored or queued."""

from typing import Any

import pytest
from marshmallow import Schema, ValidationError

from superset.ai.schemas import (
    CONTENT_MAX_LENGTH,
    MessagePostSchema,
    SuggestedPromptsPostSchema,
)


@pytest.mark.parametrize(
    "schema,base",
    [
        (MessagePostSchema(), {"content": "question"}),
        (SuggestedPromptsPostSchema(), {}),
    ],
)
@pytest.mark.parametrize(
    "value", ["x" * CONTENT_MAX_LENGTH, "я" * 20_000], ids=["ascii", "unicode"]
)
def test_context_limits_include_unrendered_fields(
    schema: Schema, base: dict[str, Any], value: str
) -> None:
    """Unknown fields cannot bypass the serialized context limit."""
    with pytest.raises(ValidationError, match="page_context"):
        schema.load({**base, "page_context": {"unused": value}})


@pytest.mark.parametrize("container", [dict, list])
def test_context_rejects_excessive_nesting(container: type) -> None:
    """Both object and array nesting are bounded before persistence."""
    nested: Any = "value"
    for _ in range(21):
        nested = {"child": nested} if container is dict else [nested]
    with pytest.raises(ValidationError, match="page_context"):
        MessagePostSchema().load({"content": "question", "page_context": {"x": nested}})


def test_context_accepts_the_size_boundary_and_optional_empty_values() -> None:
    """Legitimate context is preserved instead of being silently truncated."""
    context = {"label": "x" * (CONTENT_MAX_LENGTH - len('{"label":""}'))}
    schema = MessagePostSchema()
    assert (
        schema.load({"content": "question", "page_context": context})["page_context"]
        == context
    )
    value: dict[str, Any] | None
    for value in (None, {}):
        assert (
            schema.load({"content": "question", "page_context": value})["page_context"]
            == value
        )


def test_context_rejects_nonfinite_json_numbers() -> None:
    """A non-JSON float produces a validation error, not a persistence failure."""
    with pytest.raises(ValidationError, match="page_context"):
        MessagePostSchema().load(
            {"content": "question", "page_context": {"value": float("nan")}}
        )
