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

"""Identity partitioning for the RLS cache key.

The RLS cache key feeds chart/result caching. If two different identities (two
regular users, or a guest presenting different row-level-security rules) map to
the same key, one identity's row-filtered result could be served to another.
These tests pin the invariant: distinct identities produce distinct keys, and a
stable identity produces a stable key (so caching still works). The guest branch
must fold the guest's own rules into the key, and the fix must hold for every
datasource kind — including ``Query`` datasources whose ``is_rls_supported`` is
``False`` but which are still row-filtered on the ad-hoc chart path.
"""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from superset.extensions import appbuilder
from superset.security.manager import SupersetSecurityManager


def _sm() -> SupersetSecurityManager:
    return SupersetSecurityManager(appbuilder)


def _clause(clause: str, group_key: str | None = None) -> Any:
    return SimpleNamespace(clause=clause, group_key=group_key)


def _datasource(rls_supported: bool = True, ds_id: int = 1) -> Any:
    ds = MagicMock()
    ds.is_rls_supported = rls_supported
    ds.id = ds_id
    return ds


@pytest.fixture
def sm(app_context: None) -> SupersetSecurityManager:
    return _sm()


def test_regular_user_key_includes_identity(
    sm: SupersetSecurityManager, mocker: MockerFixture
) -> None:
    """@AC-FR8-01"""
    mocker.patch.object(sm, "get_current_guest_user_if_guest", return_value=None)
    mocker.patch.object(sm, "get_rls_sorted", return_value=[_clause("dept = 1")])
    mocker.patch.object(sm, "get_guest_rls_filters_str", return_value=[])
    mocker.patch(
        "superset.security.manager.get_user_id", return_value=7
    )

    key = sm.get_rls_cache_key(_datasource())

    # The user id partitions the key, so the identity is represented.
    assert any("7" in str(part) for part in key)
    # The clause is still contributed.
    assert any("dept = 1" in str(part) for part in key)


def test_two_regular_users_same_clause_get_distinct_keys(
    sm: SupersetSecurityManager, mocker: MockerFixture
) -> None:
    """@AC-FR8-02"""
    mocker.patch.object(sm, "get_current_guest_user_if_guest", return_value=None)
    # Same clause text for both users — only the identity differs.
    mocker.patch.object(sm, "get_rls_sorted", return_value=[_clause("dept = 1")])
    mocker.patch.object(sm, "get_guest_rls_filters_str", return_value=[])

    ds = _datasource()

    mocker.patch("superset.security.manager.get_user_id", return_value=7)
    key_user_a = sm.get_rls_cache_key(ds)

    mocker.patch("superset.security.manager.get_user_id", return_value=9)
    key_user_b = sm.get_rls_cache_key(ds)

    assert key_user_a != key_user_b


def test_same_regular_user_key_is_stable(
    sm: SupersetSecurityManager, mocker: MockerFixture
) -> None:
    """@AC-FR8-03"""
    mocker.patch.object(sm, "get_current_guest_user_if_guest", return_value=None)
    mocker.patch.object(sm, "get_rls_sorted", return_value=[_clause("dept = 1")])
    mocker.patch.object(sm, "get_guest_rls_filters_str", return_value=[])
    mocker.patch("superset.security.manager.get_user_id", return_value=7)

    ds = _datasource()
    assert sm.get_rls_cache_key(ds) == sm.get_rls_cache_key(ds)


def test_anonymous_and_regular_user_get_distinct_keys(
    sm: SupersetSecurityManager, mocker: MockerFixture
) -> None:
    """@AC-FR8-04"""
    mocker.patch.object(sm, "get_current_guest_user_if_guest", return_value=None)
    mocker.patch.object(sm, "get_rls_sorted", return_value=[])
    mocker.patch.object(sm, "get_guest_rls_filters_str", return_value=[])

    ds = _datasource()

    mocker.patch("superset.security.manager.get_user_id", return_value=None)
    anon_key = sm.get_rls_cache_key(ds)

    mocker.patch("superset.security.manager.get_user_id", return_value=7)
    user_key = sm.get_rls_cache_key(ds)

    assert anon_key != user_key


