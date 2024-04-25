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
import io
from datetime import datetime
from typing import Any

import numpy as np
import pytest

from superset.commands.database.exceptions import DatabaseUploadFailed
from superset.commands.database.uploaders.excel_reader import (
    ExcelReader,
    ExcelReaderOptions,
)
from tests.unit_tests.fixtures.common import create_excel_file

EXCEL_DATA: dict[str, list[Any]] = {
    "Name": ["name1", "name2", "name3"],
    "Age": [30, 25, 20],
    "City": ["city1", "city2", "city3"],
    "Birth": ["1990-02-01", "1995-02-01", "2000-02-01"],
}

EXCEL_WITH_NULLS: dict[str, list[Any]] = {
    "Name": ["name1", "name2", "name3"],
    "Age": ["N/A", 25, 20],
    "City": ["city1", "None", "city3"],
    "Birth": ["1990-02-01", "1995-02-01", "2000-02-01"],
}

EXCEL_DATA_DECIMAL_CHAR = {
    "Name": ["name1"],
    "Age": ["30,1"],
    "City": ["city1"],
    "Birth": ["1990-02-01"],
}


@pytest.mark.parametrize(
    "file, options, expected_cols, expected_values",
    [
        (
            create_excel_file(EXCEL_DATA),
            ExcelReaderOptions(),
            ["Name", "Age", "City", "Birth"],
            [
                ["name1", 30, "city1", "1990-02-01"],
                ["name2", 25, "city2", "1995-02-01"],
                ["name3", 20, "city3", "2000-02-01"],
            ],
        ),
        (
            create_excel_file(EXCEL_DATA),
            ExcelReaderOptions(
                columns_read=["Name", "Age"],
            ),
            ["Name", "Age"],
            [
                ["name1", 30],
                ["name2", 25],
                ["name3", 20],
            ],
        ),
        (
            create_excel_file(EXCEL_DATA),
            ExcelReaderOptions(
                columns_read=[],
            ),
            ["Name", "Age", "City", "Birth"],
            [
                ["name1", 30, "city1", "1990-02-01"],
                ["name2", 25, "city2", "1995-02-01"],
                ["name3", 20, "city3", "2000-02-01"],
            ],
        ),
        (
            create_excel_file(EXCEL_DATA),
            ExcelReaderOptions(
                rows_to_read=1,
            ),
            ["Name", "Age", "City", "Birth"],
            [
                ["name1", 30.0, "city1", "1990-02-01"],
            ],
        ),
        (
            create_excel_file(EXCEL_DATA),
            ExcelReaderOptions(
                rows_to_read=1,
                columns_read=["Name", "Age"],
            ),
            ["Name", "Age"],
            [
                ["name1", 30.0],
            ],
        ),
        (
            create_excel_file(EXCEL_DATA),
            ExcelReaderOptions(
                skip_rows=1,
            ),
            ["name1", 30, "city1", "1990-02-01"],
            [
                ["name2", 25.0, "city2", "1995-02-01"],
                ["name3", 20.0, "city3", "2000-02-01"],
            ],
        ),
        (
            create_excel_file(EXCEL_DATA),
            ExcelReaderOptions(
                column_dates=["Birth"],
            ),
            ["Name", "Age", "City", "Birth"],
            [
                ["name1", 30, "city1", datetime(1990, 2, 1, 0, 0)],
                ["name2", 25, "city2", datetime(1995, 2, 1, 0, 0)],
                ["name3", 20, "city3", datetime(2000, 2, 1, 0, 0)],
            ],
        ),
        (
            create_excel_file(EXCEL_WITH_NULLS),
            ExcelReaderOptions(
                null_values=["N/A", "None"],
            ),
            ["Name", "Age", "City", "Birth"],
            [
                ["name1", np.nan, "city1", "1990-02-01"],
                ["name2", 25.0, np.nan, "1995-02-01"],
                ["name3", 20.0, "city3", "2000-02-01"],
            ],
        ),
        (
            create_excel_file(EXCEL_DATA_DECIMAL_CHAR),
            ExcelReaderOptions(
                decimal_character=",",
            ),
            ["Name", "Age", "City", "Birth"],
            [
                ["name1", 30.1, "city1", "1990-02-01"],
            ],
        ),
    ],
)
def test_excel_reader_file_to_dataframe(file, options, expected_cols, expected_values):
    excel_reader = ExcelReader(
        options=options,
    )
    df = excel_reader.file_to_dataframe(file)
    assert df.columns.tolist() == expected_cols
    actual_values = df.values.tolist()
    for i in range(len(expected_values)):
        for j in range(len(expected_values[i])):
            expected_val = expected_values[i][j]
            actual_val = actual_values[i][j]

            # Check if both values are NaN
            if isinstance(expected_val, float) and isinstance(actual_val, float):
                assert np.isnan(expected_val) == np.isnan(actual_val)
            else:
                assert expected_val == actual_val
    file.close()


def test_excel_reader_wrong_columns_to_read():
    excel_reader = ExcelReader(
        options=ExcelReaderOptions(columns_read=["xpto"]),
    )
    with pytest.raises(DatabaseUploadFailed) as ex:
        excel_reader.file_to_dataframe(create_excel_file(EXCEL_DATA))
    assert str(ex.value) == (
        "Parsing error: Usecols do not match columns, "
        "columns expected but not found: ['xpto'] (sheet: 0)"
    )


def test_excel_reader_wrong_date():
    excel_reader = ExcelReader(
        options=ExcelReaderOptions(column_dates=["xpto"]),
    )
    with pytest.raises(DatabaseUploadFailed) as ex:
        excel_reader.file_to_dataframe(create_excel_file(EXCEL_DATA))
    assert str(ex.value) == (
        "Parsing error: Missing column provided to 'parse_dates':" " 'xpto' (sheet: 0)"
    )


def test_excel_reader_invalid_file():
    excel_reader = ExcelReader(
        options=ExcelReaderOptions(),
    )
    with pytest.raises(DatabaseUploadFailed) as ex:
        excel_reader.file_to_dataframe(io.StringIO("c1"))
    assert str(ex.value) == (
        "Parsing error: Excel file format cannot be determined, you must specify an engine manually."
    )
