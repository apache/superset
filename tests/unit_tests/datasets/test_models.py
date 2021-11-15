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

# pylint: disable=import-outside-toplevel, unused-argument

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
