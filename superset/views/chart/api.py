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
from typing import Dict, List, Optional

from flask import current_app, Response
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.models.sqla.interface import SQLAInterface
from marshmallow import fields, post_load, validates_schema, ValidationError
from marshmallow.validate import Length
from sqlalchemy.orm.exc import NoResultFound
from werkzeug.wsgi import FileWrapper

from superset import is_feature_enabled, thumbnail_cache
from superset.connectors.connector_registry import ConnectorRegistry
from superset.constants import RouteMethod
from superset.exceptions import SupersetException
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.tasks.thumbnails import cache_chart_thumbnail
from superset.utils import core as utils
from superset.utils.selenium import ChartScreenshot
from superset.views.base_api import BaseOwnedModelRestApi
from superset.views.base_schemas import BaseOwnedSchema, validate_owner
from superset.views.chart.mixin import SliceMixin

logger = logging.getLogger(__name__)

thumbnail_query_schema = {
    "type": "object",
    "properties": {"force": {"type": "boolean"}},
}


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
    cache_timeout = fields.Integer(allow_none=True)
    datasource_id = fields.Integer(required=True)
    datasource_type = fields.String(required=True)
    datasource_name = fields.String(allow_none=True)
    dashboards = fields.List(fields.Integer(validate=validate_dashboard))

    @validates_schema
    def validate_schema(self, data: Dict):  # pylint: disable=no-self-use
        validate_update_datasource(data)

    @post_load
    def make_object(self, data: Dict, discard: Optional[List[str]] = None) -> Slice:
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
    cache_timeout = fields.Integer(allow_none=True)
    datasource_id = fields.Integer(allow_none=True)
    datasource_type = fields.String(allow_none=True)
    dashboards = fields.List(fields.Integer(validate=validate_dashboard))

    @validates_schema
    def validate_schema(self, data: Dict):  # pylint: disable=no-self-use
        validate_update_datasource(data)

    @post_load
    def make_object(self, data: Dict, discard: Optional[List[str]] = None) -> Slice:
        self.instance = super().make_object(data, ["dashboards"])
        if "dashboards" in data:
            populate_dashboards(self.instance, data["dashboards"])
        return self.instance


class ChartRestApi(SliceMixin, BaseOwnedModelRestApi):
    datamodel = SQLAInterface(Slice)

    include_route_methods = RouteMethod.REST_MODEL_VIEW_CRUD_SET | {RouteMethod.RELATED}
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
        "id",
        "slice_name",
        "url",
        "description",
        "changed_by.username",
        "changed_by_name",
        "changed_by_url",
        "changed_on",
        "datasource_name_text",
        "datasource_link",
        "viz_type",
        "params",
        "cache_timeout",
        "thumbnail_url",
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

    def __init__(self, *args, **kwargs):
        if is_feature_enabled("THUMBNAILS"):
            self.include_route_methods = self.include_route_methods | {"thumbnail"}
        super().__init__(*args, **kwargs)

    @expose("/<pk>/thumbnail/<digest>/", methods=["GET"])
    @protect()
    @rison(thumbnail_query_schema)
    @safe
    def thumbnail(self, pk, digest, **kwargs):  # pylint: disable=invalid-name
        """Get Chart thumbnail
        ---
        get:
          description: Compute or get already computed chart thumbnail from cache
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
          - in: path
            schema:
              type: string
            name: sha
          responses:
            200:
              description: Chart thumbnail image
              content:
               image/*:
                 schema:
                   type: string
                   format: binary
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        chart = self.datamodel.get(pk, self._base_filters)
        if not chart:
            return self.response_404()
        if kwargs["rison"].get("force", False):
            cache_chart_thumbnail.delay(chart.id, force=True)
            return self.response(202, message="OK Async")
        # fetch the chart screenshot using the current user and cache if set
        screenshot = ChartScreenshot(pk).get_from_cache(cache=thumbnail_cache)
        # If not screenshot then send request to compute thumb to celery
        if not screenshot:
            cache_chart_thumbnail.delay(chart.id, force=True)
            return self.response(202, message="OK Async")
        # If digests
        if chart.digest != digest:
            logger.info("Requested thumbnail digest differs from actual digest")
            return self.response(304, message="Digest differs")
        return Response(
            FileWrapper(screenshot), mimetype="image/png", direct_passthrough=True
        )
