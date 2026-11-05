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

import dataclasses
import logging
import os
import re
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from operator import attrgetter
from typing import Any, TYPE_CHECKING

from dateutil.relativedelta import relativedelta
from flask import current_app
from flask_babel import gettext as _, ngettext

from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    QueryObjectValidationError,
    SupersetErrorException,
    SupersetSecurityException,
)
from superset.extensions import db, feature_flag_manager, security_manager
from superset.utils import json

if TYPE_CHECKING:
    from superset.connectors.sqla.models import SqlaTable
    from superset.explorables.base import Explorable
    from superset.models.dashboard import Dashboard

logger = logging.getLogger(__name__)

FEATURE_FLAG = "TIME_RANGE_LIMITS"
TIME_RANGE_LIMITS_KEY = "time_range_limits"

RULES = ("max_span", "max_look_back", "max_look_forward")
_KEYS = frozenset({"schema_version", *RULES})
_MAX_QUANTITY = 9999
# Superset's two legacy fractional grains, mapped as its migration 32646df09c64 does.
_ALIASES = {"PT0.5H": "PT30M", "P0.25Y": "P3M"}
_QUARTER = "P3M"
_GRAIN = re.compile(r"P([1-9][0-9]*)([DWMY])|PT([1-9][0-9]*)([HMS])")
_DAY_UNITS = {"D": "day", "W": "week", "M": "month", "Y": "year"}
_SUB_DAY_UNITS = {"H": "hour", "M": "minute", "S": "second"}
_SLACK = timedelta(seconds=1)
_UNIT_MEASURE = {
    "second": ("seconds", 1),
    "minute": ("seconds", 60),
    "hour": ("seconds", 3600),
    "day": ("days", 1),
    "week": ("days", 7),
    "month": ("months", 1),
    "year": ("months", 12),
}
_OFFSETS: dict[str, Callable[[int], relativedelta | timedelta]] = {
    "day": lambda n: relativedelta(days=n),
    "week": lambda n: relativedelta(weeks=n),
    "month": lambda n: relativedelta(months=n),
    "quarter": lambda n: relativedelta(months=3 * n),
    "year": lambda n: relativedelta(years=n),
    "hour": lambda n: timedelta(hours=n),
    "minute": lambda n: timedelta(minutes=n),
    "second": lambda n: timedelta(seconds=n),
}
_UNIT_NAMES: dict[str, Callable[[int], str]] = {
    "day": lambda n: ngettext("%(num)s day", "%(num)s days", n),
    "week": lambda n: ngettext("%(num)s week", "%(num)s weeks", n),
    "month": lambda n: ngettext("%(num)s month", "%(num)s months", n),
    "quarter": lambda n: ngettext("%(num)s quarter", "%(num)s quarters", n),
    "year": lambda n: ngettext("%(num)s year", "%(num)s years", n),
    "hour": lambda n: ngettext("%(num)s hour", "%(num)s hours", n),
    "minute": lambda n: ngettext("%(num)s minute", "%(num)s minutes", n),
    "second": lambda n: ngettext("%(num)s second", "%(num)s seconds", n),
}


class TimeRangeLimitsInvalidError(ValueError):
    """
    A time range limits policy, or the JSON holding it, is not valid.

    ``field`` is the path of the bad field (e.g. ``"max_span.quantity"``), or
    ``None`` when the whole object is wrong.
    """

    def __init__(self, message: str, field: str | None = None) -> None:
        super().__init__(message)
        self.field = field


class UnparsableFilterRangeError(QueryObjectValidationError):
    """A time filter's range can't be parsed (e.g. its start is after its end)."""


class TimeRangeLimitError(SupersetErrorException):
    """A query's time range breaks the time range limits that apply to it."""

    status = 400

    def __init__(self, reason_code: str, message: str, extra: dict[str, Any]) -> None:
        super().__init__(
            SupersetError(
                message=message,
                error_type=SupersetErrorType.TIME_RANGE_LIMIT_ERROR,
                level=ErrorLevel.ERROR,
                extra={"reason_code": reason_code, **extra},
            )
        )
        from superset.time_range_limits.telemetry import record_rejection

        record_rejection(self.error)


class TimeRangeLimitsUnavailableError(SupersetErrorException):
    """
    The time range limits that apply to a request can't be loaded, so it fails.

    ``source``, ``field``, ``value`` and ``dataset_id`` name the bad level and
    field; each one that is set is added to ``extra``.
    """

    status = 503

    def __init__(
        self,
        *,
        source: str | None = None,
        field: str | None = None,
        value: Any = None,
        dataset_id: int | None = None,
    ) -> None:
        super().__init__(
            unavailable_error(
                source=source, field=field, value=value, dataset_id=dataset_id
            )
        )
        from superset.time_range_limits.telemetry import record_rejection

        record_rejection(self.error)


def unavailable_error(
    *,
    source: str | None = None,
    field: str | None = None,
    value: Any = None,
    dataset_id: int | None = None,
) -> SupersetError:
    """The error of ``TimeRangeLimitsUnavailableError``, built without counting
    a rejection."""
    details = {
        "source": source,
        "field": field,
        "value": value,
        "dataset_id": dataset_id,
    }
    return SupersetError(
        message=_("Time range limits could not be verified. Retry the request."),
        error_type=SupersetErrorType.TIME_RANGE_LIMIT_ERROR,
        level=ErrorLevel.ERROR,
        extra={
            "reason_code": "POLICY_UNAVAILABLE",
            **{key: item for key, item in details.items() if item is not None},
        },
    )


def without_stored_value(
    error: SupersetError,
    keep_for_level_editor: bool = False,
    dashboard: Dashboard | None = None,
) -> SupersetError:
    """
    ``error`` without the stored ``value`` a ``POLICY_UNAVAILABLE`` error names.
    With ``keep_for_level_editor``, an editor of the level named in
    ``extra.source`` keeps it: an admin for ``global``, an editor of
    ``dashboard`` for ``dashboard`` and of the dataset ``extra.dataset_id`` for
    ``dataset``.
    """
    if not error.extra or "value" not in error.extra:
        return error
    if keep_for_level_editor and _edits_level(error.extra, dashboard):
        return error
    return dataclasses.replace(
        error, extra={key: item for key, item in error.extra.items() if key != "value"}
    )


