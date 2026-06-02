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

from superset.extensions.utils import is_extension_blocked


def _extension(ext_id: str, version: str) -> MagicMock:
    extension = MagicMock()
    extension.manifest.id = ext_id
    extension.manifest.version = version
    return extension


def test_is_extension_blocked() -> None:
    original = current_app.config.get("EXTENSION_BLOCKLIST")
    try:
        # Empty blocklist: nothing is blocked.
        current_app.config["EXTENSION_BLOCKLIST"] = []
        assert is_extension_blocked(_extension("acme.widget", "1.0.0")) is False

        # Block by id: every version of that id is blocked.
        current_app.config["EXTENSION_BLOCKLIST"] = ["acme.widget"]
        assert is_extension_blocked(_extension("acme.widget", "1.0.0")) is True
        assert is_extension_blocked(_extension("acme.widget", "2.0.0")) is True
        assert is_extension_blocked(_extension("acme.other", "1.0.0")) is False

        # Block by id@version: only that exact version is blocked.
        current_app.config["EXTENSION_BLOCKLIST"] = ["acme.widget@1.0.0"]
        assert is_extension_blocked(_extension("acme.widget", "1.0.0")) is True
        assert is_extension_blocked(_extension("acme.widget", "2.0.0")) is False
    finally:
        current_app.config["EXTENSION_BLOCKLIST"] = original
