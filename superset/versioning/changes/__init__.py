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
"""Write-side change-record capture for ``version_changes``.

The package is split into four submodules that descend from public
entry point to leaf helpers:

* :mod:`.listener` — public ``register_change_record_listener`` plus
  the session-event machinery (``before_flush`` / ``after_flush`` /
  ``after_commit`` / ``after_rollback``) that drives the capture.
  Holds ``ACTION_KIND_KEY``, the buffer-key constants, and the per-tx
  ``action_kind`` stamper.
* :mod:`.state` — per-entity diff dispatch: pre-state read,
  post-state serialisation, JSON-safety coercion (``jsonable``),
  cached scalar-field discovery, and bulk-insert into the
  ``version_changes`` table.
* :mod:`.shadow_queries` — shadow-table reads that drive child-
  collection diffs (dataset columns/metrics, dashboard slice
  membership). Includes the validity-strategy ``shadow_rows_valid_at``
  helper consumed externally by :mod:`superset.versioning.queries`.
* :mod:`.table` — the SQLAlchemy ``Table`` definition for
  ``version_changes`` plus the ``ENTITY_KIND_BY_CLASS_NAME`` mapping
  consumed by the API + activity-view modules.

The re-exports below preserve the prior ``from
superset.versioning.changes import …`` call shape; no caller outside
this package needs to change.
"""

from __future__ import annotations

from superset.versioning.changes.listener import (
    ACTION_KIND_CLONE,
    ACTION_KIND_IMPORT,
    ACTION_KIND_KEY,
    ACTION_KIND_RESTORE,
    ACTION_KINDS,
    ACTION_META_KEY,
    build_action_headline,
    OPERATION_ANNOUNCE,
    register_change_record_listener,
)
from superset.versioning.changes.shadow_queries import shadow_rows_valid_at
from superset.versioning.changes.table import (
    ENTITY_KIND_BY_CLASS_NAME,
    version_changes_table,
)

__all__ = [
    "ACTION_KIND_CLONE",
    "ACTION_KIND_IMPORT",
    "ACTION_KIND_KEY",
    "ACTION_KIND_RESTORE",
    "ACTION_KINDS",
    "ACTION_META_KEY",
    "build_action_headline",
    "OPERATION_ANNOUNCE",
    "ENTITY_KIND_BY_CLASS_NAME",
    "register_change_record_listener",
    "shadow_rows_valid_at",
    "version_changes_table",
]
