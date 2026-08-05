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
"""Unit tests for the current-user (``/api/v1/me/``) response schema."""

from types import SimpleNamespace

from superset.views.users.schemas import UserResponseSchema


def _user(**overrides):
    """Build a stand-in for a FAB ``User`` row."""
    attrs = {
        "id": 1,
        "username": "alice",
        "email": "alice@example.com",
        "first_name": "Alice",
        "last_name": "Doe",
        "is_active": True,
        "is_anonymous": False,
        "login_count": 3,
        "groups": [],
    }
    attrs.update(overrides)
    return SimpleNamespace(**attrs)


def test_user_response_includes_the_callers_groups():
    groups = [SimpleNamespace(id=7, name="tenant-a")]

    result = UserResponseSchema().dump(_user(groups=groups))

    assert result["groups"] == [{"id": 7, "name": "tenant-a"}]


def test_user_response_groups_is_empty_list_when_user_has_no_groups():
    result = UserResponseSchema().dump(_user(groups=[]))

    assert result["groups"] == []
