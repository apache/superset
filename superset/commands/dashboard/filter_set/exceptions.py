# dodo added 44211751
from typing import Optional

from flask_babel import lazy_gettext as _

from superset.commands.exceptions import (
    CreateFailedError,
    DeleteFailedError,
    ForbiddenError,
    ObjectNotFoundError,
    UpdateFailedError,
)


class FilterSetNotFoundError(ObjectNotFoundError):
    def __init__(
        self, filterset_id: Optional[str] = None, exception: Optional[Exception] = None
    ) -> None:
        super().__init__("FilterSet", filterset_id, exception)


class FilterSetCreateFailedError(CreateFailedError):
    base_message = 'CreateFilterSetCommand of dashboard "%s" failed: '

    def __init__(
        self, dashboard_id: str, reason: str = "", exception: Optional[Exception] = None
    ) -> None:
        super().__init__((self.base_message % dashboard_id) + reason, exception)


class FilterSetUpdateFailedError(UpdateFailedError):
    base_message = 'UpdateFilterSetCommand of filter_set "%s" failed: '

    def __init__(
        self, filterset_id: str, reason: str = "", exception: Optional[Exception] = None
    ) -> None:
        super().__init__((self.base_message % filterset_id) + reason, exception)


class FilterSetDeleteFailedError(DeleteFailedError):
    base_message = 'DeleteFilterSetCommand of filter_set "%s" failed: '

    def __init__(
        self, filterset_id: str, reason: str = "", exception: Optional[Exception] = None
    ) -> None:
        super().__init__((self.base_message % filterset_id) + reason, exception)


class UserIsNotDashboardOwnerError(FilterSetCreateFailedError):
    reason = (
        "cannot create dashboard owner filterset based when"
        " the user is not the dashboard owner"
    )

    def __init__(
        self, dashboard_id: str, exception: Optional[Exception] = None
    ) -> None:
        super().__init__(dashboard_id, self.reason, exception)


class DashboardIdInconsistencyError(FilterSetCreateFailedError):
    reason = (
        "cannot create dashboard owner filterset based when the"
        " ownerid is not the dashboard id"
    )

    def __init__(
        self, dashboard_id: str, exception: Optional[Exception] = None
    ) -> None:
        super().__init__(dashboard_id, self.reason, exception)


class FilterSetForbiddenError(ForbiddenError):
    message_format = 'Changing FilterSet "{}" is forbidden: {}'

    def __init__(
        self, filterset_id: str, reason: str = "", exception: Optional[Exception] = None
    ) -> None:
        super().__init__(_(self.message_format.format(filterset_id, reason)), exception)
