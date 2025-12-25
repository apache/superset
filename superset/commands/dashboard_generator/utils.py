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
Shared utilities for Dashboard Generator.

This module contains common helper functions and constants used across
the dashboard generation pipeline.
"""
from __future__ import annotations

from typing import Any

from superset.models.database_analyzer import DatabaseSchemaReport
from superset.utils import json


# Constants for chart params that contain column references
COLUMN_PARAMS = [
    "groupby",
    "columns",
    "all_columns",
    "all_columns_x",
    "all_columns_y",
    "order_by_cols",
    "series",
    "entity",
    "x_axis",
    "temporal_columns_lookup",
]

METRIC_PARAMS = [
    "metric",
    "metrics",
    "metric_2",
    "percent_metrics",
    "secondary_metric",
    "size",
    "x",
    "y",
]


def prepare_database_report_data(report: DatabaseSchemaReport) -> dict[str, Any]:
    """
    Convert DatabaseSchemaReport to dictionary format for LLM prompts.

    :param report: The database schema report
    :return: Dictionary with tables, columns, and joins
    """
    tables = []
    for table in report.tables:
        table_data = {
            "name": table.table_name,
            "type": table.table_type.value if table.table_type else "table",
            "description": table.ai_description or table.db_comment,
            "columns": [],
        }

        for col in table.columns:
            col_data = {
                "name": col.column_name,
                "type": col.data_type,
                "description": col.ai_description or col.db_comment,
            }
            table_data["columns"].append(col_data)

        tables.append(table_data)

    joins = []
    for join in report.joins:
        # Handle source_columns/target_columns which may be JSON strings
        src_cols = (
            json.loads(join.source_columns)
            if isinstance(join.source_columns, str)
            else join.source_columns
        )
        tgt_cols = (
            json.loads(join.target_columns)
            if isinstance(join.target_columns, str)
            else join.target_columns
        )

        join_data = {
            "source_table": join.source_table.table_name,
            "source_columns": src_cols,
            "target_table": join.target_table.table_name,
            "target_columns": tgt_cols,
            "join_type": join.join_type.value if join.join_type else "inner",
            "cardinality": join.cardinality.value if join.cardinality else "N:1",
        }
        joins.append(join_data)

    return {
        "database_id": report.database_id,
        "schema_name": report.schema_name,
        "tables": tables,
        "joins": joins,
    }
