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
from typing import Any, TYPE_CHECKING

from flask import Request

from superset.extensions import async_query_manager
from superset.tasks.async_queries import submit_chart_data_query_tasks

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext

logger = logging.getLogger(__name__)


class CreateAsyncChartDataJobCommand:
    """Fan a chart-data request out into per-``QueryObject`` GTF tasks.

    Resolves the caller's async channel, then delegates to
    ``submit_chart_data_query_tasks`` which schedules one task per query plus a
    coordinator. The returned job metadata (the HTTP 202 body) carries the
    coordinator task UUID so the client can poll/cancel via the GTF task API.
    """

    _async_channel_id: str

    def validate(self, request: Request) -> None:
        self._async_channel_id = async_query_manager.parse_channel_id_from_request(
            request
        )

    def run(self, query_context: QueryContext, user_id: int | None) -> dict[str, Any]:
        if not getattr(self, "_async_channel_id", None):
            raise RuntimeError(
                "CreateAsyncChartDataJobCommand.run() called before validate(); "
                "the async channel id was not initialized."
            )
        return submit_chart_data_query_tasks(
            self._async_channel_id, query_context, user_id
        )
