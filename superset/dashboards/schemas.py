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
from typing import Any, Dict, Union

from marshmallow import fields, post_load, Schema
from marshmallow.validate import Length, ValidationError

from superset.exceptions import SupersetException
from superset.utils import core as utils

get_delete_ids_schema = {"type": "array", "items": {"type": "integer"}}
get_export_ids_schema = {"type": "array", "items": {"type": "integer"}}
thumbnail_query_schema = {
    "type": "object",
    "properties": {"force": {"type": "boolean"}},
}

dashboard_title_description = "A title for the dashboard."
slug_description = "Unique identifying part for the web address of the dashboard."
owners_description = (
    "Owner are users ids allowed to delete or change this dashboard. "
    "If left empty you will be one of the owners of the dashboard."
)
position_json_description = (
    "This json object describes the positioning of the widgets "
    "in the dashboard. It is dynamically generated when "
    "adjusting the widgets size and positions by using "
    "drag & drop in the dashboard view"
)
css_description = "Override CSS for the dashboard."
json_metadata_description = (
    "This JSON object is generated dynamically when clicking "
    "the save or overwrite button in the dashboard view. "
    "It is exposed here for reference and for power users who may want to alter "
    " specific parameters."
)
published_description = (
    "Determines whether or not this dashboard is visible in "
    "the list of all dashboards."
)


openapi_spec_methods_override = {
    "get": {"get": {"description": "Get a dashboard detail information."}},
    "get_list": {
        "get": {
            "description": "Get a list of dashboards, use Rison or JSON query "
            "parameters for filtering, sorting, pagination and "
            " for selecting specific columns and metadata.",
        }
    },
    "info": {
        "get": {
            "description": "Several metadata information about dashboard API "
            "endpoints.",
        }
    },
    "related": {
        "get": {"description": "Get a list of all possible owners for a dashboard."}
    },
}
""" Overrides GET methods OpenApi descriptions """


def validate_json(value: Union[bytes, bytearray, str]) -> None:
    try:
        utils.validate_json(value)
    except SupersetException:
        raise ValidationError("JSON not valid")


def validate_json_metadata(value: Union[bytes, bytearray, str]) -> None:
    if not value:
        return
    try:
        value_obj = json.loads(value)
    except json.decoder.JSONDecodeError:
        raise ValidationError("JSON not valid")
    errors = DashboardJSONMetadataSchema().validate(value_obj, partial=False)
    if errors:
        raise ValidationError(errors)


class DashboardJSONMetadataSchema(Schema):
    timed_refresh_immune_slices = fields.List(fields.Integer())
    filter_scopes = fields.Dict()
    expanded_slices = fields.Dict()
    refresh_frequency = fields.Integer()
    default_filters = fields.Str()
    stagger_refresh = fields.Boolean()
    stagger_time = fields.Integer()
    color_scheme = fields.Str()
    label_colors = fields.Dict()


class BaseDashboardSchema(Schema):
    # pylint: disable=no-self-use,unused-argument
    @post_load
    def post_load(self, data: Dict[str, Any], **kwargs: Any) -> Dict[str, Any]:
        if data.get("slug"):
            data["slug"] = data["slug"].strip()
            data["slug"] = data["slug"].replace(" ", "-")
            data["slug"] = re.sub(r"[^\w\-]+", "", data["slug"])
        return data

    # pylint: disable=no-self-use,unused-argument


class DashboardPostSchema(BaseDashboardSchema):
    dashboard_title = fields.String(
        description=dashboard_title_description,
        allow_none=True,
        validate=Length(0, 500),
    )
    slug = fields.String(
        description=slug_description, allow_none=True, validate=[Length(1, 255)]
    )
    owners = fields.List(fields.Integer(description=owners_description))
    position_json = fields.String(
        description=position_json_description, validate=validate_json
    )
    css = fields.String()
    json_metadata = fields.String(
        description=json_metadata_description, validate=validate_json_metadata,
    )
    published = fields.Boolean(description=published_description)


class DashboardPutSchema(BaseDashboardSchema):
    dashboard_title = fields.String(
        description=dashboard_title_description,
        allow_none=True,
        validate=Length(0, 500),
    )
    slug = fields.String(
        description=slug_description, allow_none=True, validate=Length(0, 255)
    )
    owners = fields.List(
        fields.Integer(description=owners_description, allow_none=True)
    )
    position_json = fields.String(
        description=position_json_description, allow_none=True, validate=validate_json
    )
    css = fields.String(description=css_description, allow_none=True)
    json_metadata = fields.String(
        description=json_metadata_description,
        allow_none=True,
        validate=validate_json_metadata,
    )
    published = fields.Boolean(description=published_description, allow_none=True)
