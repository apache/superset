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

import json
from marshmallow import fields, Schema, post_load, ValidationError


class CustomLlmProviderTestSchema(Schema):
    """Schema for testing custom LLM provider connection."""
    endpoint_url = fields.String(required=True)
    request_template = fields.String(required=True)
    response_path = fields.String(required=True)
    headers = fields.String(allow_none=True)
    timeout = fields.Integer(missing=30)

    @post_load
    def validate_json_fields(self, data, **kwargs):
        """Validate JSON fields."""
        # Validate request_template
        try:
            json.loads(data["request_template"])
        except json.JSONDecodeError:
            raise ValidationError("request_template must be valid JSON")

        # Validate headers if provided
        if data.get("headers"):
            try:
                json.loads(data["headers"])
            except json.JSONDecodeError:
                raise ValidationError("headers must be valid JSON")

        return data


custom_llm_provider_test_schema = CustomLlmProviderTestSchema()