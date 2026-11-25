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
from itertools import product
from typing import Any

import pytest
from flask import current_app
from flask_babel import lazy_gettext
from pytest_mock import MockerFixture

from superset.dashboards.refresh_policy import (
    check_refresh_policy,
    get_standard_refresh_intervals,
    RefreshPolicyError,
)

STANDARD_INTERVALS = [10, 30, 60, 300, 1800, 3600, 21600, 43200, 86400]
UNITS = {"seconds": 1, "minutes": 60, "hours": 3600}
POLICY = "auto_refresh_policy"
MIN = f"{POLICY}.minimum_refresh_interval"
MAX = f"{POLICY}.maximum_refresh_interval"


def bound(value: Any, unit: Any = "seconds") -> dict[str, Any]:
    """Bound."""
    return {"value": value, "unit": unit}


def codes(errors: list[RefreshPolicyError]) -> list[tuple[str, str]]:
    """Codes."""
    return [(error.field, error.code) for error in errors]


def set_intervals(mocker: MockerFixture, intervals: Any) -> None:
    """Set intervals."""
    mocker.patch.dict(
        current_app.config, {"DASHBOARD_AUTO_REFRESH_INTERVALS": intervals}
    )


def without(value: int) -> list[list[Any]]:
    """Without."""
    return [[v, str(v)] for v in [0, *STANDARD_INTERVALS] if v != value]


@pytest.mark.parametrize(
    "intervals, expected",
    [
        (
            [
                [0, "Don't refresh"],
                [30, "30 s"],
                ["60", "1 min"],
                [30, "dup"],
                [1.5, "odd"],
                [-5, "bad"],
                ["", "bad"],
                [10, ""],
            ],
            [30],
        ),
        ([["0x10", "hex"], ["1_000", "us"], [True, "bool"]], STANDARD_INTERVALS),
        (
            [["0o7", "oct"], ["0b11", "bin"], [" 1e2 ", "exp"], [".5", "dot"]],
            STANDARD_INTERVALS,
        ),
        (
            [["Infinity", "inf"], ["1e400", "huge"], ["١٠", "arabic"], [5]],
            STANDARD_INTERVALS,
        ),
        ([[0, "Don't refresh"]], []),
        (
            [[-0.0, "zero"], [0, "dup"], (45, "tuple"), [90, lazy_gettext("Lazy")]],
            [45, 90],
        ),
        ([[20, "a", "extra"]], [20]),
        ([], STANDARD_INTERVALS),
        ("abc", STANDARD_INTERVALS),
        (None, STANDARD_INTERVALS),
    ],
)
def test_standard_intervals_accept_numeric_configuration(
    mocker: MockerFixture, intervals: Any, expected: list[float]
) -> None:
    """Check standard intervals accept numeric configuration."""
    set_intervals(mocker, intervals)
    assert get_standard_refresh_intervals() == expected


@pytest.mark.parametrize("seconds", [[0, 0.5], [0.5], [0]])
@pytest.mark.parametrize("policy", [{}, {"auto_refresh_allowed": True}])
def test_no_whole_standard_interval_rejects_enabled_policy(
    mocker: MockerFixture, seconds: list[float], policy: dict[str, Any]
) -> None:
    """An enabled policy needs a positive whole-second standard choice."""
    set_intervals(mocker, [[value, str(value)] for value in seconds])
    assert get_standard_refresh_intervals() == []
    for stored_policy in (None, policy):
        assert codes(
            check_refresh_policy({"auto_refresh_policy": policy}, stored_policy)
        ) == [("auto_refresh_policy", "no_standard_interval")]
    assert (
        check_refresh_policy({"auto_refresh_policy": {"auto_refresh_allowed": False}})
        == []
    )


@pytest.mark.parametrize("seconds", [[0, 0.5], [0.5], [0]])
def test_flag_off_accepts_policy_without_whole_standard_interval(
    mocker: MockerFixture, seconds: list[float]
) -> None:
    """The feature flag preserves metadata acceptance for unusable lists."""
    from superset.extensions import feature_flag_manager

    set_intervals(mocker, [[value, str(value)] for value in seconds])
    mocker.patch.dict(
        feature_flag_manager._feature_flags, {"AUTO_REFRESH_POLICY": False}
    )
    assert check_refresh_policy({"auto_refresh_policy": {}}) == []


def test_standard_intervals_default_config() -> None:
    """Check standard intervals default config."""
    assert get_standard_refresh_intervals() == STANDARD_INTERVALS


