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
"""Server-side checks for a dashboard's ``auto_refresh_policy``."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

from flask import current_app
from flask_babel import gettext as __, ngettext
from flask_babel.speaklater import LazyString

from superset import is_feature_enabled
from superset.utils import json

POLICY_KEY = "auto_refresh_policy"
MIN_KEY = "minimum_refresh_interval"
MAX_KEY = "maximum_refresh_interval"
SWITCH_KEYS = ("auto_refresh_allowed",)
BOUND_KEYS = (MIN_KEY, MAX_KEY)
UNIT_SECONDS = {"seconds": 1, "minutes": 60, "hours": 3600}

DEFAULT_REFRESH_INTERVALS: list[float] = [
    0,
    10,
    30,
    60,
    300,
    1800,
    3600,
    21600,
    43200,
    86400,
]


@dataclass(frozen=True)
class RefreshPolicyError:
    """A field-level policy validation failure."""

    field: str
    code: str
    message: str


def _to_seconds(value: Any) -> float | None:
    """Read finite, nonnegative numeric seconds from deployment configuration."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    try:
        seconds = float(value)
    except OverflowError:
        return None
    return seconds if math.isfinite(seconds) and seconds >= 0 else None


def get_standard_refresh_intervals() -> list[float]:
    """
    Positive whole seconds from ``DASHBOARD_AUTO_REFRESH_INTERVALS``.

    Only numeric config entries are accepted. The server is authoritative;
    the frontend standard interval reader is more lenient.
    """
    configured = current_app.config.get("DASHBOARD_AUTO_REFRESH_INTERVALS")
    values: list[float] = []
    for entry in configured if isinstance(configured, (list, tuple)) else []:
        if not isinstance(entry, (list, tuple)) or len(entry) < 2:
            continue
        seconds = _to_seconds(entry[0])
        label = entry[1]
        if seconds is None or not isinstance(label, (str, LazyString)):
            continue
        if not str(label).strip() or seconds in values:
            continue
        values.append(seconds)
    return [
        value
        for value in values or DEFAULT_REFRESH_INTERVALS
        if value > 0 and float(value).is_integer()
    ]


def refresh_settings_changed(
    metadata: dict[str, Any], stored_metadata: dict[str, Any]
) -> bool:
    """Compare effective policy and frequency with the stored refresh settings."""
    return metadata.get(POLICY_KEY) != stored_metadata.get(POLICY_KEY) or metadata.get(
        "refresh_frequency", 0
    ) != stored_metadata.get("refresh_frequency", 0)


def log_refresh_policy_change(
    dashboard_id: int, old: Any, new: Any, source: str
) -> None:
    """Record a changed policy in the caller's transaction."""
    # pylint: disable=import-outside-toplevel
    from superset.extensions import db
    from superset.models.core import Log
    from superset.utils.core import get_user_id

    if not is_feature_enabled("AUTO_REFRESH_POLICY") or old == new:
        return
    db.session.add(
        Log(
            action="dashboard_refresh_policy_changed",
            user_id=get_user_id(),
            dashboard_id=dashboard_id,
            json=json.dumps({"old": old, "new": new, "source": source}),
        )
    )


def _format_bound(bound: dict[str, Any]) -> str:
    """Format a bound as a translated duration."""
    value = bound["value"]
    if bound["unit"] == "seconds":
        return ngettext("%(num)d second", "%(num)d seconds", value)
    if bound["unit"] == "minutes":
        return ngettext("%(num)d minute", "%(num)d minutes", value)
    return ngettext("%(num)d hour", "%(num)d hours", value)


def _bound_seconds(bound: Any) -> int | None:
    """Read a positive integral duration from a policy bound."""
    if not isinstance(bound, dict) or set(bound) != {"value", "unit"}:
        return None
    value, unit = bound["value"], bound["unit"]
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or value < 1
        or (isinstance(value, float) and not value.is_integer())
    ):
        return None
    if not isinstance(unit, str) or unit not in UNIT_SECONDS:
        return None
    return int(value) * UNIT_SECONDS[unit]


