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
from typing import Any
from unittest.mock import Mock, patch

from flask_appbuilder.security.sqla.models import User

from superset.models.core import Database
from superset.utils.cache_keys import add_impersonation_cache_key_if_needed
from superset.utils.core import override_user


def _flag(name: str):
    """Build a feature-flag side_effect that returns True only for ``name``."""

    def side_effect(feature=None):
        return feature == name

    return side_effect


def _run(database: Database) -> dict[str, Any]:
    """Run the helper against a fresh dict and return that dict."""
    cache_dict: dict[str, Any] = {}
    add_impersonation_cache_key_if_needed(database, cache_dict)
    return cache_dict


def test_no_per_user_caching_yields_no_key():
    database = Database(database_name="d", sqlalchemy_uri="sqlite://")
    with override_user(User(username="u")):
        assert "impersonation_key" not in _run(database)


@patch("superset.utils.cache_keys.feature_flag_manager")
def test_cache_query_by_user_adds_username(feature_flag_mock):
    feature_flag_mock.is_feature_enabled.side_effect = _flag("CACHE_QUERY_BY_USER")
    database = Database(database_name="d", sqlalchemy_uri="sqlite://")
    with override_user(User(username="alice")):
        assert _run(database)["impersonation_key"] == "alice"


@patch("superset.utils.cache_keys.feature_flag_manager")
def test_cache_query_by_user_distinct_per_user(feature_flag_mock):
    feature_flag_mock.is_feature_enabled.side_effect = _flag("CACHE_QUERY_BY_USER")
    database = Database(database_name="d", sqlalchemy_uri="sqlite://")
    with override_user(User(username="alice")):
        key_a = _run(database)["impersonation_key"]
    with override_user(User(username="bob")):
        key_b = _run(database)["impersonation_key"]
    assert key_a != key_b


@patch("superset.utils.cache_keys.feature_flag_manager")
def test_cache_impersonation_requires_database_flag(feature_flag_mock):
    """
    CACHE_IMPERSONATION alone is not enough; ``database.impersonate_user`` must
    also be set on the database for the per-user key to apply.
    """
    feature_flag_mock.is_feature_enabled.side_effect = _flag("CACHE_IMPERSONATION")

    db_no_impersonation = Database(database_name="d", sqlalchemy_uri="sqlite://")
    db_with_impersonation = Database(
        database_name="d", sqlalchemy_uri="sqlite://", impersonate_user=True
    )

    with override_user(User(username="alice")):
        assert "impersonation_key" not in _run(db_no_impersonation)
        assert _run(db_with_impersonation)["impersonation_key"] == "alice"


def test_per_user_caching_in_extra_json_enables_key():
    database = Database(
        database_name="d",
        sqlalchemy_uri="sqlite://",
        extra='{"per_user_caching": true}',
    )
    with override_user(User(username="alice")):
        assert _run(database)["impersonation_key"] == "alice"


def test_no_user_yields_no_key(app_context):  # noqa: ARG001
    """
    With no logged-in user, the engine spec returns None even when per-user
    caching is enabled — there's no identity to key on.
    """
    database = Database(
        database_name="d",
        sqlalchemy_uri="sqlite://",
        extra='{"per_user_caching": true}',
    )
    # No override_user — g.user is unset
    assert "impersonation_key" not in _run(database)


@patch("superset.utils.cache_keys.feature_flag_manager")
def test_embedded_fallback_keys_the_cache_without_any_caching_flag(feature_flag_mock):
    """
    The embedded fallback gets its own cache identity with no opt-in flag set.

    It replaces the connection identity without going through impersonation, so
    none of the conditions below would notice it, and its rows must never land on
    the same DATA-cache entry -- nor the same SHARED async task, whose key is the
    query cache key -- as a logged-in user's per-user OAuth2 result.
    """
    feature_flag_mock.is_feature_enabled.return_value = False
    database = Database(database_name="d", sqlalchemy_uri="sqlite://")
    with patch.object(
        Database,
        "get_embedded_fallback_credentials",
        return_value={"username": "embedded_svc", "password": "pw"},
    ):
        assert _run(database)["embedded_credentials_key"] == "embedded:embedded_svc"


@patch("superset.utils.cache_keys.feature_flag_manager")
def test_embedded_fallback_key_differs_from_a_logged_in_user(feature_flag_mock):
    """
    A guest and a logged-in user must not compute the same key for one query.
    """
    feature_flag_mock.is_feature_enabled.side_effect = _flag("CACHE_QUERY_BY_USER")
    database = Database(database_name="d", sqlalchemy_uri="sqlite://")

    with patch.object(
        Database,
        "get_embedded_fallback_credentials",
        return_value={"username": "embedded_svc", "password": "pw"},
    ):
        guest_key = _run(database)

    with override_user(User(username="embedded_svc")):
        user_key = _run(database)

    # Even a logged-in account that happens to share the credential's name --
    # or a guest token claiming it -- must not collide with the guest entry.
    assert guest_key != user_key


