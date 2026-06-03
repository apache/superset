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
"""Public entry point: attach the ``before_flush`` baseline listener.

:func:`register_baseline_listener` is called from
:class:`superset.initialization.SupersetAppInitializer.init_versioning`
after ``make_versioned()`` has run and all versioned model classes
have been imported. It registers one ``before_flush`` listener on
``db.session`` that:

1. force-dirties versioned parents whose only changes are
   child-collection edits (:mod:`.dirty`);
2. collects the parents that need a baseline row
   (:mod:`.collection`);
3. for each parent with no prior shadow row, inserts the synthetic
   baseline row + its child baseline rows (:mod:`.insertion` +
   :mod:`.children`).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import event
from sqlalchemy.orm import Session

from superset.versioning.baseline.collection import (
    _collect_parents_to_baseline,
    _shadow_row_count,
    _version_table_for,
    VERSIONED_MODELS,
)
from superset.versioning.baseline.dirty import _force_parent_dirty_on_child_change
from superset.versioning.baseline.insertion import _insert_baseline_and_children

# Sentinel attribute set on the session target after first successful
# registration — same pattern as
# :mod:`superset.versioning.changes.listener`. Subsequent calls become
# no-ops so test fixtures that instantiate multiple Superset apps per
# process don't attach a second copy of the listener to the shared
# ``db.session`` (every flush would otherwise run the baseline pass
# twice).
_REGISTERED_SENTINEL = "_versioning_baseline_listener_registered"


def register_baseline_listener() -> None:
    """Attach the before_flush listener that captures baseline versions.

    Call this after ``VERSIONED_MODELS`` has been populated and
    ``make_versioned()`` has run. Idempotent — repeat calls are no-ops.
    """
    # pylint: disable=import-outside-toplevel
    from superset.extensions import db

    if getattr(db.session, _REGISTERED_SENTINEL, False):
        return

    # insert=True prepends us in the listener chain so we run BEFORE
    # Continuum's before_flush. Continuum's pending Transaction object
    # (added in its own before_flush) would otherwise get a lower
    # auto-increment tx_id than our direct-SQL baseline insert, placing the
    # baseline row after the update in version_number order. Prepending
    # ensures our baseline's tx_id comes first.
    @event.listens_for(db.session, "before_flush", insert=True)
    def capture_baseline(session: Session, flush_context: Any, instances: Any) -> None:
        if not VERSIONED_MODELS:
            return
        # Make sure a child-only edit promotes the parent to ``session.dirty``
        # before Continuum's before_flush reads the dirty set.
        _force_parent_dirty_on_child_change(session)
        for obj in _collect_parents_to_baseline(session).values():
            if type(obj) not in VERSIONED_MODELS:
                continue
            version_table = _version_table_for(obj)
            if version_table is None:
                continue
            count = _shadow_row_count(session, obj, version_table)
            if count == 0:
                _insert_baseline_and_children(session, obj, version_table)

    setattr(db.session, _REGISTERED_SENTINEL, True)
