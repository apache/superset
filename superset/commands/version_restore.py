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

Everything else — capture gate, lookup, editorship check, version-uuid
resolution, action-kind stamping, restore dispatch, transactional
boundary — lives here. Subclasses are pure declarations: the base builds
the ``@transaction`` wrapper at call time from the ``failed_exc``
ClassVar (mirroring ``BaseRestoreCommand``), so a new entity rollout
cannot forget the decorator.
"""

from __future__ import annotations

from functools import partial
from typing import Any, ClassVar
from uuid import UUID

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.exceptions import SupersetSecurityException
from superset.extensions import db
from superset.utils.decorators import on_error, transaction
from superset.versioning.queries import find_active_by_uuid, resolve_version
from superset.versioning.restore import restore_version, RestoreResult
from superset.versioning.utils import capture_enabled


class BaseRestoreVersionCommand(BaseCommand):
    """Workflow for a non-destructive version restore on one entity.

    Subclasses declare the model class plus the three entity-specific
    exception ClassVars; the base owns the workflow and the transactional
    boundary.
    """

    #: Subclass overrides — the versioned model class (``Slice`` /
    #: ``Dashboard`` / ``SqlaTable``).
    model_cls: ClassVar[type]

    #: Subclass overrides — exception classes raised on the matching
    #: failure modes. ``not_found_exc`` covers "no such entity",
    #: "version_uuid not on this entity", and "capture disabled" (the
    #: route is inert under the kill-switch); the API handler maps each
    #: to HTTP 404. ``forbidden_exc`` covers the row-level editorship
    #: denial (HTTP 403). ``failed_exc`` wraps unexpected failures inside
    #: the transaction (HTTP 422).
    not_found_exc: ClassVar[type[Exception]]
    forbidden_exc: ClassVar[type[Exception]]
    failed_exc: ClassVar[type[Exception]]

    def __init__(self, entity_uuid: UUID, version_uuid: UUID) -> None:
        self._uuid = entity_uuid
        self._version_uuid = version_uuid

    def run(self) -> RestoreResult:
        # Build the transactional wrapper at call time so ``on_error`` can
        # reference ``self.failed_exc`` — a per-subclass ClassVar that
        # isn't available when this method is defined on the base (same
        # pattern and rationale as ``BaseRestoreCommand.run``).
        @transaction(on_error=partial(on_error, reraise=self.failed_exc))
        def _perform() -> RestoreResult:
            return self._do_restore()

        return _perform()

    def _do_restore(self) -> RestoreResult:
        entity = self.validate()
        resolved = resolve_version(
            self.model_cls, self._uuid, self._version_uuid, entity=entity
        )
        if resolved is None:
            raise self.not_found_exc()
        version_number, transaction_id = resolved

        # Stamp the transaction so the change-record listener writes
        # ``action_kind='restore'`` and the ``__meta__`` headline — the
        # activity feed renders the restore as "Restored to version N",
        # not an ordinary save. Contract documented in
        # ``versioning/changes/listener.py`` (import/clone stamp the same
        # way); the listener pops both keys after use.
        # pylint: disable=import-outside-toplevel
        # Local import: the changes package bootstraps the versioning
        # listener graph; see its module docstring for the init-order
        # rationale.
        from superset.versioning.changes import (
            ACTION_KIND_KEY,
            ACTION_KIND_RESTORE,
            ACTION_META_KEY,
            build_action_headline,
            ENTITY_KIND_BY_CLASS_NAME,
        )

        db.session.info[ACTION_KIND_KEY] = ACTION_KIND_RESTORE
        entity_kind = ENTITY_KIND_BY_CLASS_NAME.get(self.model_cls.__name__)
        if entity_kind is not None:
            db.session.info[ACTION_META_KEY] = build_action_headline(
                entity_kind,
                entity.id,
                {
                    "version_uuid": str(self._version_uuid),
                    "version_number": version_number,
                },
            )

        result = restore_version(
            self.model_cls, self._uuid, transaction_id, entity=entity
        )
        if result is None:
            # Race: entity deleted, or the target version row pruned,
            # between validate()/resolve and the engine's re-check.
            raise self.not_found_exc()
        return result

    def validate(self) -> Any:
        # With capture off, Continuum's write listeners are detached: a
        # revert would mutate the live entity with NO new version row —
        # a destructive, untracked write. The whole restore surface is
        # therefore inert under the kill-switch, matching the read-side
        # convention (404, indistinguishable from "no such version").
        if not capture_enabled():
            raise self.not_found_exc()
        entity = find_active_by_uuid(self.model_cls, self._uuid)
        if entity is None:
            raise self.not_found_exc()
        try:
            security_manager.raise_for_editorship(entity)
        except SupersetSecurityException as ex:
            raise self.forbidden_exc() from ex
        return entity
