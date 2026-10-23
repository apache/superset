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
"""Microsoft Teams SDK boundary for Flask callbacks and root channel delivery."""

from __future__ import annotations

import asyncio
import math
from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from time import monotonic
from typing import Any, Literal, Protocol
from uuid import UUID

import httpx
import requests
from microsoft_teams.api import (
    ApiClient,
    Attachment,
    ClientCredentials,
    InstalledActivity,
    InvokeResponse,
    JsonWebToken,
    MessageActivityInput,
    UninstalledActivity,
)
from microsoft_teams.api.auth.cloud_environment import PUBLIC
from microsoft_teams.api.clients.conversation import CreateConversationParams
from microsoft_teams.apps import HttpServer, HttpServerAdapter
from microsoft_teams.apps.events import ActivityEvent
from microsoft_teams.apps.http import HttpRequest, HttpResponse, HttpRouteHandler
from microsoft_teams.common import Client, ClientOptions
from msal import ConfidentialClientApplication
from pydantic import ValidationError

from superset.integrations.teams.config import TeamsConfig, TeamsDestination

EVENTS_PATH = "/api/v1/teams/events/"


@dataclass(frozen=True)
class TeamsInstallationEvent:
    """Authenticated, deployment-scoped installation data, with no SDK objects."""

    team_id: str
    service_url: str
    active: bool
    event_at: datetime


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
    event_at = activity.timestamp
    if (
        body.get("attachments")
        or event_at is None
        or event_at.tzinfo is None
        or event_at.utcoffset() is None
    ):
        return TeamsEventResult(400)
    return TeamsEventResult(
        200,
        TeamsInstallationEvent(
            data.team.id, service_url, body["action"] == "add", event_at
        ),
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


# Count every send, including the single 401 replay, against the same retry bound.
_DELIVERY_ATTEMPTS = 4
_DELIVERY_TIMEOUT = 60.0
_DELIVERY_REQUEST_TIMEOUT = 10.0


class TeamsDeliveryError(Exception):
    """Sanitized delivery outcome for mapping to existing notification exceptions."""

    def __init__(
        self, category: Literal["authorization", "transient", "parameter"]
    ) -> None:
        """Expose a stable message without response bodies, SQL, tokens, or URLs."""
        self.category = category
        messages = {
            "authorization": "Teams bot authorization failed",
            "transient": "Teams alert delivery temporarily unavailable",
            "parameter": "Teams alert delivery was rejected",
        }
        super().__init__(messages[category])


class TeamsTransportError(Exception):
    """An HTTP failure carrying only the status and Microsoft's retry metadata."""

    def __init__(
        self,
        status: int | None = None,
        headers: httpx.Headers
        | requests.structures.CaseInsensitiveDict[str]
        | None = None,
    ) -> None:
        """Retain only retry headers; never retain a response body or request token."""
        super().__init__("Teams transport request failed")
        self.status = status
        self.retry_after = headers.get("Retry-After") if headers is not None else None
        self.retry_after_ms = (
            headers.get("x-ms-retry-after-ms") if headers is not None else None
        )


class TeamsTransport(Protocol):
    """Replaceable operation-scoped transport; retries live outside SDK calls."""

    async def post_root(
        self, destination: TeamsDestination, card: dict[str, Any]
    ) -> None:
        """Create a new channel root post containing the card."""
        ...

    async def refresh_auth(self) -> None:
        """Invalidate cached authentication before a single 401 replay."""
        ...


def _remaining(deadline: float) -> float:
    """Bound each request by its timeout and remaining delivery budget."""
    remaining = deadline - monotonic()
    if remaining <= 0:
        raise TeamsTransportError()
    return min(_DELIVERY_REQUEST_TIMEOUT, remaining)


class _AuthHttpClient:
    """MSAL HTTP interface backed by a caller-owned, timeout-bounded session."""

    def __init__(self, session: requests.Session, deadline: float) -> None:
        """Keep OAuth traffic within the same operation as the channel post."""
        self.session = session
        self.deadline = deadline

    def get(self, url: str, **kwargs: Any) -> requests.Response:
        """Fetch MSAL metadata without leaving a response open."""
        return self._request("GET", url, **kwargs)

    def post(self, url: str, **kwargs: Any) -> requests.Response:
        """Acquire tokens without leaving a response open."""
        return self._request("POST", url, **kwargs)

    def _request(self, method: str, url: str, **kwargs: Any) -> requests.Response:
        """Use normal serialization, explicit timeouts, and sanitized retry errors."""
        kwargs["timeout"] = _remaining(self.deadline)
        response = self.session.request(method, url, **kwargs)
        try:
            _remaining(self.deadline)
            # requests eagerly reads responses; MSAL can still read cached JSON
            # after close. Closing here also covers retryable OAuth errors.
            if response.status_code in (408, 429) or response.status_code >= 500:
                raise TeamsTransportError(response.status_code, response.headers)
            return response
        finally:
            response.close()


class _ChannelConversationParams(CreateConversationParams):
    """Include the connector's group flag, absent from the SDK base parameter model."""

    is_group: Literal[True] = True


class _SDKTeamsTransport:
    """Use the SDK create-conversation API with shared, explicitly owned resources."""

    def __init__(
        self,
        config: TeamsConfig,
        service_url: str,
        http: Client,
        auth_http: _AuthHttpClient,
        deadline: float,
    ) -> None:
        """Prepare the SDK without constructing a full App or starting a server."""
        self.config = config
        self.http = http
        self.auth_http = auth_http
        self.deadline = deadline
        self.auth: ConfidentialClientApplication | None = None
        self.api = ApiClient(service_url, http)

    def _authenticate(self) -> None:
        """Acquire a bot token without exposing identity-provider errors."""
        if self.http.token:
            return
        if self.auth is None:
            self.auth = ConfidentialClientApplication(
                self.config.application_id,
                client_credential=self.config.credential,
                authority=f"{PUBLIC.login_endpoint}/{self.config.tenant_id}",
                http_client=self.auth_http,
                instance_discovery=False,
            )
        result = self.auth.acquire_token_for_client([PUBLIC.bot_scope])
        token = result.get("access_token")
        if not isinstance(token, str) or not token:
            status = (
                503
                if result.get("error") in {"temporarily_unavailable", "server_error"}
                else 401
            )
            raise TeamsTransportError(status)
        self.http.token = token

    async def refresh_auth(self) -> None:
        """Invalidate MSAL app tokens so the next request acquires a fresh token."""
        if self.auth is not None:
            self.auth.remove_tokens_for_client()
        self.http.token = None

    async def post_root(
        self, destination: TeamsDestination, card: dict[str, Any]
    ) -> None:
        """Create a new conversation with an initial card, never reply to a thread."""
        try:
            self._authenticate()
            self.http.http.timeout = httpx.Timeout(_remaining(self.deadline))
            await self.api.conversations.create(
                _ChannelConversationParams(
                    tenant_id=self.config.tenant_id,
                    channel_data={
                        "tenant": {"id": self.config.tenant_id},
                        "team": {"id": destination.team_id},
                        "channel": {"id": destination.channel_id},
                    },
                    activity=MessageActivityInput(
                        attachments=[
                            Attachment(
                                content_type="application/vnd.microsoft.card.adaptive",
                                content=card,
                            )
                        ]
                    ),
                )
            )
        except httpx.HTTPStatusError as ex:
            error = TeamsTransportError(ex.response.status_code, ex.response.headers)
            await ex.response.aclose()
            raise error from None
        except (httpx.RequestError, requests.RequestException):
            raise TeamsTransportError() from None
        except ValueError:
            # Includes invalid SDK models/response JSON. Replaying a successful
            # POST whose response could not be decoded could duplicate delivery.
            raise TeamsDeliveryError("parameter") from None


@asynccontextmanager
async def _create_transport(
    config: TeamsConfig, service_url: str, deadline: float
) -> AsyncIterator[TeamsTransport]:
    """Close the SDK's shared async client and MSAL's session in the same operation."""
    http = Client(ClientOptions(timeout=_DELIVERY_REQUEST_TIMEOUT))
    try:
        with requests.Session() as session:
            yield _SDKTeamsTransport(
                config, service_url, http, _AuthHttpClient(session, deadline), deadline
            )
    finally:
        await http.http.aclose()


def _retry_delay(error: TeamsTransportError, attempt: int) -> float:
    """Honor Microsoft's retry headers, falling back to bounded exponential delays."""
    delays: list[float] = []
    for value, divisor in [(error.retry_after_ms, 1000), (error.retry_after, 1)]:
        if value is None:
            continue
        try:
            delay = float(value) / divisor
        except ValueError:
            if divisor != 1:
                continue
            try:
                retry_at = parsedate_to_datetime(value)
                if retry_at.tzinfo is None:
                    retry_at = retry_at.replace(tzinfo=timezone.utc)
                delay = (retry_at - datetime.now(timezone.utc)).total_seconds()
            except (ValueError, TypeError, OverflowError):
                continue
        if math.isfinite(delay):
            delays.append(max(0.0, delay))
    return max(delays) if delays else min(2.0**attempt, 8.0)


async def _deliver_with_retries(
    transport: TeamsTransport,
    destination: TeamsDestination,
    card: dict[str, Any],
    deadline: float,
) -> None:
    """Bound transient retries and allow exactly one authentication refresh."""
    refreshed = False
    for attempt in range(_DELIVERY_ATTEMPTS):
        if monotonic() >= deadline:
            raise TeamsDeliveryError("transient")
        try:
            await transport.post_root(destination, card)
            if monotonic() >= deadline:
                raise TeamsDeliveryError("transient")
            return
        except TeamsTransportError as error:
            if error.status in (401, 403):
                if (
                    error.status == 403
                    or refreshed
                    or attempt == _DELIVERY_ATTEMPTS - 1
                ):
                    raise TeamsDeliveryError("authorization") from None
                refreshed = True
                await transport.refresh_auth()
                continue
            if (
                error.status is not None
                and error.status not in (408, 429)
                and not 500 <= error.status < 600
            ):
                raise TeamsDeliveryError("parameter") from None
            delay = _retry_delay(error, attempt)
            if attempt == _DELIVERY_ATTEMPTS - 1 or delay >= deadline - monotonic():
                # Never shorten a server-specified delay to squeeze in a retry.
                raise TeamsDeliveryError("transient") from None
            await asyncio.sleep(delay)
    raise TeamsDeliveryError("transient")


TransportFactory = Callable[
    [TeamsConfig, str, float], AbstractAsyncContextManager[TeamsTransport]
]


def deliver_teams_alert(
    config: TeamsConfig,
    destination: TeamsDestination,
    service_url: str,
    card: dict[str, Any],
    *,
    retry_deadline: float | None = None,
    transport_factory: TransportFactory | None = None,
) -> None:
    """Share one retry budget across authentication, posting and resource cleanup.

    Synchronous MSAL requests and async SDK posts have explicit socket timeouts.
    The existing Celery soft/hard task limits bound blocking work that cannot be
    interrupted by a cooperative deadline, including DNS and resource teardown.
    """
    deadline = monotonic() + _DELIVERY_TIMEOUT
    if retry_deadline is not None:
        deadline = min(deadline, retry_deadline)
    if monotonic() >= deadline:
        raise TeamsDeliveryError("transient")

    async def deliver() -> None:
        """Construct, retry and close the transport in the same event loop."""
        factory = transport_factory or _create_transport
        async with factory(config, service_url, deadline) as transport:
            await _deliver_with_retries(transport, destination, card, deadline)

    asyncio.run(deliver())
    # Cleanup consumes the same budget; it must finish before reporting success.
    if monotonic() >= deadline:
        raise TeamsDeliveryError("transient")
