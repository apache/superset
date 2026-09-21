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
"""Deterministic query-count guard for representative purge graphs."""

from __future__ import annotations

import os
from datetime import datetime, timedelta
from statistics import median
from time import perf_counter
from typing import Any

import pytest
import sqlalchemy as sa
from sqlalchemy.engine import Connection

from superset import db
from superset.commands.deletion_retention.purge_cascade import (
    cascade_hard_delete,
    CascadeResult,
    suppress_purge_association_versions,
)
from superset.connectors.sqla.models import (
    RowLevelSecurityFilter,
    SqlaTable,
    SqlMetric,
    TableColumn,
)
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice

from ._base import DeletionRetentionTestBase

CHART_PURGE_BASELINE_STATEMENTS: int = 35
DASHBOARD_PURGE_BASELINE_STATEMENTS: int = 36
DATASET_PURGE_BASELINE_STATEMENTS: int = 43
MAX_STATEMENT_REGRESSION: float = 0.10
WARMUP_RUNS: int = 5
MEASURED_RUNS: int = 20


def statement_budget(baseline: int) -> int:
    """Return the inclusive integer budget for a measured SQL baseline."""
    return int(baseline * (1 + MAX_STATEMENT_REGRESSION) + 0.9999)


class TestPurgeQueryCount(DeletionRetentionTestBase):
    """Guard against accidental graph loading or query-count explosions."""

    def test_representative_chart_purge_query_count(self) -> None:
        """A chart with five dashboard memberships stays within its SQL budget."""
        chart: Slice = self.make_chart("perf_chart")
        for index in range(5):
            self.make_dashboard(f"perf_dashboard_{index}", slices=[chart])
        statement_count: int = self._purge_statement_count(chart)
        if os.environ.get("SUPERSET_PURGE_BENCHMARK") == "1":
            print(f"chart purge statements: {statement_count}")
        assert statement_count <= statement_budget(CHART_PURGE_BASELINE_STATEMENTS)

    def test_representative_dashboard_purge_query_count(self) -> None:
        """A dashboard with five chart memberships stays within its SQL budget."""
        charts: list[Slice] = [
            self.make_chart(f"perf_dashboard_chart_{index}") for index in range(5)
        ]
        dashboard: Dashboard = self.make_dashboard("perf_dashboard", slices=charts)

        statement_count: int = self._purge_statement_count(dashboard)

        if os.environ.get("SUPERSET_PURGE_BENCHMARK") == "1":
            print(f"dashboard purge statements: {statement_count}")
        assert statement_count <= statement_budget(DASHBOARD_PURGE_BASELINE_STATEMENTS)

    def test_representative_dataset_purge_query_count(self) -> None:
        """A dataset's fixed owned and association graph stays bounded."""
        dataset: SqlaTable = self.make_dataset("perf_dataset")
        for index in range(10):
            db.session.add(
                TableColumn(column_name=f"retention_it_column_{index}", table=dataset)
            )
        for index in range(5):
            db.session.add(
                SqlMetric(
                    metric_name=f"retention_it_metric_{index}",
                    expression="count(*)",
                    table=dataset,
                )
            )
            db.session.add(
                RowLevelSecurityFilter(
                    name=f"retention_it_rls_{index}",
                    clause="1=1",
                    filter_type="Regular",
                    tables=[dataset],
                )
            )
        db.session.commit()

        statement_count: int = self._purge_statement_count(dataset)

        if os.environ.get("SUPERSET_PURGE_BENCHMARK") == "1":
            print(f"dataset purge statements: {statement_count}")
        assert statement_count <= statement_budget(DATASET_PURGE_BASELINE_STATEMENTS)

    @pytest.mark.skipif(
        os.environ.get("SUPERSET_PURGE_BENCHMARK") != "1",
        reason="manual fixed-cardinality timing protocol",
    )
    @pytest.mark.parametrize(
        ("entity_type", "baseline_environment_variable"),
        [
            ("chart", "SUPERSET_PURGE_BASELINE_CHART_SECONDS"),
            ("dashboard", "SUPERSET_PURGE_BASELINE_DASHBOARD_SECONDS"),
            ("dataset", "SUPERSET_PURGE_BASELINE_DATASET_SECONDS"),
        ],
    )
    def test_representative_purge_median(
        self,
        entity_type: str,
        baseline_environment_variable: str,
    ) -> None:
        """Report fixed-cardinality medians and enforce supplied baselines."""
        durations: list[float] = []
        for iteration in range(WARMUP_RUNS + MEASURED_RUNS):
            if iteration:
                self._reset_benchmark_fixture()
            entity: Slice | Dashboard | SqlaTable = self._make_benchmark_entity(
                entity_type, iteration
            )
            self.soft_delete(entity, days_ago=90)

            started_at: float = perf_counter()
            with suppress_purge_association_versions(db.session):
                result: CascadeResult = cascade_hard_delete(
                    db.session,
                    entity,
                    enforce_window=True,
                    cutoff=datetime.now() - timedelta(days=30),
                )
            db.session.commit()
            elapsed: float = perf_counter() - started_at

            assert result.purged
            if iteration >= WARMUP_RUNS:
                durations.append(elapsed)

        measured_median: float = median(durations)
        baseline_value: str | None = os.environ.get(baseline_environment_variable)
        print(f"{entity_type} purge median: {measured_median:.6f}s")
        if baseline_value is not None:
            baseline_median: float = float(baseline_value)
            regression: float = (measured_median - baseline_median) / baseline_median
            print(f"{entity_type} purge elapsed-time delta: {regression:+.2%}")
            assert regression <= MAX_STATEMENT_REGRESSION
        assert len(durations) == MEASURED_RUNS

    def _make_benchmark_entity(
        self, entity_type: str, iteration: int
    ) -> Slice | Dashboard | SqlaTable:
        """Create one fixed-cardinality root for the manual timing protocol."""
        if entity_type == "chart":
            chart: Slice = self.make_chart(f"benchmark_chart_{iteration}")
            for dashboard_index in range(5):
                self.make_dashboard(
                    f"benchmark_dashboard_{iteration}_{dashboard_index}",
                    slices=[chart],
                )
            return chart
        if entity_type == "dashboard":
            charts: list[Slice] = [
                self.make_chart(f"benchmark_chart_{iteration}_{index}")
                for index in range(5)
            ]
            return self.make_dashboard(
                f"benchmark_dashboard_{iteration}", slices=charts
            )
        if entity_type == "dataset":
            dataset: SqlaTable = self.make_dataset(f"benchmark_dataset_{iteration}")
            for index in range(10):
                db.session.add(
                    TableColumn(
                        column_name=f"benchmark_column_{iteration}_{index}",
                        table=dataset,
                    )
                )
            for index in range(5):
                db.session.add(
                    SqlMetric(
                        metric_name=f"benchmark_metric_{iteration}_{index}",
                        expression="count(*)",
                        table=dataset,
                    )
                )
                db.session.add(
                    RowLevelSecurityFilter(
                        name=f"benchmark_rls_{iteration}_{index}",
                        clause="1=1",
                        filter_type="Regular",
                        tables=[dataset],
                    )
                )
            db.session.commit()
            return dataset
        raise ValueError(f"Unsupported benchmark entity type: {entity_type}")

    def _reset_benchmark_fixture(self) -> None:
        """Rebuild the fixed fixture between manual timing samples."""
        self._cleanup()
        self.database: Database = Database(
            database_name="retention_it_db", sqlalchemy_uri="sqlite://"
        )
        db.session.add(self.database)
        db.session.commit()
        self.dataset: SqlaTable = self.make_dataset("ds")

    def _purge_statement_count(self, entity: Any) -> int:
        """Purge one root and return SQL statements within the measured region."""
        self.soft_delete(entity, days_ago=90)
        statements: list[str] = []

        def count_statement(
            _connection: Connection,
            _cursor: object,
            statement: str,
            _parameters: object,
            _context: object,
            _executemany: bool,
        ) -> None:
            statements.append(statement)

        sa.event.listen(db.engine, "before_cursor_execute", count_statement)
        try:
            with suppress_purge_association_versions(db.session):
                result: CascadeResult = cascade_hard_delete(
                    db.session,
                    entity,
                    enforce_window=True,
                    cutoff=datetime.now() - timedelta(days=30),
                )
            db.session.commit()
        finally:
            sa.event.remove(db.engine, "before_cursor_execute", count_statement)

        assert result.purged
        return len(statements)
