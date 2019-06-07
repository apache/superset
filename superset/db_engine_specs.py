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
"""Compatibility layer for different database engines

This modules stores logic specific to different database engines. Things
like time-related functions that are similar but not identical, or
information as to expose certain features or not and how to expose them.

For instance, Hive/Presto supports partitions and have a specific API to
list partitions. Other databases like Vertica also support partitions but
have different API to get to them. Other databases don't support partitions
at all. The classes here will use a common interface to specify all this.

The general idea is to use static classes and an inheritance scheme.
"""
from collections import namedtuple, OrderedDict
import hashlib
import inspect
import logging
import os
import re
import textwrap
import time
from typing import Dict, List, Optional, Set, Tuple
from urllib import parse

from flask import g
from flask_babel import lazy_gettext as _
import pandas
import sqlalchemy as sqla
from sqlalchemy import Column, DateTime, select, types
from sqlalchemy.engine import create_engine
from sqlalchemy.engine.base import Engine
from sqlalchemy.engine.reflection import Inspector
from sqlalchemy.engine.result import RowProxy
from sqlalchemy.engine.url import make_url
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.sql import quoted_name, text
from sqlalchemy.sql.expression import ColumnClause
from sqlalchemy.sql.expression import TextAsFrom
from sqlalchemy.types import String, UnicodeText
import sqlparse
from werkzeug.utils import secure_filename

from superset import app, conf, db, sql_parse
from superset.exceptions import SupersetTemplateException
from superset.models.sql_types.presto_sql_types import type_map as presto_type_map
from superset.utils import core as utils

QueryStatus = utils.QueryStatus
config = app.config

tracking_url_trans = conf.get('TRACKING_URL_TRANSFORMER')
hive_poll_interval = conf.get('HIVE_POLL_INTERVAL')

Grain = namedtuple('Grain', 'name label function duration')

