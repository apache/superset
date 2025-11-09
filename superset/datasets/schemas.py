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
from datetime import datetime
from typing import Any

from dateutil.parser import isoparse
from flask_babel import lazy_gettext as _
from marshmallow import (
    fields,
    post_dump,
    pre_load,
    Schema,
    validates_schema,
    ValidationError,
)
from marshmallow.validate import Length, OneOf

from superset import security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.exceptions import SupersetMarshmallowValidationError
from superset.utils import json

get_delete_ids_schema = {"type": "array", "items": {"type": "integer"}}
get_export_ids_schema = {"type": "array", "items": {"type": "integer"}}
get_drill_info_schema = {
    "type": "object",
    "properties": {
        "dashboard_id": {"type": "integer"},
    },
}

openapi_spec_methods_override = {
    "get_list": {
        "get": {
            "summary": "Get a list of datasets",
            "description": "Gets a list of datasets, use Rison or JSON query "
            "parameters for filtering, sorting, pagination and "
            " for selecting specific columns and metadata.",
        }
    },
    "info": {"get": {"summary": "Get metadata information about this API resource"}},
}


def validate_python_date_format(dt_format: str) -> bool:
    if dt_format in ("epoch_s", "epoch_ms"):
        return True
    try:
        dt_str = datetime.now().strftime(dt_format)
        isoparse(dt_str)
    except ValueError as ex:
        raise ValidationError([_("Invalid date/timestamp format")]) from ex
    return True


class DatasetColumnsPutSchema(Schema):
    id = fields.Integer(required=False)
    column_name = fields.String(required=True, validate=Length(1, 255))
    type = fields.String(allow_none=True)
    advanced_data_type = fields.String(
        allow_none=True,
        validate=Length(1, 255),
    )
    verbose_name = fields.String(allow_none=True, metadata={Length: (1, 1024)})
    description = fields.String(allow_none=True)
    expression = fields.String(allow_none=True)
    extra = fields.String(allow_none=True)
    filterable = fields.Boolean()
    groupby = fields.Boolean()
    is_active = fields.Boolean(allow_none=True)
    is_dttm = fields.Boolean(allow_none=True, dump_default=False)
    python_date_format = fields.String(
        allow_none=True, validate=[Length(1, 255), validate_python_date_format]
    )
    uuid = fields.UUID(allow_none=True)


class DatasetMetricCurrencyPutSchema(Schema):
    symbol = fields.String(validate=Length(1, 128))
    symbolPosition = fields.String(validate=Length(1, 128))  # noqa: N815


class DatasetMetricsPutSchema(Schema):
    id = fields.Integer()
    expression = fields.String(required=True)
    description = fields.String(allow_none=True)
    extra = fields.String(allow_none=True)
    metric_name = fields.String(required=True, validate=Length(1, 255))
    metric_type = fields.String(allow_none=True, validate=Length(1, 32))
    d3format = fields.String(allow_none=True, validate=Length(1, 128))
    currency = fields.Nested(DatasetMetricCurrencyPutSchema, allow_none=True)
    verbose_name = fields.String(allow_none=True, metadata={Length: (1, 1024)})
    warning_text = fields.String(allow_none=True)
    uuid = fields.UUID(allow_none=True)


class FolderSchema(Schema):
    uuid = fields.UUID(required=True)
    type = fields.String(
        required=False,
        validate=OneOf(["metric", "column", "folder"]),
    )
    name = fields.String(required=False, validate=Length(1, 250))
    description = fields.String(
        required=False,
        allow_none=True,
        validate=Length(0, 1000),
    )
    # folder can contain metrics, columns, and subfolders:
    children = fields.List(
        fields.Nested(lambda: FolderSchema()),
        required=False,
        allow_none=True,
    )

    @validates_schema
    def validate_folder(self, data: dict[str, Any], **kwargs: Any) -> None:
        if "uuid" in data and len(data) == 1:
            # only UUID is present, this is a metric or column
            return

        # folder; must have children
        if "name" in data and "children" not in data:
            raise ValidationError("If 'name' is present, 'children' must be present.")


class DatasetPostSchema(Schema):
    database = fields.Integer(required=True)
    catalog = fields.String(allow_none=True, validate=Length(0, 250))
    schema = fields.String(allow_none=True, validate=Length(0, 250))
    table_name = fields.String(required=True, allow_none=False, validate=Length(1, 250))
    sql = fields.String(allow_none=True)
    owners = fields.List(fields.Integer())
    is_managed_externally = fields.Boolean(allow_none=True, dump_default=False)
    external_url = fields.String(allow_none=True)
    normalize_columns = fields.Boolean(load_default=False)
    always_filter_main_dttm = fields.Boolean(load_default=False)
    template_params = fields.String(allow_none=True)
    uuid = fields.UUID(allow_none=True)


