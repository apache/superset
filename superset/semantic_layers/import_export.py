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
"""Reference-only bundle support for already provisioned semantic views."""

from collections.abc import Iterator
from typing import Any

from marshmallow import ValidationError
from sqlalchemy.orm import joinedload, load_only

from superset import db
from superset.commands.exceptions import CommandInvalidError
from superset.exceptions import SupersetSecurityException
from superset.extensions import feature_flag_manager
from superset.semantic_layers.bundle_schemas import reference_uuid
from superset.semantic_layers.models import SemanticLayer, SemanticView
from superset.semantic_layers.registry import registry


class SemanticReferenceError(CommandInvalidError):
    """A bundle dependency cannot be resolved without changing destination policy."""

    def __init__(self, message: str) -> None:
        """Expose an actionable validation error without protected view metadata."""
        super().__init__(
            message, [ValidationError(message, field_name="semantic_references")]
        )


def dashboard_targets(metadata: dict[str, Any]) -> Iterator[dict[str, Any]]:
    """Visit native-filter and display-control datasource targets."""
    for key in ("native_filter_configuration", "chart_customization_config"):
        controls: Any = metadata.get(key) or []
        if not isinstance(controls, list):
            raise SemanticReferenceError("Dashboard controls must be a list.")
        for control in controls:
            if not isinstance(control, dict):
                raise SemanticReferenceError("Dashboard control must be an object.")
            targets: Any = control.get("targets") or []
            if not isinstance(targets, list) or any(
                not isinstance(target, dict) for target in targets
            ):
                raise SemanticReferenceError(
                    "Dashboard targets must be a list of objects."
                )
            yield from targets


def _check_enabled() -> None:
    """Reject semantic references when their host feature is disabled."""
    if not feature_flag_manager.is_feature_enabled("SEMANTIC_LAYERS"):
        raise SemanticReferenceError(
            "Semantic view references require SEMANTIC_LAYERS."
        )


def _check_view(view: SemanticView | None) -> SemanticView:
    """Authorize before disclosing metadata, without instantiating a provider."""
    if view is None:
        raise SemanticReferenceError(
            "Semantic view reference is missing or inaccessible."
        )
    try:
        view.raise_for_access()
    except SupersetSecurityException as ex:
        raise SemanticReferenceError(
            "Semantic view reference is missing or inaccessible."
        ) from ex
    if not view.semantic_layer or view.semantic_layer.type not in registry:
        raise SemanticReferenceError("Semantic view provider is not registered.")
    return view


def export_view_reference(view: SemanticView | None) -> dict[str, str]:
    """Export only a UUID and type for an accessible existing view."""
    _check_enabled()
    resolved: SemanticView = _check_view(view)
    return {"type": "semantic_view", "uuid": str(resolved.uuid)}


def export_dashboard_references(metadata: dict[str, Any]) -> None:
    """Replace semantic target IDs without ever resolving them as tables."""
    targets: list[dict[str, Any]] = []
    ids: set[int] = set()
    for target in dashboard_targets(metadata):
        source_type: str | None = target.get("datasourceType")
        if source_type is None:
            source_type = "table"
        if source_type == "table":
            continue
        if source_type != "semantic_view":
            raise SemanticReferenceError("Unsupported dashboard datasource type.")
        raw_id: Any = target.get("datasetId")
        if isinstance(raw_id, bool) or not (
            isinstance(raw_id, int) or (isinstance(raw_id, str) and raw_id.isdigit())
        ):
            raise SemanticReferenceError(
                "Semantic dashboard target requires a datasetId."
            )
        ids.add(int(raw_id))
        targets.append(target)
    if not targets:
        return
    _check_enabled()
    views: dict[int, SemanticView] = {
        view.id: view
        for view in db.session.query(SemanticView)
        .options(
            load_only(
                SemanticView.id,
                SemanticView.uuid,
                SemanticView.name,
                SemanticView.perm,
                SemanticView.semantic_layer_uuid,
            ),
            joinedload(SemanticView.semantic_layer).load_only(
                SemanticLayer.type, SemanticLayer.perm
            ),
        )
        .filter(SemanticView.id.in_(ids))
        .all()
    }
    references: dict[int, dict[str, str]] = {
        id_: export_view_reference(views.get(id_)) for id_ in ids
    }
    for target in targets:
        target["datasourceRef"] = references[int(target["datasetId"])].copy()
        target.pop("datasetId", None)
        target.pop("datasetUuid", None)


