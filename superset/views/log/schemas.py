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


class RecentActivitySchema(Schema):
    action = fields.String(description="Action taken describing type of activity")
    item_type = fields.String(description="Type of item, e.g. slice or dashboard")
    item_url = fields.String(description="URL to item")
    item_title = fields.String(description="Title of item")
    time = fields.Float(description="Time of activity, in epoch milliseconds")
    time_delta_humanized = fields.String(
        description="Human-readable description of how long ago activity took place"
    )


class RecentActivityResponseSchema(Schema):
    result = fields.List(
        fields.Nested(RecentActivitySchema),
        description="A list of recent activity objects",
    )
