from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

from collections import defaultdict
from datetime import datetime, timedelta
import json
import logging
import os
import re
import time
import traceback
from urllib import parse

from flask import (
    flash, g, Markup, redirect, render_template, request, Response, url_for,
)
from flask_appbuilder import expose, SimpleFormView
from flask_appbuilder.actions import action
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.decorators import has_access_api
from flask_appbuilder.security.sqla import models as ab_models
from flask_babel import gettext as __
from flask_babel import lazy_gettext as _
import pandas as pd
from six import text_type
import sqlalchemy as sqla
from sqlalchemy import create_engine
from sqlalchemy.engine.url import make_url
from sqlalchemy.exc import IntegrityError
from unidecode import unidecode
from werkzeug.routing import BaseConverter
from werkzeug.utils import secure_filename

from superset import (
    app, appbuilder, cache, db, results_backend, security, sm, sql_lab, utils,
    viz,
)
from superset.connectors.connector_registry import ConnectorRegistry
from superset.connectors.sqla.models import AnnotationDatasource, SqlaTable
from superset.forms import CsvToDatabaseForm
from superset.legacy import cast_form_data
import superset.models.core as models
from superset.models.sql_lab import Query
from superset.sql_parse import SupersetQuery
from superset.utils import has_access, merge_extra_filters, QueryStatus
from .base import (
    api, BaseSupersetView, CsvResponse, DeleteMixin,
    generate_download_headers, get_error_msg, get_user_roles,
    json_error_response, SupersetFilter, SupersetModelView, YamlExportMixin,
)

config = app.config
stats_logger = config.get('STATS_LOGGER')
log_this = models.Log.log_this
can_access = utils.can_access
DAR = models.DatasourceAccessRequest


ALL_DATASOURCE_ACCESS_ERR = __(
    'This endpoint requires the `all_datasource_access` permission')
DATASOURCE_MISSING_ERR = __('The datasource seems to have been deleted')
ACCESS_REQUEST_MISSING_ERR = __(
    'The access requests seem to have been deleted')
USER_MISSING_ERR = __('The user seems to have been deleted')
perms_instruction_link = config.get('PERMISSION_INSTRUCTIONS_LINK')
if perms_instruction_link:
    DATASOURCE_ACCESS_ERR = __(
        "You don't have access to this datasource. <a href='{}'>(Gain access)</a>"
        .format(perms_instruction_link),
    )
else:
    DATASOURCE_ACCESS_ERR = __("You don't have access to this datasource")

FORM_DATA_KEY_BLACKLIST = []
if not config.get('ENABLE_JAVASCRIPT_CONTROLS'):
    FORM_DATA_KEY_BLACKLIST = [
        'js_tooltip',
        'js_onclick_href',
        'js_data_mutator',
    ]


def get_database_access_error_msg(database_name):
    return __('This view requires the database %(name)s or '
              '`all_datasource_access` permission', name=database_name)


def get_datasource_access_error_msg(datasource_name):
    return __('This endpoint requires the datasource %(name)s, database or '
              '`all_datasource_access` permission', name=datasource_name)


def json_success(json_msg, status=200):
    return Response(json_msg, status=status, mimetype='application/json')


def is_owner(obj, user):
    """ Check if user is owner of the slice """
    return obj and user in obj.owners


def check_ownership(obj, raise_if_false=True):
    """Meant to be used in `pre_update` hooks on models to enforce ownership

    Admin have all access, and other users need to be referenced on either
    the created_by field that comes with the ``AuditMixin``, or in a field
    named ``owners`` which is expected to be a one-to-many with the User
    model. It is meant to be used in the ModelView's pre_update hook in
    which raising will abort the update.
    """
    if not obj:
        return False

    security_exception = utils.SupersetSecurityException(
        "You don't have the rights to alter [{}]".format(obj))

    if g.user.is_anonymous():
        if raise_if_false:
            raise security_exception
        return False
    roles = (r.name for r in get_user_roles())
    if 'Admin' in roles:
        return True
    session = db.create_scoped_session()
    orig_obj = session.query(obj.__class__).filter_by(id=obj.id).first()
    owner_names = (user.username for user in orig_obj.owners)
    if (
            hasattr(orig_obj, 'created_by') and
            orig_obj.created_by and
            orig_obj.created_by.username == g.user.username):
        return True
    if (
            hasattr(orig_obj, 'owners') and
            g.user and
            hasattr(g.user, 'username') and
            g.user.username in owner_names):
        return True
    if raise_if_false:
        raise security_exception
    else:
        return False


class SliceFilter(SupersetFilter):
    def apply(self, query, func):  # noqa
        if self.has_all_datasource_access():
            return query
        perms = self.get_view_menus('datasource_access')
        # TODO(bogdan): add `schema_access` support here
        return query.filter(self.model.perm.in_(perms))


class DashboardFilter(SupersetFilter):

    """List dashboards for which users have access to at least one slice"""

    def apply(self, query, func):  # noqa
        if self.has_all_datasource_access():
            return query
        Slice = models.Slice  # noqa
        Dash = models.Dashboard  # noqa
        # TODO(bogdan): add `schema_access` support here
        datasource_perms = self.get_view_menus('datasource_access')
        slice_ids_qry = (
            db.session
            .query(Slice.id)
            .filter(Slice.perm.in_(datasource_perms))
        )
        query = query.filter(
            Dash.id.in_(
                db.session.query(Dash.id)
                .distinct()
                .join(Dash.slices)
                .filter(Slice.id.in_(slice_ids_qry)),
            ),
        )
        return query


class DatabaseView(SupersetModelView, DeleteMixin, YamlExportMixin):  # noqa
    datamodel = SQLAInterface(models.Database)

    list_title = _('List Databases')
    show_title = _('Show Database')
    add_title = _('Add Database')
    edit_title = _('Edit Database')

    list_columns = [
        'database_name', 'backend', 'allow_run_sync', 'allow_run_async',
        'allow_dml', 'creator', 'modified']
    order_columns = [
        'database_name', 'allow_run_sync', 'allow_run_async', 'allow_dml',
        'modified',
    ]
    add_columns = [
        'database_name', 'sqlalchemy_uri', 'cache_timeout', 'extra',
        'expose_in_sqllab', 'allow_run_sync', 'allow_run_async',
        'allow_ctas', 'allow_dml', 'force_ctas_schema', 'impersonate_user']
    search_exclude_columns = (
        'password', 'tables', 'created_by', 'changed_by', 'queries',
        'saved_queries')
    edit_columns = add_columns
    show_columns = [
        'tables',
        'cache_timeout',
        'extra',
        'database_name',
        'sqlalchemy_uri',
        'perm',
        'created_by',
        'created_on',
        'changed_by',
        'changed_on',
    ]
    add_template = 'superset/models/database/add.html'
    edit_template = 'superset/models/database/edit.html'
    base_order = ('changed_on', 'desc')
    description_columns = {
        'sqlalchemy_uri': utils.markdown(
            'Refer to the '
            '[SqlAlchemy docs]'
            '(http://docs.sqlalchemy.org/en/rel_1_0/core/engines.html#'
            'database-urls) '
            'for more information on how to structure your URI.', True),
        'expose_in_sqllab': _('Expose this DB in SQL Lab'),
        'allow_run_sync': _(
            'Allow users to run synchronous queries, this is the default '
            'and should work well for queries that can be executed '
            'within a web request scope (<~1 minute)'),
        'allow_run_async': _(
            'Allow users to run queries, against an async backend. '
            'This assumes that you have a Celery worker setup as well '
            'as a results backend.'),
        'allow_ctas': _('Allow CREATE TABLE AS option in SQL Lab'),
        'allow_dml': _(
            'Allow users to run non-SELECT statements '
            '(UPDATE, DELETE, CREATE, ...) '
            'in SQL Lab'),
        'force_ctas_schema': _(
            'When allowing CREATE TABLE AS option in SQL Lab, '
            'this option forces the table to be created in this schema'),
        'extra': utils.markdown(
            'JSON string containing extra configuration elements. '
            'The ``engine_params`` object gets unpacked into the '
            '[sqlalchemy.create_engine]'
            '(http://docs.sqlalchemy.org/en/latest/core/engines.html#'
            'sqlalchemy.create_engine) call, while the ``metadata_params`` '
            'gets unpacked into the [sqlalchemy.MetaData]'
            '(http://docs.sqlalchemy.org/en/rel_1_0/core/metadata.html'
            '#sqlalchemy.schema.MetaData) call. ', True),
        'impersonate_user': _(
            'If Presto, all the queries in SQL Lab are going to be executed as the '
            'currently logged on user who must have permission to run them.<br/>'
            'If Hive and hive.server2.enable.doAs is enabled, will run the queries as '
            'service account, but impersonate the currently logged on user '
            'via hive.server2.proxy.user property.'),
    }
    label_columns = {
        'expose_in_sqllab': _('Expose in SQL Lab'),
        'allow_ctas': _('Allow CREATE TABLE AS'),
        'allow_dml': _('Allow DML'),
        'force_ctas_schema': _('CTAS Schema'),
        'database_name': _('Database'),
        'creator': _('Creator'),
        'changed_on_': _('Last Changed'),
        'sqlalchemy_uri': _('SQLAlchemy URI'),
        'cache_timeout': _('Cache Timeout'),
        'extra': _('Extra'),
        'allow_run_sync': _('Allow Run Sync'),
        'allow_run_async': _('Allow Run Async'),
        'impersonate_user': _('Impersonate the logged on user'),
    }

    def pre_add(self, db):
        db.set_sqlalchemy_uri(db.sqlalchemy_uri)
        security.merge_perm(sm, 'database_access', db.perm)
        for schema in db.all_schema_names():
            security.merge_perm(
                sm, 'schema_access', utils.get_schema_perm(db, schema))

    def pre_update(self, db):
        self.pre_add(db)

    def _delete(self, pk):
        DeleteMixin._delete(self, pk)


