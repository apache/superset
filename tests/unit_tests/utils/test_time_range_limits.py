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
# pylint: disable=import-outside-toplevel, invalid-name, unused-argument, redefined-outer-name, too-many-lines
import os
import time
from calendar import monthrange
from collections.abc import Iterator
from datetime import datetime, timedelta
from typing import Any
from unittest.mock import patch, PropertyMock

import pytest
from flask import current_app
from freezegun import freeze_time
from pytest_mock import MockerFixture

from superset.time_range_limits.policy import (
    FEATURE_FLAG,
    ResolvedTimeRangeLimits,
    TimeRangeLimitsUnavailableError,
)
from superset.utils import json
from tests.fixtures.time_range_policy import ALIAS_ADDONS

NOW = datetime(2026, 10, 16, 14, 30)
DEEPLY_NESTED_JSON = "[" * 1100 + "]" * 1100
HUGE_INTEGER_JSON = '{"a": ' + "1" * 4301 + "}"
DEFAULT_GRAINS = [
    "PT1S",
    "PT5S",
    "PT30S",
    "PT1M",
    "PT5M",
    "PT10M",
    "PT15M",
    "PT30M",
    "PT1H",
    "PT6H",
    "P1D",
    "P1W",
    "P1M",
    "P3M",
    "P1Y",
]
# Superset's legacy aliases, enabled as addons.

Rule = tuple[int, str]


def policy(
    max_span: Rule | None = None,
    max_look_back: Rule | None = None,
    max_look_forward: Rule | None = None,
) -> dict[str, Any]:
    def rule(value: Rule | None) -> dict[str, Any] | None:
        if value is None:
            return None
        return {"quantity": value[0], "time_grain": value[1]}

    return {
        "schema_version": 1,
        "max_span": rule(max_span),
        "max_look_back": rule(max_look_back),
        "max_look_forward": rule(max_look_forward),
    }


DEFAULT_POLICY = policy((90, "P1D"), (13, "P1M"), (0, "P1D"))


@pytest.fixture(autouse=True)
def dst_rows_in_warsaw(request: pytest.FixtureRequest) -> Iterator[None]:
    callspec = getattr(request.node, "callspec", None)
    if callspec is None or not callspec.id.startswith("dst"):
        yield
        return
    old_tz = os.environ.get("TZ")
    old_names = time.tzname
    os.environ["TZ"] = "Europe/Warsaw"
    time.tzset()
    assert time.tzname == ("CET", "CEST")
    yield
    if old_tz is None:
        del os.environ["TZ"]
    else:
        os.environ["TZ"] = old_tz
    time.tzset()
    assert time.tzname == old_names


def sqla_table(extra: Any) -> Any:
    from superset.connectors.sqla.models import SqlaTable

    if extra is not None and not isinstance(extra, str):
        extra = json.dumps(extra)
    return SqlaTable(table_name="t", extra=extra)


def dataset_with(limits: Any) -> Any:
    return sqla_table({"time_range_limits": limits})


def dashboard_with(limits: Any) -> Any:
    from superset.models.dashboard import Dashboard

    return Dashboard(json_metadata=json.dumps({"time_range_limits": limits}))


def set_global(mocker: MockerFixture, limits: Any) -> None:
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": limits})


def resolve(
    global_policy: Any = None,
    dataset: Any = None,
    dashboard: Any = None,
    now: datetime = NOW,
) -> Any:
    from superset.time_range_limits.policy import get_effective_time_range_limits

    with patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": global_policy}):
        return get_effective_time_range_limits(
            dataset_with(dataset) if dataset is not None else sqla_table(None),
            now,
            dashboard_with(dashboard) if dashboard is not None else None,
        )


def constraint(source: str, quantity: int, time_grain: str) -> Any:
    from superset.time_range_limits.policy import Constraint

    return Constraint(source, quantity, time_grain)


def bound(value: datetime, source: str, quantity: int, time_grain: str) -> Any:
    from superset.time_range_limits.policy import Bound

    return Bound(value, constraint(source, quantity, time_grain))


def limit_error(
    since: datetime | None,
    until: datetime | None,
    limits: Any,
    timezone: str | None = "UTC",
    **kwargs: Any,
) -> Any:
    from superset.time_range_limits.policy import (
        TimeRangeLimitError,
        validate_date_range,
    )

    with pytest.raises(TimeRangeLimitError) as excinfo:
        validate_date_range(since, until, limits, timezone=timezone, **kwargs)
    return excinfo.value


def span_limits(*spans: Rule) -> Any:
    from superset.time_range_limits.policy import ResolvedTimeRangeLimits

    return ResolvedTimeRangeLimits(
        max_span=tuple(constraint("global", *span) for span in spans)
    )


def assert_passes(since: datetime | None, until: datetime | None, limits: Any) -> None:
    from superset.time_range_limits.policy import validate_date_range

    validate_date_range(since, until, limits, timezone="UTC")


# --- Eligible time grains ---


def test_eligible_time_grains_default() -> None:
    from superset.time_range_limits.policy import get_eligible_time_grains

    grains = get_eligible_time_grains()

    assert [value for value, _label in grains] == DEFAULT_GRAINS
    assert grains[0] == ("PT1S", "Second")
    assert grains[-1] == ("P1Y", "Year")
    for value, label in grains:
        assert type(value) is str
        assert type(label) is str


def test_eligible_time_grains_denylist(mocker: MockerFixture) -> None:
    from superset.time_range_limits.policy import get_eligible_time_grains

    mocker.patch.dict(current_app.config, {"TIME_GRAIN_DENYLIST": ["PT1S", "P1W"]})

    assert [value for value, _label in get_eligible_time_grains()] == [
        grain for grain in DEFAULT_GRAINS if grain not in {"PT1S", "P1W"}
    ]


def test_time_grain_labels_keep_denied_grains(mocker: MockerFixture) -> None:
    from superset.time_range_limits.policy import (
        get_eligible_time_grains,
        time_grain_labels,
    )

    mocker.patch.dict(current_app.config, {"TIME_GRAIN_DENYLIST": DEFAULT_GRAINS})

    labels = time_grain_labels()
    assert get_eligible_time_grains() == []
    assert labels["P1D"] == "Day"
    assert all(type(key) is str and type(value) is str for key, value in labels.items())


def test_eligible_time_grains_addons(mocker: MockerFixture) -> None:
    from superset.time_range_limits.policy import get_eligible_time_grains

    mocker.patch.dict(
        current_app.config,
        {
            "TIME_GRAIN_ADDONS": {
                "PT2H": "2 hour",
                "P0.25Y": "Quarter year",
                "1969-12-28T00:00:00Z/P1W": "Week starting Sunday",
                "P1D": "Day (custom)",
                "P1.5D": "Day and a half",
                "P0.5M": "Half month",
            },
            "TIME_GRAIN_ADDON_EXPRESSIONS": {
                "sqlite": {
                    "PT2H": "x",
                    "P0.25Y": "x",
                    "1969-12-28T00:00:00Z/P1W": "x",
                },
                "postgresql": {"P1.5D": "x", "P0.5M": "x"},
            },
        },
    )

    grains = get_eligible_time_grains()

    assert [value for value, _label in grains] == [
        "PT1S",
        "PT5S",
        "PT30S",
        "PT1M",
        "PT5M",
        "PT10M",
        "PT15M",
        "PT30M",
        "PT1H",
        "PT2H",
        "PT6H",
        "P1D",
        "P1W",
        "P1M",
        "P3M",
        "P0.25Y",
        "P1Y",
    ]
    labels = dict(grains)
    assert labels["P0.25Y"] == "Quarter year"
    assert labels["P1D"] == "Day (custom)"
    assert labels["PT2H"] == "2 hour"


def test_eligible_grain_labels_match_the_time_grain_dropdown(
    mocker: MockerFixture,
) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from superset.time_range_limits.policy import get_eligible_time_grains

    mocker.patch.dict(
        current_app.config,
        {
            "TIME_GRAIN_ADDONS": {"PT2H": "2 hour"},
            "TIME_GRAIN_ADDON_EXPRESSIONS": {"sqlite": {"PT2H": "x"}},
        },
    )
    for module in (
        "superset.time_range_limits.policy",
        "superset.db_engine_specs.base",
    ):
        mocker.patch(f"{module}._", side_effect=lambda text, **kwargs: f"<{text}>")
    table = SqlaTable(
        table_name="t",
        database=Database(database_name="db", sqlalchemy_uri="sqlite://"),
    )
    dropdown = {
        grain["duration"]: str(grain["name"]) for grain in table.get_time_grains()
    }

    labels = dict(get_eligible_time_grains())

    shown = {grain: label for grain, label in labels.items() if grain in dropdown}
    assert shown == {grain: dropdown[grain] for grain in shown}
    assert {"PT1S", "PT1M", "PT1H", "PT2H", "P1D", "P1W", "P1M", "P3M", "P1Y"} <= set(
        shown
    )
    assert shown["PT2H"] == "2 hour"
    assert shown["P1D"] == "Day"


def test_eligible_time_grains_skip_addon_without_expression(
    mocker: MockerFixture,
) -> None:
    from superset.time_range_limits.policy import get_eligible_time_grains

    mocker.patch.dict(
        current_app.config,
        {"TIME_GRAIN_ADDONS": {"PT2H": "2 hour"}, "TIME_GRAIN_ADDON_EXPRESSIONS": {}},
    )

    assert [value for value, _label in get_eligible_time_grains()] == DEFAULT_GRAINS


# --- Parse ---


@pytest.mark.parametrize(
    "raw",
    [
        policy((9, "P1W"), (6, "P1M"), None),
        policy((90, "P1D"), (13, "P1M"), (0, "P1D")),
        policy(None, (0, "P1D"), None),
        policy((9999, "P1Y"), (9999, "PT1S"), (9999, "P3M")),
        policy(None, (6, "PT1H"), (2, "PT1H")),
    ],
)
def test_parse_valid(raw: dict[str, Any]) -> None:
    from superset.time_range_limits.policy import (
        parse_time_range_limits,
        Rule,
        TimeRangeLimits,
    )

    def rule(value: Any) -> Any:
        return Rule(value["quantity"], value["time_grain"]) if value else None

    assert parse_time_range_limits(raw) == TimeRangeLimits(
        rule(raw["max_span"]), rule(raw["max_look_back"]), rule(raw["max_look_forward"])
    )


@pytest.mark.parametrize("raw", [None, policy()])
def test_parse_no_limits(raw: Any) -> None:
    from superset.time_range_limits.policy import parse_time_range_limits

    assert parse_time_range_limits(raw) is None


def without(key: str) -> dict[str, Any]:
    raw = policy((9, "P1W"))
    del raw[key]
    return raw


def with_rule(name: str, value: Any) -> dict[str, Any]:
    return {**policy(), name: value}


@pytest.mark.parametrize(
    "raw",
    [
        pytest.param([], id="list"),
        pytest.param("x", id="string"),
        pytest.param(90, id="int"),
        pytest.param(True, id="bool"),
        pytest.param({}, id="empty-object"),
        pytest.param(without("max_span"), id="missing-max-span"),
        pytest.param(without("max_look_back"), id="missing-max-look-back"),
        pytest.param(without("max_look_forward"), id="missing-max-look-forward"),
        pytest.param(without("schema_version"), id="missing-schema-version"),
        pytest.param({**policy(), "extra_key": 1}, id="extra-key"),
        pytest.param({**policy(), "schema_version": 2}, id="schema-version-2"),
        pytest.param({**policy(), "schema_version": "1"}, id="schema-version-str"),
        pytest.param({**policy(), "schema_version": True}, id="schema-version-true"),
        pytest.param({**policy(), "schema_version": 1.0}, id="schema-version-float"),
        pytest.param(with_rule("max_span", {"quantity": 9}), id="partial-rule"),
        pytest.param(with_rule("max_span", {"time_grain": "P1W"}), id="partial-grain"),
        pytest.param(
            with_rule("max_span", {"quantity": 9, "time_grain": "P1W", "x": 1}),
            id="rule-extra-key",
        ),
        pytest.param(with_rule("max_span", [9, "P1W"]), id="rule-list"),
        pytest.param(with_rule("max_span", "9 weeks"), id="rule-string"),
        pytest.param(with_rule("max_span", {}), id="rule-empty"),
        pytest.param(policy((True, "P1W")), id="quantity-true"),
        pytest.param(policy((9.0, "P1W")), id="quantity-float"),  # type: ignore[arg-type]
        pytest.param(policy(("9", "P1W")), id="quantity-str"),  # type: ignore[arg-type]
        pytest.param(policy(None, (-1, "P1D")), id="quantity-negative"),
        pytest.param(policy((10000, "P1W")), id="quantity-too-big"),
        pytest.param(policy(None, None, (10000, "P1D")), id="look-forward-too-big"),
        pytest.param(policy((0, "P1W")), id="span-zero"),
        pytest.param(policy((1, "P2W")), id="grain-p2w"),
        pytest.param(policy((1, "PT0.5H")), id="grain-alias-not-enabled"),
        pytest.param(policy((1, "1969-12-28T00:00:00Z/P1W")), id="grain-anchored"),
        pytest.param(policy((1, "p1w")), id="grain-lowercase"),
        pytest.param(policy((1, 7)), id="grain-int"),  # type: ignore[arg-type]
        pytest.param(policy((1, None)), id="grain-null"),  # type: ignore[arg-type]
        pytest.param({"max_range": "3 months"}, id="old-shape"),
        pytest.param(
            {"max_range": "90 days", "earliest_start": "13 months ago"},
            id="old-shape-bounds",
        ),
    ],
)
def test_parse_invalid_policy(raw: Any) -> None:
    from superset.time_range_limits.policy import (
        parse_time_range_limits,
        TimeRangeLimitsInvalidError,
    )

    with pytest.raises(TimeRangeLimitsInvalidError):
        parse_time_range_limits(raw)


MISSING = "Missing time range limits key(s): "
UNKNOWN = "Unknown time range limits key(s): "


@pytest.mark.parametrize(
    "raw,field,prefix",
    [
        (policy((10000, "P1W")), "max_span.quantity", "max_span.quantity: "),
        (policy((0, "P1W")), "max_span.quantity", "max_span.quantity: "),
        (
            policy(None, (-1, "P1D")),
            "max_look_back.quantity",
            "max_look_back.quantity: ",
        ),
        (
            policy(None, None, (1, "P2W")),
            "max_look_forward.time_grain",
            "max_look_forward.time_grain: ",
        ),
        (
            with_rule("max_look_back", {"quantity": 9}),
            "max_look_back.time_grain",
            MISSING,
        ),
        ({**policy(), "schema_version": 2}, "schema_version", "schema_version: "),
        ([], None, "Time range limits must be an object"),
        ({}, "max_look_back", MISSING),
        (without("max_look_forward"), "max_look_forward", MISSING),
        (
            {"schema_version": 1, "max_span": None, "max_look_back": None},
            "max_look_forward",
            MISSING,
        ),
        ({"schema_version": 1, "max_span": None}, "max_look_back", MISSING),
        ({**policy(), "extra_key": 1}, "extra_key", UNKNOWN),
        ({**policy(), "zeta": 1, "alpha": 2}, "alpha", UNKNOWN),
        ({**policy(), 7: 1}, "7", UNKNOWN),  # type: ignore[dict-item, misc]
    ],
)
def test_parse_names_the_bad_field(raw: Any, field: str | None, prefix: str) -> None:
    from superset.time_range_limits.policy import (
        parse_time_range_limits,
        TimeRangeLimitsInvalidError,
    )

    with pytest.raises(TimeRangeLimitsInvalidError) as excinfo:
        parse_time_range_limits(raw)

    assert excinfo.value.field == field
    assert str(excinfo.value).startswith(prefix)
    if field is not None:
        assert field in str(excinfo.value)


def test_parse_top_level_key_messages_list_every_key() -> None:
    from superset.time_range_limits.policy import (
        parse_time_range_limits,
        TimeRangeLimitsInvalidError,
    )

    with pytest.raises(TimeRangeLimitsInvalidError) as missing:
        parse_time_range_limits({"schema_version": 1, "max_span": None})
    assert str(missing.value) == f"{MISSING}max_look_back, max_look_forward"

    with pytest.raises(TimeRangeLimitsInvalidError) as unknown:
        parse_time_range_limits({**policy(), "zeta": 1, "alpha": 2})
    assert str(unknown.value) == f"{UNKNOWN}alpha, zeta"


def test_parse_quantity_message() -> None:
    from superset.time_range_limits.policy import (
        parse_time_range_limits,
        TimeRangeLimitsInvalidError,
    )

    with pytest.raises(TimeRangeLimitsInvalidError) as excinfo:
        parse_time_range_limits(policy((10000, "P1W")))

    assert excinfo.value.field == "max_span.quantity"
    assert str(excinfo.value) == (
        "max_span.quantity: must be a whole number from 1 to 9999"
    )


