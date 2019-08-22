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
from datetime import datetime
import hashlib
import os
import re
from typing import Any, Dict, List, NamedTuple, Optional, Tuple, Union

from flask import g
from flask_babel import lazy_gettext as _
import pandas as pd
from sqlalchemy import column, DateTime, select
from sqlalchemy.engine import create_engine
from sqlalchemy.engine.base import Engine
from sqlalchemy.engine.interfaces import Compiled, Dialect
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql import quoted_name, text
from sqlalchemy.sql.expression import ColumnClause, ColumnElement, Select, TextAsFrom
from sqlalchemy.types import TypeEngine
import sqlparse
from werkzeug.utils import secure_filename

from superset import app, db, sql_parse
from superset.utils import core as utils


class TimeGrain(NamedTuple):
    name: str  # TODO: redundant field, remove
    label: str
    function: str
    duration: Optional[str]


config = app.config


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


class TimestampExpression(ColumnClause):
    def __init__(self, expr: str, col: ColumnClause, **kwargs):
        """Sqlalchemy class that can be can be used to render native column elements
        respeting engine-specific quoting rules as part of a string-based expression.

        :param expr: Sql expression with '{col}' denoting the locations where the col
        object will be rendered.
        :param col: the target column
        """
        super().__init__(expr, **kwargs)
        self.col = col

    @property
    def _constructor(self):
        # Needed to ensure that the column label is rendered correctly when
        # proxied to the outer query.
        # See https://github.com/sqlalchemy/sqlalchemy/issues/4730
        return ColumnClause


@compiles(TimestampExpression)
def compile_timegrain_expression(
    element: TimestampExpression, compiler: Compiled, **kw
) -> str:
    return element.name.replace("{col}", compiler.process(element.col, **kw))


class LimitMethod(object):
    """Enum the ways that limits can be applied"""

    FETCH_MANY = "fetch_many"
    WRAP_SQL = "wrap_sql"
    FORCE_LIMIT = "force_limit"


def _create_time_grains_tuple(
    time_grains: Dict[Optional[str], str],
    time_grain_functions: Dict[Optional[str], str],
    blacklist: List[str],
) -> Tuple[TimeGrain, ...]:
    """
    function for creating a tuple of time grains based on time grains provided by
    the engine and any potential additional or blacklisted grains in the config file.

    :param time_grains: all time grains supported by the engine + config files
    :param time_grain_functions: mapping between time grain id and sql expression
    :param blacklist: list of time grain ids to be excluded
    :return: final collection of time grains
    """
    ret_list = []
    blacklist = blacklist if blacklist else []
    for duration, func in time_grain_functions.items():
        if duration in time_grains and duration not in blacklist:
            name = time_grains[duration]
            ret_list.append(TimeGrain(name, _(name), func, duration))
    return tuple(ret_list)


