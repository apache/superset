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
"""Cross-identity cache-isolation for row-level-security-filtered results.

The row-level-security cache key partitions the chart/result cache by *who* is
asking. If two different identities collapsed to the same final cache key, one
identity's row-filtered result could be served to another — a cross-tenant data
leak.

These tests are adversarial. They do not merely assert that
``get_rls_cache_key`` returns unequal lists; they reconstruct the *final* hashed
cache-backend key exactly as the query pipeline does (``hash_from_dict`` over a
cache dict whose ``rls`` slot is fed by ``get_rls_cache_key``) and then drive a
stand-in cache store to prove that a result computed and stored under identity A
is never returned to identity B. Same identity => same key => a genuine cache
hit, so caching still works.
"""

from types import SimpleNamespace
from typing import Any, Optional
from unittest import mock

import pytest
from flask import g

from superset import security_manager
from superset.connectors.sqla.models import SqlaTable
from superset.security.guest_token import GuestUser
from superset.utils.hashing import hash_from_dict
from tests.integration_tests.fixtures.birth_names_dashboard import (
    load_birth_names_dashboard_with_slices,  # noqa: F401
    load_birth_names_data,  # noqa: F401
)

# The RLS fixtures and helpers live alongside the main RLS suite; reuse them so
# the identities and rules under test are the same real objects the product
# resolves at render time.
from tests.integration_tests.security.row_level_security_tests import (  # noqa: F401
    _get_table,
    _get_user,
    _guest_user_with_rls,
    rls_filters,
)


def _cache_key_for_current_identity(datasource: SqlaTable) -> str:
    """Final cache-backend key for the acting identity.

    Mirrors the pipeline: the RLS partition contributed by
    ``get_rls_cache_key`` is folded into the cache dict and the whole dict is
    hashed. A fixed, identity-independent ``query`` slot stands in for the rest
    of the request so that the only thing that can move the key is the identity.
    """
    cache_dict: dict[str, Any] = {
        "datasource": datasource.uid,
        "query": "SELECT * FROM birth_names",
        "rls": security_manager.get_rls_cache_key(datasource),
    }
    return hash_from_dict(cache_dict)


class _CacheStore:
    """Minimal stand-in for the result cache keyed by the final cache key."""

    def __init__(self) -> None:
        self._store: dict[str, Any] = {}
        self.compute_count = 0

    def get_or_compute(self, key: str, rows: Any) -> Any:
        """Return the cached payload for ``key`` or compute+store ``rows``."""
        if key in self._store:
            return self._store[key]
        self.compute_count += 1
        self._store[key] = rows
        return rows


