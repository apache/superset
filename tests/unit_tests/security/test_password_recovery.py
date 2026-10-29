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
"""Self-service ``AUTH_DB`` password recovery: commands and endpoints."""

from __future__ import annotations

import logging
import re
import threading
import time
from collections.abc import Iterator
from datetime import datetime, timedelta
from typing import Any
from unittest.mock import patch

import pytest
from flask import Flask
from flask_appbuilder.security.manager import (
    AUTH_DB,
    AUTH_LDAP,
    AUTH_OAUTH,
    AUTH_REMOTE_USER,
)
from flask_appbuilder.security.sqla.models import User
from pytest_mock import MockerFixture
from werkzeug.security import generate_password_hash

from superset import db, security_manager
from superset.commands.security.exceptions import (
    PasswordRecoveryDisabledError,
    PasswordRecoveryFailedError,
    PasswordRecoveryInvalidTokenError,
)
from superset.commands.security.password_recovery import (
    RequestPasswordRecoveryCommand,
    ResetPasswordWithTokenCommand,
)
from superset.daos.key_value import KeyValueDAO
from superset.key_value.models import KeyValueEntry
from superset.key_value.types import KeyValueResource
from superset.models.core import Log
from superset.models.user_attributes import UserAttribute
from superset.security import password_recovery
from superset.security.api import RECOVERY_EMAIL_THREAD_NAME
from superset.security.password_change import (
    password_change_required,
    set_password_must_change,
)

OLD_PASSWORD = "Original-Passw0rd!"  # noqa: S105
NEW_PASSWORD = "Recovered-Passw0rd!"  # noqa: S105
REQUEST_URL = "/api/v1/security/password_recovery/"
RESET_URL = "/api/v1/security/password_recovery/reset/"
GENERIC_MESSAGE = (
    "If an account with that email exists, a password reset link has been sent."
)
RESOURCES = (
    KeyValueResource.PASSWORD_RECOVERY_TOKEN.value,
    KeyValueResource.PASSWORD_RECOVERY_THROTTLE.value,
)


