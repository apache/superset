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

import dataclasses
import logging
from typing import Any, TYPE_CHECKING

from celery.exceptions import SoftTimeLimitExceeded
from flask import current_app, g
from flask_appbuilder.security.sqla.models import User
from marshmallow import ValidationError

from superset.charts.schemas import ChartDataQueryContextSchema
from superset.exceptions import (
    SupersetErrorException,
    SupersetErrorsException,
)
from superset.extensions import (
    async_query_manager,
    celery_app,
    security_manager,
)
from superset.utils.core import override_user

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext

logger = logging.getLogger(__name__)
query_timeout = current_app.config[
    "SQLLAB_ASYNC_TIME_LIMIT_SEC"
]  # TODO: new config key


def set_form_data(form_data: dict[str, Any]) -> None:
    g.form_data = form_data


def _create_query_context_from_form(form_data: dict[str, Any]) -> QueryContext:
    """
    Create the query context from the form data.

    :param form_data: The task form data
    :returns: The query context
    :raises ValidationError: If the request is incorrect
    """

    try:
        return ChartDataQueryContextSchema().load(form_data)
    except KeyError as ex:
        raise ValidationError("Request is incorrect") from ex


def _load_user_from_job_metadata(job_metadata: dict[str, Any]) -> User:
    if user_id := job_metadata.get("user_id"):
        # logged in user
        user = security_manager.get_user_by_id(user_id)
    elif guest_token := job_metadata.get("guest_token"):
        # embedded guest user
        user = security_manager.get_guest_user_from_token(guest_token)
        del job_metadata["guest_token"]
    else:
        # default to anonymous user if no user is found
        user = security_manager.get_anonymous_user()
    return user


@celery_app.task(name="load_chart_data_into_cache", soft_time_limit=query_timeout)
def load_chart_data_into_cache(
    job_metadata: dict[str, Any],
    form_data: dict[str, Any],
) -> None:
    # pylint: disable=import-outside-toplevel
    from superset.commands.chart.data.get_data_command import ChartDataCommand

    with override_user(_load_user_from_job_metadata(job_metadata), force=False):
        try:
            set_form_data(form_data)
            query_context = _create_query_context_from_form(form_data)
            command = ChartDataCommand(query_context)
            result = command.run(cache=True)
            cache_key = result["cache_key"]
            result_url = f"/api/v1/chart/data/{cache_key}"
            async_query_manager.update_job(
                job_metadata,
                async_query_manager.STATUS_DONE,
                result_url=result_url,
            )
        except SoftTimeLimitExceeded as ex:
            logger.warning("A timeout occurred while loading chart data, error: %s", ex)
            raise
        except Exception as ex:
            # Extract SIP-40 style errors when available
            if isinstance(ex, SupersetErrorException):
                errors = [dataclasses.asdict(ex.error)]
            elif isinstance(ex, SupersetErrorsException):
                errors = [dataclasses.asdict(error) for error in ex.errors]
            else:
                # Fallback for non-Superset exceptions
                error = str(ex.message if hasattr(ex, "message") else ex)
                errors = [{"message": error}]
            async_query_manager.update_job(
                job_metadata, async_query_manager.STATUS_ERROR, errors=errors
            )
            raise
