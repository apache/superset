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
"""Command to restore a soft-deleted dashboard."""

from typing import Any

from sqlalchemy import select

from superset import db
from superset.commands.dashboard.exceptions import (
    DashboardForbiddenError,
    DashboardNotFoundError,
    DashboardRestoreFailedError,
    DashboardSlugConflictError,
)
from superset.commands.restore import BaseRestoreCommand
from superset.daos.dashboard import DashboardDAO
from superset.models.dashboard import Dashboard
from superset.semantic_layers.models import SemanticView
from superset.utils import json


def _semantic_target_id(target: dict[str, Any]) -> int | None:
    """Read a stored datasource ID without treating booleans as integer IDs."""
    raw_id: Any = target.get("datasetId")
    if isinstance(raw_id, bool) or not (
        isinstance(raw_id, int) or (isinstance(raw_id, str) and raw_id.isdecimal())
    ):
        return None
    value: int = int(raw_id)
    return value if 0 < value <= 2**63 - 1 else None


class RestoreDashboardCommand(BaseRestoreCommand[Dashboard]):
    """Restore a soft-deleted dashboard by clearing its ``deleted_at`` field.

    Most behaviour is inherited from ``BaseRestoreCommand``. The override
    here adds the slug-conflict check: with the partial unique index on
    ``slug WHERE deleted_at IS NULL``, slug reuse during the soft-deleted
    window is allowed, so a restore may now collide with an active row
    that claimed the slug while this one was deleted. Raise a clean
    domain error in that case instead of letting the unique-index
    violation surface as an opaque ``IntegrityError`` at flush time.
    """

    dao = DashboardDAO
    not_found_exc = DashboardNotFoundError
    forbidden_exc = DashboardForbiddenError
    restore_failed_exc = DashboardRestoreFailedError

    def prepare_restore(self, model: Dashboard) -> None:
        """Remove controls with missing semantic targets before making them live.

        A missing target invalidates the entire control, including its defaults.
        Do not confuse unavailable providers or lost datasource grants with deletion:
        only metadata existence matters after dashboard editorship was validated.
        """
        metadata: dict[str, Any] = json.loads(model.json_metadata or "{}")
        keys: tuple[str, str] = (
            "native_filter_configuration",
            "chart_customization_config",
        )
        controls: list[dict[str, Any]] = [
            control for key in keys for control in metadata.get(key) or []
        ]
        semantic_ids: dict[int, set[int | None]] = {
            id(control): {
                _semantic_target_id(target)
                for target in control.get("targets") or []
                if target.get("datasourceType") == "semantic_view"
            }
            for control in controls
        }
        requested_ids: set[int] = {
            target_id
            for ids in semantic_ids.values()
            for target_id in ids
            if target_id is not None
        }
        existing_ids: set[int] = (
            set(
                db.session.scalars(
                    select(SemanticView.id).where(SemanticView.id.in_(requested_ids))
                )
            )
            if requested_ids
            else set()
        )
        removed: list[dict[str, Any]] = [
            control for control in controls if semantic_ids[id(control)] - existing_ids
        ]
        if not removed:
            return
        removed_objects: set[int] = {id(control) for control in removed}
        removed_ids: set[str] = {
            control["id"] for control in removed if "id" in control
        }
        for key in keys:
            if key in metadata and metadata[key] is not None:
                metadata[key] = [
                    control
                    for control in metadata[key]
                    if id(control) not in removed_objects
                ]
                for control in metadata[key]:
                    if control.get("cascadeParentIds"):
                        control["cascadeParentIds"] = [
                            parent
                            for parent in control["cascadeParentIds"]
                            if parent not in removed_ids
                        ]
        model.json_metadata = json.dumps(metadata)
        self.warnings.append(
            f"Warning: removed {len(removed)} dashboard filter(s) or display "
            "control(s) referencing a missing semantic view. Review the dashboard "
            "filters before using its results."
        )

    def validate(self) -> Dashboard:  # type: ignore[override]
        """Extend ``BaseRestoreCommand.validate`` with a slug-conflict pre-check.

        Raises ``DashboardSlugConflictError`` when the dashboard has a
        ``slug`` that has been claimed by another active dashboard while
        this one was soft-deleted. Surfacing the conflict as a domain
        error here keeps callers from seeing an opaque ``IntegrityError``
        at flush time on dialects with the partial index, and a
        constraint-violation 500 on dialects without it.
        """
        model = super().validate()
        # Check ``is not None`` rather than truthiness: an empty-string slug is
        # still subject to the partial unique index, so it must be guarded too
        # (a falsy "" would otherwise skip the pre-check and fail later with an
        # opaque IntegrityError).
        if model.slug is not None and self._has_active_slug_twin(model):
            raise DashboardSlugConflictError()
        return model

    @staticmethod
    def _has_active_slug_twin(model: Dashboard) -> bool:
        """Return True iff another active dashboard already owns this slug.

        Slug uniqueness is enforced only among active rows (via the
        partial index ``ix_dashboards_active_slug``). If the slug has
        been claimed since this dashboard was soft-deleted, the restore
        would create two active rows with the same slug — caught here
        so it surfaces as a readable domain error rather than an opaque
        ``IntegrityError`` at flush time.

        Delegates to ``DashboardDAO.validate_update_slug_uniqueness`` so
        the active-slug-twin rule has exactly one implementation — the
        update path, this explicit restore, and the importer's
        restore-with-update all consult the same predicate (which relies
        on the ``SoftDeleteMixin`` listener to consider only active
        rows; see its docstring for the dialect caveat).
        """
        return not DashboardDAO.validate_update_slug_uniqueness(model.id, model.slug)
