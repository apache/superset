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
"""
The partition mapping preview endpoint.

This route fires a real warehouse query from a text input in the dataset
editor, so the order of its guards is the point: parse and denylist checks run
*before* anything reaches the engine, which is what keeps a half-typed
expression from costing a query at all.
"""

from __future__ import annotations

from typing import Any
from unittest.mock import patch

import pytest
from flask import Flask
from sqlalchemy.orm.session import Session

from superset import db

PROBE = "superset.connectors.sqla.partition_mapping.evaluate_transform"


@pytest.fixture(autouse=True)
def enable_partition_filter_mapping(app: Flask) -> Any:
    app.config["DEFAULT_FEATURE_FLAGS"]["PARTITION_FILTER_MAPPING"] = True
    yield
    del app.config["DEFAULT_FEATURE_FLAGS"]["PARTITION_FILTER_MAPPING"]


@pytest.fixture(autouse=True)
def real_cache(app: Flask) -> Any:
    """
    The test app runs a null cache, which would make the rate limiter a no-op.
    """
    from flask_caching import Cache

    from superset.extensions import cache_manager

    cache = Cache(config={"CACHE_TYPE": "SimpleCache", "CACHE_DEFAULT_TIMEOUT": 300})
    cache.init_app(app)
    original = cache_manager._cache  # noqa: SLF001
    cache_manager._cache = cache  # noqa: SLF001
    yield
    cache_manager._cache = original  # noqa: SLF001


@pytest.fixture(autouse=True)
def allow_editorship(mocker: Any) -> Any:
    """
    The route gates on per-object editorship on top of ``@protect()``. The unit
    test app has no real roles, so grant it here rather than in every test.
    """
    mocker.patch(
        "superset.datasets.api.security_manager.raise_for_editorship",
    )


@pytest.fixture
def dataset(session: Session) -> Any:
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.models.core import Database

    SqlaTable.metadata.create_all(db.session.get_bind())
    database = Database(database_name="my_db", sqlalchemy_uri="sqlite://")
    table = SqlaTable(
        table_name="web_events",
        database=database,
        main_dttm_col="event_time",
        columns=[
            TableColumn(column_name="event_time", is_dttm=True, type="TIMESTAMP"),
            TableColumn(column_name="dt_epoch", type="BIGINT"),
        ],
    )
    table.partition_column = "dt_epoch"
    db.session.add(table)
    db.session.flush()
    return table


def test_preview_returns_the_emitted_predicate(
    client: Any, full_api_access: None, dataset: Any
) -> None:
    with patch(PROBE, return_value=[1768435200]):
        response = client.post(
            f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/",
            json={
                "mapped_column": "event_time",
                "value_transform": "unix_timestamp(:value)",
                "sample_values": ["2026-01-15 00:00:00"],
            },
        )

    assert response.status_code == 200
    assert response.json["result"] == {
        "valid": True,
        "sample_input": "event_time == '2026-01-15 00:00:00'",
        "emitted_predicate": "dt_epoch = 1768435200",
    }


def test_preview_mirrors_a_range_when_the_transform_is_monotonic(
    client: Any, full_api_access: None, dataset: Any
) -> None:
    """
    The case the whole feature exists for: an Explore time range bound.
    """
    with patch(PROBE, return_value=[1768435200]):
        response = client.post(
            f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/",
            json={
                "mapped_column": "event_time",
                "value_transform": "unix_timestamp(:value)",
                "sample_values": ["2026-01-15 00:00:00"],
                "operator": ">=",
                "is_monotonic": True,
            },
        )

    assert response.json["result"] == {
        "valid": True,
        "sample_input": "event_time >= '2026-01-15 00:00:00'",
        "emitted_predicate": "dt_epoch >= 1768435200",
    }


def test_preview_refuses_a_range_when_the_transform_is_not_monotonic(
    client: Any, full_api_access: None, dataset: Any
) -> None:
    """
    Refusing here rather than showing a predicate is the point: the query path
    would not mirror this filter either, and a preview that implied otherwise
    would be the one thing worse than no preview.
    """
    with patch(PROBE, side_effect=AssertionError("probe must not run")):
        response = client.post(
            f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/",
            json={
                "mapped_column": "event_time",
                "value_transform": "unix_timestamp(:value)",
                "sample_values": ["2026-01-15 00:00:00"],
                "operator": ">=",
                "is_monotonic": False,
            },
        )

    result = response.json["result"]
    assert result["valid"] is False
    assert "preserves ordering" in result["error"]


