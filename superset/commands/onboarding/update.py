# DODO added #32839641

import logging
from functools import partial
from typing import Any, Optional

from flask_appbuilder.models.sqla import Model

from superset.commands.base import BaseCommand, UpdateMixin
from superset.commands.onboarding.exceptions import (
    OnboardingNotFoundError,
    OnboardingUpdateFailedError,
)
from superset.daos.user_info import UserInfoDAO
from superset.models.user_info import UserInfo
from superset.utils.decorators import on_error, transaction

logger = logging.getLogger(__name__)


class UpdateOnboardingCommand(UpdateMixin, BaseCommand):
    def __init__(self, model_id: int, data: dict[str, Any]):
        self._model_id = model_id
        self._properties = data.copy()
        self._model: Optional[UserInfo] = None

    @transaction(on_error=partial(on_error, reraise=OnboardingUpdateFailedError))
    def run(self) -> Model:
        self.validate()
        assert self._model

        user_info = UserInfoDAO.update(self._model, self._properties)
        return user_info

    def validate(self) -> None:
        # Validate model exists
        self._model = UserInfoDAO.find_by_id(self._model_id)
        if not self._model:
            raise OnboardingNotFoundError()
