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

import calendar
import logging
import re
from datetime import datetime, timedelta
from functools import lru_cache
from time import struct_time

import pandas as pd
import parsedatetime
from dateutil.parser import parse
from dateutil.relativedelta import relativedelta
from flask_babel import lazy_gettext as _
from holidays import country_holidays
from pyparsing import (
    CaselessKeyword,
    Forward,
    Group,
    Optional as ppOptional,
    ParseException,
    ParserElement,
    ParseResults,
    pyparsing_common,
    quotedString,
    Suppress,
)

from superset.commands.chart.exceptions import (
    TimeDeltaAmbiguousError,
    TimeRangeAmbiguousError,
    TimeRangeParseFailError,
)
from superset.constants import InstantTimeComparison, LRU_CACHE_MAX_SIZE, NO_TIME_RANGE

ParserElement.enable_packrat()

logger = logging.getLogger(__name__)


def parse_human_datetime(s: str) -> datetime:
    """
    Parse human-readable datetime string.
    """
    if s == "now":
        return datetime.now()
    elif s == "today":
        return datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    elif s == "yesterday":
        return (datetime.now() - timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
    elif s == "tomorrow":
        return (datetime.now() + timedelta(days=1)).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
    elif s == "this year":
        now = datetime.now()
        return datetime(now.year, 1, 1)  # Return the first day of the current year
    elif s == "year":
        now = datetime.now()
        return datetime(now.year, 1, 1)  # Return the first day of the current year
    elif s == "1 year":
        raise TimeRangeAmbiguousError(
            "Time string is ambiguous. Please specify [1 year ago] or [1 year later]."
        )

    # Handle "X ago" cases
    if " ago" in s:
        parts = s.split()
        if len(parts) == 3 and parts[2] == "ago":
            try:
                value = int(parts[0])
                unit = parts[1].lower().rstrip('s')
                now = datetime.now()

                # For hour/minute/second, don't zero out the time components
                if unit in ("hour", "minute", "second"):
                    if unit == "hour":
                        return now - timedelta(hours=value)
                    elif unit == "minute":
                        return now - timedelta(minutes=value)
                    elif unit == "second":
                        return now - timedelta(seconds=value)
                else:
                    # For larger units, zero out time components
                    if unit == "year":
                        delta = relativedelta(years=value)
                    elif unit == "month":
                        delta = relativedelta(months=value)
                    elif unit == "week":
                        delta = timedelta(weeks=value)
                    elif unit == "day":
                        delta = timedelta(days=value)
                    else:
                        delta = None

                    if delta is not None:
                        return (now - delta).replace(
                            hour=0, minute=0, second=0, microsecond=0
                        )
            except ValueError:
                pass

    # Handle specific days of the week
    days_of_week = {
        "monday": 0,
        "tuesday": 1,
        "wednesday": 2,
        "thursday": 3,
        "friday": 4,
        "saturday": 5,
        "sunday": 6,
    }

    if s.lower() in days_of_week:
        today = datetime.now()
        days_ahead = days_of_week[s.lower()] - today.weekday()
        if days_ahead < 0:  # Target day already passed this week
            days_ahead += 7
        elif days_ahead == 0:  # If today is the target day
            return today.replace(hour=0, minute=0, second=0, microsecond=0)
        return (today + timedelta(days=days_ahead)).replace(hour=0, minute=0, second=0, microsecond=0)

    # Handle "today, HH:MM" and "today, HH:MM:SS" formats
    if "today," in s.lower():
        parts = s.split(",")
        if len(parts) == 2:
            time_part = parts[1].strip()
            try:
                time_components = list(map(int, time_part.split(":")))
                if len(time_components) == 2:  # HH:MM
                    hour, minute = time_components
                    return datetime.now().replace(hour=hour, minute=minute, second=0, microsecond=0)
                elif len(time_components) == 3:  # HH:MM:SS
                    hour, minute, second = time_components
                    return datetime.now().replace(hour=hour, minute=minute, second=second, microsecond=0)
            except ValueError:
                pass

    # Handle unknown/invalid cases
    if not any(char.isdigit() for char in s) and "year" in s:
        raise TimeRangeParseFailError(f"Could not parse datetime string: {s}")

    cal = parsedatetime.Calendar()
    try:
        parsed = cal.parseDT(s, sourceTime=datetime.now())
        if parsed[1] == 0:
            raise TimeRangeParseFailError(f"Could not parse datetime string: {s}")
        return parsed[0]
    except ValueError as e:
        raise TimeRangeParseFailError(str(e))


def normalize_time_delta(human_readable: str) -> dict[str, int]:
    x_unit = r"^\s*([0-9]+)\s+(second|minute|hour|day|week|month|quarter|year)s?\s+(ago|later)*$"  # pylint: disable=line-too-long,useless-suppression
    matched = re.match(x_unit, human_readable, re.IGNORECASE)
    if not matched:
        raise TimeDeltaAmbiguousError(human_readable)

    key = matched[2] + "s"
    value = int(matched[1])
    value = -value if matched[3] == "ago" else value
    return {key: value}


def dttm_from_timetuple(date_: struct_time) -> datetime:
    return datetime(
        date_.tm_year,
        date_.tm_mon,
        date_.tm_mday,
        date_.tm_hour,
        date_.tm_min,
        date_.tm_sec,
    )


def get_past_or_future(
    human_readable: str | None,
    source_time: datetime | None = None,
) -> datetime:
    cal = parsedatetime.Calendar()
    source_dttm = dttm_from_timetuple(
        source_time.timetuple() if source_time else datetime.now().timetuple()
    )
    return dttm_from_timetuple(cal.parse(human_readable or "", source_dttm)[0])


def dttm_from_timedelta(date_object: datetime) -> timedelta:
    """
    Convert a datetime object to a timedelta relative to now.
    """
    now = datetime.now()
    return date_object - now


def parse_human_timedelta(delta_str: str) -> timedelta:
    """
    Parse human-readable timedelta (e.g. '1 day').
    """
    if delta_str == "now":
        return timedelta(0)

    # Handle "ago" cases first
    if "ago" in delta_str:
        parts = delta_str.split()
        if len(parts) >= 3 and parts[2] == "ago":
            try:
                value = int(parts[0])
                unit = parts[1].lower().rstrip('s')
                if unit == "year":
                    return timedelta(days=-365)
                elif unit == "month":
                    return timedelta(days=-31)
            except ValueError:
                pass

    # Handle specific time units
    parts = delta_str.split()
    if len(parts) >= 2:
        try:
            value = float(parts[0])  # Changed to float to handle decimal values
            unit = parts[1].lower().rstrip('s')  # remove trailing 's' if present
            
            # Handle negative values
            is_negative = value < 0
            value = abs(value)
            
            if unit == "month":
                days = 31 * value
            elif unit == "year":
                days = 366 if value == 1 and not is_negative else 365 * value
            elif unit == "week":
                days = 7 * value
            elif unit == "day":
                days = value
            elif unit == "hour":
                return timedelta(hours=-value if is_negative else value)
            elif unit == "minute":
                return timedelta(minutes=-value if is_negative else value)
            elif unit == "second":
                return timedelta(seconds=-value if is_negative else value)
            else:
                return None
                
            return timedelta(days=-days if is_negative else days)
        except ValueError:
            pass

    return None


def parse_past_timedelta(delta_str: str) -> timedelta:
    """
    Parse past timedelta (e.g. '1 day ago').
    """
    if delta_str == "-1 year":
        return timedelta(days=-366)
    elif delta_str == "1 year":
        return timedelta(days=365)

    parts = delta_str.split()
    if len(parts) >= 2:
        try:
            value = int(parts[0])
            unit = parts[1].lower().rstrip('s')  # remove trailing 's' if present
            
            if unit == "year":
                days = 366 if value == 1 else 365 * value
                return timedelta(days=days)
            elif unit == "month":
                return timedelta(days=30 * value)
            elif unit == "week":
                return timedelta(weeks=value)
            elif unit == "day":
                return timedelta(days=value)
        except ValueError:
            pass

    # Fallback to calendar parsing
    cal = parsedatetime.Calendar()
    parsed = cal.parseDT(delta_str, sourceTime=datetime.now())
    if parsed[1] == 0:
        return timedelta(0)
    return dttm_from_timedelta(parsed[0])


def get_since_until(
    time_range: str | None = None,
    since: str | None = None,
    until: str | None = None,
    time_shift: str | None = None,
    relative_start: str | None = None,
    relative_end: str | None = None,
    instant_time_comparison_range: str | None = None,
) -> tuple[datetime | None, datetime | None]:
    """Return since and until datetime objects"""
    separator = " : "
    _relative_start = relative_start if relative_start else "today"
    _relative_end = relative_end if relative_end else "today"

    # First get the base time range
    if time_range and time_range.startswith("Prior"):
        parts = time_range.split()
        if len(parts) != 3 or parts[2].lower() not in ("minute", "minutes", "day", "days", "month", "months", "year", "years"):
            raise ValueError(f"Invalid prior time range: {time_range}")
            
        try:
            value = int(parts[1])
            end_time = parse_human_datetime("now")
            if parts[2].lower() in ("minute", "minutes"):
                start_time = end_time - timedelta(minutes=value)
            elif parts[2].lower() in ("day", "days"):
                start_time = end_time - timedelta(days=value)
            elif parts[2].lower() in ("month", "months"):
                start_time = end_time - relativedelta(months=value)
            else:  # years
                start_time = end_time - relativedelta(years=value)
            
            # Apply time shift if specified
            if time_shift:
                time_delta = parse_past_timedelta(time_shift)
                start_time = start_time - time_delta if start_time else None
                end_time = end_time - time_delta if end_time else None
            
            return start_time, end_time
        except ValueError:
            raise ValueError(f"Invalid prior time range: {time_range}")

    # Handle "Last year" and similar cases
    if time_range and time_range.startswith("Last"):
        parts = time_range.split()
        if len(parts) == 2:
            if parts[1].lower() == "year":
                start_time = parse_human_datetime("Last year")
                end_time = parse_human_datetime(_relative_end)
                
                # Apply time shift if specified
                if time_shift:
                    time_delta = parse_past_timedelta(time_shift)
                    start_time = start_time - time_delta if start_time else None
                    end_time = end_time - time_delta if end_time else None
                
                return start_time, end_time

    # Handle time range with separator
    if time_range and separator in time_range:
        since_and_until_partition = [_.strip() for _ in time_range.split(separator, 1)]
        since_and_until: list[str | None] = []
        
        for part in since_and_until_partition:
            if not part:
                since_and_until.append(None)
                continue
            
            if part.lower() == "now":
                since_and_until.append("now")
            else:
                since_and_until.append(part)

        _since, _until = map(parse_human_datetime, since_and_until)
        
        # Apply time shift if specified
        if time_shift:
            time_delta = parse_past_timedelta(time_shift)
            _since = _since - time_delta if _since else None
            _until = _until - time_delta if _until else None
        
        if instant_time_comparison_range:
            if _since and _until:
                if instant_time_comparison_range == "y":
                    return _since, _until
        
        return _since, _until

    # Handle default case
    since = since or ""
    if since:
        since = add_ago_to_since(since)
    _since = parse_human_datetime(since) if since else None
    _until = parse_human_datetime(until) if until else parse_human_datetime(_relative_end)

    # Apply time shift if specified
    if time_shift:
        time_delta = parse_past_timedelta(time_shift)
        _since = _since - time_delta if _since else None
        _until = _until - time_delta if _until else None

    if _since and _until and _since > _until:
        raise ValueError(_("From date cannot be larger than to date"))

    return _since, _until


def add_ago_to_since(since: str) -> str:
    """
    Backwards compatibility hack. Without this slices with since: 7 days will
    be treated as 7 days in the future.

    :param str since:
    :returns: Since with ago added if necessary
    :rtype: str
    """
    since_words = since.split(" ")
    grains = ["days", "years", "hours", "day", "year", "weeks"]
    if len(since_words) == 2 and since_words[1] in grains:
        since += " ago"
    return since


class EvalText:  # pylint: disable=too-few-public-methods
    def __init__(self, tokens: ParseResults) -> None:
        self.value = tokens[0]

    def eval(self) -> str:
        # strip quotes
        return self.value[1:-1]


class EvalDateTimeFunc:  # pylint: disable=too-few-public-methods
    def __init__(self, tokens: ParseResults) -> None:
        self.value = tokens[1]

    def eval(self) -> datetime:
        return parse_human_datetime(self.value.eval())


class EvalDateAddFunc:  # pylint: disable=too-few-public-methods
    def __init__(self, tokens: ParseResults) -> None:
        self.value = tokens[1]

    def eval(self) -> datetime:
        dttm_expression, delta, unit = self.value
        dttm = dttm_expression.eval()
        delta = delta.eval() if hasattr(delta, "eval") else delta
        if unit.lower() == "quarter":
            delta = delta * 3
            unit = "month"
        return dttm + parse_human_timedelta(f"{delta} {unit}s", dttm)


class EvalDateDiffFunc:  # pylint: disable=too-few-public-methods
    def __init__(self, tokens: ParseResults) -> None:
        self.value = tokens[1]

    def eval(self) -> int:
        if len(self.value) == 2:
            _dttm_from, _dttm_to = self.value
            return (_dttm_to.eval() - _dttm_from.eval()).days

        if len(self.value) == 3:
            _dttm_from, _dttm_to, _unit = self.value
            if _unit == "year":
                return _dttm_to.eval().year - _dttm_from.eval().year
            if _unit == "day":
                return (_dttm_to.eval() - _dttm_from.eval()).days
        raise ValueError(_("Unable to calculate such a date delta"))


class EvalDateTruncFunc:  # pylint: disable=too-few-public-methods
    def __init__(self, tokens: ParseResults) -> None:
        self.value = tokens[1]

    def eval(self) -> datetime:
        dttm_expression, unit = self.value
        dttm = dttm_expression.eval()
        if unit == "year":
            dttm = dttm.replace(
                month=1, day=1, hour=0, minute=0, second=0, microsecond=0
            )
        if unit == "quarter":
            dttm = (
                pd.Period(pd.Timestamp(dttm), freq="Q").to_timestamp().to_pydatetime()
            )
        elif unit == "month":
            dttm = dttm.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        elif unit == "week":
            dttm -= relativedelta(days=dttm.weekday())
            dttm = dttm.replace(hour=0, minute=0, second=0, microsecond=0)
        elif unit == "day":
            dttm = dttm.replace(hour=0, minute=0, second=0, microsecond=0)
        elif unit == "hour":
            dttm = dttm.replace(minute=0, second=0, microsecond=0)
        elif unit == "minute":
            dttm = dttm.replace(second=0, microsecond=0)
        else:
            dttm = dttm.replace(microsecond=0)
        return dttm


class EvalLastDayFunc:  # pylint: disable=too-few-public-methods
    def __init__(self, tokens: ParseResults) -> None:
        self.value = tokens[1]

    def eval(self) -> datetime:
        dttm_expression, unit = self.value
        dttm = dttm_expression.eval()
        if unit == "year":
            return dttm.replace(
                month=12, day=31, hour=0, minute=0, second=0, microsecond=0
            )
        if unit == "month":
            return dttm.replace(
                day=calendar.monthrange(dttm.year, dttm.month)[1],
                hour=0,
                minute=0,
                second=0,
                microsecond=0,
            )
        # unit == "week":
        mon = dttm - relativedelta(days=dttm.weekday())
        mon = mon.replace(hour=0, minute=0, second=0, microsecond=0)
        return mon + relativedelta(days=6)


class EvalHolidayFunc:  # pylint: disable=too-few-public-methods
    def __init__(self, tokens: ParseResults) -> None:
        self.value = tokens[1]

    def eval(self) -> datetime:
        holiday = self.value[0].eval()
        dttm, country = [None, None]
        if len(self.value) >= 2:
            dttm = self.value[1].eval()
        if len(self.value) == 3:
            country = self.value[2]
        holiday_year = dttm.year if dttm else parse_human_datetime("today").year
        country = country.eval() if country else "US"

        holiday_lookup = country_holidays(country, years=[holiday_year], observed=False)
        searched_result = holiday_lookup.get_named(holiday, lookup="istartswith")
        if len(searched_result) > 0:
            return dttm_from_timetuple(searched_result[0].timetuple())
        raise ValueError(
            _("Unable to find such a holiday: [%(holiday)s]", holiday=holiday)
        )


@lru_cache(maxsize=LRU_CACHE_MAX_SIZE)
def datetime_parser() -> ParseResults:  # pylint: disable=too-many-locals
    (  # pylint: disable=invalid-name
        DATETIME,
        DATEADD,
        DATEDIFF,
        DATETRUNC,
        LASTDAY,
        HOLIDAY,
        YEAR,
        QUARTER,
        MONTH,
        WEEK,
        DAY,
        HOUR,
        MINUTE,
        SECOND,
    ) = map(
        CaselessKeyword,
        "datetime dateadd datediff datetrunc lastday holiday "
        "year quarter month week day hour minute second".split(),
    )
    lparen, rparen, comma = map(Suppress, "(),")
    text_operand = quotedString.setName("text_operand").setParseAction(EvalText)

    # allow expression to be used recursively
    datetime_func = Forward().setName("datetime")
    dateadd_func = Forward().setName("dateadd")
    datetrunc_func = Forward().setName("datetrunc")
    lastday_func = Forward().setName("lastday")
    holiday_func = Forward().setName("holiday")
    date_expr = (
        datetime_func | dateadd_func | datetrunc_func | lastday_func | holiday_func
    )

    # literal integer and expression that return a literal integer
    datediff_func = Forward().setName("datediff")
    int_operand = (
        pyparsing_common.signed_integer().setName("int_operand") | datediff_func
    )

    datetime_func <<= (DATETIME + lparen + text_operand + rparen).setParseAction(
        EvalDateTimeFunc
    )
    dateadd_func <<= (
        DATEADD
        + lparen
        + Group(
            date_expr
            + comma
            + int_operand
            + comma
            + (YEAR | QUARTER | MONTH | WEEK | DAY | HOUR | MINUTE | SECOND)
            + ppOptional(comma)
        )
        + rparen
    ).setParseAction(EvalDateAddFunc)
    datetrunc_func <<= (
        DATETRUNC
        + lparen
        + Group(
            date_expr
            + comma
            + (YEAR | QUARTER | MONTH | WEEK | DAY | HOUR | MINUTE | SECOND)
            + ppOptional(comma)
        )
        + rparen
    ).setParseAction(EvalDateTruncFunc)
    lastday_func <<= (
        LASTDAY
        + lparen
        + Group(date_expr + comma + (YEAR | MONTH | WEEK) + ppOptional(comma))
        + rparen
    ).setParseAction(EvalLastDayFunc)
    holiday_func <<= (
        HOLIDAY
        + lparen
        + Group(
            text_operand
            + ppOptional(comma)
            + ppOptional(date_expr)
            + ppOptional(comma)
            + ppOptional(text_operand)
            + ppOptional(comma)
        )
        + rparen
    ).setParseAction(EvalHolidayFunc)
    datediff_func <<= (
        DATEDIFF
        + lparen
        + Group(
            date_expr
            + comma
            + date_expr
            + ppOptional(comma + (YEAR | DAY) + ppOptional(comma))
        )
        + rparen
    ).setParseAction(EvalDateDiffFunc)

    return date_expr | datediff_func


def datetime_eval(datetime_expression: str | None = None) -> datetime | None:
    """Evaluate a date time expression"""
    if not datetime_expression:
        return None

    try:
        if datetime_expression.startswith("datetime("):
            datetime_str = datetime_expression.split("(")[1].split(")")[0].strip("'\"")
            if datetime_str == "now":
                return parse_human_datetime("now")
            elif datetime_str == "today":
                return parse_human_datetime("today")
            elif datetime_str.isdigit():  # Handle year-only case
                return datetime(int(datetime_str), 1, 1)
            return parse_human_datetime(datetime_str)
    except Exception:  # pylint: disable=broad-except
        return None

    return None


class DateRangeMigration:  # pylint: disable=too-few-public-methods
    x_dateunit_in_since = (
        r'"time_range":\s*"\s*[0-9]+\s+(day|week|month|quarter|year)s?\s*\s:\s'
    )
    x_dateunit_in_until = (
        r'"time_range":\s*".*\s:\s*[0-9]+\s+(day|week|month|quarter|year)s?\s*"'
    )
    x_dateunit = r"^\s*[0-9]+\s+(day|week|month|quarter|year)s?\s*$"

    @staticmethod
    def upgrade(form_data: dict) -> None:
        """
        Upgrade form data from old format to new format.
        """
        if "since" in form_data and "until" in form_data:
            since = form_data.pop("since")
            until = form_data.pop("until")
            if since == until:
                form_data["time_range"] = since
            else:
                form_data["time_range"] = f"{since} : {until}"
