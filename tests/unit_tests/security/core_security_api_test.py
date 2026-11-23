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
"""Extensions ask the host whether the current user may read a dataset."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.exceptions import SupersetSecurityException


def test_extensions_get_the_hosts_own_dataset_access_decision(
    mocker: MockerFixture, monkeypatch: pytest.MonkeyPatch
) -> None:
    import superset_core.security as core_security

    from superset.core.api.core_api_injection import inject_security_implementations

    # Puts back whatever the app injected, once the test ends.
    monkeypatch.setattr(
        core_security, "can_access_datasource", core_security.can_access_datasource
    )
    inject_security_implementations()
    dataset = MagicMock()
    # The decision raise_for_access makes for the dataset, as chart data does.
    decide = mocker.patch(
        "superset.security_manager.raise_for_access",
        side_effect=[None, SupersetSecurityException(MagicMock())],
    )

    assert core_security.can_access_datasource(dataset) is True
    assert core_security.can_access_datasource(dataset) is False
    assert [call.kwargs for call in decide.call_args_list] == [
        {"datasource": dataset},
        {"datasource": dataset},
    ]
