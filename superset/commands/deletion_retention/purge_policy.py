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
"""Declarative policies for explicit deletion-retention purges.

A policy describes how one root is purged: which dependent tables go with it,
and which callbacks carry that out. This package declares three roots --
charts, dashboards and datasets -- and a host distribution installs policies
for its own soft-delete roots through ``PURGE_POLICIES_FUNC``.

The cascade owns the frame around a purge: the locked claim, the identity and
eligibility predicates, the write-ahead audit record and the conditional
delete. A policy fills in what happens inside that frame, either through the
shared cleanup callbacks declared here or through its own.

Validating a policy is deliberately partial. Declarations whose mistakes would
be silent are refused -- deleting the wrong rows, or skipping cleanup that was
asked for -- and everything else is left to fail where it fails, per row and
counted. Enumerating every shape a host might write is not a goal: see
``_validate_executable_declarations`` for the line and the reasoning.
"""

from __future__ import annotations

import logging
import threading
from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass, field
from enum import Enum
from functools import lru_cache
from types import MappingProxyType
from typing import Any, cast, NamedTuple

import sqlalchemy as sa
from flask import current_app, has_app_context
from sqlalchemy.orm import Mapper, Session

from superset.utils.sqlalchemy_events import (
    declared_delete_listeners,
    DeleteListenerEffect,
)

logger: logging.Logger = logging.getLogger(__name__)

# Stable machine-readable reason codes persisted on purge audit records.
# The values are frozen identifiers pinned by a golden-set test: they equal
# the related-table names at introduction by coincidence, never by derivation,
# so a physical table rename changes only the blocker mapping's key and
# leaves the persisted code untouched — audit history and the suppression
# predicate compare these literals.
REASON_REPORT_SCHEDULE: str = "report_schedule"
REASON_USER_ATTRIBUTE: str = "user_attribute"
REASON_CASCADE_INTEGRITY_FAILURE: str = "cascade_integrity_failure"

ALL_REASON_CODES: frozenset[str] = frozenset(
    {
        REASON_REPORT_SCHEDULE,
        REASON_USER_ATTRIBUTE,
        REASON_CASCADE_INTEGRITY_FAILURE,
    }
)

#: Config key holding the host's purge-policy provider: a zero-argument
#: callable returning ``PurgeEntityPolicy`` objects for soft-delete roots this
#: package does not own. A host that wants to confirm this hook exists before
#: relying on it can probe for this name, which is present exactly when the
#: hook is; installing the key on a build without it is inert.
HOST_POLICIES_CONFIG_KEY: str = "PURGE_POLICIES_FUNC"


class BlockerReason(NamedTuple):
    """One blocker's persisted audit code paired with its operator phrase."""

    code: str
    phrase: str


class PurgeBlockedError(Exception):
    """Raised when ordinary deletion policy forbids purging an entity."""

    def __init__(self, reason: BlockerReason) -> None:
        super().__init__(reason.phrase)
        self.reason: BlockerReason = reason

    @property
    def reason_code(self) -> str:
        """Return the stable machine-readable blocker code."""
        return self.reason.code


class DependencyClassification(str, Enum):
    """Describe how purge treats a persistence dependency."""

    OWNED = "owned"
    ASSOCIATION = "association"
    PRESERVE = "preserve"
    BLOCK = "block"
    LISTENER_EFFECT = "listener_effect"
    VERSION_OWNED = "version_owned"


class ExecutionPhase(str, Enum):
    """Describe the execution phase associated with a dependency."""

    VALIDATE = "validate"
    ASSOCIATIONS = "associations"
    OWNED = "owned"
    VERSION = "version"
    POST_DELETE = "post_delete"


class ListenerAction(str, Enum):
    """Identify one typed listener-equivalent purge action."""

    DELETE_TAGGED_OBJECTS = "delete_tagged_objects"
    DELETE_DATASET_PERMISSION = "delete_dataset_permission"


PolicyAction = Callable[[Session, "PurgeEntityPolicy", int], None]
CountSnapshot = Callable[[Session, "PurgeEntityPolicy", int], int]
UuidSnapshot = Callable[[Session, "PurgeEntityPolicy", int], list[str]]
PermissionSnapshot = Callable[[Session, "PurgeEntityPolicy", int], "str | None"]
PermissionCleanup = Callable[[Session, "PurgeEntityPolicy", "str | None", int], None]


@dataclass(frozen=True, order=True)
class DependencyKey:
    """Identify one physical or non-FK persistence dependency."""

    kind: str
    owner_table: str
    related_table: str
    local_columns: tuple[str, ...] = ()
    remote_columns: tuple[str, ...] = ()
    direction: str = ""
    relationship: str = ""

    def describe(self) -> str:
        """Return a deterministic human-readable dependency identity."""
        columns: str = ",".join(self.local_columns)
        remote: str = ",".join(self.remote_columns)
        relationship: str = f":{self.relationship}" if self.relationship else ""
        return (
            f"{self.kind}:{self.owner_table}->{self.related_table}:"
            f"{columns}->{remote}:{self.direction}{relationship}"
        )


@dataclass(frozen=True)
class DependencyPolicy:
    """Classify one dependency for a purge root."""

    key: DependencyKey
    classification: DependencyClassification
    phase: ExecutionPhase | None = None
    blocker: BlockerReason | None = None
    optional_listener: bool = False
    listener_action: ListenerAction | None = None
    version_column: str | None = None

    @property
    def blocked_reason(self) -> str | None:
        """Return the operator-facing blocker phrase, if this policy blocks."""
        return self.blocker.phrase if self.blocker else None

    @property
    def blocked_reason_code(self) -> str | None:
        """Return the stable audit code, if this policy blocks."""
        return self.blocker.code if self.blocker else None


@dataclass(frozen=True)
class PurgeEntityPolicy:
    """Declare the complete purge behavior for one root model."""

    model: type[Any]
    entity_type: str
    dependencies: tuple[DependencyPolicy, ...]
    validate: PolicyAction
    count_dashboard_slices: CountSnapshot
    collect_dangling_chart_uuids: UuidSnapshot
    delete_associations: PolicyAction
    delete_owned_children: PolicyAction
    capture_permission_name: PermissionSnapshot
    cleanup_permission: PermissionCleanup

    @property
    def listener_responsibilities(self) -> frozenset[str]:
        """Derive listener obligations from synthetic dependency declarations."""
        return frozenset(
            dependency.key.relationship
            for dependency in self.dependencies
            if dependency.classification is DependencyClassification.LISTENER_EFFECT
        )

    @property
    def optional_listener_responsibilities(self) -> frozenset[str]:
        """Return listener effects that are conditional on runtime configuration."""
        return frozenset(
            dependency.key.relationship
            for dependency in self.dependencies
            if dependency.classification is DependencyClassification.LISTENER_EFFECT
            and dependency.optional_listener
        )

    @property
    def version_shadow_names(self) -> tuple[tuple[str, str], ...]:
        """Derive executable shadow targets from version-owned declarations."""
        return tuple(
            (dependency.key.related_table, dependency.version_column or "")
            for dependency in self.dependencies
            if dependency.classification is DependencyClassification.VERSION_OWNED
        )


