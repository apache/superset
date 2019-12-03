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
import re

from flask import current_app, g, request
from flask_appbuilder import ModelRestApi
from flask_appbuilder.api import expose, protect, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from marshmallow import fields, post_load, pre_load, Schema, ValidationError
from marshmallow.validate import Length
from sqlalchemy.exc import SQLAlchemyError

import superset.models.core as models
from superset import appbuilder
from superset.exceptions import SupersetException
from superset.utils import core as utils

from .mixin import DashboardMixin


def validate_json(value):
    try:
        utils.validate_json(value)
    except SupersetException:
        raise ValidationError("JSON not valid")


def validate_slug_uniqueness(value):
    item = (
        current_app.appbuilder.get_session.query(models.Dashboard)
        .filter_by(slug=value)
        .one_or_none()
    )
    if item:
        raise ValidationError("Must be unique")


class DashboardPostSchema(Schema):
    dashboard_title = fields.String(required=True, validate=Length(1, 500))
    slug = fields.String(
        required=True, validate=[Length(1, 255), validate_slug_uniqueness]
    )
    owners = fields.List(fields.Integer())
    position_json = fields.String(validate=validate_json)
    css = fields.String()
    json_metadata = fields.String(validate=validate_json)
    published = fields.Boolean()

    @post_load
    def post_load(self, data):
        return models.Dashboard(**data)

    @pre_load
    def pre_load(self, data):
        data["slug"] = data.get("slug") or None
        data["owners"] = data.get("owners", [])
        if data["slug"]:
            data["slug"] = data["slug"].strip()
            data["slug"] = data["slug"].replace(" ", "-")
            data["slug"] = re.sub(r"[^\w\-]+", "", data["slug"])
        if g.user.id not in data["owners"]:
            data["owners"].append(g.user.id)
        owners = [o for o in data["owners"]]
        for slc in data.get("slices", []):
            slc.owners = list(set(owners) | set(slc.owners))


class DashboardRestApi(DashboardMixin, ModelRestApi):
    datamodel = SQLAInterface(models.Dashboard)

    resource_name = "dashboard"
    allow_browser_login = True

    class_permission_name = "DatabaseAsync"
    method_permission_name = {
        "get_list": "list",
        "get": "show",
        "post": "add",
        "put": "edit",
        "delete": "delete",
        "info": "list",
    }

    show_columns = [
        "dashboard_title",
        "slug",
        "owners.id",
        "owners.username",
        "position_json",
        "css",
        "json_metadata",
        "published",
        "table_names",
        "charts",
    ]

    add_model_schema = DashboardPostSchema()

    @expose("/", methods=["POST"])
    @protect()
    @safe
    def post(self):
        """Creates a new dashboard
        ---
        post:
          requestBody:
            description: Model schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
          responses:
            201:
              description: Dashboard added
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: string
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        if not request.is_json:
            return self.response_400(message="Request is not JSON")
        try:
            item = self.add_model_schema.load(request.json)
        except ValidationError as err:
            return self.response_422(message=err.messages)
        # This validates custom Schema with custom validations
        if isinstance(item.data, dict):
            return self.response_422(message=item.errors)
        try:
            self.datamodel.add(item.data, raise_exception=True)
            return self.response(
                201,
                **{
                    "result": self.add_model_schema.dump(item.data, many=False).data,
                    "id": self.datamodel.get_pk_value(item.data),
                },
            )
        except SQLAlchemyError as e:
            return self.response_422(message=str(e))


appbuilder.add_api(DashboardRestApi)
