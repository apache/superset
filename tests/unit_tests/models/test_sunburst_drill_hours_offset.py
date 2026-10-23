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
"""A Sunburst drill on a grained temporal ring returns that ring's rows.

The Sunburst groups a grained temporal level through a ``BASE_AXIS`` column,
which applies the dataset Hours offset before time grain truncation. Drill to
detail and Drill by send equality plus grain. The filter must shift the
column before truncation, just as grouping does, and survive query-context
time-range and granularity overrides.
"""

from __future__ import annotations

from collections.abc import Callable
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import cast

import pytest
from flask import Flask
from pytest_mock import MockerFixture
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm.session import Session
from sqlalchemy.pool import StaticPool

from superset.common.query_context_factory import QueryContextFactory
from superset.common.query_object import QueryObject
from superset.connectors.sqla.models import SqlaTable, TableColumn
from superset.models.core import Database
from superset.superset_typing import AdhocColumn, QueryObjectDict
from superset.utils.core import QueryObjectFilterClause

# Raw (stored) timestamps. With a +5h offset, the first row is locally
# 2026-08-01 01:00 (August) and the last is locally 2026-09-01 01:00
# (September), so a filter that ignores the offset moves both across months.
ROWS = [
    ("2026-07-31 20:00:00", "a"),
    ("2026-08-10 12:00:00", "a"),
    ("2026-08-20 12:00:00", "b"),
    ("2026-08-31 18:59:59", "b"),
    ("2026-08-31 20:00:00", "c"),
    ("2026-09-15 12:00:00", "b"),
]


@pytest.fixture
def events_table(mocker: MockerFixture, session: Session) -> SqlaTable:
    SqlaTable.metadata.create_all(session.get_bind())
    engine: Engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    connection = engine.raw_connection()
    connection.execute("CREATE TABLE events (order_date TIMESTAMP, kind TEXT)")
    for ts, kind in ROWS:
        connection.execute("INSERT INTO events VALUES (?, ?)", (ts, kind))
    connection.commit()

    database = Database(database_name="db", sqlalchemy_uri="sqlite://")

    @contextmanager
    def mock_get_sqla_engine(catalog=None, schema=None, **kwargs):
        yield engine

    mocker.patch.object(database, "get_sqla_engine", new=mock_get_sqla_engine)
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
        return_value=[],
    )
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.is_guest_user",
        return_value=False,
    )
    return SqlaTable(
        database=database,
        schema=None,
        table_name="events",
        offset=5,
        columns=[
            TableColumn(column_name="order_date", is_dttm=True, type="TIMESTAMP"),
            TableColumn(column_name="kind", type="TEXT"),
        ],
    )


def _ring_counts(table: SqlaTable) -> dict[str, int]:
    """Row count per month bucket, grouped the way Sunburst buildQuery does."""
    query_object = QueryObject(
        datasource=table,
        metrics=[{"expressionType": "SQL", "sqlExpression": "COUNT(*)", "label": "ct"}],
        columns=[
            AdhocColumn(
                timeGrain="P1M",
                columnType="BASE_AXIS",
                sqlExpression="order_date",
                label="order_date",
                isColumnReference=True,
            )
        ],
        extras={"time_grain_sqla": "P1M"},
        row_limit=100,
    )
    df = table.get_query_result(query_object).df
    return {
        ts.strftime("%Y-%m-%dT%H:%M:%S"): int(ct)
        for ts, ct in zip(df["order_date"], df["ct"], strict=True)
    }


def _drill_filter(since: str) -> QueryObjectFilterClause:
    """Use the raw chart-data bucket value and its grain, as the frontend does."""
    return {
        "col": "order_date",
        "op": "==",
        "val": int(
            datetime.fromisoformat(since).replace(tzinfo=timezone.utc).timestamp()
            * 1000
        ),
        "grain": "P1M",
    }


def _drill_to_detail_counts(table: SqlaTable, since: str) -> dict[str, int]:
    query_object = QueryObject(
        datasource=table,
        columns=["order_date", "kind"],
        metrics=[],
        filters=[_drill_filter(since)],
        row_limit=100,
    )
    counts = table.get_query_result(query_object).df["kind"].value_counts()
    return {str(kind): int(count) for kind, count in counts.items()}


