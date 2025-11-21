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
from flask_appbuilder.security.sqla.apis.user.schema import User
from flask_appbuilder.security.sqla.apis.user.validator import (
    PasswordComplexityValidator,
)
from marshmallow import fields, Schema
from marshmallow.fields import Boolean, Integer, String
from marshmallow.validate import Length

first_name_description = "The current user's first name"
last_name_description = "The current user's last name"
password_description = "The current user's password for authentication"  # noqa: S105


class UserResponseSchema(Schema):
    id = Integer()
    username = String()
    email = String()
    first_name = String()
    last_name = String()
    is_active = Boolean()
    is_anonymous = Boolean()
    login_count = Integer()


class CurrentUserPutSchema(Schema):
    model_cls = User

    first_name = fields.String(
        required=False,
        metadata={"description": first_name_description},
        validate=[Length(1, 64)],
    )
    last_name = fields.String(
        required=False,
        metadata={"description": last_name_description},
        validate=[Length(1, 64)],
    )
    password = fields.String(
        required=False,
        validate=[PasswordComplexityValidator()],
        metadata={"description": password_description},
    )


class ApiKeyPostSchema(Schema):
    """Schema for creating a new API key."""

    name = fields.String(
        required=True,
        metadata={"description": "User-friendly name for the API key"},
        validate=[Length(1, 256)],
    )
    workspace_name = fields.String(
        required=False,
        load_default="default",
        metadata={"description": "Workspace this key is scoped to. Defaults to 'default'."},
        validate=[Length(1, 256)],
    )
    expires_on = fields.DateTime(
        required=False,
        allow_none=True,
        metadata={"description": "Optional expiration datetime for the key"},
    )


class ApiKeyResponseSchema(Schema):
    """Schema for API key response."""

    id = Integer()
    name = String()
    key_prefix = String()
    workspace_name = String()
    created_on = fields.DateTime()
    expires_on = fields.DateTime(allow_none=True)
    revoked_on = fields.DateTime(allow_none=True)
    last_used_on = fields.DateTime(allow_none=True)


class ApiKeyCreateResponseSchema(Schema):
    """Schema for API key creation response (includes full key)."""

    id = Integer()
    name = String()
    api_key = String(
        metadata={
            "description": "Full API key - shown only once at creation. Store securely!"
        }
    )
    key_prefix = String()
    workspace_name = String()
    created_on = fields.DateTime()
