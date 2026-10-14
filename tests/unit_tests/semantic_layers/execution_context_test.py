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

from pathlib import Path
from typing import Any, cast
from unittest.mock import MagicMock, PropertyMock
from uuid import UUID

import pytest
from pytest_mock import MockerFixture

from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.query_context import QueryContext
from superset.common.query_object import QueryObject
from superset.semantic_layers.models import SemanticLayer, SemanticView
from tests.unit_tests.semantic_layers.conftest import LegacyLayer


@pytest.fixture
def execution_view(app: Any, mocker: MockerFixture) -> SemanticView:
    """A real host datasource with deterministic pre-contract key material."""
    mocker.patch.dict(app.config, {"SEMANTIC_LAYER_CACHE_NAMESPACE": "test-workspace"})
    mocker.patch.dict(
        "superset.semantic_layers.models.registry", {"execution": LegacyLayer}
    )
    mocker.patch.object(
        SemanticLayer,
        "metadata_generation",
        new_callable=PropertyMock,
        return_value="golden-generation",
    )
    mocker.patch(
        "superset.datasource.api.security_manager.get_rls_cache_key", return_value=[]
    )
    layer: SemanticLayer = SemanticLayer(
        uuid=UUID(int=1), type="execution", configuration="{}", cache_version=0
    )
    view: SemanticView = SemanticView(
        id=1, uuid=UUID(int=2), name="legacy", semantic_layer=layer, configuration="{}"
    )
    mocker.patch(
        "superset.datasource.api.DatasourceDAO.get_datasource", return_value=view
    )
    mocker.patch.object(SemanticView, "raise_for_access")
    return view


def test_connection_credentials_keys_unchanged(
    client: Any,
    full_api_access: None,
    execution_view: SemanticView,
    mocker: MockerFixture,
) -> None:
    """Golden result keys recorded on the approved containment base."""
    cache: MagicMock = mocker.patch("superset.datasource.api.cache_manager").data_cache
    cache.get.return_value = ["cached"]
    keys: list[str] = []
    assert (
        client.get(
            "/api/v1/datasource/semantic_view/1/column/category/values/"
        ).status_code
        == 200
    )
    keys.append(cache.get.call_args.args[0])
    assert (
        client.post(
            "/api/v1/datasource/semantic_view/1/compatible", json={}
        ).status_code
        == 200
    )
    keys.append(cache.get.call_args.args[0])
    query: QueryObject = QueryObject(columns=[], metrics=[])
    context: QueryContext = QueryContext(
        datasource=execution_view,
        queries=[query],
        slice_=None,
        form_data=None,
        result_type=ChartDataResultType.FULL,
        result_format=ChartDataResultFormat.JSON,
        cache_values={},
    )
    chart_key: str | None = context.query_cache_key(query)
    assert chart_key is not None
    keys.append(chart_key)
    assert keys == [
        "col_values:eb5d43a7322c2a03556fc53bc62d54fbbe0b3d26d561d18a0e385c7457abd822",
        "compatible:d073f97791e47e1308e077288564234b3e01e7452a065ba9dd52df2005463762",
        "a949254794149c0cadbc6298aac03dee51b00e7faf42c80925ed65f23c9cc271",
    ]


def test_host_context_uses_trusted_identity(app: Any, mocker: MockerFixture) -> None:
    """Client parameters cannot replace authenticated identity or effective roles."""
    from flask import g
    from superset_core.semantic_layers.context import (
        ExecutionOrigin,
        SemanticExecutionContext,
    )

    from superset.semantic_layers.execution import (
        current_host_execution_context,
    )

    mocker.patch.dict(app.config, {"SEMANTIC_LAYER_CACHE_NAMESPACE": "test-workspace"})
    user: MagicMock = MagicMock(id=7, is_anonymous=False, is_guest_user=False)
    mocker.patch(
        "superset.semantic_layers.execution.security_manager.get_user_roles",
        return_value=[MagicMock(id=3), MagicMock(id=2), MagicMock(id=3)],
    )
    with app.test_request_context("/?principal_id=attacker&origin=config"):
        g.user = user
        first: SemanticExecutionContext = current_host_execution_context()
        assert first.principal_id == "7"
        assert first.role_ids == ("2", "3")
        assert first.origin == ExecutionOrigin.REQUEST
        assert current_host_execution_context() == first


