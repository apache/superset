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

The :func:`load_shadow_model` helper exists in the same module
because each lookup is keyed on the same set of class names — keeping
it adjacent to the mappings makes the kind-translation surface
discoverable at a glance.
"""

from __future__ import annotations

from dataclasses import dataclass

from flask_appbuilder import Model

from superset.commands.chart.exceptions import ChartNotFoundError
from superset.commands.dashboard.exceptions import DashboardNotFoundError
from superset.commands.dataset.exceptions import DatasetNotFoundError
from superset.versioning.changes import ENTITY_KIND_BY_CLASS_NAME

# ---- Kind translation -----------------------------------------------------

# ``version_changes.entity_kind`` stores the friendly downstream-tooling
# value (``"chart"``, ``"dashboard"``, ``"dataset"``) per sc-103156's
# ``ENTITY_KIND_BY_CLASS_NAME``. The activity-view DTO returns the
# Python class name instead (``"Slice"``, ``"Dashboard"``,
# ``"SqlaTable"``) so the contract aligns with ``__class__.__name__``
# (data-model.md §"``ActivityRecord`` DTO"). Translate at the boundary.
TABLE_KIND_TO_API: dict[str, str] = {
    table_kind: class_name
    for class_name, table_kind in ENTITY_KIND_BY_CLASS_NAME.items()
}
API_KIND_TO_TABLE: dict[str, str] = dict(ENTITY_KIND_BY_CLASS_NAME)

# Human-readable label for AV-012 summary headlines
# ("Dataset updated: Sales Transactions"). Keyed by the internal API kind
# (Python class name; matches ``model_cls.__name__``).
API_KIND_LABEL: dict[str, str] = {
    "Dashboard": "Dashboard",
    "Slice": "Chart",
    "SqlaTable": "Dataset",
}

# User-facing lowercase rendering of the kind. This is what appears in
# the JSON response's ``entity_kind`` field and the
# ``ActivityRecordSchema.entity_kind`` enum. Internal code keeps the
# Python class-name form because it matches ``model_cls.__name__`` and is
# convenient for dispatch — translation happens at serialization time
# only, in :func:`render.apply_record_decoration`.
USER_FACING_KIND: dict[str, str] = {
    "Dashboard": "dashboard",
    "Slice": "chart",
    "SqlaTable": "dataset",
}

# 404 exception class per API kind. Each accepts a string positional arg
# (the path-entity UUID) that gets formatted into the exception message.
NOT_FOUND_EXC: dict[str, type[Exception]] = {
    "Dashboard": DashboardNotFoundError,
    "Slice": ChartNotFoundError,
    "SqlaTable": DatasetNotFoundError,
}

# Per-API-kind (model class name, display column) used by
# ``_resolve_names_for_kind`` to read the user-facing entity name from
# the shadow table valid at a given transaction.
NAME_COLUMN: dict[str, tuple[str, str]] = {
    "Dashboard": ("Dashboard", "dashboard_title"),
    "Slice": ("Slice", "slice_name"),
    "SqlaTable": ("SqlaTable", "table_name"),
}


# ---- Types ----------------------------------------------------------------


@dataclass(frozen=True)
class Window:
    """A validity window in Continuum transaction-id space, half-open as
    ``[start_tx, end_tx)``.

    Immutable and equal-by-attributes — two windows with the same
    ``start_tx`` / ``end_tx`` are interchangeable. Constructor rejects
    ``end_tx <= start_tx``. ``end_tx = None`` means "open ended
    (current)" and acts as positive infinity throughout the helpers.

    Helper methods (``contains`` / ``intersect`` / ``merges_with``)
    live on the type so callers don't re-implement the half-open
    predicate inline. Previously a ``tuple[int, int | None]`` alias;
    promoted to a dataclass so a function accepting a ``Window`` can't
    silently accept any other 2-tuple and so the constructor enforces
    the half-open invariant.
    """

    start_tx: int
    end_tx: int | None

    def __post_init__(self) -> None:
        if self.end_tx is not None and self.end_tx <= self.start_tx:
            raise ValueError(
                f"Window end_tx must be > start_tx; "
                f"got [{self.start_tx}, {self.end_tx})"
            )

    def contains(self, tx_id: int) -> bool:
        """``True`` iff *tx_id* falls inside this half-open interval."""
        return self.start_tx <= tx_id and (self.end_tx is None or tx_id < self.end_tx)

    def intersect(self, other: Window) -> Window | None:
        """Return the clipped overlap of this window with *other*, or
        ``None`` when they are disjoint. ``end_tx = None`` acts as
        positive infinity on either side."""
        start = max(self.start_tx, other.start_tx)
        end: int | None
        if self.end_tx is None:
            end = other.end_tx
        elif other.end_tx is None:
            end = self.end_tx
        else:
            end = min(self.end_tx, other.end_tx)
        if end is not None and end <= start:
            return None
        return Window(start, end)

    def merges_with(self, other: Window) -> bool:
        """``True`` iff *self* and *other* overlap or touch (so their
        union is one contiguous window). Assumes the caller has placed
        them in start-ascending order."""
        if self.end_tx is None:
            # self extends to +∞; everything past it merges in.
            return True
        return other.start_tx <= self.end_tx


#: A related-entity scope row: ``(api_kind, entity_id, [windows])``.
#: ``api_kind`` is the DTO-facing kind (``"Slice"``, etc.), not the
#: table-stored kind. Left as a tuple alias for now — the
#: ``(api_kind, entity_id)`` pair is logically a key with the window
#: list as its value, so a dict shape may fit better than a flat
#: dataclass when this is revisited.
EntityWindows = tuple[str, int, list[Window]]


def load_shadow_model(model_name: str) -> type[Model]:
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
