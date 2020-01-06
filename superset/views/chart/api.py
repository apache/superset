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
from flask import current_app, request
from flask_appbuilder.api import expose, protect, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from marshmallow import fields, post_load, validates_schema, ValidationError
from marshmallow.validate import Length
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm.exc import NoResultFound

from superset import appbuilder
from superset.connectors.connector_registry import ConnectorRegistry
from superset.exceptions import SupersetException
from superset.models.slice import Slice
from superset.utils import core as utils
from superset.views.base import BaseSupersetModelRestApi, BaseSupersetSchema
from superset.views.chart.mixin import SliceMixin


def validate_json(value):
    try:
        utils.validate_json(value)
    except SupersetException:
        raise ValidationError("JSON not valid")


def validate_owners(value):
    try:
        (
            current_app.appbuilder.get_session.query(
                current_app.appbuilder.sm.user_model.id
            )
            .filter_by(id=value)
            .one()
        )
    except NoResultFound:
        raise ValidationError(f"User {value} does not exist")


class BaseChartSchema(BaseSupersetSchema):
    @staticmethod
    def set_owners(instance, owners):
        owner_objs = list()
        for owner_id in owners:
            user = current_app.appbuilder.get_session.query(
                current_app.appbuilder.sm.user_model
            ).get(owner_id)
            owner_objs.append(user)
        instance.owners = owner_objs


class ChartPostSchema(BaseChartSchema):
    slice_name = fields.String(validate=Length(1, 250))
    description = fields.String(allow_none=True)
    viz_type = fields.String(allow_none=True, validate=Length(0, 250))
    owners = fields.List(fields.Integer(validate=validate_owners))
    params = fields.String(allow_none=True)
    cache_timeout = fields.Integer()
    datasource_id = fields.Integer()
    datasource_type = fields.String()
    datasource_name = fields.String(allow_none=True)

    @validates_schema
    def validate_datasource(self, data, **kwargs):
        datasource_type = data["datasource_type"]
        datasource_id = data["datasource_id"]
        try:
            datasource = ConnectorRegistry.get_datasource(
                datasource_type, datasource_id, current_app.appbuilder.get_session
            )
        except NoResultFound:
            raise ValidationError(
                f"Datasource [{datasource_type}].{datasource_id} does not exist"
            )
        data["datasource_name"] = datasource.name

    @post_load
    def make_object(self, data):  # pylint: disable=no-self-use
        instance = Slice()
        for field in data:
            if field == "owners":
                self.set_owners(instance, data["owners"])
            else:
                setattr(instance, field, data.get(field))
        return instance


class ChartPutSchema(BaseSupersetSchema):
    slice_name = fields.String(allow_none=True, validate=Length(0, 250))
    description = fields.String(allow_none=True)
    viz_type = fields.String(allow_none=True, validate=Length(0, 250))
    owners = fields.List(fields.Integer(validate=validate_owners))
    params = fields.String(allow_none=True)
    cache_timeout = fields.Integer()
    datasource_id = fields.Integer(allow_none=True)
    datasource_type = fields.String(allow_none=True)

    @post_load
    def make_object(self, data):  # pylint: disable=no-self-use
        for field in data:
            setattr(self.instance, field, data.get(field))
        return self.instance


class ChartRestApi(SliceMixin, BaseSupersetModelRestApi):
    datamodel = SQLAInterface(Slice)

    resource_name = "chart"
    allow_browser_login = True

    class_permission_name = "SliceModelView"
    method_permission_name = {
        "get_list": "list",
        "get": "show",
        "post": "add",
        "put": "edit",
        "delete": "delete",
        "info": "list",
        "related": "list",
    }
    show_columns = [
        "slice_name",
        "description",
        "owners.id",
        "owners.username",
        "dashboards.id",
        "dashboards.dashboard_title",
        "viz_type",
        "params",
        "cache_timeout",
    ]
    list_columns = [
        "slice_name",
        "description",
        "changed_by.username",
        "changed_by_name",
        "changed_on",
        "viz_type",
        "params",
        "cache_timeout",
    ]

    add_model_schema = ChartPostSchema()
    edit_model_schema = ChartPutSchema()

    order_rel_fields = {
        "slices": ("slice_name", "asc"),
        "owners": ("first_name", "asc"),
    }
    filter_rel_fields_field = {"owners": "first_name", "slices": "slice_name"}

    @expose("/", methods=["POST"])
    @protect()
    @safe
    def post(self):
        """Creates a new Chart
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
                result=self.add_model_schema.dump(item.data, many=False).data,
                id=item.data.id,
            )
        except SQLAlchemyError as e:
            return self.response_422(message=str(e))

    @expose("/<pk>", methods=["PUT"])
    @protect()
    @safe
    def put(self, pk):
        """Changes a Chart
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

        item = self.edit_model_schema.load(request.json, instance=item)
        if item.errors:
            return self.response_422(message=item.errors)
        try:
            self.datamodel.edit(item.data, raise_exception=True)
            return self.response(
                200, result=self.edit_model_schema.dump(item.data, many=False).data
            )
        except SQLAlchemyError as e:
            return self.response_422(message=str(e))


appbuilder.add_api(ChartRestApi)
