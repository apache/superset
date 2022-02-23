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

# pylint: disable=import-outside-toplevel, unused-argument, unused-import, too-many-locals, invalid-name, too-many-lines

import json
from datetime import datetime, timezone

from pytest_mock import MockFixture
from sqlalchemy.orm.session import Session


def test_dataset_model(app_context: None, session: Session) -> None:
    """
    Test basic attributes of a ``Dataset``.
    """
    from superset.columns.models import Column
    from superset.datasets.models import Dataset
    from superset.models.core import Database
    from superset.tables.models import Table

    engine = session.get_bind()
    Dataset.metadata.create_all(engine)  # pylint: disable=no-member

    table = Table(
        name="my_table",
        schema="my_schema",
        catalog="my_catalog",
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
        columns=[
            Column(name="longitude", expression="longitude"),
            Column(name="latitude", expression="latitude"),
        ],
    )
    session.add(table)
    session.flush()

    dataset = Dataset(
        name="positions",
        expression="""
SELECT array_agg(array[longitude,latitude]) AS position
FROM my_catalog.my_schema.my_table
""",
        tables=[table],
        columns=[
            Column(name="position", expression="array_agg(array[longitude,latitude])",),
        ],
    )
    session.add(dataset)
    session.flush()

    assert dataset.id == 1
    assert dataset.uuid is not None

    assert dataset.name == "positions"
    assert (
        dataset.expression
        == """
SELECT array_agg(array[longitude,latitude]) AS position
FROM my_catalog.my_schema.my_table
"""
    )

    assert [table.name for table in dataset.tables] == ["my_table"]
    assert [column.name for column in dataset.columns] == ["position"]


def test_cascade_delete_table(app_context: None, session: Session) -> None:
    """
    Test that deleting ``Table`` also deletes its columns.
    """
    from superset.columns.models import Column
    from superset.models.core import Database
    from superset.tables.models import Table

    engine = session.get_bind()
    Table.metadata.create_all(engine)  # pylint: disable=no-member

    table = Table(
        name="my_table",
        schema="my_schema",
        catalog="my_catalog",
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
        columns=[
            Column(name="longitude", expression="longitude"),
            Column(name="latitude", expression="latitude"),
        ],
    )
    session.add(table)
    session.flush()

    columns = session.query(Column).all()
    assert len(columns) == 2

    session.delete(table)
    session.flush()

    # test that columns were deleted
    columns = session.query(Column).all()
    assert len(columns) == 0


def test_cascade_delete_dataset(app_context: None, session: Session) -> None:
    """
    Test that deleting ``Dataset`` also deletes its columns.
    """
    from superset.columns.models import Column
    from superset.datasets.models import Dataset
    from superset.models.core import Database
    from superset.tables.models import Table

    engine = session.get_bind()
    Dataset.metadata.create_all(engine)  # pylint: disable=no-member

    table = Table(
        name="my_table",
        schema="my_schema",
        catalog="my_catalog",
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
        columns=[
            Column(name="longitude", expression="longitude"),
            Column(name="latitude", expression="latitude"),
        ],
    )
    session.add(table)
    session.flush()

    dataset = Dataset(
        name="positions",
        expression="""
SELECT array_agg(array[longitude,latitude]) AS position
FROM my_catalog.my_schema.my_table
""",
        tables=[table],
        columns=[
            Column(name="position", expression="array_agg(array[longitude,latitude])",),
        ],
    )
    session.add(dataset)
    session.flush()

    columns = session.query(Column).all()
    assert len(columns) == 3

    session.delete(dataset)
    session.flush()

    # test that dataset columns were deleted (but not table columns)
    columns = session.query(Column).all()
    assert len(columns) == 2