def test_parse_time_grain_message() -> None:
    from superset.time_range_limits.policy import (
        parse_time_range_limits,
        TimeRangeLimitsInvalidError,
    )

    with pytest.raises(TimeRangeLimitsInvalidError) as excinfo:
        parse_time_range_limits(policy((1, "P2W")))

    assert excinfo.value.field == "max_span.time_grain"
    assert str(excinfo.value) == (
        "max_span.time_grain: Time grain P2W is not available. Select a supported unit."
    )


def test_parse_rejects_denylisted_grain(mocker: MockerFixture) -> None:
    from superset.time_range_limits.policy import (
        parse_time_range_limits,
        TimeRangeLimitsInvalidError,
    )

    assert parse_time_range_limits(policy((9, "P1W"))) is not None
    mocker.patch.dict(current_app.config, {"TIME_GRAIN_DENYLIST": ["P1W"]})

    with pytest.raises(TimeRangeLimitsInvalidError) as excinfo:
        parse_time_range_limits(policy((9, "P1W")))
    assert excinfo.value.field == "max_span.time_grain"


def test_parse_accepts_enabled_aliases_and_addons(mocker: MockerFixture) -> None:
    from superset.time_range_limits.policy import parse_time_range_limits

    mocker.patch.dict(
        current_app.config,
        {
            "TIME_GRAIN_ADDONS": {**ALIAS_ADDONS["TIME_GRAIN_ADDONS"], "P2W": "2 week"},
            "TIME_GRAIN_ADDON_EXPRESSIONS": {
                "sqlite": {"PT0.5H": "x", "P0.25Y": "x", "P2W": "x"}
            },
        },
    )

    assert parse_time_range_limits(policy((3, "P0.25Y"), (3, "PT0.5H"), (1, "P2W")))


# --- Resolve ---


@pytest.mark.parametrize(
    "rule,now,expected",
    [
        ((13, "P1M"), NOW, datetime(2025, 9, 16)),
        ((0, "P1D"), NOW, datetime(2026, 10, 16)),
        ((6, "PT1H"), NOW, datetime(2026, 10, 16, 8, 30)),
        ((0, "PT1H"), NOW, NOW),
        ((13, "P1M"), datetime(2026, 3, 31, 14, 30), datetime(2025, 2, 28)),
        ((1, "P1W"), NOW, datetime(2026, 10, 9)),
        ((1, "P3M"), NOW, datetime(2026, 7, 16)),
        (
            (6, "PT30S"),
            datetime(2026, 10, 16, 14, 30, 15, 500000),
            NOW.replace(minute=27, second=15),
        ),
        ((6, "PT1H"), datetime(2026, 10, 16, 14, 30, 0, 999999), NOW.replace(hour=8)),
        pytest.param(
            (6, "PT1H"),
            datetime(2026, 3, 29, 8),
            datetime(2026, 3, 29, 2),
            id="dst_spring_hours_back_wall_clock",
        ),
        pytest.param(
            (6, "PT1H"),
            datetime(2026, 10, 25, 5),
            datetime(2026, 10, 24, 23),
            id="dst_autumn_hours_back_wall_clock",
        ),
        pytest.param(
            (1, "P1D"),
            datetime(2026, 3, 29, 14, 30),
            datetime(2026, 3, 28),
            id="dst_spring_day_back_midnight",
        ),
        pytest.param(
            (1, "P1D"),
            datetime(2026, 3, 30, 10),
            datetime(2026, 3, 29),
            id="dst_spring_day_back_across_the_change",
        ),
    ],
)
def test_look_back_bound(rule: Rule, now: datetime, expected: datetime) -> None:
    limits = resolve(policy(None, rule), now=now)

    assert limits.earliest_start == bound(expected, "global", *rule)
    assert limits.latest_end is None
    assert limits.max_span == ()


@pytest.mark.parametrize(
    "rule,now,expected",
    [
        ((0, "P1D"), NOW, datetime(2026, 10, 17)),
        ((1, "P1W"), NOW, datetime(2026, 10, 24)),
        ((1, "P3M"), NOW, datetime(2027, 1, 17)),
        ((2, "PT1H"), NOW, datetime(2026, 10, 16, 16, 30)),
        ((0, "PT1H"), NOW, NOW),
        ((1, "P1M"), datetime(2026, 1, 30, 14, 30), datetime(2026, 3, 1)),
        ((2, "PT1H"), datetime(2026, 10, 16, 14, 30, 0, 999999), NOW.replace(hour=16)),
        pytest.param(
            (2, "PT1H"),
            datetime(2026, 3, 29, 0, 30),
            datetime(2026, 3, 29, 2, 30),
            id="dst_spring_hours_forward_wall_clock",
        ),
    ],
)
def test_look_forward_bound(rule: Rule, now: datetime, expected: datetime) -> None:
    limits = resolve(policy(None, None, rule), now=now)

    assert limits.latest_end == bound(expected, "global", *rule)
    assert limits.earliest_start is None


@pytest.mark.parametrize(
    "since,passes",
    [
        (datetime(2026, 10, 16, 8, 30), True),
        (datetime(2026, 10, 16, 8, 29, 59), True),
        (datetime(2026, 10, 16, 8, 29, 58, 999000), False),
    ],
)
def test_sub_day_look_back_slack(since: datetime, passes: bool) -> None:
    limits = resolve(policy(None, (6, "PT1H")))
    until = datetime(2026, 10, 16, 14, 30)

    if passes:
        assert_passes(since, until, limits)
    else:
        ex = limit_error(since, until, limits)
        assert ex.error.extra["reason_code"] == "MAX_LOOK_BACK_EXCEEDED"
        assert ex.error.message == (
            "Start can't be earlier than Oct 16, 2026 08:30 (6 hours ago)."
        )


@pytest.mark.parametrize(
    "until,passes",
    [
        (datetime(2026, 10, 16, 16, 30), True),
        (datetime(2026, 10, 16, 16, 30, 1), True),
        (datetime(2026, 10, 16, 16, 30, 1, 1), False),
    ],
)
def test_sub_day_look_forward_slack(until: datetime, passes: bool) -> None:
    limits = resolve(policy(None, None, (2, "PT1H")))
    since = datetime(2026, 10, 16, 14)

    if passes:
        assert_passes(since, until, limits)
    else:
        ex = limit_error(since, until, limits)
        assert ex.error.extra["reason_code"] == "MAX_LOOK_FORWARD_EXCEEDED"
        assert ex.error.message == (
            "End can't be later than Oct 16, 2026 16:30 (2 hours from now)."
        )


def test_day_bounds_have_no_slack() -> None:
    limits = resolve(None, dataset=policy(None, (0, "P1D"), (0, "P1D")))

    assert limit_error(
        datetime(2026, 10, 15, 23, 59, 59, 999999), NOW, limits
    ).error.extra["reason_code"] == ("MAX_LOOK_BACK_EXCEEDED")
    assert limit_error(
        datetime(2026, 10, 16), datetime(2026, 10, 17, 0, 0, 0, 1), limits
    ).error.extra["reason_code"] == ("MAX_LOOK_FORWARD_EXCEEDED")
    assert_passes(datetime(2026, 10, 16), datetime(2026, 10, 17), limits)


@pytest.mark.parametrize(
    "time_range,rule",
    [
        ("6 hours ago : now", (None, (6, "PT1H"))),
        ("now : 2 hours later", (None, (0, "PT1H"))),
        ("now : 2 hours later", (None, None, (2, "PT1H"))),
        ("30 minutes ago : now", (None, (30, "PT1M"))),
    ],
)
def test_sub_day_bounds_pass_on_the_real_clock(
    time_range: str, rule: tuple[Any, ...]
) -> None:
    from superset.time_range_limits.policy import validate_date_range
    from superset.utils.date_parser import get_since_until

    since, until = get_since_until(time_range=time_range)
    limits = resolve(policy(*rule), now=datetime.now())

    validate_date_range(since, until, limits, timezone="UTC")


@pytest.mark.parametrize(
    "hook_now,passes",
    [
        (datetime(2026, 10, 16, 14, 30, 1, 49000), True),
        (datetime(2026, 10, 16, 14, 30, 0, 999999), True),
        (datetime(2026, 10, 16, 14, 30, 1, 999999), True),
        (datetime(2026, 10, 16, 14, 30, 2), False),
    ],
)
def test_sub_day_look_back_parser_to_hook_gap(hook_now: datetime, passes: bool) -> None:
    from superset.utils.date_parser import get_since_until

    with freeze_time("2026-10-16 14:30:00.999"):
        since, until = get_since_until(time_range="6 hours ago : now")
    assert since == datetime(2026, 10, 16, 8, 30)
    limits = resolve(policy(None, (6, "PT1H")), now=hook_now)

    if passes:
        assert_passes(since, until, limits)
    else:
        assert limit_error(since, until, limits).error.extra["reason_code"] == (
            "MAX_LOOK_BACK_EXCEEDED"
        )


_NO_DASHBOARD = object()


def effective_case(
    expected: Any,
    *,
    global_policy: Any = None,
    extra: Any = None,
    dashboard: Any = _NO_DASHBOARD,
    now: datetime = NOW,
    attribute: str | None = None,
) -> tuple[Any, Any, Any, datetime, str | None, Any]:
    """Describe one resolution using only the levels that differ from defaults."""
    return global_policy, extra, dashboard, now, attribute, expected


@pytest.mark.parametrize(
    "cases",
    [
        pytest.param(
            [
                effective_case(None),
                effective_case(None, extra=""),
                effective_case(None, extra="{}"),
                effective_case(None, extra={"other": 1}),
                effective_case(None, extra={"time_range_limits": None}),
                effective_case(None, extra={"time_range_limits": policy()}),
                effective_case(None, dashboard=None),
                effective_case(None),
                effective_case(None, global_policy=policy()),
            ],
            id="none_when_nothing_is_set",
        ),
        pytest.param(
            [
                effective_case(
                    ResolvedTimeRangeLimits(
                        max_span=(constraint("global", 90, "P1D"),),
                        earliest_start=bound(
                            datetime(2025, 9, 16), "global", 13, "P1M"
                        ),
                        latest_end=bound(datetime(2026, 10, 17), "global", 0, "P1D"),
                    ),
                    global_policy=DEFAULT_POLICY,
                )
            ],
            id="global_only",
        ),
        pytest.param(
            [
                effective_case(
                    ResolvedTimeRangeLimits(
                        max_span=(
                            constraint("global", 90, "P1D"),
                            constraint("dataset", 30, "P1D"),
                        ),
                        earliest_start=bound(
                            datetime(2026, 4, 16), "dataset", 6, "P1M"
                        ),
                        latest_end=bound(NOW, "dataset", 0, "PT1H"),
                    ),
                    global_policy=DEFAULT_POLICY,
                    extra={
                        "time_range_limits": policy(
                            (30, "P1D"), (6, "P1M"), (0, "PT1H")
                        )
                    },
                )
            ],
            id="global_and_dataset_keep_both_spans",
        ),
        pytest.param(
            [
                effective_case(
                    ResolvedTimeRangeLimits(
                        max_span=(
                            constraint("global", 90, "P1D"),
                            constraint("dataset", 60, "P1D"),
                            constraint("dashboard", 45, "P1D"),
                        ),
                        earliest_start=bound(
                            datetime(2025, 12, 16), "dataset", 10, "P1M"
                        ),
                        latest_end=bound(datetime(2026, 10, 17), "global", 0, "P1D"),
                    ),
                    global_policy=DEFAULT_POLICY,
                    extra={
                        "time_range_limits": policy(
                            (60, "P1D"), (10, "P1M"), (1, "P1D")
                        )
                    },
                    dashboard=policy((45, "P1D"), (2, "P1Y"), (0, "P1D")),
                )
            ],
            id="all_three_levels_keep_every_span",
        ),
        pytest.param(
            [
                effective_case(
                    ResolvedTimeRangeLimits(
                        max_span=(
                            constraint("global", 30, "P1D"),
                            constraint("dataset", 60, "P1D"),
                            constraint("dashboard", 10, "P1D"),
                        ),
                        earliest_start=bound(
                            datetime(2026, 6, 16), "dataset", 4, "P1M"
                        ),
                        latest_end=None,
                    ),
                    global_policy=policy((30, "P1D"), (10, "P1M")),
                    extra={"time_range_limits": policy((60, "P1D"), (4, "P1M"))},
                    dashboard=policy((10, "P1D"), (2, "P1Y")),
                )
            ],
            id="picks_strictest_level_per_rule",
        ),
        pytest.param(
            [
                effective_case(
                    ResolvedTimeRangeLimits(
                        max_span=(constraint("global", 90, "P1D"),),
                        earliest_start=bound(
                            datetime(2026, 1, 16), "dataset", 9, "P1M"
                        ),
                        latest_end=bound(datetime(2026, 10, 17), "dashboard", 0, "P1D"),
                    ),
                    global_policy=policy((90, "P1D")),
                    extra={"time_range_limits": policy(None, (9, "P1M"))},
                    dashboard=policy(None, None, (0, "P1D")),
                )
            ],
            id="rule_set_on_one_level_applies_as_is",
        ),
        pytest.param(
            [
                effective_case(
                    ResolvedTimeRangeLimits(
                        max_span=(constraint("dataset", 7, "P1D"),)
                    ),
                    extra={"time_range_limits": policy((7, "P1D"))},
                ),
                effective_case(
                    ResolvedTimeRangeLimits(
                        max_span=(constraint("dashboard", 7, "P1D"),)
                    ),
                    dashboard=policy((7, "P1D")),
                ),
            ],
            id="without_global",
        ),
        pytest.param(
            [
                effective_case(
                    bound(datetime(2025, 10, 16), "dataset", 12, "P1M"),
                    global_policy=policy(None, (13, "P1M")),
                    extra={"time_range_limits": policy(None, (12, "P1M"))},
                    attribute="earliest_start",
                ),
                effective_case(
                    bound(datetime(2026, 3, 1), "dataset", 12, "P1M"),
                    global_policy=policy(None, (13, "P1M")),
                    extra={"time_range_limits": policy(None, (12, "P1M"))},
                    now=datetime(2027, 3, 1, 8),
                    attribute="earliest_start",
                ),
            ],
            id="resolve_every_level_against_the_same_now",
        ),
    ],
)
def test_effective_limits(
    mocker: MockerFixture, cases: list[tuple[Any, Any, Any, datetime, str | None, Any]]
) -> None:
    from superset.time_range_limits.policy import get_effective_time_range_limits

    for global_policy, extra, dashboard, now, attribute, expected in cases:
        set_global(mocker, global_policy)
        result = get_effective_time_range_limits(
            sqla_table(extra),
            now,
            dashboard_with(dashboard) if dashboard is not _NO_DASHBOARD else None,
        )
        assert (getattr(result, attribute) if attribute else result) == expected


@pytest.mark.parametrize(
    "rule,global_rule,level_rule,expected_source",
    [
        ("max_look_back", (13, "P1M"), (6, "P1M"), "dataset"),
        ("max_look_back", (6, "P1M"), (13, "P1M"), "global"),
        ("max_look_back", (12, "P1M"), (1, "P1Y"), "global"),
        ("max_look_back", (1, "P1Y"), (12, "P1M"), "global"),
        ("max_look_back", (1, "P1D"), (24, "PT1H"), "dataset"),
        ("max_look_forward", (1, "P1W"), (0, "P1D"), "dataset"),
        ("max_look_forward", (0, "P1D"), (1, "P1W"), "global"),
        ("max_look_forward", (7, "P1D"), (1, "P1W"), "global"),
        ("max_look_forward", (1, "P1D"), (2, "PT1H"), "dataset"),
    ],
)
def test_effective_bounds_take_the_strictest_and_name_its_source(
    rule: str, global_rule: Rule, level_rule: Rule, expected_source: str
) -> None:
    limits = resolve(
        policy(**{rule: global_rule}), dataset=policy(**{rule: level_rule})
    )
    winner = limits.earliest_start if rule == "max_look_back" else limits.latest_end
    expected_rule = global_rule if expected_source == "global" else level_rule

    assert winner.limit == constraint(expected_source, *expected_rule)


@pytest.mark.parametrize(
    "level_limits",
    [
        None,
        policy(),
        policy((365, "P1D"), (5, "P1Y"), (10, "P1Y")),
        policy((91, "P1D")),
        policy(None, (14, "P1M")),
        policy(None, None, (1, "P1D")),
    ],
)
def test_dataset_and_dashboard_cannot_loosen_global_limits(level_limits: Any) -> None:
    global_only = resolve(DEFAULT_POLICY)

    for limits in (
        resolve(DEFAULT_POLICY, dataset=level_limits),
        resolve(DEFAULT_POLICY, dashboard=level_limits),
    ):
        assert limits.max_span[:1] == (constraint("global", 90, "P1D"),)
        assert limits.earliest_start == global_only.earliest_start
        assert limits.latest_end == global_only.latest_end
        ex = limit_error(datetime(2026, 7, 1), datetime(2026, 10, 1), limits)
        assert ex.error.extra["reason_code"] == "MAX_SPAN_EXCEEDED"
        assert ex.error.extra["source"] == "global"
        assert ex.error.extra["limit"] == {
            "quantity": 90,
            "time_grain": "P1D",
        }


