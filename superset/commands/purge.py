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

from typing import Any

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.commands.deletion_retention.force_purge import ForcePurgeCommand
from superset.exceptions import SupersetSecurityException
from superset.tasks.utils import get_current_user


class PurgeArchivedCommand(BaseCommand):
    """Permanently delete a single soft-deleted entity, by UUID.

    The entity-specific bindings (DAO + exception types) are passed in by the
    REST route, so one command serves all soft-delete types without a subclass
    per entity.
    """

    def __init__(
        self,
        model_uuid: str,
        dao: Any,
        not_found_exc: type[Exception],
        forbidden_exc: type[Exception],
        purge_failed_exc: type[Exception],
    ) -> None:
        self._model_uuid = model_uuid
        self._dao = dao
        self._not_found_exc = not_found_exc
        self._forbidden_exc = forbidden_exc
        self._purge_failed_exc = purge_failed_exc

    def run(self) -> None:
        self.validate()
        try:
            # ForcePurgeCommand owns the cascade + commit + audit.
            ForcePurgeCommand(
                self._model_uuid, actor=get_current_user() or "user"
            ).run()
        except Exception as ex:
            raise self._purge_failed_exc() from ex

    def validate(self) -> Any:
        # Bypass only the visibility filter (RBAC base_filter still applies),
        # matching the restore path; ownership is then verified explicitly.
        model = self._dao.find_by_id(
            self._model_uuid,
            id_column="uuid",
            skip_visibility_filter=True,
        )
        if model is None:
            raise self._not_found_exc(f"No row with uuid={self._model_uuid!r}")
        if model.deleted_at is None:
            raise self._not_found_exc(
                f"Row with uuid={self._model_uuid!r} is not soft-deleted; "
                "nothing to purge"
            )
        try:
            security_manager.raise_for_ownership(model)
        except SupersetSecurityException as ex:
            raise self._forbidden_exc() from ex
        return model