@dataclass(frozen=True)
class PolicyCoverage:
    """Report missing, duplicate, and stale dependency declarations."""

    missing: tuple[DependencyKey, ...]
    duplicates: tuple[DependencyKey, ...]
    stale: tuple[DependencyKey, ...]
    missing_listeners: tuple[str, ...] = ()
    stale_listeners: tuple[str, ...] = ()

    @property
    def complete(self) -> bool:
        """Return whether the policy covers the discovered graph exactly."""
        return not (
            self.missing
            or self.duplicates
            or self.stale
            or self.missing_listeners
            or self.stale_listeners
        )


def _fk_key(
    owner_table: sa.Table,
    constraint: sa.ForeignKeyConstraint,
    direction: str,
) -> DependencyKey:
    """Normalize one physical foreign-key constraint as an atomic edge."""
    elements: tuple[sa.ForeignKey, ...] = tuple(constraint.elements)
    if direction == "outbound":
        related_table: sa.Table = elements[0].column.table
        local: tuple[str, ...] = tuple(element.parent.name for element in elements)
        remote: tuple[str, ...] = tuple(element.column.name for element in elements)
    else:
        related_table = elements[0].parent.table
        local = tuple(element.column.name for element in elements)
        remote = tuple(element.parent.name for element in elements)
    return DependencyKey(
        kind="foreign_key",
        owner_table=owner_table.name,
        related_table=related_table.name,
        local_columns=local,
        remote_columns=remote,
        direction=direction,
    )


@dataclass
class _Traversal:
    """Tables already walked, split by how much each kind of walk can see.

    Walking a table through its mapper yields its foreign keys *and* its
    relationship keys; walking it as a plain table yields only the foreign
    keys. A mapper walk therefore subsumes a table walk, but not the reverse
    -- so a table reached first as a table must still be walkable as a
    mapper, or relationship-only edges (a child's version shadow, say) go
    undiscovered and read as stale declarations.
    """

    tables: set[str] = field(default_factory=set)
    mappers: set[str] = field(default_factory=set)


def _relationship_has_physical_edge(relationship: Any) -> bool:
    """Return whether a mapper relationship is represented by a physical FK."""
    for local, remote in relationship.local_remote_pairs:
        if local.foreign_keys or remote.foreign_keys:
            return True
    if relationship.secondary is None:
        return False
    owner_table: sa.Table = relationship.parent.local_table
    return any(
        foreign_key.column.table is owner_table
        for foreign_key in relationship.secondary.foreign_keys
    )


def discover_dependencies(
    mapper: Mapper[Any],
    *,
    recursive_tables: frozenset[str] = frozenset(),
    visited: frozenset[str] = frozenset(),
) -> frozenset[DependencyKey]:
    """Discover physical FKs and relationships, recursing through owned tables.

    Visited tables are tracked across the whole traversal rather than per
    branch. Each table's edges depend only on that table, so walking it once
    yields the same key set -- while restarting the bookkeeping per sibling
    makes every sibling re-walk all the others, growing factorially in the
    number of recursive tables. A root owning a dozen of them would spend
    minutes in discovery before a single row could be purged.
    """
    return _discover_mapper(
        mapper,
        recursive_tables,
        _Traversal(tables=set(visited), mappers=set(visited)),
    )


def _discover_mapper(
    mapper: Mapper[Any],
    recursive_tables: frozenset[str],
    seen: _Traversal,
) -> frozenset[DependencyKey]:
    """Discover one mapper's edges, marking its table walked for the rest."""
    table: sa.Table = mapper.local_table
    if table.name in seen.mappers:
        return frozenset()
    seen.mappers.add(table.name)
    seen.tables.add(table.name)
    discovered: set[DependencyKey] = {
        _fk_key(table, constraint, "outbound")
        for constraint in table.foreign_key_constraints
    }
    for candidate in table.metadata.tables.values():
        for constraint in candidate.foreign_key_constraints:
            if constraint.elements[0].column.table is table:
                discovered.add(_fk_key(table, constraint, "inbound"))
    for relationship in mapper.relationships:
        related_mapper: Mapper[Any] = relationship.mapper
        if related_mapper.local_table.name in recursive_tables:
            discovered.update(_discover_mapper(related_mapper, recursive_tables, seen))
        if not _relationship_has_physical_edge(relationship):
            discovered.add(
                DependencyKey(
                    kind="relationship",
                    owner_table=table.name,
                    related_table=relationship.mapper.local_table.name,
                    direction=relationship.direction.name.lower(),
                    relationship=relationship.key,
                )
            )
    discovered.update(
        _discover_recursive_table_dependencies(table, recursive_tables, seen)
    )
    return frozenset(discovered)


def _discover_table_dependencies(
    table: sa.Table,
    recursive_tables: frozenset[str],
    seen: _Traversal,
) -> frozenset[DependencyKey]:
    """Discover physical edges for unmapped association and owned tables."""
    if table.name in seen.tables:
        return frozenset()
    seen.tables.add(table.name)
    discovered: set[DependencyKey] = {
        _fk_key(table, constraint, "outbound")
        for constraint in table.foreign_key_constraints
    }
    for candidate in table.metadata.tables.values():
        for constraint in candidate.foreign_key_constraints:
            if constraint.elements[0].column.table is table:
                discovered.add(_fk_key(table, constraint, "inbound"))
    discovered.update(
        _discover_recursive_table_dependencies(table, recursive_tables, seen)
    )
    return frozenset(discovered)


def _discover_recursive_table_dependencies(
    table: sa.Table,
    recursive_tables: frozenset[str],
    seen: _Traversal,
) -> frozenset[DependencyKey]:
    """Discover dependencies for named recursive tables not already visited.

    Sorted so a traversal is reproducible, and driven off the shared
    bookkeeping so each table is walked at most once per kind of walk.
    """
    discovered: set[DependencyKey] = set()
    for recursive_table_name in sorted(recursive_tables - seen.tables):
        # Re-checked inside the loop: the set grows as the walk descends, so
        # a table a nested call already covered is skipped rather than
        # re-entered to return nothing.
        if recursive_table_name in seen.tables:
            continue
        recursive_table: sa.Table | None = table.metadata.tables.get(
            recursive_table_name
        )
        if recursive_table is not None:
            discovered.update(
                _discover_table_dependencies(recursive_table, recursive_tables, seen)
            )
    return frozenset(discovered)


def validate_unique_root_policies(
    policies: Iterable[PurgeEntityPolicy],
) -> Mapping[type[Any], PurgeEntityPolicy]:
    """Create an immutable root index and reject duplicate model policies."""
    registry: dict[type[Any], PurgeEntityPolicy] = {}
    for policy in policies:
        if policy.model in registry:
            raise ValueError(f"Duplicate purge policy for {policy.model.__name__}")
        registry[policy.model] = policy
    return MappingProxyType(registry)


def compare_policy(
    discovered: Iterable[DependencyKey],
    declared: Iterable[DependencyPolicy],
    *,
    discovered_listeners: Iterable[str] = (),
    declared_listeners: Iterable[str] = (),
    optional_declared_listeners: Iterable[str] = (),
) -> PolicyCoverage:
    """Compare discovered dependencies with one policy's declarations."""
    discovered_set: set[DependencyKey] = set(discovered)
    declared_keys: list[DependencyKey] = [item.key for item in declared]
    declared_set: set[DependencyKey] = set(declared_keys)
    duplicates: set[DependencyKey] = {
        key for key in declared_set if declared_keys.count(key) > 1
    }
    return PolicyCoverage(
        missing=tuple(sorted(discovered_set - declared_set)),
        duplicates=tuple(sorted(duplicates)),
        stale=tuple(
            sorted(
                key for key in declared_set - discovered_set if key.kind != "synthetic"
            )
        ),
        missing_listeners=tuple(
            sorted(set(discovered_listeners) - set(declared_listeners))
        ),
        stale_listeners=tuple(
            sorted(
                set(declared_listeners)
                - set(discovered_listeners)
                - set(optional_declared_listeners)
            )
        ),
    )


