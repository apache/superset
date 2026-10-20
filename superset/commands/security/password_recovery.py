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
"""Self-service ``AUTH_DB`` password recovery.

``RequestPasswordRecoveryCommand`` issues a single-use token and emails a reset
link; ``ResetPasswordWithTokenCommand`` consumes the token and sets the new
password. Hashing, session invalidation and auditing use the same primitives as
every other password write (FAB's hash settings and ``update_user``, Superset's
session-invalidation epoch, the security audit log); see
``superset.security.password_recovery`` for the token design.
"""

from __future__ import annotations

import hmac
import logging
from datetime import datetime, timedelta
from types import SimpleNamespace
from typing import Any, Callable, Optional

from flask import current_app
from sqlalchemy.exc import IntegrityError
from werkzeug.security import generate_password_hash

from superset import db, security_manager
from superset.commands.base import BaseCommand
from superset.commands.security.exceptions import (
    PasswordRecoveryDisabledError,
    PasswordRecoveryFailedError,
    PasswordRecoveryInvalidTokenError,
)
from superset.daos.key_value import KeyValueDAO
from superset.key_value.types import JsonKeyValueCodec, KeyValueResource
from superset.security import password_recovery
from superset.security.password_change import clear_password_must_change
from superset.security.session_invalidation import invalidate_sessions_for_user
from superset.utils.decorators import transaction

logger = logging.getLogger(__name__)

TOKEN_RESOURCE = KeyValueResource.PASSWORD_RECOVERY_TOKEN
THROTTLE_RESOURCE = KeyValueResource.PASSWORD_RECOVERY_THROTTLE
CODEC = JsonKeyValueCodec()

#: Runs the email-sending callable. The API hands in one that defers the send
#: until the response has gone out, so SMTP latency does not reveal whether the
#: address belongs to an account.
Dispatcher = Callable[[Callable[[], None]], None]


#: Stand-in account for the work done on behalf of an address that gets no
#: link; nothing derived from it is stored or sent.
_DECOY_USER = SimpleNamespace(id=0, username="", password="", email="")
_DECOY_BASE_URL = "https://superset.invalid/"


def _send_now(task: Callable[[], None]) -> None:
    task()


def _log_event(action: str, payload: dict[str, Any]) -> None:
    # pylint: disable=import-outside-toplevel
    from superset.security.manager import _log_audit_event

    _log_audit_event(action, payload)


class RequestPasswordRecoveryCommand(BaseCommand):
    """Issue a recovery token for ``email`` and send the reset link.

    The caller always gets the same outcome (no exception, no return value)
    whether or not the address belongs to an eligible account, so the API can
    answer every request identically. Both branches do the same database work
    (the resend-cooldown write happens for every address) and the email is
    handed to ``dispatch`` instead of being sent inline.
    """

    def __init__(self, email: str, dispatch: Optional[Dispatcher] = None) -> None:
        self._email = email.strip()
        self._dispatch = dispatch or _send_now

    def validate(self) -> None:
        if not password_recovery.is_enabled():
            raise PasswordRecoveryDisabledError()

    def run(self) -> None:
        self.validate()
        base_url = password_recovery.reset_base_url()
        user = password_recovery.find_user_by_email(self._email)
        eligible = password_recovery.is_eligible(user) and base_url is not None
        throttled, token = self._issue(user if eligible else None)
        if token is not None:
            # Render the email on every non-throttled path, sent or not, so an
            # eligible account costs no more inline work than a missing one.
            reset_url = password_recovery.build_reset_url(
                base_url or _DECOY_BASE_URL, token
            )
            self._send(user if eligible else None, reset_url)

        if base_url is None:
            logger.error(
                "Password recovery is enabled but no public base URL is "
                "configured; set AUTH_PASSWORD_RECOVERY['base_url']. No reset "
                "link was sent."
            )
            outcome = "not_configured"
        elif throttled:
            outcome = "throttled"
        elif user is None:
            outcome = "no_account"
        elif not eligible:
            outcome = "ineligible"
        else:
            outcome = "sent"
        _log_event(
            "PasswordRecoveryRequested",
            {"outcome": outcome, "target_user_id": getattr(user, "id", None)},
        )

    @transaction()
    def _issue(self, user: Any) -> tuple[bool, Optional[str]]:
        """Record the resend cooldown and, for an eligible ``user``, a token.

        Returns whether the address is still cooling down and, when it is not,
        a raw token (only ever held in memory). The token is only stored, and
        so only usable, when ``user`` is given.
        """
        now = datetime.now()
        # Sweep on write, as the PKCE verifier store does: the scheduled
        # ``prune_key_value`` task is optional, and an expired cooldown still
        # occupying its key would make the insert below collide.
        KeyValueDAO.delete_expired_entries(TOKEN_RESOURCE)
        KeyValueDAO.delete_expired_entries(THROTTLE_RESOURCE)

        cooldown_key = password_recovery.throttle_key(self._email)
        if KeyValueDAO.get_entry(THROTTLE_RESOURCE, cooldown_key) is not None:
            return True, None
        try:
            # A concurrent request for the same address can win this insert
            # (the key is unique); it then holds the cooldown, so treat this
            # one as throttled rather than failing it.
            with db.session.begin_nested():
                KeyValueDAO.create_entry(
                    resource=THROTTLE_RESOURCE,
                    value={},
                    codec=CODEC,
                    key=cooldown_key,
                    expires_on=now
                    + timedelta(seconds=password_recovery.resend_cooldown_seconds()),
                )
        except IntegrityError:
            return True, None

        # Without an eligible ``user`` the same token work runs against a decoy
        # account and the insert is rolled back, so both branches cost the same
        # and no unusable rows are left behind.
        token = password_recovery.generate_token()
        payload: password_recovery.RecoveryTokenPayload = {
            "user_id": (user or _DECOY_USER).id,
            "fingerprint": password_recovery.account_fingerprint(user or _DECOY_USER),
        }
        savepoint = db.session.begin_nested()
        KeyValueDAO.create_entry(
            resource=TOKEN_RESOURCE,
            value=payload,
            codec=CODEC,
            key=password_recovery.token_key(token),
            expires_on=now + timedelta(minutes=password_recovery.token_ttl_minutes()),
        )
        db.session.flush()
        # Savepoint only; the enclosing ``@transaction`` owns the real commit.
        if user is None:
            savepoint.rollback()  # pylint: disable=consider-using-transaction
        else:
            savepoint.commit()  # pylint: disable=consider-using-transaction
        return False, token

    def _send(self, user: Any, reset_url: str) -> None:
        """Render the email and, for an eligible ``user``, hand it to dispatch.

        Rendering happens inside the request (locale, config); only the SMTP
        round-trip is deferred. The email goes to the stored address, not the
        submitted spelling of it.
        """
        ttl = password_recovery.token_ttl_minutes()
        subject, html = password_recovery.build_email(
            (user or _DECOY_USER).username, reset_url, ttl
        )
        if user is None:
            return
        recipient = user.email

        def _deliver() -> None:
            password_recovery.send_email(recipient, subject, html)

        self._dispatch(_deliver)


