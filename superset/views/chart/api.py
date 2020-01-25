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
from typing import Dict, List

from flask import current_app
from flask_appbuilder.models.sqla.interface import SQLAInterface
from marshmallow import fields, post_load, validates_schema, ValidationError
from marshmallow.validate import Length
from sqlalchemy.orm.exc import NoResultFound

from superset import appbuilder
from superset.connectors.connector_registry import ConnectorRegistry
from superset.exceptions import SupersetException
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.utils import core as utils
from superset.views.base_api import BaseOwnedModelRestApi
from superset.views.base_schemas import BaseOwnedSchema, validate_owner
from superset.views.chart.mixin import SliceMixin


def validate_json(value):
    try:
        utils.validate_json(value)
    except SupersetException:
        raise ValidationError("JSON not valid")


def validate_dashboard(value):
    try:
        (current_app.appbuilder.get_session.query(Dashboard).filter_by(id=value).one())
    except NoResultFound:
        raise ValidationError(f"Dashboard {value} does not exist")


def validate_update_datasource(data: Dict):
    if not ("datasource_type" in data and "datasource_id" in data):
        return
    datasource_type = data["datasource_type"]
    datasource_id = data["datasource_id"]
    try:
        datasource = ConnectorRegistry.get_datasource(
            datasource_type, datasource_id, current_app.appbuilder.get_session
        )
    except (NoResultFound, KeyError):
        raise ValidationError(
            f"Datasource [{datasource_type}].{datasource_id} does not exist"
        )
    data["datasource_name"] = datasource.name


def populate_dashboards(instance: Slice, dashboards: List[int]):
    """
    Mutates a Slice with the dashboards SQLA Models
    """
    dashboards_tmp = []
    for dashboard_id in dashboards:
        dashboards_tmp.append(
            current_app.appbuilder.get_session.query(Dashboard)
            .filter_by(id=dashboard_id)
            .one()
        )
    instance.dashboards = dashboards_tmp


class ChartPostSchema(BaseOwnedSchema):
    __class_model__ = Slice

    slice_name = fields.String(required=True, validate=Length(1, 250))
    description = fields.String(allow_none=True)
    viz_type = fields.String(allow_none=True, validate=Length(0, 250))
    owners = fields.List(fields.Integer(validate=validate_owner))
    params = fields.String(allow_none=True, validate=validate_json)
    cache_timeout = fields.Integer()
    datasource_id = fields.Integer(required=True)
    datasource_type = fields.String(required=True)
    datasource_name = fields.String(allow_none=True)
    dashboards = fields.List(fields.Integer(validate=validate_dashboard))

    @validates_schema
    def validate_schema(self, data: Dict):  # pylint: disable=no-self-use
        validate_update_datasource(data)

    @post_load
    def make_object(self, data: Dict, discard: List[str] = None) -> Slice:
        instance = super().make_object(data, discard=["dashboards"])
        populate_dashboards(instance, data.get("dashboards", []))
        return instance


class ChartPutSchema(BaseOwnedSchema):
    instance: Slice

    slice_name = fields.String(allow_none=True, validate=Length(0, 250))
    description = fields.String(allow_none=True)
    viz_type = fields.String(allow_none=True, validate=Length(0, 250))
    owners = fields.List(fields.Integer(validate=validate_owner))
    params = fields.String(allow_none=True)
    cache_timeout = fields.Integer()
    datasource_id = fields.Integer(allow_none=True)
    datasource_type = fields.String(allow_none=True)
    dashboards = fields.List(fields.Integer(validate=validate_dashboard))

    @validates_schema
    def validate_schema(self, data: Dict):  # pylint: disable=no-self-use
        validate_update_datasource(data)

    @post_load
    def make_object(self, data: Dict, discard: List[str] = None) -> Slice:
        self.instance = super().make_object(data, ["dashboards"])
        if "dashboards" in data:
            populate_dashboards(self.instance, data["dashboards"])
        return self.instance


class ChartRestApi(SliceMixin, BaseOwnedModelRestApi):
    datamodel = SQLAInterface(Slice)

    resource_name = "chart"
    allow_browser_login = True

    class_permission_name = "SliceModelView"
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
    # Will just affect _info endpoint
    edit_columns = ["slice_name"]
    add_columns = edit_columns

    # exclude_route_methods = ("info",)

    add_model_schema = ChartPostSchema()
    edit_model_schema = ChartPutSchema()

    order_rel_fields = {
        "slices": ("slice_name", "asc"),
        "owners": ("first_name", "asc"),
    }
    filter_rel_fields_field = {"owners": "first_name", "dashboards": "dashboard_title"}


appbuilder.add_api(ChartRestApi)
