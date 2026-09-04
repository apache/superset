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

from superset.utils.core import DatasourceType


class FormDataPostSchema(Schema):
    datasource_id = fields.Integer(
        required=True, allow_none=False, metadata={"description": "The datasource ID"}
    )
    datasource_type = fields.String(
        required=True,
        allow_none=False,
        metadata={"description": "The datasource type"},
        validate=validate.OneOf(choices=[ds.value for ds in DatasourceType]),
    )
    chart_id = fields.Integer(required=False, metadata={"description": "The chart ID"})
    form_data = fields.String(
        required=True,
        allow_none=False,
        metadata={"description": "Any type of JSON supported text."},
    )


class FormDataPutSchema(Schema):
    datasource_id = fields.Integer(
        required=True, allow_none=False, metadata={"description": "The datasource ID"}
    )
    datasource_type = fields.String(
        required=True,
        allow_none=False,
        metadata={"description": "The datasource type"},
        validate=validate.OneOf(choices=[ds.value for ds in DatasourceType]),
    )
    chart_id = fields.Integer(required=False, metadata={"description": "The chart ID"})
    form_data = fields.String(
        required=True,
        allow_none=False,
        metadata={"description": "Any type of JSON supported text."},
    )
