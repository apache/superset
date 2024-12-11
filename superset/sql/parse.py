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

from __future__ import annotations

import enum
import logging
import re
import urllib.parse
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any, Generic, TypeVar

import sqlglot
import sqlparse
from deprecation import deprecated
from sqlglot import exp
from sqlglot.dialects.dialect import Dialect, Dialects
from sqlglot.errors import ParseError
from sqlglot.optimizer.scope import Scope, ScopeType, traverse_scope

from superset.exceptions import SupersetParseError

logger = logging.getLogger(__name__)


# mapping between DB engine specs and sqlglot dialects
SQLGLOT_DIALECTS = {
    "base": Dialects.DIALECT,
    "ascend": Dialects.HIVE,
    "awsathena": Dialects.PRESTO,
    "bigquery": Dialects.BIGQUERY,
    "clickhouse": Dialects.CLICKHOUSE,
    "clickhousedb": Dialects.CLICKHOUSE,
    "cockroachdb": Dialects.POSTGRES,
    "couchbase": Dialects.MYSQL,
    # "crate": ???
    # "databend": ???
    "databricks": Dialects.DATABRICKS,
    # "db2": ???
    # "dremio": ???
    "drill": Dialects.DRILL,
    # "druid": ???
    "duckdb": Dialects.DUCKDB,
    # "dynamodb": ???
    # "elasticsearch": ???
    # "exa": ???
    # "firebird": ???
    # "firebolt": ???
    "gsheets": Dialects.SQLITE,
    "hana": Dialects.POSTGRES,
    "hive": Dialects.HIVE,
    # "ibmi": ???
    # "impala": ???
    # "kustokql": ???
    # "kylin": ???
    "mssql": Dialects.TSQL,
    "mysql": Dialects.MYSQL,
    "netezza": Dialects.POSTGRES,
    # "ocient": ???
    # "odelasticsearch": ???
    "oracle": Dialects.ORACLE,
    # "pinot": ???
    "postgresql": Dialects.POSTGRES,
    "presto": Dialects.PRESTO,
    "pydoris": Dialects.DORIS,
    "redshift": Dialects.REDSHIFT,
    # "risingwave": ???
    # "rockset": ???
    "shillelagh": Dialects.SQLITE,
    "snowflake": Dialects.SNOWFLAKE,
    # "solr": ???
    "spark": Dialects.SPARK,
    "sqlite": Dialects.SQLITE,
    "starrocks": Dialects.STARROCKS,
    "superset": Dialects.SQLITE,
    "teradatasql": Dialects.TERADATA,
    "trino": Dialects.TRINO,
    "vertica": Dialects.POSTGRES,
    "yql": Dialects.CLICKHOUSE,
}


@dataclass(eq=True, frozen=True)
class Table:
    """
    A fully qualified SQL table conforming to [[catalog.]schema.]table.
    """

    table: str
    schema: str | None = None
    catalog: str | None = None

    def __str__(self) -> str:
        """
        Return the fully qualified SQL table name.

        Should not be used for SQL generation, only for logging and debugging, since the
        quoting is not engine-specific.
        """
        return ".".join(
            urllib.parse.quote(part, safe="").replace(".", "%2E")
            for part in [self.catalog, self.schema, self.table]
            if part
        )

    def __eq__(self, other: Any) -> bool:
        return str(self) == str(other)


# To avoid unnecessary parsing/formatting of queries, the statement has the concept of
# an "internal representation", which is the AST of the SQL statement. For most of the
# engines supported by Superset this is `sqlglot.exp.Expression`, but there is a special
# case: KustoKQL uses a different syntax and there are no Python parsers for it, so we
# store the AST as a string (the original query), and manipulate it with regular
# expressions.
InternalRepresentation = TypeVar("InternalRepresentation")

# The base type. This helps type checking the `split_query` method correctly, since each
# derived class has a more specific return type (the class itself). This will no longer
# be needed once Python 3.11 is the lowest version supported. See PEP 673 for more
# information: https://peps.python.org/pep-0673/
TBaseSQLStatement = TypeVar("TBaseSQLStatement")  # pylint: disable=invalid-name


