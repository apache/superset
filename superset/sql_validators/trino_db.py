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
    """Error in the process of asking Trino to validate SQL querytext"""

class TrinoSQLValidator(BaseSQLValidator):
    """Validate SQL queries using Trino's built-in EXPLAIN subtype"""

    name = "TrinoSQLValidator"

    @classmethod
    def validate_statement(
        cls,
        statement: str,
        database: Database,
        cursor: Any,
    ) -> Optional[SQLValidationAnnotation]:
        logger.info("COMMING IN TRINO VALIDATOR CLASS")
        # pylint: disable=too-many-locals
        db_engine_spec = database.db_engine_spec
        parsed_query = ParsedQuery(statement)
        sql = parsed_query.strip_comments()
        sql_query_mutator = config["SQL_QUERY_MUTATOR"]
        if sql_query_mutator:
            sql = sql_query_mutator(
                sql,
                user_name=get_username(),  # TODO(john-bodley): Deprecate in 3.0.
                security_manager=security_manager,
                database=database,
                query_source = "Validator",
                query_id = None
            )
        sql = f"EXPLAIN (TYPE VALIDATE) {sql}"
        from trino.exceptions import TrinoUserError
        try:
            db_engine_spec.execute(cursor, sql)
            db_engine_spec.fetch_data(cursor, MAX_ERROR_ROWS)
            return None
        except TrinoUserError as db_error:
            if db_error.args and isinstance(db_error.args[0], str):
                raise TrinoSQLValidationError(db_error.args[0]) from db_error
            if not db_error.args or not isinstance(db_error.args[0], dict):
                raise TrinoSQLValidationError(
                    "The trino client returned an unhandled " "database error."
                ) from db_error
            error_args: Dict[str, Any] = db_error.args[0]
            if "message" not in error_args:
                raise TrinoSQLValidationError(
                    "The trino client did not report an error message"
                ) from db_error
            if "errorLocation" not in error_args:
                message = error_args["message"] + "\n(Error location unknown)"
                return SQLValidationAnnotation(
                    message=message, line_number=1, start_column=1, end_column=1
                )
            return cls.construct_annotations(error_args)
        except Exception as ex:
            logger.exception("Unexpected error running validation query: %s", str(ex))
            raise ex

    @classmethod
    def validate(
        cls, sql: str, schema: Optional[str], database: Database
    ) -> List[SQLValidationAnnotation]:
        """
        Trino supports query-validation queries by running them with a
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
                annotation = cls.validate_statement(statement, database, cursor)
                if annotation:
                    annotations.append(annotation)
        logger.debug("Validation found %i error(s)", len(annotations))

        return annotations

    def construct_annotations(error_args: Any) -> SQLValidationAnnotation:
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
