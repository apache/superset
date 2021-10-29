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

openapi_spec_methods_override = {
    "get": {"get": {"description": "Get an Annotation layer"}},
    "get_list": {
        "get": {
            "description": "Get a list of Annotation layers, use Rison or JSON "
            "query parameters for filtering, sorting,"
            " pagination and for selecting specific"
            " columns and metadata.",
        }
    },
    "post": {"post": {"description": "Create an Annotation layer"}},
    "put": {"put": {"description": "Update an Annotation layer"}},
    "delete": {"delete": {"description": "Delete Annotation layer"}},
}

get_delete_ids_schema = {"type": "array", "items": {"type": "integer"}}


annotation_start_dttm = "The annotation start date time"
annotation_end_dttm = "The annotation end date time"
annotation_layer = "The annotation layer id"
annotation_short_descr = "A short description"
annotation_long_descr = "A long description"
annotation_json_metadata = "JSON metadata"


def validate_json(value: Union[bytes, bytearray, str]) -> None:
    try:
        utils.validate_json(value)
    except SupersetException as ex:
        raise ValidationError("JSON not valid") from ex


class AnnotationPostSchema(Schema):
    short_descr = fields.String(
        description=annotation_short_descr, allow_none=False, validate=[Length(1, 500)]
    )
    long_descr = fields.String(description=annotation_long_descr, allow_none=True)
    start_dttm = fields.DateTime(description=annotation_start_dttm, allow_none=False)
    end_dttm = fields.DateTime(description=annotation_end_dttm, allow_none=False)
    json_metadata = fields.String(
        description=annotation_json_metadata, validate=validate_json, allow_none=True,
    )


class AnnotationPutSchema(Schema):
    short_descr = fields.String(
        description=annotation_short_descr, required=False, validate=[Length(1, 500)]
    )
    long_descr = fields.String(description=annotation_long_descr, required=False)
    start_dttm = fields.DateTime(description=annotation_start_dttm, required=False)
    end_dttm = fields.DateTime(description=annotation_end_dttm, required=False)
    json_metadata = fields.String(
        description=annotation_json_metadata, validate=validate_json, required=False
    )