def _target_uuid(target: dict[str, Any]) -> str | None:
    """Reject ambiguous semantic targets instead of trusting archived local IDs."""
    if "datasourceRef" in target:
        if (
            target.get("datasourceType", "semantic_view") != "semantic_view"
            or "datasetUuid" in target
            or "datasetId" in target
        ):
            raise ValidationError("Conflicting semantic dashboard reference.")
        return reference_uuid(target["datasourceRef"])
    if target.get("datasourceType") not in (None, "table"):
        raise ValidationError("Semantic dashboard target requires datasourceRef.")
    return None


def _bundle_reference_uuids(configs: dict[str, Any]) -> set[str]:
    """Validate the entire reference graph before consulting the metastore."""
    uuids: set[str] = set()
    for path, config in configs.items():
        if path.startswith("charts/") and "datasource_ref" in config:
            if "dataset_uuid" in config:
                raise ValidationError("Specify only one chart datasource reference.")
            uuids.add(reference_uuid(config["datasource_ref"]))
        elif path.startswith("dashboards/"):
            for target in dashboard_targets(config.get("metadata") or {}):
                uuid: str | None = _target_uuid(target)
                if uuid is not None:
                    uuids.add(uuid)
    return uuids


def resolve_bundle_references(
    configs: dict[str, Any],
) -> dict[str, dict[str, Any]]:
    """Preflight every semantic dependency before the caller writes any asset."""
    try:
        uuids: set[str] = _bundle_reference_uuids(configs)
    except ValidationError as ex:
        raise SemanticReferenceError(
            f"Invalid semantic datasource reference: {ex}"
        ) from ex
    if not uuids:
        return {}
    _check_enabled()
    views: dict[str, SemanticView] = {
        str(view.uuid): view
        for view in db.session.query(SemanticView)
        .options(
            load_only(
                SemanticView.id,
                SemanticView.uuid,
                SemanticView.name,
                SemanticView.perm,
                SemanticView.semantic_layer_uuid,
            ),
            joinedload(SemanticView.semantic_layer).load_only(
                SemanticLayer.type, SemanticLayer.perm
            ),
        )
        .filter(SemanticView.uuid.in_(uuids))
        .all()
    }
    result: dict[str, dict[str, Any]] = {}
    for uuid in sorted(uuids):
        view: SemanticView = _check_view(views.get(uuid))
        result[uuid] = {
            "datasource_id": view.id,
            "datasource_type": "semantic_view",
            "datasource_name": view.name,
        }
    return result


def chart_semantic_info(
    config: dict[str, Any], semantic_info: dict[str, dict[str, Any]]
) -> dict[str, Any] | None:
    """Keep the semantic namespace separate from legacy table UUID maps."""
    if "datasource_ref" not in config:
        return None
    return semantic_info[reference_uuid(config.pop("datasource_ref"))]


def restore_dashboard_references(
    metadata: dict[str, Any], semantic_info: dict[str, dict[str, Any]]
) -> None:
    """Rebind validated semantic targets using destination IDs and types."""
    for target in dashboard_targets(metadata):
        uuid: str | None = _target_uuid(target)
        if uuid is not None:
            target.pop("datasourceRef")
            target["datasetId"] = semantic_info[uuid]["datasource_id"]
            target["datasourceType"] = "semantic_view"
