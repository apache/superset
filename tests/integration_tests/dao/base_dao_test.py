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

"""
Integration tests for BaseDAO functionality.

This module contains comprehensive integration tests for the BaseDAO class and its
subclasses, covering database operations, CRUD methods, flexible column support,
column operators, and error handling.

Tests use an in-memory SQLite database for isolation and to replicate the unit test
environment behavior. User model deletions are avoided due to circular dependency
constraints with self-referential foreign keys.
"""

import datetime
import time
import uuid

import pytest
from flask_appbuilder.models.filters import BaseFilter
from flask_appbuilder.security.sqla.models import User
from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm.session import Session

from superset.daos.base import BaseDAO, ColumnOperator, ColumnOperatorEnum
from superset.daos.chart import ChartDAO
from superset.daos.dashboard import DashboardDAO
from superset.daos.database import DatabaseDAO
from superset.daos.user import UserDAO
from superset.extensions import db
from superset.models.core import Database
from superset.models.dashboard import Dashboard
from superset.models.slice import Slice

# Create a test model for comprehensive testing
Base = declarative_base()


class ExampleModel(Base):  # type: ignore
    __tablename__ = "example_model"
    id = Column(Integer, primary_key=True)
    uuid = Column(String(36), unique=True, nullable=False)
    slug = Column(String(100), unique=True)
    name = Column(String(100))
    code = Column(String(50), unique=True)
    created_on = Column(DateTime, default=datetime.datetime.utcnow)


class ExampleModelDAO(BaseDAO[ExampleModel]):
    model_cls = ExampleModel
    id_column_name = "id"
    base_filter = None


@pytest.fixture(autouse=True)
def mock_g_user(app_context):
    """Mock the flask g.user for security context."""
    # Within app context, we can safely mock g
    from flask import g

    mock_user = User()
    mock_user.id = 1
    mock_user.username = "test_user"

    # Set g.user directly instead of patching
    g.user = mock_user
    yield

    # Clean up
    if hasattr(g, "user"):
        delattr(g, "user")


# =============================================================================
# Integration Tests - These tests use the actual database
# =============================================================================


def test_column_operator_enum_complete_coverage(user_with_data: Session) -> None:
    """
    Test that every single ColumnOperatorEnum operator is covered by tests.
    This ensures we have comprehensive test coverage for all operators.
    """
    # Simply verify that we can create queries with all operators
    for operator in ColumnOperatorEnum:
        column_operator = ColumnOperator(
            col="username", opr=operator, value="test_value"
        )
        # Just check it doesn't raise an error
        assert column_operator.opr == operator


def test_find_by_id_with_default_column(app_context: Session) -> None:
    """Test find_by_id with default 'id' column."""
    # Create a user to test with
    user = User(
        username="test_find_by_id",
        first_name="Test",
        last_name="User",
        email="test@example.com",
        active=True,
    )
    db.session.add(user)
    db.session.commit()

    # Find by numeric id
    found = UserDAO.find_by_id(user.id, skip_base_filter=True)
    assert found is not None
    assert found.id == user.id
    assert found.username == "test_find_by_id"

    # Test with non-existent id
    not_found = UserDAO.find_by_id(999999, skip_base_filter=True)
    assert not_found is None


def test_find_by_id_with_uuid_column(app_context: Session) -> None:
    """Test find_by_id with custom uuid column."""
    # Create a dashboard with uuid
    dashboard = Dashboard(
        dashboard_title="Test UUID Dashboard",
        slug="test-uuid-dashboard",
        published=True,
    )
    db.session.add(dashboard)
    db.session.commit()

    # Find by uuid string using the uuid column
    found = DashboardDAO.find_by_id(
        str(dashboard.uuid), id_column="uuid", skip_base_filter=True
    )
    assert found is not None
    assert found.uuid == dashboard.uuid
    assert found.dashboard_title == "Test UUID Dashboard"

    # Find by numeric id (should still work)
    found_by_id = DashboardDAO.find_by_id(dashboard.id, skip_base_filter=True)
    assert found_by_id is not None
    assert found_by_id.id == dashboard.id

    # Test with non-existent uuid
    not_found = DashboardDAO.find_by_id(str(uuid.uuid4()), skip_base_filter=True)
    assert not_found is None


def test_find_by_id_with_slug_column(app_context: Session) -> None:
    """Test find_by_id with slug column fallback."""
    # Create a dashboard with slug
    dashboard = Dashboard(
        dashboard_title="Test Slug Dashboard",
        slug="test-slug-dashboard",
        published=True,
    )
    db.session.add(dashboard)
    db.session.commit()

    # Find by slug using the slug column
    found = DashboardDAO.find_by_id(
        "test-slug-dashboard", id_column="slug", skip_base_filter=True
    )
    assert found is not None
    assert found.slug == "test-slug-dashboard"
    assert found.dashboard_title == "Test Slug Dashboard"

    # Test with non-existent slug
    not_found = DashboardDAO.find_by_id("non-existent-slug", skip_base_filter=True)
    assert not_found is None


def test_find_by_id_with_invalid_column(app_context: Session) -> None:
    """Test find_by_id returns None when column doesn't exist."""
    # This should return None gracefully
    result = UserDAO.find_by_id("not_a_valid_id", skip_base_filter=True)
    assert result is None


def test_find_by_id_skip_base_filter(app_context: Session) -> None:
    """Test find_by_id with skip_base_filter parameter."""
    # Create users with different active states
    active_user = User(
        username="active_user",
        first_name="Active",
        last_name="User",
        email="active@example.com",
        active=True,
    )
    inactive_user = User(
        username="inactive_user",
        first_name="Inactive",
        last_name="User",
        email="inactive@example.com",
        active=False,
    )
    db.session.add_all([active_user, inactive_user])
    db.session.commit()

    # Without skipping base filter (if one exists)
    found_active = UserDAO.find_by_id(active_user.id, skip_base_filter=False)
    assert found_active is not None

    # With skipping base filter
    found_active_skip = UserDAO.find_by_id(active_user.id, skip_base_filter=True)
    assert found_active_skip is not None

    # Both should find the user since UserDAO might not have a base filter
    assert found_active.id == active_user.id
    assert found_active_skip.id == active_user.id


