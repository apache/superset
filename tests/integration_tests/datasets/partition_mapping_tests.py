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
Partition filter mapping with the ``PARTITION_FILTER_MAPPING`` flag on, against
natively partitioned PostgreSQL tables in the examples database.

The mapping only earns its keep if a chart returns the same rows with fewer
partitions read. These tests check both halves against a real engine: row
parity with an unmapped twin dataset over the same table, and the partitions
PostgreSQL's planner keeps for the mirrored statement. They also cover the
documented operator and type matrix, the unpruned retry when the warehouse no
longer has the partition column, the preview endpoint's role checks, and the
mirror verdict the dataset API reads back from the Redis-backed cache.

PostgreSQL only: the examples database must support declarative partitioning.
"""

from __future__ import annotations

import calendar
from collections.abc import Iterator
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Callable

import pytest
from flask.ctx import AppContext
from flask.testing import FlaskClient
from sqlalchemy.engine import Connection

from superset import db, security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.extensions import cache_manager
from superset.models.core import Database
from superset.utils import json
from superset.utils.core import backend, get_example_default_schema
from superset.utils.database import get_example_database
from tests.integration_tests.base_tests import subjects_from_users
from tests.integration_tests.conftest import with_feature_flags
from tests.integration_tests.constants import (
    ADMIN_USERNAME,
    ALPHA_USERNAME,
    GAMMA_USERNAME,
)
from tests.integration_tests.test_app import app

HOURLY_TABLE = "pfm_hourly_events"
DAILY_TABLE = "pfm_daily_events"
REGION_TABLE = "pfm_region_events"
RENAMED_TABLE = "pfm_renamed_key_events"
DROPPED_TABLE = "pfm_dropped_key_events"

SEED_START = datetime(2026, 3, 1)
SEED_HOURS = 48
# On the hour (midnight included at hours 0 and 24), off the boundary and the
# last second of the hour.
SEED_OFFSETS_SECONDS = (0, 47 * 60 + 23, 3599)
# Rows the default partition holds: a NULL partition key under a real event
# time, as a dynamic-partition insert leaves them, and one with no event time.
NULL_KEY_ROWS = (
    (1001, "2026-03-01 10:15:00"),
    (1002, "2026-03-02 05:30:00"),
    (1003, None),
)

HOURLY_TRANSFORM = (
    "CAST(floor(extract(epoch from CAST(:value AS TIMESTAMP)) / 3600) * 3600 AS BIGINT)"
)
DAILY_TRANSFORM = "to_char(CAST(:value AS TIMESTAMP), 'YYYYMMDD')"
REGION_TRANSFORM = "lower(:value)"

PREVIEW_PAYLOAD = {
    "mapped_column": "event_ts",
    "partition_column": "hour_key",
    "value_transform": HOURLY_TRANSFORM,
    "sample_values": ["2026-03-01 10:47:23"],
    "operator": "==",
    "is_monotonic": True,
}


def hour_key(timestamp: str) -> int:
    """The hourly partition key the seed writes for ``timestamp`` (UTC epoch)."""
    instant = datetime.fromisoformat(timestamp)
    epoch = calendar.timegm(instant.timetuple())
    return epoch - epoch % 3600


def seed_instants() -> list[datetime]:
    return [
        SEED_START + timedelta(hours=hour, seconds=offset)
        for hour in range(SEED_HOURS)
        for offset in SEED_OFFSETS_SECONDS
    ]


def _sql_literal(value: str | None) -> str:
    return "NULL" if value is None else f"'{value}'"


def _hourly_ddl(table: str) -> list[str]:
    statements = [
        f"""
        CREATE TABLE {table} (
            id integer NOT NULL,
            event_ts timestamp,
            hour_key bigint,
            backup_hour_key bigint
        ) PARTITION BY RANGE (hour_key)
        """
    ]
    for hour in range(SEED_HOURS):
        lower = hour_key((SEED_START + timedelta(hours=hour)).isoformat())
        statements.append(
            f"CREATE TABLE {table}_h{hour:02d} PARTITION OF {table} "
            f"FOR VALUES FROM ({lower}) TO ({lower + 3600})"
        )
    statements.append(f"CREATE TABLE {table}_default PARTITION OF {table} DEFAULT")
    rows = [
        f"({index}, '{instant:%Y-%m-%d %H:%M:%S}', "
        f"{hour_key(instant.isoformat())}, {hour_key(instant.isoformat())})"
        for index, instant in enumerate(seed_instants(), start=1)
    ] + [f"({row_id}, {_sql_literal(ts)}, NULL, NULL)" for row_id, ts in NULL_KEY_ROWS]
    statements.append(f"INSERT INTO {table} VALUES {', '.join(rows)}")  # noqa: S608
    return statements


def _daily_ddl() -> list[str]:
    days = sorted({f"{instant:%Y%m%d}" for instant in seed_instants()})
    statements = [
        f"""
        CREATE TABLE {DAILY_TABLE} (
            id integer NOT NULL,
            event_ts timestamp,
            day_key text
        ) PARTITION BY LIST (day_key)
        """
    ]
    statements += [
        f"CREATE TABLE {DAILY_TABLE}_d{day} PARTITION OF {DAILY_TABLE} "
        f"FOR VALUES IN ('{day}')"
        for day in days
    ]
    statements.append(
        f"CREATE TABLE {DAILY_TABLE}_default PARTITION OF {DAILY_TABLE} DEFAULT"
    )
    rows = [
        f"({index}, '{instant:%Y-%m-%d %H:%M:%S}', '{instant:%Y%m%d}')"
        for index, instant in enumerate(seed_instants(), start=1)
    ] + [f"({row_id}, {_sql_literal(ts)}, NULL)" for row_id, ts in NULL_KEY_ROWS]
    statements.append(f"INSERT INTO {DAILY_TABLE} VALUES {', '.join(rows)}")  # noqa: S608
    return statements


def _region_ddl() -> list[str]:
    statements = [
        f"""
        CREATE TABLE {REGION_TABLE} (
            id integer NOT NULL,
            country varchar(2),
            country_fixed char(2),
            region_key text
        ) PARTITION BY LIST (region_key)
        """
    ]
    statements += [
        f"CREATE TABLE {REGION_TABLE}_{region} PARTITION OF {REGION_TABLE} "
        f"FOR VALUES IN ('{region}')"
        for region in ("us", "fr", "de")
    ]
    statements.append(
        f"CREATE TABLE {REGION_TABLE}_default PARTITION OF {REGION_TABLE} DEFAULT"
    )
    rows = [
        (1, "US", "us"),
        (2, "US", "us"),
        (3, "FR", "fr"),
        (4, "DE", "de"),
        (5, "us", "us"),
        # A NULL partition key under a real business value.
        (6, "US", None),
    ]
    values = ", ".join(
        f"({row_id}, '{country}', '{country}', {_sql_literal(region)})"
        for row_id, country, region in rows
    )
    statements.append(f"INSERT INTO {REGION_TABLE} VALUES {values}")  # noqa: S608
    return statements


def _run_statements(database: Database, statements: list[str]) -> None:
    with database.get_sqla_engine() as engine:
        with engine.begin() as connection:
            for statement in statements:
                connection.exec_driver_sql(statement)


def _drop_tables(database: Database, *tables: str) -> None:
    # Dropping a partitioned table drops its partitions with it.
    _run_statements(database, [f"DROP TABLE IF EXISTS {table}" for table in tables])


@pytest.fixture(scope="module", autouse=True)
def require_postgres_examples() -> None:
    """
    Skip the whole module unless the examples database is PostgreSQL.

    Declarative partitioning and ``EXPLAIN (FORMAT JSON)`` are PostgreSQL
    features. Autouse at module scope, so it runs before any other fixture:
    on another backend nothing is seeded, logged in or dropped.
    """
    with app.app_context():
        if backend() != "postgresql":
            pytest.skip("Native partitioning is exercised on PostgreSQL only")


@pytest.fixture(scope="module")
def partitioned_tables() -> Iterator[None]:
    """Seed the shared partitioned tables once, and drop them however we exit."""
    with app.app_context():
        database = get_example_database()
        tables = (HOURLY_TABLE, DAILY_TABLE, REGION_TABLE)
        _drop_tables(database, *tables)
        try:
            _run_statements(
                database, _hourly_ddl(HOURLY_TABLE) + _daily_ddl() + _region_ddl()
            )
            yield
        finally:
            # Re-fetched: the tests' sessions have detached the one above.
            _drop_tables(get_example_database(), *tables)


@dataclass
class DatasetFactory:
    """Registers datasets over seeded tables and deletes them on teardown."""

    created: list[int] = field(default_factory=list)

    def __call__(
        self,
        table_name: str,
        *,
        partition_column: str | None = None,
        mapped_column: str | None = None,
        transform: str | None = None,
        is_monotonic: bool = True,
        editors: tuple[str, ...] = (ADMIN_USERNAME,),
    ) -> SqlaTable:
        database = get_example_database()
        dataset = SqlaTable(
            table_name=table_name,
            schema=get_example_default_schema(),
            database=database,
            editors=subjects_from_users(
                [security_manager.find_user(username) for username in editors]
            ),
        )
        db.session.add(dataset)
        db.session.commit()
        self.created.append(dataset.id)
        dataset.fetch_metadata()
        if partition_column:
            dataset.partition_column = partition_column
            dataset.partition_mapped_column = mapped_column
            column = next(
                col for col in dataset.columns if col.column_name == mapped_column
            )
            column.partition_value_transform = transform
            column.partition_transform_is_monotonic = is_monotonic
        db.session.commit()
        return dataset

    def cleanup(self) -> None:
        db.session.rollback()
        for dataset_id in self.created:
            if dataset := db.session.get(SqlaTable, dataset_id):
                db.session.delete(dataset)
        db.session.commit()


@pytest.fixture
def make_dataset(
    app_context: AppContext, partitioned_tables: None
) -> Iterator[DatasetFactory]:
    factory = DatasetFactory()
    try:
        yield factory
    finally:
        factory.cleanup()


@pytest.fixture
def hourly_pair(make_dataset: DatasetFactory) -> tuple[SqlaTable, SqlaTable]:
    """A dataset mapping ``event_ts`` onto ``hour_key``, and its unmapped twin."""
    mapped = make_dataset(
        HOURLY_TABLE,
        partition_column="hour_key",
        mapped_column="event_ts",
        transform=HOURLY_TRANSFORM,
    )
    return mapped, make_dataset(HOURLY_TABLE)


def chart_data(
    client: FlaskClient,
    dataset: SqlaTable,
    filters: list[dict[str, Any]],
    result_type: str = "full",
) -> dict[str, Any]:
    """POST a raw-records query for ``id`` and return the single query result."""
    payload = {
        "datasource": {"id": dataset.id, "type": "table"},
        "force": True,
        "result_type": result_type,
        "queries": [
            {
                "columns": ["id"],
                "filters": filters,
                "orderby": [["id", True]],
                "row_limit": 10000,
            }
        ],
    }
    response = client.post("/api/v1/chart/data", json=payload)
    assert response.status_code == 200, response.get_data(as_text=True)
    return json.loads(response.get_data(as_text=True))["result"][0]


def row_ids(result: dict[str, Any]) -> list[int]:
    return [row["id"] for row in result["data"]]


def scanned_relations(database: Database, sql: str) -> set[str]:
    """The tables and partitions PostgreSQL's plan for ``sql`` reads."""
    with database.get_sqla_engine() as engine:
        with engine.connect() as connection:
            plan = _explain(connection, sql)
    relations: set[str] = set()

    def visit(node: dict[str, Any]) -> None:
        if "Relation Name" in node:
            relations.add(node["Relation Name"])
        for child in node.get("Plans", []):
            visit(child)

    visit(plan[0]["Plan"])
    return relations


