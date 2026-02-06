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
from marshmallow import fields, Schema, validate

VALID_ACTIVITY_ACTION_TYPES = ("view", "edit", "export", "chart_interaction", "all")


class DashboardActivityQuerySchema(Schema):
    page = fields.Integer(load_default=0, validate=validate.Range(min=0))
    page_size = fields.Integer(
        load_default=25,
        validate=validate.Range(min=1, max=100),
    )
    action_type = fields.String(
        load_default="all",
        validate=validate.OneOf(VALID_ACTIVITY_ACTION_TYPES),
    )
    days = fields.Integer(load_default=30, validate=validate.Range(min=1, max=365))


class ActivityUserSchema(Schema):
    id = fields.Integer(allow_none=True)
    username = fields.String()
    first_name = fields.String(allow_none=True)
    last_name = fields.String(allow_none=True)


class ActivityItemSchema(Schema):
    id = fields.Integer()
    action = fields.String()
    action_category = fields.String()
    action_display = fields.String()
    user = fields.Nested(ActivityUserSchema)
    timestamp = fields.DateTime()
    first_seen = fields.DateTime()
    last_seen = fields.DateTime()
    event_count = fields.Integer()
    duration_ms = fields.Float(allow_none=True)
    details = fields.Dict(allow_none=True)


class DashboardActivityResponseSchema(Schema):
    activities = fields.List(fields.Nested(ActivityItemSchema))
    count = fields.Integer()
    has_more = fields.Boolean()
    page = fields.Integer()
    page_size = fields.Integer()


class DashboardActivitySummarySchema(Schema):
    total_views = fields.Integer()
    unique_viewers = fields.Integer()
    views_today = fields.Integer()
    recent_editors = fields.List(fields.String())
    period_days = fields.Integer()
