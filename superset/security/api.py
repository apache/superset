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
import logging
import jwt

from flask import Response, request
from flask_appbuilder import expose
from flask_appbuilder.api import BaseApi, safe
from flask_appbuilder.security.decorators import permission_name, protect
from flask_wtf.csrf import generate_csrf
from marshmallow import Schema, fields, ValidationError

from superset.extensions import event_logger

logger = logging.getLogger(__name__)


class UserSchema(Schema):
    username = fields.String()
    first_name = fields.String()
    last_name = fields.String()


class ResourceSchema(Schema):
    type = fields.String(required=True)
    id = fields.String(required=True)
    rls_expression = fields.String()


class EmbeddedTokenCreateSchema(Schema):
    user = fields.Nested(UserSchema)
    resource = fields.Nested(ResourceSchema, required=True)


embedded_token_create_schema = EmbeddedTokenCreateSchema()


class SecurityRestApi(BaseApi):
    resource_name = "security"
    allow_browser_login = True
    openapi_spec_tag = "Security"

    @expose("/csrf_token/", methods=["GET"])
    @event_logger.log_this
    @protect()
    @safe
    @permission_name("read")
    def csrf_token(self) -> Response:
        """
        Return the csrf token
        ---
        get:
          description: >-
            Fetch the CSRF token
          responses:
            200:
              description: Result contains the CSRF token
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                        result:
                          type: string
            401:
              $ref: '#/components/responses/401'
            500:
              $ref: '#/components/responses/500'
        """
        return self.response(200, result=generate_csrf())

    @expose("/embedded_token/", methods=["POST"])
    @event_logger.log_this
    @protect()
    @safe
    @permission_name("grant_token")
    def embedded_token(self) -> Response:
        try:
            token_data = embedded_token_create_schema.load(request.json)
            # validate stuff
            secret = self.appbuilder.app.config["EMBEDDED_JWT_SECRET"]
            token = jwt.encode(token_data, secret, algorithm="HS256")
            return self.response(200, token=token)
        except ValidationError as error:
            return self.response_400(message=error.messages)