def _explain(connection: Connection, sql: str) -> list[dict[str, Any]]:
    # Driver-level execution: chart SQL carries `HH24:MI:SS` format strings that
    # SQLAlchemy's `text()` would read as bind parameters.
    statement = sql.strip().rstrip(";")
    return connection.exec_driver_sql(f"EXPLAIN (FORMAT JSON) {statement}").scalar()


def dataset_mapping_summary(client: FlaskClient, dataset: SqlaTable) -> dict[str, Any]:
    response = client.get(f"/api/v1/dataset/{dataset.id}")
    assert response.status_code == 200, response.get_data(as_text=True)
    return json.loads(response.get_data(as_text=True))["result"][
        "partition_filter_mapping"
    ]


# --------------------------------------------------------------------------
# Operator and type matrix
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class MirrorCase:
    """One filter on one documented mapping shape, and the mirror it should get."""

    id: str
    table: str
    partition_column: str
    mapped_column: str
    transform: str
    filter: dict[str, Any]
    # Fragments the mirrored statement carries; empty when it must carry none.
    mirror_fragments: tuple[str, ...]
    is_monotonic: bool = True

    @property
    def mirrors(self) -> bool:
        return bool(self.mirror_fragments)


def _hourly(
    case_id: str,
    op: str,
    val: Any,
    fragments: tuple[str, ...],
    *,
    is_monotonic: bool = True,
) -> MirrorCase:
    return MirrorCase(
        id=case_id,
        table=HOURLY_TABLE,
        partition_column="hour_key",
        mapped_column="event_ts",
        transform=HOURLY_TRANSFORM,
        filter={"col": "event_ts", "op": op, "val": val},
        mirror_fragments=fragments,
        is_monotonic=is_monotonic,
    )


