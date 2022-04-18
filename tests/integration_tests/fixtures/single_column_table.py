#  Licensed to the Apache Software Foundation (ASF) under one
#  or more contributor license agreements.  See the NOTICE file
#  distributed with this work for additional information
#  regarding copyright ownership.  The ASF licenses this file
#  to you under the Apache License, Version 2.0 (the
#  "License"); you may not use this file except in compliance
#  with the License.  You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing,
#  software distributed under the License is distributed on an
#  "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
#  KIND, either express or implied.  See the License for the
#  specific language governing permissions and limitations
#  under the License.
import pytest

from tests.fixtures.single_column_example import SINGLE_COLUMN_EXAMPLE_TABLE_NAME
from tests.integration_tests.dashboard_utils import create_table_metadata
from tests.integration_tests.test_app import app

from .utils import cleanup_table


@pytest.fixture()
def load_single_column_example_datasource(
    load_single_column_example_table_data,
    example_db,
):
    with app.app_context():
        table = create_table_metadata(SINGLE_COLUMN_EXAMPLE_TABLE_NAME, example_db)
        yield
        cleanup_table(table.table_name)
