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
from unittest.mock import MagicMock, patch

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
        "emitted_predicate": "dt_epoch = 1768435200 OR dt_epoch IS NULL",
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
        "emitted_predicate": "dt_epoch >= 1768435200 OR dt_epoch IS NULL",
    }


def test_preview_shows_a_strict_bound_mirroring_non_strictly(
    client: Any, full_api_access: None, dataset: Any
) -> None:
    """
    The preview and the query path agree only because both go through
    `build_mirrored_predicates`. A preview rendering `<` while the chart emitted
    `<=` would be the editor claiming something the SQL does not do.

    `sample_input` describes the owner's filter and `emitted_predicate` the
    mirror, so the two carrying different operators is the behaviour under test
    rather than a defect.
    """
    with patch(PROBE, return_value=[1768435200]):
        response = client.post(
            f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/",
            json={
                "mapped_column": "event_time",
                "value_transform": "unix_timestamp(:value)",
                "sample_values": ["2026-01-15 00:00:00"],
                "operator": "<",
                "is_monotonic": True,
            },
        )

    assert response.json["result"] == {
        "valid": True,
        "sample_input": "event_time < '2026-01-15 00:00:00'",
        "emitted_predicate": "dt_epoch <= 1768435200 OR dt_epoch IS NULL",
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
        "emitted_predicate": "dt_epoch IN ('us', 'ca') OR dt_epoch IS NULL",
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


def test_the_budget_is_spent_exactly_once_per_request(
    app: Flask, client: Any, full_api_access: None, dataset: Any
) -> None:
    """
    Counting is `add` then `inc`, so the first request of a window and every
    one after it cost the same single unit. A read-then-write pair would let
    concurrent previews all observe the same sub-limit value and all through.
    """
    app.config["PARTITION_TRANSFORM_PREVIEW_RATE_LIMIT"] = 3

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
            for day in range(1, 6)
        ]

    assert statuses == [200, 200, 200, 429, 429]


def test_each_window_gets_a_fresh_budget(
    app: Flask, client: Any, full_api_access: None, dataset: Any
) -> None:
    """
    The window is carried by the *key*, not by the entry's lifetime, so a
    counter that outlives its bucket is simply never read again.

    Relying on the TTL could not deliver that on either supported backend.
    cachelib's generic `inc` is a read-modify-write whose `set` restamps
    `CACHE_DEFAULT_TIMEOUT` -- a day by default -- so on SimpleCache a spent
    budget kept renewing a day-long lockout every time the owner retried. And
    on Redis, a key that expires between a losing `add` and the `inc` is
    recreated by `INCR` with no TTL at all, so past the limit the owner was
    429'd permanently.
    """
    from superset.datasets.api import PREVIEW_RATE_LIMIT_WINDOW

    app.config["PARTITION_TRANSFORM_PREVIEW_RATE_LIMIT"] = 1

    payload = {
        "mapped_column": "event_time",
        "value_transform": "unix_timestamp(:value)",
        "sample_value": "2026-01-15",
    }
    url = f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/"
    start = 1_800_000_000

    with patch(PROBE, return_value=[1]):
        with patch("superset.datasets.api.time.time", return_value=start):
            assert client.post(url, json=payload).status_code == 200
            assert client.post(url, json=payload).status_code == 429
        with patch(
            "superset.datasets.api.time.time",
            return_value=start + PREVIEW_RATE_LIMIT_WINDOW,
        ):
            assert client.post(url, json=payload).status_code == 200


def test_a_restamping_backend_cannot_extend_the_lockout(
    app: Flask, client: Any, full_api_access: None, dataset: Any
) -> None:
    """
    The concrete failure the bucketed key exists to rule out: a backend whose
    `inc` rewrites the entry with its own default lifetime. Here that lifetime
    is a day, and the next window still starts from zero because it is a
    different key.
    """
    from superset.datasets.api import PREVIEW_RATE_LIMIT_WINDOW
    from superset.extensions import cache_manager

    app.config["PARTITION_TRANSFORM_PREVIEW_RATE_LIMIT"] = 1

    payload = {
        "mapped_column": "event_time",
        "value_transform": "unix_timestamp(:value)",
        "sample_values": ["2026-01-15"],
    }
    url = f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/"
    start = 1_900_000_000
    backend = cache_manager.cache.cache
    original_inc = backend.inc

    def restamping_inc(key: str, delta: int = 1) -> Any:
        used = original_inc(key, delta)
        backend.set(key, used, timeout=86400)
        return used

    with patch(PROBE, return_value=[1]):
        with patch.object(backend, "inc", side_effect=restamping_inc):
            with patch("superset.datasets.api.time.time", return_value=start):
                assert client.post(url, json=payload).status_code == 200
                assert client.post(url, json=payload).status_code == 429
            with patch(
                "superset.datasets.api.time.time",
                return_value=start + PREVIEW_RATE_LIMIT_WINDOW,
            ):
                assert client.post(url, json=payload).status_code == 200