def _daily(case_id: str, op: str, val: Any, fragments: tuple[str, ...]) -> MirrorCase:
    return MirrorCase(
        id=case_id,
        table=DAILY_TABLE,
        partition_column="day_key",
        mapped_column="event_ts",
        transform=DAILY_TRANSFORM,
        filter={"col": "event_ts", "op": op, "val": val},
        mirror_fragments=fragments,
    )


def _region(
    case_id: str, column: str, op: str, val: Any, fragments: tuple[str, ...]
) -> MirrorCase:
    return MirrorCase(
        id=case_id,
        table=REGION_TABLE,
        partition_column="region_key",
        mapped_column=column,
        transform=REGION_TRANSFORM,
        filter={"col": column, "op": op, "val": val},
        mirror_fragments=fragments,
    )


HOUR_NULL = "hour_key IS NULL"

MIRROR_CASES = [
    # Monotonic hourly epoch key under a TIMESTAMP column.
    _hourly(
        # Spans the NULL-key row at 10:15, which only the IS NULL escape keeps.
        "hourly-time-range-off-boundary",
        "TEMPORAL_RANGE",
        "2026-03-01T09:47:23 : 2026-03-02T00:00:00",
        (
            f"hour_key >= {hour_key('2026-03-01 09:00:00')}",
            # The strict end bound mirrors non-strictly, onto midnight's bucket.
            f"hour_key <= {hour_key('2026-03-02 00:00:00')}",
            HOUR_NULL,
        ),
    ),
    _hourly(
        "hourly-equals-last-second",
        "==",
        "2026-03-01T23:59:59",
        (f"hour_key = {hour_key('2026-03-01 23:00:00')}", HOUR_NULL),
    ),
    _hourly(
        "hourly-in-midnight-and-off-boundary",
        "IN",
        ["2026-03-02T00:00:00", "2026-03-01T05:47:23"],
        (
            "hour_key IN (",
            str(hour_key("2026-03-02 00:00:00")),
            str(hour_key("2026-03-01 05:00:00")),
            HOUR_NULL,
        ),
    ),
    _hourly(
        "hourly-greater-than-mirrors-non-strictly",
        ">",
        "2026-03-02T12:47:23",
        (f"hour_key >= {hour_key('2026-03-02 12:00:00')}", HOUR_NULL),
    ),
    _hourly(
        "hourly-greater-or-equal-on-boundary",
        ">=",
        "2026-03-02T12:00:00",
        (f"hour_key >= {hour_key('2026-03-02 12:00:00')}", HOUR_NULL),
    ),
    _hourly(
        "hourly-less-than-mid-bucket-mirrors-non-strictly",
        "<",
        "2026-03-01T10:47:23",
        (f"hour_key <= {hour_key('2026-03-01 10:00:00')}", HOUR_NULL),
    ),
    _hourly(
        "hourly-less-or-equal-last-second",
        "<=",
        "2026-03-01T10:59:59",
        (f"hour_key <= {hour_key('2026-03-01 10:00:00')}", HOUR_NULL),
    ),
    _hourly("hourly-not-equals-never-mirrors", "!=", "2026-03-01T10:47:23", ()),
    _hourly(
        "hourly-not-in-never-mirrors",
        "NOT IN",
        ["2026-03-01T10:47:23", "2026-03-02T00:00:00"],
        (),
    ),
    _hourly("hourly-is-null-never-mirrors", "IS NULL", None, ()),
    # The same key with ordering not declared: only equality mirrors.
    _hourly(
        "unordered-equals-mirrors",
        "==",
        "2026-03-01T10:47:23",
        (f"hour_key = {hour_key('2026-03-01 10:00:00')}", HOUR_NULL),
        is_monotonic=False,
    ),
    _hourly(
        "unordered-range-does-not-mirror",
        ">=",
        "2026-03-02T12:00:00",
        (),
        is_monotonic=False,
    ),
    _hourly(
        "unordered-time-range-does-not-mirror",
        "TEMPORAL_RANGE",
        "2026-03-01T10:47:23 : 2026-03-02T00:00:00",
        (),
        is_monotonic=False,
    ),
    # Text day key, `to_char(..., 'YYYYMMDD')`.
    _daily(
        "daily-text-key-time-range",
        "TEMPORAL_RANGE",
        "2026-03-01T10:47:23 : 2026-03-01T23:59:59",
        ("day_key >= '20260301'", "day_key <= '20260301'", "day_key IS NULL"),
    ),
    _daily(
        "daily-text-key-equals-midnight",
        "==",
        "2026-03-02T00:00:00",
        ("day_key = '20260302'", "day_key IS NULL"),
    ),
    _daily(
        "daily-text-key-less-than-midnight-mirrors-non-strictly",
        "<",
        "2026-03-02T00:00:00",
        ("day_key <= '20260302'", "day_key IS NULL"),
    ),
    # Text business column: VARCHAR compares exactly on PostgreSQL and mirrors.
    _region(
        "varchar-equals",
        "country",
        "==",
        "US",
        ("region_key = 'us'", "region_key IS NULL"),
    ),
    _region(
        "varchar-in",
        "country",
        "IN",
        ["US", "FR"],
        ("region_key IN ('us', 'fr')", "region_key IS NULL"),
    ),
    _region("varchar-not-equals-never-mirrors", "country", "!=", "US", ()),
    _region("varchar-like-never-mirrors", "country", "LIKE", "U%", ()),
    # A fixed-width `char(2)` (`bpchar`) ignores trailing blanks: never mirrored.
    _region("bpchar-equals-does-not-mirror", "country_fixed", "==", "US", ()),
    _region("bpchar-in-does-not-mirror", "country_fixed", "IN", ["US", "FR"], ()),
    # `char(2)` matches 'US ' against a stored 'US'; `lower('US ')` is 'us '.
    _region(
        "bpchar-equals-padded-value-does-not-mirror",
        "country_fixed",
        "==",
        "US ",
        (),
    ),
]


