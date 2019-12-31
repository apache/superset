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
from typing import List, Optional, Set

import sqlparse
from sqlparse.sql import Identifier, IdentifierList, remove_quotes, Token, TokenList
from sqlparse.tokens import Keyword, Name, Punctuation, String, Whitespace
from sqlparse.utils import imt

RESULT_OPERATIONS = {"UNION", "INTERSECT", "EXCEPT", "SELECT"}
ON_KEYWORD = "ON"
PRECEDES_TABLE_NAME = {"FROM", "JOIN", "DESCRIBE", "WITH", "LEFT JOIN", "RIGHT JOIN"}
CTE_PREFIX = "CTE__"


def _extract_limit_from_query(statement: TokenList) -> Optional[int]:
    """
    Extract limit clause from SQL statement.

    :param statement: SQL statement
    :return: Limit extracted from query, None if no limit present in statement
    """
    idx, _ = statement.token_next_by(m=(Keyword, "LIMIT"))
    if idx is not None:
        _, token = statement.token_next(idx=idx)
        if token:
            if isinstance(token, IdentifierList):
                # In case of "LIMIT <offset>, <limit>", find comma and extract
                # first succeeding non-whitespace token
                idx, _ = token.token_next_by(m=(sqlparse.tokens.Punctuation, ","))
                _, token = token.token_next(idx=idx)
            if token and token.ttype == sqlparse.tokens.Literal.Number.Integer:
                return int(token.value)
    return None


class ParsedQuery:
    def __init__(self, sql_statement):
        self.sql: str = sql_statement
        self._table_names: Set[str] = set()
        self._alias_names: Set[str] = set()
        self._limit: Optional[int] = None

        logging.info("Parsing with sqlparse statement %s", self.sql)
        self._parsed = sqlparse.parse(self.stripped())
        for statement in self._parsed:
            self.__extract_from_token(statement)
            self._limit = _extract_limit_from_query(statement)
        self._table_names = self._table_names - self._alias_names

    @property
    def tables(self) -> Set[str]:
        return self._table_names

    @property
    def limit(self) -> Optional[int]:
        return self._limit

    def is_select(self) -> bool:
        return self._parsed[0].get_type() == "SELECT"

    def is_explain(self) -> bool:
        return self.stripped().upper().startswith("EXPLAIN")

    def is_readonly(self) -> bool:
        """Pessimistic readonly, 100% sure statement won't mutate anything"""
        return self.is_select() or self.is_explain()

    def stripped(self) -> str:
        return self.sql.strip(" \t\n;")

    def get_statements(self) -> List[str]:
        """Returns a list of SQL statements as strings, stripped"""
        statements = []
        for statement in self._parsed:
            if statement:
                sql = str(statement).strip(" \n;\t")
                if sql:
                    statements.append(sql)
        return statements

    @staticmethod
    def __get_full_name(tlist: TokenList) -> Optional[str]:
        """
        Return the full unquoted table name if valid, i.e., conforms to the following
        [[cluster.]schema.]table construct.

        :param tlist: The SQL tokens
        :returns: The valid full table name
        """

        # Strip the alias if present.
        idx = len(tlist.tokens)

        if tlist.has_alias():
            ws_idx, _ = tlist.token_next_by(t=Whitespace)

            if ws_idx != -1:
                idx = ws_idx

        tokens = tlist.tokens[:idx]

        if (
            len(tokens) in (1, 3, 5)
            and all(imt(token, t=[Name, String]) for token in tokens[0::2])
            and all(imt(token, m=(Punctuation, ".")) for token in tokens[1::2])
        ):
            return ".".join([remove_quotes(token.value) for token in tokens[0::2]])

        return None

    @staticmethod
    def __is_identifier(token: Token) -> bool:
        return isinstance(token, (IdentifierList, Identifier))

    def __process_tokenlist(self, token_list: TokenList):
        """
        Add table names to table set

        :param token_list: TokenList to be processed
        """
        # exclude subselects
        if "(" not in str(token_list):
            table_name = self.__get_full_name(token_list)
            if table_name and not table_name.startswith(CTE_PREFIX):
                self._table_names.add(table_name)
            return

        # store aliases
        if token_list.has_alias():
            self._alias_names.add(token_list.get_alias())

        # some aliases are not parsed properly
        if token_list.tokens[0].ttype == Name:
            self._alias_names.add(token_list.tokens[0].value)
        self.__extract_from_token(token_list)

    def as_create_table(self, table_name: str, overwrite: bool = False) -> str:
        """Reformats the query into the create table as query.

        Works only for the single select SQL statements, in all other cases
        the sql query is not modified.
        :param table_name: Table that will contain the results of the query execution
        :param overwrite: table_name will be dropped if true
        :return: Create table as query
        """
        exec_sql = ""
        sql = self.stripped()
        if overwrite:
            exec_sql = f"DROP TABLE IF EXISTS {table_name};\n"
        exec_sql += f"CREATE TABLE {table_name} AS \n{sql}"
        return exec_sql

    def __extract_from_token(self, token: Token):  # pylint: disable=too-many-branches
        """
        Populate self._table_names from token

        :param token: instance of Token or child class, e.g. TokenList, to be processed
        """
        if not hasattr(token, "tokens"):
            return

        table_name_preceding_token = False

        for item in token.tokens:
            if item.is_group and not self.__is_identifier(item):
                self.__extract_from_token(item)

            if item.ttype in Keyword and (
                item.normalized in PRECEDES_TABLE_NAME
                or item.normalized.endswith(" JOIN")
            ):
                table_name_preceding_token = True
                continue

            if item.ttype in Keyword:
                table_name_preceding_token = False
                continue

            if table_name_preceding_token:
                if isinstance(item, Identifier):
                    self.__process_tokenlist(item)
                elif isinstance(item, IdentifierList):
                    for token2 in item.get_identifiers():
                        if isinstance(token2, TokenList):
                            self.__process_tokenlist(token2)
            elif isinstance(item, IdentifierList):
                for token2 in item.tokens:
                    if not self.__is_identifier(token2):
                        self.__extract_from_token(item)

    def get_query_with_new_limit(self, new_limit: int) -> str:
        """
        returns the query with the specified limit.
        Does not change the underlying query

        :param new_limit: Limit to be incorporated into returned query
        :return: The original query with new limit
        """
        if not self._limit:
            return f"{self.stripped()}\nLIMIT {new_limit}"
        limit_pos = None
        statement = self._parsed[0]
        # Add all items to before_str until there is a limit
        for pos, item in enumerate(statement.tokens):
            if item.ttype in Keyword and item.value.lower() == "limit":
                limit_pos = pos
                break
        _, limit = statement.token_next(idx=limit_pos)
        if limit.ttype == sqlparse.tokens.Literal.Number.Integer:
            limit.value = new_limit
        elif limit.is_group:
            limit.value = f"{next(limit.get_identifiers())}, {new_limit}"

        str_res = ""
        for i in statement.tokens:
            str_res += str(i.value)
        return str_res