class BaseSQLStatement(Generic[InternalRepresentation]):
    """
    Base class for SQL statements.

    The class should be instantiated with a string representation of the script and, for
    efficiency reasons, optionally with a pre-parsed AST. This is useful with
    `sqlglot.parse`, which will split a script in multiple already parsed statements.

    The `engine` parameters comes from the `engine` attribute in a Superset DB engine
    spec.
    """

    def __init__(
        self,
        statement: str,
        engine: str,
        ast: InternalRepresentation | None = None,
    ):
        self._sql = statement
        self._parsed = ast or self._parse_statement(statement, engine)
        self.engine = engine
        self.tables = self._extract_tables_from_statement(self._parsed, self.engine)

    @classmethod
    def split_script(
        cls: type[TBaseSQLStatement],
        script: str,
        engine: str,
    ) -> list[TBaseSQLStatement]:
        """
        Split a script into multiple instantiated statements.

        This is a helper function to split a full SQL script into multiple
        `BaseSQLStatement` instances. It's used by `SQLScript` when instantiating the
        statements within a script.
        """
        raise NotImplementedError()

    @classmethod
    def _parse_statement(
        cls,
        statement: str,
        engine: str,
    ) -> InternalRepresentation:
        """
        Parse a string containing a single SQL statement, and returns the parsed AST.

        Derived classes should not assume that `statement` contains a single statement,
        and MUST explicitly validate that. Since this validation is parser dependent the
        responsibility is left to the children classes.
        """
        raise NotImplementedError()

    @classmethod
    def _extract_tables_from_statement(
        cls,
        parsed: InternalRepresentation,
        engine: str,
    ) -> set[Table]:
        """
        Extract all table references in a given statement.
        """
        raise NotImplementedError()

    def format(self, comments: bool = True) -> str:
        """
        Format the statement, optionally ommitting comments.
        """
        raise NotImplementedError()

    def get_settings(self) -> dict[str, str | bool]:
        """
        Return any settings set by the statement.

        For example, for this statement:

            sql> SET foo = 'bar';

        The method should return `{"foo": "'bar'"}`. Note the single quotes.
        """
        raise NotImplementedError()

    def is_mutating(self) -> bool:
        """
        Check if the statement mutates data (DDL/DML).

        :return: True if the statement mutates data.
        """
        raise NotImplementedError()

    def __str__(self) -> str:
        return self.format()


