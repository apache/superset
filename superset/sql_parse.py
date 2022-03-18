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
import re
from dataclasses import dataclass
from enum import Enum
from typing import List, Optional, Set, Tuple
from urllib import parse

import sqlparse
from sqlparse.sql import (
    Identifier,
    IdentifierList,
    Parenthesis,
    remove_quotes,
    Token,
    TokenList,
    Where,
)
from sqlparse.tokens import (
    CTE,
    DDL,
    DML,
    Keyword,
    Name,
    Punctuation,
    String,
    Whitespace,
)
from sqlparse.utils import imt

from superset.exceptions import QueryClauseValidationException

RESULT_OPERATIONS = {"UNION", "INTERSECT", "EXCEPT", "SELECT"}
ON_KEYWORD = "ON"
PRECEDES_TABLE_NAME = {"FROM", "JOIN", "DESCRIBE", "WITH", "LEFT JOIN", "RIGHT JOIN"}
CTE_PREFIX = "CTE__"
logger = logging.getLogger(__name__)


# TODO: Workaround for https://github.com/andialbrecht/sqlparse/issues/652.
sqlparse.keywords.SQL_REGEX.insert(
    0,
    (
        re.compile(r"'(''|\\\\|\\|[^'])*'", sqlparse.keywords.FLAGS).match,
        sqlparse.tokens.String.Single,
    ),
)


class CtasMethod(str, Enum):
    TABLE = "TABLE"
    VIEW = "VIEW"


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


def extract_top_from_query(
    statement: TokenList, top_keywords: Set[str]
) -> Optional[int]:
    """
    Extract top clause value from SQL statement.

    :param statement: SQL statement
    :param top_keywords: keywords that are considered as synonyms to TOP
    :return: top value extracted from query, None if no top value present in statement
    """

    str_statement = str(statement)
    str_statement = str_statement.replace("\n", " ").replace("\r", "")
    token = str_statement.rstrip().split(" ")
    token = [part for part in token if part]
    top = None
    for i, _ in enumerate(token):
        if token[i].upper() in top_keywords and len(token) - 1 > i:
            try:
                top = int(token[i + 1])
            except ValueError:
                top = None
            break
    return top


def get_cte_remainder_query(sql: str) -> Tuple[Optional[str], str]:
    """
    parse the SQL and return the CTE and rest of the block to the caller

    :param sql: SQL query
    :return: CTE and remainder block to the caller

    """
    cte: Optional[str] = None
    remainder = sql
    stmt = sqlparse.parse(sql)[0]

    # The first meaningful token for CTE will be with WITH
    idx, token = stmt.token_next(-1, skip_ws=True, skip_cm=True)
    if not (token and token.ttype == CTE):
        return cte, remainder
    idx, token = stmt.token_next(idx)
    idx = stmt.token_index(token) + 1

    # extract rest of the SQLs after CTE
    remainder = "".join(str(token) for token in stmt.tokens[idx:]).strip()
    cte = f"WITH {token.value}"

    return cte, remainder


def strip_comments_from_sql(statement: str) -> str:
    """
    Strips comments from a SQL statement, does a simple test first
    to avoid always instantiating the expensive ParsedQuery constructor

    This is useful for engines that don't support comments

    :param statement: A string with the SQL statement
    :return: SQL statement without comments
    """
    return ParsedQuery(statement).strip_comments() if "--" in statement else statement


@dataclass(eq=True, frozen=True)
class Table:
    """
    A fully qualified SQL table conforming to [[catalog.]schema.]table.
    """

    table: str
    schema: Optional[str] = None
    catalog: Optional[str] = None

    def __str__(self) -> str:
        """
        Return the fully qualified SQL table name.
        """

        return ".".join(
            parse.quote(part, safe="").replace(".", "%2E")
            for part in [self.catalog, self.schema, self.table]
            if part
        )


