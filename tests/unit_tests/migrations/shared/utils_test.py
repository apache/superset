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
# pylint: disable=import-outside-toplevel, unused-argument

"""
Test the SIP-68 migration.
"""

from pytest_mock import MockerFixture

from superset.sql_parse import Table


def test_extract_table_references(mocker: MockerFixture, app_context: None) -> None:
    """
    Test the ``extract_table_references`` helper function.
    """
    from superset.migrations.shared.utils import extract_table_references

    assert extract_table_references("SELECT 1", "trino") == set()
    assert extract_table_references("SELECT 1 FROM some_table", "trino") == {
        Table(table="some_table", schema=None, catalog=None)
    }
    assert extract_table_references(
        "SELECT 1 FROM some_catalog.some_schema.some_table", "trino"
    ) == {Table(table="some_table", schema="some_schema", catalog="some_catalog")}
    assert extract_table_references(
        "SELECT * FROM some_table JOIN other_table ON some_table.id = other_table.id",
        "trino",
    ) == {
        Table(table="some_table", schema=None, catalog=None),
        Table(table="other_table", schema=None, catalog=None),
    }

    # test falling back to sqlparse
    logger = mocker.patch("superset.migrations.shared.utils.logger")
    sql = "SELECT * FROM table UNION ALL SELECT * FROM other_table"
    assert extract_table_references(
        sql,
        "trino",
    ) == {Table(table="other_table", schema=None, catalog=None)}
    logger.warning.assert_called_with("Unable to parse query with sqloxide: %s", sql)
