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
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Pattern, Tuple, TYPE_CHECKING

from flask_babel import gettext as __
from sqlalchemy.engine.reflection import Inspector

from superset.db_engine_specs.base import BaseEngineSpec
from superset.errors import SupersetErrorType
from superset.utils import core as utils

if TYPE_CHECKING:
    # prevent circular imports
    from superset.models.core import Database


COLUMN_DOES_NOT_EXIST_REGEX = re.compile("no such column: (?P<column_name>.+)")


class SqliteEngineSpec(BaseEngineSpec):
    engine = "sqlite"
    engine_name = "SQLite"

    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "DATETIME(STRFTIME('%Y-%m-%dT%H:%M:%S', {col}))",
        "PT1M": "DATETIME(STRFTIME('%Y-%m-%dT%H:%M:00', {col}))",
        "PT1H": "DATETIME(STRFTIME('%Y-%m-%dT%H:00:00', {col}))",
        "P1D": "DATE({col})",
        "P1W": "DATE({col}, -strftime('%w', {col}) || ' days')",
        "P1M": "DATE({col}, -strftime('%d', {col}) || ' days', '+1 day')",
        "P3M": (
            "DATETIME(STRFTIME('%Y-', {col}) || "  # year
            "SUBSTR('00' || "  # pad with zeros to 2 chars
            "((CAST(STRFTIME('%m', {col}) AS INTEGER)) - "  # month as integer
            "(((CAST(STRFTIME('%m', {col}) AS INTEGER)) - 1) % 3)), "  # month in quarter
            "-2) || "  # close pad
            "'-01T00:00:00')"
        ),
        "P1Y": "DATETIME(STRFTIME('%Y-01-01T00:00:00', {col}))",
        "P1W/1970-01-03T00:00:00Z": "DATE({col}, 'weekday 6')",
        "1969-12-28T00:00:00Z/P1W": "DATE({col}, 'weekday 0', '-7 days')",
    }

    custom_errors: Dict[Pattern[str], Tuple[str, SupersetErrorType, Dict[str, Any]]] = {
        COLUMN_DOES_NOT_EXIST_REGEX: (
            __('We can\'t seem to resolve the column "%(column_name)s"'),
            SupersetErrorType.COLUMN_DOES_NOT_EXIST_ERROR,
            {},
        ),
    }

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "datetime({col}, 'unixepoch')"

    @classmethod
    def get_all_datasource_names(
        cls, database: "Database", datasource_type: str
    ) -> List[utils.DatasourceName]:
        schemas = database.get_all_schema_names(
            cache=database.schema_cache_enabled,
            cache_timeout=database.schema_cache_timeout,
            force=True,
        )
        schema = schemas[0]
        if datasource_type == "table":
            return database.get_all_table_names_in_schema(
                schema=schema,
                force=True,
                cache=database.table_cache_enabled,
                cache_timeout=database.table_cache_timeout,
            )
        if datasource_type == "view":
            return database.get_all_view_names_in_schema(
                schema=schema,
                force=True,
                cache=database.table_cache_enabled,
                cache_timeout=database.table_cache_timeout,
            )
        raise Exception(f"Unsupported datasource_type: {datasource_type}")

    @classmethod
    def convert_dttm(cls, target_type: str, dttm: datetime) -> Optional[str]:
        tt = target_type.upper()
        if tt in (utils.TemporalType.TEXT, utils.TemporalType.DATETIME):
            return f"""'{dttm.isoformat(sep=" ", timespec="microseconds")}'"""
        return None

    @classmethod
    def get_table_names(
        cls, database: "Database", inspector: Inspector, schema: Optional[str]
    ) -> List[str]:
        """Need to disregard the schema for Sqlite"""
        return sorted(inspector.get_table_names())
