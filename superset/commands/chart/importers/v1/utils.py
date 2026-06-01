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

    Re-importing a soft-deleted UUID is implicitly a restore-with-update:
    the user is bringing the chart back by uploading it again. We apply
    the same ownership check as the explicit overwrite path so non-owners
    cannot resurrect via re-import, and we raise rather than silently
    returning a soft-deleted row to callers without write permission
    (which would let them reattach dashboards to a deleted chart).
    """
    can_write = ignore_permissions or security_manager.can_access("can_write", "Chart")
    from superset.commands.importers.v1.utils import find_existing_for_import

    user = get_user()

    if existing := find_existing_for_import(Slice, config["uuid"]):
        is_soft_deleted = existing.deleted_at is not None
        needs_mutation = overwrite or is_soft_deleted
        if needs_mutation and can_write and user:
            if not security_manager.can_access_chart(existing) or (
                user not in existing.owners and not security_manager.is_admin()
            ):
                raise ImportFailedError(
                    "A chart already exists and user doesn't have "
                    "permissions to "
                    f"{'restore' if is_soft_deleted else 'overwrite'} it"
                )
        if needs_mutation and not can_write:
            # Case B: would-be restore-via-import without write permission.
            # Raise rather than silently returning the soft-deleted row,
            # which would let callers (e.g., the dashboard importer)
            # reattach to a deleted chart and produce a broken dashboard.
            raise ImportFailedError(
                "Chart was deleted and re-import requires can_write "
                "permission to restore it"
            )
        if not needs_mutation or not can_write:
            return existing
        # Mutation path. Restore a soft-deleted match in place rather
        # than hard-delete-and-replace: a hard delete would cascade to
        # dashboard_slices and other FK references, breaking the
        # dashboards that previously embedded this chart.
        #
        # How the restore lands as an UPDATE: clearing
        # existing.deleted_at marks the in-session row dirty and the
        # explicit flush emits the deleted_at = NULL UPDATE before
        # Slice.import_from_dict (below) does its own query-by-uuid
        # lookup. Without the flush we would be relying on autoflush
        # ahead of that internal query — correct under default session
        # config but a hidden contract; the explicit flush makes it
        # robust. The lookup then finds the now-live row (the listener
        # filters deleted_at IS NULL) and import_from_dict applies the
        # config as field updates on the existing object, preserving
        # the PK. Note: config["id"] is set defensively, but
        # ImportExportMixin.import_from_dict strips it today because
        # Slice.export_fields does not contain "id"; what actually
        # binds to the existing row is the uuid uniqueness constraint
        # used inside import_from_dict.
        if is_soft_deleted:
            existing.deleted_at = None
            db.session.flush()
        config["id"] = existing.id
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
