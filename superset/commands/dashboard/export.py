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
# isort:skip_file

import logging
import uuid as uuid_module
from typing import Any, Optional, Callable
from collections.abc import Iterator

import yaml

from superset.commands.chart.export import ExportChartsCommand
from superset.commands.tag.export import ExportTagsCommand
from superset.commands.dashboard.exceptions import DashboardNotFoundError
from superset.commands.dashboard.importers.v1.utils import find_chart_uuids
from superset.daos.dashboard import DashboardDAO
from superset.commands.export.models import ExportModelsCommand
from superset.commands.dataset.export import ExportDatasetsCommand
from superset.daos.dataset import DatasetDAO
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice
from superset.tags.models import TagType
from superset.utils.dict_import_export import EXPORT_VERSION
from superset.utils.file import get_filename
from superset.utils import json
from superset.extensions import feature_flag_manager  # Import the feature flag manager

logger = logging.getLogger(__name__)


# keys stored as JSON are loaded and the prefix/suffix removed
JSON_KEYS = {"position_json": "position", "json_metadata": "metadata"}
DEFAULT_CHART_HEIGHT = 50
DEFAULT_CHART_WIDTH = 4


def get_default_position(title: str) -> dict[str, Any]:
    return {
        "DASHBOARD_VERSION_KEY": "v2",
        "ROOT_ID": {"children": ["GRID_ID"], "id": "ROOT_ID", "type": "ROOT"},
        "GRID_ID": {
            "children": [],
            "id": "GRID_ID",
            "parents": ["ROOT_ID"],
            "type": "GRID",
        },
        "HEADER_ID": {"id": "HEADER_ID", "meta": {"text": title}, "type": "HEADER"},
    }


def append_charts(position: dict[str, Any], charts: set[Slice]) -> dict[str, Any]:
    chart_hashes = [f"CHART-{str(chart.uuid)}" for chart in charts]

    # if we have ROOT_ID/GRID_ID, append orphan charts to a new row inside the grid
    row_hash = None
    if "ROOT_ID" in position and "GRID_ID" in position["ROOT_ID"]["children"]:
        row_hash = f"ROW-N-{len(position['GRID_ID']['children'])}"
        position["GRID_ID"]["children"].append(row_hash)
        position[row_hash] = {
            "children": chart_hashes,
            "id": row_hash,
            "meta": {"0": "ROOT_ID", "background": "BACKGROUND_TRANSPARENT"},
            "type": "ROW",
            "parents": ["ROOT_ID", "GRID_ID"],
        }

    for chart_hash, chart in zip(chart_hashes, charts, strict=False):
        position[chart_hash] = {
            "children": [],
            "id": chart_hash,
            "meta": {
                "chartId": chart.id,
                "height": DEFAULT_CHART_HEIGHT,
                "sliceName": chart.slice_name,
                "uuid": str(chart.uuid),
                "width": DEFAULT_CHART_WIDTH,
            },
            "type": "CHART",
        }
        if row_hash:
            position[chart_hash]["parents"] = ["ROOT_ID", "GRID_ID", row_hash]

    return position


# Bound the derived id to the largest positive signed 32-bit integer
# (2**31 - 1) so it stays within the range a database auto-increment primary
# key would occupy and never collides with the sign bit. The concrete value is
# irrelevant — only its stability across environments matters.
_STABLE_CHART_ID_MODULO = 2_147_483_647


def stable_chart_id(chart_uuid: str) -> int:
    """Derive a deterministic, environment-independent integer from a chart UUID.

    The dashboard export format historically embedded ``meta.chartId`` — the
    source environment's auto-increment primary key — inside every ``CHART-*``
    position node (issue #32972). That integer differs between environments, so
    re-exporting an imported dashboard produced a different bundle for the same
    logical content. Deriving the id from the (stable) UUID instead makes the
    export reproducible while still giving the importer an integer it can use to
    rewire the legacy, integer-keyed metadata references back to local IDs.
    """
    return (uuid_module.UUID(chart_uuid).int % _STABLE_CHART_ID_MODULO) + 1


