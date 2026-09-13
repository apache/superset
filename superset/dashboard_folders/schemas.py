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
"""Schemas for dashboard folders."""

from marshmallow import fields, Schema, validate


class DashboardFolderPostSchema(Schema):
    """Validate dashboard folder creation requests."""

    name = fields.String(required=True, validate=validate.Length(min=1, max=100))
    description = fields.String(allow_none=True, validate=validate.Length(max=500))
    parent_id = fields.UUID(allow_none=True, load_default=None)
    editors = fields.List(fields.Integer(), load_default=list)
    viewers = fields.List(fields.Integer(), load_default=list)


class DashboardFolderPutSchema(Schema):
    """Validate dashboard folder update requests."""

    name = fields.String(validate=validate.Length(min=1, max=100))
    description = fields.String(allow_none=True, validate=validate.Length(max=500))
    parent_id = fields.UUID(allow_none=True)
    editors = fields.List(fields.Integer())
    viewers = fields.List(fields.Integer())


class DashboardFolderMoveDashboardSchema(Schema):
    """Validate dashboard move requests."""

    folder_id = fields.UUID(allow_none=True, required=True)
