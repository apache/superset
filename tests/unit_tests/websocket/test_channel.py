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


def test_channel_id_for_logged_in_user(app_context, mocker: MockerFixture) -> None:
    from superset.websocket import channel

    mocker.patch.object(
        channel.security_manager, "get_current_guest_user_if_guest", return_value=None
    )
    mocker.patch.object(channel, "get_user_id", return_value=7)
    assert channel.get_channel_id() == "user:7"


def test_channel_id_for_guest(app_context, mocker: MockerFixture) -> None:
    from superset.websocket import channel

    mocker.patch.object(
        channel.security_manager,
        "get_current_guest_user_if_guest",
        return_value=object(),
    )
    mocker.patch.object(
        channel, "get_current_guest_subscriber_key", return_value="guest-abc"
    )
    assert channel.get_channel_id() == "guest-abc"


def test_channel_id_none_for_anonymous(app_context, mocker: MockerFixture) -> None:
    from superset.websocket import channel

    mocker.patch.object(
        channel.security_manager, "get_current_guest_user_if_guest", return_value=None
    )
    mocker.patch.object(channel, "get_user_id", return_value=None)
    assert channel.get_channel_id() is None


def test_mint_channel_token_encodes_channel(app_context) -> None:
    from flask import current_app

    from superset.websocket import channel

    token = channel.mint_channel_token("user:5")
    decoded = jwt.decode(
        token, current_app.config["WEBSOCKET_JWT_SECRET"], algorithms=["HS256"]
    )
    assert decoded["channel"] == "user:5"
    assert "exp" in decoded
