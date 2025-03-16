# DODO added #32839641

from typing import Optional

from flask_babel import lazy_gettext as _

from superset.commands.exceptions import (
    CommandInvalidError,
    CreateFailedError,
    ForbiddenError,
    ObjectNotFoundError,
    UpdateFailedError,
)


class StatementInvalidError(CommandInvalidError):
    message = _("Statement parameters are invalid.")


class StatementNotFoundError(ObjectNotFoundError):
    def __init__(
        self, Statement_id: Optional[str] = None, exception: Optional[Exception] = None
    ) -> None:
        super().__init__("Statement", Statement_id, exception)


class StatementCreateFailedError(CreateFailedError):
    message = _("Statements could not be created.")


class StatementUpdateFailedError(UpdateFailedError):
    message = _("Statement could not be updated.")


class StatementForbiddenError(ForbiddenError):
    message = _("Changing this Statement is forbidden")


class StatementAccessDeniedError(ForbiddenError):
    message = _("You don't have access to this Statement.")
