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
from typing import Dict, List, Optional

from marshmallow import ValidationError

from superset.charts.commands.exceptions import (
    ChartDataQueryFailedError,
    ChartDataValidationError,
)
from superset.charts.schemas import ChartDataQueryContextSchema
from superset.commands.base import BaseCommand
from superset.common.query_context import QueryContext
from superset.extensions import async_query_manager
from superset.tasks.async_queries import load_chart_data_into_cache

logger = logging.getLogger(__name__)


class ChartDataCommand(BaseCommand):
    def __init__(self, form_data: Dict):
        self._form_data = form_data
        self._query_context: Optional[QueryContext] = None
        self._async_channel_id = None

    def run(self):
        # caching is handled in query_context.get_df_payload (also evals `force` property)
        payload = self._query_context.get_payload()

        for query in payload:
            if query.get("error"):
                raise ChartDataQueryFailedError(f"Error: {query['error']}")

        return {"query_context": self._query_context, "payload": payload}

    def run_async(self):
        # TODO: confirm cache backend is configured
        job_metadata = async_query_manager.init_job(self._async_channel_id)
        load_chart_data_into_cache.delay(job_metadata, self._form_data)

        return job_metadata

    def set_query_context(self) -> None:
        try:
            self._query_context = ChartDataQueryContextSchema().load(self._form_data)
        except KeyError:
            raise ChartDataValidationError("Request is incorrect")
        except ValidationError as error:
            raise ChartDataValidationError(
                "Request is incorrect: %(error)s", error=error.messages
            )

    def validate(self) -> None:
        self.set_query_context()
        self._query_context.raise_for_access()

    def validate_request(self, request: Dict):
        jwt_data = async_query_manager.parse_jwt_from_request(request)
        self._async_channel_id = jwt_data["channel"]
