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
from flask import current_app
from flask_appbuilder.security.sqla.models import User
from marshmallow import ValidationError
from superset_core.tasks.types import TaskOptions, TaskScope

from superset.charts.data.form_data import set_form_data
from superset.charts.schemas import ChartDataQueryContextSchema
from superset.common.query_serialization import (
    load_serialized_query,
    serialize_query,
    SerializedQuery,
)
from superset.constants import CacheRegion
from superset.exceptions import (
    SupersetErrorException,
    SupersetErrorsException,
)
from superset.extensions import (
    async_query_manager,
    celery_app,
    security_manager,
)
from superset.tasks.decorators import task
from superset.utils.core import override_user
from superset.utils.error_sanitization import sanitize_error_dicts

if TYPE_CHECKING:
    from superset.common.query_context import QueryContext
    from superset.common.query_object import QueryObject
    from superset.models.tasks import Task
    from superset.security.guest_token import GuestToken

logger = logging.getLogger(__name__)
query_timeout = current_app.config[
    "SQLLAB_ASYNC_TIME_LIMIT_SEC"
]  # TODO: new config key

# GTF task type for the chart-data fan-out. Each QueryObject runs as its own SHARED
# task keyed by its query_cache_key (safe cross-user dedup — the key encodes
# RLS/impersonation). The client polls /api/v1/task/status_changes (filtered to this
# type) and aggregates the tasks' statuses itself; GTF owns completion emission (there
# is no coordinator task). The atomic unit is a QueryObject, not chart-specific, so the
# type is versioned to allow the serialization/execution contract to evolve.
CHART_QUERY_TASK = "superset.query_object_v1"


def _resolve_user(user_id: int | None, guest_token: "GuestToken | None") -> User:
    """Resolve the acting user for an async chart-data task.

    The GTF executor does not impersonate on its own, so each task establishes the
    request user itself (for RLS/impersonation), mirroring the legacy Celery path.
    """
    if user_id:
        return security_manager.get_user_by_id(user_id)
    if guest_token:
        return security_manager.get_guest_user_from_token(guest_token)
    return security_manager.get_anonymous_user()


def _inject_contribution_totals(
    query_obj: "QueryObject", totals_cache_key: str
) -> None:
    """Inject ``contribution_totals`` from the cached totals query into ``query_obj``.

    A contribution query normalizes its metrics against column sums from a separate
    "totals" query. In the per-query task model the totals query runs as its own
    task (a ``depends_on`` prerequisite) and caches its dataframe; here we read that
    cached dataframe and inject the sums into this query's contribution
    post-processing before it runs — the same result the synchronous
    ``ensure_totals_available`` produces, but reading the cache the prerequisite
    populated instead of re-running the totals query. ``contribution_totals`` is
    stripped from the cache key, so this affects only the result, not the key.
    """
    from superset.common.utils.query_cache_manager import QueryCacheManager

    cache = QueryCacheManager.get(key=totals_cache_key, region=CacheRegion.DATA)
    if not cache.is_loaded or cache.df is None:
        # The depends_on prerequisite guarantees the totals task succeeded, so a
        # miss here is unexpected; leave the query as-is (the contribution op will
        # fall back to its own totals) rather than failing the whole chart.
        logger.warning(
            "Totals result not cached under %s; contribution left un-normalized",
            totals_cache_key,
        )
        return
    df = cache.df
    totals = {col: df[col].sum() for col in df.columns if df[col].dtype.kind in "biufc"}
    for post_processing in query_obj.post_processing or []:
        if post_processing.get("operation") == "contribution":
            post_processing.setdefault("options", {})["contribution_totals"] = totals


@task(name=CHART_QUERY_TASK, scope=TaskScope.SHARED, timeout=query_timeout)
def execute_chart_query(
    serialized_query: SerializedQuery,
    user_id: int | None = None,
    guest_token: "GuestToken | None" = None,
    totals_cache_key: str | None = None,
) -> None:
    """Execute a single chart-data query and cache it under its query_cache_key.

    The atomic async unit: reconstruct the one query (canonical serialization),
    optionally inject contribution totals from a prerequisite totals task, then run
    the existing per-query execution/caching path so a re-request reads the same
    DATA-cache entry.
    """
    with override_user(_resolve_user(user_id, guest_token), force=False):
        query_context = load_serialized_query(serialized_query)
        query_obj = query_context.queries[0]
        if totals_cache_key:
            _inject_contribution_totals(query_obj, totals_cache_key)
        # Executes on cache miss and writes CacheRegion.DATA under query_cache_key.
        query_context.get_df_payload_result(query_obj)


