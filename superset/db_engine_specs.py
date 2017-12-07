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
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from collections import defaultdict, namedtuple
import csv
import inspect
import logging
import os
import re
import textwrap
import time

import boto3
from flask import g
from flask_babel import lazy_gettext as _
import pandas
from sqlalchemy import select
from sqlalchemy.engine import create_engine
from sqlalchemy.engine.url import make_url
from sqlalchemy.sql import text
import sqlparse
from werkzeug.utils import secure_filename

from superset import app, cache_util, conf, db, utils
from superset.utils import QueryStatus, SupersetTemplateException

config = app.config

tracking_url_trans = conf.get('TRACKING_URL_TRANSFORMER')

Grain = namedtuple('Grain', 'name label function')


class LimitMethod(object):
    """Enum the ways that limits can be applied"""
    FETCH_MANY = 'fetch_many'
    WRAP_SQL = 'wrap_sql'


class BaseEngineSpec(object):

    """Abstract class for database engine specific configurations"""

    engine = 'base'  # str as defined in sqlalchemy.engine.engine
    cursor_execute_kwargs = {}
    time_grains = tuple()
    time_groupby_inline = False
    limit_method = LimitMethod.FETCH_MANY
    time_secondary_columns = False

    @classmethod
    def fetch_data(cls, cursor, limit):
        if cls.limit_method == LimitMethod.FETCH_MANY:
            return cursor.fetchmany(limit)
        return cursor.fetchall()

    @classmethod
    def epoch_to_dttm(cls):
        raise NotImplementedError()

    @classmethod
    def epoch_ms_to_dttm(cls):
        return cls.epoch_to_dttm().replace('{col}', '({col}/1000.0)')

    @classmethod
    def extra_table_metadata(cls, database, table_name, schema_name):
        """Returns engine-specific table metadata"""
        return {}

    @staticmethod
    def csv_to_df(**kwargs):
        kwargs['filepath_or_buffer'] = \
            app.config['UPLOAD_FOLDER'] + kwargs['filepath_or_buffer']
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
            return extension and extension[1:] in app.config['ALLOWED_EXTENSIONS']

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
            'con': create_engine(form.con.data, echo=False),
            'schema': form.schema.data,
            'if_exists': form.if_exists.data,
            'index': form.index.data,
            'index_label': form.index_label.data,
            'chunksize': 10000,
        }
        BaseEngineSpec.df_to_db(**df_to_db_kwargs)

    @classmethod
    def escape_sql(cls, sql):
        """Escapes the raw SQL"""
        return sql

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        return "'{}'".format(dttm.strftime('%Y-%m-%d %H:%M:%S'))

    @classmethod
    @cache_util.memoized_func(
        timeout=600,
        key=lambda *args, **kwargs: 'db:{}:{}'.format(args[0].id, args[1]))
    def fetch_result_sets(cls, db, datasource_type, force=False):
        """Returns the dictionary {schema : [result_set_name]}.

        Datasource_type can be 'table' or 'view'.
        Empty schema corresponds to the list of full names of the all
        tables or views: <schema>.<result_set_name>.
        """
        schemas = db.inspector.get_schema_names()
        result_sets = {}
        all_result_sets = []
        for schema in schemas:
            if datasource_type == 'table':
                result_sets[schema] = sorted(
                    db.inspector.get_table_names(schema))
            elif datasource_type == 'view':
                result_sets[schema] = sorted(
                    db.inspector.get_view_names(schema))
            all_result_sets += [
                '{}.{}'.format(schema, t) for t in result_sets[schema]]
        if all_result_sets:
            result_sets[''] = all_result_sets
        return result_sets

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
        return inspector.get_schema_names()

    @classmethod
    def get_table_names(cls, schema, inspector):
        return sorted(inspector.get_table_names(schema))

    @classmethod
    def where_latest_partition(
            cls, table_name, schema, database, qry, columns=None):
        return False

    @classmethod
    def select_star(cls, my_db, table_name, schema=None, limit=100,
                    show_cols=False, indent=True, latest_partition=True):
        fields = '*'
        cols = []
        if show_cols or latest_partition:
            cols = my_db.get_table(table_name, schema=schema).columns

        if show_cols:
            fields = [my_db.get_quoter()(c.name) for c in cols]
        full_table_name = table_name
        if schema:
            full_table_name = schema + '.' + table_name
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