def _drill_by_counts(table: SqlaTable, since: str) -> dict[str, int]:
    query_object = QueryObject(
        datasource=table,
        columns=["kind"],
        metrics=[{"expressionType": "SQL", "sqlExpression": "COUNT(*)", "label": "ct"}],
        filters=[_drill_filter(since)],
        row_limit=100,
    )
    df = table.get_query_result(query_object).df
    return {
        str(kind): int(count) for kind, count in zip(df["kind"], df["ct"], strict=True)
    }


def test_sunburst_ring_buckets_apply_the_hours_offset(
    events_table: SqlaTable, app: Flask
) -> None:
    with app.test_request_context():
        counts = _ring_counts(events_table)

    assert counts == {
        "2026-08-01T00:00:00": 4,
        "2026-09-01T00:00:00": 2,
    }


@pytest.mark.parametrize("drill_count", [_drill_to_detail_counts, _drill_by_counts])
def test_sunburst_drill_grain_matches_ring_bucket_with_hours_offset(
    events_table: SqlaTable,
    app: Flask,
    drill_count: Callable[[SqlaTable, str], dict[str, int]],
) -> None:
    """Every ring bucket's drill returns exactly the rows the ring counted."""
    with app.test_request_context():
        counts = _ring_counts(events_table)
        drilled = {since: drill_count(events_table, since) for since in counts}

    assert drilled == {
        "2026-08-01T00:00:00": {"a": 2, "b": 2},
        "2026-09-01T00:00:00": {"b": 1, "c": 1},
    }
    assert {bucket: sum(kinds.values()) for bucket, kinds in drilled.items()} == counts


def test_sunburst_drill_grained_column_is_shifted_by_hours_offset(
    events_table: SqlaTable, app: Flask
) -> None:
    """The drill filters the same offset-before-truncation expression as grouping."""
    query_obj: QueryObjectDict = {
        "granularity": None,
        "from_dttm": None,
        "to_dttm": None,
        "is_timeseries": False,
        "filter": [_drill_filter("2026-08-01T00:00:00")],
        "metrics": [],
        "columns": ["order_date", "kind"],
    }
    with app.test_request_context():
        sql = events_table.get_query_str_extended(query_obj, mutate=False).sql

    assert "DATETIME(order_date, '+5 hours')" in sql, sql
    assert "'2026-08-01 00:00:00'" in sql, sql


@pytest.mark.parametrize("via_adhoc", [False, True])
@pytest.mark.parametrize("result_type", ["samples", "drill_detail", "full"])
@pytest.mark.parametrize("granularity", [None, "order_date"])
def test_sunburst_factory_drill_preserves_bucket_with_time_range(
    events_table: SqlaTable,
    app: Flask,
    mocker: MockerFixture,
    result_type: str,
    granularity: str | None,
    via_adhoc: bool,
) -> None:
    """Samples and chart-data keep the grained equality beside range overrides."""
    from superset.common.chart_data import ChartDataResultType
    from superset.common.form_data_query_context import adhoc_filters_to_query_filters
    from superset.utils.core import simple_filter_to_adhoc

    filters: list[QueryObjectFilterClause] = [
        {"col": "order_date", "op": "TEMPORAL_RANGE", "val": "No filter"},
        {"col": "order_date", "op": "==", "val": 1785542400000, "grain": "P1M"},
    ]
    if via_adhoc:
        filters = cast(
            list[QueryObjectFilterClause],
            adhoc_filters_to_query_filters(
                [dict(simple_filter_to_adhoc(filter_)) for filter_ in filters]
            ),
        )

    mocker.patch.object(
        QueryContextFactory, "_convert_to_model", return_value=events_table
    )
    with app.test_request_context():
        context = QueryContextFactory().create(
            datasource={"id": 1, "type": "table"},
            result_type=ChartDataResultType(result_type),
            form_data={"extra_form_data": {"time_range": "2026-07-01 : 2026-10-01"}},
            queries=[
                {
                    "columns": ["order_date", "kind"]
                    if result_type != "full"
                    else ["kind"],
                    "metrics": []
                    if result_type != "full"
                    else [
                        {
                            "expressionType": "SQL",
                            "sqlExpression": "COUNT(*)",
                            "label": "ct",
                        }
                    ],
                    "granularity": granularity,
                    "time_range": "2026-07-01 : 2026-10-01",
                    "filters": filters,
                    "row_limit": 100,
                }
            ],
        )
        query = context.queries[0]
        assert any(f.get("grain") == "P1M" for f in query.filter)
        df = events_table.get_query_result(query).df
    assert (len(df) if result_type != "full" else int(df["ct"].sum())) == 4
    if result_type != "full":
        assert sorted(df["kind"].tolist()) == ["a", "a", "b", "b"]
    else:
        assert dict(zip(df["kind"], df["ct"], strict=True)) == {"a": 2, "b": 2}


