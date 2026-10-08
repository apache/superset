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
"""Endpoint-level tests: filter-value suggestions for semantic views.

The datasource values endpoint duck-types its datasource; these tests pin the
wiring for ``DatasourceType.SEMANTIC_VIEW`` end to end (sc-119006): 200 with
values, search pass-through, the 400 naming an unknown column, and the cache
header contract.
"""

from typing import Any, cast
from unittest.mock import MagicMock

import pyarrow as pa
import pytest
from pytest_mock import MockerFixture
from superset_core.semantic_layers.types import (
    Dimension,
    SemanticRequest,
    SemanticResult,
)

from superset.semantic_layers.models import SemanticView


@pytest.fixture
def semantic_view_datasource(mocker: MockerFixture) -> SemanticView:
    implementation: MagicMock = MagicMock(selection_identity_version=None)
    implementation.uid.return_value = "semantic_view_uid_123"
    implementation.get_dimensions.return_value = [
        Dimension(id="orders.category", name="category", type=pa.utf8()),
    ]
    implementation.get_metrics.return_value = []
    implementation.get_values.return_value = SemanticResult(
        requests=[SemanticRequest(type="SQL", definition="values query")],
        results=pa.table({"category": pa.array(["Books", "Clothing"])}),
    )
    from superset_core.semantic_layers.layer import SemanticLayer as ProviderLayer

    from superset.semantic_layers.models import SemanticLayer

    mocker.patch.dict(
        "superset.semantic_layers.models.registry", {"fixture": ProviderLayer}
    )
    view: SemanticView = SemanticView(semantic_layer=SemanticLayer(type="fixture"))
    view.id = 1
    view.cache_timeout = None
    mocker.patch.object(
        SemanticView,
        "implementation",
        new_callable=lambda: property(lambda s: implementation),
    )
    mocker.patch.object(SemanticView, "raise_for_access")
    mocker.patch(
        "superset.datasource.api.DatasourceDAO.get_datasource",
        return_value=view,
    )
    return view


def _get(client: Any, path: str) -> Any:
    return client.get(f"/api/v1/datasource/semantic_view/1/column/{path}")


def test_semantic_view_values_endpoint_returns_values(
    client: Any,
    full_api_access: None,
    semantic_view_datasource: SemanticView,
    mocker: MockerFixture,
) -> None:
    cache = mocker.patch("superset.datasource.api.cache_manager").data_cache
    cache.get.return_value = None

    response = _get(client, "category/values/")

    assert response.status_code == 200
    assert response.json["result"] == ["Books", "Clothing"]
    assert response.headers["X-Cache-Status"] == "MISS"
    cache.set.assert_called_once()

    cache.get.return_value = ["Books", "Clothing"]
    cached = _get(client, "category/values/")
    assert cached.status_code == 200
    assert cached.json["result"] == ["Books", "Clothing"]
    assert cached.headers["X-Cache-Status"] == "HIT"


def test_semantic_view_values_endpoint_passes_search_to_the_provider(
    client: Any,
    full_api_access: None,
    semantic_view_datasource: SemanticView,
    mocker: MockerFixture,
) -> None:
    mocker.patch(
        "superset.datasource.api.cache_manager"
    ).data_cache.get.return_value = None

    response = _get(client, "category/values/?q=oo")

    assert response.status_code == 200
    implementation = cast(MagicMock, semantic_view_datasource.implementation)
    _, filters = implementation.get_values.call_args.args
    (narrowing,) = filters
    assert narrowing.value == "%oo%"


def test_semantic_view_values_endpoint_unknown_column_is_a_400(
    client: Any,
    full_api_access: None,
    semantic_view_datasource: SemanticView,
    mocker: MockerFixture,
) -> None:
    mocker.patch(
        "superset.datasource.api.cache_manager"
    ).data_cache.get.return_value = None

    response = _get(client, "no_such_column/values/")

    assert response.status_code == 400
    assert "no_such_column" in response.json["message"]


def test_completeness_failure_returns_safe_error_without_cache_write(
    client: Any,
    full_api_access: None,
    semantic_view_datasource: SemanticView,
    mocker: MockerFixture,
) -> None:
    from superset.exceptions import SemanticResultCompletenessError

    cache: MagicMock = mocker.patch("superset.datasource.api.cache_manager").data_cache
    cache.get.return_value = None
    mocker.patch.object(
        SemanticView,
        "values_for_column",
        side_effect=SemanticResultCompletenessError("unverified"),
    )
    response: Any = _get(client, "category/values/?q=needle")
    assert response.status_code == 400
    assert "verify" in str(response.get_json()).lower()
    cache.set.assert_not_called()


