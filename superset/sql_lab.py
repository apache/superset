# -*- coding: utf-8 -*-
# pylint: disable=C,R,W
from __future__ import absolute_import, division, print_function, unicode_literals

from datetime import datetime
import json
import logging
from time import sleep
import uuid

from celery.exceptions import SoftTimeLimitExceeded
from contextlib2 import contextmanager
import numpy as np
import pandas as pd
import sqlalchemy
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from superset import app, dataframe, db, results_backend, security_manager, utils
from superset.db_engine_specs import LimitMethod
from superset.models.sql_lab import Query
from superset.sql_parse import SupersetQuery
from superset.utils import get_celery_app, QueryStatus

config = app.config
celery_app = get_celery_app(config)
stats_logger = app.config.get('STATS_LOGGER')
SQLLAB_TIMEOUT = config.get('SQLLAB_ASYNC_TIME_LIMIT_SEC', 600)


class SqlLabException(Exception):
    pass


def dedup(l, suffix='__'):
    """De-duplicates a list of string by suffixing a counter

    Always returns the same number of entries as provided, and always returns
    unique values.

    >>> print(','.join(dedup(['foo', 'bar', 'bar', 'bar'])))
    foo,bar,bar__1,bar__2
    """
    new_l = []
    seen = {}
    for s in l:
        if s in seen:
            seen[s] += 1
            s += suffix + str(seen[s])
        else:
            seen[s] = 0
        new_l.append(s)
    return new_l


def get_query(query_id, session, retry_count=5):
    """attemps to get the query and retry if it cannot"""
    query = None
    attempt = 0
    while not query and attempt < retry_count:
        try:
            query = session.query(Query).filter_by(id=query_id).one()
        except Exception:
            attempt += 1
            logging.error(
                'Query with id `{}` could not be retrieved'.format(query_id))
            stats_logger.incr('error_attempting_orm_query_' + str(attempt))
            logging.error('Sleeping for a sec before retrying...')
            sleep(1)
    if not query:
        stats_logger.incr('error_failed_at_getting_orm_query')
        raise SqlLabException('Failed at getting query')
    return query


@contextmanager
def session_scope(nullpool):
    """Provide a transactional scope around a series of operations."""
    if nullpool:
        engine = sqlalchemy.create_engine(
            app.config.get('SQLALCHEMY_DATABASE_URI'), poolclass=NullPool)
        session_class = sessionmaker()
        session_class.configure(bind=engine)
        session = session_class()
    else:
        session = db.session()
        session.commit()  # HACK

    try:
        yield session
        session.commit()
    except Exception as e:
        session.rollback()
        logging.exception(e)
        raise
    finally:
        session.close()


def convert_results_to_df(cursor_description, data):
    """Convert raw query results to a DataFrame."""
    column_names = (
        [col[0] for col in cursor_description] if cursor_description else [])
    column_names = dedup(column_names)

    # check whether the result set has any nested dict columns
    if data:
        first_row = data[0]
        has_dict_col = any([isinstance(c, dict) for c in first_row])
        df_data = list(data) if has_dict_col else np.array(data, dtype=object)
    else:
        df_data = []

    cdf = dataframe.SupersetDataFrame(
        pd.DataFrame(df_data, columns=column_names))

    return cdf


@celery_app.task(bind=True, soft_time_limit=SQLLAB_TIMEOUT)
def get_sql_results(
    ctask, query_id, rendered_query, return_results=True, store_results=False,
        user_name=None):
    """Executes the sql query returns the results."""
    with session_scope(not ctask.request.called_directly) as session:

        try:
            return execute_sql(
                ctask, query_id, rendered_query, return_results, store_results, user_name,
                session=session)
        except Exception as e:
            logging.exception(e)
            stats_logger.incr('error_sqllab_unhandled')
            query = get_query(query_id, session)
            query.error_message = str(e)
            query.status = QueryStatus.FAILED
            query.tmp_table_name = None
            session.commit()
            raise


