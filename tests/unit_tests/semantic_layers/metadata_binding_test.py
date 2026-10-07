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

"""Host binding keeps a single operation budget and checks capability before I/O."""

from __future__ import annotations

from contextlib import nullcontext
from logging import LogRecord
from typing import Any
from unittest.mock import MagicMock, Mock, patch
from uuid import uuid4

import pytest
from flask import Flask, g
from superset_core.semantic_layers.metadata import (
    CatalogSnapshot,
    MetadataRefreshAdapter,
    MetadataRefreshError,
)
from superset_core.semantic_layers.view import SemanticView as ViewABC

from superset.semantic_layers.metadata import ScopedMetadataStore
from superset.semantic_layers.metadata_binding import (
    chart_metadata_operation,
    connection_metadata_scope,
    connection_store,
    layer_implementation,
    metadata_operation,
    operation_deadline,
    participates,
    request_metadata_budget,
    view_implementation,
)
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.semantic_layers.registry import registry
from tests.unit_tests.semantic_layers.metadata_contract_test import (
    MemoryAdapter,
    OptedInLayer,
)
from tests.unit_tests.semantic_layers.metadata_store_test import Clock, MemoryBackend


def test_multiple_store_calls_share_the_request_deadline(app: Flask) -> None:
    with (
        patch.dict(app.config, {"SEMANTIC_LAYER_METADATA_REFRESH_ENABLED": True}),
        app.test_request_context(),
        patch(
            "superset.semantic_layers.metadata_binding.time.monotonic", return_value=100
        ),
    ):
        request_metadata_budget()
        assert operation_deadline() == 130
        with patch(
            "superset.semantic_layers.metadata_binding.time.monotonic", return_value=120
        ):
            assert operation_deadline() == 130
            with metadata_operation():
                assert operation_deadline() == 130
        with patch(
            "superset.semantic_layers.metadata_binding.time.monotonic", return_value=131
        ):
            with pytest.raises(MetadataRefreshError, match="deadline"):
                operation_deadline()


def test_worker_operation_is_explicit_and_nested_calls_do_not_reset() -> None:
    with pytest.raises(MetadataRefreshError, match="configuration"):
        operation_deadline()
    with patch(
        "superset.semantic_layers.metadata_binding.time.monotonic", return_value=100
    ):
        with metadata_operation(deadline=200):
            with metadata_operation():
                assert operation_deadline() == 130
        with metadata_operation(deadline=120):
            assert operation_deadline() == 120
    with pytest.raises(MetadataRefreshError, match="configuration"):
        operation_deadline()


@pytest.mark.parametrize("deadline", [float("nan"), float("inf"), float("-inf")])
def test_worker_rejects_nonfinite_deadline(deadline: float) -> None:
    with pytest.raises(MetadataRefreshError, match="configuration"):
        with metadata_operation(deadline=deadline):
            pytest.fail("invalid deadline entered")


def test_celery_task_establishes_a_fresh_budget_before_task_work(app: Flask) -> None:
    from superset.extensions import celery_app

    class Probe(celery_app.Task):
        def run(self) -> float:
            return operation_deadline()

    Probe.bind(celery_app)
    with (
        app.app_context(),
        patch.dict(app.config, {"SEMANTIC_LAYER_METADATA_REFRESH_ENABLED": True}),
        patch(
            "superset.semantic_layers.metadata_binding.time.monotonic", return_value=100
        ),
    ):
        assert Probe()() == 130
        with pytest.raises(MetadataRefreshError, match="configuration"):
            operation_deadline()


