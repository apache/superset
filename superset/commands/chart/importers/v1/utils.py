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

import copy
import logging
from inspect import isclass
from typing import Any

from superset import db, security_manager
from superset.commands.exceptions import ImportFailedError
from superset.migrations.shared.migrate_viz import processors
from superset.migrations.shared.migrate_viz.base import MigrateViz
from superset.models.annotations import AnnotationLayer
from superset.models.slice import Slice
from superset.utils import json
from superset.utils.core import AnnotationType, get_user

logger = logging.getLogger(__name__)


def topological_sort_charts(
    chart_configs: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Sort charts so that annotation dependencies are imported first.

    Handles multi-level dependencies (A→B→C) by iteratively resolving
    charts whose in-batch dependencies are already satisfied.
    """
    if len(chart_configs) <= 1:
        return chart_configs

    batch_uuids = {c["uuid"] for c in chart_configs}
    sorted_refs: list[dict[str, Any]] = []
    remaining = list(chart_configs)
    resolved: set[str] = set()
    while remaining:
        next_remaining = []
        for c in remaining:
            unmet = {
                ann["value"]
                for ann in c.get("params", {}).get("annotation_layers", [])
                if ann.get("sourceType") in ("table", "line")
                and isinstance(ann.get("value"), str)
                and ann["value"] in batch_uuids - resolved
            }
            if not unmet:
                sorted_refs.append(c)
                resolved.add(c["uuid"])
            else:
                next_remaining.append(c)
        if len(next_remaining) == len(remaining):
            logger.warning(
                "Circular annotation dependency detected for charts: %s — "
                "these charts may have unresolved annotation references after import.",
                [c["uuid"] for c in next_remaining],
            )
            sorted_refs.extend(next_remaining)
            break
        remaining = next_remaining
    return sorted_refs


def _resolve_uuid_to_id(
    uuid_value: str,
    id_map: dict[str, int] | None,
    model: type,
) -> int | None:
    """Resolve a UUID to a local integer ID using a map or DB fallback."""
    if id_map and uuid_value in id_map:
        return id_map[uuid_value]
    obj = db.session.query(model).filter_by(uuid=uuid_value).first()
    return obj.id if obj else None


def filter_chart_annotations(
    chart_config: dict[str, Any],
    annotation_layer_ids: dict[str, int] | None = None,
    chart_ids: dict[str, int] | None = None,
) -> None:
    """
    Resolve annotation references from exported UUIDs to local integer IDs.
    - FORMULA: kept unchanged (no DB reference)
    - NATIVE: UUID resolved to AnnotationLayer.id
    - table/line: UUID resolved to referenced Chart.id
    Annotations whose references cannot be resolved are dropped.
    """
    params = chart_config.get("params", {})
    annotation_layers = params.get("annotation_layers", [])
    resolved_annotations: list[dict[str, Any]] = []
    for annotation in annotation_layers:
        source_type = annotation.get("sourceType")
        value = annotation.get("value")

        if annotation.get("annotationType") == AnnotationType.FORMULA:
            resolved_annotations.append(annotation)
        elif source_type == "NATIVE" and isinstance(value, str):
            layer_id = _resolve_uuid_to_id(value, annotation_layer_ids, AnnotationLayer)
            if layer_id is not None:
                annotation["value"] = layer_id
                resolved_annotations.append(annotation)
        elif source_type in ("table", "line") and isinstance(value, str):
            ref_chart_id = _resolve_uuid_to_id(value, chart_ids, Slice)
            if ref_chart_id is not None:
                annotation["value"] = ref_chart_id
                resolved_annotations.append(annotation)
    params["annotation_layers"] = resolved_annotations


def _resolve_annotation_list(
    annotations: list[dict[str, Any]],
    annotation_layer_ids: dict[str, int] | None,
    chart_ids: dict[str, int] | None,
) -> None:
    """Resolve UUID values to integer IDs in-place for an annotation list."""
    for annotation in annotations:
        source_type = annotation.get("sourceType")
        value = annotation.get("value")
        if not isinstance(value, str):
            continue
        if source_type == "NATIVE":
            layer_id = _resolve_uuid_to_id(value, annotation_layer_ids, AnnotationLayer)
            if layer_id is not None:
                annotation["value"] = layer_id
        elif source_type in ("table", "line"):
            ref_chart_id = _resolve_uuid_to_id(value, chart_ids, Slice)
            if ref_chart_id is not None:
                annotation["value"] = ref_chart_id


def _resolve_query_context_annotations(
    config: dict[str, Any],
    annotation_layer_ids: dict[str, int] | None,
    chart_ids: dict[str, int] | None,
) -> None:
    """Resolve annotation UUIDs to IDs in query_context (in-place)."""
    if not config.get("query_context"):
        return
    try:
        query_context = json.loads(config["query_context"])
        for query in query_context.get("queries", []):
            _resolve_annotation_list(
                query.get("annotation_layers", []),
                annotation_layer_ids,
                chart_ids,
            )
        form_data = query_context.get("form_data", {})
        _resolve_annotation_list(
            form_data.get("annotation_layers", []),
            annotation_layer_ids,
            chart_ids,
        )
        config["query_context"] = json.dumps(query_context)
    except json.JSONDecodeError:
        pass


def import_chart(
    config: dict[str, Any],
    overwrite: bool = False,
    ignore_permissions: bool = False,
    annotation_layer_ids: dict[str, int] | None = None,
    chart_ids: dict[str, int] | None = None,
) -> Slice:
    can_write = ignore_permissions or security_manager.can_access("can_write", "Chart")
    existing = db.session.query(Slice).filter_by(uuid=config["uuid"]).first()
    user = get_user()
    if existing:
        if overwrite and can_write and user:
            if not security_manager.can_access_chart(existing) or (
                user not in existing.owners and not security_manager.is_admin()
            ):
                raise ImportFailedError(
                    "A chart already exists and user doesn't "
                    "have permissions to overwrite it"
                )
        if not overwrite or not can_write:
            return existing
        config["id"] = existing.id
    elif not can_write:
        raise ImportFailedError(
            "Chart doesn't exist and user doesn't have permission to create charts"
        )

    filter_chart_annotations(
        config,
        annotation_layer_ids=annotation_layer_ids,
        chart_ids=chart_ids,
    )

    _resolve_query_context_annotations(config, annotation_layer_ids, chart_ids)

    # TODO (betodealmeida): move this logic to import_from_dict
    config["params"] = json.dumps(config["params"])

    # migrate old viz types to new ones
    config = migrate_chart(config)

    chart = Slice.import_from_dict(config, recursive=False, allow_reparenting=True)
    if chart.id is None:
        db.session.flush()

    if (user := get_user()) and user not in chart.owners:
        chart.owners.append(user)

    return chart


def migrate_chart(config: dict[str, Any]) -> dict[str, Any]:
    """
    Used to migrate old viz types to new ones.
    """
    migrators = {
        class_.source_viz_type: class_
        for class_ in processors.__dict__.values()
        if isclass(class_)
        and issubclass(class_, MigrateViz)
        and hasattr(class_, "source_viz_type")
    }

    output = copy.deepcopy(config)
    if config["viz_type"] not in migrators:
        return output

    migrator = migrators[config["viz_type"]](output["params"])
    # pylint: disable=protected-access
    migrator._pre_action()
    migrator._migrate()
    migrator._post_action()
    params = migrator.data

    params["viz_type"] = migrator.target_viz_type
    output.update(
        {
            "params": json.dumps(params),
            "viz_type": migrator.target_viz_type,
        }
    )

    # also update `query_context`
    try:
        query_context = json.loads(output.get("query_context") or "{}")
    except (json.JSONDecodeError, TypeError):
        query_context = {}
    if "form_data" in query_context:
        query_context["form_data"] = params
        output["query_context"] = json.dumps(query_context)

    return output