class PostgresEngineSpec(BaseEngineSpec):
    engine = 'postgresql'

    time_grains = (
        Grain('Time Column', _('Time Column'), '{col}'),
        Grain('second', _('second'), "DATE_TRUNC('second', {col})"),
        Grain('minute', _('minute'), "DATE_TRUNC('minute', {col})"),
        Grain('hour', _('hour'), "DATE_TRUNC('hour', {col})"),
        Grain('day', _('day'), "DATE_TRUNC('day', {col})"),
        Grain('week', _('week'), "DATE_TRUNC('week', {col})"),
        Grain('month', _('month'), "DATE_TRUNC('month', {col})"),
        Grain('quarter', _('quarter'), "DATE_TRUNC('quarter', {col})"),
        Grain('year', _('year'), "DATE_TRUNC('year', {col})"),
    )

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

    @classmethod
    def get_table_names(cls, schema, inspector):
        """Need to consider foreign tables for PostgreSQL"""
        tables = inspector.get_table_names(schema)
        tables.extend(inspector.get_foreign_table_names(schema))
        return sorted(tables)


class Db2EngineSpec(BaseEngineSpec):
    engine = 'ibm_db_sa'
    time_grains = (
        Grain('Time Column', _('Time Column'), '{col}'),
        Grain('second', _('second'),
              'CAST({col} as TIMESTAMP)'
              ' - MICROSECOND({col}) MICROSECONDS'),
        Grain('minute', _('minute'),
              'CAST({col} as TIMESTAMP)'
              ' - SECOND({col}) SECONDS'
              ' - MICROSECOND({col}) MICROSECONDS'),
        Grain('hour', _('hour'),
              'CAST({col} as TIMESTAMP)'
              ' - MINUTE({col}) MINUTES'
              ' - SECOND({col}) SECONDS'
              ' - MICROSECOND({col}) MICROSECONDS '),
        Grain('day', _('day'),
              'CAST({col} as TIMESTAMP)'
              ' - HOUR({col}) HOURS'
              ' - MINUTE({col}) MINUTES'
              ' - SECOND({col}) SECONDS'
              ' - MICROSECOND({col}) MICROSECONDS '),
        Grain('week', _('week'),
              '{col} - (DAYOFWEEK({col})) DAYS'),
        Grain('month', _('month'),
              '{col} - (DAY({col})-1) DAYS'),
        Grain('quarter', _('quarter'),
              '{col} - (DAY({col})-1) DAYS'
              ' - (MONTH({col})-1) MONTHS'
              ' + ((QUARTER({col})-1) * 3) MONTHS'),
        Grain('year', _('year'),
              '{col} - (DAY({col})-1) DAYS'
              ' - (MONTH({col})-1) MONTHS'),
    )

    @classmethod
    def epoch_to_dttm(cls):
        return "(TIMESTAMP('1970-01-01', '00:00:00') + {col} SECONDS)"

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        return "'{}'".format(dttm.strftime('%Y-%m-%d-%H.%M.%S'))


class SqliteEngineSpec(BaseEngineSpec):
    engine = 'sqlite'
    time_grains = (
        Grain('Time Column', _('Time Column'), '{col}'),
        Grain('day', _('day'), 'DATE({col})'),
        Grain('week', _('week'),
              "DATE({col}, -strftime('%w', {col}) || ' days')"),
        Grain('month', _('month'),
              "DATE({col}, -strftime('%d', {col}) || ' days', '+1 day')"),
    )

    @classmethod
    def epoch_to_dttm(cls):
        return "datetime({col}, 'unixepoch')"

    @classmethod
    @cache_util.memoized_func(
        timeout=600,
        key=lambda *args, **kwargs: 'db:{}:{}'.format(args[0].id, args[1]))
    def fetch_result_sets(cls, db, datasource_type, force=False):
        schemas = db.inspector.get_schema_names()
        result_sets = {}
        all_result_sets = []
        schema = schemas[0]
        if datasource_type == 'table':
            result_sets[schema] = sorted(db.inspector.get_table_names())
        elif datasource_type == 'view':
            result_sets[schema] = sorted(db.inspector.get_view_names())
        all_result_sets += [
            '{}.{}'.format(schema, t) for t in result_sets[schema]]
        if all_result_sets:
            result_sets[''] = all_result_sets
        return result_sets

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        iso = dttm.isoformat().replace('T', ' ')
        if '.' not in iso:
            iso += '.000000'
        return "'{}'".format(iso)

    @classmethod
    def get_table_names(cls, schema, inspector):
        """Need to disregard the schema for Sqlite"""
        return sorted(inspector.get_table_names())


