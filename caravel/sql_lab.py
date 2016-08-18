import celery
from caravel import models, app, utils, sql_lab_utils
from datetime import datetime

celery_app = celery.Celery(config_source=app.config.get('CELERY_CONFIG'))


@celery_app.task
def get_sql_results(query_id):
    """Executes the sql query returns the results."""
    sql_manager = QueryRunner(query_id)
    sql_manager.run_sql()
    # Return the result for the sync call.
    # if self.request.called_directly:
    if sql_manager.query().status == models.QueryStatus.FINISHED:
        return {
            'query_id': sql_manager.query().id,
            'status': sql_manager.query().status,
            'data': sql_manager.data(),
            'columns': sql_manager.columns(),
        }
    else:
        return {
            'query_id': sql_manager.query().id,
            'status': sql_manager.query().status,
            'error': sql_manager.query().error_message,
        }


class QueryRunner:
    def __init__(self, query_id):
        self._query_id = query_id
        # Creates a separate session, reusing the db.session leads to the
        # concurrency issues.
        self._session = sql_lab_utils.create_scoped_session()
        self._query = self._session.query(models.Query).filter_by(
            id=query_id).first()
        self._db_to_query = self._session.query(models.Database).filter_by(
            id=self._query.database_id).first()
        # Query result.
        self._data = None
        self._columns = None

    def _sanity_check(self):
        if not self._query:
            self._query.error_message = "Query with id {0} not found.".format(
                self._query_id)
        if not self._db_to_query:
            self._query.error_message = (
                "Database with id {0} is missing.".format(
                    self._query.database_id)
            )

        if self._query.error_message:
            self._query.status = models.QueryStatus.FAILED
            self._session.flush()
            return False
        return True

    def query(self):
        return self._query

    def data(self):
        return self._data

    def columns(self):
        return self._columns

    def run_sql(self):
        if not self._sanity_check():
            return self._query.status

        # TODO(bkyryliuk): dump results somewhere for the webserver.
        engine = self._db_to_query.get_sqla_engine(schema=self._query.schema)
        self._query.executed_sql = self._query.sql.strip().strip(';')

        # Limit enforced only for retrieving the data, not for the CTA queries.
        self._query.select_as_cta_used = False
        self._query.limit_used = False
        if sql_lab_utils.is_query_select(self._query.sql):
            if self._query.select_as_cta:
                if not self._query.tmp_table_name:
                    self._query.tmp_table_name = 'tmp_{}_table_{}'.format(
                        self._query.user_id,
                        self._query.start_time.strftime('%Y_%m_%d_%H_%M_%S'))
                self._query.executed_sql = sql_lab_utils.create_table_as(
                    self._query.executed_sql, self._query.tmp_table_name)
                self._query.select_as_cta_used = True
            elif self._query.limit:
                self._query.executed_sql = sql_lab_utils.add_limit_to_the_sql(
                    self._query.executed_sql, self._query.limit, engine)
                self._query.limit_used = True

        # TODO(bkyryliuk): ensure that tmp table was created.
        # Do not set tmp table name if table wasn't created.
        if not self._query.select_as_cta_used:
            self._query.tmp_table_name = None
        self._get_sql_results(engine)

        self._query.end_time = datetime.now()
        self._session.flush()
        return self._query.status

    def _get_sql_results(self, engine):
        try:
            result_proxy = engine.execute(
                self._query.executed_sql, schema=self._query.schema)
        except Exception as e:
            self._query.error_message = utils.error_msg_from_exception(e)
            self._query.status = models.QueryStatus.FAILED
            return

        cursor = result_proxy.cursor
        if hasattr(cursor, "poll"):
            query_stats = cursor.poll()
            self._query.status = models.QueryStatus.IN_PROGRESS
            self._session.flush()
            # poll returns dict -- JSON status information or ``None``
            # if the query is done
            # https://github.com/dropbox/PyHive/blob/
            # b34bdbf51378b3979eaf5eca9e956f06ddc36ca0/pyhive/presto.py#L178
            while query_stats:
                # Update the object and wait for the kill signal.
                self._session.refresh(self._query)
                completed_splits = int(query_stats['stats']['completedSplits'])
                total_splits = int(query_stats['stats']['totalSplits'])
                progress = 100 * completed_splits / total_splits
                if progress > self._query.progress:
                    self._query.progress = progress

                self._session.flush()
                query_stats = cursor.poll()
                # TODO(b.kyryliuk): check for the kill signal.

        sql_results = sql_lab_utils.fetch_response_from_cursor(
            result_proxy)
        self._columns = sql_results['columns']
        self._data = sql_results['data']
        self._query.rows = result_proxy.rowcount
        self._query.progress = 100
        self._query.status = models.QueryStatus.FINISHED
        if self._query.rows == -1 and self._data:
            # Presto doesn't provide result_proxy.row_count
            self._query.rows = len(self._data)

        # CTAs queries result in 1 cell having the # of the added rows.
        if self._query.select_as_cta_used:
            self._query.select_sql = sql_lab_utils.select_star(
                engine, self._query.tmp_table_name, self._query.limit)
        else:
            self._query.tmp_table = None


