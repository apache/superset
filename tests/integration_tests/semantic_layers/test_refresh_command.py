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

"""Committed revocations must survive a stale repeatable-read request snapshot.

The provider and Redis boundary are controlled here; the metadata models,
security manager and two database transactions are real. Redis atomicity has
its own suite. Run this file in both PostgreSQL and MySQL integration lanes.
"""

from __future__ import annotations

from collections.abc import Callable, Iterator
from dataclasses import dataclass
from typing import Any
from unittest.mock import Mock, patch
from uuid import UUID, uuid4

import pytest
from flask import current_app, g
from flask.ctx import AppContext
from flask_appbuilder.security.sqla.models import (
    assoc_permissionview_role,
    assoc_user_role,
    Role,
    User,
)
from sqlalchemy import create_engine, delete, event, insert, select, update
from sqlalchemy.engine import Connection, Engine
from sqlalchemy.orm import Session
from superset_core.semantic_layers.metadata import (
    MetadataRefreshError,
    MetadataRefreshResult,
    MetadataSnapshotStore,
)

from superset import db, security_manager
from superset.commands.semantic_layer.exceptions import SemanticLayerForbiddenError
from superset.commands.semantic_layer.refresh_metadata import RefreshMetadataCommand
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.semantic_layers.registry import registry
from tests.unit_tests.semantic_layers.metadata_store_test import MemoryBackend


class ControlledAdapter:
    """Commit the concurrent edit precisely between acquisition and publication."""

    def __init__(self) -> None:
        self.store: MetadataSnapshotStore | None = None
        self.during_fetch: Callable[[], None] = lambda: None
        self.fetches: int = 0

    def bind(self, store: MetadataSnapshotStore, *, deadline: float) -> None:
        self.store = store

    def refresh(self, *, deadline: float) -> MetadataRefreshResult:
        assert self.store is not None
        return self.store.refresh(self.fetch, deadline=deadline)

    def fetch(self, deadline: float) -> str:
        self.fetches += 1
        self.during_fetch()
        return '{"metrics": ["new_metric"]}'


@dataclass
class RefreshRace:
    engine: Engine
    session: Session
    user: User
    role_id: int
    layer_uuid: UUID
    other_layer_uuid: UUID
    view_uuid: UUID
    provider: Mock
    adapter: ControlledAdapter
    backend: Mock