def test_bound_provider_observation_is_stable_only_within_the_operation(
    app: Flask,
) -> None:
    layer: SemanticLayer = SemanticLayer(
        uuid=uuid4(), type="fixture", configuration="{}"
    )
    view: SemanticView = SemanticView(
        uuid=uuid4(), name="orders", configuration="{}", semantic_layer=layer
    )
    memory: MemoryBackend = MemoryBackend()
    provider: Mock = Mock(wraps=OptedInLayer)
    provider.from_configuration.side_effect = lambda configuration: OptedInLayer()
    provider.supports_metadata_refresh.return_value = True
    session: Mock
    with (
        patch.dict(
            app.config,
            {
                "SEMANTIC_LAYER_METADATA_REFRESH_ENABLED": True,
                "SEMANTIC_LAYER_METADATA_NAMESPACE": "test-tenant",
                "DISTRIBUTED_COORDINATION_CONFIG": {"CACHE_TYPE": "RedisCache"},
            },
        ),
        patch.dict(registry, {"fixture": provider}),
        patch(
            "superset.semantic_layers.metadata_binding.is_feature_enabled",
            return_value=True,
        ),
        patch(
            "superset.semantic_layers.metadata_binding.DeadlineRedisBackend",
            return_value=memory,
        ),
        patch("superset.semantic_layers.metadata_binding.Session") as session,
        patch("superset.semantic_layers.metadata_binding.db"),
    ):
        session.return_value.__enter__.return_value.get.return_value = layer
        with metadata_operation():
            bound_adapter: MetadataRefreshAdapter | None = layer_implementation(
                layer
            ).metadata_refresh
            assert isinstance(bound_adapter, MemoryAdapter)
            assert bound_adapter.deadline == operation_deadline()
            first: ViewABC = view_implementation(view)
            assert view_implementation(view) is first
            assert layer_implementation(layer) is layer_implementation(layer)
            store_deadline: float = operation_deadline()
            store: ScopedMetadataStore = connection_store(layer)
            changed: CatalogSnapshot = store.refresh(
                lambda deadline: '["new_metric"]', deadline=store_deadline
            ).snapshot
            assert view_implementation(view) is first
            assert first.metadata_cache_token != changed.cache_token
            with patch(
                "superset.semantic_layers.metadata_binding.time.monotonic",
                return_value=store_deadline + 1,
            ):
                assert connection_store(layer) is store
                assert view_implementation(view) is first
        with metadata_operation():
            second: ViewABC = view_implementation(view)
            assert second is not first
            assert second.metadata_cache_token == changed.cache_token
            assert {metric.id for metric in second.get_metrics()} == {"new_metric"}
        assert provider.from_configuration.call_count == 2


@pytest.mark.parametrize(
    "change", ["config", "namespace", "removed", "disabled", "database"]
)
def test_publication_rechecks_connection_scope(
    app: Flask, change: str, caplog: pytest.LogCaptureFixture
) -> None:
    layer: SemanticLayer = SemanticLayer(
        uuid=uuid4(), type="fixture", configuration="{}"
    )
    fresh: SemanticLayer = SemanticLayer(
        uuid=layer.uuid,
        type="fixture",
        configuration='{"changed":true}' if change == "config" else "{}",
    )
    memory: MemoryBackend = MemoryBackend()
    session: Mock
    with (
        patch.dict(
            app.config,
            {
                "SEMANTIC_LAYER_METADATA_REFRESH_ENABLED": True,
                "SEMANTIC_LAYER_METADATA_NAMESPACE": "test-tenant",
                "DISTRIBUTED_COORDINATION_CONFIG": {"CACHE_TYPE": "RedisCache"},
            },
        ),
        patch.dict(registry, {"fixture": OptedInLayer}),
        patch(
            "superset.semantic_layers.metadata_binding.is_feature_enabled",
            return_value=True,
        ),
        patch(
            "superset.semantic_layers.metadata_binding.DeadlineRedisBackend",
            return_value=memory,
        ),
        patch("superset.semantic_layers.metadata_binding.Session") as session,
        patch("superset.semantic_layers.metadata_binding.db"),
        metadata_operation(),
    ):
        session.return_value.__enter__.return_value.get.return_value = (
            None if change == "removed" else fresh
        )
        if change == "database":
            from sqlalchemy.exc import OperationalError

            session.return_value.__enter__.return_value.get.side_effect = (
                OperationalError("private SQL", {}, Exception("private driver"))
            )
        store_deadline: float = operation_deadline()
        store: ScopedMetadataStore = connection_store(layer)

        def fetch(deadline: float) -> str:
            if change == "disabled":
                app.config["SEMANTIC_LAYER_METADATA_REFRESH_ENABLED"] = False
            if change == "namespace":
                app.config["SEMANTIC_LAYER_METADATA_NAMESPACE"] = "other-tenant"
            return "[]"

        reason: str = "unavailable" if change == "database" else "configuration_changed"
        error: pytest.ExceptionInfo[MetadataRefreshError]
        with pytest.raises(MetadataRefreshError, match=reason) as error:
            store.refresh(fetch, deadline=store_deadline)
        assert "private" not in str(error.value)
        assert error.value.__cause__ is None
        assert store.peek() is None
        warnings: list[LogRecord] = [
            record
            for record in caplog.records
            if record.name == "superset.semantic_layers.metadata_binding"
            and record.getMessage() == "Metadata layer revalidation failed"
            and record.exc_info is not None
        ]
        assert len(warnings) == (1 if change == "database" else 0)


