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
import logging
import re
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

from flask import current_app
from sqlalchemy import types
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.orm import Session

from superset.constants import QUERY_EARLY_CANCEL_KEY
from superset.db_engine_specs.base import BaseEngineSpec
from superset.models.sql_lab import Query

logger = logging.getLogger(__name__)
# Query 5543ffdf692b7d02:f78a944000000000: 3% Complete (17 out of 547)
QUERY_PROGRESS_REGEX = re.compile(r"Query.*: (?P<query_progress>[0-9]+)%")


class ImpalaEngineSpec(BaseEngineSpec):
    """Engine spec for Cloudera's Impala"""

    engine = "impala"
    engine_name = "Apache Impala"

    _time_grain_expressions = {
        None: "{col}",
        "PT1M": "TRUNC({col}, 'MI')",
        "PT1H": "TRUNC({col}, 'HH')",
        "P1D": "TRUNC({col}, 'DD')",
        "P1W": "TRUNC({col}, 'WW')",
        "P1M": "TRUNC({col}, 'MONTH')",
        "P3M": "TRUNC({col}, 'Q')",
        "P1Y": "TRUNC({col}, 'YYYY')",
    }

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "from_unixtime({col})"

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, types.Date):
            return f"CAST('{dttm.date().isoformat()}' AS DATE)"
        if isinstance(sqla_type, types.TIMESTAMP):
            return f"""CAST('{dttm.isoformat(timespec="microseconds")}' AS TIMESTAMP)"""
        return None

    @classmethod
    def get_schema_names(cls, inspector: Inspector) -> List[str]:
        schemas = [
            row[0]
            for row in inspector.engine.execute("SHOW SCHEMAS")
            if not row[0].startswith("_")
        ]
        return schemas

    @classmethod
    def has_implicit_cancel(cls) -> bool:
        """
        Return True if the live cursor handles the implicit cancelation of the query,
        False otherise.

        :return: Whether the live cursor implicitly cancels the query
        :see: handle_cursor
        """

        return True

    @classmethod
    def execute(
        cls,
        cursor: Any,
        query: str,
        **kwargs: Any,
    ) -> None:
        try:
            cursor.execute_async(query)
        except Exception as ex:
            raise cls.get_dbapi_mapped_exception(ex)

    @classmethod
    def handle_cursor(cls, cursor: Any, query: Query, session: Session) -> None:
        """Stop query and updates progress information"""

        query_id = query.id
        unfinished_states = (
            "INITIALIZED_STATE",
            "RUNNING_STATE",
        )

        try:
            status = cursor.status()
            while status in unfinished_states:
                session.refresh(query)
                query = session.query(Query).filter_by(id=query_id).one()
                # if query cancelation was requested prior to the handle_cursor call, but
                # the query was still executed
                # modified in stop_query in views / core.py is reflected  here.
                # stop query
                if query.extra.get(QUERY_EARLY_CANCEL_KEY):
                    cursor.cancel_operation()
                    cursor.close_operation()
                    cursor.close()
                    break

                #  updates progress info by log
                try:
                    log = cursor.get_log() or ""
                except Exception:  # pylint: disable=broad-except
                    logger.warning("Call to GetLog() failed")
                    log = ""

                if log:
                    match = QUERY_PROGRESS_REGEX.match(log)
                    if match:
                        progress = int(match.groupdict()["query_progress"])
                    logger.debug(
                        "Query %s: Progress total: %s", str(query_id), str(progress)
                    )
                    needs_commit = False
                    if progress > query.progress:
                        query.progress = progress
                        needs_commit = True

                    if needs_commit:
                        session.commit()
                sleep_interval = current_app.config["DB_POLL_INTERVAL_SECONDS"].get(
                    cls.engine, 5
                )
                time.sleep(sleep_interval)
                status = cursor.status()
        except Exception:  # pylint: disable=broad-except
            logger.debug("Call to status() failed ")
            return