def test_preview_mirrors_in_element_wise(
    client: Any, full_api_access: None, dataset: Any
) -> None:
    """
    Wireframe 1h: a non-temporal mapping previews as an `IN`, not as a `>=`
    against the first value.
    """
    with patch(PROBE, return_value=["us", "ca"]):
        response = client.post(
            f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/",
            json={
                "mapped_column": "event_time",
                "value_transform": "lower(:value)",
                "sample_values": ["US", "CA"],
                "operator": "IN",
            },
        )

    assert response.json["result"] == {
        "valid": True,
        "sample_input": "event_time IN ('US', 'CA')",
        "emitted_predicate": "dt_epoch IN ('us', 'ca')",
    }


def test_preview_rejects_an_operator_that_can_never_mirror(
    client: Any, full_api_access: None, dataset: Any
) -> None:
    response = client.post(
        f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/",
        json={
            "mapped_column": "event_time",
            "value_transform": "unix_timestamp(:value)",
            "sample_values": ["2026-01-15 00:00:00"],
            "operator": "NOT IN",
        },
    )

    assert response.status_code == 400


def test_preview_reports_a_parse_error_without_touching_the_engine(
    client: Any, full_api_access: None, dataset: Any
) -> None:
    """
    Validate first, probe second. A half-typed transform is by definition
    unparseable, which is most of the traffic a debounced text input produces.
    """
    with patch(PROBE, side_effect=AssertionError("probe must not run")):
        response = client.post(
            f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/",
            json={
                "mapped_column": "event_time",
                "value_transform": "unix_timestamp(:value",
                "sample_values": ["2026-01-15 00:00:00"],
            },
        )

    assert response.status_code == 200
    assert response.json["result"]["valid"] is False
    assert response.json["result"]["error"]


def test_preview_rejects_a_non_deterministic_transform(
    client: Any, full_api_access: None, dataset: Any
) -> None:
    with patch(PROBE, side_effect=AssertionError("probe must not run")):
        response = client.post(
            f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/",
            json={
                "mapped_column": "event_time",
                "value_transform": "unix_timestamp()",
                "sample_values": ["2026-01-15 00:00:00"],
            },
        )

    assert response.json["result"]["valid"] is False


def test_preview_reports_an_unknown_mapped_column(
    client: Any, full_api_access: None, dataset: Any
) -> None:
    with patch(PROBE, side_effect=AssertionError("probe must not run")):
        response = client.post(
            f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/",
            json={
                "mapped_column": "nope",
                "value_transform": "unix_timestamp(:value)",
                "sample_values": ["2026-01-15 00:00:00"],
            },
        )

    assert response.json["result"]["valid"] is False


def test_preview_reports_a_failed_probe_rather_than_erroring(
    client: Any, full_api_access: None, dataset: Any
) -> None:
    with patch(PROBE, return_value=None):
        response = client.post(
            f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/",
            json={
                "mapped_column": "event_time",
                "value_transform": "unix_timestamp(:value)",
                "sample_values": ["2026-01-15 00:00:00"],
            },
        )

    assert response.status_code == 200
    assert response.json["result"]["valid"] is False


def test_preview_404s_for_an_unknown_dataset(
    client: Any, full_api_access: None, dataset: Any
) -> None:
    response = client.post(
        "/api/v1/dataset/99999/partition_mapping/preview/",
        json={
            "mapped_column": "event_time",
            "value_transform": "unix_timestamp(:value)",
            "sample_values": ["2026-01-15"],
        },
    )
    assert response.status_code == 404


def test_preview_is_gated_on_the_feature_flag(
    app: Flask, client: Any, full_api_access: None, dataset: Any
) -> None:
    app.config["DEFAULT_FEATURE_FLAGS"]["PARTITION_FILTER_MAPPING"] = False

    response = client.post(
        f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/",
        json={
            "mapped_column": "event_time",
            "value_transform": "unix_timestamp(:value)",
            "sample_values": ["2026-01-15"],
        },
    )
    assert response.status_code == 404


def test_preview_rejects_an_invalid_payload(
    client: Any, full_api_access: None, dataset: Any
) -> None:
    response = client.post(
        f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/",
        json={"nonsense": True},
    )
    assert response.status_code == 400


def test_preview_is_rate_limited_per_user_and_dataset(
    app: Flask, client: Any, full_api_access: None, dataset: Any
) -> None:
    """
    Debouncing is a client-side courtesy, not a guard: a held keydown, or a few
    owners with the editor open, is sustained load on a production cluster.
    """
    app.config["PARTITION_TRANSFORM_PREVIEW_RATE_LIMIT"] = 2

    payload = {
        "mapped_column": "event_time",
        "value_transform": "unix_timestamp(:value)",
        "sample_values": ["2026-01-15"],
    }
    with patch(PROBE, return_value=[1]):
        statuses = [
            client.post(
                f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/",
                json={**payload, "sample_values": [f"2026-01-{day:02d}"]},
            ).status_code
            for day in range(1, 5)
        ]

    assert statuses[:2] == [200, 200]
    assert 429 in statuses[2:]