class BaseEngineSpec:
    """Abstract class for database engine specific configurations"""

    engine = "base"  # str as defined in sqlalchemy.engine.engine
    time_grain_functions: Dict[Optional[str], str] = {}
    time_groupby_inline = False
    limit_method = LimitMethod.FORCE_LIMIT
    time_secondary_columns = False
    allows_joins = True
    allows_subqueries = True
    allows_column_aliases = True
    force_column_alias_quotes = False
    arraysize = 0
    max_column_name_length = 0
    try_remove_schema_from_table_name = True

    @classmethod
    def get_timestamp_expr(
        cls, col: ColumnClause, pdf: Optional[str], time_grain: Optional[str]
    ) -> TimestampExpression:
        """
        Construct a TimestampExpression to be used in a SQLAlchemy query.

        :param col: Target column for the TimestampExpression
        :param pdf: date format (seconds or milliseconds)
        :param time_grain: time grain, e.g. P1Y for 1 year
        :return: TimestampExpression object
        """
        if time_grain:
            time_expr = cls.time_grain_functions.get(time_grain)
            if not time_expr:
                raise NotImplementedError(
                    f"No grain spec for {time_grain} for database {cls.engine}"
                )
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
        Generate a tuple of time grains based on time grains provided by the engine
        and any potential additional or blacklisted grains in the config file.

        :return: All time grains supported by the engine
        """
        blacklist: List[str] = config.get("TIME_GRAIN_BLACKLIST", [])
        supported_grains = builtin_time_grains.copy()
        supported_grains.update(config.get("TIME_GRAIN_ADDONS", {}))
        grain_functions = cls.time_grain_functions.copy()
        grain_addon_functions = config.get("TIME_GRAIN_ADDON_FUNCTIONS", {})
        grain_functions.update(grain_addon_functions.get(cls.engine, {}))
        return _create_time_grains_tuple(supported_grains, grain_functions, blacklist)

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
    def fetch_data(cls, cursor, limit: int) -> List[Tuple]:
        """

        :param cursor: Cursor instance
        :param limit: Maximum number of rows to be returned by the cursor
        :return: Result of query
        """
        if cls.arraysize:
            cursor.arraysize = cls.arraysize
        if cls.limit_method == LimitMethod.FETCH_MANY:
            return cursor.fetchmany(limit)
        return cursor.fetchall()

    @classmethod
    def expand_data(
        cls, columns: List[dict], data: List[dict]
    ) -> Tuple[List[dict], List[dict], List[dict]]:
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
    def alter_new_orm_column(cls, orm_col):
        """Allow altering default column attributes when first detected/added

        For instance special column like `__time` for Druid can be
        set to is_dttm=True. Note that this only gets called when new
        columns are detected/created"""
        # TODO: Fix circular import caused by importing TableColumn
        pass

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
        if isinstance(type_code, str) and len(type_code):
            return type_code.upper()
        return None

    @classmethod
    def extra_table_metadata(
        cls, database, table_name: str, schema_name: str
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
    def apply_limit_to_sql(cls, sql: str, limit: int, database) -> str:
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
        elif LimitMethod.FORCE_LIMIT:
            parsed_query = sql_parse.ParsedQuery(sql)
            sql = parsed_query.get_query_with_new_limit(limit)
        return sql

    @classmethod
    def get_limit_from_sql(cls, sql: str) -> int:
        """
        Extract limit from SQL query

        :param sql: SQL query
        :return: Value of limit clause in query
        """
        parsed_query = sql_parse.ParsedQuery(sql)
        return parsed_query.limit

    @classmethod
    def get_query_with_new_limit(cls, sql: str, limit: int) -> str:
        """
        Create a query based on original query but with new limit clause

        :param sql: SQL query
        :param limit: New limit to insert/replace into query
        :return: Query with new limit
        """
        parsed_query = sql_parse.ParsedQuery(sql)
        return parsed_query.get_query_with_new_limit(limit)

    @staticmethod
    def csv_to_df(**kwargs) -> pd.DataFrame:
        """ Read csv into Pandas DataFrame
        :param kwargs: params to be passed to DataFrame.read_csv
        :return: Pandas DataFrame containing data from csv
        """
        kwargs["filepath_or_buffer"] = (
            config["UPLOAD_FOLDER"] + kwargs["filepath_or_buffer"]
        )
        kwargs["encoding"] = "utf-8"
        kwargs["iterator"] = True
        chunks = pd.read_csv(**kwargs)
        df = pd.concat(chunk for chunk in chunks)
        return df

    @classmethod
    def df_to_sql(cls, df: pd.DataFrame, **kwargs):
        """ Upload data from a Pandas DataFrame to a database. For
        regular engines this calls the DataFrame.to_sql() method. Can be
        overridden for engines that don't work well with to_sql(), e.g.
        BigQuery.
        :param df: Dataframe with data to be uploaded
        :param kwargs: kwargs to be passed to to_sql() method
        """
        df.to_sql(**kwargs)

    @classmethod
    def create_table_from_csv(cls, form, table):
        """ Create table (including metadata in backend) from contents of a csv.
        :param form: Parameters defining how to process data
        :param table: Metadata of new table to be created
        """

        def _allowed_file(filename: str) -> bool:
            # Only allow specific file extensions as specified in the config
            extension = os.path.splitext(filename)[1]
            return (
                extension is not None and extension[1:] in config["ALLOWED_EXTENSIONS"]
            )

        filename = secure_filename(form.csv_file.data.filename)
        if not _allowed_file(filename):
            raise Exception("Invalid file type selected")
        csv_to_df_kwargs = {
            "filepath_or_buffer": filename,
            "sep": form.sep.data,
            "header": form.header.data if form.header.data else 0,
            "index_col": form.index_col.data,
            "mangle_dupe_cols": form.mangle_dupe_cols.data,
            "skipinitialspace": form.skipinitialspace.data,
            "skiprows": form.skiprows.data,
            "nrows": form.nrows.data,
            "skip_blank_lines": form.skip_blank_lines.data,
            "parse_dates": form.parse_dates.data,
            "infer_datetime_format": form.infer_datetime_format.data,
            "chunksize": 10000,
        }
        df = cls.csv_to_df(**csv_to_df_kwargs)

        df_to_sql_kwargs = {
            "df": df,
            "name": form.name.data,
            "con": create_engine(form.con.data.sqlalchemy_uri_decrypted, echo=False),
            "schema": form.schema.data,
            "if_exists": form.if_exists.data,
            "index": form.index.data,
            "index_label": form.index_label.data,
            "chunksize": 10000,
        }
        cls.df_to_sql(**df_to_sql_kwargs)

        table.user_id = g.user.id
        table.schema = form.schema.data
        table.fetch_metadata()
        db.session.add(table)
        db.session.commit()

    @classmethod
    def convert_dttm(cls, target_type: str, dttm: datetime) -> str:
        """
        Convert DateTime object to sql expression

        :param target_type: Target type of expression
        :param dttm: DateTime object
        :return: SQL expression
        """
        return "'{}'".format(dttm.strftime("%Y-%m-%d %H:%M:%S"))

    @classmethod
    def get_all_datasource_names(
        cls, db, datasource_type: str
    ) -> List[utils.DatasourceName]:
        """Returns a list of all tables or views in database.

        :param db: Database instance
        :param datasource_type: Datasource_type can be 'table' or 'view'
        :return: List of all datasources in database or schema
        """
        # TODO: Fix circular import caused by importing Database
        schemas = db.get_all_schema_names(
            cache=db.schema_cache_enabled,
            cache_timeout=db.schema_cache_timeout,
            force=True,
        )
        all_datasources: List[utils.DatasourceName] = []
        for schema in schemas:
            if datasource_type == "table":
                all_datasources += db.get_all_table_names_in_schema(
                    schema=schema,
                    force=True,
                    cache=db.table_cache_enabled,
                    cache_timeout=db.table_cache_timeout,
                )
            elif datasource_type == "view":
                all_datasources += db.get_all_view_names_in_schema(
                    schema=schema,
                    force=True,
                    cache=db.table_cache_enabled,
                    cache_timeout=db.table_cache_timeout,
                )
            else:
                raise Exception(f"Unsupported datasource_type: {datasource_type}")
        return all_datasources

    @classmethod
    def handle_cursor(cls, cursor, query, session):
        """Handle a live cursor between the execute and fetchall calls

        The flow works without this method doing anything, but it allows
        for handling the cursor and updating progress information in the
        query object"""
        # TODO: Fix circular import error caused by importing sql_lab.Query
        pass

    @classmethod
    def extract_error_message(cls, e: Exception) -> str:
        """Extract error message for queries"""
        return utils.error_msg_from_exception(e)

    @classmethod
    def adjust_database_uri(cls, uri, selected_schema: str):
        """Based on a URI and selected schema, return a new URI

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
        # TODO: All overrides mutate input uri; should be renamed or refactored
        return uri

    @classmethod
    def patch(cls):
        """
        TODO: Improve docstring and refactor implementation in Hive
        """
        pass

    @classmethod
    def get_schema_names(cls, inspector: Inspector) -> List[str]:
        """
        Get all schemas from database

        :param inspector: SqlAlchemy inspector
        :return: All schemas in the database
        """
        return sorted(inspector.get_schema_names())

    @classmethod
    def get_table_names(cls, inspector: Inspector, schema: Optional[str]) -> List[str]:
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
    def get_view_names(cls, inspector: Inspector, schema: Optional[str]) -> List[str]:
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
    def where_latest_partition(
        cls,
        table_name: str,
        schema: Optional[str],
        database,
        query: Select,
        columns: Optional[List] = None,
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
    def _get_fields(cls, cols):
        return [column(c.get("name")) for c in cols]

    @classmethod
    def select_star(
        cls,
        database,
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

        :param database: Database instance
        :param table_name: Table name
        :param engine: SqlALchemy Engine instance
        :param schema: Schema
        :param limit: limit to impose on query
        :param show_cols: Show columns in query; otherwise use "*"
        :param indent: Add indentation to query
        :param latest_partition: Only query latest partition
        :param cols: Columns to include in query
        :return: SQL query
        """
        fields = "*"
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
    def modify_url_for_impersonation(cls, url, impersonate_user: bool, username: str):
        """
        Modify the SQL Alchemy URL object with the user to impersonate if applicable.
        :param url: SQLAlchemy URL object
        :param impersonate_user: Flag indicating if impersonation is enabled
        :param username: Effective username
        """
        if impersonate_user is not None and username is not None:
            url.username = username

    @classmethod
    def get_configuration_for_impersonation(
        cls, uri: str, impersonate_user: bool, username: str
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
    def execute(cls, cursor, query: str, **kwargs):
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
    def get_sqla_column_type(cls, type_: str) -> Optional[TypeEngine]:
        """
        Return a sqlalchemy native column type that corresponds to the column type
        defined in the data source (return None to use default type inferred by
        SQLAlchemy). Needs to be overridden if column requires special handling
        (see MSSQL for example of NCHAR/NVARCHAR handling).

        :param type_: Column type returned by inspector
        :return: SqlAlchemy column type
        """
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
        Convert sqlalchemy column type to string representation. Can be overridden to remove
        unnecessary details, especially collation info (see mysql, mssql).

        :param sqla_column_type: SqlAlchemy column type
        :param dialect: Sqlalchemy dialect
        :return: Compiled column type
        """
        return sqla_column_type.compile(dialect=dialect).upper()
