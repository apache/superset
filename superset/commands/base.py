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
from abc import ABC, abstractmethod
from typing import Any, ClassVar, Generic, Optional, TypeVar

from flask_appbuilder.security.sqla.models import User

from superset import security_manager
from superset.commands.utils import compute_owner_list, populate_owner_list
from superset.exceptions import SupersetSecurityException

T = TypeVar("T")


class BaseCommand(ABC):
    """
    Base class for all Command like Superset Logic objects
    """

    @abstractmethod
    def run(self) -> Any:
        """
        Run executes the command. Can raise command exceptions
        :raises: CommandException
        """

    @abstractmethod
    def validate(self) -> None:
        """
        Validate is normally called by run to validate data.
        Will raise exception if validation fails
        :raises: CommandException
        """


class CreateMixin:  # pylint: disable=too-few-public-methods
    @staticmethod
    def populate_owners(owner_ids: Optional[list[int]] = None) -> list[User]:
        """
        Populate list of owners, defaulting to the current user if `owner_ids` is
        undefined or empty. If current user is missing in `owner_ids`, current user
        is added unless belonging to the Admin role.

        :param owner_ids: list of owners by id's
        :raises OwnersNotFoundValidationError: if at least one owner can't be resolved
        :returns: Final list of owners
        """
        return populate_owner_list(owner_ids, default_to_user=True)


class UpdateMixin:
    @staticmethod
    def populate_owners(owner_ids: Optional[list[int]] = None) -> list[User]:
        """
        Populate list of owners. If current user is missing in `owner_ids`, current user
        is added unless belonging to the Admin role.

        :param owner_ids: list of owners by id's
        :raises OwnersNotFoundValidationError: if at least one owner can't be resolved
        :returns: Final list of owners
        """
        return populate_owner_list(owner_ids, default_to_user=False)

    @staticmethod
    def compute_owners(
        current_owners: Optional[list[User]],
        new_owners: Optional[list[int]],
    ) -> list[User]:
        """
        Handle list of owners for update events.

        :param current_owners: list of current owners
        :param new_owners: list of new owners specified in the update payload
        :returns: Final list of owners
        """
        return compute_owner_list(current_owners, new_owners)


class BaseRestoreCommand(BaseCommand, Generic[T]):
    """Base class for soft-delete restore commands.

    Subclasses provide the entity-specific bindings as class variables:

      - ``dao``: the DAO class (e.g. ``ChartDAO``)
      - ``not_found_exc``: exception type raised when the row doesn't
        exist OR isn't soft-deleted
      - ``forbidden_exc``: exception type raised when the caller doesn't
        have ownership of the row
      - ``failed_exc``: exception type the ``@transaction`` decorator
        re-raises on any other failure mode

    Subclasses MUST override ``run()`` only to apply the
    ``@transaction(on_error=partial(on_error, reraise=cls.failed_exc))``
    decorator with their concrete failure-exception type — the body
    should be a single ``super().run()`` call.

    The model returned from ``validate()`` is the soft-deleted row,
    type-narrowed via ``Generic[T]``. ``run()`` calls ``model.restore()``
    on it (the method comes from ``SoftDeleteMixin``).
    """

    dao: ClassVar[Any]
    not_found_exc: ClassVar[type[Exception]]
    forbidden_exc: ClassVar[type[Exception]]
    failed_exc: ClassVar[type[Exception]]

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
            raise self.not_found_exc(
                f"No row with uuid={self._model_uuid!r}"
            )
        if model.deleted_at is None:
            raise self.not_found_exc(
                f"Row with uuid={self._model_uuid!r} is not soft-deleted; "
                f"nothing to restore"
            )
        try:
            security_manager.raise_for_ownership(model)
        except SupersetSecurityException as ex:
            raise self.forbidden_exc() from ex
        return model