@pytest.mark.parametrize("is_guest", [False, True])
def test_validation_error_message_is_sanitized_for_guests(
    client: Any,
    full_api_access: None,
    semantic_view_datasource: SemanticView,
    mocker: MockerFixture,
    is_guest: bool,
) -> None:
    """Guests get generic text; other users keep the specific 400 message."""
    from superset.exceptions import QueryObjectValidationError
    from superset.utils.error_sanitization import GENERIC_ERROR_MESSAGE

    mocker.patch(
        "superset.security.SupersetSecurityManager.is_guest_user",
        return_value=is_guest,
    )
    cache: MagicMock = mocker.patch("superset.datasource.api.cache_manager").data_cache
    cache.get.return_value = None
    detail: str = "Fetch values predicate failed SQL validation: secret_schema.t"
    mocker.patch.object(
        SemanticView,
        "values_for_column",
        side_effect=QueryObjectValidationError(detail),
    )

    response: Any = _get(client, "category/values/")

    assert response.status_code == 400
    expected: str = str(GENERIC_ERROR_MESSAGE) if is_guest else detail
    assert response.json["message"] == expected
    cache.set.assert_not_called()


@pytest.mark.parametrize("is_guest", [False, True])
def test_completeness_error_message_follows_guest_sanitization(
    client: Any,
    full_api_access: None,
    semantic_view_datasource: SemanticView,
    mocker: MockerFixture,
    is_guest: bool,
) -> None:
    """The completeness 400 survives, with guidance redacted only for guests."""
    from superset.exceptions import SemanticResultCompletenessError
    from superset.utils.error_sanitization import GENERIC_ERROR_MESSAGE

    mocker.patch(
        "superset.security.SupersetSecurityManager.is_guest_user",
        return_value=is_guest,
    )
    mocker.patch(
        "superset.datasource.api.cache_manager"
    ).data_cache.get.return_value = None
    error: SemanticResultCompletenessError = SemanticResultCompletenessError(
        "incomplete"
    )
    mocker.patch.object(SemanticView, "values_for_column", side_effect=error)

    response: Any = _get(client, "category/values/")

    assert response.status_code == 400
    expected: str = str(GENERIC_ERROR_MESSAGE) if is_guest else str(error)
    assert response.json["message"] == expected


def test_values_cache_excludes_legacy_generation(
    client: Any,
    full_api_access: None,
    semantic_view_datasource: SemanticView,
    mocker: MockerFixture,
) -> None:
    from unittest.mock import PropertyMock

    from superset.semantic_layers.models import SemanticLayer

    semantic_view_datasource.semantic_layer = SemanticLayer(type="fixture")
    version: PropertyMock = mocker.patch.object(
        SemanticView,
        "result_cache_version",
        new_callable=PropertyMock,
        return_value=None,
    )
    cache: MagicMock = mocker.patch("superset.datasource.api.cache_manager").data_cache
    stored: dict[str, Any] = {}
    cache.get.side_effect = stored.get
    first: Any = _get(client, "category/values/")
    assert first.status_code == 200
    legacy_key: str = cache.get.call_args.args[0]
    stored[legacy_key] = ["legacy partial value"]
    version.return_value = "guarded-v1"
    second: Any = _get(client, "category/values/")
    assert second.status_code == 200
    assert cache.get.call_args.args[0] != legacy_key
    assert second.get_json()["result"] != stored[legacy_key]


@pytest.mark.parametrize("warm", [False, True])
def test_denied_values_request_never_reads_cache_or_calls_provider(
    client: Any,
    full_api_access: None,
    semantic_view_datasource: SemanticView,
    mocker: MockerFixture,
    warm: bool,
) -> None:
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetSecurityException

    cache: MagicMock = mocker.patch("superset.datasource.api.cache_manager").data_cache
    cache.get.return_value = ["old result"] if warm else None
    mocker.patch.object(
        SemanticView,
        "raise_for_access",
        side_effect=SupersetSecurityException(
            SupersetError(
                error_type=SupersetErrorType.DATASOURCE_SECURITY_ACCESS_ERROR,
                message="Denied fixture",
                level=ErrorLevel.ERROR,
            )
        ),
    )
    implementation: MagicMock = cast(MagicMock, semantic_view_datasource.implementation)
    response: Any = _get(client, "category/values/")
    assert response.status_code == 403
    cache.get.assert_not_called()
    implementation.get_values.assert_not_called()
    implementation.uid.assert_not_called()


