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
from superset.models.core import Database
from superset.typing import FlaskResponse

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
            datasource_type, datasource_id
        )
        orm_datasource.database_id = database_id

        if "owners" in datasource_dict and orm_datasource.owner_class is not None:
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
                datasource_type, datasource_id
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
        if datasource_type == "druid":
            datasource = ConnectorRegistry.get_datasource(
                datasource_type, datasource_id
            )
        elif datasource_type == "table":
            database = (
                db.session.query(Database).filter_by(id=request.args.get("db_id")).one()
            )
            table_class = ConnectorRegistry.sources["table"]
            datasource = table_class(
                database=database,
                table_name=request.args.get("table_name"),
                schema=request.args.get("schema") or None,
            )
        else:
            raise Exception(f"Unsupported datasource_type: {datasource_type}")
        external_metadata = datasource.external_metadata()
        return self.json_response(external_metadata)
