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

from superset.databases.schemas import ImportV1DatabaseSchema

sql_lab_get_results_schema = {
    "type": "object",
    "properties": {
        "key": {"type": "string"},
    },
    "required": ["key"],
}


class EstimateQueryCostSchema(Schema):
    database_id = fields.Integer(
        required=True, metadata={"description": "The database id"}
    )
    sql = fields.String(
        required=True, metadata={"description": "The SQL query to estimate"}
    )
    template_params = fields.Dict(
        keys=fields.String(), metadata={"description": "The SQL query template params"}
    )
    schema = fields.String(
        allow_none=True, metadata={"description": "The database schema"}
    )


class FormatQueryPayloadSchema(Schema):
    sql = fields.String(required=True)


class ExecutePayloadSchema(Schema):
    database_id = fields.Integer(required=True)
    sql = fields.String(required=True)
    client_id = fields.String(allow_none=True)
    queryLimit = fields.Integer(allow_none=True)
    sql_editor_id = fields.String(allow_none=True)
    schema = fields.String(allow_none=True)
    tab = fields.String(allow_none=True)
    ctas_method = fields.String(allow_none=True)
    templateParams = fields.String(allow_none=True)
    tmp_table_name = fields.String(allow_none=True)
    select_as_cta = fields.Boolean(allow_none=True)
    json = fields.Boolean(allow_none=True)
    runAsync = fields.Boolean(allow_none=True)
    expand_data = fields.Boolean(allow_none=True)


class QueryResultSchema(Schema):
    changed_on = fields.DateTime()
    dbId = fields.Integer()
    db = fields.String()  # pylint: disable=invalid-name
    endDttm = fields.Float()
    errorMessage = fields.String(allow_none=True)
    executedSql = fields.String()
    id = fields.String()
    queryId = fields.Integer()
    limit = fields.Integer()
    limitingFactor = fields.String()
    progress = fields.Integer()
    rows = fields.Integer()
    schema = fields.String()
    ctas = fields.Boolean()
    serverId = fields.Integer()
    sql = fields.String()
    sqlEditorId = fields.String()
    startDttm = fields.Float()
    state = fields.String()
    tab = fields.String()
    tempSchema = fields.String(allow_none=True)
    tempTable = fields.String(allow_none=True)
    userId = fields.Integer()
    user = fields.String()
    resultsKey = fields.String()
    trackingUrl = fields.String(allow_none=True)
    extra = fields.Dict(keys=fields.String())


class QueryExecutionResponseSchema(Schema):
    status = fields.String()
    data = fields.List(fields.Dict())
    columns = fields.List(fields.Dict())
    selected_columns = fields.List(fields.Dict())
    expanded_columns = fields.List(fields.Dict())
    query = fields.Nested(QueryResultSchema)
    query_id = fields.Integer()


class TableSchema(Schema):
    database_id = fields.Integer()
    description = fields.String()
    expanded = fields.Boolean()
    id = fields.Integer()
    schema = fields.String()
    tab_state_id = fields.Integer()
    table = fields.String()


class TabStateSchema(Schema):
    active = fields.Boolean()
    autorun = fields.Boolean()
    database_id = fields.Integer()
    extra_json = fields.Dict()
    hide_left_bar = fields.Boolean()
    id = fields.String()
    label = fields.String()
    latest_query = fields.Nested(QueryResultSchema)
    query_limit = fields.Integer()
    saved_query = fields.Dict(
        allow_none=True,
        metadata={"id": "SavedQuery id"},
    )
    schema = fields.String()
    sql = fields.String()
    table_schemas = fields.List(fields.Nested(TableSchema))
    user_id = fields.Integer()


class SQLLabBootstrapSchema(Schema):
    active_tab = fields.Nested(TabStateSchema)
    databases = fields.Dict(
        keys=fields.String(
            metadata={"description": "Database id"},
        ),
        values=fields.Nested(ImportV1DatabaseSchema),
    )
    queries = fields.Dict(
        keys=fields.String(
            metadata={"description": "Query id"},
        ),
        values=fields.Nested(QueryResultSchema),
    )
    tab_state_ids = fields.List(fields.String())
