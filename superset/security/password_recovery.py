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
"""Primitives for self-service ``AUTH_DB`` password recovery.

The flow itself lives in ``superset.commands.security.password_recovery``; this
module holds the pieces it is built from: configuration, token derivation, the
account fingerprint a token is bound to, and the recovery email.

Tokens are stored in the ``key_value`` table, never in raw form. The entry key
is derived from a SHA-256 digest of the token, so the database only ever holds a
verifier, and a token can be looked up without a separate selector. Looking up
by a hash also keeps index-lookup timing from saying anything useful about a
stored token: an attacker can steer the digest of a guess but cannot invert a
stored digest back into a usable token.

A token is bound to a fingerprint of the account's password hash and email at
issue time. Any later password change (through recovery, ``/api/v1/me/``, an
administrator or the CLI) or email change makes every outstanding token for the
account stale without having to enumerate them.
"""

from __future__ import annotations

import hashlib
import hmac
import logging
from typing import Any, TypedDict
from urllib.parse import urljoin, urlsplit
from uuid import UUID

from flask import current_app
from flask_appbuilder.security.manager import AUTH_DB
from flask_babel import gettext as __
from markupsafe import escape
from sqlalchemy import func

from superset.key_value.utils import random_key
from superset.utils.core import send_email_smtp

logger = logging.getLogger(__name__)

#: Bytes of entropy in a recovery token (256 bits).
TOKEN_NBYTES = 32

#: Path of the SPA page that consumes a recovery token, relative to the app
#: root. The token travels in the URL fragment so it never reaches access logs
#: or ``Referer`` headers.
RESET_PAGE_PATH = "/login/reset_password/"

# Domain-separation prefixes, so the same input never yields the same key in the
# token and throttle resources.
_TOKEN_KEY_PREFIX = b"superset.password_recovery.token:"
_THROTTLE_KEY_PREFIX = b"superset.password_recovery.throttle:"

_FOOTER_STYLE = "color:#888;font-size:12px;"
_BUTTON_STYLE = (
    "display:inline-block;padding:10px 16px;background:#20a7c9;color:#ffffff;"
    "text-decoration:none;border-radius:4px;"
)

DEFAULT_CONFIG: dict[str, Any] = {
    "enabled": False,
    "token_ttl_minutes": 30,
    "rate_limit": "5 per 15 minutes",
    "resend_cooldown_seconds": 120,
    "base_url": None,
}

# The base URL Superset ships with; a link built from it reaches nobody.
_SHIPPED_BASE_URL = "http://0.0.0.0:8080/"

# Upper bound on a token's lifetime, whatever the configuration says.
_MAX_TOKEN_TTL_MINUTES = 24 * 60


class RecoveryTokenPayload(TypedDict):
    """The value stored for an outstanding token."""

    user_id: int
    fingerprint: str


def get_config() -> dict[str, Any]:
    """Return ``AUTH_PASSWORD_RECOVERY`` merged over the defaults.

    Operators usually override the whole dict, so any key they leave out falls
    back to its default instead of raising ``KeyError`` at request time. A
    value that is not a dict at all (``AUTH_PASSWORD_RECOVERY = True``, written
    like the neighbouring ``AUTH_*`` booleans) is treated as unset rather than
    raised: ``is_enabled()`` runs while building the bootstrap payload of every
    page, so a typo here must not take the whole UI down.
    """
    configured = current_app.config.get("AUTH_PASSWORD_RECOVERY") or {}
    if not isinstance(configured, dict):
        logger.warning(
            "AUTH_PASSWORD_RECOVERY must be a dict; using the defaults instead"
        )
        configured = {}
    return {**DEFAULT_CONFIG, **configured}


def _positive_int(value: Any, default: int, maximum: int | None = None) -> int:
    try:
        number = int(value)
    except (TypeError, ValueError):
        return default
    if number < 1:
        return default
    return min(number, maximum) if maximum else number


def token_ttl_minutes() -> int:
    return _positive_int(
        get_config()["token_ttl_minutes"],
        DEFAULT_CONFIG["token_ttl_minutes"],
        _MAX_TOKEN_TTL_MINUTES,
    )


def resend_cooldown_seconds() -> int:
    return _positive_int(
        get_config()["resend_cooldown_seconds"],
        DEFAULT_CONFIG["resend_cooldown_seconds"],
    )


def rate_limit() -> str:
    """The Flask-Limiter rate string for the recovery endpoints."""
    return str(get_config()["rate_limit"] or DEFAULT_CONFIG["rate_limit"])


def is_enabled() -> bool:
    """Whether self-service recovery is available.

    It needs ``AUTH_TYPE = AUTH_DB`` (other backends own their credentials) and
    an explicit opt-in, because it sends email and builds links from
    deployment-specific settings the operator has to confirm first.
    """
    return current_app.config.get("AUTH_TYPE") == AUTH_DB and bool(
        get_config()["enabled"]
    )


def generate_token() -> str:
    """Return a new URL-safe recovery token with 256 bits of entropy."""
    return random_key(TOKEN_NBYTES)


def token_key(token: str) -> UUID:
    """The ``key_value`` key holding ``token``'s entry (a verifier, not the
    token).

    A plain SHA-256 is enough here: the token carries 256 bits of entropy, so
    its digest cannot be reversed by guessing.
    """
    digest = hashlib.sha256(_TOKEN_KEY_PREFIX + token.encode("utf-8")).digest()
    return UUID(bytes=digest[:16])


