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

from collections import namedtuple, defaultdict
from flask_babel import lazy_gettext as _
from superset import utils

import inspect
import textwrap
import time

from superset import cache_util

Grain = namedtuple('Grain', 'name label function')


class LimitMethod(object):
    """Enum the ways that limits can be applied"""
    FETCH_MANY = 'fetch_many'
    WRAP_SQL = 'wrap_sql'


class BaseEngineSpec(object):
    engine = 'base'  # str as defined in sqlalchemy.engine.engine
    time_grains = tuple()
    limit_method = LimitMethod.FETCH_MANY

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
            result_sets[""] = all_result_sets
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
    def sql_preprocessor(cls, sql):
        """If the SQL needs to be altered prior to running it

        For example Presto needs to double `%` characters
        """
        return sql


class PostgresEngineSpec(BaseEngineSpec):
    engine = 'postgresql'

    time_grains = (
        Grain("Time Column", _('Time Column'), "{col}"),
        Grain("second", _('second'), "DATE_TRUNC('second', {col})"),
        Grain("minute", _('minute'), "DATE_TRUNC('minute', {col})"),
        Grain("hour", _('hour'), "DATE_TRUNC('hour', {col})"),
        Grain("day", _('day'), "DATE_TRUNC('day', {col})"),
        Grain("week", _('week'), "DATE_TRUNC('week', {col})"),
        Grain("month", _('month'), "DATE_TRUNC('month', {col})"),
        Grain("quarter", _('quarter'), "DATE_TRUNC('quarter', {col})"),
        Grain("year", _('year'), "DATE_TRUNC('year', {col})"),
    )

    @classmethod
    def epoch_to_dttm(cls):
        return "(timestamp 'epoch' + {col} * interval '1 second')"

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        return "'{}'".format(dttm.strftime('%Y-%m-%d %H:%M:%S'))


class SqliteEngineSpec(BaseEngineSpec):
    engine = 'sqlite'
    time_grains = (
        Grain('Time Column', _('Time Column'), '{col}'),
        Grain('day', _('day'), 'DATE({col})'),
        Grain("week", _('week'),
              "DATE({col}, -strftime('%w', {col}) || ' days')"),
        Grain("month", _('month'),
              "DATE({col}, -strftime('%d', {col}) || ' days')"),
    )

    @classmethod
    def epoch_to_dttm(cls):
        return "datetime({col}, 'unixepoch')"

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        iso = dttm.isoformat().replace('T', ' ')
        if '.' not in iso:
            iso += '.000000'
        return "'{}'".format(iso)


class MySQLEngineSpec(BaseEngineSpec):
    engine = 'mysql'
    time_grains = (
        Grain('Time Column', _('Time Column'), '{col}'),
        Grain("second", _('second'), "DATE_ADD(DATE({col}), "
              "INTERVAL (HOUR({col})*60*60 + MINUTE({col})*60"
              " + SECOND({col})) SECOND)"),
        Grain("minute", _('minute'), "DATE_ADD(DATE({col}), "
              "INTERVAL (HOUR({col})*60 + MINUTE({col})) MINUTE)"),
        Grain("hour", _('hour'), "DATE_ADD(DATE({col}), "
              "INTERVAL HOUR({col}) HOUR)"),
        Grain('day', _('day'), 'DATE({col})'),
        Grain("week", _('week'), "DATE(DATE_SUB({col}, "
              "INTERVAL DAYOFWEEK({col}) - 1 DAY))"),
        Grain("month", _('month'), "DATE(DATE_SUB({col}, "
              "INTERVAL DAYOFMONTH({col}) - 1 DAY))"),
        Grain("quarter", _('quarter'), "MAKEDATE(YEAR({col}), 1) "
              "+ INTERVAL QUARTER({col}) QUARTER - INTERVAL 1 QUARTER"),
        Grain("year", _('year'), "DATE(DATE_SUB({col}, "
              "INTERVAL DAYOFYEAR({col}) - 1 DAY))"),
        Grain("week_start_monday", _('week_start_monday'),
              "DATE(DATE_SUB({col}, "
              "INTERVAL DAYOFWEEK(DATE_SUB({col}, INTERVAL 1 DAY)) - 1 DAY))"),
    )

    @classmethod
    def convert_dttm(cls, target_type, dttm):
        if target_type.upper() in ('DATETIME', 'DATE'):
            return "STR_TO_DATE('{}', '%Y-%m-%d %H:%i:%s')".format(
                dttm.strftime('%Y-%m-%d %H:%M:%S'))
        return "'{}'".format(dttm.strftime('%Y-%m-%d %H:%M:%S'))

    @classmethod
    def epoch_to_dttm(cls):
        return "from_unixtime({col})"