class SQLStatement(BaseSQLStatement[exp.Expression]):
    """
    A SQL statement.

    This class is used for all engines with dialects that can be parsed using sqlglot.
    """

    def __init__(
        self,
        statement: str,
        engine: str,
        ast: exp.Expression | None = None,
    ):
        self._dialect = SQLGLOT_DIALECTS.get(engine)
        super().__init__(statement, engine, ast)

    @classmethod
    def _parse(cls, script: str, engine: str) -> list[exp.Expression]:
        """
        Parse helper.
        """
        dialect = SQLGLOT_DIALECTS.get(engine)
        try:
            return sqlglot.parse(script, dialect=dialect)
        except sqlglot.errors.ParseError as ex:
            error = ex.errors[0]
            raise SupersetParseError(
                script,
                engine,
                highlight=error["highlight"],
                line=error["line"],
                column=error["col"],
            ) from ex
        except sqlglot.errors.SqlglotError as ex:
            raise SupersetParseError(
                script,
                engine,
                message="Unable to parse script",
            ) from ex

    @classmethod
    def split_script(
        cls,
        script: str,
        engine: str,
    ) -> list[SQLStatement]:
        if dialect := SQLGLOT_DIALECTS.get(engine):
            try:
                return [
                    cls(ast.sql(), engine, ast)
                    for ast in cls._parse(script, engine)
                    if ast
                ]
            except ValueError:
                # `ast.sql()` might raise an error on some cases (eg, `SHOW TABLES
                # FROM`). In this case, we rely on the tokenizer to generate the
                # statements.
                pass

        # When we don't have a sqlglot dialect we can't rely on `ast.sql()` to correctly
        # generate the SQL of each statement, so we tokenize the script and split it
        # based on the location of semi-colons.
        statements = []
        start = 0
        remainder = script

        try:
            tokens = sqlglot.tokenize(script, dialect)
        except sqlglot.errors.TokenError as ex:
            raise SupersetParseError(
                script,
                engine,
                message="Unable to tokenize script",
            ) from ex

        for token in tokens:
            if token.token_type == sqlglot.TokenType.SEMICOLON:
                statement, start = script[start : token.start], token.end + 1
                ast = cls._parse(statement, engine)[0]
                statements.append(cls(statement.strip(), engine, ast))
                remainder = script[start:]

        if remainder.strip():
            ast = cls._parse(remainder, engine)[0]
            statements.append(cls(remainder.strip(), engine, ast))

        return statements

    @classmethod
    def _parse_statement(
        cls,
        statement: str,
        engine: str,
    ) -> exp.Expression:
        """
        Parse a single SQL statement.
        """
        statements = cls.split_script(statement, engine)
        if len(statements) != 1:
            raise SupersetParseError("SQLStatement should have exactly one statement")

        return statements[0]._parsed  # pylint: disable=protected-access

    @classmethod
    def _extract_tables_from_statement(
        cls,
        parsed: exp.Expression,
        engine: str,
    ) -> set[Table]:
        """
        Find all referenced tables.
        """
        dialect = SQLGLOT_DIALECTS.get(engine)
        return extract_tables_from_statement(parsed, dialect)

    def is_mutating(self) -> bool:
        """
        Check if the statement mutates data (DDL/DML).

        :return: True if the statement mutates data.
        """
        for node in self._parsed.walk():
            if isinstance(
                node,
                (
                    exp.Insert,
                    exp.Update,
                    exp.Delete,
                    exp.Merge,
                    exp.Create,
                    exp.Drop,
                    exp.TruncateTable,
                ),
            ):
                return True

            if isinstance(node, exp.Command) and node.name == "ALTER":
                return True

        # Postgres runs DMLs prefixed by `EXPLAIN ANALYZE`, see
        # https://www.postgresql.org/docs/current/sql-explain.html
        if (
            self._dialect == Dialects.POSTGRES
            and isinstance(self._parsed, exp.Command)
            and self._parsed.name == "EXPLAIN"
            and self._parsed.expression.name.upper().startswith("ANALYZE ")
        ):
            analyzed_sql = self._parsed.expression.name[len("ANALYZE ") :]
            return SQLStatement(analyzed_sql, self.engine).is_mutating()

        return False

    def format(self, comments: bool = True) -> str:
        """
        Pretty-format the SQL statement.
        """
        if self._dialect:
            try:
                write = Dialect.get_or_raise(self._dialect)
                return write.generate(
                    self._parsed,
                    copy=False,
                    comments=comments,
                    pretty=True,
                )
            except ValueError:
                pass

        return self._fallback_formatting()

    @deprecated(deprecated_in="4.0", removed_in="5.0")
    def _fallback_formatting(self) -> str:
        """
        Format SQL without a specific dialect.

        Reformatting SQL using the generic sqlglot dialect is known to break queries.
        For example, it will change `foo NOT IN (1, 2)` to `NOT foo IN (1,2)`, which
        breaks the query for Firebolt. To avoid this, we use sqlparse for formatting
        when the dialect is not known.

        In 5.0 we should remove `sqlparse`, and the method should return the query
        unmodified.
        """
        return sqlparse.format(self._sql, reindent=True, keyword_case="upper")

    def get_settings(self) -> dict[str, str | bool]:
        """
        Return the settings for the SQL statement.

            >>> statement = SQLStatement("SET foo = 'bar'")
            >>> statement.get_settings()
            {"foo": "'bar'"}

        """
        return {
            eq.this.sql(comments=False): eq.expression.sql(comments=False)
            for set_item in self._parsed.find_all(exp.SetItem)
            for eq in set_item.find_all(exp.EQ)
        }


