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
"""Contract tests for declarative hard-purge policies."""

from __future__ import annotations

import logging
import threading
import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import replace
from functools import partial
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
import sqlalchemy as sa
from flask import current_app
from sqlalchemy.engine import Dialect
from sqlalchemy.orm import configure_mappers, registry
from sqlalchemy.sql import Select

from superset.commands.deletion_retention import purge_policy as purge_policy_module
from superset.commands.deletion_retention.purge_policy import (
    _dependency_owner_depth,
    _dependency_predicates,
    _fk_key,
    BlockerReason,
    compare_policy,
    delete_associations,
    delete_owned_children,
    DependencyClassification,
    DependencyKey,
    DependencyPolicy,
    discover_dependencies,
    ExecutionPhase,
    get_purge_policy,
    HOST_POLICIES_CONFIG_KEY,
    listener_responsibilities,
    ListenerAction,
    PolicyCoverage,
    purge_policy_registry,
    PurgeEntityPolicy,
    validate_deletion_allowed,
    validate_unique_root_policies,
)
from superset.connectors.sqla.models import SqlaTable
from superset.models.dashboard import Dashboard
from superset.models.helpers import SoftDeleteMixin
from superset.models.slice import Slice
from superset.tasks.deletion_retention import _soft_delete_models
from superset.utils.sqlalchemy_events import (
    declared_delete_listeners,
    DeleteListenerDeclaration,
    DeleteListenerEffect,
    register_delete_listener,
    remove_delete_listener,
)


def test_compare_policy_reports_missing_duplicate_and_stale_dependencies() -> None:
    """Coverage diagnostics identify every kind of registry drift."""
    discovered: set[DependencyKey] = {
        DependencyKey("foreign_key", "root", "owned"),
        DependencyKey("relationship", "root", "preserved", relationship="item"),
    }
    duplicate: DependencyPolicy = DependencyPolicy(
        DependencyKey("foreign_key", "root", "owned"),
        DependencyClassification.OWNED,
    )
    stale: DependencyPolicy = DependencyPolicy(
        DependencyKey("foreign_key", "root", "stale"),
        DependencyClassification.PRESERVE,
    )

    coverage: PolicyCoverage = compare_policy(discovered, (duplicate, duplicate, stale))

    assert len(coverage.missing) == 1
    assert coverage.duplicates == (duplicate.key,)
    assert coverage.stale == (stale.key,)


def test_adding_a_complete_policy_restores_coverage() -> None:
    """A new dependency passes after its policy is supplied."""
    key: DependencyKey = DependencyKey("foreign_key", "root", "child")

    assert not compare_policy({key}, ()).complete
    assert compare_policy(
        {key},
        (DependencyPolicy(key, DependencyClassification.OWNED),),
    ).complete


def test_omitted_inbound_fk_and_listener_are_reported() -> None:
    """Inbound metadata edges and persistent listeners are obligations."""
    inbound: DependencyKey = DependencyKey(
        "foreign_key",
        "root",
        "referrer",
        ("id",),
        ("root_id",),
        "inbound",
    )
    coverage: PolicyCoverage = compare_policy(
        {inbound},
        (),
        discovered_listeners={"persistent_cleanup"},
    )

    assert coverage.missing == (inbound,)
    assert coverage.missing_listeners == ("persistent_cleanup",)


@pytest.mark.parametrize(
    "classification",
    [DependencyClassification.PRESERVE, DependencyClassification.BLOCK],
)
def test_terminal_dependency_classifications_are_complete(
    classification: DependencyClassification,
) -> None:
    """Preserve and block are explicit terminal treatments, not omissions."""
    key: DependencyKey = DependencyKey("foreign_key", "root", "terminal")

    assert compare_policy({key}, (DependencyPolicy(key, classification),)).complete


def test_composite_foreign_key_is_one_atomic_dependency() -> None:
    """Composite constraints retain ordered local and remote column tuples."""
    metadata: sa.MetaData = sa.MetaData()
    root: sa.Table = sa.Table(
        "root",
        metadata,
        sa.Column("tenant_id", sa.Integer, primary_key=True),
        sa.Column("id", sa.Integer, primary_key=True),
    )
    child: sa.Table = sa.Table(
        "child",
        metadata,
        sa.Column("tenant_id", sa.Integer),
        sa.Column("root_id", sa.Integer),
        sa.ForeignKeyConstraint(
            ("tenant_id", "root_id"), ("root.tenant_id", "root.id")
        ),
    )
    constraint: sa.ForeignKeyConstraint = next(iter(child.foreign_key_constraints))

    key: DependencyKey = _fk_key(root, constraint, "inbound")

    assert key.local_columns == ("tenant_id", "id")
    assert key.remote_columns == ("tenant_id", "root_id")


def test_duplicate_root_policies_are_rejected() -> None:
    """Registry construction cannot silently replace a root declaration."""
    policy: PurgeEntityPolicy = get_purge_policy(Slice)

    with pytest.raises(ValueError, match="Duplicate purge policy for Slice"):
        validate_unique_root_policies((policy, policy))


def test_every_soft_delete_root_has_a_purge_policy() -> None:
    """Every built-in retention root has exactly one purge policy."""
    production_roots: set[type[Any]] = {
        model
        for model in _soft_delete_models()
        if model.__module__.startswith("superset.")
    }
    assert set(purge_policy_registry()) == production_roots


def test_listener_coverage_reports_stale_and_optional_declarations() -> None:
    """Required stale listeners fail while disabled optional listeners pass."""
    stale: PolicyCoverage = compare_policy(
        (), (), declared_listeners={"removed_cleanup"}
    )
    optional: PolicyCoverage = compare_policy(
        (),
        (),
        declared_listeners={"optional_cleanup"},
        optional_declared_listeners={"optional_cleanup"},
    )

    assert stale.stale_listeners == ("removed_cleanup",)
    assert optional.complete


@pytest.mark.parametrize("model", [Slice, Dashboard, SqlaTable])
def test_real_mapper_graph_has_complete_policy(model: type[Any]) -> None:
    """Every supported root mapper dependency has one policy."""
    configure_mappers()
    metadata_tables: set[str] = set(sa.inspect(Slice).local_table.metadata.tables)
    assert {
        "embedded_dashboards",
        "report_schedule",
        "rls_filter_tables",
        "tagged_object",
        "user_attribute",
    } <= metadata_tables
    policy: PurgeEntityPolicy = get_purge_policy(model)
    recursive_tables: frozenset[str] = frozenset(
        dependency.key.related_table
        for dependency in policy.dependencies
        if dependency.classification
        in {
            DependencyClassification.OWNED,
            DependencyClassification.ASSOCIATION,
        }
    )
    coverage: PolicyCoverage = compare_policy(
        discover_dependencies(sa.inspect(model), recursive_tables=recursive_tables),
        policy.dependencies,
        discovered_listeners=listener_responsibilities(model),
        declared_listeners=policy.listener_responsibilities,
        optional_declared_listeners=policy.optional_listener_responsibilities,
    )

    assert coverage.complete, coverage


@pytest.mark.parametrize("model", [Slice, Dashboard, SqlaTable])
def test_non_preserve_dependencies_carry_phases(model: type[Any]) -> None:
    """Every executable classification declares its execution phase."""
    policy: PurgeEntityPolicy = get_purge_policy(model)

    assert all(
        dependency.phase is not None
        for dependency in policy.dependencies
        if dependency.classification is not DependencyClassification.PRESERVE
    )


def test_recursive_discovery_stops_at_owned_cycles() -> None:
    """Owned-child backrefs terminate instead of walking the graph forever."""
    dependencies: frozenset[DependencyKey] = discover_dependencies(
        sa.inspect(Dashboard),
        recursive_tables=frozenset({"dashboards", "embedded_dashboards"}),
    )

    assert dependencies
    assert len(dependencies) == len(set(dependencies))
    assert any(
        dependency.owner_table == "embedded_dashboards"
        and dependency.related_table == "dashboards"
        for dependency in dependencies
    )