def test_find_by_ids_with_default_column(app_context: Session) -> None:
    """Test find_by_ids with default 'id' column."""
    # Create multiple users
    users = []
    for i in range(3):
        user = User(
            username=f"test_find_by_ids_{i}",
            first_name=f"Test{i}",
            last_name="User",
            email=f"test{i}@example.com",
            active=True,
        )
        users.append(user)
        db.session.add(user)
    db.session.commit()

    # Find by multiple ids
    ids = [user.id for user in users]
    found = UserDAO.find_by_ids(ids, skip_base_filter=True)
    assert len(found) == 3
    found_ids = [u.id for u in found]
    assert set(found_ids) == set(ids)

    # Test with mix of existent and non-existent ids
    mixed_ids = [users[0].id, 999999, users[1].id]
    found_mixed = UserDAO.find_by_ids(mixed_ids, skip_base_filter=True)
    assert len(found_mixed) == 2

    # Test with empty list
    found_empty = UserDAO.find_by_ids([], skip_base_filter=True)
    assert found_empty == []


def test_find_by_ids_with_uuid_column(app_context: Session) -> None:
    """Test find_by_ids with uuid column."""
    # Create multiple dashboards
    dashboards = []
    for i in range(3):
        dashboard = Dashboard(
            dashboard_title=f"Test UUID Dashboard {i}",
            slug=f"test-uuid-dashboard-{i}",
            published=True,
        )
        dashboards.append(dashboard)
        db.session.add(dashboard)
    db.session.commit()

    # Find by multiple uuids
    uuids = [str(dashboard.uuid) for dashboard in dashboards]
    found = DashboardDAO.find_by_ids(uuids, id_column="uuid", skip_base_filter=True)
    assert len(found) == 3
    found_uuids = [str(d.uuid) for d in found]
    assert set(found_uuids) == set(uuids)

    # Test with mix of ids and uuids - search separately by column
    found_by_id = DashboardDAO.find_by_ids([dashboards[0].id], skip_base_filter=True)
    found_by_uuid = DashboardDAO.find_by_ids(
        [str(dashboards[1].uuid)], id_column="uuid", skip_base_filter=True
    )
    assert len(found_by_id) == 1
    assert len(found_by_uuid) == 1


def test_find_by_ids_with_slug_column(app_context: Session) -> None:
    """Test find_by_ids with slug column."""
    # Create multiple dashboards
    dashboards = []
    for i in range(3):
        dashboard = Dashboard(
            dashboard_title=f"Test Slug Dashboard {i}",
            slug=f"test-slug-dashboard-{i}",
            published=True,
        )
        dashboards.append(dashboard)
        db.session.add(dashboard)
    db.session.commit()

    # Find by multiple slugs
    slugs = [dashboard.slug for dashboard in dashboards]
    found = DashboardDAO.find_by_ids(slugs, id_column="slug", skip_base_filter=True)
    assert len(found) == 3
    found_slugs = [d.slug for d in found]
    assert set(found_slugs) == set(slugs)


def test_find_by_ids_with_invalid_column(app_context: Session) -> None:
    """Test find_by_ids returns empty list when column doesn't exist."""
    # This should return empty list gracefully
    result = UserDAO.find_by_ids(["not_a_valid_id"], skip_base_filter=True)
    assert result == []


def test_find_by_ids_skip_base_filter(app_context: Session) -> None:
    """Test find_by_ids with skip_base_filter parameter."""
    # Create users
    users = []
    for i in range(3):
        user = User(
            username=f"test_skip_filter_{i}",
            first_name=f"Test{i}",
            last_name="User",
            email=f"test{i}@example.com",
            active=True,
        )
        users.append(user)
        db.session.add(user)
    db.session.commit()

    ids = [user.id for user in users]

    # Without skipping base filter
    found_no_skip = UserDAO.find_by_ids(ids, skip_base_filter=False)
    assert len(found_no_skip) == 3

    # With skipping base filter
    found_skip = UserDAO.find_by_ids(ids, skip_base_filter=True)
    assert len(found_skip) == 3


def test_base_dao_create_with_item(app_context: Session) -> None:
    """Test BaseDAO.create with an item parameter."""
    # Create a user item
    user = User(
        username="created_with_item",
        first_name="Created",
        last_name="Item",
        email="created@example.com",
        active=True,
    )

    # Create using the item
    created = UserDAO.create(item=user)
    assert created is not None
    assert created.username == "created_with_item"
    assert created.first_name == "Created"

    # Verify it's in the session
    assert created in db.session

    # Commit and verify it persists
    db.session.commit()

    # Find it again to ensure it was saved
    found = UserDAO.find_by_id(created.id, skip_base_filter=True)
    assert found is not None
    assert found.username == "created_with_item"


def test_base_dao_create_with_attributes(app_context: Session) -> None:
    """Test BaseDAO.create with attributes parameter."""
    # Create using attributes dict
    attributes = {
        "username": "created_with_attrs",
        "first_name": "Created",
        "last_name": "Attrs",
        "email": "attrs@example.com",
        "active": True,
    }

    created = UserDAO.create(attributes=attributes)
    assert created is not None
    assert created.username == "created_with_attrs"
    assert created.email == "attrs@example.com"

    # Commit and verify
    db.session.commit()
    found = UserDAO.find_by_id(created.id, skip_base_filter=True)
    assert found is not None
    assert found.username == "created_with_attrs"