def test_connection_configuration_and_missing_capability_fail_closed(
    app: Flask,
) -> None:
    layer: SemanticLayer = SemanticLayer(
        uuid=uuid4(), type="fixture", configuration="{}"
    )
    with app.app_context(), metadata_operation():
        with patch.dict(app.config, {"SEMANTIC_LAYER_METADATA_NAMESPACE": None}):
            with pytest.raises(MetadataRefreshError, match="configuration"):
                connection_metadata_scope(layer)
        with patch.dict(
            app.config,
            {
                "SEMANTIC_LAYER_METADATA_NAMESPACE": lambda: "tenant",
                "SECRET_KEY": b"test-secret",
                "DISTRIBUTED_COORDINATION_CONFIG": None,
            },
        ):
            assert connection_metadata_scope(layer)
            with pytest.raises(MetadataRefreshError, match="unavailable"):
                connection_store(layer)
        with patch.dict(
            app.config,
            {
                "SEMANTIC_LAYER_METADATA_NAMESPACE": "tenant",
                "DISTRIBUTED_COORDINATION_CONFIG": {"CACHE_TYPE": "NullCache"},
            },
        ):
            with pytest.raises(MetadataRefreshError, match="configuration"):
                connection_store(layer)


def test_http_budget_is_required_and_disabled_hook_is_inert(app: Flask) -> None:
    with (
        app.test_request_context(),
        patch.dict(app.config, {"SEMANTIC_LAYER_METADATA_REFRESH_ENABLED": False}),
    ):
        request_metadata_budget()
        with pytest.raises(MetadataRefreshError, match="configuration"):
            with metadata_operation():
                pytest.fail("missing early request budget")


def test_opted_in_providers_must_supply_adapter_and_view_token(app: Flask) -> None:
    from tests.unit_tests.semantic_layers.metadata_contract_test import (
        LegacyLayer,
        LegacyView,
    )

    layer: SemanticLayer = SemanticLayer(
        uuid=uuid4(), type="fixture", configuration="{}"
    )
    view: SemanticView = SemanticView(
        uuid=uuid4(), name="orders", configuration="{}", semantic_layer=layer
    )
    provider: Mock = Mock()
    provider.from_configuration.return_value = LegacyLayer()
    with (
        app.app_context(),
        patch.dict(app.config, {"SEMANTIC_LAYER_METADATA_NAMESPACE": "tenant"}),
        patch.dict(registry, {"fixture": provider}),
        patch("superset.semantic_layers.metadata_binding.connection_store"),
        metadata_operation(),
    ):
        with pytest.raises(MetadataRefreshError, match="configuration"):
            layer_implementation(layer)
        with patch(
            "superset.semantic_layers.metadata_binding.layer_implementation",
            return_value=LegacyLayer(),
        ):
            with pytest.raises(MetadataRefreshError, match="configuration"):
                view_implementation(view)
        with (
            patch(
                "superset.semantic_layers.metadata_binding.participates",
                return_value=True,
            ),
            patch.object(SemanticLayer, "raise_for_access"),
            patch(
                "superset.semantic_layers.metadata_binding.layer_implementation",
                return_value=LegacyLayer(),
            ),
        ):
            assert isinstance(layer.implementation, LegacyLayer)
        with (
            patch(
                "superset.semantic_layers.metadata_binding.participates",
                return_value=True,
            ),
            patch.object(
                SemanticView, "implementation", new=property(lambda self: LegacyView())
            ),
        ):
            with pytest.raises(MetadataRefreshError, match="configuration"):
                _rejected_token: str | None = view.metadata_cache_token


