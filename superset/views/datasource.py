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
import json
from collections import Counter

from flask import request
from flask_appbuilder import expose
from flask_appbuilder.security.decorators import has_access_api
from sqlalchemy.orm.exc import NoResultFound

from superset import db
from superset.connectors.connector_registry import ConnectorRegistry
from superset.datasets.commands.exceptions import DatasetForbiddenError
from superset.exceptions import SupersetException, SupersetSecurityException
from superset.typing import FlaskResponse
from superset.views.base import check_ownership

from .base import api, BaseSupersetView, handle_api_exception, json_error_response


class Datasource(BaseSupersetView):
    """Datasource-related views"""

    @expose("/save/", methods=["POST"])
    @has_access_api
    @api
    @handle_api_exception
    def save(self) -> FlaskResponse:
        data = request.form.get("data")
        if not isinstance(data, str):
            return json_error_response("Request missing data field.", status=500)

        datasource_dict = json.loads(data)
        datasource_id = datasource_dict.get("id")
        datasource_type = datasource_dict.get("type")
        database_id = datasource_dict["database"].get("id")
        orm_datasource = ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, db.session
        )
        orm_datasource.database_id = database_id

        if "owners" in datasource_dict and orm_datasource.owner_class is not None:
            # Check ownership
            try:
                check_ownership(orm_datasource)
            except SupersetSecurityException:
                return json_error_response(
                    f"{DatasetForbiddenError.message}", DatasetForbiddenError.status
                )

            datasource_dict["owners"] = (
                db.session.query(orm_datasource.owner_class)
                .filter(orm_datasource.owner_class.id.in_(datasource_dict["owners"]))
                .all()
            )

        duplicates = [
            name
            for name, count in Counter(
                [col["column_name"] for col in datasource_dict["columns"]]
            ).items()
            if count > 1
        ]
        if duplicates:
            return json_error_response(
                f"Duplicate column name(s): {','.join(duplicates)}", status=409
            )
        orm_datasource.update_from_object(datasource_dict)
        if hasattr(orm_datasource, "health_check"):
            orm_datasource.health_check(force=True, commit=False)
        data = orm_datasource.data
        db.session.commit()

        return self.json_response(data)

    @expose("/get/<datasource_type>/<datasource_id>/")
    @has_access_api
    @api
    @handle_api_exception
    def get(self, datasource_type: str, datasource_id: int) -> FlaskResponse:
        try:
            orm_datasource = ConnectorRegistry.get_datasource(
                datasource_type, datasource_id, db.session
            )
            if not orm_datasource.data:
                return json_error_response(
                    "Error fetching datasource data.", status=500
                )
            return self.json_response(orm_datasource.data)
        except NoResultFound:
            return json_error_response("This datasource does not exist", status=400)

    @expose("/external_metadata/<datasource_type>/<datasource_id>/")
    @has_access_api
    @api
    @handle_api_exception
    def external_metadata(
        self, datasource_type: str, datasource_id: int
    ) -> FlaskResponse:
        """Gets column info from the source system"""
        try:
            datasource = ConnectorRegistry.get_datasource(
                datasource_type, datasource_id, db.session
            )
            external_metadata = datasource.external_metadata()
            return self.json_response(external_metadata)
        except SupersetException as ex:
            return json_error_response(str(ex), status=400)
