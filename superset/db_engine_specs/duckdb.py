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


class DuckDBEngineSpec(BaseEngineSpec):
    engine = "duckdb"
    engine_name = "DuckDB"

    _time_grain_expressions = {
        None: "{col}",
        "PT1S": "DATE_TRUNC('second', {col})",
        "PT1M": "DATE_TRUNC('minute', {col})",
        "PT1H": "DATE_TRUNC('hour', {col})",
        "P1D": "DATE_TRUNC('day', {col})",
        "P1W": "DATE_TRUNC('week', {col})",
        "P1M": "DATE_TRUNC('month', {col})",
        "P0.25Y": "DATE_TRUNC('quarter', {col})",
        "P1Y": "DATE_TRUNC('year', {col})",
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
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        tt = target_type.upper()
        if tt in (utils.TemporalType.TEXT, utils.TemporalType.DATETIME):
            return f"""'{dttm.isoformat(sep=" ", timespec="microseconds")}'"""
        return None

    @classmethod
    def get_table_names(
        cls, database: Database, inspector: Inspector, schema: Optional[str]
    ) -> List[str]:
        """Need to disregard the schema for DuckDB"""
        return sorted(inspector.get_table_names())