def test_identity_digest_properties(mocker: MockerFixture) -> None:
    """The partition is stable across apps and sensitive to each trusted input."""
    from flask import g

    from superset.app import SupersetApp
    from superset.semantic_layers.execution import current_host_execution_context

    def digest(
        secret: str = "first-secret",  # noqa: S107 -- deterministic test-only key
        namespace: str = "workspace",
        principal: int = 7,
        roles: tuple[int, ...] = (2, 3),
        guest: bool = False,
    ) -> str:
        application: SupersetApp = SupersetApp(__name__)
        application.config.update(
            SECRET_KEY=secret, SEMANTIC_LAYER_CACHE_NAMESPACE=namespace
        )
        mocker.patch(
            "superset.semantic_layers.execution.security_manager.get_user_roles",
            return_value=[MagicMock(id=role) for role in roles],
        )
        with application.test_request_context():
            g.user = MagicMock(id=principal, is_anonymous=False, is_guest_user=guest)
            return current_host_execution_context().identity_digest

    baseline: str = digest()
    assert digest() == baseline
    assert digest(roles=(3, 2, 3)) == baseline
    assert digest(secret="second-secret") != baseline  # noqa: S106 -- test-only key
    assert digest(namespace="another-workspace") != baseline
    assert digest(principal=8) != baseline
    assert digest(roles=(2,)) != baseline
    assert digest(guest=True) != baseline


@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"SEMANTIC_LAYERS": True}}], indirect=True
)
@pytest.mark.parametrize(
    "endpoint",
    ["column", "compatible", "views", "schema/runtime", "structure"],
)
def test_execution_refusal_survives_api_boundary(
    client: Any,
    full_api_access: None,
    execution_view: SemanticView,
    mocker: MockerFixture,
    endpoint: str,
) -> None:
    """A real provider-policy refusal retains its type and reason over HTTP."""
    mocker.patch.object(LegacyLayer, "supported_execution_methods", frozenset())
    mocker.patch.object(SemanticLayer, "raise_for_access")
    mocker.patch(
        "superset.semantic_layers.api.SemanticLayerDAO.find_by_uuid",
        return_value=execution_view.semantic_layer,
    )
    mocker.patch(
        "superset.semantic_layers.api.db.session.query"
    ).return_value.filter_by.return_value.first.return_value = execution_view
    cache: MagicMock = mocker.patch("superset.datasource.api.cache_manager").data_cache
    factory: MagicMock = mocker.spy(LegacyLayer, "from_configuration")
    response: Any
    if endpoint == "column":
        response = client.get(
            "/api/v1/datasource/semantic_view/1/column/category/values/"
        )
    elif endpoint == "compatible":
        response = client.post("/api/v1/datasource/semantic_view/1/compatible", json={})
    elif endpoint == "structure":
        response = client.get("/api/v1/semantic_view/1/structure")
    else:
        response = client.post(
            f"/api/v1/semantic_layer/{execution_view.semantic_layer.uuid}/{endpoint}",
            json={},
        )
    assert response.status_code == 403
    assert (
        response.json["errors"][0]["error_type"] == "SEMANTIC_EXECUTION_REFUSED_ERROR"
    )
    assert response.json["errors"][0]["extra"]["reason"] == "method_not_supported"
    cache.get.assert_not_called()
    factory.assert_not_called()