class KQLSplitState(enum.Enum):
    """
    State machine for splitting a KQL script.

    The state machine keeps track of whether we're inside a string or not, so we
    don't split the script in a semi-colon that's part of a string.
    """

    OUTSIDE_STRING = enum.auto()
    INSIDE_SINGLE_QUOTED_STRING = enum.auto()
    INSIDE_DOUBLE_QUOTED_STRING = enum.auto()
    INSIDE_MULTILINE_STRING = enum.auto()


def split_kql(kql: str) -> list[str]:
    """
    Custom function for splitting KQL statements.
    """
    statements = []
    state = KQLSplitState.OUTSIDE_STRING
    statement_start = 0
    script = kql if kql.endswith(";") else kql + ";"
    for i, character in enumerate(script):
        if state == KQLSplitState.OUTSIDE_STRING:
            if character == ";":
                statements.append(script[statement_start:i])
                statement_start = i + 1
            elif character == "'":
                state = KQLSplitState.INSIDE_SINGLE_QUOTED_STRING
            elif character == '"':
                state = KQLSplitState.INSIDE_DOUBLE_QUOTED_STRING
            elif character == "`" and script[i - 2 : i] == "``":
                state = KQLSplitState.INSIDE_MULTILINE_STRING

        elif (
            state == KQLSplitState.INSIDE_SINGLE_QUOTED_STRING
            and character == "'"
            and script[i - 1] != "\\"
        ):
            state = KQLSplitState.OUTSIDE_STRING

        elif (
            state == KQLSplitState.INSIDE_DOUBLE_QUOTED_STRING
            and character == '"'
            and script[i - 1] != "\\"
        ):
            state = KQLSplitState.OUTSIDE_STRING

        elif (
            state == KQLSplitState.INSIDE_MULTILINE_STRING
            and character == "`"
            and script[i - 2 : i] == "``"
        ):
            state = KQLSplitState.OUTSIDE_STRING

    return statements


class KustoKQLStatement(BaseSQLStatement[str]):
    """
    Special class for Kusto KQL.

    Kusto KQL is a SQL-like language, but it's not supported by sqlglot. Queries look
    like this:

        StormEvents
        | summarize PropertyDamage = sum(DamageProperty) by State
        | join kind=innerunique PopulationData on State
        | project State, PropertyDamagePerCapita = PropertyDamage / Population
        | sort by PropertyDamagePerCapita

    See https://learn.microsoft.com/en-us/azure/data-explorer/kusto/query/ for more
    details about it.
    """

    @classmethod
    def split_script(
        cls,
        script: str,
        engine: str,
    ) -> list[KustoKQLStatement]:
        """
        Split a script at semi-colons.

        Since we don't have a parser, we use a simple state machine based function. See
        https://learn.microsoft.com/en-us/azure/data-explorer/kusto/query/scalar-data-types/string
        for more information.
        """
        return [
            cls(statement, engine, statement.strip()) for statement in split_kql(script)
        ]

    @classmethod
    def _parse_statement(
        cls,
        statement: str,
        engine: str,
    ) -> str:
        if engine != "kustokql":
            raise SupersetParseError(f"Invalid engine: {engine}")

        statements = split_kql(statement)
        if len(statements) != 1:
            raise SupersetParseError("SQLStatement should have exactly one statement")

        return statements[0].strip()

    @classmethod
    def _extract_tables_from_statement(
        cls,
        parsed: str,
        engine: str,
    ) -> set[Table]:
        """
        Extract all tables referenced in the statement.

            StormEvents
            | where InjuriesDirect + InjuriesIndirect > 50
            | join (PopulationData) on State
            | project State, Population, TotalInjuries = InjuriesDirect + InjuriesIndirect

        """
        logger.warning(
            "Kusto KQL doesn't support table extraction. This means that data access "
            "roles will not be enforced by Superset in the database."
        )
        return set()

    def format(self, comments: bool = True) -> str:
        """
        Pretty-format the SQL statement.
        """
        return self._sql.strip()

    def get_settings(self) -> dict[str, str | bool]:
        """
        Return the settings for the SQL statement.

            >>> statement = KustoKQLStatement("set querytrace;")
            >>> statement.get_settings()
            {"querytrace": True}

        """
        set_regex = r"^set\s+(?P<name>\w+)(?:\s*=\s*(?P<value>\w+))?$"
        if match := re.match(set_regex, self._parsed, re.IGNORECASE):
            return {match.group("name"): match.group("value") or True}

        return {}

    def is_mutating(self) -> bool:
        """
        Check if the statement mutates data (DDL/DML).

        :return: True if the statement mutates data.
        """
        return self._parsed.startswith(".") and not self._parsed.startswith(".show")