@lru_cache(maxsize=1)
def _builtin_purge_policies() -> tuple[PurgeEntityPolicy, ...]:
    """Declare the purge roots this package owns, after model initialization."""
    # avoid circular import: model listener registration imports neutral event helpers
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.dashboard import Dashboard
    from superset.models.embedded_dashboard import EmbeddedDashboard  # noqa: F401
    from superset.models.slice import Slice
    from superset.models.user_attributes import UserAttribute  # noqa: F401
    from superset.reports.models import ReportSchedule  # noqa: F401

    def fk(
        owner: str,
        related: str,
        local: str,
        remote: str,
        direction: str,
    ) -> DependencyKey:
        return DependencyKey(
            "foreign_key",
            owner,
            related,
            (local,),
            (remote,),
            direction,
        )

    def relationship(
        owner: str, related: str, direction: str, name: str
    ) -> DependencyKey:
        return DependencyKey(
            "relationship",
            owner,
            related,
            direction=direction,
            relationship=name,
        )

    def version(owner: str, related: str, name: str = "versions") -> DependencyKey:
        return DependencyKey(
            "relationship",
            owner,
            related,
            direction="onetomany",
            relationship=name,
        )

    def policies(
        keys: tuple[DependencyKey, ...],
        classifications: tuple[DependencyClassification, ...],
        synthetic: tuple[DependencyPolicy, ...],
        blocked_reasons: Mapping[str, BlockerReason] = MappingProxyType({}),
        version_columns: Mapping[str, str] = MappingProxyType({}),
    ) -> tuple[DependencyPolicy, ...]:
        phases: dict[DependencyClassification, ExecutionPhase | None] = {
            DependencyClassification.OWNED: ExecutionPhase.OWNED,
            DependencyClassification.ASSOCIATION: ExecutionPhase.ASSOCIATIONS,
            DependencyClassification.PRESERVE: None,
            DependencyClassification.BLOCK: ExecutionPhase.VALIDATE,
            DependencyClassification.VERSION_OWNED: ExecutionPhase.VERSION,
        }
        if len(keys) != len(classifications):
            raise ValueError("Every dependency key requires one classification")

        def declare(
            key: DependencyKey, classification: DependencyClassification
        ) -> DependencyPolicy:
            blocker: BlockerReason | None = blocked_reasons.get(key.related_table)
            return DependencyPolicy(
                key,
                classification,
                phases[classification],
                blocker=blocker,
                version_column=version_columns.get(key.related_table),
            )

        return (
            tuple(
                declare(key, classification)
                for key, classification in zip(keys, classifications, strict=True)
            )
            + synthetic
        )

    tag_cleanup: DependencyPolicy = DependencyPolicy(
        DependencyKey(
            "synthetic",
            "",
            "tagged_object",
            relationship="tagged_object_cleanup",
        ),
        DependencyClassification.LISTENER_EFFECT,
        ExecutionPhase.ASSOCIATIONS,
        optional_listener=True,
        listener_action=ListenerAction.DELETE_TAGGED_OBJECTS,
    )
    permission_cleanup: DependencyPolicy = DependencyPolicy(
        DependencyKey(
            "synthetic",
            "tables",
            "ab_permission_view",
            relationship="datasource_permission_cleanup",
        ),
        DependencyClassification.LISTENER_EFFECT,
        ExecutionPhase.POST_DELETE,
        listener_action=ListenerAction.DELETE_DATASET_PERMISSION,
    )
    chart_membership_versions: DependencyPolicy = DependencyPolicy(
        DependencyKey(
            "synthetic",
            "slices",
            "dashboard_slices_version",
            relationship="association_versions",
        ),
        DependencyClassification.VERSION_OWNED,
        ExecutionPhase.VERSION,
        version_column="slice_id",
    )
    dashboard_membership_versions: DependencyPolicy = DependencyPolicy(
        DependencyKey(
            "synthetic",
            "dashboards",
            "dashboard_slices_version",
            relationship="association_versions",
        ),
        DependencyClassification.VERSION_OWNED,
        ExecutionPhase.VERSION,
        version_column="dashboard_id",
    )
    registry: dict[type[Any], PurgeEntityPolicy] = {
        Slice: PurgeEntityPolicy(
            model=Slice,
            entity_type="chart",
            dependencies=policies(
                (
                    fk("slices", "ab_user", "changed_by_fk", "id", "outbound"),
                    fk("slices", "ab_user", "created_by_fk", "id", "outbound"),
                    fk("slices", "ab_user", "last_saved_by_fk", "id", "outbound"),
                    fk("slices", "chart_editors", "id", "chart_id", "inbound"),
                    fk("slices", "chart_viewers", "id", "chart_id", "inbound"),
                    fk("slices", "dashboard_slices", "id", "slice_id", "inbound"),
                    fk("slices", "report_schedule", "id", "chart_id", "inbound"),
                    version("slices", "slices_version"),
                    relationship("slices", "tables", "manytoone", "table"),
                    relationship(
                        "slices", "semantic_views", "manytoone", "semantic_view"
                    ),
                    fk("chart_editors", "slices", "chart_id", "id", "outbound"),
                    fk("chart_editors", "subjects", "subject_id", "id", "outbound"),
                    fk("chart_viewers", "slices", "chart_id", "id", "outbound"),
                    fk("chart_viewers", "subjects", "subject_id", "id", "outbound"),
                    fk(
                        "dashboard_slices",
                        "dashboards",
                        "dashboard_id",
                        "id",
                        "outbound",
                    ),
                    fk(
                        "dashboard_slices",
                        "slices",
                        "slice_id",
                        "id",
                        "outbound",
                    ),
                ),
                (
                    DependencyClassification.PRESERVE,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.ASSOCIATION,
                    DependencyClassification.ASSOCIATION,
                    DependencyClassification.ASSOCIATION,
                    DependencyClassification.BLOCK,
                    DependencyClassification.VERSION_OWNED,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.PRESERVE,
                ),
                (tag_cleanup, chart_membership_versions),
                # Keyed by related table; the audit code is declared, not derived.
                {
                    "report_schedule": BlockerReason(
                        REASON_REPORT_SCHEDULE, "associated alerts or reports exist"
                    )
                },
                {"slices_version": "id"},
            ),
            validate=validate_deletion_allowed,
            count_dashboard_slices=count_dashboard_slices,
            collect_dangling_chart_uuids=dangling_chart_uuids,
            delete_associations=delete_associations,
            delete_owned_children=delete_owned_children,
            capture_permission_name=dataset_permission_name,
            cleanup_permission=cleanup_dataset_permission,
        ),
        Dashboard: PurgeEntityPolicy(
            model=Dashboard,
            entity_type="dashboard",
            dependencies=policies(
                (
                    fk("dashboards", "ab_user", "changed_by_fk", "id", "outbound"),
                    fk("dashboards", "ab_user", "created_by_fk", "id", "outbound"),
                    fk(
                        "dashboards",
                        "dashboard_editors",
                        "id",
                        "dashboard_id",
                        "inbound",
                    ),
                    fk(
                        "dashboards",
                        "dashboard_slices",
                        "id",
                        "dashboard_id",
                        "inbound",
                    ),
                    fk(
                        "dashboards",
                        "dashboard_viewers",
                        "id",
                        "dashboard_id",
                        "inbound",
                    ),
                    fk(
                        "dashboards",
                        "embedded_dashboards",
                        "id",
                        "dashboard_id",
                        "inbound",
                    ),
                    fk(
                        "dashboards",
                        "report_schedule",
                        "id",
                        "dashboard_id",
                        "inbound",
                    ),
                    fk("dashboards", "themes", "theme_id", "id", "outbound"),
                    fk(
                        "dashboards",
                        "user_attribute",
                        "id",
                        "welcome_dashboard_id",
                        "inbound",
                    ),
                    version("dashboards", "dashboards_version"),
                    fk(
                        "embedded_dashboards",
                        "ab_user",
                        "changed_by_fk",
                        "id",
                        "outbound",
                    ),
                    fk(
                        "embedded_dashboards",
                        "ab_user",
                        "created_by_fk",
                        "id",
                        "outbound",
                    ),
                    fk(
                        "embedded_dashboards",
                        "dashboards",
                        "dashboard_id",
                        "id",
                        "outbound",
                    ),
                    fk(
                        "dashboard_editors",
                        "dashboards",
                        "dashboard_id",
                        "id",
                        "outbound",
                    ),
                    fk(
                        "dashboard_editors",
                        "subjects",
                        "subject_id",
                        "id",
                        "outbound",
                    ),
                    fk(
                        "dashboard_slices",
                        "dashboards",
                        "dashboard_id",
                        "id",
                        "outbound",
                    ),
                    fk(
                        "dashboard_slices",
                        "slices",
                        "slice_id",
                        "id",
                        "outbound",
                    ),
                    fk(
                        "dashboard_viewers",
                        "dashboards",
                        "dashboard_id",
                        "id",
                        "outbound",
                    ),
                    fk(
                        "dashboard_viewers",
                        "subjects",
                        "subject_id",
                        "id",
                        "outbound",
                    ),
                ),
                (
                    DependencyClassification.PRESERVE,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.ASSOCIATION,
                    DependencyClassification.ASSOCIATION,
                    DependencyClassification.ASSOCIATION,
                    DependencyClassification.OWNED,
                    DependencyClassification.BLOCK,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.BLOCK,
                    DependencyClassification.VERSION_OWNED,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.PRESERVE,
                ),
                (tag_cleanup, dashboard_membership_versions),
                # Keyed by related table; the audit code is declared, not derived.
                # Declaration order is part of the audit contract: the first
                # matching blocker's code is the one recorded.
                {
                    "report_schedule": BlockerReason(
                        REASON_REPORT_SCHEDULE, "associated alerts or reports exist"
                    ),
                    "user_attribute": BlockerReason(
                        REASON_USER_ATTRIBUTE,
                        "a user has this dashboard set as their welcome page",
                    ),
                },
                {"dashboards_version": "id"},
            ),
            validate=validate_deletion_allowed,
            count_dashboard_slices=count_dashboard_slices,
            collect_dangling_chart_uuids=dangling_chart_uuids,
            delete_associations=delete_associations,
            delete_owned_children=delete_owned_children,
            capture_permission_name=dataset_permission_name,
            cleanup_permission=cleanup_dataset_permission,
        ),
        SqlaTable: PurgeEntityPolicy(
            model=SqlaTable,
            entity_type="dataset",
            dependencies=policies(
                (
                    fk("tables", "ab_user", "changed_by_fk", "id", "outbound"),
                    fk("tables", "ab_user", "created_by_fk", "id", "outbound"),
                    fk("tables", "dbs", "database_id", "id", "outbound"),
                    fk("tables", "rls_filter_tables", "id", "table_id", "inbound"),
                    fk("tables", "sql_metrics", "id", "table_id", "inbound"),
                    fk("tables", "sqlatable_editors", "id", "table_id", "inbound"),
                    fk("tables", "table_columns", "id", "table_id", "inbound"),
                    relationship("tables", "slices", "onetomany", "slices"),
                    version("tables", "tables_version"),
                    fk("sql_metrics", "ab_user", "changed_by_fk", "id", "outbound"),
                    fk("sql_metrics", "ab_user", "created_by_fk", "id", "outbound"),
                    fk("sql_metrics", "tables", "table_id", "id", "outbound"),
                    version("sql_metrics", "sql_metrics_version"),
                    fk("table_columns", "ab_user", "changed_by_fk", "id", "outbound"),
                    fk("table_columns", "ab_user", "created_by_fk", "id", "outbound"),
                    fk("table_columns", "tables", "table_id", "id", "outbound"),
                    version("table_columns", "table_columns_version"),
                    fk(
                        "rls_filter_tables",
                        "row_level_security_filters",
                        "rls_filter_id",
                        "id",
                        "outbound",
                    ),
                    fk(
                        "rls_filter_tables",
                        "tables",
                        "table_id",
                        "id",
                        "outbound",
                    ),
                    fk(
                        "sqlatable_editors",
                        "subjects",
                        "subject_id",
                        "id",
                        "outbound",
                    ),
                    fk(
                        "sqlatable_editors",
                        "tables",
                        "table_id",
                        "id",
                        "outbound",
                    ),
                ),
                (
                    DependencyClassification.PRESERVE,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.ASSOCIATION,
                    DependencyClassification.OWNED,
                    DependencyClassification.ASSOCIATION,
                    DependencyClassification.OWNED,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.VERSION_OWNED,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.VERSION_OWNED,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.VERSION_OWNED,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.PRESERVE,
                    DependencyClassification.PRESERVE,
                ),
                (tag_cleanup, permission_cleanup),
                {},
                {
                    "tables_version": "id",
                    "sql_metrics_version": "table_id",
                    "table_columns_version": "table_id",
                },
            ),
            validate=validate_deletion_allowed,
            count_dashboard_slices=count_dashboard_slices,
            collect_dangling_chart_uuids=dangling_chart_uuids,
            delete_associations=delete_associations,
            delete_owned_children=delete_owned_children,
            capture_permission_name=dataset_permission_name,
            cleanup_permission=cleanup_dataset_permission,
        ),
    }
    return tuple(registry.values())


