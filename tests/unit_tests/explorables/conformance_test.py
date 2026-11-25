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

"""Characterize shared source boundaries without requiring identical capabilities."""

from collections.abc import Iterator
from dataclasses import dataclass
from unittest.mock import MagicMock, patch, PropertyMock

import pyarrow as pa
import pytest
from flask import Flask
from superset_core.semantic_layers.types import Dimension, Grains, Metric

from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.db_engine_specs.base import TimeGrain
from superset.exceptions import QueryObjectValidationError
from superset.models.core import Database
from superset.models.sql_lab import Query
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.superset_typing import ExplorableData


@dataclass(frozen=True)
class SourceExpectations:
    """Name deliberate differences instead of asserting universal SQL behavior."""

    source_type: str
    select_star: str | None
    grain_function: str
    empty_drill: bool


@pytest.fixture
def conformance_database(app: Flask) -> Iterator[Database]:
    """Stub engine grains and database metadata; source projections stay real."""
    database: Database = Database(
        id=1, database_name="Examples", sqlalchemy_uri="sqlite://"
    )
    with (
        app.app_context(),
        patch.object(
            Database,
            "grains",
            return_value=[TimeGrain("Day", "Day", "DATE({col})", "P1D")],
        ),
        patch.object(
            Database,
            "data",
            new_callable=PropertyMock,
            return_value={"id": 1, "name": "Examples"},
        ),
    ):
        yield database


@pytest.fixture(params=["table", "semantic_view"])
def paired_source(
    request: pytest.FixtureRequest, conformance_database: Database
) -> Iterator[tuple[SqlaTable | SemanticView, SourceExpectations]]:
    """Pair an ordinary dataset and a provider-backed view at public boundaries."""
    source: SqlaTable | SemanticView
    expectations: SourceExpectations
    implementation: MagicMock = MagicMock()
    implementation.get_dimensions.return_value = {
        Dimension("category-id", "category", pa.string(), verbose_name="Category"),
        Dimension("day-id", "occurred_at", pa.date32(), grain=Grains.DAY),
    }
    implementation.get_metrics.return_value = {
        Metric("total-id", "total", pa.float64(), definition="total", d3format=",.2f")
    }
    implementation.uid.return_value = "provider-view"
    implementation.features = frozenset()
    implementation.selection_identity_version = None
    implementation.preferred_temporal_dimension = None
    if request.param == "table":
        source = SqlaTable(id=1, table_name="Orders", database=conformance_database)
        source.columns = [
            TableColumn(column_name="category", verbose_name="Category", groupby=True),
            TableColumn(column_name="occurred_at", is_dttm=True, groupby=True),
        ]
        source.metrics = [SqlMetric(metric_name="total", d3format=",.2f")]
        expectations = SourceExpectations(
            "table", "SELECT * FROM orders", "DATE({col})", False
        )
    else:
        source = SemanticView(
            id=1, name="Orders", semantic_layer=SemanticLayer(name="Layer")
        )
        expectations = SourceExpectations("semantic_view", None, "", True)
    with (
        # Stubbed: the table select_star check covers pass-through, not SQL generation.
        patch.object(
            SqlaTable,
            "select_star",
            new_callable=PropertyMock,
            return_value="SELECT * FROM orders",
        ),
        patch.object(
            SemanticView,
            "implementation",
            new_callable=PropertyMock,
            return_value=implementation,
        ),
    ):
        yield source, expectations


def test_source_metadata_names_labels_and_sql_absence(
    paired_source: tuple[SqlaTable | SemanticView, SourceExpectations],
) -> None:
    """Labels and formats do not replace operands or manufacture SQL support."""
    source: SqlaTable | SemanticView
    expected: SourceExpectations
    source, expected = paired_source
    data: ExplorableData = source.data
    assert data["type"] == expected.source_type
    assert data["name"] == "Orders"
    assert {column["column_name"] for column in data["columns"]} == {
        "category",
        "occurred_at",
    }
    assert data["verbose_map"]["category"] == "Category"
    assert data["verbose_map"]["occurred_at"] == "occurred_at"
    assert data["column_formats"] == {"total": ",.2f"}
    assert data["sql"] is None
    assert data["select_star"] == expected.select_star


def test_global_grains_keep_source_owned_compilation(
    paired_source: tuple[SqlaTable | SemanticView, SourceExpectations],
) -> None:
    """A common duration does not imply that a semantic source compiles SQL."""
    source: SqlaTable | SemanticView
    expected: SourceExpectations
    source, expected = paired_source
    assert source.get_time_grains() == [
        {"name": "Day", "duration": "P1D", "function": expected.grain_function}
    ]
    assert source.data["time_grain_sqla"] == [("P1D", "Day")]


def test_empty_drill_input_documents_an_existing_difference(
    paired_source: tuple[SqlaTable | SemanticView, SourceExpectations],
) -> None:
    """Pin the existing empty-list behavior without endorsing it as a grant."""
    source: SqlaTable | SemanticView
    expected: SourceExpectations
    source, expected = paired_source
    assert source.has_drill_by_columns([]) is expected.empty_drill


def test_query_is_a_separate_legacy_control(conformance_database: Database) -> None:
    """A SQL Lab Query has result columns and SQL, not saved dataset metrics."""
    source: Query = Query(
        id=1,
        sql="SELECT category FROM orders",
        tab_name="Ad hoc query",
        database=conformance_database,
    )
    source.extra = {
        "columns": [{"column_name": "category", "type": "TEXT", "is_dttm": False}]
    }
    data: ExplorableData = source.data
    assert data["name"] == "Ad hoc query"
    assert data["sql"] == "SELECT category FROM orders"
    assert data["metrics"] == []
    assert [column["column_name"] for column in data["columns"]] == ["category"]
    assert source.get_time_grains() == [
        {"name": "Day", "duration": "P1D", "function": "DATE({col})"}
    ]
    assert source.has_drill_by_columns([]) is False
    assert source.has_drill_by_columns(["category"]) is True
    assert source.has_drill_by_columns(["missing"]) is False


def test_semantic_preview_refuses_without_executing() -> None:
    """Unavailable previews must not execute a provider query to fabricate SQL."""
    view: SemanticView = SemanticView()
    implementation: MagicMock = MagicMock()
    with patch.object(
        SemanticView,
        "implementation",
        new_callable=PropertyMock,
        return_value=implementation,
    ):
        with pytest.raises(
            QueryObjectValidationError, match="produced when the chart runs"
        ):
            view.get_query_str({})
    assert implementation.mock_calls == []