class MySQLEngineSpec(BaseEngineSpec):
    engine = 'mysql'
    cursor_execute_kwargs = {'args': {}}
    time_grains = (
        Grain('Time Column', _('Time Column'), '{col}'),
        Grain('second', _('second'), 'DATE_ADD(DATE({col}), '
              'INTERVAL (HOUR({col})*60*60 + MINUTE({col})*60'
              ' + SECOND({col})) SECOND)'),
        Grain('minute', _('minute'), 'DATE_ADD(DATE({col}), '
              'INTERVAL (HOUR({col})*60 + MINUTE({col})) MINUTE)'),
        Grain('hour', _('hour'), 'DATE_ADD(DATE({col}), '
              'INTERVAL HOUR({col}) HOUR)'),
        Grain('day', _('day'), 'DATE({col})'),
        Grain('week', _('week'), 'DATE(DATE_SUB({col}, '
              'INTERVAL DAYOFWEEK({col}) - 1 DAY))'),
        Grain('month', _('month'), 'DATE(DATE_SUB({col}, '
              'INTERVAL DAYOFMONTH({col}) - 1 DAY))'),
        Grain('quarter', _('quarter'), 'MAKEDATE(YEAR({col}), 1) '
              '+ INTERVAL QUARTER({col}) QUARTER - INTERVAL 1 QUARTER'),
        Grain('year', _('year'), 'DATE(DATE_SUB({col}, '
              'INTERVAL DAYOFYEAR({col}) - 1 DAY))'),
        Grain('week_start_monday', _('week_start_monday'),
              'DATE(DATE_SUB({col}, '
              'INTERVAL DAYOFWEEK(DATE_SUB({col}, INTERVAL 1 DAY)) - 1 DAY))'),
    )

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        if target_type.upper() in ('DATETIME', 'DATE'):
            return "STR_TO_DATE('{}', '%Y-%m-%d %H:%i:%s')".format(
                dttm.strftime('%Y-%m-%d %H:%M:%S'))
        return "'{}'".format(dttm.strftime('%Y-%m-%d %H:%M:%S'))

    @classmethod
    def adjust_database_uri(cls, uri, selected_schema=None):
        if selected_schema:
            uri.database = selected_schema
        return uri

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


