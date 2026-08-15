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
"""Declarative policies for explicit deletion-retention purges."""

from __future__ import annotations

import logging
from collections.abc import Callable, Hashable, Iterable, Mapping
from dataclasses import dataclass
from enum import Enum
from functools import lru_cache
from types import MappingProxyType
from typing import Any, cast

import sqlalchemy as sa
from sqlalchemy.orm import Mapper, Session

from superset.utils.sqlalchemy_events import (
    declared_delete_listeners,
    DeleteListenerEffect,
)

logger: logging.Logger = logging.getLogger(__name__)


class PurgeBlockedError(Exception):
    """Raised when ordinary deletion policy forbids purging an entity."""


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
    blocked_reason: str | None = None
    optional_listener: bool = False
    listener_action: ListenerAction | None = None
    version_column: str | None = None


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
    """Discover physical FKs and relationships, recursing through owned tables."""
    table: sa.Table = mapper.local_table
    if table.name in visited:
        return frozenset()
    next_visited: frozenset[str] = visited | {table.name}
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
            discovered.update(
                discover_dependencies(
                    related_mapper,
                    recursive_tables=recursive_tables,
                    visited=next_visited,
                )
            )
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
        _discover_recursive_table_dependencies(
            table,
            recursive_tables=recursive_tables,
            visited=next_visited,
        )
    )
    return frozenset(discovered)


def _discover_table_dependencies(
    table: sa.Table,
    *,
    recursive_tables: frozenset[str],
    visited: frozenset[str],
) -> frozenset[DependencyKey]:
    """Discover physical edges for unmapped association and owned tables."""
    if table.name in visited:
        return frozenset()
    next_visited: frozenset[str] = visited | {table.name}
    discovered: set[DependencyKey] = {
        _fk_key(table, constraint, "outbound")
        for constraint in table.foreign_key_constraints
    }
    for candidate in table.metadata.tables.values():
        for constraint in candidate.foreign_key_constraints:
            if constraint.elements[0].column.table is table:
                discovered.add(_fk_key(table, constraint, "inbound"))
    discovered.update(
        _discover_recursive_table_dependencies(
            table,
            recursive_tables=recursive_tables,
            visited=next_visited,
        )
    )
    return frozenset(discovered)


def _discover_recursive_table_dependencies(
    table: sa.Table,
    *,
    recursive_tables: frozenset[str],
    visited: frozenset[str],
) -> frozenset[DependencyKey]:
    """Discover dependencies for named recursive tables not already visited."""
    discovered: set[DependencyKey] = set()
    for recursive_table_name in recursive_tables - visited:
        recursive_table: sa.Table | None = table.metadata.tables.get(
            recursive_table_name
        )
        if recursive_table is not None:
            discovered.update(
                _discover_table_dependencies(
                    recursive_table,
                    recursive_tables=recursive_tables,
                    visited=visited,
                )
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
def purge_policy_registry() -> Mapping[type[Any], PurgeEntityPolicy]:
    """Build the supported purge registry after model initialization."""
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
        blocked_reasons: Mapping[str, str] = MappingProxyType({}),
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
        return (
            tuple(
                DependencyPolicy(
                    key,
                    classification,
                    phases[classification],
                    blocked_reason=blocked_reasons.get(key.related_table),
                    version_column=version_columns.get(key.related_table),
                )
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
                ),
                (tag_cleanup, chart_membership_versions),
                {"report_schedule": "associated alerts or reports exist"},
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
                {
                    "report_schedule": "associated alerts or reports exist",
                    "user_attribute": (
                        "a user has this dashboard set as their welcome page"
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
    return validate_unique_root_policies(registry.values())


@lru_cache(maxsize=None)
def _validated_purge_policy(model: type[Any]) -> PurgeEntityPolicy:
    """Validate and return one root policy without blocking unrelated roots."""
    try:
        policy: PurgeEntityPolicy = purge_policy_registry()[model]
    except KeyError as ex:
        raise ValueError(f"Unsupported purge model: {model.__name__}") from ex
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
        raise RuntimeError(f"Incomplete purge policy for {model.__name__}: {details}")
    return policy


def _validate_executable_declarations(policy: PurgeEntityPolicy) -> None:
    """Reject executable classifications missing their required action metadata."""
    for dependency in policy.dependencies:
        if (
            dependency.classification is DependencyClassification.LISTENER_EFFECT
            and dependency.listener_action is None
        ):
            raise RuntimeError(
                f"Missing listener action for {dependency.key.describe()}"
            )
        if (
            dependency.classification is DependencyClassification.VERSION_OWNED
            and dependency.version_column is None
        ):
            raise RuntimeError(
                f"Missing version target column for {dependency.key.describe()}"
            )


def get_purge_policy(model: type[Any]) -> PurgeEntityPolicy:
    """Resolve a complete policy or reject an unsupported purge model."""
    return _validated_purge_policy(cast(Hashable, model))


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
            if dependency.blocked_reason is None:
                raise RuntimeError(f"Missing blocker reason for {key.describe()}")
            raise PurgeBlockedError(dependency.blocked_reason)


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
    # avoid circular import: the chart model participates in registry assembly
    from superset.models.slice import Slice

    return [
        str(chart_uuid)
        for (chart_uuid,) in session.execute(
            sa.select(Slice.uuid)
            .where(Slice.datasource_id == entity_id)
            .where(Slice.datasource_type == "table")
        )
    ]


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