def test_revalidation_uses_a_fresh_database_read(app: Flask) -> None:
    from sqlalchemy import create_engine
    from sqlalchemy.engine import Connection, Engine

    engine: Engine = create_engine("sqlite://")
    layer: SemanticLayer = SemanticLayer(
        uuid=uuid4(), name="fixture", type="fixture", configuration="{}"
    )
    SemanticLayer.__table__.create(engine)
    connection: Connection
    with engine.begin() as connection:
        connection.execute(
            SemanticLayer.__table__.insert().values(
                uuid=layer.uuid,
                name="fixture",
                type="fixture",
                configuration="{}",
                configuration_version=1,
            )
        )
    memory: MemoryBackend = MemoryBackend()
    try:
        database: Mock
        with (
            patch.dict(
                app.config,
                {
                    "SEMANTIC_LAYER_METADATA_REFRESH_ENABLED": True,
                    "SEMANTIC_LAYER_METADATA_NAMESPACE": "tenant",
                    "DISTRIBUTED_COORDINATION_CONFIG": {"CACHE_TYPE": "RedisCache"},
                },
            ),
            patch.dict(registry, {"fixture": OptedInLayer}),
            patch(
                "superset.semantic_layers.metadata_binding.is_feature_enabled",
                return_value=True,
            ),
            patch(
                "superset.semantic_layers.metadata_binding.DeadlineRedisBackend",
                return_value=memory,
            ),
            patch("superset.semantic_layers.metadata_binding.db") as database,
            metadata_operation(),
        ):
            database.session.get_bind.return_value = engine
            store_deadline: float = operation_deadline()
            store: ScopedMetadataStore = connection_store(layer)
            old: CatalogSnapshot = store.read(
                lambda deadline: "[]", deadline=store_deadline
            )

            def fetch(deadline: float) -> str:
                writer: Connection
                with engine.begin() as writer:
                    writer.execute(
                        SemanticLayer.__table__.update()
                        .where(SemanticLayer.uuid == layer.uuid)
                        .values(configuration='{"changed":true}')
                    )
                return '["new"]'

            with pytest.raises(MetadataRefreshError, match="configuration_changed"):
                store.refresh(fetch, deadline=store_deadline)
            assert store.peek() == old
    finally:
        engine.dispose()


@pytest.mark.parametrize("deadline", [401.0, 1_790_000_000.0])
@pytest.mark.parametrize("nested", [False, True])
def test_worker_rejects_implausible_budget_instead_of_clamping(
    deadline: float, nested: bool
) -> None:
    with patch(
        "superset.semantic_layers.metadata_binding.time.monotonic", return_value=100
    ):
        with metadata_operation() if nested else nullcontext():
            with pytest.raises(MetadataRefreshError, match="^deadline$"):
                with metadata_operation(deadline=deadline):
                    pytest.fail("implausible deadline entered")
            if nested:
                assert operation_deadline() == 130


@pytest.mark.parametrize(
    "provider_type,configuration",
    [
        ("missing-provider", "{}"),
        ("fixture", "{broken"),
        ("fixture", "null"),
        ("fixture", "[]"),
    ],
)
def test_participation_configuration_errors_are_stable(
    app: Flask,
    provider_type: str,
    configuration: str,
) -> None:
    """Invalid stored configuration uses the metadata error contract."""
    layer: SemanticLayer = SemanticLayer(
        uuid=uuid4(), type=provider_type, configuration=configuration
    )
    with (
        app.app_context(),
        patch.dict(app.config, {"SEMANTIC_LAYER_METADATA_REFRESH_ENABLED": True}),
        patch(
            "superset.semantic_layers.metadata_binding.is_feature_enabled",
            return_value=True,
        ),
        patch.dict(registry, {"fixture": OptedInLayer}),
    ):
        with pytest.raises(MetadataRefreshError, match="configuration"):
            participates(layer)