def test_binding_and_containment_include_effective_group_roles(
    app: Any, mocker: MockerFixture
) -> None:
    """Both host contexts include group grants and invalidate on their removal."""
    import hashlib

    from flask import g
    from flask_appbuilder.security.sqla.models import Group, Role, User
    from superset_core.semantic_layers.context import SemanticExecutionContext
    from superset_core.semantic_layers.layer import SemanticCacheExecutionContext

    from superset.semantic_layers.cache_host import _execution_context
    from superset.semantic_layers.execution import current_host_execution_context
    from superset.utils import json

    role: Role = Role(id=7, name="group-reader")
    user: User = User(id=1, username="group-member", groups=[Group(roles=[role])])
    datasource: MagicMock = MagicMock()
    mocker.patch.dict(app.config, {"SEMANTIC_LAYER_CACHE_NAMESPACE": "test"})
    mocker.patch(
        "superset.semantic_layers.cache_host.security_manager.get_rls_cache_key",
        return_value=[],
    )
    with app.test_request_context():
        g.user = user
        binding: SemanticExecutionContext = current_host_execution_context()
        containment: SemanticCacheExecutionContext | None = _execution_context(
            datasource
        )
        assert containment is not None
        assert binding.role_ids == containment.role_ids == ("7",)
        user.groups = []
        revoked: SemanticCacheExecutionContext | None = _execution_context(datasource)
        assert revoked is not None
        assert revoked.role_ids == current_host_execution_context().role_ids == ()
        assert revoked.host_identity != containment.host_identity
        # A pre-upgrade group-only user was represented with no roles, even
        # before revocation. Never reuse that older, ambiguous identity.
        old_payload: str = json.dumps(
            {"guest_token": None, "principal": "1", "rls": [], "roles": ()},
            default=str,
            separators=(",", ":"),
            sort_keys=True,
        )
        assert revoked.host_identity != hashlib.sha256(old_payload.encode()).hexdigest()


@pytest.mark.parametrize("refused", [False, True])
def test_refusal_log_includes_method_and_provider_declarations(
    app: Any,
    execution_view: SemanticView,
    mocker: MockerFixture,
    caplog: pytest.LogCaptureFixture,
    refused: bool,
) -> None:
    """Operators can distinguish policy refusal from unsupported execution."""
    from superset.exceptions import SupersetSecurityException
    from superset.semantic_layers.execution import Refused

    if refused:
        mocker.patch(
            "superset.semantic_layers.execution.resolve_method",
            return_value=Refused("no_policy"),
        )
    else:
        mocker.patch.object(LegacyLayer, "supported_execution_methods", frozenset())
    with app.app_context(), pytest.raises(SupersetSecurityException):
        _: Any = execution_view.implementation
    assert (
        "method=unresolved declared=('connection',)"
        if refused
        else "method=connection declared=()"
    ) in caplog.text


@pytest.mark.parametrize("theme_fails", [False, True])
def test_namespace_bootstrap_failure_has_its_own_boundary(
    mocker: MockerFixture, theme_fails: bool
) -> None:
    """Namespace failure stays fail-closed without masking theme diagnostics."""
    from superset.app import SupersetApp
    from superset.semantic_layers.execution import semantic_namespace

    application: SupersetApp = SupersetApp(__name__)
    mocker.patch.object(application, "_is_database_up_to_date", return_value=True)
    mocker.patch("superset.tags.core.register_sqla_event_listeners")
    mocker.patch(
        "superset.semantic_layers.execution.bootstrap_semantic_namespace",
        side_effect=ValueError("namespace failure"),
    )
    themes: MagicMock = mocker.patch(
        "superset.commands.theme.seed.SeedSystemThemesCommand.run",
        side_effect=ValueError("theme failure") if theme_fails else None,
    )
    logger: MagicMock = mocker.patch("superset.app.logger")
    with application.app_context():
        application.sync_config_to_db()
        with pytest.raises(ValueError, match="was not initialized"):
            semantic_namespace()
    themes.assert_called_once()
    assert any(
        call.args[0] == "Failed to bootstrap semantic execution namespace: %s"
        for call in logger.error.call_args_list
    )
    assert logger.error.call_count == (2 if theme_fails else 1)
    assert all(
        call.args[0] != "Configuration sync to database completed successfully"
        for call in logger.info.call_args_list
    )


