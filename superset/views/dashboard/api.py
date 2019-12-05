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
    # slug is not required but must be unique
    if value:
        item = (
            current_app.appbuilder.get_session.query(models.Dashboard)
            .filter_by(slug=value)
            .one_or_none()
        )
        if item:
            raise ValidationError("Must be unique")


def validate_owners(value):
    owner = current_app.appbuilder.get_session.query(
        current_app.appbuilder.sm.user_model
    ).get(value)
    if not owner:
        raise ValidationError(f"User {value} does not exist")


class BaseDashboardSchema(Schema):
    @pre_load
    def pre_load(self, data):
        data["slug"] = data.get("slug")
        data["owners"] = data.get("owners", [])
        if data["slug"]:
            data["slug"] = data["slug"].strip()
            data["slug"] = data["slug"].replace(" ", "-")
            data["slug"] = re.sub(r"[^\w\-]+", "", data["slug"])


class DashboardPostSchema(BaseDashboardSchema):
    dashboard_title = fields.String(allow_none=True, validate=Length(0, 500))
    slug = fields.String(
        allow_none=True, validate=[Length(1, 255), validate_slug_uniqueness]
    )
    owners = fields.List(fields.Integer(validate=validate_owners))
    position_json = fields.String(validate=validate_json)
    css = fields.String()
    json_metadata = fields.String(validate=validate_json)
    published = fields.Boolean()

    @post_load
    def post_load(self, data):
        new_data = dict.copy(data)
        new_data["owners"] = list()
        if g.user.id not in data["owners"]:
            data["owners"].append(g.user.id)
        for owner_id in data["owners"]:
            user = current_app.appbuilder.get_session.query(
                current_app.appbuilder.sm.user_model
            ).get(owner_id)
            new_data["owners"].append(user)
        return models.Dashboard(**new_data)


class DashboardPutSchema(BaseDashboardSchema):
    dashboard_title = fields.String(validate=Length(0, 500))
    slug = fields.String(allow_none=True, validate=Length(1, 255))
    owners = fields.List(fields.Integer(validate=validate_owners))
    position_json = fields.String(validate=validate_json)
    css = fields.String()
    json_metadata = fields.String(validate=validate_json)
    published = fields.Boolean()


class DashboardRestApi(DashboardMixin, ModelRestApi):
    datamodel = SQLAInterface(models.Dashboard)

    resource_name = "dashboard"
    allow_browser_login = True

    class_permission_name = "DashboardRestApi"
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
    edit_model_schema = DashboardPutSchema()

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
        item = self.add_model_schema.load(request.json)
        # This validates custom Schema with custom validations
        if item.errors:
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

    @expose("/<pk>", methods=["PUT"])
    @protect()
    @safe
    def put(self, pk):
        """Changes a dashboard
        ---
        put:
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          requestBody:
            description: Model schema
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
          responses:
            200:
              description: Item changed
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        if not request.is_json:
            self.response_400(message="Request is not JSON")
        item = self.datamodel.get(pk, self._base_filters)
        if not item:
            return self.response_404()

        changed_item = self.edit_model_schema.load(request.json)
        if changed_item.errors:
            return self.response_422(message=changed_item.errors)
        try:
            self.update_dashboard(item, changed_item.data)
            current_app.appbuilder.get_session.commit()
            return self.response(
                200,
                **{"result": self.edit_model_schema.dump(item.data, many=False).data},
            )
        except SQLAlchemyError as e:
            return self.response_422(message=str(e))

    def update_dashboard(self, item, data):
        # Always add current user has an updated dashboard owner
        if "owners" not in data and g.user not in item.owners:
            item.owners.append(g.user)
        for field in data:
            if field == "owners":
                new_owners = list()
                if g.user.id not in data["owners"]:
                    data["owners"].append(g.user.id)
                for owner_id in data["owners"]:
                    user = current_app.appbuilder.get_session.query(
                        current_app.appbuilder.sm.user_model
                    ).get(owner_id)
                    new_owners.append(user)
                    item.owners = new_owners
            else:
                setattr(item, field, data.get(field))
        for slc in item.slices:
            slc.owners = list(set(item.owners) | set(slc.owners))


appbuilder.add_api(DashboardRestApi)