def test_standard_intervals_keep_config_order(mocker: MockerFixture) -> None:
    """Check standard intervals keep config order."""
    set_intervals(mocker, [[60, "1 min"], [10, "10 s"]])
    assert get_standard_refresh_intervals() == [60, 10]


@pytest.mark.parametrize("metadata", [{}, {"auto_refresh_policy": None}])
@pytest.mark.parametrize("frequency", ["60", 60.5, -5, 45, True])
def test_no_policy_is_not_checked(metadata: dict[str, Any], frequency: Any) -> None:
    """Check no policy is not checked."""
    assert check_refresh_policy({**metadata, "refresh_frequency": frequency}) == []


def test_policy_examples() -> None:
    """Check policy examples."""
    policy = {
        "auto_refresh_allowed": True,
        "minimum_refresh_interval": bound(30),
        "maximum_refresh_interval": bound(1, "hours"),
    }
    assert (
        check_refresh_policy({"refresh_frequency": 60, "auto_refresh_policy": policy})
        == []
    )
    assert check_refresh_policy(
        {"refresh_frequency": 10, "auto_refresh_policy": policy}
    ) == [
        RefreshPolicyError(
            "refresh_frequency",
            "below_minimum",
            "Refresh frequency must be 30 seconds or greater.",
        )
    ]


@pytest.mark.parametrize("policy", [[], "x", 1, True])
def test_policy_not_an_object_stops(policy: Any) -> None:
    """A non-object policy stops validation before frequency checks."""
    assert codes(
        check_refresh_policy({"auto_refresh_policy": policy, "refresh_frequency": "x"})
    ) == [("auto_refresh_policy", "invalid_policy")]


def test_bad_keys_still_run_bound_rules_but_not_frequency() -> None:
    """Invalid keys still permit bound checks but skip frequency checks."""
    errors = check_refresh_policy(
        {
            "refresh_frequency": 45,
            "auto_refresh_policy": {
                "zz": 1,
                "auto_refresh_allowed": "true",
                "minimum_refresh_interval": bound(45),
            },
        }
    )
    assert codes(errors) == [
        ("auto_refresh_policy.zz", "invalid_policy"),
        ("auto_refresh_policy.auto_refresh_allowed", "invalid_policy"),
        ("auto_refresh_policy.minimum_refresh_interval", "invalid_boundary"),
    ]
    assert [e.message for e in errors[:2]] == [
        "Unknown field.",
        "Must be true or false.",
    ]


def test_bound_left_the_list_still_bounds_the_frequency(
    mocker: MockerFixture,
) -> None:
    """Check bound left the list still bounds the frequency."""
    set_intervals(mocker, without(60))
    policy = {"minimum_refresh_interval": bound(60)}
    assert codes(
        check_refresh_policy(
            {"auto_refresh_policy": policy, "refresh_frequency": 30}, policy
        )
    ) == [("refresh_frequency", "below_minimum")]


def test_empty_positive_list(mocker: MockerFixture) -> None:
    """Check empty positive list."""
    set_intervals(mocker, [[0, "Don't refresh"]])
    assert codes(
        check_refresh_policy(
            {
                "auto_refresh_policy": {"minimum_refresh_interval": bound(30)},
                "refresh_frequency": 30,
            }
        )
    ) == [
        ("auto_refresh_policy.minimum_refresh_interval", "invalid_boundary"),
        ("refresh_frequency", "custom_not_allowed"),
    ]


@pytest.mark.parametrize(
    "policy, expected",
    [
        (
            {"minimum_refresh_interval": bound(30)},
            "Refresh frequency must be 30 seconds or greater.",
        ),
        (
            {"minimum_refresh_interval": bound(1, "minutes")},
            "Refresh frequency must be 1 minute or greater.",
        ),
        (
            {"maximum_refresh_interval": bound(1, "minutes")},
            "Refresh frequency must be 1 minute or less.",
        ),
        (
            {"maximum_refresh_interval": bound(1, "hours")},
            "Refresh frequency must be 1 hour or less.",
        ),
        (
            {"maximum_refresh_interval": bound(6, "hours")},
            "Refresh frequency must be 6 hours or less.",
        ),
    ],
)
def test_bound_messages(policy: dict[str, Any], expected: str) -> None:
    """Check bound messages."""
    frequency = 10 if "minimum_refresh_interval" in policy else 86400
    errors = check_refresh_policy(
        {"auto_refresh_policy": policy, "refresh_frequency": frequency}
    )
    assert [e.message for e in errors] == [expected]


