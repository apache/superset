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
from typing import Literal, TypedDict

from superset.dashboards.permalink.types import DashboardPermalinkState


class ReportScheduleExtra(TypedDict):
    dashboard: DashboardPermalinkState


class ReportConfigSettings(TypedDict, total=False):
    """Settings saved in the Alerts & Reports document; absent keys use fallbacks."""

    alerts_attach_reports: bool | None
    date_format_in_email_subject: bool | None
    alert_minimum_interval: int | None
    report_minimum_interval: int | None
    limit_recipients_to_users: bool | None
    allowed_email_domains: list[str] | None


class ReportConfigDocument(TypedDict):
    """Versioned Alerts & Reports configuration stored in the key-value table."""

    version: Literal[1]
    settings: ReportConfigSettings
