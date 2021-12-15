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

import pytest

from superset.exceptions import QueryClauseValidationException
from superset.sql_parse import (
    ParsedQuery,
    strip_comments_from_sql,
    Table,
    validate_filter_clause,
)


def test_is_select_cte_with_comments() -> None:
    sql = ParsedQuery(
        """WITH blah AS
  (SELECT * FROM core_dev.manager_team),

blah2 AS
  (SELECT * FROM core_dev.manager_workspace)

SELECT * FROM blah
INNER JOIN blah2 ON blah2.team_id = blah.team_id"""
    )
    assert sql.is_select()

    sql = ParsedQuery(
        """WITH blah AS
/*blahblahbalh*/
  (SELECT * FROM core_dev.manager_team),
--blahblahbalh

blah2 AS
  (SELECT * FROM core_dev.manager_workspace)

SELECT * FROM blah
INNER JOIN blah2 ON blah2.team_id = blah.team_id"""
    )
    assert sql.is_select()


def test_validate_filter_clause_valid():
    # regular clauses
    assert validate_filter_clause("col = 1") is None
    assert validate_filter_clause("1=\t\n1") is None
    assert validate_filter_clause("(col = 1)") is None
    assert validate_filter_clause("(col1 = 1) AND (col2 = 2)") is None

    # Valid literal values that appear to be invalid
    assert validate_filter_clause("col = 'col1 = 1) AND (col2 = 2'") is None
    assert validate_filter_clause("col = 'select 1; select 2'") is None
    assert validate_filter_clause("col = 'abc -- comment'") is None


def test_validate_filter_clause_closing_unclosed():
    with pytest.raises(QueryClauseValidationException):
        validate_filter_clause("col1 = 1) AND (col2 = 2)")


def test_validate_filter_clause_unclosed():
    with pytest.raises(QueryClauseValidationException):
        validate_filter_clause("(col1 = 1) AND (col2 = 2")


def test_validate_filter_clause_closing_and_unclosed():
    with pytest.raises(QueryClauseValidationException):
        validate_filter_clause("col1 = 1) AND (col2 = 2")


def test_validate_filter_clause_closing_and_unclosed_nested():
    with pytest.raises(QueryClauseValidationException):
        validate_filter_clause("(col1 = 1)) AND ((col2 = 2)")


def test_validate_filter_clause_multiple():
    with pytest.raises(QueryClauseValidationException):
        validate_filter_clause("TRUE; SELECT 1")


def test_validate_filter_clause_comment():
    with pytest.raises(QueryClauseValidationException):
        validate_filter_clause("1 = 1 -- comment")


def test_validate_filter_clause_subquery_comment():
    with pytest.raises(QueryClauseValidationException):
        validate_filter_clause("(1 = 1 -- comment\n)")
