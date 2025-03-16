# DODO added #32839638
from typing import Optional

from flask_babel import lazy_gettext as _

from superset.commands.exceptions import (
    CommandInvalidError,
    CreateFailedError,
    DeleteFailedError,
    ForbiddenError,
    ObjectNotFoundError,
    UpdateFailedError,
    ValidationError,
)


class TeamInvalidError(CommandInvalidError):
    message = _("Team parameters are invalid.")


class TeamSlugExistsValidationError(ValidationError):
    """
    Marshmallow validation error for dashboard slug already exists
    """

    def __init__(self) -> None:
        super().__init__([_("Must be unique")], field_name="slug")


class TeamNotFoundError(ObjectNotFoundError):
    def __init__(
        self, Team_id: Optional[str] = None, exception: Optional[Exception] = None
    ) -> None:
        super().__init__("Team", Team_id, exception)


class TeamCreateFailedError(CreateFailedError):
    message = _("Teams could not be created.")


class TeamUpdateFailedError(UpdateFailedError):
    message = _("Team could not be updated.")


class TeamDeleteFailedError(DeleteFailedError):
    message = _("Team could not be deleted.")


class TeamDeleteFailedReportsExistError(TeamDeleteFailedError):
    message = _("There are associated alerts or reports")


class TeamForbiddenError(ForbiddenError):
    message = _("Changing this Team is forbidden")


class TeamAccessDeniedError(ForbiddenError):
    message = _("You don't have access to this Team.")
