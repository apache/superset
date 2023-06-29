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

from superset.dashboards.schemas import UserSchema

delete_tags_schema = {"type": "array", "items": {"type": "string"}}

object_type_description = "A title for the tag."

openapi_spec_methods_override = {
    "get": {"get": {"description": "Get a tag detail information."}},
    "get_list": {
        "get": {
            "description": "Get a list of tags, use Rison or JSON query "
            "parameters for filtering, sorting, pagination and "
            " for selecting specific columns and metadata.",
        }
    },
    "info": {
        "get": {
            "description": "Several metadata information about tag API " "endpoints.",
        }
    },
}


class TaggedObjectEntityResponseSchema(Schema):
    id = fields.Int()
    type = fields.String()
    name = fields.String()
    url = fields.String()
    changed_on = fields.DateTime()
    created_by = fields.Nested(UserSchema(exclude=["username"]))
    creator = fields.String()


class TagGetResponseSchema(Schema):
    id = fields.Int()
    name = fields.String()
    type = fields.String()


class TagPostSchema(Schema):
    tags = fields.List(fields.String())
