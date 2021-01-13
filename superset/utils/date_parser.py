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
import calendar
import logging
import re
from datetime import datetime, timedelta
from time import struct_time
from typing import List, Optional, Tuple

import parsedatetime
from dateutil.parser import parse
from dateutil.relativedelta import relativedelta
from flask_babel import lazy_gettext as _
from holidays import CountryHoliday
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

from .core import memoized

ParserElement.enablePackrat()

logger = logging.getLogger(__name__)


def parse_human_datetime(human_readable: str) -> datetime:
    """
    Returns ``datetime.datetime`` from human readable strings

    >>> from datetime import date, timedelta
    >>> from dateutil.relativedelta import relativedelta
    >>> parse_human_datetime('2015-04-03')
    datetime.datetime(2015, 4, 3, 0, 0)
    >>> parse_human_datetime('2/3/1969')
    datetime.datetime(1969, 2, 3, 0, 0)
    >>> parse_human_datetime('now') <= datetime.now()
    True
    >>> parse_human_datetime('yesterday') <= datetime.now()
    True
    >>> date.today() - timedelta(1) == parse_human_datetime('yesterday').date()
    True
    >>> year_ago_1 = parse_human_datetime('one year ago').date()
    >>> year_ago_2 = (datetime.now() - relativedelta(years=1)).date()
    >>> year_ago_1 == year_ago_2
    True
    >>> year_after_1 = parse_human_datetime('2 years after').date()
    >>> year_after_2 = (datetime.now() + relativedelta(years=2)).date()
    >>> year_after_1 == year_after_2
    True
    """
    try:
        dttm = parse(human_readable)
    except Exception:  # pylint: disable=broad-except
        try:
            cal = parsedatetime.Calendar()
            parsed_dttm, parsed_flags = cal.parseDT(human_readable)
            # when time is not extracted, we 'reset to midnight'
            if parsed_flags & 2 == 0:
                parsed_dttm = parsed_dttm.replace(hour=0, minute=0, second=0)
            dttm = dttm_from_timetuple(parsed_dttm.utctimetuple())
        except Exception as ex:
            logger.exception(ex)
            raise ValueError("Couldn't parse date string [{}]".format(human_readable))
    return dttm


def dttm_from_timetuple(date_: struct_time) -> datetime:
    return datetime(
        date_.tm_year,
        date_.tm_mon,
        date_.tm_mday,
        date_.tm_hour,
        date_.tm_min,
        date_.tm_sec,
    )


def parse_human_timedelta(
    human_readable: Optional[str], source_time: Optional[datetime] = None,
) -> timedelta:
    """
    Returns ``datetime.timedelta`` from natural language time deltas

    >>> parse_human_timedelta('1 day') == timedelta(days=1)
    True
    """
    cal = parsedatetime.Calendar()
    source_dttm = dttm_from_timetuple(
        source_time.timetuple() if source_time else datetime.now().timetuple()
    )
    modified_dttm = dttm_from_timetuple(cal.parse(human_readable or "", source_dttm)[0])
    return modified_dttm - source_dttm


def parse_past_timedelta(
    delta_str: str, source_time: Optional[datetime] = None
) -> timedelta:
    """
    Takes a delta like '1 year' and finds the timedelta for that period in
    the past, then represents that past timedelta in positive terms.

    parse_human_timedelta('1 year') find the timedelta 1 year in the future.
    parse_past_timedelta('1 year') returns -datetime.timedelta(-365)
    or datetime.timedelta(365).
    """
    return -parse_human_timedelta(
        delta_str if delta_str.startswith("-") else f"-{delta_str}", source_time,
    )