@pytest.mark.parametrize("lookup", [["order_date"], "order_date", 1])
def test_sunburst_malformed_lookup_is_ignored(lookup: object) -> None:
    """Malformed metadata must not crash the form-data query entry point."""
    from superset.common.form_data_query_context import (
        build_query_objects_from_form_data,
    )

    [query] = build_query_objects_from_form_data(
        {
            "viz_type": "sunburst_v2",
            "columns": ["order_date"],
            "time_grain_sqla": "P1M",
            "temporal_columns_lookup": lookup,
        }
    )
    assert query["columns"] == ["order_date"]
    assert "time_grain_sqla" not in query.get("extras", {})


@pytest.mark.parametrize("subject", ["order_date", "ship_date", "created_at"])
def test_sunburst_time_column_does_not_disable_lookup_grains(
    subject: str,
) -> None:
    """A Time Column must not suppress other temporal hierarchy levels."""
    from superset.common.form_data_query_context import (
        build_query_objects_from_form_data,
    )

    form_data = {
        "viz_type": "sunburst_v2",
        "columns": ["order_date", "ship_date"],
        "time_grain_sqla": "P1M",
        "granularity_sqla": subject,
    }
    [saved] = build_query_objects_from_form_data(form_data)
    [explore] = build_query_objects_from_form_data(
        {
            **form_data,
            "temporal_columns_lookup": {"order_date": True, "ship_date": True},
        }
    )
    assert [column["sqlExpression"] for column in explore["columns"]] == [
        "order_date",
        "ship_date",
    ]
    assert all(column["timeGrain"] == "P1M" for column in explore["columns"])
    for column, name in zip(saved["columns"], ["order_date", "ship_date"], strict=True):
        if name == subject:
            assert column["timeGrain"] == "P1M"
        else:
            assert column == name


@pytest.mark.parametrize("viz_type", ["table", "echarts_timeseries_line"])
@pytest.mark.parametrize(
    "filter_, expected",
    [
        (
            {"col": "order_date", "op": "==", "val": "2026-08-10 12:00:00"},
            {"a": 1},
        ),
        (
            {
                "col": "order_date",
                "op": "IN",
                "val": ["2026-08-10 12:00:00", "2026-08-20 12:00:00"],
            },
            {"a": 1, "b": 1},
        ),
        (_drill_filter("2026-08-01T00:00:00"), {"a": 2, "b": 2}),
        (
            {"col": "order_date", "op": "==", "val": "2026-09-15 12:00:00"},
            {},
        ),
    ],
    ids=["equality", "membership", "grained-equality", "outside-range"],
)
def test_non_sunburst_granularity_preserves_independent_filters(
    events_table: SqlaTable,
    app: Flask,
    mocker: MockerFixture,
    viz_type: str,
    filter_: QueryObjectFilterClause,
    expected: dict[str, int],
) -> None:
    """Time Column overrides replace ranges, not equality/membership predicates."""
    mocker.patch.object(
        QueryContextFactory, "_convert_to_model", return_value=events_table
    )
    time_range = "2026-07-01 : 2026-09-10"
    form_data: dict[str, object] = {
        "viz_type": viz_type,
        "extra_form_data": {"time_range": time_range},
    }
    columns: list[str] = ["kind"]
    if viz_type == "echarts_timeseries_line":
        # Exercise the temporal x-axis branch as well as Table's range fallback.
        form_data["x_axis"] = "order_date"
        columns.insert(0, "order_date")
    with app.test_request_context():
        context = QueryContextFactory().create(
            datasource={"id": 1, "type": "table"},
            form_data=form_data,
            queries=[
                {
                    "columns": columns,
                    "metrics": [
                        {
                            "expressionType": "SQL",
                            "sqlExpression": "COUNT(*)",
                            "label": "ct",
                        }
                    ],
                    "granularity": "order_date",
                    "time_range": time_range,
                    "extras": {"time_grain_sqla": "P1M"},
                    "filters": [
                        {
                            "col": "order_date",
                            "op": "TEMPORAL_RANGE",
                            "val": "No filter",
                        },
                        filter_,
                    ],
                    "row_limit": 100,
                }
            ],
        )
        query = context.queries[0]
        df = events_table.get_query_result(query).df

    assert df.groupby("kind")["ct"].sum().to_dict() == expected
    assert query.filter == [filter_]


