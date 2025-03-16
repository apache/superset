# DODO added #32839641
from typing import Optional

from flask_babel import lazy_gettext as _
from marshmallow.validate import ValidationError

from superset.commands.exceptions import (
    CommandInvalidError,
    ForbiddenError,
    ObjectNotFoundError,
    UpdateFailedError,
)


class OnboardingSlugExistsValidationError(ValidationError):
    """
    Marshmallow validation error for Onboarding slug already exists
    """

    def __init__(self) -> None:
        super().__init__([_("Must be unique")], field_name="slug")


class OnboardingInvalidError(CommandInvalidError):
    message = _("Onboarding parameters are invalid.")


class OnboardingNotFoundError(ObjectNotFoundError):
    def __init__(
        self, Onboarding_id: Optional[str] = None, exception: Optional[Exception] = None
    ) -> None:
        super().__init__("Onboarding", Onboarding_id, exception)


class OnboardingUpdateFailedError(UpdateFailedError):
    message = _("Onboarding could not be updated.")


class OnboardingForbiddenError(ForbiddenError):
    message = _("Changing this Onboarding is forbidden")


class OnboardingAccessDeniedError(ForbiddenError):
    message = _("You don't have access to this Onboarding.")
