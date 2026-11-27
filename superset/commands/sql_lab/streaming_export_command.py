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
"""Command for streaming CSV exports of SQL Lab query results."""

from __future__ import annotations

import logging
from typing import Any, Callable, cast

from flask_babel import gettext as __
from jinja2.exceptions import TemplateError

from superset import db
from superset.commands.streaming_export.base import BaseStreamingCSVExportCommand
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import SupersetErrorException, SupersetSecurityException
from superset.models.sql_lab import Query
from superset.sql.parse import SQLScript
from superset.sqllab.limiting_factor import LimitingFactor

logger = logging.getLogger(__name__)


class StreamingSqlResultExportCommand(BaseStreamingCSVExportCommand):
    """
    Command to execute a streaming CSV export of SQL Lab query results.

    This command handles SQL Lab-specific logic:
    - Query validation and access control
    - SQL parsing and limit extraction
    - LimitingFactor-based row limit adjustment
    """

    def __init__(
        self,
        client_id: str,
        chunk_size: int = 1000,
        *,
        progress_callback: Callable[[int, int], None] | None = None,
        raise_on_error: bool = False,
    ):
        """
        Initialize the SQL Lab streaming export command.

        Args:
            client_id: The SQL Lab query client ID
            chunk_size: Number of rows to fetch per database query (default: 1000)
            progress_callback: See ``BaseStreamingCSVExportCommand``
            raise_on_error: See ``BaseStreamingCSVExportCommand``
        """
        super().__init__(
            chunk_size,
            progress_callback=progress_callback,
            raise_on_error=raise_on_error,
        )
        self._client_id = client_id
        self._query: Query | None = None

    def validate(self) -> None:
        """Validate permissions and query existence."""
        self._query = (
            db.session.query(Query).filter_by(client_id=self._client_id).one_or_none()
        )
        if self._query is None:
            raise SupersetErrorException(
                SupersetError(
                    message=__(
                        "The query associated with these results could not be found. "
                        "You need to re-run the original query."
                    ),
                    error_type=SupersetErrorType.RESULTS_BACKEND_ERROR,
                    level=ErrorLevel.ERROR,
                ),
                status=404,
            )

        try:
            self._query.raise_for_access()
        except SupersetSecurityException as ex:
            raise SupersetErrorException(
                SupersetError(
                    message=__("Cannot access the query"),
                    error_type=SupersetErrorType.QUERY_SECURITY_ACCESS_ERROR,
                    level=ErrorLevel.ERROR,
                ),
                status=403,
            ) from ex
        except TemplateError as ex:
            raise SupersetErrorException(
                SupersetError(
                    message=str(ex),
                    error_type=SupersetErrorType.GENERIC_COMMAND_ERROR,
                    level=ErrorLevel.ERROR,
                ),
                status=400,
            ) from ex

    def _get_sql_and_database(self) -> tuple[str, Any, str | None, str | None]:
        """
        Get the SQL query, database, catalog, and schema for SQL Lab export.

        Returns:
            Tuple of (sql_query, database_object, catalog, schema)
        """
        assert self._query is not None

        select_sql = self._query.select_sql
        executed_sql = self._query.executed_sql
        database = self._query.database

        # Get the SQL query
        sql = select_sql or executed_sql

        return sql, database, self._query.catalog, self._query.schema

    def _get_row_limit(self) -> int | None:
        """
        Get the row limit for SQL Lab export.

        Handles SQL Lab's complex limit logic based on limiting_factor.

        Returns:
            Adjusted row limit or None for unlimited
        """
        assert self._query is not None

        select_sql = self._query.select_sql
        executed_sql = self._query.executed_sql
        limiting_factor = self._query.limiting_factor
        database = self._query.database

        # Get limit from SQL
        if select_sql:
            limit = None
        else:
            sql = executed_sql
            script = SQLScript(sql, database.db_engine_spec.engine)
            # when a query has multiple statements only the last one returns data
            limit = script.statements[-1].get_limit_value()

        # Adjust limit based on limiting factor
        if limit is not None and limiting_factor in {
            LimitingFactor.QUERY,
            LimitingFactor.DROPDOWN,
            LimitingFactor.QUERY_AND_DROPDOWN,
        }:
            # remove extra row from `increased_limit`
            limit -= 1

        return limit


