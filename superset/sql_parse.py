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
# pylint: disable=C,R,W
import logging

import sqlparse
from sqlparse.sql import Identifier, IdentifierList
from sqlparse.tokens import Keyword, Name

RESULT_OPERATIONS = {'UNION', 'INTERSECT', 'EXCEPT', 'SELECT'}
ON_KEYWORD = 'ON'
PRECEDES_TABLE_NAME = {
    'FROM', 'JOIN', 'DESCRIBE', 'WITH', 'LEFT JOIN', 'RIGHT JOIN',
}
CTE_PREFIX = 'CTE__'


class ParsedQuery(object):
    def __init__(self, sql_statement):
        self.sql = sql_statement
        self._table_names = set()
        self._alias_names = set()
        self._limit = None

        logging.info('Parsing with sqlparse statement {}'.format(self.sql))
        self._parsed = sqlparse.parse(self.stripped())
        for statement in self._parsed:
            self.__extract_from_token(statement)
            self._limit = self._extract_limit_from_query(statement)
        self._table_names = self._table_names - self._alias_names

    @property
    def tables(self):
        return self._table_names

    @property
    def limit(self):
        return self._limit

    def is_select(self):
        return self._parsed[0].get_type() == 'SELECT'

    def is_explain(self):
        return self.stripped().upper().startswith('EXPLAIN')

    def is_readonly(self):
        """Pessimistic readonly, 100% sure statement won't mutate anything"""
        return self.is_select() or self.is_explain()

    def stripped(self):
        return self.sql.strip(' \t\n;')

    def get_statements(self):
        """Returns a list of SQL statements as strings, stripped"""
        statements = []
        for statement in self._parsed:
            if statement:
                sql = str(statement).strip(' \n;\t')
                if sql:
                    statements.append(sql)
        return statements

    @staticmethod
    def __get_full_name(identifier):
        if len(identifier.tokens) > 1 and identifier.tokens[1].value == '.':
            return '{}.{}'.format(identifier.tokens[0].value,
                                  identifier.tokens[2].value)
        return identifier.get_real_name()

    @staticmethod
    def __is_identifier(token):
        return isinstance(token, (IdentifierList, Identifier))

    def __process_identifier(self, identifier):
        # exclude subselects
        if '(' not in str(identifier):
            table_name = self.__get_full_name(identifier)
            if not table_name.startswith(CTE_PREFIX):
                self._table_names.add(self.__get_full_name(identifier))
            return

        # store aliases
        if hasattr(identifier, 'get_alias'):
            self._alias_names.add(identifier.get_alias())
        if hasattr(identifier, 'tokens'):
            # some aliases are not parsed properly
            if identifier.tokens[0].ttype == Name:
                self._alias_names.add(identifier.tokens[0].value)
        self.__extract_from_token(identifier)

    def as_create_table(self, table_name, overwrite=False):
        """Reformats the query into the create table as query.

        Works only for the single select SQL statements, in all other cases
        the sql query is not modified.
        :param superset_query: string, sql query that will be executed
        :param table_name: string, will contain the results of the
            query execution
        :param overwrite, boolean, table table_name will be dropped if true
        :return: string, create table as query
        """
        exec_sql = ''
        sql = self.stripped()
        if overwrite:
            exec_sql = f'DROP TABLE IF EXISTS {table_name};\n'
        exec_sql += f'CREATE TABLE {table_name} AS \n{sql}'
        return exec_sql

    def __extract_from_token(self, token, depth=0):
        if not hasattr(token, 'tokens'):
            return

        table_name_preceding_token = False

        for item in token.tokens:
            logging.debug(('  ' * depth) + str(item.ttype) + str(item.value))
            if item.is_group and not self.__is_identifier(item):
                self.__extract_from_token(item, depth=depth + 1)

            if (
                    item.ttype in Keyword and (
                        item.normalized in PRECEDES_TABLE_NAME or
                        item.normalized.endswith(' JOIN')
                    )):
                table_name_preceding_token = True
                continue

            if item.ttype in Keyword:
                table_name_preceding_token = False
                continue

            if table_name_preceding_token:
                if isinstance(item, Identifier):
                    self.__process_identifier(item)
                elif isinstance(item, IdentifierList):
                    for token in item.get_identifiers():
                        self.__process_identifier(token)
            elif isinstance(item, IdentifierList):
                for token in item.tokens:
                    if not self.__is_identifier(token):
                        self.__extract_from_token(item, depth=depth + 1)

    def _get_limit_from_token(self, token):
        if token.ttype == sqlparse.tokens.Literal.Number.Integer:
            return int(token.value)
        elif token.is_group:
            return int(token.get_token_at_offset(1).value)

    def _extract_limit_from_query(self, statement):
        limit_token = None
        for pos, item in enumerate(statement.tokens):
            if item.ttype in Keyword and item.value.lower() == 'limit':
                limit_token = statement.tokens[pos + 2]
                return self._get_limit_from_token(limit_token)

    def get_query_with_new_limit(self, new_limit):
        """returns the query with the specified limit"""
        """does not change the underlying query"""
        if not self._limit:
            return self.sql + ' LIMIT ' + str(new_limit)
        limit_pos = None
        tokens = self._parsed[0].tokens
        # Add all items to before_str until there is a limit
        for pos, item in enumerate(tokens):
            if item.ttype in Keyword and item.value.lower() == 'limit':
                limit_pos = pos
                break
        limit = tokens[limit_pos + 2]
        if limit.ttype == sqlparse.tokens.Literal.Number.Integer:
            tokens[limit_pos + 2].value = new_limit
        elif limit.is_group:
            tokens[limit_pos + 2].value = (
                '{}, {}'.format(next(limit.get_identifiers()), new_limit)
            )

        str_res = ''
        for i in tokens:
            str_res += str(i.value)
        return str_res
