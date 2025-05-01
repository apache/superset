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
from typing import Any, Optional, TypedDict

from marshmallow import fields, post_load, pre_load, Schema, validate

from superset import app
from superset.charts.schemas import ChartDataExtrasSchema, ChartDataFilterSchema
from superset.utils.core import DatasourceType


class ExternalMetadataParams(TypedDict):
    datasource_type: str
    database_name: str
    catalog_name: Optional[str]
    schema_name: str
    table_name: str
    normalize_columns: Optional[bool]
    always_filter_main_dttm: Optional[bool]


get_external_metadata_schema = {
    "datasource_type": "string",
    "database_name": "string",
    "schema_name": "string",
    "table_name": "string",
    "normalize_columns": "boolean",
    "always_filter_main_dttm": "boolean",
}


class ExternalMetadataSchema(Schema):
    datasource_type = fields.Str(required=True)
    database_name = fields.Str(required=True)
    catalog_name = fields.Str(allow_none=True)
    schema_name = fields.Str(allow_none=True)
    table_name = fields.Str(required=True)
    normalize_columns = fields.Bool(allow_none=True)
    always_filter_main_dttm = fields.Bool(allow_none=True)

    # pylint: disable=unused-argument
    @post_load
    def normalize(
        self,
        data: ExternalMetadataParams,
        **kwargs: Any,
    ) -> ExternalMetadataParams:
        return ExternalMetadataParams(
            datasource_type=data["datasource_type"],
            database_name=data["database_name"],
            catalog_name=data.get("catalog_name"),
            schema_name=data.get("schema_name", ""),
            table_name=data["table_name"],
            normalize_columns=data["normalize_columns"],
            always_filter_main_dttm=data["always_filter_main_dttm"],
        )


class SamplesPayloadSchema(Schema):
    filters = fields.List(fields.Nested(ChartDataFilterSchema), required=False)
    granularity = fields.String(
        allow_none=True,
    )
    time_range = fields.String(
        allow_none=True,
    )
    extras = fields.Nested(
        ChartDataExtrasSchema,
        metadata={"description": "Extra parameters to add to the query."},
        allow_none=True,
    )

    @pre_load
    # pylint: disable=unused-argument
    def handle_none(self, data: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
        if data is None:
            return {}
        return data


class SamplesRequestSchema(Schema):
    datasource_type = fields.String(
        validate=validate.OneOf([e.value for e in DatasourceType]), required=True
    )
    datasource_id = fields.Integer(required=True)
    force = fields.Boolean(load_default=False)
    page = fields.Integer(load_default=1)
    per_page = fields.Integer(
        validate=validate.Range(min=1, max=app.config.get("SAMPLES_ROW_LIMIT", 1000)),
        load_default=app.config.get("SAMPLES_ROW_LIMIT", 1000),
    )
