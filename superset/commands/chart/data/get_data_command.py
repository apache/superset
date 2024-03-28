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
from typing import Any

from flask_babel import gettext as _

from superset.commands.base import BaseCommand
from superset.commands.chart.exceptions import (
    ChartDataCacheLoadError,
    ChartDataQueryFailedError,
)
from superset.common.query_context import QueryContext
from superset.exceptions import CacheLoadError

logger = logging.getLogger(__name__)


class ChartDataCommand(BaseCommand):
    _query_context: QueryContext

    def __init__(self, query_context: QueryContext):
        self._query_context = query_context

    def run(self, **kwargs: Any) -> dict[str, Any]:
        # caching is handled in query_context.get_df_payload
        # (also evals `force` property)
        cache_query_context = kwargs.get("cache", False)
        force_cached = kwargs.get("force_cached", False)
        try:
            payload = self._query_context.get_payload(
                cache_query_context=cache_query_context, force_cached=force_cached
            )
        except CacheLoadError as ex:
            raise ChartDataCacheLoadError(ex.message) from ex

        for query in payload["queries"]:
            if query.get("error"):
                raise ChartDataQueryFailedError(
                    _("Error: %(error)s", error=query["error"])
                )

        return_value = {
            "query_context": self._query_context,
            "queries": payload["queries"],
        }
        if cache_query_context:
            return_value.update(cache_key=payload["cache_key"])

        return return_value

    def validate(self) -> None:
        self._query_context.raise_for_access()
