# -*- coding: utf-8 -*-
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import json
import logging

from flask import g, redirect, request
from flask_appbuilder import expose
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access_api
from flask_babel import gettext as __
from flask_babel import lazy_gettext as _

from superset import app, appbuilder, db, utils, security_manager, sql_lab
from superset.connectors.connector_registry import ConnectorRegistry
import superset.models.core as models
from superset.models.sql_lab import Query, SavedQuery
from superset.sql_parse import SupersetQuery
from superset.utils import QueryStatus
from .base import (
    BaseSupersetView, DeleteMixin, SupersetModelView, json_error_response,
    json_success, get_datasource_access_error_msg,
)

config = app.config
log_this = models.Log.log_this


class QueryView(SupersetModelView):
    datamodel = SQLAInterface(Query)
    list_columns = ['user', 'database', 'status', 'start_time', 'end_time']
    label_columns = {
        'user': _('User'),
        'database': _('Database'),
        'status': _('Status'),
        'start_time': _('Start Time'),
        'end_time': _('End Time'),
    }


appbuilder.add_view(
    QueryView,
    'Queries',
    label=__('Queries'),
    category='Manage',
    category_label=__('Manage'),
    icon='fa-search')


class SavedQueryView(SupersetModelView, DeleteMixin):
    datamodel = SQLAInterface(SavedQuery)

    list_title = _('List Saved Query')
    show_title = _('Show Saved Query')
    add_title = _('Add Saved Query')
    edit_title = _('Edit Saved Query')

    list_columns = [
        'label', 'user', 'database', 'schema', 'description',
        'modified', 'pop_tab_link']
    show_columns = [
        'id', 'label', 'user', 'database',
        'description', 'sql', 'pop_tab_link']
    search_columns = ('label', 'user', 'database', 'schema', 'changed_on')
    add_columns = ['label', 'database', 'description', 'sql']
    edit_columns = add_columns
    base_order = ('changed_on', 'desc')
    label_columns = {
        'label': _('Label'),
        'user': _('User'),
        'database': _('Database'),
        'description': _('Description'),
        'modified': _('Modified'),
        'end_time': _('End Time'),
        'pop_tab_link': _('Pop Tab Link'),
        'changed_on': _('Changed on'),
    }

    def pre_add(self, obj):
        obj.user = g.user

    def pre_update(self, obj):
        self.pre_add(obj)


class SavedQueryViewApi(SavedQueryView):
    show_columns = ['label', 'db_id', 'schema', 'description', 'sql']
    add_columns = show_columns
    edit_columns = add_columns


appbuilder.add_view_no_menu(SavedQueryViewApi)
appbuilder.add_view_no_menu(SavedQueryView)