@pytest.mark.parametrize("result_type", ["samples", "drill_detail", "full"])
@pytest.mark.parametrize("bucket", ["2026-08-01", "2026-09-01"])
@pytest.mark.parametrize("viz_type", [None, "echarts_timeseries_line"])
def test_timeseries_samples_with_swapped_time_column_drops_stale_drill_filter(
    events_table: SqlaTable,
    app: Flask,
    mocker: MockerFixture,
    result_type: str,
    bucket: str,
    viz_type: str | None,
) -> None:
    """Minimal dashboard samples must not filter the replaced x-axis column."""
    from superset.common.chart_data import ChartDataResultType

    events_table.offset = 0
    events_table.columns.append(
        TableColumn(column_name="ship_date", is_dttm=True, type="TIMESTAMP")
    )
    with events_table.database.get_sqla_engine() as engine, engine.begin() as conn:
        conn.execute(text("ALTER TABLE events ADD COLUMN ship_date TIMESTAMP"))
        for (order_date, _), ship_date in zip(
            ROWS,
            [
                "2026-08-01",
                "2026-09-01",
                "2026-09-02",
                "2026-08-02",
                "2026-09-03",
                "2026-08-03",
            ],
            strict=True,
        ):
            conn.execute(
                text("UPDATE events SET ship_date = :ship WHERE order_date = :order"),
                {"ship": f"{ship_date} 12:00:00", "order": order_date},
            )
    mocker.patch.object(
        QueryContextFactory, "_convert_to_model", return_value=events_table
    )
    until = "2026-09-01" if bucket == "2026-08-01" else "2026-10-01"
    form_data: dict[str, object] = {"dashboardId": 1}
    if viz_type:
        form_data["viz_type"] = viz_type
    with app.test_request_context():
        context = QueryContextFactory().create(
            datasource={"id": 1, "type": "table"},
            result_type=ChartDataResultType(result_type),
            form_data=form_data,
            queries=[
                {
                    "columns": ["order_date", "ship_date", "kind"],
                    "metrics": [],
                    "granularity": "ship_date",
                    "time_range": f"{bucket} : {until}",
                    "filters": [
                        {
                            "col": "order_date",
                            "op": "TEMPORAL_RANGE",
                            "val": "No filter",
                        },
                        _drill_filter(bucket),
                    ],
                    "row_limit": 100,
                }
            ],
        )
        query = context.queries[0]
        assert query.filter == []
        df = events_table.get_query_result(query).df
    expected = [
        ROWS[i][0] for i in ([0, 3, 5] if bucket == "2026-08-01" else [1, 2, 4])
    ]
    assert sorted(str(value) for value in df["order_date"]) == sorted(expected)


