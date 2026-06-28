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
from flask_babel import gettext as _
from marshmallow import fields, Schema, validates
from marshmallow.exceptions import ValidationError

from superset.security.csp import (
    ALLOWED_DIRECTIVES,
    is_valid_csp_directive,
    is_valid_csp_origin,
)

domain_description = (
    "A bare origin to allow, e.g. 'https://example.com' or "
    "'https://example.com:8443'. Wildcards, paths, query strings and fragments "
    "are rejected."
)
directive_description = (
    "The CSP directive to widen. Defaults to 'frame-src'. One of: "
    f"{', '.join(sorted(ALLOWED_DIRECTIVES))}."
)

openapi_spec_methods_override = {
    "get": {"get": {"summary": "Get a CSP allowlist entry"}},
    "get_list": {
        "get": {
            "summary": "Get a list of CSP allowlist entries",
            "description": "Gets a list of runtime Content Security Policy "
            "allowlist entries, use Rison or JSON query parameters for "
            "filtering, sorting, pagination and for selecting specific "
            "columns and metadata.",
        }
    },
    "post": {"post": {"summary": "Create a CSP allowlist entry"}},
    "put": {"put": {"summary": "Update a CSP allowlist entry"}},
    "delete": {"delete": {"summary": "Delete a CSP allowlist entry"}},
    "info": {"get": {"summary": "Get metadata information about this API resource"}},
}

get_delete_ids_schema = {"type": "array", "items": {"type": "integer"}}


def validate_origin(value: str) -> None:
    if not is_valid_csp_origin(value):
        raise ValidationError(
            _(
                "'%(value)s' is not a valid origin. Provide a bare "
                "scheme://host[:port] value with no wildcard, path, query or "
                "fragment.",
                value=value,
            )
        )


def validate_directive(value: str) -> None:
    if not is_valid_csp_directive(value):
        raise ValidationError(
            _(
                "'%(value)s' is not an allowed CSP directive. Allowed: %(allowed)s.",
                value=value,
                allowed=", ".join(sorted(ALLOWED_DIRECTIVES)),
            )
        )


class CSPAllowlistEntryPostSchema(Schema):
    domain = fields.String(required=True, metadata={"description": domain_description})
    directive = fields.String(
        required=False,
        load_default="frame-src",
        metadata={"description": directive_description},
    )
    description = fields.String(required=False, allow_none=True)

    @validates("domain")
    def validate_domain(self, value: str) -> None:
        validate_origin(value)

    @validates("directive")
    def validate_directive_field(self, value: str) -> None:
        validate_directive(value)


class CSPAllowlistEntryPutSchema(Schema):
    domain = fields.String(required=False, metadata={"description": domain_description})
    directive = fields.String(
        required=False, metadata={"description": directive_description}
    )
    description = fields.String(required=False, allow_none=True)

    @validates("domain")
    def validate_domain(self, value: str) -> None:
        validate_origin(value)

    @validates("directive")
    def validate_directive_field(self, value: str) -> None:
        validate_directive(value)
