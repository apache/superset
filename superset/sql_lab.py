import celery
from datetime import datetime
import json
import logging
import numpy as np
import pandas as pd
import sqlalchemy
import uuid
import zlib

from sqlalchemy.pool import NullPool
from sqlalchemy.orm import sessionmaker

from superset import (
    app, db, models, utils, dataframe, results_backend)
from superset.sql_parse import SupersetQuery
from superset.db_engine_specs import LimitMethod
from superset.jinja_context import get_template_processor
QueryStatus = models.QueryStatus

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
    query = session.query(models.Query).filter_by(id=query_id).one()
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
    logging.info("Running query: \n{}".format(executed_sql))
    engine = database.get_sqla_engine(schema=query.schema)
    conn = engine.raw_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            query.executed_sql, **db_engine_spec.cursor_execute_kwargs)
    except Exception as e:
        logging.exception(e)
        conn.close()
        handle_error(db_engine_spec.extract_error_message(e))

    query.status = QueryStatus.RUNNING
    session.flush()
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

    column_names = (
        [col[0] for col in cursor.description] if cursor.description else [])
    column_names = dedup(column_names)
    df_data = np.array(data) if data else []
    cdf = dataframe.SupersetDataFrame(pd.DataFrame(
        df_data, columns=column_names))

    query.rows = cdf.size
    query.progress = 100
    query.status = QueryStatus.SUCCESS
    if query.select_as_cta:
        query.select_sql = '{}'.format(database.select_star(
            query.tmp_table_name,
            limit=query.limit,
            schema=database.force_ctas_schema
        ))
    query.end_time = utils.now_as_float()
    session.flush()

    payload = {
        'query_id': query.id,
        'status': query.status,
        'data': cdf.data if cdf.data else [],
        'columns': cdf.columns_dict if cdf.columns_dict else {},
        'query': query.to_dict(),
    }
    payload = json.dumps(payload, default=utils.json_iso_dttm_ser)

    if store_results:
        key = '{}'.format(uuid.uuid4())
        logging.info("Storing results in results backend, key: {}".format(key))
        results_backend.set(key, zlib.compress(payload))
        query.results_key = key

    session.flush()
    session.commit()

    if return_results:
        return payload
