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


class TrinoSQLValidationError(Exception):
    """Error in the process of asking Presto to validate SQL querytext"""


class TrinoDBSQLValidator(BaseSQLValidator):
    """Validate SQL queries using Presto's built-in EXPLAIN subtype"""

    name = "TrinoDBSQLValidator"

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
        sql = f"EXPLAIN (TYPE VALIDATE) {sql}"
        from trino.exceptions import TrinoUserError

        try:
            db_engine_spec.execute(cursor, sql)
            logger.info("CURSOR", str(cursor))
            logger.info("ENGINE INSIDE", str(db_engine_spec))
            # polled = cursor.poll()
            # while polled:
            #     logger.info("polling presto for validation progress")
            #     stats = polled.get("stats", {})
            #     if stats:
            #         state = stats.get("state")
            #         if state == "FINISHED":
            #             break
            #     time.sleep(0.2)
            #     polled = cursor.poll()
            db_engine_spec.fetch_data(cursor, MAX_ERROR_ROWS)
            return None
        except TrinoUserError as db_error:
            logger.info("database error==", str(db_error))
            if db_error.args and isinstance(db_error.args[0], str):
                raise TrinoSQLValidationError(db_error.args[0]) from db_error
            if not db_error.args or not isinstance(db_error.args[0], dict):
                raise TrinoSQLValidationError(
                    "The pyhive presto client returned an unhandled " "database error."
                ) from db_error
            error_args: Dict[str, Any] = db_error.args[0]
            if "message" not in error_args:
                raise TrinoSQLValidationError(
                    "The pyhive presto client did not report an error message"
                ) from db_error
            if "errorLocation" not in error_args:
                message = error_args["message"] + "\n(Error location unknown)"
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
        engine = database.get_sqla_engine(schema, source=QuerySource.SQL_LAB)
        # Sharing a single connection and cursor across the
        # execution of all statements (if many)
        annotations: List[SQLValidationAnnotation] = []
        with closing(engine.raw_connection()) as conn:
            cursor = conn.cursor()
            for statement in parsed_query.get_statements():
                logger.info("CURSOR IN TRINO==",cursor)
                annotation = cls.validate_statement(statement, database, cursor)
                logger.info("ANNOTATIONS==",annotation)
                if annotation:
                    annotations.append(annotation)
        logger.debug("Validation found %i error(s)", len(annotations))

        return annotations
