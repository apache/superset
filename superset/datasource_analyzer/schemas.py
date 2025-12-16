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


class DatasourceAnalyzerPostSchema(Schema):
    """Schema for POST /api/v1/datasource_analyzer/"""

    database_id = fields.Integer(
        required=True,
        metadata={"description": "The ID of the database connection"},
    )
    schema_name = fields.String(
        required=True,
        metadata={"description": "The name of the schema to analyze"},
    )
    catalog_name = fields.String(
        required=False,
        load_default=None,
        metadata={"description": "The name of the catalog (optional)"},
    )


class DatasourceAnalyzerResponseSchema(Schema):
    """Schema for the response of POST /api/v1/datasource_analyzer/"""

    run_id = fields.String(
        metadata={"description": "The unique identifier for this analysis run"},
    )