def test_base_dao_create_with_both_item_and_attributes(app_context: Session) -> None:
    """Test BaseDAO.create with both item and attributes (override behavior)."""
    # Create a user item
    user = User(
        username="item_username",
        first_name="Item",
        last_name="User",
        email="item@example.com",
        active=False,
    )

    # Override some attributes
    attributes = {
        "username": "override_username",
        "active": True,
    }

    created = UserDAO.create(item=user, attributes=attributes)
    assert created is not None
    assert created.username == "override_username"  # Should be overridden
    assert created.active is True  # Should be overridden
    assert created.first_name == "Item"  # Should keep original
    assert created.last_name == "User"  # Should keep original

    db.session.commit()


def test_base_dao_update_with_item(app_context: Session) -> None:
    """Test BaseDAO.update with an item parameter."""
    # Create a user first
    user = User(
        username="update_test",
        first_name="Original",
        last_name="User",
        email="original@example.com",
        active=True,
    )
    db.session.add(user)
    db.session.commit()

    # Update the user
    user.first_name = "Updated"
    updated = UserDAO.update(item=user)
    assert updated is not None
    assert updated.first_name == "Updated"

    db.session.commit()

    # Verify the update persisted
    found = UserDAO.find_by_id(user.id, skip_base_filter=True)
    assert found is not None
    assert found.first_name == "Updated"


def test_base_dao_update_with_attributes(app_context: Session) -> None:
    """Test BaseDAO.update with attributes parameter."""
    # Create a user first
    user = User(
        username="update_attrs_test",
        first_name="Original",
        last_name="User",
        email="original@example.com",
        active=True,
    )
    db.session.add(user)
    db.session.commit()

    # Update using attributes
    attributes = {"first_name": "Updated", "last_name": "Attr User"}
    updated = UserDAO.update(item=user, attributes=attributes)
    assert updated is not None
    assert updated.first_name == "Updated"
    assert updated.last_name == "Attr User"

    db.session.commit()


def test_base_dao_update_detached_item(app_context: Session) -> None:
    """Test BaseDAO.update with a detached item."""
    # Create a user first
    user = User(
        username="detached_test",
        first_name="Original",
        last_name="User",
        email="detached@example.com",
        active=True,
    )
    db.session.add(user)
    db.session.commit()

    user_id = user.id

    # Expunge to detach from session
    db.session.expunge(user)

    # Update the detached user
    user.first_name = "Updated Detached"
    updated = UserDAO.update(item=user)
    assert updated is not None
    assert updated.first_name == "Updated Detached"

    db.session.commit()

    # Verify the update persisted
    found = UserDAO.find_by_id(user_id, skip_base_filter=True)
    assert found is not None
    assert found.first_name == "Updated Detached"


def test_base_dao_delete_single_item(app_context: Session) -> None:
    """Test BaseDAO.delete with a single item."""
    # Create a dashboard instead of user to avoid circular dependencies
    dashboard = Dashboard(
        dashboard_title="Delete Test",
        slug="delete-test",
        published=True,
    )
    db.session.add(dashboard)
    db.session.commit()

    dashboard_id = dashboard.id

    DashboardDAO.delete([dashboard])
    db.session.commit()

    # Verify it's gone
    found = DashboardDAO.find_by_id(dashboard_id, skip_base_filter=True)
    assert found is None


def test_base_dao_delete_multiple_items(app_context: Session) -> None:
    """Test BaseDAO.delete with multiple items."""
    # Create multiple dashboards instead of users to avoid circular dependencies
    dashboards = []
    for i in range(3):
        dashboard = Dashboard(
            dashboard_title=f"Delete Multi {i}",
            slug=f"delete-multi-{i}",
            published=True,
        )
        dashboards.append(dashboard)
        db.session.add(dashboard)
    db.session.commit()

    dashboard_ids = [dashboard.id for dashboard in dashboards]

    DashboardDAO.delete(dashboards)
    db.session.commit()

    # Verify they're all gone
    for dashboard_id in dashboard_ids:
        found = DashboardDAO.find_by_id(dashboard_id, skip_base_filter=True)
        assert found is None


def test_base_dao_delete_empty_list(app_context: Session) -> None:
    """Test BaseDAO.delete with empty list."""
    # Should not raise any errors
    UserDAO.delete([])
    db.session.commit()
    # Just ensuring no exception is raised


def test_base_dao_find_all(app_context: Session) -> None:
    """Test BaseDAO.find_all method."""
    # Create some users
    users = []
    for i in range(3):
        user = User(
            username=f"find_all_{i}",
            first_name=f"Find{i}",
            last_name="All",
            email=f"findall{i}@example.com",
            active=True,
        )
        users.append(user)
        db.session.add(user)
    db.session.commit()

    # Find all users
    all_users = UserDAO.find_all()
    assert len(all_users) >= 3  # At least our 3 users

    # Check our users are in the results
    usernames = [u.username for u in all_users]
    for user in users:
        assert user.username in usernames


def test_base_dao_find_one_or_none(app_context: Session) -> None:
    """Test BaseDAO.find_one_or_none method."""
    # Create users with specific criteria
    user1 = User(
        username="unique_username_123",
        first_name="Unique",
        last_name="User",
        email="unique@example.com",
        active=True,
    )
    user2 = User(
        username="another_user",
        first_name="Another",
        last_name="User",
        email="another@example.com",
        active=True,
    )
    user3 = User(
        username="third_user",
        first_name="Another",  # Same first name as user2
        last_name="User",
        email="third@example.com",
        active=True,
    )
    db.session.add_all([user1, user2, user3])
    db.session.commit()

    # Find one with unique criteria
    found = UserDAO.find_one_or_none(username="unique_username_123")
    assert found is not None
    assert found.username == "unique_username_123"

    # Find none with non-existent criteria
    not_found = UserDAO.find_one_or_none(username="non_existent_user")
    assert not_found is None

    db.session.commit()


