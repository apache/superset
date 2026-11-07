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
The mirror verdict answers for one mapping: a dataset, its mapped column and its
partition column. These tests read it the way the UI does, through
`partition_filter_mapping_summary`, after the two things that can write it: a
chart's `build_mirrored_predicates` and the editor's preview.
"""

import hashlib
import re
from collections.abc import Callable, Iterator
from typing import Any
from unittest.mock import MagicMock

import pandas as pd
import pytest
from flask import Flask
from flask_caching import Cache

from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.connectors.sqla.partition_mapping import (
    _probe_cache_key,
    build_mirrored_predicates,
    PartitionMapping,
    preview_partition_mapping,
    PROBE_CACHE_VERSION,
)
from superset.extensions import cache_manager
from superset.models.core import Database
from superset.utils import json
from superset.utils.core import FilterOperator

EPOCH_INPUT = 1790850600
TEXT_INPUT = "2026-10-21 10:30:00"
ALL_OPERATORS = ["<", "<=", "==", ">", ">=", "IN", "TEMPORAL_RANGE"]


@pytest.fixture(autouse=True)
def real_cache(app: Flask) -> Iterator[None]:
    """The test app runs a null cache, where no verdict could be read back."""
    cache = Cache(config={"CACHE_TYPE": "SimpleCache", "CACHE_DEFAULT_TIMEOUT": 300})
    cache.init_app(app)
    original = cache_manager._cache  # noqa: SLF001
    cache_manager._cache = cache  # noqa: SLF001
    yield
    cache_manager._cache = original  # noqa: SLF001


@pytest.fixture(autouse=True)
def partition_filter_mapping_enabled(app: Flask) -> Iterator[None]:
    flags = app.config["DEFAULT_FEATURE_FLAGS"]
    original = flags.get("PARTITION_FILTER_MAPPING")
    flags["PARTITION_FILTER_MAPPING"] = True
    yield
    if original is None:
        del flags["PARTITION_FILTER_MAPPING"]
    else:
        flags["PARTITION_FILTER_MAPPING"] = original


def _database(answer: Callable[[str], Any]) -> Database:
    """A real `Database` whose engine answers one row, one column per input."""

    def get_df(sql: str, **kwargs: Any) -> pd.DataFrame:
        columns = re.findall(r"AS (v\d+)", sql)
        return pd.DataFrame(
            [[answer(sql) for _ in columns]],
            columns=columns,
        ).astype(object)

    database = Database(database_name="shared_connection", sqlalchemy_uri="sqlite://")
    database.id = 7
    database.get_df = MagicMock(side_effect=get_df)  # type: ignore[method-assign]
    return database


def _dataset(
    database: Database,
    dataset_id: int,
    *,
    mapped: tuple[str, str],
    partition: tuple[str, str],
    transform: str,
) -> SqlaTable:
    table = SqlaTable(
        table_name=f"dataset_{dataset_id}",
        database=database,
        main_dttm_col=mapped[0],
        columns=[
            TableColumn(
                column_name=mapped[0],
                type=mapped[1],
                is_dttm=True,
                partition_value_transform=transform,
                partition_transform_is_monotonic=True,
            ),
            TableColumn(column_name=partition[0], type=partition[1]),
        ],
        metrics=[SqlMetric(metric_name="hits", expression="COUNT(*)")],
    )
    table.id = dataset_id
    table.partition_column = partition[0]
    return table


def _chart(table: SqlaTable, value: Any) -> list[Any]:
    """What a chart filtering the mapped column at ``value`` would mirror."""
    mapped = next(
        column.column_name
        for column in table.columns
        if column.partition_value_transform
    )
    transform = next(
        column.partition_value_transform
        for column in table.columns
        if column.column_name == mapped
    )
    mapping = PartitionMapping(
        partition_column=str(table.partition_column),
        mapped_column=mapped,
        value_transform=transform,
        is_monotonic=True,
    )
    return build_mirrored_predicates(
        table, mapping, [(FilterOperator.GREATER_THAN_OR_EQUALS, value)]
    )


def _summary(table: SqlaTable) -> dict[str, Any]:
    summary = table.partition_filter_mapping_summary
    assert summary is not None
    return summary


def _evaluable(table: SqlaTable) -> bool | None:
    return _summary(table)["evaluable"]


def _glyph_is_lit(table: SqlaTable) -> bool:
    """The gates `isMirroredFilter` applies to the summary, for a ``>=`` chip."""
    summary = _summary(table)
    return (
        bool(summary["active"])
        and summary["evaluable"] is not False
        and ">=" in summary["mirrorable_operators"]
    )


def _preview(table: SqlaTable, value: str, partition_column: str | None = None) -> Any:
    mapped = next(
        column for column in table.columns if column.partition_value_transform
    )
    return preview_partition_mapping(
        table,
        mapped_column=mapped.column_name,
        value_transform=mapped.partition_value_transform,
        sample_values=[value],
        is_monotonic=True,
        partition_column=partition_column,
    )


# ---------------------------------------------------------------------------
# Case 1: a NULL-only transform, from a cold cache
# ---------------------------------------------------------------------------


def test_a_cold_cache_promises_nothing_until_a_probe_confirms_it(app: Flask) -> None:
    """
    `unix_timestamp(trunc(from_unixtime(:value), 'HH'))` answers `NULL` for every
    input on Hive, and on a cold cache nothing knows that yet. `evaluable` stays
    `None`, because that is the honest answer; the operators are what the glyph
    and the time range control read, so they cannot be promised until something
    has seen a mirror.
    """
    database = _database(lambda _sql: None)
    table = _dataset(
        database,
        1,
        mapped=("event_time", "BIGINT"),
        partition=("dt", "BIGINT"),
        transform="unix_timestamp(trunc(from_unixtime(:value), 'HH'))",
    )

    with app.app_context():
        assert _evaluable(table) is None
        assert _summary(table)["mirrorable_operators"] == []
        assert not _glyph_is_lit(table)

        assert _chart(table, EPOCH_INPUT) == []

        assert _evaluable(table) is False
        assert _summary(table)["mirrorable_operators"] == []
        assert not _glyph_is_lit(table)

    # Reading the summary never asks the warehouse: only the chart did.
    assert database.get_df.call_count == 1  # type: ignore[attr-defined]


def test_a_refused_transform_promises_no_operators(app: Flask) -> None:
    """The time range control reads the operators and never `evaluable`."""
    database = _database(lambda _sql: None)
    table = _dataset(
        database,
        1,
        mapped=("event_time", "BIGINT"),
        partition=("dt", "BIGINT"),
        transform="unix_timestamp(trunc(from_unixtime(:value), 'HH'))",
    )

    with app.app_context():
        _chart(table, EPOCH_INPUT)

        assert "TEMPORAL_RANGE" not in _summary(table)["mirrorable_operators"]


def test_a_chart_that_carries_the_mirror_confirms_the_operators(app: Flask) -> None:
    table = _dataset(
        _database(lambda _sql: 1790848800),
        1,
        mapped=("event_time", "BIGINT"),
        partition=("dt", "BIGINT"),
        transform=":value - :value % 3600",
    )

    with app.app_context():
        assert _chart(table, EPOCH_INPUT)

        assert _evaluable(table) is True
        assert _summary(table)["mirrorable_operators"] == ALL_OPERATORS
        assert _glyph_is_lit(table)


def test_an_all_null_probe_cache_hit_still_settles_the_verdict(app: Flask) -> None:
    """
    The probe cache is shared by every dataset on the connection, so a dataset
    can reach its first chart with the answers already cached, and must not stay
    unsettled for the whole timeout because no probe ran.
    """
    transform = "unix_timestamp(trunc(from_unixtime(:value), 'HH'))"
    database = _database(lambda _sql: None)
    first, second = (
        _dataset(
            database,
            dataset_id,
            mapped=("event_time", "BIGINT"),
            partition=("dt", "BIGINT"),
            transform=transform,
        )
        for dataset_id in (1, 2)
    )

    with app.app_context():
        _chart(first, EPOCH_INPUT)
        _chart(second, EPOCH_INPUT)

        assert database.get_df.call_count == 1  # type: ignore[attr-defined]
        assert _evaluable(second) is False


def test_a_null_for_one_input_does_not_withdraw_what_another_earned(
    app: Flask,
) -> None:
    """`NULLIF(:value, 0)` mirrors, and `0` is just the input it has no key for."""
    table = _dataset(
        _database(lambda sql: None if "'0'" in sql or " 0 " in sql else 2),
        1,
        mapped=("n", "VARCHAR"),
        partition=("bucket", "BIGINT"),
        transform="NULLIF(:value, 0)",
    )

    with app.app_context():
        assert _chart(table, "2")
        assert _chart(table, "0") == []

        assert _evaluable(table) is True


def test_a_later_answer_restores_a_verdict_from_the_probe_cache(app: Flask) -> None:
    """
    A `False` is withdrawn by the next chart that carries a mirror, even one
    whose answer comes out of the probe cache and so runs no probe at all.
    """
    table = _dataset(
        _database(lambda sql: None if "'0'" in sql else 2),
        1,
        mapped=("n", "VARCHAR"),
        partition=("bucket", "BIGINT"),
        transform="NULLIF(:value, 0)",
    )

    with app.app_context():
        assert _chart(table, "2")
        other_input_first = _dataset(
            table.database,
            2,
            mapped=("n", "VARCHAR"),
            partition=("bucket", "BIGINT"),
            transform="NULLIF(:value, 0)",
        )
        assert _chart(other_input_first, "0") == []
        assert _evaluable(other_input_first) is False

        # Answered by the probe `table` ran above: nothing reaches the engine.
        calls = table.database.get_df.call_count  # type: ignore[attr-defined]
        assert _chart(other_input_first, "2")
        assert table.database.get_df.call_count == calls  # type: ignore[attr-defined]

        assert _evaluable(other_input_first) is True


def test_a_null_only_time_range_settles_the_verdict(app: Flask) -> None:
    """
    A time range brings two bounds, and two `NULL`s fail `_bounds_are_ordered` as
    not comparable before any predicate is attempted.
    """
    table = _dataset(
        _database(lambda _sql: None),
        1,
        mapped=("event_time", "BIGINT"),
        partition=("dt", "BIGINT"),
        transform="unix_timestamp(trunc(from_unixtime(:value), 'HH'))",
    )
    mapping = PartitionMapping(
        partition_column="dt",
        mapped_column="event_time",
        value_transform="unix_timestamp(trunc(from_unixtime(:value), 'HH'))",
        is_monotonic=True,
    )

    with app.app_context():
        assert (
            build_mirrored_predicates(
                table,
                mapping,
                [
                    (FilterOperator.GREATER_THAN_OR_EQUALS, EPOCH_INPUT),
                    (FilterOperator.LESS_THAN, EPOCH_INPUT + 3600),
                ],
            )
            == []
        )

        assert _evaluable(table) is False


def test_a_refusal_is_recorded_against_the_mapping_that_asked(app: Flask) -> None:
    """A misspelled function fails for everyone, but only this mapping has asked."""
    database = Database(database_name="shared_connection", sqlalchemy_uri="sqlite://")
    database.id = 7
    database.get_df = MagicMock(  # type: ignore[method-assign]
        side_effect=RuntimeError("function no_such_fn(unknown) does not exist")
    )
    asked, other = (
        _dataset(
            database,
            dataset_id,
            mapped=("event_time", "BIGINT"),
            partition=("dt", "BIGINT"),
            transform="no_such_fn(:value)",
        )
        for dataset_id in (1, 2)
    )

    with app.app_context():
        assert _chart(asked, EPOCH_INPUT) == []

        assert _evaluable(asked) is False
        assert _evaluable(other) is None


def test_inverted_bounds_confirm_nothing(app: Flask) -> None:
    """
    The engine answered, but this range carries no predicate, so a probe success
    alone must not light the glyph. Nor does it withdraw anything: another range
    on a transform declared monotonic may well mirror.
    """
    answers = iter([200, 100])
    table = _dataset(
        _database(lambda _sql: next(answers)),
        1,
        mapped=("event_time", "BIGINT"),
        partition=("dt", "BIGINT"),
        transform="0 - :value",
    )
    mapping = PartitionMapping(
        partition_column="dt",
        mapped_column="event_time",
        value_transform="0 - :value",
        is_monotonic=True,
    )

    with app.app_context():
        assert (
            build_mirrored_predicates(
                table,
                mapping,
                [
                    (FilterOperator.GREATER_THAN_OR_EQUALS, 100),
                    (FilterOperator.LESS_THAN, 200),
                ],
            )
            == []
        )

        assert _evaluable(table) is None


# ---------------------------------------------------------------------------
# Case 2: a transform answering the wrong type for the partition column
# ---------------------------------------------------------------------------


def test_a_type_mismatch_is_recorded_against_its_column(app: Flask) -> None:
    """Postgres text `day_key` with an integer transform: every query declines."""
    table = _dataset(
        _database(lambda _sql: 1792578600),
        1,
        mapped=("event_ts", "TIMESTAMP"),
        partition=("day_key", "TEXT"),
        transform="CAST(strftime('%s', :value) AS BIGINT)",
    )

    with app.app_context():
        assert _chart(table, TEXT_INPUT) == []
        assert _evaluable(table) is False
        assert not _glyph_is_lit(table)


def test_a_type_mismatch_is_recorded_on_a_probe_cache_hit(app: Flask) -> None:
    """
    The same answers are right for a numeric key on another dataset, which may
    already have cached them; then no probe runs for this one and the decline is
    the only evidence there is.
    """
    transform = "CAST(strftime('%s', :value) AS BIGINT)"
    database = _database(lambda _sql: 1792578600)
    numeric = _dataset(
        database,
        1,
        mapped=("event_ts", "TIMESTAMP"),
        partition=("day_num", "BIGINT"),
        transform=transform,
    )
    text = _dataset(
        database,
        2,
        mapped=("event_ts", "TIMESTAMP"),
        partition=("day_key", "TEXT"),
        transform=transform,
    )

    with app.app_context():
        assert _chart(numeric, TEXT_INPUT)
        assert _chart(text, TEXT_INPUT) == []

        assert database.get_df.call_count == 1  # type: ignore[attr-defined]
        assert _evaluable(numeric) is True
        assert _evaluable(text) is False


# ---------------------------------------------------------------------------
# Case 3: the same transform text on another column
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("epoch_first", [True, False])
def test_an_epoch_column_does_not_answer_for_a_timestamp_one(
    app: Flask, epoch_first: bool
) -> None:
    """
    `:value - :value % 3600` buckets an epoch integer and answers `NULL` for a
    timestamp on Hive. Each column keeps its own verdict whichever was seen first.
    """
    transform = ":value - :value % 3600"
    database = _database(lambda sql: None if TEXT_INPUT in sql else 1790848800)
    epoch = _dataset(
        database,
        1,
        mapped=("event_time", "BIGINT"),
        partition=("dt", "BIGINT"),
        transform=transform,
    )
    timestamp = _dataset(
        database,
        2,
        mapped=("event_ts", "TIMESTAMP"),
        partition=("dt", "BIGINT"),
        transform=transform,
    )

    with app.app_context():
        steps = [
            (epoch, lambda: _preview(epoch, str(EPOCH_INPUT))),
            (timestamp, lambda: _chart(timestamp, TEXT_INPUT)),
        ]
        for _table, step in steps if epoch_first else reversed(steps):
            step()

        assert _evaluable(epoch) is True
        assert _glyph_is_lit(epoch)
        assert _evaluable(timestamp) is False
        assert not _glyph_is_lit(timestamp)


def test_previewing_on_one_column_leaves_the_other_cold(app: Flask) -> None:
    """Not `False` either: nothing has been asked about the timestamp column."""
    transform = ":value - :value % 3600"
    database = _database(lambda _sql: 1790848800)
    epoch = _dataset(
        database,
        1,
        mapped=("event_time", "BIGINT"),
        partition=("dt", "BIGINT"),
        transform=transform,
    )
    timestamp = _dataset(
        database,
        2,
        mapped=("event_ts", "TIMESTAMP"),
        partition=("dt", "BIGINT"),
        transform=transform,
    )

    with app.app_context():
        _preview(epoch, str(EPOCH_INPUT))

        assert _evaluable(timestamp) is None
        assert not _glyph_is_lit(timestamp)


# ---------------------------------------------------------------------------
# The bug recording declines once caused must not come back
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("text_key_first", [True, False])
def test_two_datasets_keep_their_own_verdict_on_one_transform(
    app: Flask, text_key_first: bool
) -> None:
    """
    `CAST(:value AS text)` mirrors onto a text key in dataset A and declines
    against a numeric key in dataset B. Recording B's decline once reported A as
    `evaluable: false`, with its glyph hidden, until the entry expired.
    """
    transform = "CAST(:value AS text)"
    database = _database(lambda _sql: TEXT_INPUT)
    dataset_a = _dataset(
        database,
        1,
        mapped=("event_ts", "TIMESTAMP"),
        partition=("day_key", "TEXT"),
        transform=transform,
    )
    dataset_b = _dataset(
        database,
        2,
        mapped=("event_ts", "TIMESTAMP"),
        partition=("day_num", "BIGINT"),
        transform=transform,
    )

    with app.app_context():
        for table in (
            (dataset_a, dataset_b) if text_key_first else (dataset_b, dataset_a)
        ):
            _preview(table, TEXT_INPUT)

        assert _evaluable(dataset_a) is True
        assert _glyph_is_lit(dataset_a)
        assert _evaluable(dataset_b) is False
        assert not _glyph_is_lit(dataset_b)

        # And a chart on either, from the probe cache, moves neither.
        _chart(dataset_a, TEXT_INPUT)
        _chart(dataset_b, TEXT_INPUT)

        assert _evaluable(dataset_a) is True
        assert _evaluable(dataset_b) is False


def test_previewing_a_candidate_partition_column_leaves_the_saved_one(
    app: Flask,
) -> None:
    """The editor previews against a column the owner has not saved yet."""
    table = _dataset(
        _database(lambda _sql: TEXT_INPUT),
        1,
        mapped=("event_ts", "TIMESTAMP"),
        partition=("day_key", "TEXT"),
        transform="CAST(:value AS text)",
    )
    table.columns.append(TableColumn(column_name="day_num", type="BIGINT"))

    with app.app_context():
        assert _chart(table, TEXT_INPUT)

        assert _preview(table, TEXT_INPUT, partition_column="day_num")["valid"] is False

        assert _evaluable(table) is True


def test_identical_datasets_do_not_share_a_verdict(app: Flask) -> None:
    """Same column names and types: only the dataset tells these apart."""
    transform = ":value - :value % 3600"
    database = _database(lambda _sql: 1790848800)
    tables = [
        _dataset(
            database,
            dataset_id,
            mapped=("event_time", "BIGINT"),
            partition=("dt", "BIGINT"),
            transform=transform,
        )
        for dataset_id in (1, 2)
    ]

    with app.app_context():
        _chart(tables[0], EPOCH_INPUT)

        assert _evaluable(tables[0]) is True
        assert _evaluable(tables[1]) is None


def test_retyping_a_column_retires_its_verdict(app: Flask) -> None:
    """A column sync can change what the transform has to answer."""
    table = _dataset(
        _database(lambda _sql: TEXT_INPUT),
        1,
        mapped=("event_ts", "TIMESTAMP"),
        partition=("day_key", "TEXT"),
        transform="CAST(:value AS text)",
    )

    with app.app_context():
        assert _chart(table, TEXT_INPUT)
        assert _evaluable(table) is True

        next(
            column for column in table.columns if column.column_name == "day_key"
        ).type = "BIGINT"

        assert _evaluable(table) is None


# ---------------------------------------------------------------------------
# Rollout
# ---------------------------------------------------------------------------


def test_a_verdict_written_before_it_had_a_column_is_not_read(app: Flask) -> None:
    """
    An entry keyed on the connection and the transform alone may be another
    column's answer, so it is left to expire. The key is rebuilt by hand here
    because the code that wrote it no longer exists.
    """
    transform = ":value - :value % 3600"
    table = _dataset(
        _database(lambda _sql: None),
        1,
        mapped=("event_ts", "TIMESTAMP"),
        partition=("dt", "BIGINT"),
        transform=transform,
    )
    database = table.database

    with app.app_context():
        payload = json.dumps(
            [
                database.id,
                database.backend,
                database.sqlalchemy_uri,
                database.extra,
                str(database.changed_on),
                None,
                None,
                transform,
                None,
            ],
            default=repr,
        )
        digest = hashlib.md5(payload.encode("utf-8")).hexdigest()  # noqa: S324
        cache_manager.cache.set(f"partition_transform_verdict:v2:{digest}", True)

        assert _evaluable(table) is None


def test_the_probe_cache_survives_the_verdict_changing_shape(app: Flask) -> None:
    """
    Its answers mean what they always did, and it also holds the canaries behind
    `safety_refusal`, so nothing warrants re-probing every mapping on deploy. The
    first chart after a deploy settles the verdict from the answers it has.
    """
    transform = ":value - :value % 3600"
    table = _dataset(
        _database(lambda _sql: 1790848800),
        1,
        mapped=("event_time", "BIGINT"),
        partition=("dt", "BIGINT"),
        transform=transform,
    )

    with app.app_context():
        assert PROBE_CACHE_VERSION == "v2"
        key = _probe_cache_key(table.database, None, None, transform, [EPOCH_INPUT])
        cache_manager.cache.set(key, [1790848800])

        assert _chart(table, EPOCH_INPUT)

        table.database.get_df.assert_not_called()  # type: ignore[attr-defined]
        assert _evaluable(table) is True