def _policy_label(policy: Any) -> str:
    """A log-safe name for a payload whose shape is not yet established."""
    model: Any = getattr(policy, "model", None)
    return str(getattr(model, "__name__", type(model).__name__))


def _host_policy_payload(provided: Any) -> tuple[Any, ...] | None:
    """Materialize the provider's payload, or reject it.

    Any iterable is accepted -- a list, a tuple, ``dict.values()``, a
    generator -- since the documented contract is a sequence of policies, not
    one particular container. Strings and bytes are excluded because they
    iterate into characters, which would read as a sequence of bad members
    rather than the wrong type. Materialized once: a generator cannot be
    walked twice.
    """
    if isinstance(provided, (str, bytes)) or not isinstance(provided, Iterable):
        logger.error(
            "purge_policy: %s returned %s; expected an iterable of PurgeEntityPolicy",
            HOST_POLICIES_CONFIG_KEY,
            type(provided).__name__,
        )
        return None
    try:
        return tuple(provided)
    except Exception:  # pylint: disable=broad-except
        logger.exception(
            "purge_policy: %s could not be read; keeping built-in roots only",
            HOST_POLICIES_CONFIG_KEY,
        )
        return None


def _unqualified_table_conflict(policy: PurgeEntityPolicy) -> str | None:
    """Return the first table a bare-name lookup would resolve wrongly.

    Discovery records table identities by bare name while a ``MetaData`` keys
    them by schema, so a declared ``child`` resolves to the default-schema
    table even where the policy meant ``host.child`` -- and the cleanup would
    delete rows belonging to unrelated roots. Carrying schema-qualified
    identities through discovery and execution is the better fix; until then
    the ambiguous shape is refused rather than silently mis-resolved.
    """
    root_table: sa.Table = sa.inspect(policy.model).local_table
    metadata: sa.MetaData = root_table.metadata
    keys_by_name: dict[str, list[str]] = {}
    for table in metadata.tables.values():
        keys_by_name.setdefault(table.name, []).append(table.key)
    declared: set[str] = {root_table.name} | {
        dependency.key.related_table
        for dependency in policy.dependencies
        if dependency.classification in _EXECUTABLE_CLASSIFICATIONS
    }
    for name in sorted(declared):
        keys: list[str] = keys_by_name.get(name, [])
        if len(keys) != 1 or keys[0] != name:
            return name
    return None


