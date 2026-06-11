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
"""Write-side: restore a versioned entity to an earlier state.

Companion to :mod:`superset.versioning.queries`. The
``BaseRestoreVersionCommand`` in :mod:`superset.commands.version_restore`
is the only intended caller; the backward-compat ``VersionDAO`` façade
in :mod:`superset.daos.version` re-exports ``restore_version`` for
existing call sites.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any
from uuid import UUID

from flask_appbuilder import Model
from sqlalchemy_continuum import version_class

from superset.extensions import db
from superset.utils.core import get_user_id
from superset.versioning.queries import find_active_by_uuid
from superset.versioning.utils import single_flush_scope

logger = logging.getLogger(__name__)


# Per-model relationships that Continuum's Reverter recurses into during a
# restore. Each restore replays the listed relationships from the version-
# side shadow tables onto the live entity. Children versioned through
# Continuum (``TableColumn`` / ``SqlMetric`` on ``SqlaTable``;
# ``dashboard_slices`` M2M on ``Dashboard``) come back automatically;
# ``Slice`` has no child collections to recurse into so its list is empty.
_RESTORE_RELATIONS: dict[str, list[str]] = {
    "SqlaTable": ["columns", "metrics"],
    "Dashboard": ["slices"],
    "Slice": [],
}


def restore_version(
    model_cls: type[Model],
    entity_uuid: UUID,
    version_num: int,
) -> Any | None:
    """Restore the entity identified by *entity_uuid* to the state captured
    by *version_num* (0-based, as returned by
    :func:`superset.versioning.queries.list_versions`).

    Returns the live entity after the restore, or ``None`` when either the
    UUID does not match an active entity or ``version_num`` is out of
    range — callers should translate both to a 404.

    Uses SQLAlchemy-Continuum's native ``version_obj.revert(relations=...)``
    and delegates commit to the caller (expected to be a command decorated
    with ``@transaction()``). The ``relations`` list depends on the model
    type and is looked up in :data:`_RESTORE_RELATIONS`.

    After the revert, ``changed_on`` / ``changed_by_fk`` are re-stamped
    with the current time and the restoring user's id (see
    :func:`_stamp_audit_fields_for_restore`) so the new version row
    produced by the restoring commit reflects who clicked Restore, not
    the original author. ``created_on`` / ``created_by_fk`` are left
    alone.
    """
    entity = find_active_by_uuid(model_cls, entity_uuid)
    if entity is None:
        return None

    ver_cls = version_class(model_cls)

    # version_num is a 0-based positional index, matching what
    # ``list_versions`` emits. Ordering keeps op=0 rows first so position 0
    # is always the baseline/INSERT.
    target_version = (
        db.session.query(ver_cls)
        .filter(ver_cls.id == entity.id)
        .order_by(
            (ver_cls.operation_type != 0).asc(),
            ver_cls.transaction_id.asc(),
        )
        .offset(version_num)
        .limit(1)
        .first()
    )
    if target_version is None:
        return None

    # Run the whole multi-relationship revert inside a single flush scope
    # so SQLAlchemy-Continuum's ``Reverter`` can iterate relations without
    # tripping its autoflush race, and so the change-records listener sees
    # the complete shadow state in one ``after_flush`` pass. See
    # ``single_flush_scope`` for the full rationale.
    relations = _RESTORE_RELATIONS.get(model_cls.__name__, [])
    try:
        with single_flush_scope(db.session):
            target_version.revert(relations=relations)
    except Exception:
        logger.exception(
            "Continuum revert() failed for %s id=%s tx=%s relations=%s",
            model_cls.__name__,
            entity.id,
            target_version.transaction_id,
            relations,
        )
        raise

    _stamp_audit_fields_for_restore(entity)
    return entity


def _stamp_audit_fields_for_restore(entity: Any) -> None:
    """Overwrite ``changed_on`` / ``changed_by_fk`` on *entity* with the
    current time and current user id, so that the restore is attributed
    to the restoring user rather than the version snapshot's original
    author.

    Charts additionally carry ``last_saved_at`` / ``last_saved_by_fk``
    columns (stamped by ``UpdateChartCommand`` on ordinary saves and
    surfaced in the Charts list page's "last edited by" column). Without
    overwriting these, the chart list still shows the snapshot's
    original author after a restore, contradicting the user-visible
    timeline.

    Uses naive ``datetime.now()`` to match ``AuditMixinNullable``'s
    column defaults — stamping UTC here while ordinary saves stamp
    local time would skew ``changed_on`` ordering on non-UTC servers
    (``datetime.utcnow`` is also deprecated as of Python 3.12).
    """
    now = datetime.now()
    user_id = get_user_id()
    if hasattr(entity, "changed_on"):
        entity.changed_on = now
    if hasattr(entity, "changed_by_fk"):
        entity.changed_by_fk = user_id
    if hasattr(entity, "last_saved_at"):
        entity.last_saved_at = now
    if hasattr(entity, "last_saved_by_fk"):
        entity.last_saved_by_fk = user_id
