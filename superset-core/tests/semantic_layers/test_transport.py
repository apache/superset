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

"""Provider transport value contracts stay independent of an HTTP library."""

import math
from dataclasses import FrozenInstanceError

import pytest


def test_response_headers_are_case_insensitive_and_owned() -> None:
    from superset_core.semantic_layers.transport import ProviderResponse

    headers: dict[str, str] = {"Content-Type": "application/json"}
    response: ProviderResponse = ProviderResponse(
        200, headers, b'{"ok":true}', "https://example.test/"
    )
    headers["Content-Type"] = "changed"
    assert response.headers["content-type"] == "application/json"
    assert response.headers["CONTENT-TYPE"] == "application/json"
    assert response.json() == {"ok": True}
    with pytest.raises(FrozenInstanceError):
        response.body = b"changed"  # type: ignore[misc]
    with pytest.raises(TypeError):
        response.headers["x"] = "y"  # type: ignore[index]


@pytest.mark.parametrize(
    "deadline,cap",
    [
        (math.inf, 1),
        (math.nan, 1),
        (True, 1),
        (1.0, 0),
        (1.0, -1),
        (1.0, True),
        (1.0, 1.5),
    ],
)
def test_budget_rejects_unbounded_or_invalid_values(deadline: float, cap: int) -> None:
    from superset_core.semantic_layers.transport import RequestBudget

    with pytest.raises(ValueError, match="deadline|max_bytes"):
        RequestBudget(deadline, cap)


def test_budget_can_represent_an_expired_deadline() -> None:
    from superset_core.semantic_layers.transport import RequestBudget

    assert RequestBudget(-1.0, 1).deadline == -1.0


def test_errors_expose_only_categories_and_status() -> None:
    from superset_core.semantic_layers.transport import (
        ProviderRequestError,
        ProviderRequestFailure,
    )

    failure: ProviderRequestFailure
    for failure in ProviderRequestFailure:
        error: ProviderRequestError = ProviderRequestError(
            failure,
            status=503 if failure == ProviderRequestFailure.HTTP_STATUS else None,
        )
        assert error.failure == failure
        assert "https://" not in str(error)
    assert "503" in str(
        ProviderRequestError(ProviderRequestFailure.HTTP_STATUS, status=503)
    )


@pytest.mark.parametrize(
    "method,args",
    [
        ("from_configuration", ({},)),
        ("get_configuration_schema", ()),
        ("get_runtime_schema", ({},)),
    ],
)
def test_sdk_entrypoints_require_explicit_transport(
    method: str, args: tuple[object, ...]
) -> None:
    from typing import Any

    from superset_core.semantic_layers.layer import SemanticLayer

    kwargs: dict[str, Any] = {}
    if method == "from_configuration":
        kwargs = {"cache_token": "generation", "context": None}
    with pytest.raises(TypeError, match="transport"):
        getattr(SemanticLayer, method)(*args, **kwargs)


@pytest.mark.parametrize(
    "failure_name",
    [
        "INVALID_URL",
        "REFUSED",
        "UNREACHABLE",
        "TIMEOUT",
        "TOO_LARGE",
        "UNSUPPORTED_ENCODING",
        "HTTP_STATUS",
    ],
)
def test_transport_failure_round_trip_preserves_category_and_status(
    failure_name: str,
) -> None:
    import pickle

    from superset_core.semantic_layers.transport import (
        ProviderRequestError,
        ProviderRequestFailure,
    )

    failure: ProviderRequestFailure = ProviderRequestFailure[failure_name]
    error: ProviderRequestError = ProviderRequestError(
        failure, status=503 if failure == ProviderRequestFailure.HTTP_STATUS else None
    )
    restored: ProviderRequestError = pickle.loads(pickle.dumps(error))  # noqa: S301 -- locally constructed exception only
    assert restored.failure is failure
    assert restored.status == error.status
    assert str(restored) == str(error)