def test_validation_does_not_construct_provider() -> None:
    """Configuration validation must not accidentally execute discovery."""
    from unittest.mock import patch

    from superset.commands.semantic_layer.utils import validate_configuration

    with patch.object(
        LegacyLayer, "from_configuration", side_effect=AssertionError("factory called")
    ):
        validate_configuration(LegacyLayer, {})


@pytest.mark.parametrize(
    "reason",
    ["no_policy", "principal_required", "guest_not_supported", "origin_not_supported"],
)
def test_policy_refuses_before_construction(
    app: Any, execution_view: SemanticView, mocker: MockerFixture, reason: str
) -> None:
    """Refusal prevents both layer and view construction, including memo hits."""
    from superset.exceptions import SupersetSecurityException
    from superset.semantic_layers.execution import Refused

    mocker.patch.dict(app.config, {"SEMANTIC_LAYER_CACHE_NAMESPACE": "test-workspace"})
    mocker.patch(
        "superset.semantic_layers.execution.resolve_method",
        return_value=Refused(reason),
    )
    factory: MagicMock = mocker.patch.object(LegacyLayer, "from_configuration")
    with app.app_context(), pytest.raises(SupersetSecurityException) as error:
        _: Any = execution_view.implementation
    assert error.value.status == 403
    assert error.value.error.extra["reason"] == reason
    factory.assert_not_called()


@pytest.mark.parametrize("namespace", [None, 7, "   "])
def test_namespace_rejects_invalid_configuration(
    app: Any, mocker: MockerFixture, namespace: Any
) -> None:
    """Invalid supplied values must not silently select another tenant scope."""
    from superset.semantic_layers.execution import semantic_namespace

    mocker.patch.dict(app.config, {"SEMANTIC_LAYER_CACHE_NAMESPACE": namespace})
    with (
        app.app_context(),
        pytest.raises(TypeError, match="SEMANTIC_LAYER_CACHE_NAMESPACE"),
    ):
        semantic_namespace()


@pytest.mark.parametrize("preexisting", [False, True])
def test_startup_namespace_needs_no_request_pool_checkout(
    tmp_path: Any, mocker: MockerFixture, preexisting: bool
) -> None:
    """Startup caches the durable ID before a request holds the sole connection."""
    from sqlalchemy import create_engine, select
    from sqlalchemy.engine import Engine
    from sqlalchemy.orm import Session
    from sqlalchemy.pool import QueuePool

    from superset.app import SupersetApp
    from superset.key_value.models import KeyValueEntry
    from superset.key_value.types import (
        JsonKeyValueCodec,
        KeyValueResource,
        SEMANTIC_INSTALL_ID_KEY,
    )
    from superset.semantic_layers.execution import semantic_namespace

    engine: Engine = create_engine(
        f"sqlite:///{tmp_path / 'namespace.db'}",
        poolclass=QueuePool,
        pool_size=1,
        max_overflow=0,
        pool_timeout=0.05,
    )
    KeyValueEntry.__table__.create(engine)
    application: SupersetApp = SupersetApp(__name__)
    application.config["SEMANTIC_LAYER_CACHE_NAMESPACE"] = ""
    mocker.patch.object(application, "_is_database_up_to_date", return_value=True)
    mocker.patch("superset.tags.core.register_sqla_event_listeners")
    mocker.patch("superset.commands.theme.seed.SeedSystemThemesCommand.run")
    try:
        with Session(engine) as caller, application.app_context():
            mocker.patch("superset.semantic_layers.execution.db.session", caller)
            if preexisting:
                caller.add(
                    KeyValueEntry(
                        uuid=SEMANTIC_INSTALL_ID_KEY,
                        resource=KeyValueResource.SEMANTIC_EXECUTION.value,
                        value=JsonKeyValueCodec().encode({"namespace": "persisted-id"}),
                    )
                )
                caller.commit()
            application.sync_config_to_db()
            caller.execute(select(KeyValueEntry.value)).all()
            with application.test_request_context():
                namespace: str = semantic_namespace()
                if preexisting:
                    assert namespace == "persisted-id"
                else:
                    assert UUID(namespace)
                assert semantic_namespace() == namespace
    finally:
        engine.dispose()


