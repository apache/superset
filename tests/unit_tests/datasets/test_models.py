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

import json
from typing import Any, Callable, Dict, List, TYPE_CHECKING

from pytest_mock import MockFixture
from sqlalchemy.orm.session import Session

from tests.unit_tests.utils.db import get_test_user

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlMetric, TableColumn


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
        database=table.database,
        name="positions",
        expression="""
SELECT array_agg(array[longitude,latitude]) AS position
FROM my_catalog.my_schema.my_table
""",
        tables=[table],
        columns=[
            Column(
                name="position",
                expression="array_agg(array[longitude,latitude])",
            ),
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
        database=table.database,
        tables=[table],
        columns=[
            Column(
                name="position",
                expression="array_agg(array[longitude,latitude])",
            ),
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
        TableColumn(column_name="num_boys", type="INTEGER"),
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
        "owners",
        "params",
        "perm",
        "schema",
        "schema_perm",
        "sql",
        "table_name",
        "template_params",
        "uuid",
    ]


def test_create_physical_sqlatable(
    app_context: None,
    session: Session,
    sample_columns: Dict["TableColumn", Dict[str, Any]],
    sample_metrics: Dict["SqlMetric", Dict[str, Any]],
    columns_default: Dict[str, Any],
) -> None:
    """
    Test shadow write when creating a new ``SqlaTable``.

    When a new physical ``SqlaTable`` is created, new models should also be created for
    ``Dataset``, ``Table``, and ``Column``.
    """
    from superset.columns.models import Column
    from superset.columns.schemas import ColumnSchema
    from superset.connectors.sqla.models import SqlaTable
    from superset.datasets.models import Dataset
    from superset.datasets.schemas import DatasetSchema
    from superset.models.core import Database
    from superset.tables.models import Table
    from superset.tables.schemas import TableSchema

    engine = session.get_bind()
    Dataset.metadata.create_all(engine)  # pylint: disable=no-member
    user1 = get_test_user(1, "abc")
    columns = list(sample_columns.keys())
    metrics = list(sample_metrics.keys())
    expected_table_columns = list(sample_columns.values())
    expected_metric_columns = list(sample_metrics.values())

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
            {
                "remote_id": 64,
                "database_name": "examples",
                "import_time": 1606677834,
            }
        ),
        created_by=user1,
        changed_by=user1,
        owners=[user1],
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
    ignored_keys = {"created_on", "changed_on"}

    # check that columns were created
    column_schema = ColumnSchema()
    actual_columns = [
        {k: v for k, v in column_schema.dump(column).items() if k not in ignored_keys}
        for column in session.query(Column).all()
    ]
    num_physical_columns = len(
        [col for col in expected_table_columns if col.get("is_physical") == True]
    )
    num_dataset_table_columns = len(columns)
    num_dataset_metric_columns = len(metrics)
    assert (
        len(actual_columns)
        == num_physical_columns + num_dataset_table_columns + num_dataset_metric_columns
    )

    # table columns are created before dataset columns are created
    offset = 0
    for i in range(num_physical_columns):
        assert actual_columns[i + offset] == {
            **columns_default,
            **expected_table_columns[i],
            "id": i + offset + 1,
            # physical columns for table have its own uuid
            "uuid": actual_columns[i + offset]["uuid"],
            "is_physical": True,
            # table columns do not have creators
            "created_by": None,
            "tables": [1],
        }

    offset += num_physical_columns
    for i, column in enumerate(sqla_table.columns):
        assert actual_columns[i + offset] == {
            **columns_default,
            **expected_table_columns[i],
            "id": i + offset + 1,
            # columns for dataset reuses the same uuid of TableColumn
            "uuid": str(column.uuid),
            "datasets": [1],
        }

    offset += num_dataset_table_columns
    for i, metric in enumerate(sqla_table.metrics):
        assert actual_columns[i + offset] == {
            **columns_default,
            **expected_metric_columns[i],
            "id": i + offset + 1,
            "uuid": str(metric.uuid),
            "datasets": [1],
        }

    # check that table was created
    table_schema = TableSchema()
    tables = [
        {
            k: v
            for k, v in table_schema.dump(table).items()
            if k not in (ignored_keys | {"uuid"})
        }
        for table in session.query(Table).all()
    ]
    assert len(tables) == 1
    assert tables[0] == {
        "id": 1,
        "database": 1,
        "created_by": 1,
        "changed_by": 1,
        "datasets": [1],
        "columns": [1, 2, 3],
        "extra_json": "{}",
        "catalog": None,
        "schema": "my_schema",
        "name": "old_dataset",
        "is_managed_externally": False,
        "external_url": None,
    }

    # check that dataset was created
    dataset_schema = DatasetSchema()
    datasets = [
        {k: v for k, v in dataset_schema.dump(dataset).items() if k not in ignored_keys}
        for dataset in session.query(Dataset).all()
    ]
    assert len(datasets) == 1
    assert datasets[0] == {
        "id": 1,
        "uuid": str(sqla_table.uuid),
        "created_by": 1,
        "changed_by": 1,
        "owners": [1],
        "name": "old_dataset",
        "columns": [4, 5, 6, 7, 8, 9],
        "is_physical": True,
        "database": 1,
        "tables": [1],
        "extra_json": "{}",
        "expression": "old_dataset",
        "is_managed_externally": False,
        "external_url": None,
    }


