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

import contextlib
import logging
import re
import time
from datetime import datetime
from typing import Any, Optional, TYPE_CHECKING

import requests
from celery.exceptions import SoftTimeLimitExceeded
from flask import current_app as app
from sqlalchemy import text, types
from sqlalchemy.engine.reflection import Inspector

from superset import db
from superset.constants import QUERY_CANCEL_KEY, QUERY_EARLY_CANCEL_KEY, TimeGrain
from superset.db_engine_specs.base import BaseEngineSpec, DatabaseCategory
from superset.models.sql_lab import Query
from superset.utils.core import QueryStatus
from superset.utils.network import is_safe_host

if TYPE_CHECKING:
    from superset.models.core import Database

logger = logging.getLogger(__name__)
# Query 5543ffdf692b7d02:f78a944000000000: 3% Complete (17 out of 547)
QUERY_PROGRESS_REGEX = re.compile(r"Query.*: (?P<query_progress>[0-9]+)%")


class ImpalaEngineSpec(BaseEngineSpec):
    """Engine spec for Cloudera's Impala"""

    engine = "impala"
    engine_name = "Apache Impala"

    metadata = {
        "description": (
            "Apache Impala is an open-source massively parallel "
            "processing SQL query engine."
        ),
        "logo": "apache-impala.png",
        "homepage_url": "https://impala.apache.org/",
        "categories": [
            DatabaseCategory.APACHE_PROJECTS,
            DatabaseCategory.QUERY_ENGINES,
            DatabaseCategory.OPEN_SOURCE,
        ],
        "pypi_packages": ["impyla"],
        "connection_string": "impala://{hostname}:{port}/{database}",
        "default_port": 21050,
    }

    _time_grain_expressions = {
        None: "{col}",
        TimeGrain.MINUTE: "TRUNC({col}, 'MI')",
        TimeGrain.HOUR: "TRUNC({col}, 'HH')",
        TimeGrain.DAY: "TRUNC({col}, 'DD')",
        TimeGrain.WEEK: "TRUNC({col}, 'WW')",
        TimeGrain.MONTH: "TRUNC({col}, 'MONTH')",
        TimeGrain.QUARTER: "TRUNC({col}, 'Q')",
        TimeGrain.YEAR: "TRUNC({col}, 'YYYY')",
    }

    has_query_id_before_execute = False

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return "from_unixtime({col})"

    @classmethod
    def convert_dttm(
        cls, target_type: str, dttm: datetime, db_extra: dict[str, Any] | None = None
    ) -> str | None:
        sqla_type = cls.get_sqla_column_type(target_type)

        if isinstance(sqla_type, types.Date):
            return f"CAST('{dttm.date().isoformat()}' AS DATE)"
        if isinstance(sqla_type, types.TIMESTAMP):
            return f"""CAST('{dttm.isoformat(timespec="microseconds")}' AS TIMESTAMP)"""
        return None

    @classmethod
    def get_schema_names(cls, inspector: Inspector) -> set[str]:
        with inspector.engine.connect() as conn:
            return {
                row[0]
                for row in conn.execute(text("SHOW SCHEMAS"))
                if not row[0].startswith("_")
            }

    @classmethod
    def has_implicit_cancel(cls) -> bool:
        """Keep HTTP cancellation independent of the live cursor polling loop."""
        return False

    @classmethod
    def execute(
        cls,
        cursor: Any,
        query: str,
        database: Database,
        **kwargs: Any,
    ) -> None:
        try:
            cursor.execute_async(query)
        except Exception as ex:
            raise cls.get_dbapi_mapped_exception(ex) from ex

    @classmethod
    def fetch_data(cls, cursor: Any, limit: int | None = None) -> list[tuple[Any, ...]]:
        """Wait for asynchronous operations using the public cursor API."""
        if callable(getattr(cursor, "execute_async", None)):
            from impala.error import Error

            deadline = time.monotonic() + app.config["SQLLAB_TIMEOUT"]
            try:
                while cursor.is_executing():
                    if time.monotonic() >= deadline:
                        cursor.cancel_operation()
                        raise TimeoutError("Timed out waiting for the Impala operation")
                    time.sleep(0.1)
                if cursor.execution_failed():
                    # Fetching surfaces the driver's detailed asynchronous error,
                    # including errors on statements that produce no result set.
                    cursor.fetchall()
            except Error as ex:
                raise cls.get_dbapi_mapped_exception(ex) from ex
        return super().fetch_data(cursor, limit)

    @classmethod
    def _cancel_operation(cls, cursor: Any, query_id: int) -> None:
        """Cancel the live operation and release its handles."""
        try:
            cursor.cancel_operation()
        except Exception:  # pylint: disable=broad-except
            logger.warning("Query %s: cancel_operation() failed", query_id)
        # The handles are released even when the cancel RPC failed, so a stopped
        # query does not leave an operation open on the coordinator for the rest
        # of the connection's life.
        with contextlib.suppress(Exception):
            cursor.close_operation()
        with contextlib.suppress(Exception):
            cursor.close()

    @classmethod
    def handle_cursor(cls, cursor: Any, query: Query) -> None:
        """Stop query and updates progress information"""

        query_id = query.id
        unfinished_states = (
            "PENDING_STATE",
            "INITIALIZED_STATE",
            "RUNNING_STATE",
        )
        # An operation waiting for admission often starts within moments, so it
        # is polled with a short interval that backs off to the configured one,
        # rather than holding a short query back for a full poll interval.
        pending_sleep_interval = 0.1

        try:
            status = cursor.status()
            while status in unfinished_states:
                db.session.refresh(query)
                query = db.session.query(Query).filter_by(id=query_id).one()
                # Stop was requested: either before a cancel handle was published
                # (early-cancel flag) or through SQL Lab's stop, which persists
                # STOPPED once cancel_query() succeeds.
                if (
                    query.extra.get(QUERY_EARLY_CANCEL_KEY)
                    or query.status == QueryStatus.STOPPED
                ):
                    cls._cancel_operation(cursor, query_id)
                    break

                sleep_interval = app.config["DB_POLL_INTERVAL_SECONDS"].get(
                    cls.engine, 5
                )
                # Pending/initialized operations have no execution progress yet.
                if status == "RUNNING_STATE":
                    try:
                        log = cursor.get_log() or ""
                    except Exception:  # pylint: disable=broad-except
                        logger.warning("Call to GetLog() failed")
                        log = ""

                    if match := QUERY_PROGRESS_REGEX.match(log):
                        progress = int(match.groupdict()["query_progress"])
                        logger.debug("Query %s: Progress total: %s", query_id, progress)
                        if progress > query.progress:
                            query.progress = progress
                            db.session.commit()  # pylint: disable=consider-using-transaction
                else:
                    sleep_interval = min(pending_sleep_interval, sleep_interval)
                    pending_sleep_interval *= 2
                time.sleep(sleep_interval)
                status = cursor.status()
        except SoftTimeLimitExceeded:
            # SQL Lab's own handler marks the query TIMED_OUT once this propagates;
            # the operation is cancelled first so it does not keep running on the
            # coordinator while fetch_data() waits on it.
            cls._cancel_operation(cursor, query_id)
            raise
        except Exception:  # pylint: disable=broad-except
            logger.debug("Call to status() failed ")
            return

    @classmethod
    def prepare_cancel_query(cls, query: Query) -> None:
        """
        Route a stop that arrives before the operation's cancel handle is
        published to the live cursor.

        The handle is only known once ``execute_async`` has returned. Until then,
        the early-cancel flag lets the stop succeed, and ``handle_cursor`` cancels
        the operation as soon as it polls.
        """
        if QUERY_CANCEL_KEY not in query.extra:
            query.set_extra_json_key(QUERY_EARLY_CANCEL_KEY, True)
            db.session.commit()  # pylint: disable=consider-using-transaction

    @classmethod
    def get_cancel_query_id(cls, cursor: Any, query: Query) -> Optional[str]:
        """
        Get Impala Query ID that will be used to cancel the running
        queries to release impala resources.

        :param cursor: Cursor instance in which the query will be executed
        :param query: Query instance
        :return: Impala Query ID
        """
        last_operation = getattr(cursor, "_last_operation", None)
        if not last_operation:
            return None
        guid = last_operation.handle.operationId.guid[::-1].hex()
        return f"{guid[-16:]}:{guid[:16]}"

    @classmethod
    def cancel_query(cls, cursor: Any, query: Query, cancel_query_id: str) -> bool:
        """
        Cancel query in the underlying database.

        :param cursor: New cursor instance to the db of the query
        :param query: Query instance
        :param cancel_query_id: Impala query ID in format "hex:hex"
        :return: True if query cancelled successfully, False otherwise
        """
        # Validate cancel_query_id to prevent URL injection
        # Impala query IDs are in "hex:hex" form (16 hex chars per side)
        if not cls.validate_cancel_query_id(
            cancel_query_id, r"^[A-Fa-f0-9]{16}:[A-Fa-f0-9]{16}$"
        ):
            return False

        try:
            impala_host = query.database.url_object.host
            # The cancel call issues an outbound HTTP request from the
            # Superset backend to whatever host the DB connection was
            # configured with; validate it before the call to keep this
            # path consistent with the dataset-import and webhook URL
            # checks. Operators with internal Impala targets can opt out
            # via IMPALA_CANCEL_QUERY_ALLOW_INTERNAL_HOSTS.
            if not impala_host:
                return False
            if not app.config[
                "IMPALA_CANCEL_QUERY_ALLOW_INTERNAL_HOSTS"
            ] and not is_safe_host(impala_host):
                logger.warning(
                    "Impala cancel_query refused: target host is not allowed"
                )
                return False
            url = f"http://{impala_host}:25000/cancel_query?query_id={cancel_query_id}"
            # Do not follow redirects: a validated host could otherwise 30x the
            # request to an internal target, bypassing the is_safe_host check.
            response = requests.post(url, timeout=3, allow_redirects=False)
        except Exception:  # pylint: disable=broad-except
            return False

        return bool(response and response.status_code == 200)