appbuilder.add_link(
    'Import Dashboards',
    label=__('Import Dashboards'),
    href='/superset/import_dashboards',
    icon='fa-cloud-upload',
    category='Manage',
    category_label=__('Manage'),
    category_icon='fa-wrench')


appbuilder.add_view(
    DatabaseView,
    'Databases',
    label=__('Databases'),
    icon='fa-database',
    category='Sources',
    category_label=__('Sources'),
    category_icon='fa-database')


class DatabaseAsync(DatabaseView):
    list_columns = [
        'id', 'database_name',
        'expose_in_sqllab', 'allow_ctas', 'force_ctas_schema',
        'allow_run_async', 'allow_run_sync', 'allow_dml',
    ]


appbuilder.add_view_no_menu(DatabaseAsync)


class CsvToDatabaseView(SimpleFormView):
    form = CsvToDatabaseForm
    form_title = _('CSV to Database configuration')
    add_columns = ['database', 'schema', 'table_name']

    def form_get(self, form):
        form.sep.data = ','
        form.header.data = 0
        form.mangle_dupe_cols.data = True
        form.skipinitialspace.data = False
        form.skip_blank_lines.data = True
        form.parse_dates.data = True
        form.infer_datetime_format.data = True
        form.decimal.data = '.'
        form.if_exists.data = 'append'

    def form_post(self, form):
        csv_file = form.csv_file.data
        form.csv_file.data.filename = secure_filename(form.csv_file.data.filename)
        csv_filename = form.csv_file.data.filename
        try:
            csv_file.save(os.path.join(config['UPLOAD_FOLDER'], csv_filename))
            table = SqlaTable(table_name=form.name.data)
            table.database = form.data.get('con')
            table.database_id = table.database.id
            table.database.db_engine_spec.create_table_from_csv(form, table)
        except Exception as e:
            try:
                os.remove(os.path.join(config['UPLOAD_FOLDER'], csv_filename))
            except OSError:
                pass
            message = u'Table name {} already exists. Please pick another'.format(
                    form.name.data) if isinstance(e, IntegrityError) else text_type(e)
            flash(
                message,
                'danger')
            return redirect('/csvtodatabaseview/form')

        os.remove(os.path.join(config['UPLOAD_FOLDER'], csv_filename))
        # Go back to welcome page / splash screen
        db_name = table.database.database_name
        message = _(u'CSV file "{0}" uploaded to table "{1}" in '
                    'database "{2}"'.format(csv_filename,
                                            form.name.data,
                                            db_name))
        flash(message, 'info')
        return redirect('/tablemodelview/list/')


appbuilder.add_view_no_menu(CsvToDatabaseView)


class DatabaseTablesAsync(DatabaseView):
    list_columns = ['id', 'all_table_names', 'all_schema_names']


appbuilder.add_view_no_menu(DatabaseTablesAsync)


if config.get('ENABLE_ACCESS_REQUEST'):
    class AccessRequestsModelView(SupersetModelView, DeleteMixin):
        datamodel = SQLAInterface(DAR)
        list_columns = [
            'username', 'user_roles', 'datasource_link',
            'roles_with_datasource', 'created_on']
        order_columns = ['created_on']
        base_order = ('changed_on', 'desc')
        label_columns = {
            'username': _('User'),
            'user_roles': _('User Roles'),
            'database': _('Database URL'),
            'datasource_link': _('Datasource'),
            'roles_with_datasource': _('Roles to grant'),
            'created_on': _('Created On'),
        }

    appbuilder.add_view(
        AccessRequestsModelView,
        'Access requests',
        label=__('Access requests'),
        category='Security',
        category_label=__('Security'),
        icon='fa-table')