def _admitted_host_policy(
    candidate: Any, builtin_roots: frozenset[type[Any]], builtin_types: frozenset[str]
) -> PurgeEntityPolicy | None:
    """Return *candidate* if it is a usable host policy, else ``None``.

    Every check runs behind one handler rather than guarding each attribute:
    the payload is host-supplied, so reading ``model`` or hashing it may
    itself raise -- and an exception escaping here would break
    ``purge_policy_registry`` for the built-in roots too, which is the
    opposite of what this boundary is for.
    """
    try:
        if not isinstance(candidate, PurgeEntityPolicy):
            logger.error(
                "purge_policy: %s returned a %s; expected PurgeEntityPolicy",
                HOST_POLICIES_CONFIG_KEY,
                type(candidate).__name__,
            )
            return None
        if not isinstance(candidate.model, type):
            # Everything downstream treats the root as a mapped class:
            # sa.inspect, the registry index, the duplicate count.
            logger.error(
                "purge_policy: host policy root %s is not a class",
                _policy_label(candidate),
            )
            return None
        if candidate.model in builtin_roots:
            logger.error(
                "purge_policy: host policy for built-in root %s ignored",
                candidate.model.__name__,
            )
            return None
        if candidate.entity_type in builtin_types:
            # Core branches on entity_type -- the dataset impact path, the tag
            # object type, the dataset permission name -- so a host reusing
            # one of its names would have that logic pointed at its own rows.
            logger.error(
                "purge_policy: host policy for %s claims the reserved entity type %r",
                candidate.model.__name__,
                candidate.entity_type,
            )
            return None
        # Validated first, so a table the metadata simply does not contain is
        # reported as such rather than as an ambiguous name.
        unusable: set[str] = {
            dependency.classification.value
            for dependency in candidate.dependencies
            if dependency.classification
            in {
                DependencyClassification.BLOCK,
                DependencyClassification.LISTENER_EFFECT,
            }
        }
        if unusable:
            # Both resolve from core's own identities: the stock listener
            # actions decide what to delete from a built-in entity type, and
            # blockers are applied by the stock validator. Declared by a host,
            # they are accepted and then never carried out -- silence rather
            # than a failure, which is the one outcome worth refusing. A host
            # blocks by raising PurgeBlockedError from its own validate.
            raise RuntimeError(
                f"{', '.join(sorted(unusable))} dependencies cannot be carried "
                "out for a host root"
            )
        _validated_policy(candidate)
        conflict: str | None = _unqualified_table_conflict(candidate)
        if conflict is not None:
            raise RuntimeError(
                f"table {conflict!r} cannot be identified unambiguously by "
                "name; schema-qualified roots are not supported"
            )
    except Exception as ex:  # pylint: disable=broad-except
        # Validated at admission rather than when a row is purged: a
        # declaration the cleanup cannot execute would otherwise fail once per
        # eligible row, counted as a cascade failure, and stay invisible until
        # something aged past the window.
        logger.error(
            "purge_policy: host policy for %s rejected: %s",
            _policy_label(candidate),
            ex,
        )
        return None
    return candidate


def _host_purge_policies(
    provider: Callable[[], Any] | None,
) -> tuple[PurgeEntityPolicy, ...]:
    """Return the purge policies a host installed for its own roots.

    A host distribution can carry ``SoftDeleteMixin`` entities this package
    cannot import. The retention task discovers those entities through the
    mixin registry, so without a policy they reach the cascade as an
    unsupported model. The host therefore declares their purge behavior and
    installs it under ``PURGE_POLICIES_FUNC``.

    Host boundary: everything about a host policy is settled here, where it is
    admitted -- an unavailable provider, a payload that is not an iterable of
    policies, a root that is not a class, a collision with a root or entity
    type declared in this package, two declarations for one root, and a
    declaration the shared cleanup could not execute. Each is logged and
    dropped, so that root is reported as unsupported instead of failing row by
    row in a scheduled run. A broken host declaration must not take the purge
    down with it, and must never redefine how a chart, dashboard or dataset is
    purged.
    """
    if provider is None:
        return ()
    try:
        provided: Any = provider()
    except Exception:  # pylint: disable=broad-except
        logger.exception(
            "purge_policy: %s is unavailable; keeping built-in roots only",
            HOST_POLICIES_CONFIG_KEY,
        )
        return ()
    candidates: tuple[Any, ...] | None = _host_policy_payload(provided)
    if candidates is None:
        return ()

    builtin_policies: tuple[PurgeEntityPolicy, ...] = _builtin_purge_policies()
    builtin_roots: frozenset[type[Any]] = frozenset(
        policy.model for policy in builtin_policies
    )
    builtin_types: frozenset[str] = frozenset(
        policy.entity_type for policy in builtin_policies
    )
    admitted: list[PurgeEntityPolicy] = [
        policy
        for candidate in candidates
        if (policy := _admitted_host_policy(candidate, builtin_roots, builtin_types))
        is not None
    ]

    # Counted after admission, where every root is known to be a class and so
    # hashable. Which of two declarations for one root is authoritative is
    # undecidable, and the loser would still delete rows, so both are dropped:
    # the root is reported as unsupported, which is the recoverable outcome.
    # It also keeps the duplicate away from validate_unique_root_policies,
    # whose ValueError would abort the whole scheduled run.
    counts: dict[type[Any], int] = {}
    for policy in admitted:
        counts[policy.model] = counts.get(policy.model, 0) + 1
    for model, count in counts.items():
        if count > 1:
            logger.error(
                "purge_policy: %s declares %d policies for %s; ignoring all of them",
                HOST_POLICIES_CONFIG_KEY,
                count,
                model.__name__,
            )
    return tuple(policy for policy in admitted if counts[policy.model] == 1)


#: Sentinel distinguishing "no index resolved yet" from an index resolved for
#: no provider, which is the ordinary case.
_UNRESOLVED: Any = object()


@dataclass
class _ResolvedRegistry:
    """The index built for one provider, with the roots validated so far.

    Compared by provider *identity* rather than memoized with ``lru_cache``: a
    cache keyed on the provider would hash it, and a host callable
    implemented as a mutable dataclass instance is unhashable. That would
    raise here -- before the host boundary could isolate the host's mistake --
    and stop the built-in roots purging too.
    """

    provider: Any = _UNRESOLVED
    registry: Mapping[type[Any], PurgeEntityPolicy] = field(
        default_factory=lambda: MappingProxyType({})
    )
    validated: set[type[Any]] = field(default_factory=set)


