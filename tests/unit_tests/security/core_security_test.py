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
"""The security checks that superset_core exposes to extensions."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture


def test_extensions_ask_the_security_manager_who_edits(
    mocker: MockerFixture, monkeypatch: pytest.MonkeyPatch
) -> None:
    from superset_core.common import security

    from superset.core.api.core_api_injection import inject_security_implementations

    # Puts back whatever the app injected, once the test ends.
    monkeypatch.setattr(security, "is_editor", security.is_editor)
    manager = mocker.patch("superset.security_manager", new=MagicMock())
    manager.is_editor.side_effect = lambda resource: resource == "mine"
    inject_security_implementations()

    assert security.is_editor("mine") is True
    assert security.is_editor("theirs") is False
    assert [call.args for call in manager.is_editor.call_args_list] == [
        ("mine",),
        ("theirs",),
    ]