def test_dataset_attributes(app_context: None, session: Session) -> None:
    """
    Test that checks attributes in the dataset.

    If this check fails it means new attributes were added to ``SqlaTable``, and
    ``SqlaTable.after_insert`` should be updated to handle them!
    """
    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
    from superset.models.core import Database

    engine = session.get_bind()
    SqlaTable.metadata.create_all(engine)  # pylint: disable=no-member

    columns = [
        TableColumn(column_name="ds", is_dttm=1, type="TIMESTAMP"),
        TableColumn(column_name="user_id", type="INTEGER"),
        TableColumn(column_name="revenue", type="INTEGER"),
        TableColumn(column_name="expenses", type="INTEGER"),
        TableColumn(
            column_name="profit", type="INTEGER", expression="revenue-expenses"
        ),
    ]
    metrics = [
        SqlMetric(metric_name="cnt", expression="COUNT(*)"),
    ]

    sqla_table = SqlaTable(
        table_name="old_dataset",
        columns=columns,
        metrics=metrics,
        main_dttm_col="ds",
        default_endpoint="https://www.youtube.com/watch?v=dQw4w9WgXcQ",  # not used
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
        offset=-8,
        description="This is the description",
        is_featured=1,
        cache_timeout=3600,
        schema="my_schema",
        sql=None,
        params=json.dumps(
            {"remote_id": 64, "database_name": "examples", "import_time": 1606677834,}
        ),
        perm=None,
        filter_select_enabled=1,
        fetch_values_predicate="foo IN (1, 2)",
        is_sqllab_view=0,  # no longer used?
        template_params=json.dumps({"answer": "42"}),
        schema_perm=None,
        extra=json.dumps({"warning_markdown": "*WARNING*"}),
    )

    session.add(sqla_table)
    session.flush()

    dataset = session.query(SqlaTable).one()
    # If this test fails because attributes changed, make sure to update
    # ``SqlaTable.after_insert`` accordingly.
    assert sorted(dataset.__dict__.keys()) == [
        "_sa_instance_state",
        "cache_timeout",
        "changed_by_fk",
        "changed_on",
        "columns",
        "created_by_fk",
        "created_on",
        "database",
        "database_id",
        "default_endpoint",
        "description",
        "external_url",
        "extra",
        "fetch_values_predicate",
        "filter_select_enabled",
        "id",
        "is_featured",
        "is_managed_externally",
        "is_sqllab_view",
        "main_dttm_col",
        "metrics",
        "offset",
        "params",
        "perm",
        "schema",
        "schema_perm",
        "sql",
        "table_name",
        "template_params",
        "uuid",
    ]


