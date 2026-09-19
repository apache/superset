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

import logging
from typing import Any, TypedDict

from flask import current_app as app
from flask_babel import gettext as __
from jinja2.exceptions import TemplateError

from superset import db, is_feature_enabled, security_manager
from superset.commands.base import BaseCommand
from superset.daos.database import DatabaseDAO
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    OAuth2RedirectError,
    SupersetDisallowedSQLFunctionException,
    SupersetDisallowedSQLTableException,
    SupersetDMLNotAllowedException,
    SupersetErrorException,
    SupersetGenericDBErrorException,
    SupersetTimeoutException,
)
from superset.jinja_context import (
    get_template_processor,
    PARAMETER_MISSING_ERR,
    undefined_parameters_message,
)
from superset.models.core import Database
from superset.models.sql_lab import Query
from superset.sql.parse import SQLScript
from superset.utils import core as utils, json
from superset.utils.rls import apply_rls

logger = logging.getLogger(__name__)


class EstimateQueryCostType(TypedDict):
    database_id: int
    sql: str
    template_params: dict[str, Any]
    catalog: str | None
    schema: str | None


class QueryEstimationCommand(BaseCommand):
    _database_id: int
    _sql: str
    _template_params: dict[str, Any]
    _schema: str
    _database: Database
    _catalog: str | None

    def __init__(self, params: EstimateQueryCostType) -> None:
        self._database_id = params["database_id"]
        self._sql = params.get("sql", "")
        self._template_params = params.get("template_params", {})
        self._schema = params.get("schema") or ""
        self._catalog = params.get("catalog")

    def validate(self) -> None:
        # Load the database through the DAO so ``DatabaseFilter`` scopes
        # visibility the same way it does on the SQL Lab execution path.
        database = DatabaseDAO.find_by_id(self._database_id)
        if not database:
            raise SupersetErrorException(
                SupersetError(
                    message=__("The database could not be found"),
                    error_type=SupersetErrorType.RESULTS_BACKEND_ERROR,
                    level=ErrorLevel.ERROR,
                ),
                status=404,
            )
        self._database = database
        # Pass the SQL so table-level authorization runs, mirroring the SQL
        # Lab execution path. Runs before Jinja templating in ``run()``.
        security_manager.raise_for_access(
            database=self._database,
            sql=self._sql,
            catalog=self._catalog,
            schema=self._schema or None,
            template_params=self._template_params,
            force_dataset_match=True,
        )

    def _apply_sql_security(self, sql: str) -> str:
        """Run the disallowed-function/table, DML and RLS controls against the
        SQL to be estimated, mirroring ``sql_lab.execute_sql_statements``.

        Returns the SQL with RLS predicates injected (when ``RLS_IN_SQLLAB`` is
        enabled), so the cost estimate reflects the same constrained query the
        user would actually be allowed to run.
        """
        db_engine_spec = self._database.db_engine_spec
        parsed_script = SQLScript(sql, engine=db_engine_spec.engine)

        disallowed_functions = app.config["DISALLOWED_SQL_FUNCTIONS"].get(
            db_engine_spec.engine,
            set(),
        )
        if disallowed_functions and parsed_script.check_functions_present(
            disallowed_functions
        ):
            raise SupersetDisallowedSQLFunctionException(disallowed_functions)

        disallowed_tables = app.config["DISALLOWED_SQL_TABLES"].get(
            db_engine_spec.engine,
            set(),
        )
        rls_enabled = is_feature_enabled("RLS_IN_SQLLAB")

        # Resolve the effective per-query schema once, the same way the execution
        # path does (``sql_lab.execute_sql_statements``), but only when a control
        # below actually needs it. Going through ``get_default_schema_for_query``
        # rather than the static ``get_default_schema`` runs engine-specific
        # per-query security gates too — e.g. ``PostgresEngineSpec`` rejects a
        # query that sets ``search_path`` — and resolves unqualified references to
        # the schema the engine uses at runtime, so both the denylist check and
        # RLS injection match the execution path exactly.
        catalog: str | None = None
        effective_schema = ""
        if disallowed_tables or rls_enabled:
            catalog = self._catalog or self._database.get_default_catalog()
            resolved_schema = self._database.resolve_query_default_schema(
                self._sql, self._schema, catalog, self._template_params
            )
            # An explicit schema still wins for matching/RLS targeting; otherwise
            # fall back to the runtime-resolved default.
            effective_schema = self._schema or resolved_schema or ""

        if disallowed_tables:
            # Honors schema-qualified denylist entries (e.g.
            # ``information_schema.tables``) and reports only the tables
            # actually referenced by the query.
            found_tables = parsed_script.get_disallowed_tables(
                disallowed_tables, effective_schema
            )
            if found_tables:
                raise SupersetDisallowedSQLTableException(found_tables)

        if parsed_script.has_mutation() and not self._database.allow_dml:
            raise SupersetDMLNotAllowedException()

        if rls_enabled:
            for statement in parsed_script.statements:
                apply_rls(self._database, catalog, effective_schema, statement)
            return parsed_script.format()

        return sql

    def run(
        self,
    ) -> list[dict[str, Any]]:
        self.validate()

        # Rendered whether or not `template_params` was supplied, the way
        # `validate()` above already jinja-processes for authorization and the
        # execution path does in `SqlQueryRenderImpl.render`. A query needs no
        # declared parameter to need rendering -- `get_time_filter()`,
        # `current_username()`, `url_param()` take none -- and SQL Lab posts an
        # empty `template_params` for an estimate, so those never rendered.
        # The execution path builds its processor from the SQL Lab query and
        # authorizes the rendered text through it (`_validate_rendered_access`).
        # Nothing is persisted here, so an unpersisted query carries the same
        # context: the selected schema and catalog for a macro resolving an
        # unqualified table, and, once rendered, the literal SQL to authorize.
        # Built the way `raise_for_access` builds one from a raw `sql=`; never
        # added to the session, expunged if a backref did.
        query = Query(
            database=self._database,
            sql=self._sql,
            schema=self._schema or None,
            catalog=self._catalog,
            client_id=utils.shortid()[:10],
            user_id=utils.get_user_id(),
        )
        if query in db.session:
            db.session.expunge(query)
        template_processor = get_template_processor(self._database, query=query)
        # Both calls sit inside the `TemplateError` catch, as they do in
        # `SqlQueryRenderImpl.render`: `get_undefined_parameters` parses the
        # rendered SQL with Jinja, so a parameter whose *value* carries
        # malformed Jinja raises from there too, and reads the same to the
        # caller as one raised while rendering.
        try:
            sql = template_processor.process_template(
                self._sql, **self._template_params
            )
            # A parameter left unresolved makes the estimate describe a
            # different query than the one Run would execute, so it is
            # reported the way `SqlQueryRenderImpl._validate` reports it.
            undefined_parameters = sorted(
                template_processor.get_undefined_parameters(sql)
            )
        except TemplateError as ex:
            raise SupersetErrorException(
                SupersetError(
                    message=str(ex),
                    error_type=SupersetErrorType.GENERIC_COMMAND_ERROR,
                    level=ErrorLevel.ERROR,
                ),
                status=400,
            ) from ex

        if undefined_parameters:
            raise SupersetErrorException(
                SupersetError(
                    message=(
                        f"{undefined_parameters_message(undefined_parameters)} "
                        f"{str(PARAMETER_MISSING_ERR)}"
                    ),
                    error_type=SupersetErrorType.MISSING_TEMPLATE_PARAMS_ERROR,
                    level=ErrorLevel.ERROR,
                    extra={
                        "undefined_parameters": undefined_parameters,
                        "template_parameters": self._template_params,
                    },
                ),
                status=400,
            )

        # Re-authorize the rendered SQL the way `_validate_rendered_access`
        # does: pinned as `executed_sql`, which `raise_for_access` prefers over
        # `sql` + `template_params`. The check in `validate()` authorized a
        # render of its own, and a template need not render the same way twice
        # -- `{{ ['a', 'b'] | random }}` resolves independently each time --
        # so the first check can clear a table this estimate never touches and
        # miss the one it does. `raise_for_access` still passes the pinned text
        # through `process_jinja_sql` with no template params, exactly as it
        # does for the execution path; fully rendered SQL comes back unchanged.
        query.executed_sql = sql
        security_manager.raise_for_access(query=query, force_dataset_match=True)

        # Apply the same SQL security controls used by the execution path
        # (sql_lab.execute_sql_statements) so cost estimation cannot be used to
        # probe disallowed functions/tables, bypass the DML guard, or confirm
        # the existence of rows hidden by row-level security.
        sql = self._apply_sql_security(sql)

        timeout = app.config["SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT"]
        timeout_msg = f"The estimation exceeded the {timeout} seconds timeout."
        try:
            with utils.timeout(seconds=timeout, error_message=timeout_msg):
                cost = self._database.db_engine_spec.estimate_query_cost(
                    self._database,
                    self._catalog,
                    self._schema,
                    sql,
                    utils.QuerySource.SQL_LAB,
                )
        except SupersetTimeoutException as ex:
            logger.exception(ex)
            raise SupersetErrorException(
                SupersetError(
                    message=__(
                        "The query estimation was killed after %(sqllab_timeout)s "
                        "seconds. It might be too complex, or the database might be "
                        "under heavy load.",
                        sqllab_timeout=app.config["SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT"],
                    ),
                    error_type=SupersetErrorType.SQLLAB_TIMEOUT_ERROR,
                    level=ErrorLevel.ERROR,
                ),
                status=500,
            ) from ex
        except json.JSONDecodeError as ex:
            logger.exception(ex)
            raise SupersetErrorException(
                SupersetError(
                    message=__(
                        "Unable to parse the cost estimate returned by the database."
                    ),
                    error_type=SupersetErrorType.GENERIC_BACKEND_ERROR,
                    level=ErrorLevel.ERROR,
                ),
                status=500,
            ) from ex
        except OAuth2RedirectError:
            # user needs to authenticate with OAuth2 in order to run query
            raise
        except Exception as ex:
            logger.exception("Query cost estimation failed unexpectedly")
            raise SupersetGenericDBErrorException(
                utils.error_msg_from_exception(ex)
            ) from ex

        spec = self._database.db_engine_spec
        query_cost_formatters: dict[str, Any] = app.config[
            "QUERY_COST_FORMATTERS_BY_ENGINE"
        ]
        query_cost_formatter = query_cost_formatters.get(
            spec.engine, spec.query_cost_formatter
        )
        cost = query_cost_formatter(cost)
        return cost