@pytest.mark.parametrize(
    "metadata, expected",
    [
        (
            {"auto_refresh_policy": {}, "refresh_frequency": 45},
            "Refresh frequency must be one of the standard intervals.",
        ),
        (
            {
                "auto_refresh_policy": {"auto_refresh_allowed": False},
                "refresh_frequency": 60,
            },
            "Auto-refresh isn't allowed on this dashboard. Set refresh frequency to "
            '"Don\'t refresh".',
        ),
        (
            {"auto_refresh_policy": {}, "refresh_frequency": "60"},
            "Refresh frequency must be 0 or a whole number of seconds.",
        ),
        (
            {"auto_refresh_policy": {"minimum_refresh_interval": bound(0)}},
            "Use a whole number of seconds, minutes or hours.",
        ),
        (
            {"auto_refresh_policy": {"minimum_refresh_interval": bound(2, "hours")}},
            "2 hours isn't a standard interval. Select one from the list.",
        ),
        (
            {
                "auto_refresh_policy": {
                    "minimum_refresh_interval": bound(1, "hours"),
                    "maximum_refresh_interval": bound(30),
                }
            },
            "Shortest interval must be shorter than or equal to the longest interval.",
        ),
        (
            {"auto_refresh_policy": {"unknown": True}},
            "Unknown field.",
        ),
        (
            {"auto_refresh_policy": "x"},
            "Auto-refresh policy must be an object with auto_refresh_allowed, "
            "minimum_refresh_interval and "
            "maximum_refresh_interval.",
        ),
    ],
)
def test_messages(metadata: dict[str, Any], expected: str) -> None:
    """Check messages."""
    assert check_refresh_policy(metadata)[0].message == expected


def test_no_standard_interval_message(mocker: MockerFixture) -> None:
    """Check no standard interval message."""
    set_intervals(mocker, without(86400))
    policy = {"minimum_refresh_interval": bound(24, "hours")}
    errors = check_refresh_policy({"auto_refresh_policy": policy}, policy)
    assert codes(errors) == [
        ("auto_refresh_policy.minimum_refresh_interval", "no_standard_interval")
    ]
    assert errors[0].message == (
        "No standard interval fits between the shortest and longest interval. "
        "Widen the range."
    )


@pytest.mark.parametrize(
    "bounds, expected",
    [
        (
            {"minimum_refresh_interval": bound(24, "hours")},
            ["minimum_refresh_interval"],
        ),
        ({"maximum_refresh_interval": bound(5)}, ["maximum_refresh_interval"]),
        (
            {
                "minimum_refresh_interval": bound(45),
                "maximum_refresh_interval": bound(50),
            },
            ["minimum_refresh_interval", "maximum_refresh_interval"],
        ),
    ],
)
def test_runs_on_unchanged_policy(
    mocker: MockerFixture, bounds: dict[str, Any], expected: list[str]
) -> None:
    """An unchanged policy still requires a standard interval within its bounds."""
    set_intervals(mocker, without(86400))
    errors = check_refresh_policy({"auto_refresh_policy": bounds}, bounds)
    assert codes(errors) == [
        (f"auto_refresh_policy.{key}", "no_standard_interval") for key in expected
    ]
    prohibited = {**bounds, "auto_refresh_allowed": False}
    assert check_refresh_policy({"auto_refresh_policy": prohibited}, prohibited) == []