def test_create_physical_sqlatable(app_context: None, session: Session) -> None:
    """
    Test shadow write when creating a new ``SqlaTable``.

    When a new physical ``SqlaTable`` is created, new models should also be created for
    ``Dataset``, ``Table``, and ``Column``.
    """
    from superset.columns.models import Column
    from superset.columns.schemas import ColumnSchema
    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
    from superset.datasets.models import Dataset
    from superset.datasets.schemas import DatasetSchema
    from superset.models.core import Database
    from superset.tables.models import Table
    from superset.tables.schemas import TableSchema

    engine = session.get_bind()
    Dataset.metadata.create_all(engine)  # pylint: disable=no-member

    columns = [
        TableColumn(column_name="ds", is_dttm=1, type="TIMESTAMP"),
        TableColumn(column_name="user_id", type="INTEGER"),
        TableColumn(column_name="revenue", type="INTEGER"),
        TableColumn(column_name="expenses", type="INTEGER"),
        TableColumn(
            column_name="profit", type="INTEGER", expression="revenue-expenses"
        ),
    ]
    metrics = [
        SqlMetric(metric_name="cnt", expression="COUNT(*)"),
    ]

    sqla_table = SqlaTable(
        table_name="old_dataset",
        columns=columns,
        metrics=metrics,
        main_dttm_col="ds",
        default_endpoint="https://www.youtube.com/watch?v=dQw4w9WgXcQ",  # not used
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
        offset=-8,
        description="This is the description",
        is_featured=1,
        cache_timeout=3600,
        schema="my_schema",
        sql=None,
        params=json.dumps(
            {"remote_id": 64, "database_name": "examples", "import_time": 1606677834,}
        ),
        perm=None,
        filter_select_enabled=1,
        fetch_values_predicate="foo IN (1, 2)",
        is_sqllab_view=0,  # no longer used?
        template_params=json.dumps({"answer": "42"}),
        schema_perm=None,
        extra=json.dumps({"warning_markdown": "*WARNING*"}),
    )
    session.add(sqla_table)
    session.flush()

    # ignore these keys when comparing results
    ignored_keys = {"created_on", "changed_on", "uuid"}

    # check that columns were created
    column_schema = ColumnSchema()
    column_schemas = [
        {k: v for k, v in column_schema.dump(column).items() if k not in ignored_keys}
        for column in session.query(Column).all()
    ]
    assert column_schemas == [
        {
            "changed_by": None,
            "created_by": None,
            "description": None,
            "expression": "ds",
            "extra_json": "{}",
            "id": 1,
            "is_increase_desired": True,
            "is_additive": False,
            "is_aggregation": False,
            "is_partition": False,
            "is_physical": True,
            "is_spatial": False,
            "is_temporal": True,
            "name": "ds",
            "type": "TIMESTAMP",
            "unit": None,
            "warning_text": None,
            "is_managed_externally": False,
            "external_url": None,
        },
        {
            "changed_by": None,
            "created_by": None,
            "description": None,
            "expression": "user_id",
            "extra_json": "{}",
            "id": 2,
            "is_increase_desired": True,
            "is_additive": False,
            "is_aggregation": False,
            "is_partition": False,
            "is_physical": True,
            "is_spatial": False,
            "is_temporal": False,
            "name": "user_id",
            "type": "INTEGER",
            "unit": None,
            "warning_text": None,
            "is_managed_externally": False,
            "external_url": None,
        },
        {
            "changed_by": None,
            "created_by": None,
            "description": None,
            "expression": "revenue",
            "extra_json": "{}",
            "id": 3,
            "is_increase_desired": True,
            "is_additive": False,
            "is_aggregation": False,
            "is_partition": False,
            "is_physical": True,
            "is_spatial": False,
            "is_temporal": False,
            "name": "revenue",
            "type": "INTEGER",
            "unit": None,
            "warning_text": None,
            "is_managed_externally": False,
            "external_url": None,
        },
        {
            "changed_by": None,
            "created_by": None,
            "description": None,
            "expression": "expenses",
            "extra_json": "{}",
            "id": 4,
            "is_increase_desired": True,
            "is_additive": False,
            "is_aggregation": False,
            "is_partition": False,
            "is_physical": True,
            "is_spatial": False,
            "is_temporal": False,
            "name": "expenses",
            "type": "INTEGER",
            "unit": None,
            "warning_text": None,
            "is_managed_externally": False,
            "external_url": None,
        },
        {
            "changed_by": None,
            "created_by": None,
            "description": None,
            "expression": "revenue-expenses",
            "extra_json": "{}",
            "id": 5,
            "is_increase_desired": True,
            "is_additive": False,
            "is_aggregation": False,
            "is_partition": False,
            "is_physical": False,
            "is_spatial": False,
            "is_temporal": False,
            "name": "profit",
            "type": "INTEGER",
            "unit": None,
            "warning_text": None,
            "is_managed_externally": False,
            "external_url": None,
        },
        {
            "changed_by": None,
            "created_by": None,
            "description": None,
            "expression": "COUNT(*)",
            "extra_json": "{}",
            "id": 6,
            "is_increase_desired": True,
            "is_additive": False,
            "is_aggregation": True,
            "is_partition": False,
            "is_physical": False,
            "is_spatial": False,
            "is_temporal": False,
            "name": "cnt",
            "type": "Unknown",
            "unit": None,
            "warning_text": None,
            "is_managed_externally": False,
            "external_url": None,
        },
    ]

    # check that table was created
    table_schema = TableSchema()
    tables = [
        {k: v for k, v in table_schema.dump(table).items() if k not in ignored_keys}
        for table in session.query(Table).all()
    ]
    assert tables == [
        {
            "extra_json": "{}",
            "catalog": None,
            "schema": "my_schema",
            "name": "old_dataset",
            "id": 1,
            "database": 1,
            "columns": [1, 2, 3, 4],
            "created_by": None,
            "changed_by": None,
            "is_managed_externally": False,
            "external_url": None,
        }
    ]

    # check that dataset was created
    dataset_schema = DatasetSchema()
    datasets = [
        {k: v for k, v in dataset_schema.dump(dataset).items() if k not in ignored_keys}
        for dataset in session.query(Dataset).all()
    ]
    assert datasets == [
        {
            "id": 1,
            "sqlatable_id": 1,
            "name": "old_dataset",
            "changed_by": None,
            "created_by": None,
            "columns": [1, 2, 3, 4, 5, 6],
            "is_physical": True,
            "tables": [1],
            "extra_json": "{}",
            "expression": "old_dataset",
            "is_managed_externally": False,
            "external_url": None,
        }
    ]


