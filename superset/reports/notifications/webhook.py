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

import ipaddress
import logging
from typing import Any
from urllib.parse import urlparse

import backoff
import requests
from flask import current_app
from requests.adapters import HTTPAdapter
from urllib3.connection import HTTPConnection, HTTPSConnection
from urllib3.connectionpool import HTTPConnectionPool, HTTPSConnectionPool

from superset import feature_flag_manager
from superset.reports.models import ReportRecipientType
from superset.reports.notifications.base import BaseNotification
from superset.reports.notifications.exceptions import (
    NotificationParamException,
    NotificationUnprocessableException,
)
from superset.utils import json
from superset.utils.decorators import statsd_gauge
from superset.utils.network import is_safe_host, is_safe_ip

logger = logging.getLogger(__name__)

# Number of characters of a failing response body kept in the server-side log
# line. Response bodies are never folded into the exception message raised
# back to the caller -- that message is persisted verbatim as
# ``ReportExecutionLog.error_message`` and readable via the execution log
# API, which would otherwise turn the webhook target into a readback oracle
# for whatever it chooses to return (including an internal host reached via
# DNS rebinding).
_LOGGED_RESPONSE_BODY_LIMIT = 500


def _sanitize_for_log(text: str) -> str:
    """
    Escape newlines and other control characters in text that gets embedded
    in a log line. The webhook target controls the response body verbatim,
    so logging it unescaped would let it forge additional log records or
    corrupt line-oriented log ingestion.
    """
    return text.translate(
        {c: f"\\x{c:02x}" for c in [*range(0x20), 0x7F] if c not in (0x09,)}
    )


def _raise_for_unsafe_peer(conn: HTTPConnection) -> None:
    """
    Validate that a connection's actual peer is publicly routable.

    ``_validate_webhook_url`` resolves and checks the hostname once, ahead of
    time; the connection opened here is resolved independently and may reach
    a different address (DNS rebinding via a low-TTL record), so the check
    has to be repeated against the address actually connected to.
    """
    sock = conn.sock
    if sock is None:
        return
    peer = sock.getpeername()[0]
    if not is_safe_ip(ipaddress.ip_address(peer)):
        raise NotificationParamException("Webhook URL target host is not allowed.")


class _PeerValidatingHTTPConnection(HTTPConnection):
    """HTTP connection that validates the peer address on connect."""

    def connect(self) -> None:
        super().connect()
        _raise_for_unsafe_peer(self)


class _PeerValidatingHTTPSConnection(HTTPSConnection):
    """HTTPS connection that validates the peer address after the handshake."""

    def connect(self) -> None:
        super().connect()
        _raise_for_unsafe_peer(self)


class _PeerValidatingHTTPConnectionPool(HTTPConnectionPool):
    ConnectionCls = _PeerValidatingHTTPConnection


class _PeerValidatingHTTPSConnectionPool(HTTPSConnectionPool):
    ConnectionCls = _PeerValidatingHTTPSConnection


class _PeerValidatingHTTPAdapter(HTTPAdapter):
    """
    Transport adapter that routes requests through connection classes which
    validate the connected peer address, closing the TOCTOU window between
    the hostname check in ``_validate_webhook_url`` and the connection that
    ``send()`` actually opens.

    Mirrors the peer-validation approach used for dataset-import data URIs
    (``superset.commands.dataset.importers.v1.utils``), adapted to
    ``requests``/``urllib3`` connection pooling instead of ``urllib``.
    """

    def init_poolmanager(self, *args: Any, **kwargs: Any) -> None:
        super().init_poolmanager(*args, **kwargs)
        # Assign a new dict rather than mutating the manager's dict in
        # place -- the attribute otherwise aliases urllib3's module-global
        # default scheme-to-pool-class mapping.
        self.poolmanager.pool_classes_by_scheme = {
            "http": _PeerValidatingHTTPConnectionPool,
            "https": _PeerValidatingHTTPSConnectionPool,
        }