class DatasetPutSchema(Schema):
    table_name = fields.String(allow_none=True, validate=Length(1, 250))
    database_id = fields.Integer()
    sql = fields.String(allow_none=True)
    filter_select_enabled = fields.Boolean(allow_none=True)
    fetch_values_predicate = fields.String(allow_none=True, validate=Length(0, 1000))
    catalog = fields.String(allow_none=True, validate=Length(0, 250))
    schema = fields.String(allow_none=True, validate=Length(0, 255))
    description = fields.String(allow_none=True)
    main_dttm_col = fields.String(allow_none=True)
    normalize_columns = fields.Boolean(allow_none=True, dump_default=False)
    always_filter_main_dttm = fields.Boolean(load_default=False)
    offset = fields.Integer(allow_none=True)
    default_endpoint = fields.String(allow_none=True)
    cache_timeout = fields.Integer(allow_none=True)
    is_sqllab_view = fields.Boolean(allow_none=True)
    template_params = fields.String(allow_none=True)
    owners = fields.List(fields.Integer())
    columns = fields.List(fields.Nested(DatasetColumnsPutSchema))
    metrics = fields.List(fields.Nested(DatasetMetricsPutSchema))
    folders = fields.List(fields.Nested(FolderSchema), required=False)
    extra = fields.String(allow_none=True)
    is_managed_externally = fields.Boolean(allow_none=True, dump_default=False)
    external_url = fields.String(allow_none=True)
    uuid = fields.UUID(allow_none=True)

    def handle_error(
        self,
        error: ValidationError,
        data: dict[str, Any],
        **kwargs: Any,
    ) -> None:
        """
        Return SIP-40 error.
        """
        raise SupersetMarshmallowValidationError(error, data)


class DatasetDuplicateSchema(Schema):
    base_model_id = fields.Integer(required=True)
    table_name = fields.String(required=True, allow_none=False, validate=Length(1, 250))


class DatasetRelatedChart(Schema):
    id = fields.Integer()
    slice_name = fields.String()
    viz_type = fields.String()


class DatasetRelatedDashboard(Schema):
    id = fields.Integer()
    json_metadata = fields.Dict()
    slug = fields.String()
    title = fields.String()


class DatasetRelatedCharts(Schema):
    count = fields.Integer(metadata={"description": "Chart count"})
    result = fields.List(
        fields.Nested(DatasetRelatedChart),
        metadata={"description": "A list of dashboards"},
    )


class DatasetRelatedDashboards(Schema):
    count = fields.Integer(metadata={"description": "Dashboard count"})
    result = fields.List(
        fields.Nested(DatasetRelatedDashboard),
        metadata={"description": "A list of dashboards"},
    )


class DatasetRelatedObjectsResponse(Schema):
    charts = fields.Nested(DatasetRelatedCharts)
    dashboards = fields.Nested(DatasetRelatedDashboards)


