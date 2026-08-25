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
"""Unit tests for the legacy-encryption-engine startup warning."""

from typing import Any
from unittest.mock import patch

from superset.initialization import SupersetAppInitializer


def _make_initializer(config: dict[str, Any]) -> SupersetAppInitializer:
    """Build a bare initializer with just the attributes the check needs."""
    initializer = SupersetAppInitializer.__new__(SupersetAppInitializer)
    initializer.config = config
    return initializer


def test_warns_when_engine_unset_defaults_to_legacy_aes() -> None:
    """An absent config value resolves to the legacy engine and warns."""
    initializer = _make_initializer({})

    with patch.object(initializer, "_log_config_warning") as log_warning:
        initializer.check_encryption_engine()

    log_warning.assert_called_once()
    message = log_warning.call_args.args[0]
    assert "aes-gcm" in message
    assert "re-encrypt-secrets" in message


def test_warns_when_engine_explicitly_set_to_aes() -> None:
    """An explicit 'aes' value warns the same as the implicit default."""
    initializer = _make_initializer({"SQLALCHEMY_ENCRYPTED_FIELD_ENGINE": "aes"})

    with patch.object(initializer, "_log_config_warning") as log_warning:
        initializer.check_encryption_engine()

    log_warning.assert_called_once()


def test_silent_when_engine_is_gcm() -> None:
    """An operator who has already opted into 'aes-gcm' gets no warning."""
    initializer = _make_initializer({"SQLALCHEMY_ENCRYPTED_FIELD_ENGINE": "aes-gcm"})

    with patch.object(initializer, "_log_config_warning") as log_warning:
        initializer.check_encryption_engine()

    log_warning.assert_not_called()


def test_silent_when_engine_value_is_unrecognized() -> None:
    """An unrecognized value already fails closed at field construction
    (``resolve_encryption_engine``); this check does not pile on a second,
    redundant warning for the same misconfiguration.
    """
    initializer = _make_initializer({"SQLALCHEMY_ENCRYPTED_FIELD_ENGINE": "bogus"})

    with patch.object(initializer, "_log_config_warning") as log_warning:
        initializer.check_encryption_engine()

    log_warning.assert_not_called()


def test_never_raises_system_exit() -> None:
    """Unlike check_secret_key/check_guest_token_secret/check_async_query_secret,
    this check must never refuse to start: the legacy engine is a supported
    configuration, not a known-bad placeholder, so blocking startup on it
    would turn an opt-in hardening step into a forced-migration outage.
    """
    initializer = _make_initializer({})

    with patch.object(initializer, "_log_config_warning"):
        # Should not raise SystemExit.
        initializer.check_encryption_engine()
