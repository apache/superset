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

from collections.abc import Callable, Hashable, Iterator
from datetime import timedelta
from pathlib import Path
from sqlite3 import Connection as SQLiteConnection
from typing import Any
from unittest.mock import MagicMock
from uuid import UUID

import pandas as pd
import pytest
from flask import Flask, Response
from flask_caching import Cache
from pytest_mock import MockerFixture
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.engine import Engine, make_url
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool, QueuePool, SingletonThreadPool, StaticPool

from superset.charts.data.api import ChartDataRestApi
from superset.commands.chart.data.get_data_command import ChartDataCommand
from superset.common.chart_data import ChartDataResultFormat, ChartDataResultType
from superset.common.query_context import QueryContext
from superset.common.query_object import QueryObject
from superset.common.utils.query_cache_manager import QueryCacheManager
from superset.constants import CacheRegion
from superset.key_value.models import KeyValueEntry
from superset.key_value.types import (
    JsonKeyValueCodec,
    KeyValueResource,
)
from superset.models.helpers import QueryResult
from superset.semantic_layers.execution import _install_namespace
from superset.semantic_layers.models import SemanticLayer, SemanticView
from tests.unit_tests.semantic_layers.conftest import LegacyLayer


@pytest.fixture
def metadata_engines(tmp_path: Path) -> Iterator[Callable[[str, str], Engine]]:
    """Real isolated stores with synthetic transport aliases, never network URLs."""
    engines: list[Engine] = []

    def create(store: str, address: str) -> Engine:
        engine: Engine = create_engine(f"sqlite:///{tmp_path / store}")
        KeyValueEntry.__table__.create(engine, checkfirst=True)
        # The SQLite pool still reaches the file; only address metadata varies.
        engine.url = make_url(address)
        engines.append(engine)
        return engine

    yield create
    for engine in engines:
        engine.dispose()


@pytest.fixture
def namespace_app(app: Flask, mocker: MockerFixture) -> Flask:
    """Do not let an app-global identity hide a metadata-bind isolation defect."""
    mocker.patch.dict(app.config, {"SEMANTIC_LAYER_CACHE_NAMESPACE": ""})
    mocker.patch.dict(app.extensions, {"semantic_execution_namespace": "wrong-store"})
    mocker.patch.dict(
        "superset.semantic_layers.models.registry", {"legacy": LegacyLayer}
    )
    mocker.patch(
        "superset.common.query_context_processor.security_manager.get_rls_cache_key",
        return_value=[],
    )
    return app


def context_for_session(session: Session) -> QueryContext:
    """Use identical layer/view identities and real query-key composition."""
    layer: SemanticLayer = SemanticLayer(
        uuid=UUID(int=1), type="legacy", configuration="{}", cache_version=0
    )
    session.add(layer)
    view: SemanticView = SemanticView(
        id=1, uuid=UUID(int=2), name="legacy", semantic_layer=layer, configuration="{}"
    )
    return QueryContext(
        datasource=view,
        queries=[QueryObject(columns=[], metrics=[])],
        slice_=None,
        form_data=None,
        result_type=ChartDataResultType.FULL,
        result_format=ChartDataResultFormat.JSON,
        cache_values={},
    )


@pytest.mark.parametrize(
    "address",
    [
        "postgresql://web:old@alias:5432/workspace",
        "postgresql://web:old@metadata/workspace",
        "postgresql://web:old@pgbouncer:6432/workspace",
        "postgresql://web:old@metadata:5432/workspace_alias",
        "postgresql+psycopg2://worker:new@metadata:5432/workspace?application_name=task",
    ],
)
def test_metadata_aliases_share_result_cache(
    namespace_app: Flask,
    metadata_engines: Callable[[str, str], Engine],
    mocker: MockerFixture,
    address: str,
) -> None:
    """Worker DATA writes are readable by an independent web metadata session."""
    worker: Engine = metadata_engines(
        "workspace.db", "postgresql://web:old@metadata:5432/workspace"
    )
    web: Engine = metadata_engines("workspace.db", address)
    backend: Cache = Cache(namespace_app, config={"CACHE_TYPE": "SimpleCache"})
    mocker.patch.dict(
        "superset.common.utils.query_cache_manager._cache", {CacheRegion.DATA: backend}
    )
    with Session(worker) as worker_session, Session(web) as web_session:
        worker_context: QueryContext = context_for_session(worker_session)
        worker_key: str | None = worker_context.query_cache_key(
            worker_context.queries[0]
        )
        assert worker_key
        cached: QueryCacheManager = QueryCacheManager()
        cached.set_query_result(
            worker_key,
            QueryResult(
                df=pd.DataFrame({"value": [7]}),
                query="provider result",
                duration=timedelta(0),
            ),
            region=CacheRegion.DATA,
            timeout=600,
        )
        assert cached.result_persisted
        mocker.patch.dict(namespace_app.config, {"SECRET_KEY": "rotated-test-key"})
        web_context: QueryContext = context_for_session(web_session)
        web_key: str | None = web_context.query_cache_key(web_context.queries[0])
        api: ChartDataRestApi = ChartDataRestApi()
        submit: MagicMock = mocker.patch(
            "superset.charts.data.api.submit_chart_data_query_tasks", return_value={}
        )
        mocker.patch.object(
            api, "_send_chart_response", return_value=Response(status=200)
        )
        response: Response = api._run_async({}, ChartDataCommand(web_context))
        assert response.status_code == 200
        submit.assert_not_called()
        loaded: QueryCacheManager = QueryCacheManager.get(
            web_key, region=CacheRegion.DATA, force_cached=True
        )
        assert loaded.is_cached
        pd.testing.assert_frame_equal(loaded.df, pd.DataFrame({"value": [7]}))
        assert web_key == worker_key
        assert isinstance(worker_context.datasource, SemanticView)
        assert isinstance(web_context.datasource, SemanticView)
        assert worker_context.datasource.metadata_generation == (
            web_context.datasource.metadata_generation
        )
        assert (
            "semantic-null-filters-v1"
            in web_context.datasource.get_extra_cache_keys({})
        )


