import celery
from time import sleep
from datetime import datetime
import json
import logging
import pandas as pd
import sqlalchemy
import uuid

from sqlalchemy.pool import NullPool
from sqlalchemy.orm import sessionmaker

from superset import (
    app, db, utils, dataframe, results_backend)
from superset.models.sql_lab import Query
from superset.sql_parse import SupersetQuery
from superset.db_engine_specs import LimitMethod
from superset.jinja_context import get_template_processor
from superset.utils import QueryStatus

celery_app = celery.Celery(config_source=app.config.get('CELERY_CONFIG'))


def dedup(l, suffix='__'):
    """De-duplicates a list of string by suffixing a counter

    Always returns the same number of entries as provided, and always returns
    unique values.

    >>> dedup(['foo', 'bar', 'bar', 'bar'])
    ['foo', 'bar', 'bar__1', 'bar__2']
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


@celery_app.task(bind=True)
def get_sql_results(self, query_id, return_results=True, store_results=False):
    """Executes the sql query returns the results."""
    if not self.request.called_directly:
        engine = sqlalchemy.create_engine(
            app.config.get('SQLALCHEMY_DATABASE_URI'), poolclass=NullPool)
        session_class = sessionmaker()
        session_class.configure(bind=engine)
        session = session_class()
    else:
        session = db.session()
        session.commit()  # HACK
    try:
        query = session.query(Query).filter_by(id=query_id).one()
    except Exception as e:
        logging.error(
            "Query with id `{}` could not be retrieved".format(query_id))
        logging.error("Sleeping for a sec and retrying...")
        # Nasty hack to get around a race condition where the worker
        # cannot find the query it's supposed to run
        sleep(1)
        query = session.query(Query).filter_by(id=query_id).one()

    database = query.database
    db_engine_spec = database.db_engine_spec
    db_engine_spec.patch()

    def handle_error(msg):
        """Local method handling error while processing the SQL"""
        query.error_message = msg
        query.status = QueryStatus.FAILED
        query.tmp_table_name = None
        session.commit()
        raise Exception(query.error_message)

    if store_results and not results_backend:
        handle_error("Results backend isn't configured.")

    # Limit enforced only for retrieving the data, not for the CTA queries.
    superset_query = SupersetQuery(query.sql)
    executed_sql = superset_query.stripped()
    if not superset_query.is_select() and not database.allow_dml:
        handle_error(
            "Only `SELECT` statements are allowed against this database")
    if query.select_as_cta:
        if not superset_query.is_select():
            handle_error(
                "Only `SELECT` statements can be used with the CREATE TABLE "
                "feature.")
        if not query.tmp_table_name:
            start_dttm = datetime.fromtimestamp(query.start_time)
            query.tmp_table_name = 'tmp_{}_table_{}'.format(
                query.user_id,
                start_dttm.strftime('%Y_%m_%d_%H_%M_%S'))
        executed_sql = superset_query.as_create_table(query.tmp_table_name)
        query.select_as_cta_used = True
    elif (
            query.limit and superset_query.is_select() and
            db_engine_spec.limit_method == LimitMethod.WRAP_SQL):
        executed_sql = database.wrap_sql_limit(executed_sql, query.limit)
        query.limit_used = True
    try:
        template_processor = get_template_processor(
            database=database, query=query)
        executed_sql = template_processor.process_template(executed_sql)
        executed_sql = db_engine_spec.sql_preprocessor(executed_sql)
    except Exception as e:
        logging.exception(e)
        msg = "Template rendering failed: " + utils.error_msg_from_exception(e)
        handle_error(msg)

    query.executed_sql = executed_sql
    query.status = QueryStatus.RUNNING
    query.start_running_time = utils.now_as_float()
    session.merge(query)
    session.commit()
    logging.info("Set query to 'running'")

    try:
        engine = database.get_sqla_engine(schema=query.schema)
        conn = engine.raw_connection()
        cursor = conn.cursor()
        logging.info("Running query: \n{}".format(executed_sql))
        logging.info(query.executed_sql)
        cursor.execute(
            query.executed_sql, **db_engine_spec.cursor_execute_kwargs)
    except Exception as e:
        logging.exception(e)
        conn.close()
        handle_error(db_engine_spec.extract_error_message(e))

    try:
        logging.info("Handling cursor")
        db_engine_spec.handle_cursor(cursor, query, session)
        logging.info("Fetching data: {}".format(query.to_dict()))
        data = db_engine_spec.fetch_data(cursor, query.limit)
    except Exception as e:
        logging.exception(e)
        conn.close()
        handle_error(db_engine_spec.extract_error_message(e))

    conn.commit()
    conn.close()

    if query.status == utils.QueryStatus.STOPPED:
        return json.dumps({
            'query_id': query.id,
            'status': query.status,
            'query': query.to_dict(),
        }, default=utils.json_iso_dttm_ser)

    column_names = (
        [col[0] for col in cursor.description] if cursor.description else [])
    column_names = dedup(column_names)
    cdf = dataframe.SupersetDataFrame(pd.DataFrame(
        list(data), columns=column_names))

    query.rows = cdf.size
    query.progress = 100
    query.status = QueryStatus.SUCCESS
    if query.select_as_cta:
        query.select_sql = '{}'.format(database.select_star(
            query.tmp_table_name,
            limit=query.limit,
            schema=database.force_ctas_schema,
            show_cols=False,
            latest_partition=False,
        ))
    query.end_time = utils.now_as_float()
    session.merge(query)
    session.flush()

    payload = {
        'query_id': query.id,
        'status': query.status,
        'data': cdf.data if cdf.data else [],
        'columns': cdf.columns if cdf.columns else [],
        'query': query.to_dict(),
    }
    payload = json.dumps(payload, default=utils.json_iso_dttm_ser)

    if store_results:
        key = '{}'.format(uuid.uuid4())
        logging.info("Storing results in results backend, key: {}".format(key))
        results_backend.set(key, utils.zlib_compress(payload))
        query.results_key = key
        query.end_result_backend_time = utils.now_as_float()

    session.merge(query)
    session.commit()

    if return_results:
        return payload
