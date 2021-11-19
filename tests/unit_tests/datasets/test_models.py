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

import json
from datetime import datetime, timezone

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
        database=Database(database_name="my_database", sqlalchemy_uri="test://"),
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
        database=Database(database_name="my_database", sqlalchemy_uri="test://"),
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
    session.commit()

    dataset = session.query(SqlaTable).one()
    assert sorted(dataset.__dict__.keys()) == [
        "_sa_instance_state",
        "cache_timeout",
        "changed_by_fk",
        "changed_on",
        "created_by_fk",
        "created_on",
        "database_id",
        "default_endpoint",
        "description",
        "extra",
        "fetch_values_predicate",
        "filter_select_enabled",
        "id",
        "is_featured",
        "is_sqllab_view",
        "main_dttm_col",
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

    This should create new models in ``Dataset``, ``Table``, and ``Column``.
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
        database=Database(database_name="my_database", sqlalchemy_uri="test://"),
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
            "name": "ds",
            "extra_json": "{}",
            "is_partition": False,
            "increase_good": True,
            "units": None,
            "warning_text": None,
            "is_aggregation": False,
            "is_spatial": False,
            "description": None,
            "is_additive": False,
            "is_temporal": True,
            "expression": "ds",
            "id": 1,
            "type": "TIMESTAMP",
            "created_by": None,
            "changed_by": None,
        },
        {
            "name": "user_id",
            "extra_json": "{}",
            "is_partition": False,
            "increase_good": True,
            "units": None,
            "warning_text": None,
            "is_aggregation": False,
            "is_spatial": False,
            "description": None,
            "is_additive": False,
            "is_temporal": False,
            "expression": "user_id",
            "id": 2,
            "type": "INTEGER",
            "created_by": None,
            "changed_by": None,
        },
        {
            "name": "revenue",
            "extra_json": "{}",
            "is_partition": False,
            "increase_good": True,
            "units": None,
            "warning_text": None,
            "is_aggregation": False,
            "is_spatial": False,
            "description": None,
            "is_additive": False,
            "is_temporal": False,
            "expression": "revenue",
            "id": 3,
            "type": "INTEGER",
            "created_by": None,
            "changed_by": None,
        },
        {
            "name": "expenses",
            "extra_json": "{}",
            "is_partition": False,
            "increase_good": True,
            "units": None,
            "warning_text": None,
            "is_aggregation": False,
            "is_spatial": False,
            "description": None,
            "is_additive": False,
            "is_temporal": False,
            "expression": "expenses",
            "id": 4,
            "type": "INTEGER",
            "created_by": None,
            "changed_by": None,
        },
        {
            "name": "profit",
            "extra_json": "{}",
            "is_partition": False,
            "increase_good": True,
            "units": None,
            "warning_text": None,
            "is_aggregation": False,
            "is_spatial": False,
            "description": None,
            "is_additive": False,
            "is_temporal": False,
            "expression": "revenue-expenses",
            "id": 5,
            "type": "INTEGER",
            "created_by": None,
            "changed_by": None,
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
            "name": "old_dataset",
            "changed_by": None,
            "created_by": None,
            "columns": [1, 2, 3, 4, 5],
            "is_physical": True,
            "tables": [1],
            "extra_json": "{}",
            "expression": "old_dataset",
        }
    ]