def test_missing_key_cannot_remove_global_limits(mocker: MockerFixture) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.dashboard import Dashboard
    from superset.time_range_limits.policy import get_effective_time_range_limits

    set_global(mocker, policy((90, "P1D")))
    expected = get_effective_time_range_limits(sqla_table(None), NOW)
    assert expected is not None

    for extra in (None, "", "{}", '{"time_range_limits": null}', '{"other": 1}'):
        dataset = SqlaTable(table_name="t", extra=extra)
        dashboard = Dashboard(json_metadata=extra)
        assert get_effective_time_range_limits(dataset, NOW) == expected
        assert get_effective_time_range_limits(dataset, NOW, dashboard) == expected


def test_effective_limits_query_datasource_gets_global_only(
    mocker: MockerFixture,
) -> None:
    from superset.models.sql_lab import Query
    from superset.time_range_limits.policy import (
        get_effective_time_range_limits,
        ResolvedTimeRangeLimits,
    )

    set_global(mocker, policy((90, "P1D")))
    query = Query(extra={"time_range_limits": policy((7, "P1D"))})
    assert get_effective_time_range_limits(query, NOW) == ResolvedTimeRangeLimits(
        max_span=(constraint("global", 90, "P1D"),)
    )

    set_global(mocker, None)
    assert get_effective_time_range_limits(query, NOW) is None
    assert get_effective_time_range_limits(
        query, NOW, dashboard=dashboard_with(policy((7, "P1D")))
    ) == ResolvedTimeRangeLimits(max_span=(constraint("dashboard", 7, "P1D"),))


def test_shipped_default_sets_no_limits() -> None:
    from superset.time_range_limits.policy import get_effective_time_range_limits

    assert current_app.config["TIME_RANGE_LIMITS_GLOBAL"] is None
    assert get_effective_time_range_limits(sqla_table(None), NOW) is None


def test_dashboard_tightens_dataset_and_global_limits() -> None:
    from superset.time_range_limits.policy import ResolvedTimeRangeLimits

    assert resolve(
        policy((90, "P1D"), (2, "P1Y"), (0, "PT1H")),
        dataset=policy((60, "P1D"), None, (5, "P1Y")),
        dashboard=policy((7, "P1D"), (9, "P1M")),
    ) == ResolvedTimeRangeLimits(
        max_span=(
            constraint("global", 90, "P1D"),
            constraint("dataset", 60, "P1D"),
            constraint("dashboard", 7, "P1D"),
        ),
        earliest_start=bound(datetime(2026, 1, 16), "dashboard", 9, "P1M"),
        latest_end=bound(NOW, "global", 0, "PT1H"),
    )


def test_dashboard_cannot_loosen_dataset_limits() -> None:
    from superset.time_range_limits.policy import ResolvedTimeRangeLimits

    dataset = policy((30, "P1D"), (9, "P1M"), (0, "P1D"))
    dashboard = policy((365, "P1D"), (6, "P1Y"), (4, "P1Y"))
    expected = ResolvedTimeRangeLimits(
        max_span=(constraint("dataset", 30, "P1D"),),
        earliest_start=bound(datetime(2026, 1, 16), "dataset", 9, "P1M"),
        latest_end=bound(datetime(2026, 10, 17), "dataset", 0, "P1D"),
    )
    assert resolve(None, dataset=dataset) == expected

    limits = resolve(None, dataset=dataset, dashboard=dashboard)
    assert limits == ResolvedTimeRangeLimits(
        max_span=(
            constraint("dataset", 30, "P1D"),
            constraint("dashboard", 365, "P1D"),
        ),
        earliest_start=expected.earliest_start,
        latest_end=expected.latest_end,
    )
    ex = limit_error(datetime(2026, 9, 1), datetime(2026, 10, 2), limits)
    assert ex.error.extra["source"] == "dataset"


def test_effective_limits_tie_keeps_the_lower_level() -> None:
    limits = resolve(
        policy(None, (12, "P1M"), (0, "P1D")),
        dataset=policy(None, (1, "P1Y"), (1, "P1D")),
        dashboard=policy(None, (365, "P1D"), (24, "PT1H")),
    )

    assert limits.earliest_start == bound(datetime(2025, 10, 16), "global", 12, "P1M")
    assert limits.latest_end == bound(datetime(2026, 10, 17), "global", 0, "P1D")

    limits = resolve(
        None,
        dataset=policy(None, (1, "P1Y"), (1, "P1W")),
        dashboard=policy(None, (12, "P1M"), (7, "P1D")),
    )
    assert limits.earliest_start.limit.source == "dataset"
    assert limits.latest_end.limit.source == "dataset"


# --- Span ---


@pytest.mark.parametrize(
    "spans,since,until,passes",
    [
        (((2, "P3M"),), datetime(2026, 4, 16), datetime(2026, 10, 16), True),
        (
            ((2, "P3M"),),
            datetime(2026, 4, 15, 23, 59, 59),
            datetime(2026, 10, 16),
            False,
        ),
        (((3, "PT5M"),), datetime(2026, 10, 16, 14, 15), NOW, True),
        (((3, "PT5M"),), datetime(2026, 10, 16, 14, 14, 59), NOW, False),
        (((1, "P1W"),), datetime(2026, 10, 9, 14, 30), NOW, True),
        (((1, "P1W"),), datetime(2026, 10, 9, 14, 29), NOW, False),
        (((24, "PT1H"),), datetime(2026, 10, 15, 14, 30), NOW, True),
        (((1, "PT30S"),), datetime(2026, 10, 16, 14, 29, 30), NOW, True),
        (((1, "PT30S"),), datetime(2026, 10, 16, 14, 29, 29, 999999), NOW, False),
        pytest.param(
            ((1, "P1D"),),
            datetime(2026, 3, 29),
            datetime(2026, 3, 30),
            True,
            id="dst_spring_one_calendar_day",
        ),
        pytest.param(
            ((1, "P1D"),),
            datetime(2026, 10, 25),
            datetime(2026, 10, 26),
            True,
            id="dst_autumn_one_calendar_day",
        ),
    ],
)
def test_span(
    spans: tuple[Rule, ...], since: datetime, until: datetime, passes: bool
) -> None:
    limits = span_limits(*spans)

    if passes:
        assert_passes(since, until, limits)
    else:
        assert limit_error(since, until, limits).error.extra["reason_code"] == (
            "MAX_SPAN_EXCEEDED"
        )


@pytest.mark.parametrize(
    "alias,grain,since,until,passes",
    [
        ("P0.25Y", "P3M", datetime(2026, 1, 31), datetime(2026, 10, 31), True),
        ("P0.25Y", "P3M", datetime(2026, 1, 30), datetime(2026, 10, 31), False),
        ("PT0.5H", "PT30M", datetime(2026, 10, 16, 13), NOW, True),
        ("PT0.5H", "PT30M", datetime(2026, 10, 16, 12, 59, 59), NOW, False),
    ],
)
def test_aliases_behave_like_their_grain(
    mocker: MockerFixture,
    alias: str,
    grain: str,
    since: datetime,
    until: datetime,
    passes: bool,
) -> None:
    from superset.time_range_limits.policy import validate_date_range

    mocker.patch.dict(current_app.config, ALIAS_ADDONS)
    results: list[str | None] = []
    for time_grain in (alias, grain):
        limits = resolve(policy((3, time_grain)))
        try:
            validate_date_range(since, until, limits, timezone="UTC")
            results.append(None)
        except Exception as ex:  # pylint: disable=broad-except
            results.append(ex.error.message)  # type: ignore[attr-defined]

    assert results[0] == results[1]
    assert (results[0] is None) == passes


PRESETS = [
    ("Last day", (1, "P1D")),
    ("Last week", (1, "P1W")),
    ("Last month", (1, "P1M")),
    ("Last quarter", (3, "P1M")),
    ("Last quarter", (1, "P3M")),
    ("Last year", (1, "P1Y")),
    ("previous calendar week", (1, "P1W")),
    ("previous calendar month", (1, "P1M")),
    ("previous calendar quarter", (3, "P1M")),
    ("previous calendar quarter", (1, "P3M")),
    ("previous calendar year", (1, "P1Y")),
]
PRESET_DAYS = sorted(
    {
        datetime(year, month, day)
        for year in (2024, 2025)
        for month in range(1, 13)
        for day in (1, 15, monthrange(year, month)[1])
    }
    | {datetime(2024, 2, 29)}
)


@pytest.mark.parametrize("today", PRESET_DAYS, ids=lambda day: f"{day:%Y-%m-%d}")
def test_presets_pass_a_span_of_their_own_length(today: datetime) -> None:
    """
    The span counts forward from the start, so a rolling preset whose start was
    clamped to a shorter month's end (Mar 31 - 1 month = Feb 28) is too long.
    """
    from superset.utils.date_parser import get_since_until

    for time_range, span in PRESETS:
        with freeze_time(today.replace(hour=14, minute=30)):
            since, until = get_since_until(time_range=time_range)
        assert since is not None
        limits = span_limits(span)
        rolling = time_range in ("Last month", "Last quarter", "Last year")
        if rolling and since.day < today.day:
            assert limit_error(since, until, limits).error.extra["reason_code"] == (
                "MAX_SPAN_EXCEEDED"
            )
            continue
        assert_passes(since, until, limits)
        assert limit_error(since - timedelta(seconds=1), until, limits).error.extra[
            "reason_code"
        ] == ("MAX_SPAN_EXCEEDED")


LOOK_BACK_PRESETS = [
    ("Last day", (1, "P1D")),
    ("Last week", (1, "P1W")),
    ("Last 7 days", (7, "P1D")),
    ("Last month", (1, "P1M")),
    ("Last quarter", (1, "P3M")),
    ("Last year", (1, "P1Y")),
]


@pytest.mark.parametrize("today", PRESET_DAYS, ids=lambda day: f"{day:%Y-%m-%d}")
def test_day_look_back_counts_from_the_start_of_today(today: datetime) -> None:
    from superset.utils.date_parser import get_since_until

    for time_range, rule in LOOK_BACK_PRESETS:
        now = today.replace(hour=14, minute=30)
        with freeze_time(now):
            since, until = get_since_until(
                time_range=time_range
                if time_range != "Last 7 days"
                else 'DATEADD(DATETIME("today"), -7, day) : today'
            )
        assert since is not None
        limits = resolve(None, dataset=policy(None, rule), now=now)
        assert_passes(since, until, limits)
        assert limit_error(since - timedelta(seconds=2), until, limits).error.extra[
            "reason_code"
        ] == ("MAX_LOOK_BACK_EXCEEDED")

    now = today.replace(hour=14, minute=30)
    zero = resolve(None, dataset=policy(None, (0, "P1D")), now=now)
    for since, until in (
        (today, today + timedelta(days=1)),
        (today, now),
    ):
        assert_passes(since, until, zero)
    assert limit_error(today - timedelta(seconds=1), now, zero).error.extra[
        "reason_code"
    ] == ("MAX_LOOK_BACK_EXCEEDED")


def test_sub_day_look_back_still_counts_from_now() -> None:
    limits = resolve(None, dataset=policy(None, (6, "PT1H")))

    assert_passes(datetime(2026, 10, 16, 8, 30), NOW, limits)
    assert limit_error(datetime(2026, 10, 16, 8, 29), NOW, limits).error.extra[
        "reason_code"
    ] == ("MAX_LOOK_BACK_EXCEEDED")


@pytest.mark.parametrize(
    "today,time_range,expected,span,passes",
    [
        ("2025-05-31", "Last quarter", ("2025-02-28", "2025-05-31"), (3, "P1M"), False),
        (
            "2025-05-31",
            "Last 3 months",
            ("2025-02-28", "2025-05-31"),
            (3, "P1M"),
            False,
        ),
        ("2028-02-29", "Last year", ("2027-02-28", "2028-02-29"), (1, "P1Y"), False),
        ("2024-03-15", "Last year", ("2023-03-15", "2024-03-15"), (1, "P1Y"), True),
        ("2024-03-15", "Last year", ("2023-03-15", "2024-03-15"), (365, "P1D"), False),
        (
            "2026-10-21",
            "previous calendar quarter",
            ("2026-07-01", "2026-10-01"),
            (3, "P1M"),
            True,
        ),
        (
            "2026-10-21",
            "previous calendar quarter",
            ("2026-07-01", "2026-10-01"),
            (90, "P1D"),
            False,
        ),
        ("2024-03-15", "Current year", ("2024-01-01", "2025-01-01"), (1, "P1Y"), True),
    ],
)
def test_validate_date_range_presets(
    today: str,
    time_range: str,
    expected: tuple[str, str],
    span: Rule,
    passes: bool,
) -> None:
    from superset.utils.date_parser import get_since_until

    with freeze_time(f"{today} 14:30"):
        since, until = get_since_until(time_range=time_range)
    assert (since, until) == tuple(map(datetime.fromisoformat, expected))
    limits = span_limits(span)

    if passes:
        assert_passes(since, until, limits)
    else:
        assert limit_error(since, until, limits).error.extra["reason_code"] == (
            "MAX_SPAN_EXCEEDED"
        )


@pytest.mark.parametrize(
    "since,until,passes",
    [
        (datetime(2025, 1, 31), datetime(2025, 4, 30), True),
        (datetime(2025, 1, 31), datetime(2025, 5, 1), False),
        (datetime(2025, 3, 31), datetime(2025, 6, 30), True),
        (datetime(2025, 3, 31), datetime(2025, 7, 1), False),
        (datetime(2025, 1, 15, 10), datetime(2025, 4, 15, 10), True),
        (datetime(2025, 1, 15, 10), datetime(2025, 4, 15, 10, 1), False),
        (datetime(2025, 1, 31, 10), datetime(2025, 4, 30, 10, 1), False),
    ],
)
def test_validate_date_range_custom_ranges_under_months(
    since: datetime, until: datetime, passes: bool
) -> None:
    limits = span_limits((3, "P1M"))
    if passes:
        assert_passes(since, until, limits)
    else:
        assert limit_error(since, until, limits).error.extra["reason_code"] == (
            "MAX_SPAN_EXCEEDED"
        )


def test_span_dashboard_tighter_than_global() -> None:
    limits = resolve(policy((12, "P1W")), dashboard=policy((9, "P1W")))
    ex = limit_error(datetime(2026, 8, 7), datetime(2026, 10, 16), limits)

    assert ex.error.extra["reason_code"] == "MAX_SPAN_EXCEEDED"
    assert ex.error.extra["source"] == "dashboard"
    assert ex.error.extra["limit"] == {
        "quantity": 9,
        "time_grain": "P1W",
    }
    assert ex.error.message == (
        "Range can't be longer than 9 weeks. This one is 10 weeks."
    )


@pytest.mark.parametrize(
    "global_span,dataset_span,since,until,binding",
    [
        ((90, "P1D"), (3, "P1M"), datetime(2025, 2, 1), datetime(2025, 5, 1), None),
        (
            (90, "P1D"),
            (3, "P1M"),
            datetime(2025, 2, 1),
            datetime(2025, 5, 2),
            ("dataset", 3, "P1M", "3 months"),
        ),
        (
            (90, "P1D"),
            (3, "P1M"),
            datetime(2025, 7, 1),
            datetime(2025, 10, 1),
            ("global", 90, "P1D", "90 days"),
        ),
        (
            (7, "P1D"),
            (1, "P1W"),
            datetime(2025, 1, 1),
            datetime(2025, 1, 9),
            ("global", 7, "P1D", "7 days"),
        ),
        (
            (1, "P1W"),
            (7, "P1D"),
            datetime(2025, 1, 1),
            datetime(2025, 1, 9),
            ("global", 1, "P1W", "1 week"),
        ),
    ],
)
def test_validate_date_range_binding_limit_across_levels(
    global_span: Rule,
    dataset_span: Rule,
    since: datetime,
    until: datetime,
    binding: tuple[str, int, str, str] | None,
) -> None:
    limits = resolve(policy(global_span), dataset=policy(dataset_span))
    assert limits.max_span == (
        constraint("global", *global_span),
        constraint("dataset", *dataset_span),
    )

    if binding is None:
        assert_passes(since, until, limits)
        return
    source, quantity, grain, words = binding
    ex = limit_error(since, until, limits)
    assert ex.error.extra["reason_code"] == "MAX_SPAN_EXCEEDED"
    assert ex.error.extra["source"] == source
    assert ex.error.extra["limit"] == {
        "quantity": quantity,
        "time_grain": grain,
    }
    assert ex.error.message.startswith(f"Range can't be longer than {words}.")


def test_validate_date_range_near_year_one_names_the_span_that_fits() -> None:
    ex = limit_error(
        datetime(1, 1, 1), datetime(500, 1, 1), span_limits((1999, "P1Y"), (1, "P1Y"))
    )

    assert ex.error.extra["source"] == "global"

    assert ex.error.extra["limit"] == {
        "quantity": 1,
        "time_grain": "P1Y",
    }
    assert ex.error.message == (
        "Range can't be longer than 1 year. This one is 499 years."
    )