def test_query_datasource_includes_regular_rls_clauses(
    sm: SupersetSecurityManager, mocker: MockerFixture
) -> None:
    """@AC-FR8-05"""
    # A ``Query`` datasource reports ``is_rls_supported = False`` yet is still
    # row-filtered on the ad-hoc chart path, so its clauses must reach the key.
    mocker.patch.object(sm, "get_current_guest_user_if_guest", return_value=None)
    mocker.patch.object(
        sm, "get_rls_sorted", return_value=[_clause("dept = 1", "dept")]
    )
    mocker.patch.object(sm, "get_guest_rls_filters_str", return_value=[])
    mocker.patch("superset.security.manager.get_user_id", return_value=7)

    key = sm.get_rls_cache_key(_datasource(rls_supported=False))

    assert any("dept = 1" in str(part) for part in key)


def test_guest_with_different_rules_get_distinct_keys(
    sm: SupersetSecurityManager, mocker: MockerFixture
) -> None:
    """@AC-FR8-06"""
    ds = _datasource()

    guest_a = MagicMock()
    guest_a.username = "guest_user"
    guest_a.rls = [{"clause": "tenant_id = 1"}]
    guest_b = MagicMock()
    guest_b.username = "guest_user"
    guest_b.rls = [{"clause": "tenant_id = 2"}]

    mocker.patch.object(sm, "get_rls_sorted", return_value=[])
    mocker.patch("superset.security.manager.get_user_id", return_value=None)

    mocker.patch.object(sm, "get_current_guest_user_if_guest", return_value=guest_a)
    mocker.patch.object(
        sm, "get_guest_rls_filters_str", return_value=["tenant_id = 1"]
    )
    key_a = sm.get_rls_cache_key(ds)

    mocker.patch.object(sm, "get_current_guest_user_if_guest", return_value=guest_b)
    mocker.patch.object(
        sm, "get_guest_rls_filters_str", return_value=["tenant_id = 2"]
    )
    key_b = sm.get_rls_cache_key(ds)

    assert key_a != key_b


def test_same_guest_key_is_stable(
    sm: SupersetSecurityManager, mocker: MockerFixture
) -> None:
    """@AC-FR8-07"""
    ds = _datasource()

    guest = MagicMock()
    guest.username = "guest_user"
    guest.rls = [{"clause": "tenant_id = 1"}]

    mocker.patch.object(sm, "get_rls_sorted", return_value=[])
    mocker.patch("superset.security.manager.get_user_id", return_value=None)
    mocker.patch.object(sm, "get_current_guest_user_if_guest", return_value=guest)
    mocker.patch.object(
        sm, "get_guest_rls_filters_str", return_value=["tenant_id = 1"]
    )

    assert sm.get_rls_cache_key(ds) == sm.get_rls_cache_key(ds)


def test_guest_and_regular_user_get_distinct_keys(
    sm: SupersetSecurityManager, mocker: MockerFixture
) -> None:
    """@AC-FR8-08"""
    ds = _datasource()

    guest = MagicMock()
    guest.username = "guest_user"
    guest.rls = []

    mocker.patch.object(sm, "get_rls_sorted", return_value=[])

    mocker.patch.object(sm, "get_current_guest_user_if_guest", return_value=guest)
    mocker.patch.object(sm, "get_guest_rls_filters_str", return_value=[])
    mocker.patch("superset.security.manager.get_user_id", return_value=None)
    guest_key = sm.get_rls_cache_key(ds)

    mocker.patch.object(sm, "get_current_guest_user_if_guest", return_value=None)
    mocker.patch("superset.security.manager.get_user_id", return_value=1)
    user_key = sm.get_rls_cache_key(ds)

    assert guest_key != user_key
