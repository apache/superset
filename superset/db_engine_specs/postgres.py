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
from datetime import datetime
from typing import Any, List, Optional, Tuple, TYPE_CHECKING

from pytz import _FixedOffset  # type: ignore
from sqlalchemy.dialects.postgresql.base import PGInspector

from superset.db_engine_specs.base import BaseEngineSpec
from superset.utils import core as utils

if TYPE_CHECKING:
    # pylint: disable=unused-import
    from superset.models.core import Database  # pragma: no cover


# Replace psycopg2.tz.FixedOffsetTimezone with pytz, which is serializable by PyArrow
# https://github.com/stub42/pytz/blob/b70911542755aeeea7b5a9e066df5e1c87e8f2c8/src/pytz/reference.py#L25
class FixedOffsetTimezone(_FixedOffset):
    pass


class PostgresBaseEngineSpec(BaseEngineSpec):
    """ Abstract class for Postgres 'like' databases """

    engine = ""

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

    @classmethod
    def fetch_data(cls, cursor: Any, limit: int) -> List[Tuple[Any, ...]]:
        cursor.tzinfo_factory = FixedOffsetTimezone
        if not cursor.description:
            return []
        return super().fetch_data(cursor, limit)

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "(timestamp 'epoch' + {col} * interval '1 second')"


class PostgresEngineSpec(PostgresBaseEngineSpec):
    engine = "postgresql"
    max_column_name_length = 63
    try_remove_schema_from_table_name = False

    @classmethod
    def get_table_names(
        cls, database: "Database", inspector: PGInspector, schema: Optional[str]
    ) -> List[str]:
        """Need to consider foreign tables for PostgreSQL"""
        tables = inspector.get_table_names(schema)
        tables.extend(inspector.get_foreign_table_names(schema))
        return sorted(tables)

    @classmethod
    def convert_dttm(cls, target_type: str, dttm: datetime) -> Optional[str]:
        tt = target_type.upper()
        if tt == utils.TemporalType.DATE:
            return f"TO_DATE('{dttm.date().isoformat()}', 'YYYY-MM-DD')"
        if tt == utils.TemporalType.TIMESTAMP:
            return f"""TO_TIMESTAMP('{dttm.isoformat(sep=" ", timespec="microseconds")}', 'YYYY-MM-DD HH24:MI:SS.US')"""  # pylint: disable=line-too-long
        return None