def test_huge_values_never_fail() -> None:
    from superset.time_range_limits.policy import ResolvedTimeRangeLimits

    limits = resolve(policy((9999, "P1Y"), (9999, "P1Y"), (9999, "P1Y")))

    assert limits == ResolvedTimeRangeLimits(
        max_span=(constraint("global", 9999, "P1Y"),)
    )
    assert_passes(datetime(2026, 1, 1), datetime(2026, 2, 1), limits)
    assert_passes(datetime(1, 1, 1), datetime(9999, 12, 31), limits)


def test_huge_addon_values_never_fail(mocker: MockerFixture) -> None:
    mocker.patch.dict(
        current_app.config,
        {
            "TIME_GRAIN_ADDONS": {"PT99999999H": "Huge", "P9999D": "Huge days"},
            "TIME_GRAIN_ADDON_EXPRESSIONS": {
                "sqlite": {"PT99999999H": "x", "P9999D": "x"}
            },
        },
    )

    for grain in ("PT99999999H", "P9999D"):
        limits = resolve(
            policy((9999, grain), (9999, grain)),
            dataset=policy(None, None, (9999, grain)),
        )
        assert limits.earliest_start is None
        assert limits.latest_end is None
        assert_passes(datetime(2026, 1, 1), datetime(2026, 2, 1), limits)
        assert_passes(datetime(1, 1, 1), datetime(9999, 12, 31), limits)


def test_look_forward_at_the_end_of_the_calendar_is_skipped() -> None:
    limits = resolve(policy(None, None, (0, "P1D")), now=datetime(9999, 12, 31, 12))

    assert limits.latest_end is None
    assert_passes(datetime(9999, 12, 31), datetime(9999, 12, 31, 23), limits)


# --- Fail closed ---


@pytest.mark.parametrize(
    "bad_policy",
    [
        [],
        "90",
        {},
        {**policy((9, "P1W")), "schema_version": 2},
        policy((0, "P1D")),
        policy((1, "P2W")),
        {"max_range": "90 days"},
        pytest.param({"max_range_days": 90}, id="old-max-range-days-key"),
        with_rule("max_span", {"quantity": 9}),
    ],
)
def test_effective_limits_reject_bad_policy_on_any_level(
    mocker: MockerFixture, bad_policy: Any
) -> None:
    from superset.time_range_limits.policy import (
        get_effective_time_range_limits,
        TimeRangeLimitsInvalidError,
    )

    set_global(mocker, None)
    with pytest.raises(TimeRangeLimitsInvalidError):
        get_effective_time_range_limits(dataset_with(bad_policy), NOW)
    with pytest.raises(TimeRangeLimitsInvalidError):
        get_effective_time_range_limits(
            sqla_table(None), NOW, dashboard=dashboard_with(bad_policy)
        )

    set_global(mocker, bad_policy)
    with pytest.raises(TimeRangeLimitsInvalidError):
        get_effective_time_range_limits(sqla_table(None), NOW)


def test_stored_grain_denylisted_later_fails_closed(mocker: MockerFixture) -> None:
    from superset.time_range_limits.policy import (
        get_effective_time_range_limits,
        TimeRangeLimitsInvalidError,
    )

    set_global(mocker, None)
    dataset = dataset_with(policy((9, "P1W")))
    dashboard = dashboard_with(policy(None, (6, "PT1H")))
    assert get_effective_time_range_limits(dataset, NOW, dashboard) is not None

    mocker.patch.dict(current_app.config, {"TIME_GRAIN_DENYLIST": ["P1W"]})
    with pytest.raises(TimeRangeLimitsInvalidError):
        get_effective_time_range_limits(dataset, NOW)
    assert get_effective_time_range_limits(sqla_table(None), NOW, dashboard)

    mocker.patch.dict(current_app.config, {"TIME_GRAIN_DENYLIST": ["PT1H"]})
    with pytest.raises(TimeRangeLimitsInvalidError):
        get_effective_time_range_limits(sqla_table(None), NOW, dashboard)


@pytest.mark.parametrize(
    "global_policy",
    [
        {},
        policy((9, "P1W"), None, None) | {"schema_version": 2},
        {"max_span": None},
        policy(None, (0, "P1D"), (0, "P1D")),
        policy((9, "P1W"), (0, "PT1H"), (0, "P1D")),
    ],
)
def test_bad_global_fails_closed(mocker: MockerFixture, global_policy: Any) -> None:
    from superset.time_range_limits.policy import (
        get_effective_time_range_limits,
        TimeRangeLimitsInvalidError,
    )

    set_global(mocker, global_policy)
    with pytest.raises(TimeRangeLimitsInvalidError):
        get_effective_time_range_limits(sqla_table(None), NOW)


def test_zero_zero_is_only_rejected_on_the_global(mocker: MockerFixture) -> None:
    from superset.time_range_limits.policy import parse_time_range_limits

    assert parse_time_range_limits(policy(None, (0, "P1D"), (0, "P1D"))) is not None
    assert resolve(None, dataset=policy(None, (0, "P1D"), (0, "P1D"))) is not None
    assert resolve(policy(None, (0, "P1D"), (1, "P1D"))) is not None


BAD_JSON_TEXTS = [
    "not json",
    "[]",
    '"text"',
    "null",
    "42",
    "{",
    pytest.param(DEEPLY_NESTED_JSON, id="deeply-nested-json"),
    pytest.param(HUGE_INTEGER_JSON, id="integer-beyond-digit-limit"),
]


BAD_JSON_TEXTS_WITH_KEY = [
    '{"time_range_limits": ',
    '["time_range_limits"]',
    '"time_range_limits"',
    pytest.param(
        "[" * 1100 + '"time_range_limits"' + "]" * 1100, id="deeply-nested-json"
    ),
]


@pytest.mark.parametrize("raw", BAD_JSON_TEXTS)
def test_effective_limits_ignore_bad_extra_without_the_key(
    mocker: MockerFixture, raw: str
) -> None:
    from superset.time_range_limits.policy import get_effective_time_range_limits

    set_global(mocker, None)
    assert get_effective_time_range_limits(sqla_table(raw), NOW) is None


@pytest.mark.parametrize("raw", BAD_JSON_TEXTS)
def test_effective_limits_ignore_bad_json_metadata_without_the_key(
    mocker: MockerFixture, raw: str
) -> None:
    from superset.models.dashboard import Dashboard
    from superset.time_range_limits.policy import get_effective_time_range_limits

    set_global(mocker, policy((90, "P1D")))
    assert get_effective_time_range_limits(
        sqla_table(None), NOW, dashboard=Dashboard(json_metadata=raw)
    ) == get_effective_time_range_limits(sqla_table(None), NOW)


@pytest.mark.parametrize("raw", BAD_JSON_TEXTS_WITH_KEY)
def test_effective_limits_reject_bad_extra(mocker: MockerFixture, raw: str) -> None:
    from superset.time_range_limits.policy import (
        get_effective_time_range_limits,
        TimeRangeLimitsInvalidError,
    )

    set_global(mocker, None)
    with pytest.raises(TimeRangeLimitsInvalidError):
        get_effective_time_range_limits(sqla_table(raw), NOW)


@pytest.mark.parametrize("raw", BAD_JSON_TEXTS_WITH_KEY)
def test_effective_limits_reject_bad_json_metadata(
    mocker: MockerFixture, raw: str
) -> None:
    from superset.models.dashboard import Dashboard
    from superset.time_range_limits.policy import (
        get_effective_time_range_limits,
        TimeRangeLimitsInvalidError,
    )

    set_global(mocker, None)
    with pytest.raises(TimeRangeLimitsInvalidError):
        get_effective_time_range_limits(
            sqla_table(None), NOW, dashboard=Dashboard(json_metadata=raw)
        )


def test_effective_limits_fail_closed_even_when_other_levels_are_fine(
    mocker: MockerFixture,
) -> None:
    from superset.time_range_limits.policy import (
        get_effective_time_range_limits,
        TimeRangeLimitsInvalidError,
    )

    set_global(mocker, policy((90, "P1D")))
    with pytest.raises(TimeRangeLimitsInvalidError):
        get_effective_time_range_limits(
            dataset_with(policy((30, "P1D"))),
            NOW,
            dashboard=dashboard_with({**policy(), "schema_version": 2}),
        )


def test_limits_unavailable_error_is_a_503_without_policy_text() -> None:
    from superset.errors import ERROR_TYPES_TO_ISSUE_CODES_MAPPING, SupersetErrorType
    from superset.time_range_limits.policy import TimeRangeLimitsUnavailableError

    error = TimeRangeLimitsUnavailableError()

    assert error.status == 503
    assert error.error.error_type == SupersetErrorType.TIME_RANGE_LIMIT_ERROR
    assert error.error.message == (
        "Time range limits could not be verified. Retry the request."
    )
    assert error.error.extra is not None
    issue_codes = error.error.extra.pop("issue_codes")
    assert [code["code"] for code in issue_codes] == [1042]
    assert error.error.extra == {"reason_code": "POLICY_UNAVAILABLE"}
    assert ERROR_TYPES_TO_ISSUE_CODES_MAPPING[error.error.error_type] == [1042]


def test_one_error_type_and_issue_code_for_the_limits() -> None:
    from superset.errors import (
        ERROR_TYPES_TO_ISSUE_CODES_MAPPING,
        ISSUE_CODES,
        SupersetErrorType,
    )

    assert SupersetErrorType.TIME_RANGE_LIMIT_ERROR == "TIME_RANGE_LIMIT_ERROR"
    assert not [name for name in SupersetErrorType if name.startswith("DATE_RANGE")]
    assert ISSUE_CODES[1042] == (
        "The time range is outside the allowed limits, or the limits can't be verified."
    )
    assert 1043 not in ISSUE_CODES
    assert [
        codes for codes in ERROR_TYPES_TO_ISSUE_CODES_MAPPING.values() if 1042 in codes
    ] == [[1042]]


# --- Validator ---


def default_limits() -> Any:
    return resolve(DEFAULT_POLICY)


@pytest.mark.parametrize(
    "since,until,global_policy",
    [
        (datetime(2026, 9, 1), datetime(2026, 10, 1), DEFAULT_POLICY),
        (datetime(2026, 7, 19), datetime(2026, 10, 17), DEFAULT_POLICY),
        (datetime(2025, 9, 16), datetime(2025, 12, 15), DEFAULT_POLICY),
        (datetime(2026, 10, 1), datetime(2026, 10, 17), DEFAULT_POLICY),
        (datetime(2026, 10, 1), datetime(2026, 10, 1), DEFAULT_POLICY),
        (datetime(2020, 1, 1), datetime(2030, 1, 1), policy(None, (20, "P1Y"))),
    ],
)
def test_validate_date_range_passes(
    since: datetime, until: datetime, global_policy: Any
) -> None:
    assert_passes(since, until, resolve(global_policy))


@pytest.mark.parametrize(
    "since,until,reason,message,rule,limit",
    [
        (
            datetime(2026, 10, 1),
            None,
            "UNBOUNDED_RANGE",
            "An end date is required.",
            None,
            None,
        ),
        (
            datetime(2026, 7, 1),
            datetime(2026, 10, 16),
            "MAX_SPAN_EXCEEDED",
            "Range can't be longer than 90 days. This one is 107 days.",
            "max_span",
            {"quantity": 90, "time_grain": "P1D"},
        ),
        (
            datetime(2025, 9, 15),
            datetime(2025, 10, 1),
            "MAX_LOOK_BACK_EXCEEDED",
            "Start can't be earlier than Sep 16, 2025 (13 months ago).",
            "max_look_back",
            {"quantity": 13, "time_grain": "P1M"},
        ),
        (
            datetime(2026, 10, 10),
            datetime(2026, 10, 17, 0, 0, 1),
            "MAX_LOOK_FORWARD_EXCEEDED",
            "End can't be later than today.",
            "max_look_forward",
            {"quantity": 0, "time_grain": "P1D"},
        ),
    ],
)
def test_validate_date_range_reasons(
    since: datetime,
    until: datetime | None,
    reason: str,
    message: str,
    rule: str | None,
    limit: dict[str, Any] | None,
) -> None:
    from superset.errors import ErrorLevel, SupersetErrorType

    ex = limit_error(since, until, default_limits(), timezone="UTC")

    assert ex.status == 400
    assert ex.error.error_type == SupersetErrorType.TIME_RANGE_LIMIT_ERROR
    assert ex.error.level == ErrorLevel.ERROR
    assert ex.error.message == message
    assert ex.message == message
    issue_codes = ex.error.extra.pop("issue_codes")
    assert [code["code"] for code in issue_codes] == [1042]
    assert ex.error.extra == {
        "reason_code": reason,
        "rule": rule,
        "source": "global" if rule else None,
        "limit": limit,
        "actual": {
            "start": since.astimezone().isoformat(),
            "end": until.astimezone().isoformat() if until else None,
        },
        "timezone": "UTC",
        "dashboard_id": None,
        "filter_id": None,
        "time_offset": None,
    }


def test_validate_date_range_extra_with_missing_values() -> None:
    ex = limit_error(
        None,
        None,
        resolve(policy((7, "P1D"))),
        timezone=None,
        time_offset="1 year ago",
    )

    ex.error.extra.pop("issue_codes")
    assert ex.error.extra == {
        "reason_code": "UNBOUNDED_RANGE",
        "rule": None,
        "source": None,
        "limit": None,
        "actual": {"start": None, "end": None},
        "timezone": None,
        "dashboard_id": None,
        "filter_id": None,
        "time_offset": "1 year ago",
    }


def test_validate_date_range_actual_has_the_server_offset() -> None:
    import os
    import time

    old_tz = os.environ.get("TZ")
    os.environ["TZ"] = "America/Sao_Paulo"
    time.tzset()
    try:
        ex = limit_error(
            datetime(2026, 6, 22),
            datetime(2026, 9, 14, 10, 30),
            span_limits((9, "P1W")),
        )
        assert ex.error.extra["actual"] == {
            "start": "2026-06-22T00:00:00-03:00",
            "end": "2026-09-14T10:30:00-03:00",
        }
    finally:
        if old_tz is None:
            del os.environ["TZ"]
        else:
            os.environ["TZ"] = old_tz
        time.tzset()


def test_dst_actual_offsets() -> None:
    import os
    import time

    old_tz = os.environ.get("TZ")
    os.environ["TZ"] = "Europe/Warsaw"
    time.tzset()
    try:
        ex = limit_error(
            datetime(2026, 3, 29, 1),
            datetime(2026, 3, 29, 12),
            span_limits((1, "PT1H")),
        )
        assert ex.error.extra["actual"] == {
            "start": "2026-03-29T01:00:00+01:00",
            "end": "2026-03-29T12:00:00+02:00",
        }
    finally:
        if old_tz is None:
            del os.environ["TZ"]
        else:
            os.environ["TZ"] = old_tz
        time.tzset()


def test_dst_actual_starts_in_the_gap() -> None:
    old_tz = os.environ.get("TZ")
    os.environ["TZ"] = "Europe/Warsaw"
    time.tzset()
    try:
        ex = limit_error(
            datetime(2026, 3, 29, 2, 30),
            datetime(2026, 3, 29, 12),
            span_limits((1, "PT1H")),
        )
        assert ex.error.extra["actual"] == {
            "start": "2026-03-29T03:30:00+02:00",
            "end": "2026-03-29T12:00:00+02:00",
        }
    finally:
        if old_tz is None:
            del os.environ["TZ"]
        else:
            os.environ["TZ"] = old_tz
        time.tzset()


@pytest.mark.parametrize(
    "value, expected",
    [
        pytest.param(
            datetime(2026, 3, 29, 1, 59, 59),
            "2026-03-29T01:59:59+01:00",
            id="dst_spring_before_the_gap",
        ),
        pytest.param(
            datetime(2026, 3, 29, 2),
            "2026-03-29T03:00:00+02:00",
            id="dst_spring_gap_start",
        ),
        pytest.param(
            datetime(2026, 3, 29, 2, 30),
            "2026-03-29T03:30:00+02:00",
            id="dst_spring_gap_middle",
        ),
        pytest.param(
            datetime(2026, 3, 29, 2, 30, fold=1),
            "2026-03-29T01:30:00+01:00",
            id="dst_spring_gap_middle_fold_1",
        ),
        pytest.param(
            datetime(2026, 3, 29, 2, 59, 59),
            "2026-03-29T03:59:59+02:00",
            id="dst_spring_gap_end",
        ),
        pytest.param(
            datetime(2026, 3, 29, 3),
            "2026-03-29T03:00:00+02:00",
            id="dst_spring_after_the_gap",
        ),
        pytest.param(
            datetime(2026, 10, 25, 1, 59, 59),
            "2026-10-25T01:59:59+02:00",
            id="dst_autumn_before_the_fold",
        ),
        pytest.param(
            datetime(2026, 10, 25, 2, 30),
            "2026-10-25T02:30:00+02:00",
            id="dst_autumn_fold_0",
        ),
        pytest.param(
            datetime(2026, 10, 25, 2, 30, fold=1),
            "2026-10-25T02:30:00+01:00",
            id="dst_autumn_fold_1",
        ),
        pytest.param(
            datetime(2026, 10, 25, 3),
            "2026-10-25T03:00:00+01:00",
            id="dst_autumn_after_the_fold",
        ),
        pytest.param(
            datetime(2026, 1, 15),
            "2026-01-15T00:00:00+01:00",
            id="dst_normal_winter_day",
        ),
        pytest.param(
            datetime(2026, 6, 22, 10, 30),
            "2026-06-22T10:30:00+02:00",
            id="dst_normal_summer_day",
        ),
        pytest.param(None, None, id="dst_none"),
    ],
)
def test_dst_actual_iso_as_python_3_12(
    value: datetime | None, expected: str | None
) -> None:
    from superset.time_range_limits.policy import _iso

    assert time.tzname == ("CET", "CEST")
    assert _iso(value) == expected


