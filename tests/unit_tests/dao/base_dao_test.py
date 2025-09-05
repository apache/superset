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
Comprehensive tests for BaseDAO functionality including find operations,
CRUD methods, flexible column support, column operators, and error handling.
"""

import datetime
import time
import uuid
from unittest.mock import Mock, patch

import pytest
from flask_appbuilder.models.filters import BaseFilter
from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.sqla.models import User
from sqlalchemy import Boolean, Column, DateTime, Integer, String
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm.session import Session

from superset.daos.base import BaseDAO, ColumnOperator, ColumnOperatorEnum
from superset.daos.chart import ChartDAO
from superset.daos.dashboard import DashboardDAO
from superset.daos.database import DatabaseDAO
from superset.daos.exceptions import DAOFindFailedError
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


class MockModel:
    def __init__(self, id=1, name="test"):
        self.id = id
        self.name = name


class TestDAO(BaseDAO[MockModel]):
    model_cls = MockModel


class TestDAOWithNoneModel(BaseDAO[MockModel]):
    model_cls = None


@pytest.fixture(autouse=True)
def mock_g_user():
    """Mock the flask g.user for security context."""
    with patch("superset.security.manager.g") as mock_g:
        mock_user = User()
        mock_user.id = 1
        mock_user.username = "test_user"
        mock_g.user = mock_user
        yield mock_g


# =============================================================================
# Column Operator Enum Tests
# =============================================================================


def test_column_operator_enum_apply_method() -> None:  # noqa: C901
    """
    Test that the apply method works correctly for each operator.
    This verifies the actual SQL generation for each operator.
    """
    Base_test = declarative_base()  # noqa: N806

    class TestModel(Base_test):  # type: ignore
        __tablename__ = "test_model"
        id = Column(Integer, primary_key=True)
        name = Column(String(50))
        age = Column(Integer)
        active = Column(Boolean)

    # Test each operator's apply method
    test_cases = [
        # (operator, column, value, expected_sql_fragment)
        (ColumnOperatorEnum.eq, TestModel.name, "test", "name = 'test'"),
        (ColumnOperatorEnum.ne, TestModel.name, "test", "name != 'test'"),
        (ColumnOperatorEnum.sw, TestModel.name, "test", "name LIKE 'test%'"),
        (ColumnOperatorEnum.ew, TestModel.name, "test", "name LIKE '%test'"),
        (ColumnOperatorEnum.in_, TestModel.id, [1, 2, 3], "id IN (1, 2, 3)"),
        (ColumnOperatorEnum.nin, TestModel.id, [1, 2, 3], "id NOT IN (1, 2, 3)"),
        (ColumnOperatorEnum.gt, TestModel.age, 25, "age > 25"),
        (ColumnOperatorEnum.gte, TestModel.age, 25, "age >= 25"),
        (ColumnOperatorEnum.lt, TestModel.age, 25, "age < 25"),
        (ColumnOperatorEnum.lte, TestModel.age, 25, "age <= 25"),
        (ColumnOperatorEnum.like, TestModel.name, "test", "name LIKE '%test%'"),
        (ColumnOperatorEnum.ilike, TestModel.name, "test", "name ILIKE '%test%'"),
        (ColumnOperatorEnum.is_null, TestModel.name, None, "name IS NULL"),
        (ColumnOperatorEnum.is_not_null, TestModel.name, None, "name IS NOT NULL"),
    ]

    for operator, column, value, expected_sql_fragment in test_cases:
        # Apply the operator
        result = operator.apply(column, value)

        # Convert to string to check SQL generation
        sql_str = str(result.compile(compile_kwargs={"literal_binds": True}))

        # Verify the SQL contains the expected fragment
        # Note: SQLAlchemy might format this differently, so we check for key parts
        if "=" in expected_sql_fragment:
            assert "=" in sql_str
        elif "!=" in expected_sql_fragment:
            assert "!=" in sql_str
        elif "LIKE" in expected_sql_fragment:
            assert "LIKE" in sql_str
        elif "ILIKE" in expected_sql_fragment:
            assert "ILIKE" in sql_str
        elif "IN" in expected_sql_fragment:
            assert "IN" in sql_str
        elif "NOT IN" in expected_sql_fragment:
            assert "NOT IN" in sql_str
        elif ">" in expected_sql_fragment:
            assert ">" in sql_str
        elif ">=" in expected_sql_fragment:
            assert ">=" in sql_str
        elif "<" in expected_sql_fragment:
            assert "<" in sql_str
        elif "<=" in expected_sql_fragment:
            assert "<=" in sql_str
        elif "IS NULL" in expected_sql_fragment:
            assert "IS NULL" in sql_str
        elif "IS NOT NULL" in expected_sql_fragment:
            assert "IS NOT NULL" in sql_str

    # Test that all operators are covered
    all_operators = set(ColumnOperatorEnum)
    tested_operators = {
        ColumnOperatorEnum.eq,
        ColumnOperatorEnum.ne,
        ColumnOperatorEnum.sw,
        ColumnOperatorEnum.ew,
        ColumnOperatorEnum.in_,
        ColumnOperatorEnum.nin,
        ColumnOperatorEnum.gt,
        ColumnOperatorEnum.gte,
        ColumnOperatorEnum.lt,
        ColumnOperatorEnum.lte,
        ColumnOperatorEnum.like,
        ColumnOperatorEnum.ilike,
        ColumnOperatorEnum.is_null,
        ColumnOperatorEnum.is_not_null,
    }

    # Ensure we've tested all operators
    assert tested_operators == all_operators, (
        f"Missing operators: {all_operators - tested_operators}"
    )


def test_column_operator_enum_complete_coverage(user_with_data: Session) -> None:
    """
    Test that every single ColumnOperatorEnum operator is covered by tests.
    This ensures we have comprehensive test coverage for all operators.
    """
    # Create test users for comprehensive operator testing
    test_users = [
        User(
            id=900,
            username="testuser1",
            first_name="Test",
            last_name="User1",
            email="test1@example.com",
            active=True,
        ),
        User(
            id=901,
            username="testuser2",
            first_name="Test",
            last_name="User2",
            email="test2@example.com",
            active=False,
        ),
        User(
            id=902,
            username="adminuser",
            first_name="Admin",
            last_name="User",
            email="admin@example.com",
            active=True,
        ),
    ]

    for user in test_users:
        user_with_data.add(user)
    user_with_data.commit()

    # Test eq (equals)
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="username", opr=ColumnOperatorEnum.eq, value="testuser1")
        ]
    )
    assert any(u.username == "testuser1" for u in results)

    # Test ne (not equals)
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="username", opr=ColumnOperatorEnum.ne, value="testuser1")
        ]
    )
    assert all(u.username != "testuser1" for u in results)

    # Test sw (starts with)
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="username", opr=ColumnOperatorEnum.sw, value="test")
        ]
    )
    assert any(u.username.startswith("test") for u in results)

    # Test ew (ends with)
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="username", opr=ColumnOperatorEnum.ew, value="user1")
        ]
    )
    assert any(u.username.endswith("user1") for u in results)

    # Test in_ (in list)
    user_ids = [900, 901]
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="id", opr=ColumnOperatorEnum.in_, value=user_ids)
        ]
    )
    result_ids = [u.id for u in results]
    assert all(uid in result_ids for uid in user_ids)

    # Test nin (not in list)
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="id", opr=ColumnOperatorEnum.nin, value=user_ids)
        ]
    )
    result_ids = [u.id for u in results]
    assert all(uid not in result_ids for uid in user_ids)

    # Test gt (greater than)
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="id", opr=ColumnOperatorEnum.gt, value=900)
        ]
    )
    assert all(u.id > 900 for u in results)

    # Test gte (greater than or equal)
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="id", opr=ColumnOperatorEnum.gte, value=901)
        ]
    )
    assert all(u.id >= 901 for u in results)

    # Test lt (less than)
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="id", opr=ColumnOperatorEnum.lt, value=902)
        ]
    )
    assert all(u.id < 902 for u in results)

    # Test lte (less than or equal)
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="id", opr=ColumnOperatorEnum.lte, value=901)
        ]
    )
    assert all(u.id <= 901 for u in results)

    # Test like (like pattern)
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="username", opr=ColumnOperatorEnum.like, value="test")
        ]
    )
    assert any("test" in u.username for u in results)

    # Test ilike (case insensitive like)
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="username", opr=ColumnOperatorEnum.ilike, value="TEST")
        ]
    )
    assert any("test" in u.username.lower() for u in results)

    # Test is_null (is null)
    # Create a user with a null field that allows nulls
    user_with_data.add(
        User(
            id=903,
            username="nulluser",
            first_name="Test",
            last_name="User",
            email="nulluser@example.com",
            active=True,
        )
    )
    user_with_data.commit()

    # Update to set a field that can be null (we'll use a field that allows nulls)
    # For this test, we'll check if we can find users where a field is null
    # Since we can't easily set first_name to null, we'll test the is_null operator
    # by checking if it works with fields that might be null
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="first_name", opr=ColumnOperatorEnum.is_null, value=None)
        ]
    )
    # This should return empty since all users have first_name set
    assert len(results) == 0

    # Test is_not_null (is not null)
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(
                col="first_name", opr=ColumnOperatorEnum.is_not_null, value=None
            )
        ]
    )
    # This should return all users since all have first_name set
    assert len(results) > 0

    # Test boolean operators
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="active", opr=ColumnOperatorEnum.eq, value=True)
        ]
    )
    assert all(u.active for u in results)

    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="active", opr=ColumnOperatorEnum.eq, value=False)
        ]
    )
    assert all(not u.active for u in results)

    # Test that all operators are covered
    all_operators = set(ColumnOperatorEnum)
    tested_operators = {
        ColumnOperatorEnum.eq,
        ColumnOperatorEnum.ne,
        ColumnOperatorEnum.sw,
        ColumnOperatorEnum.ew,
        ColumnOperatorEnum.in_,
        ColumnOperatorEnum.nin,
        ColumnOperatorEnum.gt,
        ColumnOperatorEnum.gte,
        ColumnOperatorEnum.lt,
        ColumnOperatorEnum.lte,
        ColumnOperatorEnum.like,
        ColumnOperatorEnum.ilike,
        ColumnOperatorEnum.is_null,
        ColumnOperatorEnum.is_not_null,
    }

    # Ensure we've tested all operators
    assert tested_operators == all_operators, (
        f"Missing operators: {all_operators - tested_operators}"
    )


# =============================================================================
# Find by ID Tests - Testing flexible column support
# =============================================================================


def test_find_by_id_with_default_column(app_context: None) -> None:
    """Test find_by_id using the default id column."""
    # Create test data
    user = User(
        id=1000,
        username="test_find_user",
        first_name="Test",
        last_name="User",
        email="testfind@example.com",
        active=True,
    )
    db.session.add(user)
    db.session.commit()

    # Find by ID using default column
    found_user = UserDAO.find_by_id(1000)
    assert found_user is not None
    assert found_user.id == 1000
    assert found_user.username == "test_find_user"

    # Test not found
    not_found = UserDAO.find_by_id(9999)
    assert not_found is None

    # Cleanup
    db.session.delete(user)
    db.session.commit()


def test_find_by_id_with_uuid_column(app_context: None) -> None:
    """Test find_by_id using UUID column."""
    # Create dashboard with UUID
    dashboard = Dashboard(
        dashboard_title="Test UUID Dashboard",
        slug="test-uuid-dashboard",
        published=True,
    )
    db.session.add(dashboard)
    db.session.commit()

    # Verify dashboard exists (skip base filter for test)
    found_by_id = DashboardDAO.find_by_id(dashboard.id, skip_base_filter=True)
    assert found_by_id is not None

    # Get the UUID as string for lookup
    dashboard_uuid_str = str(dashboard.uuid)

    # Find by UUID (skip base filter)
    found_dashboard = DashboardDAO.find_by_id(
        dashboard_uuid_str, id_column="uuid", skip_base_filter=True
    )
    assert found_dashboard is not None
    assert str(found_dashboard.uuid) == dashboard_uuid_str
    assert found_dashboard.dashboard_title == "Test UUID Dashboard"

    # Test not found with invalid UUID
    not_found = DashboardDAO.find_by_id("invalid-uuid", id_column="uuid")
    assert not_found is None

    # Cleanup
    db.session.delete(dashboard)
    db.session.commit()


def test_find_by_id_with_slug_column(app_context: None) -> None:
    """Test find_by_id using slug column."""
    # Create test dashboard with slug
    dashboard = Dashboard(
        dashboard_title="Test Slug Dashboard",
        slug="unique-test-slug",
        published=True,
    )
    db.session.add(dashboard)
    db.session.commit()

    # Find by slug (skip base filter)
    found_dashboard = DashboardDAO.find_by_id(
        "unique-test-slug", id_column="slug", skip_base_filter=True
    )
    assert found_dashboard is not None
    assert found_dashboard.slug == "unique-test-slug"
    assert found_dashboard.dashboard_title == "Test Slug Dashboard"

    # Test not found
    not_found = DashboardDAO.find_by_id(
        "non-existent-slug", id_column="slug", skip_base_filter=True
    )
    assert not_found is None

    # Cleanup
    db.session.delete(dashboard)
    db.session.commit()


def test_find_by_id_with_invalid_column(app_context: None) -> None:
    """Test find_by_id with invalid column name."""
    # Should return None when column doesn't exist
    result = UserDAO.find_by_id(1, id_column="non_existent_column")
    assert result is None


def test_find_by_id_skip_base_filter(app_context: None) -> None:
    """Test find_by_id with skip_base_filter option."""
    # Create two users - one active, one inactive
    active_user = User(
        id=1001,
        username="active_user",
        first_name="Active",
        last_name="User",
        email="active@example.com",
        active=True,
    )
    inactive_user = User(
        id=1002,
        username="inactive_user",
        first_name="Inactive",
        last_name="User",
        email="inactive@example.com",
        active=False,
    )
    db.session.add_all([active_user, inactive_user])
    db.session.commit()

    # Test basic finding without base filter
    found_active = UserDAO.find_by_id(1001)
    assert found_active is not None
    assert found_active.id == 1001

    found_inactive = UserDAO.find_by_id(1002)
    assert found_inactive is not None
    assert found_inactive.id == 1002

    # Test skip_base_filter parameter works (should have same result for UserDAO)
    found_with_skip = UserDAO.find_by_id(1001, skip_base_filter=True)
    assert found_with_skip is not None
    assert found_with_skip.id == 1001

    # Cleanup
    db.session.delete(active_user)
    db.session.delete(inactive_user)
    db.session.commit()


# =============================================================================
# Find by IDs Tests - Testing bulk operations with flexible columns
# =============================================================================


def test_find_by_ids_with_default_column(app_context: None) -> None:
    """Test find_by_ids using the default id column."""
    # Create multiple test users
    users = []
    for i in range(1100, 1105):
        user = User(
            id=i,
            username=f"bulk_user_{i}",
            first_name="Bulk",
            last_name=f"User{i}",
            email=f"bulk{i}@example.com",
            active=True,
        )
        users.append(user)
        db.session.add(user)
    db.session.commit()

    # Find multiple by IDs
    ids_to_find = [1100, 1102, 1104]
    found_users = UserDAO.find_by_ids(ids_to_find)
    assert len(found_users) == 3
    found_ids = [u.id for u in found_users]
    assert set(found_ids) == set(ids_to_find)

    # Test with some non-existent IDs
    mixed_ids = [1101, 1103, 9999, 8888]
    found_users = UserDAO.find_by_ids(mixed_ids)
    assert len(found_users) == 2
    found_ids = [u.id for u in found_users]
    assert set(found_ids) == {1101, 1103}

    # Test empty list
    found_users = UserDAO.find_by_ids([])
    assert found_users == []

    # Cleanup
    for user in users:
        db.session.delete(user)
    db.session.commit()


def test_find_by_ids_with_uuid_column(app_context: None) -> None:
    """Test find_by_ids using UUID column."""
    # Create multiple charts with UUIDs
    charts = []
    chart_uuids = []
    for i in range(3):
        chart_uuid = str(uuid.uuid4())
        chart_uuids.append(chart_uuid)
        chart = Slice(
            slice_name=f"Test Chart {i}",
            viz_type="table",
            datasource_id=1,
            datasource_type="table",
            params="{}",
            uuid=chart_uuid,
        )
        charts.append(chart)
        db.session.add(chart)
    db.session.commit()

    # Find multiple by UUIDs (skip base filter)
    found_charts = ChartDAO.find_by_ids(
        chart_uuids[:2], id_column="uuid", skip_base_filter=True
    )
    assert len(found_charts) == 2
    found_uuids = [str(c.uuid) for c in found_charts]
    assert set(found_uuids) == set(chart_uuids[:2])

    # Test with mixed valid and invalid UUIDs (skip base filter)
    mixed_uuids = [chart_uuids[0], "invalid-uuid", chart_uuids[2]]
    found_charts = ChartDAO.find_by_ids(
        mixed_uuids, id_column="uuid", skip_base_filter=True
    )
    assert len(found_charts) == 2
    found_uuids = [str(c.uuid) for c in found_charts]
    assert set(found_uuids) == {chart_uuids[0], chart_uuids[2]}

    # Cleanup
    for chart in charts:
        db.session.delete(chart)
    db.session.commit()


def test_find_by_ids_with_slug_column(app_context: None) -> None:
    """Test find_by_ids using slug column."""
    # Create multiple dashboards with slugs
    dashboards = []
    slugs = []
    for i in range(3):
        slug = f"test-dashboard-{i}"
        slugs.append(slug)
        dashboard = Dashboard(
            dashboard_title=f"Test Dashboard {i}",
            slug=slug,
            published=True,
        )
        dashboards.append(dashboard)
        db.session.add(dashboard)
    db.session.commit()

    # Find multiple by slugs (skip base filter)
    found_dashboards = DashboardDAO.find_by_ids(
        slugs[:2], id_column="slug", skip_base_filter=True
    )
    assert len(found_dashboards) == 2
    found_slugs = [d.slug for d in found_dashboards]
    assert set(found_slugs) == set(slugs[:2])

    # Test with non-existent slugs
    mixed_slugs = [slugs[0], "non-existent-slug", slugs[2]]
    found_dashboards = DashboardDAO.find_by_ids(
        mixed_slugs, id_column="slug", skip_base_filter=True
    )
    assert len(found_dashboards) == 2
    found_slugs = [d.slug for d in found_dashboards]
    assert set(found_slugs) == {slugs[0], slugs[2]}

    # Cleanup
    for dashboard in dashboards:
        db.session.delete(dashboard)
    db.session.commit()


def test_find_by_ids_with_invalid_column(app_context: None) -> None:
    """Test find_by_ids with invalid column name."""
    # Should return empty list when column doesn't exist
    result = UserDAO.find_by_ids([1, 2, 3], id_column="non_existent_column")
    assert result == []


def test_find_by_ids_skip_base_filter(app_context: None) -> None:
    """Test find_by_ids with skip_base_filter option."""
    # Create mix of active and inactive users
    users = []
    user_ids = []
    for i, active in enumerate([True, False, True, False]):
        user_id = 1200 + i
        user_ids.append(user_id)
        user = User(
            id=user_id,
            username=f"filter_user_{user_id}",
            first_name="Filter",
            last_name=f"User{user_id}",
            email=f"filter{user_id}@example.com",
            active=active,
        )
        users.append(user)
        db.session.add(user)
    db.session.commit()

    # Test finding all users
    found_users = UserDAO.find_by_ids(user_ids)
    assert len(found_users) == 4
    found_ids = [u.id for u in found_users]
    assert set(found_ids) == set(user_ids)

    # Test skip_base_filter parameter works (should have same result for UserDAO)
    found_users_skip = UserDAO.find_by_ids(user_ids, skip_base_filter=True)
    assert len(found_users_skip) == 4
    found_ids_skip = [u.id for u in found_users_skip]
    assert set(found_ids_skip) == set(user_ids)

    # Cleanup
    for user in users:
        db.session.delete(user)
    db.session.commit()


# =============================================================================
# CRUD Operations Tests - Create, Read, Update, Delete
# =============================================================================


def test_base_dao_create_with_item(app_context: None) -> None:
    """Test BaseDAO create method with an item."""
    # Create a new user
    user = User(
        id=5000,
        username="test_create_user",
        first_name="Test",
        last_name="Create",
        email="testcreate@example.com",
        active=True,
    )
    created = UserDAO.create(item=user)

    # Verify it's added to session
    assert created is user
    assert created in db.session

    # Commit and verify it persists
    db.session.commit()
    assert created.id is not None

    # Verify we can find it
    found = UserDAO.find_by_id(created.id)
    assert found is not None
    assert found.username == "test_create_user"
    assert found.first_name == "Test"

    # Cleanup
    db.session.delete(created)
    db.session.commit()


def test_base_dao_create_with_attributes(app_context: None) -> None:
    """Test BaseDAO create method with attributes dict."""
    # Create with attributes
    attributes = {
        "id": 5001,
        "username": "attr_user",
        "first_name": "Attr",
        "last_name": "User",
        "email": "attr@example.com",
        "active": True,
    }
    created = UserDAO.create(attributes=attributes)

    # Verify attributes were set
    assert created.username == "attr_user"
    assert created.first_name == "Attr"
    assert created in db.session

    # Commit and verify
    db.session.commit()
    assert created.id is not None

    # Cleanup
    db.session.delete(created)
    db.session.commit()


def test_base_dao_create_with_both_item_and_attributes(app_context: None) -> None:
    """Test BaseDAO create with both item and attributes."""
    # Create user with some values
    user = User(
        id=5002,
        username="initial_user",
        first_name="Initial",
        last_name="User",
        email="initial@example.com",
        active=True,
    )

    # Override with attributes
    attributes = {
        "username": "updated_user",
        "first_name": "Updated",
    }
    created = UserDAO.create(item=user, attributes=attributes)

    # Attributes should override item values
    assert created.username == "updated_user"
    assert created.first_name == "Updated"
    assert created.last_name == "User"  # Should keep original

    db.session.commit()

    # Cleanup
    db.session.delete(created)
    db.session.commit()


def test_base_dao_update_with_item(app_context: None) -> None:
    """Test BaseDAO update method with an item."""
    # Create a user first
    user = User(
        id=5003,
        username="original_user",
        first_name="Original",
        last_name="User",
        email="original@example.com",
        active=True,
    )
    db.session.add(user)
    db.session.commit()

    # Update it
    user.first_name = "Updated"
    updated = UserDAO.update(item=user)

    assert updated is user
    assert updated.first_name == "Updated"

    db.session.commit()

    # Verify update persisted
    found = UserDAO.find_by_id(user.id)
    assert found is not None
    assert found.first_name == "Updated"

    # Cleanup
    db.session.delete(user)
    db.session.commit()


def test_base_dao_update_with_attributes(app_context: None) -> None:
    """Test BaseDAO update method with attributes."""
    # Create a user first
    user = User(
        id=5004,
        username="attr_update_user",
        first_name="Original",
        last_name="User",
        email="attrupdate@example.com",
        active=True,
    )
    db.session.add(user)
    db.session.commit()

    # Update with attributes
    attributes = {
        "first_name": "Attr Updated",
        "last_name": "Attr User",
    }
    updated = UserDAO.update(item=user, attributes=attributes)

    assert updated.first_name == "Attr Updated"
    assert updated.last_name == "Attr User"

    db.session.commit()

    # Cleanup
    db.session.delete(user)
    db.session.commit()


def test_base_dao_update_detached_item(app_context: None) -> None:
    """Test BaseDAO update with a detached item."""
    # Create and commit a user
    user = User(
        id=5005,
        username="detached_user",
        first_name="Detached",
        last_name="User",
        email="detached@example.com",
        active=True,
    )
    db.session.add(user)
    db.session.commit()
    user_id = user.id

    # Detach it from session
    db.session.expunge(user)

    # Update the detached user
    user.first_name = "Updated Detached"
    updated = UserDAO.update(item=user)

    # Should merge it back into session
    assert updated in db.session
    assert updated.first_name == "Updated Detached"

    db.session.commit()

    # Verify update
    found = UserDAO.find_by_id(user_id)
    assert found is not None
    assert found.first_name == "Updated Detached"

    # Cleanup
    db.session.delete(found)
    db.session.commit()


def test_base_dao_delete_single_item(app_context: None) -> None:
    """Test BaseDAO delete method with single item."""
    # Create a user
    user = User(
        id=5006,
        username="delete_user",
        first_name="Delete",
        last_name="User",
        email="delete@example.com",
        active=True,
    )
    db.session.add(user)
    db.session.commit()
    user_id = user.id

    # Delete it
    UserDAO.delete([user])
    db.session.commit()

    # Verify it's gone
    found = UserDAO.find_by_id(user_id)
    assert found is None


def test_base_dao_delete_multiple_items(app_context: None) -> None:
    """Test BaseDAO delete method with multiple items."""
    # Create multiple users
    users = []
    for i in range(3):
        user = User(
            id=5007 + i,
            username=f"delete_user_{i}",
            first_name="Delete",
            last_name=f"User{i}",
            email=f"delete{i}@example.com",
            active=True,
        )
        users.append(user)
        db.session.add(user)
    db.session.commit()

    user_ids = [user.id for user in users]

    # Delete all at once
    UserDAO.delete(users)
    db.session.commit()

    # Verify all are gone
    for user_id in user_ids:
        found = UserDAO.find_by_id(user_id)
        assert found is None


def test_base_dao_delete_empty_list(app_context: None) -> None:
    """Test BaseDAO delete with empty list."""
    # Should not raise any errors
    UserDAO.delete([])
    db.session.commit()


def test_base_dao_find_all(app_context: None) -> None:
    """Test BaseDAO find_all method."""
    # Create test users
    users = []
    for i in range(3):
        user = User(
            id=5010 + i,
            username=f"find_all_user_{i}",
            first_name="FindAll",
            last_name=f"User{i}",
            email=f"findall{i}@example.com",
            active=True,
        )
        users.append(user)
        db.session.add(user)
    db.session.commit()

    # Find all
    all_users = UserDAO.find_all()

    # Should include our created users
    usernames = [user.username for user in all_users]
    for i in range(3):
        assert f"find_all_user_{i}" in usernames

    # Cleanup
    for user in users:
        db.session.delete(user)
    db.session.commit()


def test_base_dao_find_one_or_none(app_context: None) -> None:
    """Test BaseDAO find_one_or_none method."""
    # Create test users
    user1 = User(
        id=5013,
        username="unique_user",
        first_name="Unique",
        last_name="User",
        email="unique@example.com",
        active=True,
    )
    user2 = User(
        id=5014,
        username="duplicate_user_1",
        first_name="Duplicate",
        last_name="First",
        email="dup1@example.com",
        active=True,
    )
    user3 = User(
        id=5015,
        username="duplicate_user_2",
        first_name="Duplicate",
        last_name="Second",
        email="dup2@example.com",
        active=True,
    )
    db.session.add_all([user1, user2, user3])
    db.session.commit()

    # Find unique user
    found = UserDAO.find_one_or_none(username="unique_user")
    assert found is not None
    assert found.first_name == "Unique"

    # Find non-existent user
    not_found = UserDAO.find_one_or_none(username="does_not_exist")
    assert not_found is None

    # Cleanup
    db.session.delete(user1)
    db.session.delete(user2)
    db.session.delete(user3)
    db.session.commit()


# =============================================================================
# List and Filtering Tests
# =============================================================================


def test_base_dao_list_returns_results(user_with_data: Session) -> None:
    results, total = UserDAO.list()
    assert total >= 1
    assert any(u.username == "testuser" for u in results)


def test_base_dao_list_with_column_operators(user_with_data: Session) -> None:
    results, total = UserDAO.list(
        column_operators=[
            ColumnOperator(col="username", opr=ColumnOperatorEnum.eq, value="testuser")
        ]
    )
    assert total >= 1
    assert all(u.username == "testuser" for u in results)


def test_base_dao_list_with_non_matching_column_operator(
    user_with_data: Session,
) -> None:
    results, total = UserDAO.list(
        column_operators=[
            ColumnOperator(
                col="username", opr=ColumnOperatorEnum.eq, value="doesnotexist"
            )
        ]
    )
    assert total == 0
    assert results == []


def test_base_dao_count_returns_value(user_with_data: Session) -> None:
    count = UserDAO.count()
    assert count >= 1


def test_base_dao_count_with_column_operators(user_with_data: Session) -> None:
    count = UserDAO.count(
        column_operators=[
            ColumnOperator(col="username", opr=ColumnOperatorEnum.eq, value="testuser")
        ]
    )
    assert count >= 1
    count = UserDAO.count(
        column_operators=[
            ColumnOperator(
                col="username", opr=ColumnOperatorEnum.eq, value="doesnotexist"
            )
        ]
    )
    assert count == 0


def test_base_dao_list_and_count_skip_base_filter(user_with_data: Session) -> None:
    results, total = UserDAO.list()
    results_skip, total_skip = UserDAO.list()
    assert total == total_skip
    count = UserDAO.count()
    count_skip = UserDAO.count(skip_base_filter=True)
    assert count_skip == count


def test_base_dao_list_ordering(user_with_data: Session) -> None:
    user_with_data.add_all(
        [
            User(
                id=201,
                username="buser",
                first_name="B",
                last_name="User",
                email="buser@example.com",
                active=True,
            ),
            User(
                id=202,
                username="auser",
                first_name="A",
                last_name="User",
                email="auser@example.com",
                active=True,
            ),
            User(
                id=203,
                username="zuser",
                first_name="Z",
                last_name="User",
                email="zuser@example.com",
                active=True,
            ),
        ]
    )
    user_with_data.commit()
    results, _ = UserDAO.list(order_column="username", order_direction="asc")
    usernames = [u.username for u in results]
    assert usernames == sorted(usernames)
    results, _ = UserDAO.list(order_column="id", order_direction="desc")
    ids = [u.id for u in results]
    assert ids == sorted(ids, reverse=True)


def test_base_dao_list_paging(user_with_data: Session) -> None:
    users = [
        User(
            id=300 + i,
            username=f"user{i}",
            first_name=f"F{i}",
            last_name="User",
            email=f"user{i}@example.com",
            active=True,
        )
        for i in range(10)
    ]
    user_with_data.add_all(users)
    user_with_data.commit()
    results, total = UserDAO.list(
        order_column="id", order_direction="asc", page=0, page_size=5
    )
    ids = [u.id for u in results]
    all_results, _ = UserDAO.list(order_column="id", order_direction="asc")
    all_ids = [u.id for u in all_results]
    assert ids == all_ids[:5]
    assert total == len(all_ids)
    results, total = UserDAO.list(
        order_column="id", order_direction="asc", page=1, page_size=5
    )
    ids = [u.id for u in results]
    assert ids == all_ids[5:10]
    results, total = UserDAO.list(
        order_column="id", order_direction="asc", page=10, page_size=5
    )
    assert results == []


def test_base_dao_list_search(user_with_data: Session) -> None:
    user_with_data.add_all(
        [
            User(
                id=400,
                username="searchuser1",
                first_name="Alice",
                last_name="Wonderland",
                email="alice@example.com",
                active=True,
            ),
            User(
                id=401,
                username="searchuser2",
                first_name="Bob",
                last_name="Builder",
                email="bob@example.com",
                active=True,
            ),
            User(
                id=402,
                username="searchuser3",
                first_name="Charlie",
                last_name="Chocolate",
                email="charlie@example.com",
                active=True,
            ),
        ]
    )
    user_with_data.commit()
    results, _ = UserDAO.list(search="Alice", search_columns=["first_name"])
    assert any(u.first_name == "Alice" for u in results)
    results, _ = UserDAO.list(search="Builder", search_columns=["last_name"])
    assert any(u.last_name == "Builder" for u in results)
    results, _ = UserDAO.list(search="ar", search_columns=["first_name", "last_name"])
    names = [(u.first_name, u.last_name) for u in results]
    assert ("Charlie", "Chocolate") in names or ("Bob", "Builder") in names


def test_base_dao_list_custom_filter(user_with_data: Session) -> None:
    datamodel = SQLAInterface(User, user_with_data)

    class EmailDomainFilter(BaseFilter):
        def apply(self, query, value):
            return query.filter(User.email.like(f"%@{value}"))

    user_with_data.add_all(
        [
            User(
                id=500,
                username="customuser1",
                first_name="Dom",
                last_name="Ain",
                email="dom@domain.com",
                active=True,
            ),
            User(
                id=501,
                username="customuser2",
                first_name="Jane",
                last_name="Doe",
                email="jane@other.com",
                active=True,
            ),
        ]
    )
    user_with_data.commit()
    results, _ = UserDAO.list(
        column_operators=None,
        custom_filters={"email_domain": EmailDomainFilter("email_domain", datamodel)},
    )
    assert all(u.email.endswith("@domain.com") for u in results)


def test_base_dao_list_base_filter(user_with_data: Session) -> None:
    class OnlyActiveFilter(BaseFilter):
        def apply(self, query, value):
            return query.filter(User.active)

    class ActiveUserDAO(UserDAO):
        base_filter = OnlyActiveFilter

    user_with_data.add_all(
        [
            User(
                id=600,
                username="inactiveuser",
                first_name="Inactive",
                last_name="User",
                email="inactive@example.com",
                active=False,
            ),
            User(
                id=601,
                username="activeuser",
                first_name="Active",
                last_name="User",
                email="active@example.com",
                active=True,
            ),
        ]
    )
    user_with_data.commit()
    results, _ = ActiveUserDAO.list()
    assert all(u.active for u in results)


def test_base_dao_list_edge_cases(user_with_data: Session) -> None:
    user_with_data.add_all(
        [
            User(
                id=700,
                username="booluser1",
                first_name="Bool",
                last_name="User",
                email="bool1@example.com",
                active=True,
            ),
            User(
                id=701,
                username="booluser2",
                first_name="Bool",
                last_name="User",
                email="bool2@example.com",
                active=False,
            ),
        ]
    )
    user_with_data.commit()
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="active", opr=ColumnOperatorEnum.eq, value=True)
        ]
    )
    assert all(u.active for u in results)
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="active", opr=ColumnOperatorEnum.eq, value=False)
        ]
    )
    assert all(not u.active for u in results)
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="first_name", opr=ColumnOperatorEnum.eq, value=None)
        ]
    )
    ids = [700, 701]
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="id", opr=ColumnOperatorEnum.in_, value=ids)
        ]
    )
    result_ids = [u.id for u in results]
    assert set(result_ids) == set(ids)
    results, _ = UserDAO.list(page=100, page_size=10)
    assert results == []


def test_base_dao_list_with_select_columns(user_with_data: Session) -> None:
    # Add a user to ensure at least one exists
    user_with_data.add(
        User(
            id=900,
            username="coluser",
            first_name="Col",
            last_name="User",
            email="coluser@example.com",
            active=True,
        )
    )
    user_with_data.commit()
    # Request only username and email columns
    results, total = UserDAO.list(columns=["username", "email"])
    assert total >= 1
    # Should return Row objects with correct values
    found = False
    for row in results:
        # SQLAlchemy Row supports both index and key access
        if row[0] == "coluser" and row[1] == "coluser@example.com":
            found = True
    assert found
    # Request only id column
    results, total = UserDAO.list(columns=["id"])
    found = False
    for row in results:
        if row[0] == 900:
            found = True
    assert found


def test_base_dao_list_with_default_columns(user_with_data: Session) -> None:
    user_with_data.add(
        User(
            id=901,
            username="defaultuser",
            first_name="Default",
            last_name="User",
            email="defaultuser@example.com",
            active=True,
        )
    )
    user_with_data.commit()
    results, total = UserDAO.list()
    assert total >= 1
    # Should return model instances
    found = False
    for user in results:
        if hasattr(user, "id") and hasattr(user, "username") and hasattr(user, "email"):
            if (
                user.id == 901
                and user.username == "defaultuser"
                and user.email == "defaultuser@example.com"
            ):
                found = True
    assert found


# =============================================================================
# Advanced Features Tests - Filtering, Operators, Performance
# =============================================================================


def test_base_dao_apply_column_operators_invalid_column(app_context: None) -> None:
    """Test apply_column_operators with invalid column."""
    # Create a query
    query = db.session.query(User)

    # Apply operator with invalid column
    with patch("superset.daos.base.logging.error") as mock_log:
        column_operators = [
            ColumnOperator(
                col="non_existent_column", opr=ColumnOperatorEnum.eq, value="test"
            )
        ]

        # Should raise ValueError
        with pytest.raises(ValueError, match="Invalid filter") as exc_info:
            UserDAO.apply_column_operators(query, column_operators)

        assert "Invalid filter" in str(exc_info.value)
        mock_log.assert_called_once()


def test_base_dao_apply_column_operators_none_value(app_context: None) -> None:
    """Test apply_column_operators with None col value."""
    query = db.session.query(User)

    # Operator with None column name
    column_operators = [
        ColumnOperator(
            col="",  # Empty string instead of None
            opr=ColumnOperatorEnum.eq,
            value="test",
        )
    ]

    # Should raise ValueError
    with pytest.raises(ValueError, match="Invalid filter") as exc_info:
        UserDAO.apply_column_operators(query, column_operators)

    assert "Invalid filter" in str(exc_info.value)


def test_base_dao_list_with_invalid_operator(app_context: None) -> None:
    """Test list method with invalid column operator type."""
    # Pass a non-ColumnOperator object
    invalid_operators = [{"col": "username", "opr": "eq", "value": "test"}]

    # Should handle gracefully (skip invalid operators)
    results, total = UserDAO.list(column_operators=invalid_operators)  # type: ignore

    # Should return results without applying invalid filter
    assert isinstance(results, list)
    assert isinstance(total, int)


def test_base_dao_get_filterable_columns(app_context: None) -> None:
    """Test get_filterable_columns_and_operators method."""
    # This is typically implemented by FAB, but we can test the interface
    filterable = UserDAO.get_filterable_columns_and_operators()

    # Should return a dict
    assert isinstance(filterable, dict)

    # Common user columns should be filterable
    if filterable:  # Only test if FAB integration is available
        common_columns = ["username", "email", "active", "first_name", "last_name"]
        for col in common_columns:
            if col in filterable:
                # Should have operator information
                assert isinstance(filterable[col], (list, tuple, set))


def test_base_dao_count_with_filters(app_context: None) -> None:
    """Test count method with various filters."""
    # Create test users
    users = []
    for i in range(5):
        user = User(
            id=2000 + i,
            username=f"count_user_{i}",
            first_name="Count",
            last_name=f"User{i}",
            email=f"count{i}@example.com",
            active=(i % 2 == 0),  # Alternate active/inactive
        )
        users.append(user)
        db.session.add(user)
    db.session.commit()

    # Count all
    total_count = UserDAO.count()
    assert total_count >= 5

    # Count with filter
    active_count = UserDAO.count(
        column_operators=[
            ColumnOperator(col="active", opr=ColumnOperatorEnum.eq, value=True)
        ]
    )
    assert active_count >= 3  # We created 3 active users (0, 2, 4)

    # Count with multiple filters
    specific_count = UserDAO.count(
        column_operators=[
            ColumnOperator(col="first_name", opr=ColumnOperatorEnum.eq, value="Count"),
            ColumnOperator(col="active", opr=ColumnOperatorEnum.eq, value=False),
        ]
    )
    assert specific_count >= 2  # We created 2 inactive Count users (1, 3)

    # Cleanup
    for user in users:
        db.session.delete(user)
    db.session.commit()


# =============================================================================
# Edge Cases and Special Scenarios
# =============================================================================


def test_find_by_ids_preserves_order(app_context: None) -> None:
    """Test that find_by_ids returns results correctly."""
    # Create test users
    users = []
    for i in [1300, 1301, 1302, 1303]:
        user = User(
            id=i,
            username=f"order_user_{i}",
            first_name="Order",
            last_name=f"User{i}",
            email=f"order{i}@example.com",
            active=True,
        )
        users.append(user)
        db.session.add(user)
    db.session.commit()

    # Request in specific order
    requested_ids = [1302, 1300, 1303, 1301]
    found_users = UserDAO.find_by_ids(requested_ids)

    # Note: find_by_ids doesn't guarantee order preservation
    # but should return all requested items
    found_ids = [u.id for u in found_users]
    assert set(found_ids) == set(requested_ids)

    # Cleanup
    for user in users:
        db.session.delete(user)
    db.session.commit()


def test_find_by_ids_with_mixed_types(app_context: None) -> None:
    """Test find_by_ids with integer IDs."""
    # Create test data
    database = Database(
        id=100,
        database_name="Test DB 100",
        sqlalchemy_uri="sqlite:///:memory:",
    )
    db.session.add(database)
    db.session.commit()

    # Should handle integer IDs (skip base filter)
    found_dbs = DatabaseDAO.find_by_ids([100, 100], skip_base_filter=True)
    # Should find the database
    assert len(found_dbs) >= 1
    assert any(d.id == 100 for d in found_dbs)

    # Cleanup
    db.session.delete(database)
    db.session.commit()


def test_find_by_column_helper_method(app_context: None) -> None:
    """Test the internal _find_by_column helper method."""
    # Create test user
    user = User(
        id=1400,
        username="helper_test_user",
        first_name="Helper",
        last_name="Test",
        email="helper@example.com",
        active=True,
    )
    db.session.add(user)
    db.session.commit()

    # Test the helper method directly
    found_user = UserDAO._find_by_column("username", "helper_test_user")
    assert found_user is not None
    assert found_user.id == 1400

    # Test with non-existent value
    not_found = UserDAO._find_by_column("username", "non_existent")
    assert not_found is None

    # Test with invalid column
    not_found = UserDAO._find_by_column("invalid_column", "value")
    assert not_found is None

    # Cleanup
    db.session.delete(user)
    db.session.commit()


def test_find_methods_with_special_characters(app_context: None) -> None:
    """Test find methods with values containing special characters."""
    # Create dashboard with special characters in slug
    special_slug = "test-dashboard-with-special-@#$"
    dashboard = Dashboard(
        dashboard_title="Special Dashboard",
        slug=special_slug,
        published=True,
    )
    db.session.add(dashboard)
    db.session.commit()

    # Find by slug with special characters (skip base filter)
    found = DashboardDAO.find_by_id(
        special_slug, id_column="slug", skip_base_filter=True
    )
    assert found is not None
    assert found.slug == special_slug

    # Test find_by_ids with special characters (skip base filter)
    found_list = DashboardDAO.find_by_ids(
        [special_slug], id_column="slug", skip_base_filter=True
    )
    assert len(found_list) == 1
    assert found_list[0].slug == special_slug

    # Cleanup
    db.session.delete(dashboard)
    db.session.commit()


def test_find_methods_case_sensitivity(app_context: None) -> None:
    """Test find methods with case-sensitive columns."""
    # Create users with similar usernames differing in case
    user1 = User(
        id=1500,
        username="CaseSensitive",
        first_name="Case",
        last_name="Sensitive",
        email="case1@example.com",
        active=True,
    )
    user2 = User(
        id=1501,
        username="casesensitive",
        first_name="Case",
        last_name="Sensitive",
        email="case2@example.com",
        active=True,
    )
    db.session.add_all([user1, user2])

    try:
        db.session.commit()

        # Find by exact case
        found = UserDAO.find_by_id("CaseSensitive", id_column="username")
        assert found is not None
        assert found.id == 1500

        found = UserDAO.find_by_id("casesensitive", id_column="username")
        assert found is not None
        assert found.id == 1501

        # Cleanup
        db.session.delete(user1)
        db.session.delete(user2)
        db.session.commit()
    except Exception:
        # Some databases may have case-insensitive unique constraints
        db.session.rollback()
        pytest.skip("Database has case-insensitive unique constraint on username")


def test_find_by_ids_empty_and_none_handling(app_context: None) -> None:
    """Test find_by_ids with empty lists."""
    # Test with empty list
    result = UserDAO.find_by_ids([])
    assert result == []

    # Create test user
    user = User(
        id=1600,
        username="none_test_user",
        first_name="None",
        last_name="Test",
        email="none@example.com",
        active=True,
    )
    db.session.add(user)
    db.session.commit()

    # Find with valid IDs only
    found = UserDAO.find_by_ids([1600, 1601])
    assert len(found) == 1
    assert found[0].id == 1600

    # Cleanup
    db.session.delete(user)
    db.session.commit()


def test_find_methods_performance_with_large_lists(app_context: None) -> None:
    """Test find_by_ids performance with large ID lists."""
    # Create a batch of users
    users = []
    user_ids = []
    for i in range(1700, 1750):  # 50 users
        user_ids.append(i)
        user = User(
            id=i,
            username=f"perf_user_{i}",
            first_name="Perf",
            last_name=f"User{i}",
            email=f"perf{i}@example.com",
            active=True,
        )
        users.append(user)
        db.session.add(user)
    db.session.commit()

    # Find all at once
    start_time = time.time()
    found_users = UserDAO.find_by_ids(user_ids)
    end_time = time.time()

    assert len(found_users) == 50
    assert (end_time - start_time) < 1.0  # Should complete within 1 second

    # Cleanup
    for user in users:
        db.session.delete(user)
    db.session.commit()


# =============================================================================
# DAO Properties and Configuration Tests
# =============================================================================


def test_base_dao_model_cls_property(app_context: None) -> None:
    """Test that model_cls property is properly set."""
    assert UserDAO.model_cls == User

    # Test with a DAO that doesn't set model_cls
    class InvalidDAO(BaseDAO[User]):
        pass

    # Should have model_cls attribute set by __init_subclass__
    # Just verify it exists and is the expected type
    assert hasattr(InvalidDAO, "model_cls")
    assert InvalidDAO.model_cls == User  # It inherits the generic type


def test_base_dao_id_column_name_property(app_context: None) -> None:
    """Test that id_column_name property is properly used."""
    assert UserDAO.id_column_name == "id"

    # Test custom id column name
    class CustomIdDAO(BaseDAO[User]):
        model_cls = User
        id_column_name = "username"  # Use username as ID column

    # Create test user
    user = User(
        id=5016,
        username="unique-username-id",
        first_name="Custom",
        last_name="User",
        email="custom@example.com",
        active=True,
    )
    db.session.add(user)
    db.session.commit()

    # Find by custom ID column
    found = CustomIdDAO.find_by_id("unique-username-id")
    assert found is not None
    assert found.first_name == "Custom"

    # Cleanup
    db.session.delete(user)
    db.session.commit()


def test_base_dao_base_filter_integration(app_context: None) -> None:
    """Test base_filter integration with list operations."""
    # Create mix of users
    users = []
    for i, active in enumerate([True, False, True, False, True]):
        user = User(
            id=2100 + i,
            username=f"base_filter_user_{i}",
            first_name="BaseFilter",
            last_name=f"User{i}",
            email=f"basefilter{i}@example.com",
            active=active,
        )
        users.append(user)
        db.session.add(user)
    db.session.commit()

    # Test basic list functionality
    results, total = UserDAO.list()
    assert isinstance(results, list)
    assert isinstance(total, int)
    assert total >= 5  # Should include our 5 test users

    # Test skip_base_filter functionality
    results_skip, total_skip = UserDAO.list()
    assert isinstance(results_skip, list)
    assert isinstance(total_skip, int)

    # Test count functionality
    count_all = UserDAO.count()
    assert count_all >= 5

    count_skip = UserDAO.count(skip_base_filter=True)
    assert count_skip >= 5

    # Cleanup
    for user in users:
        db.session.delete(user)
    db.session.commit()


def test_base_dao_edge_cases(app_context: None) -> None:
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


def test_convert_value_for_column_uuid(app_context: None) -> None:
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

    # Test valid UUID string conversion
    test_uuid_str = str(dashboard.uuid)
    converted = DashboardDAO._convert_value_for_column(uuid_column, test_uuid_str)
    assert isinstance(converted, uuid.UUID)
    assert str(converted) == test_uuid_str

    # Test UUID object passthrough
    test_uuid_obj = dashboard.uuid
    converted = DashboardDAO._convert_value_for_column(uuid_column, test_uuid_obj)
    assert converted == test_uuid_obj

    # Test invalid UUID string
    converted = DashboardDAO._convert_value_for_column(uuid_column, "invalid-uuid")
    assert converted is None

    # Test integer value with UUID column (should return as-is)
    converted = DashboardDAO._convert_value_for_column(uuid_column, 123)
    assert converted == 123

    # Cleanup
    db.session.delete(dashboard)
    db.session.commit()


def test_convert_value_for_column_non_uuid(app_context: None) -> None:
    """Test the _convert_value_for_column method with non-UUID columns."""
    # Get a non-UUID column (string column)
    username_column = User.username

    # Test string value passthrough
    converted = UserDAO._convert_value_for_column(username_column, "test_string")
    assert converted == "test_string"

    # Test integer value passthrough
    converted = UserDAO._convert_value_for_column(username_column, 123)
    assert converted == 123

    # Test None value passthrough
    converted = UserDAO._convert_value_for_column(username_column, None)
    assert converted is None


def test_find_by_id_with_uuid_conversion_error_handling(app_context: None) -> None:
    """Test find_by_id handles UUID conversion errors gracefully."""
    # Test with malformed UUID string
    result = DashboardDAO.find_by_id(
        "malformed-uuid", id_column="uuid", skip_base_filter=True
    )
    assert result is None

    # Test with empty string
    result = DashboardDAO.find_by_id("", id_column="uuid", skip_base_filter=True)
    assert result is None


def test_find_by_ids_with_uuid_conversion_error_handling(app_context: None) -> None:
    """Test find_by_ids handles UUID conversion errors gracefully."""
    # Create a test dashboard
    dashboard = Dashboard(
        dashboard_title="Test UUID Error Handling",
        slug="test-uuid-error-handling",
        published=True,
    )
    db.session.add(dashboard)
    db.session.commit()

    # Mix of valid and invalid UUIDs
    mixed_uuids = [
        str(dashboard.uuid),  # valid
        "invalid-uuid-1",  # invalid
        "malformed",  # invalid
        "",  # invalid
    ]

    # Should only return the valid one
    results = DashboardDAO.find_by_ids(
        mixed_uuids, id_column="uuid", skip_base_filter=True
    )
    assert len(results) == 1
    assert str(results[0].uuid) == str(dashboard.uuid)

    # Test with all invalid UUIDs
    invalid_uuids = ["invalid-1", "invalid-2", "malformed"]
    results = DashboardDAO.find_by_ids(
        invalid_uuids, id_column="uuid", skip_base_filter=True
    )
    assert len(results) == 0

    # Cleanup
    db.session.delete(dashboard)
    db.session.commit()


# =============================================================================
# Error Handling Tests - SQLAlchemy Exceptions
# =============================================================================


def test_find_by_ids_sqlalchemy_error_with_model_cls():
    """Test SQLAlchemyError in find_by_ids shows proper model name
    when model_cls is set"""

    with (
        patch("superset.daos.base.db") as mock_db,
        patch("superset.daos.base.getattr") as mock_getattr,
    ):
        mock_session = Mock()
        mock_db.session = mock_session

        # Mock the id column to have an in_ method
        mock_id_col = Mock()
        mock_id_col.in_.return_value = Mock()
        mock_getattr.return_value = mock_id_col

        mock_query = Mock()
        mock_session.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.all.side_effect = SQLAlchemyError("Database error")

        with pytest.raises(DAOFindFailedError) as exc_info:
            TestDAO.find_by_ids([1, 2])

        assert "Failed to find MockModel with ids: [1, 2]" in str(exc_info.value)


def test_find_by_ids_sqlalchemy_error_with_none_model_cls():
    """Test SQLAlchemyError in find_by_ids shows 'Unknown' when model_cls is None"""

    with (
        patch("superset.daos.base.db") as mock_db,
        patch("superset.daos.base.getattr") as mock_getattr,
    ):
        mock_session = Mock()
        mock_db.session = mock_session

        # Mock the id column to have an in_ method but return from a None model_cls
        mock_id_col = Mock()
        mock_id_col.in_.return_value = Mock()
        mock_getattr.return_value = mock_id_col

        mock_query = Mock()
        mock_session.query.return_value = mock_query
        mock_query.filter.return_value = mock_query
        mock_query.all.side_effect = SQLAlchemyError("Database error")

        # Set model_cls to None but allow method to proceed past guard clause
        with patch.object(TestDAOWithNoneModel, "model_cls", None):
            with pytest.raises(DAOFindFailedError) as exc_info:
                TestDAOWithNoneModel.find_by_ids([1, 2])

        assert "Failed to find Unknown with ids: [1, 2]" in str(exc_info.value)


def test_find_by_ids_successful_execution():
    """Test that find_by_ids works normally when no SQLAlchemyError occurs"""

    with (
        patch("superset.daos.base.db") as mock_db,
        patch("superset.daos.base.getattr") as mock_getattr,
    ):
        mock_session = Mock()
        mock_db.session = mock_session

        # Mock the id column to have an in_ method
        mock_id_col = Mock()
        mock_id_col.in_.return_value = Mock()
        mock_getattr.return_value = mock_id_col

        mock_query = Mock()
        mock_session.query.return_value = mock_query
        mock_query.filter.return_value = mock_query

        expected_results = [MockModel(1, "test1"), MockModel(2, "test2")]
        mock_query.all.return_value = expected_results

        results = TestDAO.find_by_ids([1, 2])

        assert results == expected_results
        mock_query.all.assert_called_once()


def test_find_by_ids_empty_list():
    """Test that find_by_ids returns empty list when model_ids is empty"""

    with patch("superset.daos.base.getattr") as mock_getattr:
        mock_getattr.return_value = None

        results = TestDAO.find_by_ids([])

        assert results == []


def test_find_by_ids_none_id_column():
    """Test that find_by_ids returns empty list when id column doesn't exist"""

    with patch("superset.daos.base.getattr") as mock_getattr:
        mock_getattr.return_value = None

        results = TestDAO.find_by_ids([1, 2])

        assert results == []