@pytest.fixture
def refresh_race(app_context: AppContext) -> Iterator[RefreshRace]:
    """Create isolated records; no shared charts or connection rows are edited."""
    connection: Connection
    request_session: Session
    engine: Engine = db.engine
    assert engine.dialect.name in {"postgresql", "mysql"}, (
        "Metadata revalidation requires a PostgreSQL or MySQL integration lane"
    )
    label: str = f"metadata-race-{uuid4().hex}"
    permission_ids: list[int] = [
        security_manager.add_permission_view_menu(action, resource).id
        for action, resource in (
            ("can_read", "SemanticView"),
            ("can_read", "SemanticLayer"),
            ("can_write", "SemanticLayer"),
            ("all_datasource_access", "all_datasource_access"),
        )
    ]
    layer_uuid: UUID = uuid4()
    other_layer_uuid: UUID = uuid4()
    view_uuid: UUID = uuid4()
    role_id: int
    user_id: int
    # Core inserts avoid model event hooks unrelated to the refresh transaction.
    with engine.begin() as connection:
        role_id = connection.execute(
            insert(Role).values(name=label)
        ).inserted_primary_key[0]
        user_id = connection.execute(
            insert(User).values(
                username=label,
                first_name="Original",
                last_name="Reader",
                email=f"{label}@example.invalid",
                active=True,
            )
        ).inserted_primary_key[0]
        connection.execute(
            insert(assoc_user_role).values(user_id=user_id, role_id=role_id)
        )
        connection.execute(
            insert(assoc_permissionview_role),
            [
                {"role_id": role_id, "permission_view_id": permission_id}
                for permission_id in permission_ids
            ],
        )
        connection.execute(
            insert(SemanticLayer),
            [
                {
                    "uuid": connection_uuid,
                    "name": label,
                    "type": label,
                    "configuration": '{"environment_id": 42}',
                    "configuration_version": 1,
                    "created_by_fk": user_id,
                }
                for connection_uuid in (layer_uuid, other_layer_uuid)
            ],
        )
        connection.execute(
            insert(SemanticView).values(
                uuid=view_uuid,
                name="full",
                semantic_layer_uuid=layer_uuid,
                configuration="{}",
                configuration_version=1,
            )
        )

    original_session: Session = db.session()
    adapter: ControlledAdapter = ControlledAdapter()
    provider: Mock = Mock()
    provider.supports_metadata_refresh.return_value = True
    provider.from_configuration.return_value.metadata_refresh = adapter
    backend: Mock = Mock(wraps=MemoryBackend())
    backend.with_deadline.return_value = backend
    # Use an independent pool: Superset's default-isolation engine listener can
    # override isolation on an OptionEngine derived from the application engine.
    read_engine: Engine = create_engine(engine.url, isolation_level="REPEATABLE READ")

    def require_read_only(
        connection: Connection,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        # The deliberately concurrent writes use the separate setup engine.
        # Command sessions may not mutate configuration, users or saved charts.
        assert statement.lstrip().split(None, 1)[0].upper() in {"SELECT", "SHOW"}

    event.listen(read_engine, "before_cursor_execute", require_read_only)
    try:
        with (
            current_app.test_request_context(),
            Session(bind=read_engine, autoflush=True) as request_session,
            patch.dict(
                current_app.config,
                {
                    "SEMANTIC_LAYER_METADATA_REFRESH_ENABLED": True,
                    "SEMANTIC_LAYER_METADATA_NAMESPACE": label,
                    "DISTRIBUTED_COORDINATION_CONFIG": {"CACHE_TYPE": "RedisCache"},
                },
            ),
            patch(
                "superset.semantic_layers.metadata_binding.is_feature_enabled",
                return_value=True,
            ),
            patch(
                "superset.commands.semantic_layer.refresh_metadata.DeadlineRedisBackend",
                return_value=backend,
            ),
            patch.dict(registry, {label: provider}),
        ):
            from superset.semantic_layers.metadata_binding import (
                request_metadata_budget,
            )

            request_metadata_budget()
            db.session.registry.set(request_session)
            try:
                user: User | None = request_session.get(User, user_id)
                assert user is not None
                assert (
                    request_session.connection().get_isolation_level()
                    == "REPEATABLE READ"
                )
                g.user = user
                g._login_user = user
                # Prime the identity map and repeatable-read snapshot before fetch.
                assert [role.id for role in user.roles] == [role_id]
                assert security_manager.can_access("can_write", "SemanticLayer")
                yield RefreshRace(
                    engine,
                    request_session,
                    user,
                    role_id,
                    layer_uuid,
                    other_layer_uuid,
                    view_uuid,
                    provider,
                    adapter,
                    backend,
                )
            finally:
                db.session.registry.set(original_session)
    finally:
        read_engine.dispose()
        with engine.begin() as connection:
            connection.execute(
                delete(SemanticView).where(SemanticView.uuid == view_uuid)
            )
            connection.execute(
                delete(SemanticLayer).where(
                    SemanticLayer.uuid.in_([layer_uuid, other_layer_uuid])
                )
            )
            connection.execute(
                delete(assoc_user_role).where(assoc_user_role.c.user_id == user_id)
            )
            connection.execute(
                delete(assoc_permissionview_role).where(
                    assoc_permissionview_role.c.role_id == role_id
                )
            )
            connection.execute(delete(User).where(User.id == user_id))
            connection.execute(delete(Role).where(Role.id == role_id))


def test_unchanged_authority_can_publish_without_orm_changes(
    refresh_race: RefreshRace,
) -> None:
    race: RefreshRace = refresh_race
    result: MetadataRefreshResult = RefreshMetadataCommand(race.view_uuid).run()
    assert result.status == "changed"
    assert race.adapter.fetches == 1
    race.backend.compare_and_publish.assert_called_once()
    assert not race.session.new
    assert not race.session.dirty
    assert not race.session.deleted
    assert db.session() is race.session
    assert g.user is race.user
    assert g._login_user is race.user


@pytest.mark.parametrize(
    "change",
    [
        "roles",
        "permissions",
        "creator",
        "view_configuration",
        "view_name",
        "view_connection",
        "view_deleted",
        "layer_configuration",
        "layer_deleted",
        "user_inactive",
    ],
)
def test_committed_change_prevents_publication(
    refresh_race: RefreshRace, change: str
) -> None:
    race: RefreshRace = refresh_race

    def commit_change() -> None:
        connection: Connection
        with race.engine.begin() as connection:
            if change == "roles":
                connection.execute(
                    delete(assoc_user_role).where(
                        assoc_user_role.c.user_id == race.user.id
                    )
                )
            elif change == "permissions":
                connection.execute(
                    delete(assoc_permissionview_role).where(
                        assoc_permissionview_role.c.role_id == race.role_id
                    )
                )
            elif change == "creator":
                connection.execute(
                    update(SemanticLayer)
                    .where(SemanticLayer.uuid == race.layer_uuid)
                    .values(created_by_fk=None)
                )
            elif change == "user_inactive":
                connection.execute(
                    update(User).where(User.id == race.user.id).values(active=False)
                )
            elif change == "view_deleted":
                connection.execute(
                    delete(SemanticView).where(SemanticView.uuid == race.view_uuid)
                )
            elif change == "layer_deleted":
                connection.execute(
                    delete(SemanticView).where(SemanticView.uuid == race.view_uuid)
                )
                connection.execute(
                    delete(SemanticLayer).where(SemanticLayer.uuid == race.layer_uuid)
                )
            elif change == "layer_configuration":
                connection.execute(
                    update(SemanticLayer)
                    .where(SemanticLayer.uuid == race.layer_uuid)
                    .values(configuration='{"environment_id": 43}')
                )
            else:
                updates: dict[str, dict[str, Any]] = {
                    "view_configuration": {
                        "configuration": '{"metrics": ["restricted"]}'
                    },
                    "view_name": {"name": "another"},
                    "view_connection": {"semantic_layer_uuid": race.other_layer_uuid},
                }
                values: dict[str, Any] = updates[change]
                connection.execute(
                    update(SemanticView)
                    .where(SemanticView.uuid == race.view_uuid)
                    .values(**values)
                )

    race.adapter.during_fetch = commit_change
    with pytest.raises((MetadataRefreshError, SemanticLayerForbiddenError)):
        RefreshMetadataCommand(race.view_uuid).run()
    assert race.adapter.fetches == 1
    race.backend.compare_and_publish.assert_not_called()
    assert not race.session.dirty
    assert db.session() is race.session
    assert g.user is race.user
    assert g._login_user is race.user


def test_refresh_does_not_flush_or_end_unrelated_request_work(
    refresh_race: RefreshRace,
) -> None:
    commit: Mock
    rollback: Mock
    flush: Mock
    connection: Connection
    race: RefreshRace = refresh_race
    race.user.first_name = "Unsaved draft"
    with (
        patch.object(race.session, "commit", wraps=race.session.commit) as commit,
        patch.object(race.session, "rollback", wraps=race.session.rollback) as rollback,
        patch.object(race.session, "flush", wraps=race.session.flush) as flush,
    ):
        RefreshMetadataCommand(race.view_uuid).run()
        commit.assert_not_called()
        rollback.assert_not_called()
        flush.assert_not_called()
    assert race.user in race.session.dirty
    assert race.user.first_name == "Unsaved draft"
    with race.engine.connect() as connection:
        assert (
            connection.execute(
                select(User.first_name).where(User.id == race.user.id)
            ).scalar_one()
            == "Original"
        )


@pytest.mark.parametrize("change", ["roles", "permissions"])
def test_revocation_is_not_masked_by_creator_identity_mismatch(
    refresh_race: RefreshRace, change: str
) -> None:
    """Admin editorship avoids the creator-object mismatch of the old guard."""
    race: RefreshRace = refresh_race
    admin_role: str = race.user.roles[0].name

    def revoke() -> None:
        connection: Connection
        with race.engine.begin() as connection:
            if change == "roles":
                connection.execute(
                    delete(assoc_user_role).where(
                        assoc_user_role.c.user_id == race.user.id
                    )
                )
            else:
                connection.execute(
                    delete(assoc_permissionview_role).where(
                        assoc_permissionview_role.c.role_id == race.role_id
                    )
                )

    race.adapter.during_fetch = revoke
    with patch.dict(current_app.config, {"AUTH_ROLE_ADMIN": admin_role}):
        with pytest.raises(SemanticLayerForbiddenError):
            RefreshMetadataCommand(race.view_uuid).run()
    assert race.adapter.fetches == 1
    race.backend.compare_and_publish.assert_not_called()
    assert db.session() is race.session
    assert g.user is race.user


def test_refresh_reads_stored_configuration_without_flushing_drafts(
    refresh_race: RefreshRace,
) -> None:
    flush: Mock
    race: RefreshRace = refresh_race
    view: SemanticView = (
        race.session.query(SemanticView).filter_by(uuid=race.view_uuid).one()
    )
    layer: SemanticLayer = view.semantic_layer
    layer.configuration = '{"environment_id": 999}'
    view.configuration = '{"metrics": ["unsaved"]}'
    with patch.object(race.session, "flush", wraps=race.session.flush) as flush:
        result: MetadataRefreshResult = RefreshMetadataCommand(race.view_uuid).run()
        flush.assert_not_called()
    assert result.status == "changed"
    race.provider.from_configuration.assert_called_once_with({"environment_id": 42})
    assert layer.configuration == '{"environment_id": 999}'
    assert view.configuration == '{"metrics": ["unsaved"]}'
    assert layer in race.session.dirty
    assert view in race.session.dirty


def test_prior_committed_revocation_is_denied_before_provider_construction(
    refresh_race: RefreshRace,
) -> None:
    connection: Connection
    race: RefreshRace = refresh_race
    with race.engine.begin() as connection:
        connection.execute(
            delete(assoc_user_role).where(assoc_user_role.c.user_id == race.user.id)
        )
    with pytest.raises(SemanticLayerForbiddenError):
        RefreshMetadataCommand(race.view_uuid).run()
    race.provider.from_configuration.assert_not_called()
    race.backend.set.assert_not_called()


@pytest.mark.parametrize("has_login_cache", [True, False])
@pytest.mark.parametrize("failure_call", [1, 2])
def test_policy_exception_restores_request_context(
    refresh_race: RefreshRace, has_login_cache: bool, failure_call: int
) -> None:
    from superset.commands.semantic_layer import refresh_metadata as module

    race: RefreshRace = refresh_race
    authorize: Callable[[SemanticView], None] = module.authorize_metadata_refresh
    calls: int = 0
    if not has_login_cache:
        g.pop("_login_user")

    def failing_policy(view: SemanticView) -> None:
        nonlocal calls
        calls += 1
        assert db.session() is not race.session
        assert g.user is not race.user
        assert g.user.id == race.user.id
        if calls == failure_call:
            raise RuntimeError("controlled policy failure")
        authorize(view)

    with patch.object(module, "authorize_metadata_refresh", side_effect=failing_policy):
        with pytest.raises(RuntimeError, match="controlled policy failure"):
            RefreshMetadataCommand(race.view_uuid).run()
    assert calls == failure_call
    assert race.adapter.fetches == failure_call - 1
    race.backend.compare_and_publish.assert_not_called()
    assert db.session() is race.session
    assert g.user is race.user
    assert hasattr(g, "_login_user") is has_login_cache
    if has_login_cache:
        assert g._login_user is race.user
