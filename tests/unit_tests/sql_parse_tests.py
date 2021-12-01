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

# pylint: disable=invalid-name

import sqlparse

from superset.sql_parse import ParsedQuery


def test_cte_with_comments_is_select():
    """
    Some CTES with comments are not correctly identified as SELECTS.
    """
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


def test_cte_is_select():
    """
    Some CTEs are not correctly identified as SELECTS.
    """
    # `AS(` gets parsed as a function
    sql = ParsedQuery(
        """WITH foo AS(
SELECT
  FLOOR(__time TO WEEK) AS "week",
  name,
  COUNT(DISTINCT user_id) AS "unique_users"
FROM "druid"."my_table"
GROUP BY 1,2
)
SELECT
  f.week,
  f.name,
  f.unique_users
FROM foo f"""
    )
    assert sql.is_select()


def test_unknown_select():
    """
    Test that `is_select` works when sqlparse fails to identify the type.
    """
    sql = "WITH foo AS(SELECT 1) SELECT 1"
    assert sqlparse.parse(sql)[0].get_type() == "UNKNOWN"
    assert ParsedQuery(sql).is_select()

    sql = "WITH foo AS(SELECT 1) INSERT INTO my_table (a) VALUES (1)"
    assert sqlparse.parse(sql)[0].get_type() == "UNKNOWN"
    assert not ParsedQuery(sql).is_select()

    sql = "WITH foo AS(SELECT 1) DELETE FROM my_table"
    assert sqlparse.parse(sql)[0].get_type() == "UNKNOWN"
    assert not ParsedQuery(sql).is_select()
