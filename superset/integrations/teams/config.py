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
"""Server-only configuration for attachment-free, single-tenant Teams alerts."""

import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from uuid import UUID


class TeamsConfigError(ValueError):
    """Invalid deployment configuration, with no supplied values in the message."""


@dataclass(frozen=True)
class TeamsDestination:
    """An operator-approved standard channel, identified by a stable recipient key."""

    key: str
    label: str
    team_id: str
    channel_id: str

    def as_public_dict(self) -> dict[str, str]:
        """Return the only destination fields intended for browser responses."""
        return {"key": self.key, "label": self.label}


@dataclass(frozen=True)
class TeamsConfig:
    """Deployment identity and destinations; never serialize this object to clients."""

    tenant_id: str
    application_id: str
    credential: str = field(repr=False)
    destinations: tuple[TeamsDestination, ...]

    def get_destination(self, key: str) -> TeamsDestination:
        """Resolve a recipient key against the deployment allowlist, failing closed."""
        for destination in self.destinations:
            if destination.key == key:
                return destination
        raise TeamsConfigError("Teams destination is not approved")

    def public_destinations(self) -> list[dict[str, str]]:
        """Project selectable destinations without identity, routing, or credentials."""
        return [destination.as_public_dict() for destination in self.destinations]


def _mapping(value: object, fields: set[str], path: str) -> Mapping[str, object]:
    """Require exactly the supported fields without echoing unknown keys or values."""
    if not isinstance(value, Mapping) or set(value) != fields:
        raise TeamsConfigError(f"{path} must contain exactly the supported fields")
    return value


def _text(value: object, path: str) -> str:
    """Require a nonempty string without silently rewriting identifiers or secrets."""
    if not isinstance(value, str) or not value.strip():
        raise TeamsConfigError(f"{path} must be a nonempty string")
    return value


def _uuid(value: object, path: str) -> str:
    """Require a concrete tenant or application UUID, excluding tenant aliases."""
    text = _text(value, path)
    try:
        parsed = UUID(text)
    except ValueError:
        raise TeamsConfigError(f"{path} must be a UUID") from None
    if parsed.int == 0:
        raise TeamsConfigError(f"{path} must be a nonzero UUID")
    return str(parsed)


def parse_teams_config(value: object) -> TeamsConfig | None:
    """Validate ALERT_REPORTS_TEAMS; an empty mapping leaves Teams unconfigured.

    This parser performs no network calls and imports no optional Teams dependency.
    Operators must approve standard channels in the configured tenant. Channel IDs
    alone cannot establish membership or distinguish standard/private/shared types.
    Feature gating and Teams metadata checks belong to the future delivery layer.
    """
    if isinstance(value, Mapping) and not value:
        return None
    config = _mapping(
        value,
        {"tenant_id", "application_id", "credential", "destinations"},
        "ALERT_REPORTS_TEAMS",
    )
    tenant_id = _uuid(config["tenant_id"], "Teams tenant_id")
    application_id = _uuid(config["application_id"], "Teams application_id")
    credential = _text(config["credential"], "Teams credential")
    raw_destinations = config["destinations"]
    if not isinstance(raw_destinations, (list, tuple)) or not raw_destinations:
        raise TeamsConfigError("Teams destinations must be a nonempty list or tuple")
    destinations: list[TeamsDestination] = []
    keys: set[str] = set()
    channels: set[tuple[str, str]] = set()
    for raw_destination in raw_destinations:
        destination = _mapping(
            raw_destination,
            {"key", "label", "team_id", "channel_id"},
            "Teams destination",
        )
        key = _text(destination["key"], "Teams destination key")
        if not re.fullmatch(r"[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}", key):
            raise TeamsConfigError("Teams destination key must be a stable identifier")
        label = _text(destination["label"], "Teams destination label")
        team_id = _text(destination["team_id"], "Teams destination team_id")
        channel_id = _text(destination["channel_id"], "Teams destination channel_id")
        if key in keys or (team_id, channel_id) in channels:
            raise TeamsConfigError("Teams destination keys and channels must be unique")
        keys.add(key)
        channels.add((team_id, channel_id))
        destinations.append(TeamsDestination(key, label, team_id, channel_id))
    return TeamsConfig(tenant_id, application_id, credential, tuple(destinations))