class FullStreamingSqlResultExportCommand(StreamingSqlResultExportCommand):
    """
    Command to stream a SQL Lab query result with no Superset row cap.

    SQL Lab bakes its cap into the SQL it runs: ``apply_limit()`` writes
    ``min(dropdown limit, SQL_MAX_ROW)`` (plus the one extra row that detects
    truncation) into the statement before execution, and that text is what
    ``Query.executed_sql`` holds. A full export therefore has to work from
    ``executed_sql`` rather than re-render the user's ``Query.sql``: the
    original ``template_params`` are not persisted on the query record, so a
    re-render could not reproduce the SQL that actually ran -- which is also
    the SQL ``raise_for_access`` authorizes (see ``Query.raise_for_access``).

    A limit the *user* wrote in their own SQL is part of their query and is
    kept; only Superset's cap is removed. ``limiting_factor`` records which of
    the two was binding when the query ran.
    """

    # Sentinel for "``_uncapped_sql`` has not run yet", distinct from the
    # ``None`` it returns when the stored SQL carries no cap to remove.
    _UNRESOLVED = object()
    _resolved_sql: Any = _UNRESOLVED

    def _uncapped_sql(self) -> str | None:
        """The statement to export with Superset's cap removed, or ``None``
        when the stored SQL is already free of one.

        Resolved once: ``run()`` asks for both the SQL and the row limit, and
        each call reparses the stored SQL (and can raise).

        :raises SupersetErrorException: when the cap cannot be removed, so the
            export fails with an explanation instead of quietly re-applying it
        """
        assert self._query is not None
        if self._resolved_sql is self._UNRESOLVED:
            self._resolved_sql = self._resolve_uncapped_sql()
        return cast("str | None", self._resolved_sql)

    def _resolve_uncapped_sql(self) -> str | None:
        assert self._query is not None

        if self._query.select_sql:
            # A CTAS query's results are read back from the created table with
            # a plain ``SELECT``, which never carried a cap.
            return None

        database = self._query.database
        script = SQLScript(self._query.executed_sql, database.db_engine_spec.engine)
        if len(script.statements) > 1:
            # Engines that run a whole script as one block (
            # ``run_multiple_statements_as_one``) store every statement here.
            # Only the last one returns rows, but running it alone would drop
            # whatever the earlier statements set up, so refuse rather than
            # export something different from what the user ran.
            raise SupersetErrorException(
                SupersetError(
                    message=__(
                        "A full export is not available for a query with "
                        "multiple statements. Run the statement whose results "
                        "you want to export on its own, then export it."
                    ),
                    error_type=SupersetErrorType.GENERIC_COMMAND_ERROR,
                    level=ErrorLevel.ERROR,
                ),
                status=400,
            )

        statement = script.statements[-1]
        if statement.get_limit_value() is None:
            return None

        if self._query.limiting_factor in {
            LimitingFactor.QUERY,
            LimitingFactor.QUERY_AND_DROPDOWN,
        }:
            # The user's own ``LIMIT`` was the binding one, so the stored cap
            # is theirs (give or take the extra truncation row) and a full
            # export returns the same rows as a normal one.
            return None

        statement.remove_limit_value()
        if (remaining := statement.get_limit_value()) is not None:
            # A cap this parser will not remove: a PERCENT/WITH TIES clause, a
            # ClickHouse ``LIMIT ... BY``, or the Oracle ``ROWNUM`` filter used
            # on releases without ``FETCH FIRST``. Exporting anyway would
            # silently truncate at ``remaining`` rows.
            logger.warning(
                "Cannot remove the row cap of query %s (limit still %s)",
                self._query.client_id,
                remaining,
            )
            raise SupersetErrorException(
                SupersetError(
                    message=__(
                        "A full export is not available for this query: its "
                        "row limit cannot be removed. Re-run it with a higher "
                        "limit, or export it without the full option."
                    ),
                    error_type=SupersetErrorType.GENERIC_COMMAND_ERROR,
                    level=ErrorLevel.ERROR,
                ),
                status=400,
            )

        if (user_limit := self._user_authored_limit()) is not None:
            # Superset's cap *replaced* a larger ``LIMIT`` of the user's own
            # (that is the other way ``limiting_factor`` lands on DROPDOWN).
            # Their limit still bounds their query, so put it back.
            statement.set_limit_value(
                user_limit, database.db_engine_spec.get_limit_method(database)
            )

        return statement.format()

    def _user_authored_limit(self) -> int | None:
        """The ``LIMIT`` the user wrote in their own SQL, if it can be read.

        Read from the unrendered ``Query.sql``, the only copy of the user's
        text: Superset's cap overwrote the one in ``executed_sql``. Jinja can
        make that text unparseable, and in principle even produce the limit
        itself, so a failure to read one is treated as "no limit of their
        own" -- which is what the requester asked for anyway.
        """
        assert self._query is not None
        try:
            return self._query.database.db_engine_spec.get_limit_from_sql(
                self._query.sql
            )
        except Exception:  # pylint: disable=broad-except
            logger.warning(
                "Could not read the authored row limit of query %s",
                self._query.client_id,
                exc_info=True,
            )
            return None

    def _get_sql_and_database(self) -> tuple[str, Any, str | None, str | None]:
        sql, database, catalog, schema = super()._get_sql_and_database()
        return self._uncapped_sql() or sql, database, catalog, schema

    def _get_row_limit(self) -> int | None:
        """The row count to stop fetching at.

        ``None`` once the cap is out of the SQL: the point of the export is
        that nothing bounds it. When the cap stays (the user wrote their own
        ``LIMIT``), the inherited post-fetch bound stays with it.
        """
        if self._uncapped_sql() is not None:
            return None
        return super()._get_row_limit()
