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
from typing import Dict

from flask import current_app

from superset import app
from superset.charts.commands.exceptions import (
    ChartDataQueryFailedError,
    ChartDataValidationError,
)
from superset.extensions import async_query_manager, celery_app

logger = logging.getLogger(__name__)
query_timeout = current_app.config[
    "SQLLAB_ASYNC_TIME_LIMIT_SEC"
]  # TODO: new config key


@celery_app.task(name="load_chart_data_into_cache", soft_time_limit=query_timeout)
def load_chart_data_into_cache(job_metadata: Dict, form_data: Dict,) -> None:
    from superset.charts.commands.data import (
        ChartDataCommand,
    )  # load here due to circular imports

    with app.app_context():  # type: ignore
        try:
            command = ChartDataCommand(form_data)
            command.set_query_context()
            command.run()
            async_query_manager.update_job(
                job_metadata, async_query_manager.STATUS_DONE
            )
        except Exception as exc:
            msg = exc.message if hasattr(exc, "message") else str(exc)
            async_query_manager.update_job(
                job_metadata, async_query_manager.STATUS_ERROR, msg
            )
            raise exc

        return None
