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
"""Kind translation tables, shared types, and the shadow-model loader.

The activity-view module operates in two "kind" namespaces — the
table-stored value (``"chart"`` / ``"dashboard"`` / ``"dataset"``) that
``version_changes.entity_kind`` carries, and the Python class-name
form (``"Slice"`` / ``"Dashboard"`` / ``"SqlaTable"``) used internally
for dispatch and returned in the DTO's ``entity_kind`` field. The four
mappings here translate between them. Adjacent kind-keyed dicts live
here too: the per-kind human-readable label, the user-facing
lowercase form, and the 404 exception class.

The :func:`_load_shadow_model` helper exists in the same module
because each lookup is keyed on the same set of class names — keeping
it adjacent to the mappings makes the kind-translation surface
discoverable at a glance.
"""

from __future__ import annotations

from superset.commands.chart.exceptions import ChartNotFoundError
from superset.commands.dashboard.exceptions import DashboardNotFoundError
from superset.commands.dataset.exceptions import DatasetNotFoundError
from superset.versioning.changes import _ENTITY_KIND_BY_CLASS_NAME

# ---- Kind translation -----------------------------------------------------

# ``version_changes.entity_kind`` stores the friendly downstream-tooling
# value (``"chart"``, ``"dashboard"``, ``"dataset"``) per sc-103156's
# ``_ENTITY_KIND_BY_CLASS_NAME``. The activity-view DTO returns the
# Python class name instead (``"Slice"``, ``"Dashboard"``,
# ``"SqlaTable"``) so the contract aligns with ``__class__.__name__``
# (data-model.md §"``ActivityRecord`` DTO"). Translate at the boundary.
_TABLE_KIND_TO_API: dict[str, str] = {
    table_kind: class_name
    for class_name, table_kind in _ENTITY_KIND_BY_CLASS_NAME.items()
}
_API_KIND_TO_TABLE: dict[str, str] = dict(_ENTITY_KIND_BY_CLASS_NAME)

# Human-readable label for AV-012 summary headlines
# ("Dataset updated: Sales Transactions"). Keyed by the internal API kind
# (Python class name; matches ``model_cls.__name__``).
_API_KIND_LABEL: dict[str, str] = {
    "Dashboard": "Dashboard",
    "Slice": "Chart",
    "SqlaTable": "Dataset",
}

# User-facing lowercase rendering of the kind. This is what appears in
# the JSON response's ``entity_kind`` field and the
# ``ActivityRecordSchema.entity_kind`` enum. Internal code keeps the
# Python class-name form because it matches ``model_cls.__name__`` and is
# convenient for dispatch — translation happens at serialization time
# only, in :func:`render._decorate_records`.
_USER_FACING_KIND: dict[str, str] = {
    "Dashboard": "dashboard",
    "Slice": "chart",
    "SqlaTable": "dataset",
}

# 404 exception class per API kind. Each accepts a string positional arg
# (the path-entity UUID) that gets formatted into the exception message.
_NOT_FOUND_EXC: dict[str, type[Exception]] = {
    "Dashboard": DashboardNotFoundError,
    "Slice": ChartNotFoundError,
    "SqlaTable": DatasetNotFoundError,
}

# Per-API-kind (model class name, display column) used by
# ``_resolve_names_for_kind`` to read the user-facing entity name from
# the shadow table valid at a given transaction.
_NAME_COLUMN: dict[str, tuple[str, str]] = {
    "Dashboard": ("Dashboard", "dashboard_title"),
    "Slice": ("Slice", "slice_name"),
    "SqlaTable": ("SqlaTable", "table_name"),
}


# ---- Types ----------------------------------------------------------------

#: A validity window in Continuum transaction-id space, half-open as
#: ``[start_tx, end_tx)``. ``end_tx = None`` means "open ended (current)".
Window = tuple[int, int | None]

#: A related-entity scope row: ``(api_kind, entity_id, [windows])``.
#: ``api_kind`` is the DTO-facing kind (``"Slice"``, etc.), not the
#: table-stored kind.
EntityWindows = tuple[str, int, list[Window]]


def _load_shadow_model(model_name: str) -> type:
    """Inline-import a shadow model class by name. Deferred until call
    time because the versioning package is initialised before all model
    mappers are configured (same idiom used throughout
    :mod:`superset.versioning.changes`)."""
    # pylint: disable=import-outside-toplevel
    if model_name == "Dashboard":
        from superset.models.dashboard import Dashboard

        return Dashboard
    if model_name == "Slice":
        from superset.models.slice import Slice

        return Slice
    if model_name == "SqlaTable":
        from superset.connectors.sqla.models import SqlaTable

        return SqlaTable
    raise LookupError(f"No shadow class registered for {model_name!r}")
