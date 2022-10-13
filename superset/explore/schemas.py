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
        description="Duration (in seconds) of the caching timeout for this dataset."
    )
    column_formats = fields.Dict(description="Column formats.")
    columns = fields.List(fields.Dict(), description="Columns metadata.")
    database = fields.Dict(description="Database associated with the dataset.")
    datasource_name = fields.String(description="Dataset name.")
    default_endpoint = fields.String(description="Default endpoint for the dataset.")
    description = fields.String(description="Dataset description.")
    edit_url = fields.String(description="The URL for editing the dataset.")
    extra = fields.Dict(
        description="JSON string containing extra configuration elements."
    )
    fetch_values_predicate = fields.String(
        description="Predicate used when fetching values from the dataset."
    )
    filter_select = fields.Bool(description="SELECT filter applied to the dataset.")
    filter_select_enabled = fields.Bool(description="If the SELECT filter is enabled.")
    granularity_sqla = fields.List(
        fields.List(fields.Dict()),
        description=(
            "Name of temporal column used for time filtering for SQL datasources. "
            "This field is deprecated, use `granularity` instead."
        ),
    )
    health_check_message = fields.String(description="Health check message.")
    id = fields.Integer(description="Dataset ID.")
    is_sqllab_view = fields.Bool(description="If the dataset is a SQL Lab view.")
    main_dttm_col = fields.String(description="The main temporal column.")
    metrics = fields.List(fields.Dict(), description="Dataset metrics.")
    name = fields.String(description="Dataset name.")
    offset = fields.Integer(description="Dataset offset.")
    order_by_choices = fields.List(
        fields.List(fields.String()), description="List of order by columns."
    )
    owners = fields.List(fields.Integer(), description="List of owners identifiers")
    params = fields.Dict(description="Extra params for the dataset.")
    perm = fields.String(description="Permission expression.")
    schema = fields.String(description="Dataset schema.")
    select_star = fields.String(description="Select all clause.")
    sql = fields.String(description="A SQL statement that defines the dataset.")
    table_name = fields.String(
        description="The name of the table associated with the dataset."
    )
    template_params = fields.Dict(description="Table template params.")
    time_grain_sqla = fields.List(
        fields.List(fields.String()),
        description="List of temporal granularities supported by the dataset.",
    )
    type = fields.String(description="Dataset type.")
    uid = fields.String(description="Dataset unique identifier.")
    verbose_map = fields.Dict(description="Mapping from raw name to verbose name.")


class SliceSchema(Schema):
    cache_timeout = fields.Integer(
        description="Duration (in seconds) of the caching timeout for this chart."
    )
    certification_details = fields.String(description="Details of the certification.")
    certified_by = fields.String(
        description="Person or group that has certified this dashboard."
    )
    changed_on = fields.String(description="Timestamp of the last modification.")
    changed_on_humanized = fields.String(
        description="Timestamp of the last modification in human readable form."
    )
    datasource = fields.String(description="Datasource identifier.")
    description = fields.String(description="Slice description.")
    description_markeddown = fields.String(
        description="Sanitized HTML version of the chart description."
    )
    edit_url = fields.String(description="The URL for editing the slice.")
    form_data = fields.Dict(description="Form data associated with the slice.")
    is_managed_externally = fields.Bool(
        description="If the chart is managed outside externally."
    )
    modified = fields.String(description="Last modification in human readable form.")
    owners = fields.List(fields.Integer(), description="Owners identifiers.")
    query_context = fields.Dict(description="The context associated with the query.")
    slice_id = fields.Integer(description="The slice ID.")
    slice_name = fields.String(description="The slice name.")
    slice_url = fields.String(description="The slice URL.")


class ExploreContextSchema(Schema):
    form_data = fields.Dict(
        description=(
            "Form data from the Explore controls used to form the "
            "chart's data query."
        )
    )
    dataset = fields.Nested(DatasetSchema)
    slice = fields.Nested(SliceSchema)
    message = fields.String(description="Any message related to the processed request.")
