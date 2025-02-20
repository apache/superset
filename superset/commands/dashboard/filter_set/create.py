# dodo added 44211751
import logging
from typing import Any

from flask_appbuilder.models.sqla import Model

from superset import security_manager
from superset.commands.dashboard.filter_set.base import BaseFilterSetCommand
from superset.commands.dashboard.filter_set.exceptions import (
    DashboardIdInconsistencyError,
    FilterSetCreateFailedError,
    UserIsNotDashboardOwnerError,
)
from superset.daos.dashboard import FilterSetDAO
from superset.dashboards.filter_sets.consts import (
    DASHBOARD_ID_FIELD,
    DASHBOARD_OWNER_TYPE,
    OWNER_ID_FIELD,
    OWNER_TYPE_FIELD,
)
from superset.utils.core import get_user_id

logger = logging.getLogger(__name__)


class CreateFilterSetCommand(BaseFilterSetCommand):
    # pylint: disable=C0103
    def __init__(self, dashboard_id: int, data: dict[str, Any]):
        super().__init__(dashboard_id)
        self._properties = data.copy()

    def run(self) -> Model:
        self.validate()
        self._properties[DASHBOARD_ID_FIELD] = self._dashboard.id
        return FilterSetDAO.create(attributes=self._properties)

    def validate(self) -> None:
        self._validate_filterset_dashboard_exists()
        if self._properties[OWNER_TYPE_FIELD] == DASHBOARD_OWNER_TYPE:
            self._validate_owner_id_is_dashboard_id()
            self._validate_user_is_the_dashboard_owner()
        else:
            self._validate_owner_id_exists()

    def _validate_owner_id_exists(self) -> None:
        owner_id = self._properties[OWNER_ID_FIELD]
        if not (get_user_id() == owner_id or security_manager.get_user_by_id(owner_id)):
            raise FilterSetCreateFailedError(
                str(self._dashboard_id), "owner_id does not exists"
            )

    def _validate_user_is_the_dashboard_owner(self) -> None:
        if not security_manager.is_owner(self._dashboard):
            raise UserIsNotDashboardOwnerError(str(self._dashboard_id))

    def _validate_owner_id_is_dashboard_id(self) -> None:
        if (
            self._properties.get(OWNER_ID_FIELD, self._dashboard_id)
            != self._dashboard_id
        ):
            raise DashboardIdInconsistencyError(str(self._dashboard_id))