def test_every_standard_pair_leaves_a_standard_value() -> None:
    """Check every standard pair leaves a standard value."""
    standard = get_standard_refresh_intervals()
    lengths = sorted(
        {
            seconds: bound(int(seconds // factor), unit)
            for seconds, (unit, factor) in product(standard, UNITS.items())
            if seconds % factor == 0
        }.items()
    )
    pairs = [(lo, hi) for lo, hi in product(lengths, repeat=2) if lo[0] <= hi[0]]
    assert len(pairs) == 45
    for (_, low), (_, high) in pairs:
        policy = {"minimum_refresh_interval": low, "maximum_refresh_interval": high}
        assert check_refresh_policy({"auto_refresh_policy": policy}) == []


@pytest.fixture(autouse=True)
def enable_policy(mocker: MockerFixture) -> None:
    """Enable policy enforcement for the policy contract tests."""
    from superset.extensions import feature_flag_manager

    mocker.patch.dict(
        feature_flag_manager._feature_flags, {"AUTO_REFRESH_POLICY": True}
    )


@pytest.fixture
def disable_policy(mocker: MockerFixture) -> None:
    """Turn the feature flag off."""
    from superset.extensions import feature_flag_manager

    mocker.patch.dict(
        feature_flag_manager._feature_flags, {"AUTO_REFRESH_POLICY": False}
    )


@pytest.mark.parametrize(
    "policy, expected",
    [
        ("invalid", [(POLICY, "invalid_policy")]),
        ([], [(POLICY, "invalid_policy")]),
        (
            {"custom_refresh_allowed": False},
            [(f"{POLICY}.custom_refresh_allowed", "invalid_policy")],
        ),
        (
            {"auto_refresh_allowed": "yes"},
            [(f"{POLICY}.auto_refresh_allowed", "invalid_policy")],
        ),
        ({"minimum_refresh_interval": bound(0)}, [(MIN, "invalid_boundary")]),
        ({"maximum_refresh_interval": bound(1, "days")}, [(MAX, "invalid_boundary")]),
        ({"minimum_refresh_interval": 30}, [(MIN, "invalid_boundary")]),
    ],
)
def test_flag_off_checks_only_the_policy_shape(
    disable_policy: None, policy: Any, expected: list[tuple[str, str]]
) -> None:
    """With the flag off a malformed policy is refused with the usual errors."""
    errors = check_refresh_policy({"auto_refresh_policy": policy})
    assert [(error.field, error.code) for error in errors] == expected


@pytest.mark.parametrize(
    "metadata",
    [
        {"auto_refresh_policy": None, "refresh_frequency": -1},
        {"refresh_frequency": "60"},
        {"auto_refresh_policy": {}, "refresh_frequency": 45},
        {
            "auto_refresh_policy": {"auto_refresh_allowed": False},
            "refresh_frequency": 60,
        },
        {"auto_refresh_policy": {"minimum_refresh_interval": bound(45)}},
        {
            "auto_refresh_policy": {
                "minimum_refresh_interval": bound(2, "hours"),
                "maximum_refresh_interval": bound(1, "hours"),
            },
            "refresh_frequency": 10,
        },
    ],
)
def test_flag_off_skips_the_policy_rules(
    disable_policy: None, mocker: MockerFixture, metadata: dict[str, Any]
) -> None:
    """With the flag off a well-formed policy isn't checked against any rule."""
    set_intervals(mocker, [[0, "Off"], [300, "5 minutes"]])
    assert check_refresh_policy(metadata) == []


def test_flag_off_skips_an_unchanged_policy(disable_policy: None) -> None:
    """With the flag off a stored policy is only checked when a write changes it."""
    assert check_refresh_policy({"auto_refresh_policy": "invalid"}, "invalid") == []
    assert [
        error.code
        for error in check_refresh_policy({"auto_refresh_policy": "other"}, "invalid")
    ] == ["invalid_policy"]


TYPE_CHANGES = [
    ({"auto_refresh_allowed": True}, {"auto_refresh_allowed": 1}, "invalid_policy"),
    ({"auto_refresh_allowed": False}, {"auto_refresh_allowed": 0}, "invalid_policy"),
    (
        {"minimum_refresh_interval": bound(1)},
        {"minimum_refresh_interval": bound(True)},
        "invalid_boundary",
    ),
]


@pytest.mark.parametrize("stored, submitted, code", TYPE_CHANGES)
def test_flag_off_a_boolean_number_swap_is_a_change(
    disable_policy: None, stored: Any, submitted: Any, code: str
) -> None:
    """With the flag off JSON booleans and numbers never count as unchanged."""
    from superset.dashboards.refresh_policy import refresh_settings_changed

    assert [
        error.code
        for error in check_refresh_policy({"auto_refresh_policy": submitted}, stored)
    ] == [code]
    assert refresh_settings_changed(
        {"auto_refresh_policy": submitted}, {"auto_refresh_policy": stored}
    )


@pytest.mark.parametrize(
    "stored, submitted",
    [
        (
            {"custom_refresh_allowed": 9007199254740993},
            {"custom_refresh_allowed": 9007199254740992},
        ),
        ({"custom": [1, {"a": 2}]}, {"custom": [1.0, {"a": 2.0}]}),
        ({"custom_refresh_allowed": 10**400}, {"custom_refresh_allowed": None}),
        ({"custom": [-(10**400), float("inf")]}, {"custom": [None, None]}),
    ],
)
def test_flag_off_numbers_equal_as_doubles_are_unchanged(
    disable_policy: None, stored: Any, submitted: Any
) -> None:
    """With the flag off a policy that survives a browser JSON round trip is kept."""
    from superset.dashboards.refresh_policy import refresh_settings_changed

    assert check_refresh_policy({"auto_refresh_policy": submitted}, stored) == []
    assert not refresh_settings_changed(
        {"auto_refresh_policy": submitted}, {"auto_refresh_policy": stored}
    )


@pytest.mark.parametrize(
    "stored, submitted",
    [
        ({"custom": 9007199254740993}, {"custom": 9007199254740995}),
        ({"custom": 1}, {"custom": "1"}),
        ({"custom": [1]}, {"custom": [1, 1]}),
        ({"custom": {"a": 1}}, {"custom": {"b": 1}}),
        ({"custom": None}, {"custom": False}),
        ({"custom": None}, {"custom": 1}),
        ({"custom": 1}, {"custom": None}),
        ({"custom": None}, {"custom": 10**400}),
        ({"custom": True}, {"custom": None}),
        ({"custom": "x"}, {"custom": None}),
        ({"custom": 10**400}, {"custom": False}),
        ({"custom": 10**400}, {"custom": 10**401}),
    ],
)
def test_flag_off_a_different_malformed_value_is_checked(
    disable_policy: None, stored: Any, submitted: Any
) -> None:
    """With the flag off a genuinely different malformed policy is still refused."""
    assert [
        error.code
        for error in check_refresh_policy({"auto_refresh_policy": submitted}, stored)
    ] == ["invalid_policy"]


@pytest.mark.parametrize("stored, submitted, code", TYPE_CHANGES)
def test_flag_on_a_boolean_number_swap_is_a_change(
    mocker: MockerFixture, stored: Any, submitted: Any, code: str
) -> None:
    """With the flag on a boolean turned into a number, or back, is a change."""
    from superset.dashboards.refresh_policy import (
        log_refresh_policy_change,
        refresh_settings_changed,
    )

    add = mocker.patch("superset.extensions.db.session.add")
    for old, new in ((stored, submitted), (submitted, stored)):
        assert refresh_settings_changed(
            {"auto_refresh_policy": new}, {"auto_refresh_policy": old}
        )
        log_refresh_policy_change(1, old, new, "put")
    assert add.call_count == 2


@pytest.mark.parametrize(
    "stored, submitted",
    [
        (
            {"auto_refresh_policy": {"minimum_refresh_interval": bound(1, "minutes")}},
            {
                "auto_refresh_policy": {
                    "minimum_refresh_interval": bound(1.0, "minutes")
                }
            },
        ),
        ({"refresh_frequency": 60}, {"refresh_frequency": 60.0}),
        ({}, {"refresh_frequency": 0}),
    ],
)
def test_flag_on_equal_numbers_are_unchanged(
    mocker: MockerFixture, stored: dict[str, Any], submitted: dict[str, Any]
) -> None:
    """With the flag on an integer and an equal float count as unchanged."""
    from superset.dashboards.refresh_policy import (
        log_refresh_policy_change,
        refresh_settings_changed,
    )

    add = mocker.patch("superset.extensions.db.session.add")
    assert not refresh_settings_changed(submitted, stored)
    log_refresh_policy_change(
        1,
        stored.get("auto_refresh_policy"),
        submitted.get("auto_refresh_policy"),
        "put",
    )
    add.assert_not_called()


@pytest.mark.parametrize(
    "stored, submitted", [(0, False), (False, 0), (1, True), (True, 1)]
)
def test_flag_on_a_boolean_number_frequency_swap_is_a_change(
    stored: Any, submitted: Any
) -> None:
    """With the flag on a refresh frequency turned into a boolean is a change."""
    from superset.dashboards.refresh_policy import refresh_settings_changed

    assert refresh_settings_changed(
        {"auto_refresh_policy": {}, "refresh_frequency": submitted},
        {"auto_refresh_policy": {}, "refresh_frequency": stored},
    )


def test_a_numeric_bound_over_a_boolean_one_is_checked_against_the_list(
    mocker: MockerFixture,
) -> None:
    """A bound that replaces a boolean one must be a standard interval."""
    set_intervals(mocker, [[0, "Off"], [30, "30 seconds"], [300, "5 minutes"]])
    assert codes(
        check_refresh_policy(
            {"auto_refresh_policy": {"minimum_refresh_interval": bound(1, "minutes")}},
            {"minimum_refresh_interval": bound(True, "minutes")},
        )
    ) == [(MIN, "invalid_boundary")]


def test_huge_configured_interval_is_ignored(mocker: MockerFixture) -> None:
    """An overflowing operator value does not break policy validation."""
    set_intervals(mocker, [[10**400, "too large"], [60, "minute"]])
    assert get_standard_refresh_intervals() == [60]


def test_integral_float_policy_values_are_accepted() -> None:
    """JSON integral floats follow the same rules as integer values."""
    assert (
        check_refresh_policy(
            {
                "auto_refresh_policy": {
                    "minimum_refresh_interval": bound(1.0, "minutes")
                },
                "refresh_frequency": 60.0,
            }
        )
        == []
    )
