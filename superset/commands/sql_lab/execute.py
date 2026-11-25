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
from uuid import uuid4

from flask_babel import gettext as __
from sqlalchemy import inspect
from sqlalchemy.exc import SQLAlchemyError

from superset import db
from superset.commands.base import BaseCommand
from superset.common.db_query_status import QueryStatus
from superset.errors import SupersetErrorType
from superset.exceptions import (
    SupersetErrorException,
    SupersetErrorsException,
    SupersetGenericErrorException,
)
from superset.models.core import Database
from superset.models.sql_lab import Query
from superset.sql.execution.utils import _extract_errors
from superset.sqllab.command_status import SqlJsonExecutionStatus
from superset.sqllab.exceptions import (
    QueryIsForbiddenToAccessException,
    SqlLabException,
)
from superset.sqllab.execution_context_convertor import ExecutionContextConvertor
from superset.sqllab.query_preparation import (
    connection_revision,
    execution_inputs,
    preparation_error,
    PREPARATION_KEY,
)
from superset.sqllab.utils import set_query_limit
from superset.utils.dates import now_as_float
from superset.utils.decorators import transaction

if TYPE_CHECKING:
    from superset.daos.database import DatabaseDAO
    from superset.daos.query import QueryDAO
    from superset.sqllab.sql_json_executer import SqlJsonExecutor
    from superset.sqllab.sqllab_execution_context import SqlJsonExecutionContext


logger = logging.getLogger(__name__)

CommandResult = dict[str, Any]


