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
from typing import Any

from marshmallow import fields, post_load, Schema
from typing_extensions import TypedDict


class ExternalMetadataParams(TypedDict):
    datasource_type: str
    database_name: str
    schema_name: str
    table_name: str


get_external_metadata_schema = {
    "datasource_type": "string",
    "database_name": "string",
    "schema_name": "string",
    "table_name": "string",
}


class ExternalMetadataSchema(Schema):
    datasource_type = fields.Str(required=True)
    database_name = fields.Str(required=True)
    schema_name = fields.Str(allow_none=True)
    table_name = fields.Str(required=True)

    # pylint: disable=no-self-use,unused-argument
    @post_load
    def normalize(
        self,
        data: ExternalMetadataParams,
        **kwargs: Any,
    ) -> ExternalMetadataParams:
        return ExternalMetadataParams(
            datasource_type=data["datasource_type"],
            database_name=data["database_name"],
            schema_name=data.get("schema_name", ""),
            table_name=data["table_name"],
        )
