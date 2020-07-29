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

database_schemas_query_schema = {
    "type": "object",
    "properties": {"force": {"type": "boolean"}},
}


class TableMetadataOptionsResponseSchema(Schema):
    deferrable = fields.Bool()
    initially = fields.Bool()
    match = fields.Bool()
    ondelete = fields.Bool()
    onupdate = fields.Bool()


class TableMetadataColumnsResponseSchema(Schema):
    keys = fields.List(fields.String(), description="")
    longType = fields.String(description="The actual backend long type for the column")
    name = fields.String(description="The column name")
    type = fields.String(description="The column type")
    duplicates_constraint = fields.String(required=False)


class TableMetadataForeignKeysIndexesResponseSchema(Schema):
    column_names = fields.List(
        fields.String(
            description="A list of column names that compose the foreign key or index"
        )
    )
    name = fields.String(description="The name of the foreign key or index")
    options = fields.Nested(TableMetadataOptionsResponseSchema)
    referred_columns = fields.List(fields.String())
    referred_schema = fields.String()
    referred_table = fields.String()
    type = fields.String()


class TableMetadataPrimaryKeyResponseSchema(Schema):
    column_names = fields.List(
        fields.String(description="A list of column names that compose the primary key")
    )
    name = fields.String(description="The primary key index name")
    type = fields.String()


class TableMetadataResponseSchema(Schema):
    name = fields.String(description="The name of the table")
    columns = fields.List(
        fields.Nested(TableMetadataColumnsResponseSchema),
        description="A list of columns and their metadata",
    )
    foreignKeys = fields.List(
        fields.Nested(TableMetadataForeignKeysIndexesResponseSchema),
        description="A list of foreign keys and their metadata",
    )
    indexes = fields.List(
        fields.Nested(TableMetadataForeignKeysIndexesResponseSchema),
        description="A list of indexes and their metadata",
    )
    primaryKey = fields.Nested(
        TableMetadataPrimaryKeyResponseSchema, description="Primary keys metadata"
    )
    selectStar = fields.String(description="SQL select star")


class SelectStarResponseSchema(Schema):
    result = fields.String(description="SQL select star")


class SchemasResponseSchema(Schema):
    result = fields.List(fields.String(description="A database schema name"))


class DatabaseSchemaObjectResponseSchema(Schema):
    value = fields.String(description="Schema name")
    text = fields.String(description="Schema display name")


class DatabaseSchemaResponseSchema(Schema):
    count = fields.Integer(description="The total number of schemas")
    result = fields.Nested(DatabaseSchemaObjectResponseSchema)