def _edits_level(extra: dict[str, Any], dashboard: Dashboard | None) -> bool:
    from superset.connectors.sqla.models import SqlaTable

    source = extra.get("source")
    if source == "global":
        return security_manager.is_admin()
    editable: Any = None
    if source == "dashboard":
        editable = dashboard
    elif source == "dataset" and extra.get("dataset_id") is not None:
        editable = db.session.get(SqlaTable, extra["dataset_id"])
    if editable is None:
        return False
    try:
        security_manager.raise_for_editorship(editable)
    except SupersetSecurityException:
        return False
    return True


@dataclass(frozen=True)
class Rule:
    """One rule of a policy: ``quantity`` times the duration of ``time_grain``."""

    quantity: int
    time_grain: str


@dataclass(frozen=True)
class TimeRangeLimits:
    """The rules one level (global, dataset or dashboard) sets."""

    max_span: Rule | None = None
    max_look_back: Rule | None = None
    max_look_forward: Rule | None = None


@dataclass(frozen=True)
class Constraint:
    """A rule together with the level that set it."""

    source: str
    quantity: int
    time_grain: str

    @property
    def length(self) -> tuple[int, str]:
        if (length := _grain_length(self.time_grain)) is None:
            raise TimeRangeLimitsInvalidError(
                f"Time grain {self.time_grain} has no length"
            )
        return length

    @property
    def sub_day(self) -> bool:
        return _UNIT_MEASURE[self.length[1]][0] == "seconds"

    def shift(self, value: datetime, sign: int) -> datetime | None:
        count, unit = self.length
        return _shift(value, sign * count * self.quantity, unit)

    def as_dict(self) -> dict[str, Any]:
        return {
            "quantity": self.quantity,
            "time_grain": self.time_grain,
        }


@dataclass(frozen=True)
class Bound:
    """A look-back or look-forward bound and the constraint that set it."""

    value: datetime
    limit: Constraint

    @property
    def slack(self) -> timedelta:
        return _SLACK if self.limit.sub_day else timedelta(0)


@dataclass(frozen=True)
class ResolvedTimeRangeLimits:
    """
    Limits resolved against one ``now``.

    ``max_span`` holds the span constraint of every level that sets one, in level
    order (global, dataset, dashboard). ``earliest_start`` is the strictest
    look-back bound and ``latest_end`` the strictest (exclusive) look-forward bound.
    ``validate_date_range`` checks a query against these limits.
    """

    max_span: tuple[Constraint, ...] = ()
    earliest_start: Bound | None = None
    latest_end: Bound | None = None


def _grain_length(grain: str) -> tuple[int, str] | None:
    """The length of a time grain as a count and a unit, or ``None`` if it has none."""
    match = _GRAIN.fullmatch(_ALIASES.get(grain, grain))
    if match is None:
        return None
    if match[1]:
        return int(match[1]), _DAY_UNITS[match[2]]
    return int(match[3]), _SUB_DAY_UNITS[match[4]]


def _is_quarter(grain: str) -> bool:
    return _ALIASES.get(grain, grain) == _QUARTER


def _shift(value: datetime, amount: int, unit: str) -> datetime | None:
    """``value`` moved by ``amount`` units, or ``None`` outside the calendar."""
    try:
        return value + _OFFSETS[unit](amount)
    except (ValueError, OverflowError):
        return None


def _registry_time_grain_labels() -> dict[Any, Any]:
    from superset.db_engine_specs.base import builtin_time_grains

    return {**builtin_time_grains, **current_app.config["TIME_GRAIN_ADDONS"]}


def time_grain_labels() -> dict[str, str]:
    """Every grain the registry knows, as ``{value: label}``, eligible or not."""
    return {
        str(grain): str(label)
        for grain, label in _registry_time_grain_labels().items()
        if grain is not None
    }


def get_eligible_time_grains() -> list[tuple[str, str]]:
    """
    The time grains a rule may use, as ``(value, label)``, in the order of the Time
    Grain dropdown.

    That is every builtin grain plus every addon that some engine has an expression
    for, minus the denylist, keeping only grains with a length (whole positive
    simple durations and Superset's two legacy aliases).
    """
    from superset.db_engine_specs.base import BaseEngineSpec, builtin_time_grains

    config = current_app.config
    enabled = {
        grain
        for expressions in config["TIME_GRAIN_ADDON_EXPRESSIONS"].values()
        for grain in expressions
    }
    denylist = set(config["TIME_GRAIN_DENYLIST"])
    labels = _registry_time_grain_labels()
    grains = [
        (grain, label)
        for grain, label in labels.items()
        if grain is not None
        and (grain in builtin_time_grains or grain in enabled)
        and grain not in denylist
        and _grain_length(grain) is not None
    ]
    grains.sort(
        key=lambda item: tuple(
            BaseEngineSpec._sort_time_grains(item, index)  # pylint: disable=protected-access
            for index in range(4)
        )
    )
    return [(str(grain), str(label)) for grain, label in grains]


def _invalid(field: str, message: str) -> TimeRangeLimitsInvalidError:
    return TimeRangeLimitsInvalidError(f"{field}: {message}", field=field)


def parse_rule(name: str, value: Any, eligible: set[str] | None) -> Rule | None:
    if value is None:
        return None
    if not isinstance(value, dict) or set(value) != {"quantity", "time_grain"}:
        raise _invalid(
            name, "must be null or an object with exactly quantity and time_grain"
        )

    quantity = value["quantity"]
    low = 1 if name == "max_span" else 0
    if type(quantity) is not int or not low <= quantity <= _MAX_QUANTITY:
        raise _invalid(
            f"{name}.quantity",
            f"must be a whole number from {low} to {_MAX_QUANTITY}",
        )

    grain = value["time_grain"]
    if not isinstance(grain, str) or (eligible is not None and grain not in eligible):
        raise _invalid(
            f"{name}.time_grain",
            _(
                "Time grain %(value)s is not available. Select a supported unit.",
                value=grain,
            ),
        )
    return Rule(quantity, grain)