@pytest.fixture
def mirror_case_pair(
    request: pytest.FixtureRequest, make_dataset: DatasetFactory
) -> tuple[MirrorCase, SqlaTable, SqlaTable]:
    case: MirrorCase = request.param
    mapped = make_dataset(
        case.table,
        partition_column=case.partition_column,
        mapped_column=case.mapped_column,
        transform=case.transform,
        is_monotonic=case.is_monotonic,
    )
    return case, mapped, make_dataset(case.table)


@pytest.mark.parametrize(
    "mirror_case_pair",
    MIRROR_CASES,
    ids=[case.id for case in MIRROR_CASES],
    indirect=True,
)
@with_feature_flags(PARTITION_FILTER_MAPPING=True)
def test_mapped_chart_returns_same_rows_as_unmapped_dataset(
    test_client: FlaskClient,
    login_as_admin: None,
    mirror_case_pair: tuple[MirrorCase, SqlaTable, SqlaTable],
) -> None:
    case, mapped, unmapped = mirror_case_pair

    mapped_ids = row_ids(chart_data(test_client, mapped, [case.filter]))
    unmapped_ids = row_ids(chart_data(test_client, unmapped, [case.filter]))

    assert unmapped_ids, "the case must select rows to prove anything"
    assert mapped_ids == unmapped_ids


