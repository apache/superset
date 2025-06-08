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

from croniter import croniter
from pytz import timezone as pytz_timezone, UnknownTimeZoneError

from superset import app

logger = logging.getLogger(__name__)


def cron_schedule_window(
    triggered_at: datetime, cron: str, timezone: str
) -> Iterator[datetime]:
    window_size = app.config["ALERT_REPORTS_CRON_WINDOW_SIZE"]
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
    for schedule in crons.all_next(datetime):
        if schedule >= stop_at:
            break
        # convert schedule back to utc
        yield schedule.astimezone(utc).replace(tzinfo=None)
