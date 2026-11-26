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
"""
The changes a dashboard copy or import makes to fit the time range limits.
The code that applies them records them, so the list asked for always matches
what is saved.
"""

from __future__ import annotations

import hashlib
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from flask_babel import gettext as _
from marshmallow import ValidationError

from superset.commands.exceptions import CommandInvalidError
from superset.extensions import feature_flag_manager
from superset.time_range_limits.policy import (
    describe_rule,
    describe_time_range,
    FEATURE_FLAG,
    RULES,
)
from superset.utils import json

ADJUSTMENTS_KEY = "time_range_adjustments"
FINGERPRINT_KEY = "time_range_adjustments_fingerprint"
LIMIT = "time_range_limit"
FILTER_DEFAULT = "filter_default"
DEFAULT = "default"
APPLIED_RANGE = "applied_range"


@dataclass(frozen=True)
class TimeRangeAdjustment:
    """
    One change: a dashboard rule (``kind`` ``"time_range_limit"``, ``field`` the
    rule) or a Time Range filter (``"filter_default"``, ``name`` the filter,
    ``field`` ``"default"`` for its default or ``"applied_range"`` for the range
    its saved state sends to charts). ``dashboard_key`` identifies the dashboard
    across attempts (the source's UUID on a copy, the imported UUID on an
    import), ``filter_id`` the native filter and ``file_name`` the import file.
    ``filter_key`` identifies a filter in the fingerprint: ``native:<id>``, or
    ``migrated:<filter-box UUID>:<field>`` for a filter an import migrated from
    a filter box, whose id is new on every attempt.
    """

    kind: str
    dashboard: str
    name: str
    field: str
    old: Any
    new: Any
    dashboard_key: str = ""
    filter_id: str | None = None
    file_name: str | None = None
    filter_key: str | None = None

    def labels(self) -> tuple[str, str]:
        if self.kind == LIMIT:
            return describe_rule(self.old), describe_rule(self.new)
        return describe_time_range(self.old), describe_time_range(self.new)

    def identity(self) -> list[Any]:
        """What the fingerprint covers."""
        return [
            self.file_name,
            self.dashboard_key,
            self.filter_key or self.filter_id,
            self.kind,
            self.field,
            self.old,
            self.new,
        ]

    def as_dict(self) -> dict[str, Any]:
        old_label, new_label = self.labels()
        return {
            "kind": self.kind,
            "dashboard": self.dashboard,
            "dashboard_key": self.dashboard_key,
            "file": self.file_name,
            "name": self.name,
            "filter_id": self.filter_id,
            "field": self.field,
            "old": self.old,
            "new": self.new,
            "old_label": old_label,
            "new_label": new_label,
        }

    def describe(self) -> str:
        old_label, new_label = self.labels()
        if self.kind == LIMIT:
            rule = {
                "max_span": _("maximum span"),
                "max_look_back": _("maximum look-back"),
                "max_look_forward": _("maximum look-forward"),
            }[self.field]
            return _(
                'Dashboard "%(dashboard)s": %(rule)s %(old)s → %(new)s',
                dashboard=self.dashboard,
                rule=rule,
                old=old_label,
                new=new_label,
            )
        if self.field == APPLIED_RANGE:
            return _(
                'Dashboard "%(dashboard)s": time range filter "%(name)s" applied '
                'range "%(old)s" → "%(new)s"',
                dashboard=self.dashboard,
                name=self.name,
                old=old_label,
                new=new_label,
            )
        return _(
            'Dashboard "%(dashboard)s": time range filter "%(name)s" default '
            '"%(old)s" → "%(new)s"',
            dashboard=self.dashboard,
            name=self.name,
            old=old_label,
            new=new_label,
        )


def limit_adjustments(
    dashboard: str,
    raw: dict[str, Any] | None,
    clamped: dict[str, Any] | None,
    dashboard_key: str = "",
) -> list[TimeRangeAdjustment]:
    """The rules a clamp rewrote, from the policy before and after."""
    if raw is None or clamped is None:
        return []
    return [
        TimeRangeAdjustment(
            LIMIT,
            dashboard,
            dashboard,
            rule,
            raw[rule],
            clamped[rule],
            dashboard_key=dashboard_key,
        )
        for rule in RULES
        if raw.get(rule) != clamped.get(rule)
    ]


def adjustments_fingerprint(adjustments: Sequence[TimeRangeAdjustment]) -> str:
    """A digest of the changes, the same while they stay the same."""
    identities = sorted(
        json.dumps(item.identity(), sort_keys=True) for item in adjustments
    )
    return hashlib.sha256("\n".join(identities).encode()).hexdigest()


def check_consent(
    adjustments: Sequence[TimeRangeAdjustment],
    adjust_time_ranges: bool,
    fingerprint: str | None = None,
) -> None:
    """
    Refuse changes the caller hasn't agreed to. ``adjust_time_ranges`` with no
    ``fingerprint`` agrees to whatever is needed; with one, only to the changes
    it was issued for, so a list that changed since is asked again, even one
    that no longer has any changes: saving the source as it is would not be
    what the caller agreed to either.
    """
    if not feature_flag_manager.is_feature_enabled(FEATURE_FLAG):
        return
    if adjust_time_ranges and fingerprint:
        if fingerprint == adjustments_fingerprint(adjustments):
            return
    elif not adjustments or adjust_time_ranges:
        return
    raise TimeRangeAdjustmentsRequiredError(adjustments)


class TimeRangeDefaultsInvalidError(CommandInvalidError):
    """A Time Range filter default that no rolling range within the limits can
    replace."""


class TimeRangeAdjustmentsRequiredError(CommandInvalidError):
    """A copy or import would change time ranges the caller hasn't agreed to."""

    def __init__(self, adjustments: Sequence[TimeRangeAdjustment]) -> None:
        self.adjustments = list(adjustments)
        self.fingerprint = adjustments_fingerprint(self.adjustments)
        by_file: dict[str | None, list[dict[str, Any]]] = {}
        for adjustment in self.adjustments:
            by_file.setdefault(adjustment.file_name, []).append(adjustment.as_dict())
        errors: list[ValidationError] = []
        for file_name, items in by_file.items():
            message: dict[str, Any] = {ADJUSTMENTS_KEY: items}
            errors.append(
                ValidationError(message if file_name is None else {file_name: message})
            )
        errors.append(ValidationError({FINGERPRINT_KEY: self.fingerprint}))
        super().__init__(
            _(
                "The dashboard time ranges don't fit the time range limits. To "
                "apply these changes, send the request again with "
                "adjust_time_ranges set to true: %(changes)s",
                changes="; ".join(item.describe() for item in self.adjustments),
            )
            if self.adjustments
            else _(
                "The time range changes you agreed to are no longer needed. To "
                "continue without changes, send the request again with the new "
                "time_range_adjustments_fingerprint."
            ),
            errors,
        )

    def payload(self) -> list[dict[str, Any]]:
        return [adjustment.as_dict() for adjustment in self.adjustments]
