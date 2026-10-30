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
from unittest.mock import MagicMock, patch, PropertyMock
from uuid import UUID

import pytest
from pytest_mock import MockerFixture

from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.query_context import QueryContext
from superset.common.query_object import QueryObject
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.semantic_layers.registry import ContextualSemanticLayer
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


def test_connection_credentials_metadata_keys_unchanged(
    client: Any,
    full_api_access: None,
    execution_view: SemanticView,
    mocker: MockerFixture,
) -> None:
    """Metadata keys stay stable while chart results gain user partitioning."""
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
        # Compatibility identity includes changed_on="None" for this view.
        "compatible:a2e526c4cd1db4f68fd34cc7dffe06cc4fbd029975f2147b4b11bb55179795b8",
        # Chart keys also include the requesting user's OAuth cache partition.
        "14ee069dbffd0f7ca50bb720f7d2b9b1d2d4ade37cf50661e33562913dba0e6a",
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


def test_background_context_has_separate_binding(
    execution_view: SemanticView, mocker: MockerFixture
) -> None:
    """Origin separates provider bindings, not the same principal's digest."""
    from flask import g
    from superset_core.semantic_layers.context import (
        ExecutionOrigin,
        SemanticExecutionContext,
    )
    from superset_core.semantic_layers.layer import SemanticLayer as ProviderLayer
    from superset_core.semantic_layers.view import SemanticView as ProviderView

    from superset.app import SupersetApp
    from superset.semantic_layers.execution import (
        current_host_execution_context,
        SemanticBindingMemo,
    )

    application: SupersetApp = SupersetApp(__name__)
    application.config.update(
        SECRET_KEY="test-secret",  # noqa: S106 -- deterministic test-only key
        SEMANTIC_LAYER_CACHE_NAMESPACE="test-workspace",
    )
    user: MagicMock = MagicMock(id=7, is_anonymous=False, is_guest_user=False)
    mocker.patch(
        "superset.semantic_layers.execution.security_manager.get_user_roles",
        return_value=[MagicMock(id=2)],
    )
    memo: SemanticBindingMemo = SemanticBindingMemo()
    with application.test_request_context():
        g.user = user
        request: SemanticExecutionContext = current_host_execution_context()
        request_binding: tuple[
            ProviderLayer[Any, Any], dict[tuple[str, str], ProviderView]
        ] = memo.bind(execution_view.semantic_layer)
    with application.app_context():
        g.user = user
        background: SemanticExecutionContext = current_host_execution_context()
        background_binding: tuple[
            ProviderLayer[Any, Any], dict[tuple[str, str], ProviderView]
        ] = memo.bind(execution_view.semantic_layer)
    assert request.origin == ExecutionOrigin.REQUEST
    assert background.origin == ExecutionOrigin.BACKGROUND
    assert background.identity_digest == request.identity_digest
    assert background_binding is not request_binding
    assert len(memo.bindings) == 2


