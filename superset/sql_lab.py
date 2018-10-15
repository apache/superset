# pylint: disable=C,R,W
from datetime import datetime
import logging
from time import sleep
import uuid

from celery.exceptions import SoftTimeLimitExceeded
from contextlib2 import contextmanager
import simplejson as json
import sqlalchemy
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from superset import app, dataframe, db, results_backend, security_manager
from superset.models.sql_lab import Query
from superset.sql_parse import SupersetQuery
from superset.utils import (
    get_celery_app,
    json_iso_dttm_ser,
    now_as_float,
    QueryStatus,
    zlib_compress,
)

config = app.config
celery_app = get_celery_app(config)
stats_logger = app.config.get('STATS_LOGGER')
SQLLAB_TIMEOUT = config.get('SQLLAB_ASYNC_TIME_LIMIT_SEC', 600)


class SqlLabException(Exception):
    pass


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


@celery_app.task(bind=True, soft_time_limit=SQLLAB_TIMEOUT)
def get_sql_results(
    ctask, query_id, rendered_query, return_results=True, store_results=False,
        user_name=None, start_time=None):
    """Executes the sql query returns the results."""
    with session_scope(not ctask.request.called_directly) as session:

        try:
            return execute_sql(
                ctask, query_id, rendered_query, return_results, store_results, user_name,
                session=session, start_time=start_time)
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
    user_name=None, session=None, start_time=None,
):
    """Executes the sql query returns the results."""
    if store_results and start_time:
        # only asynchronous queries
        stats_logger.timing(
            'sqllab.query.time_pending', now_as_float() - start_time)
    query = get_query(query_id, session)
    payload = dict(query_id=query_id)

    database = query.database
    db_engine_spec = database.db_engine_spec
    db_engine_spec.patch()

    def handle_error(msg):
        """Local method handling error while processing the SQL"""
        troubleshooting_link = config['TROUBLESHOOTING_LINK']
        query.error_message = msg
        query.status = QueryStatus.FAILED
        query.tmp_table_name = None
        session.commit()
        payload.update({
            'status': query.status,
            'error': msg,
        })
        if troubleshooting_link:
            payload['link'] = troubleshooting_link
        return payload

    if store_results and not results_backend:
        return handle_error("Results backend isn't configured.")

    # Limit enforced only for retrieving the data, not for the CTA queries.
    superset_query = SupersetQuery(rendered_query)
    executed_sql = superset_query.stripped()
    SQL_MAX_ROWS = app.config.get('SQL_MAX_ROW')
    if not superset_query.is_readonly() and not database.allow_dml:
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
    if (superset_query.is_select() and SQL_MAX_ROWS and
            (not query.limit or query.limit > SQL_MAX_ROWS)):
        query.limit = SQL_MAX_ROWS
        executed_sql = database.apply_limit_to_sql(executed_sql, query.limit)

    # Hook to allow environment-specific mutation (usually comments) to the SQL
    SQL_QUERY_MUTATOR = config.get('SQL_QUERY_MUTATOR')
    if SQL_QUERY_MUTATOR:
        executed_sql = SQL_QUERY_MUTATOR(
            executed_sql, user_name, security_manager, database)

    query.executed_sql = executed_sql
    query.status = QueryStatus.RUNNING
    query.start_running_time = now_as_float()
    session.merge(query)
    session.commit()
    logging.info("Set query to 'running'")
    conn = None
    try:
        engine = database.get_sqla_engine(
            schema=query.schema,
            nullpool=True,
            user_name=user_name,
        )
        conn = engine.raw_connection()
        cursor = conn.cursor()
        logging.info('Running query: \n{}'.format(executed_sql))
        logging.info(query.executed_sql)
        query_start_time = now_as_float()
        db_engine_spec.execute(cursor, query.executed_sql, async_=True)
        logging.info('Handling cursor')
        db_engine_spec.handle_cursor(cursor, query, session)
        logging.info('Fetching data: {}'.format(query.to_dict()))
        stats_logger.timing(
            'sqllab.query.time_executing_query',
            now_as_float() - query_start_time)
        fetching_start_time = now_as_float()
        data = db_engine_spec.fetch_data(cursor, query.limit)
        stats_logger.timing(
            'sqllab.query.time_fetching_results',
            now_as_float() - fetching_start_time)
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

    if query.status == QueryStatus.STOPPED:
        return handle_error('The query has been stopped')

    cdf = dataframe.SupersetDataFrame(data, cursor_description, db_engine_spec)

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
    query.end_time = now_as_float()
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
        write_to_results_backend_start = now_as_float()
        json_payload = json.dumps(
            payload, default=json_iso_dttm_ser, ignore_nan=True)
        cache_timeout = database.cache_timeout
        if cache_timeout is None:
            cache_timeout = config.get('CACHE_DEFAULT_TIMEOUT', 0)
        results_backend.set(key, zlib_compress(json_payload), cache_timeout)
        query.results_key = key
        stats_logger.timing(
            'sqllab.query.results_backend_write',
            now_as_float() - write_to_results_backend_start)
    session.merge(query)
    session.commit()

    if return_results:
        return payload
