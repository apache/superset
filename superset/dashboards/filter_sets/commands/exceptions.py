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
