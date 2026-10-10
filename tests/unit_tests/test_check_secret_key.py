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
"""Tests for SupersetAppInitializer.check_secret_key."""

from typing import Optional
from unittest.mock import MagicMock, patch

import pytest

from superset.constants import CHANGE_ME_SECRET_KEY
from superset.initialization import SupersetAppInitializer


def _make_initializer(
    secret_key: Optional[str],
    *,
    debug: bool = False,
    testing: bool = False,
) -> SupersetAppInitializer:
    """Build a bare initializer with just the attributes check_secret_key needs."""
    init = object.__new__(SupersetAppInitializer)
    init.config = {"SECRET_KEY": secret_key}
    app = MagicMock()
    app.debug = debug
    app.config = {"TESTING": testing}
    init.superset_app = app
    return init


@pytest.mark.parametrize("secret_key", ["", None, CHANGE_ME_SECRET_KEY])
def test_check_secret_key_refuses_to_start_when_insecure(
    secret_key: Optional[str],
) -> None:
    """An empty/missing or placeholder key fails closed in non-debug mode."""
    initializer = _make_initializer(secret_key)
    with patch("superset.initialization.is_test", return_value=False):
        with pytest.raises(SystemExit):
            initializer.check_secret_key()


@pytest.mark.parametrize("secret_key", ["", None, CHANGE_ME_SECRET_KEY])
def test_check_secret_key_warns_but_starts_in_debug(
    secret_key: Optional[str],
) -> None:
    """In debug/testing mode an insecure key warns but does not exit."""
    initializer = _make_initializer(secret_key, debug=True)
    with patch("superset.initialization.is_test", return_value=False):
        # Should not raise SystemExit.
        initializer.check_secret_key()


def test_check_secret_key_accepts_strong_key() -> None:
    """A non-empty, non-placeholder key starts without warning or exit."""
    initializer = _make_initializer("a-strong-random-secret-key")
    with (
        patch("superset.initialization.is_test", return_value=False),
        patch.object(initializer, "_log_config_warning") as log_warning,
    ):
        initializer.check_secret_key()
    log_warning.assert_not_called()
