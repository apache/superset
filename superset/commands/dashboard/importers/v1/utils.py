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

import logging
from typing import Any

from superset import db, security_manager
from superset.commands.exceptions import ImportFailedError
from superset.models.dashboard import Dashboard
from superset.utils import json
from superset.utils.core import get_user

logger = logging.getLogger(__name__)


JSON_KEYS = {"position": "position_json", "metadata": "json_metadata"}


def find_chart_uuids(position: dict[str, Any]) -> set[str]:
    return set(build_uuid_to_id_map(position))


def find_native_filter_datasets(metadata: dict[str, Any]) -> set[str]:
    uuids: set[str] = set()
    for native_filter in metadata.get("native_filter_configuration", []):
        targets = native_filter.get("targets", [])
        for target in targets:
            dataset_uuid = target.get("datasetUuid")
            if dataset_uuid:
                uuids.add(dataset_uuid)
    for customization in metadata.get("chart_customization_config") or []:
        for target in customization.get("targets") or []:
            dataset_uuid = target.get("datasetUuid")
            if dataset_uuid:
                uuids.add(dataset_uuid)
    return uuids


def build_uuid_to_id_map(position: dict[str, Any]) -> dict[str, int]:
    return {
        child["meta"]["uuid"]: child["meta"]["chartId"]
        for child in position.values()
        if (
            isinstance(child, dict)
            and child["type"] == "CHART"
            and "uuid" in child["meta"]
        )
    }


