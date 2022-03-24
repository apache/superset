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
import re
from typing import Any, Dict

from flask_babel import lazy_gettext as _
from marshmallow import fields, pre_load, Schema, ValidationError
from marshmallow.validate import Length
from marshmallow_sqlalchemy import SQLAlchemyAutoSchema

from superset.datasets.models import Dataset

get_delete_ids_schema = {"type": "array", "items": {"type": "integer"}}
get_export_ids_schema = {"type": "array", "items": {"type": "integer"}}


def validate_python_date_format(value: str) -> None:
    regex = re.compile(
        r"""
        ^(
            epoch_s|epoch_ms|
            (?P<date>%Y(-%m(-%d)?)?)([\sT](?P<time>%H(:%M(:%S(\.%f)?)?)?))?
        )$
        """,
        re.VERBOSE,
    )
    match = regex.match(value or "")
    if not match:
        raise ValidationError(_("Invalid date/timestamp format"))


class DatasetColumnsPutSchema(Schema):
    id = fields.Integer()
    column_name = fields.String(required=True, validate=Length(1, 255))
    type = fields.String(allow_none=True)
    verbose_name = fields.String(allow_none=True, Length=(1, 1024))
    description = fields.String(allow_none=True)
    expression = fields.String(allow_none=True)
    extra = fields.String(allow_none=True)
    filterable = fields.Boolean()
    groupby = fields.Boolean()
    is_active = fields.Boolean()
    is_dttm = fields.Boolean(default=False)
    python_date_format = fields.String(
        allow_none=True, validate=[Length(1, 255), validate_python_date_format]
    )
    uuid = fields.UUID(allow_none=True)


class DatasetMetricsPutSchema(Schema):
    id = fields.Integer()
    expression = fields.String(required=True)
    description = fields.String(allow_none=True)
    extra = fields.String(allow_none=True)
    metric_name = fields.String(required=True, validate=Length(1, 255))
    metric_type = fields.String(allow_none=True, validate=Length(1, 32))
    d3format = fields.String(allow_none=True, validate=Length(1, 128))
    verbose_name = fields.String(allow_none=True, Length=(1, 1024))
    warning_text = fields.String(allow_none=True)
    uuid = fields.UUID(allow_none=True)


class DatasetPostSchema(Schema):
    database = fields.Integer(required=True)
    schema = fields.String(validate=Length(0, 250))
    table_name = fields.String(required=True, allow_none=False, validate=Length(1, 250))
    owners = fields.List(fields.Integer())


class DatasetPutSchema(Schema):
    table_name = fields.String(allow_none=True, validate=Length(1, 250))
    database_id = fields.Integer()
    sql = fields.String(allow_none=True)
    filter_select_enabled = fields.Boolean(allow_none=True)
    fetch_values_predicate = fields.String(allow_none=True, validate=Length(0, 1000))
    schema = fields.String(allow_none=True, validate=Length(0, 255))
    description = fields.String(allow_none=True)
    main_dttm_col = fields.String(allow_none=True)
    offset = fields.Integer(allow_none=True)
    default_endpoint = fields.String(allow_none=True)
    cache_timeout = fields.Integer(allow_none=True)
    is_sqllab_view = fields.Boolean(allow_none=True)
    template_params = fields.String(allow_none=True)
    owners = fields.List(fields.Integer())
    columns = fields.List(fields.Nested(DatasetColumnsPutSchema))
    metrics = fields.List(fields.Nested(DatasetMetricsPutSchema))
    extra = fields.String(allow_none=True)


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
    count = fields.Integer(description="Chart count")
    result = fields.List(
        fields.Nested(DatasetRelatedChart), description="A list of dashboards"
    )


class DatasetRelatedDashboards(Schema):
    count = fields.Integer(description="Dashboard count")
    result = fields.List(
        fields.Nested(DatasetRelatedDashboard), description="A list of dashboards"
    )


class DatasetRelatedObjectsResponse(Schema):
    charts = fields.Nested(DatasetRelatedCharts)
    dashboards = fields.Nested(DatasetRelatedDashboards)


class ImportV1ColumnSchema(Schema):
    # pylint: disable=no-self-use, unused-argument
    @pre_load
    def fix_extra(self, data: Dict[str, Any], **kwargs: Any) -> Dict[str, Any]:
        """
        Fix for extra initially beeing exported as a string.
        """
        if isinstance(data.get("extra"), str):
            data["extra"] = json.loads(data["extra"])

        return data

    column_name = fields.String(required=True)
    extra = fields.Dict(allow_none=True)
    verbose_name = fields.String(allow_none=True)
    is_dttm = fields.Boolean(default=False, allow_none=True)
    is_active = fields.Boolean(default=True, allow_none=True)
    type = fields.String(allow_none=True)
    groupby = fields.Boolean()
    filterable = fields.Boolean()
    expression = fields.String(allow_none=True)
    description = fields.String(allow_none=True)
    python_date_format = fields.String(allow_none=True)


class ImportV1MetricSchema(Schema):
    # pylint: disable=no-self-use, unused-argument
    @pre_load
    def fix_extra(self, data: Dict[str, Any], **kwargs: Any) -> Dict[str, Any]:
        """
        Fix for extra initially beeing exported as a string.
        """
        if isinstance(data.get("extra"), str):
            data["extra"] = json.loads(data["extra"])

        return data

    metric_name = fields.String(required=True)
    verbose_name = fields.String(allow_none=True)
    metric_type = fields.String(allow_none=True)
    expression = fields.String(required=True)
    description = fields.String(allow_none=True)
    d3format = fields.String(allow_none=True)
    extra = fields.Dict(allow_none=True)
    warning_text = fields.String(allow_none=True)


class ImportV1DatasetSchema(Schema):
    # pylint: disable=no-self-use, unused-argument
    @pre_load
    def fix_extra(self, data: Dict[str, Any], **kwargs: Any) -> Dict[str, Any]:
        """
        Fix for extra initially beeing exported as a string.
        """
        if isinstance(data.get("extra"), str):
            data["extra"] = json.loads(data["extra"])

        return data

    table_name = fields.String(required=True)
    main_dttm_col = fields.String(allow_none=True)
    description = fields.String(allow_none=True)
    default_endpoint = fields.String(allow_none=True)
    offset = fields.Integer()
    cache_timeout = fields.Integer(allow_none=True)
    schema = fields.String(allow_none=True)
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


class DatasetSchema(SQLAlchemyAutoSchema):
    """
    Schema for the ``Dataset`` model.
    """

    class Meta:  # pylint: disable=too-few-public-methods
        model = Dataset
        load_instance = True
        include_relationships = True