def _as_guest(rules: Optional[list[dict[str, Any]]]) -> GuestUser:
    return _guest_user_with_rls(rules)


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices", "rls_filters")
def test_two_regular_users_do_not_share_cached_rows():
    """@AC-FR8-01"""
    tbl = _get_table(name="birth_names")

    # gamma resolves real RLS clauses; admin resolves none — two distinct
    # identities rendering the very same query.
    g.user = _get_user(username="admin")
    admin_key = _cache_key_for_current_identity(tbl)

    g.user = _get_user(username="gamma")
    gamma_key = _cache_key_for_current_identity(tbl)

    assert admin_key != gamma_key

    # A's filtered rows land in the cache under A's key.
    cache = _CacheStore()
    g.user = _get_user(username="admin")
    admin_rows = cache.get_or_compute(
        _cache_key_for_current_identity(tbl), rows="ADMIN_ROWS"
    )
    assert admin_rows == "ADMIN_ROWS"
    assert cache.compute_count == 1

    # B asks next. B must NOT be served A's rows: a miss forces a recompute
    # under B's own key.
    g.user = _get_user(username="gamma")
    gamma_rows = cache.get_or_compute(
        _cache_key_for_current_identity(tbl), rows="GAMMA_ROWS"
    )
    assert gamma_rows == "GAMMA_ROWS"
    assert cache.compute_count == 2


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices", "rls_filters")
def test_same_regular_user_reuses_cached_rows():
    """@AC-FR8-02"""
    tbl = _get_table(name="birth_names")
    cache = _CacheStore()

    g.user = _get_user(username="gamma")
    first = cache.get_or_compute(
        _cache_key_for_current_identity(tbl), rows="GAMMA_ROWS"
    )
    # Same identity, same query => same key => genuine cache hit, no recompute.
    second = cache.get_or_compute(
        _cache_key_for_current_identity(tbl), rows="SHOULD_NOT_BE_USED"
    )

    assert first == "GAMMA_ROWS"
    assert second == "GAMMA_ROWS"
    assert cache.compute_count == 1


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices", "rls_filters")
def test_guests_with_different_rules_do_not_share_cached_rows():
    """@AC-FR8-03"""
    tbl = _get_table(name="birth_names")
    dataset_id = tbl.id

    rules_x = [{"dataset": dataset_id, "clause": "name = 'Alice'"}]
    rules_y = [{"dataset": dataset_id, "clause": "name = 'Bob'"}]

    g.user = _as_guest(rules_x)
    key_x = _cache_key_for_current_identity(tbl)

    g.user = _as_guest(rules_y)
    key_y = _cache_key_for_current_identity(tbl)

    # The guest's own rules ride on its token; differing rules must key apart.
    assert key_x != key_y

    cache = _CacheStore()
    g.user = _as_guest(rules_x)
    rows_x = cache.get_or_compute(_cache_key_for_current_identity(tbl), rows="X_ROWS")
    assert rows_x == "X_ROWS"

    g.user = _as_guest(rules_y)
    rows_y = cache.get_or_compute(_cache_key_for_current_identity(tbl), rows="Y_ROWS")
    assert rows_y == "Y_ROWS"
    assert cache.compute_count == 2


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices", "rls_filters")
def test_same_guest_rules_reuse_cached_rows():
    """@AC-FR8-04"""
    tbl = _get_table(name="birth_names")
    rules = [{"dataset": tbl.id, "clause": "name = 'Alice'"}]

    cache = _CacheStore()
    g.user = _as_guest(rules)
    first = cache.get_or_compute(_cache_key_for_current_identity(tbl), rows="X_ROWS")
    g.user = _as_guest(rules)
    second = cache.get_or_compute(
        _cache_key_for_current_identity(tbl), rows="SHOULD_NOT_BE_USED"
    )

    assert first == "X_ROWS"
    assert second == "X_ROWS"
    assert cache.compute_count == 1


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices", "rls_filters")
def test_guest_and_regular_user_do_not_share_cached_rows():
    """@AC-FR8-05"""
    tbl = _get_table(name="birth_names")

    g.user = _as_guest([{"dataset": tbl.id, "clause": "name = 'Alice'"}])
    guest_key = _cache_key_for_current_identity(tbl)

    g.user = _get_user(username="gamma")
    user_key = _cache_key_for_current_identity(tbl)

    assert guest_key != user_key

    cache = _CacheStore()
    g.user = _as_guest([{"dataset": tbl.id, "clause": "name = 'Alice'"}])
    guest_rows = cache.get_or_compute(
        _cache_key_for_current_identity(tbl), rows="GUEST_ROWS"
    )
    assert guest_rows == "GUEST_ROWS"

    g.user = _get_user(username="gamma")
    user_rows = cache.get_or_compute(
        _cache_key_for_current_identity(tbl), rows="USER_ROWS"
    )
    assert user_rows == "USER_ROWS"
    assert cache.compute_count == 2


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices", "rls_filters")
def test_two_users_with_identical_clauses_still_do_not_share_cached_rows():
    """@AC-FR8-07

    The sharpest case: two different regular users whose RLS resolves to the
    *same* clause text. Clause content alone cannot tell them apart, so only the
    identity partition can keep one user's rows from being served to the other.
    """
    tbl = _get_table(name="birth_names")

    # Force an identical resolved clause-set for both principals so the clause
    # dimension is held constant and only the acting user id can vary the key.
    same_clauses = [SimpleNamespace(clause="dept = 1", group_key="dept")]

    with (
        mock.patch.object(
            security_manager, "get_current_guest_user_if_guest", return_value=None
        ),
        mock.patch.object(
            security_manager, "get_rls_sorted", return_value=same_clauses
        ),
        mock.patch.object(
            security_manager, "get_guest_rls_filters_str", return_value=[]
        ),
    ):
        with mock.patch(
            "superset.security.manager.get_user_id", return_value=101
        ):
            key_a = _cache_key_for_current_identity(tbl)
        with mock.patch(
            "superset.security.manager.get_user_id", return_value=202
        ):
            key_b = _cache_key_for_current_identity(tbl)

        assert key_a != key_b

        cache = _CacheStore()
        with mock.patch(
            "superset.security.manager.get_user_id", return_value=101
        ):
            rows_a = cache.get_or_compute(
                _cache_key_for_current_identity(tbl), rows="USER_A_ROWS"
            )
        assert rows_a == "USER_A_ROWS"

        with mock.patch(
            "superset.security.manager.get_user_id", return_value=202
        ):
            rows_b = cache.get_or_compute(
                _cache_key_for_current_identity(tbl), rows="USER_B_ROWS"
            )
        # User B must never receive user A's cached rows.
        assert rows_b == "USER_B_ROWS"
        assert cache.compute_count == 2


@pytest.mark.usefixtures("load_birth_names_dashboard_with_slices", "rls_filters")
def test_anonymous_and_regular_user_do_not_share_cached_rows():
    """@AC-FR8-06

    Anonymous (no user id) versus a regular user whose RLS resolves to the same
    empty clause-set. Held constant on the clause dimension, so only the
    identity partition can keep the anonymous result from being served to the
    logged-in user (and vice versa).
    """
    tbl = _get_table(name="birth_names")

    with (
        mock.patch.object(
            security_manager, "get_current_guest_user_if_guest", return_value=None
        ),
        mock.patch.object(security_manager, "get_rls_sorted", return_value=[]),
        mock.patch.object(
            security_manager, "get_guest_rls_filters_str", return_value=[]
        ),
    ):
        with mock.patch(
            "superset.security.manager.get_user_id", return_value=None
        ):
            anon_key = _cache_key_for_current_identity(tbl)
        with mock.patch(
            "superset.security.manager.get_user_id", return_value=303
        ):
            user_key = _cache_key_for_current_identity(tbl)

        assert anon_key != user_key

        cache = _CacheStore()
        with mock.patch(
            "superset.security.manager.get_user_id", return_value=None
        ):
            anon_rows = cache.get_or_compute(
                _cache_key_for_current_identity(tbl), rows="ANON_ROWS"
            )
        assert anon_rows == "ANON_ROWS"

        with mock.patch(
            "superset.security.manager.get_user_id", return_value=303
        ):
            user_rows = cache.get_or_compute(
                _cache_key_for_current_identity(tbl), rows="USER_ROWS"
            )
        assert user_rows == "USER_ROWS"
        assert cache.compute_count == 2