def update_id_refs(  # pylint: disable=too-many-locals  # noqa: C901
    config: dict[str, Any],
    chart_ids: dict[str, int],
    dataset_info: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """Update dashboard metadata to use new IDs"""
    fixed = config.copy()

    # build map old_id => new_id and uuid => new_id
    old_ids = build_uuid_to_id_map(fixed["position"])
    id_map = {
        old_id: chart_ids[uuid] for uuid, old_id in old_ids.items() if uuid in chart_ids
    }
    uuid_to_new_id = {uuid: chart_ids[uuid] for uuid in old_ids if uuid in chart_ids}

    # fix metadata
    metadata = fixed.get("metadata", {})
    if "timed_refresh_immune_slices" in metadata:
        metadata["timed_refresh_immune_slices"] = [
            id_map[old_id] for old_id in metadata["timed_refresh_immune_slices"]
        ]

    if "filter_scopes" in metadata:
        # in filter_scopes the key is the chart ID as a string; we need to update
        # them to be the new ID as a string:
        metadata["filter_scopes"] = {
            str(id_map[int(old_id)]): columns
            for old_id, columns in metadata["filter_scopes"].items()
            if int(old_id) in id_map
        }

        # now update columns to use new IDs:
        for columns in metadata["filter_scopes"].values():
            for attributes in columns.values():
                attributes["immune"] = [
                    id_map[old_id]
                    for old_id in attributes["immune"]
                    if old_id in id_map
                ]

    if "expanded_slices" in metadata:
        metadata["expanded_slices"] = {
            str(id_map[int(old_id)]): value
            for old_id, value in metadata["expanded_slices"].items()
        }

    if "default_filters" in metadata:
        default_filters = json.loads(metadata["default_filters"])
        metadata["default_filters"] = json.dumps(
            {
                str(id_map[int(old_id)]): value
                for old_id, value in default_filters.items()
                if int(old_id) in id_map
            }
        )

    # fix position
    position = fixed.get("position", {})
    for child in position.values():
        if (
            isinstance(child, dict)
            and child["type"] == "CHART"
            and "uuid" in child["meta"]
            and child["meta"]["uuid"] in chart_ids
        ):
            child["meta"]["chartId"] = chart_ids[child["meta"]["uuid"]]

    # fix native filter references
    native_filter_configuration = fixed.get("metadata", {}).get(
        "native_filter_configuration", []
    )
    for native_filter in native_filter_configuration:
        targets = native_filter.get("targets", [])
        for target in targets:
            dataset_uuid = target.pop("datasetUuid", None)
            if dataset_uuid:
                target["datasetId"] = dataset_info[dataset_uuid]["datasource_id"]

        scope_excluded = native_filter.get("scope", {}).get("excluded", [])
        if scope_excluded:
            native_filter["scope"]["excluded"] = [
                id_map[old_id] for old_id in scope_excluded if old_id in id_map
            ]

        charts_in_scope = native_filter.get("chartsInScope", [])
        if charts_in_scope:
            native_filter["chartsInScope"] = _remap_chart_ids(
                charts_in_scope, id_map, uuid_to_new_id
            )

    # fix display control dataset references
    for customization in (
        fixed.get("metadata", {}).get("chart_customization_config") or []
    ):
        for target in customization.get("targets") or []:
            dataset_uuid = target.pop("datasetUuid", None)
            if dataset_uuid:
                info = dataset_info.get(dataset_uuid)
                if info:
                    target["datasetId"] = info["datasource_id"]
                else:
                    # UUID present but unresolvable — remove stale integer ID
                    # so the control fails visibly rather than binding to
                    # whatever dataset happens to own that ID in this environment
                    target.pop("datasetId", None)
                    logger.warning(
                        "Display control target references unknown dataset UUID %s; "
                        "datasetId will not be restored",
                        dataset_uuid,
                    )

    fixed = update_cross_filter_scoping(fixed, id_map, uuid_to_new_id)
    return fixed


def _remap_chart_ids(
    id_list: list[Any],
    id_map: dict[int, int],
    uuid_to_new_id: dict[str, int] | None = None,
) -> list[int]:
    """Remap old chart IDs (int or UUID string) to new integer IDs.

    Handles both the standard import format (integer IDs) and the example-export
    format (UUID strings produced by export_example.remap_chart_configuration).
    """
    result = []
    for item in id_list:
        if isinstance(item, int):
            if item in id_map:
                result.append(id_map[item])
        elif isinstance(item, str) and uuid_to_new_id:
            new_id = uuid_to_new_id.get(item)
            if new_id is not None:
                result.append(new_id)
    return result


def _update_cross_filter_scope(
    cross_filter_config: Any,
    id_map: dict[int, int],
    uuid_to_new_id: dict[str, int] | None = None,
) -> None:
    """Update scope.excluded and chartsInScope in a cross-filter configuration.

    Imported dashboard metadata is loosely validated, so malformed payloads may
    supply ``null`` or non-dict values where a cross-filter config is expected.
    Skip anything that isn't a dict rather than raising ``AttributeError``.
    """
    if not isinstance(cross_filter_config, dict):
        return

    scope = cross_filter_config.get("scope", {})
    if isinstance(scope, dict):
        if excluded := scope.get("excluded", []):
            scope["excluded"] = _remap_chart_ids(excluded, id_map, uuid_to_new_id)

    if charts_in_scope := cross_filter_config.get("chartsInScope", []):
        cross_filter_config["chartsInScope"] = _remap_chart_ids(
            charts_in_scope, id_map, uuid_to_new_id
        )


def update_cross_filter_scoping(
    config: dict[str, Any],
    id_map: dict[int, int],
    uuid_to_new_id: dict[str, int] | None = None,
) -> dict[str, Any]:
    """Fix cross filter references by remapping chart IDs.

    Handles both the standard import format (integer-keyed chart_configuration)
    and the example-export format (UUID-keyed, produced by export_example).
    """
    fixed = config.copy()
    metadata = fixed.get("metadata", {})

    # Update global_chart_configuration
    global_config = metadata.get("global_chart_configuration", {})
    _update_cross_filter_scope(global_config, id_map, uuid_to_new_id)

    # Update chart_configuration entries
    if "chart_configuration" not in metadata:
        return fixed

    new_chart_configuration: dict[str, Any] = {}
    for old_id_str, chart_config in metadata["chart_configuration"].items():
        try:
            old_id_int = int(old_id_str)
            new_id = id_map.get(old_id_int)
            if new_id is None:
                continue
        except (TypeError, ValueError):
            # UUID-keyed entry (e.g. from export_example): resolve via chart UUIDs
            new_id = uuid_to_new_id.get(old_id_str) if uuid_to_new_id else None
            if new_id is None:
                # Unknown key — preserve unchanged rather than silently drop
                new_chart_configuration[old_id_str] = chart_config
                continue

        if isinstance(chart_config, dict):
            chart_config["id"] = new_id
            if cross_filters := chart_config.get("crossFilters", {}):
                _update_cross_filter_scope(cross_filters, id_map, uuid_to_new_id)

        new_chart_configuration[str(new_id)] = chart_config

    metadata["chart_configuration"] = new_chart_configuration
    return fixed


def import_dashboard(  # noqa: C901
    config: dict[str, Any],
    overwrite: bool = False,
    ignore_permissions: bool = False,
) -> Dashboard:
    """Import a dashboard from a config dict, handling existing matches.

    Permission model for an existing UUID match:

    +--------------+---------------+---------------------+-----------------+
    | Existing row | overwrite arg | Caller has perms?   | Outcome         |
    +==============+===============+=====================+=================+
    | alive        | False         | (n/a)               | return existing |
    +--------------+---------------+---------------------+-----------------+
    | alive        | True          | can_write + owner   | UPDATE in place |
    +--------------+---------------+---------------------+-----------------+
    | alive        | True          | can_write,          | raise           |
    |              |               | not owner/admin     |                 |
    +--------------+---------------+---------------------+-----------------+
    | soft-deleted | False or True | can_write + owner   | restore + UPDATE|
    +--------------+---------------+---------------------+-----------------+
    | soft-deleted | False or True | can_write,          | raise           |
    |              |               | not owner/admin     |                 |
    +--------------+---------------+---------------------+-----------------+
    | soft-deleted | False or True | not can_write       | raise (Case B)  |
    +--------------+---------------+---------------------+-----------------+

    "owner" in the matrix above means the caller is in ``existing.owners``
    OR is an admin (the ownership check is bypassed for admins). The
    mutation path also requires ``security_manager.can_access_dashboard
    (existing)`` to pass — a per-row RBAC check distinct from the
    ``can_write`` model-level grant.

    Re-importing a soft-deleted UUID is implicitly a restore-with-update:
    the user is bringing the dashboard back by uploading it again. We apply
    the same ownership check as the explicit overwrite path so non-owners
    cannot resurrect via re-import, and we raise rather than silently
    returning a soft-deleted row to callers without write permission.

    See specs/sc-103157-soft-deletes/bypass-primer.md for the cross-entity
    rules this implementation follows.
    """
    can_write = ignore_permissions or security_manager.can_access(
        "can_write",
        "Dashboard",
    )
    from superset.commands.importers.v1.utils import find_existing_for_import

    user = get_user()

    if existing := find_existing_for_import(Dashboard, config["uuid"]):
        is_soft_deleted = existing.deleted_at is not None
        needs_mutation = overwrite or is_soft_deleted
        if needs_mutation and can_write and user:
            if not security_manager.can_access_dashboard(existing) or (
                user not in existing.owners and not security_manager.is_admin()
            ):
                raise ImportFailedError(
                    "A dashboard already exists and user doesn't have "
                    "permissions to "
                    f"{'restore' if is_soft_deleted else 'overwrite'} it"
                )
        if needs_mutation and not can_write:
            # Case B: would-be restore-via-import without write permission.
            # Raise rather than silently returning the soft-deleted row.
            raise ImportFailedError(
                "Dashboard was deleted and re-import requires can_write "
                "permission to restore it"
            )
        if not needs_mutation or not can_write:
            return existing
        # Mutation path. Restore a soft-deleted match in place rather
        # than hard-delete-and-replace: a hard delete would cascade
        # through dashboard_slices junctions and DashboardRoles / owner
        # / tag associations, breaking the relationships the import
        # would then need to reconstruct.
        #
        # How the restore lands as an UPDATE: clearing
        # existing.deleted_at marks the in-session row dirty and the
        # explicit flush emits the deleted_at = NULL UPDATE before
        # Dashboard.import_from_dict (below) does its own query-by-uuid
        # lookup. Without the flush we would be relying on autoflush
        # ahead of that internal query — correct under default session
        # config but a hidden contract; the explicit flush makes it
        # robust. The lookup then finds the now-live row (the listener
        # filters deleted_at IS NULL) and import_from_dict applies the
        # config as field updates on the existing object, preserving
        # the PK. Note: config["id"] is set defensively, but
        # ImportExportMixin.import_from_dict strips it today because
        # Dashboard.export_fields does not contain "id"; what actually
        # binds to the existing row is the uuid uniqueness constraint
        # used inside import_from_dict.
        if is_soft_deleted:
            existing.deleted_at = None
            db.session.flush()
        config["id"] = existing.id
    elif not can_write:
        raise ImportFailedError(
            "Dashboard doesn't exist and user doesn't "
            "have permission to create dashboards"
        )

    # TODO (betodealmeida): move this logic to import_from_dict
    config = config.copy()

    # removed in https://github.com/apache/superset/pull/23228
    if "metadata" in config and "show_native_filters" in config["metadata"]:
        del config["metadata"]["show_native_filters"]

    # Note: theme_id handling moved to higher level import logic

    # Pop roles before handing config to import_from_dict — it's a
    # relationship, not a column, and the standard SQLAlchemy import path
    # doesn't resolve role *names* into role objects. We re-attach below.
    role_names = config.pop("roles", None)

    for key, new_name in JSON_KEYS.items():
        if config.get(key) is not None:
            value = config.pop(key)
            try:
                config[new_name] = json.dumps(value)
            except TypeError:
                logger.info("Unable to encode `%s` field: %s", key, value)

    dashboard = Dashboard.import_from_dict(config, recursive=False)
    if dashboard.id is None:
        db.session.flush()

    if not existing and user and user not in dashboard.owners:
        dashboard.owners.append(user)

    # Re-attach DASHBOARD_RBAC role assignments by name. Role IDs are
    # environment-local; names are how exports cross environments. Roles
    # that don't exist in the destination are skipped with a warning
    # rather than failing the import — admins may need to create them
    # before the access restriction takes effect.
    if isinstance(role_names, list) and role_names:
        resolved_roles = []
        for name in role_names:
            role = security_manager.find_role(name)
            if role is not None:
                resolved_roles.append(role)
            else:
                logger.warning(
                    "Dashboard '%s': role %r referenced in export does not "
                    "exist in this environment; access restriction will not "
                    "be applied for that role",
                    dashboard.dashboard_title,
                    name,
                )
        dashboard.roles = resolved_roles

    return dashboard
