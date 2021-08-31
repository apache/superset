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

from dataclasses import dataclass  # pylint: disable=wrong-import-order
from enum import Enum
from typing import List, Optional, Set
from urllib import parse

from superset.db_engine_specs.base import BaseEngineSpec, LimitMethod

import sqlparse
from sqlparse.sql import (
    Identifier,
    IdentifierList,
    Parenthesis,
    remove_quotes,
    Token,
    TokenList,
)
from sqlparse.tokens import Keyword, Name, Punctuation, String, Whitespace
from sqlparse.utils import imt

"""
from typing import List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    # prevent circular imports
    from superset.models.core import Database
"""

def _extract_limit_from_query_td(statement: TokenList) -> Optional[int]:
    td_limit_keywork = set(["TOP", "SAMPLE"])
    str_statement = str(statement)
    str_statement = str_statement.replace('\n', ' ').replace('\r', '')
    token = str(str_statement).rstrip().split(' ')
    token = list(filter(None, token))
    limit = None

    for i in range(len(token)):
        if any(limitword in token[i].upper() for limitword in td_limit_keywork):
            if len(token) - 1 > i:
                try:
                    limit = int(token[i + 1])
                except ValueError:
                    limit = None
                break
    return limit


class ParsedQuery_td:
    def __init__(self, sql_statement: str, strip_comments: bool = False, uri_type: str = None):
        if strip_comments:
            sql_statement = sqlparse.format(sql_statement, strip_comments=True)

        self.sql: str = sql_statement
        self._tables: Set[Table] = set()
        self._alias_names: Set[str] = set()
        self._limit: Optional[int] = None
        self.uri_type: str = uri_type

        self._parsed = sqlparse.parse(self.stripped())
        for statement in self._parsed:
            self._limit = _extract_limit_from_query_td(statement)


    def stripped(self) -> str:
        return self.sql.strip(" \t\n;")


    def set_or_update_query_limit_td(self, new_limit: int) -> str:
        td_sel_keywork = set(["SELECT", "SEL"])
        td_limit_keywork = set(["TOP", "SAMPLE"])
        statement = self._parsed[0]

        if not self._limit:
            final_limit = new_limit
        elif new_limit < self._limit:
            final_limit = new_limit
        else:
            final_limit = self._limit

        str_statement = str(statement)
        str_statement = str_statement.replace('\n', ' ').replace('\r', '')
        tokens = str(str_statement).rstrip().split(' ')
        tokens = list(filter(None, tokens))

        next_remove_ind = False
        new_tokens = []
        for i in tokens:
            if any(limitword in i.upper() for limitword in td_limit_keywork):
                next_remove_ind = True
            elif next_remove_ind and i.isdigit():
                next_remove_ind = False
            else:
                new_tokens.append(i)
                next_remove_ind = False

        str_res = ""
        for i in new_tokens:
            str_res += i + " "
            if any(selword in i.upper() for selword in td_sel_keywork):
                str_res += "TOP " + str(final_limit) + " "
        return str_res



class TeradataEngineSpec(BaseEngineSpec):
    """Dialect for Teradata DB."""

    engine = "teradatasql"
    engine_name = "Teradata"
    limit_method = LimitMethod.WRAP_SQL
    max_column_name_length = 30  # since 14.10 this is 128

    _time_grain_expressions = {
        None: "{col}",
        "PT1M": "TRUNC(CAST({col} as DATE), 'MI')",
        "PT1H": "TRUNC(CAST({col} as DATE), 'HH')",
        "P1D": "TRUNC(CAST({col} as DATE), 'DDD')",
        "P1W": "TRUNC(CAST({col} as DATE), 'WW')",
        "P1M": "TRUNC(CAST({col} as DATE), 'MONTH')",
        "P0.25Y": "TRUNC(CAST({col} as DATE), 'Q')",
        "P1Y": "TRUNC(CAST({col} as DATE), 'YEAR')",
    }

    @classmethod
    def epoch_to_dttm(cls) -> str:
        return (
            "CAST(((CAST(DATE '1970-01-01' + ({col} / 86400) AS TIMESTAMP(0) "
            "AT 0)) AT 0) + (({col} MOD 86400) * INTERVAL '00:00:01' "
            "HOUR TO SECOND) AS TIMESTAMP(0))"
        )

    @classmethod
    def apply_limit_to_sql(cls, sql: str, limit: int, database: "Database", force: bool = False) -> str:
        """
        Alters the SQL statement to apply a TOP clause
        The function overwrites similar function in base.py because Teradata doesn't support LIMIT syntax
        :param sql: SQL query
        :param limit: Maximum number of rows to be returned by the query
        :param database: Database instance
        :return: SQL query with limit clause
        """
        
        parsed_query = ParsedQuery_td(sql)
        sql = parsed_query.set_or_update_query_limit_td(limit)
        
        return sql

