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

get_recent_activity_schema = {
    "type": "object",
    "properties": {
        "page": {"type": "number"},
        "page_size": {"type": "number"},
        "actions": {"type": "array", "items": {"type": "string"}},
        "distinct": {"type": "boolean"},
    },
}

get_admin_activity_schema = {
    "type": "object",
    "properties": {
        "page": {"type": "number"},
        "page_size": {"type": "number"},
        "days": {"type": "number"},
        "action_types": {"type": "array", "items": {"type": "string"}},
        "coalesce": {"type": "boolean"},
    },
}

openapi_spec_methods_override = {
    "get": {"get": {"summary": "Get a log detail information"}},
    "get_list": {
        "get": {
            "summary": "Get a list of logs",
            "description": "Gets a list of logs, use Rison or JSON query "
            "parameters for filtering, sorting, pagination and "
            " for selecting specific columns and metadata.",
        }
    },
}


class RecentActivitySchema(Schema):
    action = fields.String(
        metadata={"description": "Action taken describing type of activity"}
    )
    item_type = fields.String(
        metadata={"description": "Type of item, e.g. slice or dashboard"}
    )
    item_url = fields.String(metadata={"description": "URL to item"})
    item_title = fields.String(metadata={"description": "Title of item"})
    time = fields.Float(
        metadata={"description": "Time of activity, in epoch milliseconds"}
    )
    time_delta_humanized = fields.String(
        metadata={
            "description": "Human-readable description of how long ago activity took "
            "place."
        }
    )


class RecentActivityResponseSchema(Schema):
    result = fields.List(
        fields.Nested(RecentActivitySchema),
        metadata={"description": "A list of recent activity objects"},
    )


class AdminActivityActorSchema(Schema):
    id = fields.Integer(allow_none=True)
    username = fields.String()
    first_name = fields.String(allow_none=True)
    last_name = fields.String(allow_none=True)


class AdminActivityItemSchema(Schema):
    id = fields.Integer()
    actor = fields.Nested(AdminActivityActorSchema)
    action = fields.String()
    action_category = fields.String()
    object_type = fields.String(allow_none=True)
    object_id = fields.Integer(allow_none=True)
    object_title = fields.String(allow_none=True)
    object_url = fields.String(allow_none=True)
    timestamp = fields.DateTime()
    event_count = fields.Integer()
    first_seen = fields.DateTime()
    last_seen = fields.DateTime()


class AdminActivityResponseSchema(Schema):
    result = fields.List(
        fields.Nested(AdminActivityItemSchema),
        metadata={"description": "A list of admin activity objects"},
    )
    count = fields.Integer()
    page = fields.Integer()
    page_size = fields.Integer()
