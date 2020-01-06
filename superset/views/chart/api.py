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
from flask import current_app
from flask_appbuilder.models.sqla.interface import SQLAInterface
from marshmallow import fields, post_load, validates_schema, ValidationError
from marshmallow.validate import Length
from sqlalchemy.orm.exc import NoResultFound

from superset import appbuilder
from superset.connectors.connector_registry import ConnectorRegistry
from superset.exceptions import SupersetException
from superset.models.slice import Slice
from superset.utils import core as utils
from superset.views.base import BaseOwnedModelRestApi, BaseOwnedSchema
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


class ChartPostSchema(BaseOwnedSchema):
    __class_model__ = Slice

    slice_name = fields.String(required=True, validate=Length(1, 250))
    description = fields.String(allow_none=True)
    viz_type = fields.String(allow_none=True, validate=Length(0, 250))
    owners = fields.List(fields.Integer(validate=validate_owners))
    params = fields.String(allow_none=True)
    cache_timeout = fields.Integer()
    datasource_id = fields.Integer(required=True)
    datasource_type = fields.String(required=True)
    datasource_name = fields.String(allow_none=True)

    @staticmethod
    @validates_schema
    def validate_datasource(data):
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


class ChartPutSchema(BaseOwnedSchema):
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


class ChartRestApi(SliceMixin, BaseOwnedModelRestApi):
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
    exclude_route_methods = ("info",)

    add_model_schema = ChartPostSchema()
    edit_model_schema = ChartPutSchema()

    order_rel_fields = {
        "slices": ("slice_name", "asc"),
        "owners": ("first_name", "asc"),
    }
    filter_rel_fields_field = {"owners": "first_name", "slices": "slice_name"}


appbuilder.add_api(ChartRestApi)