def test_dependency_owner_depth_handles_deep_paths_without_recursion() -> None:
    """Ownership ordering and predicates are independent of recursion limits."""
    path_length: int = 1_100
    metadata: sa.MetaData = sa.MetaData()
    root_table: sa.Table = sa.Table(
        "synthetic_root",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
    )
    mapper_registry: registry = registry()

    class SyntheticRoot:
        """Temporary mapped root for deep ownership-path construction."""

    mapper_registry.map_imperatively(SyntheticRoot, root_table)
    for index in range(path_length):
        sa.Table(
            f"owned_{index}",
            metadata,
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("owner_id", sa.Integer),
        )
    sa.Table(
        "leaf",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("owner_id", sa.Integer),
    )
    dependencies: tuple[DependencyPolicy, ...] = tuple(
        DependencyPolicy(
            DependencyKey(
                "foreign_key",
                "synthetic_root" if index == 0 else f"owned_{index - 1}",
                f"owned_{index}",
                ("id",),
                ("owner_id",),
                "inbound",
            ),
            DependencyClassification.OWNED,
        )
        for index in range(path_length)
    )
    policy: PurgeEntityPolicy = replace(
        get_purge_policy(Slice), model=SyntheticRoot, dependencies=dependencies
    )
    leaf: DependencyKey = DependencyKey(
        "foreign_key",
        f"owned_{path_length - 1}",
        "leaf",
        ("id",),
        ("owner_id",),
        "inbound",
    )

    assert _dependency_owner_depth(policy, leaf) == path_length
    predicates: tuple[Any, ...] = _dependency_predicates(
        policy, leaf, 1, metadata.tables["leaf"]
    )
    assert len(predicates) == 1
    mapper_registry.dispose()


def test_dependency_owner_depth_rejects_cycles() -> None:
    """Malformed ownership declarations fail clearly instead of looping."""
    first: DependencyPolicy = DependencyPolicy(
        DependencyKey("foreign_key", "owned_b", "owned_a", direction="inbound"),
        DependencyClassification.OWNED,
    )
    second: DependencyPolicy = DependencyPolicy(
        DependencyKey("foreign_key", "owned_a", "owned_b", direction="inbound"),
        DependencyClassification.OWNED,
    )
    policy: PurgeEntityPolicy = replace(
        get_purge_policy(Slice), dependencies=(first, second)
    )
    leaf: DependencyKey = DependencyKey("foreign_key", "owned_a", "leaf")

    with pytest.raises(RuntimeError, match="Cyclic ownership path"):
        _dependency_owner_depth(policy, leaf)


@pytest.mark.parametrize(
    ("model", "expected_targets"),
    [
        (
            Slice,
            (
                ("slices_version", "id"),
                ("dashboard_slices_version", "slice_id"),
            ),
        ),
        (
            Dashboard,
            (
                ("dashboards_version", "id"),
                ("dashboard_slices_version", "dashboard_id"),
            ),
        ),
        (
            SqlaTable,
            (
                ("tables_version", "id"),
                ("sql_metrics_version", "table_id"),
                ("table_columns_version", "table_id"),
            ),
        ),
    ],
)
def test_version_targets_are_policy_owned(
    model: type[Any], expected_targets: tuple[tuple[str, str], ...]
) -> None:
    """Root, association, and owned-child shadows come from the policy."""
    policy: PurgeEntityPolicy = get_purge_policy(model)

    assert policy.version_shadow_names == expected_targets


