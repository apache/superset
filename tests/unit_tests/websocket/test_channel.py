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
from datetime import datetime, timedelta, timezone

import jwt
from pytest_mock import MockerFixture


def test_channel_id_for_maps_principal_identity() -> None:
    from superset.websocket.channel import channel_id_for

    # A user id wins and maps to user:<id>; a guest key is returned verbatim
    # (already namespaced); neither identity → None (anonymous).
    assert channel_id_for(7, None) == "user:7"
    assert channel_id_for(None, "guest:abc") == "guest:abc"
    assert channel_id_for(None, None) is None
    # A user id takes precedence over any stray guest key.
    assert channel_id_for(7, "guest:abc") == "user:7"


def test_mint_channel_token_encodes_channel(app_context) -> None:
    from flask import current_app

    from superset.websocket import channel
    from superset.websocket.permissions import (
        REALTIME_NOTIFICATION_JWT_AUDIENCE,
        REALTIME_NOTIFICATION_JWT_ISSUER,
    )

    token = channel.mint_channel_token(
        {
            "channel": "user:5",
            "principal_type": "user",
            "sub": "5",
        }
    )
    decoded = jwt.decode(
        token,
        current_app.config["WEBSOCKET_JWT_SECRET"],
        algorithms=["HS256"],
        audience=REALTIME_NOTIFICATION_JWT_AUDIENCE,
        issuer=REALTIME_NOTIFICATION_JWT_ISSUER,
    )
    assert decoded["channel"] == "user:5"
    assert decoded["principal_type"] == "user"
    assert decoded["sub"] == "5"
    # The token carries only what the websocket server routes on; no profile
    # attributes and no permission list.
    assert "username" not in decoded
    assert "permissions" not in decoded
    assert "exp" in decoded


def test_realtime_principal_for_logged_in_user(
    app_context, mocker: MockerFixture
) -> None:
    from superset.websocket import channel

    mocker.patch.object(
        channel.security_manager, "get_current_guest_user_if_guest", return_value=None
    )
    mocker.patch.object(channel, "get_user_id", return_value=7)

    assert channel.get_realtime_principal() == {
        "channel": "user:7",
        "principal_type": "user",
        "sub": "7",
    }


def test_realtime_principal_for_guest(app_context, mocker: MockerFixture) -> None:
    from superset.websocket import channel

    mocker.patch.object(
        channel.security_manager,
        "get_current_guest_user_if_guest",
        return_value=object(),
    )
    mocker.patch.object(
        channel, "get_current_guest_subscriber_key", return_value="guest:abc"
    )

    assert channel.get_realtime_principal() == {
        "channel": "guest:abc",
        "principal_type": "guest",
        "sub": "guest:abc",
    }


def test_realtime_principal_none_for_anonymous(
    app_context, mocker: MockerFixture
) -> None:
    from superset.websocket import channel

    mocker.patch.object(
        channel.security_manager, "get_current_guest_user_if_guest", return_value=None
    )
    mocker.patch.object(channel, "get_user_id", return_value=None)

    assert channel.get_realtime_principal() is None


def test_realtime_principal_none_for_guest_without_key(
    app_context, mocker: MockerFixture
) -> None:
    from superset.websocket import channel

    mocker.patch.object(
        channel.security_manager,
        "get_current_guest_user_if_guest",
        return_value=object(),
    )
    mocker.patch.object(channel, "get_current_guest_subscriber_key", return_value=None)

    assert channel.get_realtime_principal() is None


def _make_ws_app():
    """A minimal Flask app carrying the WEBSOCKET_* config the hook reads."""
    from flask import Flask, jsonify

    from superset.websocket.channel import register_ws_channel_cookie

    app = Flask(__name__)
    app.config.update(
        WEBSOCKET_ENABLE=True,
        WEBSOCKET_JWT_SECRET="x" * 40,
        WEBSOCKET_JWT_COOKIE_NAME="superset-ws-token",
        WEBSOCKET_JWT_COOKIE_SECURE=False,
        WEBSOCKET_JWT_COOKIE_SAMESITE=None,
        WEBSOCKET_JWT_COOKIE_DOMAIN=None,
        WEBSOCKET_JWT_EXPIRATION_SECONDS=3600,
    )
    register_ws_channel_cookie(app)

    @app.route("/_ws_probe")
    def _ws_probe():  # pragma: no cover - trivial
        return jsonify(ok=True)

    return app


def _ws_set_cookies(response):
    return [c for c in response.headers.getlist("Set-Cookie") if "ws-token" in c]


def test_cookie_reminted_when_principal_changes(mocker) -> None:
    from superset.websocket import channel

    client = _make_ws_app().test_client()
    mocker.patch.object(channel, "can_access_realtime_notifications", return_value=True)
    mocker.patch.object(
        channel.security_manager, "get_current_guest_user_if_guest", return_value=None
    )

    mocker.patch.object(channel, "get_user_id", return_value=1)
    assert _ws_set_cookies(client.get("/_ws_probe"))  # minted for user:1

    # A different principal on the same client must re-mint (not keep user:1).
    mocker.patch.object(channel, "get_user_id", return_value=2)
    assert _ws_set_cookies(client.get("/_ws_probe"))