@pytest.fixture
def recovery_enabled(app: Flask, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setitem(app.config, "AUTH_TYPE", AUTH_DB)
    monkeypatch.setitem(
        app.config,
        "AUTH_PASSWORD_RECOVERY",
        {"enabled": True, "base_url": "https://superset.example.org/"},
    )


@pytest.fixture
def sent_emails() -> Iterator[list[dict[str, str]]]:
    """Capture recovery emails instead of talking to SMTP."""
    outbox: list[dict[str, str]] = []

    def _capture(to: str, subject: str, html_content: str) -> None:
        outbox.append({"to": to, "subject": subject, "html": html_content})

    with patch.object(password_recovery, "send_email", side_effect=_capture):
        yield outbox


def _make_user(username: str, *, password: str | None = OLD_PASSWORD) -> User:
    role = db.session.query(security_manager.role_model).filter_by(name="Admin").one()
    user = User(
        first_name="Recovery",
        last_name="Test",
        username=username,
        email=f"{username}@example.org",
        active=True,
        roles=[role],
        password=generate_password_hash(password) if password else None,
    )
    db.session.add(user)
    db.session.commit()
    return user


@pytest.fixture
def users() -> Iterator[dict[str, User]]:
    """Accounts committed for real: the commands under test commit themselves,
    so the usual rollback-after-each fixtures cannot undo their writes."""
    created = {
        "db": _make_user("recovery_db_user"),
        "external": _make_user("recovery_oauth_user", password=None),
        "inactive": _make_user("recovery_inactive_user"),
    }
    created["inactive"].active = False
    db.session.commit()
    ids = [user.id for user in created.values()]

    yield created

    db.session.rollback()
    db.session.query(Log).filter(Log.user_id.in_(ids)).delete(synchronize_session=False)
    db.session.query(KeyValueEntry).filter(
        KeyValueEntry.resource.in_(RESOURCES)
    ).delete(synchronize_session=False)
    db.session.query(UserAttribute).filter(UserAttribute.user_id.in_(ids)).delete(
        synchronize_session=False
    )
    for user in db.session.query(User).filter(User.id.in_(ids)).all():
        db.session.delete(user)
    db.session.commit()


def _token_from(email: dict[str, str]) -> str:
    match = re.search(r"#token=([A-Za-z0-9_\-]+)", email["html"])
    assert match, "the email carries no reset link"
    return match.group(1)


def _issue_token(user: User, outbox: list[dict[str, str]]) -> str:
    RequestPasswordRecoveryCommand(user.email).run()
    return _token_from(outbox[-1])


def _clear_cooldowns() -> None:
    db.session.query(KeyValueEntry).filter(
        KeyValueEntry.resource == KeyValueResource.PASSWORD_RECOVERY_THROTTLE.value
    ).delete(synchronize_session=False)
    db.session.commit()


def _token_entries() -> list[KeyValueEntry]:
    return (
        db.session.query(KeyValueEntry)
        .filter(
            KeyValueEntry.resource == KeyValueResource.PASSWORD_RECOVERY_TOKEN.value
        )
        .all()
    )


def _password_works(username: str, password: str) -> bool:
    """Authenticate through FAB's ``AUTH_DB`` login check, as ``/login/`` does."""
    from flask import current_app

    # A successful login stamps the session, which needs a request context.
    with current_app.test_request_context("/login/"):
        return security_manager.auth_user_db(username, password) is not None


# --- Requesting a recovery link ---------------------------------------------


def test_known_account_gets_a_single_use_link(
    recovery_enabled: None,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
) -> None:
    user = users["db"]
    RequestPasswordRecoveryCommand(user.email).run()

    assert len(sent_emails) == 1
    email = sent_emails[0]
    assert email["to"] == user.email
    assert user.username in email["html"]
    token = _token_from(email)
    assert len(token) >= 43  # 32 random bytes, URL-safe base64
    assert "https://superset.example.org/login/reset_password/#token=" in email["html"]
    assert len(_token_entries()) == 1


def test_token_is_stored_only_as_a_verifier(
    recovery_enabled: None,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
) -> None:
    token = _issue_token(users["db"], sent_emails)

    (entry,) = _token_entries()
    assert token.encode() not in entry.value
    assert token not in str(entry.uuid)
    assert entry.uuid == password_recovery.token_key(token)
    assert entry.expires_on is not None
    assert entry.expires_on <= datetime.now() + timedelta(minutes=30)


def test_unknown_address_sends_nothing(
    recovery_enabled: None,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
) -> None:
    RequestPasswordRecoveryCommand("nobody@example.org").run()

    assert sent_emails == []
    assert _token_entries() == []


@pytest.mark.parametrize("account", ["unknown", "external", "inactive"])
def test_addresses_without_a_link_do_the_same_work_as_one_with_a_link(
    account: str,
    recovery_enabled: None,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
    mocker: MockerFixture,
) -> None:
    """An address that gets no link runs the same token, storage and email
    rendering steps against a stand-in account, so response time does not tell
    it apart from one that does; the stand-in's token and email go nowhere."""

    def steps_for(address: str) -> list[int]:
        spies = [
            mocker.spy(password_recovery, "generate_token"),
            mocker.spy(password_recovery, "account_fingerprint"),
            mocker.spy(KeyValueDAO, "create_entry"),
            mocker.spy(password_recovery, "build_email"),
        ]
        RequestPasswordRecoveryCommand(address).run()
        counts = [spy.call_count for spy in spies]
        mocker.stopall()
        return counts

    with_link = steps_for(users["db"].email)
    address = "nobody@example.org" if account == "unknown" else users[account].email
    without_link = steps_for(address)

    assert with_link == [1, 1, 2, 1]
    assert without_link == with_link
    assert len(sent_emails) == 1
    assert len(_token_entries()) == 1


def test_lookup_ignores_the_case_of_the_address(
    recovery_enabled: None,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
) -> None:
    user = users["db"]
    RequestPasswordRecoveryCommand(user.email.upper()).run()

    assert len(sent_emails) == 1
    assert sent_emails[0]["to"] == user.email


def test_address_shared_by_several_accounts_gets_no_link(
    recovery_enabled: None,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Email uniqueness is case-sensitive on some backends; an address that
    matches two accounts without case is not resolved by guessing, and the
    address itself stays out of the logs."""
    twin = _make_user("recovery_twin_user")
    twin.email = users["db"].email.upper()
    db.session.commit()
    twin_id = twin.id
    caplog.set_level(logging.DEBUG)
    try:
        RequestPasswordRecoveryCommand(users["db"].email).run()
        assert sent_emails == []
        assert _token_entries() == []
        assert "several accounts share one email" in caplog.text
        assert users["db"].email.casefold() not in caplog.text.casefold()
    finally:
        db.session.rollback()
        db.session.delete(db.session.get(User, twin_id))
        db.session.commit()


@pytest.mark.parametrize("account", ["external", "inactive"])
def test_ineligible_accounts_get_no_link(
    account: str,
    recovery_enabled: None,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
) -> None:
    """Accounts without a local password (provisioned through OAuth, LDAP,
    SAML, remote user, ...) and inactive accounts are never sent a link."""
    RequestPasswordRecoveryCommand(users[account].email).run()

    assert sent_emails == []
    assert _token_entries() == []


def test_resend_cooldown_limits_emails_per_address(
    recovery_enabled: None,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
) -> None:
    user = users["db"]
    RequestPasswordRecoveryCommand(user.email).run()
    RequestPasswordRecoveryCommand(f"  {user.email.upper()} ").run()

    assert len(sent_emails) == 1
    assert len(_token_entries()) == 1


def test_cooldown_is_recorded_for_unknown_addresses_too(
    recovery_enabled: None, users: dict[str, User]
) -> None:
    """Both branches do the same database work, so commit latency does not
    tell an existing account from a missing one."""
    RequestPasswordRecoveryCommand("nobody@example.org").run()

    key = password_recovery.throttle_key("nobody@example.org")
    assert (
        KeyValueDAO.get_entry(KeyValueResource.PASSWORD_RECOVERY_THROTTLE, key)
        is not None
    )


def test_email_is_dispatched_through_the_given_dispatcher(
    recovery_enabled: None,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
) -> None:
    deferred: list[Any] = []
    RequestPasswordRecoveryCommand(users["db"].email, dispatch=deferred.append).run()

    assert sent_emails == []
    assert len(deferred) == 1
    deferred[0]()
    assert len(sent_emails) == 1


def test_request_is_refused_when_disabled(
    app: Flask, monkeypatch: pytest.MonkeyPatch, users: dict[str, User]
) -> None:
    monkeypatch.setitem(app.config, "AUTH_PASSWORD_RECOVERY", {"enabled": False})
    with pytest.raises(PasswordRecoveryDisabledError):
        RequestPasswordRecoveryCommand(users["db"].email).run()


def test_request_is_refused_for_non_db_auth(
    recovery_enabled: None,
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
    users: dict[str, User],
) -> None:
    monkeypatch.setitem(app.config, "AUTH_TYPE", AUTH_OAUTH)
    with pytest.raises(PasswordRecoveryDisabledError):
        RequestPasswordRecoveryCommand(users["db"].email).run()
    with pytest.raises(PasswordRecoveryDisabledError):
        ResetPasswordWithTokenCommand("whatever", NEW_PASSWORD).run()


def test_nothing_is_sent_without_a_public_base_url(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
    caplog: pytest.LogCaptureFixture,
) -> None:
    """With the shipped default base URL the link would point at a container
    address, so no token is issued and an operator-facing error is logged."""
    monkeypatch.setitem(app.config, "AUTH_TYPE", AUTH_DB)
    monkeypatch.setitem(app.config, "AUTH_PASSWORD_RECOVERY", {"enabled": True})
    monkeypatch.setitem(
        app.config, "WEBDRIVER_BASEURL_USER_FRIENDLY", "http://0.0.0.0:8080/"
    )

    RequestPasswordRecoveryCommand(users["db"].email).run()

    assert sent_emails == []
    assert _token_entries() == []
    assert "no public base URL is configured" in caplog.text


# --- Resetting the password -------------------------------------------------


def test_valid_token_resets_the_password(
    recovery_enabled: None,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
) -> None:
    user = users["db"]
    token = _issue_token(user, sent_emails)

    ResetPasswordWithTokenCommand(token, NEW_PASSWORD).run()

    assert _password_works(user.username, NEW_PASSWORD)
    assert not _password_works(user.username, OLD_PASSWORD)
    assert _token_entries() == []


def test_reset_invalidates_existing_sessions(
    recovery_enabled: None,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
) -> None:
    user = users["db"]
    token = _issue_token(user, sent_emails)
    logged_in_at = time.time() - 5

    ResetPasswordWithTokenCommand(token, NEW_PASSWORD).run()

    attr = db.session.query(UserAttribute).filter_by(user_id=user.id).one()
    from superset.security.session_invalidation import is_session_invalidated

    assert is_session_invalidated(logged_in_at, attr.sessions_invalidated_at)


def test_reset_clears_a_pending_forced_password_change(
    recovery_enabled: None,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
) -> None:
    user = users["db"]
    set_password_must_change(user.id)
    assert password_change_required(user)
    token = _issue_token(user, sent_emails)

    ResetPasswordWithTokenCommand(token, NEW_PASSWORD).run()

    assert not password_change_required(user)


def test_invalid_token_is_rejected(
    recovery_enabled: None, users: dict[str, User]
) -> None:
    with pytest.raises(PasswordRecoveryInvalidTokenError):
        ResetPasswordWithTokenCommand("not-a-real-token", NEW_PASSWORD).run()
    assert _password_works(users["db"].username, OLD_PASSWORD)


def test_expired_token_is_rejected(
    recovery_enabled: None,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
) -> None:
    user = users["db"]
    token = _issue_token(user, sent_emails)
    (entry,) = _token_entries()
    entry.expires_on = datetime.now() - timedelta(seconds=1)
    db.session.commit()

    with pytest.raises(PasswordRecoveryInvalidTokenError):
        ResetPasswordWithTokenCommand(token, NEW_PASSWORD).run()
    assert _password_works(user.username, OLD_PASSWORD)


def test_consumed_token_cannot_be_replayed(
    recovery_enabled: None,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
) -> None:
    user = users["db"]
    token = _issue_token(user, sent_emails)
    ResetPasswordWithTokenCommand(token, NEW_PASSWORD).run()

    with pytest.raises(PasswordRecoveryInvalidTokenError):
        ResetPasswordWithTokenCommand(token, "Attacker-Chosen-Passw0rd!").run()
    assert _password_works(user.username, NEW_PASSWORD)


def test_password_change_supersedes_outstanding_tokens(
    recovery_enabled: None,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
) -> None:
    """Every outstanding link dies once the password changes, through recovery
    or any other path, without the tokens having to be enumerated."""
    user = users["db"]
    first = _issue_token(user, sent_emails)
    _clear_cooldowns()
    second = _issue_token(user, sent_emails)
    assert first != second

    ResetPasswordWithTokenCommand(first, NEW_PASSWORD).run()

    with pytest.raises(PasswordRecoveryInvalidTokenError):
        ResetPasswordWithTokenCommand(second, "Another-Passw0rd!").run()
    assert _password_works(user.username, NEW_PASSWORD)
    # The stale token was removed, not just refused.
    assert _token_entries() == []


def test_email_change_supersedes_outstanding_tokens(
    recovery_enabled: None,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
) -> None:
    user = users["db"]
    token = _issue_token(user, sent_emails)
    user.email = "someone.else@example.org"
    db.session.commit()

    with pytest.raises(PasswordRecoveryInvalidTokenError):
        ResetPasswordWithTokenCommand(token, NEW_PASSWORD).run()


def test_token_for_deactivated_account_is_rejected(
    recovery_enabled: None,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
) -> None:
    user = users["db"]
    token = _issue_token(user, sent_emails)
    user.active = False
    db.session.commit()

    with pytest.raises(PasswordRecoveryInvalidTokenError):
        ResetPasswordWithTokenCommand(token, NEW_PASSWORD).run()


def test_failed_password_write_keeps_the_token(
    recovery_enabled: None,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
) -> None:
    """FAB's ``update_user`` rolls back and returns ``False`` instead of
    raising; the token deletion must roll back with it."""
    user = users["db"]
    token = _issue_token(user, sent_emails)

    with patch.object(security_manager, "update_user", return_value=False):
        with pytest.raises(PasswordRecoveryFailedError):
            ResetPasswordWithTokenCommand(token, NEW_PASSWORD).run()

    assert len(_token_entries()) == 1
    assert _password_works(user.username, OLD_PASSWORD)
    ResetPasswordWithTokenCommand(token, NEW_PASSWORD).run()
    assert _password_works(user.username, NEW_PASSWORD)


def test_reset_checks_the_account_after_taking_the_token(
    recovery_enabled: None,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
) -> None:
    """Two resets racing with different tokens for one account: on SQLite,
    where ``FOR UPDATE`` is a no-op, the other reset can commit a new password
    after this one looked its token up but before it takes the token (the
    write lock the delete waits for). The account must be checked after the
    token is consumed, so this reset sees that password and is refused rather
    than overwriting it."""
    user = users["db"]
    _issue_token(user, sent_emails)
    _clear_cooldowns()
    token = _issue_token(user, sent_emails)
    concurrent_password = "Concurrent-Passw0rd!"  # noqa: S105
    consume = KeyValueDAO.consume_entry

    def consume_after_a_concurrent_reset(resource: KeyValueResource, key: Any) -> bool:
        db.session.query(User).filter(User.id == user.id).update(
            {"password": generate_password_hash(concurrent_password)},
            synchronize_session=False,
        )
        return consume(resource, key)

    with patch.object(
        KeyValueDAO, "consume_entry", side_effect=consume_after_a_concurrent_reset
    ):
        with pytest.raises(PasswordRecoveryInvalidTokenError):
            ResetPasswordWithTokenCommand(token, NEW_PASSWORD).run()

    assert _password_works(user.username, concurrent_password)
    assert not _password_works(user.username, NEW_PASSWORD)


def test_consume_entry_has_exactly_one_winner(
    recovery_enabled: None,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
) -> None:
    token = _issue_token(users["db"], sent_emails)
    key = password_recovery.token_key(token)
    resource = KeyValueResource.PASSWORD_RECOVERY_TOKEN

    assert KeyValueDAO.consume_entry(resource, key) is True
    assert KeyValueDAO.consume_entry(resource, key) is False
    db.session.rollback()


# --- Pure helpers -----------------------------------------------------------


def test_reset_url_keeps_the_application_root(
    app: Flask, recovery_enabled: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setitem(app.config, "APPLICATION_ROOT", "/superset")
    url = password_recovery.build_reset_url("https://superset.example.org/", "tok")
    assert url == (
        "https://superset.example.org/superset/login/reset_password/#token=tok"
    )


def test_reset_base_url_falls_back_to_the_user_friendly_base(
    app: Flask, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setitem(app.config, "AUTH_PASSWORD_RECOVERY", {"enabled": True})
    monkeypatch.setitem(
        app.config, "WEBDRIVER_BASEURL_USER_FRIENDLY", "https://bi.example.org/"
    )
    assert password_recovery.reset_base_url() == "https://bi.example.org/"


def test_reset_base_url_refuses_the_shipped_default(
    app: Flask, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setitem(app.config, "AUTH_PASSWORD_RECOVERY", {"enabled": True})
    monkeypatch.setitem(
        app.config, "WEBDRIVER_BASEURL_USER_FRIENDLY", "http://0.0.0.0:8080/"
    )
    assert password_recovery.reset_base_url() is None


def test_throttle_key_is_keyed_and_normalized(
    app: Flask, monkeypatch: pytest.MonkeyPatch
) -> None:
    key = password_recovery.throttle_key("Someone@Example.org ")
    assert key == password_recovery.throttle_key("someone@example.org")
    monkeypatch.setitem(app.config, "SECRET_KEY", "another-secret")
    assert key != password_recovery.throttle_key("someone@example.org")


def test_partial_config_override_keeps_defaults(
    app: Flask, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setitem(
        app.config,
        "AUTH_PASSWORD_RECOVERY",
        {"enabled": True, "token_ttl_minutes": "not-a-number"},
    )
    assert password_recovery.token_ttl_minutes() == 30
    assert password_recovery.resend_cooldown_seconds() == 120
    assert password_recovery.rate_limit() == "5 per 15 minutes"


def test_non_dict_config_is_treated_as_unset(
    app: Flask, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    """``AUTH_PASSWORD_RECOVERY = True``, written like the neighbouring
    ``AUTH_*`` booleans, must not take every page down: the bootstrap payload
    asks ``is_enabled()`` on each request, so the typo is logged and the
    defaults apply instead."""
    monkeypatch.setitem(app.config, "AUTH_TYPE", AUTH_DB)
    monkeypatch.setitem(app.config, "AUTH_PASSWORD_RECOVERY", True)

    assert password_recovery.is_enabled() is False
    assert password_recovery.token_ttl_minutes() == 30
    assert "AUTH_PASSWORD_RECOVERY must be a dict" in caplog.text


def test_email_body_escapes_the_username(app: Flask) -> None:
    _subject, html = password_recovery.build_email(
        "<script>alert(1)</script>", "https://x.example/#token=t", 30
    )
    assert "<script>" not in html
    assert "&lt;script&gt;" in html


# --- HTTP endpoints ---------------------------------------------------------


def _wait_for_email_send() -> None:
    for thread in threading.enumerate():
        if thread.name == RECOVERY_EMAIL_THREAD_NAME:
            thread.join(timeout=5)


def _close(response: Any) -> None:
    """Close ``response`` as a WSGI server would and wait for the email send.

    Closing starts the deferred send on its own thread; Werkzeug's test client
    leaves streamed responses open until told otherwise.
    """
    response.close()
    _wait_for_email_send()


def _request(client: Any, email: str) -> Any:
    response = client.post(REQUEST_URL, json={"email": email})
    _close(response)
    return response


@pytest.mark.parametrize(
    "case", ["unknown", "external", "inactive", "throttled", "smtp_error"]
)
def test_request_endpoint_responses_do_not_reveal_accounts(
    case: str,
    recovery_enabled: None,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
    client: Any,
) -> None:
    """Every outcome answers with the same status and the same bytes as a
    request that really sent a link."""
    emails = {name: user.email for name, user in users.items()}
    sent = _request(client, emails["db"])
    assert sent.status_code == 200
    assert sent.json == {"message": GENERIC_MESSAGE}
    assert len(sent_emails) == 1

    if case == "throttled":
        response = _request(client, emails["db"])
    elif case == "smtp_error":
        _clear_cooldowns()
        with patch.object(
            password_recovery, "send_email", side_effect=ConnectionRefusedError
        ):
            response = _request(client, emails["db"])
    else:
        address = "nobody@example.org" if case == "unknown" else emails[case]
        response = _request(client, address)

    assert response.status_code == sent.status_code
    assert response.get_data() == sent.get_data()
    assert len(sent_emails) == 1


def test_request_endpoint_ignores_forwarded_host_headers(
    recovery_enabled: None,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
    client: Any,
) -> None:
    response = client.post(
        REQUEST_URL,
        json={"email": users["db"].email},
        headers={"X-Forwarded-Host": "evil.example", "X-Forwarded-Proto": "http"},
    )
    _close(response)
    assert response.status_code == 200
    (email,) = sent_emails
    assert "evil.example" not in email["html"]
    assert "https://superset.example.org/login/reset_password/#token=" in email["html"]


def test_request_endpoint_sends_after_the_response(
    recovery_enabled: None,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
    client: Any,
) -> None:
    response = client.post(
        REQUEST_URL, json={"email": users["db"].email}, buffered=False
    )
    assert response.status_code == 200
    assert sent_emails == []
    _close(response)
    assert len(sent_emails) == 1


def test_request_endpoint_does_not_hold_the_connection_for_smtp(
    recovery_enabled: None,
    users: dict[str, User],
    client: Any,
) -> None:
    """A slow mail server must not delay closing the response either: the
    server closes the connection and takes the next request only once the
    close callbacks return, so a send inside them would let the close time
    tell which addresses have accounts."""
    release = threading.Event()
    delivered: list[str] = []

    def slow_send(to: str, subject: str, html_content: str) -> None:
        release.wait(timeout=2)
        delivered.append(to)

    with patch.object(password_recovery, "send_email", side_effect=slow_send):
        response = client.post(
            REQUEST_URL, json={"email": users["db"].email}, buffered=False
        )
        response.close()
        assert delivered == []
        release.set()
        _wait_for_email_send()
    assert delivered == [users["db"].email]


def test_request_endpoint_send_outlives_the_worker(
    recovery_enabled: None,
    users: dict[str, User],
    client: Any,
) -> None:
    """The send thread is not a daemon, so a worker that exits right after
    answering (``max_requests``, a graceful restart) waits for the email
    instead of dropping it; the token and cooldown are already committed."""
    seen: list[bool] = []

    def record(to: str, subject: str, html_content: str) -> None:
        seen.append(threading.current_thread().daemon)

    with patch.object(password_recovery, "send_email", side_effect=record):
        _request(client, users["db"].email)
    assert seen == [False]


def test_request_endpoint_rejects_a_malformed_body(
    recovery_enabled: None, client: Any
) -> None:
    response = client.post(REQUEST_URL, json={"email": "not-an-email"})
    assert response.status_code == 400
    assert "email" in response.json["message"]


def test_reset_endpoint_full_flow(
    recovery_enabled: None,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
    client: Any,
) -> None:
    username, email = users["db"].username, users["db"].email
    _request(client, email)
    token = _token_from(sent_emails[0])

    response = client.post(RESET_URL, json={"token": token, "password": NEW_PASSWORD})
    assert response.status_code == 200

    replay = client.post(RESET_URL, json={"token": token, "password": NEW_PASSWORD})
    assert replay.status_code == 400
    assert list(replay.json["message"]) == ["token"]
    assert _password_works(username, NEW_PASSWORD)
    assert not _password_works(username, OLD_PASSWORD)


def test_reset_endpoint_signs_out_existing_sessions(
    recovery_enabled: None,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
    app: Flask,
) -> None:
    """A session that logged in before the reset is signed out on its next
    request. ``/login/`` redirects signed-in users away and renders the login
    page for anonymous ones, which makes the session state observable."""
    user = users["db"]
    token = _issue_token(user, sent_emails)

    victim, recoverer = app.test_client(), app.test_client()
    with patch(
        "superset.views.auth.BaseSupersetView.render_app_template",
        return_value="<html></html>",
    ):
        with victim.session_transaction() as session:
            session["_user_id"] = str(user.id)
            session["_fresh"] = True
            session["_login_at"] = time.time() - 5
        assert victim.get("/login/").status_code == 302

        response = recoverer.post(
            RESET_URL, json={"token": token, "password": NEW_PASSWORD}
        )
        assert response.status_code == 200

        assert victim.get("/login/").status_code == 200


def test_recovery_stays_reachable_for_a_flagged_session(
    recovery_enabled: None,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A browser still signed in to an account that must change its password
    can use the recovery pages and endpoints like an anonymous one: recovery
    is how that change gets made, so the forced-change redirect must not
    intercept it."""
    user = users["db"]
    set_password_must_change(user.id)
    token = _issue_token(user, sent_emails)
    _clear_cooldowns()
    monkeypatch.setitem(app.config, "ENABLE_FORCE_PASSWORD_CHANGE", True)

    client = app.test_client()
    with (
        patch(
            "superset.views.auth.BaseSupersetView.render_app_template",
            return_value="<html></html>",
        ),
        patch(
            "superset.security.password_change._profile_page_reachable",
            return_value=True,
        ),
    ):
        with client.session_transaction() as session:
            session["_user_id"] = str(user.id)
            session["_fresh"] = True
            session["_login_at"] = time.time() - 5

        # Enforcement is live for this session.
        blocked = client.get("/")
        assert blocked.status_code == 302
        assert blocked.headers["Location"].endswith("/user_info/")

        for page in ("/login/forgot_password/", "/login/reset_password/"):
            assert client.get(page).status_code == 200, page

        requested = client.post(REQUEST_URL, json={"email": user.email})
        _close(requested)
        assert requested.status_code == 200
        assert requested.json == {"message": GENERIC_MESSAGE}

        reset = client.post(RESET_URL, json={"token": token, "password": NEW_PASSWORD})
        assert reset.status_code == 200

    assert not password_change_required(user)
    assert _password_works(user.username, NEW_PASSWORD)


def test_reset_endpoint_rejects_a_weak_password_without_burning_the_token(
    recovery_enabled: None,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
    client: Any,
) -> None:
    user = users["db"]
    token = _issue_token(user, sent_emails)

    weak = client.post(RESET_URL, json={"token": token, "password": "password"})
    assert weak.status_code == 400
    assert list(weak.json["message"]) == ["password"]

    short = client.post(RESET_URL, json={"token": token, "password": "a1!"})
    assert short.status_code == 400
    assert list(short.json["message"]) == ["password"]

    assert len(_token_entries()) == 1
    response = client.post(RESET_URL, json={"token": token, "password": NEW_PASSWORD})
    assert response.status_code == 200


@pytest.mark.parametrize("token", ["", "x" * 300])
def test_reset_endpoint_rejects_malformed_tokens(
    token: str, recovery_enabled: None, client: Any
) -> None:
    response = client.post(RESET_URL, json={"token": token, "password": NEW_PASSWORD})
    assert response.status_code == 400


def test_reset_endpoint_invalid_token_shape(
    recovery_enabled: None, users: dict[str, User], client: Any
) -> None:
    response = client.post(
        RESET_URL, json={"token": "no-such-token", "password": NEW_PASSWORD}
    )
    assert response.status_code == 400
    assert response.json == {
        "message": {"token": ["This password reset link is invalid or has expired."]}
    }


@pytest.mark.parametrize("case", ["expired", "superseded", "tampered", "replayed"])
def test_reset_endpoint_token_errors_are_indistinguishable(
    case: str,
    recovery_enabled: None,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
    client: Any,
) -> None:
    user = users["db"]
    token = _issue_token(user, sent_emails)
    unknown = client.post(
        RESET_URL, json={"token": "never-issued", "password": NEW_PASSWORD}
    )

    if case == "expired":
        (entry,) = _token_entries()
        entry.expires_on = datetime.now() - timedelta(seconds=1)
        db.session.commit()
    elif case == "superseded":
        user.password = generate_password_hash("Changed-Elsewhere-Passw0rd!")
        db.session.commit()
    elif case == "tampered":
        token = token[:-1] + ("A" if token[-1] != "A" else "B")
    else:
        first = client.post(RESET_URL, json={"token": token, "password": NEW_PASSWORD})
        assert first.status_code == 200

    response = client.post(
        RESET_URL, json={"token": token, "password": "Yet-Another-Passw0rd!"}
    )
    assert response.status_code == unknown.status_code == 400
    assert response.get_data() == unknown.get_data()


@pytest.mark.parametrize("auth_type", [AUTH_OAUTH, AUTH_LDAP, AUTH_REMOTE_USER])
@pytest.mark.parametrize("url", [REQUEST_URL, RESET_URL])
def test_endpoints_are_hidden_for_other_auth_types(
    auth_type: int,
    url: str,
    recovery_enabled: None,
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
    client: Any,
) -> None:
    monkeypatch.setitem(app.config, "AUTH_TYPE", auth_type)
    response = client.post(
        url,
        json={"email": "a@example.org", "token": "t", "password": NEW_PASSWORD},
    )
    assert response.status_code == 404


def test_endpoints_never_log_the_token_or_password(
    recovery_enabled: None,
    users: dict[str, User],
    sent_emails: list[dict[str, str]],
    client: Any,
    mocker: MockerFixture,
    caplog: pytest.LogCaptureFixture,
) -> None:
    from superset.extensions import event_logger

    log_spy = mocker.spy(event_logger, "log")
    caplog.set_level(logging.DEBUG)
    _request(client, users["db"].email)
    token = _token_from(sent_emails[0])
    client.post(RESET_URL, json={"token": token, "password": NEW_PASSWORD})

    logged = repr(log_spy.call_args_list) + caplog.text
    actions = [call.kwargs.get("action") for call in log_spy.call_args_list]
    assert "PasswordRecoveryRequested" in actions
    assert "PasswordRecoveryCompleted" in actions
    assert token not in logged
    assert NEW_PASSWORD not in logged


@pytest.mark.parametrize(
    "url", [REQUEST_URL, RESET_URL, "/login/forgot_password/", "/login/reset_password/"]
)
def test_everything_is_hidden_when_disabled(
    url: str, app: Flask, monkeypatch: pytest.MonkeyPatch, client: Any
) -> None:
    monkeypatch.setitem(app.config, "AUTH_PASSWORD_RECOVERY", {"enabled": False})
    if url.startswith("/api"):
        response = client.post(url, json={"email": "a@example.org"})
    else:
        response = client.get(url)
    assert response.status_code == 404


def test_pages_render_when_enabled(recovery_enabled: None, client: Any) -> None:
    # The unit-test app has no template folder; the SPA shell itself is not
    # under test here.
    with patch(
        "superset.views.auth.BaseSupersetView.render_app_template",
        return_value="<html></html>",
    ):
        for url in ("/login/forgot_password/", "/login/reset_password/"):
            assert client.get(url).status_code == 200
