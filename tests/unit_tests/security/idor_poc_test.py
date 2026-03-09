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

from unittest.mock import MagicMock, patch

from superset.commands.sql_lab.estimate import QueryEstimationCommand
from superset.commands.sql_lab.results import SqlExecutionResultsCommand
from superset.daos.database import DatabaseDAO
from superset.daos.datasource import DatasourceDAO
from superset.models.core import Database
from superset.views.users.api import UserRestApi


def test_datasource_dao_idor_mitigation():
    # Scenario: Verify DatasourceDAO.get_datasource calls raise_for_access
    with patch("superset.daos.datasource.db.session.query") as mock_query:
        mock_ds = MagicMock()
        mock_query.return_value.filter.return_value.one_or_none.return_value = mock_ds

        with (
            patch(
                "superset.daos.datasource.security_manager.raise_for_access"
            ) as mock_raise,
            patch("flask.g") as mock_g,
        ):
            mock_g.user = MagicMock()
            mock_g.user.is_anonymous = False
            DatasourceDAO.get_datasource("table", 1)
            # Verification: raise_for_access was called with the datasource
            mock_raise.assert_called_with(datasource=mock_ds)


def test_database_dao_idor_mitigation():
    # Scenario: Verify DatabaseDAO.get_with_check calls raise_for_access
    with patch("superset.daos.database.db.session.query") as mock_query:
        # Create a spec-based mock so isinstance(mock_db, Database) works
        mock_db = MagicMock(spec=Database)
        # Mocking find_by_id logic
        mock_filter = mock_query.return_value.options.return_value.filter
        mock_filter.return_value.one_or_none.return_value = mock_db

        # Mock g.user to avoid AttributeError in filters
        with (
            patch("superset.daos.base.security_manager.raise_for_access") as mock_raise,
            patch(
                "superset.daos.base.security_manager.can_access_all_databases",
                return_value=True,
            ),
            patch("flask.g") as mock_g,
        ):
            mock_g.user = MagicMock()
            mock_g.user.is_anonymous = False
            DatabaseDAO.get_with_check(1)
            # Verification: raise_for_access was called with the database keyword
            mock_raise.assert_called_with(database=mock_db)


def test_user_avatar_idor_mitigation():
    # Scenario: Verify UserRestApi.avatar now calls UserDAO.get_with_check
    with patch("superset.views.users.api.UserDAO.get_with_check") as mock_get:
        mock_user = MagicMock()
        mock_user.extra_attributes = []
        mock_get.return_value = mock_user

        api = UserRestApi()
        api.avatar(user_id=1)
        assert mock_get.called, (
            "MITIGATION FAILURE: UserRestApi.avatar did not call get_with_check"
        )


def test_query_estimation_idor_mitigation():
    # Scenario: Verify QueryEstimationCommand.validate calls raise_for_access
    with patch("superset.commands.sql_lab.estimate.db.session.query") as mock_query:
        mock_db = MagicMock()
        mock_query.return_value.get.return_value = mock_db

        params = {"database_id": 1, "sql": "SELECT 1"}
        command = QueryEstimationCommand(params)

        with (
            patch(
                "superset.commands.sql_lab.estimate.security_manager.raise_for_access"
            ) as mock_raise,
            patch("flask.g") as mock_g,
        ):
            mock_g.user = MagicMock()
            mock_g.user.is_anonymous = False
            command.validate()
            # Verification: raise_for_access was called with the database
            mock_raise.assert_called_with(database=mock_db)


def test_sql_results_idor_mitigation():
    # Scenario: Verify SqlExecutionResultsCommand.validate calls raise_for_access
    with patch("superset.commands.sql_lab.results.db.session.query") as mock_query:
        mock_query_obj = MagicMock()
        mock_query_obj.results_key = "some_key"
        mock_query_obj.user_id = 999  # Different user
        mock_query.return_value.filter_by.return_value.one_or_none.return_value = (
            mock_query_obj
        )

        with patch("superset.commands.sql_lab.results.results_backend") as mock_backend:
            mock_backend.get.return_value = b"blob"
            command = SqlExecutionResultsCommand(key="some_key")

            with (
                patch(
                    "superset.commands.sql_lab.results.security_manager.raise_for_access"
                ) as mock_raise,
                patch("flask.g") as mock_g,
            ):
                mock_g.user = MagicMock()
                mock_g.user.is_anonymous = False
                command.validate()
                # Verification: raise_for_access was called with the query
                mock_raise.assert_called_with(query=mock_query_obj)
