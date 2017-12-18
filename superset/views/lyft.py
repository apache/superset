from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

import json
import logging
import traceback

from flask import (
     g, request, Response,
)
from flask_appbuilder import expose
from flask_babel import gettext as __

from superset import (
    app, appbuilder, db, utils,
)

import superset.models.core as models
from superset.views.core import Superset
from superset.utils import QueryStatus
from .base import (
    json_error_response
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
DATASOURCE_ACCESS_ERR = __("You don't have access to this datasource")


def get_database_access_error_msg(database_name):
    return __('This view requires the database %(name)s or '
              '`all_datasource_access` permission', name=database_name)


def get_datasource_access_error_msg(datasource_name):
    return __('This endpoint requires the datasource %(name)s, database or '
              '`all_datasource_access` permission', name=datasource_name)


def json_success(json_msg, status=200):
    return Response(json_msg, status=status, mimetype='application/json')


class Lyft(Superset):

    @log_this
    @expose('/lyft_explore_json/<datasource_type>/<datasource_id>/')
    def lyft_explore_json(self, datasource_type, datasource_id):
        try:
            viz_obj = self.get_viz(
                datasource_type=datasource_type,
                datasource_id=datasource_id,
                args=request.args)

        except Exception as e:
            logging.exception(e)
            return json_error_response(
                utils.error_msg_from_exception(e),
                stacktrace=traceback.format_exc())

        if request.args.get('query') == 'true':
            return self.get_query_string_response(viz_obj)

        payload = {}
        try:
            payload = viz_obj.get_payload(
                force=request.args.get('force') == 'true')
        except Exception as e:
            logging.exception(e)
            return json_error_response(utils.error_msg_from_exception(e))

        status = 200
        if payload.get('status') == QueryStatus.FAILED:
            status = 400

        return json_success(viz_obj.json_dumps(payload), status=status)

    @log_this
    @expose('/lyft_dashboard_json/<dashboard_id>/')
    def lyft_dashboard_json(self, dashboard_id):
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

        # Hack to log the dashboard_id properly, even when getting a slug
        @log_this
        def dashboard(**kwargs):  # noqa
            pass
        dashboard(dashboard_id=dash.id)

        standalone_mode = request.args.get('standalone') == 'true'

        dashboard_data = dash.data
        dashboard_data.update({
            'standalone_mode': standalone_mode,
            'dash_save_perm': False,
            'dash_edit_perm': False,
        })

        bootstrap_data = {
            'user_id': g.user.get_id(),
            'dashboard_data': dashboard_data,
            'datasources': {ds.uid: ds.data for ds in datasources},
            'common': self.common_bootsrap_payload(),
        }

        return json_success(json.dumps(bootstrap_data))


appbuilder.add_view_no_menu(Lyft)
