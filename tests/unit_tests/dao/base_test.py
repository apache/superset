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

from sqlalchemy.orm.session import Session
from flask_appbuilder.models.filters import BaseFilter
import pytest

def test_base_dao_list_returns_results(user_with_data: Session) -> None:
    """Test that BaseDAO.list returns results for the model."""
    from superset.daos.user import UserDAO
    results, total = UserDAO.list()
    assert total >= 1
    assert any(u.username == "testuser" for u in results)


def test_base_dao_list_with_filters(user_with_data: Session) -> None:
    """Test that BaseDAO.list applies filters correctly."""
    from superset.daos.user import UserDAO
    results, total = UserDAO.list(filters={"username": "testuser"})
    assert total >= 1
    assert all(u.username == "testuser" for u in results)


def test_base_dao_list_with_non_matching_filter(user_with_data: Session) -> None:
    """Test that BaseDAO.list returns empty for non-matching filters."""
    from superset.daos.user import UserDAO
    results, total = UserDAO.list(filters={"username": "doesnotexist"})
    assert total == 0
    assert results == []


def test_base_dao_count_returns_value(user_with_data: Session) -> None:
    """Test that BaseDAO.count returns a count for the model."""
    from superset.daos.user import UserDAO
    count = UserDAO.count()
    assert count >= 1


def test_base_dao_count_with_filters(user_with_data: Session) -> None:
    """Test that BaseDAO.count applies filters correctly."""
    from superset.daos.user import UserDAO
    count = UserDAO.count(filters={"username": "testuser"})
    assert count >= 1
    count = UserDAO.count(filters={"username": "doesnotexist"})
    assert count == 0


def test_base_dao_list_and_count_skip_base_filter(user_with_data: Session) -> None:
    """Test that skip_base_filter argument works for list and count."""
    from superset.daos.user import UserDAO
    results, total = UserDAO.list()
    results_skip, total_skip = UserDAO.list()
    assert total == total_skip
    count = UserDAO.count()
    count_skip = UserDAO.count(skip_base_filter=True)
    assert count_skip == count 


def test_base_dao_list_ordering(user_with_data: Session) -> None:
    from superset.daos.user import UserDAO
    from flask_appbuilder.security.sqla.models import User
    # Add users for ordering
    user_with_data.add_all([
        User(id=201, username="buser", first_name="B", last_name="User", email="buser@example.com", active=True),
        User(id=202, username="auser", first_name="A", last_name="User", email="auser@example.com", active=True),
        User(id=203, username="zuser", first_name="Z", last_name="User", email="zuser@example.com", active=True),
    ])
    user_with_data.commit()
    # Ascending order by username
    results, _ = UserDAO.list(order_column="username", order_direction="asc")
    usernames = [u.username for u in results]
    assert usernames == sorted(usernames)
    # Descending order by id
    results, _ = UserDAO.list(order_column="id", order_direction="desc")
    ids = [u.id for u in results]
    assert ids == sorted(ids, reverse=True)


def test_base_dao_list_paging(user_with_data: Session) -> None:
    from superset.daos.user import UserDAO
    from flask_appbuilder.security.sqla.models import User
    # Add users for paging
    users = [User(id=300 + i, username=f"user{i}", first_name=f"F{i}", last_name="User", email=f"user{i}@example.com", active=True) for i in range(10)]
    user_with_data.add_all(users)
    user_with_data.commit()
    # Page 1, size 5
    results, total = UserDAO.list(order_column="id", order_direction="asc", page=0, page_size=5)
    ids = [u.id for u in results]
    all_results, _ = UserDAO.list(order_column="id", order_direction="asc")
    all_ids = [u.id for u in all_results]
    assert ids == all_ids[:5]
    assert total == len(all_ids)
    # Page 2, size 5
    results, total = UserDAO.list(order_column="id", order_direction="asc", page=1, page_size=5)
    ids = [u.id for u in results]
    assert ids == all_ids[5:10]
    # Out-of-range page
    results, total = UserDAO.list(order_column="id", order_direction="asc", page=10, page_size=5)
    assert results == []


