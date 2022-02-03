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

from typing import Optional, Set

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

from superset.db_engine_specs.base import BaseEngineSpec, LimitMethod
from superset.sql_parse import Table

PRECEDES_TABLE_NAME = {"FROM", "JOIN", "DESCRIBE", "WITH", "LEFT JOIN", "RIGHT JOIN"}
CTE_PREFIX = "CTE__"
JOIN = " JOIN"


def _extract_limit_from_query_td(statement: TokenList) -> Optional[int]:
    td_limit_keywork = {"TOP", "SAMPLE"}
    str_statement = str(statement)
    str_statement = str_statement.replace("\n", " ").replace("\r", "")
    token = str_statement.rstrip().split(" ")
    token = [part for part in token if part]
    limit = None

    for i, _ in enumerate(token):
        if token[i].upper() in td_limit_keywork and len(token) - 1 > i:
            try:
                limit = int(token[i + 1])
            except ValueError:
                limit = None
            break
    return limit


class ParsedQueryTeradata:
    def __init__(
        self, sql_statement: str, strip_comments: bool = False, uri_type: str = "None"
    ):

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

    @property
    def tables(self) -> Set[Table]:
        if not self._tables:
            for statement in self._parsed:
                self._extract_from_token(statement)

            self._tables = {
                table for table in self._tables if str(table) not in self._alias_names
            }
        return self._tables

    def stripped(self) -> str:
        return self.sql.strip(" \t\n;")

    def _extract_from_token(self, token: Token) -> None:
        """
        <Identifier> store a list of subtokens and <IdentifierList> store lists of
        subtoken list.

        It extracts <IdentifierList> and <Identifier> from :param token: and loops
        through all subtokens recursively. It finds table_name_preceding_token and
        passes <IdentifierList> and <Identifier> to self._process_tokenlist to populate

        self._tables.

        :param token: instance of Token or child class, e.g. TokenList, to be processed
        """
        if not hasattr(token, "tokens"):
            return

        table_name_preceding_token = False

        for item in token.tokens:
            if item.is_group and (
                not self._is_identifier(item) or isinstance(item.tokens[0], Parenthesis)
            ):
                self._extract_from_token(item)

            if item.ttype in Keyword and (
                item.normalized in PRECEDES_TABLE_NAME or item.normalized.endswith(JOIN)
            ):
                table_name_preceding_token = True
                continue

            if item.ttype in Keyword:
                table_name_preceding_token = False
                continue
            if table_name_preceding_token:
                if isinstance(item, Identifier):
                    self._process_tokenlist(item)
                elif isinstance(item, IdentifierList):
                    for item_list in item.get_identifiers():
                        if isinstance(item_list, TokenList):
                            self._process_tokenlist(item_list)
            elif isinstance(item, IdentifierList):
                if any(not self._is_identifier(ItemList) for ItemList in item.tokens):
                    self._extract_from_token(item)

    @staticmethod
    def _get_table(tlist: TokenList) -> Optional[Table]:
        """
        Return the table if valid, i.e., conforms to the [[catalog.]schema.]table
        construct.

        :param tlist: The SQL tokens
        :returns: The table if the name conforms
        """

        # Strip the alias if present.
        idx = len(tlist.tokens)

        if tlist.has_alias():
            ws_idx, _ = tlist.token_next_by(t=Whitespace)

            if ws_idx != -1:
                idx = ws_idx

        tokens = tlist.tokens[:idx]

        odd_token_number = len(tokens) in (1, 3, 5)
        qualified_name_parts = all(
            imt(token, t=[Name, String]) for token in tokens[::2]
        )
        dot_separators = all(imt(token, m=(Punctuation, ".")) for token in tokens[1::2])
        if odd_token_number and qualified_name_parts and dot_separators:
            return Table(*[remove_quotes(token.value) for token in tokens[::-2]])

        return None

    @staticmethod
    def _is_identifier(token: Token) -> bool:
        return isinstance(token, (IdentifierList, Identifier))

    def _process_tokenlist(self, token_list: TokenList) -> None:
        """
        Add table names to table set

        :param token_list: TokenList to be processed
        """
        # exclude subselects
        if "(" not in str(token_list):
            table = self._get_table(token_list)
            if table and not table.table.startswith(CTE_PREFIX):
                self._tables.add(table)
            return

        # store aliases
        if token_list.has_alias():
            self._alias_names.add(token_list.get_alias())

        # some aliases are not parsed properly
        if token_list.tokens[0].ttype == Name:
            self._alias_names.add(token_list.tokens[0].value)
        self._extract_from_token(token_list)

    def set_or_update_query_limit_td(self, new_limit: int) -> str:
        td_sel_keywords = {"SELECT", "SEL"}
        td_limit_keywords = {"TOP", "SAMPLE"}
        statement = self._parsed[0]

        if not self._limit:
            final_limit = new_limit
        elif new_limit < self._limit:
            final_limit = new_limit
        else:
            final_limit = self._limit

        str_statement = str(statement)
        str_statement = str_statement.replace("\n", " ").replace("\r", "")

        tokens = str_statement.rstrip().split(" ")
        tokens = [token for token in tokens if token]

        if limit_not_in_sql(str_statement, td_limit_keywords):
            selects = [i for i, word in enumerate(tokens) if word in td_sel_keywords]
            first_select = selects[0]
            tokens.insert(first_select + 1, "TOP")
            tokens.insert(first_select + 2, str(final_limit))

        next_is_limit_token = False
        new_tokens = []

        for token in tokens:
            if token.upper() in td_limit_keywords:
                next_is_limit_token = True
            elif next_is_limit_token:
                if token.isdigit():
                    token = str(final_limit)
                    next_is_limit_token = False
            new_tokens.append(token)

        return " ".join(new_tokens)


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
    def apply_limit_to_sql(
        cls, sql: str, limit: int, database: str = "Database", force: bool = False
    ) -> str:
        """
        Alters the SQL statement to apply a TOP clause
        The function overwrites similar function in base.py because Teradata doesn't
        support LIMIT syntax
        :param sql: SQL query
        :param limit: Maximum number of rows to be returned by the query
        :param database: Database instance
        :return: SQL query with limit clause
        """

        parsed_query = ParsedQueryTeradata(sql)
        sql = parsed_query.set_or_update_query_limit_td(limit)

        return sql


def limit_not_in_sql(sql: str, limit_words: Set[str]) -> bool:
    for limit_word in limit_words:
        if limit_word in sql:
            return False
    return True
