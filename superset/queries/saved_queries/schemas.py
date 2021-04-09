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
    "get": {"get": {"description": "Get a saved query",}},
    "get_list": {
        "get": {
            "description": "Get a list of saved queries, use Rison or JSON "
            "query parameters for filtering, sorting,"
            " pagination and for selecting specific"
            " columns and metadata.",
        }
    },
    "post": {"post": {"description": "Create a saved query"}},
    "put": {"put": {"description": "Update a saved query"}},
    "delete": {"delete": {"description": "Delete saved query"}},
}

get_delete_ids_schema = {"type": "array", "items": {"type": "integer"}}
get_export_ids_schema = {"type": "array", "items": {"type": "integer"}}


class ImportV1SavedQuerySchema(Schema):
    schema = fields.String(allow_none=True, validate=Length(0, 128))
    label = fields.String(allow_none=True, validate=Length(0, 256))
    description = fields.String(allow_none=True)
    sql = fields.String(required=True)
    uuid = fields.UUID(required=True)
    version = fields.String(required=True)
    database_uuid = fields.UUID(required=True)
