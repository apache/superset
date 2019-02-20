# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
# pylint: disable=C,R,W
import json

from flask import request
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access_api
from flask_babel import gettext as __

from superset import appbuilder, db
from superset.connectors.connector_registry import ConnectorRegistry
from superset.models.core import Database
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

        if 'owners' in datasource:
            datasource['owners'] = db.session.query(orm_datasource.owner_class).filter(
                orm_datasource.owner_class.id.in_(datasource['owners'])).all()
        orm_datasource.update_from_object(datasource)
        data = orm_datasource.data
        db.session.commit()
        return self.json_response(data)

    @expose('/get/<datasource_type>/<datasource_id>/')
    @has_access_api
    def get(self, datasource_type, datasource_id):
        orm_datasource = ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, db.session)

        if not orm_datasource:
            return json_error_response(
                'This datasource does not exist',
                status='400',
            )
        elif not orm_datasource.data:
            return json_error_response(
                'Error fetching datasource data.',
                status='500',
            )

        return self.json_response(orm_datasource.data)

    @expose('/external_metadata/<datasource_type>/<datasource_id>/')
    @has_access_api
    def external_metadata(self, datasource_type=None, datasource_id=None):
        """Gets column info from the source system"""
        if datasource_type == 'druid':
            datasource = ConnectorRegistry.get_datasource(
                datasource_type, datasource_id, db.session)
        elif datasource_type == 'table':
            database = (
                db.session
                .query(Database)
                .filter_by(id=request.args.get('db_id'))
                .one()
            )
            Table = ConnectorRegistry.sources['table']
            datasource = Table(
                database=database,
                table_name=request.args.get('table_name'),
                schema=request.args.get('schema') or None,
            )
        external_metadata = datasource.external_metadata()
        return self.json_response(external_metadata)


appbuilder.add_view_no_menu(Datasource)
