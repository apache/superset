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
"""Unit tests for the default async JWT secret startup check."""

from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.constants import CHANGE_ME_GLOBAL_ASYNC_QUERIES_JWT_SECRET
from superset.initialization import SupersetAppInitializer


def _make_initializer(
    secret: str,
    *,
    debug: bool = False,
    testing: bool = False,
) -> SupersetAppInitializer:
    initializer = SupersetAppInitializer.__new__(SupersetAppInitializer)
    app = MagicMock()
    app.debug = debug
    app.config = {
        "GLOBAL_ASYNC_QUERIES_JWT_SECRET": secret,
        "TESTING": testing,
    }
    initializer.superset_app = app
    initializer.config = app.config
    return initializer


def test_check_async_query_secret_rejects_default_in_production(
    mocker: MockerFixture,
) -> None:
    """A default async secret with GAQ enabled refuses to start in production."""
    mocker.patch(
        "superset.initialization.feature_flag_manager.is_feature_enabled",
        return_value=True,
    )
    mocker.patch("superset.initialization.is_test", return_value=False)
    initializer = _make_initializer(CHANGE_ME_GLOBAL_ASYNC_QUERIES_JWT_SECRET)

    with pytest.raises(SystemExit):
        initializer.check_async_query_secret()


def test_check_async_query_secret_allows_overridden_secret(
    mocker: MockerFixture,
) -> None:
    """A non-default async secret does not block startup."""
    mocker.patch(
        "superset.initialization.feature_flag_manager.is_feature_enabled",
        return_value=True,
    )
    mocker.patch("superset.initialization.is_test", return_value=False)
    initializer = _make_initializer("a-strong-random-secret-value-1234567890")

    # Should not raise.
    initializer.check_async_query_secret()


def test_check_async_query_secret_skipped_when_gaq_disabled(
    mocker: MockerFixture,
) -> None:
    """The check is a no-op when GLOBAL_ASYNC_QUERIES is disabled."""
    mocker.patch(
        "superset.initialization.feature_flag_manager.is_feature_enabled",
        return_value=False,
    )
    mocker.patch("superset.initialization.is_test", return_value=False)
    initializer = _make_initializer(CHANGE_ME_GLOBAL_ASYNC_QUERIES_JWT_SECRET)

    # Should not raise even with the default secret.
    initializer.check_async_query_secret()


def test_check_async_query_secret_warns_only_in_debug(
    mocker: MockerFixture,
) -> None:
    """In debug the default secret warns but does not exit (matches SECRET_KEY)."""
    mocker.patch(
        "superset.initialization.feature_flag_manager.is_feature_enabled",
        return_value=True,
    )
    mocker.patch("superset.initialization.is_test", return_value=False)
    initializer = _make_initializer(
        CHANGE_ME_GLOBAL_ASYNC_QUERIES_JWT_SECRET, debug=True
    )

    # Should not raise in debug mode.
    initializer.check_async_query_secret()