def test_create_virtual_sqlatable(
    mocker: MockFixture, app_context: None, session: Session
) -> None:
    """
    Test shadow write when creating a new ``SqlaTable``.

    When a new virtual ``SqlaTable`` is created, new models should also be created for
    ``Dataset`` and ``Column``.
    """
    # patch session
    mocker.patch(
        "superset.security.SupersetSecurityManager.get_session", return_value=session
    )

    from superset.columns.models import Column
    from superset.columns.schemas import ColumnSchema
    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
    from superset.datasets.models import Dataset
    from superset.datasets.schemas import DatasetSchema
    from superset.models.core import Database
    from superset.tables.models import Table

    engine = session.get_bind()
    Dataset.metadata.create_all(engine)  # pylint: disable=no-member

    # create the ``Table`` that the virtual dataset points to
    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    table = Table(
        name="some_table",
        schema="my_schema",
        catalog=None,
        database=database,
        columns=[
            Column(name="ds", is_temporal=True, type="TIMESTAMP"),
            Column(name="user_id", type="INTEGER"),
            Column(name="revenue", type="INTEGER"),
            Column(name="expenses", type="INTEGER"),
        ],
    )
    session.add(table)
    session.commit()

    # create virtual dataset
    columns = [
        TableColumn(column_name="ds", is_dttm=1, type="TIMESTAMP"),
        TableColumn(column_name="user_id", type="INTEGER"),
        TableColumn(column_name="revenue", type="INTEGER"),
        TableColumn(column_name="expenses", type="INTEGER"),
        TableColumn(
            column_name="profit", type="INTEGER", expression="revenue-expenses"
        ),
    ]
    metrics = [
        SqlMetric(metric_name="cnt", expression="COUNT(*)"),
    ]

    sqla_table = SqlaTable(
        table_name="old_dataset",
        columns=columns,
        metrics=metrics,
        main_dttm_col="ds",
        default_endpoint="https://www.youtube.com/watch?v=dQw4w9WgXcQ",  # not used
        database=database,
        offset=-8,
        description="This is the description",
        is_featured=1,
        cache_timeout=3600,
        schema="my_schema",
        sql="""
SELECT
  ds,
  user_id,
  revenue,
  expenses,
  revenue - expenses AS profit
FROM
  some_table""",
        params=json.dumps(
            {"remote_id": 64, "database_name": "examples", "import_time": 1606677834,}
        ),
        perm=None,
        filter_select_enabled=1,
        fetch_values_predicate="foo IN (1, 2)",
        is_sqllab_view=0,  # no longer used?
        template_params=json.dumps({"answer": "42"}),
        schema_perm=None,
        extra=json.dumps({"warning_markdown": "*WARNING*"}),
    )
    session.add(sqla_table)
    session.flush()

    # ignore these keys when comparing results
    ignored_keys = {"created_on", "changed_on", "uuid"}

    # check that columns were created
    column_schema = ColumnSchema()
    column_schemas = [
        {k: v for k, v in column_schema.dump(column).items() if k not in ignored_keys}
        for column in session.query(Column).all()
    ]
    assert column_schemas == [
        {
            "type": "TIMESTAMP",
            "is_additive": False,
            "extra_json": "{}",
            "is_partition": False,
            "expression": None,
            "unit": None,
            "warning_text": None,
            "created_by": None,
            "is_increase_desired": True,
            "description": None,
            "is_spatial": False,
            "name": "ds",
            "is_physical": True,
            "changed_by": None,
            "is_temporal": True,
            "id": 1,
            "is_aggregation": False,
            "external_url": None,
            "is_managed_externally": False,
        },
        {
            "type": "INTEGER",
            "is_additive": False,
            "extra_json": "{}",
            "is_partition": False,
            "expression": None,
            "unit": None,
            "warning_text": None,
            "created_by": None,
            "is_increase_desired": True,
            "description": None,
            "is_spatial": False,
            "name": "user_id",
            "is_physical": True,
            "changed_by": None,
            "is_temporal": False,
            "id": 2,
            "is_aggregation": False,
            "external_url": None,
            "is_managed_externally": False,
        },
        {
            "type": "INTEGER",
            "is_additive": False,
            "extra_json": "{}",
            "is_partition": False,
            "expression": None,
            "unit": None,
            "warning_text": None,
            "created_by": None,
            "is_increase_desired": True,
            "description": None,
            "is_spatial": False,
            "name": "revenue",
            "is_physical": True,
            "changed_by": None,
            "is_temporal": False,
            "id": 3,
            "is_aggregation": False,
            "external_url": None,
            "is_managed_externally": False,
        },
        {
            "type": "INTEGER",
            "is_additive": False,
            "extra_json": "{}",
            "is_partition": False,
            "expression": None,
            "unit": None,
            "warning_text": None,
            "created_by": None,
            "is_increase_desired": True,
            "description": None,
            "is_spatial": False,
            "name": "expenses",
            "is_physical": True,
            "changed_by": None,
            "is_temporal": False,
            "id": 4,
            "is_aggregation": False,
            "external_url": None,
            "is_managed_externally": False,
        },
        {
            "type": "TIMESTAMP",
            "is_additive": False,
            "extra_json": "{}",
            "is_partition": False,
            "expression": "ds",
            "unit": None,
            "warning_text": None,
            "created_by": None,
            "is_increase_desired": True,
            "description": None,
            "is_spatial": False,
            "name": "ds",
            "is_physical": False,
            "changed_by": None,
            "is_temporal": True,
            "id": 5,
            "is_aggregation": False,
            "external_url": None,
            "is_managed_externally": False,
        },
        {
            "type": "INTEGER",
            "is_additive": False,
            "extra_json": "{}",
            "is_partition": False,
            "expression": "user_id",
            "unit": None,
            "warning_text": None,
            "created_by": None,
            "is_increase_desired": True,
            "description": None,
            "is_spatial": False,
            "name": "user_id",
            "is_physical": False,
            "changed_by": None,
            "is_temporal": False,
            "id": 6,
            "is_aggregation": False,
            "external_url": None,
            "is_managed_externally": False,
        },
        {
            "type": "INTEGER",
            "is_additive": False,
            "extra_json": "{}",
            "is_partition": False,
            "expression": "revenue",
            "unit": None,
            "warning_text": None,
            "created_by": None,
            "is_increase_desired": True,
            "description": None,
            "is_spatial": False,
            "name": "revenue",
            "is_physical": False,
            "changed_by": None,
            "is_temporal": False,
            "id": 7,
            "is_aggregation": False,
            "external_url": None,
            "is_managed_externally": False,
        },
        {
            "type": "INTEGER",
            "is_additive": False,
            "extra_json": "{}",
            "is_partition": False,
            "expression": "expenses",
            "unit": None,
            "warning_text": None,
            "created_by": None,
            "is_increase_desired": True,
            "description": None,
            "is_spatial": False,
            "name": "expenses",
            "is_physical": False,
            "changed_by": None,
            "is_temporal": False,
            "id": 8,
            "is_aggregation": False,
            "external_url": None,
            "is_managed_externally": False,
        },
        {
            "type": "INTEGER",
            "is_additive": False,
            "extra_json": "{}",
            "is_partition": False,
            "expression": "revenue-expenses",
            "unit": None,
            "warning_text": None,
            "created_by": None,
            "is_increase_desired": True,
            "description": None,
            "is_spatial": False,
            "name": "profit",
            "is_physical": False,
            "changed_by": None,
            "is_temporal": False,
            "id": 9,
            "is_aggregation": False,
            "external_url": None,
            "is_managed_externally": False,
        },
        {
            "type": "Unknown",
            "is_additive": False,
            "extra_json": "{}",
            "is_partition": False,
            "expression": "COUNT(*)",
            "unit": None,
            "warning_text": None,
            "created_by": None,
            "is_increase_desired": True,
            "description": None,
            "is_spatial": False,
            "name": "cnt",
            "is_physical": False,
            "changed_by": None,
            "is_temporal": False,
            "id": 10,
            "is_aggregation": True,
            "external_url": None,
            "is_managed_externally": False,
        },
    ]

    # check that dataset was created, and has a reference to the table
    dataset_schema = DatasetSchema()
    datasets = [
        {k: v for k, v in dataset_schema.dump(dataset).items() if k not in ignored_keys}
        for dataset in session.query(Dataset).all()
    ]
    assert datasets == [
        {
            "id": 1,
            "sqlatable_id": 1,
            "name": "old_dataset",
            "changed_by": None,
            "created_by": None,
            "columns": [5, 6, 7, 8, 9, 10],
            "is_physical": False,
            "tables": [1],
            "extra_json": "{}",
            "external_url": None,
            "is_managed_externally": False,
            "expression": """
SELECT
  ds,
  user_id,
  revenue,
  expenses,
  revenue - expenses AS profit
FROM
  some_table""",
        }
    ]