@pytest.mark.parametrize("result_type", ["samples", "drill_detail", "full"])
@pytest.mark.parametrize("time_column_source", ["dashboard", "saved"])
def test_sunburst_factory_drill_keeps_bucket_on_different_time_column(
    events_table: SqlaTable,
    app: Flask,
    mocker: MockerFixture,
    result_type: str,
    time_column_source: str,
) -> None:
    """An independent Sunburst ring remains filtered under a Time Column override."""
    from superset.common.chart_data import ChartDataResultType

    events_table.columns.append(
        TableColumn(column_name="ship_date", is_dttm=True, type="TIMESTAMP")
    )
    with events_table.database.get_sqla_engine() as engine, engine.begin() as conn:
        conn.execute(text("ALTER TABLE events ADD COLUMN ship_date TIMESTAMP"))
        conn.execute(text("UPDATE events SET ship_date = '2026-08-15 12:00:00'"))
    mocker.patch.object(
        QueryContextFactory, "_convert_to_model", return_value=events_table
    )
    time_range = "2026-07-01 : 2026-10-01"
    form_data: dict[str, object] = {
        "viz_type": "sunburst_v2",
        **(
            {
                "extra_form_data": {
                    "granularity_sqla": "ship_date",
                    "time_range": time_range,
                }
            }
            if time_column_source == "dashboard"
            else {"granularity_sqla": "ship_date", "time_range": time_range}
        ),
    }
    with app.test_request_context():
        context = QueryContextFactory().create(
            datasource={"id": 1, "type": "table"},
            result_type=ChartDataResultType(result_type),
            form_data=form_data,
            queries=[
                {
                    "columns": ["kind"]
                    if result_type == "full"
                    else ["order_date", "kind"],
                    "metrics": [
                        {
                            "expressionType": "SQL",
                            "sqlExpression": "COUNT(*)",
                            "label": "ct",
                        }
                    ]
                    if result_type == "full"
                    else [],
                    "granularity": "ship_date",
                    "time_range": time_range,
                    "filters": [
                        {
                            "col": "order_date",
                            "op": "TEMPORAL_RANGE",
                            "val": "No filter",
                        },
                        _drill_filter("2026-08-01"),
                    ],
                    "row_limit": 100,
                }
            ],
        )
        df = events_table.get_query_result(context.queries[0]).df
    if result_type == "full":
        assert dict(zip(df["kind"], df["ct"], strict=True)) == {"a": 2, "b": 2}
    else:
        assert sorted(str(value) for value in df["order_date"]) == sorted(
            order_date for order_date, _ in ROWS[:4]
        )
        assert sorted(df["kind"].tolist()) == ["a", "a", "b", "b"]


@pytest.mark.parametrize("result_type", ["samples", "drill_detail", "full"])
def test_sunburst_factory_drops_extra_filter_on_replaced_time_column(
    events_table: SqlaTable,
    app: Flask,
    mocker: MockerFixture,
    result_type: str,
) -> None:
    """A swapped dashboard axis must not filter a Sunburst's independent level."""
    from superset.common.chart_data import ChartDataResultType

    events_table.offset = 0
    events_table.columns.append(
        TableColumn(column_name="ship_date", is_dttm=True, type="TIMESTAMP")
    )
    with events_table.database.get_sqla_engine() as engine, engine.begin() as conn:
        conn.execute(text("ALTER TABLE events ADD COLUMN ship_date TIMESTAMP"))
        conn.execute(text("UPDATE events SET ship_date = '2026-08-01 12:00:00'"))
        conn.execute(
            text(
                "INSERT INTO events VALUES "
                "('2026-08-01 12:00:00', 'z', '2026-12-25 12:00:00')"
            )
        )
    mocker.patch.object(
        QueryContextFactory, "_convert_to_model", return_value=events_table
    )
    independent_filter = _drill_filter("2026-08-01")
    with app.test_request_context():
        context = QueryContextFactory().create(
            datasource={"id": 1, "type": "table"},
            result_type=ChartDataResultType(result_type),
            form_data={
                "viz_type": "sunburst_v2",
                "extra_form_data": {"granularity_sqla": "ship_date"},
            },
            queries=[
                {
                    "columns": ["order_date", "kind"],
                    "metrics": [],
                    "granularity": "ship_date",
                    "filters": [
                        {
                            "col": "order_date",
                            "op": "TEMPORAL_RANGE",
                            "val": "No filter",
                        },
                        {
                            "col": "order_date",
                            "op": "IN",
                            "val": ["2026-08-01 12:00:00"],
                            "isExtra": True,
                        },
                        independent_filter,
                    ],
                    "row_limit": 100,
                }
            ],
        )
        query = context.queries[0]
        df = events_table.get_query_result(query).df
    assert sorted(df["kind"].tolist()) == ["a", "b", "b", "c", "z"]
    assert query.filter == [independent_filter]
