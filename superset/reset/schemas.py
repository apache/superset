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


class ResetPostSchema(Schema):
    """
    Schema to reset superset.
    """

    all = fields.Boolean(
        allow_none=True,
        metadata={"description": "Reset entire superset"}
    )
    dashboards = fields.Boolean(
        allow_none=True,
        metadata={"description": "Reset all dashboards"}
    )
    databases = fields.Boolean(
        allow_none=True,
        metadata={"description": "Reset all databases"}
    )
    datasets = fields.Boolean(
        allow_none=True,
        metadata={"description": "Reset all datasets"}
    )
    slices = fields.Boolean(
        allow_none=True,
        metadata={"description": "Reset all slices"}
    )
    users = fields.Boolean(
        allow_none=True,
        metadata={"description": "Reset all users"}
    )
    roles = fields.Boolean(
        allow_none=True,
        metadata={"description": "Reset all roles"}
    )
    excluded_roles = fields.List(
        fields.String(),
        allow_none=True,
        metadata={"description": "List of roles to exclude"}
    )
    excluded_users = fields.List(
        fields.String(),
        allow_none=True,
        metadata={"description": "List of users to exclude"}
    )