def execute_sql(
    ctask, query_id, rendered_query, return_results=True, store_results=False,
    user_name=None, session=None,
):
    """Executes the sql query returns the results."""

    query = get_query(query_id, session)
    payload = dict(query_id=query_id)

    database = query.database
    db_engine_spec = database.db_engine_spec
    db_engine_spec.patch()

    def handle_error(msg):
        """Local method handling error while processing the SQL"""
        troubleshooting_link = config['TROUBLESHOOTING_LINK']
        msg = 'Error: {}. You can find common superset errors and their \
            resolutions at: {}'.format(msg, troubleshooting_link) \
            if troubleshooting_link else msg
        query.error_message = msg
        query.status = QueryStatus.FAILED
        query.tmp_table_name = None
        session.commit()
        payload.update({
            'status': query.status,
            'error': msg,
        })
        return payload

    if store_results and not results_backend:
        return handle_error("Results backend isn't configured.")

    # Limit enforced only for retrieving the data, not for the CTA queries.
    superset_query = SupersetQuery(rendered_query)
    executed_sql = superset_query.stripped()
    if not superset_query.is_select() and not database.allow_dml:
        return handle_error(
            'Only `SELECT` statements are allowed against this database')
    if query.select_as_cta:
        if not superset_query.is_select():
            return handle_error(
                'Only `SELECT` statements can be used with the CREATE TABLE '
                'feature.')
        if not query.tmp_table_name:
            start_dttm = datetime.fromtimestamp(query.start_time)
            query.tmp_table_name = 'tmp_{}_table_{}'.format(
                query.user_id, start_dttm.strftime('%Y_%m_%d_%H_%M_%S'))
        executed_sql = superset_query.as_create_table(query.tmp_table_name)
        query.select_as_cta_used = True
    elif (query.limit and superset_query.is_select() and
            db_engine_spec.limit_method == LimitMethod.WRAP_SQL):
        executed_sql = database.wrap_sql_limit(executed_sql, query.limit)
        query.limit_used = True

    # Hook to allow environment-specific mutation (usually comments) to the SQL
    SQL_QUERY_MUTATOR = config.get('SQL_QUERY_MUTATOR')
    if SQL_QUERY_MUTATOR:
        executed_sql = SQL_QUERY_MUTATOR(
            executed_sql, user_name, security_manager, database)

    query.executed_sql = executed_sql
    query.status = QueryStatus.RUNNING
    query.start_running_time = utils.now_as_float()
    session.merge(query)
    session.commit()
    logging.info("Set query to 'running'")
    conn = None
    try:
        engine = database.get_sqla_engine(
            schema=query.schema,
            nullpool=not ctask.request.called_directly,
            user_name=user_name,
        )
        conn = engine.raw_connection()
        cursor = conn.cursor()
        logging.info('Running query: \n{}'.format(executed_sql))
        logging.info(query.executed_sql)
        cursor.execute(query.executed_sql,
                       **db_engine_spec.cursor_execute_kwargs)
        logging.info('Handling cursor')
        db_engine_spec.handle_cursor(cursor, query, session)
        logging.info('Fetching data: {}'.format(query.to_dict()))
        data = db_engine_spec.fetch_data(cursor, query.limit)
    except SoftTimeLimitExceeded as e:
        logging.exception(e)
        if conn is not None:
            conn.close()
        return handle_error(
            "SQL Lab timeout. This environment's policy is to kill queries "
            'after {} seconds.'.format(SQLLAB_TIMEOUT))
    except Exception as e:
        logging.exception(e)
        if conn is not None:
            conn.close()
        return handle_error(db_engine_spec.extract_error_message(e))

    logging.info('Fetching cursor description')
    cursor_description = cursor.description

    if conn is not None:
        conn.commit()
        conn.close()

    if query.status == utils.QueryStatus.STOPPED:
        return handle_error('The query has been stopped')

    cdf = convert_results_to_df(cursor_description, data)

    query.rows = cdf.size
    query.progress = 100
    query.status = QueryStatus.SUCCESS
    if query.select_as_cta:
        query.select_sql = '{}'.format(
            database.select_star(
                query.tmp_table_name,
                limit=query.limit,
                schema=database.force_ctas_schema,
                show_cols=False,
                latest_partition=False))
    query.end_time = utils.now_as_float()
    session.merge(query)
    session.flush()

    payload.update({
        'status': query.status,
        'data': cdf.data if cdf.data else [],
        'columns': cdf.columns if cdf.columns else [],
        'query': query.to_dict(),
    })
    if store_results:
        key = '{}'.format(uuid.uuid4())
        logging.info('Storing results in results backend, key: {}'.format(key))
        json_payload = json.dumps(payload, default=utils.json_iso_dttm_ser)
        cache_timeout = database.cache_timeout
        if cache_timeout is None:
            cache_timeout = config.get('CACHE_DEFAULT_TIMEOUT', 0)
        results_backend.set(key, utils.zlib_compress(json_payload), cache_timeout)
        query.results_key = key
        query.end_result_backend_time = utils.now_as_float()

    session.merge(query)
    session.commit()

    if return_results:
        return payload
