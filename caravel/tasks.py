import celery
from caravel import db, models, app
from sqlalchemy import select, text
from sqlalchemy.sql.expression import TextAsFrom
import pandas as pd

print str(app.config.get('CELERY_CONFIG').BROKER_URL)
celery_app = celery.Celery(config_source=app.config.get('CELERY_CONFIG'))

# TODO @b.kyryliuk - move it into separate module as it should be used by the celery module
@celery_app.task
def get_sql_results(database_id, sql):
    """Gets sql results from a Caravel database connection"""
    # TODO @b.kyryliuk handle async
    # handle models.Queries (userid, sql, timestamps, status) index on userid, state, start_ddtm
    session = db.session()
    mydb = session.query(models.Database).filter_by(id=database_id).first()

    content = ""
    if mydb:
        eng = mydb.get_sqla_engine()
        if app.config.get('SQL_MAX_ROW'):
            sql = sql.strip().strip(';')
            qry = (
                select('*')
                .select_from(TextAsFrom(text(sql), ['*']).alias('inner_qry'))
                .limit(app.config.get('SQL_MAX_ROW'))
            )
            sql = str(qry.compile(eng, compile_kwargs={"literal_binds": True}))
        try:
            df = pd.read_sql_query(sql=sql, con=eng)
            content = df.to_html(
                index=False,
                na_rep='',
                classes=(
                    "dataframe table table-striped table-bordered "
                    "table-condensed sql_results").split(' '))
        except Exception as e:
            content = (
                '<div class="alert alert-danger">'
                "{}</div>"
            ).format(e.message)
    session.commit()
    return content
