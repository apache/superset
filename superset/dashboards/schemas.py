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

from marshmallow import fields, pre_load, Schema
from marshmallow.validate import Length, ValidationError

from superset.exceptions import SupersetException
from superset.utils import core as utils

get_delete_ids_schema = {"type": "array", "items": {"type": "integer"}}
get_export_ids_schema = {"type": "array", "items": {"type": "integer"}}
thumbnail_query_schema = {
    "type": "object",
    "properties": {"force": {"type": "boolean"}},
}


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
    errors = DashboardJSONMetadataSchema(strict=True).validate(value_obj, partial=False)
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
    @pre_load
    def pre_load(self, data: Dict[str, Any]) -> None:  # pylint: disable=no-self-use
        if data.get("slug"):
            data["slug"] = data["slug"].strip()
            data["slug"] = data["slug"].replace(" ", "-")
            data["slug"] = re.sub(r"[^\w\-]+", "", data["slug"])


class DashboardPostSchema(BaseDashboardSchema):
    dashboard_title = fields.String(allow_none=True, validate=Length(0, 500))
    slug = fields.String(allow_none=True, validate=[Length(1, 255)])
    owners = fields.List(fields.Integer())
    position_json = fields.String(validate=validate_json)
    css = fields.String()
    json_metadata = fields.String(validate=validate_json_metadata)
    published = fields.Boolean()


class DashboardPutSchema(BaseDashboardSchema):
    dashboard_title = fields.String(allow_none=True, validate=Length(0, 500))
    slug = fields.String(allow_none=True, validate=Length(0, 255))
    owners = fields.List(fields.Integer(allow_none=True))
    position_json = fields.String(allow_none=True, validate=validate_json)
    css = fields.String(allow_none=True)
    json_metadata = fields.String(allow_none=True, validate=validate_json_metadata)
    published = fields.Boolean(allow_none=True)