def test_a_cache_that_cannot_count_does_not_lock_the_editor_out(
    app: Flask, client: Any, full_api_access: None, dataset: Any
) -> None:
    """Unenforceable is not the same as spent."""
    from superset.extensions import cache_manager

    app.config["PARTITION_TRANSFORM_PREVIEW_RATE_LIMIT"] = 1

    payload = {
        "mapped_column": "event_time",
        "value_transform": "unix_timestamp(:value)",
        "sample_values": ["2026-01-15"],
    }
    backend = cache_manager.cache.cache
    with patch.object(backend, "add", return_value=False):
        with patch.object(backend, "inc", return_value=None):
            with patch(PROBE, return_value=[1]):
                response = client.post(
                    f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/",
                    json=payload,
                )

    assert response.status_code == 200


def test_a_probe_that_returns_null_reports_a_reason_not_a_predicate(
    client: Any, full_api_access: None, dataset: Any
) -> None:
    """
    A transform returns NULL for an input it cannot convert. A NULL bound would
    make the mirrored comparison NULL for every row, so no predicate is emitted
    at all -- and the editor is told why rather than shown `dt_epoch >= None`.
    """
    with patch(PROBE, return_value=[None]):
        response = client.post(
            f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/",
            json={
                "mapped_column": "event_time",
                "value_transform": "unix_timestamp(:value)",
                "sample_values": ["not a date"],
            },
        )

    assert response.status_code == 200
    result = response.json["result"]
    assert result["valid"] is False
    assert result["reason"] == "engine"
    assert "emitted_predicate" not in result
    assert "None" not in result["sample_input"]


def test_a_probed_string_is_quoted_and_escaped_by_the_dialect(
    client: Any, full_api_access: None, dataset: Any
) -> None:
    """Escaping is the dialect's job, not a hand-rolled `replace`."""
    with patch(PROBE, return_value=["o'hara"]):
        response = client.post(
            f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/",
            json={
                "mapped_column": "event_time",
                "value_transform": "lower(:value)",
                "sample_values": ["O'Hara"],
            },
        )

    assert response.status_code == 200
    result = response.json["result"]
    assert result["emitted_predicate"] == "dt_epoch = 'o''hara' OR dt_epoch IS NULL"
    # The sample input is display-only but still reads as SQL, so the value it
    # echoes back is quoted and escaped the same way.
    assert result["sample_input"] == "event_time == 'O''Hara'"


def test_an_over_long_transform_is_rejected_before_the_engine(
    client: Any, full_api_access: None, dataset: Any
) -> None:
    """
    The transform is parsed and then run against the warehouse, so an unbounded
    string is parser time and warehouse time an owner can spend at will.
    """
    with patch(PROBE) as probe:
        response = client.post(
            f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/",
            json={
                "mapped_column": "event_time",
                "value_transform": "unix_timestamp(:value)" + " " * 2000,
                "sample_values": ["2026-01-15"],
            },
        )

    assert response.status_code == 400
    probe.assert_not_called()


def test_preview_rejects_a_subquery_without_touching_the_engine(
    client: Any, full_api_access: None, dataset: Any
) -> None:
    """
    `build_probe_sql` binds `:value` and splices the rest of the transform in as
    SQL text, so without the stored-expression gate a dataset editor who has no
    SQL Lab access could read another table through the preview: the subquery
    runs and its result comes back in `emitted_predicate`.

    The save path has always applied this gate. Preview evaluates a transform
    that has not been saved, so it has to apply it too.
    """
    with patch(PROBE, side_effect=AssertionError("probe must not run")):
        response = client.post(
            f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/",
            json={
                "mapped_column": "event_time",
                "value_transform": ("(SELECT password FROM ab_user LIMIT 1) || :value"),
                "sample_value": "2026-01-15 00:00:00",
            },
        )

    assert response.status_code == 200
    assert response.json["result"]["valid"] is False
    assert "emitted_predicate" not in response.json["result"]


