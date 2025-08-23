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

# pylint: disable=too-many-lines

from __future__ import annotations

import logging
import re
from collections.abc import Iterator
from typing import Any, cast, TYPE_CHECKING

import sqlparse
from flask_babel import gettext as __
from jinja2 import nodes, Template
from sqlalchemy import and_
from sqlparse import keywords
from sqlparse.lexer import Lexer
from sqlparse.sql import (
    Function,
    Identifier,
    IdentifierList,
    Parenthesis,
    remove_quotes,
    Token,
    TokenList,
    Where,
)
from sqlparse.tokens import (
    Comment,
    CTE,
    DDL,
    DML,
    Keyword,
    Name,
    Punctuation,
    String,
    Whitespace,
    Wildcard,
)
from sqlparse.utils import imt

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    QueryClauseValidationException,
    SupersetParseError,
    SupersetSecurityException,
)
from superset.sql.parse import (
    extract_tables_from_statement,
    SQLGLOT_DIALECTS,
    SQLScript,
    SQLStatement,
    Table,
)
from superset.utils.backports import StrEnum

try:
    from sqloxide import parse_sql as sqloxide_parse
except (ImportError, ModuleNotFoundError):
    sqloxide_parse = None

if TYPE_CHECKING:
    from superset.models.core import Database

RESULT_OPERATIONS = {"UNION", "INTERSECT", "EXCEPT", "SELECT"}
ON_KEYWORD = "ON"
PRECEDES_TABLE_NAME = {"FROM", "JOIN", "DESCRIBE", "WITH", "LEFT JOIN", "RIGHT JOIN"}
CTE_PREFIX = "CTE__"

logger = logging.getLogger(__name__)

# TODO: Workaround for https://github.com/andialbrecht/sqlparse/issues/652.
# configure the Lexer to extend sqlparse
# reference: https://sqlparse.readthedocs.io/en/stable/extending/
lex = Lexer.get_default_instance()
sqlparser_sql_regex = keywords.SQL_REGEX
sqlparser_sql_regex.insert(25, (r"'(''|\\\\|\\|[^'])*'", sqlparse.tokens.String.Single))
lex.set_SQL_REGEX(sqlparser_sql_regex)


class CtasMethod(StrEnum):
    TABLE = "TABLE"
    VIEW = "VIEW"


def _extract_limit_from_query(statement: TokenList) -> int | None:
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


def extract_top_from_query(statement: TokenList, top_keywords: set[str]) -> int | None:
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
    for i, part in enumerate(token):
        if part.upper() in top_keywords and len(token) - 1 > i:
            try:
                top = int(token[i + 1])
            except ValueError:
                top = None
            break
    return top


def get_cte_remainder_query(sql: str) -> tuple[str | None, str]:
    """
    parse the SQL and return the CTE and rest of the block to the caller

    :param sql: SQL query
    :return: CTE and remainder block to the caller

    """
    cte: str | None = None
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


def check_sql_functions_exist(
    sql: str,
    function_list: set[str],
    engine: str = "base",
) -> bool:
    """
    Check if the SQL statement contains any of the specified functions.

    :param sql: The SQL statement
    :param function_list: The list of functions to search for
    :param engine: The engine to use for parsing the SQL statement
    """
    return ParsedQuery(sql, engine=engine).check_functions_exist(function_list)


def strip_comments_from_sql(statement: str, engine: str = "base") -> str:
    """
    Strips comments from a SQL statement, does a simple test first
    to avoid always instantiating the expensive ParsedQuery constructor

    This is useful for engines that don't support comments

    :param statement: A string with the SQL statement
    :return: SQL statement without comments
    """
    return (
        ParsedQuery(statement, engine=engine).strip_comments()
        if "--" in statement
        else statement
    )


