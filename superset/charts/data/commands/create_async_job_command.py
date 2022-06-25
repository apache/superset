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
from typing import Any, Dict, Optional

from flask import Request

from superset.extensions import async_query_manager
from superset.tasks.async_queries import load_chart_data_into_cache

logger = logging.getLogger(__name__)


class CreateAsyncChartDataJobCommand:
    _async_channel_id: str

    def validate(self, request: Request) -> None:
        jwt_data = async_query_manager.parse_jwt_from_request(request)
        self._async_channel_id = jwt_data["channel"]

    def run(self, form_data: Dict[str, Any], user_id: Optional[int]) -> Dict[str, Any]:
        job_metadata = async_query_manager.init_job(self._async_channel_id, user_id)
        load_chart_data_into_cache.delay(job_metadata, form_data)
        return job_metadata