def test_configuration_change_on_same_model_rebinds_opted_in_provider(
    app: Flask,
) -> None:
    """Operation caching is scoped by configuration, not just ORM identity."""
    layer: SemanticLayer = SemanticLayer(
        uuid=uuid4(), type="fixture", configuration="{}"
    )
    with (
        app.app_context(),
        patch.dict(
            app.config,
            {
                "SEMANTIC_LAYER_METADATA_REFRESH_ENABLED": True,
                "SEMANTIC_LAYER_METADATA_NAMESPACE": "tenant",
            },
        ),
        patch(
            "superset.semantic_layers.metadata_binding.is_feature_enabled",
            return_value=True,
        ),
        patch.dict(registry, {"fixture": OptedInLayer}),
        patch("superset.semantic_layers.metadata_binding.connection_store"),
        metadata_operation(),
    ):
        first: object = layer.implementation
        layer.configuration = '{"changed":true}'
        second: object = layer.implementation
        assert first is not second
        assert layer.implementation is second


def test_configuration_parse_is_operation_scoped_and_tracks_stored_changes(
    app: Flask,
) -> None:
    """Avoid repeated parsing without retaining stale or provider-mutated values."""
    from superset.utils import json

    layer: SemanticLayer = SemanticLayer(
        uuid=uuid4(), type="fixture", configuration="{}"
    )
    provider: Mock = Mock()
    seen: list[dict[str, object]] = []

    def supports(configuration: dict[str, object]) -> bool:
        seen.append(dict(configuration))
        configuration["provider_mutation"] = True
        return True

    provider.supports_metadata_refresh.side_effect = supports
    parse: Mock
    with (
        patch.dict(app.config, {"SEMANTIC_LAYER_METADATA_REFRESH_ENABLED": True}),
        patch.dict(registry, {"fixture": provider}),
        patch(
            "superset.semantic_layers.metadata_binding.is_feature_enabled",
            return_value=True,
        ),
        patch(
            "superset.semantic_layers.metadata_binding.json.loads", wraps=json.loads
        ) as parse,
    ):
        with metadata_operation():
            assert participates(layer)
            assert participates(layer)
            assert parse.call_count == 1
            layer.configuration = '{"changed":true}'
            assert participates(layer)
            assert parse.call_count == 2
        with metadata_operation():
            assert participates(layer)
            assert parse.call_count == 3
    assert seen == [{}, {}, {"changed": True}, {"changed": True}]


@pytest.mark.parametrize(
    "kind", ["missing", "unscoped", "other_scope", "forged", "expired", "valid"]
)
@pytest.mark.parametrize(
    "consumer", ["binding", "result", "compatibility", "annotation"]
)
def test_provider_token_must_belong_to_the_operation_store(
    app: Flask, kind: str, consumer: str
) -> None:
    """A reused provider cannot carry unknown identities into any derived key."""
    from collections.abc import Callable

    from superset.semantic_layers import metadata_cache
    from tests.unit_tests.semantic_layers.metadata_identity_test import ResultView
    from tests.unit_tests.semantic_layers.metadata_store_test import catalog, Clock

    clock: Clock = Clock()
    backend: MemoryBackend = MemoryBackend(clock)
    previous: ScopedMetadataStore = ScopedMetadataStore(
        backend, "scope", deadline=130, clock=clock
    )
    expired: CatalogSnapshot = previous.read(catalog, deadline=130)
    clock.advance(301)
    store: ScopedMetadataStore = ScopedMetadataStore(
        backend, "scope", deadline=clock() + 30, clock=clock
    )
    current: CatalogSnapshot = store.read(catalog, deadline=clock() + 30)
    tokens: dict[str, str] = {
        "missing": "",
        "unscoped": "provider-token",
        "other_scope": "other:token",
        "forged": "scope:forged",
        "expired": expired.cache_token,
        "valid": current.cache_token,
    }
    provider: Mock = Mock()
    provider.get_semantic_view.return_value = ResultView(tokens[kind], 17)
    layer: SemanticLayer = SemanticLayer(
        uuid=uuid4(), type="fixture", configuration="{}"
    )
    view: SemanticView = SemanticView(
        uuid=uuid4(), name="orders", configuration="{}", semantic_layer=layer
    )
    with (
        app.app_context(),
        patch.dict(app.config, {"SEMANTIC_LAYER_METADATA_NAMESPACE": "tenant"}),
        patch(
            "superset.semantic_layers.metadata_binding.participates", return_value=True
        ),
        patch(
            "superset.semantic_layers.metadata_binding.layer_implementation",
            return_value=provider,
        ),
        patch(
            "superset.semantic_layers.metadata_binding.connection_store",
            return_value=store,
        ),
        patch(
            "superset.semantic_layers.metadata_cache.connection_store",
            return_value=store,
        ),
        metadata_operation(),
    ):
        if consumer == "annotation":
            # A previously captured provider can mutate its token after binding.
            provider.get_semantic_view.return_value.token = current.cache_token
            view_implementation(view)
            provider.get_semantic_view.return_value.token = tokens[kind]
            token: str | None = metadata_cache.annotation_cache_token(view)
            assert token is not None
            assert token.startswith("uncaptured:") is (kind != "valid")
            return
        if kind != "valid":
            consumers: dict[str, Callable[[], object]] = {
                "binding": lambda: view_implementation(view),
                "result": lambda: view.metadata_cache_token,
                "compatibility": lambda: metadata_cache.compatibility_identity(
                    view, ["orders"], []
                ),
            }
            with pytest.raises(MetadataRefreshError, match="configuration"):
                consumers[consumer]()
            return
        assert view_implementation(view).metadata_cache_token == current.cache_token
        assert view.metadata_cache_token is not None
        assert metadata_cache.compatibility_identity(view, ["orders"], []) is not None


