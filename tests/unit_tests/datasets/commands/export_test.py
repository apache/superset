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
# pylint: disable=import-outside-toplevel, unused-argument, unused-import

from sqlalchemy.orm.session import Session

from superset import db
from superset.utils import json


def test_export(session: Session) -> None:
    """
    Test exporting a dataset.
    """
    from superset.commands.dataset.export import ExportDatasetsCommand
    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
    from superset.models.core import Database

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    columns = [
        TableColumn(column_name="ds", is_dttm=1, type="TIMESTAMP"),
        TableColumn(column_name="user_id", type="INTEGER"),
        TableColumn(column_name="revenue", type="INTEGER"),
        TableColumn(column_name="expenses", type="INTEGER"),
        TableColumn(
            column_name="profit",
            type="INTEGER",
            expression="revenue-expenses",
            extra=json.dumps({"certified_by": "User"}),
        ),
    ]
    metrics = [
        SqlMetric(
            metric_name="cnt",
            expression="COUNT(*)",
            extra=json.dumps({"warning_markdown": None}),
        ),
    ]

    sqla_table = SqlaTable(
        table_name="my_table",
        columns=columns,
        metrics=metrics,
        main_dttm_col="ds",
        database=database,
        offset=-8,
        description="This is the description",
        is_featured=1,
        cache_timeout=3600,
        catalog="public",
        schema="my_schema",
        sql=None,
        params=json.dumps(
            {
                "remote_id": 64,
                "database_name": "examples",
                "import_time": 1606677834,
            }
        ),
        perm=None,
        filter_select_enabled=1,
        fetch_values_predicate="foo IN (1, 2)",
        is_sqllab_view=0,  # no longer used?
        template_params=json.dumps({"answer": "42"}),
        schema_perm=None,
        normalize_columns=False,
        always_filter_main_dttm=False,
        extra=json.dumps({"warning_markdown": "*WARNING*"}),
    )

    export = [
        (file[0], file[1]())
        for file in list(
            ExportDatasetsCommand._export(sqla_table)  # pylint: disable=protected-access
        )
    ]

    payload = sqla_table.export_to_dict(
        recursive=True,
        include_parent_ref=False,
        include_defaults=True,
        export_uuids=True,
    )

    assert export == [
        (
            "datasets/my_database/my_table.yaml",
            f"""table_name: my_table
main_dttm_col: ds
description: This is the description
default_endpoint: null
offset: -8
cache_timeout: 3600
catalog: public
schema: my_schema
sql: null
params:
  remote_id: 64
  database_name: examples
  import_time: 1606677834
template_params:
  answer: '42'
filter_select_enabled: 1
fetch_values_predicate: foo IN (1, 2)
extra:
  warning_markdown: '*WARNING*'
normalize_columns: false
always_filter_main_dttm: false
uuid: {payload['uuid']}
metrics:
- metric_name: cnt
  verbose_name: null
  metric_type: null
  expression: COUNT(*)
  description: null
  d3format: null
  currency: null
  extra:
    warning_markdown: null
  warning_text: null
columns:
- column_name: profit
  verbose_name: null
  is_dttm: false
  is_active: true
  type: INTEGER
  advanced_data_type: null
  groupby: true
  filterable: true
  expression: revenue-expenses
  description: null
  python_date_format: null
  extra:
    certified_by: User
- column_name: ds
  verbose_name: null
  is_dttm: 1
  is_active: true
  type: TIMESTAMP
  advanced_data_type: null
  groupby: true
  filterable: true
  expression: null
  description: null
  python_date_format: null
  extra: null
- column_name: user_id
  verbose_name: null
  is_dttm: false
  is_active: true
  type: INTEGER
  advanced_data_type: null
  groupby: true
  filterable: true
  expression: null
  description: null
  python_date_format: null
  extra: null
- column_name: expenses
  verbose_name: null
  is_dttm: false
  is_active: true
  type: INTEGER
  advanced_data_type: null
  groupby: true
  filterable: true
  expression: null
  description: null
  python_date_format: null
  extra: null
- column_name: revenue
  verbose_name: null
  is_dttm: false
  is_active: true
  type: INTEGER
  advanced_data_type: null
  groupby: true
  filterable: true
  expression: null
  description: null
  python_date_format: null
  extra: null
version: 1.0.0
database_uuid: {database.uuid}
""",
        ),
        (
            "databases/my_database.yaml",
            f"""database_name: my_database
sqlalchemy_uri: sqlite://
cache_timeout: null
expose_in_sqllab: true
allow_run_async: false
allow_ctas: false
allow_cvas: false
allow_dml: false
allow_file_upload: false
extra:
  metadata_params: {{}}
  engine_params: {{}}
  metadata_cache_timeout: {{}}
  schemas_allowed_for_file_upload: []
impersonate_user: false
uuid: {database.uuid}
version: 1.0.0
""",
        ),
    ]