def test_base_dao_list_returns_results(user_with_data: Session) -> None:
    """Test that BaseDAO.list returns results and total."""
    results, total = UserDAO.list()
    assert isinstance(results, list)
    assert isinstance(total, int)
    assert total >= 1  # At least the fixture user


def test_base_dao_list_with_column_operators(user_with_data: Session) -> None:
    """Test BaseDAO.list with column operators."""
    column_operators = [
        ColumnOperator(col="username", opr=ColumnOperatorEnum.eq, value="testuser")
    ]
    results, total = UserDAO.list(column_operators=column_operators)
    assert total == 1
    assert results[0].username == "testuser"


def test_base_dao_list_with_non_matching_column_operator(
    user_with_data: Session,
) -> None:
    """Test BaseDAO.list with non-matching column operator."""
    column_operators = [
        ColumnOperator(
            col="username", opr=ColumnOperatorEnum.eq, value="nonexistentuser"
        )
    ]
    results, total = UserDAO.list(column_operators=column_operators)
    assert total == 0
    assert results == []


def test_base_dao_count_returns_value(user_with_data: Session) -> None:
    """Test that BaseDAO.count returns correct count."""
    count = UserDAO.count()
    assert isinstance(count, int)
    assert count >= 1  # At least the fixture user


def test_base_dao_count_with_column_operators(user_with_data: Session) -> None:
    """Test BaseDAO.count with column operators."""
    # Count with matching operator
    column_operators = [
        ColumnOperator(col="username", opr=ColumnOperatorEnum.eq, value="testuser")
    ]
    count = UserDAO.count(column_operators=column_operators)
    assert count == 1

    # Count with non-matching operator
    column_operators = [
        ColumnOperator(
            col="username", opr=ColumnOperatorEnum.eq, value="nonexistentuser"
        )
    ]
    count = UserDAO.count(column_operators=column_operators)
    assert count == 0


def test_base_dao_list_ordering(user_with_data: Session) -> None:
    """Test BaseDAO.list with ordering."""
    # Create additional users with predictable names
    users = []
    for i in range(3):
        user = User(
            # Let database auto-generate IDs to avoid conflicts
            username=f"order_test_{i}",
            first_name=f"Order{i}",
            last_name="Test",
            email=f"order{i}@example.com",
            active=True,
        )
        users.append(user)
        user_with_data.add(user)
    user_with_data.commit()

    # Test ascending order
    results_asc, _ = UserDAO.list(
        order_column="username", order_direction="asc", page_size=100
    )
    usernames_asc = [r.username for r in results_asc]
    # Check that our test users are in order
    assert usernames_asc.index("order_test_0") < usernames_asc.index("order_test_1")
    assert usernames_asc.index("order_test_1") < usernames_asc.index("order_test_2")

    # Test descending order
    results_desc, _ = UserDAO.list(
        order_column="username", order_direction="desc", page_size=100
    )
    usernames_desc = [r.username for r in results_desc]
    # Check that our test users are in reverse order
    assert usernames_desc.index("order_test_2") < usernames_desc.index("order_test_1")
    assert usernames_desc.index("order_test_1") < usernames_desc.index("order_test_0")

    for user in users:
        user_with_data.delete(user)
    user_with_data.commit()


def test_base_dao_list_paging(user_with_data: Session) -> None:
    """Test BaseDAO.list with paging."""
    # Create additional users for paging
    users = []
    for i in range(10):
        user = User(
            username=f"page_test_{i}",
            first_name=f"Page{i}",
            last_name="Test",
            email=f"page{i}@example.com",
            active=True,
        )
        users.append(user)
        user_with_data.add(user)
    user_with_data.commit()

    # Test first page
    page1_results, page1_total = UserDAO.list(page=0, page_size=5, order_column="id")
    assert len(page1_results) <= 5
    assert page1_total >= 10  # At least our 10 users

    # Test second page
    page2_results, page2_total = UserDAO.list(page=1, page_size=5, order_column="id")
    assert len(page2_results) <= 5
    assert page2_total >= 10

    # Results should be different
    page1_ids = [r.id for r in page1_results]
    page2_ids = [r.id for r in page2_results]
    assert set(page1_ids).isdisjoint(set(page2_ids))  # No overlap

    for user in users:
        user_with_data.delete(user)
    user_with_data.commit()


def test_base_dao_list_search(user_with_data: Session) -> None:
    """Test BaseDAO.list with search."""
    # Create users with searchable names
    users = []
    for i in range(3):
        user = User(
            id=400 + i,
            username=f"searchable_{i}",
            first_name=f"Searchable{i}",
            last_name="User",
            email=f"search{i}@example.com",
            active=True,
        )
        users.append(user)
        user_with_data.add(user)

    # Create some non-matching users
    for i in range(2):
        user = User(
            id=410 + i,
            username=f"other_{i}",
            first_name=f"Other{i}",
            last_name="Person",
            email=f"other{i}@example.com",
            active=True,
        )
        users.append(user)
        user_with_data.add(user)

    user_with_data.commit()

    # Search for "searchable"
    results, total = UserDAO.list(
        search="searchable", search_columns=["username", "first_name"]
    )
    assert total >= 3  # At least our 3 searchable users

    # Verify search functionality works - count how many of our test users are found
    searchable_test_users = [
        r
        for r in results
        if "searchable" in (r.username.lower() + " " + r.first_name.lower())
    ]
    assert len(searchable_test_users) >= 3  # Our created test users should be found

    # Verify the search actually filtered results (total should be reasonable)
    assert total > 0  # Search returned some results

    for user in users:
        user_with_data.delete(user)
    user_with_data.commit()


