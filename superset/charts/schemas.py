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
from typing import Union

from marshmallow import fields, Schema, ValidationError
from marshmallow.validate import Length

from superset.exceptions import SupersetException
from superset.utils import core as utils

get_delete_ids_schema = {"type": "array", "items": {"type": "integer"}}


def validate_json(value: Union[bytes, bytearray, str]) -> None:
    try:
        utils.validate_json(value)
    except SupersetException:
        raise ValidationError("JSON not valid")


class ChartPostSchema(Schema):
    slice_name = fields.String(required=True, validate=Length(1, 250))
    description = fields.String(allow_none=True)
    viz_type = fields.String(allow_none=True, validate=Length(0, 250))
    owners = fields.List(fields.Integer())
    params = fields.String(allow_none=True, validate=validate_json)
    cache_timeout = fields.Integer(allow_none=True)
    datasource_id = fields.Integer(required=True)
    datasource_type = fields.String(required=True)
    datasource_name = fields.String(allow_none=True)
    dashboards = fields.List(fields.Integer())


class ChartPutSchema(Schema):
    slice_name = fields.String(allow_none=True, validate=Length(0, 250))
    description = fields.String(allow_none=True)
    viz_type = fields.String(allow_none=True, validate=Length(0, 250))
    owners = fields.List(fields.Integer())
    params = fields.String(allow_none=True)
    cache_timeout = fields.Integer(allow_none=True)
    datasource_id = fields.Integer(allow_none=True)
    datasource_type = fields.String(allow_none=True)
    dashboards = fields.List(fields.Integer())