def test_delete_sqlatable(app_context: None, session: Session) -> None:
    """
    Test that deleting a ``SqlaTable`` also deletes the corresponding ``Dataset``.
    """
    from superset.columns.models import Column
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.datasets.models import Dataset
    from superset.models.core import Database
    from superset.tables.models import Table

    engine = session.get_bind()
    Dataset.metadata.create_all(engine)  # pylint: disable=no-member

    columns = [
        TableColumn(column_name="ds", is_dttm=1, type="TIMESTAMP"),
    ]
    sqla_table = SqlaTable(
        table_name="old_dataset",
        columns=columns,
        metrics=[],
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
    )
    session.add(sqla_table)
    session.flush()

    datasets = session.query(Dataset).all()
    assert len(datasets) == 1

    session.delete(sqla_table)
    session.flush()

    # test that dataset was also deleted
    datasets = session.query(Dataset).all()
    assert len(datasets) == 0


def test_update_sqlatable(
    mocker: MockFixture, app_context: None, session: Session
) -> None:
    """
    Test that updating a ``SqlaTable`` also updates the corresponding ``Dataset``.
    """
    # patch session
    mocker.patch(
        "superset.security.SupersetSecurityManager.get_session", return_value=session
    )

    from superset.columns.models import Column
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.datasets.models import Dataset
    from superset.models.core import Database
    from superset.tables.models import Table

    engine = session.get_bind()
    Dataset.metadata.create_all(engine)  # pylint: disable=no-member

    columns = [
        TableColumn(column_name="ds", is_dttm=1, type="TIMESTAMP"),
    ]
    sqla_table = SqlaTable(
        table_name="old_dataset",
        columns=columns,
        metrics=[],
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
    )
    session.add(sqla_table)
    session.flush()

    dataset = session.query(Dataset).one()
    assert len(dataset.columns) == 1

    # add a column to the original ``SqlaTable`` instance
    sqla_table.columns.append(TableColumn(column_name="user_id", type="INTEGER"))
    session.flush()

    # check that the column was added to the dataset
    dataset = session.query(Dataset).one()
    assert len(dataset.columns) == 2

    # delete the column in the original instance
    sqla_table.columns = sqla_table.columns[1:]
    session.flush()

    # check that the column was also removed from the dataset
    dataset = session.query(Dataset).one()
    assert len(dataset.columns) == 1

    # modify the attribute in a column
    sqla_table.columns[0].is_dttm = True
    session.flush()

    # check that the dataset column was modified
    dataset = session.query(Dataset).one()
    assert dataset.columns[0].is_temporal is True