def test_validate_date_range_actual_at_the_ends_of_the_calendar() -> None:
    ex = limit_error(datetime(1, 1, 1), datetime(9999, 12, 31), span_limits((1, "P1D")))

    assert ex.error.extra["actual"]["start"] == "0001-01-01T00:00:00"
    assert ex.error.extra["actual"]["end"].startswith("9999-12-31T00:00:00")


def test_validate_date_range_no_valid_range_extra() -> None:
    ex = limit_error(
        None,
        None,
        resolve(None, dataset=policy(None, (0, "PT1H"), (0, "PT1H"))),
        dashboard_id=42,
        timezone="UTC",
    )

    ex.error.extra.pop("issue_codes")
    assert ex.error.extra == {
        "reason_code": "NO_VALID_RANGE",
        "rule": None,
        "source": None,
        "limit": None,
        "actual": {"start": None, "end": None},
        "timezone": "UTC",
        "dashboard_id": 42,
        "filter_id": None,
        "time_offset": None,
    }


def test_validate_date_range_extra_has_only_the_new_keys() -> None:
    for since, until in (
        (None, None),
        (datetime(2025, 1, 1), datetime(2026, 1, 1)),
        (datetime(2024, 1, 1), datetime(2024, 1, 2)),
        (datetime(2026, 10, 1), datetime(2026, 11, 1)),
    ):
        ex = limit_error(since, until, default_limits())
        ex.error.extra.pop("issue_codes")
        assert set(ex.error.extra) == {
            "reason_code",
            "rule",
            "source",
            "limit",
            "actual",
            "timezone",
            "dashboard_id",
            "filter_id",
            "time_offset",
        }
        for old_key in (
            "reason",
            "since",
            "until",
            "max_range",
            "max_range_binding",
            "earliest_start",
            "latest_end",
        ):
            assert old_key not in ex.error.extra


@pytest.mark.parametrize(
    "since,until,dataset,reason",
    [
        (None, None, policy(None, (0, "PT1H"), (0, "PT1H")), "NO_VALID_RANGE"),
        (None, datetime(2030, 1, 1), DEFAULT_POLICY, "UNBOUNDED_RANGE"),
        (datetime(2020, 1, 1), None, DEFAULT_POLICY, "UNBOUNDED_RANGE"),
        (
            datetime(2020, 1, 1),
            datetime(2030, 1, 1),
            DEFAULT_POLICY,
            "MAX_SPAN_EXCEEDED",
        ),
        (
            datetime(2025, 9, 1),
            datetime(2026, 10, 18),
            policy(None, (13, "P1M"), (0, "P1D")),
            "MAX_LOOK_BACK_EXCEEDED",
        ),
    ],
)
def test_validate_date_range_first_failure_wins(
    since: datetime | None,
    until: datetime | None,
    dataset: Any,
    reason: str,
) -> None:
    limits = resolve(None, dataset=dataset)

    assert limit_error(since, until, limits).error.extra["reason_code"] == reason


def test_validate_date_range_extra_without_span() -> None:
    ex = limit_error(
        datetime(2025, 9, 1),
        datetime(2026, 10, 18),
        resolve(policy(None, (13, "P1M"), (0, "P1D"))),
    )

    assert ex.error.extra["reason_code"] == "MAX_LOOK_BACK_EXCEEDED"
    assert ex.error.extra["source"] == "global"
    assert ex.error.extra["limit"] == {
        "quantity": 13,
        "time_grain": "P1M",
    }


def test_validate_date_range_impossible_policy_sub_day_zeros() -> None:
    limits = resolve(
        None,
        dataset=policy(None, (0, "PT1H")),
        dashboard=policy(None, None, (0, "PT1H")),
    )
    ex = limit_error(datetime(2026, 10, 16, 14), NOW, limits)

    assert ex.error.extra["reason_code"] == "NO_VALID_RANGE"
    assert ex.error.extra["limit"] is None
    assert ex.error.message == (
        "No time range fits the limits: the earliest start (now) is not before the "
        "latest end (now). Ask an editor or admin to fix the limits."
    )


def test_validate_date_range_impossible_policy_at_midnight() -> None:
    limits = resolve(
        None,
        dataset=policy(None, (0, "P1D")),
        dashboard=policy(None, None, (0, "PT1H")),
        now=datetime(2026, 10, 16),
    )
    ex = limit_error(datetime(2026, 10, 16), datetime(2026, 10, 16), limits)

    assert ex.error.extra["reason_code"] == "NO_VALID_RANGE"
    assert ex.error.message == (
        "No time range fits the limits: the earliest start (today) is not before the "
        "latest end (now). Ask an editor or admin to fix the limits."
    )


def test_validate_date_range_impossible_policy_with_dates() -> None:
    limits = resolve(
        None,
        dataset=policy(None, (2, "PT1H")),
        dashboard=policy(None, None, (0, "PT1H")),
        now=datetime(2026, 10, 16, 0, 30),
    )
    assert limits.earliest_start.value < limits.latest_end.value
    assert_passes(datetime(2026, 10, 16), datetime(2026, 10, 16, 0, 30), limits)

    from superset.time_range_limits.policy import Bound, ResolvedTimeRangeLimits

    swapped = ResolvedTimeRangeLimits(
        earliest_start=Bound(
            datetime(2026, 10, 16, 16, 30), constraint("dashboard", 2, "PT1H")
        ),
        latest_end=Bound(datetime(2026, 10, 9), constraint("dataset", 1, "P1W")),
    )
    ex = limit_error(datetime(2026, 10, 1), datetime(2026, 10, 2), swapped)
    assert ex.error.message == (
        "No time range fits the limits: the earliest start (Oct 16, 2026 16:30 "
        "(2 hours ago)) is not before the latest end (Oct 8, 2026 (1 week from "
        "now)). Ask an editor or admin to fix the limits."
    )


@pytest.mark.parametrize(
    "since,until,message",
    [
        (
            None,
            datetime(2026, 10, 1),
            "Choose a start and an end date. Time range limits are on.",
        ),
        (datetime(2026, 10, 1), None, "An end date is required."),
        (None, None, "Choose a start and an end date. Time range limits are on."),
    ],
)
def test_validate_date_range_open_range(
    since: datetime | None, until: datetime | None, message: str
) -> None:
    ex = limit_error(since, until, default_limits())

    assert ex.error.extra["reason_code"] == "UNBOUNDED_RANGE"
    assert ex.error.message == message


@pytest.mark.parametrize(
    "since,until",
    [
        (None, datetime(2026, 10, 1)),
        (datetime(2026, 10, 1), None),
        (None, None),
    ],
)
def test_validate_date_range_open_range_on_a_dashboard(
    since: datetime | None, until: datetime | None
) -> None:
    ex = limit_error(since, until, default_limits(), dashboard_id=42)

    assert ex.error.extra["reason_code"] == "UNBOUNDED_RANGE"
    assert ex.error.extra["dashboard_id"] == 42
    assert ex.error.message == (
        "This chart requires a bounded time range. Ask a dashboard editor to add or "
        "scope a time range filter."
    )


@pytest.mark.parametrize(
    "since,until,message",
    [
        (
            None,
            datetime(2026, 10, 1),
            "Choose a start and an end date. Time range limits are on.",
        ),
        (datetime(2026, 10, 1), None, "An end date is required."),
        (
            None,
            None,
            "Choose a start and an end date. Time range limits are on.",
        ),
    ],
)
def test_validate_date_range_open_range_of_a_filter_preview_on_a_dashboard(
    since: datetime | None, until: datetime | None, message: str
) -> None:
    ex = limit_error(
        since, until, default_limits(), dashboard_id=42, filter_preview=True
    )

    assert ex.error.extra["reason_code"] == "UNBOUNDED_RANGE"
    assert ex.error.extra["dashboard_id"] == 42
    assert ex.error.message == message


def test_validate_date_range_open_range_without_any_constraint() -> None:
    from superset.time_range_limits.policy import ResolvedTimeRangeLimits

    assert limit_error(None, None, ResolvedTimeRangeLimits()).error.extra[
        "reason_code"
    ] == ("UNBOUNDED_RANGE")


def test_validate_date_range_since_after_until() -> None:
    from superset.time_range_limits.policy import validate_date_range

    with pytest.raises(ValueError, match="since must not be later than until"):
        validate_date_range(
            datetime(2026, 10, 2),
            datetime(2026, 10, 1),
            default_limits(),
            timezone="UTC",
        )


@pytest.mark.parametrize(
    "since,until,days",
    [
        (datetime(2026, 1, 1), datetime(2026, 4, 1, 0, 0, 1), 91),
        (datetime(2026, 1, 1), datetime(2026, 4, 2), 91),
        (datetime(2026, 1, 1, 12), datetime(2026, 4, 2), 91),
    ],
)
def test_validate_date_range_rounds_days_up(
    since: datetime, until: datetime, days: int
) -> None:
    ex = limit_error(since, until, span_limits((90, "P1D")))

    assert ex.error.message == (
        f"Range can't be longer than 90 days. This one is {days} days."
    )


def test_validate_date_range_one_day_limit_message() -> None:
    ex = limit_error(
        datetime(2026, 1, 1), datetime(2026, 1, 2, 0, 0, 1), span_limits((1, "P1D"))
    )

    assert ex.error.message == "Range can't be longer than 1 day. This one is 2 days."


@pytest.mark.parametrize(
    "rule,now,shown",
    [
        ((13, "P1M"), NOW, "Sep 16, 2025 (13 months ago)"),
        ((0, "P1D"), NOW, "today"),
        ((6, "PT1H"), NOW, "Oct 16, 2026 08:30 (6 hours ago)"),
        ((0, "PT1H"), NOW, "now"),
        ((0, "PT1S"), NOW, "now"),
        ((1, "P1W"), NOW, "Oct 9, 2026 (1 week ago)"),
        ((2, "P3M"), NOW, "Apr 16, 2026 (2 quarters ago)"),
        ((3, "PT5M"), NOW, "Oct 16, 2026 14:15 (15 minutes ago)"),
        (
            (6, "PT30S"),
            datetime(2026, 10, 16, 14, 30, 15, 250000),
            "Oct 16, 2026 14:27:15 (180 seconds ago)",
        ),
        ((2, "PT1S"), NOW, "Oct 16, 2026 14:29:58 (2 seconds ago)"),
        (
            (1, "P1D"),
            datetime(2026, 10, 16, 14, 30, 7),
            "Oct 15, 2026 (1 day ago)",
        ),
        (
            (1, "PT1H"),
            datetime(2026, 10, 16, 14, 30, 7),
            "Oct 16, 2026 13:30:07 (1 hour ago)",
        ),
    ],
)
def test_start_message(rule: Rule, now: datetime, shown: str) -> None:
    ex = limit_error(
        datetime(2024, 1, 1), datetime(2024, 1, 2), resolve(policy(None, rule), now=now)
    )

    assert ex.error.message == f"Start can't be earlier than {shown}."


@pytest.mark.parametrize(
    "rule,shown",
    [
        ((0, "P1D"), "today"),
        ((0, "PT1H"), "now"),
        ((1, "P1W"), "Oct 23, 2026 (1 week from now)"),
        ((2, "PT1H"), "Oct 16, 2026 16:30 (2 hours from now)"),
        ((1, "P1M"), "Nov 16, 2026 (1 month from now)"),
        ((1, "P3M"), "Jan 16, 2027 (1 quarter from now)"),
        ((3, "PT30M"), "Oct 16, 2026 16:00 (90 minutes from now)"),
    ],
)
def test_end_message(rule: Rule, shown: str) -> None:
    ex = limit_error(
        datetime(2027, 1, 1),
        datetime(2027, 6, 2),
        resolve(policy(None, None, rule)),
    )

    assert ex.error.message == f"End can't be later than {shown}."


@pytest.mark.parametrize(
    "span,since,until,message",
    [
        (
            (90, "P1D"),
            datetime(2025, 1, 1),
            datetime(2026, 1, 1),
            "Range can't be longer than 90 days. This one is 365 days.",
        ),
        (
            (1, "P1D"),
            datetime(2025, 1, 1),
            datetime(2025, 1, 2, 0, 1),
            "Range can't be longer than 1 day. This one is 2 days.",
        ),
        (
            (3, "P1M"),
            datetime(2025, 2, 27),
            datetime(2025, 5, 31),
            "Range can't be longer than 3 months. This one is 3 months and 4 days.",
        ),
        (
            (1, "P1Y"),
            datetime(2023, 1, 1),
            datetime(2025, 1, 1),
            "Range can't be longer than 1 year. This one is 2 years.",
        ),
        (
            (2, "P1W"),
            datetime(2025, 1, 1),
            datetime(2025, 1, 18),
            "Range can't be longer than 2 weeks. This one is 2 weeks and 3 days.",
        ),
        (
            (3, "P1M"),
            datetime(2025, 1, 15, 10),
            datetime(2025, 4, 15, 10, 1),
            "Range can't be longer than 3 months. This one is 3 months and 1 day.",
        ),
        (
            (1, "P3M"),
            datetime(2025, 1, 1),
            datetime(2025, 7, 15),
            "Range can't be longer than 1 quarter. This one is 2 quarters and 14 days.",
        ),
        (
            (2, "P3M"),
            datetime(2025, 1, 1),
            datetime(2025, 9, 1),
            "Range can't be longer than 2 quarters. This one is 2 quarters and 62 "
            "days.",
        ),
        (
            (3, "P1M"),
            datetime(2025, 1, 1),
            datetime(2025, 6, 1),
            "Range can't be longer than 3 months. This one is 5 months.",
        ),
        (
            (1, "P1M"),
            datetime(2015, 1, 1),
            datetime(2025, 1, 1),
            "Range can't be longer than 1 month. This one is 120 months.",
        ),
        (
            (1, "P1M"),
            datetime(2025, 1, 31),
            datetime(2025, 4, 30),
            "Range can't be longer than 1 month. This one is 3 months.",
        ),
        (
            (3, "PT5M"),
            datetime(2026, 10, 16, 14, 14),
            datetime(2026, 10, 16, 14, 30),
            "Range can't be longer than 15 minutes. This one is 16 minutes.",
        ),
        (
            (3, "PT5M"),
            datetime(2026, 10, 16, 14),
            datetime(2026, 10, 16, 14, 15, 1),
            "Range can't be longer than 15 minutes. This one is 16 minutes.",
        ),
        (
            (6, "PT1H"),
            datetime(2026, 10, 16, 8),
            datetime(2026, 10, 16, 14, 30),
            "Range can't be longer than 6 hours. This one is 7 hours.",
        ),
        (
            (2, "PT30S"),
            datetime(2026, 10, 16, 14, 29),
            datetime(2026, 10, 16, 14, 30, 0, 1),
            "Range can't be longer than 60 seconds. This one is 61 seconds.",
        ),
        (
            (1, "PT1H"),
            datetime(2026, 10, 15),
            datetime(2026, 10, 16),
            "Range can't be longer than 1 hour. This one is 24 hours.",
        ),
    ],
)
def test_validate_date_range_too_long_message(
    span: Rule, since: datetime, until: datetime, message: str
) -> None:
    ex = limit_error(since, until, span_limits(span))

    assert ex.error.message == message


@pytest.mark.parametrize(
    "grain,since,until,message",
    [
        (
            "P0.25Y",
            datetime(2025, 1, 1),
            datetime(2025, 9, 1),
            "Range can't be longer than 2 quarters. This one is 2 quarters and 62 "
            "days.",
        ),
        (
            "PT0.5H",
            datetime(2026, 10, 16, 12),
            datetime(2026, 10, 16, 14, 30),
            "Range can't be longer than 60 minutes. This one is 150 minutes.",
        ),
        (
            "P2W",
            datetime(2025, 1, 1),
            datetime(2025, 2, 18),
            "Range can't be longer than 4 weeks. This one is 6 weeks and 6 days.",
        ),
    ],
)
def test_too_long_message_with_addons(
    mocker: MockerFixture, grain: str, since: datetime, until: datetime, message: str
) -> None:
    mocker.patch.dict(
        current_app.config,
        {
            "TIME_GRAIN_ADDONS": {**ALIAS_ADDONS["TIME_GRAIN_ADDONS"], "P2W": "2 week"},
            "TIME_GRAIN_ADDON_EXPRESSIONS": {
                "sqlite": {"PT0.5H": "x", "P0.25Y": "x", "P2W": "x"}
            },
        },
    )

    ex = limit_error(since, until, resolve(policy((2, grain))))

    assert ex.error.message == message


