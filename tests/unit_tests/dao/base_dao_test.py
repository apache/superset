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
from unittest.mock import Mock, patch

import pytest
from sqlalchemy.exc import SQLAlchemyError

from superset.daos.base import BaseDAO
from superset.daos.exceptions import DAOFindFailedError


class MockModel:
    def __init__(self, id=1, name="test"):
        self.id = id
        self.name = name


class TestDAO(BaseDAO[MockModel]):
    model_cls = MockModel


class TestDAOWithNoneModel(BaseDAO[MockModel]):
    model_cls = None


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