def test_values_cache_keeps_rls_isolation_and_force_refresh(
    client: Any,
    full_api_access: None,
    semantic_view_datasource: SemanticView,
    mocker: MockerFixture,
) -> None:
    from unittest.mock import PropertyMock

    mocker.patch.object(
        SemanticView,
        "result_cache_version",
        new_callable=PropertyMock,
        return_value="guarded-v1",
    )
    scope: MagicMock = mocker.patch(
        "superset.datasource.api.security_manager.get_rls_cache_key",
        return_value=["scope-a"],
    )
    cache: MagicMock = mocker.patch("superset.datasource.api.cache_manager").data_cache
    stored: dict[str, Any] = {}
    cache.get.side_effect = stored.get
    cache.set.side_effect = lambda key, value, **kwargs: stored.__setitem__(key, value)
    first: Any = _get(client, "category/values/")
    assert first.status_code == 200
    assert first.headers["X-Cache-Status"] == "MISS"
    key_a: str = cache.get.call_args.args[0]
    assert _get(client, "category/values/").headers["X-Cache-Status"] == "HIT"
    scope.return_value = ["scope-b"]
    assert _get(client, "category/values/").headers["X-Cache-Status"] == "MISS"
    assert cache.get.call_args.args[0] != key_a
    assert (
        _get(client, "category/values/?force=true").headers["X-Cache-Status"] == "MISS"
    )


def test_unregistered_provider_values_return_safe_error_before_cache_lookup(
    client: Any,
    full_api_access: None,
    semantic_view_datasource: SemanticView,
    mocker: MockerFixture,
) -> None:
    """A missing producer must not turn cache-key construction into a 500."""
    mocker.patch.dict("superset.semantic_layers.models.registry", {}, clear=True)
    cache: MagicMock = mocker.patch("superset.datasource.api.cache_manager").data_cache
    response: Any = _get(client, "category/values/")
    assert response.status_code == 400
    assert "unavailable" in str(response.get_json())
    cache.get.assert_not_called()
    implementation: MagicMock = cast(MagicMock, semantic_view_datasource.implementation)
    implementation.uid.assert_not_called()
    implementation.get_values.assert_not_called()


@pytest.mark.parametrize("provider_type", ["sql", "cube", "snowflake", "metricflow"])
def test_default_provider_value_cache_key_matches_legacy_bytes(
    semantic_view_datasource: SemanticView,
    mocker: MockerFixture,
    provider_type: str,
) -> None:
    """An SDK-default provider adds no field to the pre-guard cache identity."""
    import hashlib

    from superset_core.semantic_layers.layer import SemanticLayer as ProviderLayer

    from superset.datasource.api import _column_values_cache_key
    from superset.utils import json

    datasource: Any = semantic_view_datasource
    if provider_type == "sql":
        datasource = MagicMock(uid="semantic_view_uid_123", changed_on=None)
    else:
        datasource.semantic_layer.type = provider_type
        mocker.patch.dict(
            "superset.semantic_layers.models.registry", {provider_type: ProviderLayer}
        )
    mocker.patch(
        "superset.datasource.api.security_manager.get_rls_cache_key",
        return_value=["scope-a"],
    )
    query: dict[str, Any] = {
        "col": "category",
        "limit": 500,
        "denorm": False,
        "elements": False,
        "q": None,
    }
    legacy: dict[str, Any] = {
        **query,
        "uid": "semantic_view_uid_123",
        "rls": ["scope-a"],
        "changed_on": "None",
    }
    expected: str = (
        "col_values:"
        + hashlib.sha256(json.dumps(legacy, sort_keys=True).encode()).hexdigest()
    )
    assert _column_values_cache_key(datasource, query) == expected
    assert "semantic_result_version" not in query


def test_versioned_suggestions_are_unavailable_before_cache(
    client: Any,
    full_api_access: None,
    semantic_view_datasource: SemanticView,
    mocker: MockerFixture,
) -> None:
    implementation: MagicMock = cast(MagicMock, semantic_view_datasource.implementation)
    implementation.selection_identity_version = "cube-member-id-v1"
    cache: MagicMock = mocker.patch("superset.datasource.api.cache_manager").data_cache
    response: Any = _get(client, "category/values/")
    assert response.status_code == 200
    assert response.json == {
        "result": [],
        "suggestions_status": "unavailable_versioned_view",
    }
    cache.get.assert_not_called()
    implementation.get_values.assert_not_called()
