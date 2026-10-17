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
"""Import and export FAB-compatible role definitions."""

from typing import Any, TypedDict

from flask_appbuilder.security.sqla.manager import SecurityManager
from flask_appbuilder.security.sqla.models import PermissionView, Role

from superset.daos.role import RoleDAO
from superset.extensions import db
from superset.utils.decorators import transaction

RolePermissionPairs = list[tuple[str, set[tuple[str, str]]]]


class RoleImportResult(TypedDict):
    """Role names grouped by their outcome during import."""

    created: list[str]
    updated: list[str]
    unchanged: list[str]
    skipped: list[str]


def parse_role_import(definitions: Any) -> RolePermissionPairs:
    """Validate the FAB JSON structure and reject duplicate entries."""
    if not isinstance(definitions, list) or not definitions:
        raise ValueError("Expected a nonempty JSON array")
    names: set[str] = set()
    normalized: RolePermissionPairs = []
    for definition in definitions:
        if (
            not isinstance(definition, dict)
            or not isinstance(definition.get("name"), str)
            or not definition["name"].strip()
        ):
            raise ValueError("Each role must have a nonempty name")
        name = definition["name"].strip()
        if name in names:
            raise ValueError(f"Duplicate role name: {name}")
        names.add(name)
        permissions = definition.get("permissions")
        if not isinstance(permissions, list):
            raise ValueError(f"Invalid permissions for role: {name}")
        pairs: set[tuple[str, str]] = set()
        for entry in permissions:
            permission = (
                entry.get("permission", {}).get("name")
                if isinstance(entry, dict)
                else None
            )
            view = (
                entry.get("view_menu", {}).get("name")
                if isinstance(entry, dict)
                else None
            )
            if (
                not isinstance(permission, str)
                or not permission.strip()
                or not isinstance(view, str)
                or not view.strip()
            ):
                raise ValueError(f"Invalid permission entry for role: {name}")
            pair = (permission, view)
            if pair in pairs:
                raise ValueError(f"Duplicate permission entry for role: {name}")
            pairs.add(pair)
        normalized.append((name, pairs))
    return normalized


def import_roles(definitions: Any, role_manager: SecurityManager) -> RoleImportResult:
    """Import validated custom roles additively, preserving unrelated access."""
    normalized = parse_role_import(definitions)
    available = {
        (pvm.permission.name, pvm.view_menu.name): pvm
        for pvm in db.session.query(PermissionView).all()
    }
    builtin_names = set(role_manager.builtin_roles)
    missing = sorted(
        pair
        for name, pairs in normalized
        if name not in builtin_names
        for pair in pairs
        if pair not in available
    )
    if missing:
        raise ValueError(
            f"Permission pairs are not registered on this instance: {missing}"
        )
    return _apply_role_import(normalized, available, builtin_names, role_manager)


def export_roles(role_ids: list[int]) -> list[dict[str, Any]]:
    """Return selected roles in Flask-AppBuilder's JSON format."""
    roles = db.session.query(Role).filter(Role.id.in_(role_ids)).all()
    if len(roles) != len(role_ids):
        raise LookupError("One or more roles were not found")
    return [
        {
            "name": role.name,
            "permissions": sorted(
                (
                    {
                        "permission": {"name": pvm.permission.name},
                        "view_menu": {"name": pvm.view_menu.name},
                    }
                    for pvm in role.permissions
                ),
                key=lambda item: (
                    item["permission"]["name"],
                    item["view_menu"]["name"],
                ),
            ),
        }
        for role in sorted(roles, key=lambda item: item.name)
    ]


@transaction()
def _apply_role_import(
    normalized: RolePermissionPairs,
    available: dict[tuple[str, str], PermissionView],
    builtin_names: set[str],
    role_manager: SecurityManager,
) -> RoleImportResult:
    """Apply changes together and synchronize Subjects for created roles."""
    created: list[str] = []
    updated: list[str] = []
    unchanged: list[str] = []
    skipped: list[str] = []
    for name, pairs in normalized:
        if name in builtin_names:
            skipped.append(name)
            continue
        role = role_manager.find_role(name)
        if role is None:
            role = role_manager.add_role(name)
            if role is None:
                raise ValueError(f"Unable to create role: {name}")
            RoleDAO._sync_subject(role)
            created.append(name)
        existing = {pvm.id for pvm in role.permissions}
        additions = [
            available[pair] for pair in pairs if available[pair].id not in existing
        ]
        if additions:
            role.permissions.extend(additions)
            if name not in created:
                updated.append(name)
        elif name not in created:
            unchanged.append(name)
    return {
        "created": created,
        "updated": updated,
        "unchanged": unchanged,
        "skipped": skipped,
    }