class PrestoEngineSpec(BaseEngineSpec):
    engine = 'presto'
    cursor_execute_kwargs = {'parameters': None}

    time_grains = (
        Grain('Time Column', _('Time Column'), '{col}'),
        Grain('second', _('second'),
              "date_trunc('second', CAST({col} AS TIMESTAMP))"),
        Grain('minute', _('minute'),
              "date_trunc('minute', CAST({col} AS TIMESTAMP))"),
        Grain('hour', _('hour'),
              "date_trunc('hour', CAST({col} AS TIMESTAMP))"),
        Grain('day', _('day'),
              "date_trunc('day', CAST({col} AS TIMESTAMP))"),
        Grain('week', _('week'),
              "date_trunc('week', CAST({col} AS TIMESTAMP))"),
        Grain('month', _('month'),
              "date_trunc('month', CAST({col} AS TIMESTAMP))"),
        Grain('quarter', _('quarter'),
              "date_trunc('quarter', CAST({col} AS TIMESTAMP))"),
        Grain('week_ending_saturday', _('week_ending_saturday'),
              "date_add('day', 5, date_trunc('week', date_add('day', 1, "
              'CAST({col} AS TIMESTAMP))))'),
        Grain('week_start_sunday', _('week_start_sunday'),
              "date_add('day', -1, date_trunc('week', "
              "date_add('day', 1, CAST({col} AS TIMESTAMP))))"),
    )

    @classmethod
    def patch(cls):
        from pyhive import presto
        from superset.db_engines import presto as patched_presto
        presto.Cursor.cancel = patched_presto.cancel

    @classmethod
    def adjust_database_uri(cls, uri, selected_schema=None):
        database = uri.database
        if selected_schema:
            if '/' in database:
                database = database.split('/')[0] + '/' + selected_schema
            else:
                database += '/' + selected_schema
            uri.database = database
        return uri

    @classmethod
    def escape_sql(cls, sql):
        return re.sub(r'%%|%', '%%', sql)

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        tt = target_type.upper()
        if tt == 'DATE':
            return "from_iso8601_date('{}')".format(dttm.isoformat()[:10])
        if tt == 'TIMESTAMP':
            return "from_iso8601_timestamp('{}')".format(dttm.isoformat())
        return "'{}'".format(dttm.strftime('%Y-%m-%d %H:%M:%S'))

    @classmethod
    def epoch_to_dttm(cls):
        return 'from_unixtime({col})'

    @classmethod
    @cache_util.memoized_func(
        timeout=600,
        key=lambda *args, **kwargs: 'db:{}:{}'.format(args[0].id, args[1]))
    def fetch_result_sets(cls, db, datasource_type, force=False):
        """Returns the dictionary {schema : [result_set_name]}.

        Datasource_type can be 'table' or 'view'.
        Empty schema corresponds to the list of full names of the all
        tables or views: <schema>.<result_set_name>.
        """
        result_set_df = db.get_df(
            """SELECT table_schema, table_name FROM INFORMATION_SCHEMA.{}S
               ORDER BY concat(table_schema, '.', table_name)""".format(
                datasource_type.upper(),
            ),
            None)
        result_sets = defaultdict(list)
        for unused, row in result_set_df.iterrows():
            result_sets[row['table_schema']].append(row['table_name'])
            result_sets[''].append('{}.{}'.format(
                row['table_schema'], row['table_name']))
        return result_sets

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
            if query.status == QueryStatus.STOPPED:
                cursor.cancel()
                break

            if stats:
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
        :param filters: a list of filters to apply
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
                l.append("{field} = '{value}'".format(**locals()))
            where_clause = 'WHERE ' + ' AND '.join(l)

        sql = textwrap.dedent("""\
            SHOW PARTITIONS FROM {table_name}
            {where_clause}
            {order_by_clause}
            {limit_clause}
        """).format(**locals())
        return sql

    @classmethod
    def _latest_partition_from_df(cls, df):
        recs = df.to_records(index=False)
        if recs:
            return recs[0][0]

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
        '2018-01-01'
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
    cursor_execute_kwargs = {'async': True}

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
        from pyhive import hive
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
    @cache_util.memoized_func(
        timeout=600,
        key=lambda *args, **kwargs: 'db:{}:{}'.format(args[0].id, args[1]))
    def fetch_result_sets(cls, db, datasource_type, force=False):
        return BaseEngineSpec.fetch_result_sets(
            db, datasource_type, force=force)

    @staticmethod
    def create_table_from_csv(form, table):
        """Uploads a csv file and creates a superset datasource in Hive."""
        def get_column_names(filepath):
            with open(filepath, 'rb') as f:
                return csv.reader(f).next()

        table_name = form.name.data
        filename = form.csv_file.data.filename

        bucket_path = app.config['CSV_TO_HIVE_UPLOAD_BUCKET']

        if not bucket_path:
            logging.info('No upload bucket specified')
            raise Exception(
                'No upload bucket specified. You can specify one in the config file.')

        upload_prefix = app.config['CSV_TO_HIVE_UPLOAD_DIRECTORY']
        dest_path = os.path.join(table_name, filename)

        upload_path = app.config['UPLOAD_FOLDER'] + \
            secure_filename(form.csv_file.data.filename)
        column_names = get_column_names(upload_path)
        schema_definition = ', '.join(
            [s + ' STRING ' for s in column_names])

        s3 = boto3.client('s3')
        location = os.path.join('s3a://', bucket_path, upload_prefix, table_name)
        s3.upload_file(
            upload_path, 'airbnb-superset',
            os.path.join(upload_prefix, table_name, filename))
        sql = """CREATE EXTERNAL TABLE {table_name} ( {schema_definition} )
            ROW FORMAT DELIMITED FIELDS TERMINATED BY ',' STORED AS
            TEXTFILE LOCATION '{location}'""".format(**locals())

        logging.info(form.con.data)
        engine = create_engine(form.con.data)
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
            uri.database = selected_schema
        return uri

    @classmethod
    def extract_error_message(cls, e):
        try:
            msg = e.message.status.errorMessage
        except Exception:
            msg = str(e)
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
        from pyhive import hive
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
            time.sleep(5)
            polled = cursor.poll()

    @classmethod
    def where_latest_partition(
            cls, table_name, schema, database, qry, columns=None):
        try:
            col_name, value = cls.latest_partition(
                table_name, schema, database)
        except Exception:
            # table is not partitioned
            return False
        for c in columns:
            if str(c.name) == str(col_name):
                return qry.where(c == str(value))
        return False

    @classmethod
    def latest_sub_partition(cls, table_name, schema, database, **kwargs):
        # TODO(bogdan): implement`
        pass

    @classmethod
    def _latest_partition_from_df(cls, df):
        """Hive partitions look like ds={partition name}"""
        return df.ix[:, 0].max().split('=')[1]

    @classmethod
    def _partition_query(
            cls, table_name, limit=0, order_by=None, filters=None):
        return 'SHOW PARTITIONS {table_name}'.format(**locals())

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


