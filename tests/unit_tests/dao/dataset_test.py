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

from sqlalchemy.orm.session import Session

from superset.daos.dataset import DatasetDAO


def test_validate_update_uniqueness(session: Session) -> None:
    """
    Test the `validate_update_uniqueness` static method.

    In particular, allow datasets with the same name in the same database as long as they
    are in different schemas
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="sqlite://",
    )
    dataset1 = SqlaTable(
        table_name="my_dataset",
        schema="main",
        database=database,
    )
    dataset2 = SqlaTable(
        table_name="my_dataset",
        schema="dev",
        database=database,
    )
    session.add_all([database, dataset1, dataset2])
    session.flush()

    # same table name, different schema
    assert (
        DatasetDAO.validate_update_uniqueness(
            database_id=database.id,
            schema=dataset1.schema,
            dataset_id=dataset1.id,
            name=dataset1.table_name,
        )
        is True
    )

    # duplicate schema and table name
    assert (
        DatasetDAO.validate_update_uniqueness(
            database_id=database.id,
            schema=dataset2.schema,
            dataset_id=dataset1.id,
            name=dataset1.table_name,
        )
        is False
    )

    # no schema
    assert (
        DatasetDAO.validate_update_uniqueness(
            database_id=database.id,
            schema=None,
            dataset_id=dataset1.id,
            name=dataset1.table_name,
        )
        is True
    )