def parse_time_range_limits(
    raw: Any, *, check_units: bool = True
) -> TimeRangeLimits | None:
    """
    Validate a policy and return it, or ``None`` when it sets no limit.

    Raises ``TimeRangeLimitsInvalidError`` on anything that is not a valid policy,
    including a time grain that is not in ``get_eligible_time_grains()`` now.
    ``check_units=False`` skips that unit check.
    """
    if raw is None:
        return None
    if not isinstance(raw, dict):
        raise TimeRangeLimitsInvalidError("Time range limits must be an object")
    if missing := [
        f"{name}.{key}"
        for name in RULES
        if isinstance(raw.get(name), dict)
        for key in ("quantity", "time_grain")
        if key not in raw[name]
    ] + sorted(_KEYS - set(raw)):
        raise TimeRangeLimitsInvalidError(
            f"Missing time range limits key(s): {', '.join(missing)}",
            field=missing[0],
        )
    if unknown := sorted(map(str, set(raw) - _KEYS)):
        raise TimeRangeLimitsInvalidError(
            f"Unknown time range limits key(s): {', '.join(unknown)}",
            field=unknown[0],
        )
    version = raw["schema_version"]
    if type(version) is not int or version != 1:
        raise _invalid("schema_version", "must be 1")

    eligible = (
        {value for value, _label in get_eligible_time_grains()} if check_units else None
    )
    limits = TimeRangeLimits(*(parse_rule(name, raw[name], eligible) for name in RULES))
    return limits if limits != TimeRangeLimits() else None


def parse_written_policy(raw: Any) -> TimeRangeLimits | None:
    """
    ``parse_time_range_limits`` for a policy a write carries. With the feature flag
    off nothing is checked and ``None`` is returned: the value is stored as base
    Superset would store it.
    """
    if not feature_flag_manager.is_feature_enabled(FEATURE_FLAG):
        return None
    return parse_time_range_limits(raw)


def validate_extra_time_range_limits(
    extra: str | dict[str, Any] | None,
) -> TimeRangeLimits | None:
    """
    Read the ``time_range_limits`` policy of a dataset ``extra`` a write carries,
    if it has one. Returns ``None`` with the feature flag off, checking nothing.

    Text that is not a JSON object is left alone, as ``extra`` is not validated
    elsewhere, unless it mentions ``time_range_limits``: the query side fails
    closed on that. Raises ``TimeRangeLimitsInvalidError`` on a bad policy.
    """
    if not feature_flag_manager.is_feature_enabled(FEATURE_FLAG):
        return None
    if isinstance(extra, str):
        return load_level(extra, "Dataset extra")
    if isinstance(extra, dict) and TIME_RANGE_LIMITS_KEY in extra:
        return parse_time_range_limits(extra[TIME_RANGE_LIMITS_KEY])
    return None


def load_level(raw: str | None, source: str) -> TimeRangeLimits | None:
    """
    Read the policy from a JSON text column.

    Text that isn't a JSON object sets no limit, unless it mentions
    ``time_range_limits``: then someone tried to set limits, and it raises.
    """
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except (TypeError, ValueError, RecursionError) as ex:
        if TIME_RANGE_LIMITS_KEY in raw:
            raise TimeRangeLimitsInvalidError(f"{source} is not valid JSON") from ex
        return None
    if not isinstance(data, dict):
        if TIME_RANGE_LIMITS_KEY in raw:
            raise TimeRangeLimitsInvalidError(f"{source} is not a JSON object")
        return None
    return parse_time_range_limits(data.get(TIME_RANGE_LIMITS_KEY))


def load_global() -> TimeRangeLimits | None:
    limits = parse_time_range_limits(current_app.config["TIME_RANGE_LIMITS_GLOBAL"])
    if (
        limits is not None
        and limits.max_look_back is not None
        and limits.max_look_forward is not None
        and limits.max_look_back.quantity == 0
        and limits.max_look_forward.quantity == 0
    ):
        raise TimeRangeLimitsInvalidError(
            "TIME_RANGE_LIMITS_GLOBAL: max_look_back and max_look_forward can't "
            "both be 0"
        )
    return limits


def stored_limits(text: str | None) -> dict[str, Any] | None:
    """
    The raw ``time_range_limits`` object of a stored JSON text column, or
    ``None``. Never validated: a stored unit may have been denylisted since.
    """
    if not text:
        return None
    try:
        data = json.loads(text)
    except (TypeError, ValueError, RecursionError):
        return None
    value = data.get(TIME_RANGE_LIMITS_KEY) if isinstance(data, dict) else None
    return value if isinstance(value, dict) else None


def limits_errors(prefix: str, errors: dict[str, list[str]]) -> dict[str, list[str]]:
    """Errors of ``check_stricter_than_global``, keyed by ``prefix.<path>``."""
    return {f"{prefix}.{path}": messages for path, messages in errors.items()}


def limits_shape_error(
    prefix: str, ex: TimeRangeLimitsInvalidError
) -> dict[str, list[str]]:
    """A ``parse_time_range_limits`` error, keyed by the path of the bad field."""
    return {f"{prefix}.{ex.field}" if ex.field is not None else prefix: [str(ex)]}


def _changed(policy: TimeRangeLimits, stored: dict[str, Any] | None, rule: str) -> bool:
    value = getattr(policy, rule)
    return stored is None or stored.get(rule) != (
        dataclasses.asdict(value) if value is not None else None
    )


