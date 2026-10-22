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
"""Database-backed tests of the Teams installation lifecycle and migration."""

from collections.abc import Iterator
from copy import deepcopy
from datetime import datetime
from importlib import import_module
from typing import Any
from unittest.mock import MagicMock, patch
from uuid import UUID, uuid4

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, select
from sqlalchemy.engine import Engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from superset.integrations.teams.config import parse_teams_config
from superset.integrations.teams.models import TeamsInstallation
from superset.integrations.teams.store import TeamsInstallationStore

migration = import_module(
    "superset.migrations.versions.2026-10-19_00-00_7b9d2f8a6c31_add_teams_installations"
)
TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
APPLICATION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
OTHER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
SERVICE_URL = "https://smba.trafficmanager.net/amer/"
REFRESHED_URL = "https://smba.trafficmanager.net/emea/"


@pytest.fixture
def engine() -> Iterator[Engine]:
    """Use the actual migration, rather than create_all, to create the test table."""
    database = create_engine("sqlite://")
    with database.begin() as connection:
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
    yield database
    database.dispose()


@pytest.fixture
def session(engine: Engine) -> Iterator[Session]:
    """Provide a caller-owned transaction."""
    with Session(engine) as database_session:
        yield database_session


def test_installation_is_persisted(engine: Engine, session: Session) -> None:
    store = TeamsInstallationStore(session)
    installation = store.install(TENANT, APPLICATION, "team-1", SERVICE_URL)
    identity = installation.id
    assert isinstance(identity, UUID)
    assert installation.tenant_id == UUID(TENANT)
    assert installation.application_id == UUID(APPLICATION)
    assert installation.active
    assert installation.service_url == SERVICE_URL
    assert isinstance(installation.created_on, datetime)
    assert installation.changed_on == installation.created_on
    session.commit()
    with Session(engine) as reader:
        persisted = reader.get(TeamsInstallation, identity)
        assert persisted is not None
        assert persisted.service_url == SERVICE_URL


def test_duplicate_install_refreshes_same_record(session: Session) -> None:
    store = TeamsInstallationStore(session)
    original = store.install(TENANT, APPLICATION, "team-1", SERVICE_URL)
    identity, created_on = original.id, original.created_on
    refreshed = store.install(TENANT, APPLICATION, "team-1", REFRESHED_URL)
    repeated = store.install(TENANT, APPLICATION, "team-1", REFRESHED_URL)
    assert refreshed is original
    assert repeated.id == identity
    assert repeated.created_on == created_on
    assert repeated.changed_on >= created_on
    assert repeated.service_url == REFRESHED_URL
    assert session.query(TeamsInstallation).count() == 1


def test_remove_and_reinstall_preserves_identity(session: Session) -> None:
    store = TeamsInstallationStore(session)
    original = store.install(TENANT, APPLICATION, "team-1", SERVICE_URL)
    identity, created_on = original.id, original.created_on
    store.remove(TENANT, APPLICATION, "team-1")
    store.remove(TENANT, APPLICATION, "team-1")
    assert not original.active
    assert store.get_active(TENANT, APPLICATION, "team-1") is None
    assert session.query(TeamsInstallation).count() == 1
    reinstalled = store.install(TENANT, APPLICATION, "team-1", REFRESHED_URL)
    assert reinstalled.id == identity
    assert reinstalled.created_on == created_on
    assert reinstalled.active
    assert reinstalled.service_url == REFRESHED_URL
    assert store.get_active(TENANT, APPLICATION, "team-1") is reinstalled


def test_unknown_removal_does_not_create_installation(session: Session) -> None:
    store = TeamsInstallationStore(session)
    store.remove(TENANT, APPLICATION, "unknown")
    store.remove(TENANT, APPLICATION, "unknown")
    assert store.get_active(TENANT, APPLICATION, "unknown") is None
    assert session.query(TeamsInstallation).count() == 0


@pytest.mark.parametrize(
    "identity",
    [
        (OTHER, APPLICATION, "team-1"),
        (TENANT, OTHER, "team-1"),
        (TENANT, APPLICATION, "team-2"),
    ],
)
def test_identity_is_scoped_to_all_three_fields(
    session: Session, identity: tuple[str, str, str]
) -> None:
    store = TeamsInstallationStore(session)
    first = store.install(TENANT, APPLICATION, "team-1", SERVICE_URL)
    assert store.get_active(*identity) is None
    second = store.install(*identity, REFRESHED_URL)
    assert second.id != first.id
    store.remove(*identity)
    assert first.active
    assert not second.active
    assert session.query(TeamsInstallation).count() == 2


def test_database_enforces_identity_uniqueness(session: Session) -> None:
    store = TeamsInstallationStore(session)
    original = store.install(TENANT, APPLICATION, "team-1", SERVICE_URL)
    with pytest.raises(IntegrityError), session.begin_nested():
        session.execute(
            TeamsInstallation.__table__.insert().values(
                id=uuid4(),
                tenant_id=UUID(TENANT),
                application_id=UUID(APPLICATION),
                team_id="team-1",
                service_url=SERVICE_URL,
                active=True,
                created_on=original.created_on,
                changed_on=original.changed_on,
            )
        )
    assert session.query(TeamsInstallation).count() == 1


