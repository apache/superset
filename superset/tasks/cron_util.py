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

from datetime import datetime, timedelta, timezone as dt_timezone
from typing import Iterator

import pytz
from croniter import croniter

from superset import app


def cron_schedule_window(cron: str, timezone: str) -> Iterator[datetime]:
    window_size = app.config["ALERT_REPORTS_CRON_WINDOW_SIZE"]
    # create a time-aware datetime in utc
    time_now = datetime.now(tz=dt_timezone.utc)
    tz = pytz.timezone(timezone)
    utc = pytz.timezone("UTC")
    # convert the current time to the user's local time for comparison
    time_now = time_now.astimezone(tz)
    start_at = time_now - timedelta(seconds=1)
    stop_at = time_now + timedelta(seconds=window_size)
    crons = croniter(cron, start_at)
    for schedule in crons.all_next(datetime):
        if schedule >= stop_at:
            break
        # convert schedule back to utc
        yield schedule.astimezone(utc).replace(tzinfo=None)
