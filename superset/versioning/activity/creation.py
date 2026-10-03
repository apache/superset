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
"""Synthetic "starting version" record for the activity stream (sc-120488).

``operation_type=0`` transactions emit zero change records by design
(see ``versioning/changes/listener.py``), so an entity's creation —
Continuum's INSERT row, an importer's INSERT, or the retroactive
pre-tracking baseline — exists in the versions API but never appears in
the activity timeline. This module derives ONE synthetic record from the
op=0 shadow row and its ``version_transaction`` so the panel can render
the starting version as the oldest entry, previewable and restorable
like any other version (the record carries the same ``version_uuid``
the ``/versions/`` family resolves).

Placement and gating live in the orchestrator: the record is appended
only for the PATH entity (it inherits the activity endpoint's access
gate — edit access to the path entity),
only when the stream is not truncated, and never for
``include="related"``. If retention pruned the op=0 row or its
transaction, no record is synthesized — the timeline simply starts at
the oldest surviving save.
"""

from __future__ import annotations

from typing import Any

import sqlalchemy as sa
from flask_appbuilder import Model

from superset.extensions import db
from superset.versioning.activity.kinds import USER_FACING_KIND
from superset.versioning.creation_kinds import (
    CREATION_KIND_CREATED,
    CREATION_KIND_IMPORTED,
    CREATION_KIND_PRE_TRACKING,
    CREATION_KIND_UNKNOWN,
    CREATION_RECORD_KIND,
)
from superset.versioning.queries import derive_version_uuid


def _creation_kind_for(action_kind: str | None) -> str:
    # pylint: disable=import-outside-toplevel
    from superset.versioning.changes import (
        ACTION_KIND_BASELINE,
        ACTION_KIND_CLONE,
        ACTION_KIND_CREATE,
        ACTION_KIND_IMPORT,
    )

    if action_kind == ACTION_KIND_BASELINE:
        return CREATION_KIND_PRE_TRACKING
    if action_kind == ACTION_KIND_IMPORT:
        return CREATION_KIND_IMPORTED
    if action_kind in (ACTION_KIND_CLONE, ACTION_KIND_CREATE):
        return CREATION_KIND_CREATED
    # Unstamped ordinary inserts and historical retroactive baselines are
    # indistinguishable. Do not invent creation provenance for either.
    return CREATION_KIND_UNKNOWN


def build_creation_record(
    model_cls: type[Model], entity: Model, entity_name: str | None
) -> dict[str, Any] | None:
    """The synthetic starting-version record for *entity*, or ``None``.

    ``None`` when no op=0 shadow row survives for ``(id, uuid)`` or its
    ``version_transaction`` row is gone (retention pruned the baseline —
    sc-115615 expiry): synthesizing from partial data would fabricate
    attribution, so the row is omitted cleanly instead.

    The returned dict mirrors a POST-decoration activity record (the
    orchestrator appends it after the decoration phase), including the
    ``version_uuid`` the ``/versions/`` endpoints resolve — which is what
    makes the row previewable and restorable like any other version.
    """
    # pylint: disable=import-outside-toplevel
    from sqlalchemy_continuum import version_class, versioning_manager

    from superset import security_manager

    shadow: sa.Table = version_class(model_cls).__table__
    tx_tbl: sa.Table = versioning_manager.transaction_cls.__table__
    user_tbl: sa.Table = security_manager.user_model.__table__
    # ONE inner-joined statement, not a shadow read followed by a
    # transaction check: retention deletes shadow rows and transactions
    # on different anchors (a transaction survives while any OTHER live
    # row anchors it), so two statements leave a window where the shadow
    # is pruned between them and the row would be synthesized for an
    # unresolvable restore target. The join returns nothing unless BOTH
    # halves survive.
    tx: sa.engine.RowMapping | None = (
        db.session.execute(
            sa.select(
                shadow.c.transaction_id,
                tx_tbl.c.issued_at,
                tx_tbl.c.action_kind,
                user_tbl.c.id.label("changed_by_id"),
                user_tbl.c.first_name,
                user_tbl.c.last_name,
            )
            .select_from(
                shadow.join(tx_tbl, shadow.c.transaction_id == tx_tbl.c.id).outerjoin(
                    user_tbl, tx_tbl.c.user_id == user_tbl.c.id
                )
            )
            .where(
                shadow.c.id == entity.id,
                shadow.c.uuid == entity.uuid,
                shadow.c.operation_type == 0,
            )
            .order_by(shadow.c.transaction_id.asc())
            .limit(1)
        )
        .mappings()
        .first()
    )
    if tx is None:
        return None
    creation_tx_id: int = tx["transaction_id"]

    api_kind: str = model_cls.__name__
    changed_by: dict[str, Any] | None = (
        {
            "id": tx["changed_by_id"],
            "first_name": tx["first_name"],
            "last_name": tx["last_name"],
        }
        if tx["changed_by_id"] is not None
        else None
    )
    return {
        "version_uuid": str(derive_version_uuid(entity.uuid, creation_tx_id)),
        "entity_kind": USER_FACING_KIND.get(api_kind, api_kind),
        "entity_uuid": str(entity.uuid),
        "entity_name": entity_name,
        "entity_deleted": False,
        "entity_deletion_state": None,
        "source": "self",
        "transaction_id": creation_tx_id,
        "issued_at": tx["issued_at"],
        "changed_by": changed_by,
        "kind": CREATION_RECORD_KIND,
        "operation": "announce",
        # Transaction-level baseline/create stamps are INTERNAL provenance:
        # the public action_kind vocabulary is restore/import/clone/null
        # (ActivityRecordSchema + the client's ActivityActionKind), so
        # the synthetic record ships null and display is driven by
        # creation_kind alone.
        "action_kind": None,
        "path": [CREATION_RECORD_KIND],
        "from_value": None,
        "to_value": None,
        "summary": "",
        "impact": None,
        "first_tracked_save": False,
        "creation_kind": _creation_kind_for(tx["action_kind"]),
    }
