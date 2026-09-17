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

from uuid import UUID

import yaml
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
        TableColumn(
            column_name="ds",
            is_dttm=1,
            type="TIMESTAMP",
            uuid=UUID("00000000-0000-0000-0000-000000000006"),
        ),
        TableColumn(
            column_name="user_id",
            type="INTEGER",
            uuid=UUID("00000000-0000-0000-0000-000000000007"),
        ),
        TableColumn(
            column_name="revenue",
            type="INTEGER",
            uuid=UUID("00000000-0000-0000-0000-000000000008"),
        ),
        TableColumn(
            column_name="expenses",
            type="INTEGER",
            uuid=UUID("00000000-0000-0000-0000-000000000009"),
        ),
        TableColumn(
            column_name="profit",
            type="INTEGER",
            expression="revenue-expenses",
            extra=json.dumps({"certified_by": "User"}),
            uuid=UUID("00000000-0000-0000-0000-000000000005"),
        ),
    ]
    metrics = [
        SqlMetric(
            metric_name="cnt",
            expression="COUNT(*)",
            extra=json.dumps({"warning_markdown": None}),
            uuid=UUID("00000000-0000-0000-0000-000000000004"),
        ),
    ]

    sqla_table = SqlaTable(
        table_name="my_table",
        columns=columns,
        metrics=metrics,
        folders=[
            {
                "uuid": "00000000-0000-0000-0000-000000000000",
                "type": "folder",
                "name": "Engineering",
                "children": [
                    {
                        "uuid": "00000000-0000-0000-0000-000000000001",
                        "type": "folder",
                        "name": "Core",
                        "children": [
                            {
                                "uuid": "00000000-0000-0000-0000-000000000004",
                                "type": "metric",
                                "name": "cnt",
                            },
                        ],
                    },
                ],
            },
            {
                "uuid": "00000000-0000-0000-0000-000000000002",
                "type": "folder",
                "name": "Sales",
                "children": [
                    {
                        "uuid": "00000000-0000-0000-0000-000000000003",
                        "type": "folder",
                        "name": "Core",
                        "children": [
                            {
                                "uuid": "00000000-0000-0000-0000-000000000005",
                                "type": "column",
                                "name": "profit",
                            },
                        ],
                    },
                ],
            },
        ],
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

    # Add the table to the session and flush to get an ID
    db.session.add(sqla_table)
    db.session.flush()

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
            f"datasets/my_database/my_table_{sqla_table.id}.yaml",
            f"""table_name: my_table
main_dttm_col: ds
currency_code_column: null
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
folders:
- uuid: 00000000-0000-0000-0000-000000000000
  type: folder
  name: Engineering
  children:
  - uuid: 00000000-0000-0000-0000-000000000001
    type: folder
    name: Core
    children:
    - uuid: 00000000-0000-0000-0000-000000000004
      type: metric
      name: cnt
- uuid: 00000000-0000-0000-0000-000000000002
  type: folder
  name: Sales
  children:
  - uuid: 00000000-0000-0000-0000-000000000003
    type: folder
    name: Core
    children:
    - uuid: 00000000-0000-0000-0000-000000000005
      type: column
      name: profit
uuid: {payload["uuid"]}
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
  uuid: 00000000-0000-0000-0000-000000000004
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
  datetime_format: null
  extra:
    certified_by: User
  uuid: 00000000-0000-0000-0000-000000000005
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
  datetime_format: null
  extra: null
  uuid: 00000000-0000-0000-0000-000000000006
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
  datetime_format: null
  extra: null
  uuid: 00000000-0000-0000-0000-000000000007
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
  datetime_format: null
  extra: null
  uuid: 00000000-0000-0000-0000-000000000008
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
  datetime_format: null
  extra: null
  uuid: 00000000-0000-0000-0000-000000000009
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
configuration_method: sqlalchemy_form
uuid: {database.uuid}
version: 1.0.0
""",
        ),
    ]


def test_export_database_bundle_includes_child_uuids(session: Session) -> None:
    """
    Datasets embedded in a *database* export must carry metric/column UUIDs.

    ``ExportDatabasesCommand`` reaches datasets through its own
    ``export_to_dict(recursive=True, export_uuids=True)`` call rather than
    through ``ExportDatasetsCommand``, so it needs its own coverage: without
    ``export_uuids`` being forwarded to the recursive child export, the
    ``datasets/`` files in a database bundle would drop the UUIDs that custom
    folder assignments reference.
    """
    from superset.commands.database.export import ExportDatabasesCommand
    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
    from superset.models.core import Database

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    metric_uuid = UUID("00000000-0000-0000-0000-0000000000f1")
    column_uuid = UUID("00000000-0000-0000-0000-0000000000f2")
    sqla_table = SqlaTable(
        table_name="my_table",
        database=database,
        metrics=[
            SqlMetric(metric_name="cnt", expression="COUNT(*)", uuid=metric_uuid),
        ],
        columns=[
            TableColumn(column_name="profit", type="INTEGER", uuid=column_uuid),
        ],
    )
    db.session.add(sqla_table)
    db.session.flush()

    contents = {
        path: content_fn()
        for path, content_fn in ExportDatabasesCommand._export(database)  # pylint: disable=protected-access
    }
    dataset_paths = [path for path in contents if path.startswith("datasets/")]
    assert len(dataset_paths) == 1

    payload = yaml.safe_load(contents[dataset_paths[0]])
    assert [metric["uuid"] for metric in payload["metrics"]] == [str(metric_uuid)]
    assert [column["uuid"] for column in payload["columns"]] == [str(column_uuid)]


def test_export_two_datasets_same_table_name_different_schema(
    session: Session,
) -> None:
    """
    Regression coverage for GitHub issue #16141.

    Exporting two datasets that share a `table_name` but live in
    different schemas (e.g. prod.users + dev.users) must produce two
    distinct entries in the export. Historically the pair could collide
    onto a single filename — the export filename is now disambiguated by
    dataset id, so this test pins that behavior so it can't silently
    regress.
    """
    from superset.commands.dataset.export import ExportDatasetsCommand
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database

    engine = db.session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    prod = SqlaTable(table_name="users", schema="prod", database=database)
    dev = SqlaTable(table_name="users", schema="dev", database=database)
    db.session.add_all([prod, dev])
    db.session.flush()

    paths: list[str] = []
    contents: list[str] = []
    for ds in (prod, dev):
        for path, content_fn in ExportDatasetsCommand._export(  # pylint: disable=protected-access
            ds, export_related=False
        ):
            paths.append(path)
            contents.append(content_fn())

    # Both datasets must produce distinct export paths — no collision.
    assert len(paths) == len(set(paths)), (
        f"Export filenames collided for same-table-name datasets: {paths}"
    )

    # And both YAML payloads must reflect their own schema, not be
    # silently merged or overwritten.
    schemas_in_yaml = {yaml.safe_load(c)["schema"] for c in contents}
    assert schemas_in_yaml == {"prod", "dev"}, (
        f"Expected both prod and dev schemas in export, got {schemas_in_yaml}"
    )