def test_create_virtual_sqlatable(
    app_context: None,
    mocker: MockFixture,
    session: Session,
    sample_columns: Dict["TableColumn", Dict[str, Any]],
    sample_metrics: Dict["SqlMetric", Dict[str, Any]],
    columns_default: Dict[str, Any],
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
    from superset.connectors.sqla.models import SqlaTable
    from superset.datasets.models import Dataset
    from superset.datasets.schemas import DatasetSchema
    from superset.models.core import Database
    from superset.tables.models import Table

    engine = session.get_bind()
    Dataset.metadata.create_all(engine)  # pylint: disable=no-member
    user1 = get_test_user(1, "abc")
    physical_table_columns: List[Dict[str, Any]] = [
        dict(
            name="ds",
            is_temporal=True,
            type="TIMESTAMP",
            advanced_data_type=None,
            expression="ds",
            is_physical=True,
        ),
        dict(
            name="num_boys",
            type="INTEGER",
            advanced_data_type=None,
            expression="num_boys",
            is_physical=True,
        ),
        dict(
            name="revenue",
            type="INTEGER",
            advanced_data_type=None,
            expression="revenue",
            is_physical=True,
        ),
        dict(
            name="expenses",
            type="INTEGER",
            advanced_data_type=None,
            expression="expenses",
            is_physical=True,
        ),
    ]
    # create a physical ``Table`` that the virtual dataset points to
    database = Database(database_name="my_database", sqlalchemy_uri="sqlite://")
    table = Table(
        name="some_table",
        schema="my_schema",
        catalog=None,
        database=database,
        columns=[
            Column(**props, created_by=user1, changed_by=user1)
            for props in physical_table_columns
        ],
    )
    session.add(table)
    session.commit()

    assert session.query(Table).count() == 1
    assert session.query(Dataset).count() == 0

    # create virtual dataset
    columns = list(sample_columns.keys())
    metrics = list(sample_metrics.keys())
    expected_table_columns = list(sample_columns.values())
    expected_metric_columns = list(sample_metrics.values())

    sqla_table = SqlaTable(
        created_by=user1,
        changed_by=user1,
        owners=[user1],
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
  num_boys,
  revenue,
  expenses,
  revenue - expenses AS profit
FROM
  some_table""",
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
        extra=json.dumps({"warning_markdown": "*WARNING*"}),
    )
    session.add(sqla_table)
    session.flush()

    # should not add a new table
    assert session.query(Table).count() == 1
    assert session.query(Dataset).count() == 1

    # ignore these keys when comparing results
    ignored_keys = {"created_on", "changed_on"}
    column_schema = ColumnSchema()
    actual_columns = [
        {k: v for k, v in column_schema.dump(column).items() if k not in ignored_keys}
        for column in session.query(Column).all()
    ]
    num_physical_columns = len(physical_table_columns)
    num_dataset_table_columns = len(columns)
    num_dataset_metric_columns = len(metrics)
    assert (
        len(actual_columns)
        == num_physical_columns + num_dataset_table_columns + num_dataset_metric_columns
    )

    for i, column in enumerate(table.columns):
        assert actual_columns[i] == {
            **columns_default,
            **physical_table_columns[i],
            "id": i + 1,
            "uuid": str(column.uuid),
            "tables": [1],
        }

    offset = num_physical_columns
    for i, column in enumerate(sqla_table.columns):
        assert actual_columns[i + offset] == {
            **columns_default,
            **expected_table_columns[i],
            "id": i + offset + 1,
            "uuid": str(column.uuid),
            "is_physical": False,
            "datasets": [1],
        }

    offset = num_physical_columns + num_dataset_table_columns
    for i, metric in enumerate(sqla_table.metrics):
        assert actual_columns[i + offset] == {
            **columns_default,
            **expected_metric_columns[i],
            "id": i + offset + 1,
            "uuid": str(metric.uuid),
            "datasets": [1],
        }

    # check that dataset was created, and has a reference to the table
    dataset_schema = DatasetSchema()
    datasets = [
        {k: v for k, v in dataset_schema.dump(dataset).items() if k not in ignored_keys}
        for dataset in session.query(Dataset).all()
    ]
    assert len(datasets) == 1
    assert datasets[0] == {
        "id": 1,
        "database": 1,
        "uuid": str(sqla_table.uuid),
        "name": "old_dataset",
        "changed_by": 1,
        "created_by": 1,
        "owners": [1],
        "columns": [5, 6, 7, 8, 9, 10],
        "is_physical": False,
        "tables": [1],
        "extra_json": "{}",
        "external_url": None,
        "is_managed_externally": False,
        "expression": """
SELECT
  ds,
  num_boys,
  revenue,
  expenses,
  revenue - expenses AS profit
FROM
  some_table""",
    }


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

    assert session.query(Dataset).count() == 1
    assert session.query(Table).count() == 1
    assert session.query(Column).count() == 2

    session.delete(sqla_table)
    session.flush()

    # test that dataset and dataset columns are also deleted
    # but the physical table and table columns are kept
    assert session.query(Dataset).count() == 0
    assert session.query(Table).count() == 1
    assert session.query(Column).count() == 1


def test_update_physical_sqlatable_columns(
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

    assert session.query(Table).count() == 1
    assert session.query(Dataset).count() == 1
    assert session.query(Column).count() == 2  # 1 for table, 1 for dataset

    dataset = session.query(Dataset).one()
    assert len(dataset.columns) == 1

    # add a column to the original ``SqlaTable`` instance
    sqla_table.columns.append(TableColumn(column_name="num_boys", type="INTEGER"))
    session.flush()

    assert session.query(Column).count() == 3
    dataset = session.query(Dataset).one()
    assert len(dataset.columns) == 2

    # check that both lists have the same uuids
    assert [col.uuid for col in sqla_table.columns].sort() == [
        col.uuid for col in dataset.columns
    ].sort()

    # delete the column in the original instance
    sqla_table.columns = sqla_table.columns[1:]
    session.flush()

    # check that the column was added to the dataset and the added columns have
    # the correct uuid.
    assert session.query(TableColumn).count() == 1
    # the extra Dataset.column is deleted, but Table.column is kept
    assert session.query(Column).count() == 2

    # check that the column was also removed from the dataset
    dataset = session.query(Dataset).one()
    assert len(dataset.columns) == 1

    # modify the attribute in a column
    sqla_table.columns[0].is_dttm = True
    session.flush()

    # check that the dataset column was modified
    dataset = session.query(Dataset).one()
    assert dataset.columns[0].is_temporal is True


def test_update_physical_sqlatable_schema(
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

    new_dataset = session.query(Dataset).one()
    assert new_dataset.tables[0].schema == "new_schema"
    assert new_dataset.tables[0].id == 2


def test_update_physical_sqlatable_metrics(
    mocker: MockFixture,
    app_context: None,
    session: Session,
    get_session: Callable[[], Session],
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
    # 1 physical column for table + (1 column + 1 metric for datasets)
    assert session.query(Column).count() == 3

    column = session.query(Column).filter_by(is_physical=False).one()
    assert column.expression == "COUNT(*)"

    # change the metric definition
    sqla_table.metrics[0].expression = "MAX(ds)"
    session.flush()

    assert column.expression == "MAX(ds)"

    # in a new session, update new columns and metrics at the same time
    # reload the sqla_table so we can test the case that accessing an not already
    # loaded attribute (`sqla_table.metrics`) while there are updates on the instance
    # may trigger `after_update` before the attribute is loaded
    session = get_session()
    sqla_table = session.query(SqlaTable).filter(SqlaTable.id == sqla_table.id).one()
    sqla_table.columns.append(
        TableColumn(
            column_name="another_column",
            is_dttm=0,
            type="TIMESTAMP",
            expression="concat('a', 'b')",
        )
    )
    # Here `SqlaTable.after_update` is triggered
    # before `sqla_table.metrics` is loaded
    sqla_table.metrics.append(
        SqlMetric(metric_name="another_metric", expression="COUNT(*)")
    )
    # `SqlaTable.after_update` will trigger again at flushing
    session.flush()
    assert session.query(Column).count() == 5


def test_update_physical_sqlatable_database(
    mocker: MockFixture,
    app_context: None,
    session: Session,
    get_session: Callable[[], Session],
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
    from superset.datasets.models import Dataset, dataset_column_association_table
    from superset.models.core import Database
    from superset.tables.models import Table, table_column_association_table
    from superset.tables.schemas import TableSchema

    engine = session.get_bind()
    Dataset.metadata.create_all(engine)  # pylint: disable=no-member

    columns = [
        TableColumn(column_name="a", type="INTEGER"),
    ]

    original_database = Database(
        database_name="my_database", sqlalchemy_uri="sqlite://"
    )
    sqla_table = SqlaTable(
        table_name="original_table",
        columns=columns,
        metrics=[],
        database=original_database,
    )
    session.add(sqla_table)
    session.flush()

    assert session.query(Table).count() == 1
    assert session.query(Dataset).count() == 1
    assert session.query(Column).count() == 2  # 1 for table, 1 for dataset

    # check that the table was created, and that the created dataset points to it
    table = session.query(Table).one()
    assert table.id == 1
    assert table.name == "original_table"
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
    sqla_table.table_name = "new_table"
    session.flush()

    assert session.query(Dataset).count() == 1
    assert session.query(Table).count() == 2
    # <Column:id=1> is kept for the old table
    # <Column:id=2> is kept for the updated dataset
    # <Column:id=3> is created for the new table
    assert session.query(Column).count() == 3

    # ignore these keys when comparing results
    ignored_keys = {"created_on", "changed_on", "uuid"}

    # check that the old table still exists, and that the dataset points to the newly
    # created table, column and dataset
    table_schema = TableSchema()
    tables = [
        {k: v for k, v in table_schema.dump(table).items() if k not in ignored_keys}
        for table in session.query(Table).all()
    ]
    assert tables[0] == {
        "id": 1,
        "database": 1,
        "columns": [1],
        "datasets": [],
        "created_by": None,
        "changed_by": None,
        "extra_json": "{}",
        "catalog": None,
        "schema": None,
        "name": "original_table",
        "external_url": None,
        "is_managed_externally": False,
    }
    assert tables[1] == {
        "id": 2,
        "database": 2,
        "datasets": [1],
        "columns": [3],
        "created_by": None,
        "changed_by": None,
        "catalog": None,
        "schema": None,
        "name": "new_table",
        "is_managed_externally": False,
        "extra_json": "{}",
        "external_url": None,
    }

    # check that dataset now points to the new table
    assert dataset.tables[0].database_id == 2
    # and a new column is created
    assert len(dataset.columns) == 1
    assert dataset.columns[0].id == 2

    # point ``SqlaTable`` back
    sqla_table.database = original_database
    sqla_table.table_name = "original_table"
    session.flush()

    # should not create more table and datasets
    assert session.query(Dataset).count() == 1
    assert session.query(Table).count() == 2
    # <Column:id=1> is deleted for the old table
    # <Column:id=2> is kept for the updated dataset
    # <Column:id=3> is kept for the new table
    assert session.query(Column.id).order_by(Column.id).all() == [
        (1,),
        (2,),
        (3,),
    ]
    assert session.query(dataset_column_association_table).all() == [(1, 2)]
    assert session.query(table_column_association_table).all() == [(1, 1), (2, 3)]
    assert session.query(Dataset).filter_by(id=1).one().columns[0].id == 2
    assert session.query(Table).filter_by(id=2).one().columns[0].id == 3
    assert session.query(Table).filter_by(id=1).one().columns[0].id == 1

    # the dataset points back to the original table
    assert dataset.tables[0].database_id == 1
    assert dataset.tables[0].name == "original_table"

    # kept the original column
    assert dataset.columns[0].id == 2
    session.commit()
    session.close()

    # querying in a new session should still return the same result
    session = get_session()
    assert session.query(table_column_association_table).all() == [(1, 1), (2, 3)]


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
    dataset: Dataset = session.query(Dataset).one()
    assert dataset.tables == [table1]

    # change SQL
    sqla_table.sql = "SELECT a, b FROM table_a JOIN table_b"
    session.flush()

    # check that new dataset has both tables
    new_dataset: Dataset = session.query(Dataset).one()
    assert new_dataset.tables == [table1, table2]
    assert new_dataset.expression == "SELECT a, b FROM table_a JOIN table_b"

    # automatically add new referenced table
    sqla_table.sql = "SELECT a, b, c FROM table_a JOIN table_b JOIN table_c"
    session.flush()

    new_dataset = session.query(Dataset).one()
    assert len(new_dataset.tables) == 3
    assert new_dataset.tables[2].name == "table_c"


def test_quote_expressions(app_context: None, session: Session) -> None:
    """
    Test that expressions are quoted appropriately in columns and datasets.
    """
    from superset.connectors.sqla.models import SqlaTable, TableColumn
    from superset.datasets.models import Dataset
    from superset.models.core import Database

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
