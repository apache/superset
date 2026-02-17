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
from typing import Any, cast

from flask import current_app as app
from flask_babel import gettext as __

from superset import db, results_backend, results_backend_use_msgpack
from superset.commands.base import BaseCommand
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SerializationError, SupersetErrorException
from superset.models.sql_lab import Query
from superset.sqllab.utils import apply_display_max_row_configuration_if_require
from superset.utils import core as utils
from superset.utils.dates import now_as_float
from superset.views.utils import _deserialize_results_payload

logger = logging.getLogger(__name__)


class SqlExecutionResultsCommand(BaseCommand):
    _key: str
    _rows: int | None
    _blob: Any
    _query: Query

    def __init__(
        self,
        key: str,
        rows: int | None = None,
    ) -> None:
        self._key = key
        self._rows = rows

    def validate(self) -> None:
        if not results_backend:
            raise SupersetErrorException(
                SupersetError(
                    message=__("Results backend is not configured."),
                    error_type=SupersetErrorType.RESULTS_BACKEND_NOT_CONFIGURED_ERROR,
                    level=ErrorLevel.ERROR,
                )
            )

        stats_logger = app.config["STATS_LOGGER"]

        # Check if query exists in database first (fast, avoids unnecessary S3 call)
        self._query = (
            db.session.query(Query).filter_by(results_key=self._key).one_or_none()
        )
        if self._query is None:
            logger.warning(
                "404 Error - Query not found in database for key: %s",
                self._key,
            )
            stats_logger.incr("sqllab.results_backend.404_query_not_found")
            raise SupersetErrorException(
                SupersetError(
                    message=__(
                        "The query associated with these results could not be found. "
                        "You need to re-run the original query."
                    ),
                    error_type=SupersetErrorType.RESULTS_BACKEND_ERROR,
                    level=ErrorLevel.ERROR,
                ),
                status=404,
            )

        # Now fetch results from backend (query exists, so this is a valid request)
        read_from_results_backend_start = now_as_float()
        self._blob = results_backend.get(self._key)
        stats_logger.timing(
            "sqllab.query.results_backend_read",
            now_as_float() - read_from_results_backend_start,
        )

        if not self._blob:
            # Query exists in DB but results not in S3 - enhanced diagnostics
            query_age_seconds = now_as_float() - (
                self._query.end_time if self._query.end_time else now_as_float()
            )
            logger.warning(
                "410 Error - Query exists in DB but results not in results backend"
                " Query ID: %s, Status: %s, Age: %.2f seconds, "
                "End time: %s, Results key: %s",
                self._query.id,
                self._query.status,
                query_age_seconds,
                self._query.end_time,
                self._key,
            )
            stats_logger.incr("sqllab.results_backend.410_results_missing")

            raise SupersetErrorException(
                SupersetError(
                    message=__(
                        "Data could not be retrieved from the results backend. You "
                        "need to re-run the original query."
                    ),
                    error_type=SupersetErrorType.RESULTS_BACKEND_ERROR,
                    level=ErrorLevel.ERROR,
                ),
                status=410,
            )

    def run(
        self,
    ) -> dict[str, Any]:
        """Runs arbitrary sql and returns data as json"""
        self.validate()
        payload = utils.zlib_decompress(
            self._blob, decode=not results_backend_use_msgpack
        )
        try:
            obj = _deserialize_results_payload(
                payload, self._query, cast(bool, results_backend_use_msgpack)
            )
        except SerializationError as ex:
            raise SupersetErrorException(
                SupersetError(
                    message=__(
                        "Data could not be deserialized from the results backend. The "
                        "storage format might have changed, rendering the old data "
                        "stake. You need to re-run the original query."
                    ),
                    error_type=SupersetErrorType.RESULTS_BACKEND_ERROR,
                    level=ErrorLevel.ERROR,
                ),
                status=404,
            ) from ex

        if self._rows:
            obj = apply_display_max_row_configuration_if_require(obj, self._rows)

        return obj
