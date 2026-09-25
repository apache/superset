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
"""``DATA_CACHE_MAX_VALUE_SIZE`` applies to the datasource API's cache writes.

The column-values endpoint (filter dropdown values) and the compatible
metrics/dimensions endpoint write to the data cache directly. An oversized
payload is left uncached (and any older value under its key removed) and still
returned to the caller; a normal payload is cached as usual.
"""

from typing import Any
from unittest.mock import call, MagicMock

import pytest
from flask import current_app
from pytest_mock import MockerFixture

# A cap small enough for the "large" payloads below to exceed it, while the
# "small" payloads stay under it.
MAX_VALUE_SIZE = 1024


@pytest.fixture
def datasource(mocker: MockerFixture) -> MagicMock:
    datasource = MagicMock()
    datasource.uid = "1__table"
    datasource.cache_timeout = None
    datasource.normalize_columns = False
    datasource.changed_on = "2024-01-01"
    mocker.patch(
        "superset.datasource.api.DatasourceDAO.get_datasource",
        return_value=datasource,
    )
    mocker.patch(
        "superset.datasource.api.security_manager.get_rls_cache_key",
        return_value=[],
    )
    return datasource


@pytest.fixture
def data_cache(mocker: MockerFixture) -> MagicMock:
    cache = mocker.patch("superset.datasource.api.cache_manager").data_cache
    cache.get.return_value = None
    return cache


@pytest.fixture
def stats_logger(mocker: MockerFixture) -> MagicMock:
    stats_logger = MagicMock()
    mocker.patch.dict(
        current_app.config,
        {
            "DATA_CACHE_MAX_VALUE_SIZE": MAX_VALUE_SIZE,
            "STATS_LOGGER": stats_logger,
        },
    )
    return stats_logger


def _get_values(client: Any) -> Any:
    return client.get("/api/v1/datasource/table/1/column/name/values/")


def _post_compatible(client: Any) -> Any:
    return client.post(
        "/api/v1/datasource/table/1/compatible",
        json={"selected_metrics": [], "selected_dimensions": []},
    )


def test_column_values_oversized_payload_is_not_cached(
    client: Any,
    full_api_access: None,
    datasource: MagicMock,
    data_cache: MagicMock,
    stats_logger: MagicMock,
    mocker: MockerFixture,
) -> None:
    values = [f"value-{i:05d}" for i in range(500)]
    datasource.values_for_column.return_value = values
    mock_logger = mocker.patch("superset.utils.cache.logger")

    response = _get_values(client)

    assert response.status_code == 200
    assert response.json["result"] == values
    data_cache.set.assert_not_called()
    # An older value under the same key is removed so it is not served later.
    data_cache.delete.assert_called_once()
    assert data_cache.delete.call_args.args[0].startswith("col_values:")
    stats_logger.incr.assert_any_call("skip_cache_value_too_large")
    mock_logger.warning.assert_called_once()


def test_column_values_normal_payload_is_cached(
    client: Any,
    full_api_access: None,
    datasource: MagicMock,
    data_cache: MagicMock,
    stats_logger: MagicMock,
) -> None:
    datasource.values_for_column.return_value = ["a", "b"]

    response = _get_values(client)

    assert response.status_code == 200
    data_cache.set.assert_called_once()
    assert data_cache.set.call_args.args[1] == ["a", "b"]
    data_cache.delete.assert_not_called()
    assert call("skip_cache_value_too_large") not in stats_logger.incr.mock_calls


def test_compatible_oversized_result_is_not_cached(
    client: Any,
    full_api_access: None,
    datasource: MagicMock,
    data_cache: MagicMock,
    stats_logger: MagicMock,
) -> None:
    metrics = [f"metric_{i:05d}" for i in range(500)]
    datasource.get_compatible_metrics.return_value = metrics
    datasource.get_compatible_dimensions.return_value = []

    response = _post_compatible(client)

    assert response.status_code == 200
    assert response.json["result"]["compatible_metrics"] == metrics
    data_cache.set.assert_not_called()
    data_cache.delete.assert_called_once()
    assert data_cache.delete.call_args.args[0].startswith("compatible:")
    stats_logger.incr.assert_any_call("skip_cache_value_too_large")


def test_compatible_normal_result_is_cached(
    client: Any,
    full_api_access: None,
    datasource: MagicMock,
    data_cache: MagicMock,
    stats_logger: MagicMock,
) -> None:
    datasource.get_compatible_metrics.return_value = ["count"]
    datasource.get_compatible_dimensions.return_value = ["country"]

    response = _post_compatible(client)

    assert response.status_code == 200
    data_cache.set.assert_called_once()
    assert data_cache.set.call_args.args[1] == {
        "compatible_metrics": ["count"],
        "compatible_dimensions": ["country"],
    }


@pytest.fixture
def null_data_cache(mocker: MockerFixture) -> MagicMock:
    """A data cache backed by ``NullCache`` (caching disabled)."""
    from flask_caching.backends import NullCache

    cache = mocker.patch("superset.datasource.api.cache_manager").data_cache
    cache.get.return_value = None
    cache.cache = NullCache()
    return cache


def test_column_values_null_cache_skips_serialization(
    client: Any,
    full_api_access: None,
    datasource: MagicMock,
    null_data_cache: MagicMock,
    stats_logger: MagicMock,
    mocker: MockerFixture,
) -> None:
    """With caching disabled nothing is written and the payload is never pickled
    to measure it against ``DATA_CACHE_MAX_VALUE_SIZE``."""
    datasource.values_for_column.return_value = ["a", "b"]
    mock_dumps = mocker.patch("superset.utils.cache.pickle.dumps")

    response = _get_values(client)

    assert response.status_code == 200
    assert response.json["result"] == ["a", "b"]
    mock_dumps.assert_not_called()
    null_data_cache.set.assert_not_called()
    null_data_cache.delete.assert_not_called()


def test_compatible_null_cache_skips_serialization(
    client: Any,
    full_api_access: None,
    datasource: MagicMock,
    null_data_cache: MagicMock,
    stats_logger: MagicMock,
    mocker: MockerFixture,
) -> None:
    """With caching disabled nothing is written and the result is never pickled."""
    datasource.get_compatible_metrics.return_value = ["count"]
    datasource.get_compatible_dimensions.return_value = ["country"]
    mock_dumps = mocker.patch("superset.utils.cache.pickle.dumps")

    response = _post_compatible(client)

    assert response.status_code == 200
    mock_dumps.assert_not_called()
    null_data_cache.set.assert_not_called()


def test_column_values_oversized_delete_failure_still_returns_values(
    client: Any,
    full_api_access: None,
    datasource: MagicMock,
    data_cache: MagicMock,
    stats_logger: MagicMock,
) -> None:
    """A failure deleting the older cached value does not break the request."""
    values = [f"value-{i:05d}" for i in range(500)]
    datasource.values_for_column.return_value = values
    data_cache.delete.side_effect = RuntimeError("backend down")

    response = _get_values(client)

    assert response.status_code == 200
    assert response.json["result"] == values
    data_cache.set.assert_not_called()
