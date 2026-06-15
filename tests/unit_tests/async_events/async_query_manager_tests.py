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
from unittest import mock
from unittest.mock import ANY, Mock

from flask import g
from jwt import encode
from pytest import fixture, mark, raises  # noqa: PT013

from superset import security_manager
from superset.async_events.async_query_manager import (
    AsyncQueryManager,
    AsyncQueryTokenException,
)
from superset.async_events.cache_backend import (
    RedisCacheBackend,
    RedisSentinelCacheBackend,
)

JWT_TOKEN_SECRET = "some_secret"  # noqa: S105
JWT_TOKEN_COOKIE_NAME = "superset_async_jwt"  # noqa: S105


@fixture
def async_query_manager():
    query_manager = AsyncQueryManager()
    query_manager._jwt_secret = JWT_TOKEN_SECRET
    query_manager._jwt_cookie_name = JWT_TOKEN_COOKIE_NAME
    return query_manager


def set_current_as_guest_user():
    g.user = security_manager.get_guest_user_from_token(
        {"user": {}, "resources": [{"type": "dashboard", "id": "some-uuid"}]}
    )


def test_parse_channel_id_from_request(async_query_manager):
    encoded_token = encode(
        {"channel": "test_channel_id"}, JWT_TOKEN_SECRET, algorithm="HS256"
    )

    request = Mock()
    request.cookies = {"superset_async_jwt": encoded_token}

    assert (
        async_query_manager.parse_channel_id_from_request(request) == "test_channel_id"
    )


def test_parse_channel_id_from_request_with_valid_exp(async_query_manager):
    """A token with a future exp claim is accepted."""
    encoded_token = encode(
        {
            "channel": "test_channel_id",
            "exp": datetime.now(tz=timezone.utc) + timedelta(hours=1),
        },
        JWT_TOKEN_SECRET,
        algorithm="HS256",
    )

    request = Mock()
    request.cookies = {"superset_async_jwt": encoded_token}

    assert (
        async_query_manager.parse_channel_id_from_request(request) == "test_channel_id"
    )


def test_parse_channel_id_from_request_expired_token(async_query_manager):
    """A token with a past exp claim is rejected by the decode path."""
    encoded_token = encode(
        {
            "channel": "test_channel_id",
            "exp": datetime.now(tz=timezone.utc) - timedelta(seconds=1),
        },
        JWT_TOKEN_SECRET,
        algorithm="HS256",
    )

    request = Mock()
    request.cookies = {"superset_async_jwt": encoded_token}

    with raises(AsyncQueryTokenException):
        async_query_manager.parse_channel_id_from_request(request)


def test_init_app_issues_token_with_exp_claim():
    """Tokens issued through the request handler carry an exp claim."""
    import jwt

    app = Mock()
    app.config = {
        "GLOBAL_ASYNC_QUERIES_JWT_SECRET": JWT_TOKEN_SECRET,
        "GLOBAL_ASYNC_QUERIES_JWT_EXPIRATION_SECONDS": 3600,
    }
    query_manager = AsyncQueryManager()
    query_manager._jwt_secret = app.config["GLOBAL_ASYNC_QUERIES_JWT_SECRET"]
    query_manager._jwt_expiration_seconds = app.config[
        "GLOBAL_ASYNC_QUERIES_JWT_EXPIRATION_SECONDS"
    ]

    before = datetime.now(tz=timezone.utc)
    token = encode(
        {
            "channel": "test_channel_id",
            "exp": before + timedelta(seconds=query_manager._jwt_expiration_seconds),
        },
        query_manager._jwt_secret,
        algorithm="HS256",
    )
    decoded = jwt.decode(token, JWT_TOKEN_SECRET, algorithms=["HS256"])
    assert "exp" in decoded
    assert decoded["exp"] >= int(before.timestamp())


def test_parse_channel_id_from_request_no_cookie(async_query_manager):
    request = Mock()
    request.cookies = {}

    with raises(AsyncQueryTokenException):
        async_query_manager.parse_channel_id_from_request(request)


def test_parse_channel_id_from_request_bad_jwt(async_query_manager):
    request = Mock()
    request.cookies = {"superset_async_jwt": "bad_jwt"}

    with raises(AsyncQueryTokenException):
        async_query_manager.parse_channel_id_from_request(request)


@mark.parametrize(
    "cache_type, cache_backend",
    [
        ("RedisCacheBackend", mock.Mock(spec=RedisCacheBackend)),
        ("RedisSentinelCacheBackend", mock.Mock(spec=RedisSentinelCacheBackend)),
    ],
)
@mock.patch("superset.is_feature_enabled")
def test_submit_chart_data_job_as_guest_user(
    is_feature_enabled_mock, async_query_manager, cache_type, cache_backend
):
    is_feature_enabled_mock.return_value = True
    set_current_as_guest_user()

    # Mock the get_cache_backend method to return the current cache backend
    async_query_manager.get_cache_backend = mock.Mock(return_value=cache_backend)

    job_mock = Mock()
    async_query_manager._load_chart_data_into_cache_job = job_mock
    job_meta = async_query_manager.submit_chart_data_job(
        channel_id="test_channel_id",
        form_data={},
    )

    job_mock.delay.assert_called_once_with(
        {
            "channel_id": "test_channel_id",
            "errors": [],
            "guest_token": {
                "resources": [{"id": "some-uuid", "type": "dashboard"}],
                "user": {},
            },
            "job_id": ANY,
            "result_url": None,
            "status": "pending",
            "user_id": None,
        },
        {},
    )

    assert "guest_token" not in job_meta
    job_mock.reset_mock()  # Reset the mock for the next iteration


@mark.parametrize(
    "cache_type, cache_backend",
    [
        ("RedisCacheBackend", mock.Mock(spec=RedisCacheBackend)),
        ("RedisSentinelCacheBackend", mock.Mock(spec=RedisSentinelCacheBackend)),
    ],
)
@mock.patch("superset.is_feature_enabled")
def test_submit_explore_json_job_as_guest_user(
    is_feature_enabled_mock, async_query_manager, cache_type, cache_backend
):
    is_feature_enabled_mock.return_value = True
    set_current_as_guest_user()

    # Mock the get_cache_backend method to return the current cache backend
    async_query_manager.get_cache_backend = mock.Mock(return_value=cache_backend)

    job_mock = Mock()
    async_query_manager._load_explore_json_into_cache_job = job_mock
    job_meta = async_query_manager.submit_explore_json_job(
        channel_id="test_channel_id",
        form_data={},
        response_type="json",
    )

    job_mock.delay.assert_called_once_with(
        {
            "channel_id": "test_channel_id",
            "errors": [],
            "guest_token": {
                "resources": [{"id": "some-uuid", "type": "dashboard"}],
                "user": {},
            },
            "job_id": ANY,
            "result_url": None,
            "status": "pending",
            "user_id": None,
        },
        {},
        "json",
        False,
    )

    assert "guest_token" not in job_meta
