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
from flask import current_app

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


def test_extra_owners_resolver_injects_ids(sample_chart):
    """EXTRA_OWNERS_RESOLVER injects extra owner IDs into Slice.data['owners']."""
    original_owner_ids = [o.id for o in sample_chart.owners]

    # Without config — only real owners
    original_config = current_app.config.get("EXTRA_OWNERS_RESOLVER")
    current_app.config["EXTRA_OWNERS_RESOLVER"] = None
    try:
        data = sample_chart.data
        assert data["owners"] == original_owner_ids
    finally:
        current_app.config["EXTRA_OWNERS_RESOLVER"] = original_config

    # With config — extra owner injected
    def _resolver(resource):
        return [{"id": 99999, "first_name": "Folder", "last_name": "Editor"}]

    resolver_mock = Mock(side_effect=_resolver)

    original_config = current_app.config.get("EXTRA_OWNERS_RESOLVER")
    current_app.config["EXTRA_OWNERS_RESOLVER"] = resolver_mock
    try:
        data = sample_chart.data
        assert 99999 in data["owners"]
        assert resolver_mock.call_count == 1
    finally:
        current_app.config["EXTRA_OWNERS_RESOLVER"] = original_config


def test_extra_owners_resolver_empty_returns_unchanged(sample_chart):
    """EXTRA_OWNERS_RESOLVER returning empty list leaves owners unchanged."""
    resolver_mock = Mock(return_value=[])

    original_config = current_app.config.get("EXTRA_OWNERS_RESOLVER")
    current_app.config["EXTRA_OWNERS_RESOLVER"] = resolver_mock
    try:
        data = sample_chart.data
        original_owner_ids = [o.id for o in sample_chart.owners]
        assert data["owners"] == original_owner_ids
        assert resolver_mock.call_count == 1
    finally:
        current_app.config["EXTRA_OWNERS_RESOLVER"] = original_config


def test_raise_for_access_bypass_skips_checks(app_context: None):
    """EXTRA_RAISE_FOR_ACCESS_BYPASS returning True skips all permission checks."""
    from superset import security_manager

    bypass_mock = Mock(return_value=True)

    original_config = current_app.config.get("EXTRA_RAISE_FOR_ACCESS_BYPASS")
    current_app.config["EXTRA_RAISE_FOR_ACCESS_BYPASS"] = bypass_mock
    try:
        security_manager.raise_for_access(dashboard=None, chart=None)
        assert bypass_mock.call_count == 1
    finally:
        current_app.config["EXTRA_RAISE_FOR_ACCESS_BYPASS"] = original_config


def test_raise_for_access_no_bypass_without_config(app_context: None):
    """Without EXTRA_RAISE_FOR_ACCESS_BYPASS, normal checks proceed."""
    from superset import security_manager

    original_config = current_app.config.get("EXTRA_RAISE_FOR_ACCESS_BYPASS")
    current_app.config["EXTRA_RAISE_FOR_ACCESS_BYPASS"] = None
    try:
        security_manager.raise_for_access(dashboard=None, chart=None)
    finally:
        current_app.config["EXTRA_RAISE_FOR_ACCESS_BYPASS"] = original_config


def test_ownership_check_allows_non_owner(sample_chart, sample_user):
    """EXTRA_OWNERSHIP_CHECKS returning True allows a non-owner to pass."""
    from flask import g

    from superset import security_manager

    check_mock = Mock(return_value=True)

    original_config = current_app.config.get("EXTRA_OWNERSHIP_CHECKS")
    current_app.config["EXTRA_OWNERSHIP_CHECKS"] = check_mock
    try:
        g.user = sample_user
        security_manager.raise_for_ownership(sample_chart)
        check_mock.assert_called_once()
    finally:
        current_app.config["EXTRA_OWNERSHIP_CHECKS"] = original_config


def test_owner_auto_add_skip_prevents_auto_add(sample_user, app_context: None):
    """EXTRA_OWNER_AUTO_ADD_SKIP returning True prevents auto-adding current user."""
    from flask import g
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

    skip_mock = Mock(return_value=True)

    original_config = current_app.config.get("EXTRA_OWNER_AUTO_ADD_SKIP")
    current_app.config["EXTRA_OWNER_AUTO_ADD_SKIP"] = skip_mock
    try:
        g.user = sample_user
        owners = populate_owner_list([other_user.id], default_to_user=False)
        assert len(owners) == 1
        assert owners[0].id == other_user.id
        skip_mock.assert_called_once()
    finally:
        current_app.config["EXTRA_OWNER_AUTO_ADD_SKIP"] = original_config
        db.session.delete(other_user)
        db.session.flush()


def test_owner_auto_add_without_skip(sample_user, app_context: None):
    """Without EXTRA_OWNER_AUTO_ADD_SKIP, current user is auto-added."""
    from flask import g
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

    original_config = current_app.config.get("EXTRA_OWNER_AUTO_ADD_SKIP")
    current_app.config["EXTRA_OWNER_AUTO_ADD_SKIP"] = None
    try:
        g.user = sample_user
        owners = populate_owner_list([other_user.id], default_to_user=False)
        owner_ids = [o.id for o in owners]
        assert sample_user.id in owner_ids
        assert other_user.id in owner_ids
    finally:
        current_app.config["EXTRA_OWNER_AUTO_ADD_SKIP"] = original_config
        db.session.delete(other_user)
        db.session.flush()
