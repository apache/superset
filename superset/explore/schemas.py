# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
#  License ); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
#  AS IS  BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
from marshmallow import fields, Schema


class DatasetSchema(Schema):
    cache_timeout = fields.Integer(
        metadata={
            "description": "Duration (in seconds) of the caching timeout for this "
            "dataset."
        }
    )
    column_formats = fields.Dict(metadata={"description": "Column formats."})
    currency_formats = fields.Dict(metadata={"description": "Currency formats."})
    columns = fields.List(fields.Dict(), metadata={"description": "Columns metadata."})
    database = fields.Dict(
        metadata={"description": "Database associated with the dataset."}
    )
    datasource_name = fields.String(metadata={"description": "Dataset name."})
    default_endpoint = fields.String(
        metadata={"description": "Default endpoint for the dataset."}
    )
    description = fields.String(metadata={"description": "Dataset description."})
    edit_url = fields.String(
        metadata={"description": "The URL for editing the dataset."}
    )
    extra = fields.Dict(
        metadata={"description": "JSON string containing extra configuration elements."}
    )
    fetch_values_predicate = fields.String(
        metadata={
            "description": "Predicate used when fetching values from the dataset."
        }
    )
    filter_select = fields.Bool(
        metadata={"description": "SELECT filter applied to the dataset."}
    )
    filter_select_enabled = fields.Bool(
        metadata={"description": "If the SELECT filter is enabled."}
    )
    granularity_sqla = fields.List(
        fields.List(fields.Dict()),
        metadata={
            "description": (
                "Name of temporal column used for time filtering for SQL datasources. "
                "This field is deprecated, use `granularity` instead."
            )
        },
    )
    health_check_message = fields.String(
        metadata={"description": "Health check message."}
    )
    id = fields.Integer(metadata={"description": "Dataset ID."})
    is_sqllab_view = fields.Bool(
        metadata={"description": "If the dataset is a SQL Lab view."}
    )
    main_dttm_col = fields.String(metadata={"description": "The main temporal column."})
    metrics = fields.List(fields.Dict(), metadata={"description": "Dataset metrics."})
    name = fields.String(metadata={"description": "Dataset name."})
    offset = fields.Integer(metadata={"description": "Dataset offset."})
    order_by_choices = fields.List(
        fields.List(fields.String()),
        metadata={"description": "List of order by columns."},
    )
    owners = fields.List(
        fields.Integer(), metadata={"description": "List of owners identifiers"}
    )
    params = fields.Dict(metadata={"description": "Extra params for the dataset."})
    perm = fields.String(metadata={"description": "Permission expression."})
    schema = fields.String(metadata={"description": "Dataset schema."})
    select_star = fields.String(metadata={"description": "Select all clause."})
    sql = fields.String(
        metadata={"description": "A SQL statement that defines the dataset."}
    )
    table_name = fields.String(
        metadata={"description": "The name of the table associated with the dataset."}
    )
    template_params = fields.Dict(metadata={"description": "Table template params."})
    time_grain_sqla = fields.List(
        fields.List(fields.String()),
        metadata={
            "description": "List of temporal granularities supported by the dataset."
        },
    )
    type = fields.String(metadata={"description": "Dataset type."})
    uid = fields.String(metadata={"description": "Dataset unique identifier."})
    verbose_map = fields.Dict(
        metadata={"description": "Mapping from raw name to verbose name."}
    )


class SliceSchema(Schema):
    cache_timeout = fields.Integer(
        metadata={
            "description": "Duration (in seconds) of the caching timeout for this chart."
        }
    )
    certification_details = fields.String(
        metadata={"description": "Details of the certification."}
    )
    certified_by = fields.String(
        metadata={"description": "Person or group that has certified this dashboard."}
    )
    changed_on = fields.DateTime(
        metadata={"description": "Timestamp of the last modification."}
    )
    changed_on_humanized = fields.String(
        metadata={
            "description": "Timestamp of the last modification in human readable form."
        }
    )
    datasource = fields.String(metadata={"description": "Datasource identifier."})
    description = fields.String(metadata={"description": "Slice description."})
    description_markeddown = fields.String(
        metadata={"description": "Sanitized HTML version of the chart description."}
    )
    edit_url = fields.String(metadata={"description": "The URL for editing the slice."})
    form_data = fields.Dict(
        metadata={"description": "Form data associated with the slice."}
    )
    is_managed_externally = fields.Bool(
        metadata={"description": "If the chart is managed outside externally."}
    )
    modified = fields.String(
        metadata={"description": "Last modification in human readable form."}
    )
    owners = fields.List(
        fields.Integer(), metadata={"description": "Owners identifiers."}
    )
    query_context = fields.Dict(
        metadata={"description": "The context associated with the query."}
    )
    slice_id = fields.Integer(metadata={"description": "The slice ID."})
    slice_name = fields.String(metadata={"description": "The slice name."})
    slice_url = fields.String(metadata={"description": "The slice URL."})


class ExploreContextSchema(Schema):
    form_data = fields.Dict(
        metadata={
            "description": (
                "Form data from the Explore controls used to form the "
                "chart's data query."
            )
        }
    )
    dataset = fields.Nested(DatasetSchema)
    slice = fields.Nested(SliceSchema)
    message = fields.String(
        metadata={"description": "Any message related to the processed request."}
    )