def test_limit_words_for_aliases(mocker: MockerFixture) -> None:
    mocker.patch.dict(current_app.config, ALIAS_ADDONS)

    quarters = limit_error(
        datetime(2026, 1, 1), NOW, resolve(policy(None, (2, "P0.25Y")))
    )
    minutes = limit_error(
        datetime(2026, 10, 16), NOW, resolve(policy(None, (3, "PT0.5H")))
    )

    assert quarters.error.message == (
        "Start can't be earlier than Apr 16, 2026 (2 quarters ago)."
    )
    assert minutes.error.message == (
        "Start can't be earlier than Oct 16, 2026 13:00 (90 minutes ago)."
    )
    assert minutes.error.extra["limit"]["time_grain"] == "PT0.5H"


@pytest.mark.parametrize(
    "span,message",
    [
        (
            (1, "P1W"),
            "Range can't be longer than 1 week. This one is 521722 weeks and 4 days.",
        ),
        (
            (1, "P1M"),
            "Range can't be longer than 1 month. This one is 119987 months and 30 "
            "days.",
        ),
        (
            (1, "P1Y"),
            "Range can't be longer than 1 year. This one is 9998 years and 364 days.",
        ),
        (
            (1, "PT1S"),
            "Range can't be longer than 1 second. This one is 315537811200 seconds.",
        ),
    ],
)
def test_validate_date_range_too_long_message_is_fast(span: Rule, message: str) -> None:
    import time

    started = time.perf_counter()
    ex = limit_error(datetime(1, 1, 1), datetime(9999, 12, 31), span_limits(span))

    assert time.perf_counter() - started < 1
    assert ex.error.message == message


def test_validate_date_range_time_comparison_prefix() -> None:
    ex = limit_error(
        datetime(2025, 7, 18),
        datetime(2025, 10, 16),
        default_limits(),
        time_offset="1 year ago",
    )

    assert ex.error.message == (
        'Time comparison "1 year ago": '
        "Start can't be earlier than Sep 16, 2025 (13 months ago)."
    )
    assert ex.error.extra["time_offset"] == "1 year ago"


def test_comparison_range_gets_every_rule() -> None:
    ex = limit_error(
        datetime(2024, 2, 28),
        datetime(2024, 5, 31),
        resolve(policy((3, "P1M"))),
        time_offset="1 year ago",
    )

    assert ex.error.extra["reason_code"] == "MAX_SPAN_EXCEEDED"
    assert ex.error.extra["time_offset"] == "1 year ago"
    assert ex.error.message == (
        'Time comparison "1 year ago": '
        "Range can't be longer than 3 months. This one is 3 months and 3 days."
    )


def test_validate_date_range_does_not_read_the_clock() -> None:
    from superset.time_range_limits.policy import validate_date_range

    limits = default_limits()
    sub_day = resolve(policy(None, (6, "PT1H"), (2, "PT1H")))
    results = []
    # The first moment is the earliest start's day, so a bound shown from the clock
    # (e.g. as "today") would change the message.
    for moment in ("2025-09-16 12:00", "2030-06-15 12:00"):
        with freeze_time(moment):
            validate_date_range(
                datetime(2026, 9, 1), datetime(2026, 10, 1), limits, timezone="UTC"
            )
            ex = limit_error(datetime(2025, 9, 15), datetime(2025, 10, 1), limits)
            too_long = limit_error(
                datetime(2026, 2, 27), datetime(2026, 5, 31), span_limits((3, "P1M"))
            )
            early = limit_error(datetime(2026, 10, 16, 8), NOW, sub_day)
            results.append(
                (
                    ex.error.message,
                    ex.error.extra,
                    too_long.error.message,
                    too_long.error.extra,
                    early.error.message,
                )
            )

    assert results[0] == results[1]


def test_resolver_does_not_read_the_clock() -> None:
    from superset.time_range_limits import policy as module

    results = []
    for moment in ("2025-09-16 12:00", "2030-06-15 12:00"):
        with freeze_time(moment):
            results.append(
                resolve(
                    policy((90, "P1D"), (6, "PT1H"), (0, "P1D")),
                    dataset=policy(None, (13, "P1M"), (2, "PT1H")),
                )
            )
    assert results[0] == results[1]

    with open(module.__file__, encoding="utf-8") as source_file:
        source = source_file.read()
    assert "datetime.now" not in source
    assert "utcnow" not in source
    assert "date.today" not in source


def test_error_type_is_in_the_frontend_enum() -> None:
    from pathlib import Path

    from superset.errors import SupersetErrorType

    query_ts = (
        Path(__file__).parents[3]
        / "superset-frontend/packages/superset-ui-core/src/query/types/Query.ts"
    )

    assert SupersetErrorType.TIME_RANGE_LIMIT_ERROR == "TIME_RANGE_LIMIT_ERROR"
    source = query_ts.read_text()
    assert "  TIME_RANGE_LIMIT_ERROR: 'TIME_RANGE_LIMIT_ERROR',\n" in source
    assert "  TIME_RANGE_LIMIT:" not in source


EXAMPLE_GLOBAL = policy((12, "P1W"), (12, "P1M"), (3, "P1M"))
ZERO_WINDOW = "Look-back and look-forward can't both be 0: no time range would fit."


def set_flag(mocker: MockerFixture, enabled: bool) -> None:
    from superset.extensions import feature_flag_manager

    flags = feature_flag_manager._feature_flags or {}
    mocker.patch.object(
        feature_flag_manager,
        "get_feature_flags",
        return_value={**flags, FEATURE_FLAG: enabled},
    )


@pytest.fixture
def limits_on(mocker: MockerFixture) -> None:
    set_flag(mocker, True)


def check(
    raw: Any,
    global_policy: Any = EXAMPLE_GLOBAL,
    stored: Any = None,
    level: str = "dashboard",
) -> dict[str, list[str]]:
    from superset.time_range_limits.policy import (
        check_stricter_than_global,
        parse_time_range_limits,
    )

    with patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": global_policy}):
        return check_stricter_than_global(parse_time_range_limits(raw), stored, level)


def comparison(
    raw: Any,
    expected: Any = None,
    *,
    global_policy: Any = EXAMPLE_GLOBAL,
    stored: Any = None,
    level: str = "dashboard",
) -> tuple[Any, Any, Any, str, Any]:
    """Describe one comparison without repeating the unchanged defaults."""
    return raw, global_policy, stored, level, {} if expected is None else expected


@pytest.mark.parametrize(
    "enabled,config,cases",
    [
        pytest.param(
            True, {}, [comparison(policy((9, "P1W")))], id="accepts_tighter_or_equal-0"
        ),
        pytest.param(
            True,
            {},
            [comparison(policy((12, "P1W"), (12, "P1M"), (3, "P1M")))],
            id="accepts_tighter_or_equal-1",
        ),
        pytest.param(
            True,
            {},
            [comparison(policy((1, "P1W"), (0, "P1M")))],
            id="accepts_tighter_or_equal-2",
        ),
        pytest.param(
            True,
            {},
            [comparison(policy(None, (6, "P1M"), (0, "P1M")))],
            id="accepts_tighter_or_equal-3",
        ),
        pytest.param(
            True,
            {},
            [
                comparison(
                    policy((13, "P1W")),
                    {
                        "max_span.quantity": [
                            "Dashboard maximum span must be 12 weeks or less."
                        ]
                    },
                ),
                comparison(
                    policy(None, (13, "P1M"), (4, "P1M")),
                    {
                        "max_look_back.quantity": [
                            "Dashboard maximum look-back must be 12 months or less."
                        ],
                        "max_look_forward.quantity": [
                            "Dashboard maximum look-forward must be 3 months or less."
                        ],
                    },
                ),
            ],
            id="quantity",
        ),
        pytest.param(
            True,
            {},
            [
                comparison(policy((2, "P1M"), (365, "P1D"), (12, "P1W"))),
                comparison(
                    policy((3, "P1M"), (366, "P1D"), (13, "P1W")),
                    {
                        "max_span.quantity": [
                            "Dashboard maximum span must be 12 weeks or less."
                        ],
                        "max_look_back.quantity": [
                            "Dashboard maximum look-back must be 12 months or less."
                        ],
                        "max_look_forward.quantity": [
                            "Dashboard maximum look-forward must be 3 months or less."
                        ],
                    },
                ),
                comparison(
                    policy((1, "PT1H")),
                    {
                        "max_span.time_grain": [
                            "Dashboard maximum span must be 12 weeks or less. "
                            "Use a unit of a day or longer."
                        ]
                    },
                ),
            ],
            id="unit",
        ),
        pytest.param(
            True,
            ALIAS_ADDONS,
            [
                comparison(policy((2, "PT0.5H")), global_policy=policy((2, "PT30M"))),
                comparison(policy((4, "P0.25Y")), global_policy=policy((1, "P1Y"))),
                comparison(
                    policy((3, "PT0.5H")),
                    {
                        "max_span.quantity": [
                            "Dashboard maximum span must be 60 minutes or less."
                        ]
                    },
                    global_policy=policy((2, "PT30M")),
                ),
            ],
            id="compares_aliases_by_length",
        ),
        pytest.param(
            True,
            {},
            [
                comparison(policy((2, "PT1H")), global_policy=policy((8, "PT15M"))),
                comparison(
                    policy((3, "PT1H")),
                    {
                        "max_span.quantity": [
                            "Dashboard maximum span must be 120 minutes or less."
                        ]
                    },
                    global_policy=policy((8, "PT15M")),
                ),
                comparison(
                    policy((1, "P1D")),
                    {
                        "max_span.time_grain": [
                            "Dashboard maximum span must be 120 minutes or less. "
                            "Use a unit shorter than a day."
                        ]
                    },
                    global_policy=policy((8, "PT15M")),
                ),
            ],
            id="unit_label_of_a_multi_count_grain",
        ),
        pytest.param(
            True,
            {},
            [
                comparison(
                    policy((13, "P1W")),
                    {
                        "max_span.quantity": [
                            "Dataset maximum span must be 12 weeks or less."
                        ]
                    },
                    level="dataset",
                ),
                comparison(policy((2, "P1M")), level="dataset"),
                comparison(
                    policy((3, "P1M")),
                    {
                        "max_span.quantity": [
                            "Dataset maximum span must be 12 weeks or less."
                        ]
                    },
                    level="dataset",
                ),
                comparison(
                    policy((1, "PT1H")),
                    {
                        "max_span.time_grain": [
                            "Dataset maximum span must be 12 weeks or less. "
                            "Use a unit of a day or longer."
                        ]
                    },
                    level="dataset",
                ),
            ],
            id="dataset_level",
        ),
        pytest.param(
            True,
            {},
            [
                comparison(policy()),
                comparison(None),
                comparison(policy(None, None, (3, "P1M"))),
            ],
            id="null_rules_and_no_policy",
        ),
        pytest.param(
            True,
            {},
            [
                comparison(
                    policy(None, (9999, "P1Y"), (2, "P1Y")),
                    global_policy=policy((12, "P1W")),
                ),
                comparison(policy((9999, "P1D")), global_policy=None),
            ],
            id="rule_the_global_does_not_set",
        ),
        pytest.param(
            True,
            {},
            [
                comparison(
                    policy((9, "P1W"), (20, "P1M")),
                    global_policy=policy((2, "P1M")),
                    stored={
                        "max_look_back": {"time_grain": "P1M", "quantity": 20},
                        "schema_version": 1,
                        "max_look_forward": None,
                        "max_span": {"time_grain": "P1W", "quantity": 9},
                    },
                ),
                comparison(
                    policy((10, "P1W"), (20, "P1M")),
                    {
                        "max_span.quantity": [
                            "Dashboard maximum span must be 2 months or less."
                        ]
                    },
                    global_policy=policy((2, "P1M")),
                    stored={
                        "max_look_back": {"time_grain": "P1M", "quantity": 20},
                        "schema_version": 1,
                        "max_look_forward": None,
                        "max_span": {"time_grain": "P1W", "quantity": 9},
                    },
                ),
                comparison(
                    policy((8, "P1W"), (20, "P1M")),
                    global_policy=policy((2, "P1M")),
                    stored={
                        "max_look_back": {"time_grain": "P1M", "quantity": 20},
                        "schema_version": 1,
                        "max_look_forward": None,
                        "max_span": {"time_grain": "P1W", "quantity": 9},
                    },
                ),
                comparison(
                    policy((9, "P1W"), (20, "P1M")),
                    stored={
                        "max_look_back": {"time_grain": "P1M", "quantity": 20},
                        "schema_version": 1,
                        "max_look_forward": None,
                        "max_span": {"time_grain": "P1W", "quantity": 9},
                    },
                ),
                comparison(
                    policy((9, "P1W"), (20, "P1M")),
                    {
                        "max_look_back.quantity": [
                            "Dashboard maximum look-back must be 12 months or less."
                        ]
                    },
                    stored={
                        "max_span": {
                            "max_look_back": {"time_grain": "P1M", "quantity": 20},
                            "schema_version": 1,
                            "max_look_forward": None,
                            "max_span": {"time_grain": "P1W", "quantity": 9},
                        }["max_span"]
                    },
                ),
                comparison(
                    policy((9, "P1W"), (20, "P1M")),
                    {
                        "max_look_back.quantity": [
                            "Dashboard maximum look-back must be 12 months or less."
                        ]
                    },
                ),
            ],
            id="checks_only_changed_rules",
        ),
        pytest.param(
            True,
            {},
            [
                comparison(
                    policy(None, (0, "P1M")),
                    {"max_look_forward.quantity": [ZERO_WINDOW]},
                    global_policy=policy(None, (12, "P1M"), (0, "P1D")),
                )
            ],
            id="zero_window_with_a_global",
        ),
        pytest.param(
            True,
            {},
            [
                comparison(
                    policy(None, (0, "P1D"), (0, "PT1H")),
                    {"max_look_forward.quantity": [ZERO_WINDOW]},
                    global_policy=None,
                )
            ],
            id="zero_window_without_a_global",
        ),
        pytest.param(
            True,
            {},
            [
                comparison(
                    policy(None, (0, "P1D"), (0, "PT1H")),
                    global_policy=None,
                    stored={
                        "schema_version": 1,
                        "max_span": None,
                        "max_look_back": {"quantity": 0, "time_grain": "P1D"},
                        "max_look_forward": {"quantity": 0, "time_grain": "PT1H"},
                    },
                ),
                comparison(
                    policy(None, (0, "P1D"), (0, "PT1H")),
                    stored={
                        "schema_version": 1,
                        "max_span": None,
                        "max_look_back": {"quantity": 0, "time_grain": "P1D"},
                        "max_look_forward": {"quantity": 0, "time_grain": "PT1H"},
                    },
                ),
            ],
            id="zero_window_unchanged",
        ),
        pytest.param(
            True,
            {},
            [
                comparison(
                    policy(None, (0, "P1M"), (5, "P1D")),
                    {
                        "max_look_forward.quantity": [
                            "Dashboard maximum look-forward must be 0 days or less.",
                            ZERO_WINDOW,
                        ]
                    },
                    global_policy=policy(None, (12, "P1M"), (0, "P1D")),
                )
            ],
            id="appends_to_the_same_field",
        ),
        pytest.param(
            False,
            {},
            [
                comparison(policy((13, "P1M")), global_policy={}),
                comparison(policy(None, (0, "P1D"), (0, "P1D")), global_policy=None),
            ],
            id="flag_off-0",
        ),
        pytest.param(
            False,
            {},
            [
                comparison(
                    policy((13, "P1M")),
                    global_policy=policy(None, (0, "P1D"), (0, "P1D")),
                ),
                comparison(policy(None, (0, "P1D"), (0, "P1D")), global_policy=None),
            ],
            id="flag_off-1",
        ),
        pytest.param(
            False,
            {},
            [
                comparison(policy((13, "P1M"))),
                comparison(policy(None, (0, "P1D"), (0, "P1D")), global_policy=None),
            ],
            id="flag_off-2",
        ),
        pytest.param(
            True,
            {"TIME_GRAIN_DENYLIST": ["P1W"]},
            [
                comparison(
                    policy((1, "P1D")),
                    TimeRangeLimitsUnavailableError,
                    global_policy={},
                ),
                comparison(None, global_policy={}),
            ],
            id="bad_global_is_unavailable-0",
        ),
        pytest.param(
            True,
            {"TIME_GRAIN_DENYLIST": ["P1W"]},
            [
                comparison(
                    policy((1, "P1D")),
                    TimeRangeLimitsUnavailableError,
                    global_policy=policy(None, (0, "P1D"), (0, "P1D")),
                ),
                comparison(None, global_policy=policy(None, (0, "P1D"), (0, "P1D"))),
            ],
            id="bad_global_is_unavailable-1",
        ),
        pytest.param(
            True,
            {"TIME_GRAIN_DENYLIST": ["P1W"]},
            [
                comparison(
                    policy((1, "P1D")),
                    TimeRangeLimitsUnavailableError,
                    global_policy=policy((12, "P1W")),
                ),
                comparison(None, global_policy=policy((12, "P1W"))),
            ],
            id="bad_global_is_unavailable-2",
        ),
    ],
)
def test_stricter_than_global(
    mocker: MockerFixture,
    enabled: bool,
    config: dict[str, Any],
    cases: list[tuple[Any, Any, Any, str, Any]],
) -> None:
    from superset.time_range_limits.policy import TimeRangeLimitsUnavailableError

    set_flag(mocker, enabled)
    mocker.patch.dict(current_app.config, config)
    for raw, global_policy, stored, level, expected in cases:
        if expected is TimeRangeLimitsUnavailableError:
            with pytest.raises(TimeRangeLimitsUnavailableError):
                check(raw, global_policy=global_policy, stored=stored, level=level)
        else:
            assert (
                check(raw, global_policy=global_policy, stored=stored, level=level)
                == expected
            )