def _query_task_cache_key(query_context: "QueryContext", index: int) -> str | None:
    """Compute a query's cache key exactly as its task will.

    ``execute_chart_query`` validates each query before keying (see
    ``get_df_payload_result``), so validate here too — otherwise the SHARED task's
    ``task_key`` (used for cross-user dedup) could diverge from the key the task
    actually caches under.
    """
    query_obj = query_context.queries[index]
    query_obj.validate()
    return query_context.query_cache_key(query_obj)


def submit_chart_data_query_tasks(
    query_context: "QueryContext",
    user_id: int | None,
) -> dict[str, Any]:
    """Fan a chart-data request out into one GTF task per ``QueryObject``.

    Each ``QueryObject`` runs as its own SHARED task keyed by its ``query_cache_key``
    (safe cross-user dedup — the key encodes RLS/impersonation), writing the per-query
    DATA cache a later re-request reads back. A contribution query ``depends_on`` the
    totals query's task and reads its cached result to normalize.

    There is no coordinator task: the client polls ``/api/v1/task/status_changes`` and
    aggregates the query tasks' own honest statuses itself (all ``SUCCESS`` → re-issue
    the request, now served entirely from the per-query cache; any terminal non-success
    → error). GTF owns completion emission (per-task, via the coordination service), so
    the websocket transport subscribes to GTF, not to any GAQ-specific stream.

    Returns the HTTP 202 body ``{"task_ids": [...]}`` — the query tasks' UUIDs, in
    query order, for the client to poll and cancel via the GTF task API.
    """
    guest_user = security_manager.get_current_guest_user_if_guest()
    guest_token = guest_user.guest_token if guest_user else None

    queries = query_context.queries
    # Contribution queries normalize against a shared totals row. Identify the coupling
    # (this also clears the totals query's row_limit so its cache key matches the entry
    # its dependents read) and compute the totals key up front.
    needs_totals, totals_idx = query_context.prepare_contribution_totals()
    totals_key: str | None = None
    if needs_totals and totals_idx is not None:
        # Mirror the row_limit normalization into the raw serialized dict so the totals
        # task caches under the same key its dependents (and the re-request) compute.
        query_context.cache_values["queries"][totals_idx]["row_limit"] = None
        totals_key = _query_task_cache_key(query_context, totals_idx)

    def _schedule(index: int, depends_on: list["Task"] | None = None) -> "Task":
        return execute_chart_query.schedule(
            serialize_query(query_context, index),
            user_id,
            guest_token,
            totals_key if index in needs_totals else None,
            options=TaskOptions(
                task_key=_query_task_cache_key(query_context, index),
                depends_on=depends_on,
            ),
        )

    # Schedule the totals query first so contribution queries can depend on it.
    tasks: dict[int, "Task"] = {}
    if totals_idx is not None and needs_totals:
        tasks[totals_idx] = _schedule(totals_idx)
    for index in range(len(queries)):
        if index not in tasks:
            depends_on = (
                [tasks[totals_idx]]
                if index in needs_totals and totals_idx is not None
                else None
            )
            tasks[index] = _schedule(index, depends_on=depends_on)

    return {"task_ids": [str(tasks[index].uuid) for index in range(len(queries))]}


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


def _handle_soft_time_limit(
    job_metadata: dict[str, Any], ex: Exception, activity: str
) -> None:
    """
    SoftTimeLimitExceeded is raised both by a genuine timeout and by a
    user-initiated cancel (revoke sends SIGUSR1). The cancel endpoint has
    already emitted the terminal event for the latter - it has to, since a task
    revoked while still queued never reaches this handler - so only a timeout
    is reported here, and without one the client would wait forever.
    """
    if async_query_manager.is_job_cancelled(job_metadata["job_id"]):
        logger.info("Cancelled by the user while %s", activity)
        return

    logger.warning("A timeout occurred while %s, error: %s", activity, ex)
    async_query_manager.update_job(
        job_metadata,
        async_query_manager.STATUS_ERROR,
        errors=[{"message": f"A timeout occurred while {activity}"}],
    )


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
            _handle_soft_time_limit(job_metadata, ex, "loading chart data")
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
                job_metadata,
                async_query_manager.STATUS_ERROR,
                errors=sanitize_error_dicts(errors),
            )
            raise
