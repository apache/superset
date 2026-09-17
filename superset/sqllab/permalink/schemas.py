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


class SqlLabPermalinkSchema(Schema):
    autorun = fields.Boolean()
    dbId = fields.Integer(  # noqa: N815
        required=True,
        allow_none=False,
        metadata={"description": "The id of the database"},
    )
    name = fields.String(
        required=True,
        allow_none=False,
        metadata={"description": "The label of the editor tab"},
    )
    schema = fields.String(
        required=False,
        allow_none=True,
        metadata={"description": "The schema name of the query"},
    )
    catalog = fields.String(
        required=False,
        allow_none=True,
        metadata={"description": "The catalog name of the query"},
    )
    sql = fields.String(
        required=True,
        allow_none=False,
        metadata={"description": "SQL query text"},
    )
    templateParams = fields.String(  # noqa: N815
        required=False,
        allow_none=True,
        metadata={"description": "stringfied JSON string for template parameters"},
    )