def test_copied_layer_ids_in_distinct_stores_are_isolated(
    namespace_app: Flask, metadata_engines: Callable[[str, str], Engine]
) -> None:
    """Sequential tenant sessions in one app cannot borrow its startup identity."""
    address: str = "postgresql://user:password@proxy/tenant"
    first: Engine = metadata_engines("first.db", address)
    second: Engine = metadata_engines("second.db", address)
    with Session(first) as first_session, Session(second) as second_session:
        first_context: QueryContext = context_for_session(first_session)
        second_context: QueryContext = context_for_session(second_session)
        assert first_context.query_cache_key(first_context.queries[0]) != (
            second_context.query_cache_key(second_context.queries[0])
        )


@pytest.mark.parametrize("callable_override", [False, True])
def test_explicit_namespace_needs_no_identity_store(
    namespace_app: Flask, mocker: MockerFixture, callable_override: bool
) -> None:
    """Operator identity takes precedence even when the durable store is unavailable."""
    configured: str | Callable[[], str] = (
        (lambda: "explicit-workspace") if callable_override else "explicit-workspace"
    )
    mocker.patch.dict(
        namespace_app.config, {"SEMANTIC_LAYER_CACHE_NAMESPACE": configured}
    )
    with Session() as session:
        context: QueryContext = context_for_session(session)
        assert context.query_cache_key(context.queries[0])


def test_identity_is_memoized_without_committing_caller(
    namespace_app: Flask, metadata_engines: Callable[[str, str], Engine]
) -> None:
    """Many layers share one identity lookup; caller work remains uncommitted."""
    engine: Engine = metadata_engines("memo.db", "sqlite:///synthetic-address")
    statements: list[str] = []

    def record(
        connection: Any,
        cursor: Any,
        statement: str,
        parameters: Any,
        context: Any,
        executemany: bool,
    ) -> None:
        statements.append(statement)

    event.listen(engine, "before_cursor_execute", record)
    try:
        with Session(engine) as session:
            first: QueryContext = context_for_session(session)
            assert isinstance(first.datasource, SemanticView)
            original: str = first.datasource.metadata_generation
            statements.clear()
            other: SemanticLayer = SemanticLayer(
                uuid=UUID(int=3), type="legacy", configuration="{}", cache_version=0
            )
            session.add(other)
            assert other.metadata_generation != original
            assert not statements
            assert other in session.new
            first.datasource.semantic_layer.cache_version = 1
            assert first.datasource.metadata_generation == original
            session.info.clear()
            assert first.datasource.semantic_layer.metadata_generation != original
            assert len(statements) == 1
    finally:
        event.remove(engine, "before_cursor_execute", record)


@pytest.mark.parametrize("seed_identity", [True, False])
def test_single_connection_pool_never_waits_for_itself(
    namespace_app: Flask, tmp_path: Path, seed_identity: bool
) -> None:
    """Both existing identity reads and first-use bootstrap avoid pool self-wait."""
    engine: Engine = create_engine(
        f"sqlite:///{tmp_path / 'single.db'}",
        poolclass=QueuePool,
        pool_size=1,
        max_overflow=0,
        pool_timeout=0.05,
    )
    try:
        KeyValueEntry.__table__.create(engine)
        expected: str | None = _install_namespace(engine) if seed_identity else None
        with Session(engine) as session:
            session.connection()
            context: QueryContext = context_for_session(session)
            assert isinstance(context.datasource, SemanticView)
            generation: str = context.datasource.metadata_generation
            assert generation
            assert context.datasource.semantic_layer in session.new
        durable: str = _install_namespace(engine)
        if expected is not None:
            assert durable == expected
        with Session(engine) as reader:
            assert (
                context_for_session(reader).datasource.get_extra_cache_keys({})[0]
                == generation
            )
    finally:
        engine.dispose()