def test_insert_collision_recovers_inside_savepoint(session: Session) -> None:
    store = TeamsInstallationStore(session)
    winner = store.install(TENANT, APPLICATION, "team-1", SERVICE_URL)
    identity = winner.id
    connection = session.connection()
    execute = connection.execute
    # Model another writer winning the insert after our first UPDATE found no row.
    with patch.object(connection, "execute") as mocked:
        mocked.side_effect = lambda statement, *args, **kwargs: (
            MagicMock(rowcount=0)
            if mocked.call_count == 1
            else execute(statement, *args, **kwargs)
        )
        refreshed = store.install(TENANT, APPLICATION, "team-1", REFRESHED_URL)
    assert refreshed.id == identity
    assert refreshed.service_url == REFRESHED_URL
    assert session.query(TeamsInstallation).count() == 1
    # The insert error did not invalidate the caller's transaction.
    assert store.install(TENANT, APPLICATION, "team-2", SERVICE_URL).active
    session.commit()


def test_unrelated_integrity_error_is_not_swallowed(session: Session) -> None:
    store = TeamsInstallationStore(session)
    connection = session.connection()
    execute = connection.execute

    def fail_insert(statement: Any, *args: Any, **kwargs: Any) -> Any:
        """Inject an insert failure while exercising real savepoint recovery."""
        if statement.is_insert:
            raise IntegrityError("insert failed", {}, Exception("unrelated constraint"))
        return execute(statement, *args, **kwargs)

    with patch.object(connection, "execute", side_effect=fail_insert):
        with pytest.raises(IntegrityError, match="unrelated constraint"):
            store.install(TENANT, APPLICATION, "team-1", SERVICE_URL)
    assert session.query(TeamsInstallation).count() == 0
    assert store.install(TENANT, APPLICATION, "team-2", SERVICE_URL).active


def test_caller_can_roll_back_install_and_remove(session: Session) -> None:
    store = TeamsInstallationStore(session)
    store.install(TENANT, APPLICATION, "team-1", SERVICE_URL)
    session.rollback()
    assert session.query(TeamsInstallation).count() == 0
    store.install(TENANT, APPLICATION, "team-1", SERVICE_URL)
    session.commit()
    store.remove(TENANT, APPLICATION, "team-1")
    session.rollback()
    assert store.get_active(TENANT, APPLICATION, "team-1") is not None


@pytest.mark.parametrize(
    "url",
    [
        "http://example.com",
        "https://user:secret@example.com",
        "https://example.com?secret=1",
        "https://example.com/#fragment",
        "https://example.com:80",
        "https://example.com/with space",
        "",
        "https://[broken",
    ],
)
def test_rejects_invalid_service_url(session: Session, url: str) -> None:
    with pytest.raises(ValueError, match="HTTPS URL"):
        TeamsInstallationStore(session).install(TENANT, APPLICATION, "team-1", url)
    assert session.query(TeamsInstallation).count() == 0


def test_installation_does_not_authorize_destinations(
    session: Session, teams_config: dict[str, Any]
) -> None:
    raw_config = teams_config
    raw_config["destinations"][0]["team_id"] = "approved"
    before = deepcopy(raw_config)
    config = parse_teams_config(raw_config)
    assert config is not None
    store = TeamsInstallationStore(session)
    store.install(TENANT, APPLICATION, "unapproved", SERVICE_URL)
    store.remove(TENANT, APPLICATION, "unapproved")
    store.install(TENANT, APPLICATION, "unapproved", REFRESHED_URL)
    assert raw_config == before
    assert config.get_destination("ops").team_id == "approved"
    assert set(TeamsInstallation.__table__.columns.keys()) == {
        "id",
        "tenant_id",
        "application_id",
        "team_id",
        "service_url",
        "active",
        "created_on",
        "changed_on",
    }


def test_migration_downgrade_and_reupgrade(engine: Engine, session: Session) -> None:
    TeamsInstallationStore(session).install(TENANT, APPLICATION, "team-1", SERVICE_URL)
    session.commit()
    with engine.begin() as connection:
        connection.exec_driver_sql("CREATE TABLE teams_migration_sentinel (id INTEGER)")
        with Operations.context(MigrationContext.configure(connection)):
            migration.downgrade()
            assert "teams_installations" not in inspect(connection).get_table_names()
            assert "teams_migration_sentinel" in inspect(connection).get_table_names()
            migration.upgrade()
            assert "teams_installations" in inspect(connection).get_table_names()
            assert connection.execute(select(TeamsInstallation.id)).all() == []


@pytest.mark.parametrize("team_id", ["t" * 256, " team-1", "team-1 ", "\tteam-1\n"])
@pytest.mark.parametrize("operation", ["install", "remove", "get_active"])
def test_store_rejects_invalid_team_ids_consistently(
    session: Session,
    team_id: str,
    operation: str,
) -> None:
    """Authenticated event persistence shares the deployment identifier validator."""
    store = TeamsInstallationStore(session)
    args: tuple[str, ...] = (TENANT, APPLICATION, team_id)
    if operation == "install":
        args = (*args, SERVICE_URL)
    method = getattr(store, operation)
    with pytest.raises(ValueError, match="Teams team ID"):
        method(*args)
    assert session.query(TeamsInstallation).count() == 0


def test_migration_preserves_bootstrapped_installations(
    engine: Engine, session: Session
) -> None:
    """Fresh database bootstrap may create the model table before Alembic runs."""
    installation = TeamsInstallationStore(session).install(
        TENANT, APPLICATION, "team-1", SERVICE_URL
    )
    session.commit()
    installation_id = installation.id
    with engine.begin() as connection:
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            assert connection.execute(select(TeamsInstallation.id)).scalars().all() == [
                installation_id
            ]