@pytest.mark.parametrize(
    "mirror_case_pair",
    MIRROR_CASES,
    ids=[case.id for case in MIRROR_CASES],
    indirect=True,
)
@with_feature_flags(PARTITION_FILTER_MAPPING=True)
def test_view_query_carries_mirror_only_for_documented_operators(
    test_client: FlaskClient,
    login_as_admin: None,
    mirror_case_pair: tuple[MirrorCase, SqlaTable, SqlaTable],
) -> None:
    case, mapped, _ = mirror_case_pair

    sql = chart_data(test_client, mapped, [case.filter], result_type="query")["query"]

    if case.mirrors:
        for fragment in case.mirror_fragments:
            assert fragment in sql, f"{fragment!r} missing from:\n{sql}"
    else:
        assert case.partition_column not in sql, sql


# --------------------------------------------------------------------------
# Pruning
# --------------------------------------------------------------------------

HOURLY_RANGE_FILTER = {
    "col": "event_ts",
    "op": "TEMPORAL_RANGE",
    "val": "2026-03-01T09:47:23 : 2026-03-02T00:00:00",
}
# Hours 9 through 23 of the first day, midnight of the second (the end bound
# mirrors non-strictly) and the default partition the IS NULL escape admits.
HOURLY_RANGE_PARTITIONS = {f"{HOURLY_TABLE}_h{hour:02d}" for hour in range(9, 25)} | {
    f"{HOURLY_TABLE}_default"
}
ALL_HOURLY_PARTITIONS = {f"{HOURLY_TABLE}_h{hour:02d}" for hour in range(48)} | {
    f"{HOURLY_TABLE}_default"
}


