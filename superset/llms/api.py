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
import logging
from typing import Any

from flask import request, Response
from flask_appbuilder.api import expose, protect, rison, safe
from flask_appbuilder.api.schemas import get_list_schema
from flask_appbuilder.models.sqla.interface import SQLAInterface
from marshmallow import fields, post_load, Schema, ValidationError

from superset.models.core import CustomLlmProvider
from superset.views.base_api import BaseSupersetModelRestApi, statsd_metrics

logger = logging.getLogger(__name__)


class CustomLlmProviderSchema(Schema):
    id = fields.Integer(dump_only=True)
    name = fields.String(required=True)
    endpoint_url = fields.String(required=True)
    request_template = fields.String(required=True)
    response_path = fields.String(required=True)
    headers = fields.String(allow_none=True)
    models = fields.String(required=True)
    system_instructions = fields.String(allow_none=True)
    timeout = fields.Integer(allow_none=True, missing=30)
    enabled = fields.Boolean(missing=True)
    created_on = fields.DateTime(dump_only=True)
    changed_on = fields.DateTime(dump_only=True)

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

        # Validate models
        try:
            models = json.loads(data["models"])
            if not isinstance(models, dict):
                raise ValidationError("models must be a JSON object")
        except json.JSONDecodeError:
            raise ValidationError("models must be valid JSON")

        return data