def test_cookie_signed_with_old_secret_is_reminted_with_current_secret(mocker) -> None:
    from superset.websocket import channel
    from superset.websocket.permissions import (
        REALTIME_NOTIFICATION_JWT_AUDIENCE,
        REALTIME_NOTIFICATION_JWT_ISSUER,
    )

    client = _make_ws_app().test_client()
    mocker.patch.object(channel, "can_access_realtime_notifications", return_value=True)
    mocker.patch.object(
        channel.security_manager, "get_current_guest_user_if_guest", return_value=None
    )
    mocker.patch.object(channel, "get_user_id", return_value=1)

    old_key_token = jwt.encode(
        {
            "channel": "user:1",
            "principal_type": "user",
            "sub": "1",
            "aud": REALTIME_NOTIFICATION_JWT_AUDIENCE,
            "iss": REALTIME_NOTIFICATION_JWT_ISSUER,
            "exp": datetime.now(tz=timezone.utc) + timedelta(hours=1),
        },
        "y" * 40,
        algorithm="HS256",
    )
    client.set_cookie("superset-ws-token", old_key_token)

    assert _ws_set_cookies(client.get("/_ws_probe"))


def _mint_ws_token(
    exp_delta_seconds: int,
    secret: str = "x" * 40,
    channel_id: str = "user:1",
) -> str:
    from superset.websocket.permissions import (
        REALTIME_NOTIFICATION_JWT_AUDIENCE,
        REALTIME_NOTIFICATION_JWT_ISSUER,
    )

    return jwt.encode(
        {
            "channel": channel_id,
            "principal_type": "user",
            "sub": channel_id.split(":")[1],
            "aud": REALTIME_NOTIFICATION_JWT_AUDIENCE,
            "iss": REALTIME_NOTIFICATION_JWT_ISSUER,
            "exp": datetime.now(tz=timezone.utc) + timedelta(seconds=exp_delta_seconds),
        },
        secret,
        algorithm="HS256",
    )


def test_cookie_not_reminted_when_fresh(mocker) -> None:
    from superset.websocket import channel

    client = _make_ws_app().test_client()
    mocker.patch.object(channel, "can_access_realtime_notifications", return_value=True)
    mocker.patch.object(
        channel.security_manager, "get_current_guest_user_if_guest", return_value=None
    )
    mocker.patch.object(channel, "get_user_id", return_value=1)

    # Full lifetime remaining (> half of 3600s) → the hook leaves it alone, so a
    # Set-Cookie header is not written on every request.
    client.set_cookie("superset-ws-token", _mint_ws_token(3600))
    assert not _ws_set_cookies(client.get("/_ws_probe"))


def test_cookie_reminted_inside_refresh_window(mocker) -> None:
    from superset.websocket import channel

    client = _make_ws_app().test_client()
    mocker.patch.object(channel, "can_access_realtime_notifications", return_value=True)
    mocker.patch.object(
        channel.security_manager, "get_current_guest_user_if_guest", return_value=None
    )
    mocker.patch.object(channel, "get_user_id", return_value=1)

    # Only 60s remaining (< half of 3600s) → sliding-window re-mint keeps an active
    # surface's socket alive past the original expiry (Finding 6).
    client.set_cookie("superset-ws-token", _mint_ws_token(60))
    assert _ws_set_cookies(client.get("/_ws_probe"))


def test_cookie_cleared_for_anonymous(mocker) -> None:
    from superset.websocket import channel

    client = _make_ws_app().test_client()
    mocker.patch.object(channel, "can_access_realtime_notifications", return_value=True)
    mocker.patch.object(
        channel.security_manager, "get_current_guest_user_if_guest", return_value=None
    )
    mocker.patch.object(channel, "get_user_id", return_value=None)

    client.set_cookie("superset-ws-token", "stale")
    resp = client.get("/_ws_probe")
    cleared = [
        c
        for c in resp.headers.getlist("Set-Cookie")
        if "superset-ws-token" in c and ("Expires" in c or "Max-Age=0" in c)
    ]
    assert cleared, "stale cookie must be cleared when there is no principal"


def test_cookie_not_minted_without_realtime_permission(mocker) -> None:
    from superset.websocket import channel

    client = _make_ws_app().test_client()
    mocker.patch.object(
        channel, "can_access_realtime_notifications", return_value=False
    )
    mocker.patch.object(
        channel.security_manager, "get_current_guest_user_if_guest", return_value=None
    )
    mocker.patch.object(channel, "get_user_id", return_value=1)

    assert not _ws_set_cookies(client.get("/_ws_probe"))


def test_cookie_cleared_when_realtime_permission_removed(mocker) -> None:
    from superset.websocket import channel

    client = _make_ws_app().test_client()
    mocker.patch.object(
        channel, "can_access_realtime_notifications", return_value=False
    )
    mocker.patch.object(
        channel.security_manager, "get_current_guest_user_if_guest", return_value=None
    )
    mocker.patch.object(channel, "get_user_id", return_value=1)

    client.set_cookie("superset-ws-token", "stale")
    resp = client.get("/_ws_probe")
    cleared = [
        c
        for c in resp.headers.getlist("Set-Cookie")
        if "superset-ws-token" in c and ("Expires" in c or "Max-Age=0" in c)
    ]
    assert cleared, "stale cookie must be cleared without realtime permission"