class PrestoEngineSpec(BaseEngineSpec):
    engine = 'presto'

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
        Grain("week_ending_saturday", _('week_ending_saturday'),
              "date_add('day', 5, date_trunc('week', date_add('day', 1, "
              "CAST({col} AS TIMESTAMP))))"),
        Grain("week_start_sunday", _('week_start_sunday'),
              "date_add('day', -1, date_trunc('week', "
              "date_add('day', 1, CAST({col} AS TIMESTAMP))))"),
    )

    @classmethod
    def sql_preprocessor(cls, sql):
        return sql.replace('%', '%%')

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
        return "from_unixtime({col})"

    @staticmethod
    def show_partition_pql(
            table_name, schema_name=None, order_by=None, limit=100):
        if schema_name:
            table_name = schema_name + '.' + table_name
        order_by = order_by or []
        order_by_clause = ''
        if order_by:
            order_by_clause = "ORDER BY " + ', '.join(order_by) + " DESC"

        limit_clause = ''
        if limit:
            limit_clause = "LIMIT {}".format(limit)

        return textwrap.dedent("""\
        SHOW PARTITIONS
        FROM {table_name}
        {order_by_clause}
        {limit_clause}
        """).format(**locals())

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
                datasource_type.upper()), None)
        result_sets = defaultdict(list)
        for unused, row in result_set_df.iterrows():
            result_sets[row['table_schema']].append(row['table_name'])
            result_sets[""].append('{}.{}'.format(
                row['table_schema'], row['table_name']))
        return result_sets

    @classmethod
    def extra_table_metadata(cls, database, table_name, schema_name):
        indexes = database.get_indexes(table_name, schema_name)
        if not indexes:
            return {}
        cols = indexes[0].get('column_names', [])
        pql = cls.show_partition_pql(table_name, schema_name, cols)
        df = database.get_df(pql, schema_name)
        latest_part = df.to_dict(orient='records')[0] if not df.empty else None

        partition_query = cls.show_partition_pql(table_name, schema_name, cols)
        return {
            'partitions': {
                'cols': cols,
                'latest': latest_part,
                'partitionQuery': partition_query,
            }
        }

    @classmethod
    def handle_cursor(cls, cursor, query, session):
        """Updates progress information"""
        polled = cursor.poll()
        # poll returns dict -- JSON status information or ``None``
        # if the query is done
        # https://github.com/dropbox/PyHive/blob/
        # b34bdbf51378b3979eaf5eca9e956f06ddc36ca0/pyhive/presto.py#L178
        while polled:
            # Update the object and wait for the kill signal.
            stats = polled.get('stats', {})
            if stats:
                completed_splits = float(stats.get('completedSplits'))
                total_splits = float(stats.get('totalSplits'))
                if total_splits and completed_splits:
                    progress = 100 * (completed_splits / total_splits)
                    if progress > query.progress:
                        query.progress = progress
                    session.commit()
            time.sleep(1)
            polled = cursor.poll()

    @classmethod
    def extract_error_message(cls, e):
        if hasattr(e, 'orig') \
           and type(e.orig).__name__ == 'DatabaseError' \
           and isinstance(e.orig[0], dict):
            error_dict = e.orig[0]
            e = '{} at {}: {}'.format(
                error_dict['errorName'],
                error_dict['errorLocation'],
                error_dict['message']
            )
        return utils.error_msg_from_exception(e)


class MssqlEngineSpec(BaseEngineSpec):
    engine = 'mssql'
    epoch_to_dttm = "dateadd(S, {col}, '1970-01-01')"

    time_grains = (
        Grain("Time Column", _('Time Column'), "{col}"),
        Grain("second", _('second'), "DATEADD(second, "
              "DATEDIFF(second, '2000-01-01', {col}), '2000-01-01')"),
        Grain("minute", _('minute'), "DATEADD(minute, "
              "DATEDIFF(minute, 0, {col}), 0)"),
        Grain("5 minute", _('5 minute'), "DATEADD(minute, "
              "DATEDIFF(minute, 0, {col}) / 5 * 5, 0)"),
        Grain("half hour", _('half hour'), "DATEADD(minute, "
              "DATEDIFF(minute, 0, {col}) / 30 * 30, 0)"),
        Grain("hour", _('hour'), "DATEADD(hour, "
              "DATEDIFF(hour, 0, {col}), 0)"),
        Grain("day", _('day'), "DATEADD(day, "
              "DATEDIFF(day, 0, {col}), 0)"),
        Grain("week", _('week'), "DATEADD(week, "
              "DATEDIFF(week, 0, {col}), 0)"),
        Grain("month", _('month'), "DATEADD(month, "
              "DATEDIFF(month, 0, {col}), 0)"),
        Grain("quarter", _('quarter'), "DATEADD(quarter, "
              "DATEDIFF(quarter, 0, {col}), 0)"),
        Grain("year", _('year'), "DATEADD(year, "
              "DATEDIFF(year, 0, {col}), 0)"),
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
            """TO_TIMESTAMP('{}', 'YYYY-MM-DD"T"HH24:MI:SS.ff6')"""
        ).format(dttm.isoformat())


class VerticaEngineSpec(PostgresEngineSpec):
    engine = 'vertica'

engines = {
    o.engine: o for o in globals().values()
    if inspect.isclass(o) and issubclass(o, BaseEngineSpec)}
