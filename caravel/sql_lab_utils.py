# SQL Lab Utils
import pandas as pd

import sqlparse
from caravel import models, app
from sqlalchemy import create_engine
from sqlalchemy.orm import scoped_session, sessionmaker
from sqlalchemy import select, text
from sqlalchemy.sql.expression import TextAsFrom


def create_scoped_session():
    """Creates new SQLAlchemy scoped_session."""
    engine = create_engine(
        app.config.get('SQLALCHEMY_DATABASE_URI'), convert_unicode=True)
    return scoped_session(sessionmaker(
        autocommit=True, autoflush=False, bind=engine))


def fetch_response_from_cursor(result_proxy):
    columns = None
    data = None
    if result_proxy.cursor:
        cols = [col[0] for col in result_proxy.cursor.description]
        data = result_proxy.fetchall()
        df = pd.DataFrame(data, columns=cols)
        df = df.fillna(0)
        columns = [c for c in df.columns]
        data = df.to_dict(orient='records')
    return {
        'columns': columns,
        'data': data,
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


def select_star(engine, table_name, limit):
    if limit:
        select_star_sql = select('*').select_from(table_name).limit(limit)
    else:
        select_star_sql = select('*').select_from(table_name)

    # SQL code to preview the results
    return '{}'.format(select_star_sql.compile(
        engine, compile_kwargs={"literal_binds": True}))


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
