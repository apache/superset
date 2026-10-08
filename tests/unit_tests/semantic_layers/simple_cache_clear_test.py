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

from __future__ import annotations

from typing import Any
from unittest.mock import Mock, patch
from uuid import uuid4

import pytest
from flask import Flask
from sqlalchemy import select
from sqlalchemy.orm import Session

from superset.commands.semantic_layer.exceptions import SemanticLayerUpdateFailedError
from superset.commands.semantic_layer.update import UpdateSemanticLayerCommand
from superset.semantic_layers.models import SemanticLayer, SemanticView

pytestmark: pytest.MarkDecorator = pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"SEMANTIC_LAYERS": True}}], indirect=True
)


@pytest.fixture
def layer(session: Session) -> SemanticLayer:
    """Persist a layer without involving a provider or permission event callbacks."""
    SemanticLayer.metadata.create_all(session.get_bind())
    session.execute(
        SemanticLayer.__table__.insert().values(
            uuid=uuid4(),
            name="test",
            type="test",
            configuration="{}",
        )
    )
    session.commit()
    return session.scalars(select(SemanticLayer)).one()


@pytest.mark.parametrize(
    "properties,expected",
    [
        ({"configuration": {}}, 1),
        ({"description": "changed"}, 0),
    ],
)
def test_save_rotates_only_submitted_configuration(
    app: Flask,
    session: Session,
    layer: SemanticLayer,
    properties: dict[str, Any],
    expected: int,
) -> None:
    """Save writes its generation in the same transaction, even for unchanged config."""
    command: UpdateSemanticLayerCommand = UpdateSemanticLayerCommand(
        str(layer.uuid), properties
    )
    with app.app_context(), patch.object(command, "validate"):
        command._model = layer
        command.run()
    session.expire_all()
    assert session.get(SemanticLayer, layer.uuid).cache_version == expected


def test_failed_save_rolls_back_configuration_and_version(
    app: Flask,
    session: Session,
    layer: SemanticLayer,
) -> None:
    """Commit failure cannot publish a generation without the corresponding Save."""
    command: UpdateSemanticLayerCommand = UpdateSemanticLayerCommand(
        str(layer.uuid),
        {"configuration": {"value": "new"}},
    )
    command._model = layer
    with (
        app.app_context(),
        patch.object(command, "validate"),
        patch.object(
            session,
            "commit",
            side_effect=ValueError("failed commit"),
        ),
        pytest.raises(SemanticLayerUpdateFailedError),
    ):
        command.run()
    session.expire_all()
    assert layer.configuration == "{}"
    assert layer.cache_version == 0


def test_version_token_is_captured_and_namespaced(
    app: Flask,
    session: Session,
    layer: SemanticLayer,
) -> None:
    """An operation cannot label old discovery with a newly rotated generation."""
    with app.app_context():
        first: str = layer.metadata_generation
        layer.cache_version = 1
        assert layer.metadata_generation == first
        session.info.clear()
        second: str = layer.metadata_generation
        assert second != first
        app.config["SEMANTIC_LAYER_CACHE_NAMESPACE"] = "other-workspace"
        session.info.clear()
        assert layer.metadata_generation != second
        app.config.pop("SEMANTIC_LAYER_CACHE_NAMESPACE")


def test_token_binding_precedes_provider_construction(
    app: Flask,
    session: Session,
    layer: SemanticLayer,
) -> None:
    """The optional factory hook receives identity before eager discovery can run."""
    factory: Mock = Mock()
    with (
        app.app_context(),
        patch.dict("superset.semantic_layers.models.registry", {"test": factory}),
    ):
        assert (
            layer.implementation
            is factory.from_configuration_with_cache_token.return_value
        )
        factory.from_configuration_with_cache_token.assert_called_once_with(
            {},
            cache_token=layer.metadata_generation,
        )
        view: SemanticView = SemanticView(name="view", semantic_layer=layer)
        assert view.metadata_generation == layer.metadata_generation
        assert view.get_extra_cache_keys({}) == [layer.metadata_generation]


def test_host_generation_is_named_apart_from_provider_token(
    app: Flask,
    session: Session,
    layer: SemanticLayer,
) -> None:
    """Host keys use the metadata generation, never the provider's echoed token."""
    with app.app_context():
        view: SemanticView = SemanticView(name="view", semantic_layer=layer)
        view.__dict__["implementation"] = Mock(
            metadata_cache_token="provider-echo"  # noqa: S106
        )
        assert view.metadata_generation == layer.metadata_generation
        # Containment (#42760) still reads the host generation by its older name.
        assert view.metadata_cache_token == view.metadata_generation
        assert view.get_extra_cache_keys({}) == [layer.metadata_generation]


