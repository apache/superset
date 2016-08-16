import celery
from caravel import models, app, utils
from datetime import datetime

from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import scoped_session, sessionmaker
from sqlalchemy.sql.expression import TextAsFrom
import sqlparse
import pandas as pd

celery_app = celery.Celery(config_source=app.config.get('CELERY_CONFIG'))


@celery_app.task
def get_sql_results_of_executed_query(query_id):
    """Executes the sql query returns the results."""
    # Create a separate session, reusing the db.session leads to the
    # concurrency issues.
    session = get_session()
    query = session.query(models.Query).filter_by(id=query_id).first()
    if query.status != models.QueryStatus.FINISHED:
        return {
            'query_id': query_id,
            'error': {'Query {} failed and results are not available.'.format(
                query.executed_sql)},
        }

    try:
        db_to_query = (
            session.query(models.Database).filter_by(id=query.database_id)
            .first()
        )
    except Exception as e:
        return {
            'query_id': query_id,
            'error': utils.error_msg_from_exception(e),
        }

    if not db_to_query:
        return {
            'query_id': query_id,
            'error': "Database with id {0} is missing.".format(
                query.database_id),
        }
    return db_to_query.get_df(query.select_sql, query.schema)


@celery_app.task
def get_sql_results(query_id):
    """Executes the sql query returns the results."""
    # Create a separate session, reusing the db.session leads to the
    # concurrency issues.
    session = get_session()
    query = session.query(models.Query).filter_by(id=query_id).first()
    result = None
    try:
        db_to_query = (
            session.query(models.Database).filter_by(id=query.database_id)
            .first()
        )
    except Exception as e:
        result = fail_query(query, utils.error_msg_from_exception(e))

    if not db_to_query:
        result = fail_query(query, "Database with id {0} is missing.".format(
            query.database_id))

    if not result:
        result = get_sql_results_as_dict(db_to_query, query, session)
    query.end_time = datetime.now()
    session.flush()
    return result


# TODO(bkyryliuk): dump results somewhere for the webserver.
def get_sql_results_as_dict(db_to_query, query, orm_session):
    """Get the SQL query results from the give session and db connection."""
    engine = db_to_query.get_sqla_engine(schema=query.schema)
    query.executed_sql = query.sql.strip().strip(';')

    # Limit enforced only for retrieving the data, not for the CTA queries.
    query.select_as_cta_used = False
    query.limit_used = False
    if is_query_select(query.executed_sql):
        if query.select_as_cta:
            if not query.tmp_table_name:
                query.tmp_table_name = 'tmp_{}_table_{}'.format(
                    query.user_id,
                    query.start_time.strftime('%Y_%m_%d_%H_%M_%S'))
            query.executed_sql = create_table_as(
                query.executed_sql, query.tmp_table_name)
            query.select_as_cta_used = True
        elif query.limit:
            query.executed_sql = add_limit_to_the_sql(
                query.executed_sql, query.limit, engine)
            query.limit_used = True

    # TODO(bkyryliuk): ensure that tmp table was created.
    # Do not set tmp table name if table wasn't created.
    if not query.select_as_cta_used:
        query.tmp_table_name = None

    backend = engine.url.get_backend_name()
    if backend in ('presto', 'hive'):
        result = get_sql_results_async(engine, query, orm_session)
    else:
        result = get_sql_results_sync(engine, query)

    orm_session.flush()
    return result


def get_sql_results_async(engine, query, orm_session):
    try:
        result_proxy = engine.execute(query.executed_sql, schema=query.schema)
    except Exception as e:
        return fail_query(query, utils.error_msg_from_exception(e))

    cursor = result_proxy.cursor
    query_stats = cursor.poll()
    query.status = models.QueryStatus.IN_PROGRESS
    orm_session.flush()
    # poll returns dict -- JSON status information or ``None``
    # if the query is done
    # https://github.com/dropbox/PyHive/blob/
    # b34bdbf51378b3979eaf5eca9e956f06ddc36ca0/pyhive/presto.py#L178
    while query_stats:
        # Update the object and wait for the kill signal.
        orm_session.refresh(query)
        completed_splits = int(query_stats['stats']['completedSplits'])
        total_splits = int(query_stats['stats']['totalSplits'])
        progress = 100 * completed_splits / total_splits
        if progress > query.progress:
            query.progress = progress

        orm_session.flush()
        query_stats = cursor.poll()
        # TODO(b.kyryliuk): check for the kill signal.

    if query.select_as_cta_used:
        select_star = (
            select('*').select_from(query.tmp_table_name).
            limit(query.limit)
        )
        # SQL code to preview the results
        query.select_sql = str(select_star.compile(
            engine, compile_kwargs={"literal_binds": True}))
        try:
            # override cursor value to reuse the data extraction down below.
            result_proxy = engine.execute(
                query.select_sql, schema=query.schema)
            cursor = result_proxy.cursor
            while cursor.poll():
                # TODO: wait till the data is fetched
                pass
        except Exception as e:
            return fail_query(query, utils.error_msg_from_exception(e))

    response = fetch_response_from_cursor(result_proxy, query)
    query.status = models.QueryStatus.FINISHED
    orm_session.flush()
    return response


