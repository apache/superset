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


class ExplorePermalinkStateSchema(Schema):
    formData = fields.Dict(
        required=True,
        allow_none=False,
        description="Chart form data",
    )
    urlParams = fields.List(
        fields.Tuple(
            (
                fields.String(required=True, allow_none=True, description="Key"),
                fields.String(required=True, allow_none=True, description="Value"),
            ),
            required=False,
            allow_none=True,
            description="URL Parameter key-value pair",
        ),
        required=False,
        allow_none=True,
        description="URL Parameters",
    )


class ExplorePermalinkSchema(Schema):
    chartId = fields.Integer(
        required=False,
        allow_none=True,
        metadata={"description": "The id of the chart"},
    )
    datasourceType = fields.String(
        required=True,
        allow_none=False,
        metadata={"description": "The type of the datasource"},
    )
    datasourceId = fields.Integer(
        required=False,
        allow_none=True,
        metadata={"description": "The id of the datasource"},
    )
    datasource = fields.String(
        required=False,
        allow_none=True,
        metadata={"description": "The fully qualified datasource reference"},
    )
    state = fields.Nested(ExplorePermalinkStateSchema())
