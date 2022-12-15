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
from typing import Any, Dict, List, Optional

from sqlalchemy.engine.reflection import Inspector

from superset.db_engine_specs.base import BaseEngineSpec
from superset.utils import core as utils
from superset.models.sql_lab import Query
from sqlalchemy.orm import Session
from superset.common.db_query_status import QueryStatus
import time
from flask import current_app
import logging
import re

logger = logging.getLogger(__name__)


class ImpalaEngineSpec(BaseEngineSpec):
    """Engine spec for Cloudera's Impala"""

    engine = "impala"
    engine_name = "Apache Impala"
    # Query 5543ffdf692b7d02:f78a944000000000: 3% Complete (17 out of 547)
    query_progress_r = re.compile(r".*Query.*: (?P<query_progress>[0-9]+)%.*")

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
        tt = target_type.upper()
        if tt == utils.TemporalType.DATE:
            return f"CAST('{dttm.date().isoformat()}' AS DATE)"
        if tt == utils.TemporalType.TIMESTAMP:
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
    def execute(  # pylint: disable=unused-argument
        cls,
        cursor: Any,
        query: str,
        **kwargs: Any,
    ) -> None:  # pylint: disable=arguments-differ
        # kwargs = {"async": async_}
        try:
            cursor.execute_async(query)
        except Exception as ex:
            raise cls.get_dbapi_mapped_exception(ex)

    @classmethod
    def handle_cursor(cls, cursor: Any, query: Query, session: Session) -> None:
        """Stop query and updates progress information"""

        query_id = query.id
        unfinished_states = (
            'INITIALIZED_STATE',
            'RUNNING_STATE',
        )
        # When the query status is pending, the stop operation is queried
        # Refresh session so that the `query.status` and `query.extra.get(is_stopped)`
        # modified in stop_query in views / core.py is reflected  here.
        session.refresh(query)
        query = session.query(Query).filter_by(id=query_id).one()
        is_stopped = query.extra.get("is_stopped")
        # stop query
        if query.status == QueryStatus.STOPPED or is_stopped:
            logger.info("query_id_cancel=%s, status=%s,"
                        " is_stopped=%s", str(query_id), query.status, is_stopped)
            try:
                cursor.cancel_operation()
                cursor.close_operation()
                cursor.close()
                return
            except Exception as ex:
                logger.warning("Call to cancel_operation() failed %s" % ex)
                return
        try:
            status = cursor.status()
            while status in unfinished_states:

                # Refresh session so that the `query.status`
                # and `query.extra.get(is_stopped)`
                # modified in stop_query in views / core.py is reflected  here.
                session.refresh(query)
                query = session.query(Query).filter_by(id=query_id).one()
                is_stopped = query.extra.get('is_stopped')

                # stop query
                if query.status == QueryStatus.STOPPED or is_stopped:
                    logger.info("while running query_id_cancel=%s, status=%s,"
                                " is_stopped=%s", str(query_id), query.status,
                                is_stopped)
                    try:
                        cursor.cancel_operation()
                        cursor.close_operation()
                        cursor.close()
                    except Exception as ex:
                        logger.warning("Call to cancel_operation() failed %s" % ex)
                    break

                #  updates progress info by log
                try:
                    log = cursor.get_log() or ""
                except Exception:  # pylint: disable=broad-except
                    logger.warning("Call to GetLog() failed")
                    log = ""

                if log:
                    match = cls.query_progress_r.match(log)
                    progress = int(match.groupdict()["query_progress"])
                    logger.info(
                        "Query %s: Progress total: %s", str(query_id), str(progress)
                    )
                    needs_commit = False
                    if progress > query.progress:
                        query.progress = progress
                        needs_commit = True

                    if needs_commit:
                        session.commit()

                time.sleep(current_app.config["IMPALA_POLL_INTERVAL"])
                status = cursor.status()
        except Exception as ex:
            logger.warning("Call to status() failed %s" % ex)
            return
