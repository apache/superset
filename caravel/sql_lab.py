import celery
from datetime import datetime
import pandas as pd
import logging
import numpy
import time

from caravel import app, db, models, utils

QueryStatus = models.QueryStatus


celery_app = celery.Celery(config_source=app.config.get('CELERY_CONFIG'))


def is_query_select(sql):
    return sql.upper().startswith('SELECT')

def create_table_as(sql, table_name, schema=None, override=False):
    """Reformats the query into the create table as query.

    Works only for the single select SQL statements, in all other cases
    the sql query is not modified.
    :param sql: string, sql query that will be executed
    :param table_name: string, will contain the results of the query execution
    :param override, boolean, table table_name will be dropped if true
    :return: string, create table as query
    """
    # TODO(bkyryliuk): enforce that all the columns have names. Presto requires it
    #                  for the CTA operation.
    # TODO(bkyryliuk): drop table if allowed, check the namespace and
    #                  the permissions.
    # TODO raise if multi-statement
    if schema:
        table_name = schema + '.' + table_name
    exec_sql = ''
    if is_query_select(sql):
        if override:
            exec_sql = 'DROP TABLE IF EXISTS {table_name};\n'
        exec_sql += "CREATE TABLE {table_name} AS \n{sql}"
    else:
        raise Exception("Could not generate CREATE TABLE statement")
    return exec_sql.format(**locals())


@celery_app.task
def get_sql_results(query_id, return_results=True):
    """Executes the sql query returns the results."""
    session = db.session()
    session.commit()  # HACK
    query = session.query(models.Query).filter_by(id=query_id).one()
    database = query.database
    executed_sql = query.sql.strip().strip(';')


    def handle_error(msg):
        """Local method handling error while processing the SQL"""
        query.error_message = msg
        query.status = QueryStatus.FAILED
        query.tmp_table_name = None
        session.commit()
        raise Exception(query.error_message)

    # Limit enforced only for retrieving the data, not for the CTA queries.
    is_select = is_query_select(executed_sql);
    if not is_select and not database.allow_dml:
        handle_error(
            "Only `SELECT` statements are allowed against this database")
    if query.select_as_cta:
        if not is_select:
            handle_error(
                "Only `SELECT` statements can be used with the CREATE TABLE "
                "feature.")
        if not query.tmp_table_name:
            start_dttm = datetime.fromtimestamp(query.start_time)
            query.tmp_table_name = 'tmp_{}_table_{}'.format(
                query.user_id,
                start_dttm.strftime('%Y_%m_%d_%H_%M_%S'))
        executed_sql = create_table_as(
            executed_sql, query.tmp_table_name, database.force_ctas_schema)
        query.select_as_cta_used = True
    elif query.limit and is_select:
        executed_sql = database.wrap_sql_limit(executed_sql, query.limit)
        query.limit_used = True
    engine = database.get_sqla_engine(schema=query.schema)
    try:
        query.executed_sql = executed_sql
        logging.info("Running query: \n{}".format(executed_sql))
        result_proxy = engine.execute(query.executed_sql, schema=query.schema)
    except Exception as e:
        logging.exception(e)
        handle_error(utils.error_msg_from_exception(e))

    cursor = result_proxy.cursor
    query.status = QueryStatus.RUNNING
    session.flush()
    if database.backend == 'presto':
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

    column_names = None
    data = None
    if result_proxy.cursor:
        column_names = [col[0] for col in result_proxy.cursor.description]
        data = result_proxy.fetchall()
    df = pd.DataFrame(data, columns=column_names)
    df = df.where((pd.notnull(df)), None)
    # TODO consider generating tuples instead of dicts to send
    # less data through the wire. The command bellow does that,
    # but we'd need to align on the client side.
    # data = df.values.tolist()
    data = df.to_dict(orient='records')

    query.rows = result_proxy.rowcount
    query.progress = 100
    query.status = QueryStatus.SUCCESS
    if query.rows == -1 and data:
        # Presto doesn't provide result_proxy.row_count
        query.rows = len(data)
    if query.select_as_cta:
        query.select_sql = '{}'.format(database.select_star(
            query.tmp_table_name, limit=query.limit))
    query.end_time = utils.now_as_float()
    session.commit()

    if return_results:
        payload = {
            'query_id': query.id,
            'status': query.status,
            'data': [],
        }
        if query.status == models.QueryStatus.SUCCESS:
            payload['data'] = data
            payload['columns'] = get_columns_dict(df) if column_names else None
        else:
            payload['error'] = query.error_message
        return payload
    '''
    # Hack testing using a kv store for results
    key = "query_id={}".format(query.id)
    logging.info("Storing results in key=[{}]".format(key))
    cache.set(key, json.dumps(payload, default=utils.json_iso_dttm_ser))
    '''


THRESHOLD = 95
SAMPLE_SIZE = 100


# TODO(bkyryliuk): add support for the conventions like: *_dim or dim_*
#     - dimensions, *_ts, ts_*, ds_*, *_ds - datetime, etc.
# TODO(bkyryliuk): recognize integer encoded enums.
def get_columns_dict(df):
    if df.empty:
        return None

    columns = []
    sample_size = min(SAMPLE_SIZE, len(df.index))
    sample = df
    if sample_size:
        sample = df.sample(sample_size)
    for col in df.dtypes.keys():
        column = {
            'name': col,
            'type': df.dtypes[col].name,
            'is_date': is_date(df.dtypes[col]),
            'is_dim': is_dimension(df.dtypes[col], col),
        }
        agg = agg_func(df.dtypes[col], col)
        if agg_func:
            column['agg'] = agg

        if column['type'] == 'object':
            # check if encoded datetime
            if get_datetime_conversion_rate(sample[col]) > THRESHOLD:
                column['type'] = 'datetime_string'
                column['is_date'] = True
                column['is_dim'] = False
                column.pop('agg', None)
        columns.append(column)

    return columns


# It will give false positives on the numbers that are stored as strings.
# It is hard to distinguish integer numbers and timestamps
def get_datetime_conversion_rate(data_series):
    success = 0
    total = 0
    for value in data_series:
        total = total + 1
        try:
            pd.to_datetime(value)
            success = success + 1
        except Exception:
            continue
    return 100 * success / total


def is_date(dtype):
    return dtype.name.startswith('datetime')


def is_dimension(dtype, column_name):
    if is_id(column_name):
        return False
    return dtype == numpy.object or dtype == numpy.bool


def is_id(column_name):
    return column_name.startswith('id') or column_name.endswith('id')


def agg_func(dtype, column_name):
    # consider checking for key substring too.
    if is_id(column_name):
        return 'count_distinct'
    if numpy.issubdtype(dtype, numpy.number):
        return 'sum'
    return None
