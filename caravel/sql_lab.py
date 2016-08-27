import celery
from datetime import datetime
import pandas as pd
import logging
from caravel import  app, db, models, utils


celery_app = celery.Celery(config_source=app.config.get('CELERY_CONFIG'))


def is_query_select(sql):
    return sql.upper().startswith('SELECT')

def create_table_as(sql, table_name, override=False):
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
    exec_sql = ''
    if is_query_select(sql):
        if override:
            exec_sql = 'DROP TABLE IF EXISTS {};\n'.format(table_name)
        exec_sql += "CREATE TABLE {table_name} AS {sql}"
    else:
        raise Exception("Could not generate CREATE TABLE statement")
    return exec_sql.format(**locals())


@celery_app.task
def get_sql_results(query_id):
    """Executes the sql query returns the results."""
    db.session.commit()  # HACK
    q = db.session.query(models.Query).all()
    query = db.session.query(models.Query).filter_by(id=query_id).one()
    database = query.database
    executed_sql = query.sql.strip().strip(';')

    # Limit enforced only for retrieving the data, not for the CTA queries.
    if is_query_select(executed_sql):
        if query.select_as_cta:
            if not query.tmp_table_name:
                query.tmp_table_name = 'tmp_{}_table_{}'.format(
                    query.user_id,
                    query.start_time.strftime('%Y_%m_%d_%H_%M_%S'))
            executed_sql = create_table_as(executed_sql, query.tmp_table_name)
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
            query.error_message = utils.error_msg_from_exception(e)
            query.status = models.QueryStatus.FAILED
            query.tmp_table_name = None
            db.session.commit()
            raise Exception(query.error_message)

        cursor = result_proxy.cursor
        if hasattr(cursor, "poll"):
            query_stats = cursor.poll()
            # poll returns dict -- JSON status information or ``None``
            # if the query is done
            # https://github.com/dropbox/PyHive/blob/
            # b34bdbf51378b3979eaf5eca9e956f06ddc36ca0/pyhive/presto.py#L178
            while query_stats:
                # Update the object and wait for the kill signal.
                completed_splits = float(query_stats['stats']['completedSplits'])
                total_splits = float(query_stats['stats']['totalSplits'])
                progress = 100 * completed_splits / total_splits
                if progress > self._query.progress:
                    query.progress = progress

                db.session.commit()
                query_stats = cursor.poll()
                # TODO(b.kyryliuk): check for the kill signal.

        columns = None
        data = None
        if result_proxy.cursor:
            cols = [col[0] for col in result_proxy.cursor.description]
            data = result_proxy.fetchall()
            df = pd.DataFrame(data, columns=cols)
            df = df.fillna(0)
            columns = [c for c in df.columns]
            data = df.to_dict(orient='records')

        query.rows = result_proxy.rowcount
        query.progress = 100
        query.status = models.QueryStatus.FINISHED
        if query.rows == -1 and data:
            # Presto doesn't provide result_proxy.row_count
            query.rows = len(data)

        # CTAs queries result in 1 cell having the # of the added rows.
        if query.select_as_cta:
            query.select_sql = '{}'.format(database.select_star(
                query.tmp_table_name, limit=query.limit))

        query.end_time = datetime.now()
        db.session.commit()

    payload = {
        'query_id': query.id,
        'status': query.status,
    }
    if query.status == models.QueryStatus.FINISHED:
        payload['data'] = data
        payload['columns'] = columns
    else:
        payload['error'] = query.error_message
    return payload