# Shortest and longest number of days in 0..11 consecutive months, over any start
# date; a run of years counts 365 days each for the shortest and 366 for the longest.
_MIN_DAYS = (0, 28, 59, 89, 120, 150, 181, 212, 242, 273, 303, 334)
_MAX_DAYS = (0, 31, 62, 92, 123, 153, 184, 215, 245, 276, 306, 337)


def _min_days(months: int) -> int:
    years, rest = divmod(months, 12)
    return 365 * years + _MIN_DAYS[rest]


def _max_days(months: int) -> int:
    years, rest = divmod(months, 12)
    return 366 * years + _MAX_DAYS[rest]


def _measure(rule: Rule) -> tuple[str, int] | None:
    """A rule's length in seconds, days or months, or ``None`` if it has none."""
    if (length := _grain_length(rule.time_grain)) is None:
        return None
    count, unit = length
    kind, size = _UNIT_MEASURE[unit]
    return kind, count * rule.quantity * size


def _same_family(value: Rule, limit: Rule) -> bool:
    """Whether both rules are sub-day, or both a day or longer."""
    return _grain_sub_day(value.time_grain) == _grain_sub_day(limit.time_grain)


def _grain_sub_day(grain: str) -> bool:
    """Whether a time grain is shorter than a day; ``False`` if it has no length."""
    length = _grain_length(grain)
    return length is not None and _UNIT_MEASURE[length[1]][0] == "seconds"


def never_longer(value: Rule, limit: Rule) -> bool:
    """
    Whether ``value`` is never longer than ``limit``, whatever the calendar.
    A sub-day rule and a day-or-longer one never compare: look-back and
    look-forward anchor them differently (``now`` vs midnight).
    """
    value_measure, limit_measure = _measure(value), _measure(limit)
    if value_measure is None or limit_measure is None:
        return False
    value_kind, value_amount = value_measure
    limit_kind, limit_amount = limit_measure
    if value_kind == limit_kind:
        return value_amount <= limit_amount
    if "seconds" in (value_kind, limit_kind):
        return False
    longest = _max_days(value_amount) if value_kind == "months" else value_amount
    shortest = _min_days(limit_amount) if limit_kind == "months" else limit_amount
    return longest <= shortest


def _override_field(value: Rule, limit: Rule) -> str | None:
    """
    The field of ``value`` that makes it looser than ``limit``: ``"quantity"`` in
    the same unit family, else ``"time_grain"``; ``None`` when it isn't looser.
    """
    if never_longer(value, limit):
        return None
    return "quantity" if _same_family(value, limit) else "time_grain"


def _looser_message(rule: str, level: str, limit: str) -> str:
    if level == "dashboard":
        if rule == "max_span":
            return _("Dashboard maximum span must be %(limit)s or less.", limit=limit)
        if rule == "max_look_back":
            return _(
                "Dashboard maximum look-back must be %(limit)s or less.", limit=limit
            )
        return _(
            "Dashboard maximum look-forward must be %(limit)s or less.", limit=limit
        )
    if rule == "max_span":
        return _("Dataset maximum span must be %(limit)s or less.", limit=limit)
    if rule == "max_look_back":
        return _("Dataset maximum look-back must be %(limit)s or less.", limit=limit)
    return _("Dataset maximum look-forward must be %(limit)s or less.", limit=limit)


def _looser_than(
    rule: str, value: Rule, limit: Rule, level: str
) -> tuple[str, str] | None:
    if (field := _override_field(value, limit)) is None:
        return None
    message = _looser_message(
        rule,
        level,
        _describe_limit(Constraint("global", limit.quantity, limit.time_grain)),
    )
    if field == "time_grain":
        hint = (
            _("Use a unit shorter than a day.")
            if _grain_sub_day(limit.time_grain)
            else _("Use a unit of a day or longer.")
        )
        message = f"{message} {hint}"
    return f"{rule}.{field}", message


def _is_zero(*rules: Rule | None) -> bool:
    return any(rule is not None and rule.quantity == 0 for rule in rules)


def check_stricter_than_global(
    policy: TimeRangeLimits | None, stored: dict[str, Any] | None, level: str
) -> dict[str, list[str]]:
    """
    Check that a dashboard or dataset policy only tightens the global one.

    Returns messages by field path within the policy (e.g. ``"max_span.quantity"``),
    empty when the policy is fine. Only rules that differ from ``stored`` (the raw
    stored policy) are checked, so a value a later global change made looser
    doesn't block unrelated edits. ``level`` is ``"dashboard"`` or ``"dataset"``.
    Returns ``{}`` when the feature flag is off. Raises
    ``TimeRangeLimitsUnavailableError`` when the global policy is invalid and a rule
    changed.
    """
    if not feature_flag_manager.is_feature_enabled(FEATURE_FLAG) or policy is None:
        return {}
    if not (changed := {rule for rule in RULES if _changed(policy, stored, rule)}):
        return {}
    try:
        global_limits = load_global() or TimeRangeLimits()
    except TimeRangeLimitsInvalidError as ex:
        from superset.time_range_limits.telemetry import known_field

        raise TimeRangeLimitsUnavailableError(
            source="global", field=known_field(ex.field)
        ) from ex

    errors: dict[str, list[str]] = {}
    for rule in sorted(changed, key=RULES.index):
        value, limit = getattr(policy, rule), getattr(global_limits, rule)
        if value is not None and limit is not None:
            if error := _looser_than(rule, value, limit, level):
                errors.setdefault(error[0], []).append(error[1])

    if (
        changed & {"max_look_back", "max_look_forward"}
        and _is_zero(global_limits.max_look_back, policy.max_look_back)
        and _is_zero(global_limits.max_look_forward, policy.max_look_forward)
    ):
        errors.setdefault("max_look_forward.quantity", []).append(
            _("Look-back and look-forward can't both be 0: no time range would fit.")
        )
    return errors


