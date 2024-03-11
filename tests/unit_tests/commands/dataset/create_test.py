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

from pytest_mock import MockerFixture

from superset.commands.dataset.create import CreateDatasetCommand


def test_jionja_in_sql(mocker: MockerFixture) -> None:
    """
    Test that we pass valid SQL to the security manager.

    See discussion in https://github.com/apache/superset/pull/26476. Before, we were
    passing templated SQL to the security manager as if it was SQL, which could result
    in it failing to be parsed (since it was not valid SQL).

    This has been fixed so that the template is processed before being passed to the
    security manager.
    """
    DatasetDAO = mocker.patch("superset.commands.dataset.create.DatasetDAO")
    DatasetDAO.validate_uniqueness.return_value = True
    database = mocker.MagicMock()
    DatasetDAO.get_database_by_id.return_value = database
    jinja_context = mocker.patch("superset.commands.dataset.create.jinja_context")
    jinja_context.get_template_processor().process_template.return_value = "SELECT '42'"
    mocker.patch.object(CreateDatasetCommand, "populate_owners")
    security_manager = mocker.patch("superset.commands.dataset.create.security_manager")

    data = {
        "database": 1,
        "table_name": "tmp_table",
        "schema": "main",
        "sql": "SELECT '{{ answer }}'",
        "owners": [1],
    }
    command = CreateDatasetCommand(data)
    command.validate()

    security_manager.raise_for_access.assert_called_with(
        database=database,
        sql="SELECT '42'",
        schema="main",
    )
