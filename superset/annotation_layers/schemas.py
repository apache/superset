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
from marshmallow import fields, Schema
from marshmallow.validate import Length

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

annotation_layer_name = "The annotation layer name"
annotation_layer_descr = "Give a description for this annotation layer"


class AnnotationLayerPostSchema(Schema):
    name = fields.String(
        description=annotation_layer_name, required=True, validate=[Length(1, 250)]
    )
    descr = fields.String(description=annotation_layer_descr, allow_none=True)


class AnnotationLayerPutSchema(Schema):
    name = fields.String(
        description=annotation_layer_name, required=False, validate=[Length(1, 250)]
    )
    descr = fields.String(description=annotation_layer_descr, required=False)
