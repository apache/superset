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

from unittest.mock import MagicMock, patch

import pytest

from superset.security.password_change import (
    _is_exempt_endpoint,
    password_change_required,
)


@pytest.mark.parametrize(
    "endpoint,expected",
    [
        (None, True),  # static file serving etc.
        ("ResetMyPasswordView.this_form_get", True),
        ("AuthDBView.login", True),
        ("AuthDBView.logout", True),
        ("appbuilder.static", True),
        ("UserInfoEditView.this_form_post", True),
        ("SupersetIndexView.index", False),
        ("Superset.dashboard", False),
    ],
)
def test_is_exempt_endpoint(endpoint, expected) -> None:
    # The password-reset / auth / static endpoints must stay reachable to avoid
    # a redirect loop while a change is pending.
    assert _is_exempt_endpoint(endpoint) is expected


def test_password_change_required() -> None:
    user = MagicMock()
    user.id = 5

    with patch(
        "superset.security.password_change._get_user_attribute"
    ) as mock_get_attr:
        mock_get_attr.return_value = MagicMock(password_must_change=True)
        assert password_change_required(user) is True

        mock_get_attr.return_value = MagicMock(password_must_change=False)
        assert password_change_required(user) is False

        mock_get_attr.return_value = None
        assert password_change_required(user) is False


def test_password_change_required_no_user_id() -> None:
    user = MagicMock()
    user.id = None
    assert password_change_required(user) is False
