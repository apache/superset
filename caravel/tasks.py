import celery
from caravel import db, models, app
import json
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import scoped_session, sessionmaker
from sqlalchemy.sql.expression import TextAsFrom
import pandas as pd
import time

celery_app = celery.Celery(config_source=app.config.get('CELERY_CONFIG'))


def init_query(database_id, sql, user_id):
    """Initializes the models.Query object.

    :param database_id: integer
    :param sql: sql query that will be executed
    :param user_id: interger
    :return: models.Query
    """
    milis = int(time.time() * 1000)

    query = models.Query()
    query.user_id = user_id
    query.database_id = database_id
    if app.config.get('SQL_MAX_ROW'):
        query.query_limit = app.config.get('SQL_MAX_ROW')
    query.query_name = str(milis)
    query.query_text = sql
    # TODO(bkyryliuk): run explain query to derive the tables and fill in the
    #                  table_ids
    # TODO(bkyryliuk): check the user permissions
    query.start_time = milis
    query.query_status = models.QueryStatus.IN_PROGRESS
    return query


def create_table_as(sql, table_name):
    """Reformats the query into the create table as query.

    :param sql: string, sql query that will be executed
    :param table_name: string, will contain the results of the query execution
    :return: string, create table as query
    """
    return "CREATE TABLE %s AS %s" % (table_name, sql)


def get_session():
    """Creates new SQLAlchemy scoped_session."""
    engine = create_engine(
        app.config.get('SQLALCHEMY_DATABASE_URI'), convert_unicode=True)
    return scoped_session(sessionmaker(
        autocommit=False, autoflush=False, bind=engine))

@celery_app.task
def get_sql_results(database_id, sql, user_id):
    """Executes the sql query returns the results.

    :param database_id: integer
    :param sql: string, query that will be executed
    :param user_id: integer
    :return: dataframe, query result
    """
    # Create a separate session, reusing the db.session leads to the
    # concurrency issues.
    query_session = get_session()
    try:
        db_to_query = query_session.query(models.Database).filter_by(
            id=database_id).first()
    except Exception as e:
        return json.dumps({'msg': str(e)})

    if not db_to_query:
        return json.dumps(
            {'msg': "Database with id {0} is missing.".format(database_id)})

    query = init_query(database_id, sql, user_id)
    query_session.add(query)
    query_session.commit()

    query_result, success = get_sql_results_internal(sql, db_to_query)

    query.end_time = int(time.time() * 1000)
    if success:
        query.query_status = models.QueryStatus.FINISHED
        # TODO(bkyryliuk): fill in query.tmp_table_name
    else:
        query.query_status = models.QueryStatus.FAILED

    query_session.commit()
    # TODO(bkyryliuk): return the tmp table  / query_id
    return query_result


# TODO(bkyryliuk): merge the changes made in the carapal first
#                   before merging this PR.
def get_sql_results_internal(sql, db_to_query):
    """Get the SQL query resulst from the give session and db connection.

    :param sql: string, query that will be executed
    :param db_to_query: models.Database to query
    :return: (dataframe, boolean), results and the status
    """
    try:
        eng = db_to_query.get_sqla_engine()
        if app.config.get('SQL_MAX_ROW'):
            sql = sql.strip().strip(';')
            qry = (
                select('*')
                .select_from(TextAsFrom(text(sql), ['*']).alias('inner_qry'))
                .limit(app.config.get('SQL_MAX_ROW'))
            )
            sql = str(qry.compile(eng, compile_kwargs={"literal_binds": True}))
        if db_to_query.select_as_create_table_as:
            sql = sql.strip().strip(';')
            # TODO(bkyryliuk): figure out if the query is select query.
            sql = create_table_as(
                sql, "query_" + str(int(round(time.time() * 1000))))

        df = pd.read_sql_query(sql=sql, con=eng)
        # TODO(bkyryliuk): refactore the output to be json instead of html
        data = {
            'columns': [c for c in df.columns],
            'data': df.to_dict(orient='records'),
        }
        return json.dumps(data, allow_nan=False), True
    except Exception as e:
        if hasattr(e, 'message'):
            return json.dumps({'msg': e.message}), False
        else:
            return json.dumps({'msg': str(e)}), False