def test_preview_rejects_a_smuggled_from_clause_without_touching_the_engine(
    client: Any, full_api_access: None, dataset: Any
) -> None:
    """
    The sibling above covers the sub-query. This covers the shape that got
    past it: a top-level FROM is not a sub-query, so `ALLOW_ADHOC_SUBQUERY`
    never applied, and the single-select-expression check counts only the
    projection -- so `password || :value FROM ab_user` read as one expression
    and the probe ran `SELECT password || '...' AS v0 FROM ab_user`, with the
    alias landing on the table the transform smuggled in.

    The verdict comes from the shape gate, so it arrives as a validation
    reason and the probe is never reached.
    """
    with patch(PROBE, side_effect=AssertionError("probe must not run")):
        response = client.post(
            f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/",
            json={
                "mapped_column": "event_time",
                "value_transform": "password || :value FROM ab_user",
                "sample_values": ["2026-01-15 00:00:00"],
            },
        )

    assert response.status_code == 200
    assert response.json["result"]["valid"] is False
    assert response.json["result"]["reason"] == "validation"
    assert "emitted_predicate" not in response.json["result"]


@pytest.mark.parametrize(
    "transform",
    [
        "':value'",
        "concat(':value', 'x')",
        "1 -- :value",
        "1 /* :value */",
    ],
    ids=["quoted", "quoted-in-call", "line-comment", "block-comment"],
)
def test_preview_rejects_a_placeholder_the_engine_will_not_evaluate(
    client: Any, full_api_access: None, dataset: Any, transform: str
) -> None:
    """
    The two siblings above cover a transform that reads another table in the
    clear. This covers the same read assembled out of pieces that each look
    harmless.

    Every write-side gate reads the transform with `:value` replaced by the
    `NULL` keyword, so `':value'` arrives as the literal `SELECT 'NULL'` -- a
    constant, and nothing a shape check objects to. The escape completes later:
    SQLAlchemy's `text()` scan is no more literal-aware than the regex, so the
    placeholder inside the quotes is bound anyway and the dialect renders the
    bind *including its own quotes* in the middle of the owner's. A sample of
    `" || (SELECT secret FROM vault LIMIT 1) || "` then closes the literal and
    the probe runs the sub-query.

    The comment forms are the other half: the probe joins its selections on one
    line, so a comment eats its own `AS v0` alias and everything after it. The
    engine still answers with one column, the constant in front of the comment
    is accepted as the transform's result, and the mirror emits
    `partition_col = <constant>` for every filter value -- wrong rows, not lost
    pruning.
    """
    with patch(PROBE, side_effect=AssertionError("probe must not run")):
        response = client.post(
            f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/",
            json={
                "mapped_column": "event_time",
                "value_transform": transform,
                "sample_values": [" || (SELECT 1) || "],
            },
        )

    assert response.status_code == 200
    assert response.json["result"]["valid"] is False
    assert response.json["result"]["reason"] == "validation"
    assert "emitted_predicate" not in response.json["result"]


def test_preview_refuses_a_mapped_column_with_an_advanced_data_type(
    client: Any, full_api_access: None, dataset: Any, app: Flask
) -> None:
    """
    `resolve_partition_mapping` refuses to mirror such a column -- its filters
    go through `translate_filter`, which builds its own predicate shape from
    translated values, so the `(operator, value)` pair the operator matrix
    reasons about does not exist. The Explore indicator repeats the bail-out.
    Preview did not, so it reported a valid emitted predicate for a mapping no
    chart would ever mirror: the one answer a preview panel must not give.
    """
    column = next(col for col in dataset.columns if col.column_name == "event_time")
    column.advanced_data_type = "port"
    db.session.flush()

    app.config["DEFAULT_FEATURE_FLAGS"]["ENABLE_ADVANCED_DATA_TYPES"] = True
    app.config["ADVANCED_DATA_TYPES"] = {"port": MagicMock()}
    try:
        with patch(PROBE, side_effect=AssertionError("probe must not run")):
            response = client.post(
                f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/",
                json={
                    "mapped_column": "event_time",
                    "value_transform": "unix_timestamp(:value)",
                    "sample_values": ["2026-01-15 00:00:00"],
                },
            )
    finally:
        del app.config["DEFAULT_FEATURE_FLAGS"]["ENABLE_ADVANCED_DATA_TYPES"]
        app.config["ADVANCED_DATA_TYPES"] = {}

    assert response.status_code == 200
    assert response.json["result"]["valid"] is False
    assert response.json["result"]["reason"] == "validation"
    assert "advanced data type" in response.json["result"]["error"]
    assert "emitted_predicate" not in response.json["result"]


