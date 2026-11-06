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
"""Request schemas for the saved widget REST API."""

from marshmallow import fields, Schema, validate

widget_type_description = (
    "The namespaced id of the registered widget this is an instance of."
)
schema_version_description = (
    "The version of the widget's schema that the props conform to."
)
name_description = "The display name of the widget."
description_description = (
    "What the widget shows, its business meaning and any caveats. Agents read "
    "it to understand the widget without loading its full configuration."
)
props_description = "The widget's type-specific values, as a JSON object."
editors_description = (
    "A list of subject IDs (users, roles, or groups) that can alter the widget."
)
viewers_description = (
    "A list of subject IDs (users, roles, or groups) that can view the widget."
)


class WidgetPostSchema(Schema):
    widget_type = fields.String(
        required=True,
        validate=validate.Length(1, 250),
        metadata={"description": widget_type_description},
    )
    schema_version = fields.Integer(
        load_default=1,
        strict=True,
        validate=validate.Range(min=1),
        metadata={"description": schema_version_description},
    )
    name = fields.String(
        required=True,
        validate=validate.Length(1, 250),
        metadata={"description": name_description},
    )
    description = fields.String(
        allow_none=True, metadata={"description": description_description}
    )
    props = fields.Dict(
        keys=fields.String(),
        load_default=dict,
        metadata={"description": props_description},
    )
    editors = fields.List(
        fields.Integer(), metadata={"description": editors_description}
    )
    viewers = fields.List(
        fields.Integer(), metadata={"description": viewers_description}
    )


class WidgetPutSchema(Schema):
    schema_version = fields.Integer(
        strict=True,
        validate=validate.Range(min=1),
        metadata={"description": schema_version_description},
    )
    name = fields.String(
        validate=validate.Length(1, 250), metadata={"description": name_description}
    )
    description = fields.String(
        allow_none=True, metadata={"description": description_description}
    )
    props = fields.Dict(
        keys=fields.String(), metadata={"description": props_description}
    )
    editors = fields.List(
        fields.Integer(), metadata={"description": editors_description}
    )
    viewers = fields.List(
        fields.Integer(), metadata={"description": viewers_description}
    )


openapi_spec_methods_override = {
    "get_list": {
        "get": {
            "summary": "Get a list of widgets",
            "description": "Gets a list of saved widgets, use Rison or JSON query "
            "parameters for filtering, sorting, pagination and for selecting "
            "specific columns and metadata.",
        }
    },
    "info": {"get": {"summary": "Get metadata information about this API resource"}},
}
