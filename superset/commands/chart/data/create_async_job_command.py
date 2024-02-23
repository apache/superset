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
from typing import Any, Optional

from flask import Request

from superset.extensions import async_query_manager

logger = logging.getLogger(__name__)


class CreateAsyncChartDataJobCommand:
    _async_channel_id: str

    def validate(self, request: Request) -> None:
        self._async_channel_id = async_query_manager.parse_channel_id_from_request(
            request
        )

    def run(self, form_data: dict[str, Any], user_id: Optional[int]) -> dict[str, Any]:
        return async_query_manager.submit_chart_data_job(
            self._async_channel_id, form_data, user_id
        )
