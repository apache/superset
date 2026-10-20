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
"""Browser discovery only projects approved keys and active-installation status."""

from collections.abc import Iterator
from typing import Any
from unittest.mock import MagicMock

import pytest
from flask import current_app, Flask
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from superset.integrations.teams import destinations
from superset.integrations.teams.models import TeamsInstallation
from superset.integrations.teams.store import TeamsInstallationStore

TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
APPLICATION = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
OTHER = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"


@pytest.fixture
def configured_app(monkeypatch: pytest.MonkeyPatch) -> Iterator[Flask]:
    app = Flask(__name__)
    app.config["ALERT_REPORTS_TEAMS"] = {
        "tenant_id": TENANT,
        "application_id": APPLICATION,
        "credential": "never-return-this-credential",
        "destinations": [
            {
                "key": "ops",
                "label": "Operations",
                "team_id": "team-1",
                "channel_id": "channel-1",
            },
            {
                "key": "finance",
                "label": "Finance",
                "team_id": "team-1",
                "channel_id": "channel-2",
            },
            {
                "key": "support",
                "label": "Support",
                "team_id": "team-2",
                "channel_id": "channel-3",
            },
        ],
    }
    monkeypatch.setattr(
        destinations.feature_flag_manager, "is_feature_enabled", lambda name: True
    )
    monkeypatch.setattr(destinations, "is_teams_sdk_installed", lambda: True)
    engine = create_engine("sqlite://")
    TeamsInstallation.__table__.create(engine)
    monkeypatch.setattr(destinations, "db", MagicMock(engine=engine))
    with app.app_context():
        yield app
    engine.dispose()


def test_only_approved_public_fields_and_missing_installations(
    configured_app: Flask,
) -> None:
    assert destinations.list_teams_destinations() == [
        {"key": "ops", "label": "Operations", "available": False},
        {"key": "finance", "label": "Finance", "available": False},
        {"key": "support", "label": "Support", "available": False},
    ]


def test_removal_and_reinstallation_update_availability(configured_app: Flask) -> None:
    with Session(destinations.db.engine) as session:
        store = TeamsInstallationStore(session)
        store.install(
            TENANT, APPLICATION, "team-1", "https://smba.trafficmanager.net/amer/"
        )
        store.install(
            TENANT,
            APPLICATION,
            "unapproved-team",
            "https://smba.trafficmanager.net/amer/",
        )
        session.commit()
        assert [
            item["available"] for item in destinations.list_teams_destinations()
        ] == [True, True, False]
        store.remove(TENANT, APPLICATION, "team-1")
        session.commit()
        assert not any(
            item["available"] for item in destinations.list_teams_destinations()
        )
        store.install(
            TENANT, APPLICATION, "team-1", "https://smba.trafficmanager.net/emea/"
        )
        session.commit()
        assert [
            item["available"] for item in destinations.list_teams_destinations()
        ] == [True, True, False]
        assert len(destinations.list_teams_destinations()) == 3


@pytest.mark.parametrize("tenant,application", [(OTHER, APPLICATION), (TENANT, OTHER)])
def test_other_identity_cannot_make_destination_available(
    configured_app: Flask, tenant: str, application: str
) -> None:
    with Session(destinations.db.engine) as session:
        TeamsInstallationStore(session).install(
            tenant, application, "team-1", "https://smba.trafficmanager.net/amer/"
        )
        session.commit()
    assert not any(item["available"] for item in destinations.list_teams_destinations())


@pytest.mark.parametrize("configuration", [{}, {"credential": "invalid-secret"}])
def test_unconfigured_or_invalid_integration_is_hidden(
    configured_app: Flask, configuration: dict[str, Any]
) -> None:
    current_app.config["ALERT_REPORTS_TEAMS"] = configuration
    assert destinations.configured_teams() is None
    assert destinations.list_teams_destinations() == []


def test_disabled_integration_does_not_query_installations(
    configured_app: Flask, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        destinations.feature_flag_manager, "is_feature_enabled", lambda name: False
    )
    monkeypatch.setattr(
        destinations, "Session", MagicMock(side_effect=AssertionError("must not query"))
    )
    assert destinations.list_teams_destinations() == []


@pytest.mark.parametrize("team_id", ["t" * 256, " team-1", "team-1 ", "\tteam-1\n"])
def test_invalid_team_config_is_hidden_before_installation_lookup(
    configured_app: Flask,
    monkeypatch: pytest.MonkeyPatch,
    team_id: str,
) -> None:
    """Discovery handles invalid deployment IDs instead of raising store ValueError."""
    configured_app.config["ALERT_REPORTS_TEAMS"]["destinations"][0]["team_id"] = team_id
    lookup = MagicMock(side_effect=AssertionError("must not query installations"))
    monkeypatch.setattr(destinations, "Session", lookup)
    assert destinations.configured_teams() is None
    assert destinations.list_teams_destinations() == []
    lookup.assert_not_called()


@pytest.mark.parametrize("installed", [False, True])
def test_optional_sdk_controls_both_discovery_and_notification_methods(
    configured_app: Flask,
    monkeypatch: pytest.MonkeyPatch,
    installed: bool,
) -> None:
    """Bootstrap and destination discovery agree when the optional SDK is missing."""
    from superset.reports.models import ReportRecipientType
    from superset.views import base

    monkeypatch.setattr(destinations, "is_teams_sdk_installed", lambda: installed)
    monkeypatch.setattr(base, "app", configured_app)
    configured_app.config["SLACK_API_TOKEN"] = None
    if installed:
        assert destinations.configured_teams() is not None
        assert len(destinations.list_teams_destinations()) == 3
        assert ReportRecipientType.TEAMS in base._notification_methods()
    else:
        session = MagicMock(side_effect=AssertionError("must not query installations"))
        monkeypatch.setattr(destinations, "Session", session)
        assert destinations.configured_teams() is None
        assert destinations.list_teams_destinations() == []
        assert ReportRecipientType.TEAMS not in base._notification_methods()
        session.assert_not_called()


def test_disabled_integration_registers_and_bootstraps_without_sdk(
    configured_app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """The Teams startup paths require neither SDK imports nor a dependency lookup."""
    import sys

    from superset.integrations.teams.api import register_teams_api
    from superset.reports.models import ReportRecipientType
    from superset.views import base

    monkeypatch.setattr(
        destinations.feature_flag_manager, "is_feature_enabled", lambda _: False
    )
    missing_sdk = MagicMock(side_effect=AssertionError("must not check SDK"))
    monkeypatch.setattr(destinations, "is_teams_sdk_installed", missing_sdk)
    monkeypatch.setitem(sys.modules, "superset.integrations.teams.adapter", None)
    monkeypatch.setitem(sys.modules, "microsoft_teams", None)
    monkeypatch.setitem(sys.modules, "microsoft_teams.apps", None)
    monkeypatch.setattr(base, "app", configured_app)
    register_teams_api(configured_app)
    assert destinations.configured_teams() is None
    assert destinations.list_teams_destinations() == []
    assert ReportRecipientType.TEAMS not in base._notification_methods()
    assert (
        configured_app.test_client().post("/api/v1/teams/events/", json={}).status_code
        == 404
    )
    missing_sdk.assert_not_called()
