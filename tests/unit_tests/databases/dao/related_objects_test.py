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

"""Datasets are dependents of a database, so the delete confirmation's preview
has to enumerate them.

``DeleteDatabaseCommand.validate`` blocks the delete whenever any ``SqlaTable``
row references the database, but ``get_related_objects`` used to return only
charts, dashboards and SQL Lab tabs -- so the modal could report zero dependents
for a database that cannot be deleted at all. These tests pin the datasets block
and, crucially, that it is counted the same way ``validate`` counts: with the
soft-delete visibility filter bypassed.
"""

from datetime import datetime

from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session


def test_get_related_objects_includes_live_datasets(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """A live dataset is surfaced so the modal can name it before deleting."""
    from superset import db
    from superset.connectors.sqla.models import SqlaTable
    from superset.daos.database import DatabaseDAO
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(database_name="related_db", sqlalchemy_uri="sqlite://")
    dataset = SqlaTable(table_name="qa_orders", database=database)
    db.session.add_all([database, dataset])
    db.session.flush()

    # ``find_by_id`` applies the database base filter, which needs a request
    # user; the dataset lookup under test is independent of it.
    mocker.patch.object(DatabaseDAO, "find_by_id", return_value=database)

    related = DatabaseDAO.get_related_objects(database.id)

    assert [table.table_name for table in related["datasets"]] == ["qa_orders"]


def test_get_related_objects_includes_soft_deleted_datasets(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """The preview must agree with the delete gate.

    A soft-deleted dataset still FK-references the database and still blocks
    ``DeleteDatabaseCommand.validate``. If the preview hid it, the modal would
    show zero dataset dependents and the delete would fail anyway -- the exact
    dependent-blind case this block exists to prevent.
    """
    from superset import db
    from superset.connectors.sqla.models import SqlaTable
    from superset.daos.database import DatabaseDAO
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(database_name="hidden_db", sqlalchemy_uri="sqlite://")
    soft_deleted = SqlaTable(
        table_name="gone",
        database=database,
        deleted_at=datetime(2026, 1, 1, 12, 0, 0),
    )
    db.session.add_all([database, soft_deleted])
    db.session.flush()

    # ``find_by_id`` applies the database base filter, which needs a request
    # user; the dataset lookup under test is independent of it.
    mocker.patch.object(DatabaseDAO, "find_by_id", return_value=database)

    related = DatabaseDAO.get_related_objects(database.id)

    assert [table.table_name for table in related["datasets"]] == ["gone"]


def test_get_related_objects_without_datasets(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """No datasets means an empty block, not a missing key."""
    from superset import db
    from superset.connectors.sqla.models import SqlaTable
    from superset.daos.database import DatabaseDAO
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(database_name="empty_related_db", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    # ``find_by_id`` applies the database base filter, which needs a request
    # user; the dataset lookup under test is independent of it.
    mocker.patch.object(DatabaseDAO, "find_by_id", return_value=database)

    related = DatabaseDAO.get_related_objects(database.id)

    assert related["datasets"] == []