class CustomLlmProviderRestApi(BaseSupersetModelRestApi):
    datamodel = SQLAInterface(CustomLlmProvider)
    resource_name = "custom_llm_provider"
    allow_browser_login = True

    class_permission_name = "CustomLlmProvider"
    method_permission_name = {
        "get": "read",
        "get_list": "read",
        "post": "write",
        "put": "write",
        "delete": "write",
    }

    add_columns = [
        "name",
        "endpoint_url",
        "request_template",
        "response_path",
        "headers",
        "models",
        "system_instructions",
        "timeout",
        "enabled",
    ]

    edit_columns = add_columns

    list_columns = [
        "id",
        "name",
        "endpoint_url",
        "enabled",
        "created_on",
        "changed_on",
    ]

    show_columns = [
        "id",
        "name",
        "endpoint_url",
        "request_template",
        "response_path",
        "headers",
        "models",
        "system_instructions",
        "timeout",
        "enabled",
        "created_on",
        "changed_on",
    ]

    openapi_spec_tag = "Custom LLM Providers"

    add_model_schema = CustomLlmProviderSchema()
    edit_model_schema = CustomLlmProviderSchema()
    show_model_schema = CustomLlmProviderSchema()

    @expose("/test", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def test_connection(self) -> Response:
        """Test connection to a custom LLM provider.
        ---
        post:
          summary: Test connection to a custom LLM provider
          requestBody:
            description: Custom LLM provider connection details
            required: true
            content:
              application/json:
                schema:
                  type: object
                  required:
                  - endpoint_url
                  - request_template
                  - response_path
                  properties:
                    endpoint_url:
                      type: string
                      description: The LLM provider endpoint URL
                    request_template:
                      type: string
                      description: JSON template for requests
                    response_path:
                      type: string
                      description: Path to extract response content
                    headers:
                      type: string
                      description: Additional headers as JSON
                    timeout:
                      type: integer
                      description: Request timeout in seconds
          responses:
            200:
              description: Connection test result
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: object
                        properties:
                          status:
                            type: string
                          status_code:
                            type: integer
                          message:
                            type: string
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            500:
              $ref: '#/components/responses/500'
        """
        try:
            data = request.get_json()

            # Validate required fields
            required_fields = ["endpoint_url", "request_template", "response_path"]
            for field in required_fields:
                if field not in data:
                    return self.response_400(f"Missing required field: {field}")

            # Validate JSON fields
            try:
                request_template = json.loads(data["request_template"])
            except json.JSONDecodeError:
                return self.response_400("request_template must be valid JSON")

            headers = {"Content-Type": "application/json"}
            if data.get("headers"):
                try:
                    custom_headers = json.loads(data["headers"])
                    headers.update(custom_headers)
                except json.JSONDecodeError:
                    return self.response_400("headers must be valid JSON")

            # Create a simple test request
            test_request = {
                "model": "test",
                "messages": [{"role": "user", "content": "SELECT 1"}],
            }

            # Substitute template variables if needed
            test_data = request_template.copy()
            for key, value in test_data.items():
                if isinstance(value, str) and "{" in value:
                    test_data[key] = value.format(
                        model="test", messages=test_request["messages"], api_key="test"
                    )

            import requests

            timeout = data.get("timeout", 30)

            try:
                response = requests.post(
                    data["endpoint_url"],
                    json=test_data,
                    headers=headers,
                    timeout=timeout,
                )

                return self.response(
                    200,
                    result={
                        "status": "success",
                        "status_code": response.status_code,
                        "message": "Connection test completed",
                    },
                )

            except requests.exceptions.RequestException as e:
                return self.response(
                    200,
                    result={
                        "status": "error",
                        "message": f"Connection failed: {str(e)}",
                    },
                )

        except Exception as e:
            logger.exception("Error testing custom LLM provider connection")
            return self.response_500(message=str(e))

    @expose("/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @rison(get_list_schema)
    def get_list(self, **kwargs: Any) -> Response:
        """Get list of custom LLM providers.
        ---
        get:
          summary: Get a list of custom LLM providers
          parameters:
          - in: query
            name: q
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/get_list_schema'
          responses:
            200:
              description: List of custom LLM providers
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      ids:
                        description: >-
                          A list of custom LLM provider ids
                        type: array
                        items:
                          type: integer
                      count:
                        description: >-
                          The total record count on the backend
                        type: number
                      result:
                        description: >-
                          The result from the get list query
                        type: array
                        items:
                          $ref: '#/components/schemas/{{self.__class__.__name__}}.get_list'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        return super().get_list(**kwargs)

    @expose("/<int:pk>", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def get(self, pk: int, **kwargs: Any) -> Response:
        """Get a custom LLM provider by ID.
        ---
        get:
          summary: Get a custom LLM provider
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The custom LLM provider id
          responses:
            200:
              description: Custom LLM provider details
              content:
                application/json:
                  schema:
                    $ref: '#/components/schemas/{{self.__class__.__name__}}.get'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            500:
              $ref: '#/components/responses/500'
        """
        return super().get(pk, **kwargs)

    @expose("/", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def post(self) -> Response:
        """Create a new custom LLM provider.
        ---
        post:
          summary: Create a custom LLM provider
          requestBody:
            description: Custom LLM provider details
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
          responses:
            201:
              description: Custom LLM provider created
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: integer
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.post'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        return super().post()

    @expose("/<int:pk>", methods=("PUT",))
    @protect()
    @safe
    @statsd_metrics
    def put(self, pk: int) -> Response:
        """Update a custom LLM provider.
        ---
        put:
          summary: Update a custom LLM provider
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The custom LLM provider id
          requestBody:
            description: Custom LLM provider details
            required: true
            content:
              application/json:
                schema:
                  $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
          responses:
            200:
              description: Custom LLM provider updated
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      id:
                        type: integer
                      result:
                        $ref: '#/components/schemas/{{self.__class__.__name__}}.put'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        return super().put(pk)

    @expose("/<int:pk>", methods=("DELETE",))
    @protect()
    @safe
    @statsd_metrics
    def delete(self, pk: int) -> Response:
        """Delete a custom LLM provider.
        ---
        delete:
          summary: Delete a custom LLM provider
          parameters:
          - in: path
            schema:
              type: integer
            name: pk
            description: The custom LLM provider id
          responses:
            200:
              description: Custom LLM provider deleted
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: string
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            404:
              $ref: '#/components/responses/404'
            422:
              $ref: '#/components/responses/422'
            500:
              $ref: '#/components/responses/500'
        """
        return super().delete(pk)