def test_base_dao_list_search(user_with_data: Session) -> None:
    from superset.daos.user import UserDAO
    from flask_appbuilder.security.sqla.models import User
    user_with_data.add_all([
        User(id=400, username="searchuser1", first_name="Alice", last_name="Wonderland", email="alice@example.com", active=True),
        User(id=401, username="searchuser2", first_name="Bob", last_name="Builder", email="bob@example.com", active=True),
        User(id=402, username="searchuser3", first_name="Charlie", last_name="Chocolate", email="charlie@example.com", active=True),
    ])
    user_with_data.commit()
    # Search for 'Alice' in first_name
    results, _ = UserDAO.list(search="Alice", search_columns=["first_name"])
    assert any(u.first_name == "Alice" for u in results)
    # Search for 'Builder' in last_name
    results, _ = UserDAO.list(search="Builder", search_columns=["last_name"])
    assert any(u.last_name == "Builder" for u in results)
    # Search for 'ar' in first_name or last_name
    results, _ = UserDAO.list(search="ar", search_columns=["first_name", "last_name"])
    names = [(u.first_name, u.last_name) for u in results]
    assert ("Charlie", "Chocolate") in names or ("Bob", "Builder") in names


def test_base_dao_list_custom_filter(user_with_data: Session) -> None:
    from superset.daos.user import UserDAO
    from flask_appbuilder.security.sqla.models import User
    from flask_appbuilder.models.sqla.interface import SQLAInterface
    datamodel = SQLAInterface(User, user_with_data)
    class EmailDomainFilter(BaseFilter):
        def apply(self, query, value):
            return query.filter(User.email.like(f"%@{value}"))
    user_with_data.add_all([
        User(id=500, username="customuser1", first_name="Dom", last_name="Ain", email="dom@domain.com", active=True),
        User(id=501, username="customuser2", first_name="Jane", last_name="Doe", email="jane@other.com", active=True),
    ])
    user_with_data.commit()
    results, _ = UserDAO.list(
        filters={"email_domain": "domain.com"},
        custom_filters={"email_domain": EmailDomainFilter("email_domain", datamodel)},
    )
    assert all(u.email.endswith("@domain.com") for u in results)


def test_base_dao_list_base_filter(user_with_data: Session) -> None:
    from superset.daos.user import UserDAO
    from flask_appbuilder.security.sqla.models import User
    class OnlyActiveFilter(BaseFilter):
        def apply(self, query, value):
            return query.filter(User.active == True)
    class ActiveUserDAO(UserDAO):
        base_filter = OnlyActiveFilter
    user_with_data.add_all([
        User(id=600, username="inactiveuser", first_name="Inactive", last_name="User", email="inactive@example.com", active=False),
        User(id=601, username="activeuser", first_name="Active", last_name="User", email="active@example.com", active=True),
    ])
    user_with_data.commit()
    results, _ = ActiveUserDAO.list()
    assert all(u.active for u in results)


def test_base_dao_list_edge_cases(user_with_data: Session) -> None:
    from superset.daos.user import UserDAO
    from flask_appbuilder.security.sqla.models import User
    # Boolean filtering
    user_with_data.add_all([
        User(id=700, username="booluser1", first_name="Bool", last_name="User", email="bool1@example.com", active=True),
        User(id=701, username="booluser2", first_name="Bool", last_name="User", email="bool2@example.com", active=False),
    ])
    user_with_data.commit()
    results, _ = UserDAO.list(filters={"active": True})
    assert all(u.active for u in results)
    results, _ = UserDAO.list(filters={"active": False})
    assert all(not u.active for u in results)
    # None filtering (should not filter out any rows)
    results, _ = UserDAO.list(filters={"first_name": None})
    # IN query (simulate by passing a list)
    ids = [700, 701]
    results, _ = UserDAO.list(filters={"id": ids})
    result_ids = [u.id for u in results]
    assert set(result_ids) == set(ids)
    # Out-of-range pagination
    results, _ = UserDAO.list(page=100, page_size=10)
    assert results == [] 
