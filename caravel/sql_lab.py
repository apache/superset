import celery
from datetime import datetime
import pandas as pd
import logging
from caravel import  app, db, models, utils
import time

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
    db.session.commit()  # HACK
    query = db.session.query(models.Query).filter_by(id=query_id).one()
    database = query.database
    executed_sql = query.sql.strip().strip(';')

    # Limit enforced only for retrieving the data, not for the CTA queries.
    if is_query_select(executed_sql):
        if query.select_as_cta:
            if not query.tmp_table_name:
                start_dttm = datetime.fromtimestamp(query.start_time)
                query.tmp_table_name = 'tmp_{}_table_{}'.format(
                    query.user_id,
                    start_dttm.strftime('%Y_%m_%d_%H_%M_%S'))
            executed_sql = create_table_as(
                executed_sql, query.tmp_table_name, database.force_ctas_schema)
            query.select_as_cta_used = True
        elif query.limit:
            executed_sql = database.wrap_sql_limit(executed_sql, query.limit)
            query.limit_used = True
        engine = database.get_sqla_engine(schema=query.schema)
        try:
            query.executed_sql = executed_sql
            logging.info("Running query: \n{}".format(executed_sql))
            result_proxy = engine.execute(query.executed_sql, schema=query.schema)
        except Exception as e:
            logging.exception(e)
            query.error_message = utils.error_msg_from_exception(e)
            query.status = QueryStatus.FAILED
            query.tmp_table_name = None
            db.session.commit()
            raise Exception(query.error_message)

        cursor = result_proxy.cursor
        query.status = QueryStatus.RUNNING
        db.session.flush()
        if hasattr(cursor, "poll"):
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
                        db.session.commit()
                time.sleep(1)
                polled = cursor.poll()

        columns = None
        data = None
        if result_proxy.cursor:
            columns = [col[0] for col in result_proxy.cursor.description]
            data = result_proxy.fetchall()
            df = pd.DataFrame(data, columns=columns)
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

        # CTAs queries result in 1 cell having the # of the added rows.
        if query.select_as_cta:
            query.select_sql = '{}'.format(database.select_star(
                query.tmp_table_name, limit=query.limit))

        query.end_time = utils.now_as_float()
        db.session.commit()

    payload = {
        'query_id': query.id,
        'status': query.status,
    }
    if query.status == models.QueryStatus.SUCCESS:
        payload['data'] = data
        payload['columns'] = columns
    else:
        payload['error'] = query.error_message
    if return_results:
        return payload
