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

from pytest_mock import MockerFixture

from superset.connectors.sqla.utils import get_columns_description


# Returns column descriptions when given valid database, catalog, schema, and query
def test_returns_column_descriptions(mocker: MockerFixture) -> None:
    database = mocker.MagicMock()
    cursor = mocker.MagicMock()

    result_set = mocker.MagicMock()
    db_engine_spec = mocker.MagicMock()

    CURSOR_DESCR = (
        ("foo", "string"),
        ("bar", "string"),
        ("baz", "string"),
        ("type_generic", "string"),
        ("is_dttm", "boolean"),
    )
    cursor.description = CURSOR_DESCR

    database.get_raw_connection.return_value.__enter__.return_value.cursor.return_value = cursor
    database.db_engine_spec = db_engine_spec
    database.apply_limit_to_sql.return_value = "SELECT * FROM table LIMIT 1"
    database.mutate_sql_based_on_config.return_value = "SELECT * FROM table LIMIT 1"
    db_engine_spec.fetch_data.return_value = [("col1", "col1", "STRING", None, False)]
    db_engine_spec.get_datatype.return_value = "STRING"
    db_engine_spec.get_column_spec.return_value.is_dttm = False
    db_engine_spec.get_column_spec.return_value.generic_type = "STRING"

    mocker.patch("superset.result_set.SupersetResultSet", return_value=result_set)

    columns = get_columns_description(
        database, "catalog", "schema", "SELECT * FROM table"
    )

    assert columns == [
        {
            "column_name": "foo",
            "name": "foo",
            "type": "STRING",
            "type_generic": "STRING",
            "is_dttm": False,
        },
        {
            "column_name": "bar",
            "name": "bar",
            "type": "STRING",
            "type_generic": "STRING",
            "is_dttm": False,
        },
        {
            "column_name": "baz",
            "name": "baz",
            "type": "STRING",
            "type_generic": "STRING",
            "is_dttm": False,
        },
        {
            "column_name": "type_generic",
            "name": "type_generic",
            "type": "STRING",
            "type_generic": "STRING",
            "is_dttm": False,
        },
        {
            "column_name": "is_dttm",
            "name": "is_dttm",
            "type": "STRING",
            "type_generic": "STRING",
            "is_dttm": False,
        },
    ]
