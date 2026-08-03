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
"""Owner/admin-gated permanent delete (force-purge) of a soft-deleted entity.

This is the RBAC-enforced REST surface anticipated by the deletion-retention
force-purge contract: it verifies ownership (owners/admins, mirroring restore)
on the soft-deleted row, then delegates the irreversible cascade removal to
``ForcePurgeCommand`` (which handles dependents, M:N rows, version history,
audit, and the commit). Restricted to *soft-deleted* rows so it only operates on
items the user already sees in the archive.
"""

import logging
from dataclasses import dataclass
from typing import Any

from sqlalchemy.exc import SQLAlchemyError

from superset import is_feature_enabled, security_manager
from superset.commands.base import BaseCommand
from superset.commands.deletion_retention.force_purge import ForcePurgeCommand
from superset.daos.base import BaseDAO
from superset.daos.exceptions import DAODeleteFailedError
from superset.exceptions import SupersetSecurityException
from superset.models.helpers import SoftDeleteMixin
from superset.tasks.utils import get_current_user

logger = logging.getLogger(__name__)

#: Recorded when the audit trail cannot name the acting user. The purge routes
#: are ``@protect()``-ed, so this should be unreachable; it exists so an
#: anomaly is visible as one rather than disguised as a plausible username.
UNKNOWN_ACTOR = "unknown"


@dataclass(frozen=True)
class SoftDeleteBinding:
    """Entity-specific bindings for the soft-delete purge command.

    Lets one command serve every soft-delete type without a subclass per
    entity. The REST route supplies the binding for its entity (see each
    ``*RestApi``).
    """

    dao: type[BaseDAO[Any]]
    not_found: type[Exception]
    forbidden: type[Exception]
    delete_failed: type[Exception]


class PurgeArchivedCommand(BaseCommand):
    """Permanently delete a single soft-deleted entity, by UUID."""

    def __init__(self, model_uuid: str, binding: SoftDeleteBinding) -> None:
        self._model_uuid = model_uuid
        self._binding = binding
        #: The authorized entity, resolved by ``validate()``. ``BaseCommand``
        #: fixes ``validate()``'s return type as ``None``, so the model is
        #: handed to ``run()`` here rather than returned.
        self._model: SoftDeleteMixin | None = None

    def run(self) -> None:
        self.validate()
        model = self._model
        if model is None:  # pragma: no cover — validate() raises or sets it
            raise self._binding.not_found(f"No row with uuid={self._model_uuid!r}")
        try:
            # ForcePurgeCommand owns the cascade + commit + audit.
            #
            # model_cls pins resolution to the type this route authorized:
            # UUIDs are unique per table but not across them, so an
            # unconstrained search could purge a different entity than the one
            # validate() checked the caller against.
            #
            # require_archived re-asserts soft-deleted state at resolution
            # time, closing the window between authorization and purge in which
            # a concurrent restore would otherwise expose a live row.
            result = ForcePurgeCommand(
                self._model_uuid,
                actor=get_current_user() or UNKNOWN_ACTOR,
                model_cls=type(model),
                require_archived=True,
                # An end user's irreversible purge must never run unaudited;
                # the CLI's fail-open default is an operator-trust decision
                # that does not extend to REST principals.
                require_audit=True,
            ).run()
        except (SQLAlchemyError, DAODeleteFailedError) as ex:
            # Deliberately narrow: a database or DAO failure is a real
            # "could not delete" answer and belongs in a 422. Anything else —
            # a programming error, a misconfiguration — is not the caller's
            # fault and must surface as a 500 rather than be disguised as one.
            #
            # The cause is logged, not returned: str(ex) on a driver error
            # carries the failing SQL and bind parameters, and this message
            # travels into a user-facing toast.
            logger.warning(
                "purge: database failure for uuid=%s", self._model_uuid, exc_info=True
            )
            raise self._binding.delete_failed(
                "The database could not complete the delete"
            ) from ex

        # A force purge reports its outcome rather than raising: a blocked or
        # vanished entity is still there afterwards, so reporting success would
        # tell the caller their data is gone when it is not.
        if not result.get("purged"):
            reason = result.get("reason")
            if reason == "audit_unavailable":
                raise self._binding.delete_failed(
                    "The purge was not performed because it could not be "
                    "recorded in the audit log"
                )
            if reason == "not_found":
                raise self._binding.not_found(
                    f"Row with uuid={self._model_uuid!r} was restored or removed "
                    "before it could be purged"
                )
            raise self._binding.delete_failed(
                result.get("blocked_reason")
                or f"Purge was blocked for uuid={self._model_uuid!r}"
            )

    def validate(self) -> None:
        if not is_feature_enabled("SOFT_DELETE"):
            # Every other surface of this feature is already gated: the archive
            # page, the Settings entry, and the retention task all stand down
            # when the flag is off. The route staying live left an irreversible
            # operation reachable for a feature nobody can otherwise see.
            #
            # Restore is deliberately *not* gated alongside it. With the flag
            # off, deletes are hard and the visibility filter is inert, so any
            # rows soft-deleted while it was on are plainly visible again --
            # and undoing that state is reversible, where purging it is not.
            # A disabled feature should lose its destructive operations, not
            # its recovery ones.
            raise self._binding.not_found(
                "Permanent delete is unavailable while soft delete is disabled"
            )

        # Bypass the visibility filter *and* the RBAC base filter, matching
        # BaseRestoreCommand: an editor whose base filter no longer admits the
        # row (e.g. a chart editor who lost datasource access) must still be
        # able to empty their own trash, not just fill it. Editorship is then
        # verified explicitly below, which is what actually gates the action.
        model = self._binding.dao.find_by_id(
            self._model_uuid,
            id_column="uuid",
            skip_visibility_filter=True,
            skip_base_filter=True,
        )
        if model is None:
            raise self._binding.not_found(f"No row with uuid={self._model_uuid!r}")
        if model.deleted_at is None:
            raise self._binding.not_found(
                f"Row with uuid={self._model_uuid!r} is not soft-deleted; "
                "nothing to purge"
            )
        try:
            security_manager.raise_for_editorship(model)
        except SupersetSecurityException as ex:
            raise self._binding.forbidden() from ex
        self._model = model