class ResetPasswordWithTokenCommand(BaseCommand):
    """Consume a recovery token and set the account's new password.

    The password is expected to have passed the configured complexity
    validator already (the API schema runs FAB's ``PasswordComplexityValidator``),
    so a rejected password never consumes the token.
    """

    def __init__(self, token: str, password: str) -> None:
        self._token = token
        self._password = password

    def validate(self) -> None:
        if not password_recovery.is_enabled():
            raise PasswordRecoveryDisabledError()

    def run(self) -> None:
        self.validate()
        try:
            user = self._reset()
        except PasswordRecoveryFailedError:
            _log_event("PasswordRecoveryFailed", {"reason": "update_failed"})
            raise
        if user is None:
            _log_event("PasswordRecoveryFailed", {"reason": "invalid_token"})
            raise PasswordRecoveryInvalidTokenError()
        _log_event(
            "PasswordRecoveryCompleted",
            {"target_user_id": user.id, "target_username": user.username},
        )

    @transaction()
    def _reset(self) -> Any:
        """Consume the token and set the password in one unit of work.

        The token deletion, the new hash, the session-invalidation epoch and the
        cleared forced-change flag commit together or not at all, so a failed
        write never burns the link and a reset never leaves old sessions alive.
        Returns ``None`` (after committing the removal of a stale token) when
        the token cannot be used.
        """
        user = self._consume_token()
        if user is None:
            return None

        # The same primitives as every other password write: FAB's hash
        # settings (as in ``reset_password`` and ``PUT /api/v1/me/``), FAB's
        # ``update_user``, and Superset's session-invalidation epoch. FAB's
        # ``reset_password`` itself is not used because it commits on its own
        # and swallows a failed write.
        user.password = generate_password_hash(
            password=self._password,
            method=current_app.config.get("FAB_PASSWORD_HASH_METHOD", "scrypt"),
            salt_length=current_app.config.get("FAB_PASSWORD_HASH_SALT_LENGTH", 16),
        )
        if security_manager.update_user(user, commit=False) is False:
            raise PasswordRecoveryFailedError()
        invalidate_sessions_for_user(user.id)
        # Recovering by email is the account owner choosing their own password,
        # so it satisfies a pending forced password change, the same as the
        # self-service ``/api/v1/me/`` path.
        clear_password_must_change(user.id)
        return user

    def _consume_token(self) -> Any:
        """Validate and delete the token, returning its (row-locked) user.

        Returns ``None`` for a missing, expired, already-used or superseded
        token, without saying which. The deletion is left to the caller's
        transaction so it lands atomically with the password change.
        """
        key = password_recovery.token_key(self._token)
        entry = KeyValueDAO.get_entry(TOKEN_RESOURCE, key)
        if entry is None or entry.is_expired():
            return None
        payload: dict[str, Any] = CODEC.decode(entry.value)

        # Consume before checking the account, so only one of several
        # concurrent requests for the same token proceeds and a superseded
        # token is gone too.
        if not KeyValueDAO.consume_entry(TOKEN_RESOURCE, key):
            return None

        # Two different valid tokens for the same user must not both pass the
        # fingerprint check, so the account is read only now. Where row locks
        # exist, the second request waits on this row lock; on SQLite, which
        # ignores ``FOR UPDATE``, it already waited on the delete above for the
        # database write lock. Either way it reads the first one's committed
        # password hash and the token comes out stale.
        user_model = security_manager.user_model
        user = (
            db.session.query(user_model)
            .filter(user_model.id == payload.get("user_id"))
            .populate_existing()
            .with_for_update()
            .one_or_none()
        )
        if not password_recovery.is_eligible(user) or not hmac.compare_digest(
            password_recovery.account_fingerprint(user),
            str(payload.get("fingerprint", "")),
        ):
            return None
        return user