class SqlLab(BaseSupersetView):
    """SQL Lab views"""

    @utils.has_access
    @expose('/')
    def sqllab(self):
        """SQL Editor"""
        d = {
            'defaultDbId': config.get('SQLLAB_DEFAULT_DBID'),
            'common': self.common_bootsrap_payload(),
        }
        return self.render_template(
            'superset/basic.html',
            entry='sqllab',
            bootstrap_data=json.dumps(d, default=utils.json_iso_dttm_ser),
        )

    @has_access_api
    @expose('/sql_json/', methods=['POST', 'GET'])
    @log_this
    def sql_json(self):
        """Runs arbitrary sql and returns and json"""
        # TODO move to ./sqllab.py
        async = request.form.get('runAsync') == 'true'
        sql = request.form.get('sql')
        database_id = request.form.get('database_id')
        schema = request.form.get('schema') or None
        template_params = json.loads(
            request.form.get('templateParams') or '{}')

        session = db.session()
        mydb = session.query(models.Database).filter_by(id=database_id).first()

        if not mydb:
            json_error_response(
                'Database with id {} is missing.'.format(database_id))

        rejected_tables = security_manager.rejected_datasources(sql, mydb, schema)
        if rejected_tables:
            return json_error_response(get_datasource_access_error_msg(
                '{}'.format(rejected_tables)))
        session.commit()

        select_as_cta = request.form.get('select_as_cta') == 'true'
        tmp_table_name = request.form.get('tmp_table_name')
        if select_as_cta and mydb.force_ctas_schema:
            tmp_table_name = '{}.{}'.format(
                mydb.force_ctas_schema,
                tmp_table_name,
            )

        query = Query(
            database_id=int(database_id),
            limit=int(app.config.get('SQL_MAX_ROW', None)),
            sql=sql,
            schema=schema,
            select_as_cta=request.form.get('select_as_cta') == 'true',
            start_time=utils.now_as_float(),
            tab_name=request.form.get('tab'),
            status=QueryStatus.PENDING if async else QueryStatus.RUNNING,
            sql_editor_id=request.form.get('sql_editor_id'),
            tmp_table_name=tmp_table_name,
            user_id=int(g.user.get_id()),
            client_id=request.form.get('client_id'),
        )
        session.add(query)
        session.flush()
        query_id = query.id
        session.commit()  # shouldn't be necessary
        if not query_id:
            raise Exception(_('Query record was not created as expected.'))
        logging.info('Triggering query_id: {}'.format(query_id))

        # Async request.
        if async:
            logging.info('Running query on a Celery worker')
            # Ignore the celery future object and the request may time out.
            try:
                sql_lab.get_sql_results.delay(
                    query_id=query_id, return_results=False,
                    store_results=not query.select_as_cta,
                    user_name=g.user.username,
                    template_params=template_params)
            except Exception as e:
                logging.exception(e)
                msg = (
                    'Failed to start remote query on a worker. '
                    'Tell your administrator to verify the availability of '
                    'the message queue.'
                )
                query.status = QueryStatus.FAILED
                query.error_message = msg
                session.commit()
                return json_error_response('{}'.format(msg))

            resp = json_success(json.dumps(
                {'query': query.to_dict()}, default=utils.json_int_dttm_ser,
                allow_nan=False), status=202)
            session.commit()
            return resp

        # Sync request.
        try:
            timeout = config.get('SQLLAB_TIMEOUT')
            timeout_msg = (
                'The query exceeded the {timeout} seconds '
                'timeout.').format(**locals())
            with utils.timeout(seconds=timeout,
                               error_message=timeout_msg):
                # pylint: disable=no-value-for-parameter
                data = sql_lab.get_sql_results(
                    query_id=query_id, return_results=True,
                    template_params=template_params)
            payload = json.dumps(
                data, default=utils.pessimistic_json_iso_dttm_ser)
        except Exception as e:
            logging.exception(e)
            return json_error_response('{}'.format(e))
        if data.get('status') == QueryStatus.FAILED:
            return json_error_response(payload=data)
        return json_success(payload)

    @expose('/my_queries/')
    def my_queries(self):
        """Assigns a list of found users to the given role."""
        return redirect(
            '/savedqueryview/list/?_flt_0_user={}'.format(g.user.id))

    @utils.has_access
    @expose('/sqllab_viz/', methods=['POST'])
    @log_this
    def sqllab_viz(self):
        SqlaTable = ConnectorRegistry.sources['table']
        data = json.loads(request.form.get('data'))
        table_name = data.get('datasourceName')
        table = (
            db.session.query(SqlaTable)
            .filter_by(table_name=table_name)
            .first()
        )
        if not table:
            table = SqlaTable(table_name=table_name)
        table.database_id = data.get('dbId')
        table.schema = data.get('schema')
        q = SupersetQuery(data.get('sql'))
        table.sql = q.stripped()
        db.session.add(table)
        cols = []
        dims = []
        metrics = []
        for column_name, config in data.get('columns').items():
            is_dim = config.get('is_dim', False)
            SqlaTable = ConnectorRegistry.sources['table']
            TableColumn = SqlaTable.column_class
            SqlMetric = SqlaTable.metric_class
            col = TableColumn(
                column_name=column_name,
                filterable=is_dim,
                groupby=is_dim,
                is_dttm=config.get('is_date', False),
                type=config.get('type', False),
            )
            cols.append(col)
            if is_dim:
                dims.append(col)
            agg = config.get('agg')
            if agg:
                if agg == 'count_distinct':
                    metrics.append(SqlMetric(
                        metric_name='{agg}__{column_name}'.format(**locals()),
                        expression='COUNT(DISTINCT {column_name})'
                        .format(**locals()),
                    ))
                else:
                    metrics.append(SqlMetric(
                        metric_name='{agg}__{column_name}'.format(**locals()),
                        expression='{agg}({column_name})'.format(**locals()),
                    ))
        if not metrics:
            metrics.append(SqlMetric(
                metric_name='count'.format(**locals()),
                expression='count(*)'.format(**locals()),
            ))
        table.columns = cols
        table.metrics = metrics
        db.session.commit()
        return self.json_response({
            'table_id': table.id,
        })

    @utils.has_access
    @expose('/search_queries/')
    @log_this
    def search_queries(self):
        """Search for queries."""
        query = db.session.query(Query)
        search_user_id = request.args.get('user_id')
        database_id = request.args.get('database_id')
        search_text = request.args.get('search_text')
        status = request.args.get('status')
        # From and To time stamp should be Epoch timestamp in seconds
        from_time = request.args.get('from')
        to_time = request.args.get('to')

        if search_user_id:
            # Filter on db Id
            query = query.filter(Query.user_id == search_user_id)

        if database_id:
            # Filter on db Id
            query = query.filter(Query.database_id == database_id)

        if status:
            # Filter on status
            query = query.filter(Query.status == status)

        if search_text:
            # Filter on search text
            query = query \
                .filter(Query.sql.like('%{}%'.format(search_text)))

        if from_time:
            query = query.filter(Query.start_time > int(from_time))

        if to_time:
            query = query.filter(Query.start_time < int(to_time))

        query_limit = config.get('QUERY_SEARCH_LIMIT', 1000)
        sql_queries = (
            query.order_by(Query.start_time.asc())
            .limit(query_limit)
            .all()
        )

        dict_queries = [q.to_dict() for q in sql_queries]
        return self.json_response(dict_queries)


appbuilder.add_view_no_menu(SqlLab)

appbuilder.add_link(
    'SQL Editor',
    label=_('SQL Editor'),
    href='/sqllab/',
    category_icon='fa-flask',
    icon='fa-flask',
    category='SQL Lab',
    category_label=__('SQL Lab'),
)

appbuilder.add_link(
    'Query Search',
    label=_('Query Search'),
    href='/sqllab/#search',
    icon='fa-search',
    category_icon='fa-flask',
    category='SQL Lab',
    category_label=__('SQL Lab'),
)

appbuilder.add_link(
    __('Saved Queries'),
    href='/sqllab/my_queries/',
    icon='fa-save',
    category='SQL Lab',
)