_RESOLVED: _ResolvedRegistry = _ResolvedRegistry()

#: Per-thread marker for "this thread is already resolving". A host provider
#: may build its policy from a built-in one -- ``replace(get_purge_policy(
#: Slice), model=HostRoot, ...)`` is the obvious way to borrow the stock
#: callbacks -- which re-enters resolution while the first call is still in
#: the provider. The nested call is handed the state already published
#: instead, which always carries the built-in roots.
_RESOLVING: threading.local = threading.local()


def _resolved_registry() -> _ResolvedRegistry:
    """Return the state resolved for the installed provider, building it once.

    Readers take a snapshot and a rebuild publishes a new one, so a caller
    always sees an index and its validation record together. Publishing is a
    single rebind, which is what makes it safe to do this without a lock: two
    concurrent first uses may each invoke the provider and each publish, but
    the two snapshots are equivalent and neither is ever seen half-built.
    Paying for a duplicate provider call is the deliberate trade -- a lock
    here deadlocks the moment a provider resolves a built-in policy of its
    own, and a hung purge is worse than a repeated call.
    """
    provider: Callable[[], Any] | None = (
        current_app.config.get(HOST_POLICIES_CONFIG_KEY) if has_app_context() else None
    )
    resolved: _ResolvedRegistry = _RESOLVED
    if resolved.provider is provider or getattr(_RESOLVING, "active", False):
        return resolved
    _RESOLVING.active = True
    try:
        host_policies: tuple[PurgeEntityPolicy, ...] = _host_purge_policies(provider)
        rebuilt = _ResolvedRegistry(
            provider=provider,
            registry=validate_unique_root_policies(
                (*_builtin_purge_policies(), *host_policies)
            ),
            # Host roots were validated as they were admitted. Built-in roots
            # stay lazy, so one unusable built-in cannot block the others.
            validated={policy.model for policy in host_policies},
        )
    finally:
        _RESOLVING.active = False
    globals()["_RESOLVED"] = rebuilt
    return rebuilt


def purge_policy_registry() -> Mapping[type[Any], PurgeEntityPolicy]:
    """Index the built-in purge roots plus any the host installed.

    Rebuilt only when the installed provider changes. Freezing at first use
    would pin whatever happened to be installed at that moment -- including
    nothing at all, for a call made before startup finished -- until a
    restart, while resolving on every call would invoke the provider once per
    root and could hand back different objects each time.
    """
    return _resolved_registry().registry


def _validated_policy(policy: PurgeEntityPolicy) -> PurgeEntityPolicy:
    """Validate one declaration.

    Uncached, for the same reason the index is compared by identity: a policy
    carrying a callable that is not hashable could not be an ``lru_cache``
    key. Callers record which roots they have validated instead -- see
    ``_ResolvedRegistry.validated``, which is discarded whenever the provider
    changes, so a replaced declaration is validated afresh.
    """
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
        discover_dependencies(
            sa.inspect(policy.model), recursive_tables=recursive_tables
        ),
        policy.dependencies,
        discovered_listeners=listener_responsibilities(policy.model),
        declared_listeners=policy.listener_responsibilities,
        optional_declared_listeners=policy.optional_listener_responsibilities,
    )
    _validate_executable_declarations(policy)
    if not coverage.complete:
        details: str = "; ".join(
            f"{label}=[{', '.join(key.describe() for key in dependencies)}]"
            for label, dependencies in (
                ("missing", coverage.missing),
                ("duplicates", coverage.duplicates),
                ("stale", coverage.stale),
            )
            if dependencies
        )
        if coverage.missing_listeners:
            details = (
                f"{details}; " if details else ""
            ) + f"missing_listeners=[{', '.join(coverage.missing_listeners)}]"
        if coverage.stale_listeners:
            details = (
                f"{details}; " if details else ""
            ) + f"stale_listeners=[{', '.join(coverage.stale_listeners)}]"
        raise RuntimeError(
            f"Incomplete purge policy for {policy.model.__name__}: {details}"
        )
    return policy


def _validate_scanner_requirements(policy: PurgeEntityPolicy) -> None:
    """Reject a root the scheduled scan cannot page through.

    The retention task selects, windows and orders eligible rows by ``id``,
    and the cascade pins each row by it. A root keyed on something else -- a
    UUID primary key with no ``id`` column -- raises inside the scan, outside
    the per-row error handling, so the run aborts before the remaining roots
    are reached.
    """
    mapper: Mapper[Any] = sa.inspect(policy.model)
    table: sa.Table = mapper.local_table
    if "id" not in table.c:
        raise RuntimeError(
            f"Purge root {policy.model.__name__} has no 'id' column; the "
            "scheduled scan pages eligible rows by id"
        )
    primary_key: tuple[sa.Column[Any], ...] = tuple(mapper.primary_key)
    if (
        len(primary_key) != 1
        or primary_key[0].name != "id"
        or not isinstance(primary_key[0].type, sa.Integer)
    ):
        # The scan pages by id and the row is then fetched with a scalar
        # Session.get, so a composite or differently named key matches
        # nothing: every row fails while a dry run still counts it eligible.
        raise RuntimeError(
            f"Purge root {policy.model.__name__} is keyed on "
            f"({', '.join(column.name for column in primary_key)}); the "
            "scheduled purge pages an integer 'id' watermark and looks rows "
            "up by it"
        )
    if "deleted_at" not in table.c:
        raise RuntimeError(
            f"Purge root {policy.model.__name__} has no 'deleted_at' column; "
            "every purge path requires the row to be archived first"
        )


#: Classifications the shared cleanup executes as SQL, through
#: ``_dependency_predicates`` -- which only knows how to read an inbound
#: foreign key.
_EXECUTABLE_CLASSIFICATIONS: frozenset[DependencyClassification] = frozenset(
    {
        DependencyClassification.OWNED,
        DependencyClassification.ASSOCIATION,
        DependencyClassification.BLOCK,
    }
)


def _validate_version_target(
    policy: PurgeEntityPolicy, dependency: DependencyPolicy, metadata: sa.MetaData
) -> None:
    """Reject a version target whose column does not hold the root's id.

    Version cleanup compares the declared column with the root's id directly,
    so the column has to be root-relative. Shadow tables are generated and may
    not exist when a policy is validated, so the check reads their live
    counterpart -- ``<table>_version`` describes ``<table>``, the naming the
    shadow declarations already rely on -- and accepts the column when it is
    the root's own primary key or a foreign key into the root.

    A column naming an intermediate owner, a stage id under a workflow root
    say, matches history belonging to a different root and leaves this one's
    behind.
    """
    root_table: sa.Table = sa.inspect(policy.model).local_table
    column: str = cast(str, dependency.version_column)
    shadow_name: str = dependency.key.related_table
    suffix: str = "_version"
    live_name: str = (
        shadow_name[: -len(suffix)] if shadow_name.endswith(suffix) else shadow_name
    )
    live_table: sa.Table | None = metadata.tables.get(live_name)
    if live_table is not None and column in live_table.c:
        live_column: sa.Column[Any] = live_table.c[column]
        primary_key: tuple[sa.Column[Any], ...] = tuple(root_table.primary_key.columns)
        if (
            live_table is root_table
            and len(primary_key) == 1
            and live_column.name == primary_key[0].name
        ):
            return
        # The comparison is against the root's id, so a foreign key to any
        # other root column matches rows belonging to a different root.
        if len(primary_key) == 1 and any(
            foreign_key.column.table is root_table
            and foreign_key.column.name == primary_key[0].name
            for foreign_key in live_column.foreign_keys
        ):
            return
    raise RuntimeError(
        f"Version target {shadow_name}.{column} for {dependency.key.describe()} "
        f"is not root-relative; cleanup compares it with the "
        f"{root_table.name} id, so it must be that id or a foreign key to it"
    )