class ParsedQuery:
    def __init__(
        self,
        sql_statement: str,
        strip_comments: bool = False,
        engine: str = "base",
    ):
        if strip_comments:
            sql_statement = sqlparse.format(sql_statement, strip_comments=True)

        self.sql: str = sql_statement
        self._engine = engine
        self._dialect = SQLGLOT_DIALECTS.get(engine) if engine else None
        self._tables: set[Table] = set()
        self._alias_names: set[str] = set()
        self._limit: int | None = None

        logger.debug("Parsing with sqlparse statement: %s", self.sql)
        self._parsed = sqlparse.parse(self.stripped())
        for statement in self._parsed:
            self._limit = _extract_limit_from_query(statement)

    @property
    def tables(self) -> set[Table]:
        if not self._tables:
            self._tables = self._extract_tables_from_sql()
        return self._tables

    def _check_functions_exist_in_token(
        self, token: Token, functions: set[str]
    ) -> bool:
        if (
            isinstance(token, Function)
            and token.get_name() is not None
            and token.get_name().lower() in functions
        ):
            return True
        if hasattr(token, "tokens"):
            for inner_token in token.tokens:
                if self._check_functions_exist_in_token(inner_token, functions):
                    return True
        return False

    def check_functions_exist(self, functions: set[str]) -> bool:
        """
        Check if the SQL statement contains any of the specified functions.

        :param functions: A set of functions to search for
        :return: True if the statement contains any of the specified functions
        """
        for statement in self._parsed:
            for token in statement.tokens:
                if self._check_functions_exist_in_token(token, functions):
                    return True
        return False

    def _extract_tables_from_sql(self) -> set[Table]:
        """
        Extract all table references in a query.

        Note: this uses sqlglot, since it's better at catching more edge cases.
        """
        try:
            statements = [
                statement._parsed  # pylint: disable=protected-access
                for statement in SQLScript(self.stripped(), self._engine).statements
            ]
        except SupersetParseError as ex:
            logger.warning("Unable to parse SQL (%s): %s", self._dialect, self.sql)
            raise SupersetSecurityException(
                SupersetError(
                    error_type=SupersetErrorType.INVALID_SQL_ERROR,
                    message=__(
                        "You may have an error in your SQL statement. {message}"
                    ).format(message=ex.error.message),
                    level=ErrorLevel.ERROR,
                )
            ) from ex

        return {
            table
            for statement in statements
            for table in extract_tables_from_statement(statement, self._dialect)
            if statement
        }

    @property
    def limit(self) -> int | None:
        return self._limit

    def _get_cte_tables(self, parsed: dict[str, Any]) -> list[dict[str, Any]]:
        if "with" not in parsed:
            return []
        return parsed["with"].get("cte_tables", [])

    def _check_cte_is_select(self, oxide_parse: list[dict[str, Any]]) -> bool:
        """
        Check if a oxide parsed CTE contains only SELECT statements

        :param oxide_parse: parsed CTE
        :return: True if CTE is a SELECT statement
        """

        def is_body_select(body: dict[str, Any]) -> bool:
            if op := body.get("SetOperation"):
                return is_body_select(op["left"]) and is_body_select(op["right"])
            return all(key == "Select" for key in body.keys())

        for query in oxide_parse:
            parsed_query = query["Query"]
            cte_tables = self._get_cte_tables(parsed_query)
            for cte_table in cte_tables:
                is_select = is_body_select(cte_table["query"]["body"])
                if not is_select:
                    return False
        return True

    def is_select(self) -> bool:
        # make sure we strip comments; prevents a bug with comments in the CTE
        parsed = sqlparse.parse(self.strip_comments())
        seen_select = False

        for statement in parsed:
            # Check if this is a CTE
            if statement.is_group and statement[0].ttype == Keyword.CTE:
                if sqloxide_parse is not None:
                    try:
                        if not self._check_cte_is_select(
                            sqloxide_parse(self.strip_comments(), dialect="ansi")
                        ):
                            return False
                    except ValueError:
                        # sqloxide was not able to parse the query, so let's continue with
                        # sqlparse
                        pass
                inner_cte = self.get_inner_cte_expression(statement.tokens) or []
                # Check if the inner CTE is a not a SELECT
                if any(token.ttype == DDL for token in inner_cte) or any(
                    token.ttype == DML and token.normalized != "SELECT"
                    for token in inner_cte
                ):
                    return False

            if statement.get_type() == "SELECT":
                seen_select = True
                continue

            if statement.get_type() != "UNKNOWN":
                return False

            # for `UNKNOWN`, check all DDL/DML explicitly: only `SELECT` DML is allowed,
            # and no DDL is allowed
            if any(token.ttype == DDL for token in statement) or any(
                token.ttype == DML and token.normalized != "SELECT"
                for token in statement
            ):
                return False

            if imt(statement.tokens[0], m=(Keyword, "USE")):
                continue

            # return false on `EXPLAIN`, `SET`, `SHOW`, etc.
            if imt(statement.tokens[0], t=Keyword):
                return False

            if not any(
                token.ttype == DML and token.normalized == "SELECT"
                for token in statement
            ):
                return False

        return seen_select

    def get_inner_cte_expression(self, tokens: TokenList) -> TokenList | None:
        for token in tokens:
            if self._is_identifier(token):
                for identifier_token in token.tokens:
                    if (
                        isinstance(identifier_token, Parenthesis)
                        and identifier_token.is_group
                    ):
                        return identifier_token.tokens
        return None

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
        return self.sql.strip(" \t\r\n;")

    def strip_comments(self) -> str:
        return sqlparse.format(self.stripped(), strip_comments=True)

    def get_statements(self) -> list[str]:
        """Returns a list of SQL statements as strings, stripped"""
        statements = []
        for statement in self._parsed:
            if statement:
                sql = str(statement).strip(" \n;\t")
                if sql:
                    statements.append(sql)
        return statements

    @staticmethod
    def get_table(tlist: TokenList) -> Table | None:
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

    def as_create_table(
        self,
        table_name: str,
        schema_name: str | None = None,
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


def sanitize_clause(clause: str) -> str:
    # clause = sqlparse.format(clause, strip_comments=True)
    statements = sqlparse.parse(clause)
    if len(statements) != 1:
        raise QueryClauseValidationException("Clause contains multiple statements")
    open_parens = 0

    previous_token = None
    for token in statements[0]:
        if token.value == "/" and previous_token and previous_token.value == "*":
            raise QueryClauseValidationException("Closing unopened multiline comment")
        if token.value == "*" and previous_token and previous_token.value == "/":
            raise QueryClauseValidationException("Unclosed multiline comment")
        if token.value in (")", "("):
            open_parens += 1 if token.value == "(" else -1
            if open_parens < 0:
                raise QueryClauseValidationException(
                    "Closing unclosed parenthesis in filter clause"
                )
        previous_token = token
    if open_parens > 0:
        raise QueryClauseValidationException("Unclosed parenthesis in filter clause")

    if previous_token and previous_token.ttype in Comment:
        if previous_token.value[-1] != "\n":
            clause = f"{clause}\n"

    return clause


class InsertRLSState(StrEnum):
    """
    State machine that scans for WHERE and ON clauses referencing tables.
    """

    SCANNING = "SCANNING"
    SEEN_SOURCE = "SEEN_SOURCE"
    FOUND_TABLE = "FOUND_TABLE"


def has_table_query(expression: str, engine: str) -> bool:
    """
    Return if a statement has a query reading from a table.

        >>> has_table_query("COUNT(*)", "postgresql")
        False
        >>> has_table_query("SELECT * FROM table", "postgresql")
        True

    Note that queries reading from constant values return false:

        >>> has_table_query("SELECT * FROM (SELECT 1)", "postgresql")
        False

    """
    # Remove trailing semicolon.
    expression = expression.strip().rstrip(";")

    # Wrap the expression in parentheses if it's not already.
    if not expression.startswith("("):
        expression = f"({expression})"

    sql = f"SELECT {expression}"
    statement = SQLStatement(sql, engine)
    return any(statement.tables)


def add_table_name(rls: TokenList, table: str) -> None:
    """
    Modify a RLS expression inplace ensuring columns are fully qualified.
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


def get_rls_for_table(
    candidate: Token,
    database_id: int,
    default_schema: str | None,
) -> TokenList | None:
    """
    Given a table name, return any associated RLS predicates.
    """
    # pylint: disable=import-outside-toplevel
    from superset import db
    from superset.connectors.sqla.models import SqlaTable

    if not isinstance(candidate, Identifier):
        candidate = Identifier([Token(Name, candidate.value)])

    table = ParsedQuery.get_table(candidate)
    if not table:
        return None

    dataset = (
        db.session.query(SqlaTable)
        .filter(
            and_(
                SqlaTable.database_id == database_id,
                SqlaTable.schema == (table.schema or default_schema),
                SqlaTable.table_name == table.table,
            )
        )
        .one_or_none()
    )
    if not dataset:
        return None

    predicate = " AND ".join(
        str(filter_) for filter_ in dataset.get_sqla_row_level_filters()
    )
    if not predicate:
        return None

    rls = sqlparse.parse(predicate)[0]
    add_table_name(rls, table.table)

    return rls


def insert_rls_as_subquery(
    token_list: TokenList,
    database_id: int,
    default_schema: str | None,
) -> TokenList:
    """
    Update a statement inplace applying any associated RLS predicates.

    The RLS predicate is applied as subquery replacing the original table:

        before: SELECT * FROM some_table WHERE 1=1
        after:  SELECT * FROM (
                  SELECT * FROM some_table WHERE some_table.id=42
                ) AS some_table
                WHERE 1=1

    This method is safer than ``insert_rls_in_predicate``, but doesn't work in all
    databases.
    """
    rls: TokenList | None = None
    state = InsertRLSState.SCANNING
    for token in token_list.tokens:
        # Recurse into child token list
        if isinstance(token, TokenList):
            i = token_list.tokens.index(token)
            token_list.tokens[i] = insert_rls_as_subquery(
                token,
                database_id,
                default_schema,
            )

        # Found a source keyword (FROM/JOIN)
        if imt(token, m=[(Keyword, "FROM"), (Keyword, "JOIN")]):
            state = InsertRLSState.SEEN_SOURCE

        # Found identifier/keyword after FROM/JOIN, test for table
        elif state == InsertRLSState.SEEN_SOURCE and (
            isinstance(token, Identifier) or token.ttype == Keyword
        ):
            rls = get_rls_for_table(token, database_id, default_schema)
            if rls:
                # replace table with subquery
                subquery_alias = (
                    token.tokens[-1].value
                    if isinstance(token, Identifier)
                    else token.value
                )
                i = token_list.tokens.index(token)

                # strip alias from table name
                if isinstance(token, Identifier) and token.has_alias():
                    whitespace_index = token.token_next_by(t=Whitespace)[0]
                    token.tokens = token.tokens[:whitespace_index]

                token_list.tokens[i] = Identifier(
                    [
                        Parenthesis(
                            [
                                Token(Punctuation, "("),
                                Token(DML, "SELECT"),
                                Token(Whitespace, " "),
                                Token(Wildcard, "*"),
                                Token(Whitespace, " "),
                                Token(Keyword, "FROM"),
                                Token(Whitespace, " "),
                                token,
                                Token(Whitespace, " "),
                                Where(
                                    [
                                        Token(Keyword, "WHERE"),
                                        Token(Whitespace, " "),
                                        rls,
                                    ]
                                ),
                                Token(Punctuation, ")"),
                            ]
                        ),
                        Token(Whitespace, " "),
                        Token(Keyword, "AS"),
                        Token(Whitespace, " "),
                        Identifier([Token(Name, subquery_alias)]),
                    ]
                )
                state = InsertRLSState.SCANNING

        # Found nothing, leaving source
        elif state == InsertRLSState.SEEN_SOURCE and token.ttype != Whitespace:
            state = InsertRLSState.SCANNING

    return token_list


def insert_rls_in_predicate(
    token_list: TokenList,
    database_id: int,
    default_schema: str | None,
) -> TokenList:
    """
    Update a statement inplace applying any associated RLS predicates.

    The RLS predicate is ``AND``ed to any existing predicates:

        before: SELECT * FROM some_table WHERE 1=1
        after:  SELECT * FROM some_table WHERE ( 1=1) AND some_table.id=42

    """
    rls: TokenList | None = None
    state = InsertRLSState.SCANNING
    for token in token_list.tokens:
        # Recurse into child token list
        if isinstance(token, TokenList):
            i = token_list.tokens.index(token)
            token_list.tokens[i] = insert_rls_in_predicate(
                token,
                database_id,
                default_schema,
            )

        # Found a source keyword (FROM/JOIN)
        if imt(token, m=[(Keyword, "FROM"), (Keyword, "JOIN")]):
            state = InsertRLSState.SEEN_SOURCE

        # Found identifier/keyword after FROM/JOIN, test for table
        elif state == InsertRLSState.SEEN_SOURCE and (
            isinstance(token, Identifier) or token.ttype == Keyword
        ):
            rls = get_rls_for_table(token, database_id, default_schema)
            if rls:
                state = InsertRLSState.FOUND_TABLE

        # Found WHERE clause, insert RLS. Note that we insert it even it already exists,
        # to be on the safe side: it could be present in a clause like `1=1 OR RLS`.
        elif state == InsertRLSState.FOUND_TABLE and isinstance(token, Where):
            rls = cast(TokenList, rls)
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


# mapping between sqloxide and SQLAlchemy dialects
SQLOXIDE_DIALECTS = {
    "ansi": {"trino", "trinonative", "presto"},
    "hive": {"hive", "databricks"},
    "ms": {"mssql"},
    "mysql": {"mysql"},
    "postgres": {
        "cockroachdb",
        "hana",
        "netezza",
        "postgres",
        "postgresql",
        "redshift",
        "vertica",
    },
    "snowflake": {"snowflake"},
    "sqlite": {"sqlite", "gsheets", "shillelagh"},
    "clickhouse": {"clickhouse"},
}

RE_JINJA_VAR = re.compile(r"\{\{[^\{\}]+\}\}")
RE_JINJA_BLOCK = re.compile(r"\{[%#][^\{\}%#]+[%#]\}")


def extract_table_references(
    sql_text: str, sqla_dialect: str, show_warning: bool = True
) -> set[Table]:
    """
    Return all the dependencies from a SQL sql_text.
    """
    dialect = "generic"
    tree = None

    if sqloxide_parse:
        for dialect, sqla_dialects in SQLOXIDE_DIALECTS.items():
            if sqla_dialect in sqla_dialects:
                break
        sql_text = RE_JINJA_BLOCK.sub(" ", sql_text)
        sql_text = RE_JINJA_VAR.sub("abc", sql_text)
        try:
            tree = sqloxide_parse(sql_text, dialect=dialect)
        except Exception as ex:  # pylint: disable=broad-except
            if show_warning:
                logger.warning(
                    "\nUnable to parse query with sqloxide:\n%s\n%s", sql_text, ex
                )

    # fallback to sqlparse
    if not tree:
        parsed = ParsedQuery(sql_text)
        return parsed.tables

    def find_nodes_by_key(element: Any, target: str) -> Iterator[Any]:
        """
        Find all nodes in a SQL tree matching a given key.
        """
        if isinstance(element, list):
            for child in element:
                yield from find_nodes_by_key(child, target)
        elif isinstance(element, dict):
            for key, value in element.items():
                if key == target:
                    yield value
                else:
                    yield from find_nodes_by_key(value, target)

    return {
        Table(*[part["value"] for part in table["name"][::-1]])
        for table in find_nodes_by_key(tree, "Table")
    }


def extract_tables_from_jinja_sql(sql: str, database: Database) -> set[Table]:
    """
    Extract all table references in the Jinjafied SQL statement.

    Due to Jinja templating, a multiphase approach is necessary as the Jinjafied SQL
    statement may represent invalid SQL which is non-parsable by SQLGlot.

    Firstly, we extract any tables referenced within the confines of specific Jinja
    macros. Secondly, we replace these non-SQL Jinja calls with a pseudo-benign SQL
    expression to help ensure that the resulting SQL statements are parsable by
    SQLGlot.

    :param sql: The Jinjafied SQL statement
    :param database: The database associated with the SQL statement
    :returns: The set of tables referenced in the SQL statement
    :raises SupersetSecurityException: If SQLGlot is unable to parse the SQL statement
    :raises jinja2.exceptions.TemplateError: If the Jinjafied SQL could not be rendered
    """

    from superset.jinja_context import (  # pylint: disable=import-outside-toplevel
        get_template_processor,
    )

    processor = get_template_processor(database)
    template = processor.env.parse(sql)

    tables = set()

    for node in template.find_all(nodes.Call):
        if isinstance(node.node, nodes.Getattr) and node.node.attr in (
            "latest_partition",
            "latest_sub_partition",
        ):
            # Try to extract the table referenced in the macro.
            try:
                tables.add(
                    Table(
                        *[
                            remove_quotes(part.strip())
                            for part in node.args[0].as_const().split(".")[::-1]
                            if len(node.args) == 1
                        ]
                    )
                )
            except nodes.Impossible:
                pass

            # Replace the potentially problematic Jinja macro with some benign SQL.
            node.__class__ = nodes.TemplateData
            node.fields = nodes.TemplateData.fields
            node.data = "NULL"

    # re-render template back into a string
    rendered_template = Template(template).render()

    return (
        tables
        | ParsedQuery(
            sql_statement=processor.process_template(rendered_template),
            engine=database.db_engine_spec.engine,
        ).tables
    )
