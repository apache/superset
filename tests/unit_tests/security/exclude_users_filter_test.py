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

from flask_appbuilder.models.sqla.interface import SQLAInterface
from flask_appbuilder.security.sqla.models import User
from pytest_mock import MockerFixture
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from superset.security.manager import ExcludeUsersFilter, SupersetSecurityManager


def test_exclude_users_filter_no_exclusions(mocker: MockerFixture) -> None:
    """
    Test ExcludeUsersFilter when no users are configured for exclusion.

    The query should be returned unmodified.
    """
    mocker.patch(
        "superset.security.manager.current_app.config",
        {"EXCLUDE_USERS_FROM_LISTS": None},
    )
    mocker.patch.object(
        SupersetSecurityManager,
        "get_exclude_users_from_lists",
        return_value=[],
    )

    engine = create_engine("sqlite://")
    Session = sessionmaker(bind=engine)  # noqa: N806
    session = Session()
    query = session.query(User)

    filter_ = ExcludeUsersFilter("username", SQLAInterface(User))
    filtered_query = filter_.apply(query, None)

    assert filtered_query == query


def test_exclude_users_filter_with_config(mocker: MockerFixture) -> None:
    """
    Test ExcludeUsersFilter when EXCLUDE_USERS_FROM_LISTS config is set.
    """
    mocker.patch(
        "superset.security.manager.current_app.config",
        {"EXCLUDE_USERS_FROM_LISTS": ["service_account", "automation_user"]},
    )

    engine = create_engine("sqlite://")
    Session = sessionmaker(bind=engine)  # noqa: N806
    session = Session()
    query = session.query(User)

    filter_ = ExcludeUsersFilter("username", SQLAInterface(User))
    filtered_query = filter_.apply(query, None)

    compiled_query = filtered_query.statement.compile(
        engine,
        compile_kwargs={"literal_binds": True},
    )
    query_str = str(compiled_query)

    assert "ab_user.username NOT IN" in query_str
    assert "service_account" in query_str
    assert "automation_user" in query_str


def test_exclude_users_filter_with_security_manager(mocker: MockerFixture) -> None:
    """
    Test ExcludeUsersFilter when EXCLUDE_USERS_FROM_LISTS is None
    and security manager provides the exclusion list.
    """
    mocker.patch(
        "superset.security.manager.current_app.config",
        {"EXCLUDE_USERS_FROM_LISTS": None},
    )
    mocker.patch.object(
        SupersetSecurityManager,
        "get_exclude_users_from_lists",
        return_value=["gamma", "guest"],
    )

    engine = create_engine("sqlite://")
    Session = sessionmaker(bind=engine)  # noqa: N806
    session = Session()
    query = session.query(User)

    filter_ = ExcludeUsersFilter("username", SQLAInterface(User))
    filtered_query = filter_.apply(query, None)

    compiled_query = filtered_query.statement.compile(
        engine,
        compile_kwargs={"literal_binds": True},
    )
    query_str = str(compiled_query)

    assert "ab_user.username NOT IN" in query_str
    assert "gamma" in query_str
    assert "guest" in query_str


def test_exclude_users_filter_config_takes_precedence(mocker: MockerFixture) -> None:
    """
    Test that EXCLUDE_USERS_FROM_LISTS config takes precedence over
    security manager's get_exclude_users_from_lists method.
    """
    mocker.patch(
        "superset.security.manager.current_app.config",
        {"EXCLUDE_USERS_FROM_LISTS": ["config_user"]},
    )
    # This should NOT be called when config is set
    get_exclude_mock = mocker.patch.object(
        SupersetSecurityManager,
        "get_exclude_users_from_lists",
        return_value=["sm_user"],
    )

    engine = create_engine("sqlite://")
    Session = sessionmaker(bind=engine)  # noqa: N806
    session = Session()
    query = session.query(User)

    filter_ = ExcludeUsersFilter("username", SQLAInterface(User))
    filtered_query = filter_.apply(query, None)

    compiled_query = filtered_query.statement.compile(
        engine,
        compile_kwargs={"literal_binds": True},
    )
    query_str = str(compiled_query)

    # Config user should be excluded
    assert "config_user" in query_str
    # SM user should NOT be in the query (config takes precedence)
    assert "sm_user" not in query_str
    # get_exclude_users_from_lists should not be called when config is set
    get_exclude_mock.assert_not_called()
