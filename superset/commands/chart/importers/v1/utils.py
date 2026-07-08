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
from inspect import isclass
from typing import Any

from superset import db, security_manager
from superset.commands.exceptions import ImportFailedError
from superset.commands.importers.v1.utils import find_existing_for_import
from superset.migrations.shared.migrate_viz import processors
from superset.migrations.shared.migrate_viz.base import MigrateViz
from superset.models.slice import Slice
from superset.utils import json
from superset.utils.core import AnnotationType, get_user


def filter_chart_annotations(chart_config: dict[str, Any]) -> None:
    """
    Mutating the chart's config params to keep only the annotations of
    type FORMULA.
    TODO:
      handle annotation dependencies on either other charts or
      annotation layers objects.
    """
    params = chart_config.get("params", {})
    als = params.get("annotation_layers", [])
    params["annotation_layers"] = [
        al for al in als if al.get("annotationType") == AnnotationType.FORMULA
    ]


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

    filter_chart_annotations(config)

    # TODO (betodealmeida): move this logic to import_from_dict
    config["params"] = json.dumps(config["params"])

    # migrate old viz types to new ones
    config = migrate_chart(config)

    chart = Slice.import_from_dict(config, recursive=False, allow_reparenting=True)
    if chart.id is None:
        db.session.flush()

    if user:
        from superset.subjects.utils import get_user_subject

        subj = get_user_subject(user.id)
        if subj and subj not in chart.editors:
            chart.editors.append(subj)

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