# pylint: disable=too-many-arguments, too-many-locals, too-many-branches
def get_since_until(
    time_range: Optional[str] = None,
    since: Optional[str] = None,
    until: Optional[str] = None,
    time_shift: Optional[str] = None,
    relative_start: Optional[str] = None,
    relative_end: Optional[str] = None,
) -> Tuple[Optional[datetime], Optional[datetime]]:
    """Return `since` and `until` date time tuple from string representations of
    time_range, since, until and time_shift.

    This functiom supports both reading the keys separately (from `since` and
    `until`), as well as the new `time_range` key. Valid formats are:

        - ISO 8601
        - X days/years/hours/day/year/weeks
        - X days/years/hours/day/year/weeks ago
        - X days/years/hours/day/year/weeks from now
        - freeform

    Additionally, for `time_range` (these specify both `since` and `until`):

        - Last day
        - Last week
        - Last month
        - Last quarter
        - Last year
        - No filter
        - Last X seconds/minutes/hours/days/weeks/months/years
        - Next X seconds/minutes/hours/days/weeks/months/years

    """
    separator = " : "
    _relative_start = relative_start if relative_start else "today"
    _relative_end = relative_end if relative_end else "today"

    if time_range == "No filter":
        return None, None

    if time_range and time_range.startswith("Last") and separator not in time_range:
        time_range = time_range + separator + _relative_end

    if time_range and time_range.startswith("Next") and separator not in time_range:
        time_range = _relative_start + separator + time_range

    if (
        time_range
        and time_range.startswith("previous calendar week")
        and separator not in time_range
    ):
        time_range = "DATETRUNC(DATEADD(DATETIME('today'), -1, WEEK), WEEK) : DATETRUNC(DATETIME('today'), WEEK)"  # pylint: disable=line-too-long
    if (
        time_range
        and time_range.startswith("previous calendar month")
        and separator not in time_range
    ):
        time_range = "DATETRUNC(DATEADD(DATETIME('today'), -1, MONTH), MONTH) : DATETRUNC(DATETIME('today'), MONTH)"  # pylint: disable=line-too-long
    if (
        time_range
        and time_range.startswith("previous calendar year")
        and separator not in time_range
    ):
        time_range = "DATETRUNC(DATEADD(DATETIME('today'), -1, YEAR), YEAR) : DATETRUNC(DATETIME('today'), YEAR)"  # pylint: disable=line-too-long

    if time_range and separator in time_range:
        time_range_lookup = [
            (
                r"^last\s+(day|week|month|quarter|year)$",
                lambda unit: f"DATEADD(DATETIME('{_relative_start}'), -1, {unit})",
            ),
            (
                r"^last\s+([0-9]+)\s+(second|minute|hour|day|week|month|year)s$",
                lambda delta, unit: f"DATEADD(DATETIME('{_relative_start}'), -{int(delta)}, {unit})",  # pylint: disable=line-too-long
            ),
            (
                r"^next\s+([0-9]+)\s+(second|minute|hour|day|week|month|year)s$",
                lambda delta, unit: f"DATEADD(DATETIME('{_relative_end}'), {int(delta)}, {unit})",  # pylint: disable=line-too-long
            ),
            (
                r"^(DATETIME.*|DATEADD.*|DATETRUNC.*|LASTDAY.*|HOLIDAY.*)$",
                lambda text: text,
            ),
        ]

        since_and_until_partition = [_.strip() for _ in time_range.split(separator, 1)]
        since_and_until: List[Optional[str]] = []
        for part in since_and_until_partition:
            if not part:
                # if since or until is "", set as None
                since_and_until.append(None)
                continue

            # Is it possible to match to time_range_lookup
            matched = False
            for pattern, fn in time_range_lookup:
                result = re.search(pattern, part, re.IGNORECASE)
                if result:
                    matched = True
                    # converted matched time_range to "formal time expressions"
                    since_and_until.append(fn(*result.groups()))  # type: ignore
            if not matched:
                # default matched case
                since_and_until.append(f"DATETIME('{part}')")

        _since, _until = map(datetime_eval, since_and_until)
    else:
        since = since or ""
        if since:
            since = add_ago_to_since(since)
        _since = parse_human_datetime(since) if since else None
        _until = (
            parse_human_datetime(until)
            if until
            else parse_human_datetime(_relative_end)
        )

    if time_shift:
        time_delta = parse_past_timedelta(time_shift)
        _since = _since if _since is None else (_since - time_delta)
        _until = _until if _until is None else (_until - time_delta)

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
        if unit.lower() == "quarter":
            delta = delta * 3
            unit = "month"
        return dttm + parse_human_timedelta(f"{delta} {unit}s", dttm)


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
        elif unit == "month":
            dttm = dttm.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        elif unit == "week":
            dttm = dttm - relativedelta(days=dttm.weekday())
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

        holiday_lookup = CountryHoliday(country, years=[holiday_year], observed=False)
        searched_result = holiday_lookup.get_named(holiday)
        if len(searched_result) == 1:
            return dttm_from_timetuple(searched_result[0].timetuple())
        raise ValueError(_("Unable to find such a holiday: [{}]").format(holiday))


@memoized
def datetime_parser() -> ParseResults:  # pylint: disable=too-many-locals
    (  # pylint: disable=invalid-name
        DATETIME,
        DATEADD,
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
        "datetime dateadd datetrunc lastday holiday "
        "year quarter month week day hour minute second".split(),
    )
    lparen, rparen, comma = map(Suppress, "(),")
    int_operand = pyparsing_common.signed_integer().setName("int_operand")
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
            + (YEAR | MONTH | WEEK | DAY | HOUR | MINUTE | SECOND)
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

    return date_expr


def datetime_eval(datetime_expression: Optional[str] = None) -> Optional[datetime]:
    if datetime_expression:
        try:
            return datetime_parser().parseString(datetime_expression)[0].eval()
        except ParseException as error:
            raise ValueError(error)
    return None