def test_nullpool_identity_read_adds_no_connections(
    namespace_app: Flask, tmp_path: Path
) -> None:
    """Each request's already-open connection suffices for the identity lookup."""
    engine: Engine = create_engine(
        f"sqlite:///{tmp_path / 'nullpool.db'}", poolclass=NullPool
    )
    connections: list[object] = []

    def connected(dbapi_connection: object, record: object) -> None:
        connections.append(dbapi_connection)

    try:
        KeyValueEntry.__table__.create(engine)
        _install_namespace(engine)
        event.listen(engine, "connect", connected)
        for _ in range(3):
            with Session(engine) as session:
                session.connection()
                assert context_for_session(session).datasource.get_extra_cache_keys({})
        assert len(connections) == 3
    finally:
        event.remove(engine, "connect", connected)
        engine.dispose()


def test_missing_identity_with_sqlite_write_fails_without_committing(
    namespace_app: Flask, tmp_path: Path
) -> None:
    """Bootstrap must not wait on, or commit, the caller's SQLite write lock."""
    engine: Engine = create_engine(
        f"sqlite:///{tmp_path / 'write-lock.db'}",
        poolclass=QueuePool,
        pool_size=1,
        max_overflow=0,
        pool_timeout=0.05,
    )
    try:
        KeyValueEntry.__table__.create(engine)
        with Session(engine) as session:
            session.connection().execute(
                KeyValueEntry.__table__.insert().values(
                    uuid=UUID(int=20),
                    resource=KeyValueResource.SEMANTIC_EXECUTION.value,
                    value=JsonKeyValueCodec().encode({"pending": True}),
                )
            )
            context: QueryContext = context_for_session(session)
            with pytest.raises(
                ValueError, match="before starting a SQLite transaction"
            ):
                context.datasource.get_extra_cache_keys({})
            session.rollback()
        with engine.connect() as connection:
            assert (
                connection.scalar(select(func.count()).select_from(KeyValueEntry)) == 0
            )
        _install_namespace(engine)
        with Session(engine) as session:
            assert context_for_session(session).datasource.get_extra_cache_keys({})
    finally:
        engine.dispose()


@pytest.mark.parametrize("poolclass", [SingletonThreadPool, StaticPool])
def test_missing_identity_in_memory_preserves_store(
    namespace_app: Flask, poolclass: type[SingletonThreadPool] | type[StaticPool]
) -> None:
    """First use retains the in-memory store and does not flush caller objects."""
    engine: Engine = create_engine("sqlite://", poolclass=poolclass)
    try:
        KeyValueEntry.__table__.create(engine)
        with Session(engine) as writer:
            writer.connection().execute(
                KeyValueEntry.__table__.insert().values(
                    uuid=UUID(int=20),
                    resource=KeyValueResource.SEMANTIC_EXECUTION.value,
                    value=JsonKeyValueCodec().encode({"pending": True}),
                )
            )
            with pytest.raises(
                ValueError, match="before starting a SQLite transaction"
            ):
                context_for_session(writer).datasource.get_extra_cache_keys({})
            writer.rollback()
        with Session(engine) as session:
            assert session.scalar(select(func.count()).select_from(KeyValueEntry)) == 0
            context: QueryContext = context_for_session(session)
            generation: Hashable = context.datasource.get_extra_cache_keys({})[0]
            assert generation
            assert isinstance(context.datasource, SemanticView)
            assert context.datasource.semantic_layer in session.new
            session.rollback()
        with Session(engine) as reader:
            assert reader.scalar(select(func.count()).select_from(KeyValueEntry)) == 1
            assert (
                context_for_session(reader).datasource.get_extra_cache_keys({})[0]
                == generation
            )
    finally:
        engine.dispose()


def test_missing_identity_uses_metadata_schema(
    namespace_app: Flask, tmp_path: Path
) -> None:
    """Bootstrap writes the configured schema, never an available default table."""
    engine: Engine = create_engine(f"sqlite:///{tmp_path / 'main.db'}")

    def attach_schema(connection: SQLiteConnection, record: object) -> None:
        connection.execute(
            "ATTACH DATABASE ? AS tenant", (str(tmp_path / "tenant.db"),)
        )

    event.listen(engine, "connect", attach_schema)
    tenant: Engine = engine.execution_options(schema_translate_map={None: "tenant"})
    try:
        KeyValueEntry.__table__.create(engine)
        KeyValueEntry.__table__.create(tenant)
        with Session(tenant) as session:
            generation: Hashable = context_for_session(
                session
            ).datasource.get_extra_cache_keys({})[0]
        with Session(tenant) as reader:
            assert reader.scalar(select(func.count()).select_from(KeyValueEntry)) == 1
            assert (
                context_for_session(reader).datasource.get_extra_cache_keys({})[0]
                == generation
            )
        with Session(engine) as default_schema:
            assert (
                default_schema.scalar(select(func.count()).select_from(KeyValueEntry))
                == 0
            )
    finally:
        engine.dispose()
