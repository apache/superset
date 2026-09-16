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

from datetime import datetime

import pytest
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session


def test_delete_database_blocked_by_soft_deleted_dataset(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """A database whose only datasets are soft-deleted must NOT be deletable.

    ``Database.tables`` now hides soft-deleted datasets (``SqlaTable`` inherits
    ``SoftDeleteMixin``), so the validation counts datasets with the visibility
    filter bypassed — otherwise the database looks empty and gets hard-deleted
    while ``tables.database_id`` rows still reference it.
    """
    from superset import db
    from superset.commands.database.delete import DeleteDatabaseCommand
    from superset.commands.database.exceptions import (
        DatabaseDeleteSoftDeletedDatasetsExistFailedError,
    )
    from superset.connectors.sqla.models import SqlaTable
    from superset.daos.database import DatabaseDAO
    from superset.daos.report import ReportScheduleDAO
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(database_name="del_db", sqlalchemy_uri="sqlite://")
    soft_deleted = SqlaTable(
        table_name="gone",
        database=database,
        deleted_at=datetime(2026, 1, 1, 12, 0, 0),
    )
    db.session.add_all([database, soft_deleted])
    db.session.flush()

    # Isolate the dataset check: the report/model lookups are unrelated to the
    # soft-delete behaviour under test.
    mocker.patch.object(DatabaseDAO, "find_by_id", return_value=database)
    mocker.patch.object(ReportScheduleDAO, "find_by_database_id", return_value=[])

    command = DeleteDatabaseCommand(database.id)
    # The soft-deleted-only branch raises the *specific* subclass so the
    # message tells the operator the blockers are hidden rows.
    with pytest.raises(DatabaseDeleteSoftDeletedDatasetsExistFailedError):
        command.validate()


def test_delete_database_blocked_by_live_dataset(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """A database with a live (non-deleted) dataset raises the base error, not
    the soft-deleted subclass — pinning that the two ``validate`` branches map
    to distinct messages."""
    from superset import db
    from superset.commands.database.delete import DeleteDatabaseCommand
    from superset.commands.database.exceptions import (
        DatabaseDeleteDatasetsExistFailedError,
        DatabaseDeleteSoftDeletedDatasetsExistFailedError,
    )
    from superset.connectors.sqla.models import SqlaTable
    from superset.daos.database import DatabaseDAO
    from superset.daos.report import ReportScheduleDAO
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(database_name="live_db", sqlalchemy_uri="sqlite://")
    live = SqlaTable(table_name="present", database=database)
    db.session.add_all([database, live])
    db.session.flush()

    mocker.patch.object(DatabaseDAO, "find_by_id", return_value=database)
    mocker.patch.object(ReportScheduleDAO, "find_by_database_id", return_value=[])

    command = DeleteDatabaseCommand(database.id)
    with pytest.raises(DatabaseDeleteDatasetsExistFailedError) as exc_info:
        command.validate()
    # The live branch must NOT surface the hidden-rows message.
    assert not isinstance(
        exc_info.value, DatabaseDeleteSoftDeletedDatasetsExistFailedError
    )


def test_delete_database_allowed_when_no_datasets(
    mocker: MockerFixture,
    session: Session,
) -> None:
    """With no datasets at all (soft-deleted or active), validation passes."""
    from superset import db
    from superset.commands.database.delete import DeleteDatabaseCommand
    from superset.connectors.sqla.models import SqlaTable
    from superset.daos.database import DatabaseDAO
    from superset.daos.report import ReportScheduleDAO
    from superset.models.core import Database

    SqlaTable.metadata.create_all(session.get_bind())

    database = Database(database_name="empty_db", sqlalchemy_uri="sqlite://")
    db.session.add(database)
    db.session.flush()

    mocker.patch.object(DatabaseDAO, "find_by_id", return_value=database)
    mocker.patch.object(ReportScheduleDAO, "find_by_database_id", return_value=[])

    command = DeleteDatabaseCommand(database.id)
    # Should not raise.
    command.validate()