def test_update_sqlatable_schema(
    mocker: MockFixture, app_context: None, session: Session
) -> None:
    """
    Test that updating a ``SqlaTable`` schema also updates the corresponding ``Dataset``.
    """
    # patch session
    mocker.patch(
        "superset.security.SupersetSecurityManager.get_session", return_value=session
    )
    mocker.patch("superset.datasets.dao.db.session", session)

    from superset.columns.models import Column
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.datasets.models import Dataset
    from superset.models.core import Database
    from superset.tables.models import Table

    engine = session.get_bind()
    Dataset.metadata.create_all(engine)  # pylint: disable=no-member

    columns = [
        TableColumn(column_name="ds", is_dttm=1, type="TIMESTAMP"),
    ]
    sqla_table = SqlaTable(
        table_name="old_dataset",
        schema="old_schema",
        columns=columns,
        metrics=[],
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
    )
    session.add(sqla_table)
    session.flush()

    dataset = session.query(Dataset).one()
    assert dataset.tables[0].schema == "old_schema"
    assert dataset.tables[0].id == 1

    sqla_table.schema = "new_schema"
    session.flush()

    dataset = session.query(Dataset).one()
    assert dataset.tables[0].schema == "new_schema"
    assert dataset.tables[0].id == 2


def test_update_sqlatable_metric(
    mocker: MockFixture, app_context: None, session: Session
) -> None:
    """
    Test that updating a ``SqlaTable`` also updates the corresponding ``Dataset``.

    For this test we check that updating the SQL expression in a metric belonging to a
    ``SqlaTable`` is reflected in the ``Dataset`` metric.
    """
    # patch session
    mocker.patch(
        "superset.security.SupersetSecurityManager.get_session", return_value=session
    )

    from superset.columns.models import Column
    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
    from superset.datasets.models import Dataset
    from superset.models.core import Database
    from superset.tables.models import Table

    engine = session.get_bind()
    Dataset.metadata.create_all(engine)  # pylint: disable=no-member

    columns = [
        TableColumn(column_name="ds", is_dttm=1, type="TIMESTAMP"),
    ]
    metrics = [
        SqlMetric(metric_name="cnt", expression="COUNT(*)"),
    ]
    sqla_table = SqlaTable(
        table_name="old_dataset",
        columns=columns,
        metrics=metrics,
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
    )
    session.add(sqla_table)
    session.flush()

    # check that the metric was created
    column = session.query(Column).filter_by(is_physical=False).one()
    assert column.expression == "COUNT(*)"

    # change the metric definition
    sqla_table.metrics[0].expression = "MAX(ds)"
    session.flush()

    assert column.expression == "MAX(ds)"


