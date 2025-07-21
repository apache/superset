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

from superset.daos.base import ColumnOperator, ColumnOperatorEnum


def test_base_dao_list_returns_results(user_with_data: Session) -> None:
    from superset.daos.user import UserDAO

    results, total = UserDAO.list()
    assert total >= 1
    assert any(u.username == "testuser" for u in results)


def test_base_dao_list_with_column_operators(user_with_data: Session) -> None:
    from superset.daos.user import UserDAO

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
    from superset.daos.user import UserDAO

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
    from superset.daos.user import UserDAO

    count = UserDAO.count()
    assert count >= 1


def test_base_dao_count_with_column_operators(user_with_data: Session) -> None:
    from superset.daos.user import UserDAO

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
    from superset.daos.user import UserDAO

    results, total = UserDAO.list()
    results_skip, total_skip = UserDAO.list()
    assert total == total_skip
    count = UserDAO.count()
    count_skip = UserDAO.count(skip_base_filter=True)
    assert count_skip == count


def test_base_dao_list_ordering(user_with_data: Session) -> None:
    from flask_appbuilder.security.sqla.models import User

    from superset.daos.user import UserDAO

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
    from flask_appbuilder.security.sqla.models import User

    from superset.daos.user import UserDAO

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
    from flask_appbuilder.security.sqla.models import User

    from superset.daos.user import UserDAO

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
    from flask_appbuilder.models.filters import BaseFilter
    from flask_appbuilder.models.sqla.interface import SQLAInterface
    from flask_appbuilder.security.sqla.models import User

    from superset.daos.user import UserDAO

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
    from flask_appbuilder.models.filters import BaseFilter
    from flask_appbuilder.security.sqla.models import User

    from superset.daos.user import UserDAO

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
    from flask_appbuilder.security.sqla.models import User

    from superset.daos.user import UserDAO

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


def test_base_dao_column_operator_ne(user_with_data: Session) -> None:
    from flask_appbuilder.security.sqla.models import User

    from superset.daos.user import UserDAO

    user_with_data.add(
        User(
            id=800,
            username="neuser",
            first_name="NotEqual",
            last_name="User",
            email="neuser@example.com",
            active=True,
        )
    )
    user_with_data.commit()
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="username", opr=ColumnOperatorEnum.ne, value="otheruser")
        ]
    )
    assert any(u.username == "neuser" for u in results)
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="username", opr=ColumnOperatorEnum.ne, value="neuser")
        ]
    )
    assert all(u.username != "neuser" for u in results)


def test_base_dao_column_operator_sw(user_with_data: Session) -> None:
    from flask_appbuilder.security.sqla.models import User

    from superset.daos.user import UserDAO

    user_with_data.add(
        User(
            id=801,
            username="swuser",
            first_name="Start",
            last_name="With",
            email="swuser@example.com",
            active=True,
        )
    )
    user_with_data.commit()
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="username", opr=ColumnOperatorEnum.sw, value="sw")
        ]
    )
    assert any(u.username == "swuser" for u in results)
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="username", opr=ColumnOperatorEnum.sw, value="nope")
        ]
    )
    assert all(u.username != "swuser" for u in results)


def test_base_dao_column_operator_ew(user_with_data: Session) -> None:
    from flask_appbuilder.security.sqla.models import User

    from superset.daos.user import UserDAO

    user_with_data.add(
        User(
            id=802,
            username="ewuser",
            first_name="End",
            last_name="With",
            email="ewuser@example.com",
            active=True,
        )
    )
    user_with_data.commit()
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="username", opr=ColumnOperatorEnum.ew, value="user")
        ]
    )
    assert any(u.username == "ewuser" for u in results)
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="username", opr=ColumnOperatorEnum.ew, value="nope")
        ]
    )
    assert all(u.username != "ewuser" for u in results)


def test_base_dao_column_operator_nin(user_with_data: Session) -> None:
    from flask_appbuilder.security.sqla.models import User

    from superset.daos.user import UserDAO

    user_with_data.add(
        User(
            id=803,
            username="ninuser",
            first_name="Not",
            last_name="In",
            email="ninuser@example.com",
            active=True,
        )
    )
    user_with_data.commit()
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(
                col="username", opr=ColumnOperatorEnum.nin, value=["otheruser"]
            )
        ]
    )
    assert any(u.username == "ninuser" for u in results)
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(
                col="username", opr=ColumnOperatorEnum.nin, value=["ninuser"]
            )
        ]
    )
    assert all(u.username != "ninuser" for u in results)


def test_base_dao_column_operator_gt(user_with_data: Session) -> None:
    from flask_appbuilder.security.sqla.models import User

    from superset.daos.user import UserDAO

    user_with_data.add(
        User(
            id=804,
            username="gtuser",
            first_name="Greater",
            last_name="Than",
            email="gtuser@example.com",
            active=True,
        )
    )
    user_with_data.commit()
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="id", opr=ColumnOperatorEnum.gt, value=803)
        ]
    )
    assert any(u.id == 804 for u in results)
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="id", opr=ColumnOperatorEnum.gt, value=804)
        ]
    )
    assert all(u.id != 804 for u in results)


