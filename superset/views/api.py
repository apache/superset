# pylint: disable=R
import json

from flask import g, request
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access_api

from superset import appbuilder, security_manager
from superset.common.query_context import QueryContext
from superset.models.core import Log
from .base import api, BaseSupersetView, data_payload_response, handle_api_exception


class Api(BaseSupersetView):
    @Log.log_this
    @api
    @handle_api_exception
    @has_access_api
    @expose('/v1/query/', methods=['POST'])
    def query(self):
        """
        Takes a query_obj constructed in the client and returns payload data response
        for the given query_obj.
        """
        query_context = QueryContext(**json.loads(request.form.get('query_context')))
        security_manager.assert_datasource_permission(query_context.datasource, g.user)
        payload_json = query_context.get_data()
        return data_payload_response(payload_json)


appbuilder.add_view_no_menu(Api)