def _stabilize_chart_ids(payload: dict[str, Any]) -> None:
    """Replace env-local integer chart IDs in ``payload`` with UUID-derived ones.

    Rewrites ``meta.chartId`` in every ``CHART`` position node to a value derived
    from ``meta.uuid`` and remaps the legacy, integer-keyed metadata references
    (filter scopes, default filters, expanded slices, native filter scopes, and
    cross-filter/chart configuration) accordingly so the bundle stays internally
    consistent and the import-side id remap resolves against the same IDs.
    Mappings are applied defensively — a reference whose source id is unknown is
    dropped rather than raising, and a node with a malformed ``meta.uuid`` is
    skipped — so a partially corrupt position never aborts the export. See
    ``stable_chart_id`` and issue #32972 for the motivation.
    """
    position = payload.get("position")
    if not isinstance(position, dict):
        return

    # Collect each chart node with its stable UUID-derived id. Nodes are
    # processed in UUID order so that, on the (astronomically unlikely) event
    # that two UUIDs reduce to the same integer, the deterministic collision
    # resolution below assigns the same ids regardless of dict iteration order
    # or environment.
    chart_nodes: list[tuple[str, Any, dict[str, Any]]] = []
    for node in position.values():
        if (
            isinstance(node, dict)
            and node.get("type") == "CHART"
            and isinstance(node.get("meta"), dict)
        ):
            meta = node["meta"]
            chart_uuid = meta.get("uuid")
            if chart_uuid is None:
                continue
            try:
                uuid_module.UUID(str(chart_uuid))
            except ValueError:
                # A malformed ``meta.uuid`` (corrupt position_json) must not
                # abort the whole export — skip stabilizing this single node
                # and leave its existing chartId untouched.
                logger.warning(
                    "Skipping chart id stabilization for invalid uuid %r",
                    chart_uuid,
                )
                continue
            chart_nodes.append((str(chart_uuid), meta.get("chartId"), meta))

    # Map each chart's env-local integer id -> stable UUID-derived id. Since
    # ``stable_chart_id`` reduces a UUID into a finite integer space, two
    # distinct charts could in principle collide; if so, probe forward
    # deterministically so every chart keeps a distinct id and the metadata
    # remaps below never silently overwrite one another.
    id_map: dict[int, int] = {}
    assigned: set[int] = set()
    for chart_uuid, old_id, meta in sorted(chart_nodes, key=lambda item: item[0]):
        new_id = stable_chart_id(chart_uuid)
        while new_id in assigned:
            new_id = (new_id % _STABLE_CHART_ID_MODULO) + 1
        assigned.add(new_id)
        if isinstance(old_id, int):
            id_map[old_id] = new_id
        meta["chartId"] = new_id

    if not id_map:
        return

    metadata = payload.get("metadata")
    if not isinstance(metadata, dict):
        return

    def remap_id(old_id: Any) -> Optional[int]:
        """Map a single legacy chart id to its stabilized id, or ``None``.

        Returns ``None`` when the id is unknown or not coercible to ``int`` so
        callers can drop unresolved references rather than raising.
        """
        try:
            return id_map.get(int(old_id))
        except (TypeError, ValueError):
            return None

    def remap_ids(old_ids: Any) -> list[int]:
        """Remap a collection of legacy chart ids, dropping unresolved entries."""
        return [
            new_id for old_id in old_ids if (new_id := remap_id(old_id)) is not None
        ]

    if isinstance(metadata.get("timed_refresh_immune_slices"), list):
        metadata["timed_refresh_immune_slices"] = remap_ids(
            metadata["timed_refresh_immune_slices"]
        )

    if isinstance(metadata.get("filter_scopes"), dict):
        metadata["filter_scopes"] = {
            str(new_key): columns
            for old_key, columns in metadata["filter_scopes"].items()
            if (new_key := remap_id(old_key)) is not None
        }
        for columns in metadata["filter_scopes"].values():
            if not isinstance(columns, dict):
                continue
            for attributes in columns.values():
                if isinstance(attributes, dict) and isinstance(
                    attributes.get("immune"), list
                ):
                    attributes["immune"] = remap_ids(attributes["immune"])

    if isinstance(metadata.get("expanded_slices"), dict):
        metadata["expanded_slices"] = {
            str(new_key): value
            for old_key, value in metadata["expanded_slices"].items()
            if (new_key := remap_id(old_key)) is not None
        }

    if metadata.get("default_filters"):
        try:
            default_filters = json.loads(metadata["default_filters"])
        except (TypeError, json.JSONDecodeError):
            default_filters = None
        if isinstance(default_filters, dict):
            metadata["default_filters"] = json.dumps(
                {
                    str(new_key): value
                    for old_key, value in default_filters.items()
                    if (new_key := remap_id(old_key)) is not None
                }
            )

    def remap_scope(container: Any) -> None:
        """Remap ``scope.excluded`` and ``chartsInScope`` of a filter container.

        Shared by native filters and (global) cross-filter configuration, which
        both denormalize the charts a filter applies to into these two lists.
        """
        if not isinstance(container, dict):
            return
        scope = container.get("scope")
        if isinstance(scope, dict) and isinstance(scope.get("excluded"), list):
            scope["excluded"] = remap_ids(scope["excluded"])
        if isinstance(container.get("chartsInScope"), list):
            container["chartsInScope"] = remap_ids(container["chartsInScope"])

    if isinstance(metadata.get("native_filter_configuration"), list):
        for native_filter in metadata["native_filter_configuration"]:
            remap_scope(native_filter)

    if isinstance(metadata.get("global_chart_configuration"), dict):
        remap_scope(metadata["global_chart_configuration"])

    if isinstance(metadata.get("chart_configuration"), dict):
        new_chart_configuration: dict[str, Any] = {}
        for old_key, chart_config in metadata["chart_configuration"].items():
            new_key = remap_id(old_key)
            if new_key is None:
                continue
            if isinstance(chart_config, dict):
                if isinstance(chart_config.get("id"), int):
                    chart_config["id"] = new_key
                remap_scope(chart_config.get("crossFilters"))
            new_chart_configuration[str(new_key)] = chart_config
        metadata["chart_configuration"] = new_chart_configuration