def check_refresh_policy(  # noqa: C901
    metadata: dict[str, Any], stored_policy: Any = None
) -> list[RefreshPolicyError]:
    """
    Check the final dashboard metadata against its ``auto_refresh_policy``.

    Returns one error per field (the first failing rule wins); an empty list
    means valid. Without a policy nothing is checked.
    """
    if not is_feature_enabled("AUTO_REFRESH_POLICY"):
        return []
    policy = metadata.get(POLICY_KEY)
    if policy is None:
        return []
    if not isinstance(policy, dict):
        return [
            RefreshPolicyError(
                POLICY_KEY,
                "invalid_policy",
                __(
                    "Auto-refresh policy must be an object with auto_refresh_allowed, "
                    "minimum_refresh_interval and "
                    "maximum_refresh_interval."
                ),
            )
        ]

    errors: dict[str, RefreshPolicyError] = {}

    def add(field: str, code: str, message: str) -> None:
        """Keep the first validation error for each field."""
        errors.setdefault(field, RefreshPolicyError(field, code, message))

    for key in policy:
        if key not in SWITCH_KEYS + BOUND_KEYS:
            add(f"{POLICY_KEY}.{key}", "invalid_policy", __("Unknown field."))
    for key in SWITCH_KEYS:
        if key in policy and not isinstance(policy[key], bool):
            add(f"{POLICY_KEY}.{key}", "invalid_policy", __("Must be true or false."))
    policy_shape_ok = not errors
    # an invalid switch counts as the default (allowed)
    allowed = policy.get("auto_refresh_allowed") is not False
    standard = get_standard_refresh_intervals()
    check_list = allowed and stored_policy != policy

    valid: dict[str, int] = {}
    set_bounds = [key for key in BOUND_KEYS if policy.get(key) is not None]
    for key in set_bounds:
        field = f"{POLICY_KEY}.{key}"
        seconds = _bound_seconds(policy[key])
        if seconds is None:
            add(
                field,
                "invalid_boundary",
                __("Use a whole number of seconds, minutes or hours."),
            )
        elif check_list and seconds not in standard:
            add(
                field,
                "invalid_boundary",
                __(
                    "%(interval)s isn't a standard interval. Select one from the list.",
                    interval=_format_bound(policy[key]),
                ),
            )
        else:
            valid[key] = seconds

    minimum, maximum = valid.get(MIN_KEY), valid.get(MAX_KEY)
    if minimum is not None and maximum is not None and minimum > maximum:
        for key in BOUND_KEYS:
            add(
                f"{POLICY_KEY}.{key}",
                "minimum_greater_than_maximum",
                __(
                    "Shortest interval must be shorter than or equal to the "
                    "longest interval."
                ),
            )
    elif (
        allowed
        and len(valid) == len(set_bounds)
        and not any(
            (minimum is None or value >= minimum)
            and (maximum is None or value <= maximum)
            for value in standard
        )
    ):
        for field in [f"{POLICY_KEY}.{key}" for key in set_bounds] or [POLICY_KEY]:
            add(
                field,
                "no_standard_interval",
                __(
                    "No standard interval fits between the shortest and longest "
                    "interval. Widen the range."
                ),
            )

    if not policy_shape_ok:
        return list(errors.values())

    frequency = metadata.get("refresh_frequency", 0)
    field = "refresh_frequency"
    if (
        isinstance(frequency, bool)
        or not isinstance(frequency, (int, float))
        or frequency < 0
        or (isinstance(frequency, float) and not frequency.is_integer())
    ):
        add(
            field,
            "invalid_refresh_frequency",
            __("Refresh frequency must be 0 or a whole number of seconds."),
        )
    elif not allowed:
        if frequency != 0:
            add(
                field,
                "auto_refresh_prohibited",
                __(
                    "Auto-refresh isn't allowed on this dashboard. Set refresh "
                    'frequency to "Don\'t refresh".'
                ),
            )
    elif frequency > 0:
        if frequency not in standard:
            add(
                field,
                "custom_not_allowed",
                __("Refresh frequency must be one of the standard intervals."),
            )
        elif minimum is not None and frequency < minimum:
            add(
                field,
                "below_minimum",
                __(
                    "Refresh frequency must be %(minimum)s or greater.",
                    minimum=_format_bound(policy[MIN_KEY]),
                ),
            )
        elif maximum is not None and frequency > maximum:
            add(
                field,
                "above_maximum",
                __(
                    "Refresh frequency must be %(maximum)s or less.",
                    maximum=_format_bound(policy[MAX_KEY]),
                ),
            )
    return list(errors.values())
