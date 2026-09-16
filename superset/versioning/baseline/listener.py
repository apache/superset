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

import logging
from typing import Any

from flask import current_app
from sqlalchemy import event
from sqlalchemy.orm import Session
from sqlalchemy_continuum import versioning_manager

from superset.versioning.baseline.collection import (
    collect_parents_to_baseline,
    shadow_row_count,
    version_table_for,
    VERSIONED_MODELS,
)
from superset.versioning.baseline.dirty import force_parent_dirty_on_child_change
from superset.versioning.baseline.insertion import insert_baseline_and_children

logger = logging.getLogger(__name__)


def _emit_baseline_error_metric() -> None:
    """Increment the baseline-capture-error counter so a persistently-failing
    baseline path is alertable rather than only visible by log-grep. Guarded:
    metric emission must never be what breaks a user's save."""
    try:
        current_app.config["STATS_LOGGER"].incr("versioning.baseline_capture_error")
    except Exception:  # pylint: disable=broad-except  # noqa: S110
        pass


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
        # Respect the unified capture master switch. Unlike the change-record
        # listener (which self-gates because it needs a Continuum transaction
        # id that won't exist when capture is off), the baseline writer mints
        # its own ``version_transaction`` row via direct SQL — so without this
        # guard a detached/kill-switched session would still write baselines.
        # ``_remove_continuum_write_listeners`` flips this option off.
        if not versioning_manager.options["versioning"]:
            return
        try:
            # Make sure a child-only edit promotes the parent to
            # ``session.dirty`` before Continuum's before_flush reads the
            # dirty set.
            force_parent_dirty_on_child_change(session)
            for obj in collect_parents_to_baseline(session).values():
                if type(obj) not in VERSIONED_MODELS:
                    continue
                version_table = version_table_for(obj)
                if version_table is None:
                    continue
                count = shadow_row_count(session, obj, version_table)
                if count == 0:
                    insert_baseline_and_children(session, obj, version_table)
        except Exception:  # pylint: disable=broad-except
            # Versioning must never break a user's save. If baseline capture
            # fails (a lazy-load error, a registry gap, an unexpected schema
            # state), log it and let the flush proceed uninstrumented rather
            # than aborting the user's transaction.
            logger.warning(
                "versioning: baseline capture failed during before_flush; "
                "the save proceeds without a baseline row for this flush.",
                exc_info=True,
            )
            _emit_baseline_error_metric()

    setattr(db.session, _REGISTERED_SENTINEL, True)
