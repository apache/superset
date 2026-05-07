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


def test_csv_reader_integer_in_float_column():
    csv_data = [
        ["Name", "Score", "City"],
        ["name1", 25.5, "city1"],
        ["name2", 25, "city2"],
    ]

    csv_reader = CSVReader(
        options=CSVReaderOptions(column_data_types={"Score": "float"})
    )

    df = csv_reader.file_to_dataframe(create_csv_file(csv_data))

    assert df.shape == (2, 3)
    assert df["Score"].dtype == "float64"


def test_csv_reader_object_type_auto_inferring():
    # this case below won't raise a error
    csv_data = [
        ["Name", "id", "City"],
        ["name1", 25.5, "city1"],
        ["name2", 15, "city2"],
        ["name3", 123456789086, "city3"],
        ["name4", "abc", "city4"],
        ["name5", 4.75, "city5"],
    ]

    csv_reader = CSVReader()

    df = csv_reader.file_to_dataframe(create_csv_file(csv_data))

    assert df.shape == (5, 3)
    # pandas automatically infers the type if column_data_types is not informed
    # if there's only one string in the column it converts the whole column to object
    assert df["id"].dtype == "object"


def test_csv_reader_float_type_auto_inferring():
    csv_data = [
        ["Name", "id", "City"],
        ["name1", "25", "city1"],
        ["name2", "15", "city2"],
        ["name3", "123456789086", "city3"],
        ["name5", "4.75", "city5"],
    ]

    csv_reader = CSVReader()

    df = csv_reader.file_to_dataframe(create_csv_file(csv_data))

    assert df.shape == (4, 3)
    # The type here is automatically inferred to float due to 4.75 value
    assert df["id"].dtype == "float64"


def test_csv_reader_int_type_auto_inferring():
    csv_data = [
        ["Name", "id", "City"],
        ["name1", "0", "city1"],
        ["name2", "15", "city2"],
        ["name3", "123456789086", "city3"],
        ["name5", "45", "city5"],
    ]

    csv_reader = CSVReader()

    df = csv_reader.file_to_dataframe(create_csv_file(csv_data))

    assert df.shape == (4, 3)
    assert df["id"].dtype == "int64"


def test_csv_reader_bigint_type_auto_inferring():
    csv_data = [
        ["Name", "id", "City"],
        ["name1", "9223372036854775807", "city1"],
        ["name2", "9223372036854775806", "city2"],
        ["name3", "1234567890123456789", "city3"],
        ["name4", "0", "city4"],
        ["name5", "-9223372036854775808", "city5"],
    ]

    csv_reader = CSVReader()

    df = csv_reader.file_to_dataframe(create_csv_file(csv_data))

    assert df.shape == (5, 3)
    assert df["id"].dtype == "int64"
    assert df.iloc[0]["id"] == 9223372036854775807
    assert df.iloc[4]["id"] == -9223372036854775808


def test_csv_reader_int_typing():
    csv_data = [
        ["Name", "id", "City"],
        ["name1", "0", "city1"],
        ["name2", "15", "city2"],
        ["name3", "123456789086", "city3"],
        ["name5", "45", "city5"],
    ]

    csv_reader = CSVReader(options=CSVReaderOptions(column_data_types={"id": "int"}))

    df = csv_reader.file_to_dataframe(create_csv_file(csv_data))

    assert df.shape == (4, 3)
    assert df["id"].dtype == "int64"


def test_csv_reader_float_typing():
    csv_data = [
        ["Name", "score", "City"],
        ["name1", "0", "city1"],
        ["name2", "15.3", "city2"],
        ["name3", "45", "city3"],
        ["name5", "23.1342", "city5"],
    ]

    csv_reader = CSVReader(
        options=CSVReaderOptions(column_data_types={"score": "float"})
    )

    df = csv_reader.file_to_dataframe(create_csv_file(csv_data))

    assert df.shape == (4, 3)
    assert df["score"].dtype == "float64"


