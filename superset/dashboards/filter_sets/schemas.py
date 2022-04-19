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
from typing import Any, cast, Dict, Mapping

from marshmallow import fields, post_load, Schema, ValidationError
from marshmallow.validate import Length, OneOf

from superset.dashboards.filter_sets.consts import (
    DASHBOARD_OWNER_TYPE,
    JSON_METADATA_FIELD,
    OWNER_ID_FIELD,
    OWNER_TYPE_FIELD,
    USER_OWNER_TYPE,
)


class JsonMetadataSchema(Schema):
    nativeFilters = fields.Mapping(required=True, allow_none=False)
    dataMask = fields.Mapping(required=False, allow_none=False)


class FilterSetSchema(Schema):
    json_metadata_schema: JsonMetadataSchema = JsonMetadataSchema()

    def _validate_json_meta_data(self, json_meta_data: str) -> None:
        try:
            self.json_metadata_schema.loads(json_meta_data)
        except Exception as ex:
            raise ValidationError("failed to parse json_metadata to json") from ex


class FilterSetPostSchema(FilterSetSchema):
    json_metadata_schema: JsonMetadataSchema = JsonMetadataSchema()
    # pylint: disable=W0613
    name = fields.String(required=True, allow_none=False, validate=Length(0, 500),)
    description = fields.String(
        required=False, allow_none=True, validate=[Length(1, 1000)]
    )
    json_metadata = fields.String(allow_none=False, required=True)

    owner_type = fields.String(
        required=True, validate=OneOf([USER_OWNER_TYPE, DASHBOARD_OWNER_TYPE])
    )
    owner_id = fields.Int(required=False)

    @post_load
    def validate(
        self, data: Mapping[Any, Any], *, many: Any, partial: Any
    ) -> Dict[str, Any]:
        self._validate_json_meta_data(data[JSON_METADATA_FIELD])
        if data[OWNER_TYPE_FIELD] == USER_OWNER_TYPE and OWNER_ID_FIELD not in data:
            raise ValidationError("owner_id is mandatory when owner_type is User")
        return cast(Dict[str, Any], data)


class FilterSetPutSchema(FilterSetSchema):
    name = fields.String(required=False, allow_none=False, validate=Length(0, 500))
    description = fields.String(
        required=False, allow_none=False, validate=[Length(1, 1000)]
    )
    json_metadata = fields.String(required=False, allow_none=False)
    owner_type = fields.String(
        allow_none=False, required=False, validate=OneOf([DASHBOARD_OWNER_TYPE])
    )

    @post_load
    def validate(  # pylint: disable=unused-argument
        self, data: Mapping[Any, Any], *, many: Any, partial: Any
    ) -> Dict[str, Any]:
        if JSON_METADATA_FIELD in data:
            self._validate_json_meta_data(data[JSON_METADATA_FIELD])
        return cast(Dict[str, Any], data)


def validate_pair(first_field: str, second_field: str, data: Dict[str, Any]) -> None:
    if first_field in data and second_field not in data:
        raise ValidationError(
            "{} must be included alongside {}".format(first_field, second_field)
        )
