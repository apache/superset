# DODO added #32839641

import logging
from functools import partial
from typing import Any, Optional

from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError

from superset.commands.base import BaseCommand, CreateMixin
from superset.commands.statement.exceptions import (
    StatementCreateFailedError,
    StatementInvalidError,
)
from superset.commands.utils import get_ids_roles_by_name
from superset.daos.statement import StatementDAO
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class CreateStatementCommand(CreateMixin, BaseCommand):
    def __init__(self, data: dict[str, Any]):
        self._properties = data.copy()

    @transaction(on_error=partial(on_error, reraise=StatementCreateFailedError))
    def run(self) -> Model:
        self.validate()

        statement = StatementDAO.create(attributes=self._properties)
        return statement

    def validate(self) -> None:
        exceptions = []
        role_names: Optional[list[str]] = self._properties.get("request_roles")
        user_id: Optional[list[int]] = self._properties.get("user")
        try:
            user = self.populate_owners(user_id)
            self._properties["user"] = user
            roles = get_ids_roles_by_name(role_names)
            self._properties["request_roles"] = roles
        except ValidationError as ex:
            exceptions.append(ex)
        if exceptions:
            raise StatementInvalidError(exceptions=exceptions)
