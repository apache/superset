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
# pylint: disable=too-few-public-methods, too-many-arguments
from __future__ import annotations

import dataclasses
import logging
from typing import Any, Optional, TYPE_CHECKING

from flask import current_app as app
from flask_babel import gettext as __
from sqlalchemy.exc import SQLAlchemyError

from superset import db, is_feature_enabled
from superset.commands.base import BaseCommand
from superset.common.db_query_status import QueryStatus
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    SupersetErrorException,
    SupersetErrorsException,
    SupersetGenericDBErrorException,
    SupersetGenericErrorException,
)
from superset.models.core import Database
from superset.models.sql_lab import Query
from superset.sqllab.command_status import SqlJsonExecutionStatus
from superset.sqllab.exceptions import (
    QueryIsForbiddenToAccessException,
    SqlLabException,
)
from superset.sqllab.execution_context_convertor import ExecutionContextConvertor
from superset.sqllab.limiting_factor import LimitingFactor
from superset.utils import core as utils
from superset.utils.core import get_username
from superset.utils.dates import now_as_float
from superset.utils.decorators import transaction

if TYPE_CHECKING:
    from superset.daos.database import DatabaseDAO
    from superset.daos.query import QueryDAO
    from superset.sqllab.sqllab_execution_context import SqlJsonExecutionContext


logger = logging.getLogger(__name__)

CommandResult = dict[str, Any]


