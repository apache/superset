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
from typing import Any, cast, Dict

from flask import current_app

from superset import app
from superset.extensions import async_query_manager, cache_manager, celery_app
from superset.utils.cache import generate_cache_key, set_and_log_cache
from superset.views.utils import get_datasource_info, get_viz

logger = logging.getLogger(__name__)
query_timeout = current_app.config[
    "SQLLAB_ASYNC_TIME_LIMIT_SEC"
]  # TODO: new config key


@celery_app.task(name="load_chart_data_into_cache", soft_time_limit=query_timeout)
def load_chart_data_into_cache(
    job_metadata: Dict[str, Any], form_data: Dict[str, Any],
) -> None:
    from superset.charts.commands.data import (
        ChartDataCommand,
    )  # load here due to circular imports

    with app.app_context():  # type: ignore
        try:
            command = ChartDataCommand()
            command.set_query_context(form_data)
            result = command.run(cache=True)
            async_query_manager.update_job(
                job_metadata,
                async_query_manager.STATUS_DONE,
                cache_key=result["cache_key"],
            )
        except Exception as exc:
            msg = exc.message if hasattr(exc, "message") else str(exc)  # type: ignore
            async_query_manager.update_job(
                job_metadata, async_query_manager.STATUS_ERROR, msg=msg
            )
            raise exc

        return None


@celery_app.task(name="load_explore_json_into_cache", soft_time_limit=query_timeout)
def load_explore_json_into_cache(
    job_metadata: Dict[str, Any],
    form_data: Dict[str, Any],
    response_type: str,
    force: bool = False,
) -> None:
    with app.app_context():  # type: ignore
        try:
            datasource_id, datasource_type = get_datasource_info(None, None, form_data)

            viz_obj = get_viz(
                datasource_type=cast(str, datasource_type),
                datasource_id=datasource_id,
                form_data=form_data,
                force=force,
            )
            # run query & cache results
            viz_obj.get_payload()

            # cache form_data for async retrieval
            cache_value = {"form_data": form_data, "response_type": response_type}
            cache_key = generate_cache_key(
                cache_value, "ejr-"
            )  # ejr: explore_json request
            set_and_log_cache(cache_manager.cache, cache_key, cache_value)

            async_query_manager.update_job(
                job_metadata, async_query_manager.STATUS_DONE, cache_key=cache_key,
            )
        except Exception as exc:
            msg = exc.message if hasattr(exc, "message") else str(exc)  # type: ignore
            async_query_manager.update_job(
                job_metadata, async_query_manager.STATUS_ERROR, msg=msg
            )
            raise exc

        return None
