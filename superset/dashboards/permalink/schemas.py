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


class DashboardPermalinkStateSchema(Schema):
    dataMask = fields.Dict(  # noqa: N815
        required=False,
        allow_none=True,
        metadata={"description": "Data mask used for native filter state"},
    )
    activeTabs = fields.List(  # noqa: N815
        fields.String(),
        required=False,
        allow_none=True,
        metadata={"description": "Current active dashboard tabs"},
    )
    urlParams = fields.List(  # noqa: N815
        fields.Tuple(
            (
                fields.String(
                    required=True, allow_none=True, metadata={"description": "Key"}
                ),
                fields.String(
                    required=True, allow_none=True, metadata={"description": "Value"}
                ),
            ),
            required=False,
            allow_none=True,
            metadata={"description": "URL Parameter key-value pair"},
        ),
        required=False,
        allow_none=True,
        metadata={"description": "URL Parameters"},
    )
    anchor = fields.String(
        required=False,
        allow_none=True,
        metadata={"description": "Optional anchor link added to url hash"},
    )


class DashboardPermalinkSchema(Schema):
    dashboardId = fields.String(  # noqa: N815
        required=True,
        allow_none=False,
        metadata={"description": "The id or slug of the dashboard"},
    )
    state = fields.Nested(DashboardPermalinkStateSchema())