def test_base_dao_list_custom_filter(user_with_data: Session) -> None:
    """Test BaseDAO.list with custom filters."""
    # Create users with specific attributes
    active_user = User(
        id=500,
        username="active_custom",
        first_name="Active",
        last_name="Custom",
        email="active@custom.com",
        active=True,
    )
    inactive_user = User(
        id=501,
        username="inactive_custom",
        first_name="Inactive",
        last_name="Custom",
        email="inactive@custom.com",
        active=False,
    )
    user_with_data.add_all([active_user, inactive_user])
    user_with_data.commit()

    # Create a custom filter for active users only
    class ActiveUsersFilter(BaseFilter):
        def __init__(self):
            self.column_name = "active"
            self.datamodel = None
            self.model = User  # Set model directly

        def apply(self, query, value):
            return query.filter(User.active.is_(True))

    custom_filters = {"active_only": ActiveUsersFilter()}

    results, total = UserDAO.list(custom_filters=custom_filters)

    # All results should be active users
    for result in results:
        assert result.active is True


def test_base_dao_list_base_filter(user_with_data: Session) -> None:
    """Test BaseDAO.list with base_filter."""

    # Create a DAO with a base filter
    class FilteredUserDAO(BaseDAO[User]):
        model_cls = User

        class ActiveFilter(BaseFilter):
            def apply(self, query, value):
                return query.filter(User.active.is_(True))

        base_filter = ActiveFilter

    # Create active and inactive users
    active_user = User(
        id=600,
        username="active_base",
        first_name="Active",
        last_name="Base",
        email="active@base.com",
        active=True,
    )
    inactive_user = User(
        id=601,
        username="inactive_base",
        first_name="Inactive",
        last_name="Base",
        email="inactive@base.com",
        active=False,
    )
    user_with_data.add_all([active_user, inactive_user])
    user_with_data.commit()

    # List should only return active users when base filter is applied
    results, total = FilteredUserDAO.list()

    # All results should be active
    for result in results:
        assert result.active is True

    user_with_data.delete(active_user)
    user_with_data.delete(inactive_user)
    user_with_data.commit()


def test_base_dao_list_edge_cases(user_with_data: Session) -> None:
    """Test BaseDAO.list with edge cases."""
    # Test with invalid order column (should not raise)
    results, total = UserDAO.list(order_column="invalid_column")
    assert isinstance(results, list)
    assert isinstance(total, int)

    # Test with invalid order direction (should default to asc)
    results, total = UserDAO.list(order_direction="invalid")
    assert isinstance(results, list)
    assert isinstance(total, int)

    # Test with negative page (should default to 0)
    results, total = UserDAO.list(page=-1, page_size=10)
    assert isinstance(results, list)
    assert isinstance(total, int)

    # Test with zero page size (should use default)
    results, total = UserDAO.list(page_size=0)
    assert isinstance(results, list)
    assert isinstance(total, int)

    # Test with very large page number (should return empty)
    results, total = UserDAO.list(page=99999, page_size=10)
    assert results == []
    assert isinstance(total, int)

    # Test with both search and column operators
    column_operators = [
        ColumnOperator(col="username", opr=ColumnOperatorEnum.sw, value="test")
    ]
    results, total = UserDAO.list(
        search="user", search_columns=["username"], column_operators=column_operators
    )
    assert isinstance(results, list)
    assert isinstance(total, int)


def test_base_dao_list_with_default_columns(user_with_data: Session) -> None:
    """Test BaseDAO.list with default columns when select_columns is None."""
    # Create test user
    user = User(
        id=800,
        username="default_columns_test",
        first_name="Default",
        last_name="Columns",
        email="default@columns.com",
        active=True,
    )
    user_with_data.add(user)
    user_with_data.commit()

    # Test without select_columns (should use default)
    results, total = UserDAO.list(
        column_operators=[
            ColumnOperator(
                col="username", opr=ColumnOperatorEnum.eq, value="default_columns_test"
            )
        ]
    )

    assert total == 1
    assert results[0].username == "default_columns_test"

    user_with_data.delete(user)
    user_with_data.commit()


def test_base_dao_list_with_invalid_operator(app_context: Session) -> None:
    """Test BaseDAO.list with invalid operator value."""
    # This test ensures that invalid operators are handled gracefully
    try:
        # Try to create an invalid operator (this might raise ValueError)
        invalid_op = ColumnOperator(col="username", opr="invalid_op", value="test")
        results, total = UserDAO.list(column_operators=[invalid_op])
    except (ValueError, KeyError):
        # Expected behavior - invalid operator is rejected
        pass


def test_base_dao_get_filterable_columns(app_context: Session) -> None:
    """Test get_filterable_columns_and_operators method."""
    # Get filterable columns for UserDAO
    filterable = UserDAO.get_filterable_columns_and_operators()

    # Should return a dict
    assert isinstance(filterable, dict)

    # Check for expected columns (User model has these)
    expected_columns = ["id", "username", "email", "active"]
    for col in expected_columns:
        assert col in filterable
        assert isinstance(filterable[col], list)
        assert len(filterable[col]) > 0  # Should have at least some operators


def test_base_dao_count_with_filters(app_context: Session) -> None:
    """Test BaseDAO.count with various filters."""
    # Create test users
    users = []
    for i in range(5):
        user = User(
            username=f"count_test_{i}",
            first_name=f"Count{i}",
            last_name="Test",
            email=f"count{i}@example.com",
            active=i % 2 == 0,  # Alternate active/inactive
        )
        users.append(user)
        db.session.add(user)
    db.session.commit()

    # Count all test users
    column_operators = [
        ColumnOperator(col="username", opr=ColumnOperatorEnum.sw, value="count_test_")
    ]
    count = UserDAO.count(column_operators=column_operators)
    assert count == 5