@with_feature_flags(PARTITION_FILTER_MAPPING=True)
def test_mirrored_query_plan_reads_only_matching_hour_partitions(
    test_client: FlaskClient,
    login_as_admin: None,
    hourly_pair: tuple[SqlaTable, SqlaTable],
) -> None:
    mapped, _ = hourly_pair
    sql = chart_data(test_client, mapped, [HOURLY_RANGE_FILTER], "query")["query"]

    relations = scanned_relations(mapped.database, sql)

    assert relations == HOURLY_RANGE_PARTITIONS
    assert len(relations) < len(ALL_HOURLY_PARTITIONS)


@with_feature_flags(PARTITION_FILTER_MAPPING=True)
def test_unmapped_query_plan_reads_every_hour_partition(
    test_client: FlaskClient,
    login_as_admin: None,
    hourly_pair: tuple[SqlaTable, SqlaTable],
) -> None:
    _, unmapped = hourly_pair
    sql = chart_data(test_client, unmapped, [HOURLY_RANGE_FILTER], "query")["query"]

    relations = scanned_relations(unmapped.database, sql)

    assert relations == ALL_HOURLY_PARTITIONS


@with_feature_flags(PARTITION_FILTER_MAPPING=True)
def test_mirrored_text_day_key_plan_reads_one_day_and_default_partition(
    test_client: FlaskClient,
    login_as_admin: None,
    make_dataset: DatasetFactory,
) -> None:
    mapped = make_dataset(
        DAILY_TABLE,
        partition_column="day_key",
        mapped_column="event_ts",
        transform=DAILY_TRANSFORM,
    )
    day_filter = {
        "col": "event_ts",
        "op": "TEMPORAL_RANGE",
        "val": "2026-03-01T10:47:23 : 2026-03-01T23:59:59",
    }
    sql = chart_data(test_client, mapped, [day_filter], "query")["query"]

    relations = scanned_relations(mapped.database, sql)

    assert relations == {f"{DAILY_TABLE}_d20260301", f"{DAILY_TABLE}_default"}


