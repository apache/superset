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

from flask_appbuilder.security.sqla.models import User

from superset import app, security_manager
from superset.reports.commands.exceptions import ReportScheduleUserNotFoundError
from superset.reports.models import ReportSchedule
from superset.reports.types import ReportScheduleExecutor


# pylint: disable=too-many-branches
def get_executor(report_schedule: ReportSchedule) -> User:
    """
    Extract the user that should be used to execute a report schedule as.

    :param report_schedule: The report to execute
    :return: User to execute the report as
    """
    user_types = app.config["ALERT_REPORTS_EXECUTE_AS"]
    owners = report_schedule.owners
    owner_dict = {owner.id: owner for owner in owners}
    for user_type in user_types:
        if user_type == ReportScheduleExecutor.SELENIUM:
            username = app.config["THUMBNAIL_SELENIUM_USER"]
            if username and (user := security_manager.find_user(username=username)):
                return user
        if user_type == ReportScheduleExecutor.CREATOR_OWNER:
            if (user := report_schedule.created_by) and (
                owner := owner_dict.get(user.id)
            ):
                return owner
        if user_type == ReportScheduleExecutor.CREATOR:
            if user := report_schedule.created_by:
                return user
        if user_type == ReportScheduleExecutor.MODIFIER_OWNER:
            if (user := report_schedule.changed_by) and (
                owner := owner_dict.get(user.id)
            ):
                return owner
        if user_type == ReportScheduleExecutor.MODIFIER:
            if user := report_schedule.changed_by:
                return user
        if user_type == ReportScheduleExecutor.OWNER:
            owners = report_schedule.owners
            if len(owners) == 1:
                return owners[0]
            if len(owners) > 1:
                if modifier := report_schedule.changed_by:
                    if modifier and (user := owner_dict.get(modifier.id)):
                        return user
                if creator := report_schedule.created_by:
                    if creator and (user := owner_dict.get(creator.id)):
                        return user
                return owners[0]

    raise ReportScheduleUserNotFoundError()
