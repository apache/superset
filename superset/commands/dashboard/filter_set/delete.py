# dodo added 44211751
import logging

from superset.commands.dashboard.filter_set.base import BaseFilterSetCommand
from superset.commands.dashboard.filter_set.exceptions import (
    FilterSetDeleteFailedError,
    FilterSetForbiddenError,
    FilterSetNotFoundError,
)
from superset.daos.dashboard import FilterSetDAO
from superset.daos.exceptions import DAODeleteFailedError

logger = logging.getLogger(__name__)


class DeleteFilterSetCommand(BaseFilterSetCommand):
    def __init__(self, dashboard_id: int, filter_set_id: int):
        super().__init__(dashboard_id)
        self._filter_set_id: int = filter_set_id

    def run(self) -> None:
        self.validate()
        assert self._filter_set

        try:
            FilterSetDAO.delete([self._filter_set])
        except DAODeleteFailedError as err:
            raise FilterSetDeleteFailedError(str(self._filter_set_id), "") from err

    def validate(self) -> None:
        self._validate_filterset_dashboard_exists()
        try:
            self.validate_exist_filter_use_cases_set()
        except FilterSetNotFoundError as err:
            if FilterSetDAO.find_by_id(self._filter_set_id):
                raise FilterSetForbiddenError(
                    f"the filter-set does not related to dashboard {self._dashboard_id}"
                ) from err
            raise