class MssqlEngineSpec(BaseEngineSpec):
    engine = 'mssql'
    epoch_to_dttm = "dateadd(S, {col}, '1970-01-01')"

    time_grains = (
        Grain('Time Column', _('Time Column'), '{col}'),
        Grain('second', _('second'), 'DATEADD(second, '
              "DATEDIFF(second, '2000-01-01', {col}), '2000-01-01')"),
        Grain('minute', _('minute'), 'DATEADD(minute, '
              'DATEDIFF(minute, 0, {col}), 0)'),
        Grain('5 minute', _('5 minute'), 'DATEADD(minute, '
              'DATEDIFF(minute, 0, {col}) / 5 * 5, 0)'),
        Grain('half hour', _('half hour'), 'DATEADD(minute, '
              'DATEDIFF(minute, 0, {col}) / 30 * 30, 0)'),
        Grain('hour', _('hour'), 'DATEADD(hour, '
              'DATEDIFF(hour, 0, {col}), 0)'),
        Grain('day', _('day'), 'DATEADD(day, '
              'DATEDIFF(day, 0, {col}), 0)'),
        Grain('week', _('week'), 'DATEADD(week, '
              'DATEDIFF(week, 0, {col}), 0)'),
        Grain('month', _('month'), 'DATEADD(month, '
              'DATEDIFF(month, 0, {col}), 0)'),
        Grain('quarter', _('quarter'), 'DATEADD(quarter, '
              'DATEDIFF(quarter, 0, {col}), 0)'),
        Grain('year', _('year'), 'DATEADD(year, '
              'DATEDIFF(year, 0, {col}), 0)'),
    )

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        return "CONVERT(DATETIME, '{}', 126)".format(dttm.isoformat())


class RedshiftEngineSpec(PostgresEngineSpec):
    engine = 'redshift'


class OracleEngineSpec(PostgresEngineSpec):
    engine = 'oracle'

    time_grains = (
        Grain('Time Column', _('Time Column'), '{col}'),
        Grain('minute', _('minute'),
              "TRUNC(TO_DATE({col}), 'MI')"),
        Grain('hour', _('hour'),
              "TRUNC(TO_DATE({col}), 'HH')"),
        Grain('day', _('day'),
              "TRUNC(TO_DATE({col}), 'DDD')"),
        Grain('week', _('week'),
              "TRUNC(TO_DATE({col}), 'WW')"),
        Grain('month', _('month'),
              "TRUNC(TO_DATE({col}), 'MONTH')"),
        Grain('quarter', _('quarter'),
              "TRUNC(TO_DATE({col}), 'Q')"),
        Grain('year', _('year'),
              "TRUNC(TO_DATE({col}), 'YEAR')"),
    )

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        return (
            """TO_TIMESTAMP('{}', 'YYYY-MM-DD'T'HH24:MI:SS.ff6')"""
        ).format(dttm.isoformat())


class VerticaEngineSpec(PostgresEngineSpec):
    engine = 'vertica'


