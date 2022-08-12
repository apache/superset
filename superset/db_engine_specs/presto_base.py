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
from __future__ import annotations

import json
import logging
from abc import ABCMeta
from datetime import datetime
from typing import Any, Dict, List, Optional, TYPE_CHECKING
from urllib import parse

from sqlalchemy.engine import URL

from superset import cache_manager
from superset.db_engine_specs.base import BaseEngineSpec
from superset.utils import core as utils

if TYPE_CHECKING:
    from superset.models.core import Database

logger = logging.getLogger(__name__)


class PrestoBaseEngineSpec(BaseEngineSpec, metaclass=ABCMeta):
    """
    A base class that share common functions between Presto and Trino
    """

    # pylint: disable=line-too-long
    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "date_trunc('second', CAST({col} AS TIMESTAMP))",
        "PT1M": "date_trunc('minute', CAST({col} AS TIMESTAMP))",
        "PT1H": "date_trunc('hour', CAST({col} AS TIMESTAMP))",
        "P1D": "date_trunc('day', CAST({col} AS TIMESTAMP))",
        "P1W": "date_trunc('week', CAST({col} AS TIMESTAMP))",
        "P1M": "date_trunc('month', CAST({col} AS TIMESTAMP))",
        "P3M": "date_trunc('quarter', CAST({col} AS TIMESTAMP))",
        "P1Y": "date_trunc('year', CAST({col} AS TIMESTAMP))",
        # Week starting Sunday
        "1969-12-28T00:00:00Z/P1W": "date_trunc('week', CAST({col} AS TIMESTAMP) + interval '1' day) - interval '1' day",  # noqa
        # Week starting Monday
        "1969-12-29T00:00:00Z/P1W": "date_trunc('week', CAST({col} AS TIMESTAMP))",
        # Week ending Saturday
        "P1W/1970-01-03T00:00:00Z": "date_trunc('week', CAST({col} AS TIMESTAMP) + interval '1' day) + interval '5' day",  # noqa
        # Week ending Sunday
        "P1W/1970-01-04T00:00:00Z": "date_trunc('week', CAST({col} AS TIMESTAMP)) + interval '6' day",  # noqa
    }

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """
        Convert a Python `datetime` object to a SQL expression.
        :param target_type: The target type of expression
        :param dttm: The datetime object
        :param db_extra: The database extra object
        :return: The SQL expression
        Superset only defines time zone naive `datetime` objects, though this method
        handles both time zone naive and aware conversions.
        """
        tt = target_type.upper()
        if tt == utils.TemporalType.DATE:
            return f"DATE '{dttm.date().isoformat()}'"
        if tt in (
            utils.TemporalType.TIMESTAMP,
            utils.TemporalType.TIMESTAMP_WITH_TIME_ZONE,
        ):
            return f"""TIMESTAMP '{dttm.isoformat(timespec="microseconds", sep=" ")}'"""
        return None

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "from_unixtime({col})"

    @classmethod
    def adjust_database_uri(
        cls, uri: URL, selected_schema: Optional[str] = None
    ) -> URL:
        database = uri.database
        if selected_schema and database:
            selected_schema = parse.quote(selected_schema, safe="")
            if "/" in database:
                database = database.split("/")[0] + "/" + selected_schema
            else:
                database += "/" + selected_schema
            uri = uri.set(database=database)

        return uri

    @classmethod
    def estimate_statement_cost(cls, statement: str, cursor: Any) -> Dict[str, Any]:
        """
        Run a SQL query that estimates the cost of a given statement.
        :param statement: A single SQL statement
        :param cursor: Cursor instance
        :return: JSON response from Trino
        """
        sql = f"EXPLAIN (TYPE IO, FORMAT JSON) {statement}"
        cursor.execute(sql)

        # the output from Trino is a single column and a single row containing
        # JSON:
        #
        #   {
        #     ...
        #     "estimate" : {
        #       "outputRowCount" : 8.73265878E8,
        #       "outputSizeInBytes" : 3.41425774958E11,
        #       "cpuCost" : 3.41425774958E11,
        #       "maxMemory" : 0.0,
        #       "networkCost" : 3.41425774958E11
        #     }
        #   }
        result = json.loads(cursor.fetchone()[0])
        return result

    @classmethod
    def query_cost_formatter(
        cls, raw_cost: List[Dict[str, Any]]
    ) -> List[Dict[str, str]]:
        """
        Format cost estimate.
        :param raw_cost: JSON estimate from Trino
        :return: Human readable cost estimate
        """

        def humanize(value: Any, suffix: str) -> str:
            try:
                value = int(value)
            except ValueError:
                return str(value)

            prefixes = ["K", "M", "G", "T", "P", "E", "Z", "Y"]
            prefix = ""
            to_next_prefix = 1000
            while value > to_next_prefix and prefixes:
                prefix = prefixes.pop(0)
                value //= to_next_prefix

            return f"{value} {prefix}{suffix}"

        cost = []
        columns = [
            ("outputRowCount", "Output count", " rows"),
            ("outputSizeInBytes", "Output size", "B"),
            ("cpuCost", "CPU cost", ""),
            ("maxMemory", "Max memory", "B"),
            ("networkCost", "Network cost", ""),
        ]
        for row in raw_cost:
            estimate: Dict[str, float] = row.get("estimate", {})
            statement_cost = {}
            for key, label, suffix in columns:
                if key in estimate:
                    statement_cost[label] = humanize(estimate[key], suffix).strip()
            cost.append(statement_cost)

        return cost

    @classmethod
    @cache_manager.data_cache.memoize()
    def get_function_names(cls, database: Database) -> List[str]:
        """
        Get a list of function names that are able to be called on the database.
        Used for SQL Lab autocomplete.

        :param database: The database to get functions for
        :return: A list of function names useable in the database
        """
        return database.get_df("SHOW FUNCTIONS")["Function"].tolist()
