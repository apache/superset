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
from __future__ import annotations

from typing import Any

from marshmallow import fields, Schema, validates_schema, ValidationError
from marshmallow.validate import Length

_filters_description = (
    "Resolved filters {column, operator, value} ANDed onto the widget's query. "
    "operator is one of EQUALS, NOT_EQUALS, IN, NOT_IN, RANGE, TIME_RANGE."
)


class WidgetSpecSchema(Schema):
    type = fields.String(required=True, validate=Length(1, 250))
    props = fields.Dict(required=True)


class WidgetSelectorSchema(Schema):
    id = fields.String(metadata={"description": "Saved widget uuid."})
    widget = fields.Nested(
        WidgetSpecSchema, metadata={"description": "Inline widget spec."}
    )

    @validates_schema
    def validate_selector(self, data: dict[str, Any], **kwargs: Any) -> None:
        if ("id" in data) == ("widget" in data):
            raise ValidationError("Provide exactly one of `id` or `widget`.")


class WidgetDataPostSchema(WidgetSelectorSchema):
    filters = fields.List(
        fields.Dict(),
        load_default=list,
        metadata={"description": _filters_description},
    )


class WidgetValuesPostSchema(WidgetSelectorSchema):
    pass


class WidgetDataResponseSchema(Schema):
    columns = fields.List(fields.String())
    rows = fields.List(fields.Dict())


class SavedWidgetPostSchema(Schema):
    widget_type = fields.String(required=True, validate=Length(1, 250))
    props = fields.Dict(required=True)
    title = fields.String(allow_none=True, validate=Length(0, 500))


class SavedWidgetPutSchema(Schema):
    props = fields.Dict()
    title = fields.String(allow_none=True, validate=Length(0, 500))


class SavedWidgetResponseSchema(Schema):
    uuid = fields.String()
    widget_type = fields.String()
    title = fields.String(allow_none=True)
    props = fields.Dict()
    dataset_id = fields.Integer(allow_none=True)
    changed_on = fields.DateTime(allow_none=True)
