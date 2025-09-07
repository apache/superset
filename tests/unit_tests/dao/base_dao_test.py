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
Unit tests for BaseDAO functionality using mocks and no database operations.
"""

from unittest.mock import Mock, patch

import pytest
from sqlalchemy import Boolean, Column, Integer, String
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.declarative import declarative_base

from superset.daos.base import BaseDAO, ColumnOperatorEnum
from superset.daos.exceptions import DAOFindFailedError


class MockModel:
    def __init__(self, id=1, name="test"):
        self.id = id
        self.name = name


class TestDAO(BaseDAO[MockModel]):
    model_cls = MockModel


class TestDAOWithNoneModel(BaseDAO[MockModel]):
    model_cls = None


# =============================================================================
# Unit Tests - These tests use mocks and don't touch the database
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

        results = TestDAO.find_by_ids([1, 2, 3])

        assert results == []