@pytest.mark.parametrize(
    "allowed,guest,modifiable",
    [
        (True, False, True),
        (False, False, True),
        (True, True, True),
        (True, False, False),
    ],
)
def test_clear_requires_management_authority_without_provider_work(
    app: Flask,
    session: Session,
    layer: SemanticLayer,
    allowed: bool,
    guest: bool,
    modifiable: bool,
) -> None:
    """Clear uses the management gate and commits only for an authorized owner."""
    from superset.commands.semantic_layer.exceptions import SemanticLayerForbiddenError
    from superset.commands.semantic_layer.update import ClearSemanticLayerCacheCommand

    security: Mock
    with (
        app.app_context(),
        patch(
            "superset.commands.semantic_layer.update.security_manager", new=Mock()
        ) as security,
        patch(
            "superset.commands.semantic_layer.update.current_user_can_modify_object",
            return_value=modifiable,
        ),
        patch(
            "superset.commands.semantic_layer.update.SemanticLayerDAO.find_by_uuid",
            return_value=layer,
        ),
        patch.object(
            layer,
            "raise_for_access",
        ),
        patch.dict("superset.semantic_layers.models.registry", {}, clear=True),
    ):
        security.is_guest_user.return_value = guest
        security.can_access.return_value = allowed
        command: ClearSemanticLayerCacheCommand = ClearSemanticLayerCacheCommand(
            str(layer.uuid)
        )
        if allowed and not guest and modifiable:
            command.run()
            assert layer.cache_version == 1
        else:
            with pytest.raises(SemanticLayerForbiddenError):
                command.run()
            assert layer.cache_version == 0
        assert "implementation" not in layer.__dict__


@pytest.mark.parametrize(
    "payload,status", [({}, 200), ({"version": 4}, 400), ([], 400)]
)
def test_clear_route_requires_empty_object(
    client: Any,
    full_api_access: None,
    payload: Any,
    status: int,
) -> None:
    """The clear endpoint does not accept arbitrary configuration or versions."""
    command: Mock
    with (
        patch("superset.semantic_layers.api.is_feature_enabled", return_value=True),
        patch(
            "superset.semantic_layers.api.ClearSemanticLayerCacheCommand",
            create=True,
        ) as command,
    ):
        response: Any = client.post(
            f"/api/v1/semantic_layer/{uuid4()}/clear_cache", json=payload
        )
        assert response.status_code == status
        assert command.return_value.run.call_count == (status == 200)


@pytest.mark.parametrize("route", ["compatible", "column/category/values/"])
def test_suggestion_cache_rotates_with_layer_version(
    client: Any,
    full_api_access: None,
    route: str,
) -> None:
    """Both endpoint caches partition generations without changing their query scope."""
    view: Mock = Mock(spec=SemanticView)
    view.uid = "view"
    view.cache_timeout = 60
    view.changed_on = None
    view.type = "semantic_view"
    view.metadata_generation = "generation-zero"  # noqa: S105
    view.implementation.selection_identity_version = None
    view.get_compatible_metrics.return_value = []
    view.get_compatible_dimensions.return_value = []
    view.values_for_column.return_value = ["one"]
    cache: Mock
    with (
        patch(
            "superset.datasource.api.DatasourceDAO.get_datasource", return_value=view
        ),
        patch(
            "superset.datasource.api.cache_manager",
        ) as cache,
        patch(
            "superset.datasource.api.security_manager.get_rls_cache_key",
            return_value=[],
        ),
    ):
        cache.data_cache.get.return_value = None
        endpoint: str = f"/api/v1/datasource/semantic_view/1/{route}"

        def request() -> Any:
            return (
                client.post(endpoint, json={})
                if route == "compatible"
                else client.get(endpoint)
            )

        assert request().status_code == 200
        first: str = cache.data_cache.get.call_args.args[0]
        view.metadata_generation = "generation-one"  # noqa: S105
        assert request().status_code == 200
        assert cache.data_cache.get.call_args.args[0] != first