@pytest.mark.parametrize(
    "app", [{"FEATURE_FLAGS": {"SEMANTIC_LAYERS": True}}], indirect=True
)
@pytest.mark.parametrize(
    "endpoint",
    [
        "column",
        "compatible",
        "views",
        "schema/runtime",
        "structure",
        "chart_data",
        "saved_chart_data",
        "datasource_info",
        "datasource_query",
    ],
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
    query_cache_get: MagicMock = mocker.patch(
        "superset.common.query_context_processor.QueryCacheManager.get"
    )
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
    elif endpoint == "datasource_info":
        response = client.get("/api/v1/datasource/semantic_view/1")
    elif endpoint == "datasource_query":
        response = client.post(
            "/api/v1/datasource/semantic_view/1/query",
            json={"dimensions": ["category"]},
        )
    elif endpoint in {"chart_data", "saved_chart_data"}:
        from superset.charts.data.api import ChartDataRestApi
        from superset.utils import json

        payload: dict[str, Any] = {
            "datasource": {"id": 1, "type": "semantic_view"},
            "queries": [{"columns": [], "metrics": []}],
            "result_type": "full",
            "result_format": "json",
        }
        if endpoint == "chart_data":
            response = client.post("/api/v1/chart/data", json=payload)
        else:
            mocker.patch.object(
                ChartDataRestApi.datamodel,
                "get",
                return_value=MagicMock(query_context=json.dumps(payload)),
            )
            response = client.get("/api/v1/chart/1/data/")
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
    query_cache_get.assert_not_called()
    factory.assert_not_called()


@pytest.mark.parametrize("endpoint", ["info", "query"])
def test_datasource_resolution_keeps_unrelated_denial_message_only(
    client: Any,
    full_api_access: None,
    execution_view: SemanticView,
    mocker: MockerFixture,
    endpoint: str,
) -> None:
    """Resolution must not serialize details from ordinary access denials."""
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetSecurityException

    mocker.patch.object(
        SemanticView,
        "raise_for_access",
        side_effect=SupersetSecurityException(
            SupersetError(
                message="Access denied",
                error_type=SupersetErrorType.TABLE_SECURITY_ACCESS_ERROR,
                level=ErrorLevel.ERROR,
                extra={"tables": ["private_schema.private_table"]},
            )
        ),
    )
    response: Any
    if endpoint == "info":
        response = client.get("/api/v1/datasource/semantic_view/1")
    else:
        response = client.post(
            "/api/v1/datasource/semantic_view/1/query",
            json={"dimensions": ["category"]},
        )
    assert response.status_code == 403
    assert response.json == {"message": "Access denied"}


@pytest.mark.parametrize("saved", [False, True])
def test_chart_data_keeps_unrelated_denial_details_private(
    client: Any,
    full_api_access: None,
    execution_view: SemanticView,
    mocker: MockerFixture,
    saved: bool,
) -> None:
    """Semantic refusal handling must not expose other validation denials."""
    from superset.charts.data.api import ChartDataRestApi
    from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
    from superset.exceptions import SupersetSecurityException
    from superset.utils import json

    payload: dict[str, Any] = {
        "datasource": {"id": 1, "type": "semantic_view"},
        "queries": [{"columns": [], "metrics": []}],
        "result_type": "full",
        "result_format": "json",
    }
    mocker.patch(
        "superset.charts.data.api.ChartDataCommand.validate",
        side_effect=SupersetSecurityException(
            SupersetError(
                message="You need access to private_schema.private_table",
                error_type=SupersetErrorType.TABLE_SECURITY_ACCESS_ERROR,
                level=ErrorLevel.ERROR,
                extra={"tables": ["private_schema.private_table"]},
            )
        ),
    )
    response: Any
    if saved:
        mocker.patch.object(
            ChartDataRestApi.datamodel,
            "get",
            return_value=MagicMock(query_context=json.dumps(payload)),
        )
        response = client.get("/api/v1/chart/1/data/")
    else:
        response = client.post("/api/v1/chart/data", json=payload)
    assert response.status_code == 403
    assert response.json == {"message": "Forbidden"}


def test_guest_digest_does_not_partition_token_claims(
    app: Any, mocker: MockerFixture
) -> None:
    """D14 keeps guest restrictions outside the binding identity digest."""
    from flask import g
    from flask_appbuilder.security.sqla.models import Role
    from superset_core.semantic_layers.context import SemanticExecutionContext

    from superset.security.guest_token import (
        GuestToken,
        GuestTokenResourceType,
        GuestUser,
    )
    from superset.semantic_layers.execution import current_host_execution_context

    mocker.patch.dict(app.config, {"SEMANTIC_LAYER_CACHE_NAMESPACE": "test-workspace"})
    role: Role = Role(id=7, name="Guest")
    contexts: list[SemanticExecutionContext] = []
    username: str
    for username in ("alice", "bob"):
        token: GuestToken = {
            "iat": 1,
            "exp": 2,
            "user": {"username": username},
            "resources": [{"type": GuestTokenResourceType.DASHBOARD, "id": username}],
            "rls_rules": [{"dataset": "1", "clause": f"tenant = '{username}'"}],
        }
        with app.test_request_context():
            g.user = GuestUser(token, [role])
            contexts.append(current_host_execution_context())
    assert contexts[0].is_guest
    assert contexts[1].is_guest
    assert contexts[0].principal_id is contexts[1].principal_id is None
    assert contexts[0].role_ids == contexts[1].role_ids == ("7",)
    assert contexts[0].identity_digest == contexts[1].identity_digest


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
@pytest.mark.usefixtures("enabled_namespace_bootstrap")
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
        with pytest.raises(ValueError, match="namespace failure"):
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


@pytest.fixture
def enabled_namespace_bootstrap(mocker: MockerFixture) -> None:
    """Exercise eager initialization with semantic layers enabled at startup."""
    mocker.patch(
        "superset.semantic_layers.access.is_semantic_layers_enabled", return_value=True
    )


@pytest.mark.usefixtures("enabled_namespace_bootstrap")
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


@pytest.mark.usefixtures("enabled_namespace_bootstrap")
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
            assert (
                other.implementation._implementation is not first_other._implementation
            )
            assert (
                cast(
                    LegacyLayer, execution_view.semantic_layer.implementation
                ).context.principal_id
                == "2"
            )
            assert (
                execution_view.implementation._implementation
                is not first._implementation
            )
            assert (
                cast(
                    ContextualSemanticLayer,
                    execution_view.semantic_layer.implementation,
                )._implementation
                is not first_layer._implementation
            )
        assert execution_view.implementation._implementation is first._implementation
        assert other.implementation._implementation is first_other._implementation
        execution_view.forget_metadata()
        assert other.implementation._implementation is not first_other._implementation
        assert (
            execution_view.implementation._implementation is not first._implementation
        )


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


def test_disabled_startup_then_runtime_enable_shares_namespace(
    tmp_path: Path, mocker: MockerFixture
) -> None:
    """Off-at-boot apps lazily converge on one persisted deployment identity."""
    from sqlalchemy import create_engine, select
    from sqlalchemy.engine import Engine
    from sqlalchemy.orm import Session

    from superset import feature_flag_manager
    from superset.app import SupersetApp
    from superset.key_value.models import KeyValueEntry
    from superset.semantic_layers.access import is_semantic_layers_enabled
    from superset.semantic_layers.execution import semantic_namespace

    engine: Engine = create_engine(f"sqlite:///{tmp_path / 'runtime-namespace.db'}")
    KeyValueEntry.__table__.create(engine)
    applications: list[SupersetApp] = [SupersetApp("web"), SupersetApp("worker")]
    enabled: bool = False

    def runtime_flag(feature: str, default: bool) -> bool:
        """Model a host callback whose decision can change after boot."""
        return enabled if feature == "SEMANTIC_LAYERS" else default

    mocker.patch.object(feature_flag_manager, "_is_feature_enabled_func", runtime_flag)
    mocker.patch("superset.tags.core.register_sqla_event_listeners")
    mocker.patch("superset.commands.theme.seed.SeedSystemThemesCommand.run")
    namespaces: list[str] = []
    application: SupersetApp
    connect: MagicMock
    try:
        with Session(engine) as caller:
            mocker.patch("superset.semantic_layers.execution.db.session", caller)
            for application in applications:
                mocker.patch.object(
                    application, "_is_database_up_to_date", return_value=True
                )
                with application.app_context():
                    with patch.object(
                        engine,
                        "connect",
                        side_effect=AssertionError("namespace DB access while off"),
                    ) as connect:
                        application.sync_config_to_db()
                        connect.assert_not_called()
                    assert "semantic_execution_namespace" not in application.extensions
            enabled = True
            for application in applications:
                with application.app_context():
                    assert is_semantic_layers_enabled()
                    namespaces.append(semantic_namespace())
            assert namespaces[0] == namespaces[1]
            assert UUID(namespaces[0])
            assert len(list(caller.scalars(select(KeyValueEntry)))) == 1
    finally:
        engine.dispose()


def test_namespace_retry_failure_does_not_publish_identity(
    session: Any,
    mocker: MockerFixture,
) -> None:
    """A failed retry leaves initialization available to a subsequent access."""
    from superset.app import SupersetApp
    from superset.semantic_layers.execution import semantic_namespace

    app: SupersetApp = SupersetApp(__name__)
    mocker.patch(
        "superset.semantic_layers.execution._install_namespace",
        side_effect=ValueError("invalid persisted identity"),
    )
    with (
        app.app_context(),
        pytest.raises(ValueError, match="invalid persisted identity"),
    ):
        semantic_namespace()
    assert "semantic_execution_namespace" not in app.extensions


@pytest.mark.usefixtures("enabled_namespace_bootstrap")
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


@pytest.mark.usefixtures("enabled_namespace_bootstrap")
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
    assert "semantic access will retry (OperationalError)" in caplog.text


@pytest.mark.usefixtures("enabled_namespace_bootstrap")
def test_namespace_recovers_after_fresh_install_upgrade(
    session: Any, mocker: MockerFixture
) -> None:
    """A web process started before Helm's upgrade recovers without restarting."""
    from sqlalchemy.exc import OperationalError

    from superset.app import SupersetApp
    from superset.key_value.models import KeyValueEntry
    from superset.semantic_layers.execution import semantic_namespace

    application: SupersetApp = SupersetApp(__name__)
    mocker.patch.object(application, "_is_database_up_to_date", return_value=False)
    with application.app_context():
        application.sync_config_to_db()
    assert "semantic_execution_namespace" not in application.extensions
    # Requests before the upgrade still fail closed; they must not poison recovery.
    with application.test_request_context(), pytest.raises(OperationalError):
        semantic_namespace()
    KeyValueEntry.__table__.create(session.get_bind())
    with application.test_request_context():
        namespace: str = semantic_namespace()
        assert UUID(namespace)
    with application.test_request_context():
        mocker.patch("superset.semantic_layers.execution._install_namespace", new=None)
        assert semantic_namespace() == namespace
    assert session.query(KeyValueEntry).count() == 1


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
