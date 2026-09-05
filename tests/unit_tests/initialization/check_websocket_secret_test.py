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
"""Tests for SupersetAppInitializer.check_websocket_secret."""

from unittest.mock import MagicMock, patch

import pytest

from superset.constants import CHANGE_ME_WEBSOCKET_JWT_SECRET
from superset.initialization import SupersetAppInitializer

STRONG = "a" * 40


def _make_initializer(
    *, enabled: bool, secret: str | None, debug: bool = False, testing: bool = False
) -> SupersetAppInitializer:
    init = object.__new__(SupersetAppInitializer)
    init.config = {"WEBSOCKET_ENABLE": enabled, "WEBSOCKET_JWT_SECRET": secret}
    app = MagicMock()
    app.debug = debug
    app.config = {"TESTING": testing}
    init.superset_app = app
    return init


@pytest.mark.parametrize("secret", [CHANGE_ME_WEBSOCKET_JWT_SECRET, "short", "", None])
def test_refuses_to_start_when_enabled_and_insecure(secret) -> None:
    initializer = _make_initializer(enabled=True, secret=secret)
    with patch("superset.initialization.is_test", return_value=False):
        with pytest.raises(SystemExit):
            initializer.check_websocket_secret()


def test_disabled_ignores_insecure_secret() -> None:
    initializer = _make_initializer(
        enabled=False, secret=CHANGE_ME_WEBSOCKET_JWT_SECRET
    )
    with patch("superset.initialization.is_test", return_value=False):
        initializer.check_websocket_secret()  # no raise


def test_strong_secret_starts() -> None:
    initializer = _make_initializer(enabled=True, secret=STRONG)
    with patch("superset.initialization.is_test", return_value=False):
        initializer.check_websocket_secret()  # no raise


def test_insecure_warns_but_starts_in_debug() -> None:
    initializer = _make_initializer(
        enabled=True, secret=CHANGE_ME_WEBSOCKET_JWT_SECRET, debug=True
    )
    with patch("superset.initialization.is_test", return_value=False):
        initializer.check_websocket_secret()  # no raise
