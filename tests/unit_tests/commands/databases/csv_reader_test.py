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

import numpy as np
import pytest
from werkzeug.datastructures import FileStorage

from superset.commands.database.exceptions import DatabaseUploadFailed
from superset.commands.database.uploaders.csv_reader import CSVReader, CSVReaderOptions
from tests.unit_tests.fixtures.common import create_csv_file

CSV_DATA = [
    ["Name", "Age", "City", "Birth"],
    ["name1", "30", "city1", "1990-02-01"],
    ["name2", "25", "city2", "1995-02-01"],
    ["name3", "20", "city3", "2000-02-01"],
]

CSV_DATA_CHANGED_HEADER = [
    ["name1", "30", "city1", "1990-02-01"],
    ["Name", "Age", "City", "Birth"],
    ["name2", "25", "city2", "1995-02-01"],
    ["name3", "20", "city3", "2000-02-01"],
]

CSV_DATA_WITH_NULLS = [
    ["Name", "Age", "City", "Birth"],
    ["name1", "N/A", "city1", "1990-02-01"],
    ["name2", "25", "None", "1995-02-01"],
    ["name3", "20", "city3", "2000-02-01"],
]

CSV_DATA_DAY_FIRST = [
    ["Name", "Age", "City", "Birth"],
    ["name1", "30", "city1", "01-02-1990"],
]

CSV_DATA_DECIMAL_CHAR = [
    ["Name", "Age", "City", "Birth"],
    ["name1", "30,1", "city1", "1990-02-01"],
]

CSV_DATA_SKIP_INITIAL_SPACE = [
    ["         Name", "Age", "City", "Birth"],
    ["      name1", "30", "city1", "1990-02-01"],
]