class ParsedQuery:
    def __init__(self, sql_statement: str, strip_comments: bool = False):
        if strip_comments:
            sql_statement = sqlparse.format(sql_statement, strip_comments=True)

        self.sql: str = sql_statement
        self._tables: Set[Table] = set()
        self._alias_names: Set[str] = set()
        self._limit: Optional[int] = None

        logger.debug("Parsing with sqlparse statement: %s", self.sql)
        self._parsed = sqlparse.parse(self.stripped())
        for statement in self._parsed:
            self._limit = _extract_limit_from_query(statement)

    @property
    def tables(self) -> Set[Table]:
        if not self._tables:
            for statement in self._parsed:
                self._extract_from_token(statement)

            self._tables = {
                table for table in self._tables if str(table) not in self._alias_names
            }
        return self._tables

    @property
    def limit(self) -> Optional[int]:
        return self._limit

    def is_select(self) -> bool:
        # make sure we strip comments; prevents a bug with coments in the CTE
        parsed = sqlparse.parse(self.strip_comments())
        if parsed[0].get_type() == "SELECT":
            return True

        if parsed[0].get_type() != "UNKNOWN":
            return False

        # for `UNKNOWN`, check all DDL/DML explicitly: only `SELECT` DML is allowed,
        # and no DDL is allowed
        if any(token.ttype == DDL for token in parsed[0]) or any(
            token.ttype == DML and token.value != "SELECT" for token in parsed[0]
        ):
            return False

        # return false on `EXPLAIN`, `SET`, `SHOW`, etc.
        if parsed[0][0].ttype == Keyword:
            return False

        return any(
            token.ttype == DML and token.value == "SELECT" for token in parsed[0]
        )

    def is_valid_ctas(self) -> bool:
        parsed = sqlparse.parse(self.strip_comments())
        return parsed[-1].get_type() == "SELECT"

    def is_valid_cvas(self) -> bool:
        parsed = sqlparse.parse(self.strip_comments())
        return len(parsed) == 1 and parsed[0].get_type() == "SELECT"

    def is_explain(self) -> bool:
        # Remove comments
        statements_without_comments = sqlparse.format(
            self.stripped(), strip_comments=True
        )

        # Explain statements will only be the first statement
        return statements_without_comments.upper().startswith("EXPLAIN")

    def is_show(self) -> bool:
        # Remove comments
        statements_without_comments = sqlparse.format(
            self.stripped(), strip_comments=True
        )
        # Show statements will only be the first statement
        return statements_without_comments.upper().startswith("SHOW")

    def is_set(self) -> bool:
        # Remove comments
        statements_without_comments = sqlparse.format(
            self.stripped(), strip_comments=True
        )
        # Set statements will only be the first statement
        return statements_without_comments.upper().startswith("SET")

    def is_unknown(self) -> bool:
        return self._parsed[0].get_type() == "UNKNOWN"

    def stripped(self) -> str:
        return self.sql.strip(" \t\n;")

    def strip_comments(self) -> str:
        return sqlparse.format(self.stripped(), strip_comments=True)

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

        if (
            len(tokens) in (1, 3, 5)
            and all(imt(token, t=[Name, String]) for token in tokens[::2])
            and all(imt(token, m=(Punctuation, ".")) for token in tokens[1::2])
        ):
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

    def as_create_table(
        self,
        table_name: str,
        schema_name: Optional[str] = None,
        overwrite: bool = False,
        method: CtasMethod = CtasMethod.TABLE,
    ) -> str:
        """Reformats the query into the create table as query.

        Works only for the single select SQL statements, in all other cases
        the sql query is not modified.
        :param table_name: table that will contain the results of the query execution
        :param schema_name: schema name for the target table
        :param overwrite: table_name will be dropped if true
        :param method: method for the CTA query, currently view or table creation
        :return: Create table as query
        """
        exec_sql = ""
        sql = self.stripped()
        # TODO(bkyryliuk): quote full_table_name
        full_table_name = f"{schema_name}.{table_name}" if schema_name else table_name
        if overwrite:
            exec_sql = f"DROP {method} IF EXISTS {full_table_name};\n"
        exec_sql += f"CREATE {method} {full_table_name} AS \n{sql}"
        return exec_sql

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
                    self._process_tokenlist(item)
                elif isinstance(item, IdentifierList):
                    for token2 in item.get_identifiers():
                        if isinstance(token2, TokenList):
                            self._process_tokenlist(token2)
            elif isinstance(item, IdentifierList):
                if any(not self._is_identifier(token2) for token2 in item.tokens):
                    self._extract_from_token(item)

    def set_or_update_query_limit(self, new_limit: int, force: bool = False) -> str:
        """Returns the query with the specified limit.

        Does not change the underlying query if user did not apply the limit,
        otherwise replaces the limit with the lower value between existing limit
        in the query and new_limit.

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
        # Override the limit only when it exceeds the configured value.
        if limit.ttype == sqlparse.tokens.Literal.Number.Integer and (
            force or new_limit < int(limit.value)
        ):
            limit.value = new_limit
        elif limit.is_group:
            limit.value = f"{next(limit.get_identifiers())}, {new_limit}"

        str_res = ""
        for i in statement.tokens:
            str_res += str(i.value)
        return str_res


def validate_filter_clause(clause: str) -> None:
    if sqlparse.format(clause, strip_comments=True) != sqlparse.format(clause):
        raise QueryClauseValidationException("Filter clause contains comment")

    statements = sqlparse.parse(clause)
    if len(statements) != 1:
        raise QueryClauseValidationException("Filter clause contains multiple queries")
    open_parens = 0

    for token in statements[0]:
        if token.value in (")", "("):
            open_parens += 1 if token.value == "(" else -1
            if open_parens < 0:
                raise QueryClauseValidationException(
                    "Closing unclosed parenthesis in filter clause"
                )
    if open_parens > 0:
        raise QueryClauseValidationException("Unclosed parenthesis in filter clause")


class InsertRLSState(str, Enum):
    """
    State machine that scans for WHERE and ON clauses referencing tables.
    """

    SCANNING = "SCANNING"
    SEEN_SOURCE = "SEEN_SOURCE"
    FOUND_TABLE = "FOUND_TABLE"


def has_table_query(token_list: TokenList) -> bool:
    """
    Return if a stament has a query reading from a table.

        >>> has_table_query(sqlparse.parse("COUNT(*)")[0])
        False
        >>> has_table_query(sqlparse.parse("SELECT * FROM table")[0])
        True

    Note that queries reading from constant values return false:

        >>> has_table_query(sqlparse.parse("SELECT * FROM (SELECT 1)")[0])
        False

    """
    state = InsertRLSState.SCANNING
    for token in token_list.tokens:

        # # Recurse into child token list
        if isinstance(token, TokenList) and has_table_query(token):
            return True

        # Found a source keyword (FROM/JOIN)
        if imt(token, m=[(Keyword, "FROM"), (Keyword, "JOIN")]):
            state = InsertRLSState.SEEN_SOURCE

        # Found identifier/keyword after FROM/JOIN
        elif state == InsertRLSState.SEEN_SOURCE and (
            isinstance(token, sqlparse.sql.Identifier) or token.ttype == Keyword
        ):
            return True

        # Found nothing, leaving source
        elif state == InsertRLSState.SEEN_SOURCE and token.ttype != Whitespace:
            state = InsertRLSState.SCANNING

    return False


def add_table_name(rls: TokenList, table: str) -> None:
    """
    Modify a RLS expression ensuring columns are fully qualified.
    """
    tokens = rls.tokens[:]
    while tokens:
        token = tokens.pop(0)

        if isinstance(token, Identifier) and token.get_parent_name() is None:
            token.tokens = [
                Token(Name, table),
                Token(Punctuation, "."),
                Token(Name, token.get_name()),
            ]
        elif isinstance(token, TokenList):
            tokens.extend(token.tokens)


def matches_table_name(candidate: Token, table: str) -> bool:
    """
    Returns if the token represents a reference to the table.

    Tables can be fully qualified with periods.

    Note that in theory a table should be represented as an identifier, but due to
    sqlparse's aggressive list of keywords (spanning multiple dialects) often it gets
    classified as a keyword.
    """
    if not isinstance(candidate, Identifier):
        candidate = Identifier([Token(Name, candidate.value)])

    target = sqlparse.parse(table)[0].tokens[0]
    if not isinstance(target, Identifier):
        target = Identifier([Token(Name, target.value)])

    # match from right to left, splitting on the period, eg, schema.table == table
    for left, right in zip(candidate.tokens[::-1], target.tokens[::-1]):
        if left.value != right.value:
            return False

    return True


def insert_rls(token_list: TokenList, table: str, rls: TokenList) -> TokenList:
    """
    Update a statement inplace applying an RLS associated with a given table.
    """
    # make sure the identifier has the table name
    add_table_name(rls, table)

    state = InsertRLSState.SCANNING
    for token in token_list.tokens:

        # Recurse into child token list
        if isinstance(token, TokenList):
            i = token_list.tokens.index(token)
            token_list.tokens[i] = insert_rls(token, table, rls)

        # Found a source keyword (FROM/JOIN)
        if imt(token, m=[(Keyword, "FROM"), (Keyword, "JOIN")]):
            state = InsertRLSState.SEEN_SOURCE

        # Found identifier/keyword after FROM/JOIN, test for table
        elif state == InsertRLSState.SEEN_SOURCE and (
            isinstance(token, Identifier) or token.ttype == Keyword
        ):
            if matches_table_name(token, table):
                state = InsertRLSState.FOUND_TABLE

        # Found WHERE clause, insert RLS. Note that we insert it even it already exists,
        # to be on the safe side: it could be present in a clause like `1=1 OR RLS`.
        elif state == InsertRLSState.FOUND_TABLE and isinstance(token, Where):
            token.tokens[1:1] = [Token(Whitespace, " "), Token(Punctuation, "(")]
            token.tokens.extend(
                [
                    Token(Punctuation, ")"),
                    Token(Whitespace, " "),
                    Token(Keyword, "AND"),
                    Token(Whitespace, " "),
                ]
                + rls.tokens
            )
            state = InsertRLSState.SCANNING

        # Found ON clause, insert RLS. The logic for ON is more complicated than the logic
        # for WHERE because in the former the comparisons are siblings, while on the
        # latter they are children.
        elif (
            state == InsertRLSState.FOUND_TABLE
            and token.ttype == Keyword
            and token.value.upper() == "ON"
        ):
            tokens = [
                Token(Whitespace, " "),
                rls,
                Token(Whitespace, " "),
                Token(Keyword, "AND"),
                Token(Whitespace, " "),
                Token(Punctuation, "("),
            ]
            i = token_list.tokens.index(token)
            token.parent.tokens[i + 1 : i + 1] = tokens
            i += len(tokens) + 2

            # close parenthesis after last existing comparison
            j = 0
            for j, sibling in enumerate(token_list.tokens[i:]):
                # scan until we hit a non-comparison keyword (like ORDER BY) or a WHERE
                if (
                    sibling.ttype == Keyword
                    and not imt(
                        sibling, m=[(Keyword, "AND"), (Keyword, "OR"), (Keyword, "NOT")]
                    )
                    or isinstance(sibling, Where)
                ):
                    j -= 1
                    break
            token.parent.tokens[i + j + 1 : i + j + 1] = [
                Token(Whitespace, " "),
                Token(Punctuation, ")"),
                Token(Whitespace, " "),
            ]

            state = InsertRLSState.SCANNING

        # Found table but no WHERE clause found, insert one
        elif state == InsertRLSState.FOUND_TABLE and token.ttype != Whitespace:
            i = token_list.tokens.index(token)
            token_list.tokens[i:i] = [
                Token(Whitespace, " "),
                Where([Token(Keyword, "WHERE"), Token(Whitespace, " "), rls]),
                Token(Whitespace, " "),
            ]

            state = InsertRLSState.SCANNING

        # Found nothing, leaving source
        elif state == InsertRLSState.SEEN_SOURCE and token.ttype != Whitespace:
            state = InsertRLSState.SCANNING

    # found table at the end of the statement; append a WHERE clause
    if state == InsertRLSState.FOUND_TABLE:
        token_list.tokens.extend(
            [
                Token(Whitespace, " "),
                Where([Token(Keyword, "WHERE"), Token(Whitespace, " "), rls]),
            ]
        )

    return token_list
