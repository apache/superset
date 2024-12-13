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


def __fix_charts_references_in_scope(
    configuration: dict[str, Any], charts_map: dict[int, int]
) -> dict[str, Any]:
    configuration_scope = configuration.get("scope", {})
    if isinstance(configuration_scope, dict):  # means is not "global"
        if scope_excluded := configuration_scope.get("excluded", []):
            configuration_scope["excluded"] = [
                charts_map[old_id] for old_id in scope_excluded if old_id in charts_map
            ]

    if charts_in_scope := configuration.get("chartsInScope", []):
        configuration["chartsInScope"] = [
            charts_map[old_id] for old_id in charts_in_scope if old_id in charts_map
        ]

    return configuration


def update_id_refs(  # pylint: disable=too-many-locals
    config: dict[str, Any],
    chart_ids: dict[str, int],
    dataset_info: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    """Update dashboard metadata to use new IDs"""
    fixed = config.copy()

    # build map old_id => new_id
    old_ids = build_uuid_to_id_map(fixed["position"])
    id_map = {
        old_id: chart_ids[uuid] for uuid, old_id in old_ids.items() if uuid in chart_ids
    }

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

        __fix_charts_references_in_scope(native_filter, id_map)

    # fix global chart configuration
    global_chart_configuration = fixed.get("metadata", {}).get(
        "global_chart_configuration", {}
    )
    __fix_charts_references_in_scope(global_chart_configuration, id_map)

    # fix chart configuration
    chart_configuration = fixed.get("metadata", {}).get("chart_configuration", {})
    for (
        chart_configuration_key,
        chart_configuration_value,
    ) in chart_configuration.copy().items():
        if new_chart_configuration_key := id_map.get(int(chart_configuration_key)):
            chart_configuration_value["id"] = new_chart_configuration_key
            __fix_charts_references_in_scope(
                chart_configuration_value["crossFilters"], id_map
            )
            chart_configuration[str(new_chart_configuration_key)] = (
                chart_configuration.pop(chart_configuration_key)
            )

    return fixed


def import_dashboard(
    config: dict[str, Any],
    overwrite: bool = False,
    ignore_permissions: bool = False,
) -> Dashboard:
    can_write = ignore_permissions or security_manager.can_access(
        "can_write",
        "Dashboard",
    )
    existing = db.session.query(Dashboard).filter_by(uuid=config["uuid"]).first()
    if existing:
        if overwrite and can_write and get_user():
            if not security_manager.can_access_dashboard(existing):
                raise ImportFailedError(
                    "A dashboard already exists and user doesn't "
                    "have permissions to overwrite it"
                )
        elif not overwrite or not can_write:
            return existing
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

    if (user := get_user()) and user not in dashboard.owners:
        dashboard.owners.append(user)

    return dashboard