class SliceModelView(SupersetModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(models.Slice)

    list_title = _('List Charts')
    show_title = _('Show Chart')
    add_title = _('Add Chart')
    edit_title = _('Edit Chart')

    can_add = False
    label_columns = {
        'datasource_link': _('Datasource'),
    }
    search_columns = (
        'slice_name', 'description', 'viz_type', 'datasource_name', 'owners',
    )
    list_columns = [
        'slice_link', 'viz_type', 'datasource_link', 'creator', 'modified']
    order_columns = ['viz_type', 'datasource_link', 'modified']
    edit_columns = [
        'slice_name', 'description', 'viz_type', 'owners', 'dashboards',
        'params', 'cache_timeout']
    base_order = ('changed_on', 'desc')
    description_columns = {
        'description': Markup(
            'The content here can be displayed as widget headers in the '
            'dashboard view. Supports '
            '<a href="https://daringfireball.net/projects/markdown/"">'
            'markdown</a>'),
        'params': _(
            'These parameters are generated dynamically when clicking '
            'the save or overwrite button in the explore view. This JSON '
            'object is exposed here for reference and for power users who may '
            'want to alter specific parameters.',
        ),
        'cache_timeout': _(
            'Duration (in seconds) of the caching timeout for this slice.'),
    }
    base_filters = [['id', SliceFilter, lambda: []]]
    label_columns = {
        'cache_timeout': _('Cache Timeout'),
        'creator': _('Creator'),
        'dashboards': _('Dashboards'),
        'datasource_link': _('Datasource'),
        'description': _('Description'),
        'modified': _('Last Modified'),
        'owners': _('Owners'),
        'params': _('Parameters'),
        'slice_link': _('Chart'),
        'slice_name': _('Name'),
        'table': _('Table'),
        'viz_type': _('Visualization Type'),
    }

    def pre_add(self, obj):
        utils.validate_json(obj.params)

    def pre_update(self, obj):
        utils.validate_json(obj.params)
        check_ownership(obj)

    def pre_delete(self, obj):
        check_ownership(obj)

    @expose('/add', methods=['GET', 'POST'])
    @has_access
    def add(self):
        datasources = ConnectorRegistry.get_all_datasources(db.session)
        datasources = [
            {'value': str(d.id) + '__' + d.type, 'label': repr(d)}
            for d in datasources
        ]
        return self.render_template(
            'superset/add_slice.html',
            bootstrap_data=json.dumps({
                'datasources': sorted(datasources, key=lambda d: d['label']),
            }),
        )


appbuilder.add_view(
    SliceModelView,
    'Charts',
    label=__('Charts'),
    icon='fa-bar-chart',
    category='',
    category_icon='')


class SliceAsync(SliceModelView):  # noqa
    list_columns = [
        'id', 'slice_link', 'viz_type', 'slice_name',
        'creator', 'modified', 'icons']
    label_columns = {
        'icons': ' ',
        'slice_link': _('Chart'),
    }


appbuilder.add_view_no_menu(SliceAsync)


class SliceAddView(SliceModelView):  # noqa
    list_columns = [
        'id', 'slice_name', 'slice_link', 'viz_type',
        'datasource_link', 'owners', 'modified', 'changed_on']
    show_columns = list(set(SliceModelView.edit_columns + list_columns))


appbuilder.add_view_no_menu(SliceAddView)


class DashboardModelView(SupersetModelView, DeleteMixin):  # noqa
    datamodel = SQLAInterface(models.Dashboard)

    list_title = _('List Dashboards')
    show_title = _('Show Dashboard')
    add_title = _('Add Dashboard')
    edit_title = _('Edit Dashboard')

    list_columns = ['dashboard_link', 'creator', 'modified']
    order_columns = ['modified']
    edit_columns = [
        'dashboard_title', 'slug', 'slices', 'owners', 'position_json', 'css',
        'json_metadata']
    show_columns = edit_columns + ['table_names']
    search_columns = ('dashboard_title', 'slug', 'owners')
    add_columns = edit_columns
    base_order = ('changed_on', 'desc')
    description_columns = {
        'position_json': _(
            'This json object describes the positioning of the widgets in '
            'the dashboard. It is dynamically generated when adjusting '
            'the widgets size and positions by using drag & drop in '
            'the dashboard view'),
        'css': _(
            'The css for individual dashboards can be altered here, or '
            'in the dashboard view where changes are immediately '
            'visible'),
        'slug': _('To get a readable URL for your dashboard'),
        'json_metadata': _(
            'This JSON object is generated dynamically when clicking '
            'the save or overwrite button in the dashboard view. It '
            'is exposed here for reference and for power users who may '
            'want to alter specific parameters.'),
        'owners': _('Owners is a list of users who can alter the dashboard.'),
    }
    base_filters = [['slice', DashboardFilter, lambda: []]]
    add_form_query_rel_fields = {
        'slices': [['slices', SliceFilter, None]],
    }
    edit_form_query_rel_fields = add_form_query_rel_fields
    label_columns = {
        'dashboard_link': _('Dashboard'),
        'dashboard_title': _('Title'),
        'slug': _('Slug'),
        'slices': _('Charts'),
        'owners': _('Owners'),
        'creator': _('Creator'),
        'modified': _('Modified'),
        'position_json': _('Position JSON'),
        'css': _('CSS'),
        'json_metadata': _('JSON Metadata'),
        'table_names': _('Underlying Tables'),
    }

    def pre_add(self, obj):
        obj.slug = obj.slug.strip() or None
        if obj.slug:
            obj.slug = obj.slug.replace(' ', '-')
            obj.slug = re.sub(r'[^\w\-]+', '', obj.slug)
        if g.user not in obj.owners:
            obj.owners.append(g.user)
        utils.validate_json(obj.json_metadata)
        utils.validate_json(obj.position_json)
        owners = [o for o in obj.owners]
        for slc in obj.slices:
            slc.owners = list(set(owners) | set(slc.owners))

    def pre_update(self, obj):
        check_ownership(obj)
        self.pre_add(obj)

    def pre_delete(self, obj):
        check_ownership(obj)

    @action('mulexport', __('Export'), __('Export dashboards?'), 'fa-database')
    def mulexport(self, items):
        if not isinstance(items, list):
            items = [items]
        ids = ''.join('&id={}'.format(d.id) for d in items)
        return redirect(
            '/dashboardmodelview/export_dashboards_form?{}'.format(ids[1:]))

    @expose('/export_dashboards_form')
    def download_dashboards(self):
        if request.args.get('action') == 'go':
            ids = request.args.getlist('id')
            return Response(
                models.Dashboard.export_dashboards(ids),
                headers=generate_download_headers('json'),
                mimetype='application/text')
        return self.render_template(
            'superset/export_dashboards.html',
            dashboards_url='/dashboardmodelview/list',
        )


appbuilder.add_view(
    DashboardModelView,
    'Dashboards',
    label=__('Dashboards'),
    icon='fa-dashboard',
    category='',
    category_icon='')


class DashboardModelViewAsync(DashboardModelView):  # noqa
    list_columns = [
        'id', 'dashboard_link', 'creator', 'modified', 'dashboard_title',
        'changed_on', 'url', 'changed_by_name',
    ]
    label_columns = {
        'dashboard_link': _('Dashboard'),
        'dashboard_title': _('Title'),
        'creator': _('Creator'),
        'modified': _('Modified'),
    }


appbuilder.add_view_no_menu(DashboardModelViewAsync)


class DashboardAddView(DashboardModelView):  # noqa
    list_columns = [
        'id', 'dashboard_link', 'creator', 'modified', 'dashboard_title',
        'changed_on', 'url', 'changed_by_name',
    ]
    show_columns = list(set(DashboardModelView.edit_columns + list_columns))


appbuilder.add_view_no_menu(DashboardAddView)


class LogModelView(SupersetModelView):
    datamodel = SQLAInterface(models.Log)
    list_columns = ('user', 'action', 'dttm')
    edit_columns = ('user', 'action', 'dttm', 'json')
    base_order = ('dttm', 'desc')
    label_columns = {
        'user': _('User'),
        'action': _('Action'),
        'dttm': _('dttm'),
        'json': _('JSON'),
    }


appbuilder.add_view(
    LogModelView,
    'Action Log',
    label=__('Action Log'),
    category='Security',
    category_label=__('Security'),
    icon='fa-list-ol')


@app.route('/health')
def health():
    return 'OK'


@app.route('/healthcheck')
def healthcheck():
    return 'OK'


@app.route('/ping')
def ping():
    return 'OK'


class KV(BaseSupersetView):

    """Used for storing and retrieving key value pairs"""

    @log_this
    @expose('/store/', methods=['POST'])
    def store(self):
        try:
            value = request.form.get('data')
            obj = models.KeyValue(value=value)
            db.session.add(obj)
            db.session.commit()
        except Exception as e:
            return json_error_response(e)
        return Response(
            json.dumps({'id': obj.id}),
            status=200)

    @log_this
    @expose('/<key_id>/', methods=['GET'])
    def get_value(self, key_id):
        kv = None
        try:
            kv = db.session.query(models.KeyValue).filter_by(id=key_id).one()
        except Exception as e:
            return json_error_response(e)
        return Response(kv.value, status=200)


appbuilder.add_view_no_menu(KV)


class R(BaseSupersetView):

    """used for short urls"""

    @log_this
    @expose('/<url_id>')
    def index(self, url_id):
        url = db.session.query(models.Url).filter_by(id=url_id).first()
        if url:
            return redirect('/' + url.url)
        else:
            flash('URL to nowhere...', 'danger')
            return redirect('/')

    @log_this
    @expose('/shortner/', methods=['POST', 'GET'])
    def shortner(self):
        url = request.form.get('data')
        directory = url.split('?')[0][2:]
        obj = models.Url(url=url)
        db.session.add(obj)
        db.session.commit()
        return('http://{request.headers[Host]}/{directory}?r={obj.id}'.format(
            request=request, directory=directory, obj=obj))

    @expose('/msg/')
    def msg(self):
        """Redirects to specified url while flash a message"""
        flash(Markup(request.args.get('msg')), 'info')
        return redirect(request.args.get('url'))


appbuilder.add_view_no_menu(R)


class Superset(BaseSupersetView):
    """The base views for Superset!"""
    def json_response(self, obj, status=200):
        return Response(
            json.dumps(obj, default=utils.json_int_dttm_ser),
            status=status,
            mimetype='application/json')

    @has_access_api
    @expose('/datasources/')
    def datasources(self):
        datasources = ConnectorRegistry.get_all_datasources(db.session)
        datasources = [o.short_data for o in datasources]
        datasources = sorted(datasources, key=lambda o: o['name'])
        return self.json_response(datasources)

    @has_access_api
    @expose('/override_role_permissions/', methods=['POST'])
    def override_role_permissions(self):
        """Updates the role with the give datasource permissions.

          Permissions not in the request will be revoked. This endpoint should
          be available to admins only. Expects JSON in the format:
           {
            'role_name': '{role_name}',
            'database': [{
                'datasource_type': '{table|druid}',
                'name': '{database_name}',
                'schema': [{
                    'name': '{schema_name}',
                    'datasources': ['{datasource name}, {datasource name}']
                }]
            }]
        }
        """
        data = request.get_json(force=True)
        role_name = data['role_name']
        databases = data['database']

        db_ds_names = set()
        for dbs in databases:
            for schema in dbs['schema']:
                for ds_name in schema['datasources']:
                    fullname = utils.get_datasource_full_name(
                        dbs['name'], ds_name, schema=schema['name'])
                    db_ds_names.add(fullname)

        existing_datasources = ConnectorRegistry.get_all_datasources(db.session)
        datasources = [
            d for d in existing_datasources if d.full_name in db_ds_names]
        role = sm.find_role(role_name)
        # remove all permissions
        role.permissions = []
        # grant permissions to the list of datasources
        granted_perms = []
        for datasource in datasources:
            view_menu_perm = sm.find_permission_view_menu(
                view_menu_name=datasource.perm,
                permission_name='datasource_access')
            # prevent creating empty permissions
            if view_menu_perm and view_menu_perm.view_menu:
                role.permissions.append(view_menu_perm)
                granted_perms.append(view_menu_perm.view_menu.name)
        db.session.commit()
        return self.json_response({
            'granted': granted_perms,
            'requested': list(db_ds_names),
        }, status=201)

    @log_this
    @has_access
    @expose('/request_access/')
    def request_access(self):
        datasources = set()
        dashboard_id = request.args.get('dashboard_id')
        if dashboard_id:
            dash = (
                db.session.query(models.Dashboard)
                .filter_by(id=int(dashboard_id))
                .one()
            )
            datasources |= dash.datasources
        datasource_id = request.args.get('datasource_id')
        datasource_type = request.args.get('datasource_type')
        if datasource_id:
            ds_class = ConnectorRegistry.sources.get(datasource_type)
            datasource = (
                db.session.query(ds_class)
                .filter_by(id=int(datasource_id))
                .one()
            )
            datasources.add(datasource)
        if request.args.get('action') == 'go':
            for datasource in datasources:
                access_request = DAR(
                    datasource_id=datasource.id,
                    datasource_type=datasource.type)
                db.session.add(access_request)
                db.session.commit()
            flash(__('Access was requested'), 'info')
            return redirect('/')

        return self.render_template(
            'superset/request_access.html',
            datasources=datasources,
            datasource_names=', '.join([o.name for o in datasources]),
        )

    @log_this
    @has_access
    @expose('/approve')
    def approve(self):
        def clean_fulfilled_requests(session):
            for r in session.query(DAR).all():
                datasource = ConnectorRegistry.get_datasource(
                    r.datasource_type, r.datasource_id, session)
                user = sm.get_user_by_id(r.created_by_fk)
                if not datasource or \
                   self.datasource_access(datasource, user):
                    # datasource does not exist anymore
                    session.delete(r)
            session.commit()
        datasource_type = request.args.get('datasource_type')
        datasource_id = request.args.get('datasource_id')
        created_by_username = request.args.get('created_by')
        role_to_grant = request.args.get('role_to_grant')
        role_to_extend = request.args.get('role_to_extend')

        session = db.session
        datasource = ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, session)

        if not datasource:
            flash(DATASOURCE_MISSING_ERR, 'alert')
            return json_error_response(DATASOURCE_MISSING_ERR)

        requested_by = sm.find_user(username=created_by_username)
        if not requested_by:
            flash(USER_MISSING_ERR, 'alert')
            return json_error_response(USER_MISSING_ERR)

        requests = (
            session.query(DAR)
            .filter(
                DAR.datasource_id == datasource_id,
                DAR.datasource_type == datasource_type,
                DAR.created_by_fk == requested_by.id)
            .all()
        )

        if not requests:
            flash(ACCESS_REQUEST_MISSING_ERR, 'alert')
            return json_error_response(ACCESS_REQUEST_MISSING_ERR)

        # check if you can approve
        if self.all_datasource_access() or g.user.id == datasource.owner_id:
            # can by done by admin only
            if role_to_grant:
                role = sm.find_role(role_to_grant)
                requested_by.roles.append(role)
                msg = __(
                    '%(user)s was granted the role %(role)s that gives access '
                    'to the %(datasource)s',
                    user=requested_by.username,
                    role=role_to_grant,
                    datasource=datasource.full_name)
                utils.notify_user_about_perm_udate(
                    g.user, requested_by, role, datasource,
                    'email/role_granted.txt', app.config)
                flash(msg, 'info')

            if role_to_extend:
                perm_view = sm.find_permission_view_menu(
                    'email/datasource_access', datasource.perm)
                role = sm.find_role(role_to_extend)
                sm.add_permission_role(role, perm_view)
                msg = __('Role %(r)s was extended to provide the access to '
                         'the datasource %(ds)s', r=role_to_extend,
                         ds=datasource.full_name)
                utils.notify_user_about_perm_udate(
                    g.user, requested_by, role, datasource,
                    'email/role_extended.txt', app.config)
                flash(msg, 'info')
            clean_fulfilled_requests(session)
        else:
            flash(__('You have no permission to approve this request'),
                  'danger')
            return redirect('/accessrequestsmodelview/list/')
        for r in requests:
            session.delete(r)
        session.commit()
        return redirect('/accessrequestsmodelview/list/')

    def get_form_data(self):
        d = {}
        post_data = request.form.get('form_data')
        request_args_data = request.args.get('form_data')
        # Supporting POST
        if post_data:
            d.update(json.loads(post_data))
        # request params can overwrite post body
        if request_args_data:
            d.update(json.loads(request_args_data))

        if request.args.get('viz_type'):
            # Converting old URLs
            d = cast_form_data(d)

        d = {k: v for k, v in d.items() if k not in FORM_DATA_KEY_BLACKLIST}

        return d

    def get_viz(
            self,
            slice_id=None,
            form_data=None,
            datasource_type=None,
            datasource_id=None,
            force=False,
    ):
        if slice_id:
            slc = (
                db.session.query(models.Slice)
                .filter_by(id=slice_id)
                .one()
            )
            return slc.get_viz()
        else:
            viz_type = form_data.get('viz_type', 'table')
            datasource = ConnectorRegistry.get_datasource(
                datasource_type, datasource_id, db.session)
            viz_obj = viz.viz_types[viz_type](
                datasource,
                form_data=form_data,
                force=force,
            )
            return viz_obj

    @has_access
    @expose('/slice/<slice_id>/')
    def slice(self, slice_id):
        viz_obj = self.get_viz(slice_id)
        endpoint = '/superset/explore/{}/{}?form_data={}'.format(
                viz_obj.datasource.type,
                viz_obj.datasource.id,
                parse.quote(json.dumps(viz_obj.form_data)),
            )
        if request.args.get('standalone') == 'true':
            endpoint += '&standalone=true'
        return redirect(endpoint)

    def get_query_string_response(self, viz_obj):
        query = None
        try:
            query_obj = viz_obj.query_obj()
            if query_obj:
                query = viz_obj.datasource.get_query_str(query_obj)
        except Exception as e:
            logging.exception(e)
            return json_error_response(e)

        if query_obj and query_obj['prequeries']:
            query_obj['prequeries'].append(query)
            query = ';\n\n'.join(query_obj['prequeries'])
        if query:
            query += ';'
        else:
            query = 'No query.'

        return Response(
            json.dumps({
                'query': query,
                'language': viz_obj.datasource.query_language,
            }),
            status=200,
            mimetype='application/json')

    def generate_json(self, datasource_type, datasource_id, form_data,
                      csv=False, query=False, force=False):
        try:
            viz_obj = self.get_viz(
                datasource_type=datasource_type,
                datasource_id=datasource_id,
                form_data=form_data,
                force=force,
            )
        except Exception as e:
            logging.exception(e)
            return json_error_response(
                utils.error_msg_from_exception(e),
                stacktrace=traceback.format_exc())

        if not self.datasource_access(viz_obj.datasource):
            return json_error_response(DATASOURCE_ACCESS_ERR, status=404)

        if csv:
            return CsvResponse(
                viz_obj.get_csv(),
                status=200,
                headers=generate_download_headers('csv'),
                mimetype='application/csv')

        if query:
            return self.get_query_string_response(viz_obj)

        try:
            payload = viz_obj.get_payload()
        except Exception as e:
            logging.exception(e)
            return json_error_response(utils.error_msg_from_exception(e))

        status = 200
        if payload.get('status') == QueryStatus.FAILED:
            status = 400

        return json_success(viz_obj.json_dumps(payload), status=status)

    @log_this
    @has_access_api
    @expose('/slice_json/<slice_id>')
    def slice_json(self, slice_id):
        try:
            viz_obj = self.get_viz(slice_id)
            datasource_type = viz_obj.datasource.type
            datasource_id = viz_obj.datasource.id
            form_data = viz_obj.form_data
            # This allows you to override the saved slice form data with
            # data from the current request (e.g. change the time window)
            form_data.update(self.get_form_data())
        except Exception as e:
            return json_error_response(
                utils.error_msg_from_exception(e),
                stacktrace=traceback.format_exc())
        return self.generate_json(datasource_type=datasource_type,
                                  datasource_id=datasource_id,
                                  form_data=form_data)

    @log_this
    @has_access_api
    @expose('/annotation_json/<layer_id>')
    def annotation_json(self, layer_id):
        form_data = self.get_form_data()
        form_data['layer_id'] = layer_id
        form_data['filters'] = [{'col': 'layer_id',
                                 'op': '==',
                                 'val': layer_id}]
        datasource = AnnotationDatasource()
        viz_obj = viz.viz_types['table'](
          datasource,
          form_data=form_data,
          force=False,
        )
        try:
            payload = viz_obj.get_payload()
        except Exception as e:
            logging.exception(e)
            return json_error_response(utils.error_msg_from_exception(e))
        status = 200
        if payload.get('status') == QueryStatus.FAILED:
            status = 400
        return json_success(viz_obj.json_dumps(payload), status=status)

    @log_this
    @has_access_api
    @expose('/explore_json/<datasource_type>/<datasource_id>/', methods=['GET', 'POST'])
    def explore_json(self, datasource_type, datasource_id):
        try:
            csv = request.args.get('csv') == 'true'
            query = request.args.get('query') == 'true'
            force = request.args.get('force') == 'true'
            form_data = self.get_form_data()
        except Exception as e:
            logging.exception(e)
            return json_error_response(
                utils.error_msg_from_exception(e),
                stacktrace=traceback.format_exc())
        return self.generate_json(datasource_type=datasource_type,
                                  datasource_id=datasource_id,
                                  form_data=form_data,
                                  csv=csv,
                                  query=query,
                                  force=force)

    @log_this
    @has_access
    @expose('/import_dashboards', methods=['GET', 'POST'])
    def import_dashboards(self):
        """Overrides the dashboards using json instances from the file."""
        f = request.files.get('file')
        if request.method == 'POST' and f:
            current_tt = int(time.time())
            data = json.loads(f.stream.read(), object_hook=utils.decode_dashboards)
            # TODO: import DRUID datasources
            for table in data['datasources']:
                type(table).import_obj(table, import_time=current_tt)
            db.session.commit()
            for dashboard in data['dashboards']:
                models.Dashboard.import_obj(
                    dashboard, import_time=current_tt)
            db.session.commit()
            return redirect('/dashboardmodelview/list/')
        return self.render_template('superset/import_dashboards.html')

    @log_this
    @has_access
    @expose('/explorev2/<datasource_type>/<datasource_id>/')
    def explorev2(self, datasource_type, datasource_id):
        return redirect(url_for(
            'Superset.explore',
            datasource_type=datasource_type,
            datasource_id=datasource_id,
            **request.args))

    @log_this
    @has_access
    @expose('/explore/<datasource_type>/<datasource_id>/', methods=['GET', 'POST'])
    def explore(self, datasource_type, datasource_id):
        datasource_id = int(datasource_id)
        user_id = g.user.get_id() if g.user else None
        form_data = self.get_form_data()

        saved_url = None
        url_id = request.args.get('r')
        if url_id:
            saved_url = db.session.query(models.Url).filter_by(id=url_id).first()
            if saved_url:
                url_str = parse.unquote_plus(
                    saved_url.url.split('?')[1][10:], encoding='utf-8', errors=None)
                url_form_data = json.loads(url_str)
                # allow form_date in request override saved url
                url_form_data.update(form_data)
                form_data = url_form_data
        slice_id = form_data.get('slice_id')
        slc = None
        if slice_id:
            slc = db.session.query(models.Slice).filter_by(id=slice_id).first()
            slice_form_data = slc.form_data.copy()
            # allow form_data in request override slice from_data
            slice_form_data.update(form_data)
            form_data = slice_form_data

        error_redirect = '/slicemodelview/list/'
        datasource = ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, db.session)
        if not datasource:
            flash(DATASOURCE_MISSING_ERR, 'danger')
            return redirect(error_redirect)

        if not self.datasource_access(datasource):
            flash(
                __(get_datasource_access_error_msg(datasource.name)),
                'danger')
            return redirect(
                'superset/request_access/?'
                'datasource_type={datasource_type}&'
                'datasource_id={datasource_id}&'
                ''.format(**locals()))

        viz_type = form_data.get('viz_type')
        if not viz_type and datasource.default_endpoint:
            return redirect(datasource.default_endpoint)

        # slc perms
        slice_add_perm = self.can_access('can_add', 'SliceModelView')
        slice_overwrite_perm = is_owner(slc, g.user)
        slice_download_perm = self.can_access('can_download', 'SliceModelView')

        form_data['datasource'] = str(datasource_id) + '__' + datasource_type

        # On explore, merge extra filters into the form data
        merge_extra_filters(form_data)

        # handle save or overwrite
        action = request.args.get('action')

        if action == 'overwrite' and not slice_overwrite_perm:
            return json_error_response(
                _('You don\'t have the rights to ') + _('alter this ') + _('chart'),
                status=400)

        if action == 'saveas' and not slice_add_perm:
            return json_error_response(
                _('You don\'t have the rights to ') + _('create a ') + _('chart'),
                status=400)

        if action in ('saveas', 'overwrite'):
            return self.save_or_overwrite_slice(
                request.args,
                slc, slice_add_perm,
                slice_overwrite_perm,
                slice_download_perm,
                datasource_id,
                datasource_type,
                datasource.name)

        standalone = request.args.get('standalone') == 'true'
        bootstrap_data = {
            'can_add': slice_add_perm,
            'can_download': slice_download_perm,
            'can_overwrite': slice_overwrite_perm,
            'datasource': datasource.data,
            'form_data': form_data,
            'datasource_id': datasource_id,
            'datasource_type': datasource_type,
            'slice': slc.data if slc else None,
            'standalone': standalone,
            'user_id': user_id,
            'forced_height': request.args.get('height'),
            'common': self.common_bootsrap_payload(),
        }
        table_name = datasource.table_name \
            if datasource_type == 'table' \
            else datasource.datasource_name
        if slc:
            title = '[slice] ' + slc.slice_name
        else:
            title = '[explore] ' + table_name
        return self.render_template(
            'superset/basic.html',
            bootstrap_data=json.dumps(bootstrap_data),
            entry='explore',
            title=title,
            standalone_mode=standalone)

    @api
    @has_access_api
    @expose('/filter/<datasource_type>/<datasource_id>/<column>/')
    def filter(self, datasource_type, datasource_id, column):
        """
        Endpoint to retrieve values for specified column.

        :param datasource_type: Type of datasource e.g. table
        :param datasource_id: Datasource id
        :param column: Column name to retrieve values for
        :return:
        """
        # TODO: Cache endpoint by user, datasource and column
        datasource = ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, db.session)
        if not datasource:
            return json_error_response(DATASOURCE_MISSING_ERR)
        if not self.datasource_access(datasource):
            return json_error_response(DATASOURCE_ACCESS_ERR)

        payload = json.dumps(
            datasource.values_for_column(
                column,
                config.get('FILTER_SELECT_ROW_LIMIT', 10000),
            ),
            default=utils.json_int_dttm_ser)
        return json_success(payload)

    def save_or_overwrite_slice(
            self, args, slc, slice_add_perm, slice_overwrite_perm, slice_download_perm,
            datasource_id, datasource_type, datasource_name):
        """Save or overwrite a slice"""
        slice_name = args.get('slice_name')
        action = args.get('action')
        form_data = self.get_form_data()

        if action in ('saveas'):
            if 'slice_id' in form_data:
                form_data.pop('slice_id')  # don't save old slice_id
            slc = models.Slice(owners=[g.user] if g.user else [])

        slc.params = json.dumps(form_data)
        slc.datasource_name = datasource_name
        slc.viz_type = form_data['viz_type']
        slc.datasource_type = datasource_type
        slc.datasource_id = datasource_id
        slc.slice_name = slice_name

        if action in ('saveas') and slice_add_perm:
            self.save_slice(slc)
        elif action == 'overwrite' and slice_overwrite_perm:
            self.overwrite_slice(slc)

        # Adding slice to a dashboard if requested
        dash = None
        if request.args.get('add_to_dash') == 'existing':
            dash = (
                db.session.query(models.Dashboard)
                .filter_by(id=int(request.args.get('save_to_dashboard_id')))
                .one()
            )

            # check edit dashboard permissions
            dash_overwrite_perm = check_ownership(dash, raise_if_false=False)
            if not dash_overwrite_perm:
                return json_error_response(
                    _('You don\'t have the rights to ') + _('alter this ') +
                    _('dashboard'),
                    status=400)

            flash(
                'Slice [{}] was added to dashboard [{}]'.format(
                    slc.slice_name,
                    dash.dashboard_title),
                'info')
        elif request.args.get('add_to_dash') == 'new':
            # check create dashboard permissions
            dash_add_perm = self.can_access('can_add', 'DashboardModelView')
            if not dash_add_perm:
                return json_error_response(
                    _('You don\'t have the rights to ') + _('create a ') + _('dashboard'),
                    status=400)

            dash = models.Dashboard(
                dashboard_title=request.args.get('new_dashboard_name'),
                owners=[g.user] if g.user else [])
            flash(
                'Dashboard [{}] just got created and slice [{}] was added '
                'to it'.format(
                    dash.dashboard_title,
                    slc.slice_name),
                'info')

        if dash and slc not in dash.slices:
            dash.slices.append(slc)
            db.session.commit()

        response = {
            'can_add': slice_add_perm,
            'can_download': slice_download_perm,
            'can_overwrite': is_owner(slc, g.user),
            'form_data': slc.form_data,
            'slice': slc.data,
        }

        if request.args.get('goto_dash') == 'true':
            response.update({'dashboard': dash.url})

        return json_success(json.dumps(response))

    def save_slice(self, slc):
        session = db.session()
        msg = 'Slice [{}] has been saved'.format(slc.slice_name)
        session.add(slc)
        session.commit()
        flash(msg, 'info')

    def overwrite_slice(self, slc):
        session = db.session()
        session.merge(slc)
        session.commit()
        msg = 'Slice [{}] has been overwritten'.format(slc.slice_name)
        flash(msg, 'info')

    @api
    @has_access_api
    @expose('/checkbox/<model_view>/<id_>/<attr>/<value>', methods=['GET'])
    def checkbox(self, model_view, id_, attr, value):
        """endpoint for checking/unchecking any boolean in a sqla model"""
        modelview_to_model = {
            'TableColumnInlineView':
                ConnectorRegistry.sources['table'].column_class,
            'DruidColumnInlineView':
                ConnectorRegistry.sources['druid'].column_class,
        }
        model = modelview_to_model[model_view]
        col = db.session.query(model).filter_by(id=id_).first()
        checked = value == 'true'
        if col:
            setattr(col, attr, checked)
            if checked:
                metrics = col.get_metrics().values()
                col.datasource.add_missing_metrics(metrics)
            db.session.commit()
        return json_success('OK')

    @api
    @has_access_api
    @expose('/activity_per_day')
    def activity_per_day(self):
        """endpoint to power the calendar heatmap on the welcome page"""
        Log = models.Log  # noqa
        qry = (
            db.session
            .query(
                Log.dt,
                sqla.func.count())
            .group_by(Log.dt)
            .all()
        )
        payload = {str(time.mktime(dt.timetuple())):
                   ccount for dt, ccount in qry if dt}
        return json_success(json.dumps(payload))

    @api
    @has_access_api
    @expose('/schemas/<db_id>/')
    def schemas(self, db_id):
        db_id = int(db_id)
        database = (
            db.session
            .query(models.Database)
            .filter_by(id=db_id)
            .one()
        )
        schemas = database.all_schema_names()
        schemas = self.schemas_accessible_by_user(database, schemas)
        return Response(
            json.dumps({'schemas': schemas}),
            mimetype='application/json')

    @api
    @has_access_api
    @expose('/tables/<db_id>/<schema>/<substr>/')
    def tables(self, db_id, schema, substr):
        """Endpoint to fetch the list of tables for given database"""
        db_id = int(db_id)
        schema = utils.js_string_to_python(schema)
        substr = utils.js_string_to_python(substr)
        database = db.session.query(models.Database).filter_by(id=db_id).one()
        table_names = self.accessible_by_user(
            database, database.all_table_names(schema), schema)
        view_names = self.accessible_by_user(
            database, database.all_view_names(schema), schema)

        if substr:
            table_names = [tn for tn in table_names if substr in tn]
            view_names = [vn for vn in view_names if substr in vn]

        max_items = config.get('MAX_TABLE_NAMES') or len(table_names)
        total_items = len(table_names) + len(view_names)
        max_tables = len(table_names)
        max_views = len(view_names)
        if total_items and substr:
            max_tables = max_items * len(table_names) // total_items
            max_views = max_items * len(view_names) // total_items

        table_options = [{'value': tn, 'label': tn}
                         for tn in table_names[:max_tables]]
        table_options.extend([{'value': vn, 'label': '[view] {}'.format(vn)}
                              for vn in view_names[:max_views]])
        payload = {
            'tableLength': len(table_names) + len(view_names),
            'options': table_options,
        }
        return json_success(json.dumps(payload))

    @api
    @has_access_api
    @expose('/copy_dash/<dashboard_id>/', methods=['GET', 'POST'])
    def copy_dash(self, dashboard_id):
        """Copy dashboard"""
        session = db.session()
        data = json.loads(request.form.get('data'))
        dash = models.Dashboard()
        original_dash = (
            session
            .query(models.Dashboard)
            .filter_by(id=dashboard_id).first())

        dash.owners = [g.user] if g.user else []
        dash.dashboard_title = data['dashboard_title']
        if data['duplicate_slices']:
            # Duplicating slices as well, mapping old ids to new ones
            old_to_new_sliceids = {}
            for slc in original_dash.slices:
                new_slice = slc.clone()
                new_slice.owners = [g.user] if g.user else []
                session.add(new_slice)
                session.flush()
                new_slice.dashboards.append(dash)
                old_to_new_sliceids['{}'.format(slc.id)] =\
                    '{}'.format(new_slice.id)
            for d in data['positions']:
                d['slice_id'] = old_to_new_sliceids[d['slice_id']]
        else:
            dash.slices = original_dash.slices
        dash.params = original_dash.params

        self._set_dash_metadata(dash, data)
        session.add(dash)
        session.commit()
        dash_json = json.dumps(dash.data)
        session.close()
        return json_success(dash_json)

    @api
    @has_access_api
    @expose('/save_dash/<dashboard_id>/', methods=['GET', 'POST'])
    def save_dash(self, dashboard_id):
        """Save a dashboard's metadata"""
        session = db.session()
        dash = (session
                .query(models.Dashboard)
                .filter_by(id=dashboard_id).first())
        check_ownership(dash, raise_if_false=True)
        data = json.loads(request.form.get('data'))
        self._set_dash_metadata(dash, data)
        session.merge(dash)
        session.commit()
        session.close()
        return 'SUCCESS'

    @staticmethod
    def _set_dash_metadata(dashboard, data):
        positions = data['positions']
        slice_ids = [int(d['slice_id']) for d in positions]
        dashboard.slices = [o for o in dashboard.slices if o.id in slice_ids]
        positions = sorted(data['positions'], key=lambda x: int(x['slice_id']))
        dashboard.position_json = json.dumps(positions, indent=4, sort_keys=True)
        md = dashboard.params_dict
        dashboard.css = data['css']
        dashboard.dashboard_title = data['dashboard_title']

        if 'filter_immune_slices' not in md:
            md['filter_immune_slices'] = []
        if 'timed_refresh_immune_slices' not in md:
            md['timed_refresh_immune_slices'] = []
        if 'filter_immune_slice_fields' not in md:
            md['filter_immune_slice_fields'] = {}
        md['expanded_slices'] = data['expanded_slices']
        md['default_filters'] = data.get('default_filters', '')
        dashboard.json_metadata = json.dumps(md, indent=4)

    @api
    @has_access_api
    @expose('/add_slices/<dashboard_id>/', methods=['POST'])
    def add_slices(self, dashboard_id):
        """Add and save slices to a dashboard"""
        data = json.loads(request.form.get('data'))
        session = db.session()
        Slice = models.Slice  # noqa
        dash = (
            session.query(models.Dashboard).filter_by(id=dashboard_id).first())
        check_ownership(dash, raise_if_false=True)
        new_slices = session.query(Slice).filter(
            Slice.id.in_(data['slice_ids']))
        dash.slices += new_slices
        session.merge(dash)
        session.commit()
        session.close()
        return 'SLICES ADDED'

    @api
    @has_access_api
    @expose('/testconn', methods=['POST', 'GET'])
    def testconn(self):
        """Tests a sqla connection"""
        try:
            username = g.user.username if g.user is not None else None
            uri = request.json.get('uri')
            db_name = request.json.get('name')
            impersonate_user = request.json.get('impersonate_user')
            database = None
            if db_name:
                database = (
                    db.session
                    .query(models.Database)
                    .filter_by(database_name=db_name)
                    .first()
                )
                if database and uri == database.safe_sqlalchemy_uri():
                    # the password-masked uri was passed
                    # use the URI associated with this database
                    uri = database.sqlalchemy_uri_decrypted

            configuration = {}

            if database and uri:
                url = make_url(uri)
                db_engine = models.Database.get_db_engine_spec_for_backend(
                    url.get_backend_name())
                db_engine.patch()

                masked_url = database.get_password_masked_url_from_uri(uri)
                logging.info('Superset.testconn(). Masked URL: {0}'.format(masked_url))

                configuration.update(
                    db_engine.get_configuration_for_impersonation(uri,
                                                                  impersonate_user,
                                                                  username),
                )

            connect_args = (
                request.json
                .get('extras', {})
                .get('engine_params', {})
                .get('connect_args', {}))

            if configuration:
                connect_args['configuration'] = configuration

            engine = create_engine(uri, connect_args=connect_args)
            engine.connect()
            return json_success(json.dumps(engine.table_names(), indent=4))
        except Exception as e:
            logging.exception(e)
            return json_error_response((
                'Connection failed!\n\n'
                'The error message returned was:\n{}').format(e))

    @api
    @has_access_api
    @expose('/recent_activity/<user_id>/', methods=['GET'])
    def recent_activity(self, user_id):
        """Recent activity (actions) for a given user"""
        M = models  # noqa
        qry = (
            db.session.query(M.Log, M.Dashboard, M.Slice)
            .outerjoin(
                M.Dashboard,
                M.Dashboard.id == M.Log.dashboard_id,
            )
            .outerjoin(
                M.Slice,
                M.Slice.id == M.Log.slice_id,
            )
            .filter(
                sqla.and_(
                    ~M.Log.action.in_(('queries', 'shortner', 'sql_json')),
                    M.Log.user_id == user_id,
                ),
            )
            .order_by(M.Log.dttm.desc())
            .limit(1000)
        )
        payload = []
        for log in qry.all():
            item_url = None
            item_title = None
            if log.Dashboard:
                item_url = log.Dashboard.url
                item_title = log.Dashboard.dashboard_title
            elif log.Slice:
                item_url = log.Slice.slice_url
                item_title = log.Slice.slice_name

            payload.append({
                'action': log.Log.action,
                'item_url': item_url,
                'item_title': item_title,
                'time': log.Log.dttm,
            })
        return json_success(
            json.dumps(payload, default=utils.json_int_dttm_ser))

    @api
    @has_access_api
    @expose('/csrf_token/', methods=['GET'])
    def csrf_token(self):
        return Response(
            self.render_template('superset/csrf_token.json'),
            mimetype='text/json',
        )

    @api
    @has_access_api
    @expose('/fave_dashboards_by_username/<username>/', methods=['GET'])
    def fave_dashboards_by_username(self, username):
        """This lets us use a user's username to pull favourite dashboards"""
        user = sm.find_user(username=username)
        return self.fave_dashboards(user.get_id())

    @api
    @has_access_api
    @expose('/fave_dashboards/<user_id>/', methods=['GET'])
    def fave_dashboards(self, user_id):
        qry = (
            db.session.query(
                models.Dashboard,
                models.FavStar.dttm,
            )
            .join(
                models.FavStar,
                sqla.and_(
                    models.FavStar.user_id == int(user_id),
                    models.FavStar.class_name == 'Dashboard',
                    models.Dashboard.id == models.FavStar.obj_id,
                ),
            )
            .order_by(
                models.FavStar.dttm.desc(),
            )
        )
        payload = []
        for o in qry.all():
            d = {
                'id': o.Dashboard.id,
                'dashboard': o.Dashboard.dashboard_link(),
                'title': o.Dashboard.dashboard_title,
                'url': o.Dashboard.url,
                'dttm': o.dttm,
            }
            if o.Dashboard.created_by:
                user = o.Dashboard.created_by
                d['creator'] = str(user)
                d['creator_url'] = '/superset/profile/{}/'.format(
                    user.username)
            payload.append(d)
        return json_success(
            json.dumps(payload, default=utils.json_int_dttm_ser))

    @api
    @has_access_api
    @expose('/created_dashboards/<user_id>/', methods=['GET'])
    def created_dashboards(self, user_id):
        Dash = models.Dashboard  # noqa
        qry = (
            db.session.query(
                Dash,
            )
            .filter(
                sqla.or_(
                    Dash.created_by_fk == user_id,
                    Dash.changed_by_fk == user_id,
                ),
            )
            .order_by(
                Dash.changed_on.desc(),
            )
        )
        payload = [{
            'id': o.id,
            'dashboard': o.dashboard_link(),
            'title': o.dashboard_title,
            'url': o.url,
            'dttm': o.changed_on,
        } for o in qry.all()]
        return json_success(
            json.dumps(payload, default=utils.json_int_dttm_ser))

    @api
    @has_access_api
    @expose('/user_slices', methods=['GET'])
    @expose('/user_slices/<user_id>/', methods=['GET'])
    def user_slices(self, user_id=None):
        """List of slices a user created, or faved"""
        if not user_id:
            user_id = g.user.id
        Slice = models.Slice  # noqa
        FavStar = models.FavStar # noqa
        qry = (
            db.session.query(Slice,
                             FavStar.dttm).join(
                models.FavStar,
                sqla.and_(
                    models.FavStar.user_id == int(user_id),
                    models.FavStar.class_name == 'slice',
                    models.Slice.id == models.FavStar.obj_id,
                ),
                isouter=True).filter(
                sqla.or_(
                    Slice.created_by_fk == user_id,
                    Slice.changed_by_fk == user_id,
                    FavStar.user_id == user_id,
                ),
            )
            .order_by(Slice.slice_name.asc())
        )
        payload = [{
            'id': o.Slice.id,
            'title': o.Slice.slice_name,
            'url': o.Slice.slice_url,
            'data': o.Slice.form_data,
            'dttm': o.dttm if o.dttm else o.Slice.changed_on,
            'viz_type': o.Slice.viz_type,
        } for o in qry.all()]
        return json_success(
            json.dumps(payload, default=utils.json_int_dttm_ser))

    @api
    @has_access_api
    @expose('/created_slices', methods=['GET'])
    @expose('/created_slices/<user_id>/', methods=['GET'])
    def created_slices(self, user_id=None):
        """List of slices created by this user"""
        if not user_id:
            user_id = g.user.id
        Slice = models.Slice  # noqa
        qry = (
            db.session.query(Slice)
            .filter(
                sqla.or_(
                    Slice.created_by_fk == user_id,
                    Slice.changed_by_fk == user_id,
                ),
            )
            .order_by(Slice.changed_on.desc())
        )
        payload = [{
            'id': o.id,
            'title': o.slice_name,
            'url': o.slice_url,
            'dttm': o.changed_on,
            'viz_type': o.viz_type,
        } for o in qry.all()]
        return json_success(
            json.dumps(payload, default=utils.json_int_dttm_ser))

    @api
    @has_access_api
    @expose('/fave_slices', methods=['GET'])
    @expose('/fave_slices/<user_id>/', methods=['GET'])
    def fave_slices(self, user_id=None):
        """Favorite slices for a user"""
        if not user_id:
            user_id = g.user.id
        qry = (
            db.session.query(
                models.Slice,
                models.FavStar.dttm,
            )
            .join(
                models.FavStar,
                sqla.and_(
                    models.FavStar.user_id == int(user_id),
                    models.FavStar.class_name == 'slice',
                    models.Slice.id == models.FavStar.obj_id,
                ),
            )
            .order_by(
                models.FavStar.dttm.desc(),
            )
        )
        payload = []
        for o in qry.all():
            d = {
                'id': o.Slice.id,
                'title': o.Slice.slice_name,
                'url': o.Slice.slice_url,
                'dttm': o.dttm,
                'viz_type': o.Slice.viz_type,
            }
            if o.Slice.created_by:
                user = o.Slice.created_by
                d['creator'] = str(user)
                d['creator_url'] = '/superset/profile/{}/'.format(
                    user.username)
            payload.append(d)
        return json_success(
            json.dumps(payload, default=utils.json_int_dttm_ser))

    @api
    @has_access_api
    @expose('/warm_up_cache/', methods=['GET'])
    def warm_up_cache(self):
        """Warms up the cache for the slice or table.

        Note for slices a force refresh occurs.
        """
        slices = None
        session = db.session()
        slice_id = request.args.get('slice_id')
        table_name = request.args.get('table_name')
        db_name = request.args.get('db_name')

        if not slice_id and not (table_name and db_name):
            return json_error_response(__(
                'Malformed request. slice_id or table_name and db_name '
                'arguments are expected'), status=400)
        if slice_id:
            slices = session.query(models.Slice).filter_by(id=slice_id).all()
            if not slices:
                return json_error_response(__(
                    'Slice %(id)s not found', id=slice_id), status=404)
        elif table_name and db_name:
            SqlaTable = ConnectorRegistry.sources['table']
            table = (
                session.query(SqlaTable)
                .join(models.Database)
                .filter(
                    models.Database.database_name == db_name or
                    SqlaTable.table_name == table_name)
            ).first()
            if not table:
                return json_error_response(__(
                    "Table %(t)s wasn't found in the database %(d)s",
                    t=table_name, s=db_name), status=404)
            slices = session.query(models.Slice).filter_by(
                datasource_id=table.id,
                datasource_type=table.type).all()

        for slc in slices:
            try:
                obj = slc.get_viz(force=True)
                obj.get_json()
            except Exception as e:
                return json_error_response(utils.error_msg_from_exception(e))
        return json_success(json.dumps(
            [{'slice_id': slc.id, 'slice_name': slc.slice_name}
             for slc in slices]))

    @expose('/favstar/<class_name>/<obj_id>/<action>/')
    def favstar(self, class_name, obj_id, action):
        """Toggle favorite stars on Slices and Dashboard"""
        session = db.session()
        FavStar = models.FavStar  # noqa
        count = 0
        favs = session.query(FavStar).filter_by(
            class_name=class_name, obj_id=obj_id,
            user_id=g.user.get_id()).all()
        if action == 'select':
            if not favs:
                session.add(
                    FavStar(
                        class_name=class_name,
                        obj_id=obj_id,
                        user_id=g.user.get_id(),
                        dttm=datetime.now(),
                    ),
                )
            count = 1
        elif action == 'unselect':
            for fav in favs:
                session.delete(fav)
        else:
            count = len(favs)
        session.commit()
        return json_success(json.dumps({'count': count}))

    @has_access
    @expose('/dashboard/<dashboard_id>/')
    def dashboard(self, dashboard_id):
        """Server side rendering for a dashboard"""
        session = db.session()
        qry = session.query(models.Dashboard)
        if dashboard_id.isdigit():
            qry = qry.filter_by(id=int(dashboard_id))
        else:
            qry = qry.filter_by(slug=dashboard_id)

        dash = qry.one()
        datasources = set()
        for slc in dash.slices:
            datasource = slc.datasource
            if datasource:
                datasources.add(datasource)

        if config.get('ENABLE_ACCESS_REQUEST'):
            for datasource in datasources:
                if datasource and not self.datasource_access(datasource):
                    flash(
                        __(get_datasource_access_error_msg(datasource.name)),
                        'danger')
                    return redirect(
                        'superset/request_access/?'
                        'dashboard_id={dash.id}&'.format(**locals()))

        # Hack to log the dashboard_id properly, even when getting a slug
        @log_this
        def dashboard(**kwargs):  # noqa
            pass
        dashboard(dashboard_id=dash.id)

        dash_edit_perm = check_ownership(dash, raise_if_false=False)
        dash_save_perm = \
            dash_edit_perm and self.can_access('can_save_dash', 'Superset')

        standalone_mode = request.args.get('standalone') == 'true'

        dashboard_data = dash.data
        dashboard_data.update({
            'standalone_mode': standalone_mode,
            'dash_save_perm': dash_save_perm,
            'dash_edit_perm': dash_edit_perm,
        })

        bootstrap_data = {
            'user_id': g.user.get_id(),
            'dashboard_data': dashboard_data,
            'datasources': {ds.uid: ds.data for ds in datasources},
            'common': self.common_bootsrap_payload(),
        }

        if request.args.get('json') == 'true':
            return json_success(json.dumps(bootstrap_data))

        return self.render_template(
            'superset/dashboard.html',
            entry='dashboard',
            standalone_mode=standalone_mode,
            title='[dashboard] ' + dash.dashboard_title,
            bootstrap_data=json.dumps(bootstrap_data),
        )

    @api
    @log_this
    @expose('/log/', methods=['POST'])
    def log(self):
        return Response(status=200)

    @has_access
    @expose('/sync_druid/', methods=['POST'])
    @log_this
    def sync_druid_source(self):
        """Syncs the druid datasource in main db with the provided config.

        The endpoint takes 3 arguments:
            user - user name to perform the operation as
            cluster - name of the druid cluster
            config - configuration stored in json that contains:
                name: druid datasource name
                dimensions: list of the dimensions, they become druid columns
                    with the type STRING
                metrics_spec: list of metrics (dictionary). Metric consists of
                    2 attributes: type and name. Type can be count,
                    etc. `count` type is stored internally as longSum
            other fields will be ignored.

            Example: {
                'name': 'test_click',
                'metrics_spec': [{'type': 'count', 'name': 'count'}],
                'dimensions': ['affiliate_id', 'campaign', 'first_seen']
            }
        """
        payload = request.get_json(force=True)
        druid_config = payload['config']
        user_name = payload['user']
        cluster_name = payload['cluster']

        user = sm.find_user(username=user_name)
        DruidDatasource = ConnectorRegistry.sources['druid']
        DruidCluster = DruidDatasource.cluster_class
        if not user:
            err_msg = __("Can't find User '%(name)s', please ask your admin "
                         'to create one.', name=user_name)
            logging.error(err_msg)
            return json_error_response(err_msg)
        cluster = db.session.query(DruidCluster).filter_by(
            cluster_name=cluster_name).first()
        if not cluster:
            err_msg = __("Can't find DruidCluster with cluster_name = "
                         "'%(name)s'", name=cluster_name)
            logging.error(err_msg)
            return json_error_response(err_msg)
        try:
            DruidDatasource.sync_to_db_from_config(
                druid_config, user, cluster)
        except Exception as e:
            logging.exception(utils.error_msg_from_exception(e))
            return json_error_response(utils.error_msg_from_exception(e))
        return Response(status=201)

    @has_access
    @expose('/sqllab_viz/', methods=['POST'])
    @log_this
    def sqllab_viz(self):
        SqlaTable = ConnectorRegistry.sources['table']
        data = json.loads(request.form.get('data'))
        table_name = data.get('datasourceName')
        SqlaTable = ConnectorRegistry.sources['table']
        table = (
            db.session.query(SqlaTable)
            .filter_by(table_name=table_name)
            .first()
        )
        if not table:
            table = SqlaTable(table_name=table_name)
        table.database_id = data.get('dbId')
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
        return self.json_response(json.dumps({
            'table_id': table.id,
        }))

    @has_access
    @expose('/table/<database_id>/<table_name>/<schema>/')
    @log_this
    def table(self, database_id, table_name, schema):
        schema = utils.js_string_to_python(schema)
        mydb = db.session.query(models.Database).filter_by(id=database_id).one()
        cols = []
        indexes = []
        t = mydb.get_columns(table_name, schema)
        try:
            t = mydb.get_columns(table_name, schema)
            indexes = mydb.get_indexes(table_name, schema)
            primary_key = mydb.get_pk_constraint(table_name, schema)
            foreign_keys = mydb.get_foreign_keys(table_name, schema)
        except Exception as e:
            return json_error_response(utils.error_msg_from_exception(e))
        keys = []
        if primary_key and primary_key.get('constrained_columns'):
            primary_key['column_names'] = primary_key.pop('constrained_columns')
            primary_key['type'] = 'pk'
            keys += [primary_key]
        for fk in foreign_keys:
            fk['column_names'] = fk.pop('constrained_columns')
            fk['type'] = 'fk'
        keys += foreign_keys
        for idx in indexes:
            idx['type'] = 'index'
        keys += indexes

        for col in t:
            dtype = ''
            try:
                dtype = '{}'.format(col['type'])
            except Exception:
                pass
            cols.append({
                'name': col['name'],
                'type': dtype.split('(')[0] if '(' in dtype else dtype,
                'longType': dtype,
                'keys': [
                    k for k in keys
                    if col['name'] in k.get('column_names')
                ],
            })
        tbl = {
            'name': table_name,
            'columns': cols,
            'selectStar': mydb.select_star(
                table_name, schema=schema, show_cols=True, indent=True),
            'primaryKey': primary_key,
            'foreignKeys': foreign_keys,
            'indexes': keys,
        }
        return json_success(json.dumps(tbl))

    @has_access
    @expose('/extra_table_metadata/<database_id>/<table_name>/<schema>/')
    @log_this
    def extra_table_metadata(self, database_id, table_name, schema):
        schema = utils.js_string_to_python(schema)
        mydb = db.session.query(models.Database).filter_by(id=database_id).one()
        payload = mydb.db_engine_spec.extra_table_metadata(
            mydb, table_name, schema)
        return json_success(json.dumps(payload))

    @has_access
    @expose('/select_star/<database_id>/<table_name>/')
    @log_this
    def select_star(self, database_id, table_name):
        mydb = db.session.query(
            models.Database).filter_by(id=database_id).first()
        return self.render_template(
            'superset/ajah.html',
            content=mydb.select_star(table_name, show_cols=True),
        )

    @expose('/theme/')
    def theme(self):
        return self.render_template('superset/theme.html')

    @has_access_api
    @expose('/cached_key/<key>/')
    @log_this
    def cached_key(self, key):
        """Returns a key from the cache"""
        resp = cache.get(key)
        if resp:
            return resp
        return 'nope'

    @has_access_api
    @expose('/cache_key_exist/<key>/')
    @log_this
    def cache_key_exist(self, key):
        """Returns if a key from cache exist"""
        key_exist = True if cache.get(key) else False
        status = 200 if key_exist else 404
        return json_success(json.dumps({'key_exist': key_exist}),
                            status=status)

    @has_access_api
    @expose('/results/<key>/')
    @log_this
    def results(self, key):
        """Serves a key off of the results backend"""
        if not results_backend:
            return json_error_response("Results backend isn't configured")

        blob = results_backend.get(key)
        if not blob:
            return json_error_response(
                'Data could not be retrieved. '
                'You may want to re-run the query.',
                status=410,
            )

        query = db.session.query(Query).filter_by(results_key=key).one()
        rejected_tables = self.rejected_datasources(
            query.sql, query.database, query.schema)
        if rejected_tables:
            return json_error_response(get_datasource_access_error_msg(
                '{}'.format(rejected_tables)))

        payload = utils.zlib_decompress_to_string(blob)
        display_limit = app.config.get('DISPLAY_SQL_MAX_ROW', None)
        if display_limit:
            payload_json = json.loads(payload)
            payload_json['data'] = payload_json['data'][:display_limit]
        return json_success(
            json.dumps(payload_json, default=utils.json_iso_dttm_ser))

    @has_access_api
    @expose('/stop_query/', methods=['POST'])
    @log_this
    def stop_query(self):
        client_id = request.form.get('client_id')
        try:
            query = (
                db.session.query(Query)
                .filter_by(client_id=client_id).one()
            )
            query.status = utils.QueryStatus.STOPPED
            db.session.commit()
        except Exception:
            pass
        return self.json_response('OK')

    @has_access_api
    @expose('/sql_json/', methods=['POST', 'GET'])
    @log_this
    def sql_json(self):
        """Runs arbitrary sql and returns and json"""
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

        rejected_tables = self.rejected_datasources(sql, mydb, schema)
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

    @has_access
    @expose('/csv/<client_id>')
    @log_this
    def csv(self, client_id):
        """Download the query results as csv."""
        logging.info('Exporting CSV file [{}]'.format(client_id))
        query = (
            db.session.query(Query)
            .filter_by(client_id=client_id)
            .one()
        )

        rejected_tables = self.rejected_datasources(
            query.sql, query.database, query.schema)
        if rejected_tables:
            flash(get_datasource_access_error_msg('{}'.format(rejected_tables)))
            return redirect('/')
        blob = None
        if results_backend and query.results_key:
            logging.info(
                'Fetching CSV from results backend '
                '[{}]'.format(query.results_key))
            blob = results_backend.get(query.results_key)
        if blob:
            logging.info('Decompressing')
            json_payload = utils.zlib_decompress_to_string(blob)
            obj = json.loads(json_payload)
            columns = [c['name'] for c in obj['columns']]
            df = pd.DataFrame.from_records(obj['data'], columns=columns)
            logging.info('Using pandas to convert to CSV')
            csv = df.to_csv(index=False, **config.get('CSV_EXPORT'))
        else:
            logging.info('Running a query to turn into CSV')
            sql = query.select_sql or query.executed_sql
            df = query.database.get_df(sql, query.schema)
            # TODO(bkyryliuk): add compression=gzip for big files.
            csv = df.to_csv(index=False, **config.get('CSV_EXPORT'))
        response = Response(csv, mimetype='text/csv')
        response.headers['Content-Disposition'] = (
            'attachment; filename={}.csv'.format(unidecode(query.name)))
        logging.info('Ready to return response')
        return response

    @has_access
    @expose('/fetch_datasource_metadata')
    @log_this
    def fetch_datasource_metadata(self):
        datasource_id, datasource_type = (
            request.args.get('datasourceKey').split('__'))
        datasource = ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, db.session)
        # Check if datasource exists
        if not datasource:
            return json_error_response(DATASOURCE_MISSING_ERR)

        # Check permission for datasource
        if not self.datasource_access(datasource):
            return json_error_response(DATASOURCE_ACCESS_ERR)
        return json_success(json.dumps(datasource.data))

    @expose('/queries/<last_updated_ms>')
    def queries(self, last_updated_ms):
        """Get the updated queries."""
        stats_logger.incr('queries')
        if not g.user.get_id():
            return json_error_response(
                'Please login to access the queries.', status=403)

        # Unix time, milliseconds.
        last_updated_ms_int = int(float(last_updated_ms)) if last_updated_ms else 0

        # UTC date time, same that is stored in the DB.
        last_updated_dt = utils.EPOCH + timedelta(seconds=last_updated_ms_int / 1000)

        sql_queries = (
            db.session.query(Query)
            .filter(
                Query.user_id == g.user.get_id(),
                Query.changed_on >= last_updated_dt,
            )
            .all()
        )
        dict_queries = {q.client_id: q.to_dict() for q in sql_queries}
        return json_success(
            json.dumps(dict_queries, default=utils.json_int_dttm_ser))

    @has_access
    @expose('/search_queries')
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

        return Response(
            json.dumps(dict_queries, default=utils.json_int_dttm_ser),
            status=200,
            mimetype='application/json')

    @app.errorhandler(500)
    def show_traceback(self):
        return render_template(
            'superset/traceback.html',
            error_msg=get_error_msg(),
        ), 500

    @expose('/welcome')
    def welcome(self):
        """Personalized welcome page"""
        if not g.user or not g.user.get_id():
            return redirect(appbuilder.get_url_for_login)
        payload = {
            'common': self.common_bootsrap_payload(),
        }
        return self.render_template(
            'superset/basic.html',
            entry='welcome',
            title='Superset',
            bootstrap_data=json.dumps(payload, default=utils.json_iso_dttm_ser),
        )

    @has_access
    @expose('/profile/<username>/')
    def profile(self, username):
        """User profile page"""
        if not username and g.user:
            username = g.user.username
        user = (
            db.session.query(ab_models.User)
            .filter_by(username=username)
            .one()
        )
        roles = {}
        permissions = defaultdict(set)
        for role in user.roles:
            perms = set()
            for perm in role.permissions:
                if perm.permission and perm.view_menu:
                    perms.add(
                        (perm.permission.name, perm.view_menu.name),
                    )
                    if perm.permission.name in ('datasource_access', 'database_access'):
                        permissions[perm.permission.name].add(perm.view_menu.name)
            roles[role.name] = [
                [perm.permission.name, perm.view_menu.name]
                for perm in role.permissions
                if perm.permission and perm.view_menu
            ]
        payload = {
            'user': {
                'username': user.username,
                'firstName': user.first_name,
                'lastName': user.last_name,
                'userId': user.id,
                'isActive': user.is_active(),
                'createdOn': user.created_on.isoformat(),
                'email': user.email,
                'roles': roles,
                'permissions': permissions,
            },
            'common': self.common_bootsrap_payload(),
        }
        return self.render_template(
            'superset/basic.html',
            title=user.username + "'s profile",
            entry='profile',
            bootstrap_data=json.dumps(payload, default=utils.json_iso_dttm_ser),
        )

    @has_access
    @expose('/sqllab')
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

    @api
    @has_access_api
    @expose('/slice_query/<slice_id>/')
    def sliceQuery(self, slice_id):
        """
        This method exposes an API endpoint to
        get the database query string for this slice
        """
        viz_obj = self.get_viz(slice_id)
        if not self.datasource_access(viz_obj.datasource):
            return json_error_response(DATASOURCE_ACCESS_ERR, status=401)
        return self.get_query_string_response(viz_obj)


