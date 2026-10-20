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

"""Exception-safety tests for temporary user overrides."""

import pytest
from flask_appbuilder.security.sqla.models import User
from pytest_mock import MockerFixture

from superset.utils.core import override_user


@pytest.mark.parametrize("initial_user", ["absent", "none", "alice"])
@pytest.mark.parametrize("force", [False, True])
def test_override_user_restores_after_exception(
    mocker: MockerFixture, initial_user: str, force: bool
) -> None:
    mock_g = mocker.patch("superset.utils.core.g", spec={})
    alice = User(username="alice")
    bob = User(username="bob")
    if initial_user != "absent":
        mock_g.user = alice if initial_user == "alice" else None

    def fail_query() -> None:
        with override_user(bob, force):
            assert mock_g.user == (
                alice if initial_user == "alice" and not force else bob
            )
            raise RuntimeError("query failed")

    with pytest.raises(RuntimeError, match="query failed"):
        fail_query()

    if initial_user == "absent":
        assert not hasattr(mock_g, "user")
    else:
        assert mock_g.user == (alice if initial_user == "alice" else None)


def test_nested_override_user_restores_outer_identity_after_inner_failure(
    mocker: MockerFixture,
) -> None:
    mock_g = mocker.patch("superset.utils.core.g", spec={})
    alice = User(username="alice")
    bob = User(username="bob")

    def fail_query() -> None:
        with override_user(bob):
            assert mock_g.user == bob
            raise RuntimeError("query failed")

    with override_user(alice):
        with pytest.raises(RuntimeError, match="query failed"):
            fail_query()
        assert mock_g.user == alice

    assert not hasattr(mock_g, "user")