def _validate_dependency_declaration(
    policy: PurgeEntityPolicy,
    dependency: DependencyPolicy,
    metadata: sa.MetaData,
) -> None:
    """Reject one declaration whose mistake would not announce itself."""
    key: DependencyKey = dependency.key
    if (
        dependency.classification is DependencyClassification.LISTENER_EFFECT
        and dependency.listener_action is None
    ):
        raise RuntimeError(f"Missing listener action for {key.describe()}")
    if dependency.classification is DependencyClassification.VERSION_OWNED:
        if dependency.version_column is None:
            raise RuntimeError(f"Missing version target column for {key.describe()}")
        # A version target that is not root-relative deletes another root's
        # history and leaves this root's behind -- silently, either way.
        _validate_version_target(policy, dependency, metadata)


def _validate_executable_declarations(policy: PurgeEntityPolicy) -> None:
    """Reject a declaration that would delete the wrong rows, and little else.

    Validation here is deliberately not an attempt to prove that an arbitrary
    declaration executes correctly -- the space of shapes a host might write
    is not enumerable, and every rule written to anticipate one is a rule to
    maintain. The line drawn instead:

    * a declaration whose mistake would **delete the wrong rows, or silently
      skip cleanup**, is refused, because neither announces itself;
    * a declaration that merely **fails loudly** -- a predicate the cleanup
      cannot build, an ordering a foreign key refuses -- is left to fail,
      where it is caught per row, counted as a cascade failure, isolated to
      its own root by the scheduled task, and visible in the audit record.

    The frame's own requirements are checked regardless, since the scan and
    the locked claim read them before any policy code runs.
    """
    metadata: sa.MetaData = sa.inspect(policy.model).local_table.metadata
    for dependency in policy.dependencies:
        _validate_dependency_declaration(policy, dependency, metadata)
    _validate_scanner_requirements(policy)


def get_purge_policy(model: type[Any]) -> PurgeEntityPolicy:
    """Resolve a complete policy or reject an unsupported purge model."""
    resolved: _ResolvedRegistry = _resolved_registry()
    try:
        policy: PurgeEntityPolicy = resolved.registry[model]
    except KeyError as ex:
        raise ValueError(f"Unsupported purge model: {model.__name__}") from ex
    if model not in resolved.validated:
        _validated_policy(policy)
        resolved.validated.add(model)
    return policy


def listener_responsibilities(model: type[Any]) -> frozenset[str]:
    """Return persistent listener responsibilities declared for a model."""
    return frozenset(
        declaration.responsibility
        for declaration in declared_delete_listeners()
        if declaration.target is model
        and declaration.effect is not DeleteListenerEffect.OBSERVATIONAL
    )


def validate_deletion_allowed(
    session: Session, policy: PurgeEntityPolicy, entity_id: int
) -> None:
    """Apply every blocker declared for a purge root."""
    metadata: sa.MetaData = sa.inspect(policy.model).local_table.metadata
    for dependency in policy.dependencies:
        if dependency.classification is not DependencyClassification.BLOCK:
            continue
        key: DependencyKey = dependency.key
        table: sa.Table = _dependency_table(metadata, key)
        predicates: tuple[Any, ...] = _dependency_predicates(
            policy, key, entity_id, table
        )
        if session.execute(
            sa.select(sa.literal(1)).select_from(table).where(*predicates).limit(1)
        ).first():
            if dependency.blocker is None:
                raise RuntimeError(f"Missing blocker reason for {key.describe()}")
            raise PurgeBlockedError(dependency.blocker)


def count_dashboard_slices(
    session: Session, policy: PurgeEntityPolicy, entity_id: int
) -> int:
    """Snapshot dashboard membership before explicit cleanup."""
    # avoid circular import: dashboard imports the chart model
    from superset.models.dashboard import dashboard_slices

    column: Any | None = {
        "chart": dashboard_slices.c.slice_id,
        "dashboard": dashboard_slices.c.dashboard_id,
    }.get(policy.entity_type)
    if column is None:
        return 0
    return int(
        session.execute(
            sa.select(sa.func.count())
            .select_from(dashboard_slices)
            .where(column == entity_id)
        ).scalar_one()
    )


def dangling_chart_uuids(
    session: Session, policy: PurgeEntityPolicy, entity_id: int
) -> list[str]:
    """Return chart UUIDs left by the dataset preservation policy."""
    if policy.entity_type != "dataset":
        return []
    from superset.commands.deletion_retention.purge_impact import (
        collect_dataset_purge_impact,
        DatasetPurgeImpact,
    )

    impact: DatasetPurgeImpact = collect_dataset_purge_impact(session, entity_id)
    return [chart.uuid for chart in impact.charts]


def delete_associations(
    session: Session, policy: PurgeEntityPolicy, entity_id: int
) -> None:
    """Execute declared association and tag cleanup with Core DML."""
    _delete_declared_dependencies(
        session, policy, entity_id, DependencyClassification.ASSOCIATION
    )
    _execute_listener_effects(
        session,
        policy,
        entity_id,
        phase=ExecutionPhase.ASSOCIATIONS,
        permission_name=None,
    )


def delete_owned_children(
    session: Session, policy: PurgeEntityPolicy, entity_id: int
) -> None:
    """Execute declared owned-child cleanup with Core DML."""
    _delete_declared_dependencies(
        session, policy, entity_id, DependencyClassification.OWNED
    )


def _delete_declared_dependencies(
    session: Session,
    policy: PurgeEntityPolicy,
    entity_id: int,
    classification: DependencyClassification,
) -> None:
    """Delete inbound FK dependencies declared for one execution class."""
    metadata: sa.MetaData = sa.inspect(policy.model).local_table.metadata
    dependencies: list[DependencyPolicy] = sorted(
        (
            dependency
            for dependency in policy.dependencies
            if dependency.classification is classification
        ),
        key=lambda dependency: _dependency_owner_depth(policy, dependency.key),
        reverse=True,
    )
    for dependency in dependencies:
        key: DependencyKey = dependency.key
        table: sa.Table = _dependency_table(metadata, key)
        predicates: tuple[Any, ...] = _dependency_predicates(
            policy, key, entity_id, table
        )
        session.execute(sa.delete(table).where(*predicates))


def _dependency_table(metadata: sa.MetaData, key: DependencyKey) -> sa.Table:
    """Resolve a declared dependency table or fail with policy context."""
    try:
        return metadata.tables[key.related_table]
    except KeyError as ex:
        raise RuntimeError(f"Purge execution cannot resolve {key.describe()}") from ex


