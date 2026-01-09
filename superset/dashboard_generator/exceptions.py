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
from __future__ import annotations

from flask_babel import lazy_gettext as _

from superset.commands.exceptions import (
    CommandException,
    CommandInvalidError,
    CreateFailedError,
    ObjectNotFoundError,
)


class DashboardGeneratorException(CommandException):
    """Base exception for dashboard generator errors"""

    pass


class DashboardGeneratorInvalidError(CommandInvalidError):
    """Invalid input for dashboard generation"""

    message = _("Dashboard generator parameters are invalid")


class DashboardGeneratorNotFoundError(ObjectNotFoundError):
    """Dashboard generator run not found"""

    def __init__(self, run_id: str | None = None) -> None:
        super().__init__("Dashboard generator run", run_id)


class DatabaseReportNotFoundError(ObjectNotFoundError):
    """Database report not found"""

    def __init__(self, report_id: int | str | None = None) -> None:
        super().__init__("Database report", str(report_id) if report_id else None)


class TemplateDashboardNotFoundError(ObjectNotFoundError):
    """Template dashboard not found"""

    def __init__(self, dashboard_id: int | str | None = None) -> None:
        super().__init__(
            "Template dashboard", str(dashboard_id) if dashboard_id else None
        )


class DashboardGeneratorCreateError(CreateFailedError):
    """Failed to create dashboard generator run"""

    message = _("Failed to create dashboard generator run")


class DashboardCopyError(DashboardGeneratorException):
    """Failed to copy dashboard from template"""

    status = 500
    message = _("Failed to copy dashboard from template")


class DatasetCreationError(DashboardGeneratorException):
    """Failed to create dataset"""

    status = 500
    message = _("Failed to create dataset for generated dashboard")


class ChartUpdateError(DashboardGeneratorException):
    """Failed to update chart"""

    status = 500
    message = _("Failed to update chart datasource")


class NativeFilterUpdateError(DashboardGeneratorException):
    """Failed to update native filters"""

    status = 500
    message = _("Failed to update native filters")


class LLMServiceError(DashboardGeneratorException):
    """Error calling LLM service"""

    status = 500
    message = _("Error calling LLM service for dashboard generation")


class DashboardGeneratorAlreadyRunningError(DashboardGeneratorException):
    """Dashboard generation already in progress"""

    status = 409
    message = _("Dashboard generation is already in progress for this template")