def _get_requester() -> Any:
    """
    Return the object used to issue the webhook POST -- either the
    ``requests`` module itself or a ``requests.Session``, both of which
    expose a compatible ``.post(url, ...)``.

    Operators who explicitly opt into internal webhook targets via
    ``ALERT_REPORTS_WEBHOOK_ALLOW_INTERNAL_HOSTS`` get the plain ``requests``
    module (no peer pinning -- internal hosts are the intended destination).
    Otherwise a session is returned whose transport pins the connection to
    the address that was actually validated.
    """
    if current_app.config["ALERT_REPORTS_WEBHOOK_ALLOW_INTERNAL_HOSTS"]:
        return requests
    session = requests.Session()
    adapter = _PeerValidatingHTTPAdapter()
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session


class WebhookNotification(BaseNotification):
    """
    Sends a post request to a webhook url
    """

    type = ReportRecipientType.WEBHOOK

    def _get_webhook_url(self) -> str:
        """
        Get the webhook URL from the recipient configuration
        :returns: The webhook URL
        :raises NotificationParamException: If the webhook URL is not provided in the recipient configuration
        """  # noqa: E501
        try:
            cfg = json.loads(self._recipient.recipient_config_json)
            target = cfg.get("target") if isinstance(cfg, dict) else None
            if not target:
                raise NotificationParamException("Webhook URL is required")
            return target
        except (json.JSONDecodeError, KeyError, TypeError) as ex:
            raise NotificationParamException("Webhook URL is required") from ex

    def _get_req_payload(self) -> dict[str, Any]:
        header_content = {
            "notification_format": self._content.header_data.get("notification_format"),
            "notification_type": self._content.header_data.get("notification_type"),
            "notification_source": self._content.header_data.get("notification_source"),
            "chart_id": self._content.header_data.get("chart_id"),
            "dashboard_id": self._content.header_data.get("dashboard_id"),
        }
        content = {
            "name": self._content.name,
            "header": header_content,
            "text": self._content.text,
            "description": self._content.description,
            "url": self._content.url,
        }
        return content

    def _get_files(self) -> list[tuple[str, tuple[str, bytes, str]]]:
        files = []
        if self._content.csv:
            files.append(("files", ("report.csv", self._content.csv, "text/csv")))
        if self._content.xlsx:
            files.append(
                (
                    "files",
                    (
                        "report.xlsx",
                        self._content.xlsx,
                        "application/vnd.openxmlformats-officedocument."
                        "spreadsheetml.sheet",
                    ),
                )
            )
        if self._content.pdf:
            files.append(
                ("files", ("report.pdf", self._content.pdf, "application/pdf"))
            )
        if self._content.screenshots:
            for i, screenshot in enumerate(self._content.screenshots):
                files.append(
                    (
                        "files",
                        (f"screenshot_{i}.png", screenshot, "image/png"),
                    )
                )
        return files

    def _validate_webhook_url(self, url: str) -> None:
        """
        Validate the webhook target URL before dispatch.

        Checks that the scheme is HTTP(S) (and HTTPS when required by config),
        that a hostname is present, and, unless the operator opts out via
        ``ALERT_REPORTS_WEBHOOK_ALLOW_INTERNAL_HOSTS``, that the host does not
        resolve to a private/internal address.

        :raises NotificationParamException: if any of the above checks fail.
        """
        parsed = urlparse(url)
        scheme = parsed.scheme.lower()
        if scheme not in ("http", "https"):
            raise NotificationParamException(
                "Webhook failed: only HTTP and HTTPS webhook URLs are supported."
            )
        if current_app.config["ALERT_REPORTS_WEBHOOK_HTTPS_ONLY"] and scheme != "https":
            raise NotificationParamException(
                "Webhook failed: HTTPS is required by config for webhook URLs."
            )
        if not parsed.hostname:
            raise NotificationParamException(
                "Webhook failed: URL must include a valid hostname."
            )
        # Operators with internal webhook targets (chatops bridges, internal
        # automation, etc.) can opt out of the private-IP block via
        # ALERT_REPORTS_WEBHOOK_ALLOW_INTERNAL_HOSTS.
        if current_app.config["ALERT_REPORTS_WEBHOOK_ALLOW_INTERNAL_HOSTS"]:
            return
        if not is_safe_host(parsed.hostname):
            raise NotificationParamException("Webhook URL target host is not allowed.")

    @backoff.on_exception(
        backoff.expo,
        NotificationUnprocessableException,
        factor=10,
        base=2,
        max_tries=5,
        # Bound total wall-clock retry time. Without max_time, a hanging or
        # persistently-failing target can stall a worker for minutes per bad
        # URL, starving sequential report dispatch.
        #
        # backoff (see backoff._sync.retry_exception) samples elapsed at the
        # start of each attempt and checks it against max_time only after that
        # attempt fails -- so the giveup decision uses the time measured before
        # the attempt ran, ignoring the attempt's own duration. With each
        # request carrying the ALERT_REPORTS_WEBHOOK_TIMEOUT (default 60s), a
        # third attempt can begin past the 120s mark (its start gated by the
        # prior check, which still saw ~60-70s) and then run its full request
        # timeout before the check trips. The loop therefore makes 3 attempts:
        # total wall-clock can exceed 120s by up to one request timeout plus
        # jitter sleeps (<=10s then <=20s). factor is kept at 10 so
        # legitimately-transient 5xx targets are not abandoned early.
        max_time=120,
    )
    @statsd_gauge("reports.webhook.send")
    def send(self) -> None:
        if not feature_flag_manager.is_feature_enabled("ALERT_REPORT_WEBHOOK"):
            raise NotificationUnprocessableException(
                "Attempted to send a Webhook notification but Webhook feature flag \
                is not enabled."
            )
        wh_url = self._get_webhook_url()
        self._validate_webhook_url(wh_url)
        payload = self._get_req_payload()
        files = self._get_files()
        timeout = current_app.config["ALERT_REPORTS_WEBHOOK_TIMEOUT"]
        requester = _get_requester()

        try:
            if files:
                data = {}
                for key, value in payload.items():
                    if isinstance(value, (dict, list)):
                        data[key] = json.dumps(value)
                    else:
                        data[key] = value

                response = requester.post(
                    wh_url,
                    data=data,
                    files=files,
                    timeout=timeout,
                    allow_redirects=False,
                )
            else:
                response = requester.post(
                    wh_url, json=payload, timeout=timeout, allow_redirects=False
                )

            logger.info(
                "Webhook sent to %s, status code: %s", wh_url, response.status_code
            )

            if response.status_code >= 500 or response.status_code == 429:
                # The response body is logged server-side only (and
                # truncated) -- it must not be folded into the exception
                # message, which is persisted as the report execution log's
                # error message and surfaced back to whoever can read that
                # log, turning the webhook target into a readback oracle.
                logger.warning(
                    "Webhook to %s failed with status code %s: %s",
                    wh_url,
                    response.status_code,
                    _sanitize_for_log(response.text[:_LOGGED_RESPONSE_BODY_LIMIT]),
                )
                raise NotificationUnprocessableException(
                    f"Webhook failed with status code {response.status_code}"
                )
            if response.status_code >= 400:
                logger.warning(
                    "Webhook to %s failed with status code %s: %s",
                    wh_url,
                    response.status_code,
                    _sanitize_for_log(response.text[:_LOGGED_RESPONSE_BODY_LIMIT]),
                )
                raise NotificationParamException(
                    f"Webhook failed with status code {response.status_code}"
                )
            if response.status_code >= 300:
                # Redirects are intentionally not followed (allow_redirects=False),
                # so a 3xx means the request never reached the final target. Treat
                # it as a failure rather than silently reporting success.
                raise NotificationParamException(
                    f"Webhook returned an unfollowed redirect "
                    f"(status code {response.status_code})"
                )

        except requests.exceptions.RequestException as ex:
            raise NotificationUnprocessableException(str(ex)) from ex