def _dependency_predicates(
    policy: PurgeEntityPolicy,
    key: DependencyKey,
    entity_id: int,
    table: sa.Table,
) -> tuple[Any, ...]:
    """Build an atomic predicate for a simple or composite inbound constraint."""
    if key.kind != "foreign_key" or key.direction != "inbound":
        raise RuntimeError(f"Purge execution cannot use {key.describe()}")
    if len(key.local_columns) != len(key.remote_columns):
        raise RuntimeError(f"Mismatched dependency columns for {key.describe()}")
    owner_values: Any = _owner_value_select(
        policy, key.owner_table, key.local_columns, entity_id
    )
    remote_columns: tuple[sa.Column[Any], ...] = tuple(
        table.c[column_name] for column_name in key.remote_columns
    )
    if len(remote_columns) == 1:
        return (remote_columns[0].in_(owner_values),)
    return (sa.tuple_(*remote_columns).in_(owner_values),)


def _owner_value_select(
    policy: PurgeEntityPolicy,
    owner_table_name: str,
    column_names: tuple[str, ...],
    entity_id: int,
) -> Any:
    """Select owner-column values reachable from the purge root through ownership."""
    root_table: sa.Table = sa.inspect(policy.model).local_table
    metadata: sa.MetaData = root_table.metadata
    owner_table: sa.Table = metadata.tables[owner_table_name]
    selected_columns: tuple[sa.Column[Any], ...] = tuple(
        owner_table.c[column_name] for column_name in column_names
    )
    if owner_table_name == root_table.name:
        return sa.select(*selected_columns).where(root_table.c.id == entity_id)
    reverse_path: list[DependencyKey] = []
    visited: set[str] = set()
    path_table_name: str = owner_table_name
    while path_table_name != root_table.name:
        if path_table_name in visited:
            raise RuntimeError(f"Cyclic ownership path to {owner_table_name}")
        visited.add(path_table_name)
        ownership_key: DependencyKey = _ownership_edge(policy, path_table_name)
        reverse_path.append(ownership_key)
        path_table_name = ownership_key.owner_table

    path: list[DependencyKey] = list(reversed(reverse_path))
    parent_table: sa.Table = root_table
    parent_predicate: Any = root_table.c.id == entity_id
    for index, ownership_key in enumerate(path):
        parent_columns: tuple[sa.Column[Any], ...] = tuple(
            parent_table.c[column_name] for column_name in ownership_key.local_columns
        )
        parent_values: Any = sa.select(*parent_columns).where(parent_predicate)
        child_table: sa.Table = metadata.tables[ownership_key.related_table]
        child_link_columns: tuple[sa.Column[Any], ...] = tuple(
            child_table.c[column_name] for column_name in ownership_key.remote_columns
        )
        parent_predicate = (
            child_link_columns[0].in_(parent_values)
            if len(child_link_columns) == 1
            else sa.tuple_(*child_link_columns).in_(parent_values)
        )
        parent_table = child_table
        if index == len(path) - 1:
            return sa.select(*selected_columns).where(parent_predicate)
    raise RuntimeError(f"Missing ownership path to {owner_table_name}")


def _ownership_edge(policy: PurgeEntityPolicy, owner_table_name: str) -> DependencyKey:
    """Resolve the unique owned/association edge linking a table to the root."""
    ownership_edges: tuple[DependencyKey, ...] = tuple(
        dependency.key
        for dependency in policy.dependencies
        if dependency.classification
        in {DependencyClassification.OWNED, DependencyClassification.ASSOCIATION}
        and dependency.key.related_table == owner_table_name
        and dependency.key.direction == "inbound"
    )
    if len(ownership_edges) != 1:
        raise RuntimeError(
            f"Expected one ownership path to {owner_table_name}, "
            f"found {len(ownership_edges)}"
        )
    return ownership_edges[0]


def _dependency_owner_depth(
    policy: PurgeEntityPolicy,
    key: DependencyKey,
) -> int:
    """Return the number of ownership edges between a dependency and its root."""
    root_table: sa.Table = sa.inspect(policy.model).local_table
    owner_table_name: str = key.owner_table
    visited: set[str] = set()
    depth: int = 0
    while owner_table_name != root_table.name:
        if owner_table_name in visited:
            raise RuntimeError(
                f"Cyclic ownership path while resolving {key.describe()}"
            )
        visited.add(owner_table_name)
        ownership_key: DependencyKey = _ownership_edge(policy, owner_table_name)
        owner_table_name = ownership_key.owner_table
        depth += 1
    return depth


def _execute_listener_effects(
    session: Session,
    policy: PurgeEntityPolicy,
    entity_id: int,
    *,
    phase: ExecutionPhase,
    permission_name: str | None,
) -> None:
    """Execute every listener-equivalent action declared for one phase."""
    for dependency in policy.dependencies:
        if (
            dependency.classification is not DependencyClassification.LISTENER_EFFECT
            or dependency.phase is not phase
        ):
            continue
        if dependency.listener_action is ListenerAction.DELETE_TAGGED_OBJECTS:
            _delete_tagged_objects(session, policy, entity_id)
        elif dependency.listener_action is ListenerAction.DELETE_DATASET_PERMISSION:
            _delete_dataset_permission(session, permission_name, entity_id)
        else:
            raise RuntimeError(
                f"Unsupported listener action for {dependency.key.describe()}"
            )


def _delete_tagged_objects(
    session: Session, policy: PurgeEntityPolicy, entity_id: int
) -> None:
    """Delete tag rows using the declared root object type."""
    from superset.tags.models import ObjectType, TaggedObject

    try:
        object_type: ObjectType = {
            "chart": ObjectType.chart,
            "dashboard": ObjectType.dashboard,
            "dataset": ObjectType.dataset,
        }[policy.entity_type]
    except KeyError as ex:
        raise ValueError(f"Unsupported purge entity type: {policy.entity_type}") from ex
    session.execute(
        sa.delete(TaggedObject.__table__).where(
            TaggedObject.object_id == entity_id,
            TaggedObject.object_type == object_type,
        )
    )


def dataset_permission_name(
    session: Session, policy: PurgeEntityPolicy, entity_id: int
) -> str | None:
    """Capture the dataset permission identifier under the purge row lock.

    Reads the identity columns from the database rather than the in-memory
    entity, so a rename or database move committed before the purge claimed
    the row cannot leave the cleanup targeting a stale permission name.
    """
    if policy.entity_type != "dataset":
        return None
    from superset import security_manager

    metadata: sa.MetaData = sa.inspect(policy.model).local_table.metadata
    tables: sa.Table = metadata.tables["tables"]
    dbs: sa.Table = metadata.tables["dbs"]
    row = session.execute(
        sa.select(tables.c.table_name, dbs.c.database_name)
        .select_from(tables.join(dbs, tables.c.database_id == dbs.c.id))
        .where(tables.c.id == entity_id)
    ).one_or_none()
    if row is None:
        return None
    return str(
        security_manager.get_dataset_perm(entity_id, row.table_name, row.database_name)
    )


def cleanup_dataset_permission(
    session: Session,
    policy: PurgeEntityPolicy,
    permission_name: str | None,
    entity_id: int,
) -> None:
    """Execute the declared dataset permission-listener equivalent."""
    _execute_listener_effects(
        session,
        policy,
        entity_id,
        phase=ExecutionPhase.POST_DELETE,
        permission_name=permission_name,
    )


def _delete_dataset_permission(
    session: Session, permission_name: str | None, entity_id: int
) -> None:
    """Remove the permission artifact represented by a listener declaration."""
    if permission_name is None:
        raise RuntimeError("Dataset permission cleanup requires a captured name")
    from superset import security_manager

    security_manager._delete_pvm_on_sqla_event(  # pylint: disable=protected-access
        None, session.connection(), "datasource_access", permission_name
    )
    logger.debug("deletion_retention: removed dataset permission for id=%s", entity_id)