def get_sql_results_sync(engine, query):
    # TODO(bkyryliuk): rewrite into eng.execute as queries different from
    #                  select should be permitted too.
    query.select_sql = query.sql
    if query.select_as_cta_used:
        try:
            engine.execute(query.executed_sql, schema=query.schema)
        except Exception as e:
            return fail_query(query, utils.error_msg_from_exception(e))
        select_star = (
            select('*').select_from(query.tmp_table_name).
            limit(query.limit)
        )
        query.select_sql = str(select_star.compile(
            engine, compile_kwargs={"literal_binds": True}))
    try:
        result_proxy = engine.execute(
            query.select_sql, schema=query.schema)
    except Exception as e:
        return fail_query(query, utils.error_msg_from_exception(e))
    response = fetch_response_from_cursor(result_proxy, query)
    query.status = models.QueryStatus.FINISHED
    return response


def fail_query(query, message):
    query.error_message = message
    query.status = models.QueryStatus.FAILED
    return {
        'error': query.error_message,
        'status': query.status,
    }


# TODO(b.kyryliuk): find better way to pass the data.
def fetch_response_from_cursor(result_proxy, query):
    cols = [col[0] for col in result_proxy.cursor.description]
    data = result_proxy.fetchall()
    df = pd.DataFrame(data, columns=cols)
    df = df.fillna(0)
    return {
        'query_id': query.id,
        'columns': [c for c in df.columns],
        'data': df.to_dict(orient='records'),
        'status': models.QueryStatus.FINISHED,
    }


def is_query_select(sql):
    try:
        return sqlparse.parse(sql)[0].get_type() == 'SELECT'
    # Capture sqlparse exceptions, worker shouldn't fail here.
    except Exception:
        # TODO(bkyryliuk): add logging here.
        return False


# if sqlparse provides the stream of tokens but don't provide the API
# to access the table names, more on it:
# https://groups.google.com/forum/#!topic/sqlparse/sL2aAi6dSJU
# https://github.com/andialbrecht/sqlparse/blob/master/examples/
# extract_table_names.py
#
# Another approach would be to run the EXPLAIN on the sql statement:
# https://prestodb.io/docs/current/sql/explain.html
# https://cwiki.apache.org/confluence/display/Hive/LanguageManual+Explain
def get_tables():
    """Retrieves the query names from the query."""
    # TODO(bkyryliuk): implement parsing the sql statement.
    pass


def add_limit_to_the_sql(sql, limit, eng):
    # Treat as single sql statement in case of failure.
    try:
        sql_statements = [s for s in sqlparse.split(sql) if s]
    except Exception as e:
        app.logger.info(
            "Statement " + sql + "failed to be transformed to have the limit "
            "with the exception" + e.message)
        return sql
    if len(sql_statements) == 1 and is_query_select(sql):
        qry = select('*').select_from(
            TextAsFrom(text(sql_statements[0]), ['*']).alias(
                'inner_qry')).limit(limit)
        sql_statement = str(qry.compile(
            eng, compile_kwargs={"literal_binds": True}))
        return sql_statement
    return sql


# create table works only for the single statement.
# TODO(bkyryliuk): enforce that all the columns have names. Presto requires it
#                  for the CTA operation.
def create_table_as(sql, table_name, override=False):
    """Reformats the query into the create table as query.

    Works only for the single select SQL statements, in all other cases
    the sql query is not modified.
    :param sql: string, sql query that will be executed
    :param table_name: string, will contain the results of the query execution
    :param override, boolean, table table_name will be dropped if true
    :return: string, create table as query
    """
    # TODO(bkyryliuk): drop table if allowed, check the namespace and
    #                  the permissions.
    # Treat as single sql statement in case of failure.
    try:
        # Filter out empty statements.
        sql_statements = [s for s in sqlparse.split(sql) if s]
    except Exception as e:
        app.logger.info(
            "Statement " + sql + "failed to be transformed as create table as "
            "with the exception" + e.message)
        return sql
    if len(sql_statements) == 1 and is_query_select(sql):
        updated_sql = ''
        # TODO(bkyryliuk): use sqlalchemy statements for the
        #  the drop and create operations.
        if override:
            updated_sql = 'DROP TABLE IF EXISTS {};\n'.format(table_name)
        updated_sql += "CREATE TABLE %s AS %s" % (
            table_name, sql_statements[0])
        return updated_sql
    return sql


def get_session():
    """Creates new SQLAlchemy scoped_session."""
    engine = create_engine(
        app.config.get('SQLALCHEMY_DATABASE_URI'), convert_unicode=True)
    return scoped_session(sessionmaker(
        autocommit=True, autoflush=False, bind=engine))