class ImportV1ColumnSchema(Schema):
    # pylint: disable=unused-argument
    @pre_load
    def fix_extra(self, data: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
        """
        Fix for extra initially being exported as a string.
        """
        if isinstance(data.get("extra"), str):
            data["extra"] = json.loads(data["extra"])

        return data

    column_name = fields.String(required=True)
    extra = fields.Dict(allow_none=True)
    verbose_name = fields.String(allow_none=True)
    is_dttm = fields.Boolean(dump_default=False, allow_none=True)
    is_active = fields.Boolean(dump_default=True, allow_none=True)
    type = fields.String(allow_none=True)
    advanced_data_type = fields.String(allow_none=True)
    groupby = fields.Boolean()
    filterable = fields.Boolean()
    expression = fields.String(allow_none=True)
    description = fields.String(allow_none=True)
    python_date_format = fields.String(allow_none=True)


class ImportMetricCurrencySchema(Schema):
    symbol = fields.String(validate=Length(1, 128))
    symbolPosition = fields.String(validate=Length(1, 128))  # noqa: N815


class ImportV1MetricSchema(Schema):
    # pylint: disable=unused-argument
    @pre_load
    def fix_fields(self, data: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
        """
        Fix for extra and currency initially being exported as a string.
        """
        if isinstance(data.get("extra"), str):
            data["extra"] = json.loads(data["extra"])

        if isinstance(data.get("currency"), str):
            data["currency"] = json.loads(data["currency"])

        return data

    metric_name = fields.String(required=True)
    verbose_name = fields.String(allow_none=True)
    metric_type = fields.String(allow_none=True)
    expression = fields.String(required=True)
    description = fields.String(allow_none=True)
    d3format = fields.String(allow_none=True)
    currency = fields.Nested(ImportMetricCurrencySchema, allow_none=True)
    extra = fields.Dict(allow_none=True)
    warning_text = fields.String(allow_none=True)


class ImportV1DatasetSchema(Schema):
    # pylint: disable=unused-argument
    @pre_load
    def fix_extra(self, data: dict[str, Any], **kwargs: Any) -> dict[str, Any]:
        """
        Fix for extra initially being exported as a string.
        And fixed bug when exporting template_params as empty string.
        """
        if isinstance(data.get("extra"), str):
            try:
                extra = data["extra"]
                data["extra"] = json.loads(extra) if extra.strip() else None
            except ValueError:
                data["extra"] = None

        if "template_params" in data and data["template_params"] == "":
            data["template_params"] = None

        return data

    table_name = fields.String(required=True)
    main_dttm_col = fields.String(allow_none=True)
    description = fields.String(allow_none=True)
    default_endpoint = fields.String(allow_none=True)
    offset = fields.Integer()
    cache_timeout = fields.Integer(allow_none=True)
    schema = fields.String(allow_none=True)
    catalog = fields.String(allow_none=True)
    sql = fields.String(allow_none=True)
    params = fields.Dict(allow_none=True)
    template_params = fields.Dict(allow_none=True)
    filter_select_enabled = fields.Boolean()
    fetch_values_predicate = fields.String(allow_none=True)
    extra = fields.Dict(allow_none=True)
    uuid = fields.UUID(required=True)
    columns = fields.List(fields.Nested(ImportV1ColumnSchema))
    metrics = fields.List(fields.Nested(ImportV1MetricSchema))
    version = fields.String(required=True)
    database_uuid = fields.UUID(required=True)
    data = fields.URL()
    is_managed_externally = fields.Boolean(allow_none=True, dump_default=False)
    external_url = fields.String(allow_none=True)
    normalize_columns = fields.Boolean(load_default=False)
    always_filter_main_dttm = fields.Boolean(load_default=False)
    folders = fields.List(fields.Nested(FolderSchema), required=False, allow_none=True)


class GetOrCreateDatasetSchema(Schema):
    table_name = fields.String(required=True, metadata={"description": "Name of table"})
    database_id = fields.Integer(
        required=True, metadata={"description": "ID of database table belongs to"}
    )
    catalog = fields.String(
        allow_none=True,
        validate=Length(0, 250),
        metadata={"description": "The catalog the table belongs to"},
    )
    schema = fields.String(
        allow_none=True,
        validate=Length(0, 250),
        metadata={"description": "The schema the table belongs to"},
    )
    template_params = fields.String(
        metadata={"description": "Template params for the table"}
    )
    normalize_columns = fields.Boolean(load_default=False)
    always_filter_main_dttm = fields.Boolean(load_default=False)


class DatasetCacheWarmUpRequestSchema(Schema):
    db_name = fields.String(
        required=True,
        metadata={"description": "The name of the database where the table is located"},
    )
    table_name = fields.String(
        required=True,
        metadata={"description": "The name of the table to warm up cache for"},
    )
    dashboard_id = fields.Integer(
        metadata={
            "description": "The ID of the dashboard to get filters for when warming cache"  # noqa: E501
        }
    )
    extra_filters = fields.String(
        metadata={"description": "Extra filters to apply when warming up cache"}
    )


class DatasetCacheWarmUpResponseSingleSchema(Schema):
    chart_id = fields.Integer(
        metadata={"description": "The ID of the chart the status belongs to"}
    )
    viz_error = fields.String(
        metadata={"description": "Error that occurred when warming cache for chart"}
    )
    viz_status = fields.String(
        metadata={"description": "Status of the underlying query for the viz"}
    )


class DatasetCacheWarmUpResponseSchema(Schema):
    result = fields.List(
        fields.Nested(DatasetCacheWarmUpResponseSingleSchema),
        metadata={
            "description": "A list of each chart's warmup status and errors if any"
        },
    )


class DatasetColumnDrillInfoSchema(Schema):
    column_name = fields.String(required=True)
    verbose_name = fields.String(required=False)


class UserSchema(Schema):
    first_name = fields.String()
    last_name = fields.String()


class DatasetDrillInfoSchema(Schema):
    id = fields.Integer()
    columns = fields.List(fields.Nested(DatasetColumnDrillInfoSchema))
    table_name = fields.String()
    owners = fields.List(fields.Nested(UserSchema))
    created_by = fields.Nested(UserSchema)
    created_on_humanized = fields.String()
    changed_by = fields.Nested(UserSchema)
    changed_on_humanized = fields.String()

    # pylint: disable=unused-argument
    @post_dump(pass_original=True)
    def post_dump(
        self, serialized: dict[str, Any], obj: SqlaTable, **kwargs: Any
    ) -> dict[str, Any]:
        """
        Clear API response to avoid exposing sensitive information for embedded users,
        and filter columns to only include those with groupby=True for drill operations.
        """
        dimensions = {
            col.column_name
            for col in getattr(obj, "columns", [])
            if getattr(col, "groupby", False)
        }
        serialized["columns"] = [
            col
            for col in serialized.get("columns", [])
            if col["column_name"] in dimensions
        ]

        if security_manager.is_guest_user():
            return {"id": serialized["id"], "columns": serialized["columns"]}
        return serialized
