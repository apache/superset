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

import logging
import re
from datetime import datetime
from typing import Any, Optional, TYPE_CHECKING

from sqlalchemy import types

from superset.constants import TimeGrain
from superset.db_engine_specs.base import BaseEngineSpec, DatabaseCategory
from superset.utils.core import GenericDataType

if TYPE_CHECKING:
    from superset.models.sql_lab import Query

logger = logging.getLogger(__name__)


class OracleEngineSpec(BaseEngineSpec):
    engine = "oracle"
    engine_name = "Oracle"

    metadata = {
        "description": "Oracle Database is a multi-model database management system.",
        "logo": "oraclelogo.png",
        "homepage_url": "https://www.oracle.com/database/",
        "categories": [
            DatabaseCategory.TRADITIONAL_RDBMS,
            DatabaseCategory.PROPRIETARY,
        ],
        "pypi_packages": ["oracledb"],
        "connection_string": "oracle+oracledb://{username}:{password}@{hostname}:{port}",
        "default_port": 1521,
        "notes": (
            "Previously used cx_Oracle, now uses oracledb. Legacy LONG columns are "
            "treated as text, not numeric data, so Explore does not select SUM as "
            "their default aggregate."
        ),
        "docs_url": "https://python-oracledb.readthedocs.io/en/latest/user_guide/installation.html",
    }
    force_column_alias_quotes = True
    max_column_name_length = 128
    supports_multivalues_insert = True

    # Oracle-native type names the base mappings don't cover. NUMBER is Oracle's
    # primary numeric type (reflected as e.g. "NUMBER" or "NUMBER(10, 2)"), and
    # without these mappings such columns get no generic type, so they are not
    # treated as numeric (no default SUM aggregate, excluded from numeric
    # column lists). BLOB, RAW and LONG RAW are binary and intentionally unmapped.
    # The patterns are anchored on a word boundary so unrelated type names that
    # merely share a prefix (e.g. a user-defined "NUMBERING" type) stay unmapped.
    column_type_mappings = (
        (
            re.compile(r"^number\b", re.IGNORECASE),
            types.Numeric(),
            GenericDataType.NUMERIC,
        ),
        (
            re.compile(r"^binary_(float|double)\b", re.IGNORECASE),
            types.Float(),
            GenericDataType.NUMERIC,
        ),
        (
            re.compile(r"^n?clob\b", re.IGNORECASE),
            types.Text(),
            GenericDataType.STRING,
        ),
        # Oracle LONG stores character data, unlike the base numeric mapping.
        (
            re.compile(r"^long\b", re.IGNORECASE),
            types.Text(),
            GenericDataType.STRING,
        ),
    )
    # LONG RAW is binary like BLOB and RAW. Keep it unmapped rather than letting
    # the LONG pattern above, or the base numeric "^long" pattern, claim it.
    _long_raw_type = re.compile(r"^long\s+raw\b", re.IGNORECASE)

    @classmethod
    def get_column_types(
        cls,
        column_type: str | None,
    ) -> tuple[types.TypeEngine, GenericDataType] | None:
        """Leave LONG RAW unmapped; otherwise apply the Oracle and base mappings."""
        if column_type and cls._long_raw_type.match(column_type):
            return None
        return super().get_column_types(column_type)

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.SECOND: "CAST({col} as DATE)",
        TimeGrain.MINUTE: "TRUNC(CAST({col} as DATE), 'MI')",
        TimeGrain.HOUR: "TRUNC(CAST({col} as DATE), 'HH')",
        TimeGrain.DAY: "TRUNC(CAST({col} as DATE), 'DDD')",
        TimeGrain.WEEK: "TRUNC(CAST({col} as DATE), 'WW')",
        TimeGrain.MONTH: "TRUNC(CAST({col} as DATE), 'MONTH')",
        TimeGrain.QUARTER: "TRUNC(CAST({col} as DATE), 'Q')",
        TimeGrain.YEAR: "TRUNC(CAST({col} as DATE), 'YEAR')",
    }

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[dict[str, Any]] = None
    ) -> Optional[str]:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, types.Date):
            return f"TO_DATE('{dttm.date().isoformat()}', 'YYYY-MM-DD')"
        if isinstance(sqla_type, types.TIMESTAMP):
            return f"""TO_TIMESTAMP('{
                dttm.isoformat(timespec="microseconds")
            }', 'YYYY-MM-DD"T"HH24:MI:SS.ff6')"""
        if isinstance(sqla_type, types.DateTime):
            datetime_formatted = dttm.isoformat(timespec="seconds")
            return f"""TO_DATE('{datetime_formatted}', 'YYYY-MM-DD"T"HH24:MI:SS')"""
        return None

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "TO_DATE('1970-01-01','YYYY-MM-DD')+(1/24/60/60)*{col}"

    @classmethod
    def epoch_ms_to_dttm(cls) -> str:
        return "TO_DATE('1970-01-01','YYYY-MM-DD')+(1/24/60/60/1000)*{col}"

    @classmethod
    def get_cancel_query_id(cls, cursor: Any, query: Query) -> Optional[str]:
        """
        Identify the session that will run the query, so it can be cancelled.

        ``DBMS_DEBUG_JDWP.CURRENT_SESSION_SERIAL`` is executable by PUBLIC, so no
        grant on ``V$SESSION`` is needed. The instance number lets the cancel reach
        the right instance on RAC.

        :param cursor: Cursor instance in which the query will be executed
        :param query: Query instance
        :return: ``"<sid>,<serial#>,<instance>"``, or None if it cannot be read
        """
        try:
            cursor.execute(
                "SELECT SYS_CONTEXT('USERENV', 'SID'), "
                "DBMS_DEBUG_JDWP.CURRENT_SESSION_SERIAL, "
                "SYS_CONTEXT('USERENV', 'INSTANCE') FROM dual"
            )
            sid, serial, instance = cursor.fetchone()
        except Exception:  # pylint: disable=broad-except
            logger.warning("Could not identify the Oracle session", exc_info=True)
            return None
        return f"{sid},{serial},{instance}"

    @classmethod
    def cancel_query(cls, cursor: Any, query: Query, cancel_query_id: str) -> bool:
        """
        Cancel the running statement of a session with ``ALTER SYSTEM CANCEL SQL``.

        The session stays open and the statement fails with ORA-01013. Oracle
        requires the ALTER SYSTEM privilege for this, even for the user's own
        sessions; without it the cancel fails and False is returned.

        :param cursor: New cursor instance to the db of the query
        :param query: Query instance
        :param cancel_query_id: Value returned by ``get_cancel_query_id``
        :return: True if query cancelled successfully, False otherwise
        """
        if not cls.validate_cancel_query_id(cancel_query_id, r"^\d+,\d+,\d+$"):
            return False
        sid, serial, instance = cancel_query_id.split(",")
        try:
            cursor.execute(f"ALTER SYSTEM CANCEL SQL '{sid}, {serial}, @{instance}'")
        except Exception:  # pylint: disable=broad-except
            logger.warning(
                "Could not cancel Oracle session %s", cancel_query_id, exc_info=True
            )
            return False
        return True
