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
from superset import utils

import inspect
import re
import sqlparse
import textwrap
import time

from superset import cache_util
from sqlalchemy import select
from sqlalchemy.sql import text
from superset.utils import SupersetTemplateException
from flask_babel import lazy_gettext as _

Grain = namedtuple('Grain', 'name label function')


class LimitMethod(object):
    """Enum the ways that limits can be applied"""
    FETCH_MANY = 'fetch_many'
    WRAP_SQL = 'wrap_sql'


class BaseEngineSpec(object):
    engine = 'base'  # str as defined in sqlalchemy.engine.engine
    cursor_execute_kwargs = {}
    time_grains = tuple()
    limit_method = LimitMethod.FETCH_MANY

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

    @classmethod
    def patch(cls):
        pass

    @classmethod
    def where_latest_partition(
            cls, table_name, schema, database, qry, columns=None):
        return False

    @classmethod
    def select_star(cls, my_db, table_name, schema=None, limit=100,
                    show_cols=False, indent=True):
        fields = '*'
        table = my_db.get_table(table_name, schema=schema)
        if show_cols:
            fields = [my_db.get_quoter()(c.name) for c in table.columns]
        full_table_name = table_name
        if schema:
            full_table_name = schema + '.' + table_name
        qry = select(fields)
        if limit:
            qry = qry.limit(limit)
        partition_query = cls.where_latest_partition(
            table_name, schema, my_db, qry, columns=table.columns)
        # if not partition_query condition fails.
        if partition_query == False:  # noqa
            qry = qry.select_from(text(full_table_name))
        else:
            qry = partition_query
        sql = my_db.compile_sqla_query(qry)
        if indent:
            sql = sqlparse.format(sql, reindent=True)
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
        full_table_name = table_name
        if schema_name and '.' not in table_name:
            full_table_name = "{}.{}".format(schema_name, table_name)
        pql = cls._partition_query(full_table_name)
        col_name, latest_part = cls.latest_partition(
            table_name, schema_name, database)
        return {
            'partitions': {
                'cols': cols,
                'latest': {col_name: latest_part},
                'partitionQuery': pql,
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
        limit_clause = "LIMIT {}".format(limit) if limit else ''
        order_by_clause = ''
        if order_by:
            l = []
            for field, desc in order_by:
                l.append(field + ' DESC' if desc else '')
            order_by_clause = 'ORDER BY ' + ', '.join(l)

        where_clause = ''
        if filters:
            l = []
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
        return df.to_records(index=False)[0][0]

    @classmethod
    def latest_partition(cls, table_name, schema, database):
        """Returns col name and the latest (max) partition value for a table

        :param table_name: the name of the table
        :type table_name: str
        :param schema: schema / database / namespace
        :type schema: str
        :param database: database query will be run against
        :type database: models.Database

        >>> latest_partition('foo_table')
        '2018-01-01'
        """
        indexes = database.get_indexes(table_name, schema)
        if len(indexes[0]['column_names']) < 1:
            raise SupersetTemplateException(
                "The table should have one partitioned field")
        elif len(indexes[0]['column_names']) > 1:
            raise SupersetTemplateException(
                "The table should have a single partitioned field "
                "to use this function. You may want to use "
                "`presto.latest_sub_partition`")
        part_field = indexes[0]['column_names'][0]
        sql = cls._partition_query(table_name, 1, [(part_field, True)])
        df = database.get_df(sql, schema)
        return part_field, cls._latest_partition_from_df(df)

    @classmethod
    def latest_sub_partition(cls, table_name, schema, database,  **kwargs):
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
                msg = "Field [{k}] is not part of the portioning key"
                raise SupersetTemplateException(msg)
        if len(kwargs.keys()) != len(part_fields) - 1:
            msg = (
                "A filter needs to be specified for {} out of the "
                "{} fields."
            ).format(len(part_fields)-1, len(part_fields))
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

    @classmethod
    def patch(cls):
        from pyhive import hive
        from superset.db_engines import hive as patched_hive
        from pythrifthiveapi.TCLIService import (
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

    @classmethod
    def progress(cls, logs):
        # 17/02/07 19:36:38 INFO ql.Driver: Total jobs = 5
        jobs_stats_r = re.compile(
            r'.*INFO.*Total jobs = (?P<max_jobs>[0-9]+)')
        # 17/02/07 19:37:08 INFO ql.Driver: Launching Job 2 out of 5
        launching_job_r = re.compile(
            '.*INFO.*Launching Job (?P<job_number>[0-9]+) out of '
            '(?P<max_jobs>[0-9]+)')
        # 17/02/07 19:36:58 INFO exec.Task: 2017-02-07 19:36:58,152 Stage-18
        # map = 0%,  reduce = 0%
        stage_progress = re.compile(
            r'.*INFO.*Stage-(?P<stage_number>[0-9]+).*'
            r'map = (?P<map_progress>[0-9]+)%.*'
            r'reduce = (?P<reduce_progress>[0-9]+)%.*')
        total_jobs = None
        current_job = None
        stages = {}
        lines = logs.splitlines()
        for line in lines:
            match = jobs_stats_r.match(line)
            if match:
                total_jobs = int(match.groupdict()['max_jobs'])
            match = launching_job_r.match(line)
            if match:
                current_job = int(match.groupdict()['job_number'])
                stages = {}
            match = stage_progress.match(line)
            if match:
                stage_number = int(match.groupdict()['stage_number'])
                map_progress = int(match.groupdict()['map_progress'])
                reduce_progress = int(match.groupdict()['reduce_progress'])
                stages[stage_number] = (map_progress + reduce_progress) / 2

        if not total_jobs or not current_job:
            return 0
        stage_progress = sum(
            stages.values()) / len(stages.values()) if stages else 0

        progress = (
            100 * (current_job - 1) / total_jobs + stage_progress / total_jobs
        )
        return int(progress)

    @classmethod
    def handle_cursor(cls, cursor, query, session):
        """Updates progress information"""
        from pyhive import hive
        print("PATCHED TCLIService {}".format(hive.TCLIService.__file__))
        unfinished_states = (
            hive.ttypes.TOperationState.INITIALIZED_STATE,
            hive.ttypes.TOperationState.RUNNING_STATE,
        )
        polled = cursor.poll()
        while polled.operationState in unfinished_states:
            resp = cursor.fetch_logs()
            if resp and resp.log:
                progress = cls.progress(resp.log)
                if progress > query.progress:
                    query.progress = progress
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
    def latest_sub_partition(cls, table_name, **kwargs):
        # TODO(bogdan): implement`
        pass

    @classmethod
    def _latest_partition_from_df(cls, df):
        """Hive partitions look like ds={partition name}"""
        return df.ix[:, 0].max().split('=')[1]

    @classmethod
    def _partition_query(
            cls, table_name, limit=0, order_by=None, filters=None):
        return "SHOW PARTITIONS {table_name}".format(**locals())


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