# --------------------------------------------------------------------------
# Partition column gone from the warehouse
# --------------------------------------------------------------------------


@pytest.fixture
def renamed_key_table(app_context: AppContext) -> Iterator[str]:
    database = get_example_database()
    _drop_tables(database, RENAMED_TABLE)
    try:
        _run_statements(database, _hourly_ddl(RENAMED_TABLE))
        yield RENAMED_TABLE
    finally:
        _drop_tables(database, RENAMED_TABLE)


@pytest.fixture
def dropped_key_table(
    app_context: AppContext, partitioned_tables: None
) -> Iterator[str]:
    # PostgreSQL refuses to drop a partition key column, so the dropped case
    # runs on an unpartitioned copy; the recovery does not depend on the layout.
    database = get_example_database()
    _drop_tables(database, DROPPED_TABLE)
    try:
        copy_table = f"CREATE TABLE {DROPPED_TABLE} AS SELECT * FROM {HOURLY_TABLE}"  # noqa: S608
        _run_statements(database, [copy_table])
        yield DROPPED_TABLE
    finally:
        _drop_tables(database, DROPPED_TABLE)


@pytest.mark.parametrize(
    ("table_fixture", "alteration"),
    [
        ("renamed_key_table", "RENAME COLUMN hour_key TO hour_bucket"),
        ("dropped_key_table", "DROP COLUMN hour_key"),
    ],
    ids=["renamed", "dropped"],
)
@with_feature_flags(PARTITION_FILTER_MAPPING=True)
def test_chart_falls_back_to_unpruned_rows_when_partition_column_is_gone(
    test_client: FlaskClient,
    login_as_admin: None,
    make_dataset: DatasetFactory,
    request: pytest.FixtureRequest,
    table_fixture: str,
    alteration: str,
) -> None:
    table = request.getfixturevalue(table_fixture)
    mapped = make_dataset(
        table,
        partition_column="hour_key",
        mapped_column="event_ts",
        transform=HOURLY_TRANSFORM,
    )
    unmapped = make_dataset(table)
    expected_ids = row_ids(chart_data(test_client, unmapped, [HOURLY_RANGE_FILTER]))
    _run_statements(mapped.database, [f"ALTER TABLE {table} {alteration}"])

    result = chart_data(test_client, mapped, [HOURLY_RANGE_FILTER])

    assert row_ids(result) == expected_ids
    assert "hour_key" not in result["query"]


