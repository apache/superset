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
An interface to dbt's semantic layer, Metric Flow.
"""

from __future__ import annotations

from datetime import timedelta
from typing import Any, TYPE_CHECKING

from shillelagh.backends.apsw.dialects.base import get_adapter_for_table_name
from shillelagh.backends.apsw.dialects.metricflow import TABLE_NAME
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.pool import _ConnectionRecord
from sqlalchemy.pool.base import _ConnectionFairy

from superset.connectors.sqla.models import SqlaTable
from superset.constants import TimeGrain
from superset.db_engine_specs.base import MetricType, ValidColumnsType
from superset.db_engine_specs.shillelagh import ShillelaghEngineSpec
from superset.extensions import cache_manager
from superset.utils.cache import memoized_func

if TYPE_CHECKING:
    from shillelagh.backends.apsw.dialects.metricflow import TableMetricFlowAPI
    from shillelagh.fields import Field
    from sqlalchemy.engine.reflection import Inspector

    from superset.models.core import Database
    from superset.sql.parse import Table
    from superset.superset_typing import ResultSetColumnType


@event.listens_for(Engine, "connect")
def receive_connect(
    dbapi_connection: _ConnectionFairy,
    connection_record: _ConnectionRecord,
) -> None:
    """
    Called when a new DB connection is created.

    This hook adds a cache to the `_build_column_from_dimension` method of the Metric
    Flow adapter, since it's called frequently and can be expensive.
    """
    engine = connection_record.info.get("engine")
    if (
        not engine
        or not engine.name == "metricflow"
        or getattr(engine.dialect, "_patched", False)
    ):
        return

    original_method = engine.dialect._build_column_from_dimension

    @memoized_func(
        key="metricflow:dimension:{name}",
        cache=cache_manager.data_cache,
    )
    def cached_build_column_from_dimension(
        self: TableMetricFlowAPI,
        name: str,
        *args: Any,
        **kwargs: Any,
    ) -> Field:
        return original_method(
            self,
            name,
            cache_timeout=int(timedelta(days=1).total_seconds()),
        )

    engine.dialect._build_column_from_dimension = cached_build_column_from_dimension
    engine.dialect._patched = True


SELECT_STAR_MESSAGE = (
    'The dbt semantic layer does not support data preview, since the "metrics" table '
    "is a virtual table that is not materialized. An administrator should configure "
    'the database in Apache Superset so that the "Disable SQL Lab data preview '
    'queries" option under "Advanced" → "SQL Lab" is enabled.'
)


class DbtMetricFlowEngineSpec(ShillelaghEngineSpec):
    """
    Engine for the the dbt semantic layer.
    """

    engine = "metricflow"
    engine_name = "dbt Metric Flow"
    sqlalchemy_uri_placeholder = (
        "metricflow://[ab123.us1.dbt.com]/<environment_id>"
        "?service_token=<service_token>"
    )

    supports_dynamic_columns = True

    _time_grain_expressions = {
        TimeGrain.DAY: "{col}__day",
        TimeGrain.WEEK: "{col}__week",
        TimeGrain.MONTH: "{col}__month",
        TimeGrain.QUARTER: "{col}__quarter",
        TimeGrain.YEAR: "{col}__year",
    }

    @classmethod
    def select_star(cls, *args: Any, **kwargs: Any) -> str:
        """
        Return a ``SELECT *`` query.
        """
        message = SELECT_STAR_MESSAGE.replace("'", "''")
        return f"SELECT '{message}' AS warning"

    @classmethod
    def get_columns(
        cls,
        inspector: Inspector,
        table: Table,
        options: dict[str, Any] | None = None,
    ) -> list[ResultSetColumnType]:
        columns: list[ResultSetColumnType] = []

        for column in inspector.get_columns(table.table, table.schema):
            # ignore metrics
            if "computed" in column:
                continue

            column["column_name"] = column["name"]
            columns.append(column)

        return columns

    @classmethod
    def get_metrics(
        cls,
        database: Database,
        inspector: Inspector,
        table: Table,
    ) -> list[MetricType]:
        """
        Get all metrics.
        """
        return [
            {
                "metric_name": column["name"],
                "expression": column["computed"]["sqltext"],
                "description": column["comment"],
            }
            for column in inspector.get_columns(table.table, table.schema)
            if "computed" in column
        ]

    @classmethod
    def get_valid_metrics_and_dimensions(
        cls,
        database: Database,
        table: SqlaTable,
        dimensions: set[str],
        metrics: set[str],
    ) -> ValidColumnsType:
        """
        Get valid metrics and dimensions.

        Given a datasource, and sets of selected metrics and dimensions, return the
        sets of valid metrics and dimensions that can further be selected.
        """
        with database.get_sqla_engine() as engine:
            connection = engine.connect()
            adapter = get_adapter_for_table_name(connection, TABLE_NAME)

        return {
            "metrics": adapter._get_metrics_for_dimensions(dimensions),
            "dimensions": adapter._get_dimensions_for_metrics(metrics),
        }