def test_update_virtual_sqlatable_references(
    mocker: MockFixture, app_context: None, session: Session
) -> None:
    """
    Test that changing the SQL of a virtual ``SqlaTable`` updates ``Dataset``.

    When the SQL is modified the list of referenced tables should be updated in the new
    ``Dataset`` model.
    """
    # patch session
    mocker.patch(
        "superset.security.SupersetSecurityManager.get_session", return_value=session
    )

    from superset.columns.models import Column
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.datasets.models import Dataset
    from superset.models.core import Database
    from superset.tables.models import Table

    engine = session.get_bind()
    Dataset.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    table1 = Table(
        name="table_a",
        schema="my_schema",
        catalog=None,
        database=database,
        columns=[Column(name="a", type="INTEGER")],
    )
    table2 = Table(
        name="table_b",
        schema="my_schema",
        catalog=None,
        database=database,
        columns=[Column(name="b", type="INTEGER")],
    )
    session.add(table1)
    session.add(table2)
    session.commit()

    # create virtual dataset
    columns = [TableColumn(column_name="a", type="INTEGER")]

    sqla_table = SqlaTable(
        table_name="old_dataset",
        columns=columns,
        database=database,
        schema="my_schema",
        sql="SELECT a FROM table_a",
    )
    session.add(sqla_table)
    session.flush()

    # check that new dataset has table1
    dataset = session.query(Dataset).one()
    assert dataset.tables == [table1]

    # change SQL
    sqla_table.sql = "SELECT a, b FROM table_a JOIN table_b"
    session.flush()

    # check that new dataset has both tables
    dataset = session.query(Dataset).one()
    assert dataset.tables == [table1, table2]
    assert dataset.expression == "SELECT a, b FROM table_a JOIN table_b"