builtin_time_grains = {
    None: 'Time Column',
    'PT1S': 'second',
    'PT1M': 'minute',
    'PT5M': '5 minute',
    'PT10M': '10 minute',
    'PT15M': '15 minute',
    'PT0.5H': 'half hour',
    'PT1H': 'hour',
    'P1D': 'day',
    'P1W': 'week',
    'P1M': 'month',
    'P0.25Y': 'quarter',
    'P1Y': 'year',
    '1969-12-28T00:00:00Z/P1W': 'week_start_sunday',
    '1969-12-29T00:00:00Z/P1W': 'week_start_monday',
    'P1W/1970-01-03T00:00:00Z': 'week_ending_saturday',
    'P1W/1970-01-04T00:00:00Z': 'week_ending_sunday',
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


@compiles(TimestampExpression)
def compile_timegrain_expression(element: TimestampExpression, compiler, **kw):
    return element.name.replace('{col}', compiler.process(element.col, **kw))


def _create_time_grains_tuple(time_grains, time_grain_functions, blacklist):
    ret_list = []
    blacklist = blacklist if blacklist else []
    for duration, func in time_grain_functions.items():
        if duration not in blacklist:
            name = time_grains.get(duration)
            ret_list.append(Grain(name, _(name), func, duration))
    return tuple(ret_list)


class LimitMethod(object):
    """Enum the ways that limits can be applied"""
    FETCH_MANY = 'fetch_many'
    WRAP_SQL = 'wrap_sql'
    FORCE_LIMIT = 'force_limit'


class BaseEngineSpec(object):

    """Abstract class for database engine specific configurations"""

    engine = 'base'  # str as defined in sqlalchemy.engine.engine
    time_grain_functions: Dict[Optional[str], str] = {}
    time_groupby_inline = False
    limit_method = LimitMethod.FORCE_LIMIT
    time_secondary_columns = False
    inner_joins = True
    allows_subquery = True
    supports_column_aliases = True
    force_column_alias_quotes = False
    arraysize = 0
    max_column_name_length = 0
    try_remove_schema_from_table_name = True

    @classmethod
    def get_timestamp_expr(cls, col: ColumnClause, pdf: Optional[str],
                           time_grain: Optional[str]) -> TimestampExpression:
        """
        Construct a TimeExpression to be used in a SQLAlchemy query.

        :param col: Target column for the TimeExpression
        :param pdf: date format (seconds or milliseconds)
        :param time_grain: time grain, e.g. P1Y for 1 year
        :return: TimestampExpression object
        """
        if time_grain:
            time_expr = cls.time_grain_functions.get(time_grain)
            if not time_expr:
                raise NotImplementedError(
                    f'No grain spec for {time_grain} for database {cls.engine}')
        else:
            time_expr = '{col}'

        # if epoch, translate to DATE using db specific conf
        if pdf == 'epoch_s':
            time_expr = time_expr.replace('{col}', cls.epoch_to_dttm())
        elif pdf == 'epoch_ms':
            time_expr = time_expr.replace('{col}', cls.epoch_ms_to_dttm())

        return TimestampExpression(time_expr, col, type_=DateTime)

    @classmethod
    def get_time_grains(cls):
        blacklist = config.get('TIME_GRAIN_BLACKLIST', [])
        grains = builtin_time_grains.copy()
        grains.update(config.get('TIME_GRAIN_ADDONS', {}))
        grain_functions = cls.time_grain_functions.copy()
        grain_addon_functions = config.get('TIME_GRAIN_ADDON_FUNCTIONS', {})
        grain_functions.update(grain_addon_functions.get(cls.engine, {}))
        return _create_time_grains_tuple(grains, grain_functions, blacklist)

    @classmethod
    def make_select_compatible(cls, groupby_exprs, select_exprs):
        # Some databases will just return the group-by field into the select, but don't
        # allow the group-by field to be put into the select list.
        return select_exprs

    @classmethod
    def fetch_data(cls, cursor, limit):
        if cls.arraysize:
            cursor.arraysize = cls.arraysize
        if cls.limit_method == LimitMethod.FETCH_MANY:
            return cursor.fetchmany(limit)
        return cursor.fetchall()

    @classmethod
    def expand_data(cls,
                    columns: List[dict],
                    data: List[dict]) -> Tuple[List[dict], List[dict], List[dict]]:
        return columns, data, []

    @classmethod
    def alter_new_orm_column(cls, orm_col):
        """Allow altering default column attributes when first detected/added

        For instance special column like `__time` for Druid can be
        set to is_dttm=True. Note that this only gets called when new
        columns are detected/created"""
        pass

    @classmethod
    def epoch_to_dttm(cls):
        raise NotImplementedError()

    @classmethod
    def epoch_ms_to_dttm(cls):
        return cls.epoch_to_dttm().replace('{col}', '({col}/1000)')

    @classmethod
    def get_datatype(cls, type_code):
        if isinstance(type_code, str) and len(type_code):
            return type_code.upper()

    @classmethod
    def extra_table_metadata(cls, database, table_name, schema_name):
        """Returns engine-specific table metadata"""
        return {}

    @classmethod
    def apply_limit_to_sql(cls, sql, limit, database):
        """Alters the SQL statement to apply a LIMIT clause"""
        if cls.limit_method == LimitMethod.WRAP_SQL:
            sql = sql.strip('\t\n ;')
            qry = (
                select('*')
                .select_from(
                    TextAsFrom(text(sql), ['*']).alias('inner_qry'),
                )
                .limit(limit)
            )
            return database.compile_sqla_query(qry)
        elif LimitMethod.FORCE_LIMIT:
            parsed_query = sql_parse.ParsedQuery(sql)
            sql = parsed_query.get_query_with_new_limit(limit)
        return sql

    @classmethod
    def get_limit_from_sql(cls, sql):
        parsed_query = sql_parse.ParsedQuery(sql)
        return parsed_query.limit

    @classmethod
    def get_query_with_new_limit(cls, sql, limit):
        parsed_query = sql_parse.ParsedQuery(sql)
        return parsed_query.get_query_with_new_limit(limit)

    @staticmethod
    def csv_to_df(**kwargs):
        kwargs['filepath_or_buffer'] = \
            config['UPLOAD_FOLDER'] + kwargs['filepath_or_buffer']
        kwargs['encoding'] = 'utf-8'
        kwargs['iterator'] = True
        chunks = pandas.read_csv(**kwargs)
        df = pandas.DataFrame()
        df = pandas.concat(chunk for chunk in chunks)
        return df

    @staticmethod
    def df_to_db(df, table, **kwargs):
        df.to_sql(**kwargs)
        table.user_id = g.user.id
        table.schema = kwargs['schema']
        table.fetch_metadata()
        db.session.add(table)
        db.session.commit()

    @staticmethod
    def create_table_from_csv(form, table):
        def _allowed_file(filename):
            # Only allow specific file extensions as specified in the config
            extension = os.path.splitext(filename)[1]
            return extension and extension[1:] in config['ALLOWED_EXTENSIONS']

        filename = secure_filename(form.csv_file.data.filename)
        if not _allowed_file(filename):
            raise Exception('Invalid file type selected')
        kwargs = {
            'filepath_or_buffer': filename,
            'sep': form.sep.data,
            'header': form.header.data if form.header.data else 0,
            'index_col': form.index_col.data,
            'mangle_dupe_cols': form.mangle_dupe_cols.data,
            'skipinitialspace': form.skipinitialspace.data,
            'skiprows': form.skiprows.data,
            'nrows': form.nrows.data,
            'skip_blank_lines': form.skip_blank_lines.data,
            'parse_dates': form.parse_dates.data,
            'infer_datetime_format': form.infer_datetime_format.data,
            'chunksize': 10000,
        }
        df = BaseEngineSpec.csv_to_df(**kwargs)

        df_to_db_kwargs = {
            'table': table,
            'df': df,
            'name': form.name.data,
            'con': create_engine(form.con.data.sqlalchemy_uri_decrypted, echo=False),
            'schema': form.schema.data,
            'if_exists': form.if_exists.data,
            'index': form.index.data,
            'index_label': form.index_label.data,
            'chunksize': 10000,
        }

        BaseEngineSpec.df_to_db(**df_to_db_kwargs)

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        return "'{}'".format(dttm.strftime('%Y-%m-%d %H:%M:%S'))

    @classmethod
    def get_all_datasource_names(cls, db, datasource_type: str) \
            -> List[utils.DatasourceName]:
        """Returns a list of all tables or views in database.

        :param db: Database instance
        :param datasource_type: Datasource_type can be 'table' or 'view'
        :return: List of all datasources in database or schema
        """
        schemas = db.get_all_schema_names(cache=db.schema_cache_enabled,
                                          cache_timeout=db.schema_cache_timeout,
                                          force=True)
        all_datasources: List[utils.DatasourceName] = []
        for schema in schemas:
            if datasource_type == 'table':
                all_datasources += db.get_all_table_names_in_schema(
                    schema=schema, force=True,
                    cache=db.table_cache_enabled,
                    cache_timeout=db.table_cache_timeout)
            elif datasource_type == 'view':
                all_datasources += db.get_all_view_names_in_schema(
                    schema=schema, force=True,
                    cache=db.table_cache_enabled,
                    cache_timeout=db.table_cache_timeout)
            else:
                raise Exception(f'Unsupported datasource_type: {datasource_type}')
        return all_datasources

    @classmethod
    def handle_cursor(cls, cursor, query, session):
        """Handle a live cursor between the execute and fetchall calls

        The flow works without this method doing anything, but it allows
        for handling the cursor and updating progress information in the
        query object"""
        pass

    @classmethod
    def extract_error_message(cls, e):
        """Extract error message for queries"""
        return utils.error_msg_from_exception(e)

    @classmethod
    def adjust_database_uri(cls, uri, selected_schema):
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
        return uri

    @classmethod
    def patch(cls):
        pass

    @classmethod
    def get_schema_names(cls, inspector):
        return sorted(inspector.get_schema_names())

    @classmethod
    def get_table_names(cls, inspector, schema):
        tables = inspector.get_table_names(schema)
        if schema and cls.try_remove_schema_from_table_name:
            tables = [re.sub(f'^{schema}\\.', '', table) for table in tables]
        return sorted(tables)

    @classmethod
    def get_view_names(cls, inspector, schema):
        views = inspector.get_view_names(schema)
        if schema and cls.try_remove_schema_from_table_name:
            views = [re.sub(f'^{schema}\\.', '', view) for view in views]
        return sorted(views)

    @classmethod
    def get_columns(cls, inspector: Inspector, table_name: str, schema: str) -> list:
        return inspector.get_columns(table_name, schema)

    @classmethod
    def where_latest_partition(
            cls, table_name, schema, database, qry, columns=None):
        return False

    @classmethod
    def _get_fields(cls, cols):
        return [sqla.column(c.get('name')) for c in cols]

    @classmethod
    def select_star(cls, my_db, table_name, engine, schema=None, limit=100,
                    show_cols=False, indent=True, latest_partition=True,
                    cols=None):
        fields = '*'
        cols = cols or []
        if (show_cols or latest_partition) and not cols:
            cols = my_db.get_columns(table_name, schema)

        if show_cols:
            fields = cls._get_fields(cols)
        quote = engine.dialect.identifier_preparer.quote
        if schema:
            full_table_name = quote(schema) + '.' + quote(table_name)
        else:
            full_table_name = quote(table_name)

        qry = select(fields).select_from(text(full_table_name))

        if limit:
            qry = qry.limit(limit)
        if latest_partition:
            partition_query = cls.where_latest_partition(
                table_name, schema, my_db, qry, columns=cols)
            if partition_query != False:  # noqa
                qry = partition_query
        sql = my_db.compile_sqla_query(qry)
        if indent:
            sql = sqlparse.format(sql, reindent=True)
        return sql

    @classmethod
    def modify_url_for_impersonation(cls, url, impersonate_user, username):
        """
        Modify the SQL Alchemy URL object with the user to impersonate if applicable.
        :param url: SQLAlchemy URL object
        :param impersonate_user: Bool indicating if impersonation is enabled
        :param username: Effective username
        """
        if impersonate_user is not None and username is not None:
            url.username = username

    @classmethod
    def get_configuration_for_impersonation(cls, uri, impersonate_user, username):
        """
        Return a configuration dictionary that can be merged with other configs
        that can set the correct properties for impersonating users
        :param uri: URI string
        :param impersonate_user: Bool indicating if impersonation is enabled
        :param username: Effective username
        :return: Dictionary with configs required for impersonation
        """
        return {}

    @classmethod
    def execute(cls, cursor, query, **kwargs):
        if cls.arraysize:
            cursor.arraysize = cls.arraysize
        cursor.execute(query)

    @classmethod
    def make_label_compatible(cls, label):
        """
        Conditionally mutate and/or quote a sql column/expression label. If
        force_column_alias_quotes is set to True, return the label as a
        sqlalchemy.sql.elements.quoted_name object to ensure that the select query
        and query results have same case. Otherwise return the mutated label as a
        regular string. If maxmimum supported column name length is exceeded,
        generate a truncated label by calling truncate_label().
        """
        label_mutated = cls.mutate_label(label)
        if cls.max_column_name_length and len(label_mutated) > cls.max_column_name_length:
            label_mutated = cls.truncate_label(label)
        if cls.force_column_alias_quotes:
            label_mutated = quoted_name(label_mutated, True)
        return label_mutated

    @classmethod
    def get_sqla_column_type(cls, type_):
        """
        Return a sqlalchemy native column type that corresponds to the column type
        defined in the data source (optional). Needs to be overridden if column requires
        special handling (see MSSQL for example of NCHAR/NVARCHAR handling).
        """
        return None

    @staticmethod
    def mutate_label(label):
        """
        Most engines support mixed case aliases that can include numbers
        and special characters, like commas, parentheses etc. For engines that
        have restrictions on what types of aliases are supported, this method
        can be overridden to ensure that labels conform to the engine's
        limitations. Mutated labels should be deterministic (input label A always
        yields output label X) and unique (input labels A and B don't yield the same
        output label X).
        """
        return label

    @classmethod
    def truncate_label(cls, label):
        """
        In the case that a label exceeds the max length supported by the engine,
        this method is used to construct a deterministic and unique label based on
        an md5 hash.
        """
        label = hashlib.md5(label.encode('utf-8')).hexdigest()
        # truncate hash if it exceeds max length
        if cls.max_column_name_length and len(label) > cls.max_column_name_length:
            label = label[:cls.max_column_name_length]
        return label

    @classmethod
    def column_datatype_to_string(cls, sqla_column_type, dialect):
        return sqla_column_type.compile(dialect=dialect).upper()


class PostgresBaseEngineSpec(BaseEngineSpec):
    """ Abstract class for Postgres 'like' databases """

    engine = ''

    time_grain_functions = {
        None: '{col}',
        'PT1S': "DATE_TRUNC('second', {col})",
        'PT1M': "DATE_TRUNC('minute', {col})",
        'PT1H': "DATE_TRUNC('hour', {col})",
        'P1D': "DATE_TRUNC('day', {col})",
        'P1W': "DATE_TRUNC('week', {col})",
        'P1M': "DATE_TRUNC('month', {col})",
        'P0.25Y': "DATE_TRUNC('quarter', {col})",
        'P1Y': "DATE_TRUNC('year', {col})",
    }

    @classmethod
    def fetch_data(cls, cursor, limit):
        if not cursor.description:
            return []
        if cls.limit_method == LimitMethod.FETCH_MANY:
            return cursor.fetchmany(limit)
        return cursor.fetchall()

    @classmethod
    def epoch_to_dttm(cls):
        return "(timestamp 'epoch' + {col} * interval '1 second')"

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        return "'{}'".format(dttm.strftime('%Y-%m-%d %H:%M:%S'))


class PostgresEngineSpec(PostgresBaseEngineSpec):
    engine = 'postgresql'
    max_column_name_length = 63
    try_remove_schema_from_table_name = False

    @classmethod
    def get_table_names(cls, inspector, schema):
        """Need to consider foreign tables for PostgreSQL"""
        tables = inspector.get_table_names(schema)
        tables.extend(inspector.get_foreign_table_names(schema))
        return sorted(tables)


class SnowflakeEngineSpec(PostgresBaseEngineSpec):
    engine = 'snowflake'
    force_column_alias_quotes = True
    max_column_name_length = 256

    time_grain_functions = {
        None: '{col}',
        'PT1S': "DATE_TRUNC('SECOND', {col})",
        'PT1M': "DATE_TRUNC('MINUTE', {col})",
        'PT5M': "DATEADD(MINUTE, FLOOR(DATE_PART(MINUTE, {col}) / 5) * 5, \
                DATE_TRUNC('HOUR', {col}))",
        'PT10M': "DATEADD(MINUTE, FLOOR(DATE_PART(MINUTE, {col}) / 10) * 10, \
                 DATE_TRUNC('HOUR', {col}))",
        'PT15M': "DATEADD(MINUTE, FLOOR(DATE_PART(MINUTE, {col}) / 15) * 15, \
                 DATE_TRUNC('HOUR', {col}))",
        'PT0.5H': "DATEADD(MINUTE, FLOOR(DATE_PART(MINUTE, {col}) / 30) * 30, \
                  DATE_TRUNC('HOUR', {col}))",
        'PT1H': "DATE_TRUNC('HOUR', {col})",
        'P1D': "DATE_TRUNC('DAY', {col})",
        'P1W': "DATE_TRUNC('WEEK', {col})",
        'P1M': "DATE_TRUNC('MONTH', {col})",
        'P0.25Y': "DATE_TRUNC('QUARTER', {col})",
        'P1Y': "DATE_TRUNC('YEAR', {col})",
    }

    @classmethod
    def adjust_database_uri(cls, uri, selected_schema=None):
        database = uri.database
        if '/' in uri.database:
            database = uri.database.split('/')[0]
        if selected_schema:
            selected_schema = parse.quote(selected_schema, safe='')
            uri.database = database + '/' + selected_schema
        return uri


class VerticaEngineSpec(PostgresBaseEngineSpec):
    engine = 'vertica'


class RedshiftEngineSpec(PostgresBaseEngineSpec):
    engine = 'redshift'
    max_column_name_length = 127

    @staticmethod
    def mutate_label(label):
        """
        Redshift only supports lowercase column names and aliases.
        :param str label: Original label which might include uppercase letters
        :return: String that is supported by the database
        """
        return label.lower()


class OracleEngineSpec(PostgresBaseEngineSpec):
    engine = 'oracle'
    limit_method = LimitMethod.WRAP_SQL
    force_column_alias_quotes = True
    max_column_name_length = 30

    time_grain_functions = {
        None: '{col}',
        'PT1S': 'CAST({col} as DATE)',
        'PT1M': "TRUNC(CAST({col} as DATE), 'MI')",
        'PT1H': "TRUNC(CAST({col} as DATE), 'HH')",
        'P1D': "TRUNC(CAST({col} as DATE), 'DDD')",
        'P1W': "TRUNC(CAST({col} as DATE), 'WW')",
        'P1M': "TRUNC(CAST({col} as DATE), 'MONTH')",
        'P0.25Y': "TRUNC(CAST({col} as DATE), 'Q')",
        'P1Y': "TRUNC(CAST({col} as DATE), 'YEAR')",
    }

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        return (
            """TO_TIMESTAMP('{}', 'YYYY-MM-DD"T"HH24:MI:SS.ff6')"""
        ).format(dttm.isoformat())


class Db2EngineSpec(BaseEngineSpec):
    engine = 'ibm_db_sa'
    limit_method = LimitMethod.WRAP_SQL
    force_column_alias_quotes = True
    max_column_name_length = 30

    time_grain_functions = {
        None: '{col}',
        'PT1S': 'CAST({col} as TIMESTAMP)'
                ' - MICROSECOND({col}) MICROSECONDS',
        'PT1M': 'CAST({col} as TIMESTAMP)'
                ' - SECOND({col}) SECONDS'
                ' - MICROSECOND({col}) MICROSECONDS',
        'PT1H': 'CAST({col} as TIMESTAMP)'
                ' - MINUTE({col}) MINUTES'
                ' - SECOND({col}) SECONDS'
                ' - MICROSECOND({col}) MICROSECONDS ',
        'P1D': 'CAST({col} as TIMESTAMP)'
               ' - HOUR({col}) HOURS'
               ' - MINUTE({col}) MINUTES'
               ' - SECOND({col}) SECONDS'
               ' - MICROSECOND({col}) MICROSECONDS',
        'P1W': '{col} - (DAYOFWEEK({col})) DAYS',
        'P1M': '{col} - (DAY({col})-1) DAYS',
        'P0.25Y': '{col} - (DAY({col})-1) DAYS'
                  ' - (MONTH({col})-1) MONTHS'
                  ' + ((QUARTER({col})-1) * 3) MONTHS',
        'P1Y': '{col} - (DAY({col})-1) DAYS'
               ' - (MONTH({col})-1) MONTHS',
    }

    @classmethod
    def epoch_to_dttm(cls):
        return "(TIMESTAMP('1970-01-01', '00:00:00') + {col} SECONDS)"

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        return "'{}'".format(dttm.strftime('%Y-%m-%d-%H.%M.%S'))


class SqliteEngineSpec(BaseEngineSpec):
    engine = 'sqlite'

    time_grain_functions = {
        None: '{col}',
        'PT1H': "DATETIME(STRFTIME('%Y-%m-%dT%H:00:00', {col}))",
        'P1D': 'DATE({col})',
        'P1W': "DATE({col}, -strftime('%W', {col}) || ' days')",
        'P1M': "DATE({col}, -strftime('%d', {col}) || ' days', '+1 day')",
        'P1Y': "DATETIME(STRFTIME('%Y-01-01T00:00:00', {col}))",
        'P1W/1970-01-03T00:00:00Z': "DATE({col}, 'weekday 6')",
        '1969-12-28T00:00:00Z/P1W': "DATE({col}, 'weekday 0', '-7 days')",
    }

    @classmethod
    def epoch_to_dttm(cls):
        return "datetime({col}, 'unixepoch')"

    @classmethod
    def get_all_datasource_names(cls, db, datasource_type: str) \
            -> List[utils.DatasourceName]:
        schemas = db.get_all_schema_names(cache=db.schema_cache_enabled,
                                          cache_timeout=db.schema_cache_timeout,
                                          force=True)
        schema = schemas[0]
        if datasource_type == 'table':
            return db.get_all_table_names_in_schema(
                schema=schema, force=True,
                cache=db.table_cache_enabled,
                cache_timeout=db.table_cache_timeout)
        elif datasource_type == 'view':
            return db.get_all_view_names_in_schema(
                schema=schema, force=True,
                cache=db.table_cache_enabled,
                cache_timeout=db.table_cache_timeout)
        else:
            raise Exception(f'Unsupported datasource_type: {datasource_type}')

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        iso = dttm.isoformat().replace('T', ' ')
        if '.' not in iso:
            iso += '.000000'
        return "'{}'".format(iso)

    @classmethod
    def get_table_names(cls, inspector, schema):
        """Need to disregard the schema for Sqlite"""
        return sorted(inspector.get_table_names())


class DrillEngineSpec(BaseEngineSpec):
    """Engine spec for Apache Drill"""
    engine = 'drill'

    time_grain_functions = {
        None: '{col}',
        'PT1S': "NEARESTDATE({col}, 'SECOND')",
        'PT1M': "NEARESTDATE({col}, 'MINUTE')",
        'PT15M': "NEARESTDATE({col}, 'QUARTER_HOUR')",
        'PT0.5H': "NEARESTDATE({col}, 'HALF_HOUR')",
        'PT1H': "NEARESTDATE({col}, 'HOUR')",
        'P1D': "NEARESTDATE({col}, 'DAY')",
        'P1W': "NEARESTDATE({col}, 'WEEK_SUNDAY')",
        'P1M': "NEARESTDATE({col}, 'MONTH')",
        'P0.25Y': "NEARESTDATE({col}, 'QUARTER')",
        'P1Y': "NEARESTDATE({col}, 'YEAR')",
    }

    # Returns a function to convert a Unix timestamp in milliseconds to a date
    @classmethod
    def epoch_to_dttm(cls):
        return cls.epoch_ms_to_dttm().replace('{col}', '({col}*1000)')

    @classmethod
    def epoch_ms_to_dttm(cls):
        return 'TO_DATE({col})'

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        tt = target_type.upper()
        if tt == 'DATE':
            return "CAST('{}' AS DATE)".format(dttm.isoformat()[:10])
        elif tt == 'TIMESTAMP':
            return "CAST('{}' AS TIMESTAMP)".format(
                dttm.strftime('%Y-%m-%d %H:%M:%S'))
        return "'{}'".format(dttm.strftime('%Y-%m-%d %H:%M:%S'))

    @classmethod
    def adjust_database_uri(cls, uri, selected_schema):
        if selected_schema:
            uri.database = parse.quote(selected_schema, safe='')
        return uri


class MySQLEngineSpec(BaseEngineSpec):
    engine = 'mysql'
    max_column_name_length = 64

    time_grain_functions = {
        None: '{col}',
        'PT1S': 'DATE_ADD(DATE({col}), '
              'INTERVAL (HOUR({col})*60*60 + MINUTE({col})*60'
              ' + SECOND({col})) SECOND)',
        'PT1M': 'DATE_ADD(DATE({col}), '
              'INTERVAL (HOUR({col})*60 + MINUTE({col})) MINUTE)',
        'PT1H': 'DATE_ADD(DATE({col}), '
              'INTERVAL HOUR({col}) HOUR)',
        'P1D': 'DATE({col})',
        'P1W': 'DATE(DATE_SUB({col}, '
              'INTERVAL DAYOFWEEK({col}) - 1 DAY))',
        'P1M': 'DATE(DATE_SUB({col}, '
              'INTERVAL DAYOFMONTH({col}) - 1 DAY))',
        'P0.25Y': 'MAKEDATE(YEAR({col}), 1) '
              '+ INTERVAL QUARTER({col}) QUARTER - INTERVAL 1 QUARTER',
        'P1Y': 'DATE(DATE_SUB({col}, '
              'INTERVAL DAYOFYEAR({col}) - 1 DAY))',
        '1969-12-29T00:00:00Z/P1W': 'DATE(DATE_SUB({col}, '
              'INTERVAL DAYOFWEEK(DATE_SUB({col}, INTERVAL 1 DAY)) - 1 DAY))',
    }

    type_code_map: Dict[int, str] = {}  # loaded from get_datatype only if needed

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        if target_type.upper() in ('DATETIME', 'DATE'):
            return "STR_TO_DATE('{}', '%Y-%m-%d %H:%i:%s')".format(
                dttm.strftime('%Y-%m-%d %H:%M:%S'))
        return "'{}'".format(dttm.strftime('%Y-%m-%d %H:%M:%S'))

    @classmethod
    def adjust_database_uri(cls, uri, selected_schema=None):
        if selected_schema:
            uri.database = parse.quote(selected_schema, safe='')
        return uri

    @classmethod
    def get_datatype(cls, type_code):
        if not cls.type_code_map:
            # only import and store if needed at least once
            import MySQLdb
            ft = MySQLdb.constants.FIELD_TYPE
            cls.type_code_map = {
                getattr(ft, k): k
                for k in dir(ft)
                if not k.startswith('_')
            }
        datatype = type_code
        if isinstance(type_code, int):
            datatype = cls.type_code_map.get(type_code)
        if datatype and isinstance(datatype, str) and len(datatype):
            return datatype

    @classmethod
    def epoch_to_dttm(cls):
        return 'from_unixtime({col})'

    @classmethod
    def extract_error_message(cls, e):
        """Extract error message for queries"""
        message = str(e)
        try:
            if isinstance(e.args, tuple) and len(e.args) > 1:
                message = e.args[1]
        except Exception:
            pass
        return message

    @classmethod
    def column_datatype_to_string(cls, sqla_column_type, dialect):
        datatype = super().column_datatype_to_string(sqla_column_type, dialect)
        # MySQL dialect started returning long overflowing datatype
        # as in 'VARCHAR(255) COLLATE UTF8MB4_GENERAL_CI'
        # and we don't need the verbose collation type
        str_cutoff = ' COLLATE '
        if str_cutoff in datatype:
            datatype = datatype.split(str_cutoff)[0]
        return datatype


class PrestoEngineSpec(BaseEngineSpec):
    engine = 'presto'

    time_grain_functions = {
        None: '{col}',
        'PT1S': "date_trunc('second', CAST({col} AS TIMESTAMP))",
        'PT1M': "date_trunc('minute', CAST({col} AS TIMESTAMP))",
        'PT1H': "date_trunc('hour', CAST({col} AS TIMESTAMP))",
        'P1D': "date_trunc('day', CAST({col} AS TIMESTAMP))",
        'P1W': "date_trunc('week', CAST({col} AS TIMESTAMP))",
        'P1M': "date_trunc('month', CAST({col} AS TIMESTAMP))",
        'P0.25Y': "date_trunc('quarter', CAST({col} AS TIMESTAMP))",
        'P1Y': "date_trunc('year', CAST({col} AS TIMESTAMP))",
        'P1W/1970-01-03T00:00:00Z':
            "date_add('day', 5, date_trunc('week', date_add('day', 1, \
            CAST({col} AS TIMESTAMP))))",
        '1969-12-28T00:00:00Z/P1W':
            "date_add('day', -1, date_trunc('week', \
            date_add('day', 1, CAST({col} AS TIMESTAMP))))",
    }

    @classmethod
    def get_view_names(cls, inspector, schema):
        """Returns an empty list

        get_table_names() function returns all table names and view names,
        and get_view_names() is not implemented in sqlalchemy_presto.py
        https://github.com/dropbox/PyHive/blob/e25fc8440a0686bbb7a5db5de7cb1a77bdb4167a/pyhive/sqlalchemy_presto.py
        """
        return []

    @classmethod
    def _create_column_info(cls, name: str, data_type: str) -> dict:
        """
        Create column info object
        :param name: column name
        :param data_type: column data type
        :return: column info object
        """
        return {
            'name': name,
            'type': f'{data_type}',
        }

    @classmethod
    def _get_full_name(cls, names: List[Tuple[str, str]]) -> str:
        """
        Get the full column name
        :param names: list of all individual column names
        :return: full column name
        """
        return '.'.join(column[0] for column in names if column[0])

    @classmethod
    def _has_nested_data_types(cls, component_type: str) -> bool:
        """
        Check if string contains a data type. We determine if there is a data type by
        whitespace or multiple data types by commas
        :param component_type: data type
        :return: boolean
        """
        comma_regex = r',(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)'
        white_space_regex = r'\s(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)'
        return re.search(comma_regex, component_type) is not None \
            or re.search(white_space_regex, component_type) is not None

    @classmethod
    def _split_data_type(cls, data_type: str, delimiter: str) -> List[str]:
        """
        Split data type based on given delimiter. Do not split the string if the
        delimiter is enclosed in quotes
        :param data_type: data type
        :param delimiter: string separator (i.e. open parenthesis, closed parenthesis,
               comma, whitespace)
        :return: list of strings after breaking it by the delimiter
        """
        return re.split(
            r'{}(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)'.format(delimiter), data_type)

    @classmethod
    def _parse_structural_column(cls,
                                 parent_column_name: str,
                                 parent_data_type: str,
                                 result: List[dict]) -> None:
        """
        Parse a row or array column
        :param result: list tracking the results
        """
        formatted_parent_column_name = parent_column_name
        # Quote the column name if there is a space
        if ' ' in parent_column_name:
            formatted_parent_column_name = f'"{parent_column_name}"'
        full_data_type = f'{formatted_parent_column_name} {parent_data_type}'
        original_result_len = len(result)
        # split on open parenthesis ( to get the structural
        # data type and its component types
        data_types = cls._split_data_type(full_data_type, r'\(')
        stack: List[Tuple[str, str]] = []
        for data_type in data_types:
            # split on closed parenthesis ) to track which component
            # types belong to what structural data type
            inner_types = cls._split_data_type(data_type, r'\)')
            for inner_type in inner_types:
                # We have finished parsing multiple structural data types
                if not inner_type and len(stack) > 0:
                    stack.pop()
                elif cls._has_nested_data_types(inner_type):
                    # split on comma , to get individual data types
                    single_fields = cls._split_data_type(inner_type, ',')
                    for single_field in single_fields:
                        single_field = single_field.strip()
                        # If component type starts with a comma, the first single field
                        # will be an empty string. Disregard this empty string.
                        if not single_field:
                            continue
                        # split on whitespace to get field name and data type
                        field_info = cls._split_data_type(single_field, r'\s')
                        # check if there is a structural data type within
                        # overall structural data type
                        if field_info[1] == 'array' or field_info[1] == 'row':
                            stack.append((field_info[0], field_info[1]))
                            full_parent_path = cls._get_full_name(stack)
                            result.append(cls._create_column_info(
                                full_parent_path,
                                presto_type_map[field_info[1]]()))
                        else:  # otherwise this field is a basic data type
                            full_parent_path = cls._get_full_name(stack)
                            column_name = '{}.{}'.format(full_parent_path, field_info[0])
                            result.append(cls._create_column_info(
                                column_name, presto_type_map[field_info[1]]()))
                    # If the component type ends with a structural data type, do not pop
                    # the stack. We have run across a structural data type within the
                    # overall structural data type. Otherwise, we have completely parsed
                    # through the entire structural data type and can move on.
                    if not (inner_type.endswith('array') or inner_type.endswith('row')):
                        stack.pop()
                # We have an array of row objects (i.e. array(row(...)))
                elif 'array' == inner_type or 'row' == inner_type:
                    # Push a dummy object to represent the structural data type
                    stack.append(('', inner_type))
                # We have an array of a basic data types(i.e. array(varchar)).
                elif len(stack) > 0:
                    # Because it is an array of a basic data type. We have finished
                    # parsing the structural data type and can move on.
                    stack.pop()
        # Unquote the column name if necessary
        if formatted_parent_column_name != parent_column_name:
            for index in range(original_result_len, len(result)):
                result[index]['name'] = result[index]['name'].replace(
                    formatted_parent_column_name, parent_column_name)

    @classmethod
    def _show_columns(
            cls, inspector: Inspector, table_name: str, schema: str) -> List[RowProxy]:
        """
        Show presto column names
        :param inspector: object that performs database schema inspection
        :param table_name: table name
        :param schema: schema name
        :return: list of column objects
        """
        quote = inspector.engine.dialect.identifier_preparer.quote_identifier
        full_table = quote(table_name)
        if schema:
            full_table = '{}.{}'.format(quote(schema), full_table)
        columns = inspector.bind.execute('SHOW COLUMNS FROM {}'.format(full_table))
        return columns

    @classmethod
    def get_columns(
            cls, inspector: Inspector, table_name: str, schema: str) -> List[dict]:
        """
        Get columns from a Presto data source. This includes handling row and
        array data types
        :param inspector: object that performs database schema inspection
        :param table_name: table name
        :param schema: schema name
        :return: a list of results that contain column info
                (i.e. column name and data type)
        """
        columns = cls._show_columns(inspector, table_name, schema)
        result: List[dict] = []
        for column in columns:
            try:
                # parse column if it is a row or array
                if 'array' in column.Type or 'row' in column.Type:
                    structural_column_index = len(result)
                    cls._parse_structural_column(column.Column, column.Type, result)
                    result[structural_column_index]['nullable'] = getattr(
                        column, 'Null', True)
                    result[structural_column_index]['default'] = None
                    continue
                else:  # otherwise column is a basic data type
                    column_type = presto_type_map[column.Type]()
            except KeyError:
                logging.info('Did not recognize type {} of column {}'.format(
                    column.Type, column.Column))
                column_type = types.NullType
            column_info = cls._create_column_info(column.Column, column_type)
            column_info['nullable'] = getattr(column, 'Null', True)
            column_info['default'] = None
            result.append(column_info)
        return result

    @classmethod
    def _is_column_name_quoted(cls, column_name: str) -> bool:
        """
        Check if column name is in quotes
        :param column_name: column name
        :return: boolean
        """
        return column_name.startswith('"') and column_name.endswith('"')

    @classmethod
    def _get_fields(cls, cols: List[dict]) -> List[ColumnClause]:
        """
        Format column clauses where names are in quotes and labels are specified
        :param cols: columns
        :return: column clauses
        """
        column_clauses = []
        # Column names are separated by periods. This regex will find periods in a string
        # if they are not enclosed in quotes because if a period is enclosed in quotes,
        # then that period is part of a column name.
        dot_pattern = r"""\.                # split on period
                          (?=               # look ahead
                          (?:               # create non-capture group
                          [^\"]*\"[^\"]*\"  # two quotes
                          )*[^\"]*$)        # end regex"""
        dot_regex = re.compile(dot_pattern, re.VERBOSE)
        for col in cols:
            # get individual column names
            col_names = re.split(dot_regex, col['name'])
            # quote each column name if it is not already quoted
            for index, col_name in enumerate(col_names):
                if not cls._is_column_name_quoted(col_name):
                    col_names[index] = '"{}"'.format(col_name)
            quoted_col_name = '.'.join(
                col_name if cls._is_column_name_quoted(col_name) else f'"{col_name}"'
                for col_name in col_names)
            # create column clause in the format "name"."name" AS "name.name"
            column_clause = sqla.literal_column(quoted_col_name).label(col['name'])
            column_clauses.append(column_clause)
        return column_clauses

    @classmethod
    def _filter_out_array_nested_cols(
            cls, cols: List[dict]) -> Tuple[List[dict], List[dict]]:
        """
        Filter out columns that correspond to array content. We know which columns to
        skip because cols is a list provided to us in a specific order where a structural
        column is positioned right before its content.

        Example: Column Name: ColA, Column Data Type: array(row(nest_obj int))
                 cols = [ ..., ColA, ColA.nest_obj, ... ]

        When we run across an array, check if subsequent column names start with the
        array name and skip them.
        :param cols: columns
        :return: filtered list of columns and list of array columns and its nested fields
        """
        filtered_cols = []
        array_cols = []
        curr_array_col_name = None
        for col in cols:
            # col corresponds to an array's content and should be skipped
            if curr_array_col_name and col['name'].startswith(curr_array_col_name):
                array_cols.append(col)
                continue
            # col is an array so we need to check if subsequent
            # columns correspond to the array's contents
            elif str(col['type']) == 'ARRAY':
                curr_array_col_name = col['name']
                array_cols.append(col)
                filtered_cols.append(col)
            else:
                curr_array_col_name = None
                filtered_cols.append(col)
        return filtered_cols, array_cols

    @classmethod
    def select_star(cls, my_db, table_name: str, engine: Engine, schema: str = None,
                    limit: int = 100, show_cols: bool = False, indent: bool = True,
                    latest_partition: bool = True, cols: List[dict] = []) -> str:
        """
        Include selecting properties of row objects. We cannot easily break arrays into
        rows, so render the whole array in its own row and skip columns that correspond
        to an array's contents.
        """
        presto_cols = cols
        if show_cols:
            dot_regex = r'\.(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)'
            presto_cols = [
                col for col in presto_cols if not re.search(dot_regex, col['name'])]
        return super(PrestoEngineSpec, cls).select_star(
            my_db, table_name, engine, schema, limit,
            show_cols, indent, latest_partition, presto_cols,
        )

    @classmethod
    def adjust_database_uri(cls, uri, selected_schema=None):
        database = uri.database
        if selected_schema and database:
            selected_schema = parse.quote(selected_schema, safe='')
            if '/' in database:
                database = database.split('/')[0] + '/' + selected_schema
            else:
                database += '/' + selected_schema
            uri.database = database
        return uri

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        tt = target_type.upper()
        if tt == 'DATE':
            return "from_iso8601_date('{}')".format(dttm.isoformat()[:10])
        if tt == 'TIMESTAMP':
            return "from_iso8601_timestamp('{}')".format(dttm.isoformat())
        if tt == 'BIGINT':
            return "to_unixtime(from_iso8601_timestamp('{}'))".format(dttm.isoformat())
        return "'{}'".format(dttm.strftime('%Y-%m-%d %H:%M:%S'))

    @classmethod
    def epoch_to_dttm(cls):
        return 'from_unixtime({col})'

    @classmethod
    def get_all_datasource_names(cls, db, datasource_type: str) \
            -> List[utils.DatasourceName]:
        datasource_df = db.get_df(
            """SELECT table_schema, table_name FROM INFORMATION_SCHEMA.{}S
               ORDER BY concat(table_schema, '.', table_name)""".format(
                datasource_type.upper(),
            ),
            None)
        datasource_names: List[utils.DatasourceName] = []
        for unused, row in datasource_df.iterrows():
            datasource_names.append(utils.DatasourceName(
                schema=row['table_schema'], table=row['table_name']))
        return datasource_names

    @classmethod
    def _build_column_hierarchy(cls,
                                columns: List[dict],
                                parent_column_types: List[str],
                                column_hierarchy: dict) -> None:
        """
        Build a graph where the root node represents a column whose data type is in
        parent_column_types. A node's children represent that column's nested fields
        :param columns: list of columns
        :param parent_column_types: list of data types that decide what columns can
               be root nodes
        :param column_hierarchy: dictionary representing the graph
        """
        if len(columns) == 0:
            return
        root = columns.pop(0)
        root_info = {'type': root['type'], 'children': []}
        column_hierarchy[root['name']] = root_info
        while columns:
            column = columns[0]
            # If the column name does not start with the root's name,
            # then this column is not a nested field
            if not column['name'].startswith(f"{root['name']}."):
                break
            # If the column's data type is one of the parent types,
            # then this column may have nested fields
            if str(column['type']) in parent_column_types:
                cls._build_column_hierarchy(columns, parent_column_types,
                                            column_hierarchy)
                root_info['children'].append(column['name'])
                continue
            else:  # The column is a nested field
                root_info['children'].append(column['name'])
                columns.pop(0)

    @classmethod
    def _create_row_and_array_hierarchy(
            cls, selected_columns: List[dict]) -> Tuple[dict, dict, List[dict]]:
        """
        Build graphs where the root node represents a row or array and its children
        are that column's nested fields
        :param selected_columns: columns selected in a query
        :return: graph representing a row, graph representing an array, and a list
                 of all the nested fields
        """
        row_column_hierarchy: OrderedDict = OrderedDict()
        array_column_hierarchy: OrderedDict = OrderedDict()
        expanded_columns: List[dict] = []
        for column in selected_columns:
            if column['type'].startswith('ROW'):
                parsed_row_columns: List[dict] = []
                cls._parse_structural_column(column['name'],
                                             column['type'].lower(),
                                             parsed_row_columns)
                expanded_columns = expanded_columns + parsed_row_columns[1:]
                filtered_row_columns, array_columns = cls._filter_out_array_nested_cols(
                    parsed_row_columns)
                cls._build_column_hierarchy(filtered_row_columns,
                                            ['ROW'],
                                            row_column_hierarchy)
                cls._build_column_hierarchy(array_columns,
                                            ['ROW', 'ARRAY'],
                                            array_column_hierarchy)
            elif column['type'].startswith('ARRAY'):
                parsed_array_columns: List[dict] = []
                cls._parse_structural_column(column['name'],
                                             column['type'].lower(),
                                             parsed_array_columns)
                expanded_columns = expanded_columns + parsed_array_columns[1:]
                cls._build_column_hierarchy(parsed_array_columns,
                                            ['ROW', 'ARRAY'],
                                            array_column_hierarchy)
        return row_column_hierarchy, array_column_hierarchy, expanded_columns

    @classmethod
    def _create_empty_row_of_data(cls, columns: List[dict]) -> dict:
        """
        Create an empty row of data
        :param columns: list of columns
        :return: dictionary representing an empty row of data
        """
        return {column['name']: '' for column in columns}

    @classmethod
    def _expand_row_data(cls, datum: dict, column: str, column_hierarchy: dict) -> None:
        """
        Separate out nested fields and its value in a row of data
        :param datum: row of data
        :param column: row column name
        :param column_hierarchy: dictionary tracking structural columns and its
               nested fields
        """
        if column in datum:
            row_data = datum[column]
            row_children = column_hierarchy[column]['children']
            if row_data and len(row_data) != len(row_children):
                raise Exception('The number of data values and number of nested'
                                'fields are not equal')
            elif row_data:
                for index, data_value in enumerate(row_data):
                    datum[row_children[index]] = data_value
            else:
                for row_child in row_children:
                    datum[row_child] = ''

    @classmethod
    def _split_array_columns_by_process_state(
            cls, array_columns: List[str],
            array_column_hierarchy: dict,
            datum: dict) -> Tuple[List[str], Set[str]]:
        """
        Take a list of array columns and split them according to whether or not we are
        ready to process them from a data set
        :param array_columns: list of array columns
        :param array_column_hierarchy: graph representing array columns
        :param datum: row of data
        :return: list of array columns ready to be processed and set of array columns
                 not ready to be processed
        """
        array_columns_to_process = []
        unprocessed_array_columns = set()
        child_array = None
        for array_column in array_columns:
            if array_column in datum:
                array_columns_to_process.append(array_column)
            elif str(array_column_hierarchy[array_column]['type']) == 'ARRAY':
                child_array = array_column
                unprocessed_array_columns.add(child_array)
            elif child_array and array_column.startswith(child_array):
                unprocessed_array_columns.add(array_column)
        return array_columns_to_process, unprocessed_array_columns

    @classmethod
    def _convert_data_list_to_array_data_dict(
            cls, data: List[dict], array_columns_to_process: List[str]) -> dict:
        """
        Pull out array data from rows of data into a dictionary where the key represents
        the index in the data list and the value is the array data values
        Example:
          data = [
              {'ColumnA': [1, 2], 'ColumnB': 3},
              {'ColumnA': [11, 22], 'ColumnB': 3}
          ]
          data dictionary = {
              0: [{'ColumnA': [1, 2]],
              1: [{'ColumnA': [11, 22]]
          }
        :param data: rows of data
        :param array_columns_to_process: array columns we want to pull out
        :return: data dictionary
        """
        array_data_dict = {}
        for data_index, datum in enumerate(data):
            all_array_datum = {}
            for array_column in array_columns_to_process:
                all_array_datum[array_column] = datum[array_column]
            array_data_dict[data_index] = [all_array_datum]
        return array_data_dict

    @classmethod
    def _process_array_data(cls,
                            data: List[dict],
                            all_columns: List[dict],
                            array_column_hierarchy: dict) -> dict:
        """
        Pull out array data that is ready to be processed into a dictionary.
        The key refers to the index in the original data set. The value is
        a list of data values. Initially this list will contain just one value,
        the row of data that corresponds to the index in the original data set.
        As we process arrays, we will pull out array values into separate rows
        and append them to the list of data values.
        Example:
          Original data set = [
              {'ColumnA': [1, 2], 'ColumnB': [3]},
              {'ColumnA': [11, 22], 'ColumnB': [33]}
          ]
          all_array_data (intially) = {
              0: [{'ColumnA': [1, 2], 'ColumnB': [3}],
              1: [{'ColumnA': [11, 22], 'ColumnB': [33]}]
          }
          all_array_data (after processing) = {
              0: [
                  {'ColumnA': 1, 'ColumnB': 3},
                  {'ColumnA': 2, 'ColumnB': ''},
              ],
              1: [
                  {'ColumnA': 11, 'ColumnB': 33},
                  {'ColumnA': 22, 'ColumnB': ''},
              ],
          }
        :param data: rows of data
        :param all_columns: list of columns
        :param array_column_hierarchy: graph representing array columns
        :return: dictionary representing processed array data
        """
        array_columns = list(array_column_hierarchy.keys())
        # Determine what columns are ready to be processed. This is necessary for
        # array columns that contain rows with nested arrays. We first process
        # the outer arrays before processing inner arrays.
        array_columns_to_process, \
            unprocessed_array_columns = cls._split_array_columns_by_process_state(
                array_columns, array_column_hierarchy, data[0])

        # Pull out array data that is ready to be processed into a dictionary.
        all_array_data = cls._convert_data_list_to_array_data_dict(
            data, array_columns_to_process)

        for original_data_index, expanded_array_data in all_array_data.items():
            for array_column in array_columns:
                if array_column in unprocessed_array_columns:
                    continue
                # Expand array values that are rows
                if str(array_column_hierarchy[array_column]['type']) == 'ROW':
                    for array_value in expanded_array_data:
                        cls._expand_row_data(array_value,
                                             array_column,
                                             array_column_hierarchy)
                    continue
                array_data = expanded_array_data[0][array_column]
                array_children = array_column_hierarchy[array_column]
                # This is an empty array of primitive data type
                if not array_data and not array_children['children']:
                    continue
                # Pull out complex array values into its own row of data
                elif array_data and array_children['children']:
                    for array_index, data_value in enumerate(array_data):
                        if array_index >= len(expanded_array_data):
                            empty_data = cls._create_empty_row_of_data(all_columns)
                            expanded_array_data.append(empty_data)
                        for index, datum_value in enumerate(data_value):
                            array_child = array_children['children'][index]
                            expanded_array_data[array_index][array_child] = datum_value
                # Pull out primitive array values into its own row of data
                elif array_data:
                    for array_index, data_value in enumerate(array_data):
                        if array_index >= len(expanded_array_data):
                            empty_data = cls._create_empty_row_of_data(all_columns)
                            expanded_array_data.append(empty_data)
                        expanded_array_data[array_index][array_column] = data_value
                # This is an empty array with nested fields
                else:
                    for index, array_child in enumerate(array_children['children']):
                        for array_value in expanded_array_data:
                            array_value[array_child] = ''
        return all_array_data

    @classmethod
    def _consolidate_array_data_into_data(cls,
                                          data: List[dict],
                                          array_data: dict) -> None:
        """
        Consolidate data given a list representing rows of data and a dictionary
        representing expanded array data
        Example:
          Original data set = [
              {'ColumnA': [1, 2], 'ColumnB': [3]},
              {'ColumnA': [11, 22], 'ColumnB': [33]}
          ]
          array_data = {
              0: [
                  {'ColumnA': 1, 'ColumnB': 3},
                  {'ColumnA': 2, 'ColumnB': ''},
              ],
              1: [
                  {'ColumnA': 11, 'ColumnB': 33},
                  {'ColumnA': 22, 'ColumnB': ''},
              ],
          }
          Final data set = [
               {'ColumnA': 1, 'ColumnB': 3},
               {'ColumnA': 2, 'ColumnB': ''},
               {'ColumnA': 11, 'ColumnB': 33},
               {'ColumnA': 22, 'ColumnB': ''},
          ]
        :param data: list representing rows of data
        :param array_data: dictionary representing expanded array data
        :return: list where data and array_data are combined
        """
        data_index = 0
        original_data_index = 0
        while data_index < len(data):
            data[data_index].update(array_data[original_data_index][0])
            array_data[original_data_index].pop(0)
            data[data_index + 1:data_index + 1] = array_data[original_data_index]
            data_index = data_index + len(array_data[original_data_index]) + 1
            original_data_index = original_data_index + 1

    @classmethod
    def _remove_processed_array_columns(cls,
                                        unprocessed_array_columns: Set[str],
                                        array_column_hierarchy: dict) -> None:
        """
        Remove keys representing array columns that have already been processed
        :param unprocessed_array_columns: list of unprocessed array columns
        :param array_column_hierarchy: graph representing array columns
        """
        array_columns = list(array_column_hierarchy.keys())
        for array_column in array_columns:
            if array_column in unprocessed_array_columns:
                continue
            else:
                del array_column_hierarchy[array_column]

    @classmethod
    def expand_data(cls,
                    columns: List[dict],
                    data: List[dict]) -> Tuple[List[dict], List[dict], List[dict]]:
        """
        We do not immediately display rows and arrays clearly in the data grid. This
        method separates out nested fields and data values to help clearly display
        structural columns.

        Example: ColumnA is a row(nested_obj varchar) and ColumnB is an array(int)
        Original data set = [
            {'ColumnA': ['a1'], 'ColumnB': [1, 2]},
            {'ColumnA': ['a2'], 'ColumnB': [3, 4]},
        ]
        Expanded data set = [
            {'ColumnA': ['a1'], 'ColumnA.nested_obj': 'a1', 'ColumnB': 1},
            {'ColumnA': '',     'ColumnA.nested_obj': '',   'ColumnB': 2},
            {'ColumnA': ['a2'], 'ColumnA.nested_obj': 'a2', 'ColumnB': 3},
            {'ColumnA': '',     'ColumnA.nested_obj': '',   'ColumnB': 4},
        ]
        :param columns: columns selected in the query
        :param data: original data set
        :return: list of all columns(selected columns and their nested fields),
                 expanded data set, listed of nested fields
        """
        all_columns: List[dict] = []
        # Get the list of all columns (selected fields and their nested fields)
        for column in columns:
            if column['type'].startswith('ARRAY') or column['type'].startswith('ROW'):
                cls._parse_structural_column(column['name'],
                                             column['type'].lower(),
                                             all_columns)
            else:
                all_columns.append(column)

        # Build graphs where the root node is a row or array and its children are that
        # column's nested fields
        row_column_hierarchy,\
            array_column_hierarchy,\
            expanded_columns = cls._create_row_and_array_hierarchy(columns)

        # Pull out a row's nested fields and their values into separate columns
        ordered_row_columns = row_column_hierarchy.keys()
        for datum in data:
            for row_column in ordered_row_columns:
                cls._expand_row_data(datum, row_column, row_column_hierarchy)

        while array_column_hierarchy:
            array_columns = list(array_column_hierarchy.keys())
            # Determine what columns are ready to be processed.
            array_columns_to_process,\
                unprocessed_array_columns = cls._split_array_columns_by_process_state(
                    array_columns, array_column_hierarchy, data[0])
            all_array_data = cls._process_array_data(data,
                                                     all_columns,
                                                     array_column_hierarchy)
            # Consolidate the original data set and the expanded array data
            cls._consolidate_array_data_into_data(data, all_array_data)
            # Remove processed array columns from the graph
            cls._remove_processed_array_columns(unprocessed_array_columns,
                                                array_column_hierarchy)

        return all_columns, data, expanded_columns

    @classmethod
    def extra_table_metadata(cls, database, table_name, schema_name):
        indexes = database.get_indexes(table_name, schema_name)
        if not indexes:
            return {}
        cols = indexes[0].get('column_names', [])
        full_table_name = table_name
        if schema_name and '.' not in table_name:
            full_table_name = '{}.{}'.format(schema_name, table_name)
        pql = cls._partition_query(full_table_name)
        col_name, latest_part = cls.latest_partition(
            table_name, schema_name, database, show_first=True)
        return {
            'partitions': {
                'cols': cols,
                'latest': {col_name: latest_part},
                'partitionQuery': pql,
            },
        }

    @classmethod
    def handle_cursor(cls, cursor, query, session):
        """Updates progress information"""
        logging.info('Polling the cursor for progress')
        polled = cursor.poll()
        # poll returns dict -- JSON status information or ``None``
        # if the query is done
        # https://github.com/dropbox/PyHive/blob/
        # b34bdbf51378b3979eaf5eca9e956f06ddc36ca0/pyhive/presto.py#L178
        while polled:
            # Update the object and wait for the kill signal.
            stats = polled.get('stats', {})

            query = session.query(type(query)).filter_by(id=query.id).one()
            if query.status in [QueryStatus.STOPPED, QueryStatus.TIMED_OUT]:
                cursor.cancel()
                break

            if stats:
                state = stats.get('state')

                # if already finished, then stop polling
                if state == 'FINISHED':
                    break

                completed_splits = float(stats.get('completedSplits'))
                total_splits = float(stats.get('totalSplits'))
                if total_splits and completed_splits:
                    progress = 100 * (completed_splits / total_splits)
                    logging.info(
                        'Query progress: {} / {} '
                        'splits'.format(completed_splits, total_splits))
                    if progress > query.progress:
                        query.progress = progress
                    session.commit()
            time.sleep(1)
            logging.info('Polling the cursor for progress')
            polled = cursor.poll()

    @classmethod
    def extract_error_message(cls, e):
        if (
                hasattr(e, 'orig') and
                type(e.orig).__name__ == 'DatabaseError' and
                isinstance(e.orig[0], dict)):
            error_dict = e.orig[0]
            return '{} at {}: {}'.format(
                error_dict.get('errorName'),
                error_dict.get('errorLocation'),
                error_dict.get('message'),
            )
        if (
                type(e).__name__ == 'DatabaseError' and
                hasattr(e, 'args') and
                len(e.args) > 0
        ):
            error_dict = e.args[0]
            return error_dict.get('message')
        return utils.error_msg_from_exception(e)

    @classmethod
    def _partition_query(
            cls, table_name, limit=0, order_by=None, filters=None):
        """Returns a partition query

        :param table_name: the name of the table to get partitions from
        :type table_name: str
        :param limit: the number of partitions to be returned
        :type limit: int
        :param order_by: a list of tuples of field name and a boolean
            that determines if that field should be sorted in descending
            order
        :type order_by: list of (str, bool) tuples
        :param filters: dict of field name and filter value combinations
        """
        limit_clause = 'LIMIT {}'.format(limit) if limit else ''
        order_by_clause = ''
        if order_by:
            l = []  # noqa: E741
            for field, desc in order_by:
                l.append(field + ' DESC' if desc else '')
            order_by_clause = 'ORDER BY ' + ', '.join(l)

        where_clause = ''
        if filters:
            l = []  # noqa: E741
            for field, value in filters.items():
                l.append(f"{field} = '{value}'")
            where_clause = 'WHERE ' + ' AND '.join(l)

        sql = textwrap.dedent(f"""\
            SELECT * FROM "{table_name}$partitions"

            {where_clause}
            {order_by_clause}
            {limit_clause}
        """)
        return sql

    @classmethod
    def where_latest_partition(
            cls, table_name, schema, database, qry, columns=None):
        try:
            col_name, value = cls.latest_partition(
                table_name, schema, database, show_first=True)
        except Exception:
            # table is not partitioned
            return False
        if value is not None:
            for c in columns:
                if c.get('name') == col_name:
                    return qry.where(Column(col_name) == value)
        return False

    @classmethod
    def _latest_partition_from_df(cls, df):
        if not df.empty:
            return df.to_records(index=False)[0][0]

    @classmethod
    def latest_partition(cls, table_name, schema, database, show_first=False):
        """Returns col name and the latest (max) partition value for a table

        :param table_name: the name of the table
        :type table_name: str
        :param schema: schema / database / namespace
        :type schema: str
        :param database: database query will be run against
        :type database: models.Database
        :param show_first: displays the value for the first partitioning key
          if there are many partitioning keys
        :type show_first: bool

        >>> latest_partition('foo_table')
        ('ds', '2018-01-01')
        """
        indexes = database.get_indexes(table_name, schema)
        if len(indexes[0]['column_names']) < 1:
            raise SupersetTemplateException(
                'The table should have one partitioned field')
        elif not show_first and len(indexes[0]['column_names']) > 1:
            raise SupersetTemplateException(
                'The table should have a single partitioned field '
                'to use this function. You may want to use '
                '`presto.latest_sub_partition`')
        part_field = indexes[0]['column_names'][0]
        sql = cls._partition_query(table_name, 1, [(part_field, True)])
        df = database.get_df(sql, schema)
        return part_field, cls._latest_partition_from_df(df)

    @classmethod
    def latest_sub_partition(cls, table_name, schema, database, **kwargs):
        """Returns the latest (max) partition value for a table

        A filtering criteria should be passed for all fields that are
        partitioned except for the field to be returned. For example,
        if a table is partitioned by (``ds``, ``event_type`` and
        ``event_category``) and you want the latest ``ds``, you'll want
        to provide a filter as keyword arguments for both
        ``event_type`` and ``event_category`` as in
        ``latest_sub_partition('my_table',
            event_category='page', event_type='click')``

        :param table_name: the name of the table, can be just the table
            name or a fully qualified table name as ``schema_name.table_name``
        :type table_name: str
        :param schema: schema / database / namespace
        :type schema: str
        :param database: database query will be run against
        :type database: models.Database

        :param kwargs: keyword arguments define the filtering criteria
            on the partition list. There can be many of these.
        :type kwargs: str
        >>> latest_sub_partition('sub_partition_table', event_type='click')
        '2018-01-01'
        """
        indexes = database.get_indexes(table_name, schema)
        part_fields = indexes[0]['column_names']
        for k in kwargs.keys():
            if k not in k in part_fields:
                msg = 'Field [{k}] is not part of the portioning key'
                raise SupersetTemplateException(msg)
        if len(kwargs.keys()) != len(part_fields) - 1:
            msg = (
                'A filter needs to be specified for {} out of the '
                '{} fields.'
            ).format(len(part_fields) - 1, len(part_fields))
            raise SupersetTemplateException(msg)

        for field in part_fields:
            if field not in kwargs.keys():
                field_to_return = field

        sql = cls._partition_query(
            table_name, 1, [(field_to_return, True)], kwargs)
        df = database.get_df(sql, schema)
        if df.empty:
            return ''
        return df.to_dict()[field_to_return][0]


class HiveEngineSpec(PrestoEngineSpec):

    """Reuses PrestoEngineSpec functionality."""

    engine = 'hive'
    max_column_name_length = 767

    # Scoping regex at class level to avoid recompiling
    # 17/02/07 19:36:38 INFO ql.Driver: Total jobs = 5
    jobs_stats_r = re.compile(
        r'.*INFO.*Total jobs = (?P<max_jobs>[0-9]+)')
    # 17/02/07 19:37:08 INFO ql.Driver: Launching Job 2 out of 5
    launching_job_r = re.compile(
        '.*INFO.*Launching Job (?P<job_number>[0-9]+) out of '
        '(?P<max_jobs>[0-9]+)')
    # 17/02/07 19:36:58 INFO exec.Task: 2017-02-07 19:36:58,152 Stage-18
    # map = 0%,  reduce = 0%
    stage_progress_r = re.compile(
        r'.*INFO.*Stage-(?P<stage_number>[0-9]+).*'
        r'map = (?P<map_progress>[0-9]+)%.*'
        r'reduce = (?P<reduce_progress>[0-9]+)%.*')

    @classmethod
    def patch(cls):
        from pyhive import hive  # pylint: disable=no-name-in-module
        from superset.db_engines import hive as patched_hive
        from TCLIService import (
            constants as patched_constants,
            ttypes as patched_ttypes,
            TCLIService as patched_TCLIService)

        hive.TCLIService = patched_TCLIService
        hive.constants = patched_constants
        hive.ttypes = patched_ttypes
        hive.Cursor.fetch_logs = patched_hive.fetch_logs

    @classmethod
    def get_all_datasource_names(cls, db, datasource_type: str) \
            -> List[utils.DatasourceName]:
        return BaseEngineSpec.get_all_datasource_names(db, datasource_type)

    @classmethod
    def fetch_data(cls, cursor, limit):
        import pyhive
        from TCLIService import ttypes
        state = cursor.poll()
        if state.operationState == ttypes.TOperationState.ERROR_STATE:
            raise Exception('Query error', state.errorMessage)
        try:
            return super(HiveEngineSpec, cls).fetch_data(cursor, limit)
        except pyhive.exc.ProgrammingError:
            return []

    @staticmethod
    def create_table_from_csv(form, table):
        """Uploads a csv file and creates a superset datasource in Hive."""
        def convert_to_hive_type(col_type):
            """maps tableschema's types to hive types"""
            tableschema_to_hive_types = {
                'boolean': 'BOOLEAN',
                'integer': 'INT',
                'number': 'DOUBLE',
                'string': 'STRING',
            }
            return tableschema_to_hive_types.get(col_type, 'STRING')

        bucket_path = config['CSV_TO_HIVE_UPLOAD_S3_BUCKET']

        if not bucket_path:
            logging.info('No upload bucket specified')
            raise Exception(
                'No upload bucket specified. You can specify one in the config file.')

        table_name = form.name.data
        schema_name = form.schema.data

        if config.get('UPLOADED_CSV_HIVE_NAMESPACE'):
            if '.' in table_name or schema_name:
                raise Exception(
                    "You can't specify a namespace. "
                    'All tables will be uploaded to the `{}` namespace'.format(
                        config.get('HIVE_NAMESPACE')))
            full_table_name = '{}.{}'.format(
                config.get('UPLOADED_CSV_HIVE_NAMESPACE'), table_name)
        else:
            if '.' in table_name and schema_name:
                raise Exception(
                    "You can't specify a namespace both in the name of the table "
                    'and in the schema field. Please remove one')

            full_table_name = '{}.{}'.format(
                schema_name, table_name) if schema_name else table_name

        filename = form.csv_file.data.filename

        upload_prefix = config['CSV_TO_HIVE_UPLOAD_DIRECTORY']
        upload_path = config['UPLOAD_FOLDER'] + \
            secure_filename(filename)

        # Optional dependency
        from tableschema import Table  # pylint: disable=import-error
        hive_table_schema = Table(upload_path).infer()
        column_name_and_type = []
        for column_info in hive_table_schema['fields']:
            column_name_and_type.append(
                '`{}` {}'.format(
                    column_info['name'],
                    convert_to_hive_type(column_info['type'])))
        schema_definition = ', '.join(column_name_and_type)

        # Optional dependency
        import boto3  # pylint: disable=import-error

        s3 = boto3.client('s3')
        location = os.path.join('s3a://', bucket_path, upload_prefix, table_name)
        s3.upload_file(
            upload_path, bucket_path,
            os.path.join(upload_prefix, table_name, filename))
        sql = f"""CREATE TABLE {full_table_name} ( {schema_definition} )
            ROW FORMAT DELIMITED FIELDS TERMINATED BY ',' STORED AS
            TEXTFILE LOCATION '{location}'
            tblproperties ('skip.header.line.count'='1')"""
        logging.info(form.con.data)
        engine = create_engine(form.con.data.sqlalchemy_uri_decrypted)
        engine.execute(sql)

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        tt = target_type.upper()
        if tt == 'DATE':
            return "CAST('{}' AS DATE)".format(dttm.isoformat()[:10])
        elif tt == 'TIMESTAMP':
            return "CAST('{}' AS TIMESTAMP)".format(
                dttm.strftime('%Y-%m-%d %H:%M:%S'))
        return "'{}'".format(dttm.strftime('%Y-%m-%d %H:%M:%S'))

    @classmethod
    def adjust_database_uri(cls, uri, selected_schema=None):
        if selected_schema:
            uri.database = parse.quote(selected_schema, safe='')
        return uri

    @classmethod
    def extract_error_message(cls, e):
        msg = str(e)
        match = re.search(r'errorMessage="(.*?)(?<!\\)"', msg)
        if match:
            msg = match.group(1)
        return msg

    @classmethod
    def progress(cls, log_lines):
        total_jobs = 1  # assuming there's at least 1 job
        current_job = 1
        stages = {}
        for line in log_lines:
            match = cls.jobs_stats_r.match(line)
            if match:
                total_jobs = int(match.groupdict()['max_jobs']) or 1
            match = cls.launching_job_r.match(line)
            if match:
                current_job = int(match.groupdict()['job_number'])
                total_jobs = int(match.groupdict()['max_jobs']) or 1
                stages = {}
            match = cls.stage_progress_r.match(line)
            if match:
                stage_number = int(match.groupdict()['stage_number'])
                map_progress = int(match.groupdict()['map_progress'])
                reduce_progress = int(match.groupdict()['reduce_progress'])
                stages[stage_number] = (map_progress + reduce_progress) / 2
        logging.info(
            'Progress detail: {}, '
            'current job {}, '
            'total jobs: {}'.format(stages, current_job, total_jobs))

        stage_progress = sum(
            stages.values()) / len(stages.values()) if stages else 0

        progress = (
            100 * (current_job - 1) / total_jobs + stage_progress / total_jobs
        )
        return int(progress)

    @classmethod
    def get_tracking_url(cls, log_lines):
        lkp = 'Tracking URL = '
        for line in log_lines:
            if lkp in line:
                return line.split(lkp)[1]

    @classmethod
    def handle_cursor(cls, cursor, query, session):
        """Updates progress information"""
        from pyhive import hive  # pylint: disable=no-name-in-module
        unfinished_states = (
            hive.ttypes.TOperationState.INITIALIZED_STATE,
            hive.ttypes.TOperationState.RUNNING_STATE,
        )
        polled = cursor.poll()
        last_log_line = 0
        tracking_url = None
        job_id = None
        while polled.operationState in unfinished_states:
            query = session.query(type(query)).filter_by(id=query.id).one()
            if query.status == QueryStatus.STOPPED:
                cursor.cancel()
                break

            log = cursor.fetch_logs() or ''
            if log:
                log_lines = log.splitlines()
                progress = cls.progress(log_lines)
                logging.info('Progress total: {}'.format(progress))
                needs_commit = False
                if progress > query.progress:
                    query.progress = progress
                    needs_commit = True
                if not tracking_url:
                    tracking_url = cls.get_tracking_url(log_lines)
                    if tracking_url:
                        job_id = tracking_url.split('/')[-2]
                        logging.info(
                            'Found the tracking url: {}'.format(tracking_url))
                        tracking_url = tracking_url_trans(tracking_url)
                        logging.info(
                            'Transformation applied: {}'.format(tracking_url))
                        query.tracking_url = tracking_url
                        logging.info('Job id: {}'.format(job_id))
                        needs_commit = True
                if job_id and len(log_lines) > last_log_line:
                    # Wait for job id before logging things out
                    # this allows for prefixing all log lines and becoming
                    # searchable in something like Kibana
                    for l in log_lines[last_log_line:]:
                        logging.info('[{}] {}'.format(job_id, l))
                    last_log_line = len(log_lines)
                if needs_commit:
                    session.commit()
            time.sleep(hive_poll_interval)
            polled = cursor.poll()

    @classmethod
    def get_columns(
            cls, inspector: Inspector, table_name: str, schema: str) -> List[dict]:
        return inspector.get_columns(table_name, schema)

    @classmethod
    def where_latest_partition(
            cls, table_name, schema, database, qry, columns=None):
        try:
            col_name, value = cls.latest_partition(
                table_name, schema, database, show_first=True)
        except Exception:
            # table is not partitioned
            return False
        if value is not None:
            for c in columns:
                if c.get('name') == col_name:
                    return qry.where(Column(col_name) == value)
        return False

    @classmethod
    def _get_fields(cls, cols: List[dict]) -> List[ColumnClause]:
        return BaseEngineSpec._get_fields(cols)

    @classmethod
    def latest_sub_partition(cls, table_name, schema, database, **kwargs):
        # TODO(bogdan): implement`
        pass

    @classmethod
    def _latest_partition_from_df(cls, df):
        """Hive partitions look like ds={partition name}"""
        if not df.empty:
            return df.ix[:, 0].max().split('=')[1]

    @classmethod
    def _partition_query(
            cls, table_name, limit=0, order_by=None, filters=None):
        return f'SHOW PARTITIONS {table_name}'

    @classmethod
    def select_star(cls, my_db, table_name: str, engine: Engine, schema: str = None,
                    limit: int = 100, show_cols: bool = False, indent: bool = True,
                    latest_partition: bool = True, cols: List[dict] = []) -> str:
        return BaseEngineSpec.select_star(
            my_db, table_name, engine, schema, limit,
            show_cols, indent, latest_partition, cols)

    @classmethod
    def modify_url_for_impersonation(cls, url, impersonate_user, username):
        """
        Modify the SQL Alchemy URL object with the user to impersonate if applicable.
        :param url: SQLAlchemy URL object
        :param impersonate_user: Bool indicating if impersonation is enabled
        :param username: Effective username
        """
        # Do nothing in the URL object since instead this should modify
        # the configuraiton dictionary. See get_configuration_for_impersonation
        pass

    @classmethod
    def get_configuration_for_impersonation(cls, uri, impersonate_user, username):
        """
        Return a configuration dictionary that can be merged with other configs
        that can set the correct properties for impersonating users
        :param uri: URI string
        :param impersonate_user: Bool indicating if impersonation is enabled
        :param username: Effective username
        :return: Dictionary with configs required for impersonation
        """
        configuration = {}
        url = make_url(uri)
        backend_name = url.get_backend_name()

        # Must be Hive connection, enable impersonation, and set param auth=LDAP|KERBEROS
        if (backend_name == 'hive' and 'auth' in url.query.keys() and
                impersonate_user is True and username is not None):
            configuration['hive.server2.proxy.user'] = username
        return configuration

    @staticmethod
    def execute(cursor, query, async_=False):
        kwargs = {'async': async_}
        cursor.execute(query, **kwargs)


class MssqlEngineSpec(BaseEngineSpec):
    engine = 'mssql'
    epoch_to_dttm = "dateadd(S, {col}, '1970-01-01')"
    limit_method = LimitMethod.WRAP_SQL
    max_column_name_length = 128

    time_grain_functions = {
        None: '{col}',
        'PT1S': "DATEADD(second, DATEDIFF(second, '2000-01-01', {col}), '2000-01-01')",
        'PT1M': 'DATEADD(minute, DATEDIFF(minute, 0, {col}), 0)',
        'PT5M': 'DATEADD(minute, DATEDIFF(minute, 0, {col}) / 5 * 5, 0)',
        'PT10M': 'DATEADD(minute, DATEDIFF(minute, 0, {col}) / 10 * 10, 0)',
        'PT15M': 'DATEADD(minute, DATEDIFF(minute, 0, {col}) / 15 * 15, 0)',
        'PT0.5H': 'DATEADD(minute, DATEDIFF(minute, 0, {col}) / 30 * 30, 0)',
        'PT1H': 'DATEADD(hour, DATEDIFF(hour, 0, {col}), 0)',
        'P1D': 'DATEADD(day, DATEDIFF(day, 0, {col}), 0)',
        'P1W': 'DATEADD(week, DATEDIFF(week, 0, {col}), 0)',
        'P1M': 'DATEADD(month, DATEDIFF(month, 0, {col}), 0)',
        'P0.25Y': 'DATEADD(quarter, DATEDIFF(quarter, 0, {col}), 0)',
        'P1Y': 'DATEADD(year, DATEDIFF(year, 0, {col}), 0)',
    }

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        return "CONVERT(DATETIME, '{}', 126)".format(dttm.isoformat())

    @classmethod
    def fetch_data(cls, cursor, limit):
        data = super(MssqlEngineSpec, cls).fetch_data(cursor, limit)
        if len(data) != 0 and type(data[0]).__name__ == 'Row':
            data = [[elem for elem in r] for r in data]
        return data

    column_types = [
        (String(), re.compile(r'^(?<!N)((VAR){0,1}CHAR|TEXT|STRING)', re.IGNORECASE)),
        (UnicodeText(), re.compile(r'^N((VAR){0,1}CHAR|TEXT)', re.IGNORECASE)),
    ]

    @classmethod
    def get_sqla_column_type(cls, type_):
        for sqla_type, regex in cls.column_types:
            if regex.match(type_):
                return sqla_type
        return None


class AthenaEngineSpec(BaseEngineSpec):
    engine = 'awsathena'

    time_grain_functions = {
        None: '{col}',
        'PT1S': "date_trunc('second', CAST({col} AS TIMESTAMP))",
        'PT1M': "date_trunc('minute', CAST({col} AS TIMESTAMP))",
        'PT1H': "date_trunc('hour', CAST({col} AS TIMESTAMP))",
        'P1D': "date_trunc('day', CAST({col} AS TIMESTAMP))",
        'P1W': "date_trunc('week', CAST({col} AS TIMESTAMP))",
        'P1M': "date_trunc('month', CAST({col} AS TIMESTAMP))",
        'P0.25Y': "date_trunc('quarter', CAST({col} AS TIMESTAMP))",
        'P1Y': "date_trunc('year', CAST({col} AS TIMESTAMP))",
        'P1W/1970-01-03T00:00:00Z': "date_add('day', 5, date_trunc('week', \
                                    date_add('day', 1, CAST({col} AS TIMESTAMP))))",
        '1969-12-28T00:00:00Z/P1W': "date_add('day', -1, date_trunc('week', \
                                    date_add('day', 1, CAST({col} AS TIMESTAMP))))",
    }

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        tt = target_type.upper()
        if tt == 'DATE':
            return "from_iso8601_date('{}')".format(dttm.isoformat()[:10])
        if tt == 'TIMESTAMP':
            return "from_iso8601_timestamp('{}')".format(dttm.isoformat())
        return ("CAST ('{}' AS TIMESTAMP)"
                .format(dttm.strftime('%Y-%m-%d %H:%M:%S')))

    @classmethod
    def epoch_to_dttm(cls):
        return 'from_unixtime({col})'

    @staticmethod
    def mutate_label(label):
        """
        Athena only supports lowercase column names and aliases.
        :param str label: Original label which might include uppercase letters
        :return: String that is supported by the database
        """
        return label.lower()


class PinotEngineSpec(BaseEngineSpec):
    engine = 'pinot'
    allows_subquery = False
    inner_joins = False
    supports_column_aliases = False

    # Pinot does its own conversion below
    time_grain_functions: Dict[Optional[str], str] = {
        'PT1S': '1:SECONDS',
        'PT1M': '1:MINUTES',
        'PT1H': '1:HOURS',
        'P1D': '1:DAYS',
        'P1W': '1:WEEKS',
        'P1M': '1:MONTHS',
        'P0.25Y': '3:MONTHS',
        'P1Y': '1:YEARS',
    }

    @classmethod
    def get_timestamp_expr(cls, col: ColumnClause, pdf: Optional[str],
                           time_grain: Optional[str]) -> TimestampExpression:
        is_epoch = pdf in ('epoch_s', 'epoch_ms')
        if not is_epoch:
            raise NotImplementedError('Pinot currently only supports epochs')
        # The DATETIMECONVERT pinot udf is documented at
        # Per https://github.com/apache/incubator-pinot/wiki/dateTimeConvert-UDF
        # We are not really converting any time units, just bucketing them.
        seconds_or_ms = 'MILLISECONDS' if pdf == 'epoch_ms' else 'SECONDS'
        tf = f'1:{seconds_or_ms}:EPOCH'
        granularity = cls.time_grain_functions.get(time_grain)
        if not granularity:
            raise NotImplementedError('No pinot grain spec for ' + str(time_grain))
        # In pinot the output is a string since there is no timestamp column like pg
        time_expr = f'DATETIMECONVERT({{col}}, "{tf}", "{tf}", "{granularity}")'
        return TimestampExpression(time_expr, col)

    @classmethod
    def make_select_compatible(cls, groupby_exprs, select_exprs):
        # Pinot does not want the group by expr's to appear in the select clause
        select_sans_groupby = []
        # We want identity and not equality, so doing the filtering manually
        for s in select_exprs:
            for gr in groupby_exprs:
                if s is gr:
                    break
            else:
                select_sans_groupby.append(s)
        return select_sans_groupby


class ClickHouseEngineSpec(BaseEngineSpec):
    """Dialect for ClickHouse analytical DB."""

    engine = 'clickhouse'

    time_secondary_columns = True
    time_groupby_inline = True

    time_grain_functions = {
        None: '{col}',
        'PT1M': 'toStartOfMinute(toDateTime({col}))',
        'PT5M': 'toDateTime(intDiv(toUInt32(toDateTime({col})), 300)*300)',
        'PT10M': 'toDateTime(intDiv(toUInt32(toDateTime({col})), 600)*600)',
        'PT15M': 'toDateTime(intDiv(toUInt32(toDateTime({col})), 900)*900)',
        'PT0.5H': 'toDateTime(intDiv(toUInt32(toDateTime({col})), 1800)*1800)',
        'PT1H': 'toStartOfHour(toDateTime({col}))',
        'P1D': 'toStartOfDay(toDateTime({col}))',
        'P1W': 'toMonday(toDateTime({col}))',
        'P1M': 'toStartOfMonth(toDateTime({col}))',
        'P0.25Y': 'toStartOfQuarter(toDateTime({col}))',
        'P1Y': 'toStartOfYear(toDateTime({col}))',
    }

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        tt = target_type.upper()
        if tt == 'DATE':
            return "toDate('{}')".format(dttm.strftime('%Y-%m-%d'))
        if tt == 'DATETIME':
            return "toDateTime('{}')".format(
                dttm.strftime('%Y-%m-%d %H:%M:%S'))
        return "'{}'".format(dttm.strftime('%Y-%m-%d %H:%M:%S'))


class BQEngineSpec(BaseEngineSpec):
    """Engine spec for Google's BigQuery

    As contributed by @mxmzdlv on issue #945"""
    engine = 'bigquery'
    max_column_name_length = 128

    """
    https://www.python.org/dev/peps/pep-0249/#arraysize
    raw_connections bypass the pybigquery query execution context and deal with
    raw dbapi connection directly.
    If this value is not set, the default value is set to 1, as described here,
    https://googlecloudplatform.github.io/google-cloud-python/latest/_modules/google/cloud/bigquery/dbapi/cursor.html#Cursor

    The default value of 5000 is derived from the pybigquery.
    https://github.com/mxmzdlv/pybigquery/blob/d214bb089ca0807ca9aaa6ce4d5a01172d40264e/pybigquery/sqlalchemy_bigquery.py#L102
    """
    arraysize = 5000

    time_grain_functions = {
        None: '{col}',
        'PT1S': 'TIMESTAMP_TRUNC({col}, SECOND)',
        'PT1M': 'TIMESTAMP_TRUNC({col}, MINUTE)',
        'PT1H': 'TIMESTAMP_TRUNC({col}, HOUR)',
        'P1D': 'TIMESTAMP_TRUNC({col}, DAY)',
        'P1W': 'TIMESTAMP_TRUNC({col}, WEEK)',
        'P1M': 'TIMESTAMP_TRUNC({col}, MONTH)',
        'P0.25Y': 'TIMESTAMP_TRUNC({col}, QUARTER)',
        'P1Y': 'TIMESTAMP_TRUNC({col}, YEAR)',
    }

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        tt = target_type.upper()
        if tt == 'DATE':
            return "'{}'".format(dttm.strftime('%Y-%m-%d'))
        return "'{}'".format(dttm.strftime('%Y-%m-%d %H:%M:%S'))

    @classmethod
    def fetch_data(cls, cursor, limit):
        data = super(BQEngineSpec, cls).fetch_data(cursor, limit)
        if len(data) != 0 and type(data[0]).__name__ == 'Row':
            data = [r.values() for r in data]
        return data

    @staticmethod
    def mutate_label(label):
        """
        BigQuery field_name should start with a letter or underscore and contain only
        alphanumeric characters. Labels that start with a number are prefixed with an
        underscore. Any unsupported characters are replaced with underscores and an
        md5 hash is added to the end of the label to avoid possible collisions.
        :param str label: the original label which might include unsupported characters
        :return: String that is supported by the database
        """
        label_hashed = '_' + hashlib.md5(label.encode('utf-8')).hexdigest()

        # if label starts with number, add underscore as first character
        label_mutated = '_' + label if re.match(r'^\d', label) else label

        # replace non-alphanumeric characters with underscores
        label_mutated = re.sub(r'[^\w]+', '_', label_mutated)
        if label_mutated != label:
            # add md5 hash to label to avoid possible collisions
            label_mutated += label_hashed

        return label_mutated

    @classmethod
    def truncate_label(cls, label):
        """BigQuery requires column names start with either a letter or
        underscore. To make sure this is always the case, an underscore is prefixed
        to the truncated label.
        """
        return '_' + hashlib.md5(label.encode('utf-8')).hexdigest()

    @classmethod
    def extra_table_metadata(cls, database, table_name, schema_name):
        indexes = database.get_indexes(table_name, schema_name)
        if not indexes:
            return {}
        partitions_columns = [
            index.get('column_names', []) for index in indexes
            if index.get('name') == 'partition'
        ]
        cluster_columns = [
            index.get('column_names', []) for index in indexes
            if index.get('name') == 'clustering'
        ]
        return {
            'partitions': {
                'cols': partitions_columns,
            },
            'clustering': {
                'cols': cluster_columns,
            },
        }

    @classmethod
    def _get_fields(cls, cols):
        """
        BigQuery dialect requires us to not use backtick in the fieldname which are
        nested.
        Using literal_column handles that issue.
        https://docs.sqlalchemy.org/en/latest/core/tutorial.html#using-more-specific-text-with-table-literal-column-and-column
        Also explicility specifying column names so we don't encounter duplicate
        column names in the result.
        """
        return [sqla.literal_column(c.get('name')).label(c.get('name').replace('.', '__'))
                for c in cols]


class ImpalaEngineSpec(BaseEngineSpec):
    """Engine spec for Cloudera's Impala"""

    engine = 'impala'

    time_grain_functions = {
        None: '{col}',
        'PT1M': "TRUNC({col}, 'MI')",
        'PT1H': "TRUNC({col}, 'HH')",
        'P1D': "TRUNC({col}, 'DD')",
        'P1W': "TRUNC({col}, 'WW')",
        'P1M': "TRUNC({col}, 'MONTH')",
        'P0.25Y': "TRUNC({col}, 'Q')",
        'P1Y': "TRUNC({col}, 'YYYY')",
    }

    @classmethod
    def epoch_to_dttm(cls):
        return 'from_unixtime({col})'

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        tt = target_type.upper()
        if tt == 'DATE':
            return "'{}'".format(dttm.strftime('%Y-%m-%d'))
        return "'{}'".format(dttm.strftime('%Y-%m-%d %H:%M:%S'))

    @classmethod
    def get_schema_names(cls, inspector):
        schemas = [row[0] for row in inspector.engine.execute('SHOW SCHEMAS')
                   if not row[0].startswith('_')]
        return schemas


class DruidEngineSpec(BaseEngineSpec):
    """Engine spec for Druid.io"""
    engine = 'druid'
    inner_joins = False
    allows_subquery = False

    time_grain_functions = {
        None: '{col}',
        'PT1S': 'FLOOR({col} TO SECOND)',
        'PT1M': 'FLOOR({col} TO MINUTE)',
        'PT1H': 'FLOOR({col} TO HOUR)',
        'P1D': 'FLOOR({col} TO DAY)',
        'P1W': 'FLOOR({col} TO WEEK)',
        'P1M': 'FLOOR({col} TO MONTH)',
        'P0.25Y': 'FLOOR({col} TO QUARTER)',
        'P1Y': 'FLOOR({col} TO YEAR)',
    }

    @classmethod
    def alter_new_orm_column(cls, orm_col):
        if orm_col.column_name == '__time':
            orm_col.is_dttm = True


class GSheetsEngineSpec(SqliteEngineSpec):
    """Engine for Google spreadsheets"""
    engine = 'gsheets'
    inner_joins = False
    allows_subquery = False


class KylinEngineSpec(BaseEngineSpec):
    """Dialect for Apache Kylin"""

    engine = 'kylin'

    time_grain_functions = {
        None: '{col}',
        'PT1S': 'CAST(FLOOR(CAST({col} AS TIMESTAMP) TO SECOND) AS TIMESTAMP)',
        'PT1M': 'CAST(FLOOR(CAST({col} AS TIMESTAMP) TO MINUTE) AS TIMESTAMP)',
        'PT1H': 'CAST(FLOOR(CAST({col} AS TIMESTAMP) TO HOUR) AS TIMESTAMP)',
        'P1D': 'CAST(FLOOR(CAST({col} AS TIMESTAMP) TO DAY) AS DATE)',
        'P1W': 'CAST(TIMESTAMPADD(WEEK, WEEK(CAST({col} AS DATE)) - 1, \
               FLOOR(CAST({col} AS TIMESTAMP) TO YEAR)) AS DATE)',
        'P1M': 'CAST(FLOOR(CAST({col} AS TIMESTAMP) TO MONTH) AS DATE)',
        'P0.25Y': 'CAST(TIMESTAMPADD(QUARTER, QUARTER(CAST({col} AS DATE)) - 1, \
                  FLOOR(CAST({col} AS TIMESTAMP) TO YEAR)) AS DATE)',
        'P1Y': 'CAST(FLOOR(CAST({col} AS TIMESTAMP) TO YEAR) AS DATE)',
    }

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        tt = target_type.upper()
        if tt == 'DATE':
            return "CAST('{}' AS DATE)".format(dttm.isoformat()[:10])
        if tt == 'TIMESTAMP':
            return "CAST('{}' AS TIMESTAMP)".format(
                dttm.strftime('%Y-%m-%d %H:%M:%S'))
        return "'{}'".format(dttm.strftime('%Y-%m-%d %H:%M:%S'))


class TeradataEngineSpec(BaseEngineSpec):
    """Dialect for Teradata DB."""
    engine = 'teradata'
    limit_method = LimitMethod.WRAP_SQL
    max_column_name_length = 30  # since 14.10 this is 128

    time_grain_functions = {
        None: '{col}',
        'PT1M': "TRUNC(CAST({col} as DATE), 'MI')",
        'PT1H': "TRUNC(CAST({col} as DATE), 'HH')",
        'P1D': "TRUNC(CAST({col} as DATE), 'DDD')",
        'P1W': "TRUNC(CAST({col} as DATE), 'WW')",
        'P1M': "TRUNC(CAST({col} as DATE), 'MONTH')",
        'P0.25Y': "TRUNC(CAST({col} as DATE), 'Q')",
        'P1Y': "TRUNC(CAST({col} as DATE), 'YEAR')",
    }


engines = {
    o.engine: o for o in globals().values()
    if inspect.isclass(o) and issubclass(o, BaseEngineSpec)}
