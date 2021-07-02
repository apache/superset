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
import json
import re
from contextlib import closing
from typing import Any, Dict, Optional, Pattern, Tuple, TYPE_CHECKING

from flask_babel import gettext as __
from sqlalchemy.engine.url import URL

from superset import security_manager
from superset.db_engine_specs.sqlite import SqliteEngineSpec
from superset.errors import SupersetErrorType

if TYPE_CHECKING:
    from superset.models.core import Database


SYNTAX_ERROR_REGEX = re.compile('SQLError: near "(?P<server_error>.*?)": syntax error')


class GSheetsEngineSpec(SqliteEngineSpec):
    """Engine for Google spreadsheets"""

    engine = "gsheets"
    engine_name = "Google Sheets"
    allows_joins = True
    allows_subqueries = True

    custom_errors: Dict[Pattern[str], Tuple[str, SupersetErrorType, Dict[str, Any]]] = {
        SYNTAX_ERROR_REGEX: (
            __(
                'Please check your query for syntax errors near "%(server_error)s". '
                "Then, try running your query again."
            ),
            SupersetErrorType.SYNTAX_ERROR,
            {},
        ),
    }

    @classmethod
    def modify_url_for_impersonation(
        cls, url: URL, impersonate_user: bool, username: Optional[str]
    ) -> None:
        if impersonate_user and username is not None:
            user = security_manager.find_user(username=username)
            if user and user.email:
                url.query["subject"] = user.email

    @classmethod
    def extra_table_metadata(
        cls, database: "Database", table_name: str, schema_name: str,
    ) -> Dict[str, Any]:
        engine = cls.get_engine(database, schema=schema_name)
        with closing(engine.raw_connection()) as conn:
            cursor = conn.cursor()
            cursor.execute(f'SELECT GET_METADATA("{table_name}")')
            results = cursor.fetchone()[0]

        try:
            metadata = json.loads(results)
        except Exception:  # pylint: disable=broad-except
            metadata = {}

        return {"metadata": metadata["extra"]}