def test_base_dao_column_operator_gte(user_with_data: Session) -> None:
    from flask_appbuilder.security.sqla.models import User

    from superset.daos.user import UserDAO

    user_with_data.add(
        User(
            id=805,
            username="gteuser",
            first_name="GreaterEqual",
            last_name="Than",
            email="gteuser@example.com",
            active=True,
        )
    )
    user_with_data.commit()
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="id", opr=ColumnOperatorEnum.gte, value=805)
        ]
    )
    assert any(u.id == 805 for u in results)
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="id", opr=ColumnOperatorEnum.gte, value=806)
        ]
    )
    assert all(u.id != 805 for u in results)


def test_base_dao_column_operator_lt(user_with_data: Session) -> None:
    from flask_appbuilder.security.sqla.models import User

    from superset.daos.user import UserDAO

    user_with_data.add(
        User(
            id=806,
            username="ltuser",
            first_name="Less",
            last_name="Than",
            email="ltuser@example.com",
            active=True,
        )
    )
    user_with_data.commit()
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="id", opr=ColumnOperatorEnum.lt, value=807)
        ]
    )
    assert any(u.id == 806 for u in results)
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="id", opr=ColumnOperatorEnum.lt, value=806)
        ]
    )
    assert all(u.id != 806 for u in results)


def test_base_dao_column_operator_lte(user_with_data: Session) -> None:
    from flask_appbuilder.security.sqla.models import User

    from superset.daos.user import UserDAO

    user_with_data.add(
        User(
            id=807,
            username="lteuser",
            first_name="LessEqual",
            last_name="Than",
            email="lteuser@example.com",
            active=True,
        )
    )
    user_with_data.commit()
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="id", opr=ColumnOperatorEnum.lte, value=807)
        ]
    )
    assert any(u.id == 807 for u in results)
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="id", opr=ColumnOperatorEnum.lte, value=806)
        ]
    )
    assert all(u.id != 807 for u in results)


def test_base_dao_column_operator_like(user_with_data: Session) -> None:
    from flask_appbuilder.security.sqla.models import User

    from superset.daos.user import UserDAO

    user_with_data.add(
        User(
            id=808,
            username="likeuser",
            first_name="Like",
            last_name="Pattern",
            email="likeuser@example.com",
            active=True,
        )
    )
    user_with_data.commit()
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(
                col="username", opr=ColumnOperatorEnum.like, value="%likeuser%"
            )
        ]
    )
    assert any(u.username == "likeuser" for u in results)
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="username", opr=ColumnOperatorEnum.like, value="%nope%")
        ]
    )
    assert all(u.username != "likeuser" for u in results)


def test_base_dao_column_operator_ilike(user_with_data: Session) -> None:
    from flask_appbuilder.security.sqla.models import User

    from superset.daos.user import UserDAO

    user_with_data.add(
        User(
            id=809,
            username="ilikeuser",
            first_name="ILike",
            last_name="Pattern",
            email="ilikeuser@example.com",
            active=True,
        )
    )
    user_with_data.commit()
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(
                col="username", opr=ColumnOperatorEnum.ilike, value="%ILIKEUSER%"
            )
        ]
    )
    assert any(u.username == "ilikeuser" for u in results)
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="username", opr=ColumnOperatorEnum.ilike, value="%nope%")
        ]
    )
    assert all(u.username != "ilikeuser" for u in results)


def test_base_dao_column_operator_is_null(user_with_data: Session) -> None:
    from flask_appbuilder.security.sqla.models import User

    from superset.daos.user import UserDAO

    # last_login is nullable
    user_with_data.add(
        User(
            id=810,
            username="nulluser",
            first_name="Null",
            last_name="Null",
            email="nulluser@example.com",
            active=True,
            last_login=None,
        )
    )
    user_with_data.commit()
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="last_login", opr=ColumnOperatorEnum.is_null)
        ]
    )
    assert any(u.username == "nulluser" for u in results)
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="last_login", opr=ColumnOperatorEnum.is_null)
        ]
    )
    assert all(u.last_login is None for u in results)


def test_base_dao_column_operator_is_not_null(user_with_data: Session) -> None:
    import datetime

    from flask_appbuilder.security.sqla.models import User

    from superset.daos.user import UserDAO

    # last_login is nullable
    user_with_data.add(
        User(
            id=811,
            username="notnulluser",
            first_name="NotNull",
            last_name="NotNull",
            email="notnulluser@example.com",
            active=True,
            last_login=datetime.datetime.utcnow(),
        )
    )
    user_with_data.commit()
    results, _ = UserDAO.list(
        column_operators=[
            ColumnOperator(col="last_login", opr=ColumnOperatorEnum.is_not_null)
        ]
    )
    assert any(u.username == "notnulluser" for u in results)
    assert all(u.last_login is not None for u in results)


def test_base_dao_list_with_select_columns(user_with_data: Session) -> None:
    # Add a user to ensure at least one exists
    from flask_appbuilder.security.sqla.models import User

    from superset.daos.user import UserDAO

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
    from flask_appbuilder.security.sqla.models import User

    from superset.daos.user import UserDAO

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