# --------------------------------------------------------------------------
# Preview endpoint: real roles, no patched editorship check
# --------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("username", "dataset_editor", "expected_status"),
    [
        (ALPHA_USERNAME, ALPHA_USERNAME, 200),
        (ADMIN_USERNAME, ALPHA_USERNAME, 200),
        (ALPHA_USERNAME, ADMIN_USERNAME, 403),
        (GAMMA_USERNAME, ALPHA_USERNAME, 403),
    ],
    ids=[
        "alpha-editor-allowed",
        "admin-non-editor-allowed",
        "alpha-non-editor-forbidden",
        "gamma-forbidden",
    ],
)
@with_feature_flags(PARTITION_FILTER_MAPPING=True)
def test_preview_access_follows_dataset_editorship(
    test_client: FlaskClient,
    login_as: Callable[..., None],
    make_dataset: DatasetFactory,
    username: str,
    dataset_editor: str,
    expected_status: int,
) -> None:
    dataset = make_dataset(HOURLY_TABLE, editors=(dataset_editor,))
    login_as(username)

    response = test_client.post(
        f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/",
        json=PREVIEW_PAYLOAD,
    )

    assert response.status_code == expected_status, response.get_data(as_text=True)


@with_feature_flags(PARTITION_FILTER_MAPPING=True)
def test_preview_for_editor_evaluates_transform_on_postgres(
    test_client: FlaskClient,
    login_as: Callable[..., None],
    make_dataset: DatasetFactory,
) -> None:
    dataset = make_dataset(HOURLY_TABLE, editors=(ALPHA_USERNAME,))
    login_as(ALPHA_USERNAME)

    response = test_client.post(
        f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/",
        json=PREVIEW_PAYLOAD,
    )

    result = json.loads(response.get_data(as_text=True))["result"]
    assert result["valid"] is True
    assert str(hour_key("2026-03-01 10:00:00")) in result["emitted_predicate"]


@with_feature_flags(PARTITION_FILTER_MAPPING=False)
def test_preview_is_not_found_when_flag_is_off(
    test_client: FlaskClient,
    login_as_admin: None,
    make_dataset: DatasetFactory,
) -> None:
    dataset = make_dataset(HOURLY_TABLE)

    response = test_client.post(
        f"/api/v1/dataset/{dataset.id}/partition_mapping/preview/",
        json=PREVIEW_PAYLOAD,
    )

    assert response.status_code == 404


# --------------------------------------------------------------------------
# Mirror verdict through the Redis cache
# --------------------------------------------------------------------------


@pytest.fixture
def redis_cache(app_context: AppContext) -> None:
    """The verdict lives in ``CACHE_CONFIG``; insist it is the real Redis one."""
    backend = type(cache_manager.cache.cache).__name__
    assert backend == "RedisCache", f"CACHE_CONFIG resolves to {backend}"


@with_feature_flags(PARTITION_FILTER_MAPPING=True)
def test_first_chart_marks_mapping_evaluable(
    test_client: FlaskClient,
    login_as_admin: None,
    redis_cache: None,
    hourly_pair: tuple[SqlaTable, SqlaTable],
) -> None:
    mapped, _ = hourly_pair
    assert dataset_mapping_summary(test_client, mapped)["evaluable"] is None

    chart_data(test_client, mapped, [HOURLY_RANGE_FILTER])

    assert dataset_mapping_summary(test_client, mapped)["evaluable"] is True


@with_feature_flags(PARTITION_FILTER_MAPPING=True)
def test_verdict_does_not_carry_over_to_mapping_on_another_column(
    test_client: FlaskClient,
    login_as_admin: None,
    redis_cache: None,
    hourly_pair: tuple[SqlaTable, SqlaTable],
) -> None:
    mapped, _ = hourly_pair
    chart_data(test_client, mapped, [HOURLY_RANGE_FILTER])
    assert dataset_mapping_summary(test_client, mapped)["evaluable"] is True

    # Same dataset, mapped column and transform; only the partition column moves.
    mapped.partition_column = "backup_hour_key"
    db.session.commit()

    summary = dataset_mapping_summary(test_client, mapped)
    assert summary["partition_column"] == "backup_hour_key"
    assert summary["active"] is True
    assert summary["evaluable"] is None
