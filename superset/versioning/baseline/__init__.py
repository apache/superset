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
"""``before_flush`` listener that captures a baseline version (version 0)
for entities being updated for the first time after the versioning
migration.

Package layout (descends from public entry point to leaf builders):

* :mod:`.listener` — public :func:`register_baseline_listener` that
  wires the before-flush event on ``db.session``.
* :mod:`.dirty` — :func:`force_parent_dirty_on_child_change` and
  :func:`pin_audit_columns`: promote a parent into ``session.dirty``
  when only its versioned children changed, and pin its audit columns
  so the synthetic flush doesn't bump them.
* :mod:`.collection` — discovery: which parents need a baseline row?
  Holds ``VERSIONED_MODELS`` (populated at app start),
  :func:`collect_parents_to_baseline`, the
  :func:`child_to_parent_registry` mapping, and the per-parent
  Continuum-shadow-table lookups.
* :mod:`.insertion` — parent baseline insertion + child-handler
  dispatch.
* :mod:`.children` — per-entity child baseline handlers
  (``_baseline_dataset_children`` / ``_baseline_dashboard_children``)
  plus the leaf helpers that synthesize child / slice shadow rows.
* :mod:`.shadow` — low-level :func:`insert_baseline_shadow_row`
  helper used by every module that writes a shadow row, and the
  :data:`CONTINUUM_BOOKKEEPING_COLUMNS` constant re-used outside this
  package (the change-record listener and ``queries.py`` filter on it).

The re-exports below preserve the prior ``from
superset.versioning.baseline import …`` call shape; no caller outside
this package needs to change.
"""

from __future__ import annotations

from superset.versioning.baseline.collection import (
    child_to_parent_registry,
    VERSIONED_MODELS,
)
from superset.versioning.baseline.dirty import pin_audit_columns
from superset.versioning.baseline.listener import register_baseline_listener
from superset.versioning.baseline.shadow import (
    CONTINUUM_BOOKKEEPING_COLUMNS,
    insert_baseline_shadow_row,
)

__all__ = [
    "CONTINUUM_BOOKKEEPING_COLUMNS",
    "VERSIONED_MODELS",
    "child_to_parent_registry",
    "insert_baseline_shadow_row",
    "pin_audit_columns",
    "register_baseline_listener",
]
