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
from marshmallow import fields, pre_load, Schema, ValidationError
from marshmallow.validate import Length

from superset.dashboards.filter_sets.consts import (
    DASHBOARD_OWNER_TYPE,
    OWNER_ID_FIELD,
    OWNER_TYPE_FIELD,
    USER_OWNER_TYPE,
)


class JsonMetadataSchema(Schema):
    nativeFilters = fields.Mapping(required=True, allow_none=False)
    dataMask = fields.Mapping(required=False, allow_none=False)


class FilterSetPostSchema(Schema):
    name = fields.String(required=True, allow_none=False, validate=Length(0, 500),)
    description = fields.String(allow_none=True, validate=[Length(1, 1000)])
    json_metadata = fields.Nested(JsonMetadataSchema, required=True)

    owner_id = fields.Int(required=True)
    owner_type = fields.String(
        required=False, OneOf=[USER_OWNER_TYPE, DASHBOARD_OWNER_TYPE]
    )

    @pre_load
    def validate(self, data, many, **kwargs):
        if data[OWNER_TYPE_FIELD] == USER_OWNER_TYPE and OWNER_ID_FIELD not in data:
            raise ValidationError("owner_id is mandatory when owner_type is User")
        return data


class FilterSetPutSchema(Schema):
    name = fields.String(allow_none=False, validate=Length(0, 500))
    description = fields.String(allow_none=False, validate=[Length(1, 1000)])
    json_metadata = fields.Nested(JsonMetadataSchema, allow_none=False)
    owner_type = fields.String(
        allow_none=False, OneOf=[USER_OWNER_TYPE, DASHBOARD_OWNER_TYPE]
    )


def validate_pair(first_field, second_field, data):
    if first_field in data and second_field not in data:
        raise ValidationError(
            "{} must be included alongside {}".format(first_field, second_field)
        )


class FilterSetMetadataSchema(Schema):
    pass