def stricter_errors(
    policy: TimeRangeLimits | None,
    level: str,
    find_stored: Callable[[], dict[str, Any] | None],
) -> dict[str, list[str]]:
    """
    ``check_stricter_than_global`` errors of a policy whose stored value is only
    looked up on errors: a stored value can only remove errors. ``find_stored``
    returns the raw stored policy, or ``None`` when there is no stored row.
    """
    if errors := check_stricter_than_global(policy, None, level):
        if (stored := find_stored()) is not None:
            errors = check_stricter_than_global(policy, stored, level)
    return errors


def policy_errors(
    read: Callable[[], TimeRangeLimits | None],
    stored: dict[str, Any] | None,
    level: str,
    prefix: str,
) -> tuple[dict[str, list[str]], dict[str, list[str]], TimeRangeLimits | None]:
    """
    Read a proposed policy and check it against the global one. Returns the shape
    errors (``read`` raised), the ``check_stricter_than_global`` errors and the
    policy, keyed by ``prefix.<path>``. The two kinds stay apart, as callers answer
    them with different status codes.
    """
    try:
        policy = read()
    except TimeRangeLimitsInvalidError as ex:
        return limits_shape_error(prefix, ex), {}, None
    errors = check_stricter_than_global(policy, stored, level)
    return {}, limits_errors(prefix, errors), policy


def json_text_limits_errors(
    text: str, stored: dict[str, Any] | None, level: str, prefix: str
) -> dict[str, list[str]]:
    """
    Shape and ``check_stricter_than_global`` errors of the policy in a JSON text
    column, keyed by ``prefix.<path>``. Text that isn't a JSON object has no policy.
    Empty with the feature flag off.
    """
    try:
        data = json.loads(text)
    except (TypeError, ValueError, RecursionError):
        return {}
    raw = data.get(TIME_RANGE_LIMITS_KEY) if isinstance(data, dict) else None
    shape, errors, _policy = policy_errors(
        lambda: parse_written_policy(raw), stored, level, prefix
    )
    return shape or errors


def midnight(value: datetime) -> datetime:
    return value.replace(hour=0, minute=0, second=0, microsecond=0)


def _look_back_bound(limit: Constraint, now: datetime) -> Bound | None:
    anchor = now.replace(microsecond=0) if limit.sub_day else midnight(now)
    value = limit.shift(anchor, -1)
    return Bound(value, limit) if value is not None else None


def _look_forward_bound(limit: Constraint, now: datetime) -> Bound | None:
    if limit.sub_day:
        value = limit.shift(now.replace(microsecond=0), 1)
    elif (end := limit.shift(midnight(now), 1)) is not None:
        value = _shift(end, 1, "day")
    else:
        value = None
    return Bound(value, limit) if value is not None else None


def get_effective_time_range_limits(
    datasource: Explorable,
    now: datetime,
    dashboard: Dashboard | None = None,
) -> ResolvedTimeRangeLimits | None:
    """
    Merge the global, dataset and dashboard limits that apply to a request.

    Every level is resolved against the same ``now``. The span of every level is
    kept, in level order, and all of them are checked. For look-back and
    look-forward the strictest bound wins, a tie keeping the lower level. So a
    dataset or dashboard can tighten the limits but never loosen or remove them.
    Returns ``None`` when no level sets a rule. Raises
    ``TimeRangeLimitsInvalidError`` if any level is invalid, so callers can fail
    closed. The feature flag is the caller's concern.
    """
    from superset.connectors.sqla.models import SqlaTable

    levels: list[tuple[str, TimeRangeLimits | None]] = [("global", load_global())]
    if isinstance(datasource, SqlaTable):
        levels.append(("dataset", load_level(datasource.extra, "Dataset extra")))
    if dashboard is not None:
        levels.append(
            (
                "dashboard",
                load_level(dashboard.json_metadata, "Dashboard json_metadata"),
            )
        )
    return resolve_time_range_limits(levels, now)


def resolve_time_range_limits(
    levels: Sequence[tuple[str, TimeRangeLimits | None]], now: datetime
) -> ResolvedTimeRangeLimits | None:
    """
    Merge already-loaded levels, each ``(source, policy or None)`` in level order
    (global, dataset, dashboard), as ``get_effective_time_range_limits`` does.
    Returns ``None`` when no level sets a rule.
    """
    set_levels = [(source, limits) for source, limits in levels if limits is not None]
    if not set_levels:
        return None

    def constraints(rule: str) -> list[Constraint]:
        return [
            Constraint(source, value.quantity, value.time_grain)
            for source, limits in set_levels
            if (value := getattr(limits, rule)) is not None
        ]

    look_back = [
        bound
        for limit in constraints("max_look_back")
        if (bound := _look_back_bound(limit, now)) is not None
    ]
    look_forward = [
        bound
        for limit in constraints("max_look_forward")
        if (bound := _look_forward_bound(limit, now)) is not None
    ]
    # max/min return the first of equal values, so a tie keeps the lower level.
    return ResolvedTimeRangeLimits(
        max_span=tuple(constraints("max_span")),
        earliest_start=max(look_back, key=attrgetter("value"), default=None),
        latest_end=min(look_forward, key=attrgetter("value"), default=None),
    )


