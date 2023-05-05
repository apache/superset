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
# RISON/JSON schemas for query parameters
from marshmallow import fields, Schema, validate

from superset.charts.schemas import (
    datasource_name_description,
    datasource_type_description,
    datasource_uid_description,
)
from superset.utils.core import DatasourceType


class Datasource(Schema):
    database_name = fields.String(
        metadata={"description": "Datasource name"},
    )
    datasource_name = fields.String(
        metadata={"description": datasource_name_description},
    )
    schema = fields.String(
        metadata={"description": "Datasource schema"},
    )
    datasource_type = fields.String(
        metadata={"description": datasource_type_description},
        validate=validate.OneOf(choices=[ds.value for ds in DatasourceType]),
        required=True,
    )


class CacheInvalidationRequestSchema(Schema):
    datasource_uids = fields.List(
        fields.String(),
        metadata={"description": datasource_uid_description},
    )
    datasources = fields.List(
        fields.Nested(Datasource),
        metadata={"description": "A list of the data source and database names"},
    )


class CacheWarmUpRequestSchema(Schema):
    chart_id = fields.Integer(
        metadata={"description": "The ID of the chart to warm up cache for"}
    )
    dashboard_id = fields.Integer(
        metadata={
            "description": "The ID of the dashboard to get filters for when warming cache"
        }
    )
    table_name = fields.String(
        metadata={"description": "The name of the table to warm up cache for"}
    )
    db_name = fields.String(
        metadata={"description": "The name of the database where the table is located"}
    )
    extra_filters = fields.String(
        metadata={"description": "Extra filters to apply when warming up cache"}
    )


class CacheWarmUpResponseSingleSchema(Schema):
    chart_id = fields.Integer(
        metadata={"description": "The ID of the chart the status belongs to"}
    )
    viz_error = fields.String(
        metadata={"description": "Error that occurred when warming cache for chart"}
    )
    viz_status = fields.String(
        metadata={"description": "Status of the underlying query for the viz"}
    )


class CacheWarmUpResponseSchema(Schema):
    result = fields.List(
        fields.Nested(CacheWarmUpResponseSingleSchema),
        metadata={
            "description": "A list of each chart's warmup status and errors if any"
        },
    )