def test_csv_reader_multiple_errors_display():
    """Test that multiple errors are displayed with proper formatting."""
    csv_data = [
        ["Name", "Age", "Score"],
        ["Alice", "25", "95.5"],
        ["Bob", "invalid1", "87.2"],
        ["Charlie", "invalid2", "92.1"],
        ["Diana", "invalid3", "88.5"],
        ["Eve", "invalid4", "90.0"],
        ["Frank", "30", "85.5"],
    ]

    csv_reader = CSVReader(options=CSVReaderOptions(column_data_types={"Age": "int64"}))

    with pytest.raises(DatabaseUploadFailed) as ex:
        csv_reader.file_to_dataframe(create_csv_file(csv_data))

    error_msg = str(ex.value)
    assert "Cannot convert column 'Age' to int64" in error_msg
    assert "Found 4 error(s):" in error_msg
    assert "Line 3: 'invalid1' cannot be converted to int64" in error_msg
    assert "Line 4: 'invalid2' cannot be converted to int64" in error_msg
    assert "Line 5: 'invalid3' cannot be converted to int64" in error_msg
    assert "Line 6: 'invalid4' cannot be converted to int64" in error_msg
    # With MAX_DISPLAYED_ERRORS = 5, all 4 errors should be shown without truncation
    assert "and" not in error_msg or "more error(s)" not in error_msg


def test_csv_reader_non_numeric_in_integer_column():
    csv_data = [
        ["Name", "Age", "City"],
        ["name1", "abc", "city1"],
        ["name2", "25", "city2"],
    ]

    csv_reader = CSVReader(options=CSVReaderOptions(column_data_types={"Age": "int64"}))

    with pytest.raises(DatabaseUploadFailed) as ex:
        csv_reader.file_to_dataframe(create_csv_file(csv_data))

    error_msg = str(ex.value)
    assert "Cannot convert column 'Age' to int64" in error_msg
    assert "Found 1 error(s):" in error_msg
    assert "Line 2: 'abc' cannot be converted to int64" in error_msg


def test_csv_reader_non_numeric_in_float_column():
    csv_data = [
        ["Name", "Score", "City"],
        ["name1", "5.3", "city1"],
        ["name2", "25.5", "city2"],
        ["name3", "24.5", "city3"],
        ["name4", "1.0", "city4"],
        ["name5", "one point five", "city5"],
    ]

    csv_reader = CSVReader(
        options=CSVReaderOptions(column_data_types={"Score": "float64"})
    )

    with pytest.raises(DatabaseUploadFailed) as ex:
        csv_reader.file_to_dataframe(create_csv_file(csv_data))

    error_msg = str(ex.value)
    assert "Cannot convert column 'Score' to float64" in error_msg
    assert "Found 1 error(s):" in error_msg
    assert "Line 6: 'one point five' cannot be converted to float64" in error_msg


def test_csv_reader_improved_error_detection_int32():
    """Test improved error detection for int32 type casting."""
    csv_data = [
        ["Name", "ID", "City"],
        ["name1", "123", "city1"],
        ["name2", "456", "city2"],
        ["name3", "not_a_number", "city3"],
        ["name4", "789", "city4"],
    ]

    csv_reader = CSVReader(options=CSVReaderOptions(column_data_types={"ID": "int32"}))

    with pytest.raises(DatabaseUploadFailed) as ex:
        csv_reader.file_to_dataframe(create_csv_file(csv_data))

    error_msg = str(ex.value)
    assert "Cannot convert column 'ID' to int32" in error_msg
    assert "Found 1 error(s):" in error_msg
    assert "Line 4: 'not_a_number' cannot be converted to int32" in error_msg


def test_csv_reader_improved_error_detection_float32():
    """Test improved error detection for float32 type casting."""
    csv_data = [
        ["Name", "Score", "City"],
        ["name1", "1.5", "city1"],
        ["name2", "2.7", "city2"],
        ["name3", "invalid_float", "city3"],
    ]

    csv_reader = CSVReader(
        options=CSVReaderOptions(column_data_types={"Score": "float32"})
    )

    with pytest.raises(DatabaseUploadFailed) as ex:
        csv_reader.file_to_dataframe(create_csv_file(csv_data))

    error_msg = str(ex.value)
    assert "Cannot convert column 'Score' to float32" in error_msg
    assert "Found 1 error(s):" in error_msg
    assert "Line 4: 'invalid_float' cannot be converted to float32" in error_msg


def test_csv_reader_error_detection_with_header_row():
    """Test that line numbers are correctly calculated with custom header row."""
    csv_data = [
        ["skip_this_row", "skip", "skip"],
        ["Name", "Age", "City"],
        ["name1", "25", "city1"],
        ["name2", "invalid_age", "city2"],
    ]

    csv_reader = CSVReader(
        options=CSVReaderOptions(header_row=1, column_data_types={"Age": "int"})
    )

    with pytest.raises(DatabaseUploadFailed) as ex:
        csv_reader.file_to_dataframe(create_csv_file(csv_data))

    error_msg = str(ex.value)
    assert "Cannot convert column 'Age' to int" in error_msg
    assert "Found 1 error(s):" in error_msg
    assert "Line 4: 'invalid_age' cannot be converted to int" in error_msg


