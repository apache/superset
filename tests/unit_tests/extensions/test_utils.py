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

from unittest.mock import MagicMock

from flask import current_app

from superset.extensions.utils import (
    get_extension_rejection_reason,
    is_extension_below_min_version,
    is_extension_denied,
)


def _extension(ext_id: str, version: str) -> MagicMock:
    extension = MagicMock()
    extension.id = ext_id
    extension.version = version
    return extension


def test_is_extension_denied() -> None:
    original = current_app.config.get("EXTENSION_DENYLIST")
    try:
        # Empty denylist: nothing is denied.
        current_app.config["EXTENSION_DENYLIST"] = []
        assert is_extension_denied(_extension("acme.widget", "1.0.0")) is False

        # Deny by id: every version of that id is denied.
        current_app.config["EXTENSION_DENYLIST"] = ["acme.widget"]
        assert is_extension_denied(_extension("acme.widget", "1.0.0")) is True
        assert is_extension_denied(_extension("acme.widget", "2.0.0")) is True
        assert is_extension_denied(_extension("acme.other", "1.0.0")) is False

        # Deny by id@version: only that exact version is denied.
        current_app.config["EXTENSION_DENYLIST"] = ["acme.widget@1.0.0"]
        assert is_extension_denied(_extension("acme.widget", "1.0.0")) is True
        assert is_extension_denied(_extension("acme.widget", "2.0.0")) is False
    finally:
        current_app.config["EXTENSION_DENYLIST"] = original


def test_is_extension_below_min_version() -> None:
    too_old = is_extension_below_min_version
    original = current_app.config.get("EXTENSION_VERSION_POLICY")
    try:
        # No policy: nothing is too old.
        current_app.config["EXTENSION_VERSION_POLICY"] = {}
        assert too_old(_extension("acme.widget", "1.0.0")) is False

        current_app.config["EXTENSION_VERSION_POLICY"] = {"acme.widget": "1.2.0"}
        # PEP 440 comparison, not string compare (1.10.0 > 1.2.0).
        assert too_old(_extension("acme.widget", "1.10.0")) is False
        assert too_old(_extension("acme.widget", "1.1.9")) is True
        # At or above the minimum -> allowed.
        assert too_old(_extension("acme.widget", "1.2.0")) is False
        assert too_old(_extension("acme.widget", "2.0.0")) is False
        # A different id is unaffected by this id's policy.
        assert too_old(_extension("acme.other", "0.1.0")) is False
        # Unparseable version fails closed.
        assert too_old(_extension("acme.widget", "not-a-version")) is True
    finally:
        current_app.config["EXTENSION_VERSION_POLICY"] = original or {}


def test_get_extension_rejection_reason() -> None:
    deny = current_app.config.get("EXTENSION_DENYLIST")
    policy = current_app.config.get("EXTENSION_VERSION_POLICY")
    try:
        current_app.config["EXTENSION_DENYLIST"] = ["acme.bad"]
        current_app.config["EXTENSION_VERSION_POLICY"] = {"acme.widget": "1.2.0"}

        assert get_extension_rejection_reason(_extension("acme.ok", "9.9.9")) is None
        assert "EXTENSION_DENYLIST" in (
            get_extension_rejection_reason(_extension("acme.bad", "1.0.0")) or ""
        )
        assert "EXTENSION_VERSION_POLICY" in (
            get_extension_rejection_reason(_extension("acme.widget", "1.0.0")) or ""
        )
    finally:
        current_app.config["EXTENSION_DENYLIST"] = deny or []
        current_app.config["EXTENSION_VERSION_POLICY"] = policy or {}