def _whole_days(delta: timedelta) -> int:
    return -(-delta // timedelta(days=1))


def _binding_span(
    since: datetime, max_span: tuple[Constraint, ...]
) -> tuple[Constraint, datetime] | None:
    """
    Return the span constraint that binds and the latest end it allows.

    That is the one with the earliest ``since + duration``; a tie keeps the
    first, which is the lower level. A constraint whose end would fall after
    year 9999 can't bind.
    """
    binding: tuple[Constraint, datetime] | None = None
    for limit in max_span:
        end = limit.shift(since, 1)
        if end is not None and (binding is None or end < binding[1]):
            binding = (limit, end)
    return binding


def _fits(since: datetime, until: datetime, amount: int, unit: str) -> bool:
    end = _shift(since, amount, unit)
    return end is not None and end <= until


def _length_unit(limit: Constraint) -> str:
    return "quarter" if _is_quarter(limit.time_grain) else limit.length[1]


def _describe_limit(limit: Constraint) -> str:
    if _is_quarter(limit.time_grain):
        return _UNIT_NAMES["quarter"](limit.quantity)
    count, unit = limit.length
    return _UNIT_NAMES[unit](count * limit.quantity)


def _describe_length(since: datetime, until: datetime, unit: str) -> str:
    """
    Describe ``until - since`` in ``unit``. Sub-day and day units count whole
    units, rounded up. Longer units count whole units forward from ``since``,
    then the rest in days, rounded up.

    The calendar month difference plus one is an upper bound on that count, so
    it only ever steps down.
    """
    if unit in _SUB_DAY_UNITS.values():
        step = timedelta(**{f"{unit}s": 1})
        return _UNIT_NAMES[unit](-(-(until - since) // step))
    if unit == "day":
        return _UNIT_NAMES["day"](_whole_days(until - since))
    if unit == "week":
        count = (until - since).days // 7
    else:
        months = (until.year - since.year) * 12 + until.month - since.month + 1
        count = months // {"month": 1, "quarter": 3, "year": 12}[unit]
    while count > 0 and not _fits(since, until, count, unit):
        count -= 1
    units = _UNIT_NAMES[unit](count)
    end = _shift(since, count, unit)
    rest = _whole_days(until - end) if end is not None else 0
    if not rest:
        return units
    return _("%(units)s and %(days)s", units=units, days=_UNIT_NAMES["day"](rest))


def _format_date(value: datetime) -> str:
    return f"{value:%b} {value.day}, {value.year}"


def _format_bound(value: datetime, limit: Constraint) -> str:
    if not limit.sub_day:
        return _format_date(value)
    time_format = "%H:%M:%S" if limit.length[1] == "second" or value.second else "%H:%M"
    return f"{_format_date(value)} {value.strftime(time_format)}"


def _describe_start(bound: Bound) -> str:
    limit = bound.limit
    if limit.quantity == 0:
        return _("now") if limit.sub_day else _("today")
    ago = _("%(duration)s ago", duration=_describe_limit(limit))
    return f"{_format_bound(bound.value, limit)} ({ago})"


def _describe_end(bound: Bound) -> str:
    limit = bound.limit
    if limit.quantity == 0:
        return _("now") if limit.sub_day else _("today")
    # A day-or-longer bound is the exclusive midnight, so show the last allowed day.
    value = bound.value if limit.sub_day else bound.value - timedelta(days=1)
    from_now = _("%(duration)s from now", duration=_describe_limit(limit))
    return f"{_format_bound(value, limit)} ({from_now})"


def _iso(value: datetime | None) -> str | None:
    """A naive server-local datetime as ISO 8601 with the server's UTC offset."""
    if value is None:
        return None
    try:
        aware = value.astimezone()
        if aware.replace(tzinfo=None) != value:
            # A wall time in the spring-forward gap. Python 3.11 swaps the two
            # candidate instants; pick them as Python 3.12 does (gh-83861):
            # fold=0 -> the later instant, fold=1 -> the earlier.
            other = value.replace(fold=1 - value.fold).astimezone()
            aware = (min if value.fold else max)(aware, other)
        return aware.isoformat()
    except (ValueError, OverflowError):
        # Near year 1 or 9999 the local offset can't be computed.
        return value.isoformat()


def server_timezone(now: datetime) -> str:
    """
    The server's time zone, as a label to show: ``TZ`` when it is set (an IANA
    name), else the abbreviation of ``now``'s local offset (``CET``, ``CEST``).
    """
    return os.environ.get("TZ") or now.astimezone().tzname() or ""


def _unbounded_message(
    since: datetime | None, dashboard_id: int | None, filter_preview: bool = False
) -> str:
    if dashboard_id is not None and not filter_preview:
        return _(
            "This chart requires a bounded time range. Ask a dashboard editor to "
            "add or scope a time range filter."
        )
    if since is not None:
        return _("An end date is required.")
    return _("Choose a start and an end date. Time range limits are on.")


@dataclass(frozen=True)
class DateRangeFailure:
    """
    Why a time range breaks the limits: what ``validate_date_range`` raises, as
    data. ``message`` is the error's translated message.
    """

    reason_code: str
    rule: str | None
    source: str | None
    message: str
    limit: Constraint | None


def date_range_failure(
    since: datetime | None,
    until: datetime | None,
    limits: ResolvedTimeRangeLimits,
    *,
    time_offset: str | None = None,
    dashboard_id: int | None = None,
    filter_preview: bool = False,
) -> DateRangeFailure | None:
    """
    The first way one time range breaks resolved limits, or ``None`` when it
    fits. Same checks, order and message as ``validate_date_range``, but builds
    no error. Raises ``ValueError`` when ``since > until``, before any other
    check. ``filter_preview`` marks a new native filter's preview in the filter
    settings, which gets the editor's open-range message even with a dashboard.
    """
    if since is not None and until is not None and since > until:
        raise ValueError("since must not be later than until")

    reason: str | None = None
    message = ""
    rule: str | None = None
    limit: Constraint | None = None
    binding = (
        _binding_span(since, limits.max_span)
        if since is not None and until is not None
        else None
    )
    start, end = limits.earliest_start, limits.latest_end
    if start is not None and end is not None and start.value >= end.value:
        reason = "NO_VALID_RANGE"
        message = _(
            "No time range fits the limits: the earliest start (%(earliest)s) is not "
            "before the latest end (%(latest)s). Ask an editor or admin to fix the "
            "limits.",
            earliest=_describe_start(start),
            latest=_describe_end(end),
        )
    elif since is None or until is None:
        reason = "UNBOUNDED_RANGE"
        message = _unbounded_message(since, dashboard_id, filter_preview)
    elif binding is not None and until > binding[1]:
        reason, rule = "MAX_SPAN_EXCEEDED", "max_span"
        limit = binding[0]
        message = _(
            "Range can't be longer than %(limit)s. This one is %(length)s.",
            limit=_describe_limit(limit),
            length=_describe_length(since, until, _length_unit(limit)),
        )
    elif start is not None and since < start.value - start.slack:
        reason, rule = "MAX_LOOK_BACK_EXCEEDED", "max_look_back"
        limit = start.limit
        message = _(
            "Start can't be earlier than %(date)s.", date=_describe_start(start)
        )
    elif end is not None and until > end.value + end.slack:
        reason, rule = "MAX_LOOK_FORWARD_EXCEEDED", "max_look_forward"
        limit = end.limit
        message = _("End can't be later than %(date)s.", date=_describe_end(end))

    if reason is None:
        return None
    if time_offset is not None:
        message = _(
            'Time comparison "%(offset)s": %(message)s',
            offset=time_offset,
            message=message,
        )
    return DateRangeFailure(
        reason_code=reason,
        rule=rule,
        source=limit.source if limit is not None else None,
        message=message,
        limit=limit,
    )


def validate_date_range(
    since: datetime | None,
    until: datetime | None,
    limits: ResolvedTimeRangeLimits,
    *,
    time_offset: str | None = None,
    dashboard_id: int | None = None,
    filter_preview: bool = False,
    timezone: str | None,
) -> None:
    """
    Check one time range against resolved limits. Never reads the clock.

    Raises ``ValueError`` when ``since > until``, before any other check. Then
    raises ``TimeRangeLimitError`` on the first failure, in this order: impossible
    policy, open range, range too long, starts too early, ends too late. A range is
    too long when ``until > since + duration`` for the binding span, the one with
    the earliest ``since + duration``. An open range fails even when ``limits``
    sets no limit. ``until`` may equal ``latest_end``, as that bound is exclusive.
    Sub-day bounds allow one more second either way.
    ``time_offset`` names a time comparison range, for the message and ``extra``
    only. ``dashboard_id`` is the request's verified dashboard, for the message
    and ``extra``; ``timezone`` is the server's, for ``extra`` only.
    ``filter_preview`` is as in ``date_range_failure``, for the message only.
    """
    failure = date_range_failure(
        since,
        until,
        limits,
        time_offset=time_offset,
        dashboard_id=dashboard_id,
        filter_preview=filter_preview,
    )
    if failure is None:
        return
    raise TimeRangeLimitError(
        failure.reason_code,
        failure.message,
        {
            "rule": failure.rule,
            "source": failure.source,
            "limit": failure.limit.as_dict() if failure.limit is not None else None,
            "actual": {"start": _iso(since), "end": _iso(until)},
            "timezone": timezone,
            "dashboard_id": dashboard_id,
            "filter_id": None,
            "time_offset": time_offset,
        },
    )


def _value_at(raw: Any, field: str | None) -> Any:
    """The string or number at the dotted ``field`` of ``raw``, else ``None``."""
    if field is None:
        return None
    value = raw
    for key in field.split("."):
        if not isinstance(value, dict) or key not in value:
            return None
        value = value[key]
    if isinstance(value, bool) or not isinstance(value, (str, int, float)):
        return None
    return value


def checked_policy(
    source: str,
    raw: Any,
    load: Callable[[], TimeRangeLimits | None],
    dataset_id: int | None = None,
) -> TimeRangeLimits | None:
    """``load()``, failing closed with the bad level and field named in the error."""
    try:
        return load()
    except TimeRangeLimitsInvalidError as ex:
        raise TimeRangeLimitsUnavailableError(
            source=source,
            field=ex.field,
            value=_value_at(raw, ex.field),
            dataset_id=dataset_id,
        ) from ex


def load_global_limits() -> TimeRangeLimits | None:
    return checked_policy(
        "global", current_app.config["TIME_RANGE_LIMITS_GLOBAL"], load_global
    )


def load_dataset_limits(dataset: Any) -> TimeRangeLimits | None:
    return checked_policy(
        "dataset",
        stored_limits(dataset.extra),
        lambda: load_level(dataset.extra, "Dataset extra"),
        dataset.id,
    )


def policy_as_dict(limits: TimeRangeLimits | None) -> dict[str, Any]:
    """A policy's rules as the API returns them, all ``None`` when unset."""
    return dataclasses.asdict(limits or TimeRangeLimits())


def effective_rule(
    global_rule: Rule | None, dashboard_rule: Rule | None
) -> dict[str, Any]:
    """
    The constraints a global and a dashboard rule enforce together, with a label.
    When one rule is never longer than the other only that one is kept, a tie
    keeping the global one; otherwise both are kept.
    """
    rules = [
        Constraint(source, rule.quantity, rule.time_grain)
        for source, rule in (("global", global_rule), ("dashboard", dashboard_rule))
        if rule is not None
    ]
    if global_rule is not None and dashboard_rule is not None:
        if never_longer(global_rule, dashboard_rule):
            rules = rules[:1]
        elif never_longer(dashboard_rule, global_rule):
            rules = rules[1:]
    if not rules:
        label = _("No limit")
    elif len(rules) == 1:
        label = _describe_limit(rules[0])
    else:
        label = _(
            "%(global)s and %(dashboard)s; both enforced",
            **{
                "global": _describe_limit(rules[0]),
                "dashboard": _describe_limit(rules[1]),
            },
        )
    return {
        "constraints": [{"source": rule.source, **rule.as_dict()} for rule in rules],
        "display_label": label,
    }


def needs_review(
    global_limits: TimeRangeLimits | None, dashboard_limits: TimeRangeLimits | None
) -> list[dict[str, str]]:
    """The dashboard rules the global one overrides, with the reason."""
    review: list[dict[str, str]] = []
    for rule in RULES:
        value = getattr(dashboard_limits or TimeRangeLimits(), rule)
        limit = getattr(global_limits or TimeRangeLimits(), rule)
        if value is None or limit is None:
            continue
        if (field := _override_field(value, limit)) is None:
            continue
        reason = "LOOSER_THAN_GLOBAL" if field == "quantity" else "UNIT_MISMATCH"
        review.append({"rule": rule, "reason": reason})
    return review


def global_limits_payload() -> dict[str, Any]:
    """
    The global policy, a display label per rule (``None`` when unset) and the
    time grains a rule may use.
    """
    global_limits = load_global_limits()
    display_labels: dict[str, str | None] = {}
    for name in RULES:
        rule = getattr(global_limits or TimeRangeLimits(), name)
        display_labels[name] = (
            None
            if rule is None
            else _describe_limit(Constraint("global", rule.quantity, rule.time_grain))
        )
    return {
        "schema_version": 1,
        "revision": 0,
        "policy": policy_as_dict(global_limits),
        "display_labels": display_labels,
        "eligible_time_grains": [
            {"value": value, "label": label}
            for value, label in get_eligible_time_grains()
        ],
    }


def _can_read_dashboard_dataset(dataset: SqlaTable, dashboard: Dashboard) -> bool:
    """Use member-chart guest grants while preserving standalone user access."""
    if not security_manager.is_guest_user():
        return security_manager.can_access_datasource(dataset)
    return any(
        chart.datasource_id == dataset.id
        and chart.datasource_type == dataset.type
        and security_manager.can_access_dashboard_chart_labels(dashboard, chart)
        for chart in dashboard.slices
    )


def dashboard_limits_payload(
    dashboard: Dashboard, now: datetime, *, keep_for_level_editor: bool = True
) -> dict[str, Any]:
    """
    The global and dashboard policies, what they enforce together, the policies
    of the dashboard's chart datasets that set one, the server's time zone and
    the time grains a rule may use.
    """
    from superset.connectors.sqla.models import SqlaTable
    from superset.time_range_limits.notice import editor_notice

    global_limits = load_global_limits()
    dashboard_limits = checked_policy(
        "dashboard",
        stored_limits(dashboard.json_metadata),
        lambda: load_level(dashboard.json_metadata, "Dashboard json_metadata"),
    )
    tables = sorted(
        (ds for ds in dashboard.datasources if isinstance(ds, SqlaTable)),
        key=attrgetter("id"),
    )
    datasets = []
    for table in tables:
        if not _can_read_dashboard_dataset(table, dashboard):
            continue
        try:
            limits = load_dataset_limits(table)
        except TimeRangeLimitsUnavailableError as ex:
            datasets.append(
                {
                    "id": table.id,
                    "name": table.table_name,
                    "policy": None,
                    "error": without_stored_value(
                        ex.error, keep_for_level_editor=keep_for_level_editor
                    ).to_dict(),
                }
            )
        else:
            if limits is not None:
                datasets.append(
                    {
                        "id": table.id,
                        "name": table.table_name,
                        "policy": policy_as_dict(limits),
                    }
                )
    effective = {
        rule: effective_rule(
            getattr(global_limits or TimeRangeLimits(), rule),
            getattr(dashboard_limits or TimeRangeLimits(), rule),
        )
        for rule in RULES
    }
    return {
        "schema_version": 1,
        "global_revision": 0,
        "global": policy_as_dict(global_limits),
        "dashboard": policy_as_dict(dashboard_limits),
        "effective": {
            "active": any(item["constraints"] for item in effective.values()),
            **effective,
        },
        "needs_review": needs_review(global_limits, dashboard_limits),
        "datasets": datasets,
        "timezone": server_timezone(now),
        "eligible_time_grains": [
            {"value": value, "label": label}
            for value, label in get_eligible_time_grains()
        ],
        "time_grain_labels": time_grain_labels(),
        "editor_notice": editor_notice(dashboard, global_limits),
    }


def dataset_limits_payload(table: SqlaTable) -> dict[str, Any]:
    """
    The global and dataset policies, the dataset rules the global one overrides
    and the time grains a rule may use.
    """
    global_limits = load_global_limits()
    dataset_limits = load_dataset_limits(table)
    return {
        "schema_version": 1,
        "global_revision": 0,
        "global": policy_as_dict(global_limits),
        "dataset": policy_as_dict(dataset_limits),
        "needs_review": needs_review(global_limits, dataset_limits),
        "eligible_time_grains": [
            {"value": value, "label": label}
            for value, label in get_eligible_time_grains()
        ],
        "time_grain_labels": time_grain_labels(),
    }


def explore_limits_payload(datasource: Explorable, now: datetime) -> dict[str, Any]:
    """
    The global policy, the policy of the dataset Explore opened, and the server's
    time zone.
    """
    from superset.connectors.sqla.models import SqlaTable

    return {
        "schema_version": 1,
        "global": policy_as_dict(load_global_limits()),
        "dataset": (
            policy_as_dict(load_dataset_limits(datasource))
            if isinstance(datasource, SqlaTable)
            else None
        ),
        "timezone": server_timezone(now),
    }


def check_restored_limits(
    restored: str | None, live: str | None, level: str, prefix: str
) -> None:
    """
    Raise ``TimeRangeLimitsRestoreError`` when the ``restored`` JSON text
    (dashboard ``json_metadata`` or dataset ``extra``) has a bad policy, or one
    looser than the global policy unless unchanged from the ``live`` text read
    under the row lock. Raises ``TimeRangeLimitsUnavailableError`` as
    ``check_stricter_than_global`` does. Checks nothing while the feature flag
    is off: the user sends no value, so there is no shape check to keep.
    """
    if not feature_flag_manager.is_feature_enabled(FEATURE_FLAG):
        return
    from marshmallow import ValidationError

    from superset.commands.exceptions import TimeRangeLimitsRestoreError

    stored = stored_limits(live)
    shape, errors, _policy = policy_errors(
        lambda: load_level(restored, prefix), stored, level, prefix
    )
    if shape or errors:
        raise TimeRangeLimitsRestoreError(exceptions=[ValidationError(shape or errors)])
