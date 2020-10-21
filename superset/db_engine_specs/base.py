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
# pylint: disable=unused-argument
import dataclasses
import hashlib
import json
import logging
import re
from contextlib import closing
from datetime import datetime
from typing import (
    Any,
    Callable,
    Dict,
    List,
    Match,
    NamedTuple,
    Optional,
    Pattern,
    Tuple,
    TYPE_CHECKING,
    Union,
)

import pandas as pd
import sqlparse
from flask import g
from flask_babel import lazy_gettext as _
from sqlalchemy import column, DateTime, select
from sqlalchemy.engine.base import Engine
from sqlalchemy.engine.interfaces import Compiled, Dialect
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.engine.url import URL
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session
from sqlalchemy.sql import quoted_name, text
from sqlalchemy.sql.expression import ColumnClause, ColumnElement, Select, TextAsFrom
from sqlalchemy.types import TypeEngine

from superset import app, sql_parse
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.models.sql_lab import Query
from superset.sql_parse import Table
from superset.utils import core as utils

if TYPE_CHECKING:
    # prevent circular imports
    from superset.connectors.sqla.models import TableColumn
    from superset.models.core import Database

logger = logging.getLogger()


class TimeGrain(NamedTuple):  # pylint: disable=too-few-public-methods
    name: str  # TODO: redundant field, remove
    label: str
    function: str
    duration: Optional[str]


QueryStatus = utils.QueryStatus
config = app.config

builtin_time_grains: Dict[Optional[str], str] = {
    None: "Time Column",
    "PT1S": "second",
    "PT1M": "minute",
    "PT5M": "5 minute",
    "PT10M": "10 minute",
    "PT15M": "15 minute",
    "PT0.5H": "half hour",
    "PT1H": "hour",
    "P1D": "day",
    "P1W": "week",
    "P1M": "month",
    "P0.25Y": "quarter",
    "P1Y": "year",
    "1969-12-28T00:00:00Z/P1W": "week_start_sunday",
    "1969-12-29T00:00:00Z/P1W": "week_start_monday",
    "P1W/1970-01-03T00:00:00Z": "week_ending_saturday",
    "P1W/1970-01-04T00:00:00Z": "week_ending_sunday",
}


class TimestampExpression(
    ColumnClause
):  # pylint: disable=abstract-method,too-many-ancestors,too-few-public-methods
    def __init__(self, expr: str, col: ColumnClause, **kwargs: Any) -> None:
        """Sqlalchemy class that can be can be used to render native column elements
        respeting engine-specific quoting rules as part of a string-based expression.

        :param expr: Sql expression with '{col}' denoting the locations where the col
        object will be rendered.
        :param col: the target column
        """
        super().__init__(expr, **kwargs)
        self.col = col

    @property
    def _constructor(self) -> ColumnClause:
        # Needed to ensure that the column label is rendered correctly when
        # proxied to the outer query.
        # See https://github.com/sqlalchemy/sqlalchemy/issues/4730
        return ColumnClause


@compiles(TimestampExpression)
def compile_timegrain_expression(
    element: TimestampExpression, compiler: Compiled, **kwargs: Any
) -> str:
    return element.name.replace("{col}", compiler.process(element.col, **kwargs))


class LimitMethod:  # pylint: disable=too-few-public-methods
    """Enum the ways that limits can be applied"""

    FETCH_MANY = "fetch_many"
    WRAP_SQL = "wrap_sql"
    FORCE_LIMIT = "force_limit"


