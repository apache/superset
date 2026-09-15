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

from superset.commands.dashboard.exceptions import (
    DashboardForbiddenError,
    DashboardNotFoundError,
    DashboardRestoreFailedError,
    DashboardSlugConflictError,
)
from superset.commands.restore import BaseRestoreCommand
from superset.daos.dashboard import DashboardDAO
from superset.models.dashboard import Dashboard


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