@pytest.mark.parametrize("lifetime", [None, 2, 300, 900])
def test_host_snapshot_lifetime_controls_catalog_and_compatibility_expiry(
    app: Flask, lifetime: int | None
) -> None:
    """The host setting governs both identities without preserving expired tokens."""
    clock: Clock = Clock()
    memory: MemoryBackend = MemoryBackend(clock)
    layer: SemanticLayer = SemanticLayer(
        uuid=uuid4(), type="fixture", configuration="{}"
    )
    expected_lifetime: int = 300 if lifetime is None else lifetime
    settings: dict[str, object] = (
        {}
        if lifetime is None
        else {"SEMANTIC_LAYER_METADATA_SNAPSHOT_TTL_SECONDS": lifetime}
    )
    session: Mock
    with (
        patch.dict(
            app.config,
            {
                "SEMANTIC_LAYER_METADATA_REFRESH_ENABLED": True,
                "SEMANTIC_LAYER_METADATA_NAMESPACE": "test-tenant",
                **settings,
                "DISTRIBUTED_COORDINATION_CONFIG": {"CACHE_TYPE": "RedisCache"},
            },
        ),
        patch.dict(registry, {"fixture": OptedInLayer}),
        patch(
            "superset.semantic_layers.metadata_binding.is_feature_enabled",
            return_value=True,
        ),
        patch(
            "superset.semantic_layers.metadata_binding.DeadlineRedisBackend",
            return_value=memory,
        ),
        patch("superset.semantic_layers.metadata_binding.Session") as session,
        patch("superset.semantic_layers.metadata_binding.db"),
        metadata_operation(),
    ):
        assert (
            app.config["SEMANTIC_LAYER_METADATA_SNAPSHOT_TTL_SECONDS"]
            == expected_lifetime
        )
        session.return_value.__enter__.return_value.get.return_value = layer
        store: ScopedMetadataStore = connection_store(layer)
        deadline: float = operation_deadline()
        first: CatalogSnapshot = store.read(lambda budget: "[]", deadline=deadline)
        generation: str = store.compatibility_generation()
        clock.advance(expected_lifetime - 1)
        assert store.peek() == first
        assert store.compatibility_generation() == generation
        clock.advance(2)
        assert store.peek() is None
        assert store.peek_compatibility_generation() is None
        second: CatalogSnapshot = store.read(lambda budget: "[]", deadline=deadline)
        assert second.payload == first.payload
        assert second.cache_token != first.cache_token
        assert store.compatibility_generation() != generation
        store.invalidate_compatibility()
        cleared: str = store.compatibility_generation()
        clock.advance(expected_lifetime - 1)
        assert store.compatibility_generation() == cleared
        clock.advance(2)
        assert store.peek_compatibility_generation() is None