class ExportDashboardsCommand(ExportModelsCommand):
    dao = DashboardDAO
    not_found = DashboardNotFoundError

    @staticmethod
    def _file_name(model: Dashboard) -> str:
        file_name = get_filename(model.dashboard_title, model.id)
        return f"dashboards/{file_name}.yaml"

    @staticmethod
    # ruff: noqa: C901
    def _file_content(model: Dashboard) -> str:
        payload = model.export_to_dict(
            recursive=False,
            include_parent_ref=False,
            include_defaults=True,
            export_uuids=True,
        )
        # TODO (betodealmeida): move this logic to export_to_dict once this
        #  becomes the default export endpoint
        for key, new_name in JSON_KEYS.items():
            value: Optional[str] = payload.pop(key, None)
            if value:
                try:
                    payload[new_name] = json.loads(value)
                except (TypeError, json.JSONDecodeError):
                    logger.info("Unable to decode `%s` field: %s", key, value)
                    payload[new_name] = {}

        # Extract all native filter datasets and replace native
        # filter dataset references with uuid
        for native_filter in payload.get("metadata", {}).get(
            "native_filter_configuration", []
        ):
            for target in native_filter.get("targets", []):
                dataset_id = target.pop("datasetId", None)
                if dataset_id is not None:
                    dataset = DatasetDAO.find_by_id(dataset_id)
                    if dataset:
                        target["datasetUuid"] = str(dataset.uuid)

        # Replace display control dataset references with uuid.
        # datasetId is intentionally preserved alongside datasetUuid so that
        # bundles remain importable by older versions that do not yet understand
        # datasetUuid for display-control targets.
        for customization in (
            payload.get("metadata", {}).get("chart_customization_config") or []
        ):
            for target in customization.get("targets") or []:
                dataset_id = target.get("datasetId")
                if dataset_id is not None:
                    dataset = DatasetDAO.find_by_id(dataset_id)
                    if dataset:
                        target["datasetUuid"] = str(dataset.uuid)
                    else:
                        logger.warning(
                            "Dashboard '%s': display control target references "
                            "missing dataset %s; datasetUuid will not be set",
                            model.dashboard_title,
                            dataset_id,
                        )

        # the mapping between dashboard -> charts is inferred from the position
        # attribute, so if it's not present we need to add a default config
        if not payload.get("position"):
            payload["position"] = get_default_position(model.dashboard_title)

        # if any charts or not referenced in position, we need to add them
        # in a new row
        referenced_charts = find_chart_uuids(payload["position"])
        orphan_charts = {
            chart for chart in model.slices if str(chart.uuid) not in referenced_charts
        }

        if orphan_charts:
            payload["position"] = append_charts(payload["position"], orphan_charts)

        # Strip env-local integer chart IDs in favor of UUID-derived ones so the
        # export is reproducible across environments (issue #32972). Must run
        # after orphan charts are appended so their nodes are stabilized too.
        _stabilize_chart_ids(payload)

        # Add theme UUID for proper cross-system imports
        payload["theme_uuid"] = str(model.theme.uuid) if model.theme else None

        payload["version"] = EXPORT_VERSION

        # Check if the TAGGING_SYSTEM feature is enabled
        if feature_flag_manager.is_feature_enabled("TAGGING_SYSTEM"):
            tags = model.tags if hasattr(model, "tags") else []
            payload["tags"] = [tag.name for tag in tags if tag.type == TagType.custom]

        file_content = yaml.safe_dump(payload, sort_keys=False, allow_unicode=True)
        return file_content

    @staticmethod
    # ruff: noqa: C901
    def _export(
        model: Dashboard, export_related: bool = True
    ) -> Iterator[tuple[str, Callable[[], str]]]:
        yield (
            ExportDashboardsCommand._file_name(model),
            lambda: ExportDashboardsCommand._file_content(model),
        )

        if export_related:
            chart_ids = [chart.id for chart in model.slices]
            dashboard_ids = model.id
            command = ExportChartsCommand(chart_ids)
            command.disable_tag_export()
            yield from command.run()
            command.enable_tag_export()
            if feature_flag_manager.is_feature_enabled("TAGGING_SYSTEM"):
                yield from ExportTagsCommand.export(
                    dashboard_ids=dashboard_ids, chart_ids=chart_ids
                )

            # Export related theme
            if model.theme:
                from superset.commands.theme.export import ExportThemesCommand

                yield from ExportThemesCommand([model.theme.id]).run()

        payload = model.export_to_dict(
            recursive=False,
            include_parent_ref=False,
            include_defaults=True,
            export_uuids=True,
        )
        # TODO (betodealmeida): move this logic to export_to_dict once this
        #  becomes the default export endpoint
        for key, new_name in JSON_KEYS.items():
            value: Optional[str] = payload.pop(key, None)
            if value:
                try:
                    payload[new_name] = json.loads(value)
                except (TypeError, json.JSONDecodeError):
                    logger.info("Unable to decode `%s` field: %s", key, value)
                    payload[new_name] = {}

        if export_related:
            # Extract all native filter datasets and export referenced datasets
            for native_filter in payload.get("metadata", {}).get(
                "native_filter_configuration", []
            ):
                for target in native_filter.get("targets", []):
                    dataset_id = target.pop("datasetId", None)
                    if dataset_id is not None:
                        dataset = DatasetDAO.find_by_id(dataset_id)
                        if dataset:
                            yield from ExportDatasetsCommand([dataset_id]).run()

            # Export datasets referenced by display controls
            for customization in (
                payload.get("metadata", {}).get("chart_customization_config") or []
            ):
                for target in customization.get("targets") or []:
                    dataset_id = target.get("datasetId")
                    if dataset_id is not None:
                        dataset = DatasetDAO.find_by_id(dataset_id)
                        if dataset:
                            yield from ExportDatasetsCommand([dataset_id]).run()