class BaseEngineSpec:  # pylint: disable=too-many-public-methods
    """Abstract class for database engine specific configurations"""

    engine = "base"  # str as defined in sqlalchemy.engine.engine
    engine_aliases: Optional[Tuple[str]] = None
    engine_name: Optional[
        str
    ] = None  # used for user messages, overridden in child classes
    _date_trunc_functions: Dict[str, str] = {}
    _time_grain_expressions: Dict[Optional[str], str] = {}
    column_type_mappings: Tuple[
        Tuple[Pattern[str], Union[TypeEngine, Callable[[Match[str]], TypeEngine]]], ...,
    ] = ()
    time_groupby_inline = False
    limit_method = LimitMethod.FORCE_LIMIT
    time_secondary_columns = False
    allows_joins = True
    allows_subqueries = True
    allows_column_aliases = True
    force_column_alias_quotes = False
    arraysize = 0
    max_column_name_length = 0
    try_remove_schema_from_table_name = True  # pylint: disable=invalid-name

    # default matching patterns for identifying column types
    db_column_types: Dict[utils.DbColumnType, Tuple[Pattern[Any], ...]] = {
        utils.DbColumnType.NUMERIC: (
            re.compile(r"BIT", re.IGNORECASE),
            re.compile(r".*DOUBLE.*", re.IGNORECASE),
            re.compile(r".*FLOAT.*", re.IGNORECASE),
            re.compile(r".*INT.*", re.IGNORECASE),
            re.compile(r".*NUMBER.*", re.IGNORECASE),
            re.compile(r".*LONG$", re.IGNORECASE),
            re.compile(r".*REAL.*", re.IGNORECASE),
            re.compile(r".*NUMERIC.*", re.IGNORECASE),
            re.compile(r".*DECIMAL.*", re.IGNORECASE),
            re.compile(r".*MONEY.*", re.IGNORECASE),
        ),
        utils.DbColumnType.STRING: (
            re.compile(r".*CHAR.*", re.IGNORECASE),
            re.compile(r".*STRING.*", re.IGNORECASE),
            re.compile(r".*TEXT.*", re.IGNORECASE),
        ),
        utils.DbColumnType.TEMPORAL: (
            re.compile(r".*DATE.*", re.IGNORECASE),
            re.compile(r".*TIME.*", re.IGNORECASE),
        ),
    }

    @classmethod
    def is_db_column_type_match(
        cls, db_column_type: Optional[str], target_column_type: utils.DbColumnType
    ) -> bool:
        """
        Check if a column type satisfies a pattern in a collection of regexes found in
        `db_column_types`. For example, if `db_column_type == "NVARCHAR"`,
        it would be a match for "STRING" due to being a match for the regex ".*CHAR.*".

        :param db_column_type: Column type to evaluate
        :param target_column_type: The target type to evaluate for
        :return: `True` if a `db_column_type` matches any pattern corresponding to
        `target_column_type`
        """
        if not db_column_type:
            return False
        patterns = cls.db_column_types[target_column_type]
        return any(pattern.match(db_column_type) for pattern in patterns)

    @classmethod
    def get_allow_cost_estimate(cls, version: Optional[str] = None) -> bool:
        return False

    @classmethod
    def get_engine(
        cls,
        database: "Database",
        schema: Optional[str] = None,
        source: Optional[str] = None,
    ) -> Engine:
        user_name = utils.get_username()
        return database.get_sqla_engine(
            schema=schema, nullpool=True, user_name=user_name, source=source
        )

    @classmethod
    def get_timestamp_expr(
        cls,
        col: ColumnClause,
        pdf: Optional[str],
        time_grain: Optional[str],
        type_: Optional[str] = None,
    ) -> TimestampExpression:
        """
        Construct a TimestampExpression to be used in a SQLAlchemy query.

        :param col: Target column for the TimestampExpression
        :param pdf: date format (seconds or milliseconds)
        :param time_grain: time grain, e.g. P1Y for 1 year
        :param type_: the source column type
        :return: TimestampExpression object
        """
        if time_grain:
            time_expr = cls.get_time_grain_expressions().get(time_grain)
            if not time_expr:
                raise NotImplementedError(
                    f"No grain spec for {time_grain} for database {cls.engine}"
                )
            if type_ and "{func}" in time_expr:
                date_trunc_function = cls._date_trunc_functions.get(type_)
                if date_trunc_function:
                    time_expr = time_expr.replace("{func}", date_trunc_function)
        else:
            time_expr = "{col}"

        # if epoch, translate to DATE using db specific conf
        if pdf == "epoch_s":
            time_expr = time_expr.replace("{col}", cls.epoch_to_dttm())
        elif pdf == "epoch_ms":
            time_expr = time_expr.replace("{col}", cls.epoch_ms_to_dttm())

        return TimestampExpression(time_expr, col, type_=DateTime)

    @classmethod
    def get_time_grains(cls) -> Tuple[TimeGrain, ...]:
        """
        Generate a tuple of supported time grains.

        :return: All time grains supported by the engine
        """

        ret_list = []
        time_grains = builtin_time_grains.copy()
        time_grains.update(config["TIME_GRAIN_ADDONS"])
        for duration, func in cls.get_time_grain_expressions().items():
            if duration in time_grains:
                name = time_grains[duration]
                ret_list.append(TimeGrain(name, _(name), func, duration))
        return tuple(ret_list)

    @classmethod
    def get_time_grain_expressions(cls) -> Dict[Optional[str], str]:
        """
        Return a dict of all supported time grains including any potential added grains
        but excluding any potentially disabled grains in the config file.

        :return: All time grain expressions supported by the engine
        """
        # TODO: use @memoize decorator or similar to avoid recomputation on every call
        time_grain_expressions = cls._time_grain_expressions.copy()
        grain_addon_expressions = config["TIME_GRAIN_ADDON_EXPRESSIONS"]
        time_grain_expressions.update(grain_addon_expressions.get(cls.engine, {}))
        denylist: List[str] = config["TIME_GRAIN_DENYLIST"]
        for key in denylist:
            time_grain_expressions.pop(key)
        return time_grain_expressions

    @classmethod
    def make_select_compatible(
        cls, groupby_exprs: Dict[str, ColumnElement], select_exprs: List[ColumnElement]
    ) -> List[ColumnElement]:
        """
        Some databases will just return the group-by field into the select, but don't
        allow the group-by field to be put into the select list.

        :param groupby_exprs: mapping between column name and column object
        :param select_exprs: all columns in the select clause
        :return: columns to be included in the final select clause
        """
        return select_exprs

    @classmethod
    def fetch_data(
        cls, cursor: Any, limit: Optional[int] = None
    ) -> List[Tuple[Any, ...]]:
        """

        :param cursor: Cursor instance
        :param limit: Maximum number of rows to be returned by the cursor
        :return: Result of query
        """
        if cls.arraysize:
            cursor.arraysize = cls.arraysize
        if cls.limit_method == LimitMethod.FETCH_MANY and limit:
            return cursor.fetchmany(limit)
        return cursor.fetchall()

    @classmethod
    def expand_data(
        cls, columns: List[Dict[Any, Any]], data: List[Dict[Any, Any]]
    ) -> Tuple[List[Dict[Any, Any]], List[Dict[Any, Any]], List[Dict[Any, Any]]]:
        """
        Some engines support expanding nested fields. See implementation in Presto
        spec for details.

        :param columns: columns selected in the query
        :param data: original data set
        :return: list of all columns(selected columns and their nested fields),
                 expanded data set, listed of nested fields
        """
        return columns, data, []

    @classmethod
    def alter_new_orm_column(cls, orm_col: "TableColumn") -> None:
        """Allow altering default column attributes when first detected/added

        For instance special column like `__time` for Druid can be
        set to is_dttm=True. Note that this only gets called when new
        columns are detected/created"""
        # TODO: Fix circular import caused by importing TableColumn

    @classmethod
    def epoch_to_dttm(cls) -> str:
        """
        SQL expression that converts epoch (seconds) to datetime that can be used in a
        query. The reference column should be denoted as `{col}` in the return
        expression, e.g. "FROM_UNIXTIME({col})"

        :return: SQL Expression
        """
        raise NotImplementedError()

    @classmethod
    def epoch_ms_to_dttm(cls) -> str:
        """
        SQL expression that converts epoch (milliseconds) to datetime that can be used
        in a query.

        :return: SQL Expression
        """
        return cls.epoch_to_dttm().replace("{col}", "({col}/1000)")

    @classmethod
    def get_datatype(cls, type_code: Any) -> Optional[str]:
        """
        Change column type code from cursor description to string representation.

        :param type_code: Type code from cursor description
        :return: String representation of type code
        """
        if isinstance(type_code, str) and type_code != "":
            return type_code.upper()
        return None

    @classmethod
    def normalize_indexes(cls, indexes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Normalizes indexes for more consistency across db engines

        noop by default

        :param indexes: Raw indexes as returned by SQLAlchemy
        :return: cleaner, more aligned index definition
        """
        return indexes

    @classmethod
    def extra_table_metadata(
        cls, database: "Database", table_name: str, schema_name: str
    ) -> Dict[str, Any]:
        """
        Returns engine-specific table metadata

        :param database: Database instance
        :param table_name: Table name
        :param schema_name: Schema name
        :return: Engine-specific table metadata
        """
        # TODO: Fix circular import caused by importing Database
        return {}

    @classmethod
    def apply_limit_to_sql(cls, sql: str, limit: int, database: "Database") -> str:
        """
        Alters the SQL statement to apply a LIMIT clause

        :param sql: SQL query
        :param limit: Maximum number of rows to be returned by the query
        :param database: Database instance
        :return: SQL query with limit clause
        """
        # TODO: Fix circular import caused by importing Database
        if cls.limit_method == LimitMethod.WRAP_SQL:
            sql = sql.strip("\t\n ;")
            qry = (
                select("*")
                .select_from(TextAsFrom(text(sql), ["*"]).alias("inner_qry"))
                .limit(limit)
            )
            return database.compile_sqla_query(qry)

        if LimitMethod.FORCE_LIMIT:
            parsed_query = sql_parse.ParsedQuery(sql)
            sql = parsed_query.set_or_update_query_limit(limit)

        return sql

    @classmethod
    def get_limit_from_sql(cls, sql: str) -> Optional[int]:
        """
        Extract limit from SQL query

        :param sql: SQL query
        :return: Value of limit clause in query
        """
        parsed_query = sql_parse.ParsedQuery(sql)
        return parsed_query.limit

    @classmethod
    def set_or_update_query_limit(cls, sql: str, limit: int) -> str:
        """
        Create a query based on original query but with new limit clause

        :param sql: SQL query
        :param limit: New limit to insert/replace into query
        :return: Query with new limit
        """
        parsed_query = sql_parse.ParsedQuery(sql)
        return parsed_query.set_or_update_query_limit(limit)

    @staticmethod
    def csv_to_df(**kwargs: Any) -> pd.DataFrame:
        """ Read csv into Pandas DataFrame
        :param kwargs: params to be passed to DataFrame.read_csv
        :return: Pandas DataFrame containing data from csv
        """
        kwargs["encoding"] = "utf-8"
        kwargs["iterator"] = True
        chunks = pd.read_csv(**kwargs)
        df = pd.concat(chunk for chunk in chunks)
        return df

    @classmethod
    def df_to_sql(cls, df: pd.DataFrame, **kwargs: Any) -> None:
        """ Upload data from a Pandas DataFrame to a database. For
        regular engines this calls the DataFrame.to_sql() method. Can be
        overridden for engines that don't work well with to_sql(), e.g.
        BigQuery.
        :param df: Dataframe with data to be uploaded
        :param kwargs: kwargs to be passed to to_sql() method
        """
        df.to_sql(**kwargs)

    @classmethod
    def create_table_from_csv(  # pylint: disable=too-many-arguments
        cls,
        filename: str,
        table: Table,
        database: "Database",
        csv_to_df_kwargs: Dict[str, Any],
        df_to_sql_kwargs: Dict[str, Any],
    ) -> None:
        """
        Create table from contents of a csv. Note: this method does not create
        metadata for the table.
        """
        df = cls.csv_to_df(filepath_or_buffer=filename, **csv_to_df_kwargs)
        engine = cls.get_engine(database)
        if table.schema:
            # only add schema when it is preset and non empty
            df_to_sql_kwargs["schema"] = table.schema
        if engine.dialect.supports_multivalues_insert:
            df_to_sql_kwargs["method"] = "multi"
        cls.df_to_sql(df=df, con=engine, **df_to_sql_kwargs)

    @classmethod
    def convert_dttm(cls, target_type: str, dttm: datetime) -> Optional[str]:
        """
        Convert Python datetime object to a SQL expression

        :param target_type: The target type of expression
        :param dttm: The datetime object
        :return: The SQL expression
        """
        return None

    @classmethod
    def create_table_from_excel(  # pylint: disable=too-many-arguments
        cls,
        filename: str,
        table: Table,
        database: "Database",
        excel_to_df_kwargs: Dict[str, Any],
        df_to_sql_kwargs: Dict[str, Any],
    ) -> None:
        """
        Create table from contents of a excel. Note: this method does not create
        metadata for the table.
        """
        df = pd.read_excel(io=filename, **excel_to_df_kwargs)
        engine = cls.get_engine(database)
        if table.schema:
            # only add schema when it is preset and non empty
            df_to_sql_kwargs["schema"] = table.schema
        if engine.dialect.supports_multivalues_insert:
            df_to_sql_kwargs["method"] = "multi"
        cls.df_to_sql(df=df, con=engine, **df_to_sql_kwargs)

    @classmethod
    def get_all_datasource_names(
        cls, database: "Database", datasource_type: str
    ) -> List[utils.DatasourceName]:
        """Returns a list of all tables or views in database.

        :param database: Database instance
        :param datasource_type: Datasource_type can be 'table' or 'view'
        :return: List of all datasources in database or schema
        """
        # TODO: Fix circular import caused by importing Database
        schemas = database.get_all_schema_names(
            cache=database.schema_cache_enabled,
            cache_timeout=database.schema_cache_timeout,
            force=True,
        )
        all_datasources: List[utils.DatasourceName] = []
        for schema in schemas:
            if datasource_type == "table":
                all_datasources += database.get_all_table_names_in_schema(
                    schema=schema,
                    force=True,
                    cache=database.table_cache_enabled,
                    cache_timeout=database.table_cache_timeout,
                )
            elif datasource_type == "view":
                all_datasources += database.get_all_view_names_in_schema(
                    schema=schema,
                    force=True,
                    cache=database.table_cache_enabled,
                    cache_timeout=database.table_cache_timeout,
                )
            else:
                raise Exception(f"Unsupported datasource_type: {datasource_type}")
        return all_datasources

    @classmethod
    def handle_cursor(cls, cursor: Any, query: Query, session: Session) -> None:
        """Handle a live cursor between the execute and fetchall calls

        The flow works without this method doing anything, but it allows
        for handling the cursor and updating progress information in the
        query object"""
        # TODO: Fix circular import error caused by importing sql_lab.Query

    @classmethod
    def extract_error_message(cls, ex: Exception) -> str:
        return f"{cls.engine} error: {cls._extract_error_message(ex)}"

    @classmethod
    def _extract_error_message(cls, ex: Exception) -> str:
        """Extract error message for queries"""
        return utils.error_msg_from_exception(ex)

    @classmethod
    def extract_errors(cls, ex: Exception) -> List[Dict[str, Any]]:
        return [
            dataclasses.asdict(
                SupersetError(
                    error_type=SupersetErrorType.GENERIC_DB_ENGINE_ERROR,
                    message=cls._extract_error_message(ex),
                    level=ErrorLevel.ERROR,
                    extra={"engine_name": cls.engine_name},
                )
            )
        ]

    @classmethod
    def adjust_database_uri(cls, uri: URL, selected_schema: Optional[str]) -> None:
        """
        Mutate the database component of the SQLAlchemy URI.

        The URI here represents the URI as entered when saving the database,
        ``selected_schema`` is the schema currently active presumably in
        the SQL Lab dropdown. Based on that, for some database engine,
        we can return a new altered URI that connects straight to the
        active schema, meaning the users won't have to prefix the object
        names by the schema name.

        Some databases engines have 2 level of namespacing: database and
        schema (postgres, oracle, mssql, ...)
        For those it's probably better to not alter the database
        component of the URI with the schema name, it won't work.

        Some database drivers like presto accept '{catalog}/{schema}' in
        the database component of the URL, that can be handled here.
        """

    @classmethod
    def patch(cls) -> None:
        """
        TODO: Improve docstring and refactor implementation in Hive
        """

    @classmethod
    def get_schema_names(cls, inspector: Inspector) -> List[str]:
        """
        Get all schemas from database

        :param inspector: SqlAlchemy inspector
        :return: All schemas in the database
        """
        return sorted(inspector.get_schema_names())

    @classmethod
    def get_table_names(
        cls, database: "Database", inspector: Inspector, schema: Optional[str]
    ) -> List[str]:
        """
        Get all tables from schema

        :param inspector: SqlAlchemy inspector
        :param schema: Schema to inspect. If omitted, uses default schema for database
        :return: All tables in schema
        """
        tables = inspector.get_table_names(schema)
        if schema and cls.try_remove_schema_from_table_name:
            tables = [re.sub(f"^{schema}\\.", "", table) for table in tables]
        return sorted(tables)

    @classmethod
    def get_view_names(
        cls, database: "Database", inspector: Inspector, schema: Optional[str]
    ) -> List[str]:
        """
        Get all views from schema

        :param inspector: SqlAlchemy inspector
        :param schema: Schema name. If omitted, uses default schema for database
        :return: All views in schema
        """
        views = inspector.get_view_names(schema)
        if schema and cls.try_remove_schema_from_table_name:
            views = [re.sub(f"^{schema}\\.", "", view) for view in views]
        return sorted(views)

    @classmethod
    def get_table_comment(
        cls, inspector: Inspector, table_name: str, schema: Optional[str]
    ) -> Optional[str]:
        """
        Get comment of table from a given schema and table

        :param inspector: SqlAlchemy Inspector instance
        :param table_name: Table name
        :param schema: Schema name. If omitted, uses default schema for database
        :return: comment of table
        """
        comment = None
        try:
            comment = inspector.get_table_comment(table_name, schema)
            comment = comment.get("text") if isinstance(comment, dict) else None
        except NotImplementedError:
            # It's expected that some dialects don't implement the comment method
            pass
        except Exception as ex:  # pylint: disable=broad-except
            logger.error("Unexpected error while fetching table comment")
            logger.exception(ex)
        return comment

    @classmethod
    def get_columns(
        cls, inspector: Inspector, table_name: str, schema: Optional[str]
    ) -> List[Dict[str, Any]]:
        """
        Get all columns from a given schema and table

        :param inspector: SqlAlchemy Inspector instance
        :param table_name: Table name
        :param schema: Schema name. If omitted, uses default schema for database
        :return: All columns in table
        """
        return inspector.get_columns(table_name, schema)

    @classmethod
    def where_latest_partition(  # pylint: disable=too-many-arguments
        cls,
        table_name: str,
        schema: Optional[str],
        database: "Database",
        query: Select,
        columns: Optional[List[Dict[str, str]]] = None,
    ) -> Optional[Select]:
        """
        Add a where clause to a query to reference only the most recent partition

        :param table_name: Table name
        :param schema: Schema name
        :param database: Database instance
        :param query: SqlAlchemy query
        :param columns: List of TableColumns
        :return: SqlAlchemy query with additional where clause referencing latest
        partition
        """
        # TODO: Fix circular import caused by importing Database, TableColumn
        return None

    @classmethod
    def _get_fields(cls, cols: List[Dict[str, Any]]) -> List[Any]:
        return [column(c["name"]) for c in cols]

    @classmethod
    def select_star(  # pylint: disable=too-many-arguments,too-many-locals
        cls,
        database: "Database",
        table_name: str,
        engine: Engine,
        schema: Optional[str] = None,
        limit: int = 100,
        show_cols: bool = False,
        indent: bool = True,
        latest_partition: bool = True,
        cols: Optional[List[Dict[str, Any]]] = None,
    ) -> str:
        """
        Generate a "SELECT * from [schema.]table_name" query with appropriate limit.

        WARNING: expects only unquoted table and schema names.

        :param database: Database instance
        :param table_name: Table name, unquoted
        :param engine: SqlALchemy Engine instance
        :param schema: Schema, unquoted
        :param limit: limit to impose on query
        :param show_cols: Show columns in query; otherwise use "*"
        :param indent: Add indentation to query
        :param latest_partition: Only query latest partition
        :param cols: Columns to include in query
        :return: SQL query
        """
        fields: Union[str, List[Any]] = "*"
        cols = cols or []
        if (show_cols or latest_partition) and not cols:
            cols = database.get_columns(table_name, schema)

        if show_cols:
            fields = cls._get_fields(cols)
        quote = engine.dialect.identifier_preparer.quote
        if schema:
            full_table_name = quote(schema) + "." + quote(table_name)
        else:
            full_table_name = quote(table_name)

        qry = select(fields).select_from(text(full_table_name))

        if limit:
            qry = qry.limit(limit)
        if latest_partition:
            partition_query = cls.where_latest_partition(
                table_name, schema, database, qry, columns=cols
            )
            if partition_query is not None:
                qry = partition_query
        sql = database.compile_sqla_query(qry)
        if indent:
            sql = sqlparse.format(sql, reindent=True)
        return sql

    @classmethod
    def estimate_statement_cost(
        cls, statement: str, database: "Database", cursor: Any, user_name: str
    ) -> Dict[str, Any]:
        """
        Generate a SQL query that estimates the cost of a given statement.

        :param statement: A single SQL statement
        :param database: Database instance
        :param cursor: Cursor instance
        :param username: Effective username
        :return: Dictionary with different costs
        """
        raise Exception("Database does not support cost estimation")

    @classmethod
    def query_cost_formatter(
        cls, raw_cost: List[Dict[str, Any]]
    ) -> List[Dict[str, str]]:
        """
        Format cost estimate.

        :param raw_cost: Raw estimate from `estimate_query_cost`
        :return: Human readable cost estimate
        """
        raise Exception("Database does not support cost estimation")

    @classmethod
    def estimate_query_cost(
        cls, database: "Database", schema: str, sql: str, source: Optional[str] = None
    ) -> List[Dict[str, str]]:
        """
        Estimate the cost of a multiple statement SQL query.

        :param database: Database instance
        :param schema: Database schema
        :param sql: SQL query with possibly multiple statements
        :param source: Source of the query (eg, "sql_lab")
        """
        database_version = database.get_extra().get("version")
        if not cls.get_allow_cost_estimate(database_version):
            raise Exception("Database does not support cost estimation")

        user_name = g.user.username if g.user else None
        parsed_query = sql_parse.ParsedQuery(sql)
        statements = parsed_query.get_statements()

        engine = cls.get_engine(database, schema=schema, source=source)
        costs = []
        with closing(engine.raw_connection()) as conn:
            with closing(conn.cursor()) as cursor:
                for statement in statements:
                    costs.append(
                        cls.estimate_statement_cost(
                            statement, database, cursor, user_name
                        )
                    )
        return costs

    @classmethod
    def modify_url_for_impersonation(
        cls, url: URL, impersonate_user: bool, username: Optional[str]
    ) -> None:
        """
        Modify the SQL Alchemy URL object with the user to impersonate if applicable.
        :param url: SQLAlchemy URL object
        :param impersonate_user: Flag indicating if impersonation is enabled
        :param username: Effective username
        """
        if impersonate_user and username is not None:
            url.username = username

    @classmethod
    def get_configuration_for_impersonation(  # pylint: disable=invalid-name
        cls, uri: str, impersonate_user: bool, username: Optional[str]
    ) -> Dict[str, str]:
        """
        Return a configuration dictionary that can be merged with other configs
        that can set the correct properties for impersonating users

        :param uri: URI
        :param impersonate_user: Flag indicating if impersonation is enabled
        :param username: Effective username
        :return: Configs required for impersonation
        """
        return {}

    @classmethod
    def execute(cls, cursor: Any, query: str, **kwargs: Any) -> None:
        """
        Execute a SQL query

        :param cursor: Cursor instance
        :param query: Query to execute
        :param kwargs: kwargs to be passed to cursor.execute()
        :return:
        """
        if cls.arraysize:
            cursor.arraysize = cls.arraysize
        cursor.execute(query)

    @classmethod
    def make_label_compatible(cls, label: str) -> Union[str, quoted_name]:
        """
        Conditionally mutate and/or quote a sqlalchemy expression label. If
        force_column_alias_quotes is set to True, return the label as a
        sqlalchemy.sql.elements.quoted_name object to ensure that the select query
        and query results have same case. Otherwise return the mutated label as a
        regular string. If maxmimum supported column name length is exceeded,
        generate a truncated label by calling truncate_label().

        :param label: expected expression label/alias
        :return: conditionally mutated label supported by the db engine
        """
        label_mutated = cls._mutate_label(label)
        if (
            cls.max_column_name_length
            and len(label_mutated) > cls.max_column_name_length
        ):
            label_mutated = cls._truncate_label(label)
        if cls.force_column_alias_quotes:
            label_mutated = quoted_name(label_mutated, True)
        return label_mutated

    @classmethod
    def get_sqla_column_type(cls, type_: Optional[str]) -> Optional[TypeEngine]:
        """
        Return a sqlalchemy native column type that corresponds to the column type
        defined in the data source (return None to use default type inferred by
        SQLAlchemy). Override `column_type_mappings` for specific needs
        (see MSSQL for example of NCHAR/NVARCHAR handling).

        :param type_: Column type returned by inspector
        :return: SqlAlchemy column type
        """
        if not type_:
            return None
        for regex, sqla_type in cls.column_type_mappings:
            match = regex.match(type_)
            if match:
                if callable(sqla_type):
                    return sqla_type(match)
                return sqla_type
        return None

    @staticmethod
    def _mutate_label(label: str) -> str:
        """
        Most engines support mixed case aliases that can include numbers
        and special characters, like commas, parentheses etc. For engines that
        have restrictions on what types of aliases are supported, this method
        can be overridden to ensure that labels conform to the engine's
        limitations. Mutated labels should be deterministic (input label A always
        yields output label X) and unique (input labels A and B don't yield the same
        output label X).

        :param label: Preferred expression label
        :return: Conditionally mutated label
        """
        return label

    @classmethod
    def _truncate_label(cls, label: str) -> str:
        """
        In the case that a label exceeds the max length supported by the engine,
        this method is used to construct a deterministic and unique label based on
        the original label. By default this returns an md5 hash of the original label,
        conditionally truncated if the length of the hash exceeds the max column length
        of the engine.

        :param label: Expected expression label
        :return: Truncated label
        """
        label = hashlib.md5(label.encode("utf-8")).hexdigest()
        # truncate hash if it exceeds max length
        if cls.max_column_name_length and len(label) > cls.max_column_name_length:
            label = label[: cls.max_column_name_length]
        return label

    @classmethod
    def column_datatype_to_string(
        cls, sqla_column_type: TypeEngine, dialect: Dialect
    ) -> str:
        """
        Convert sqlalchemy column type to string representation.
        By default removes collation and character encoding info to avoid unnecessarily
        long datatypes.

        :param sqla_column_type: SqlAlchemy column type
        :param dialect: Sqlalchemy dialect
        :return: Compiled column type
        """
        sqla_column_type = sqla_column_type.copy()
        if hasattr(sqla_column_type, "collation"):
            sqla_column_type.collation = None
        if hasattr(sqla_column_type, "charset"):
            sqla_column_type.charset = None
        return sqla_column_type.compile(dialect=dialect).upper()

    @classmethod
    def get_function_names(cls, database: "Database") -> List[str]:
        """
        Get a list of function names that are able to be called on the database.
        Used for SQL Lab autocomplete.

        :param database: The database to get functions for
        :return: A list of function names useable in the database
        """
        return []

    @staticmethod
    def pyodbc_rows_to_tuples(data: List[Any]) -> List[Tuple[Any, ...]]:
        """
        Convert pyodbc.Row objects from `fetch_data` to tuples.

        :param data: List of tuples or pyodbc.Row objects
        :return: List of tuples
        """
        if data and type(data[0]).__name__ == "Row":
            data = [tuple(row) for row in data]
        return data

    @staticmethod
    def mutate_db_for_connection_test(database: "Database") -> None:
        """
        Some databases require passing additional parameters for validating database
        connections. This method makes it possible to mutate the database instance prior
        to testing if a connection is ok.

        :param database: instance to be mutated
        """
        return None

    @staticmethod
    def get_extra_params(database: "Database") -> Dict[str, Any]:
        """
        Some databases require adding elements to connection parameters,
        like passing certificates to `extra`. This can be done here.

        :param database: database instance from which to extract extras
        :raises CertificateException: If certificate is not valid/unparseable
        """
        extra: Dict[str, Any] = {}
        if database.extra:
            try:
                extra = json.loads(database.extra)
            except json.JSONDecodeError as ex:
                logger.error(ex)
                raise ex
        return extra
