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
"""Marshmallow schemas for AI Assistant API."""

from marshmallow import fields, Schema


class GenerateSQLSchema(Schema):
    """Schema for SQL generation request."""

    dataset_id = fields.Integer(
        required=True,
        metadata={"description": "The ID of the dataset to query"},
    )
    user_query = fields.String(
        required=True,
        metadata={"description": "Natural language query from the user"},
    )


class GenerateSQLResponseSchema(Schema):
    """Schema for SQL generation response."""

    sql = fields.String(
        metadata={"description": "Generated SQL query"},
    )
    error = fields.String(
        metadata={"description": "Error message if generation failed"},
    )