class ExecuteSqlCommand(BaseCommand):
    _execution_context: SqlJsonExecutionContext
    _query_dao: QueryDAO
    _database_dao: DatabaseDAO
    _access_validator: CanAccessQueryValidator
    _sql_query_render: SqlQueryRender
    _sql_json_executor: SqlJsonExecutor
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
        sql_json_executor: SqlJsonExecutor,
        execution_context_convertor: ExecutionContextConvertor,
        sqllab_ctas_no_limit_flag: bool,
        log_params: dict[str, Any] | None = None,
    ) -> None:
        self._execution_context = execution_context
        self._query_dao = query_dao
        self._database_dao = database_dao
        self._access_validator = access_validator
        self._sql_query_render = sql_query_render
        self._sql_json_executor = sql_json_executor
        self._execution_context_convertor = execution_context_convertor
        self._sqllab_ctas_no_limit = sqllab_ctas_no_limit_flag
        self._log_params = log_params

    def validate(self) -> None:
        pass

    @transaction()
    def run(
        self,
    ) -> CommandResult:
        """Runs arbitrary sql and returns data as json"""
        try:
            query = self._try_get_existing_query()
            if self._execution_context.prepared_query_id:
                status = self._resume_prepared_query()
            elif query is not None and query.status in (
                QueryStatus.PREPARING,
                QueryStatus.PREPARED,
                QueryStatus.DISCARDED,
            ):
                raise preparation_error()
            elif self.is_query_handled(query):
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
            skip_base_filter=True,
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

            self._validate_access(query, self._execution_context.template_params)
            rendered_query = self._render_query(query)
            self._query_dao.update(
                query, {"limit": self._execution_context.query.limit}
            )
            # Commit now, before dispatch. The async executor below hands off to
            # a Celery worker that re-fetches this query on its own connection
            # (`get_query` in superset/sql_lab.py); under READ COMMITTED that
            # worker only sees the limit recomputed just above once it is
            # committed. `@transaction()` on `run()` only commits after this
            # whole method returns, which is too late: `.delay()` can hand the
            # task to an already-idle worker before that commit lands, so the
            # worker reads back the row's limit as it was at creation time (the
            # raw dropdown value from `create_query()`) instead of the smaller
            # value just computed from the query's own SQL LIMIT. Same race and
            # fix as apache/superset#40070.
            db.session.commit()  # pylint: disable=consider-using-transaction
            return self._sql_json_executor.execute(
                self._execution_context, rendered_query, self._log_params
            )
        except Exception as ex:
            self._record_pending_query_failure(query, ex)
            raise

    def prepare_warning(self) -> dict[str, Any]:
        """Prepare using execution's renderer, assess, and retain a hidden attempt."""
        from superset.commands.sql_lab.estimate import QueryEstimationCommand

        context = self._execution_context
        context.set_database(self._get_the_query_db())
        if not context.client_id or context.select_as_cta or context.prepared_query_id:
            raise preparation_error()
        estimator = QueryEstimationCommand(
            {
                "database_id": context.database_id,
                "sql": context.sql,
                "catalog": context.catalog,
                "schema": context.schema,
                "template_params": context.template_params,
                "query_limit": context.limit,
                "check_warning": True,
            }
        )
        estimator.validate()
        enabled = estimator.get_enabled_check()
        if enabled is None:
            return {"result": {"action": "proceed"}}
        if self._try_get_existing_query() is not None:
            raise preparation_error()
        query = context.create_query()
        assert context.database is not None
        query.database = context.database
        query.status = QueryStatus.PREPARING
        context.set_query(query)
        self._save_new_query(query)
        try:
            rendered = self._render_query(query)
            prepared_sql, reason = estimator._prepare_warning_sql(query, rendered)
            assessment = estimator.assess_prepared_sql(prepared_sql, reason, enabled)
            identifier = str(uuid4())
            query.set_extra_json_key(
                PREPARATION_KEY,
                {
                    "id": identifier,
                    "inputs": execution_inputs(context),
                    "rendered_sql": rendered,
                    "assessed_sql": prepared_sql,
                    "connection_revision": connection_revision(context.database),
                },
            )
            extra_json = query.extra_json
            # Do not flush the local object over a concurrent cancellation.
            with db.session.no_autoflush:
                changed = (
                    db.session.query(Query)
                    .filter(Query.id == query.id, Query.status == QueryStatus.PREPARING)
                    .update(
                        {
                            Query.status: QueryStatus.PREPARED,
                            Query.extra_json: extra_json,
                            Query.limit: query.limit,
                            Query.limiting_factor: query.limiting_factor,
                        },
                        synchronize_session=False,
                    )
                )
            db.session.expire(query)
            db.session.commit()  # pylint: disable=consider-using-transaction
            if not changed:
                raise preparation_error()
            return {"result": assessment, "prepared_query_id": identifier}
        except Exception:
            from superset.sqllab.query_preparation import discard_preparation

            # End the failed transaction before saving cancellation independently.
            db.session.rollback()  # pylint: disable=consider-using-transaction
            discard_preparation(context.client_id_or_short_id)
            raise

    def _render_query(self, query: Query) -> str:
        """Use the existing access checks and renderer for execution and assessment."""
        self._execution_context.set_query(query)
        rendered = self._sql_query_render.render(self._execution_context)
        self._validate_rendered_access(query, rendered)
        self._set_query_limit_if_required(rendered)
        return rendered

    def _resume_prepared_query(self) -> SqlJsonExecutionStatus:
        """Claim one owned preparation and dispatch without rendering its template."""
        from superset.sql_lab import prepare_sql_for_execution
        from superset.sqllab.query_preparation import validate_prepared_sql

        context = self._execution_context
        context.set_database(self._get_the_query_db())
        query = (
            db.session.query(Query)
            .filter(
                Query.client_id == context.client_id, Query.user_id == context.user_id
            )
            .one_or_none()
        )
        if query is None:
            raise preparation_error()
        preparation = query.extra.get(PREPARATION_KEY, {})
        if (
            preparation.get("id") != context.prepared_query_id
            or preparation.get("inputs") != execution_inputs(context)
            or preparation.get("connection_revision")
            != connection_revision(query.database)
        ):
            raise preparation_error()
        context.set_query(query)
        self._validate_rendered_access(query, preparation["rendered_sql"])
        if query.status not in (
            QueryStatus.PREPARED,
            QueryStatus.PREPARING,
            QueryStatus.DISCARDED,
        ):
            return SqlJsonExecutionStatus.QUERY_ALREADY_CREATED
        if query.status != QueryStatus.PREPARED:
            raise preparation_error()
        script = prepare_sql_for_execution(query, preparation["rendered_sql"])
        validate_prepared_sql(query, script)
        claimed = (
            db.session.query(Query)
            .filter(Query.id == query.id, Query.status == QueryStatus.PREPARED)
            .update(
                {
                    Query.status: QueryStatus.PENDING,
                    Query.start_time: now_as_float(),
                    Query.sql_editor_id: context.sql_editor_id,
                    Query.tab_name: context.tab_name,
                },
                synchronize_session=False,
            )
        )
        db.session.commit()  # pylint: disable=consider-using-transaction
        db.session.refresh(query)
        if not claimed:
            if query.status == QueryStatus.DISCARDED:
                raise preparation_error()
            return SqlJsonExecutionStatus.QUERY_ALREADY_CREATED
        try:
            return self._sql_json_executor.execute(
                context, preparation["rendered_sql"], self._log_params
            )
        except Exception as ex:
            self._record_pending_query_failure(query, ex)
            raise

    @staticmethod
    def _record_pending_query_failure(query: Query, ex: Exception) -> None:
        """Save a pending query failure without replacing a worker or stop outcome."""
        # Read identity without loading expired fields from a failed transaction.
        query_id = inspect(query).identity[0]
        try:
            # The pending row was committed for the worker. Roll back partial
            # changes before saving its failure outside the failing transaction.
            db.session.rollback()  # pylint: disable=consider-using-transaction
            changed = (
                db.session.query(Query)
                .filter(Query.id == query_id, Query.status == QueryStatus.PENDING)
                .update({Query.status: QueryStatus.FAILED}, synchronize_session=False)
            )
            if changed:
                # The conditional update holds the row lock through commit.
                db.session.refresh(query)
                query.error_message = str(ex)
                query.end_time = now_as_float()
                query.set_extra_json_key(
                    "errors",
                    [dataclasses.asdict(error) for error in _extract_errors(ex, query)],
                )
            db.session.commit()  # pylint: disable=consider-using-transaction
        except Exception:  # pylint: disable=broad-except
            db.session.rollback()  # pylint: disable=consider-using-transaction
            logger.exception("Query %s: Failed to save execution failure", query_id)

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
        re-render (see its docstring). Restore the previous value without
        flushing temporary SQL, including when rechecking an existing query.
        """
        previous_sql = query.executed_sql
        with db.session.no_autoflush:
            query.executed_sql = rendered_query
            try:
                self._validate_access(query, self._execution_context.template_params)
            finally:
                query.executed_sql = previous_sql

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
        set_query_limit(
            self._execution_context.query,
            rendered_query,
            self._execution_context.limit,
            self._execution_context.database.db_engine_spec,  # type: ignore
        )


class CanAccessQueryValidator:
    def validate(
        self, query: Query, template_params: Optional[dict[str, Any]] = None
    ) -> None:
        raise NotImplementedError()


class SqlQueryRender:
    def render(self, execution_context: SqlJsonExecutionContext) -> str:
        raise NotImplementedError()
