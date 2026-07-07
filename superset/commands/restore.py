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
"""Base class shared by all soft-delete restore commands."""

from functools import partial
from typing import Any, ClassVar, Generic, TypeVar

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.exceptions import SupersetSecurityException
from superset.models.helpers import SoftDeleteMixin
from superset.utils.decorators import on_error, transaction

T = TypeVar("T", bound=SoftDeleteMixin)


class BaseRestoreCommand(BaseCommand, Generic[T]):
    """Base class for soft-delete restore commands.

    Subclasses provide the entity-specific bindings as class variables —
    no method override required:

      - ``dao``: the DAO class (e.g. ``ChartDAO``)
      - ``not_found_exc``: raised when the row doesn't exist OR isn't
        soft-deleted
      - ``forbidden_exc``: raised when the caller doesn't have editorship
      - ``restore_failed_exc``: re-raised by the transactional wrapper
        when an underlying SQLAlchemy error aborts the commit

    The transactional wrapper is applied by this class's ``run()``
    using ``restore_failed_exc`` as the rethrow type, so each subclass
    just declares the four ClassVars and is done. There is no
    subclass-managed decorator contract — earlier iterations of this
    PR required subclasses to override ``run()`` purely to add a
    ``@transaction`` decorator, which was fragile (every new entity
    rollout had to remember).

    The model returned from ``validate()`` is the soft-deleted row,
    type-narrowed via ``Generic[T]``. ``run()`` calls ``model.restore()``
    on it (the method comes from ``SoftDeleteMixin``).
    """

    dao: ClassVar[Any]
    not_found_exc: ClassVar[type[Exception]]
    forbidden_exc: ClassVar[type[Exception]]
    restore_failed_exc: ClassVar[type[Exception]]

    def __init__(self, model_uuid: str) -> None:
        self._model_uuid = model_uuid

    def run(self) -> None:
        # Build the transactional wrapper at call time so ``on_error`` can
        # reference ``self.restore_failed_exc`` — a per-subclass ClassVar
        # that isn't available when this method is defined on the base.
        @transaction(on_error=partial(on_error, reraise=self.restore_failed_exc))
        def _perform() -> None:
            model = self.validate()
            model.restore()

        _perform()

    def validate(self) -> T:  # type: ignore[override]
        # Both bypasses are deliberate. ``skip_visibility_filter`` lets the
        # lookup see the soft-deleted row at all. ``skip_base_filter`` keeps
        # an editor's own trash reachable even when the entity's RBAC
        # ``base_filter`` has no editorship leg (charts/datasets filter by
        # datasource access): the security model's ``raise_for_access``
        # counts editorship as datasource access, so a lost grant must not
        # hide a row from the one audience that can restore it. The restore
        # audience is enforced below by ``raise_for_editorship`` — editors or
        # admin; anyone else holding a valid uuid gets 403.
        model = self.dao.find_by_id(
            self._model_uuid,
            id_column="uuid",
            skip_base_filter=True,
            skip_visibility_filter=True,
        )
        if model is None:
            raise self.not_found_exc(f"No row with uuid={self._model_uuid!r}")
        if model.deleted_at is None:
            raise self.not_found_exc(
                f"Row with uuid={self._model_uuid!r} is not soft-deleted; "
                "nothing to restore"
            )
        try:
            security_manager.raise_for_editorship(model)
        except SupersetSecurityException as ex:
            raise self.forbidden_exc() from ex
        return model
