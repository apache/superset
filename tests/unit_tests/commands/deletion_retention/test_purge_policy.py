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

from dataclasses import replace
from typing import Any
from unittest.mock import MagicMock

import pytest
import sqlalchemy as sa
from sqlalchemy.engine import Dialect
from sqlalchemy.orm import configure_mappers
from sqlalchemy.sql import Select

from superset.commands.deletion_retention.purge_policy import (
    _fk_key,
    compare_policy,
    delete_associations,
    delete_owned_children,
    DependencyClassification,
    DependencyKey,
    DependencyPolicy,
    discover_dependencies,
    get_purge_policy,
    listener_responsibilities,
    PolicyCoverage,
    purge_policy_registry,
    PurgeEntityPolicy,
    validate_deletion_allowed,
    validate_unique_root_policies,
)
from superset.connectors.sqla.models import SqlaTable
from superset.models.dashboard import Dashboard
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


def test_fk_relationship_aliases_do_not_change_dependency_identity() -> None:
    """Harmless mapper aliases remain diagnostic rather than new obligations."""
    first: DependencyKey = DependencyKey(
        "foreign_key",
        "root",
        "child",
        relationship_aliases=("children",),
    )
    second: DependencyKey = DependencyKey(
        "foreign_key",
        "root",
        "child",
        relationship_aliases=("items",),
    )

    assert first == second
    assert len({first, second}) == 1


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
def test_root_policy_exposes_typed_phase_callbacks(model: type[Any]) -> None:
    """The resolved registry entry is executable without root dispatch."""
    policy: PurgeEntityPolicy = get_purge_policy(model)

    assert callable(policy.validate)
    assert callable(policy.count_dashboard_slices)
    assert callable(policy.collect_dangling_chart_uuids)
    assert callable(policy.delete_associations)
    assert callable(policy.delete_owned_children)
    assert callable(policy.capture_permission_name)
    assert callable(policy.cleanup_permission)
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
    assert all(statement.startswith(("SELECT", "DELETE")) for statement in compiled)