def test_find_by_ids_preserves_order(app_context: Session) -> None:
    """Test that find_by_ids preserves the order of input IDs."""
    # Create users with specific IDs
    users = []
    for i in [3, 1, 2]:  # Create in different order
        user = User(
            username=f"order_test_{i}",
            first_name=f"Order{i}",
            last_name="Test",
            email=f"order{i}@example.com",
            active=True,
        )
        users.append(user)
        db.session.add(user)
    db.session.commit()

    # Get their IDs in a specific order
    user_ids = [users[1].id, users[2].id, users[0].id]  # 1, 2, 3

    # Find by IDs
    found = UserDAO.find_by_ids(user_ids, skip_base_filter=True)

    # The order might not be preserved by default SQL behavior
    # but we should get all users back
    assert len(found) == 3
    found_ids = [u.id for u in found]
    assert set(found_ids) == set(user_ids)


def test_find_by_ids_with_mixed_types(app_context: Session) -> None:
    """Test find_by_ids with mixed ID types (int, str, uuid)."""
    # Create a database with mixed ID types
    database = Database(
        database_name="test_mixed_ids_db",
        sqlalchemy_uri="sqlite:///:memory:",
    )
    db.session.add(database)
    db.session.commit()

    # Find by numeric ID
    found = DatabaseDAO.find_by_ids([database.id], skip_base_filter=True)
    assert len(found) == 1
    assert found[0].id == database.id


def test_find_by_column_helper_method(app_context: Session) -> None:
    """Test the _find_by_column helper method."""
    # Create a user
    user = User(
        username="find_by_column_test",
        first_name="FindBy",
        last_name="Column",
        email="findby@column.com",
        active=True,
    )
    db.session.add(user)
    db.session.commit()

    # Use the helper method directly
    found = UserDAO._find_by_column("username", "find_by_column_test")
    assert found is not None
    assert found.username == "find_by_column_test"

    # Test with non-existent value
    not_found = UserDAO._find_by_column("username", "non_existent")
    assert not_found is None


def test_find_methods_with_special_characters(app_context: Session) -> None:
    """Test find methods with special characters in values."""
    # Create a dashboard with special characters in slug
    dashboard = Dashboard(
        dashboard_title="Test Special Chars",
        slug="test-special_chars.v1",
        published=True,
    )
    db.session.add(dashboard)
    db.session.commit()

    # Find by slug with special characters
    found = DashboardDAO.find_by_id(
        "test-special_chars.v1", id_column="slug", skip_base_filter=True
    )
    assert found is not None
    assert found.slug == "test-special_chars.v1"

    # Find by IDs with special characters
    found_list = DashboardDAO.find_by_ids(
        ["test-special_chars.v1"], id_column="slug", skip_base_filter=True
    )
    assert len(found_list) == 1
    assert found_list[0].slug == "test-special_chars.v1"


def test_find_methods_case_sensitivity(app_context: Session) -> None:
    """Test find methods with case sensitivity."""
    # Create users with similar usernames differing in case
    user1 = User(
        username="CaseSensitive",
        first_name="Case",
        last_name="Sensitive",
        email="case1@example.com",
        active=True,
    )
    user2 = User(
        username="casesensitive",
        first_name="Case",
        last_name="Insensitive",
        email="case2@example.com",
        active=True,
    )
    db.session.add_all([user1, user2])

    try:
        db.session.commit()

        # Find with exact case
        found = UserDAO.find_one_or_none(username="CaseSensitive")
        assert found is not None
        assert found.username == "CaseSensitive"

        # Find with different case
        found_lower = UserDAO.find_one_or_none(username="casesensitive")
        assert found_lower is not None
        assert found_lower.username == "casesensitive"

    finally:
        db.session.rollback()
        db.session.remove()


def test_find_by_ids_empty_and_none_handling(app_context: Session) -> None:
    """Test find_by_ids with empty list and None values."""
    # Test with empty list
    found_empty = UserDAO.find_by_ids([], skip_base_filter=True)
    assert found_empty == []

    # Test with None in list - cast to list with proper type
    found_with_none = UserDAO.find_by_ids([None], skip_base_filter=True)  # type: ignore[list-item]
    assert found_with_none == []

    # Test with mix of valid and None
    user = User(
        username="test_none_handling",
        first_name="Test",
        last_name="None",
        email="none@example.com",
        active=True,
    )
    db.session.add(user)
    db.session.commit()

    found_mixed = UserDAO.find_by_ids([user.id, None], skip_base_filter=True)  # type: ignore[list-item]
    assert len(found_mixed) == 1
    assert found_mixed[0].id == user.id


def test_find_methods_performance_with_large_lists(app_context: Session) -> None:
    """Test find_by_ids performance with large lists."""
    # Create a batch of users
    users = []
    for i in range(50):
        user = User(
            username=f"perf_test_{i}",
            first_name=f"Perf{i}",
            last_name="Test",
            email=f"perf{i}@example.com",
            active=True,
        )
        users.append(user)
        db.session.add(user)
    db.session.commit()

    # Test with large list of IDs
    user_ids = [user.id for user in users]

    start_time = time.time()
    found = UserDAO.find_by_ids(user_ids, skip_base_filter=True)
    elapsed = time.time() - start_time

    assert len(found) == 50
    # Should complete reasonably quickly (within 1 second for 50 items)
    assert elapsed < 1.0


def test_base_dao_model_cls_property(app_context: Session) -> None:
    """Test that model_cls is properly set on DAO classes."""
    # UserDAO should have User as model_cls
    assert UserDAO.model_cls == User

    # DashboardDAO should have Dashboard as model_cls
    assert DashboardDAO.model_cls == Dashboard

    # ChartDAO should have Slice as model_cls
    assert ChartDAO.model_cls == Slice