def throttle_key(email: str) -> UUID:
    """The ``key_value`` key of the resend cooldown for ``email``.

    Keyed with ``SECRET_KEY``: a cooldown row is written for every submitted
    address, and an unkeyed digest of a guessable address could be reversed
    with a dictionary, letting anyone with database access learn which
    addresses were submitted. Case and surrounding whitespace are ignored, so
    trivially different spellings of the same address share one cooldown.
    """
    digest = hmac.new(
        str(current_app.config["SECRET_KEY"]).encode("utf-8"),
        _THROTTLE_KEY_PREFIX + email.strip().casefold().encode("utf-8"),
        hashlib.sha256,
    ).digest()
    return UUID(bytes=digest[:16])


def account_fingerprint(user: Any) -> str:
    """A digest of the account state a token is bound to.

    Covers the user id, the stored password hash and the email address, so a
    token stops working as soon as any of them changes.
    """
    material = "\x00".join(
        (str(user.id), user.password or "", (user.email or "").casefold())
    )
    return hashlib.sha256(material.encode("utf-8")).hexdigest()


def find_user_by_email(email: str) -> Any:
    """The account registered under ``email``, ignoring case, or ``None``.

    FAB's ``find_user(email=...)`` matches exactly, and on case-sensitive
    backends such as PostgreSQL a user typing their address with different
    capitalization would silently get no email. Email uniqueness is itself
    case-sensitive there, so an address matching more than one account is
    treated as no match rather than guessing which account to send to.
    """
    # pylint: disable=import-outside-toplevel
    from superset import db, security_manager

    user_model = security_manager.user_model
    matches = (
        db.session.query(user_model)
        .filter(func.lower(user_model.email) == email.strip().lower())
        .limit(2)
        .all()
    )
    if len(matches) != 1:
        if matches:
            logger.warning(
                "Password recovery skipped: several accounts share one email "
                "address when compared without case"
            )
        return None
    return matches[0]


def is_eligible(user: Any) -> bool:
    """Whether ``user`` may recover their password by email.

    The account must be active, have an email address to send to, and already
    have a local password. Accounts without one were provisioned by another
    authentication backend (OAuth, LDAP, remote user, ...) and are not turned
    into password accounts through this flow.
    """
    return bool(
        user is not None
        and getattr(user, "is_active", False)
        and getattr(user, "password", None)
        and getattr(user, "email", None)
    )


def reset_base_url() -> str | None:
    """The configured public address reset links point at, if any.

    Comes from configuration only (``base_url``, falling back to
    ``WEBDRIVER_BASEURL_USER_FRIENDLY``), never from the incoming request, so a
    forged ``Host`` or ``X-Forwarded-Host`` header cannot point the link, and
    the token in it, at another site. Returns ``None`` while it is still the
    shipped default, which reaches nobody outside the container.
    """
    base_url = (
        get_config()["base_url"]
        or current_app.config["WEBDRIVER_BASEURL_USER_FRIENDLY"]
    )
    if not base_url or base_url.rstrip("/") == _SHIPPED_BASE_URL.rstrip("/"):
        return None
    return str(base_url)


def build_reset_url(base_url: str, token: str) -> str:
    """The absolute link sent in the recovery email, with ``token`` in the
    fragment."""
    app_root = (current_app.config.get("APPLICATION_ROOT") or "/").rstrip("/")
    url = urljoin(base_url, f"{app_root}{RESET_PAGE_PATH}")
    if urlsplit(url).scheme != "https":
        logger.warning(
            "Password recovery links are not using HTTPS; set "
            "AUTH_PASSWORD_RECOVERY['base_url'] to the public HTTPS address"
        )
    return f"{url}#token={token}"


def build_email(username: str, reset_url: str, ttl_minutes: int) -> tuple[str, str]:
    """Render the recovery email, returning ``(subject, html_body)``."""
    app_name = current_app.config.get("APP_NAME") or "Superset"
    subject = __("Reset your %(app_name)s password", app_name=app_name)
    greeting = __(
        'A password reset was requested for the %(app_name)s account "%(username)s".',
        app_name=escape(app_name),
        username=escape(username),
    )
    button = __("Reset password")
    expiry = __(
        "This link can be used once and expires in %(minutes)s minutes.",
        minutes=ttl_minutes,
    )
    disclaimer = __(
        "If you did not request a password reset, you can ignore this email; "
        "your password will not change."
    )
    html = (
        '<html><body style="font-family:Arial,sans-serif;color:#333;">'
        f"<p>{greeting}</p>"
        f'<p><a href="{escape(reset_url)}" style="{_BUTTON_STYLE}">{button}</a></p>'
        f"<p>{expiry}</p>"
        "<hr/>"
        f'<p style="{_FOOTER_STYLE}">{disclaimer}</p>'
        "</body></html>"
    )
    return subject, html


def send_email(to: str, subject: str, html_content: str) -> None:
    """Send a recovery email through the configured SMTP transport."""
    send_email_smtp(
        to=to,
        subject=subject,
        html_content=html_content,
        config=current_app.config,
    )