@patch("superset.utils.cache_keys.feature_flag_manager")
def test_embedded_fallback_ignores_the_guest_token_username_claim(feature_flag_mock):
    """
    The key comes from the configured credential, not from ``g.user``.

    Whoever mints the guest token controls its ``username`` claim; letting that
    into the key would let a token holder choose which cache entry they read.
    """
    feature_flag_mock.is_feature_enabled.side_effect = _flag("CACHE_QUERY_BY_USER")
    database = Database(database_name="d", sqlalchemy_uri="sqlite://")

    with patch.object(
        Database,
        "get_embedded_fallback_credentials",
        return_value={"username": "embedded_svc", "password": "pw"},
    ):
        with override_user(User(username="ACCOUNTADMIN")):
            key_a = _run(database)["embedded_credentials_key"]
        with override_user(User(username="someone_else")):
            key_b = _run(database)["embedded_credentials_key"]

    assert key_a == key_b == "embedded:embedded_svc"


@patch("superset.utils.cache_keys.feature_flag_manager")
def test_query_object_cache_key_separates_guest_from_logged_in(feature_flag_mock):
    """
    The separation survives all the way to the hashed ``QueryObject.cache_key``.

    That key is also the SHARED async ``task_key``, so without this a guest and a
    logged-in user would dedup onto one task and one DATA-cache entry for the same
    chart -- whichever of them arrived first choosing the credential for both.
    """
    from superset.common.query_object import QueryObject

    feature_flag_mock.is_feature_enabled.side_effect = _flag("CACHE_QUERY_BY_USER")
    database = Database(database_name="d", sqlalchemy_uri="sqlite://")

    def key_for(credentials: dict[str, str] | None) -> str:
        query_object = QueryObject(columns=["region"], metrics=["count"])
        # `QueryObject.cache_key` reaches the database through its datasource; the
        # rest of the datasource plays no part in this assertion.
        query_object.datasource = Mock(database=database, uid="1__table")
        with patch.object(
            Database,
            "get_embedded_fallback_credentials",
            return_value=credentials,
        ):
            return query_object.cache_key()

    guest_key = key_for({"username": "embedded_svc", "password": "pw"})
    with override_user(User(username="embedded:embedded_svc")):
        logged_in_key = key_for(None)

    assert guest_key != logged_in_key


@patch("superset.utils.cache_keys.feature_flag_manager")
def test_the_engine_spec_owns_the_embedded_cache_key(feature_flag_mock):
    """
    The key material comes from the engine spec, not from this helper.

    An engine whose fallback credential has no ``username`` -- or whose cached rows
    depend on more of the credential than the identity does -- states that in
    ``get_embedded_credential_cache_key`` rather than having this helper guess.
    """
    from superset.db_engine_specs.sqlite import SqliteEngineSpec

    class CustomEngineSpec(SqliteEngineSpec):
        @classmethod
        def get_embedded_credential_cache_key(cls, credentials: dict[str, str]) -> str:
            return f"tenant:{credentials['tenant']}"

    feature_flag_mock.is_feature_enabled.return_value = False
    database = Database(database_name="d", sqlalchemy_uri="sqlite://")

    with (
        patch.object(
            Database,
            "get_embedded_fallback_credentials",
            return_value={"tenant": "acme"},
        ),
        patch.object(
            Database,
            "db_engine_spec",
            new_callable=lambda: property(lambda self: CustomEngineSpec),
        ),
    ):
        assert _run(database)["embedded_credentials_key"] == "tenant:acme"


@patch("superset.utils.cache_keys.feature_flag_manager")
def test_unconfigured_embedded_guest_cannot_read_a_warm_logged_in_cache(
    feature_flag_mock: Mock,
) -> None:
    """Missing fallback credentials get a separate result and async task key."""
    from superset.common.query_object import QueryObject

    feature_flag_mock.is_feature_enabled.return_value = False
    database = Database(database_name="d", sqlalchemy_uri="sqlite://")
    query_object = QueryObject(columns=["region"], metrics=["count"])
    query_object.datasource = Mock(database=database, uid="1__table")
    with patch.object(Database, "get_embedded_fallback_credentials", return_value=None):
        with patch.object(Database, "embedded_fallback_applies", return_value=False):
            logged_in_key = query_object.cache_key()
        warmed_cache = {logged_in_key: ["logged-in rows"]}
        with patch.object(Database, "embedded_fallback_applies", return_value=True):
            guest_key = query_object.cache_key()
            assert _run(database) == {"embedded_credentials_missing": True}
        assert guest_key not in warmed_cache
        with patch.object(
            Database,
            "get_embedded_fallback_credentials",
            return_value={"username": "missing", "password": "pw"},
        ):
            configured_key = query_object.cache_key()
    assert len({guest_key, logged_in_key, configured_key}) == 3


@patch("superset.utils.cache_keys.feature_flag_manager")
def test_a_guest_refused_for_a_missing_oauth2_client_gets_a_separate_cache_key(
    feature_flag_mock: Mock,
) -> None:
    """
    A guest refused on a promoted connection cannot read a warm logged-in entry.

    The refusal happens at engine creation, which a cache hit never reaches.
    """
    feature_flag_mock.is_feature_enabled.return_value = False
    database = Database(database_name="d", sqlalchemy_uri="sqlite://")
    with (
        patch.object(Database, "get_embedded_fallback_credentials", return_value=None),
        patch.object(Database, "embedded_fallback_applies", return_value=False),
        patch.object(
            Database, "embedded_guest_missing_oauth2_client", return_value=True
        ),
    ):
        assert _run(database) == {"embedded_credentials_missing": True}
