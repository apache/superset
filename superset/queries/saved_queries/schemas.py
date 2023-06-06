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
from typing import Any, Dict

from marshmallow import fields, post_dump, Schema
from marshmallow.validate import Length

from superset.models.sql_lab import SavedQuery

openapi_spec_methods_override = {
    "get": {
        "get": {
            "description": "Get a saved query",
        }
    },
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


class SavedQueryCreatorSchema(Schema):
    id = fields.Integer(metadata={"description": "Creator's ID"})
    first_name = fields.String(metadata={"description": "Creator's first name"})
    last_name = fields.String(metadata={"description": "Creator's last name"})


class SavedQueryDatabaseSchema(Schema):
    database_name = fields.String(metadata={"description": "Database's name"})
    id = fields.Integer(metadata={"description": "Database's ID"})


class SavedQuerySqlTableSchema(Schema):
    table = fields.String()
    schema = fields.String()
    catalog = fields.String()


class SavedQueryGetSchema(Schema):
    changed_on_delta_humanized = fields.String(
        metadata={"description": "How long ago the query was changed"}
    )
    created_by = fields.Nested(SavedQueryCreatorSchema)
    database = fields.Nested(SavedQueryDatabaseSchema)
    description = fields.String(metadata={"description": "Query's description"})
    id = fields.Integer(metadata={"description": "Query's ID"})
    label = fields.String(metadata={"description": "Query's label"})
    schema = fields.String(metadata={"description": "Query's schema"})
    sql = fields.String(metadata={"description": "Query's SQL"})
    sql_tables = fields.List(
        fields.Nested(SavedQuerySqlTableSchema),
        metadata={"description": "Tables accessed by query SQL"},
    )
    uuid = fields.UUID(metadata={"description": "Query's UUID"})

    @post_dump(pass_original=True)
    def post_dump(self, serialized: Dict[str, Any], saved_query: SavedQuery, **kwargs):
        serialized["changed_on_delta_humanized"] = saved_query.changed_on_humanized
        return serialized
