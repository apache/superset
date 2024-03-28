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
import logging

from flask import request, Response
from flask_appbuilder import expose
from flask_appbuilder.api import safe
from flask_appbuilder.security.decorators import protect
from marshmallow import ValidationError


from superset import db, security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.extensions import event_logger, csrf
from superset.key_value.models import KeyValueEntry
from superset.models.core import Database, FavStar, Log
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.reset.schemas import ResetPostSchema
from superset.views.base_api import BaseSupersetApi, requires_json, statsd_metrics

logger = logging.getLogger(__name__)

class ResetRestApi(BaseSupersetApi):
    resource_name = "reset"
    allow_browser_login = True
    openapi_spec_tag = "Reset"

    reset_model_schema = ResetPostSchema()

    @expose("/", methods=("POST",))
    @csrf.exempt
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}" f".post",
        log_to_statsd=False,
    )
    @requires_json
    def post(self) -> Response:
        """Reset all superset records.
        ---
        post:
          summary: Reset all superset records
          requestBody:
            description: Reset all superset records
            required: true
            content:
              application/json:
                schema: ResetPostSchema
          responses:
            200:
              description: Records deleted successfully
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            item = self.reset_model_schema.load(request.json)
        # This validates custom Schema with custom validations
        except ValidationError as error:
            return self.response_400(message=error.messages)
        try:
            if item.get("all") or item.get("datasets"):
                db.session.query(SqlaTable).delete()
            if item.get("all") or item.get("databases"):
                databases_to_delete = db.session.query(Database).all()
                for database in databases_to_delete:
                    db.session.delete(database)
            if item.get("all") or item.get("dashboards"):
                db.session.query(Dashboard).delete()
            if item.get("all") or item.get("slices"):
                db.session.query(Slice).delete()
            if item.get("all") or item.get("users"):
                db.session.query(KeyValueEntry).delete()
                db.session.query(Log).delete()
                db.session.query(FavStar).delete()
                excluded_users = ["admin"]
                if item.get("excluded_users"):
                    excluded_users.extend(item["excluded_users"])
                users_to_delete = db.session.query(security_manager.user_model).filter(security_manager.user_model.username.not_in(excluded_users)).all()                
                for user in users_to_delete:
                    db.session.delete(user)
            if item.get("all") or item.get("roles"):
                if item.get("excluded_roles"):
                    excluded_roles.extend(item["excluded_roles"])                
                excluded_roles = ["Admin", "Public", "Gamma", "Alpha", "sql_lab"]
                roles_to_delete = db.session.query(security_manager.role_model).filter(security_manager.role_model.name.not_in(excluded_roles)).all()
                for role in roles_to_delete:
                    db.session.delete(role)
            db.session.commit()
            return self.response(200, message="OK")
        except Exception as ex:
            logger.error(
                "Error resetting superset: %s",
                str(ex),
                exc_info=True,
            )
            return self.response_422(message=str(ex))
