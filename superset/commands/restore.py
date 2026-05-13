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

from typing import Any, ClassVar, Generic, TypeVar

from superset import security_manager
from superset.commands.base import BaseCommand
from superset.exceptions import SupersetSecurityException
from superset.models.helpers import SoftDeleteMixin

T = TypeVar("T", bound=SoftDeleteMixin)


class BaseRestoreCommand(BaseCommand, Generic[T]):
    """Base class for soft-delete restore commands.

    Subclasses provide the entity-specific bindings as class variables:

      - ``dao``: the DAO class (e.g. ``ChartDAO``)
      - ``not_found_exc``: exception type raised when the row doesn't
        exist OR isn't soft-deleted
      - ``forbidden_exc``: exception type raised when the caller doesn't
        have ownership of the row

    Subclasses MUST override ``run()`` only to apply the
    ``@transaction(on_error=partial(on_error, reraise=<RestoreFailed>))``
    decorator with their concrete restore-failed exception type — the
    body should be a single ``super().run()`` call. The base class does
    not enforce this in code; Python decorators don't compose well with
    class-var-driven configuration. The contract lives in this
    docstring and in code review.

    The model returned from ``validate()`` is the soft-deleted row,
    type-narrowed via ``Generic[T]``. ``run()`` calls ``model.restore()``
    on it (the method comes from ``SoftDeleteMixin``).
    """

    dao: ClassVar[Any]
    not_found_exc: ClassVar[type[Exception]]
    forbidden_exc: ClassVar[type[Exception]]

    def __init__(self, model_uuid: str) -> None:
        self._model_uuid = model_uuid

    def run(self) -> None:
        model = self.validate()
        model.restore()

    def validate(self) -> T:  # type: ignore[override]
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
            security_manager.raise_for_ownership(model)
        except SupersetSecurityException as ex:
            raise self.forbidden_exc() from ex
        return model