def test_annotation_result_key_uses_saved_source_generation(
    app: Flask,
    session: Session,
    layer: SemanticLayer,
) -> None:
    """Annotation versions follow the datasource in the saved query context."""
    from superset.common.query_context_processor import QueryContextProcessor

    view: SemanticView = SemanticView(name="view", semantic_layer=layer)
    chart: Mock = Mock(query_context='{"datasource":{"id":17,"type":"semantic_view"}}')
    query: Mock = Mock(annotation_layers=[{"sourceType": "line", "value": 7}])
    processor: QueryContextProcessor = QueryContextProcessor(Mock())
    with (
        app.app_context(),
        patch(
            "superset.common.query_context_processor.ChartDAO.find_by_id",
            return_value=chart,
        ),
        patch(
            "superset.daos.datasource.DatasourceDAO.get_datasource",
            return_value=view,
        ),
        patch(
            "superset.common.query_context_processor.security_manager.get_rls_cache_key",
            return_value=[],
        ),
    ):
        first: dict[str, Any] = processor._annotation_cache_context(query)
        layer.cache_version = 1
        session.info.clear()
        view.forget_metadata()
        assert processor._annotation_cache_context(query) != first


def test_stale_writers_each_increment_the_database_version(
    app: Flask,
    session: Session,
    layer: SemanticLayer,
) -> None:
    """Two writers that read zero must commit two increments, not overwrite one."""
    other: Session
    with Session(session.get_bind()) as other:
        stale: SemanticLayer = other.get(SemanticLayer, layer.uuid)
        assert stale.cache_version == layer.cache_version == 0
        layer.clear_metadata_cache()
        session.commit()
        stale.clear_metadata_cache()
        other.commit()
        session.expire_all()
        assert layer.cache_version == 2


def test_clear_discards_reused_implementation_objects(
    session: Session,
    layer: SemanticLayer,
) -> None:
    """Reusing ORM instances after a Save cannot reuse their old implementation."""
    view: SemanticView = SemanticView(name="view", semantic_layer=layer)
    session.add(view)
    session.commit()
    layer.__dict__["implementation"] = Mock()
    view.__dict__["implementation"] = Mock()
    previous: str = view.metadata_generation
    layer.clear_metadata_cache()
    session.commit()
    assert "implementation" not in layer.__dict__
    assert "implementation" not in view.__dict__
    assert view.metadata_generation != previous


def test_migration_backfills_existing_layers_and_downgrades() -> None:
    """The server default initializes existing rows and non-ORM inserts alike."""
    from importlib import import_module

    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    from sqlalchemy import create_engine, text
    from sqlalchemy.engine import Connection, Engine

    migration: Any = import_module(
        "superset.migrations.versions.2026-10-08_00-00_c179af013f48_add_semantic_layer_cache_version"
    )
    engine: Engine = create_engine("sqlite://")
    connection: Connection
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE semantic_layers (name TEXT NOT NULL)"))
        connection.execute(
            text("INSERT INTO semantic_layers (name) VALUES ('existing')")
        )
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            connection.execute(
                text("INSERT INTO semantic_layers (name) VALUES ('new')")
            )
            assert connection.execute(
                text("SELECT cache_version FROM semantic_layers")
            ).scalars().all() == [0, 0]
            migration.downgrade()
            assert connection.execute(text("SELECT * FROM semantic_layers")).all() == [
                ("existing",),
                ("new",),
            ]
    engine.dispose()


@pytest.mark.parametrize(
    "error,status",
    [
        ("SemanticLayerNotFoundError", 404),
        ("SemanticLayerForbiddenError", 403),
        ("SemanticLayerUpdateFailedError", 422),
    ],
)
def test_clear_route_preserves_management_errors(
    client: Any,
    full_api_access: None,
    error: str,
    status: int,
) -> None:
    """Management failures retain their status and cannot report success."""
    from superset.commands.semantic_layer import exceptions

    command: Mock
    with patch(
        "superset.semantic_layers.api.ClearSemanticLayerCacheCommand"
    ) as command:
        command.return_value.run.side_effect = getattr(exceptions, error)()
        assert (
            client.post(
                f"/api/v1/semantic_layer/{uuid4()}/clear_cache", json={}
            ).status_code
            == status
        )


def test_clear_route_disabled_feature_does_no_work(
    client: Any, full_api_access: None
) -> None:
    """A disabled feature does not expose the mutation."""
    command: Mock
    with (
        patch("superset.semantic_layers.api.is_feature_enabled", return_value=False),
        patch(
            "superset.semantic_layers.api.ClearSemanticLayerCacheCommand",
        ) as command,
    ):
        assert (
            client.post(
                f"/api/v1/semantic_layer/{uuid4()}/clear_cache", json={}
            ).status_code
            == 404
        )
        command.assert_not_called()


