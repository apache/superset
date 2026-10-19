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
"""Microsoft Teams SDK boundary for synchronous Flask installation callbacks."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Any, Literal
from uuid import UUID

from microsoft_teams.api import (
    ClientCredentials,
    InstalledActivity,
    InvokeResponse,
    JsonWebToken,
    UninstalledActivity,
)
from microsoft_teams.api.auth.cloud_environment import PUBLIC
from microsoft_teams.apps import HttpServer, HttpServerAdapter
from microsoft_teams.apps.events import ActivityEvent
from microsoft_teams.apps.http import HttpRequest, HttpResponse, HttpRouteHandler
from pydantic import ValidationError

from superset.integrations.teams.config import TeamsConfig

EVENTS_PATH = "/api/v1/teams/events/"


@dataclass(frozen=True)
class TeamsInstallationEvent:
    """Authenticated, deployment-scoped installation data, with no SDK objects."""

    team_id: str
    service_url: str
    active: bool


@dataclass(frozen=True)
class TeamsEventResult:
    """Callback outcome; only an authenticated event may reach persistence."""

    status: int
    event: TeamsInstallationEvent | None = None


class _FlaskServerAdapter(HttpServerAdapter):
    """Capture the SDK route for one invocation of Flask's existing POST route.

    Flask registers its route once at startup. Each request creates a fresh SDK
    authentication server; its handler runs to completion in an operation-scoped
    event loop. No SDK App, outbound clients, tasks, or separate server are created.
    """

    def __init__(self) -> None:
        """Hold only the handler for this request."""
        self.handler: HttpRouteHandler | None = None

    def register_route(
        self, method: Literal["POST"], path: str, handler: HttpRouteHandler
    ) -> None:
        """Accept only the independently authenticated Teams callback."""
        if method != "POST" or path != EVENTS_PATH or self.handler is not None:
            raise ValueError("Unexpected Teams SDK route registration")
        self.handler = handler

    async def start(self, port: int) -> None:
        """Prevent the SDK from starting its own HTTP server."""
        raise RuntimeError("Flask manages the Teams callback server")

    async def stop(self) -> None:
        """Release the operation's handler; Flask owns the HTTP server."""
        self.handler = None


def _same_uuid(value: object, expected: str) -> bool:
    """Compare concrete UUIDs without accepting tenant aliases."""
    try:
        return isinstance(value, str) and UUID(value) == UUID(expected)
    except ValueError:
        return False


def _allowed_token(config: TeamsConfig, event: ActivityEvent) -> bool:
    """Restrict the SDK's broader auth support to expiring bot service tokens."""
    # Only Bot Framework service tokens bind serviceurl to a signed claim.
    # Agent 365/Entra activities and bot-to-bot callers are outside this integration.
    token = event.token
    return (
        isinstance(token, JsonWebToken)
        and token.issuer == PUBLIC.token_issuer
        and token.expiration is not None
        and (not token.tenant_id or _same_uuid(token.tenant_id, config.tenant_id))
    )


def _installation_event(
    config: TeamsConfig, event: ActivityEvent, body: dict[str, Any]
) -> TeamsEventResult:
    """Apply deployment restrictions only after the SDK has authenticated the token."""
    if not _allowed_token(config, event):
        return TeamsEventResult(403)
    token = event.token
    if body.get("type") != "installationUpdate" or body.get("action") not in (
        "add",
        "remove",
    ):
        return TeamsEventResult(400)
    if body.get("attachments"):
        return TeamsEventResult(400)
    # Require the wire-format fields used by SDK authentication. Do not allow
    # model defaults or snake_case aliases to bypass missing channel/service data.
    if body.get("channelId") != "msteams" or not isinstance(
        body.get("serviceUrl"), str
    ):
        return TeamsEventResult(400)
    service_url = body["serviceUrl"]
    if not service_url or token.service_url.rstrip("/") != service_url.rstrip("/"):
        return TeamsEventResult(403)
    try:
        model = InstalledActivity if body["action"] == "add" else UninstalledActivity
        activity = model.model_validate(body)
    except ValidationError:
        return TeamsEventResult(400)
    if activity.recipient.id not in {
        config.application_id,
        f"28:{config.application_id}",
    }:
        return TeamsEventResult(403)
    data = activity.channel_data
    if (
        data is None
        or data.tenant is None
        or not _same_uuid(data.tenant.id, config.tenant_id)
        or activity.conversation.conversation_type != "channel"
        or (
            activity.conversation.tenant_id is not None
            and not _same_uuid(activity.conversation.tenant_id, config.tenant_id)
        )
        or data.team is None
        or not data.team.id
        or data.team.team_type not in (None, "standard")
        or (data.channel is not None and data.channel.type not in (None, "standard"))
    ):
        return TeamsEventResult(403)
    approved_teams = {destination.team_id for destination in config.destinations}
    if data.team.id not in approved_teams:
        return TeamsEventResult(403)
    return TeamsEventResult(
        200, TeamsInstallationEvent(data.team.id, service_url, body["action"] == "add")
    )


def process_teams_event(
    config: TeamsConfig, body: dict[str, Any], headers: dict[str, str]
) -> TeamsEventResult:
    """Authenticate through the SDK's server adapter without starting a server.

    The SDK's HttpServer uses PyJWKClient, whose network responses close within
    its scoped fetch. It creates no persistent HTTP clients. Keep construction,
    authentication, and adapter cleanup within the same event loop; asyncio.run
    closes that loop on success and failure. SDK response bodies are never exposed.
    """

    async def process() -> TeamsEventResult:
        """Run one SDK invocation, returning only sanitized application data."""
        adapter = _FlaskServerAdapter()
        result = TeamsEventResult(500)

        async def on_request(event: ActivityEvent) -> InvokeResponse[None]:
            """Receive activities only after SDK authentication succeeds."""
            nonlocal result
            result = _installation_event(config, event, body)
            return InvokeResponse(status=result.status)

        try:
            server = HttpServer(adapter, messaging_endpoint=EVENTS_PATH)
            server.on_request = on_request
            server.initialize(
                credentials=ClientCredentials(
                    client_id=config.application_id,
                    client_secret=config.credential,
                    tenant_id=config.tenant_id,
                ),
                dangerously_allow_unauthenticated_requests=False,
            )
            if adapter.handler is None:
                return TeamsEventResult(500)
            response: HttpResponse = await adapter.handler(
                HttpRequest(body=body, headers=headers)
            )
            if response["status"] != 200:
                return TeamsEventResult(response["status"])
            return result
        finally:
            await adapter.stop()

    return asyncio.run(process())