def test_startup_namespace_is_shared_across_independent_apps(
    tmp_path: Any, mocker: MockerFixture
) -> None:
    """Separate worker apps and pools load one persisted deployment identifier."""
    from sqlalchemy import create_engine, func, select
    from sqlalchemy.engine import Engine
    from sqlalchemy.orm import Session

    from superset.app import SupersetApp
    from superset.key_value.models import KeyValueEntry
    from superset.semantic_layers.execution import semantic_namespace

    namespaces: list[str] = []
    mocker.patch("superset.tags.core.register_sqla_event_listeners")
    mocker.patch("superset.commands.theme.seed.SeedSystemThemesCommand.run")
    worker: int
    for worker in range(2):
        engine: Engine = create_engine(f"sqlite:///{tmp_path / 'namespace.db'}")
        if worker == 0:
            KeyValueEntry.__table__.create(engine)
        application: SupersetApp = SupersetApp(f"worker-{worker}")
        mocker.patch.object(application, "_is_database_up_to_date", return_value=True)
        try:
            with Session(engine) as caller, application.app_context():
                mocker.patch("superset.semantic_layers.execution.db.session", caller)
                application.sync_config_to_db()
                namespaces.append(semantic_namespace())
                assert (
                    caller.scalar(select(func.count()).select_from(KeyValueEntry)) == 1
                )
                caller.rollback()
                # Repeated initialization of the same app never checks out a connection.
                mocker.patch.object(engine, "connect", side_effect=AssertionError("DB"))
                application.sync_config_to_db()
                assert semantic_namespace() == namespaces[-1]
        finally:
            engine.dispose()
    assert namespaces[0] == namespaces[1]
    assert UUID(namespaces[0])