def test_preview_renders_a_probed_value_read_from_a_dataframe(
    client: Any, full_api_access: None, dataset: Any
) -> None:
    """
    The probe reads its results out of a pandas frame, so the canonical epoch
    transform returns a `numpy.int64` and a temporal one a `pandas.Timestamp`.
    SQLAlchemy has a literal renderer for neither -- `sa.literal` infers
    `NullType` and raises `CompileError`, which the endpoint turns into a 500.

    Patching `Database.get_df` rather than `evaluate_transform` is what makes
    this a regression test: stubbing the evaluator hands back a plain Python
    `int` and never exercises the frame at all.
    """
    import pandas as pd

    frame = pd.DataFrame([[1768435200]], columns=["v0"])
    with patch(
        "superset.models.core.Database.get_df",
        return_value=frame,
    ):
        response = client.post(
            f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/",
            json={
                "mapped_column": "event_time",
                "value_transform": "unix_timestamp(:value)",
                "sample_value": "2026-01-15 00:00:00",
            },
        )

    assert response.status_code == 200
    assert response.json["result"] == {
        "valid": True,
        "emitted_predicate": "dt_epoch >= 1768435200",
    }


def test_preview_renders_a_probed_timestamp_read_from_a_dataframe(
    client: Any, full_api_access: None, dataset: Any
) -> None:
    """A transform returning a date hits the same renderer gap as an integer."""
    import pandas as pd

    frame = pd.DataFrame([[pd.Timestamp("2026-01-15")]], columns=["v0"])
    with patch(
        "superset.models.core.Database.get_df",
        return_value=frame,
    ):
        response = client.post(
            f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/",
            json={
                "mapped_column": "event_time",
                "value_transform": "date(:value)",
                "sample_value": "2026-01-15 00:00:00",
            },
        )

    assert response.status_code == 200
    assert response.json["result"]["valid"] is True
    assert "2026-01-15" in response.json["result"]["emitted_predicate"]


def test_preview_is_authorized_as_a_write() -> None:
    """
    Preview inspects a mapping the caller is entitled to *save*, so it is
    authorized the way the PUT behind it is: ``can_write`` plus
    ``raise_for_editorship``. Without the mapping, FAB's ``@protect()`` falls
    back to ``can_partition_mapping_preview_Dataset``, which no stock role
    carries -- so a custom role with ``can_write`` could store a mapping and not
    preview it.
    """
    from superset.datasets.api import DatasetRestApi

    assert DatasetRestApi.method_permission_name["partition_mapping_preview"] == (
        "write"
    )


def test_preview_coerces_a_sample_the_way_a_chart_filter_is_coerced(
    client: Any, full_api_access: None, dataset: Any
) -> None:
    """
    Samples arrive as strings and the probe is keyed on exactly what it is
    handed, so a numeric column's sample has to be cast the way
    `filter_values_handler` casts a chart filter's value. Under the reviewer's
    `typeof(:value)` on SQLite the raw string previewed a partition key of
    `'text'` where the equivalent chart filter emitted `'integer'`.

    It also makes the shared probe cache actually shared: `_probe_cache_key`
    keys on each value's `repr`, so `'2025'` and `2025` were separate entries.
    """
    from superset.connectors.sqla.models import TableColumn

    dataset.columns.append(TableColumn(column_name="year", type="BIGINT"))
    db.session.flush()

    probed: list[list[Any]] = []

    def record(*args: Any, **kwargs: Any) -> list[Any]:
        probed.append(list(args[-1]))
        return ["integer"]

    with patch(PROBE, side_effect=record):
        response = client.post(
            f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/",
            json={
                "mapped_column": "year",
                "value_transform": "typeof(:value)",
                "sample_values": ["2025"],
            },
        )

    assert response.status_code == 200
    assert response.json["result"]["valid"] is True
    assert probed == [[2025]]


def test_preview_leaves_a_string_column_s_sample_alone(
    client: Any, full_api_access: None, dataset: Any
) -> None:
    """
    The counterweight to the test above: the coercion is the column's, not a
    blanket cast, so a digit-only sample on a VARCHAR column stays a string --
    exactly as it would reaching a chart filter on that column.
    """
    from superset.connectors.sqla.models import TableColumn

    dataset.columns.append(TableColumn(column_name="zip", type="VARCHAR"))
    db.session.flush()

    probed: list[list[Any]] = []

    def record(*args: Any, **kwargs: Any) -> list[Any]:
        probed.append(list(args[-1]))
        return ["text"]

    with patch(PROBE, side_effect=record):
        response = client.post(
            f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/",
            json={
                "mapped_column": "zip",
                "value_transform": "typeof(:value)",
                "sample_values": ["02134"],
            },
        )

    assert response.status_code == 200
    assert probed == [["02134"]]
