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
from superset.commands.importers.v1.utils import find_existing_for_import
from superset.migrations.shared.migrate_viz import processors
from superset.migrations.shared.migrate_viz.base import MigrateViz
from superset.models.annotations import AnnotationLayer
from superset.models.slice import Slice
from superset.subjects.models import Subject
from superset.utils import json
from superset.utils.core import (
    ANNOTATION_SOURCE_TYPES_WITH_CHART_REFERENCE,
    AnnotationType,
    get_user,
)

logger = logging.getLogger(__name__)


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
        elif source_type == "NATIVE" and isinstance(value, int):
            resolved_annotations.append(annotation)
        elif source_type == "NATIVE" and isinstance(value, str):
            layer_id = _resolve_uuid_to_id(value, annotation_layer_ids, AnnotationLayer)
            if layer_id is not None:
                annotation["value"] = layer_id
                resolved_annotations.append(annotation)
        elif source_type in ANNOTATION_SOURCE_TYPES_WITH_CHART_REFERENCE and isinstance(
            value, int
        ):
            resolved_annotations.append(annotation)
        elif source_type in ANNOTATION_SOURCE_TYPES_WITH_CHART_REFERENCE and isinstance(
            value, str
        ):
            ref_chart_id = _resolve_uuid_to_id(value, chart_ids, Slice)
            if ref_chart_id is not None:
                annotation["value"] = ref_chart_id
                resolved_annotations.append(annotation)
    params["annotation_layers"] = resolved_annotations


def _ensure_can_edit_existing_chart(
    existing: Slice,
    user: Any,
    error_message: str,
) -> None:
    if user and (
        not security_manager.can_access_chart(existing)
        or not security_manager.is_editor(existing)
    ):
        raise ImportFailedError(error_message)


def _restore_existing_chart_for_import(
    existing: Slice,
    config: dict[str, Any],
    can_write: bool,
    user: Any,
) -> None:
    # RESTORE path — re-importing a soft-deleted UUID is an implicit
    # restore-with-update, a distinct operation from overwriting an
    # alive row, so it is handled in its own branch.
    if not can_write:
        # Case B: don't silently return a soft-deleted row to a caller
        # without write permission — that would let the dashboard
        # importer reattach to a deleted chart and produce a broken
        # dashboard.
        # Name the chart: a dashboard bundle imports many charts, and
        # without the identity the operator can't tell which of N
        # charts in the bundle hit the soft-deleted match.
        raise ImportFailedError(
            f"Chart {existing.slice_name!r} (uuid {config['uuid']}) "
            f"was deleted and re-import requires can_write "
            f"permission to restore it"
        )
    # ``user`` is None on background / example-loader paths; combined
    # with ``can_write`` (typically from ``ignore_permissions=True``)
    # the editorship check is intentionally skipped because the caller
    # already established trust.
    _ensure_can_edit_existing_chart(
        existing,
        user,
        f"Chart {existing.slice_name!r} (uuid {config['uuid']}) "
        f"already exists and user doesn't have permissions to restore it",
    )
    # Restore in place (clear ``deleted_at``) rather than
    # hard-delete-and-replace: a hard delete would cascade to
    # dashboard_slices and other FK references, breaking the dashboards
    # that previously embedded this chart.
    #
    # How the restore lands as an UPDATE: clearing
    # ``existing.deleted_at`` marks the in-session row dirty and the
    # explicit flush emits the ``deleted_at = NULL`` UPDATE before
    # ``Slice.import_from_dict`` (below) does its own query-by-uuid
    # lookup. Without the flush we would rely on autoflush ahead of that
    # internal query — correct under default session config but a hidden
    # contract; the explicit flush makes it robust. The lookup then
    # finds the now-live row (the listener filters ``deleted_at IS
    # NULL``) and ``import_from_dict`` applies the config as field
    # updates on the existing object, preserving the PK.
    existing.restore()
    db.session.flush()
    config["id"] = existing.id


def _prepare_existing_chart_for_import(
    existing: Slice,
    config: dict[str, Any],
    overwrite: bool,
    can_write: bool,
    user: Any,
) -> Slice | None:
    if existing.deleted_at is not None:
        _restore_existing_chart_for_import(existing, config, can_write, user)
        return None

    # OVERWRITE path — existing alive row. Without ``overwrite`` or
    # write permission, return it unchanged (the pre-soft-delete
    # overwrite-without-permission behaviour).
    if not overwrite or not can_write:
        return existing
    _ensure_can_edit_existing_chart(
        existing,
        user,
        "A chart already exists and user doesn't have permissions to overwrite it",
    )
    config["id"] = existing.id
    return None