@pytest.mark.parametrize(
    "file, options, expected_cols, expected_values",
    [
        (
            create_csv_file(CSV_DATA),
            CSVReaderOptions(),
            ["Name", "Age", "City", "Birth"],
            [
                ["name1", 30, "city1", "1990-02-01"],
                ["name2", 25, "city2", "1995-02-01"],
                ["name3", 20, "city3", "2000-02-01"],
            ],
        ),
        (
            create_csv_file(CSV_DATA, delimiter="|"),
            CSVReaderOptions(delimiter="|"),
            ["Name", "Age", "City", "Birth"],
            [
                ["name1", 30, "city1", "1990-02-01"],
                ["name2", 25, "city2", "1995-02-01"],
                ["name3", 20, "city3", "2000-02-01"],
            ],
        ),
        (
            create_csv_file(CSV_DATA),
            CSVReaderOptions(
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
            create_csv_file(CSV_DATA),
            CSVReaderOptions(
                columns_read=["Name", "Age"],
                column_data_types={"Age": "float"},
            ),
            ["Name", "Age"],
            [
                ["name1", 30.0],
                ["name2", 25.0],
                ["name3", 20.0],
            ],
        ),
        (
            create_csv_file(CSV_DATA),
            CSVReaderOptions(
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
            create_csv_file(CSV_DATA),
            CSVReaderOptions(
                columns_read=[],
                column_data_types={"Age": "float"},
            ),
            ["Name", "Age", "City", "Birth"],
            [
                ["name1", 30.0, "city1", "1990-02-01"],
                ["name2", 25.0, "city2", "1995-02-01"],
                ["name3", 20.0, "city3", "2000-02-01"],
            ],
        ),
        (
            create_csv_file(CSV_DATA),
            CSVReaderOptions(
                rows_to_read=1,
            ),
            ["Name", "Age", "City", "Birth"],
            [
                ["name1", 30.0, "city1", "1990-02-01"],
            ],
        ),
        (
            create_csv_file(CSV_DATA),
            CSVReaderOptions(
                rows_to_read=1,
                columns_read=["Name", "Age"],
            ),
            ["Name", "Age"],
            [
                ["name1", 30.0],
            ],
        ),
        (
            create_csv_file(CSV_DATA),
            CSVReaderOptions(
                skip_rows=1,
            ),
            ["name1", "30", "city1", "1990-02-01"],
            [
                ["name2", 25.0, "city2", "1995-02-01"],
                ["name3", 20.0, "city3", "2000-02-01"],
            ],
        ),
        (
            create_csv_file(CSV_DATA),
            CSVReaderOptions(
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
            create_csv_file(CSV_DATA_CHANGED_HEADER),
            CSVReaderOptions(
                header_row=1,
            ),
            ["Name", "Age", "City", "Birth"],
            [
                ["name2", 25, "city2", "1995-02-01"],
                ["name3", 20, "city3", "2000-02-01"],
            ],
        ),
        (
            create_csv_file(CSV_DATA_WITH_NULLS),
            CSVReaderOptions(
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
            create_csv_file(CSV_DATA_DAY_FIRST),
            CSVReaderOptions(
                day_first=False,
                column_dates=["Birth"],
            ),
            ["Name", "Age", "City", "Birth"],
            [
                ["name1", 30, "city1", datetime(1990, 1, 2, 0, 0)],
            ],
        ),
        (
            create_csv_file(CSV_DATA_DAY_FIRST),
            CSVReaderOptions(
                day_first=True,
                column_dates=["Birth"],
            ),
            ["Name", "Age", "City", "Birth"],
            [
                ["name1", 30, "city1", datetime(1990, 2, 1, 0, 0)],
            ],
        ),
        (
            create_csv_file(CSV_DATA_DECIMAL_CHAR),
            CSVReaderOptions(
                decimal_character=",",
            ),
            ["Name", "Age", "City", "Birth"],
            [
                ["name1", 30.1, "city1", "1990-02-01"],
            ],
        ),
        (
            create_csv_file(CSV_DATA_SKIP_INITIAL_SPACE),
            CSVReaderOptions(
                skip_initial_space=True,
            ),
            ["Name", "Age", "City", "Birth"],
            [
                ["name1", 30, "city1", "1990-02-01"],
            ],
        ),
    ],
)
def test_csv_reader_file_to_dataframe(file, options, expected_cols, expected_values):
    csv_reader = CSVReader(
        options=options,
    )
    df = csv_reader.file_to_dataframe(file)
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


def test_csv_reader_index_column():
    csv_reader = CSVReader(
        options=CSVReaderOptions(index_column="Name"),
    )
    df = csv_reader.file_to_dataframe(create_csv_file(CSV_DATA))
    assert df.index.name == "Name"


def test_csv_reader_wrong_index_column():
    csv_reader = CSVReader(
        options=CSVReaderOptions(index_column="wrong"),
    )
    with pytest.raises(DatabaseUploadFailed) as ex:
        csv_reader.file_to_dataframe(create_csv_file(CSV_DATA))
    assert str(ex.value) == "Parsing error: Index wrong invalid"


def test_csv_reader_broken_file_no_columns():
    csv_reader = CSVReader(
        options=CSVReaderOptions(),
    )
    with pytest.raises(DatabaseUploadFailed) as ex:
        csv_reader.file_to_dataframe(create_csv_file([""]))
    assert str(ex.value) == "Parsing error: No columns to parse from file"


def test_csv_reader_wrong_columns_to_read():
    csv_reader = CSVReader(
        options=CSVReaderOptions(columns_read=["xpto"]),
    )
    with pytest.raises(DatabaseUploadFailed) as ex:
        csv_reader.file_to_dataframe(create_csv_file(CSV_DATA))
    assert str(ex.value) == (
        "Parsing error: Usecols do not match columns, "
        "columns expected but not found: ['xpto']"
    )


def test_csv_reader_invalid_file():
    csv_reader = CSVReader(
        options=CSVReaderOptions(),
    )
    with pytest.raises(DatabaseUploadFailed) as ex:
        csv_reader.file_to_dataframe(
            FileStorage(
                io.StringIO("c1,c2,c3\na,b,c\n1,2,3,4,5,6,7\n1,2,3"), filename=""
            )
        )
    assert str(ex.value) == (
        "Parsing error: Error tokenizing data. C error:"
        " Expected 3 fields in line 3, saw 7\n"
    )


def test_csv_reader_invalid_encoding():
    csv_reader = CSVReader(
        options=CSVReaderOptions(),
    )
    binary_data = b"col1,col2,col3\nv1,v2,\xba\nv3,v4,v5\n"
    with pytest.raises(DatabaseUploadFailed) as ex:
        csv_reader.file_to_dataframe(FileStorage(io.BytesIO(binary_data)))
    assert str(ex.value) == (
        "Parsing error: 'utf-8' codec can't decode byte 0xba in"
        " position 21: invalid start byte"
    )


def test_csv_reader_file_metadata():
    csv_reader = CSVReader(
        options=CSVReaderOptions(),
    )
    file = create_csv_file(CSV_DATA)
    metadata = csv_reader.file_metadata(file)
    assert metadata == {
        "items": [
            {"column_names": ["Name", "Age", "City", "Birth"], "sheet_name": None}
        ]
    }
    file.close()

    file = create_csv_file(CSV_DATA, delimiter="|")
    csv_reader = CSVReader(
        options=CSVReaderOptions(delimiter="|"),
    )
    metadata = csv_reader.file_metadata(file)
    assert metadata == {
        "items": [
            {"column_names": ["Name", "Age", "City", "Birth"], "sheet_name": None}
        ]
    }
    file.close()


def test_csv_reader_file_metadata_invalid_file():
    csv_reader = CSVReader(
        options=CSVReaderOptions(),
    )
    with pytest.raises(DatabaseUploadFailed) as ex:
        csv_reader.file_metadata(
            FileStorage(io.StringIO("c1,c2,c3\na,b,c\n1,2,3,4,5,6,7\n1,2,3"))
        )
    assert str(ex.value) == (
        "Parsing error: Error tokenizing data. C error:"
        " Expected 3 fields in line 3, saw 7\n"
    )
