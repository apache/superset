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


def test_table_access_message_sorted():
    tables = {"b_table", "a_table"}

    quoted_tables = [f'"{table}"' for table in sorted(tables, key=str)]
    result = ", ".join(quoted_tables)

    assert result == '"a_table", "b_table"'


def test_no_key_error_in_sql_lab_progress():
    template = "Running block %(block_num)s out of %(block_count)s"

    try:
        result = template % {"block_num": 1, "block_count": 2}
    except KeyError:
        pytest.fail("KeyError occurred during interpolation")

    assert "1" in result
    assert "2" in result


def test_progress_message_format():
    template = "Running block %(block_num)s out of %(block_count)s"
    result = template % {"block_num": 3, "block_count": 10}

    assert result == "Running block 3 out of 10"
