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
from marshmallow import fields, Schema


class FormDataPostSchema(Schema):
    dataset_id = fields.Integer(
        required=False, allow_none=True, description="The dataset ID"
    )
    chart_id = fields.Integer(required=False, description="The chart ID")
    form_data = fields.String(
        required=True, allow_none=False, description="Any type of JSON supported text."
    )

    """
    SIP - 68 Integration
    sl_type: enum for sl_types (Query:sl_query, Dataset: sl_dataset, SavedQuery: sl_saved_query, Table: sl_table)
    sl_id: index lookup id for given type(Query, Dataset, SavedQuery, Table) to look up
    """
    sl_id = fields.Integer(
        required=False, allow_none=True, description="SIP-68 semantic layer type"
    )
    sl_type = fields.String(
        required=False, allow_none=True, description="SIP-68 semantic layer id"
    )


class FormDataPutSchema(Schema):
    dataset_id = fields.Integer(
        required=True, allow_none=False, description="The dataset ID"
    )
    chart_id = fields.Integer(required=False, description="The chart ID")
    form_data = fields.String(
        required=True, allow_none=False, description="Any type of JSON supported text."
    )