@pytest.mark.parametrize(
    "lifetime", [None, True, False, 0, -1, "900", 1.5, float("inf"), 2**63]
)
def test_invalid_host_snapshot_lifetime_fails_before_backend_work(
    app: Flask, lifetime: object
) -> None:
    """Invalid operator settings cannot create immortal metadata entries."""
    backend: Mock = Mock()
    layer: SemanticLayer = SemanticLayer(
        uuid=uuid4(), type="fixture", configuration="{}"
    )
    with (
        patch.dict(
            app.config,
            {
                "SEMANTIC_LAYER_METADATA_NAMESPACE": "test-tenant",
                "SEMANTIC_LAYER_METADATA_SNAPSHOT_TTL_SECONDS": lifetime,
                "DISTRIBUTED_COORDINATION_CONFIG": {"CACHE_TYPE": "RedisCache"},
            },
        ),
        patch(
            "superset.semantic_layers.metadata_binding.DeadlineRedisBackend",
            return_value=backend,
        ),
        metadata_operation(),
        pytest.raises(MetadataRefreshError, match="configuration"),
    ):
        connection_store(layer)
    assert backend.mock_calls == []


@pytest.mark.parametrize("task_delay", [0, 45])
def test_export_charts_get_independent_budgets_before_query_construction(
    app: Flask, task_delay: int
) -> None:
    """Earlier task/warehouse work cannot exhaust a later chart's acquisition."""
    from superset.dashboards.excel_export.workbook import build_workbook
    from superset.extensions import celery_app

    clock: Mock = Mock(return_value=100.0)
    observed: list[float] = []
    charts: list[Mock] = [
        Mock(id=1, slice_name="First", viz_type="table"),
        Mock(id=2, slice_name="Second", viz_type="table"),
    ]
    query_context: Mock = Mock()
    command: Mock = Mock()

    def construct(_body: dict[str, Any]) -> Mock:
        """Observe the budget before schema loading can discover fields."""
        observed.append(operation_deadline())
        clock.return_value += 5
        with metadata_operation():
            assert operation_deadline() == observed[-1]
        return query_context

    def execute() -> dict[str, Any]:
        """Model warehouse work after the chart captures its metadata."""
        clock.return_value += 40
        return {"queries": [{"colnames": ["value"], "data": [{"value": 1}]}]}

    command.run.side_effect = execute

    class Export(celery_app.Task):
        """Probe chart boundaries inside the real Celery application task."""

        def run(self) -> dict[str, list[str]]:
            """Exercise the real worker wrapper and workbook chart loop."""
            clock.return_value += task_delay
            return build_workbook("unused.xlsx", Mock(id=1), {}, "job", "data", Mock())

    Export.bind(celery_app)
    schema: MagicMock
    with (
        app.app_context(),
        patch.dict(app.config, {"SEMANTIC_LAYER_METADATA_REFRESH_ENABLED": True}),
        patch(
            "superset.semantic_layers.metadata_binding.is_feature_enabled",
            return_value=True,
        ),
        patch("superset.semantic_layers.metadata_binding.time.monotonic", clock),
        patch(
            "superset.dashboards.excel_export.workbook.get_charts_in_layout_order",
            return_value=charts,
        ),
        patch(
            "superset.dashboards.excel_export.workbook.resolve_query_context",
            return_value={"queries": [{}]},
        ),
        patch(
            "superset.dashboards.excel_export.workbook.get_dashboard_filter_context",
            return_value=Mock(extra_form_data={}),
        ),
        patch(
            "superset.dashboards.excel_export.workbook.ChartDataQueryContextSchema"
        ) as schema,
        patch(
            "superset.dashboards.excel_export.workbook.ChartDataCommand",
            return_value=command,
        ),
        patch(
            "superset.dashboards.excel_export.workbook.StreamingXlsxWriter",
            return_value=MagicMock(sheet_count=2),
        ),
    ):
        schema.return_value.load.side_effect = construct
        assert Export()() == {}
        assert observed == [130 + task_delay, 175 + task_delay]
        assert command.run.call_count == 2
        with pytest.raises(MetadataRefreshError, match="configuration"):
            operation_deadline()


