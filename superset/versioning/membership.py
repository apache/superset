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
"""M2M dashboard-membership queries, shared across the versioning surfaces.

``charts_attached_to_dashboard`` reads the ``dashboard_slices_version``
association shadow and pairs its INSERT/DELETE rows into ``[attach, detach)``
windows. It must **never** filter that shadow by ``end_transaction_id``:
Continuum never closes an M2M association's ``end_transaction_id`` (see
:func:`~superset.versioning.activity.windows.attachment_windows`), so a
validity filter would re-include a chart removed before the queried tx.

This lives in a neutral module — not the activity read-path module
(``activity/queries.py``) — so the restore write path and the impact rollup
depend on it here rather than reaching up into the read path (sc-119907).
"""

from __future__ import annotations

from typing import TYPE_CHECKING

import sqlalchemy as sa

from superset.extensions import db

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from superset.versioning.activity.kinds import Window


def charts_attached_to_dashboard(
    dashboard_id: int, session: Session | None = None
) -> list[tuple[int, Window]]:
    """Return ``(slice_id, window)`` for every chart that has ever been on
    *dashboard_id*, with each attachment episode's validity window in
    transaction-id space.

    Reads from ``dashboard_slices_version`` (Continuum's auto-generated M2M
    shadow) and pairs its INSERT/DELETE rows via
    :func:`~superset.versioning.activity.windows.attachment_windows`,
    so a chart removed from the dashboard is bounded at the detach transaction
    rather than open-ended — otherwise the chart's edits made *after* removal
    would surface in the dashboard's related history.
    """
    # pylint: disable=import-outside-toplevel
    # attachment_windows is imported lazily (not at module top) so that this
    # module stays a leaf: importing it must not pull the activity package,
    # whose read-path modules (scope.py) import charts_attached_to_dashboard
    # back from here — a module-top import created a circular import that only
    # surfaced at runtime, when a restore imported this module for the first
    # time (sc-119907).
    from sqlalchemy_continuum import version_class

    from superset.models.dashboard import Dashboard
    from superset.versioning.activity.windows import attachment_windows

    metadata = version_class(Dashboard).__table__.metadata
    m2m_tbl = metadata.tables.get("dashboard_slices_version")
    if m2m_tbl is None:
        return []

    # *session* lets a caller thread the committing session so the read hits
    # the same connection as its other reads — required on the commit-
    # finalization path (changes/shadow_queries.py), where the current
    # transaction's association-shadow rows are flushed-but-not-committed and
    # visible only on that session's connection. Defaults to the Flask-scoped
    # ``db.session``, which the read/restore-path callers already run on.
    rows = (
        (session or db.session)
        .connection()
        .execute(
            sa.select(
                m2m_tbl.c.slice_id,
                m2m_tbl.c.transaction_id,
                m2m_tbl.c.operation_type,
            ).where(
                m2m_tbl.c.dashboard_id == dashboard_id,
                m2m_tbl.c.slice_id.is_not(None),
            )
        )
        .all()
    )
    return attachment_windows([(row[0], row[1], row[2]) for row in rows])
