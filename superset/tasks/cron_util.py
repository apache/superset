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

import logging
from collections.abc import Iterator
from datetime import datetime, timedelta

from cron_descriptor import ExpressionDescriptor, get_description
from croniter import croniter, CroniterBadDateError
from flask import current_app
from pytz import timezone as pytz_timezone, UnknownTimeZoneError

logger = logging.getLogger(__name__)

# Field values that place no restriction on a cron field. ``?`` is the Quartz
# spelling of "no specific value" and is accepted by ``cron_descriptor``.
UNRESTRICTED_CRON_FIELDS = {"*", "?"}


def get_cron_description(cron: str) -> str:
    """
    Build a human readable description of a cron expression.

    ``cron_descriptor`` renders a restricted day-of-month next to a restricted
    day-of-week as a single comma separated clause -- ``0 9 7-11 * 2`` becomes
    "At 09:00 AM, on day 7 through 11 of the month, only on Tuesday" -- which
    reads as an intersection. POSIX cron, and therefore ``croniter`` (which
    picks the fire times in :func:`cron_schedule_window`), takes the *union* of
    the two fields when both are restricted: the schedule fires on every
    matching day of the month as well as on every matching day of the week.
    Join the two clauses with "or" so the description matches when the job
    really runs.
    """
    description = get_description(cron)

    fields = cron.split()
    if len(fields) != 5:
        return description

    day_of_month, day_of_week = fields[2], fields[4]
    if (
        day_of_month in UNRESTRICTED_CRON_FIELDS
        or day_of_week in UNRESTRICTED_CRON_FIELDS
    ):
        # Only one of the two fields narrows the days, so the description is
        # already unambiguous.
        return description

    day_of_week_clause = ExpressionDescriptor(cron).get_day_of_week_description()
    if not day_of_week_clause.startswith(", ") or day_of_week_clause not in description:
        return description

    clause = day_of_week_clause[len(", ") :]
    # "only on Tuesday" claims the day-of-week narrows the day-of-month clause;
    # it is an alternative to it, not an extra filter.
    clause = clause.removeprefix("only ")
    return description.replace(day_of_week_clause, f", or {clause}", 1)


def cron_schedule_window(
    triggered_at: datetime, cron: str, timezone: str
) -> Iterator[datetime]:
    window_size = current_app.config["ALERT_REPORTS_CRON_WINDOW_SIZE"]
    try:
        tz = pytz_timezone(timezone)
    except UnknownTimeZoneError:
        # fallback to default timezone
        tz = pytz_timezone("UTC")
        logger.warning("Timezone %s was invalid. Falling back to 'UTC'", timezone)
    utc = pytz_timezone("UTC")
    # convert the current time to the user's local time for comparison
    time_now = triggered_at.astimezone(tz)
    start_at = time_now - timedelta(seconds=window_size / 2)
    stop_at = time_now + timedelta(seconds=window_size / 2)
    crons = croniter(cron, start_at)
    try:
        for schedule in crons.all_next(datetime):
            if schedule >= stop_at:
                break
            # convert schedule back to utc
            yield schedule.astimezone(utc).replace(tzinfo=None)
    except CroniterBadDateError:
        logger.error(
            "Cron schedule %s can never match a valid date; "
            "it will not produce any executions",
            cron,
        )