class ExecuteSqlCommand(BaseCommand):
    _execution_context: SqlJsonExecutionContext
    _query_dao: QueryDAO
    _database_dao: DatabaseDAO
    _access_validator: CanAccessQueryValidator
    _sql_query_render: SqlQueryRender
    _execution_context_convertor: ExecutionContextConvertor
    _sqllab_ctas_no_limit: bool
    _log_params: dict[str, Any] | None = None

    def __init__(
        self,
        execution_context: SqlJsonExecutionContext,
        query_dao: QueryDAO,
        database_dao: DatabaseDAO,
        access_validator: CanAccessQueryValidator,
        sql_query_render: SqlQueryRender,
        execution_context_convertor: ExecutionContextConvertor,
        sqllab_ctas_no_limit_flag: bool,
        log_params: dict[str, Any] | None = None,
    ) -> None:
        self._execution_context = execution_context
        self._query_dao = query_dao
        self._database_dao = database_dao
        self._access_validator = access_validator
        self._sql_query_render = sql_query_render
        self._execution_context_convertor = execution_context_convertor
        self._sqllab_ctas_no_limit = sqllab_ctas_no_limit_flag
        self._log_params = log_params
        # Set in run() for a fresh async query; consumed by submit_async(), which
        # the endpoint calls AFTER this command's transaction commits (scheduling a
        # GTF task cannot run inside an outer @transaction — see submit_async).
        self._rendered_query: str | None = None
        self._pending_async = False

    def validate(self) -> None:
        pass

    @transaction()
    def run(
        self,
    ) -> CommandResult:
        """Runs arbitrary sql and returns data as json"""
        try:
            query = self._try_get_existing_query()
            if self.is_query_handled(query):
                self._execution_context.set_query(query)  # type: ignore
                status = SqlJsonExecutionStatus.QUERY_ALREADY_CREATED
            else:
                status = self._run_sql_json_exec_from_scratch()

            self._execution_context_convertor.set_payload(
                self._execution_context, status
            )

            # save columns into metadata_json
            self._query_dao.save_metadata(
                self._execution_context.query, self._execution_context_convertor.payload
            )

            return {
                "status": status,
                "payload": self._execution_context_convertor.serialize_payload(),
            }
        except (SupersetErrorException, SupersetErrorsException):
            # to make sure we raising the original
            # SupersetErrorsException || SupersetErrorsException
            raise
        except Exception as ex:
            raise SqlLabException(self._execution_context, exception=ex) from ex

    def _try_get_existing_query(self) -> Query | None:
        return self._query_dao.find_one_or_none(
            client_id=self._execution_context.client_id,
            user_id=self._execution_context.user_id,
            sql_editor_id=self._execution_context.sql_editor_id,
        )

    @classmethod
    def is_query_handled(cls, query: Query | None) -> bool:
        return query is not None and query.status in [
            QueryStatus.RUNNING,
            QueryStatus.PENDING,
            QueryStatus.TIMED_OUT,
        ]

    def _run_sql_json_exec_from_scratch(self) -> SqlJsonExecutionStatus:
        self._execution_context.set_database(self._get_the_query_db())
        query = self._execution_context.create_query()
        self._save_new_query(query)
        try:
            logger.info("Triggering query_id: %i", query.id)

            # Necessary to check access before rendering the Jinjafied query as the
            # some Jinja macros execute statements upon rendering.
            self._validate_access(query, self._execution_context.template_params)
            self._execution_context.set_query(query)
            rendered_query = self._sql_query_render.render(self._execution_context)
            # The check above authorizes a render of query.sql + template_params
            # performed before rendering, so that macros with side effects are
            # gated before they run. self._sql_query_render.render() above is an
            # independent second render of the same source; for a
            # nondeterministic template (e.g. one using Jinja's `random` filter
            # to pick a table) the two renders can diverge, letting a query
            # read a table the first check never saw. Re-validate the literal
            # rendered text that is about to execute.
            self._validate_rendered_access(query, rendered_query)
            self._set_query_limit_if_required(rendered_query)
            self._query_dao.update(
                query, {"limit": self._execution_context.query.limit}
            )
            return self._execute(rendered_query)
        except Exception:
            self._query_dao.update(query, {"status": QueryStatus.FAILED})
            raise

    def _execute(self, rendered_query: str) -> SqlJsonExecutionStatus:
        """Dispatch to synchronous (inline) or asynchronous (GTF task) execution.

        Sync runs the query in-process via the unified SQL-Lab executor entry.
        Async only *prepares* here (the ``Query`` row is committed by this
        command's transaction); the actual GTF task is scheduled by
        ``submit_async``, which the endpoint calls after the transaction commits
        because scheduling a task cannot run inside an outer ``@transaction``.
        """
        if self._execution_context.is_run_asynchronous():
            return self._prepare_async(rendered_query)
        return self._execute_sync(rendered_query)

    def _execute_sync(self, rendered_query: str) -> SqlJsonExecutionStatus:
        """Run the query inline via ``execute_sql_lab_query`` and set the result."""
        from superset.sql.execution.sqllab_executor import execute_sql_lab_query
        from superset.sql_lab import get_query, handle_query_error

        context = self._execution_context
        query = context.query
        timeout = app.config["SQLLAB_TIMEOUT"]
        store_results = (
            is_feature_enabled("SQLLAB_BACKEND_PERSISTENCE")
            and not context.select_as_cta
        )
        with utils.timeout(
            seconds=timeout,
            error_message=f"The query exceeded the {timeout} seconds timeout.",
        ):
            try:
                data = execute_sql_lab_query(
                    query,
                    rendered_query,
                    return_results=True,
                    store_results=store_results,
                    expand_data=context.expand_data,
                    log_params=self._log_params,
                )
            except Exception as ex:  # pylint: disable=broad-except
                # Any execution error (including a soft timeout raised via the
                # timeout context) becomes a FAILED payload — the classic sync path
                # caught everything the same way. Re-fetch first: the session may be
                # poisoned by the failed statement.
                data = handle_query_error(ex, get_query(query_id=query.id))

        context.set_execution_result(data)
        if data and data.get("status") == QueryStatus.FAILED:
            if data.get("errors"):
                errors = [SupersetError(**params) for params in data["errors"]]
                status = (
                    500
                    if any(error.level == ErrorLevel.ERROR for error in errors)
                    else 400
                )
                raise SupersetErrorsException(errors, status=status)
            raise SupersetGenericDBErrorException(data["error"])
        return SqlJsonExecutionStatus.HAS_RESULTS

    def _prepare_async(self, rendered_query: str) -> SqlJsonExecutionStatus:
        """Validate async prerequisites and defer scheduling to ``submit_async``.

        Async SQL Lab execution runs as a GTF task, so it requires the
        ``GLOBAL_TASK_FRAMEWORK`` feature flag; fail fast with a clear error when
        it is disabled rather than surfacing a raw framework error at schedule time.
        """
        if not is_feature_enabled("GLOBAL_TASK_FRAMEWORK"):
            error = SupersetError(
                message=__(
                    "Asynchronous SQL Lab execution requires the "
                    "GLOBAL_TASK_FRAMEWORK feature flag to be enabled."
                ),
                error_type=SupersetErrorType.ASYNC_WORKERS_ERROR,
                level=ErrorLevel.ERROR,
            )
            self._fail_query(error)
            raise SupersetErrorException(error)
        self._rendered_query = rendered_query
        self._pending_async = True
        return SqlJsonExecutionStatus.QUERY_IS_RUNNING

    def submit_async(self) -> dict[str, Any] | None:
        """Schedule the async GTF SQL task, outside this command's transaction.

        Called by the endpoint after ``run`` commits. Scheduling a GTF task
        acquires its own lock/transaction and refuses to run inside an outer
        ``@transaction`` (see ``SubmitTaskCommand``), so it must happen here.

        Returns the ``async_job`` descriptor the endpoint surfaces in the 202
        (``{task_id, cursor, tab_id?}``): the scheduled task's UUID, a
        server-captured pre-task status cursor (the recovery watermark the client
        polls/catches up ``/api/v1/task/status_changes`` from — captured *before*
        scheduling so no completion can slip in ahead of the client's waiter), and
        the per-tab id the subscription policy recorded (so a later cancel detaches
        exactly this tab). ``None`` when there is nothing to schedule.
        """
        if not self._pending_async:
            return None
        from superset_core.tasks.types import TaskOptions

        from superset.tasks.sql_queries import run_sql_lab_query
        from superset.tasks.subscription import get_request_tab_id
        from superset.tasks.utils import floored_status_cursor

        context = self._execution_context
        query = context.query
        # Capture the status-poll cursor BEFORE the task is created so the client is
        # guaranteed to observe its completion even if the task finishes before the
        # waiter is established (floored to whole seconds; see floored_status_cursor).
        poll_cursor = floored_status_cursor()
        try:
            task = run_sql_lab_query.schedule(
                query.id,
                self._rendered_query,
                store_results=not context.select_as_cta,
                expand_data=context.expand_data,
                username=get_username(),
                start_time=now_as_float(),
                log_params=self._log_params,
                # PRIVATE dedup on the browser-generated client_id subsumes the
                # classic ``is_query_handled`` idempotency guard.
                options=TaskOptions(task_key=query.client_id),
            )
        except Exception as ex:  # pylint: disable=broad-except
            logger.exception("Query %i: failed to schedule async task", query.id)
            error = SupersetError(
                message=__("Failed to start remote query on a worker."),
                error_type=SupersetErrorType.ASYNC_WORKERS_ERROR,
                level=ErrorLevel.ERROR,
            )
            self._fail_query(error)
            raise SupersetErrorException(error) from ex

        async_job: dict[str, Any] = {
            "task_id": str(task.uuid),
            "cursor": poll_cursor.isoformat(),
        }
        if tab_id := get_request_tab_id():
            async_job["tab_id"] = tab_id
        return async_job

    def _fail_query(self, error: SupersetError) -> None:
        """Mark the query FAILED with ``error`` (own transaction — submit_async
        runs outside the command's)."""
        query = self._execution_context.query
        query.set_extra_json_key("errors", [dataclasses.asdict(error)])
        query.status = QueryStatus.FAILED
        query.error_message = error.message
        db.session.commit()  # pylint: disable=consider-using-transaction

    def _get_the_query_db(self) -> Database:
        mydb: Any = self._database_dao.find_by_id(self._execution_context.database_id)
        self._validate_query_db(mydb)
        return mydb

    @classmethod
    def _validate_query_db(cls, database: Database | None) -> None:
        if not database:
            raise SupersetGenericErrorException(
                __(
                    "The database referenced in this query was not found. Please "
                    "contact an administrator for further assistance or try again."
                )
            )

    def _save_new_query(self, query: Query) -> None:
        """
        Saves the new SQL Lab query.

        Committing within a transaction violates the "unit of work" construct, but is
        necessary for async querying. The Celery task is defined within the confines
        of another command and needs to read a previously committed state given the
        `READ COMMITTED` isolation level.

        To mitigate said issue, ideally there would be a command to prepare said query
        and another to execute it, either in a sync or async manner.

        :param query: The SQL Lab query
        """
        try:
            self._query_dao.create(query)
        except SQLAlchemyError as ex:
            raise SqlLabException(
                self._execution_context,
                SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
                "The query record was not created as expected",
                ex,
                "Please contact an administrator for further assistance or try again.",
            ) from ex

        db.session.commit()  # pylint: disable=consider-using-transaction

    def _validate_access(
        self, query: Query, template_params: Optional[dict[str, Any]] = None
    ) -> None:
        try:
            self._access_validator.validate(query, template_params)
        except Exception as ex:
            raise QueryIsForbiddenToAccessException(self._execution_context, ex) from ex

    def _validate_rendered_access(self, query: Query, rendered_query: str) -> None:
        """
        Re-authorize the exact SQL that is about to execute.

        Pins ``query.executed_sql`` to the literal, already-rendered text so
        ``security_manager.raise_for_access``'s "prefer executed_sql" path
        authorizes that exact SQL directly, with no further Jinja
        re-render (see its docstring). ``executed_sql`` is reset
        afterwards so the execution path can assign its own final
        (limited / per-block mutated) SQL.
        """
        query.executed_sql = rendered_query
        try:
            self._validate_access(query, self._execution_context.template_params)
        finally:
            query.executed_sql = None

    def _set_query_limit_if_required(
        self,
        rendered_query: str,
    ) -> None:
        if self._is_required_to_set_limit():
            self._set_query_limit(rendered_query)

    def _is_required_to_set_limit(self) -> bool:
        return not (
            self._sqllab_ctas_no_limit and self._execution_context.select_as_cta
        )

    def _set_query_limit(self, rendered_query: str) -> None:
        db_engine_spec = self._execution_context.database.db_engine_spec  # type: ignore
        limits = [
            db_engine_spec.get_limit_from_sql(rendered_query),
            self._execution_context.limit,
        ]
        if limits[0] is None or limits[0] > limits[1]:  # type: ignore
            self._execution_context.query.limiting_factor = LimitingFactor.DROPDOWN
        elif limits[1] > limits[0]:  # type: ignore
            self._execution_context.query.limiting_factor = LimitingFactor.QUERY
        else:  # limits[0] == limits[1]
            self._execution_context.query.limiting_factor = (
                LimitingFactor.QUERY_AND_DROPDOWN
            )
        self._execution_context.query.limit = min(
            lim for lim in limits if lim is not None
        )


class CanAccessQueryValidator:
    def validate(
        self, query: Query, template_params: Optional[dict[str, Any]] = None
    ) -> None:
        raise NotImplementedError()


class SqlQueryRender:
    def render(self, execution_context: SqlJsonExecutionContext) -> str:
        raise NotImplementedError()
