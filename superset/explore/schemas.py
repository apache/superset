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
    cache_timeout = fields.Int()
    column_formats = fields.Dict()
    columns = fields.List(fields.Dict())
    database = fields.Dict()
    datasource_name = fields.Str()
    default_endpoint = fields.Str()
    description = fields.Str()
    edit_url = fields.Str()
    extra = fields.Dict()
    fetch_values_predicate = fields.Str()
    filter_select = fields.Bool()
    filter_select_enabled = fields.Bool()
    granularity_sqla = fields.List(fields.List(fields.Dict()))
    health_check_message = fields.Str()
    id = fields.Int()
    is_sqllab_view = fields.Bool()
    main_dttm_col = fields.Str()
    metrics = fields.List(fields.Dict())
    name = fields.Str()
    offset = fields.Int()
    order_by_choices = fields.List(fields.List(fields.Str()))
    owners = fields.List(fields.Number)
    params = fields.Dict()
    perm = fields.Str()
    schema = fields.Str()
    select_star = fields.Str()
    sql = fields.Str()
    table_name = fields.Str()
    template_params = fields.Dict()
    time_grain_sqla = fields.List(fields.List(fields.Str()))
    type = fields.Str()
    uid = fields.Str()
    verbose_map = fields.Dict()


class SliceSchema(Schema):
    cache_timeout = fields.Int()
    certification_details = fields.Str()
    certified_by = fields.Str()
    changed_on = fields.Str()
    changed_on_humanized = fields.Str()
    datasource = fields.Str()
    description = fields.Str()
    description_markeddown = fields.Str()
    edit_url = fields.Str()
    form_data = fields.Dict()
    is_managed_externally = fields.Bool()
    modified = fields.Str()
    owners = fields.List(fields.Number)
    query_context = fields.Dict()
    slice_id = fields.Int()
    slice_name = fields.Str()
    slice_url = fields.Str()


class ExploreContextSchema(Schema):
    form_data = fields.Dict()
    dataset = fields.Nested(DatasetSchema)
    slice = fields.Nested(SliceSchema)
    message = fields.String()