@pytest.mark.parametrize("fail", [False, True])
def test_worker_chart_scope_shares_nested_budget_and_restores_task(
    fail: bool, app: Flask
) -> None:
    """Chart completion/failure releases observations without renewing nested work."""
    clock: Clock = Clock()
    with (
        app.app_context(),
        patch.dict(app.config, {"SEMANTIC_LAYER_METADATA_REFRESH_ENABLED": True}),
        patch(
            "superset.semantic_layers.metadata_binding.is_feature_enabled",
            return_value=True,
        ),
        patch("superset.semantic_layers.metadata_binding.time.monotonic", clock),
        metadata_operation(),
    ):
        clock.advance(10)
        with (
            pytest.raises(RuntimeError, match="chart failed") if fail else nullcontext()
        ):
            with chart_metadata_operation():
                assert operation_deadline() == 140
                clock.advance(5)
                with chart_metadata_operation(), metadata_operation():
                    assert operation_deadline() == 140
                if fail:
                    raise RuntimeError("chart failed")
        assert operation_deadline() == 130
        clock.advance(40)
        with chart_metadata_operation():
            assert operation_deadline() == 185
            clock.advance(31)
            with chart_metadata_operation(), metadata_operation():
                with pytest.raises(MetadataRefreshError, match="deadline"):
                    operation_deadline()
        with pytest.raises(MetadataRefreshError, match="deadline"):
            operation_deadline()


@pytest.mark.parametrize("enabled", [False, True])
def test_chart_scope_preserves_http_request_budget(app: Flask, enabled: bool) -> None:
    """Eager chart work must not renew an HTTP request's acquisition budget."""
    clock: Clock = Clock()
    with (
        app.test_request_context(),
        patch.dict(app.config, {"SEMANTIC_LAYER_METADATA_REFRESH_ENABLED": enabled}),
        patch("superset.semantic_layers.metadata_binding.time.monotonic", clock),
    ):
        request_metadata_budget()
        clock.advance(45)
        with chart_metadata_operation():
            with pytest.raises(
                MetadataRefreshError, match="deadline" if enabled else "configuration"
            ):
                operation_deadline()


def test_disabled_worker_chart_does_not_establish_an_operation(app: Flask) -> None:
    """The rollout flag leaves nonparticipating worker behavior unchanged."""
    with (
        app.app_context(),
        patch.dict(app.config, {"SEMANTIC_LAYER_METADATA_REFRESH_ENABLED": False}),
    ):
        with chart_metadata_operation():
            with pytest.raises(MetadataRefreshError, match="configuration"):
                operation_deadline()


@pytest.mark.parametrize("user_scoped", [False, True])
def test_async_chart_starts_budget_before_deserialization(
    app: Flask, user_scoped: bool
) -> None:
    """A delayed task must enter its chart scope before metadata construction."""
    from superset.common.query_serialization import SerializedQuery
    from superset.tasks.async_queries import execute_chart_query

    principal: Mock = Mock()
    clock: Clock = Clock()
    serialized: SerializedQuery = SerializedQuery(
        datasource={"id": 1, "type": "table"},
        query={},
        form_data=None,
        result_type="full",
        result_format="json",
        force=False,
        custom_cache_timeout=None,
    )

    def deserialize(_query: SerializedQuery) -> None:
        """Stop after verifying the production deserialization boundary."""
        assert operation_deadline() == 175
        with chart_metadata_operation(), metadata_operation():
            assert operation_deadline() == 175
        raise RuntimeError("construction reached")

    with (
        app.app_context(),
        patch.dict(app.config, {"SEMANTIC_LAYER_METADATA_REFRESH_ENABLED": True}),
        patch(
            "superset.semantic_layers.metadata_binding.is_feature_enabled",
            side_effect=lambda _flag: not user_scoped
            or getattr(g, "user", None) is principal,
        ),
        patch("superset.semantic_layers.metadata_binding.time.monotonic", clock),
        metadata_operation(),
        patch("superset.tasks.async_queries._resolve_user", return_value=principal),
        patch(
            "superset.tasks.async_queries.load_serialized_query",
            side_effect=deserialize,
        ),
    ):
        clock.advance(45)
        with pytest.raises(RuntimeError, match="construction reached"):
            execute_chart_query.func(serialized, user_id=7)
        with pytest.raises(MetadataRefreshError, match="deadline"):
            operation_deadline()