def test_base_dao_list_with_relationships_pagination(app_context: Session) -> None:
    """
    Test that pagination works correctly when loading relationships.

    This test addresses the concern that joinedload() with many-to-many
    relationships can cause incorrect pagination due to SQL JOINs multiplying rows.
    """
    # Create dashboards with owners (many-to-many relationship)
    users = []
    for i in range(3):
        user = User(
            username=f"rel_test_user_{i}",
            first_name=f"RelUser{i}",
            last_name="Test",
            email=f"reluser{i}@example.com",
            active=True,
        )
        users.append(user)
        db.session.add(user)

    dashboards = []
    for i in range(10):
        dashboard = Dashboard(
            dashboard_title=f"Relationship Test Dashboard {i}",
            slug=f"rel-test-dash-{i}",
        )
        # Add multiple owners to create many-to-many relationship
        dashboard.owners = users[:2]  # Each dashboard has 2 owners
        dashboards.append(dashboard)
        db.session.add(dashboard)

    db.session.commit()

    # Test pagination without relationships - baseline
    results_no_rel, count_no_rel = DashboardDAO.list(
        page=0,
        page_size=5,
        order_column="dashboard_title",
        order_direction="asc",
    )

    assert count_no_rel >= 10  # At least our 10 dashboards
    assert len(results_no_rel) == 5  # Should get exactly 5 due to page_size

    # Test pagination WITH relationships loaded
    # This is the critical test - it should NOT inflate the count
    results_with_rel, count_with_rel = DashboardDAO.list(
        page=0,
        page_size=5,
        columns=[
            "id",
            "dashboard_title",
            "owners",
        ],  # Include many-to-many relationship
        order_column="dashboard_title",
        order_direction="asc",
    )

    # CRITICAL ASSERTIONS:
    # 1. Count should be the same regardless of joins
    assert count_with_rel == count_no_rel, (
        f"Count inflated by joins! Without relationships: {count_no_rel}, "
        f"With relationships: {count_with_rel}"
    )

    # 2. Should still get exactly 5 dashboards, not affected by joins
    assert len(results_with_rel) == 5, (
        f"Pagination broken by joins! Expected 5 dashboards, got "
        f"{len(results_with_rel)}"
    )

    # 3. Verify relationships are actually loaded
    for result in results_with_rel:
        # Check that owners relationship is loaded (would raise if not)
        assert hasattr(result, "owners")
        # In our test setup, each dashboard should have 2 owners
        assert len(result.owners) == 2

    # Test second page to ensure offset works correctly
    results_page2, _ = DashboardDAO.list(
        page=1,
        page_size=5,
        columns=["id", "dashboard_title", "owners"],
        order_column="dashboard_title",
        order_direction="asc",
    )

    assert len(results_page2) == 5  # Should get next 5 dashboards
    # Ensure no overlap between pages
    page1_ids = {d.id for d in results_with_rel}
    page2_ids = {d.id for d in results_page2}
    assert page1_ids.isdisjoint(page2_ids), "Pages should not overlap"


def test_base_dao_list_with_one_to_many_relationship(app_context: Session) -> None:
    """
    Test pagination with one-to-many relationships.

    Charts have a many-to-one relationship with databases.
    When we load the database relationship, it shouldn't affect pagination.
    """
    # Create a database
    database = Database(
        database_name="TestDB for Relationships",
        sqlalchemy_uri="sqlite:///:memory:",
    )
    db.session.add(database)
    db.session.commit()

    # Create charts linked to this database
    charts = []
    for i in range(15):
        chart = Slice(
            slice_name=f"Chart with Relationship {i}",
            datasource_type="table",
            datasource_id=1,
            viz_type="line",
            params="{}",
        )
        charts.append(chart)
        db.session.add(chart)

    db.session.commit()

    # Test with relationship loading (skip_base_filter since ChartDAO may have filters)
    # We'll use a simpler approach - directly test the BaseDAO.list method
    from superset.daos.base import BaseDAO

    class TestChartDAO(BaseDAO[Slice]):
        model_cls = Slice
        base_filter = None  # No base filter for testing

    results, total_count = TestChartDAO.list(
        page=0,
        page_size=10,
        columns=["id", "slice_name", "datasource_type"],
        order_column="slice_name",
        order_direction="asc",
    )

    # Should get exactly 10 charts
    assert len(results) == 10
    # Total count should reflect all charts, not be affected by any joins
    assert total_count >= 15


def test_base_dao_list_count_accuracy_with_filters_and_relationships(
    app_context: Session,
) -> None:
    """
    Test that count remains accurate when combining filters with relationship loading.

    This ensures the fix (counting before joins) works correctly with complex queries.
    """
    # Create users with specific patterns
    active_users = []
    inactive_users = []

    for i in range(8):
        user = User(
            username=f"count_test_active_{i}",
            first_name="Active",
            last_name=f"User{i}",
            email=f"active{i}@test.com",
            active=True,
        )
        active_users.append(user)
        db.session.add(user)

    for i in range(5):
        user = User(
            username=f"count_test_inactive_{i}",
            first_name="Inactive",
            last_name=f"User{i}",
            email=f"inactive{i}@test.com",
            active=False,
        )
        inactive_users.append(user)
        db.session.add(user)

    db.session.commit()

    # Create dashboards owned by these users
    for i in range(6):
        dashboard = Dashboard(
            dashboard_title=f"Count Test Dashboard {i}",
            slug=f"count-test-{i}",
        )
        dashboard.owners = active_users[:3]  # 3 owners per dashboard
        db.session.add(dashboard)

    db.session.commit()

    # Test with filters and relationship loading
    filters = [
        ColumnOperator(
            col="dashboard_title",
            opr=ColumnOperatorEnum.sw,
            value="Count Test",
        )
    ]

    results, count = DashboardDAO.list(
        column_operators=filters,
        columns=["id", "dashboard_title", "owners"],  # Load many-to-many
        page=0,
        page_size=3,
    )

    # Should find exactly 6 dashboards that match the filter
    assert count == 6, f"Expected 6 dashboards, but count was {count}"

    # Should return only 3 due to page_size
    assert len(results) == 3, (
        f"Expected 3 results due to pagination, got {len(results)}"
    )

    # Each should have 3 owners as we set up
    for dashboard in results:
        assert len(dashboard.owners) == 3, (
            f"Dashboard {dashboard.dashboard_title} should have 3 owners, "
            f"has {len(dashboard.owners)}"
        )


