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


class KeyValuePostSchema(Schema):
    value = fields.String(
        required=True, allow_none=False, description="Any type of JSON supported value."
    )
    duration_ms = fields.Integer(
        required=False,
        allow_none=True,
        description="The duration of the value on the key store. If no duration is specified the value won't expire.",
    )
    reset_duration_on_retrieval = fields.Boolean(
        required=False,
        allow_none=False,
        default=True,
        description="If the duration should be reset when the value is retrieved. This is useful if you wish to expire unused values but keep the ones that are actively retrieved.",
    )


class KeyValuePutSchema(Schema):
    value = fields.String(
        required=True, allow_none=False, description="Any type of JSON supported value."
    )
    duration_ms = fields.Integer(
        required=False,
        allow_none=True,
        description="The duration of the value on the key store. If no duration is specified the value won't expire.",
    )
    reset_duration_on_retrieval = fields.Boolean(
        required=False,
        allow_none=False,
        default=True,
        description="If the duration should be reset when the value is retrieved. This is useful if you wish to expire unused values but keep the ones that are actively retrieved.",
    )
