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

import copy
import pickle
from collections.abc import Callable
from typing import cast

import pytest
from superset_core.semantic_layers.errors import (
    SemanticResultCompletenessError,
    SemanticResultCompletenessReason,
)


@pytest.mark.parametrize("reason", ["incomplete", "unverified"])
def test_incomplete_error_carries_closed_reason(
    reason: SemanticResultCompletenessReason,
) -> None:
    error: SemanticResultCompletenessError = SemanticResultCompletenessError(reason)
    assert error.reason == reason
    assert not isinstance(error, (ValueError, LookupError))


def test_incomplete_error_rejects_unknown_reason() -> None:
    reason: SemanticResultCompletenessReason = cast(
        SemanticResultCompletenessReason, "raw upstream diagnostics"
    )
    with pytest.raises(ValueError, match="Unknown completeness reason"):
        SemanticResultCompletenessError(reason)


def _pickle_roundtrip(
    error: SemanticResultCompletenessError,
) -> SemanticResultCompletenessError:
    return pickle.loads(pickle.dumps(error))  # noqa: S301


@pytest.mark.parametrize(
    "roundtrip", [_pickle_roundtrip, copy.copy], ids=["pickle", "copy"]
)
def test_incomplete_error_survives_serialization(
    roundtrip: Callable[
        [SemanticResultCompletenessError], SemanticResultCompletenessError
    ],
) -> None:
    error: SemanticResultCompletenessError = SemanticResultCompletenessError(
        "unverified"
    )
    restored: SemanticResultCompletenessError = roundtrip(error)
    assert type(restored) is SemanticResultCompletenessError
    assert restored.reason == "unverified"
