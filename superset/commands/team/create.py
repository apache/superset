# DODO added #32839638

import logging
from functools import partial
from typing import Any, Optional

from flask_appbuilder.models.sqla import Model
from marshmallow import ValidationError

from superset.commands.base import BaseCommand, CreateMixin
from superset.commands.team.exceptions import (
    TeamCreateFailedError,
    TeamInvalidError,
    TeamSlugExistsValidationError,
)
from superset.commands.utils import get_ids_roles_by_name
from superset.daos.team import TeamDAO
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class CreateTeamCommand(CreateMixin, BaseCommand):
    def __init__(self, data: dict[str, Any]):
        self._properties = data.copy()

    @transaction(on_error=partial(on_error, reraise=TeamCreateFailedError))
    def run(self) -> Model:
        self.validate()

        team = TeamDAO.create(attributes=self._properties)
        return team

    def validate(self) -> None:
        exceptions: list[ValidationError] = []
        role_names: Optional[list[str]] = self._properties.get("roles")
        slug: str = self._properties.get("slug", "")

        # Validate slug uniqueness
        if not TeamDAO.validate_slug_uniqueness(slug):
            exceptions.append(TeamSlugExistsValidationError())

        try:
            roles = get_ids_roles_by_name(role_names)
            self._properties["roles"] = roles
        except ValidationError as ex:
            exceptions.append(ex)

        if exceptions:
            raise TeamInvalidError(exceptions=exceptions)