@pytest.mark.parametrize(
    "level,raw,field,message",
    [
        (
            "dashboard",
            policy((13, "P1W")),
            "max_span.quantity",
            "Dashboard maximum span must be 12 weeks or less.",
        ),
        (
            "dashboard",
            policy(None, (13, "P1M")),
            "max_look_back.quantity",
            "Dashboard maximum look-back must be 12 months or less.",
        ),
        (
            "dashboard",
            policy(None, None, (4, "P1M")),
            "max_look_forward.quantity",
            "Dashboard maximum look-forward must be 3 months or less.",
        ),
        (
            "dataset",
            policy((13, "P1W")),
            "max_span.quantity",
            "Dataset maximum span must be 12 weeks or less.",
        ),
        (
            "dataset",
            policy(None, (13, "P1M")),
            "max_look_back.quantity",
            "Dataset maximum look-back must be 12 months or less.",
        ),
        (
            "dataset",
            policy(None, None, (4, "P1M")),
            "max_look_forward.quantity",
            "Dataset maximum look-forward must be 3 months or less.",
        ),
    ],
)
def test_one_message_per_level_and_rule(
    limits_on: None, level: str, raw: dict[str, Any], field: str, message: str
) -> None:
    assert check(raw, level=level) == {field: [message]}


@pytest.mark.parametrize(
    "raw,stored,looked_up,errors",
    [
        (policy((12, "P1W")), policy((20, "P1W")), False, {}),
        (policy((13, "P1W")), None, True, {"max_span.quantity": 1}),
        (policy((13, "P1W")), policy((13, "P1W")), True, {}),
    ],
)
def test_importers_look_up_the_stored_row_only_on_errors(
    limits_on: None,
    mocker: MockerFixture,
    raw: dict[str, Any],
    stored: dict[str, Any] | None,
    looked_up: bool,
    errors: dict[str, int],
) -> None:
    from superset.commands.dashboard.importers.v0 import (
        _json_metadata_limits_errors,
    )
    from superset.commands.dataset.importers.v0 import extra_limits_errors

    text = json.dumps({"time_range_limits": raw})
    row = sqla_table(json.dumps({"time_range_limits": stored}))
    row.json_metadata = row.extra
    for helper in (extra_limits_errors, _json_metadata_limits_errors):
        find_existing = mocker.Mock(return_value=row if stored else None)
        with patch.dict(
            current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": EXAMPLE_GLOBAL}
        ):
            result = helper(text, find_existing)
        assert find_existing.call_count == int(looked_up)
        assert {
            path.removeprefix("time_range_limits."): len(messages)
            for path, messages in result.items()
        } == errors


@pytest.mark.parametrize(
    ("value", "limit", "expected"),
    [
        ((90, "P1D"), (1, "P1Y"), True),
        ((12, "P1M"), (1, "P1Y"), True),
        ((1, "P1Y"), (12, "P1M"), True),
        ((52, "P1W"), (1, "P1Y"), True),
        ((365, "P1D"), (1, "P1Y"), True),
        ((366, "P1D"), (1, "P1Y"), False),
        ((4, "P1W"), (1, "P1M"), True),
        ((5, "P1W"), (1, "P1M"), False),
        ((28, "P1D"), (1, "P1M"), True),
        ((31, "P1D"), (1, "P1M"), False),
        ((1, "P3M"), (3, "P1M"), True),
        ((3, "P1M"), (1, "P3M"), True),
        ((4, "P3M"), (1, "P1Y"), True),
        ((1, "P1Y"), (4, "P3M"), True),
        ((3, "P1M"), (90, "P1D"), False),
        ((90, "P1D"), (3, "P1M"), False),
        ((1, "P1Y"), (365, "P1D"), False),
        ((1, "P1Y"), (366, "P1D"), True),
        ((2, "P1M"), (9, "P1W"), True),
        ((9, "P1W"), (2, "P1M"), False),
        ((9, "P1W"), (9, "P1W"), True),
        ((10, "P1W"), (9, "P1W"), False),
        ((7, "P1D"), (1, "P1W"), True),
        ((8, "P1D"), (1, "P1W"), False),
        ((24, "PT15M"), (1, "PT6H"), True),
        ((25, "PT15M"), (1, "PT6H"), False),
        ((2, "PT30M"), (1, "PT1H"), True),
        ((1, "PT1H"), (2, "PT30M"), True),
        ((2, "PT0.5H"), (1, "PT1H"), True),
        ((4, "P0.25Y"), (1, "P1Y"), True),
        ((60, "PT1S"), (1, "PT1M"), True),
        ((61, "PT1S"), (1, "PT1M"), False),
        ((0, "P1D"), (0, "P1M"), True),
        ((1, "P1D"), (0, "P1M"), False),
        ((48, "PT1H"), (2, "P1D"), False),
        ((2, "P1D"), (48, "PT1H"), False),
        ((1, "PT1S"), (1, "P1Y"), False),
        ((0, "PT1H"), (0, "P1D"), False),
        ((1, "P1D"), (1, "P1X"), False),
    ],
)
def test_never_longer(value: Rule, limit: Rule, expected: bool) -> None:
    from superset.time_range_limits.policy import never_longer, Rule as LimitRule

    assert never_longer(LimitRule(*value), LimitRule(*limit)) is expected


def test_never_longer_month_bounds_are_safe() -> None:
    from superset.time_range_limits.policy import _max_days, _min_days, _shift

    first = datetime(2096, 1, 1)
    starts = [first + timedelta(days=n) for n in range(3287)]
    assert starts[-1] == datetime(2104, 12, 31)
    for months in sorted({*range(1, 37), *range(12, 301, 12)}):
        lengths = {
            abs((_shift(start, sign * months, "month") - start).days)  # type: ignore[operator]
            for start in starts
            for sign in (1, -1)
        }
        assert _min_days(months) <= min(lengths), months
        assert max(lengths) <= _max_days(months), months
        if months <= 12:
            assert (min(lengths), max(lengths)) == (
                _min_days(months),
                _max_days(months),
            )


@pytest.mark.parametrize(
    ("global_policy", "raw", "expected"),
    [
        (policy((1, "P1Y")), policy((90, "P1D")), {}),
        (policy((1, "P1Y")), policy((12, "P1M")), {}),
        (
            policy((1, "P1Y")),
            policy((366, "P1D")),
            {"max_span.quantity": ["Dashboard maximum span must be 1 year or less."]},
        ),
        (
            policy((90, "P1D")),
            policy((3, "P1M")),
            {"max_span.quantity": ["Dashboard maximum span must be 90 days or less."]},
        ),
        (
            policy((365, "P1D")),
            policy((1, "P1Y")),
            {"max_span.quantity": ["Dashboard maximum span must be 365 days or less."]},
        ),
        (
            policy((2, "P1D")),
            policy((48, "PT1H")),
            {
                "max_span.time_grain": [
                    "Dashboard maximum span must be 2 days or less. "
                    "Use a unit of a day or longer."
                ]
            },
        ),
        (policy(None, (1, "P1Y")), policy(None, (52, "P1W")), {}),
        (
            policy(None, (1, "P1M")),
            policy(None, (31, "P1D")),
            {
                "max_look_back.quantity": [
                    "Dashboard maximum look-back must be 1 month or less."
                ]
            },
        ),
        (policy(None, None, (1, "P3M")), policy(None, None, (3, "P1M")), {}),
        (
            policy(None, None, (6, "PT1H")),
            policy(None, None, (1, "P1D")),
            {
                "max_look_forward.time_grain": [
                    "Dashboard maximum look-forward must be 6 hours or less. "
                    "Use a unit shorter than a day."
                ]
            },
        ),
    ],
)
def test_stricter_than_global_in_any_unit(
    limits_on: None, global_policy: Any, raw: Any, expected: Any
) -> None:
    assert check(raw, global_policy=global_policy) == expected


@pytest.mark.parametrize(
    "global_policy",
    [{}, policy(None, (0, "P1D"), (0, "P1D")), policy((12, "P1W"))],
    ids=["empty", "zero-zero", "denylisted"],
)
def test_bad_global_only_blocks_a_changed_policy(
    limits_on: None, mocker: MockerFixture, global_policy: Any
) -> None:
    import superset.time_range_limits.policy as time_range_limits
    from superset.time_range_limits.policy import (
        check_stricter_than_global,
        parse_time_range_limits,
        TimeRangeLimitsUnavailableError,
    )

    stored = policy((9, "P1D"), (2, "P1M"))
    parsed = parse_time_range_limits(stored)
    reordered = {key: stored[key] for key in reversed(list(stored))}
    mocker.patch.dict(current_app.config, {"TIME_GRAIN_DENYLIST": ["P1W"]})
    load_global = mocker.spy(time_range_limits, "load_global")

    with patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": global_policy}):
        assert check_stricter_than_global(parsed, stored, "dashboard") == {}
        assert check_stricter_than_global(parsed, reordered, "dataset") == {}
        assert load_global.call_count == 0
        for changed, stored_value in (
            (policy((8, "P1D"), (2, "P1M")), stored),
            (policy((9, "P1D")), stored),
            (stored, None),
            (stored, {**stored, "max_look_forward": {"quantity": 1}}),
        ):
            with pytest.raises(TimeRangeLimitsUnavailableError):
                check_stricter_than_global(
                    parse_time_range_limits(changed), stored_value, "dashboard"
                )


@pytest.mark.parametrize("enabled", [False, True], ids=["flag-off", "flag-on"])
def test_write_checks_run_only_with_the_flag_on(
    mocker: MockerFixture, enabled: bool
) -> None:
    from superset.time_range_limits.policy import (
        json_text_limits_errors,
        parse_written_policy,
        TimeRangeLimitsInvalidError,
        validate_extra_time_range_limits,
    )

    set_flag(mocker, enabled)
    stored = policy((9, "P1W"), (2, "P1W"))
    mocker.patch.dict(current_app.config, {"TIME_GRAIN_DENYLIST": ["P1W"]})
    text = json.dumps({"time_range_limits": stored})

    if enabled:
        for parse in (
            lambda: parse_written_policy(stored),
            lambda: validate_extra_time_range_limits(text),
            lambda: validate_extra_time_range_limits({"time_range_limits": stored}),
        ):
            with pytest.raises(TimeRangeLimitsInvalidError):
                parse()
    else:
        assert parse_written_policy(stored) is None
        with pytest.raises(TimeRangeLimitsInvalidError):
            parse_written_policy("not a policy")
        assert validate_extra_time_range_limits(text) is None
        assert validate_extra_time_range_limits({"time_range_limits": []}) is None
        assert validate_extra_time_range_limits('{"time_range_limits": 1') is None
    with patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": None}):
        assert bool(json_text_limits_errors(text, stored, "dashboard", "p")) == (
            enabled
        )
        assert json_text_limits_errors(
            '{"time_range_limits": []}', None, "dashboard", "p"
        )


@pytest.mark.parametrize(
    ("raw", "field", "text"),
    [
        (
            {"schema_version": 1, "max_span": {"quantity": 5}},
            "max_span.time_grain",
            "max_span.time_grain, max_look_back, max_look_forward",
        ),
        (
            {**policy(), "max_span": {"time_grain": "P1D"}, "x": 1},
            "max_span.quantity",
            "max_span.quantity",
        ),
        (
            {**policy(), "max_span": {"quantity": 5, "x": 1}},
            "max_span.time_grain",
            "max_span.time_grain",
        ),
        (
            {
                **policy(),
                "max_span": {"quantity": 5},
                "max_look_forward": {"quantity": 1},
            },
            "max_span.time_grain",
            "max_span.time_grain, max_look_forward.time_grain",
        ),
    ],
)
def test_missing_rule_key_is_named_first(raw: Any, field: str, text: str) -> None:
    from superset.time_range_limits.policy import (
        parse_time_range_limits,
        TimeRangeLimitsInvalidError,
    )

    with pytest.raises(TimeRangeLimitsInvalidError) as excinfo:
        parse_time_range_limits(raw)
    assert excinfo.value.field == field
    assert str(excinfo.value).startswith(f"{MISSING}{text}")


@pytest.mark.parametrize("enabled", [False, True], ids=["flag-off", "flag-on"])
def test_parse_without_the_unit_check(mocker: MockerFixture, enabled: bool) -> None:
    from superset.time_range_limits.policy import (
        parse_time_range_limits,
        TimeRangeLimitsInvalidError,
    )

    set_flag(mocker, enabled)
    mocker.patch.dict(current_app.config, {"TIME_GRAIN_DENYLIST": ["P1W"]})

    assert parse_time_range_limits(policy((9, "P1W")), check_units=False) is not None
    assert parse_time_range_limits(policy((9, "tomorrow")), check_units=False)
    for raw, field in (
        (policy((9, 5)), "max_span.time_grain"),  # type: ignore[arg-type]
        (policy((0, "P1W")), "max_span.quantity"),
    ):
        with pytest.raises(TimeRangeLimitsInvalidError) as excinfo:
            parse_time_range_limits(raw, check_units=False)
        assert excinfo.value.field == field


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        (None, None),
        ("", None),
        ("not json time_range_limits", None),
        ("[]", None),
        ('{"time_range_limits": [1]}', None),
        ('{"time_range_limits": null}', None),
        ("{}", None),
        ('{"time_range_limits": {"max_span": 1}}', {"max_span": 1}),
        (DEEPLY_NESTED_JSON, None),
    ],
)
def test_stored_limits(text: str | None, expected: Any) -> None:
    from superset.time_range_limits.policy import stored_limits

    assert stored_limits(text) == expected


def test_stored_limits_keeps_a_denylisted_unit(mocker: MockerFixture) -> None:
    from superset.time_range_limits.policy import stored_limits

    mocker.patch.dict(current_app.config, {"TIME_GRAIN_DENYLIST": ["P1W"]})
    stored = policy((9, "P1W"))
    assert stored_limits(json.dumps({"time_range_limits": stored})) == stored


def test_stale_dashboard_span_and_stricter_global_span_are_both_checked() -> None:
    limits = resolve(policy((2, "P1M")), dashboard=policy((9, "P1W")))
    assert limits.max_span == (
        constraint("global", 2, "P1M"),
        constraint("dashboard", 9, "P1W"),
    )

    ex = limit_error(datetime(2026, 8, 15), datetime(2026, 10, 16), limits)
    assert ex.error.extra["source"] == "global"
    assert ex.error.extra["limit"] == {"quantity": 2, "time_grain": "P1M"}


def test_feature_flag_lives_in_the_limits_module() -> None:
    from superset.config import DEFAULT_FEATURE_FLAGS
    from superset.time_range_limits import (
        enforcement as time_range_enforcement,
        policy as time_range_limits,
    )

    assert time_range_limits.FEATURE_FLAG == "TIME_RANGE_LIMITS"
    assert time_range_enforcement.FEATURE_FLAG is time_range_limits.FEATURE_FLAG
    assert DEFAULT_FEATURE_FLAGS[time_range_limits.FEATURE_FLAG] is False


def rule_dict(quantity: int, time_grain: str) -> dict[str, Any]:
    return {"quantity": quantity, "time_grain": time_grain}


def as_api(raw: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in raw.items() if key != "schema_version"}


NO_POLICY = {"max_span": None, "max_look_back": None, "max_look_forward": None}


def unavailable_extra(ex: Any) -> dict[str, Any]:
    extra = dict(ex.value.error.extra)
    assert [code["code"] for code in extra.pop("issue_codes")] == [1042]
    return extra


def dashboard_on(limits: Any, *datasets: Any, mocker: MockerFixture) -> Any:
    from superset.models.dashboard import Dashboard

    dashboard = dashboard_with(limits)
    mocker.patch.object(
        Dashboard, "datasources", new_callable=PropertyMock, return_value=set(datasets)
    )
    return dashboard


def table(id_: int, extra: Any, name: str = "t") -> Any:
    item = sqla_table(extra)
    item.id = id_
    item.table_name = name
    return item


