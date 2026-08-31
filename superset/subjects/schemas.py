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

openapi_spec_methods_override = {
    "get": {"get": {"summary": "Get a Subject"}},
    "get_list": {
        "get": {
            "summary": "Get a list of Subjects",
            "description": "Gets a list of Subjects, use Rison or JSON "
            "query parameters for filtering, sorting, "
            "pagination and for selecting specific "
            "columns and metadata.",
        }
    },
    "info": {"get": {"summary": "Get metadata information about this API resource"}},
}


class SubjectSchema(Schema):
    id = fields.Int()
    label = fields.String()
    secondary_label = fields.String()
    img = fields.String()
    extra_search = fields.String()
    type = fields.Integer()
    active = fields.Boolean()


class SubjectResponseSchema(Schema):
    """Compact schema for subject data in API responses."""

    id = fields.Int()
    label = fields.String()
    secondary_label = fields.String()
    img = fields.String()
    type = fields.Integer()
