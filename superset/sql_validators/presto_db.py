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
import time
from contextlib import closing
from typing import Any, Dict, List, Optional

from superset import app, security_manager
from superset.models.core import Database
from superset.sql_parse import ParsedQuery
from superset.sql_validators.base import BaseSQLValidator, SQLValidationAnnotation
from superset.utils.core import get_username, QuerySource

MAX_ERROR_ROWS = 10

config = app.config
logger = logging.getLogger(__name__)


class PrestoSQLValidationError(Exception):
    """Error in the process of asking Presto to validate SQL querytext"""


class PrestoDBSQLValidator(BaseSQLValidator):
    """Validate SQL queries using Presto's built-in EXPLAIN subtype"""

    name = "PrestoDBSQLValidator"

    @classmethod
    def validate_statement(
        cls,
        statement: str,
        database: Database,
        cursor: Any,
    ) -> Optional[SQLValidationAnnotation]:
        # pylint: disable=too-many-locals
        db_engine_spec = database.db_engine_spec
        parsed_query = ParsedQuery(statement)
        sql = parsed_query.stripped()

        # Hook to allow environment-specific mutation (usually comments) to the SQL
        sql_query_mutator = config["SQL_QUERY_MUTATOR"]
        if sql_query_mutator:
            sql = sql_query_mutator(
                sql,
                user_name=get_username(),  # TODO(john-bodley): Deprecate in 3.0.
                security_manager=security_manager,
                database=database,
            )

        # Transform the final statement to an explain call before sending it on
        # to presto to validate
        sql = f"EXPLAIN (TYPE VALIDATE) {sql}"

        # Invoke the query against presto. NB this deliberately doesn't use the
        # engine spec's handle_cursor implementation since we don't record
        # these EXPLAIN queries done in validation as proper Query objects
        # in the superset ORM.
        # pylint: disable=import-outside-toplevel
        from pyhive.exc import DatabaseError

        try:
            db_engine_spec.execute(cursor, sql)
            polled = cursor.poll()
            while polled:
                logger.info("polling presto for validation progress")
                stats = polled.get("stats", {})
                if stats:
                    state = stats.get("state")
                    if state == "FINISHED":
                        break
                time.sleep(0.2)
                polled = cursor.poll()
            db_engine_spec.fetch_data(cursor, MAX_ERROR_ROWS)
            return None
        except DatabaseError as db_error:
            # The pyhive presto client yields EXPLAIN (TYPE VALIDATE) responses
            # as though they were normal queries. In other words, it doesn't
            # know that errors here are not exceptional. To map this back to
            # ordinary control flow, we have to trap the category of exception
            # raised by the underlying client, match the exception arguments
            # pyhive provides against the shape of dictionary for a presto query
            # invalid error, and restructure that error as an annotation we can
            # return up.

            # If the first element in the DatabaseError is not a dictionary, but
            # is a string, return that message.
            if db_error.args and isinstance(db_error.args[0], str):
                raise PrestoSQLValidationError(db_error.args[0]) from db_error

            # Confirm the first element in the DatabaseError constructor is a
            # dictionary with error information. This is currently provided by
            # the pyhive client, but may break if their interface changes when
            # we update at some point in the future.
            if not db_error.args or not isinstance(db_error.args[0], dict):
                raise PrestoSQLValidationError(
                    "The pyhive presto client returned an unhandled " "database error."
                ) from db_error
            error_args: Dict[str, Any] = db_error.args[0]

            # Confirm the two fields we need to be able to present an annotation
            # are present in the error response -- a message, and a location.
            if "message" not in error_args:
                raise PrestoSQLValidationError(
                    "The pyhive presto client did not report an error message"
                ) from db_error
            if "errorLocation" not in error_args:
                # Pylint is confused about the type of error_args, despite the hints
                # and checks above.
                # pylint: disable=invalid-sequence-index
                message = error_args["message"] + "\n(Error location unknown)"
                # If we have a message but no error location, return the message and
                # set the location as the beginning.
                return SQLValidationAnnotation(
                    message=message, line_number=1, start_column=1, end_column=1
                )

            # pylint: disable=invalid-sequence-index
            message = error_args["message"]
            err_loc = error_args["errorLocation"]
            line_number = err_loc.get("lineNumber", None)
            start_column = err_loc.get("columnNumber", None)
            end_column = err_loc.get("columnNumber", None)

            return SQLValidationAnnotation(
                message=message,
                line_number=line_number,
                start_column=start_column,
                end_column=end_column,
            )
        except Exception as ex:
            logger.exception("Unexpected error running validation query: %s", str(ex))
            raise ex

    @classmethod
    def validate(
        cls, sql: str, schema: Optional[str], database: Database
    ) -> List[SQLValidationAnnotation]:
        """
        Presto supports query-validation queries by running them with a
        prepended explain.

        For example, "SELECT 1 FROM default.mytable" becomes "EXPLAIN (TYPE
        VALIDATE) SELECT 1 FROM default.mytable.
        """
        parsed_query = ParsedQuery(sql)
        statements = parsed_query.get_statements()

        logger.info("Validating %i statement(s)", len(statements))
        # todo(hughhh): update this to use new database.get_raw_connection()
        # this function keeps stalling CI
        with database.get_sqla_engine_with_context(
            schema, source=QuerySource.SQL_LAB
        ) as engine:
            # Sharing a single connection and cursor across the
            # execution of all statements (if many)
            annotations: List[SQLValidationAnnotation] = []
            with closing(engine.raw_connection()) as conn:
                cursor = conn.cursor()
                for statement in parsed_query.get_statements():
                    annotation = cls.validate_statement(statement, database, cursor)
                    if annotation:
                        annotations.append(annotation)
            logger.debug("Validation found %i error(s)", len(annotations))

        return annotations