def test_csv_reader_error_detection_first_row_error():
    """Test error detection when the first data row has the error."""

    csv_data = [
        ["Name", "Age", "City"],
        ["name1", "not_a_number", "city1"],
        ["name2", "25", "city2"],
    ]

    csv_reader = CSVReader(options=CSVReaderOptions(column_data_types={"Age": "int64"}))

    with pytest.raises(DatabaseUploadFailed) as ex:
        csv_reader.file_to_dataframe(create_csv_file(csv_data))

    error_msg = str(ex.value)
    assert "Cannot convert column 'Age' to int64" in error_msg
    assert "Found 1 error(s):" in error_msg
    assert "Line 2: 'not_a_number' cannot be converted to int64" in error_msg


def test_csv_reader_error_detection_missing_column():
    """Test that missing columns are handled gracefully."""
    csv_data = [
        ["Name", "City"],
        ["name1", "city1"],
        ["name2", "city2"],
    ]

    # Try to cast a column that doesn't exist
    csv_reader = CSVReader(
        options=CSVReaderOptions(column_data_types={"NonExistent": "int64"})
    )

    # Should not raise an error for missing columns
    df = csv_reader.file_to_dataframe(create_csv_file(csv_data))
    assert df.shape == (2, 2)
    assert df.columns.tolist() == ["Name", "City"]


def test_csv_reader_error_detection_mixed_valid_invalid():
    csv_data = [
        ["Name", "Score", "City"],
        ["name1", "95.5", "city1"],
        ["name2", "87.2", "city2"],
        ["name3", "92.1", "city3"],
        ["name4", "eighty-five", "city4"],
        ["name5", "78.9", "city5"],
    ]

    csv_reader = CSVReader(
        options=CSVReaderOptions(column_data_types={"Score": "float64"})
    )

    with pytest.raises(DatabaseUploadFailed) as ex:
        csv_reader.file_to_dataframe(create_csv_file(csv_data))

    error_msg = str(ex.value)
    assert "Cannot convert column 'Score' to float64" in error_msg
    assert "Found 1 error(s):" in error_msg
    assert "Line 5: 'eighty-five' cannot be converted to float64" in error_msg


def test_csv_reader_error_detection_multiple_invalid_values():
    """Test error detection with multiple invalid values showing first 5 + count."""
    csv_data = [
        ["Name", "Score", "City"],
        ["name1", "95.5", "city1"],
        ["name2", "87.2", "city2"],
        ["name3", "92.1", "city3"],
        ["name4", "eighty-five", "city4"],
        ["name4", "eighty-one", "city4"],
        ["name4", "eighty", "city4"],
        ["name4", "one", "city4"],
        ["name4", "two", "city4"],
        ["name4", "three", "city4"],
        ["name5", "78.9", "city5"],
    ]

    csv_reader = CSVReader(
        options=CSVReaderOptions(column_data_types={"Score": "float64"})
    )

    with pytest.raises(DatabaseUploadFailed) as ex:
        csv_reader.file_to_dataframe(create_csv_file(csv_data))

    error_msg = str(ex.value)
    assert "Cannot convert column 'Score' to float64" in error_msg
    assert "Found 6 error(s):" in error_msg
    assert "Line 5: 'eighty-five' cannot be converted to float64" in error_msg
    assert "Line 6: 'eighty-one' cannot be converted to float64" in error_msg
    assert "Line 7: 'eighty' cannot be converted to float64" in error_msg
    assert "Line 8: 'one' cannot be converted to float64" in error_msg
    assert "Line 9: 'two' cannot be converted to float64" in error_msg
    assert "and 1 more error(s)" in error_msg


def test_csv_reader_error_detection_non_numeric_types():
    """Test error detection for non-numeric type casting."""
    csv_data = [
        ["Name", "Status", "City"],
        ["name1", "active", "city1"],
        ["name2", "inactive", "city2"],
        ["name3", 123, "city3"],  # This should cause an error when casting to string
    ]

    csv_reader = CSVReader(
        options=CSVReaderOptions(column_data_types={"Status": "string"})
    )

    # For non-numeric types, the error detection should still work
    # but might have different behavior depending on pandas version
    try:
        df = csv_reader.file_to_dataframe(create_csv_file(csv_data))
        # If no error is raised, the conversion succeeded
        assert df["Status"].dtype == "string"
    except DatabaseUploadFailed as ex:
        # If an error is raised, it should have proper formatting
        error_msg = str(ex.value)
        assert "Cannot convert" in error_msg
        assert "Status" in error_msg


