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
    app, appbuilder, db, utils, sm,
)

import superset.models.core as models
from superset.views.core import Superset
from superset.utils import QueryStatus
from .base import (
    json_error_response, generate_download_headers, CsvResponse,
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


def json_success(json_msg, status=200):
    return Response(json_msg, status=status, mimetype='application/json')


class Lyft(Superset):

    @log_this
    @expose('/explore_json/<datasource_type>/<datasource_id>/')
    def explore_json(self, datasource_type, datasource_id):
        if sm.check_api_access():
            return super(Lyft, self).explore_json(datasource_type, datasource_id)
        return json_error_response("Access denied")

appbuilder.add_view_no_menu(Lyft)