appbuilder.add_view_no_menu(Superset)


class CssTemplateModelView(SupersetModelView, DeleteMixin):
    datamodel = SQLAInterface(models.CssTemplate)
    list_columns = ['template_name']
    edit_columns = ['template_name', 'css']
    add_columns = edit_columns
    label_columns = {
        'template_name': _('Template Name'),
    }


class CssTemplateAsyncModelView(CssTemplateModelView):
    list_columns = ['template_name', 'css']


appbuilder.add_separator('Sources')
appbuilder.add_view(
    CssTemplateModelView,
    'CSS Templates',
    label=__('CSS Templates'),
    icon='fa-css3',
    category='Manage',
    category_label=__('Manage'),
    category_icon='')


appbuilder.add_view_no_menu(CssTemplateAsyncModelView)

appbuilder.add_link(
    'SQL Editor',
    label=_('SQL Editor'),
    href='/superset/sqllab',
    category_icon='fa-flask',
    icon='fa-flask',
    category='SQL Lab',
    category_label=__('SQL Lab'),
)

appbuilder.add_link(
    'Query Search',
    label=_('Query Search'),
    href='/superset/sqllab#search',
    icon='fa-search',
    category_icon='fa-flask',
    category='SQL Lab',
    category_label=__('SQL Lab'),
)

appbuilder.add_link(
    'Upload a CSV',
    label=__('Upload a CSV'),
    href='/csvtodatabaseview/form',
    icon='fa-upload',
    category='Sources',
    category_label=__('Sources'),
    category_icon='fa-wrench')
appbuilder.add_separator('Sources')


@app.after_request
def apply_caching(response):
    """Applies the configuration's http headers to all responses"""
    for k, v in config.get('HTTP_HEADERS').items():
        response.headers[k] = v
    return response


# ---------------------------------------------------------------------
# Redirecting URL from previous names
class RegexConverter(BaseConverter):
    def __init__(self, url_map, *items):
        super(RegexConverter, self).__init__(url_map)
        self.regex = items[0]


app.url_map.converters['regex'] = RegexConverter


@app.route('/<regex("panoramix\/.*"):url>')
def panoramix(url):  # noqa
    return redirect(request.full_path.replace('panoramix', 'superset'))


@app.route('/<regex("caravel\/.*"):url>')
def caravel(url):  # noqa
    return redirect(request.full_path.replace('caravel', 'superset'))


# ---------------------------------------------------------------------
