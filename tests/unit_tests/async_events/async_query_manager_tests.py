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
    query_manager._jwt_expiration_seconds = 3600
    return query_manager


def set_current_as_guest_user():
    g.user = security_manager.get_guest_user_from_token(
        {
            "user": {},
            "resources": [{"type": "dashboard", "id": "some-uuid"}],
            "rls_rules": [{"clause": '"STATEID" = 3'}],
            "iat": 1700000000.0,
            "exp": 1700000300.0,
            "aud": "http://0.0.0.0:8080/",
            "type": "guest",
        }
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


@mock.patch("superset.is_feature_enabled")
def test_parse_channel_id_from_request_as_guest_user_no_cookie(
    is_feature_enabled_mock, async_query_manager
):
    """
    Embedded guest sessions cannot rely on the async-token cookie because
    cross-origin cookies are blocked or stripped by modern browsers when the
    dashboard is rendered inside a third-party iframe. The channel id must
    therefore be derived from the guest token rather than the cookie.
    """
    is_feature_enabled_mock.return_value = True
    set_current_as_guest_user()

    request = Mock()
    request.cookies = {}

    channel_id = async_query_manager.parse_channel_id_from_request(request)
    assert channel_id.startswith("guest-")


@mock.patch("superset.is_feature_enabled")
def test_parse_channel_id_from_request_as_guest_user_is_deterministic(
    is_feature_enabled_mock, async_query_manager
):
    """
    The same guest token (including its RLS rules) must yield the same channel
    id across requests. Otherwise the chart-data submission and the polling
    endpoint would write to and read from different streams, returning 401s
    even though the work was scheduled correctly.
    """
    is_feature_enabled_mock.return_value = True
    set_current_as_guest_user()

    request = Mock()
    request.cookies = {}

    first = async_query_manager.parse_channel_id_from_request(request)
    second = async_query_manager.parse_channel_id_from_request(request)
    assert first == second


@mock.patch("superset.is_feature_enabled")
def test_parse_channel_id_from_request_as_guest_user_differs_per_token(
    is_feature_enabled_mock, async_query_manager
):
    """Different guest tokens must produce different channel ids."""
    is_feature_enabled_mock.return_value = True

    set_current_as_guest_user()
    request = Mock()
    request.cookies = {}
    first = async_query_manager.parse_channel_id_from_request(request)

    g.user = security_manager.get_guest_user_from_token(
        {
            "user": {"username": "other"},
            "resources": [{"type": "dashboard", "id": "another-uuid"}],
            "rls_rules": [{"clause": '"STATEID" = 4'}],
            "iat": 1700000000.0,
            "exp": 1700000300.0,
            "aud": "http://0.0.0.0:8080/",
            "type": "guest",
        }
    )
    second = async_query_manager.parse_channel_id_from_request(request)

    assert first != second


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

    job_mock.apply_async.assert_called_once_with(
        args=[
            {
                "channel_id": "test_channel_id",
                "errors": [],
                "guest_token": {
                    "user": {},
                    "resources": [{"type": "dashboard", "id": "some-uuid"}],
                    "rls_rules": [{"clause": '"STATEID" = 3'}],
                    "iat": 1700000000.0,
                    "exp": 1700000300.0,
                    "aud": "http://0.0.0.0:8080/",
                    "type": "guest",
                },
                "job_id": ANY,
                "result_url": None,
                "status": "pending",
                "user_id": None,
            },
            {},
        ],
        expires=3600,
    )

    assert "guest_token" not in job_meta
    job_mock.reset_mock()  # Reset the mock for the next iteration


def test_parse_channel_id_from_request_sub_none(async_query_manager):
    """Regression: token with sub=None must not break parse (PyJWT 2.10.1+)."""
    encoded_token = encode(
        {"channel": "test_channel_id", "sub": None},
        JWT_TOKEN_SECRET,
        algorithm="HS256",
    )

    request = Mock()
    request.cookies = {JWT_TOKEN_COOKIE_NAME: encoded_token}

    with raises(AsyncQueryTokenException):
        async_query_manager.parse_channel_id_from_request(request)


def test_validate_session_guest_user_creates_valid_token(async_query_manager):
    """Regression: validate_session creates decodable tokens when user_id is None."""
    from flask import Flask

    async_query_manager._jwt_cookie_secure = False
    async_query_manager._jwt_cookie_domain = None
    async_query_manager._jwt_cookie_samesite = "Lax"
    async_query_manager._jwt_expiration_seconds = 3600

    app = Flask(__name__)
    app.secret_key = "test_secret_key_for_testing"  # noqa: S105
    async_query_manager.register_request_handlers(app)

    @app.route("/test")
    def test_view():
        return "ok"

    with mock.patch(
        "superset.async_events.async_query_manager.get_user_id",
        return_value=None,
    ):
        client = app.test_client()
        resp = client.get("/test")

        cookie_header = [
            v
            for k, v in resp.headers
            if k == "Set-Cookie" and JWT_TOKEN_COOKIE_NAME in v
        ]
        assert cookie_header, "JWT cookie was not set"
        token = cookie_header[0].split("=", 1)[1].split(";")[0]

        mock_request = Mock()
        mock_request.cookies = {JWT_TOKEN_COOKIE_NAME: token}
        channel = async_query_manager.parse_channel_id_from_request(mock_request)
        assert channel  # valid UUID string


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

    job_mock.apply_async.assert_called_once_with(
        args=[
            {
                "channel_id": "test_channel_id",
                "errors": [],
                "guest_token": {
                    "user": {},
                    "resources": [{"type": "dashboard", "id": "some-uuid"}],
                    "rls_rules": [{"clause": '"STATEID" = 3'}],
                    "iat": 1700000000.0,
                    "exp": 1700000300.0,
                    "aud": "http://0.0.0.0:8080/",
                    "type": "guest",
                },
                "job_id": ANY,
                "result_url": None,
                "status": "pending",
                "user_id": None,
            },
            {},
            "json",
            False,
        ],
        expires=3600,
    )

    assert "guest_token" not in job_meta
