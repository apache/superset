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
"""Tests for config-based permission extension hooks.

Follows the same pattern as EXTRA_DYNAMIC_QUERY_FILTERS tests in
tests/unit_tests/databases/api_test.py.
"""

from unittest.mock import Mock

import pytest

from superset import db


@pytest.fixture
def sample_chart(app_context: None):
    """Create a minimal chart for testing."""
    from superset.models.slice import Slice

    chart = Slice(
        slice_name="test_permission_hooks_chart",
        datasource_type="table",
        viz_type="table",
        params="{}",
    )
    db.session.add(chart)
    db.session.flush()
    yield chart
    db.session.delete(chart)
    db.session.flush()


@pytest.fixture
def sample_user(app_context: None):
    """Create a minimal user for testing."""
    from flask_appbuilder.security.sqla.models import User

    user = User(
        first_name="test",
        last_name="hooks",
        username="test_permission_hooks_user",
        email="test_hooks@example.com",
    )
    db.session.add(user)
    db.session.flush()
    yield user
    db.session.delete(user)
    db.session.flush()


def test_extra_owners_resolver_injects_into_extra_owners(sample_chart, monkeypatch):
    """EXTRA_OWNERS_RESOLVER populates Slice.data['extra_owners'], not 'owners'."""
    from flask import current_app

    original_owner_ids = [o.id for o in sample_chart.owners]

    # Without config — extra_owners is empty, owners unchanged
    monkeypatch.setitem(current_app.config, "EXTRA_OWNERS_RESOLVER", None)
    data = sample_chart.data
    assert data["owners"] == original_owner_ids
    assert data["extra_owners"] == []

    # With config — extra_owners populated, owners unchanged
    def _resolver(resource):
        return [{"id": 99999, "first_name": "Folder", "last_name": "Editor"}]

    resolver_mock = Mock(side_effect=_resolver)
    monkeypatch.setitem(current_app.config, "EXTRA_OWNERS_RESOLVER", resolver_mock)

    data = sample_chart.data
    assert data["owners"] == original_owner_ids
    assert 99999 in data["extra_owners"]
    assert resolver_mock.call_count == 1


def test_extra_owners_resolver_empty_returns_unchanged(sample_chart, monkeypatch):
    """EXTRA_OWNERS_RESOLVER returning empty list leaves extra_owners empty."""
    from flask import current_app

    resolver_mock = Mock(return_value=[])
    monkeypatch.setitem(current_app.config, "EXTRA_OWNERS_RESOLVER", resolver_mock)

    data = sample_chart.data
    original_owner_ids = [o.id for o in sample_chart.owners]
    assert data["owners"] == original_owner_ids
    assert data["extra_owners"] == []
    assert resolver_mock.call_count == 1


def test_raise_for_access_bypass_skips_checks(app_context: None, monkeypatch):
    """EXTRA_RAISE_FOR_ACCESS_BYPASS returning True skips all permission checks."""
    from flask import current_app

    from superset import security_manager

    bypass_mock = Mock(return_value=True)
    monkeypatch.setitem(
        current_app.config, "EXTRA_RAISE_FOR_ACCESS_BYPASS", bypass_mock
    )

    security_manager.raise_for_access(dashboard=None, chart=None)
    assert bypass_mock.call_count == 1


def test_raise_for_access_no_bypass_without_config(app_context: None, monkeypatch):
    """Without EXTRA_RAISE_FOR_ACCESS_BYPASS, normal checks proceed."""
    from flask import current_app

    from superset import security_manager

    monkeypatch.setitem(current_app.config, "EXTRA_RAISE_FOR_ACCESS_BYPASS", None)
    security_manager.raise_for_access(dashboard=None, chart=None)


def test_ownership_check_allows_non_owner(sample_chart, sample_user, monkeypatch):
    """EXTRA_OWNERS_RESOLVER returning the user allows a non-owner to pass."""
    from flask import current_app, g

    from superset import security_manager

    resolver_mock = Mock(return_value=[sample_user])
    monkeypatch.setitem(current_app.config, "EXTRA_OWNERS_RESOLVER", resolver_mock)
    monkeypatch.setattr(g, "user", sample_user, raising=False)

    security_manager.raise_for_ownership(sample_chart)
    resolver_mock.assert_called_once()


def test_owner_auto_add_skipped_with_resolver(
    sample_user, app_context: None, monkeypatch
):
    """When EXTRA_OWNERS_RESOLVER is set, current user is NOT auto-added."""
    from flask import current_app, g
    from flask_appbuilder.security.sqla.models import User

    from superset.commands.utils import populate_owner_list

    other_user = User(
        first_name="other",
        last_name="skip",
        username="test_skip_other",
        email="skip_other@example.com",
    )
    db.session.add(other_user)
    db.session.flush()

    resolver = Mock(return_value=[])
    monkeypatch.setitem(current_app.config, "EXTRA_OWNERS_RESOLVER", resolver)
    monkeypatch.setattr(g, "user", sample_user, raising=False)

    try:
        owners = populate_owner_list([other_user.id], default_to_user=False)
        owner_ids = [o.id for o in owners]
        # Only the explicitly passed owner — current user NOT auto-added
        assert owner_ids == [other_user.id]
        assert sample_user.id not in owner_ids
    finally:
        db.session.delete(other_user)
        db.session.flush()


def test_owner_auto_add_without_resolver(sample_user, app_context: None, monkeypatch):
    """Without EXTRA_OWNERS_RESOLVER, current user IS auto-added."""
    from flask import current_app, g
    from flask_appbuilder.security.sqla.models import User

    from superset.commands.utils import populate_owner_list

    other_user = User(
        first_name="other",
        last_name="user",
        username="test_other_user",
        email="other@example.com",
    )
    db.session.add(other_user)
    db.session.flush()

    monkeypatch.setitem(current_app.config, "EXTRA_OWNERS_RESOLVER", None)
    monkeypatch.setattr(g, "user", sample_user, raising=False)

    try:
        owners = populate_owner_list([other_user.id], default_to_user=False)
        owner_ids = [o.id for o in owners]
        # Both the passed owner AND current user auto-added
        assert sample_user.id in owner_ids
        assert other_user.id in owner_ids
    finally:
        db.session.delete(other_user)
        db.session.flush()