def test_startup_namespace_insert_race_uses_winners_identity(tmp_path: Path) -> None:
    """Two absent-row readers converge after a real unique-constraint failure."""
    from sqlalchemy import create_engine, event, select
    from sqlalchemy.engine import Connection, Engine, ExceptionContext
    from sqlalchemy.exc import IntegrityError
    from sqlalchemy.orm import Session

    from superset.key_value.models import KeyValueEntry
    from superset.key_value.types import JsonKeyValueCodec
    from superset.semantic_layers.execution import _install_namespace

    database_url: str = f"sqlite:///{tmp_path / 'namespace-race.db'}"
    loser: Engine = create_engine(database_url)
    winner: Engine = create_engine(database_url)
    winner_namespaces: list[str] = []
    collisions: list[IntegrityError] = []

    def commit_winner_before_insert(
        connection: Connection,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        """Commit the second caller after the first read but before its INSERT."""
        if statement.lstrip().upper().startswith("INSERT"):
            assert not winner_namespaces
            winner_namespaces.append(_install_namespace(winner))

    def record_collision(context: ExceptionContext) -> None:
        """Observe the database exception rather than synthesizing a failure."""
        assert isinstance(context.sqlalchemy_exception, IntegrityError)
        collisions.append(context.sqlalchemy_exception)

    try:
        KeyValueEntry.__table__.create(loser)
        event.listen(loser, "before_cursor_execute", commit_winner_before_insert)
        event.listen(loser, "handle_error", record_collision)
        recovered: str = _install_namespace(loser)
        assert len(collisions) == 1
        assert winner_namespaces == [recovered]
        assert UUID(recovered)
        with Session(winner) as verification:
            values: list[bytes] = list(
                verification.scalars(select(KeyValueEntry.value))
            )
        assert len(values) == 1
        assert JsonKeyValueCodec().decode(values[0]) == {"namespace": recovered}
    finally:
        loser.dispose()
        winner.dispose()


@pytest.mark.parametrize("namespace", [None, 7, "", "   "])
def test_startup_namespace_rejects_invalid_persisted_identity(
    tmp_path: Path, namespace: Any
) -> None:
    """Invalid durable identity fails closed and is not replaced by a new UUID."""
    from sqlalchemy import create_engine, select
    from sqlalchemy.engine import Engine
    from sqlalchemy.orm import Session

    from superset.key_value.models import KeyValueEntry
    from superset.key_value.types import (
        JsonKeyValueCodec,
        KeyValueResource,
        SEMANTIC_INSTALL_ID_KEY,
    )
    from superset.semantic_layers.execution import _install_namespace

    engine: Engine = create_engine(f"sqlite:///{tmp_path / 'invalid-namespace.db'}")
    encoded: bytes = JsonKeyValueCodec().encode({"namespace": namespace})
    try:
        KeyValueEntry.__table__.create(engine)
        with Session(engine) as writer:
            writer.add(
                KeyValueEntry(
                    uuid=SEMANTIC_INSTALL_ID_KEY,
                    resource=KeyValueResource.SEMANTIC_EXECUTION.value,
                    value=encoded,
                )
            )
            writer.commit()
        with pytest.raises(
            ValueError, match="Semantic execution namespace is unavailable"
        ):
            _install_namespace(engine)
        with Session(engine) as verification:
            assert list(verification.scalars(select(KeyValueEntry.value))) == [encoded]
    finally:
        engine.dispose()


def test_one_session_two_principals_never_share_instances(
    app: Any, execution_view: SemanticView, mocker: MockerFixture
) -> None:
    """One memo owns each bound layer and all of its views across user switches."""
    from flask_appbuilder.security.sqla.models import User

    from superset.utils.core import override_user

    mocker.patch.dict(app.config, {"SEMANTIC_LAYER_CACHE_NAMESPACE": "test-workspace"})
    mocker.patch(
        "superset.semantic_layers.execution.security_manager.get_user_roles",
        return_value=[],
    )
    alice: User = User(id=1)
    bob: User = User(id=2)
    other: SemanticView = SemanticView(
        name="other", configuration="{}", semantic_layer=execution_view.semantic_layer
    )
    with app.app_context(), override_user(alice):
        first: Any = execution_view.implementation
        first_layer: Any = execution_view.semantic_layer.implementation
        first_other: Any = other.implementation
        assert first_layer.context.principal_id == "1"
        assert first_layer.cache_token == "golden-generation"  # noqa: S105
        assert first_layer.credentials is None
        with override_user(bob):
            assert other.implementation is not first_other
            assert (
                cast(
                    LegacyLayer, execution_view.semantic_layer.implementation
                ).context.principal_id
                == "2"
            )
            assert execution_view.implementation is not first
            assert execution_view.semantic_layer.implementation is not first_layer
        assert execution_view.implementation is first
        assert other.implementation is first_other
        execution_view.forget_metadata()
        assert other.implementation is not first_other
        assert execution_view.implementation is not first


def test_policy_is_checked_on_warm_binding(
    app: Any, execution_view: SemanticView, mocker: MockerFixture
) -> None:
    """A cached provider cannot bypass a later policy refusal."""
    from superset.exceptions import SupersetSecurityException
    from superset.semantic_layers.execution import Refused

    with app.app_context():
        _: Any = execution_view.implementation
        mocker.patch(
            "superset.semantic_layers.execution.resolve_method",
            return_value=Refused("no_policy"),
        )
        with pytest.raises(SupersetSecurityException):
            _ = execution_view.implementation


def test_unsupported_method_refuses_before_construction(
    app: Any, execution_view: SemanticView, mocker: MockerFixture
) -> None:
    """A provider must explicitly support the resolved connection method."""
    from superset.exceptions import SupersetSecurityException

    mocker.patch.object(LegacyLayer, "supported_execution_methods", frozenset())
    factory: MagicMock = mocker.patch.object(LegacyLayer, "from_configuration")
    with app.app_context(), pytest.raises(SupersetSecurityException) as error:
        _: Any = execution_view.implementation
    assert error.value.error.extra["reason"] == "method_not_supported"
    factory.assert_not_called()


def test_guest_context_constructs_connection_provider(
    app: Any, execution_view: SemanticView
) -> None:
    """An embedded guest has no database user id but can use connection execution."""
    from flask import g
    from flask_appbuilder.security.sqla.models import Role

    from superset.security.guest_token import GuestToken, GuestUser

    token: GuestToken = {
        "iat": 0,
        "exp": 1,
        "user": {"username": "embedded"},
        "resources": [],
        "rls_rules": [],
    }
    with app.app_context():
        g.user = GuestUser(token, [Role(id=7, name="guest")])
        layer: LegacyLayer = cast(
            LegacyLayer, execution_view.semantic_layer.implementation
        )
        assert layer.context.principal_id is None
        assert layer.context.is_guest
        assert layer.context.role_ids == ("7",)
        assert layer.credentials is None
        assert execution_view.implementation is not None


@pytest.mark.parametrize(
    "namespace", ["operator-workspace", lambda: "tenant-workspace"]
)
def test_configured_namespace_precedes_bootstrap_memory(
    app: Any, mocker: MockerFixture, namespace: Any
) -> None:
    """A tenant resolver retains precedence over the startup fallback."""
    from superset.semantic_layers.execution import semantic_namespace

    mocker.patch.dict(app.config, {"SEMANTIC_LAYER_CACHE_NAMESPACE": namespace})
    mocker.patch.dict(app.extensions, {"semantic_execution_namespace": "install-id"})
    mocker.patch("superset.semantic_layers.execution.db", new=None)
    assert semantic_namespace() == (namespace() if callable(namespace) else namespace)


def test_namespace_without_startup_sync_fails_without_database_access(
    mocker: MockerFixture,
) -> None:
    """An unavailable startup identity fails closed without request-time writes."""
    from superset.app import SupersetApp
    from superset.semantic_layers.execution import semantic_namespace

    app: SupersetApp = SupersetApp(__name__)
    mocker.patch("superset.semantic_layers.execution.db", new=None)
    with app.app_context(), pytest.raises(ValueError, match="was not initialized"):
        semantic_namespace()


def test_namespace_bootstraps_before_migration_head(
    app: Any,
    session: Any,
    mocker: MockerFixture,
    monkeypatch: pytest.MonkeyPatch,
    execution_view: SemanticView,
) -> None:
    """Pending migrations must not strand a worker's subsequent provider access."""
    from superset.key_value.models import KeyValueEntry

    KeyValueEntry.__table__.create(session.get_bind())
    mocker.patch.dict(app.config, {"SEMANTIC_LAYER_CACHE_NAMESPACE": ""})
    monkeypatch.delitem(app.extensions, "semantic_execution_namespace", raising=False)
    mocker.patch.object(app, "_is_database_up_to_date", return_value=False)
    themes: MagicMock = mocker.patch(
        "superset.commands.theme.seed.SeedSystemThemesCommand.run"
    )
    with app.app_context():
        app.sync_config_to_db()
    # The request resolves a real provider without retrying database initialization.
    with app.test_request_context():
        provider: Any = execution_view.implementation
        assert provider is not None
        assert UUID(app.extensions["semantic_execution_namespace"])
    themes.assert_not_called()
    assert session.query(KeyValueEntry).count() == 1


def test_namespace_survives_historic_pickle_migration(
    session: Any,
    mocker: MockerFixture,
) -> None:
    """A pre-upgrade install ID must not enter the old app-resource pickle scan."""
    import pickle
    from importlib import import_module
    from types import ModuleType

    from sqlalchemy import select
    from sqlalchemy.orm import Session

    from superset.key_value.models import KeyValueEntry
    from superset.key_value.types import JsonKeyValueCodec, SEMANTIC_INSTALL_ID_KEY
    from superset.semantic_layers.execution import _install_namespace

    migration: ModuleType = import_module(
        "superset.migrations.versions."
        "2023-05-01_12-03_9c2a5681ddfd_convert_key_value_entries_to_json"
    )
    KeyValueEntry.__table__.create(session.get_bind())
    namespace: str = _install_namespace(session.get_bind())
    session.add(KeyValueEntry(resource="app", value=pickle.dumps({"legacy": True})))
    session.commit()
    with Session(session.get_bind()) as migration_session:
        mocker.patch.object(migration.op, "get_bind", return_value=session.get_bind())
        mocker.patch.object(migration.db, "Session", return_value=migration_session)
        migration.upgrade()
        assert (
            session.scalar(
                select(KeyValueEntry.value).where(KeyValueEntry.resource == "app")
            )
            == b'{"legacy": true}'
        )
        migration.downgrade()
    assert JsonKeyValueCodec().decode(
        session.scalar(
            select(KeyValueEntry.value).where(
                KeyValueEntry.uuid == SEMANTIC_INSTALL_ID_KEY
            )
        )
    ) == {"namespace": namespace}
    assert _install_namespace(session.get_bind()) == namespace


def test_namespace_missing_table_defers_without_error_log(
    session: Any,
    mocker: MockerFixture,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """First-install CLI startup must not report an expected absent table as ERROR."""
    import logging

    from superset.app import SupersetApp

    application: SupersetApp = SupersetApp(__name__)
    mocker.patch.object(application, "_is_database_up_to_date", return_value=False)
    caplog.set_level(logging.INFO, logger="superset.app")
    with application.app_context():
        application.sync_config_to_db()
    assert not [record for record in caplog.records if record.levelno >= logging.ERROR]
    assert "namespace initialization deferred" in caplog.text


def test_static_namespace_skips_bootstrap_database_access(
    mocker: MockerFixture,
) -> None:
    """An operator-provided namespace needs no persisted fallback."""
    from superset.app import SupersetApp
    from superset.semantic_layers.execution import bootstrap_semantic_namespace

    app: SupersetApp = SupersetApp(__name__)
    app.config["SEMANTIC_LAYER_CACHE_NAMESPACE"] = "operator-workspace"
    mocker.patch("superset.semantic_layers.execution.db", new=None)
    with app.app_context():
        bootstrap_semantic_namespace()
    assert "semantic_execution_namespace" not in app.extensions


def test_bootstrap_does_not_evaluate_tenant_callable(
    app: Any, session: Any, mocker: MockerFixture, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Request-scoped tenant configuration is evaluated only during binding."""
    from superset.key_value.models import KeyValueEntry
    from superset.semantic_layers.execution import bootstrap_semantic_namespace

    KeyValueEntry.__table__.create(session.get_bind())
    resolver: MagicMock = MagicMock(side_effect=AssertionError("no request at startup"))
    mocker.patch.dict(app.config, {"SEMANTIC_LAYER_CACHE_NAMESPACE": resolver})
    monkeypatch.setitem(app.extensions, "semantic_execution_namespace", None)
    del app.extensions["semantic_execution_namespace"]
    bootstrap_semantic_namespace()
    resolver.assert_not_called()
    assert UUID(app.extensions["semantic_execution_namespace"])
