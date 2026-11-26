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
"""Shared builders for time range limits tests."""

from __future__ import annotations

from collections.abc import Iterator
from datetime import datetime, timedelta
from typing import Any

import pandas as pd
import pytest
from sqlalchemy import DateTime, Integer, String, text

from superset import db
from superset.connectors.sqla.models import SqlaTable, SqlMetric
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import json
from superset.utils.core import get_example_default_schema
from superset.utils.database import get_example_database
from tests.integration_tests.dashboard_utils import create_table_metadata
from tests.integration_tests.test_app import app

TABLE_NAME = "time_range_limits_events"


def span_policy(days: int) -> dict[str, Any]:
    return {
        "schema_version": 1,
        "max_span": {"quantity": days, "time_grain": "P1D"},
        "max_look_back": None,
        "max_look_forward": None,
    }


GLOBAL_90_DAYS = {"TIME_RANGE_LIMITS_GLOBAL": span_policy(90)}


def query(time_range: str) -> dict[str, Any]:
    return {
        "filters": [{"col": "ds", "op": "TEMPORAL_RANGE", "val": time_range}],
        "metrics": ["count"],
        "columns": ["name"],
    }


def query_context(table_id: int, time_range: str, **form_data: Any) -> Any:
    return {
        "datasource": {"id": table_id, "type": "table"},
        "queries": [query(time_range)],
        "form_data": form_data,
        "result_format": "json",
        "result_type": "full",
    }


__all__ = [
    "Any",
    "Dashboard",
    "DateTime",
    "GLOBAL_90_DAYS",
    "Integer",
    "Iterator",
    "Slice",
    "SqlMetric",
    "SqlaTable",
    "String",
    "TABLE_NAME",
    "app",
    "create_table_metadata",
    "datetime",
    "db",
    "get_example_database",
    "get_example_default_schema",
    "json",
    "pd",
    "pytest",
    "query",
    "query_context",
    "span_policy",
    "text",
    "timedelta",
]
