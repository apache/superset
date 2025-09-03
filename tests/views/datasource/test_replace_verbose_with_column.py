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

from superset.views.datasource.utils import replace_verbose_with_column


class Column:
    def __init__(self, column_name, verbose_name):
        self.column_name = column_name
        self.verbose_name = verbose_name


# Test dataset and filters
columns = [
    Column("col1", "Column 1"),
    Column("col3", "Column 3"),
]


# Test the replacement function
@pytest.mark.parametrize(
    "filters, expected",
    [
        # Normal match, should be replaced with the actual column_name
        ([{"col": "Column 1"}], [{"col": "col1"}]),
        # Multiple filters, should correctly replace all matching columns
        (
            [{"col": "Column 1"}, {"col": "Column 3"}],
            [{"col": "col1"}, {"col": "col3"}],
        ),
        # No matching case, the original value should remain unchanged
        ([{"col": "Non-existent"}], [{"col": "Non-existent"}]),
        # Empty filters, no changes should be made
        ([], []),
    ],
)
def test_replace_verbose_with_column(filters, expected):
    # Copy input data to avoid modifying the original
    filters_copy = [dict(f) for f in filters]

    # Run the replacement function
    replace_verbose_with_column(filters_copy, columns)

    # Assert that the replaced filters match the expected result.
    assert filters_copy == expected
