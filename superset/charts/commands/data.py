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
from marshmallow import ValidationError

from superset import cache
from superset.charts.commands.exceptions import (
    ChartDataCacheLoadError,
    ChartDataQueryFailedError,
)
from superset.charts.schemas import ChartDataQueryContextSchema
from superset.commands.base import BaseCommand
from superset.common.query_context import QueryContext
from superset.exceptions import CacheLoadError
from superset.extensions import async_query_manager
from superset.tasks.async_queries import load_chart_data_into_cache

logger = logging.getLogger(__name__)


class ChartDataCommand(BaseCommand):
    def __init__(self) -> None:
        self._form_data: Dict[str, Any]
        self._query_context: QueryContext
        self._async_channel_id: str

    def run(self, **kwargs: Any) -> Dict[str, Any]:
        # caching is handled in query_context.get_df_payload
        # (also evals `force` property)
        cache_query_context = kwargs.get("cache", False)
        force_cached = kwargs.get("force_cached", False)
        try:
            payload = self._query_context.get_payload(
                cache_query_context=cache_query_context, force_cached=force_cached
            )
        except CacheLoadError as exc:
            raise ChartDataCacheLoadError(exc.message)

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

    def run_async(self) -> Dict[str, Any]:
        job_metadata = async_query_manager.init_job(self._async_channel_id)
        load_chart_data_into_cache.delay(job_metadata, self._form_data)

        return job_metadata

    def set_query_context(self, form_data: Dict[str, Any]) -> QueryContext:
        self._form_data = form_data
        try:
            self._query_context = ChartDataQueryContextSchema().load(self._form_data)
        except KeyError:
            raise ValidationError("Request is incorrect")
        except ValidationError as error:
            raise error

        return self._query_context

    def validate(self) -> None:
        self._query_context.raise_for_access()

    def validate_async_request(self, request: Request) -> None:
        jwt_data = async_query_manager.parse_jwt_from_request(request)
        self._async_channel_id = jwt_data["channel"]

    def load_query_context_from_cache(  # pylint: disable=no-self-use
        self, cache_key: str
    ) -> Dict[str, Any]:
        cache_value = cache.get(cache_key)
        if not cache_value:
            raise ChartDataCacheLoadError("Cached data not found")

        return cache_value["data"]