def import_chart(
    config: dict[str, Any],
    overwrite: bool = False,
    ignore_permissions: bool = False,
    default_viewers: list[Subject] | None = None,
    annotation_layer_ids: dict[str, int] | None = None,
    chart_ids: dict[str, int] | None = None,
) -> Slice:
    """Import a chart from a config dict, handling existing matches.

    Permission model for an existing UUID match:

    +--------------+---------------+---------------------+-----------------+
    | Existing row | overwrite arg | Caller has perms?   | Outcome         |
    +==============+===============+=====================+=================+
    | alive        | False         | (n/a)               | return existing |
    +--------------+---------------+---------------------+-----------------+
    | alive        | True          | can_write + editor  | UPDATE in place |
    +--------------+---------------+---------------------+-----------------+
    | alive        | True          | can_write,          | raise           |
    |              |               | not editor/admin    |                 |
    +--------------+---------------+---------------------+-----------------+
    | soft-deleted | False or True | can_write + editor  | restore + UPDATE|
    +--------------+---------------+---------------------+-----------------+
    | soft-deleted | False or True | can_write,          | raise           |
    |              |               | not editor/admin    |                 |
    +--------------+---------------+---------------------+-----------------+
    | soft-deleted | False or True | not can_write       | raise (Case B)  |
    +--------------+---------------+---------------------+-----------------+

    Re-importing a soft-deleted UUID is implicitly a restore-with-update:
    the user is bringing the chart back by uploading it again. We apply
    the same editorship check as the explicit overwrite path so non-editors
    cannot resurrect via re-import, and we raise rather than silently
    returning a soft-deleted row to callers without write permission
    (which would let them reattach dashboards to a deleted chart).
    """
    can_write = ignore_permissions or security_manager.can_access("can_write", "Chart")
    # `user` is None for background / example-loader paths (no Flask request
    # user). Combined with ``can_write=True`` (typically from
    # ``ignore_permissions=True``), the editorship checks in the restore /
    # overwrite branches below are intentionally skipped because the caller has
    # already established trust at the command level.
    user = get_user()

    if existing := find_existing_for_import(Slice, config["uuid"]):
        if existing_chart := _prepare_existing_chart_for_import(
            existing,
            config,
            overwrite,
            can_write,
            user,
        ):
            return existing_chart
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

    # Only newly created charts inherit the creator's editor/viewer defaults;
    # re-importing over an existing chart (overwrite or soft-delete restore)
    # must not silently grant the importer's groups access. Mirrors the
    # dashboard importer's ``not existing`` guard.
    if not existing and user:
        from superset.subjects.utils import (
            get_default_viewers_for_new_asset,
            get_user_subject,
        )

        subj = get_user_subject(user.id)
        if subj and subj not in chart.editors:
            chart.editors.append(subj)
        # Resolved once by bulk importers and passed in; recomputed here only
        # for direct callers that omit it (one membership query per asset).
        viewers = (
            default_viewers
            if default_viewers is not None
            else get_default_viewers_for_new_asset(user.id)
        )
        for viewer in viewers:
            if viewer not in chart.viewers:
                chart.viewers.append(viewer)

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


def topological_sort_charts(
    chart_configs: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Sort charts so that annotation dependencies are imported first.

    Handles multi-level dependencies (A→B→C) by iteratively resolving
    charts whose in-batch dependencies are already satisfied.

    TODO: Add runtime circular annotation detection in
    QueryContextProcessor.get_viz_annotation_data to prevent infinite
    recursion when rendering charts with circular line annotations.
    """
    if len(chart_configs) <= 1:
        return chart_configs

    def _annotation_dependencies(chart_config: dict[str, Any]) -> set[str]:
        refs = {
            ann["value"]
            for ann in chart_config.get("params", {}).get("annotation_layers", [])
            if ann.get("sourceType") in ANNOTATION_SOURCE_TYPES_WITH_CHART_REFERENCE
            and isinstance(ann.get("value"), str)
        }
        if query_context_raw := chart_config.get("query_context"):
            try:
                query_context = json.loads(query_context_raw)
            except (json.JSONDecodeError, TypeError):
                query_context = {}

            for query in query_context.get("queries", []):
                refs.update(
                    ann["value"]
                    for ann in query.get("annotation_layers", [])
                    if ann.get("sourceType")
                    in ANNOTATION_SOURCE_TYPES_WITH_CHART_REFERENCE
                    and isinstance(ann.get("value"), str)
                )
            refs.update(
                ann["value"]
                for ann in query_context.get("form_data", {}).get(
                    "annotation_layers", []
                )
                if ann.get("sourceType") in ANNOTATION_SOURCE_TYPES_WITH_CHART_REFERENCE
                and isinstance(ann.get("value"), str)
            )
        return refs

    batch_uuids = {c["uuid"] for c in chart_configs}
    sorted_refs: list[dict[str, Any]] = []
    remaining = list(chart_configs)
    resolved: set[str] = set()
    while remaining:
        next_remaining = []
        for c in remaining:
            unmet = _annotation_dependencies(c).intersection(batch_uuids - resolved)
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
    try:
        obj = db.session.query(model).filter_by(uuid=uuid_value).first()
    except Exception:  # noqa: BLE001 — malformed UUID raises at bind time
        return None
    return obj.id if obj else None


def _resolve_annotation_list(
    annotations: list[dict[str, Any]],
    annotation_layer_ids: dict[str, int] | None,
    chart_ids: dict[str, int] | None,
) -> None:
    """Resolve UUID values to integer IDs in-place for an annotation list."""
    resolved_annotations: list[dict[str, Any]] = []
    for annotation in annotations:
        if annotation.get("annotationType") == AnnotationType.FORMULA:
            resolved_annotations.append(annotation)
            continue
        source_type = annotation.get("sourceType")
        value = annotation.get("value")
        if isinstance(value, int):
            resolved_annotations.append(annotation)
            continue
        if not isinstance(value, str):
            continue
        if source_type == "NATIVE":
            layer_id = _resolve_uuid_to_id(value, annotation_layer_ids, AnnotationLayer)
            if layer_id is not None:
                annotation["value"] = layer_id
                resolved_annotations.append(annotation)
        elif source_type in ANNOTATION_SOURCE_TYPES_WITH_CHART_REFERENCE:
            ref_chart_id = _resolve_uuid_to_id(value, chart_ids, Slice)
            if ref_chart_id is not None:
                annotation["value"] = ref_chart_id
                resolved_annotations.append(annotation)
    annotations[:] = resolved_annotations


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
