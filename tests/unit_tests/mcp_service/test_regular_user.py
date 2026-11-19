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

"""Regular-user test principals stay regular when embedding is enabled."""

from unittest.mock import Mock

import pytest

from superset import is_feature_enabled
from superset.security.manager import SupersetSecurityManager
from tests.unit_tests.mcp_service.conftest import regular_user


@pytest.mark.parametrize("embedded_enabled", [False, True])
def test_regular_user_does_not_enter_guest_authorization(
    embedded_enabled: bool, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "superset.is_feature_enabled",
        lambda flag: embedded_enabled
        if flag == "EMBEDDED_SUPERSET"
        else is_feature_enabled(flag),
    )
    user = regular_user(id=7, username="author")

    assert SupersetSecurityManager.is_guest_user(user) is False
    assert user.is_authenticated is True
    assert user.is_anonymous is False
    # A typo must not silently create another truthy identity attribute.
    with pytest.raises(AttributeError):
        _ = user.is_guets_user


def test_regular_users_do_not_share_role_or_group_lists() -> None:
    first = regular_user(id=1)
    second = regular_user(id=2)
    first.roles.append(Mock())
    first.groups.append(Mock())

    assert second.roles == []
    assert second.groups == []


@pytest.mark.parametrize("guest_identity", [True, Mock()])
def test_regular_user_rejects_guest_identity(guest_identity: object) -> None:
    with pytest.raises(ValueError, match="cannot represent a guest"):
        regular_user(is_guest_user=guest_identity)