def test_csv_reader_error_detection_with_null_values():
    csv_data = [
        ["Name", "Age", "City"],
        ["name1", "25", "city1"],
        ["name2", "", "city2"],
        ["name3", "invalid_age", "city3"],
    ]

    csv_reader = CSVReader(options=CSVReaderOptions(column_data_types={"Age": "int64"}))

    with pytest.raises(DatabaseUploadFailed) as ex:
        csv_reader.file_to_dataframe(create_csv_file(csv_data))

    error_msg = str(ex.value)
    assert "Cannot convert column 'Age' to int64" in error_msg
    assert "Found 1 error(s):" in error_msg
    assert "Line 4: 'invalid_age' cannot be converted to int64" in error_msg


def test_csv_reader_successful_numeric_conversion():
    csv_data = [
        ["Name", "Age", "Score", "ID"],
        ["name1", "25", "95.5", "1001"],
        ["name2", "30", "87.2", "1002"],
        ["name3", "35", "92.1", "1003"],
    ]

    csv_reader = CSVReader(
        options=CSVReaderOptions(
            column_data_types={
                "Age": "int64",
                "Score": "float64",
                "ID": "int32",
            }
        )
    )

    df = csv_reader.file_to_dataframe(create_csv_file(csv_data))

    assert df.shape == (3, 4)
    assert df["Age"].dtype == "int64"
    assert df["Score"].dtype == "float64"
    assert df["ID"].dtype == "int32"
    assert df.iloc[0]["Age"] == 25
    assert df.iloc[0]["Score"] == 95.5
    assert df.iloc[0]["ID"] == 1001


def test_csv_reader_successful_string_conversion_with_floats():
    csv_data = [
        ["id"],
        [1439403621518935563],
        [42286989],
        [1413660691875593351],
        [8.26839e17],
    ]

    csv_reader = CSVReader(
        options=CSVReaderOptions(
            column_data_types={
                "id": "str",
            }
        )
    )

    df = csv_reader.file_to_dataframe(create_csv_file(csv_data))

    assert df.shape == (4, 1)
    assert df["id"].dtype == "object"
    assert df.iloc[0]["id"] == "1439403621518935563"
    assert df.iloc[1]["id"] == "42286989"
    assert df.iloc[2]["id"] == "1413660691875593351"
    assert df.iloc[3]["id"] == "8.26839e+17"


def test_csv_reader_error_detection_improvements_summary():
    csv_data_with_custom_header = [
        ["metadata_row", "skip", "this"],
        ["Name", "Age", "Score"],
        ["Alice", "25", "95.5"],
        ["Bob", "invalid_age", "87.2"],
        ["Charlie", "30", "92.1"],
    ]

    csv_reader = CSVReader(
        options=CSVReaderOptions(
            header_row=1, column_data_types={"Age": "int64", "Score": "float64"}
        )
    )

    with pytest.raises(DatabaseUploadFailed) as ex:
        csv_reader.file_to_dataframe(create_csv_file(csv_data_with_custom_header))

    error_msg = str(ex.value)
    assert "Cannot convert column 'Age' to int64" in error_msg
    assert "Found 1 error(s):" in error_msg
    assert "Line 4: 'invalid_age' cannot be converted to int64" in error_msg

    # Test case 2: Multiple type errors - Age comes first alphabetically
    csv_data_multiple_errors = [
        ["Name", "Age", "Score"],
        ["Alice", "25", "95.5"],
        ["Bob", "invalid_age", "invalid_score"],  # Error in both columns (line 3)
        ["Charlie", "30", "92.1"],
    ]

    csv_reader = CSVReader(
        options=CSVReaderOptions(column_data_types={"Age": "int64", "Score": "float64"})
    )

    with pytest.raises(DatabaseUploadFailed) as ex:
        csv_reader.file_to_dataframe(create_csv_file(csv_data_multiple_errors))

    error_msg = str(ex.value)
    # Should catch the Age error first (Age comes before Score alphabetically)
    assert "Cannot convert column 'Age' to int64" in error_msg
    assert "Found 1 error(s):" in error_msg
    assert "Line 3: 'invalid_age' cannot be converted to int64" in error_msg
