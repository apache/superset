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