def test_workspace_namespace_can_follow_the_active_tenant(
    app: Flask,
    session: Session,
    layer: SemanticLayer,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A shared database connection can distinguish routed workspace schemas."""
    scope: list[str] = ["first"]
    monkeypatch.setitem(app.config, "SEMANTIC_LAYER_CACHE_NAMESPACE", lambda: scope[0])
    first: str = layer.metadata_generation
    scope[0] = "second"
    session.info.clear()
    assert layer.metadata_generation != first
    session.info["unrelated"] = 1
    layer.clear_metadata_cache()
    assert session.info["unrelated"] == 1


@pytest.mark.parametrize("allowed,status", [(True, 200), (False, 403)])
def test_clear_route_protects_write_permission(
    client: Any,
    full_api_access: None,
    allowed: bool,
    status: int,
) -> None:
    """The real protect decorator checks connection write, never view write/read."""
    from superset import security_manager

    access: Mock
    command: Mock
    with (
        patch.object(security_manager, "is_item_public", return_value=False),
        patch.object(
            security_manager,
            "has_access",
            return_value=allowed,
        ) as access,
        patch("superset.semantic_layers.api.ClearSemanticLayerCacheCommand") as command,
    ):
        assert (
            client.post(
                f"/api/v1/semantic_layer/{uuid4()}/clear_cache", json={}
            ).status_code
            == status
        )
        access.assert_called_with("can_write", "SemanticLayer")
        assert command.return_value.run.call_count == allowed


@pytest.mark.parametrize("namespace", ["", "workspace"])
def test_web_and_task_share_metadata_keys_despite_local_credentials(
    session: Session,
    layer: SemanticLayer,
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
    namespace: str,
) -> None:
    """Credential, driver, query-option and secret rotation cannot strand async hits."""
    from sqlalchemy.engine import make_url

    monkeypatch.setitem(app.config, "SEMANTIC_LAYER_CACHE_NAMESPACE", namespace)
    bind: Mock = Mock()
    bind.engine.url = make_url(
        "postgresql+psycopg2://web:old@metadata:5432/superset?application_name=web"
    )
    view: SemanticView = SemanticView(semantic_layer=layer)
    with patch.object(session, "get_bind", return_value=bind):
        web_key: list[object] = view.get_extra_cache_keys({})
        session.info.clear()
        bind.engine.url = make_url(
            "postgresql://worker:new@metadata:5432/superset?application_name=celery"
        )
        monkeypatch.setitem(app.config, "SECRET_KEY", "rotated-for-task")
        task_view: SemanticView = SemanticView(semantic_layer=layer)
        assert task_view.get_extra_cache_keys({}) == web_key


def test_namespace_is_validated_and_captured_once(
    app: Flask,
    session: Session,
    layer: SemanticLayer,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Reject misconfigured identity and evaluate a tenant resolver only once."""
    monkeypatch.setitem(app.config, "SEMANTIC_LAYER_CACHE_NAMESPACE", 17)
    with pytest.raises(TypeError, match="must resolve to a string"):
        assert layer.metadata_generation
    namespace: Mock = Mock(return_value="workspace")
    monkeypatch.setitem(app.config, "SEMANTIC_LAYER_CACHE_NAMESPACE", namespace)
    first: str = layer.metadata_generation
    assert layer.metadata_generation == first
    namespace.assert_called_once_with()


def test_legacy_provider_keeps_host_invalidation(
    session: Session,
    layer: SemanticLayer,
) -> None:
    """A None SDK token never opts a legacy provider out of host cache rotation."""
    from tests.unit_tests.semantic_layers.metadata_contract_test import LegacyLayer

    view: SemanticView = SemanticView(name="legacy", semantic_layer=layer)
    session.add(view)
    session.commit()
    with patch.dict("superset.semantic_layers.models.registry", {"test": LegacyLayer}):
        assert view.implementation.metadata_cache_token is None
        before: list[object] = view.get_extra_cache_keys({})
        layer.clear_metadata_cache()
        session.commit()
        assert view.implementation.metadata_cache_token is None
        assert view.get_extra_cache_keys({}) != before


def test_clear_preserves_loaded_views_of_other_layers(
    session: Session,
    layer: SemanticLayer,
) -> None:
    """Invalidating one connection cannot discard another connection's discovery."""
    session.execute(
        SemanticLayer.__table__.insert().values(
            uuid=uuid4(),
            name="other",
            type="test",
            configuration="{}",
        )
    )
    other: SemanticLayer = session.scalars(
        select(SemanticLayer).where(SemanticLayer.name == "other")
    ).one()
    view: SemanticView = SemanticView(name="view", semantic_layer=other)
    session.add(view)
    session.commit()
    assert view.semantic_layer_uuid == other.uuid
    implementation: Mock = Mock()
    view.__dict__["implementation"] = implementation
    before: str = view.metadata_generation
    layer.clear_metadata_cache()
    assert view.implementation is implementation
    assert view.metadata_generation == before
