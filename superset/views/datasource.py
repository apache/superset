# pylint: disable=C,R,W
import json

from flask import request
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access_api
from flask_babel import gettext as __

from superset import appbuilder, db
from superset.connectors.connector_registry import ConnectorRegistry
from .base import BaseSupersetView, check_ownership, json_error_response


class Datasource(BaseSupersetView):
    """Datasource-related views"""
    @expose('/save/', methods=['POST'])
    @has_access_api
    def save(self):
        datasource = json.loads(request.form.get('data'))
        datasource_id = datasource.get('id')
        datasource_type = datasource.get('type')
        orm_datasource = ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, db.session)

        if not check_ownership(orm_datasource, raise_if_false=False):
            return json_error_response(
                __(
                    'You are not authorized to modify '
                    'this data source configuration'),
                status='401',
            )
        orm_datasource.update_from_object(datasource)
        data = orm_datasource.data
        db.session.commit()
        return self.json_response(data)

    @expose('/external_metadata/<datasource_type>/<datasource_id>/')
    def external_metadata(self, datasource_type=None, datasource_id=None):
        """Gets column info from the source system"""
        orm_datasource = ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, db.session)
        return self.json_response(orm_datasource.external_metadata())


appbuilder.add_view_no_menu(Datasource)