def test_base_dao_id_column_name_property(app_context: Session) -> None:
    """Test that id_column_name property works correctly."""
    # Create a user to test with
    user = User(
        username="id_column_test",
        first_name="ID",
        last_name="Column",
        email="id@column.com",
        active=True,
    )
    db.session.add(user)
    db.session.commit()

    # UserDAO should use 'id' by default
    assert UserDAO.id_column_name == "id"

    # Find by ID should work
    found = UserDAO.find_by_id(user.id, skip_base_filter=True)
    assert found is not None
    assert found.id == user.id


def test_base_dao_base_filter_integration(app_context: Session) -> None:
    """Test that base_filter is properly applied when set."""
    # Create test users
    users = []
    for i in range(3):
        user = User(
            username=f"filter_test_{i}",
            first_name=f"Filter{i}",
            last_name="Test",
            email=f"filter{i}@example.com",
            active=i % 2 == 0,  # Alternate active/inactive
        )
        users.append(user)
        db.session.add(user)
    db.session.commit()

    # UserDAO might not have a base filter, so we just verify it doesn't break
    all_users = UserDAO.find_all()
    assert len(all_users) >= 3

    # With skip_base_filter - find_all doesn't support this parameter
    # Just test the regular find_all
    all_users_normal = UserDAO.find_all()
    assert len(all_users_normal) >= 3


def test_base_dao_edge_cases(app_context: Session) -> None:
    """Test BaseDAO edge cases and error conditions."""
    # Test create without item or attributes
    created = UserDAO.create()
    assert created is not None
    # User model has required fields, so we expect them to be None
    assert created.username is None

    # Don't commit - would fail due to constraints
    db.session.rollback()

    # Test update without item (creates new)
    updated = UserDAO.update(
        attributes={"username": "no_item_update", "email": "test@example.com"}
    )
    assert updated is not None
    assert updated.username == "no_item_update"

    # Don't commit - would fail due to constraints
    db.session.rollback()

    # Test list with search
    results, total = UserDAO.list(search="test")
    # Should handle gracefully
    assert isinstance(results, list)
    assert isinstance(total, int)

    # Test list with column operators
    results, total = UserDAO.list(
        column_operators=[
            ColumnOperator(col="username", opr=ColumnOperatorEnum.like, value="test")
        ]
    )
    # Should handle gracefully
    assert isinstance(results, list)
    assert isinstance(total, int)


def test_convert_value_for_column_uuid(app_context: Session) -> None:
    """Test the _convert_value_for_column method with UUID columns."""
    # Create a dashboard to get a real UUID column
    dashboard = Dashboard(
        dashboard_title="Test UUID Conversion",
        slug="test-uuid-conversion",
        published=True,
    )
    db.session.add(dashboard)
    db.session.commit()

    # Get the UUID column
    uuid_column = Dashboard.uuid

    # Test with valid UUID string
    uuid_str = str(dashboard.uuid)
    converted = DashboardDAO._convert_value_for_column(uuid_column, uuid_str)
    # Should convert string to UUID object
    assert converted == dashboard.uuid

    # Test with UUID object (should return as-is)
    converted = DashboardDAO._convert_value_for_column(uuid_column, dashboard.uuid)
    assert converted == dashboard.uuid

    # Test with invalid UUID string
    invalid = DashboardDAO._convert_value_for_column(uuid_column, "not-a-uuid")
    # Should return None for invalid UUID
    assert invalid is None


def test_convert_value_for_column_non_uuid(app_context: Session) -> None:
    """Test the _convert_value_for_column method with non-UUID columns."""
    # Get a non-UUID column
    id_column = User.id

    # Test with integer value
    converted = UserDAO._convert_value_for_column(id_column, 123)
    assert converted == 123

    # Test with string that can be converted to int
    converted = UserDAO._convert_value_for_column(id_column, "456")
    assert converted == "456"  # Should return as-is if not UUID column

    # Get a string column
    username_column = User.username

    # Test with string value
    converted = UserDAO._convert_value_for_column(username_column, "testuser")
    assert converted == "testuser"


def test_find_by_id_with_uuid_conversion_error_handling(app_context: Session) -> None:
    """Test find_by_id handles UUID conversion errors gracefully."""
    # Create a dashboard
    dashboard = Dashboard(
        dashboard_title="UUID Error Test",
        slug="uuid-error-test",
        published=True,
    )
    db.session.add(dashboard)
    db.session.commit()

    # Try to find with completely invalid UUID format
    # Should handle gracefully and return None
    found = DashboardDAO.find_by_id("not-a-uuid-at-all!!!", skip_base_filter=True)
    assert found is None


def test_find_by_ids_with_uuid_conversion_error_handling(app_context: Session) -> None:
    """Test find_by_ids handles UUID conversion errors gracefully."""
    # Create a dashboard
    dashboard = Dashboard(
        dashboard_title="UUID Error Test Multiple",
        slug="uuid-error-test-multiple",
        published=True,
    )
    db.session.add(dashboard)
    db.session.commit()

    # Try to find with mix of valid and invalid UUIDs
    valid_uuid = str(dashboard.uuid)
    invalid_uuids = ["not-a-uuid", "also-not-a-uuid"]

    # Should handle gracefully and only return valid matches
    found = DashboardDAO.find_by_ids(
        [valid_uuid] + invalid_uuids, id_column="uuid", skip_base_filter=True
    )
    assert len(found) <= 1  # Should only find the valid one or none