class AthenaEngineSpec(BaseEngineSpec):
    engine = 'awsathena'

    time_grains = (
        Grain('Time Column', _('Time Column'), '{col}'),
        Grain('second', _('second'),
              "date_trunc('second', CAST({col} AS TIMESTAMP))"),
        Grain('minute', _('minute'),
              "date_trunc('minute', CAST({col} AS TIMESTAMP))"),
        Grain('hour', _('hour'),
              "date_trunc('hour', CAST({col} AS TIMESTAMP))"),
        Grain('day', _('day'),
              "date_trunc('day', CAST({col} AS TIMESTAMP))"),
        Grain('week', _('week'),
              "date_trunc('week', CAST({col} AS TIMESTAMP))"),
        Grain('month', _('month'),
              "date_trunc('month', CAST({col} AS TIMESTAMP))"),
        Grain('quarter', _('quarter'),
              "date_trunc('quarter', CAST({col} AS TIMESTAMP))"),
        Grain('week_ending_saturday', _('week_ending_saturday'),
              "date_add('day', 5, date_trunc('week', date_add('day', 1, "
              'CAST({col} AS TIMESTAMP))))'),
        Grain('week_start_sunday', _('week_start_sunday'),
              "date_add('day', -1, date_trunc('week', "
              "date_add('day', 1, CAST({col} AS TIMESTAMP))))"),
    )

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


class ClickHouseEngineSpec(BaseEngineSpec):
    """Dialect for ClickHouse analytical DB."""

    engine = 'clickhouse'

    time_secondary_columns = True
    time_groupby_inline = True
    time_grains = (
        Grain('Time Column', _('Time Column'), '{col}'),
        Grain('minute', _('minute'),
              'toStartOfMinute(toDateTime({col}))'),
        Grain('5 minute', _('5 minute'),
              'toDateTime(intDiv(toUInt32(toDateTime({col})), 300)*300)'),
        Grain('10 minute', _('10 minute'),
              'toDateTime(intDiv(toUInt32(toDateTime({col})), 600)*600)'),
        Grain('hour', _('hour'),
              'toStartOfHour(toDateTime({col}))'),
        Grain('day', _('day'),
              'toStartOfDay(toDateTime({col}))'),
        Grain('month', _('month'),
              'toStartOfMonth(toDateTime({col}))'),
        Grain('quarter', _('quarter'),
              'toStartOfQuarter(toDateTime({col}))'),
        Grain('year', _('year'),
              'toStartOfYear(toDateTime({col}))'),
    )

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

    time_grains = (
        Grain('Time Column', _('Time Column'), '{col}'),
        Grain('second', _('second'), 'TIMESTAMP_TRUNC({col}, SECOND)'),
        Grain('minute', _('minute'), 'TIMESTAMP_TRUNC({col}, MINUTE)'),
        Grain('hour', _('hour'), 'TIMESTAMP_TRUNC({col}, HOUR)'),
        Grain('day', _('day'), 'TIMESTAMP_TRUNC({col}, DAY)'),
        Grain('week', _('week'), 'TIMESTAMP_TRUNC({col}, WEEK)'),
        Grain('month', _('month'), 'TIMESTAMP_TRUNC({col}, MONTH)'),
        Grain('quarter', _('quarter'), 'TIMESTAMP_TRUNC({col}, QUARTER)'),
        Grain('year', _('year'), 'TIMESTAMP_TRUNC({col}, YEAR)'),
    )

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        tt = target_type.upper()
        if tt == 'DATE':
            return "{}'".format(dttm.strftime('%Y-%m-%d'))
        return "'{}'".format(dttm.strftime('%Y-%m-%d %H:%M:%S'))


class ImpalaEngineSpec(BaseEngineSpec):
    """Engine spec for Cloudera's Impala"""

    engine = 'impala'

    time_grains = (
        Grain('Time Column', _('Time Column'), '{col}'),
        Grain('minute', _('minute'), "TRUNC({col}, 'MI')"),
        Grain('hour', _('hour'), "TRUNC({col}, 'HH')"),
        Grain('day', _('day'), "TRUNC({col}, 'DD')"),
        Grain('week', _('week'), "TRUNC({col}, 'WW')"),
        Grain('month', _('month'), "TRUNC({col}, 'MONTH')"),
        Grain('quarter', _('quarter'), "TRUNC({col}, 'Q')"),
        Grain('year', _('year'), "TRUNC({col}, 'YYYY')"),
    )

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        tt = target_type.upper()
        if tt == 'DATE':
            return "{}'".format(dttm.strftime('%Y-%m-%d'))
        return "'{}'".format(dttm.strftime('%Y-%m-%d %H:%M:%S'))

    @classmethod
    def get_schema_names(cls, inspector):
        schemas = [row[0] for row in inspector.engine.execute('SHOW SCHEMAS')
                   if not row[0].startswith('_')]
        return schemas


engines = {
    o.engine: o for o in globals().values()
    if inspect.isclass(o) and issubclass(o, BaseEngineSpec)}
