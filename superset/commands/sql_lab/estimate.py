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
from typing import Any, NotRequired, TypedDict

from flask import current_app as app
from flask_babel import gettext as __
from jinja2 import Environment
from jinja2.exceptions import TemplateError
from marshmallow import ValidationError

from superset import config, db, is_feature_enabled, security_manager
from superset.commands.base import BaseCommand
from superset.daos.database import DatabaseDAO
from superset.databases.schemas import get_query_cost_warning
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    OAuth2RedirectError,
    SupersetDisallowedClientFileTransferException,
    SupersetDisallowedSQLFunctionException,
    SupersetDisallowedSQLTableException,
    SupersetDMLNotAllowedException,
    SupersetErrorException,
    SupersetGenericDBErrorException,
    SupersetTimeoutException,
)
from superset.jinja_context import get_template_processor
from superset.models.core import Database
from superset.models.sql_lab import Query
from superset.sql.parse import SQLScript
from superset.sql_lab import apply_limit
from superset.sqllab.utils import get_query_limit, set_query_limit
from superset.utils import core as utils, json
from superset.utils.rls import apply_rls

logger = logging.getLogger(__name__)


class EstimateQueryCostType(TypedDict):
    database_id: int
    sql: str
    template_params: dict[str, Any]
    catalog: str | None
    schema: str | None
    check_warning: NotRequired[bool]
    query_limit: NotRequired[int | None]


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
        self._check_warning = params.get("check_warning", False)
        self._query_limit = params.get("query_limit")

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
        """Run the disallowed-function/table, file-transfer, DML and RLS controls
        against the SQL to be estimated, mirroring
        ``sql_lab.execute_sql_statements``.

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

        # Rejected regardless of `allow_dml`: these do host file I/O, not DML.
        if file_transfer_commands := parsed_script.get_client_file_transfer_commands():
            raise SupersetDisallowedClientFileTransferException(file_transfer_commands)

        if parsed_script.has_mutation() and not self._database.allow_dml:
            raise SupersetDMLNotAllowedException()

        if rls_enabled:
            for statement in parsed_script.statements:
                apply_rls(self._database, catalog, effective_schema, statement)
            return parsed_script.format()

        return sql

    def _get_warning_rule(self, metric: str) -> dict[str, Any]:
        """Validate saved settings without the display property's disabled fallback."""
        try:
            # Do not use Database.query_cost_warning: its display fallback hides
            # invalid saved rules, which must remain errors on this path.
            rule = get_query_cost_warning(json.loads(self._database.extra or "{}"))
            if rule["enabled"] and rule["metric"] != metric:
                raise ValidationError(
                    {
                        "metric": [
                            __("The warning metric is not supported by this engine.")
                        ]
                    }
                )
        except ValidationError as ex:
            raise SupersetErrorException(
                SupersetError(
                    message=__("The saved query cost warning rule is invalid."),
                    error_type=SupersetErrorType.GENERIC_COMMAND_ERROR,
                    level=ErrorLevel.ERROR,
                    extra={"messages": ex.messages},
                ),
                status=400,
            ) from ex
        return rule

    def _prepare_warning_sql(self) -> tuple[str | None, str | None]:
        """Prepare execution-equivalent SQL, or explain why it cannot be estimated."""
        spec = self._database.db_engine_spec
        if self._template_params or any(
            kind != "data" for _, kind, _ in Environment(autoescape=True).lex(self._sql)
        ):
            return None, __("Warning checks are unavailable for SQL templates.")
        mutator = app.config["SQL_QUERY_MUTATOR"]
        if (mutator and mutator is not config.SQL_QUERY_MUTATOR) or (
            is_feature_enabled("ENABLE_TEMPLATE_PROCESSING")
            and spec.engine in app.config["CUSTOM_TEMPLATE_PROCESSORS"]
        ):
            return None, __(
                "Warning checks are unavailable for custom SQL transformations."
            )

        if self._catalog is None:
            self._catalog = self._database.get_default_catalog()
        sql = self._apply_sql_security(self._sql)
        script = SQLScript(sql, engine=spec.engine)
        if (
            len(script.statements) != 1
            or not script.statements[0].is_select()
            or script.statements[0].is_mutating()
        ):
            return None, __("Warning checks require a single read-only SELECT.")

        # Use execution's dropdown/SQL limits and its extra truncation row.
        # This Query is never persisted or dispatched for execution.
        query = Query(database=self._database, select_as_cta_used=False)
        if query in db.session:
            db.session.expunge(query)
        set_query_limit(query, sql, get_query_limit(self._query_limit))
        apply_limit(query, script.statements[0])
        return script.format(comments=spec.allows_sql_comments), None

    def _run_warning_check(self) -> dict[str, Any]:
        """Compare raw usage while keeping failures distinct from advisory opt-outs."""
        if not (
            is_feature_enabled("SQLLAB_QUERY_COST_WARNINGS")
            and is_feature_enabled("ESTIMATE_QUERY_COST")
        ):
            return {"status": "disabled"}
        spec = self._database.db_engine_spec
        metric = spec.get_query_cost_warning_metric()
        if metric is None:
            return {"status": "unsupported"}
        if self._database.allows_cost_estimate is not True:
            return {"status": "disabled"}
        rule = self._get_warning_rule(metric)
        if rule["enabled"] is False:
            return {"status": "disabled"}

        label, unit = (
            (__("Estimated bytes processed"), __("bytes"))
            if metric == "bytes_processed"
            else (__("Estimated planner cost"), __("planner cost units"))
        )
        result: dict[str, Any] = {
            "status": "unavailable",
            "metric": metric,
            "label": label,
            "unit": unit,
            "value": None,
            "threshold": rule["threshold"],
        }
        sql, reason = self._prepare_warning_sql()
        if sql is None:
            return {**result, "message": reason}

        timeout = app.config["SQLLAB_QUERY_COST_ESTIMATE_TIMEOUT"]
        try:
            with utils.timeout(
                seconds=timeout,
                error_message=f"The estimation exceeded the {timeout} seconds timeout.",
            ):
                estimate = spec.estimate_query_cost_for_warning(
                    self._database, self._catalog, self._schema, sql
                )
        except SupersetTimeoutException:
            return {**result, "message": __("The query cost estimate timed out.")}

        comparison = estimate.compare(rule["threshold"])
        result.update(
            accuracy=estimate.accuracy,
            row_level_security_applied=estimate.row_level_security_applied,
        )
        if estimate.row_level_security_applied is not True and estimate.accuracy in {
            "PRECISE",
            "LOWER_BOUND",
            "UPPER_BOUND",
        }:
            result["value"] = estimate.value
        if comparison == "unavailable":
            return {
                **result,
                "message": __(
                    "The estimate is unavailable or cannot establish whether "
                    "usage is within the warning threshold."
                ),
            }
        result["status"] = (
            "exceeded" if comparison == "above_threshold" else "within_threshold"
        )
        result["message"] = (
            __("The estimate exceeds this connection's warning threshold.")
            if result["status"] == "exceeded"
            else __("The estimate is within this connection's warning threshold.")
        )
        return result

    def run(
        self,
    ) -> list[dict[str, Any]] | dict[str, Any]:
        self.validate()

        if self._check_warning:
            return self._run_warning_check()
        return self._run_manual_estimate()

    def _run_manual_estimate(self) -> list[dict[str, Any]]:
        """Preserve the manual estimator's rendering, formatter and error contract."""
        sql = self._sql
        if self._template_params:
            # Access is already checked in validate() before any rendering.
            template_processor = get_template_processor(self._database)
            try:
                sql = template_processor.process_template(sql, **self._template_params)
            except TemplateError as ex:
                raise SupersetErrorException(
                    SupersetError(
                        message=str(ex),
                        error_type=SupersetErrorType.GENERIC_COMMAND_ERROR,
                        level=ErrorLevel.ERROR,
                    ),
                    status=400,
                ) from ex

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
