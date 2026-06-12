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
"""Shared base for the per-entity restore-version commands.

The three concrete commands (:mod:`superset.commands.chart.restore_version`,
:mod:`superset.commands.dashboard.restore_version`,
:mod:`superset.commands.dataset.restore_version`) differ only in:

* the model class they operate on
* the per-entity ``NotFoundError`` / ``ForbiddenError`` / ``UpdateFailedError``
  triplet they raise

Everything else — lookup, ownership check, version-uuid resolution,
restore dispatch, transactional boundary — is identical. The base
defines the workflow; each subclass declares its three exception
classes and decorates :meth:`run` with the right ``failed_exc``.
"""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from flask_appbuilder import Model

from superset import db, security_manager
from superset.commands.base import BaseCommand
from superset.daos.version import VersionDAO
from superset.exceptions import SupersetSecurityException
from superset.versioning.changes import (
    ACTION_KIND_KEY,
    ACTION_KIND_RESTORE,
    ACTION_META_KEY,
    ENTITY_KIND_BY_CLASS_NAME,
)
from superset.versioning.diff import ChangeRecord

logger = logging.getLogger(__name__)


class BaseRestoreVersionCommand(BaseCommand):
    """Workflow for a non-destructive version restore on one entity.

    Subclasses declare the model class plus the three entity-specific
    exception classes; they also decorate :meth:`run` with
    ``@transaction(on_error=partial(on_error, reraise=<their failed_exc>))``
    so the transactional commit boundary maps to the right HTTP-level
    error on failure.
    """

    #: Subclass overrides — the versioned model class (``Slice`` /
    #: ``Dashboard`` / ``SqlaTable``).
    model_cls: type[Model]

    #: Subclass overrides — exception classes raised on the matching
    #: failure modes. ``not_found_exc`` covers both "no such entity"
    #: and "version_uuid not on this entity"; the API handler maps
    #: either to HTTP 404. ``forbidden_exc`` covers the row-level
    #: ownership denial; the handler maps it to HTTP 403.
    not_found_exc: type[Exception]
    forbidden_exc: type[Exception]

    def __init__(self, entity_uuid: UUID, version_uuid: UUID) -> None:
        self._uuid = entity_uuid
        self._version_uuid = version_uuid

    def _do_restore(self) -> Any:
        """The actual restore work — call from a ``@transaction``-decorated
        :meth:`run` in each subclass."""
        self.validate()
        version_number = VersionDAO.resolve_version_uuid(
            self.model_cls, self._uuid, self._version_uuid
        )
        if version_number is None:
            raise self.not_found_exc()
        live_entity = VersionDAO.find_active_by_uuid(self.model_cls, self._uuid)
        if live_entity is None:
            # Race: entity deleted between validate() and now.
            raise self.not_found_exc()
        # Declare the high-level avenue before the restore touches the
        # session. The change-record listener reads this on its first
        # after_flush for the new ``version_transaction`` row and stamps
        # ``version_transaction.action_kind = 'restore'``. See
        # data-model.md §"Three dimensions" for the full design.
        db.session.info[ACTION_KIND_KEY] = ACTION_KIND_RESTORE
        # And declare WHICH version is being restored: action_kind alone
        # can't answer "Restored to X from [date]" (version-history UI,
        # PR #40988). The listener prepends this synthetic ``__meta__``
        # headline record to the transaction's change records.
        db.session.info[ACTION_META_KEY] = {
            "entity_kind": ENTITY_KIND_BY_CLASS_NAME[self.model_cls.__name__],
            "entity_id": live_entity.id,
            "record": ChangeRecord(
                kind="__meta__",
                operation="edit",
                path=["__meta__", "restore"],
                from_value=None,
                to_value={
                    "version_uuid": str(self._version_uuid),
                    "version_number": version_number,
                },
            ),
        }
        entity = VersionDAO.restore_version(self.model_cls, self._uuid, version_number)
        if entity is None:
            # Race: entity deleted between validate() and now.
            raise self.not_found_exc()
        return entity

    def validate(self) -> None:
        entity = VersionDAO.find_active_by_uuid(self.model_cls, self._uuid)
        if entity is None:
            raise self.not_found_exc()
        try:
            security_manager.raise_for_ownership(entity)
        except SupersetSecurityException as ex:
            raise self.forbidden_exc() from ex
