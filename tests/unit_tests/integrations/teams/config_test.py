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
"""Tests for server-side Teams configuration and safe destination projection."""

from copy import deepcopy
from typing import Any

import pytest

from superset.integrations.teams.config import parse_teams_config, TeamsConfigError


@pytest.fixture
def deployment(teams_config: dict[str, Any]) -> dict[str, Any]:
    teams_config["destinations"][0].update(
        key="operations",
        label="Operations alerts",
        channel_id="19:channel@thread.tacv2",
    )
    return teams_config


def test_unconfigured() -> None:
    assert parse_teams_config({}) is None


def test_valid_config_is_immutable_and_hides_credential(
    deployment: dict[str, Any],
) -> None:
    config = parse_teams_config(deployment)
    assert config is not None
    assert config.tenant_id == deployment["tenant_id"]
    assert config.application_id == deployment["application_id"]
    assert config.credential == deployment["credential"]
    assert config.get_destination("operations").channel_id == "19:channel@thread.tacv2"
    assert deployment["credential"] not in repr(config)
    deployment["destinations"][0]["key"] = "changed"
    assert config.get_destination("operations").key == "operations"
    with pytest.raises(TeamsConfigError, match="not approved"):
        config.get_destination("unapproved")


@pytest.mark.parametrize(
    "field", ["tenant_id", "application_id", "credential", "destinations"]
)
def test_required_fields(deployment: dict[str, Any], field: str) -> None:
    del deployment[field]
    with pytest.raises(TeamsConfigError):
        parse_teams_config(deployment)


@pytest.mark.parametrize("field", ["tenant_id", "application_id", "credential"])
@pytest.mark.parametrize("value", [None, "", "  ", 123, []])
def test_invalid_identity(
    deployment: dict[str, Any], field: str, value: object
) -> None:
    deployment[field] = value
    with pytest.raises(TeamsConfigError):
        parse_teams_config(deployment)


@pytest.mark.parametrize("field", ["tenant_id", "application_id"])
@pytest.mark.parametrize("value", ["common", "organizations", "not-a-uuid", "0" * 32])
def test_requires_concrete_uuid(
    deployment: dict[str, Any], field: str, value: str
) -> None:
    deployment[field] = value
    with pytest.raises(TeamsConfigError):
        parse_teams_config(deployment)


@pytest.mark.parametrize("value", [None, [], "secret-value", 1])
def test_invalid_top_level(value: object) -> None:
    with pytest.raises(TeamsConfigError) as exc:
        parse_teams_config(value)
    assert "secret-value" not in str(exc.value)


@pytest.mark.parametrize("value", [None, {}, [], "operations", [None]])
def test_invalid_destinations(deployment: dict[str, Any], value: object) -> None:
    deployment["destinations"] = value
    with pytest.raises(TeamsConfigError):
        parse_teams_config(deployment)


@pytest.mark.parametrize("field", ["key", "label", "team_id", "channel_id"])
@pytest.mark.parametrize("value", [None, "", "  ", 123])
def test_invalid_destination_fields(
    deployment: dict[str, Any], field: str, value: object
) -> None:
    deployment["destinations"][0][field] = value
    with pytest.raises(TeamsConfigError):
        parse_teams_config(deployment)


@pytest.mark.parametrize("key", ["has spaces", "../path", "a" * 129])
def test_invalid_stable_key(deployment: dict[str, Any], key: str) -> None:
    deployment["destinations"][0]["key"] = key
    with pytest.raises(TeamsConfigError):
        parse_teams_config(deployment)


@pytest.mark.parametrize("duplicate_key", [True, False])
def test_duplicate_destinations(
    deployment: dict[str, Any], duplicate_key: bool
) -> None:
    duplicate = deepcopy(deployment["destinations"][0])
    duplicate["channel_id" if duplicate_key else "key"] = "other"
    deployment["destinations"].append(duplicate)
    with pytest.raises(TeamsConfigError, match="unique"):
        parse_teams_config(deployment)


@pytest.mark.parametrize("nested", [True, False])
def test_unknown_fields_do_not_leak_values(
    deployment: dict[str, Any], nested: bool
) -> None:
    target = deployment["destinations"][0] if nested else deployment
    target["secret-unknown-key"] = deployment["credential"]
    with pytest.raises(TeamsConfigError) as exc:
        parse_teams_config(deployment)
    assert deployment["credential"] not in str(exc.value)
    assert "secret-unknown-key" not in str(exc.value)


@pytest.mark.parametrize("team_id", ["t" * 256, " team-1", "team-1 ", "\tteam-1\n"])
def test_rejects_team_ids_incompatible_with_installation_identity(
    deployment: dict[str, Any],
    team_id: str,
) -> None:
    """Bad deployment identifiers fail at parsing, without leaking their values."""
    deployment["destinations"][0]["team_id"] = team_id
    with pytest.raises(TeamsConfigError, match="Teams team ID") as error:
        parse_teams_config(deployment)
    assert team_id not in str(error.value)
    assert deployment["destinations"][0]["team_id"] == team_id


@pytest.mark.parametrize("team_id", ["t", "t" * 255])
def test_accepts_team_id_length_boundaries(
    deployment: dict[str, Any],
    team_id: str,
) -> None:
    """Identifiers at both supported limits remain intact."""
    deployment["destinations"][0]["team_id"] = team_id
    config = parse_teams_config(deployment)
    assert config is not None
    assert config.destinations[0].team_id == team_id
