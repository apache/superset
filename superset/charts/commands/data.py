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
from typing import Any, Dict

from flask import Request

from superset.charts.commands.exceptions import (
    ChartDataCacheLoadError,
    ChartDataQueryFailedError,
)
from superset.commands.base import BaseCommand
from superset.common.query_context import QueryContext
from superset.common.query_context_processor import QueryContextProcessor
from superset.exceptions import CacheLoadError
from superset.extensions import async_query_manager
from superset.tasks.async_queries import load_chart_data_into_cache

logger = logging.getLogger(__name__)


class ChartDataCommand(BaseCommand):
    _query_context: QueryContext

    def __init__(self, query_context: QueryContext) -> None:
        self._query_context = query_context
        self._query_context_processor = QueryContextProcessor()

    def run(self, **kwargs: Any) -> Dict[str, Any]:
        # caching is handled in query_context.get_df_payload
        # (also evals `force` property)
        cache_query_context = kwargs.get("cache", False)
        force_cached = kwargs.get("force_cached", False)
        try:
            payload = self._query_context_processor.get_payload(
                query_context=self._query_context,
                cache_query_context=cache_query_context,
                force_cached=force_cached,
            )
        except CacheLoadError as ex:
            raise ChartDataCacheLoadError(ex.message) from ex

        # TODO: QueryContext should support SIP-40 style errors
        for query in payload["queries"]:
            if query.get("error"):
                raise ChartDataQueryFailedError(f"Error: {query['error']}")

        return_value = {
            "query_context": self._query_context,
            "queries": payload["queries"],
        }
        if cache_query_context:
            return_value.update(cache_key=payload["cache_key"])

        return return_value

    def validate(self) -> None:
        self._query_context_processor.raise_for_access(self._query_context)


class CreateAsyncChartDataJobCommand(BaseCommand):
    _query_context: Dict[str, Any]
    _request: Request
    _async_channel_id: str
    _user_id: str

    def __init__(self, request: Request, user_id: str, query_context: Dict[str, Any]):
        self._request = request
        self._user_id = user_id
        self._query_context = query_context

    def validate(self) -> None:
        jwt_data = async_query_manager.parse_jwt_from_request(self._request)
        self._async_channel_id = jwt_data["channel"]

    def run(self) -> Dict[str, Any]:
        job_metadata = async_query_manager.init_job(
            self._async_channel_id, self._user_id
        )

        load_chart_data_into_cache.delay(job_metadata, self._query_context)

        return job_metadata