def test_version_target_resolution_rejects_invalid_declarations(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A shadow-table typo cannot silently leave version history behind."""
    from superset.commands.deletion_retention import purge_cascade

    metadata: sa.MetaData = sa.MetaData()
    parent_shadow: sa.Table = sa.Table(
        "slices_version", metadata, sa.Column("id", sa.Integer)
    )
    slice_policy: PurgeEntityPolicy = purge_policy_registry()[Slice]
    dependencies: tuple[DependencyPolicy, ...] = tuple(
        replace(
            dependency,
            key=replace(dependency.key, related_table="missing_version"),
        )
        if dependency.key.related_table == "slices_version"
        else dependency
        for dependency in slice_policy.dependencies
    )
    policy: PurgeEntityPolicy = replace(slice_policy, dependencies=dependencies)

    def fake_policy(_model: type[Any]) -> PurgeEntityPolicy:
        return policy

    monkeypatch.setattr(purge_cascade, "get_purge_policy", fake_policy)

    with pytest.raises(RuntimeError, match="missing_version.id"):
        purge_cascade._entity_version_targets(
            Slice, metadata, parent_shadow, entity_id=1
        )


def test_listener_registration_is_idempotent_and_symmetric() -> None:
    """Declared listener registration can safely repeat and clear."""

    def observe(*_args: Any) -> None:
        return None

    declaration: DeleteListenerDeclaration = DeleteListenerDeclaration(
        Slice,
        "test_observer",
        DeleteListenerEffect.OBSERVATIONAL,
        observe,
    )
    try:
        register_delete_listener(declaration)
        register_delete_listener(declaration)
        assert declaration in declared_delete_listeners()
    finally:
        remove_delete_listener(declaration)
    assert declaration not in declared_delete_listeners()


def test_listener_removal_rejects_a_conflicting_declaration() -> None:
    """Removal cannot erase a different declaration with the same key."""

    def first(*_args: Any) -> None:
        return None

    def conflicting(*_args: Any) -> None:
        return None

    declaration: DeleteListenerDeclaration = DeleteListenerDeclaration(
        Slice,
        "test_conflict",
        DeleteListenerEffect.OBSERVATIONAL,
        first,
    )
    conflicting_declaration: DeleteListenerDeclaration = DeleteListenerDeclaration(
        Slice,
        "test_conflict",
        DeleteListenerEffect.OBSERVATIONAL,
        conflicting,
    )
    try:
        register_delete_listener(declaration)
        with pytest.raises(ValueError, match="Conflicting delete-listener"):
            remove_delete_listener(conflicting_declaration)
        assert declaration in declared_delete_listeners()
    finally:
        remove_delete_listener(declaration)


@pytest.mark.parametrize("model", [Slice, Dashboard, SqlaTable])
def test_supported_root_after_delete_listeners_are_declared_and_installed(
    model: type[Any],
) -> None:
    """Every runtime root listener is represented in the listener catalog."""
    declarations: tuple[DeleteListenerDeclaration, ...] = tuple(
        declaration
        for declaration in declared_delete_listeners()
        if declaration.target is model
        and declaration.effect is not DeleteListenerEffect.OBSERVATIONAL
    )
    policy: PurgeEntityPolicy = get_purge_policy(model)

    assert {declaration.responsibility for declaration in declarations} <= set(
        policy.listener_responsibilities
    )
    assert all(
        sa.event.contains(model, "after_delete", declaration.listener)
        for declaration in declarations
    )
    installed_listeners: set[Any] = {
        cell.cell_contents
        for wrapper in model.__mapper__.dispatch.after_delete
        for cell in (wrapper.__closure__ or ())
        if callable(cell.cell_contents)
        and not getattr(cell.cell_contents, "__module__", "").startswith(
            "sqlalchemy_continuum"
        )
    }
    assert installed_listeners == {declaration.listener for declaration in declarations}


def test_delete_associations_rejects_unknown_entity_type() -> None:
    """An unsupported root cannot fall through to dataset cleanup."""
    from superset.commands.deletion_retention.purge_policy import delete_associations

    slice_policy: PurgeEntityPolicy = get_purge_policy(Slice)
    listener_dependencies: tuple[DependencyPolicy, ...] = tuple(
        dependency
        for dependency in slice_policy.dependencies
        if dependency.classification is DependencyClassification.LISTENER_EFFECT
    )
    policy: PurgeEntityPolicy = replace(
        slice_policy,
        entity_type="unsupported",
        dependencies=listener_dependencies,
    )

    with pytest.raises(ValueError, match="Unsupported purge entity type"):
        delete_associations(MagicMock(), policy, 1)


def test_association_owned_children_are_deleted_before_their_owner() -> None:
    """Association traversal deletes nested rows before their owning rows."""
    association: DependencyPolicy = DependencyPolicy(
        DependencyKey(
            "foreign_key",
            "slices",
            "dashboard_slices",
            ("id",),
            ("slice_id",),
            "inbound",
        ),
        DependencyClassification.ASSOCIATION,
    )
    association_child: DependencyPolicy = DependencyPolicy(
        DependencyKey(
            "foreign_key",
            "dashboard_slices",
            "dashboard_slices_version",
            ("dashboard_id", "slice_id"),
            ("dashboard_id", "slice_id"),
            "inbound",
        ),
        DependencyClassification.ASSOCIATION,
    )
    policy: PurgeEntityPolicy = replace(
        get_purge_policy(Slice),
        dependencies=(association, association_child),
    )
    session: MagicMock = MagicMock()

    delete_associations(session, policy, 7)

    statements: list[Any] = [call.args[0] for call in session.execute.call_args_list]
    assert [statement.table.name for statement in statements] == [
        "dashboard_slices_version",
        "dashboard_slices",
    ]
    assert "dashboard_slices.slice_id" in str(statements[0])
    assert "slices.id" in str(statements[0])


@pytest.mark.parametrize("dialect", ["sqlite", "postgresql", "mysql"])
def test_core_delete_actions_compile_for_supported_dialects(dialect: str) -> None:
    """Statements emitted by policy callbacks compile for supported dialects."""
    from sqlalchemy.dialects import mysql, postgresql, sqlite

    dialects: dict[str, Dialect] = {
        "sqlite": sqlite.dialect(),
        "postgresql": postgresql.dialect(),
        "mysql": mysql.dialect(),
    }
    compiled: list[str] = []
    for model in (Slice, Dashboard, SqlaTable):
        policy: PurgeEntityPolicy = get_purge_policy(model)
        session: MagicMock = MagicMock()
        session.execute.return_value.first.return_value = None
        validate_deletion_allowed(session, policy, 1)
        delete_associations(session, policy, 1)
        delete_owned_children(session, policy, 1)
        calls: list[Any] = list(session.execute.call_args_list)
        for call in calls:
            statement: Any = call.args[0]
            compiled.append(str(statement.compile(dialect=dialects[dialect])))
    claim: Select = sa.select(Slice.id).where(Slice.id == 1).with_for_update()
    compiled.append(str(claim.compile(dialect=dialects[dialect])))

    assert compiled
    # The only UPDATE detaches a purged dataset's preserved charts.
    assert all(
        statement.startswith(("SELECT", "DELETE", "UPDATE slices "))
        for statement in compiled
    )


#: Throwaway mapper registries created by the fixtures below, disposed after
#: each test. Left in place they stay in SQLAlchemy's global mapper state,
#: where ``configure_mappers()`` in the real-graph tests would walk them.
_HOST_MAPPERS: list[registry] = []


@pytest.fixture(autouse=True)
def _restore_soft_delete_registry() -> Iterator[None]:
    """Keep a test's throwaway mixin subclasses out of the live registry.

    ``SoftDeleteMixin.__init_subclass__`` appends to a process-global list
    when the class statement runs, so a subclass declared in a test body
    outlives the test: a later one scanning the registry finds a model with
    no policy and reports it unsupported. Restored in place, because other
    modules hold a reference to the same list.
    """
    registered: list[type[SoftDeleteMixin]] = SoftDeleteMixin._registered_subclasses  # noqa: SLF001
    snapshot: list[type[SoftDeleteMixin]] = list(registered)
    yield
    registered[:] = snapshot


@pytest.fixture(autouse=True)
def _dispose_host_mappers() -> Iterator[None]:
    """Drop the mappers a test mapped, as the deep-path test does."""
    yield
    while _HOST_MAPPERS:
        _HOST_MAPPERS.pop().dispose()


@pytest.fixture
def versioned_host_root(monkeypatch: pytest.MonkeyPatch) -> None:
    """Make any root resolve a version class.

    The root-relative version rules only come into play once the cascade
    reaches the root at all, which it does by resolving the root's own version
    class. A throwaway root has none, so these tests stand one in.
    """
    import sqlalchemy_continuum

    monkeypatch.setattr(sqlalchemy_continuum, "version_class", lambda model: model)


def _map_host_root(model: type[Any], table: sa.Table) -> type[Any]:
    """Map *model* onto *table* for the duration of one test."""
    mapper_registry: registry = registry()
    _HOST_MAPPERS.append(mapper_registry)
    mapper_registry.map_imperatively(model, table)
    return model


def _host_root(prefix: str) -> type[Any]:
    """Map a throwaway root in its own ``MetaData``.

    The hook is indifferent to a host root's shape, so this is the smallest
    graph with anything to declare: one outbound foreign key, the same edge
    every built-in policy preserves for its ``ab_user`` columns.
    """
    metadata: sa.MetaData = sa.MetaData()
    sa.Table(
        f"{prefix}_owner",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
    )
    root_table: sa.Table = sa.Table(
        f"{prefix}_entity",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("owner_id", sa.Integer, sa.ForeignKey(f"{prefix}_owner.id")),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
    )

    class HostRoot:
        """Temporary mapped root standing in for an entity core does not own."""

    return _map_host_root(HostRoot, root_table)


def _host_edge(prefix: str) -> DependencyPolicy:
    """The one dependency ``discover_dependencies`` finds for that root."""
    return DependencyPolicy(
        DependencyKey(
            "foreign_key",
            f"{prefix}_entity",
            f"{prefix}_owner",
            ("owner_id",),
            ("id",),
            "outbound",
        ),
        DependencyClassification.PRESERVE,
    )


def _host_policy(
    model: type[Any], dependencies: tuple[DependencyPolicy, ...]
) -> PurgeEntityPolicy:
    """Borrow the chart policy's actions for a host root.

    The documented clone pattern, kept as the fixture so the tests exercise
    what an integrator would actually write. The chart-specific snapshots it
    carries are inert on a host root: each resolves from an entity type a
    host cannot claim.
    """
    return replace(
        get_purge_policy(Slice),
        model=model,
        entity_type="host_root",
        dependencies=dependencies,
    )


@contextmanager
def _installed(provider: Any) -> Iterator[None]:
    """Install a host policy provider for the duration of one test.

    Typed loosely on purpose: some tests install a value that is not a
    provider at all, which is what the host boundary has to cope with.
    """
    previous: Any = current_app.config.get(HOST_POLICIES_CONFIG_KEY)
    current_app.config[HOST_POLICIES_CONFIG_KEY] = provider
    try:
        yield
    finally:
        current_app.config[HOST_POLICIES_CONFIG_KEY] = previous


def _assert_rejected(
    model: type[Any],
    policy: PurgeEntityPolicy,
    reason: str,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """A rejected declaration costs the host its root, with the reason logged.

    Rejection happens where the policy is admitted, so the root simply reads
    as unsupported -- the shape the retention task already reports -- rather
    than raising once per eligible row.
    """
    with _installed(lambda: [policy]), caplog.at_level(logging.ERROR):
        assert model not in purge_policy_registry()
        with pytest.raises(ValueError, match="Unsupported purge model"):
            get_purge_policy(model)
    assert reason in caplog.text


def test_host_policy_extends_the_registry() -> None:
    """A complete host declaration resolves like a built-in root."""
    model: type[Any] = _host_root("extend")
    policy: PurgeEntityPolicy = _host_policy(model, (_host_edge("extend"),))

    with _installed(lambda: [policy]):
        assert get_purge_policy(model) is policy
        assert {Slice, Dashboard, SqlaTable} <= set(purge_policy_registry())


def test_host_policy_is_held_to_the_discovered_graph(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """An incomplete host declaration is rejected, not silently honored."""
    model: type[Any] = _host_root("incomplete")

    _assert_rejected(model, _host_policy(model, ()), "Incomplete purge policy", caplog)


@pytest.mark.parametrize(
    "provider",
    [
        pytest.param(lambda: 1 // 0, id="raises"),
        pytest.param(lambda: "not-a-sequence", id="wrong_type"),
        pytest.param(lambda: [object()], id="wrong_member"),
    ],
)
def test_malformed_host_provider_leaves_builtin_roots_intact(
    provider: Callable[[], Any],
) -> None:
    """A broken host boundary costs the host its roots, not the purge."""
    with _installed(provider):
        assert set(purge_policy_registry()) == {Slice, Dashboard, SqlaTable}


def test_host_policies_need_an_app_context() -> None:
    """Off an app context the host's roots drop out; the built-ins remain.

    The provider lives in config, so there is nothing to read without an
    application context. Dropping the host's roots leaves them reported as
    unsupported, where propagating the Flask error would abort the whole
    scheduled run -- including the roots that do have policies.
    """
    model: type[Any] = _host_root("contextless")
    policy: PurgeEntityPolicy = _host_policy(model, (_host_edge("contextless"),))

    with (
        _installed(lambda: [policy]),
        patch(
            "superset.commands.deletion_retention.purge_policy.has_app_context",
            return_value=False,
        ),
    ):
        assert set(purge_policy_registry()) == {Slice, Dashboard, SqlaTable}


def test_duplicate_host_declarations_do_not_abort_the_registry() -> None:
    """Two policies for one host root drop that root, not the whole index."""
    model: type[Any] = _host_root("duplicate")
    policy: PurgeEntityPolicy = _host_policy(model, (_host_edge("duplicate"),))

    with _installed(lambda: [policy, policy]):
        assert set(purge_policy_registry()) == {Slice, Dashboard, SqlaTable}
        with pytest.raises(ValueError, match="Unsupported purge model"):
            get_purge_policy(model)


def test_host_policy_cannot_redeclare_a_builtin_root() -> None:
    """A host cannot redefine how a chart, dashboard or dataset is purged."""
    builtin: PurgeEntityPolicy = get_purge_policy(Slice)

    with _installed(lambda: [replace(builtin, dependencies=())]):
        assert purge_policy_registry()[Slice] is builtin


def _host_chain(prefix: str) -> type[Any]:
    """Map a root that reaches a detail table only through a link table."""
    metadata: sa.MetaData = sa.MetaData()
    root_table: sa.Table = sa.Table(
        f"{prefix}_entity",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
    )
    sa.Table(
        f"{prefix}_link",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entity_id", sa.Integer, sa.ForeignKey(f"{prefix}_entity.id")),
    )
    sa.Table(
        f"{prefix}_detail",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("link_id", sa.Integer, sa.ForeignKey(f"{prefix}_link.id")),
    )

    class HostChainRoot:
        """Temporary mapped root with a two-hop ownership path."""

    return _map_host_root(HostChainRoot, root_table)


def _host_chain_edges(
    prefix: str, link: DependencyClassification
) -> tuple[DependencyPolicy, ...]:
    """Classify the chain, varying only how the intermediate hop is declared."""
    entity: str = f"{prefix}_entity"
    link_table: str = f"{prefix}_link"
    detail: str = f"{prefix}_detail"
    link_phase: ExecutionPhase = (
        ExecutionPhase.ASSOCIATIONS
        if link is DependencyClassification.ASSOCIATION
        else ExecutionPhase.OWNED
    )
    return (
        DependencyPolicy(
            DependencyKey(
                "foreign_key", entity, link_table, ("id",), ("entity_id",), "inbound"
            ),
            link,
            link_phase,
        ),
        DependencyPolicy(
            DependencyKey(
                "foreign_key", link_table, detail, ("id",), ("link_id",), "inbound"
            ),
            DependencyClassification.OWNED,
            ExecutionPhase.OWNED,
        ),
        DependencyPolicy(
            DependencyKey(
                "foreign_key", link_table, entity, ("entity_id",), ("id",), "outbound"
            ),
            DependencyClassification.PRESERVE,
        ),
        DependencyPolicy(
            DependencyKey(
                "foreign_key", detail, link_table, ("link_id",), ("id",), "outbound"
            ),
            DependencyClassification.PRESERVE,
        ),
    )


def test_owned_table_behind_an_owned_link_is_accepted() -> None:
    """Declaring the intermediate hop owned puts both in the same phase."""
    model: type[Any] = _host_chain("owned")
    policy: PurgeEntityPolicy = _host_policy(
        model, _host_chain_edges("owned", DependencyClassification.OWNED)
    )

    with _installed(lambda: [policy]):
        assert get_purge_policy(model) is policy


def _host_bare_root(prefix: str, *columns: str) -> type[Any]:
    """Map a host root carrying only *columns*, to probe scan requirements."""
    available: dict[str, sa.Column[Any]] = {
        "id": sa.Column("id", sa.Integer, primary_key=True),
        "uuid": sa.Column("uuid", sa.String(36), primary_key=True),
        "deleted_at": sa.Column("deleted_at", sa.DateTime, nullable=True),
    }
    metadata: sa.MetaData = sa.MetaData()
    root_table: sa.Table = sa.Table(
        f"{prefix}_entity", metadata, *(available[name] for name in columns)
    )

    class HostBareRoot:
        """Temporary mapped root missing a column some purge path needs."""

    return _map_host_root(HostBareRoot, root_table)


def _host_referenced(prefix: str) -> type[Any]:
    """Map a host root with one inbound foreign key and nothing else."""
    metadata: sa.MetaData = sa.MetaData()
    root_table: sa.Table = sa.Table(
        f"{prefix}_entity",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
    )
    sa.Table(
        f"{prefix}_ref",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entity_id", sa.Integer, sa.ForeignKey(f"{prefix}_entity.id")),
    )

    class HostReferencedRoot:
        """Temporary mapped root referenced by one other table."""

    return _map_host_root(HostReferencedRoot, root_table)


def _inbound_ref_key(prefix: str) -> DependencyKey:
    return DependencyKey(
        "foreign_key",
        f"{prefix}_entity",
        f"{prefix}_ref",
        ("id",),
        ("entity_id",),
        "inbound",
    )


def _host_tree(prefix: str) -> type[Any]:
    """Map a host root whose table owns itself through a parent column."""
    metadata: sa.MetaData = sa.MetaData()
    root_table: sa.Table = sa.Table(
        f"{prefix}_node",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("parent_id", sa.Integer, sa.ForeignKey(f"{prefix}_node.id")),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
    )

    class HostTreeRoot:
        """Temporary mapped root with a recursive sub-tree."""

    return _map_host_root(HostTreeRoot, root_table)


def _host_tree_edges(prefix: str) -> tuple[DependencyPolicy, ...]:
    node: str = f"{prefix}_node"
    return (
        DependencyPolicy(
            DependencyKey(
                "foreign_key", node, node, ("id",), ("parent_id",), "inbound"
            ),
            DependencyClassification.OWNED,
            ExecutionPhase.OWNED,
        ),
        DependencyPolicy(
            DependencyKey(
                "foreign_key", node, node, ("parent_id",), ("id",), "outbound"
            ),
            DependencyClassification.PRESERVE,
        ),
    )


def test_root_without_an_id_column_is_rejected(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """The scheduled scan pages by id, so a root must have one."""
    model: type[Any] = _host_bare_root("uuidonly", "uuid")

    _assert_rejected(model, _host_policy(model, ()), "has no 'id' column", caplog)


def test_self_referencing_owned_table_accepts_declared_subtree_cleanup() -> None:
    """A policy that says it walks the sub-tree may declare the shape."""
    model: type[Any] = _host_tree("customtree")
    policy: PurgeEntityPolicy = replace(
        _host_policy(model, _host_tree_edges("customtree")),
        delete_owned_children=lambda session, policy, entity_id: None,
        walks_own_subtree=True,
    )

    with _installed(lambda: [policy]):
        assert get_purge_policy(model) is policy


def test_discovery_walks_each_recursive_table_once(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Traversal is per table, not per permutation of tables.

    Five link tables walked per permutation is already hundreds of visits;
    a dozen is billions, which a host root could reach before any row is
    purged.
    """
    metadata: sa.MetaData = sa.MetaData()
    root_table: sa.Table = sa.Table(
        "wide_entity",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
    )
    link_names: list[str] = [f"wide_link{index}" for index in range(5)]
    for name in link_names:
        sa.Table(
            name,
            metadata,
            sa.Column("id", sa.Integer, primary_key=True),
            sa.Column("entity_id", sa.Integer, sa.ForeignKey("wide_entity.id")),
        )

    class WideRoot:
        """Temporary mapped root owning several independent link tables."""

    _map_host_root(WideRoot, root_table)

    walked: list[str] = []
    original = purge_policy_module._discover_table_dependencies  # noqa: SLF001

    def counting(table: sa.Table, recursive_tables: Any, seen: Any) -> Any:
        walked.append(table.name)
        return original(table, recursive_tables, seen)

    monkeypatch.setattr(purge_policy_module, "_discover_table_dependencies", counting)

    discover_dependencies(sa.inspect(WideRoot), recursive_tables=frozenset(link_names))

    assert sorted(walked) == sorted(link_names)


def test_root_without_a_deleted_at_column_is_rejected(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Every purge path requires the row to be archived first."""
    model: type[Any] = _host_bare_root("noflag", "id")

    _assert_rejected(model, _host_policy(model, ()), "no 'deleted_at' column", caplog)


def test_discovery_keeps_a_child_version_shadow_reached_through_its_mapper() -> None:
    """A table walked plainly sees fewer edges than one walked as a mapper.

    ``sql_metrics`` is reachable both ways from the dataset root. Tracking the
    two kinds of walk together, rather than separately, dropped its version
    shadow -- which then reads as a stale declaration on the dataset policy.
    This pins the edge the split exists to preserve.
    """
    configure_mappers()
    policy: PurgeEntityPolicy = get_purge_policy(SqlaTable)
    recursive_tables: frozenset[str] = frozenset(
        dependency.key.related_table
        for dependency in policy.dependencies
        if dependency.classification
        in {
            DependencyClassification.OWNED,
            DependencyClassification.ASSOCIATION,
        }
    )

    discovered: frozenset[DependencyKey] = discover_dependencies(
        sa.inspect(SqlaTable), recursive_tables=recursive_tables
    )

    assert (
        DependencyKey(
            kind="relationship",
            owner_table="sql_metrics",
            related_table="sql_metrics_version",
            direction="onetomany",
            relationship="versions",
        )
        in discovered
    )


def test_provider_is_invoked_once_however_many_roots_resolve() -> None:
    """The index is cached per provider, so a slow provider runs once."""
    model: type[Any] = _host_root("once")
    policy: PurgeEntityPolicy = _host_policy(model, (_host_edge("once"),))
    invocations: list[int] = []

    def provider() -> list[PurgeEntityPolicy]:
        invocations.append(1)
        return [policy]

    with _installed(provider):
        for _ in range(5):
            assert get_purge_policy(model) is policy
            assert get_purge_policy(Slice) is not None

    assert len(invocations) == 1


def test_host_policy_claiming_a_built_in_entity_type_is_dropped(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Core branches on entity_type, so its names are reserved."""
    model: type[Any] = _host_root("claimed")
    policy: PurgeEntityPolicy = replace(
        _host_policy(model, (_host_edge("claimed"),)), entity_type="dataset"
    )

    _assert_rejected(model, policy, "reserved entity type", caplog)


@pytest.mark.parametrize(
    "root",
    [
        pytest.param(
            sa.Table(
                "host_not_a_class",
                sa.MetaData(),
                sa.Column("id", sa.Integer, primary_key=True),
            ),
            id="table",
        ),
        pytest.param([], id="unhashable"),
    ],
)
def test_host_policy_with_a_non_class_root_is_dropped(
    root: Any, caplog: pytest.LogCaptureFixture
) -> None:
    """A root that is not a class is dropped without touching the index.

    Reading or hashing it must not happen before the boundary can refuse it:
    an exception escaping here would break the registry for the built-in
    roots too.
    """
    policy: PurgeEntityPolicy = replace(
        get_purge_policy(Slice), model=root, entity_type="host_root", dependencies=()
    )

    with _installed(lambda: [policy]), caplog.at_level(logging.ERROR):
        assert set(purge_policy_registry()) == {Slice, Dashboard, SqlaTable}

    assert "is not a class" in caplog.text


def test_host_policies_may_arrive_as_any_iterable() -> None:
    """The contract is a sequence of policies, not one particular container."""
    model: type[Any] = _host_root("generated")
    policy: PurgeEntityPolicy = _host_policy(model, (_host_edge("generated"),))

    with _installed(lambda: (item for item in [policy])):
        assert get_purge_policy(model) is policy


def test_root_with_a_composite_primary_key_is_rejected(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """The scan pages by id and then fetches the row with a scalar lookup.

    A composite key matches nothing, so every row fails while a dry run still
    counts it as purgeable.
    """
    metadata: sa.MetaData = sa.MetaData()
    root_table: sa.Table = sa.Table(
        "composite_entity",
        metadata,
        sa.Column("tenant_id", sa.Integer, primary_key=True),
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
    )

    class CompositeRoot:
        """Temporary mapped root keyed on two columns."""

    _map_host_root(CompositeRoot, root_table)

    _assert_rejected(
        CompositeRoot, _host_policy(CompositeRoot, ()), "is keyed on", caplog
    )


def test_version_target_on_an_intermediate_owner_is_rejected(
    caplog: pytest.LogCaptureFixture,
    versioned_host_root: None,
) -> None:
    """Version cleanup compares the declared column with the root's id.

    A column that is not root-relative matches another root's history and
    leaves this root's behind.
    """
    model: type[Any] = _host_referenced("versioned")
    declared: tuple[DependencyPolicy, ...] = (
        DependencyPolicy(
            DependencyKey(
                "relationship",
                "versioned_ref",
                "versioned_ref_version",
                direction="onetomany",
                relationship="versions",
            ),
            DependencyClassification.VERSION_OWNED,
            ExecutionPhase.VERSION,
            version_column="id",
        ),
    )

    _assert_rejected(
        model, _host_policy(model, declared), "is not root-relative", caplog
    )


def test_root_whose_table_name_is_ambiguous_is_rejected(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Identities are recorded by bare name while metadata keys them by schema.

    With the same bare name in two schemas, cleanup would resolve to the
    default-schema table and delete rows belonging to unrelated roots.
    """
    metadata: sa.MetaData = sa.MetaData()
    sa.Table(
        "ambiguous_entity",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
    )
    qualified: sa.Table = sa.Table(
        "ambiguous_entity",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
        schema="host",
    )

    class QualifiedRoot:
        """Temporary mapped root living in a named schema."""

    _map_host_root(QualifiedRoot, qualified)

    _assert_rejected(
        QualifiedRoot,
        _host_policy(QualifiedRoot, ()),
        "unambiguously by name",
        caplog,
    )


def test_provider_may_build_on_a_built_in_policy() -> None:
    """Borrowing a built-in policy inside the provider must not stall.

    ``replace(get_purge_policy(Slice), ...)`` is the obvious way for a host to
    pick up the stock callbacks, and it re-enters resolution while the first
    call is still inside the provider. Run on a thread so a regression here
    surfaces as a timeout rather than hanging the suite.
    """
    app = current_app._get_current_object()  # noqa: SLF001
    model: type[Any] = _host_root("reentrant")

    def provider() -> list[PurgeEntityPolicy]:
        # _host_policy itself resolves the chart policy, which is the
        # re-entrant call under test.
        return [_host_policy(model, (_host_edge("reentrant"),))]

    resolved: list[PurgeEntityPolicy] = []

    def resolve() -> None:
        with app.app_context():
            resolved.append(get_purge_policy(model))

    with _installed(provider):
        thread = threading.Thread(target=resolve)
        thread.start()
        thread.join(timeout=10)

    assert not thread.is_alive(), "resolution did not finish: re-entry stalled"
    assert len(resolved) == 1
    assert resolved[0].model is model


def test_concurrent_first_use_publishes_a_whole_index() -> None:
    """Each caller sees a complete index, never a half-built one.

    Two first uses may each invoke the provider -- the deliberate trade for
    not holding a lock across host code -- but publishing is a single rebind,
    so neither sees a partial result.
    """
    app = current_app._get_current_object()  # noqa: SLF001
    model: type[Any] = _host_root("concurrent")
    policy: PurgeEntityPolicy = _host_policy(model, (_host_edge("concurrent"),))
    both_ready: threading.Barrier = threading.Barrier(2)

    def provider() -> list[PurgeEntityPolicy]:
        time.sleep(0.05)
        return [policy]

    seen: list[tuple[PurgeEntityPolicy, set[type[Any]]]] = []

    def resolve() -> None:
        with app.app_context():
            both_ready.wait(timeout=5)
            seen.append((get_purge_policy(model), set(purge_policy_registry())))

    with _installed(provider):
        threads: list[threading.Thread] = [
            threading.Thread(target=resolve) for _ in range(2)
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=10)

    assert len(seen) == 2
    for found, roots in seen:
        assert found is policy
        assert {Slice, Dashboard, SqlaTable} <= roots


def test_root_with_a_non_integer_id_is_rejected(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """The scan pages an integer watermark, starting from zero."""
    metadata: sa.MetaData = sa.MetaData()
    root_table: sa.Table = sa.Table(
        "stringid_entity",
        metadata,
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
    )

    class StringIdRoot:
        """Temporary mapped root keyed on a string id."""

    _map_host_root(StringIdRoot, root_table)

    _assert_rejected(
        StringIdRoot, _host_policy(StringIdRoot, ()), "integer 'id'", caplog
    )


def test_version_target_keyed_on_a_non_primary_root_column_is_rejected(
    caplog: pytest.LogCaptureFixture,
    versioned_host_root: None,
) -> None:
    """Cleanup compares the target with the root's id, not another column.

    A child keyed on some other root column matches rows whose value happens
    to equal this root's id -- another root's history.
    """
    metadata: sa.MetaData = sa.MetaData()
    root_table: sa.Table = sa.Table(
        "coded_entity",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("code", sa.Integer, unique=True),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
    )
    sa.Table(
        "coded_child",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("root_code", sa.Integer, sa.ForeignKey("coded_entity.code")),
    )

    class CodedRoot:
        """Temporary mapped root whose child is keyed on a non-primary column."""

    _map_host_root(CodedRoot, root_table)
    declared: tuple[DependencyPolicy, ...] = (
        DependencyPolicy(
            DependencyKey(
                "relationship",
                "coded_child",
                "coded_child_version",
                direction="onetomany",
                relationship="versions",
            ),
            DependencyClassification.VERSION_OWNED,
            ExecutionPhase.VERSION,
            version_column="root_code",
        ),
    )

    _assert_rejected(
        CodedRoot, _host_policy(CodedRoot, declared), "is not root-relative", caplog
    )


@pytest.mark.parametrize(
    "classification",
    [
        pytest.param(DependencyClassification.BLOCK, id="block"),
        pytest.param(DependencyClassification.LISTENER_EFFECT, id="listener_effect"),
    ],
)
def test_host_policy_declaring_core_only_dependencies_is_dropped(
    classification: DependencyClassification, caplog: pytest.LogCaptureFixture
) -> None:
    """Both resolve from core's own identities, so a host declaration is silent.

    The stock listener actions decide what to delete from a built-in entity
    type, and blockers are applied by the stock validator. Declared by a host
    either one is accepted and then never carried out -- the one outcome worth
    refusing, since nothing announces it. A host refuses a purge by raising
    PurgeBlockedError from its own validator instead.
    """
    model: type[Any] = _host_referenced("coreonly")
    declared: tuple[DependencyPolicy, ...] = (
        DependencyPolicy(
            _inbound_ref_key("coreonly"),
            classification,
            ExecutionPhase.VALIDATE,
            blocker=BlockerReason("host_reference", "a reference exists"),
            listener_action=ListenerAction.DELETE_TAGGED_OBJECTS,
        ),
    )

    _assert_rejected(
        model, _host_policy(model, declared), "not available to a host root", caplog
    )


def test_owned_table_behind_an_association_is_rejected(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Associations are emptied first, so owning through one cannot execute.

    Kept where the other ordering rules were dropped because this one can be
    silent: without enforced foreign keys the root purges and its descendants
    are orphaned with nothing reported.
    """
    model: type[Any] = _host_chain("behind")
    policy: PurgeEntityPolicy = _host_policy(
        model, _host_chain_edges("behind", DependencyClassification.ASSOCIATION)
    )

    _assert_rejected(model, policy, "associations are deleted first", caplog)


def test_a_failing_provider_is_not_called_again_on_every_read() -> None:
    """A failure answers reads for a while instead of re-running the provider.

    The registry is read roughly three times per purged entity, so retrying
    per read meant tens of thousands of provider calls -- and tracebacks --
    in a single pass.
    """
    calls: list[int] = []

    def provider() -> list[PurgeEntityPolicy]:
        calls.append(1)
        raise RuntimeError("manager unreachable")

    with _installed(provider):
        for _ in range(4):
            assert set(purge_policy_registry()) == {Slice, Dashboard, SqlaTable}

    assert len(calls) == 1


def test_a_failing_provider_is_tried_again_once_its_window_passes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """And not remembered for the life of the process either.

    The window is set to zero here so the published failure is already stale,
    which is what a later purge sees after a transient outage.
    """
    monkeypatch.setattr(purge_policy_module, "_PROVIDER_RETRY_SECONDS", 0.0)
    model: type[Any] = _host_root("transient")
    policy: PurgeEntityPolicy = _host_policy(model, (_host_edge("transient"),))
    calls: list[int] = []

    def provider() -> list[PurgeEntityPolicy]:
        calls.append(1)
        if len(calls) == 1:
            raise RuntimeError("manager unreachable")
        return [policy]

    with _installed(provider):
        assert model not in purge_policy_registry()
        assert get_purge_policy(model) is policy

    assert len(calls) == 2


def test_replacing_only_the_association_delete_still_refuses_the_shape(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """The orphaning hazard belongs to the stock owned cleanup alone.

    Whoever empties the association rows, the stock owned delete still
    traverses an ownership path that is empty by the time it runs.
    """
    model: type[Any] = _host_chain("assoconly")
    policy: PurgeEntityPolicy = replace(
        _host_policy(
            model, _host_chain_edges("assoconly", DependencyClassification.ASSOCIATION)
        ),
        delete_associations=lambda session, policy, entity_id: None,
    )

    _assert_rejected(model, policy, "associations are deleted first", caplog)


def test_self_referencing_owned_table_rejects_stock_cleanup(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Stock cleanup prunes one level, which orphans a deeper tree.

    Loud where foreign keys are enforced, silent on SQLite: the root is
    purged and its grandchildren keep a dangling parent id.
    """
    model: type[Any] = _host_tree("stocktree")
    policy: PurgeEntityPolicy = _host_policy(model, _host_tree_edges("stocktree"))

    _assert_rejected(model, policy, "must supply its own", caplog)


def test_self_referencing_version_target_is_rejected(
    caplog: pytest.LogCaptureFixture,
    versioned_host_root: None,
) -> None:
    """A parent column on the root's own shadow is not the root's identity.

    Cleanup compares it with the purged row's id, so it deletes that row's
    children's history and leaves its own behind.
    """
    model: type[Any] = _host_tree("selfversion")
    declared: tuple[DependencyPolicy, ...] = (
        *_host_tree_edges("selfversion"),
        DependencyPolicy(
            DependencyKey(
                "relationship",
                "selfversion_node",
                "selfversion_node_version",
                direction="onetomany",
                relationship="versions",
            ),
            DependencyClassification.VERSION_OWNED,
            ExecutionPhase.VERSION,
            version_column="parent_id",
        ),
    )
    policy: PurgeEntityPolicy = replace(
        _host_policy(model, declared),
        delete_owned_children=lambda session, policy, entity_id: None,
    )

    _assert_rejected(model, policy, "is not root-relative", caplog)


def test_each_app_resolves_its_own_index(app_context: None) -> None:
    """Two apps in one process do not thrash a single global snapshot.

    Without per-app state each read from either app would see the other's
    provider, re-resolve, and call the provider again -- once per root.
    """
    from superset.app import SupersetApp

    first = current_app._get_current_object()  # noqa: SLF001
    model: type[Any] = _host_root("perapp")
    policy: PurgeEntityPolicy = _host_policy(model, (_host_edge("perapp"),))
    calls: list[int] = []

    def provider() -> list[PurgeEntityPolicy]:
        calls.append(1)
        return [policy]

    second = SupersetApp(__name__)
    second.config.update(first.config)
    second.config[HOST_POLICIES_CONFIG_KEY] = None

    with _installed(provider):
        assert get_purge_policy(model) is policy
        with second.app_context():
            # The second app has no provider, so its index carries only the
            # built-in roots -- and resolving it must not disturb the first.
            assert model not in purge_policy_registry()
        assert get_purge_policy(model) is policy

    assert len(calls) == 1


def test_a_lazy_payload_that_raises_is_retried_like_the_call(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Walking a generator runs host code, so it earns the provider's retry.

    Reading a lazy payload can fail for the same transient reasons calling
    the provider can; only the shape of a payload that arrived intact is
    settled for good.
    """
    monkeypatch.setattr(purge_policy_module, "_PROVIDER_RETRY_SECONDS", 0.0)
    model: type[Any] = _host_root("lazy")
    policy: PurgeEntityPolicy = _host_policy(model, (_host_edge("lazy"),))
    calls: list[int] = []

    def provider() -> Iterator[PurgeEntityPolicy]:
        calls.append(1)
        if len(calls) == 1:
            raise RuntimeError("manager unreachable")
            yield policy  # pragma: no cover - unreachable, keeps this a generator
        yield policy

    with _installed(provider):
        assert model not in purge_policy_registry()
        assert get_purge_policy(model) is policy

    assert len(calls) == 2


def test_version_target_on_an_unversioned_root_is_rejected(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """The cascade stops before a declared target when the root has none.

    It resolves the root's own version class first, so for an unversioned root
    a target on a child's shadow is never reached: the root and its live child
    rows are purged while the child's history survives, unreported.
    """
    model: type[Any] = _host_referenced("unversioned")
    declared: tuple[DependencyPolicy, ...] = (
        DependencyPolicy(
            DependencyKey(
                "relationship",
                "unversioned_ref",
                "unversioned_ref_version",
                direction="onetomany",
                relationship="versions",
            ),
            DependencyClassification.VERSION_OWNED,
            ExecutionPhase.VERSION,
            version_column="entity_id",
        ),
    )

    _assert_rejected(
        model, _host_policy(model, declared), "has no version class", caplog
    )


def test_host_policy_mapped_onto_a_built_in_table_is_dropped(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """A different class on a built-in table is still this package's rows.

    It is not the built-in root by identity, so the class check alone admits
    it -- and then host cleanup runs against ``slices``. Inheriting the mixin
    also puts it in the soft-delete registry, so the scheduled task would
    scan it.
    """

    class HostSliceClone(Slice):
        """A host root mapped onto the chart table."""

    policy: PurgeEntityPolicy = replace(
        get_purge_policy(Slice),
        model=HostSliceClone,
        entity_type="host_root",
        dependencies=(),
    )

    with _installed(lambda: [policy]), caplog.at_level(logging.ERROR):
        assert set(purge_policy_registry()) == {Slice, Dashboard, SqlaTable}

    assert "mapped onto built-in table" in caplog.text


def test_wrapping_the_shared_cleanup_does_not_exempt_a_tree(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Keeping the shared cleanup's behavior while defeating an identity test.

    A ``partial`` of it is a different object but deletes exactly one level,
    so the shape is still wrong. The exemption is a declared field for that
    reason: what matters is whether the policy walks the sub-tree, not which
    object it holds.
    """
    model: type[Any] = _host_tree("wrapped")
    policy: PurgeEntityPolicy = replace(
        _host_policy(model, _host_tree_edges("wrapped")),
        delete_owned_children=partial(delete_owned_children),
    )

    _assert_rejected(model, policy, "must supply its own", caplog)


def test_a_non_callable_config_value_is_reported_once(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """A static misconfiguration, not an outage, so it is not retried.

    Assigning the policies directly rather than a callable returning them is
    an easy mistake; retrying it would log a traceback every window for the
    life of the process.
    """
    model: type[Any] = _host_root("notcallable")
    policy: PurgeEntityPolicy = _host_policy(model, (_host_edge("notcallable"),))

    with _installed([policy]), caplog.at_level(logging.ERROR):
        for _ in range(3):
            assert set(purge_policy_registry()) == {Slice, Dashboard, SqlaTable}

    assert caplog.text.count("not a callable returning policies") == 1


def test_host_policy_without_a_usable_entity_type_is_dropped(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """The cascade, the audit record and the logs all read it as a string."""
    model: type[Any] = _host_root("notype")
    policy: PurgeEntityPolicy = replace(
        _host_policy(model, (_host_edge("notype"),)),
        # The field is declared ``str``; a host reaching admission with None
        # is exactly what the check exists for.
        entity_type=None,  # type: ignore[arg-type]
    )

    _assert_rejected(model, policy, "declares entity_type", caplog)


def test_a_root_with_its_own_delete_listener_can_be_admitted() -> None:
    """A registered listener must not make a host root unpolicyable.

    Coverage reports the listener responsibility as missing, and the only
    declaration that answers it is one this package refuses for a host root.
    Saying the cleanup accounts for it is the way out.
    """
    model: type[Any] = _host_root("ownlistener")
    declaration: DeleteListenerDeclaration = DeleteListenerDeclaration(
        target=model,
        responsibility="probe_audit_row",
        effect=DeleteListenerEffect.PERSISTENT_RECORD,
        listener=lambda *args, **kwargs: None,
    )
    register_delete_listener(declaration)
    try:
        refused: PurgeEntityPolicy = _host_policy(model, (_host_edge("ownlistener"),))
        with _installed(lambda: [refused]):
            assert model not in purge_policy_registry()

        accounted: PurgeEntityPolicy = replace(refused, accounts_for_own_listeners=True)
        with _installed(lambda: [accounted]):
            assert get_purge_policy(model) is accounted
    finally:
        remove_delete_listener(declaration)


def test_root_typing_uuid_as_a_character_based_uuid_is_rejected(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """The third column the frame reads, gated like the other two.

    The locked claim and the conditional delete carry ``uuid == str(...)``,
    and a character-based UUID type rejects that on every dialect, so every
    eligible row would raise and stay archived while a dry run counted it
    purgeable.
    """
    metadata: sa.MetaData = sa.MetaData()
    root_table: sa.Table = sa.Table(
        "charuuid_entity",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("uuid", sa.Uuid(native_uuid=False)),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
    )

    class CharUuidRoot:
        """Temporary mapped root whose uuid is stored as characters."""

    _map_host_root(CharUuidRoot, root_table)

    _assert_rejected(
        CharUuidRoot, _host_policy(CharUuidRoot, ()), "character-based", caplog
    )


def test_root_typing_uuid_as_a_native_uuid_is_admitted() -> None:
    """A native UUID column binds the string cleanly where the database has one.

    Refusing it would cost a Postgres host a declaration that works; the
    dialects without a native type reject it per row, which the docs say.
    """
    metadata: sa.MetaData = sa.MetaData()
    root_table: sa.Table = sa.Table(
        "nativeuuid_entity",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("uuid", sa.Uuid()),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
    )

    class NativeUuidRoot:
        """Temporary mapped root whose uuid uses the database's own type."""

    _map_host_root(NativeUuidRoot, root_table)
    policy: PurgeEntityPolicy = _host_policy(NativeUuidRoot, ())

    with _installed(lambda: [policy]):
        assert get_purge_policy(NativeUuidRoot) is policy


def test_a_root_using_the_sqlalchemy_utils_uuid_type_is_admitted() -> None:
    """The type the built-in roots use accepts the string, so it is fine.

    Pinned because the check above rests on these two types being unrelated.
    """
    from sqlalchemy_utils import UUIDType

    metadata: sa.MetaData = sa.MetaData()
    root_table: sa.Table = sa.Table(
        "utilsuuid_entity",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("uuid", UUIDType(binary=True)),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
    )

    class UtilsUuidRoot:
        """Temporary mapped root using the type the built-in roots use."""

    _map_host_root(UtilsUuidRoot, root_table)
    policy: PurgeEntityPolicy = _host_policy(UtilsUuidRoot, ())

    with _installed(lambda: [policy]):
        assert get_purge_policy(UtilsUuidRoot) is policy


def test_self_referencing_association_is_rejected(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """An association edge onto the root's own table deletes live rows.

    The shared association cleanup issues one ``DELETE`` per edge, so this
    one removes the purged row's unarchived children with none of the frame's
    eligibility predicates and no audit record. The owned spelling of the
    same shape is already refused; this one reached the cleanup because only
    ``OWNED`` was checked.
    """
    metadata: sa.MetaData = sa.MetaData()
    root_table: sa.Table = sa.Table(
        "selfassoc_entity",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("parent_id", sa.Integer, sa.ForeignKey("selfassoc_entity.id")),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
    )

    class SelfAssocRoot:
        """Temporary mapped root whose rows reference one another."""

    _map_host_root(SelfAssocRoot, root_table)
    dependencies: tuple[DependencyPolicy, ...] = (
        DependencyPolicy(
            DependencyKey(
                "foreign_key",
                "selfassoc_entity",
                "selfassoc_entity",
                ("id",),
                ("parent_id",),
                "inbound",
            ),
            DependencyClassification.ASSOCIATION,
        ),
        DependencyPolicy(
            DependencyKey(
                "foreign_key",
                "selfassoc_entity",
                "selfassoc_entity",
                ("parent_id",),
                ("id",),
                "outbound",
            ),
            DependencyClassification.PRESERVE,
        ),
    )
    policy: PurgeEntityPolicy = _host_policy(SelfAssocRoot, dependencies)

    _assert_rejected(SelfAssocRoot, policy, "root's own table", caplog)
    # walks_own_subtree speaks for delete_owned_children, not for the
    # association phase, so it does not exempt this.
    _assert_rejected(
        SelfAssocRoot,
        replace(policy, walks_own_subtree=True),
        "root's own table",
        caplog,
    )


@pytest.mark.parametrize("related_table", ["slices", "report_schedule", "ab_user"])
def test_executable_dependency_on_a_superset_table_is_rejected(
    related_table: str,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """A host root cannot have the shared cleanup delete this package's rows.

    An owned or association edge is executed as one ``DELETE`` against the
    named table, with no eligibility predicate, no blocker and no audit
    record. A root table loses charts, dashboards or datasets;
    ``report_schedule`` loses the very rows the built-in blocker exists to
    protect; ``ab_user`` loses users. None of them is the host's to clear
    this way -- those references are its own to handle in its own callbacks,
    which ``PRESERVE`` leaves it free to do.
    """
    model: type[Any] = _host_root(f"into{related_table}")
    dependencies: tuple[DependencyPolicy, ...] = (
        _host_edge(f"into{related_table}"),
        DependencyPolicy(
            DependencyKey(
                "foreign_key",
                f"into{related_table}_entity",
                related_table,
                ("id",),
                ("id",),
                "inbound",
            ),
            DependencyClassification.ASSOCIATION,
        ),
    )

    _assert_rejected(
        model, _host_policy(model, dependencies), "Superset-owned tables", caplog
    )


def test_two_host_roots_on_one_table_are_both_dropped(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """One table, two roots: which declarations apply is an accident.

    The index keys on the model and the scan iterates models, so both are
    scanned and a row is purged under whichever set of declarations reaches
    it first. A child one policy owns and the other preserves is then cleaned
    or orphaned by that accident, so neither is kept -- the same call made
    for two declarations of one model.
    """
    metadata: sa.MetaData = sa.MetaData()
    root_table: sa.Table = sa.Table(
        "twin_entity",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
    )

    class TwinA:
        """One of two temporary roots sharing a table."""

    class TwinB:
        """The other."""

    for model in (TwinA, TwinB):
        _map_host_root(model, root_table)

    policies: list[PurgeEntityPolicy] = [
        replace(_host_policy(TwinA, ()), entity_type="twin_a"),
        replace(_host_policy(TwinB, ()), entity_type="twin_b"),
    ]

    with _installed(lambda: policies), caplog.at_level(logging.ERROR):
        roots = set(purge_policy_registry())
        assert TwinA not in roots
        assert TwinB not in roots
        assert {Slice, Dashboard, SqlaTable} <= roots
    assert "mapped onto table" in caplog.text


def test_host_root_named_after_a_builtin_entity_kind_is_rejected(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """The version cascade resolves an entity kind from the bare class name.

    ``_delete_version_history`` maps ``model.__name__`` through
    ``ENTITY_KIND_BY_CLASS_NAME``, so a host class sharing one of those names
    deletes the ``version_changes`` rows of the built-in entity carrying the
    same id -- live rows, not only archived ones. A fourth reserved identity
    alongside the model, its table and its entity type.
    """
    from superset.versioning.changes import ENTITY_KIND_BY_CLASS_NAME

    metadata: sa.MetaData = sa.MetaData()
    root_table: sa.Table = sa.Table(
        "host_dashboards",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
    )
    # Named for the collision, with its own table and its own entity type:
    # every other reserved identity is clear.
    model: type[Any] = type("Dashboard", (), {"__doc__": "host root"})
    assert model.__name__ in ENTITY_KIND_BY_CLASS_NAME
    _map_host_root(model, root_table)

    _assert_rejected(model, _host_policy(model, ()), "built-in entity kind", caplog)


def test_version_target_that_is_not_a_shadow_is_rejected(
    versioned_host_root: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """A version target resolves by name, so a live table name deletes live rows.

    ``_entity_version_targets`` looks the declared name up in the live
    metadata. Without the ``_version`` suffix that lookup finds a real table
    and the version phase deletes from it -- rows a ``PRESERVE`` declaration
    meant to keep -- while the history the target named survives untouched.
    """
    metadata: sa.MetaData = sa.MetaData()
    root_table: sa.Table = sa.Table(
        "liveversion_entity",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
    )
    sa.Table(
        "liveversion_note",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("entity_id", sa.Integer, sa.ForeignKey("liveversion_entity.id")),
    )

    class LiveVersionRoot:
        """Temporary mapped root whose notes are meant to be preserved."""

    _map_host_root(LiveVersionRoot, root_table)
    dependencies: tuple[DependencyPolicy, ...] = (
        DependencyPolicy(
            DependencyKey(
                "foreign_key",
                "liveversion_entity",
                "liveversion_note",
                ("id",),
                ("entity_id",),
                "inbound",
            ),
            DependencyClassification.PRESERVE,
        ),
        DependencyPolicy(
            DependencyKey(
                "synthetic",
                "liveversion_entity",
                "liveversion_note",
                relationship="note_history",
            ),
            DependencyClassification.VERSION_OWNED,
            ExecutionPhase.VERSION,
            version_column="entity_id",
        ),
    )

    _assert_rejected(
        LiveVersionRoot,
        _host_policy(LiveVersionRoot, dependencies),
        "is not a '_version' shadow",
        caplog,
    )


def test_a_late_provider_failure_does_not_replace_a_good_index() -> None:
    """A caller that fails after another published must not undo the publish.

    Both callers share one provider, so the snapshot the slow one finds on
    its way out is the fast one's. Without the guard it would publish the
    built-in roots with a retry deadline instead, and the host root would
    read as unsupported for that whole window.
    """
    app = current_app._get_current_object()  # noqa: SLF001
    model: type[Any] = _host_root("latefailure")
    policy: PurgeEntityPolicy = _host_policy(model, (_host_edge("latefailure"),))
    slow_inside: threading.Event = threading.Event()
    fast_published: threading.Event = threading.Event()
    calls: list[str] = []

    def provider() -> list[PurgeEntityPolicy]:
        calls.append(threading.current_thread().name)
        if threading.current_thread().name == "slow":
            # Hold the slow caller inside host code until the fast one has
            # published, so its failure lands on a good snapshot.
            slow_inside.set()
            assert fast_published.wait(timeout=10)
            raise RuntimeError("provider went away")
        return [policy]

    seen: dict[str, Any] = {}

    def resolve(label: str) -> None:
        with app.app_context():
            try:
                seen[label] = get_purge_policy(model)
            except Exception as ex:  # pylint: disable=broad-except
                seen[label] = ex

    with _installed(provider):
        slow = threading.Thread(target=resolve, args=("slow",), name="slow")
        slow.start()
        assert slow_inside.wait(timeout=10), "slow caller never reached the provider"
        fast = threading.Thread(target=resolve, args=("fast",), name="fast")
        fast.start()
        fast.join(timeout=10)
        fast_published.set()
        slow.join(timeout=10)

        assert not slow.is_alive()
        assert not fast.is_alive()
        assert seen["fast"] is policy
        # The slow caller's own lookup resolves against the published index.
        assert seen["slow"] is policy
        assert sorted(calls) == ["fast", "slow"]
        # And the index is still the good one, answered without a third call.
        assert get_purge_policy(model) is policy
        assert len(calls) == 2


@pytest.mark.parametrize("model", [Slice, Dashboard, SqlaTable])
def test_builtin_policies_satisfy_the_host_rules(model: type[Any]) -> None:
    """The host rules hold for this package's own roots, pinned here.

    They run where a host policy is admitted, so nothing exercises them
    against these three at runtime -- deliberately, since each is a function
    of declarations and a mapper that are fixed at build time, and running
    them per read could only add a way for a built-in root to stop purging.
    That makes this test the thing standing between a bad edit to a built-in
    declaration and a nightly purge that refuses the root.
    """
    purge_policy_module._validate_host_declarations(  # noqa: SLF001
        get_purge_policy(model)
    )


def _host_cycle(prefix: str) -> type[Any]:
    """Map a root and child that reference each other.

    ``root.link_id -> link.id`` and ``link.root_id -> root.id``: a foreign-key
    cycle, which a host can declare as two owned edges.
    """
    metadata: sa.MetaData = sa.MetaData()
    root_table: sa.Table = sa.Table(
        f"{prefix}_root",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("link_id", sa.Integer, sa.ForeignKey(f"{prefix}_link.id")),
        sa.Column("deleted_at", sa.DateTime, nullable=True),
    )
    sa.Table(
        f"{prefix}_link",
        metadata,
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("root_id", sa.Integer, sa.ForeignKey(f"{prefix}_root.id")),
    )

    class HostCycleRoot:
        """Temporary mapped root in a foreign-key cycle with its child."""

    return _map_host_root(HostCycleRoot, root_table)


def test_owned_back_edge_into_the_root_table_is_rejected(
    caplog: pytest.LogCaptureFixture,
) -> None:
    """The back edge of a root/child cycle deletes other live roots.

    Its predicate resolves through the ownership path, so the statement reads
    ``DELETE FROM root WHERE link_id IN (SELECT id FROM link WHERE root_id =
    :id)`` -- removing any other root sharing that child, outside the purge
    frame, with no audit record, and committing cleanly even with foreign
    keys enforced.
    """
    model: type[Any] = _host_cycle("cycle")
    root, link = "cycle_root", "cycle_link"
    owned = (DependencyClassification.OWNED, ExecutionPhase.OWNED)
    declared: tuple[DependencyPolicy, ...] = (
        DependencyPolicy(
            DependencyKey("foreign_key", root, link, ("id",), ("root_id",), "inbound"),
            *owned,
        ),
        DependencyPolicy(
            DependencyKey("foreign_key", link, root, ("id",), ("link_id",), "inbound"),
            *owned,
        ),
        DependencyPolicy(
            DependencyKey("foreign_key", root, link, ("link_id",), ("id",), "outbound"),
            DependencyClassification.PRESERVE,
        ),
        DependencyPolicy(
            DependencyKey("foreign_key", link, root, ("root_id",), ("id",), "outbound"),
            DependencyClassification.PRESERVE,
        ),
    )

    _assert_rejected(
        model,
        _host_policy(model, declared),
        "the root's own table",
        caplog,
    )