def test_quote_expressions(app_context: None, session: Session) -> None:
    """
    Test that expressions are quoted appropriately in columns and datasets.
    """
    from superset.columns.models import Column
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.datasets.models import Dataset
    from superset.models.core import Database
    from superset.tables.models import Table

    engine = session.get_bind()
    Dataset.metadata.create_all(engine)  # pylint: disable=no-member

    columns = [
        TableColumn(column_name="has space", type="INTEGER"),
        TableColumn(column_name="no_need", type="INTEGER"),
    ]

    sqla_table = SqlaTable(
        table_name="old dataset",
        columns=columns,
        metrics=[],
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
    )
    session.add(sqla_table)
    session.flush()

    dataset = session.query(Dataset).one()
    assert dataset.expression == '"old dataset"'
    assert dataset.columns[0].expression == '"has space"'
    assert dataset.columns[1].expression == "no_need"


def test_update_physical_sqlatable(
    mocker: MockFixture, app_context: None, session: Session
) -> None:
    """
    Test updating the table on a physical dataset.

    When updating the table on a physical dataset by pointing it somewhere else (change
    in database ID, schema, or table name) we should point the ``Dataset`` to an
    existing ``Table`` if possible, and create a new one otherwise.
    """
    # patch session
    mocker.patch(
        "superset.security.SupersetSecurityManager.get_session", return_value=session
    )
    mocker.patch("superset.datasets.dao.db.session", session)

    from superset.columns.models import Column
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.datasets.models import Dataset
    from superset.models.core import Database
    from superset.tables.models import Table
    from superset.tables.schemas import TableSchema

    engine = session.get_bind()
    Dataset.metadata.create_all(engine)  # pylint: disable=no-member

    columns = [
        TableColumn(column_name="a", type="INTEGER"),
    ]

    sqla_table = SqlaTable(
        table_name="old_dataset",
        columns=columns,
        metrics=[],
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
    )
    session.add(sqla_table)
    session.flush()

    # check that the table was created, and that the created dataset points to it
    table = session.query(Table).one()
    assert table.id == 1
    assert table.name == "old_dataset"
    assert table.schema is None
    assert table.database_id == 1

    dataset = session.query(Dataset).one()
    assert dataset.tables == [table]

    # point ``SqlaTable`` to a different database
    new_database = Database(
        database_name="my_other_database", sqlalchemy_uri="sqlite://"
    )
    session.add(new_database)
    session.flush()
    sqla_table.database = new_database
    session.flush()

    # ignore these keys when comparing results
    ignored_keys = {"created_on", "changed_on", "uuid"}

    # check that the old table still exists, and that the dataset points to the newly
    # created table (id=2) and column (id=2), on the new database (also id=2)
    table_schema = TableSchema()
    tables = [
        {k: v for k, v in table_schema.dump(table).items() if k not in ignored_keys}
        for table in session.query(Table).all()
    ]
    assert tables == [
        {
            "created_by": None,
            "extra_json": "{}",
            "name": "old_dataset",
            "changed_by": None,
            "catalog": None,
            "columns": [1],
            "database": 1,
            "external_url": None,
            "schema": None,
            "id": 1,
            "is_managed_externally": False,
        },
        {
            "created_by": None,
            "extra_json": "{}",
            "name": "old_dataset",
            "changed_by": None,
            "catalog": None,
            "columns": [2],
            "database": 2,
            "external_url": None,
            "schema": None,
            "id": 2,
            "is_managed_externally": False,
        },
    ]

    # check that dataset now points to the new table
    assert dataset.tables[0].database_id == 2

    # point ``SqlaTable`` back
    sqla_table.database_id = 1
    session.flush()

    # check that dataset points to the original table
    assert dataset.tables[0].database_id == 1