class SQLScript:
    """
    A SQL script, with 0+ statements.
    """

    # Special engines that can't be parsed using sqlglot. Supporting non-SQL engines
    # adds a lot of complexity to Superset, so we should avoid adding new engines to
    # this data structure.
    special_engines = {
        "kustokql": KustoKQLStatement,
    }

    def __init__(
        self,
        script: str,
        engine: str,
    ):
        statement_class = self.special_engines.get(engine, SQLStatement)
        self.engine = engine
        self.statements = statement_class.split_script(script, engine)

    def format(self, comments: bool = True) -> str:
        """
        Pretty-format the SQL script.

        Note that even though KQL is very different from SQL, multiple statements are
        still separated by semi-colons.
        """
        return ";\n".join(statement.format(comments) for statement in self.statements)

    def get_settings(self) -> dict[str, str | bool]:
        """
        Return the settings for the SQL script.

            >>> statement = SQLScript("SET foo = 'bar'; SET foo = 'baz'")
            >>> statement.get_settings()
            {"foo": "'baz'"}

        """
        settings: dict[str, str | bool] = {}
        for statement in self.statements:
            settings.update(statement.get_settings())

        return settings

    def has_mutation(self) -> bool:
        """
        Check if the script contains mutating statements.

        :return: True if the script contains mutating statements
        """
        return any(statement.is_mutating() for statement in self.statements)


def extract_tables_from_statement(
    statement: exp.Expression,
    dialect: Dialects | None,
) -> set[Table]:
    """
    Extract all table references in a single statement.

    Please not that this is not trivial; consider the following queries:

        DESCRIBE some_table;
        SHOW PARTITIONS FROM some_table;
        WITH masked_name AS (SELECT * FROM some_table) SELECT * FROM masked_name;

    See the unit tests for other tricky cases.
    """
    sources: Iterable[exp.Table]

    if isinstance(statement, exp.Describe):
        # A `DESCRIBE` query has no sources in sqlglot, so we need to explicitly
        # query for all tables.
        sources = statement.find_all(exp.Table)
    elif isinstance(statement, exp.Command):
        # Commands, like `SHOW COLUMNS FROM foo`, have to be converted into a
        # `SELECT` statetement in order to extract tables.
        literal = statement.find(exp.Literal)
        if not literal:
            return set()

        try:
            pseudo_query = sqlglot.parse_one(f"SELECT {literal.this}", dialect=dialect)
        except ParseError:
            return set()
        sources = pseudo_query.find_all(exp.Table)
    else:
        sources = [
            source
            for scope in traverse_scope(statement)
            for source in scope.sources.values()
            if isinstance(source, exp.Table) and not is_cte(source, scope)
        ]

    return {
        Table(
            source.name,
            source.db if source.db != "" else None,
            source.catalog if source.catalog != "" else None,
        )
        for source in sources
    }


def is_cte(source: exp.Table, scope: Scope) -> bool:
    """
    Is the source a CTE?

    CTEs in the parent scope look like tables (and are represented by
    exp.Table objects), but should not be considered as such;
    otherwise a user with access to table `foo` could access any table
    with a query like this:

        WITH foo AS (SELECT * FROM target_table) SELECT * FROM foo

    """
    parent_sources = scope.parent.sources if scope.parent else {}
    ctes_in_scope = {
        name
        for name, parent_scope in parent_sources.items()
        if isinstance(parent_scope, Scope) and parent_scope.scope_type == ScopeType.CTE
    }

    return source.name in ctes_in_scope