def test_limits_unavailable_error_details() -> None:
    from superset.time_range_limits.policy import TimeRangeLimitsUnavailableError

    error = TimeRangeLimitsUnavailableError(
        source="dataset", field="max_span.time_grain", value="P1W", dataset_id=4
    )
    extra = dict(error.error.extra or {})
    extra.pop("issue_codes")
    assert extra == {
        "reason_code": "POLICY_UNAVAILABLE",
        "source": "dataset",
        "field": "max_span.time_grain",
        "value": "P1W",
        "dataset_id": 4,
    }
    assert error.error.message == (
        "Time range limits could not be verified. Retry the request."
    )

    only_source = TimeRangeLimitsUnavailableError(source="global")
    assert set(only_source.error.extra or {}) == {
        "reason_code",
        "issue_codes",
        "source",
    }
    zero = TimeRangeLimitsUnavailableError(source="global", value=0)
    assert (zero.error.extra or {})["value"] == 0


@pytest.mark.parametrize(
    ("raw", "field", "expected"),
    [
        ({"max_span": {"time_grain": "P1W"}}, "max_span.time_grain", "P1W"),
        ({"schema_version": 2}, "schema_version", 2),
        ({"max_span": {"quantity": 1.5}}, "max_span.quantity", 1.5),
        ({"max_span": {"quantity": True}}, "max_span.quantity", None),
        ({"max_span": {"quantity": [1]}}, "max_span.quantity", None),
        ({"max_span": "90"}, "max_span.quantity", None),
        ({}, "max_look_back", None),
        ({"max_span": None}, "max_span", None),
        ({"a": 1}, None, None),
        (None, "max_span", None),
    ],
)
def test_value_at(raw: Any, field: str | None, expected: Any) -> None:
    from superset.time_range_limits.policy import _value_at

    assert _value_at(raw, field) == expected


def test_policy_as_dict() -> None:
    from superset.time_range_limits.policy import (
        parse_time_range_limits,
        policy_as_dict,
    )

    assert policy_as_dict(None) == NO_POLICY
    assert policy_as_dict(parse_time_range_limits(EXAMPLE_GLOBAL)) == as_api(
        EXAMPLE_GLOBAL
    )


def test_explore_limits_payload_bad_global_and_dataset(
    mocker: MockerFixture,
) -> None:
    from superset.time_range_limits.policy import (
        explore_limits_payload,
        TimeRangeLimitsUnavailableError,
    )

    set_global(mocker, EXAMPLE_GLOBAL)
    mocker.patch.dict(current_app.config, {"TIME_GRAIN_DENYLIST": ["P1W"]})
    bad = table(9, {"time_range_limits": policy((0, "P1D"))})
    with pytest.raises(TimeRangeLimitsUnavailableError) as ex:
        explore_limits_payload(bad, NOW)
    assert unavailable_extra(ex) == {
        "reason_code": "POLICY_UNAVAILABLE",
        "source": "global",
        "field": "max_span.time_grain",
        "value": "P1W",
    }


def test_explore_limits_payload(mocker: MockerFixture) -> None:
    from superset.time_range_limits.policy import explore_limits_payload

    set_global(mocker, EXAMPLE_GLOBAL)
    mocker.patch.dict(os.environ, {"TZ": "Europe/Warsaw"})
    with_policy = table(1, {"time_range_limits": policy((4, "P1W"))})

    assert explore_limits_payload(with_policy, NOW) == {
        "schema_version": 1,
        "global": as_api(EXAMPLE_GLOBAL),
        "dataset": as_api(policy((4, "P1W"))),
        "timezone": "Europe/Warsaw",
    }
    assert explore_limits_payload(table(2, None), NOW)["dataset"] == NO_POLICY
    assert explore_limits_payload(mocker.MagicMock(spec=[]), NOW)["dataset"] is None

    set_global(mocker, None)
    assert explore_limits_payload(table(2, None), NOW) == {
        "schema_version": 1,
        "global": NO_POLICY,
        "dataset": NO_POLICY,
        "timezone": "Europe/Warsaw",
    }


def test_server_timezone_is_tz_when_set(mocker: MockerFixture) -> None:
    from superset.time_range_limits.policy import server_timezone

    mocker.patch.dict(os.environ, {"TZ": "Europe/Warsaw"})
    assert server_timezone(NOW) == "Europe/Warsaw"


def test_server_timezone_without_tz_is_the_offset_name(
    mocker: MockerFixture,
) -> None:
    from superset.time_range_limits.policy import server_timezone

    mocker.patch.dict(os.environ, clear=True)
    now = mocker.MagicMock(spec=datetime)
    now.astimezone.return_value.tzname.return_value = "CEST"
    assert server_timezone(now) == "CEST"
    assert server_timezone(NOW) == NOW.astimezone().tzname()


SAVE_CHECK_NOW = datetime(2026, 10, 28, 12, 0)
FAILURE_CASES = [
    ("ok", (2026, 10, 1), (2026, 10, 28), {"dashboard": policy((90, "P1D"))}, None, 3),
    (
        "NO_VALID_RANGE",
        (2026, 10, 1),
        (2026, 10, 2),
        {
            "dataset": policy(None, (0, "PT1H")),
            "dashboard": policy(None, None, (0, "PT1H")),
        },
        None,
        None,
    ),
    (
        "UNBOUNDED_RANGE-dashboard",
        None,
        None,
        {"dashboard": policy((90, "P1D"))},
        None,
        3,
    ),
    (
        "UNBOUNDED_RANGE-open_end",
        (2026, 1, 1),
        None,
        {"dataset": policy((90, "P1D"))},
        None,
        None,
    ),
    (
        "UNBOUNDED_RANGE-both_open",
        None,
        None,
        {"dataset": policy((90, "P1D"))},
        None,
        None,
    ),
    (
        "MAX_SPAN_EXCEEDED",
        (2025, 10, 28),
        (2026, 10, 28),
        {"dashboard": policy((90, "P1D"))},
        None,
        3,
    ),
    (
        "MAX_SPAN_EXCEEDED-two_levels",
        (2026, 6, 1),
        (2026, 10, 28),
        {
            "global": policy((1, "P1Y")),
            "dataset": policy((12, "P1W")),
            "dashboard": policy((3, "P1M")),
        },
        None,
        3,
    ),
    (
        "MAX_SPAN_EXCEEDED-quarter",
        (2025, 10, 28),
        (2026, 10, 28),
        {"dataset": policy((2, "P3M"))},
        None,
        None,
    ),
    (
        "MAX_LOOK_BACK_EXCEEDED",
        (2025, 9, 28),
        (2025, 10, 28),
        {"dashboard": policy(None, (6, "P1M"))},
        "1 year ago",
        3,
    ),
    (
        "MAX_LOOK_BACK_EXCEEDED-sub_day",
        (2026, 10, 28, 9),
        (2026, 10, 28, 12),
        {"dataset": policy(None, (1, "PT1H"))},
        None,
        None,
    ),
    (
        "MAX_LOOK_FORWARD_EXCEEDED",
        (2026, 10, 1),
        (2026, 12, 1),
        {"global": policy(None, None, (0, "P1D"))},
        None,
        None,
    ),
    (
        "MAX_LOOK_FORWARD_EXCEEDED-offset",
        (2026, 10, 1),
        (2026, 12, 1),
        {"dataset": policy(None, None, (1, "P1W"))},
        "inherit",
        7,
    ),
]


def resolved_levels(levels: dict[str, Any]) -> Any:
    from superset.time_range_limits.policy import (
        parse_time_range_limits,
        resolve_time_range_limits,
    )

    return resolve_time_range_limits(
        [
            (source, parse_time_range_limits(levels.get(source)))
            for source in ("global", "dataset", "dashboard")
        ],
        SAVE_CHECK_NOW,
    )


@pytest.mark.parametrize("case", FAILURE_CASES, ids=[case[0] for case in FAILURE_CASES])
@freeze_time("2026-10-28 12:00:00")
def test_date_range_failure_matches_validate(
    case: tuple[Any, ...], mocker: MockerFixture
) -> None:
    from superset.time_range_limits.policy import (
        date_range_failure,
        TimeRangeLimitError,
        validate_date_range,
    )

    _name, since, until, levels, offset, dashboard_id = case
    since = datetime(*since) if since else None
    until = datetime(*until) if until else None
    limits = resolved_levels(levels)
    built = mocker.spy(TimeRangeLimitError, "__init__")

    failure = date_range_failure(
        since, until, limits, time_offset=offset, dashboard_id=dashboard_id
    )

    assert built.call_count == 0
    if failure is None:
        validate_date_range(
            since,
            until,
            limits,
            time_offset=offset,
            dashboard_id=dashboard_id,
            timezone="UTC",
        )
        return
    with pytest.raises(TimeRangeLimitError) as raised:
        validate_date_range(
            since,
            until,
            limits,
            time_offset=offset,
            dashboard_id=dashboard_id,
            timezone="UTC",
        )
    error = raised.value.error
    assert (
        failure.reason_code,
        failure.rule,
        failure.source,
        failure.message,
        failure.limit.as_dict() if failure.limit else None,
    ) == (
        error.extra["reason_code"],
        error.extra["rule"],
        error.extra["source"],
        error.message,
        error.extra["limit"],
    )


def test_date_range_failure_since_after_until_value_error() -> None:
    from superset.time_range_limits.policy import date_range_failure

    limits = resolved_levels({"dashboard": policy((1, "P1D"))})
    with pytest.raises(ValueError, match="since must not be later than until"):
        date_range_failure(datetime(2026, 2, 1), datetime(2026, 1, 1), limits)
    with pytest.raises(ValueError, match="since must not be later than until"):
        date_range_failure(
            datetime(2026, 2, 1), datetime(2026, 1, 1), limits.__class__()
        )


LEVEL_MIXES = [
    ("none", None, None, None),
    ("global_only", policy((1, "P1Y")), None, None),
    ("dataset_only", None, policy(None, (6, "P1M")), None),
    ("dashboard_only", None, None, policy(None, None, (0, "P1D"))),
    (
        "all_three_tie",
        policy((90, "P1D")),
        policy((90, "P1D"), (3, "P1M")),
        policy((13, "P1W"), (3, "P1M")),
    ),
    (
        "sub_day",
        policy(None, (1, "P1D")),
        policy(None, (24, "PT1H")),
        policy(None, None, (30, "PT1M")),
    ),
]


@pytest.mark.parametrize("mix", LEVEL_MIXES, ids=[mix[0] for mix in LEVEL_MIXES])
@pytest.mark.parametrize("with_dashboard", [False, True], ids=["no_dash", "dash"])
@freeze_time("2026-10-28 12:00:00")
def test_resolve_matches_get_effective(
    mix: tuple[Any, ...], with_dashboard: bool, mocker: MockerFixture
) -> None:
    from superset.connectors.sqla.models import SqlaTable
    from superset.models.dashboard import Dashboard
    from superset.time_range_limits.policy import (
        get_effective_time_range_limits,
        load_global,
        load_level,
        resolve_time_range_limits,
    )

    _name, global_policy, dataset_policy, dashboard_policy = mix
    mocker.patch.dict(current_app.config, {"TIME_RANGE_LIMITS_GLOBAL": global_policy})
    table = SqlaTable(
        table_name="t",
        extra=json.dumps({"time_range_limits": dataset_policy})
        if dataset_policy
        else None,
    )
    dashboard = Dashboard(
        json_metadata=json.dumps({"time_range_limits": dashboard_policy})
        if dashboard_policy
        else "{}"
    )

    levels = [
        ("global", load_global()),
        ("dataset", load_level(table.extra, "Dataset extra")),
        (
            "dashboard",
            load_level(dashboard.json_metadata, "Dashboard json_metadata")
            if with_dashboard
            else None,
        ),
    ]

    assert resolve_time_range_limits(
        levels, SAVE_CHECK_NOW
    ) == get_effective_time_range_limits(
        table, SAVE_CHECK_NOW, dashboard if with_dashboard else None
    )


def restored_text(limits: Any) -> str:
    return json.dumps({"color_scheme": "x", "time_range_limits": limits})


def test_restored_limits_looser_than_the_global_are_refused(
    limits_on: None, mocker: MockerFixture
) -> None:
    from superset.commands.exceptions import TimeRangeLimitsRestoreError
    from superset.time_range_limits.policy import check_restored_limits

    set_global(mocker, EXAMPLE_GLOBAL)
    looser = {**EXAMPLE_GLOBAL, "max_span": {"quantity": 13, "time_grain": "P1W"}}
    prefix = "json_metadata.time_range_limits"

    with pytest.raises(TimeRangeLimitsRestoreError) as excinfo:
        check_restored_limits(
            restored_text(looser), restored_text(None), "dashboard", prefix
        )
    assert excinfo.value.normalized_messages() == {
        f"{prefix}.max_span.quantity": [
            "Dashboard maximum span must be 12 weeks or less."
        ]
    }

    # Unchanged from the live row, stricter, or removed: accepted.
    check_restored_limits(
        restored_text(looser), restored_text(looser), "dashboard", prefix
    )
    check_restored_limits(
        restored_text(EXAMPLE_GLOBAL), restored_text(looser), "dashboard", prefix
    )
    check_restored_limits("{}", restored_text(looser), "dashboard", prefix)


def test_restored_limits_with_a_bad_shape_are_refused(
    limits_on: None, mocker: MockerFixture
) -> None:
    from superset.commands.exceptions import TimeRangeLimitsRestoreError
    from superset.time_range_limits.policy import check_restored_limits

    set_global(mocker, EXAMPLE_GLOBAL)
    bad = {**EXAMPLE_GLOBAL, "max_span": {"quantity": 0, "time_grain": "P1W"}}

    with pytest.raises(TimeRangeLimitsRestoreError) as excinfo:
        check_restored_limits(
            json.dumps({"time_range_limits": bad}),
            None,
            "dataset",
            "extra.time_range_limits",
        )
    assert list(excinfo.value.normalized_messages()) == [
        "extra.time_range_limits.max_span.quantity"
    ]


def test_restored_limits_under_a_bad_global_are_unavailable(
    limits_on: None, mocker: MockerFixture
) -> None:
    from superset.time_range_limits.policy import (
        check_restored_limits,
        TimeRangeLimitsUnavailableError,
    )

    set_global(mocker, {})

    with pytest.raises(TimeRangeLimitsUnavailableError):
        check_restored_limits(
            restored_text(EXAMPLE_GLOBAL),
            None,
            "dashboard",
            "json_metadata.time_range_limits",
        )


def test_restored_limits_are_not_checked_while_the_flag_is_off(
    mocker: MockerFixture,
) -> None:
    from superset.time_range_limits.policy import check_restored_limits

    set_flag(mocker, False)
    set_global(mocker, EXAMPLE_GLOBAL)
    looser = {**EXAMPLE_GLOBAL, "max_span": {"quantity": 13, "time_grain": "P1W"}}

    check_restored_limits(
        restored_text(looser), None, "dashboard", "json_metadata.time_range_limits"
    )
    check_restored_limits(
        '{"time_range_limits": "oops"}',
        None,
        "dashboard",
        "json_metadata.time_range_limits",
    )


def test_dashboard_payload_omits_inaccessible_dataset(mocker: MockerFixture) -> None:
    """Dataset policies follow datasource access without hiding dashboard levels."""
    from superset.extensions import security_manager
    from superset.time_range_limits.policy import dashboard_limits_payload

    allowed = table(7, {"time_range_limits": policy((7, "P1D"))}, "allowed")
    denied = table(8, {"time_range_limits": policy((3, "P1D"))}, "denied")
    dashboard = dashboard_on(policy((14, "P1D")), allowed, denied, mocker=mocker)
    set_global(mocker, policy((90, "P1D")))
    mocker.patch.object(
        security_manager, "can_access_datasource", side_effect=lambda ds: ds.id == 7
    )
    mocker.patch("superset.time_range_limits.notice.editor_notice", return_value=None)
    payload = dashboard_limits_payload(dashboard, NOW)
    assert [dataset["id"] for dataset in payload["datasets"]] == [7]
    assert payload["global"]["max_span"]["quantity"] == 90
    assert payload["dashboard"]["max_span"]["quantity"] == 14


def test_dashboard_payload_isolates_invalid_dataset(mocker: MockerFixture) -> None:
    """A bad dataset remains unavailable without hiding the valid dataset."""
    from superset.extensions import security_manager
    from superset.time_range_limits.policy import dashboard_limits_payload

    mocker.patch("superset.time_range_limits.policy._edits_level", return_value=False)
    good = table(7, {"time_range_limits": policy((7, "P1D"))}, "good")
    bad = table(8, {"time_range_limits": policy((0, "P1D"))}, "bad")
    dashboard = dashboard_on(policy((14, "P1D")), good, bad, mocker=mocker)
    set_global(mocker, policy((90, "P1D")))
    mocker.patch.object(security_manager, "can_access_datasource", return_value=True)
    mocker.patch("superset.time_range_limits.notice.editor_notice", return_value=None)
    payload = dashboard_limits_payload(dashboard, NOW)
    datasets = {dataset["id"]: dataset for dataset in payload["datasets"]}
    assert datasets[7]["policy"]["max_span"]["quantity"] == 7
    assert datasets[8]["error"]["extra"]["reason_code"] == "POLICY_UNAVAILABLE"
    assert "value" not in datasets[8]["error"]["extra"]
