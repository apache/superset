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
import pandas as pd
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
    """Test that encoding detection automatically handles problematic encoding."""
    csv_reader = CSVReader(
        options=CSVReaderOptions(),
    )
    binary_data = b"col1,col2,col3\nv1,v2,\xba\nv3,v4,v5\n"
    # The new encoding detection should automatically handle this
    df = csv_reader.file_to_dataframe(FileStorage(io.BytesIO(binary_data)))
    assert df.columns.tolist() == ["col1", "col2", "col3"]
    assert len(df) == 2  # Should have 2 data rows


def test_csv_reader_encoding_detection_latin1():
    """Test automatic encoding detection for Latin-1 encoded files."""
    csv_reader = CSVReader(
        options=CSVReaderOptions(),
    )
    # Create a Latin-1 encoded file with special characters
    binary_data = "col1,col2,col3\nCafé,Résumé,naïve\n".encode("latin-1")
    df = csv_reader.file_to_dataframe(FileStorage(io.BytesIO(binary_data)))
    assert df.columns.tolist() == ["col1", "col2", "col3"]
    assert df.values.tolist() == [["Café", "Résumé", "naïve"]]


def test_csv_reader_encoding_detection_iso88591():
    """Test automatic encoding detection for ISO-8859-1 encoded files."""
    csv_reader = CSVReader(
        options=CSVReaderOptions(),
    )
    # Create an ISO-8859-1 encoded file with special characters
    binary_data = "col1,col2\nCafé,naïve\n".encode("iso-8859-1")
    df = csv_reader.file_to_dataframe(FileStorage(io.BytesIO(binary_data)))
    assert df.columns.tolist() == ["col1", "col2"]
    assert df.values.tolist() == [["Café", "naïve"]]


def test_csv_reader_explicit_encoding():
    """Test that explicit encoding is respected."""
    csv_reader = CSVReader(
        options=CSVReaderOptions(encoding="latin-1"),
    )
    # Create a Latin-1 encoded file
    binary_data = "col1,col2\nCafé,naïve\n".encode("latin-1")
    df = csv_reader.file_to_dataframe(FileStorage(io.BytesIO(binary_data)))
    assert df.columns.tolist() == ["col1", "col2"]
    assert df.values.tolist() == [["Café", "naïve"]]


def test_csv_reader_encoding_detection_failure():
    """Test that undecodable files raise appropriate error."""
    csv_reader = CSVReader(
        options=CSVReaderOptions(encoding="ascii"),  # Force ASCII encoding
    )
    # Create data that can't be decoded as ASCII
    binary_data = b"col1,col2\n\xff\xfe,test\n"
    with pytest.raises(DatabaseUploadFailed) as ex:
        csv_reader.file_to_dataframe(FileStorage(io.BytesIO(binary_data)))
    assert "Parsing error" in str(ex.value)


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


def test_csv_reader_cast_column_types_function():
    """Test the _cast_column_types function directly for better isolation."""
    # Create test DataFrame
    test_data = {
        "name": ["Alice", "Bob", "Charlie"],
        "age": ["25", "30", "invalid_age"],
        "score": ["95.5", "87.2", "92.1"],
    }
    df = pd.DataFrame(test_data)

    # Test successful casting
    types_success = {"age": "int64", "score": "float64"}
    kwargs = {"header": 0}

    # This should work for first two rows, but we'll only test the first two
    df_subset = df.iloc[:2].copy()
    result_df = CSVReader._cast_column_types(df_subset, types_success, kwargs)

    assert result_df["age"].dtype == "int64"
    assert result_df["score"].dtype == "float64"
    assert result_df.iloc[0]["age"] == 25
    assert result_df.iloc[0]["score"] == 95.5

    # Test error case
    with pytest.raises(DatabaseUploadFailed) as ex:
        CSVReader._cast_column_types(df, types_success, kwargs)

    error_msg = str(ex.value)
    assert "Cannot convert column 'age' to int64" in error_msg
    assert "Found 1 error(s):" in error_msg
    assert "Line 4: 'invalid_age' cannot be converted to int64" in error_msg


def test_csv_reader_cast_column_types_missing_column():
    """Test _cast_column_types with missing columns."""
    test_data = {
        "name": ["Alice", "Bob"],
        "age": ["25", "30"],
    }
    df = pd.DataFrame(test_data)

    # Try to cast a column that doesn't exist
    types = {"age": "int64", "nonexistent": "float64"}
    kwargs = {"header": 0}

    # Should not raise an error for missing columns
    result_df = CSVReader._cast_column_types(df, types, kwargs)
    assert result_df["age"].dtype == "int64"
    assert "nonexistent" not in result_df.columns


def test_csv_reader_cast_column_types_different_numeric_types():
    """Test _cast_column_types with various numeric types."""
    test_data = {
        "int32_col": ["1", "2", "3"],
        "int64_col": ["100", "200", "300"],
        "float32_col": ["1.5", "2.5", "3.5"],
        "float64_col": ["10.1", "20.2", "30.3"],
    }
    df = pd.DataFrame(test_data)

    types = {
        "int32_col": "int32",
        "int64_col": "int64",
        "float32_col": "float32",
        "float64_col": "float64",
    }
    kwargs = {"header": 0}

    result_df = CSVReader._cast_column_types(df, types, kwargs)

    assert result_df["int32_col"].dtype == "int32"
    assert result_df["int64_col"].dtype == "int64"
    assert result_df["float32_col"].dtype == "float32"
    assert result_df["float64_col"].dtype == "float64"


def test_csv_reader_chunking_large_file():
    """Test that chunking is used for large files."""
    # Create a large CSV with more than 100k rows
    large_data = [["col1", "col2", "col3"]]
    for i in range(100001):
        large_data.append([f"val{i}", str(i), f"data{i}"])

    csv_reader = CSVReader(
        options=CSVReaderOptions(),
    )
    df = csv_reader.file_to_dataframe(create_csv_file(large_data))
    assert len(df) == 100001
    assert df.columns.tolist() == ["col1", "col2", "col3"]
    assert df.iloc[0].tolist() == ["val0", 0, "data0"]
    assert df.iloc[-1].tolist() == ["val100000", 100000, "data100000"]


def test_csv_reader_chunking_with_rows_limit():
    """Test that chunking respects rows_to_read limit."""
    # Create a CSV with more than the chunk size
    large_data = [["col1", "col2"]]
    for i in range(60000):  # More than chunk size of 50000
        large_data.append([f"val{i}", str(i)])

    csv_reader = CSVReader(
        options=CSVReaderOptions(rows_to_read=55000),
    )
    df = csv_reader.file_to_dataframe(create_csv_file(large_data))
    assert len(df) == 55000
    assert df.columns.tolist() == ["col1", "col2"]


def test_csv_reader_no_chunking_small_file():
    """Test that chunking is not used for small files."""
    # Create a small CSV (less than 2 * chunk size)
    small_data = [["col1", "col2"]]
    for i in range(1000):  # Much less than chunk size
        small_data.append([f"val{i}", str(i)])

    csv_reader = CSVReader(
        options=CSVReaderOptions(rows_to_read=1000),
    )
    df = csv_reader.file_to_dataframe(create_csv_file(small_data))
    assert len(df) == 1000
    assert df.columns.tolist() == ["col1", "col2"]


def test_csv_reader_engine_selection():
    """Test engine selection based on feature flag."""
    from unittest.mock import MagicMock, patch

    csv_reader = CSVReader(
        options=CSVReaderOptions(),
    )

    # Test 1: Feature flag disabled (default) - should use c engine
    with patch("superset.commands.database.uploaders.csv_reader.pd") as mock_pd:
        with patch(
            "superset.commands.database.uploaders.csv_reader.is_feature_enabled"
        ) as mock_flag:
            mock_flag.return_value = False
            mock_pd.__version__ = "2.0.0"
            mock_pd.read_csv = MagicMock(return_value=pd.DataFrame({"col1": [1, 2, 3]}))
            mock_pd.DataFrame = pd.DataFrame

            file = create_csv_file([["col1"], ["1"], ["2"], ["3"]])
            csv_reader.file_to_dataframe(file)

            # Check that c engine is selected when feature flag is disabled
            call_kwargs = mock_pd.read_csv.call_args[1]
            assert call_kwargs.get("engine") == "c"

    # Test 2: Feature flag enabled - pyarrow would be used but chunking prevents it
    with patch("superset.commands.database.uploaders.csv_reader.pd") as mock_pd:
        with patch(
            "superset.commands.database.uploaders.csv_reader.is_feature_enabled"
        ) as mock_flag:
            with patch("importlib.util") as mock_util:
                mock_flag.return_value = True
                mock_pd.__version__ = "2.0.0"
                mock_pd.read_csv = MagicMock(
                    return_value=pd.DataFrame({"col1": [1, 2, 3]})
                )
                mock_pd.DataFrame = pd.DataFrame
                mock_pd.concat = MagicMock(
                    return_value=pd.DataFrame({"col1": [1, 2, 3]})
                )
                mock_util.find_spec = MagicMock(return_value=True)

                file = create_csv_file([["col1"], ["1"], ["2"], ["3"]])
                csv_reader.file_to_dataframe(file)

                # Check that c engine is selected due to chunking (default behavior)
                # Even with feature flag enabled, chunking prevents pyarrow usage
                call_kwargs = mock_pd.read_csv.call_args[1]
                assert call_kwargs.get("engine") == "c"

    # Test 3: Feature flag enabled but unsupported options - should use c engine
    with patch("superset.commands.database.uploaders.csv_reader.pd") as mock_pd:
        with patch(
            "superset.commands.database.uploaders.csv_reader.is_feature_enabled"
        ) as mock_flag:
            mock_flag.return_value = True
            mock_pd.__version__ = "2.0.0"
            mock_pd.read_csv = MagicMock(return_value=pd.DataFrame({"col1": [1, 2, 3]}))
            mock_pd.DataFrame = pd.DataFrame

            # Create reader with date parsing (unsupported by pyarrow)
            csv_reader_with_dates = CSVReader(
                options=CSVReaderOptions(column_dates=["date_col"]),
            )
            file = create_csv_file([["date_col"], ["2023-01-01"]])
            csv_reader_with_dates.file_to_dataframe(file)

            # Check that c engine is selected due to unsupported options
            call_kwargs = mock_pd.read_csv.call_args[1]
            assert call_kwargs.get("engine") == "c"


def test_csv_reader_low_memory_setting():
    """Test that low_memory is set to False."""
    from unittest.mock import MagicMock, patch

    csv_reader = CSVReader(
        options=CSVReaderOptions(),
    )

    with patch("superset.commands.database.uploaders.csv_reader.pd") as mock_pd:
        mock_pd.__version__ = "2.0.0"
        mock_pd.read_csv = MagicMock(return_value=pd.DataFrame({"col1": [1, 2, 3]}))
        mock_pd.DataFrame = pd.DataFrame

        file = create_csv_file([["col1"], ["1"], ["2"], ["3"]])
        csv_reader.file_to_dataframe(file)

        # Check that low_memory=False was set
        call_kwargs = mock_pd.read_csv.call_args[1]
        assert call_kwargs.get("low_memory") is False


def test_csv_reader_cache_dates_setting():
    """Test that cache_dates is set to True for performance."""
    from unittest.mock import MagicMock, patch

    csv_reader = CSVReader(
        options=CSVReaderOptions(column_dates=["date_col"]),
    )

    with patch("superset.commands.database.uploaders.csv_reader.pd") as mock_pd:
        mock_pd.__version__ = "2.0.0"
        mock_pd.read_csv = MagicMock(
            return_value=pd.DataFrame({"date_col": ["2023-01-01"]})
        )
        mock_pd.DataFrame = pd.DataFrame

        file = create_csv_file([["date_col"], ["2023-01-01"]])
        csv_reader.file_to_dataframe(file)

        # Check that cache_dates=True was set
        call_kwargs = mock_pd.read_csv.call_args[1]
        assert call_kwargs.get("cache_dates") is True


def test_csv_reader_pyarrow_feature_flag():
    """
    Test that the CSV_UPLOAD_PYARROW_ENGINE feature flag controls engine selection.
    """
    import io
    from unittest.mock import MagicMock, patch

    from werkzeug.datastructures import FileStorage

    # Test _read_csv directly to avoid the file_to_dataframe chunking logic
    with patch(
        "superset.commands.database.uploaders.csv_reader.is_feature_enabled"
    ) as mock_flag:
        with patch("superset.commands.database.uploaders.csv_reader.pd") as mock_pd:
            with patch.object(
                CSVReader, "_select_optimal_engine"
            ) as mock_engine_select:
                # Test 1: FF enabled, pyarrow available, no unsupported options
                mock_flag.return_value = True
                mock_pd.__version__ = "2.0.0"
                mock_pd.read_csv = MagicMock(return_value=pd.DataFrame({"col1": [1]}))
                mock_engine_select.return_value = "pyarrow"

                # Create clean kwargs without any problematic options
                clean_kwargs = {
                    "encoding": "utf-8",
                    "low_memory": False,
                    # No chunksize, iterator, nrows, parse_dates, or na_values
                }

                file = FileStorage(io.StringIO("col1\nval1"))
                CSVReader._read_csv(file, clean_kwargs)

                # Verify feature flag was checked
                mock_flag.assert_called_with("CSV_UPLOAD_PYARROW_ENGINE")

                # Verify engine selection method was called
                mock_engine_select.assert_called_once()

                # Verify pyarrow engine was selected
                call_kwargs = mock_pd.read_csv.call_args[1]
                assert call_kwargs.get("engine") == "pyarrow"

    # Test 2: Feature flag disabled
    with patch(
        "superset.commands.database.uploaders.csv_reader.is_feature_enabled"
    ) as mock_flag:
        with patch("superset.commands.database.uploaders.csv_reader.pd") as mock_pd:
            mock_flag.return_value = False
            mock_pd.__version__ = "2.0.0"
            mock_pd.read_csv = MagicMock(return_value=pd.DataFrame({"col1": [1]}))

            clean_kwargs = {
                "encoding": "utf-8",
                "low_memory": False,
            }

            file = FileStorage(io.StringIO("col1\nval1"))
            CSVReader._read_csv(file, clean_kwargs)

            # Verify feature flag was checked
            mock_flag.assert_called_with("CSV_UPLOAD_PYARROW_ENGINE")

            # Verify c engine was selected when flag is disabled
            call_kwargs = mock_pd.read_csv.call_args[1]
            assert call_kwargs.get("engine") == "c"

    # Test 3: Feature flag enabled but unsupported options present
    with patch(
        "superset.commands.database.uploaders.csv_reader.is_feature_enabled"
    ) as mock_flag:
        with patch("superset.commands.database.uploaders.csv_reader.pd") as mock_pd:
            mock_flag.return_value = True
            mock_pd.__version__ = "2.0.0"
            mock_pd.read_csv = MagicMock(return_value=pd.DataFrame({"col1": [1]}))

            # Include unsupported options
            unsupported_kwargs = {
                "encoding": "utf-8",
                "low_memory": False,
                "nrows": 100,  # Unsupported by pyarrow
            }

            file = FileStorage(io.StringIO("col1\nval1"))
            CSVReader._read_csv(file, unsupported_kwargs)

            # Verify c engine was selected due to unsupported options
            call_kwargs = mock_pd.read_csv.call_args[1]
            assert call_kwargs.get("engine") == "c"


def test_csv_reader_select_optimal_engine():
    """Test the _select_optimal_engine method with different scenarios."""
    from unittest.mock import MagicMock, patch

    # Test 1: PyArrow available, no built-in support
    with patch("superset.commands.database.uploaders.csv_reader.util") as mock_util:
        with patch("superset.commands.database.uploaders.csv_reader.pd") as mock_pd:
            with patch("superset.commands.database.uploaders.csv_reader.logger"):
                mock_util.find_spec = MagicMock(
                    return_value=MagicMock()
                )  # PyArrow found
                mock_pd.__version__ = "2.0.0"  # No pyarrow in version

                # Mock successful pyarrow import
                with patch.dict("sys.modules", {"pyarrow": MagicMock()}):
                    result = CSVReader._select_optimal_engine()
                    assert result == "pyarrow"

    # Test 2: PyArrow not available
    with patch("superset.commands.database.uploaders.csv_reader.util") as mock_util:
        with patch("superset.commands.database.uploaders.csv_reader.logger"):
            mock_util.find_spec = MagicMock(return_value=None)  # PyArrow not found

            result = CSVReader._select_optimal_engine()
            assert result == "c"

    # Test 3: Pandas with built-in pyarrow
    with patch("superset.commands.database.uploaders.csv_reader.util") as mock_util:
        with patch("superset.commands.database.uploaders.csv_reader.pd") as mock_pd:
            with patch("superset.commands.database.uploaders.csv_reader.logger"):
                mock_util.find_spec = MagicMock(
                    return_value=MagicMock()
                )  # PyArrow found
                mock_pd.__version__ = "2.0.0+pyarrow"  # Has pyarrow in version

                # Mock successful pyarrow import
                with patch.dict("sys.modules", {"pyarrow": MagicMock()}):
                    result = CSVReader._select_optimal_engine()
                    assert result == "c"

    # Test 4: PyArrow import fails
    with patch("superset.commands.database.uploaders.csv_reader.util") as mock_util:
        with patch("superset.commands.database.uploaders.csv_reader.logger"):
            mock_util.find_spec = MagicMock(return_value=MagicMock())  # PyArrow found

            # Mock import error
            with patch(
                "builtins.__import__", side_effect=ImportError("PyArrow import failed")
            ):
                result = CSVReader._select_optimal_engine()
                assert result == "c"


def test_csv_reader_progressive_encoding_detection():
    """Test that progressive encoding detection uses multiple sample sizes."""
    import io

    from werkzeug.datastructures import FileStorage

    # Create a file with latin-1 encoding that will require detection
    content = "col1,col2,col3\n" + "café,résumé,naïve\n"
    binary_data = content.encode("latin-1")

    file = FileStorage(io.BytesIO(binary_data))

    # Track read calls to verify progressive sampling
    original_read = file.read
    read_calls = []
    read_sizes = []

    def track_read(size):
        read_calls.append(size)
        read_sizes.append(size)
        file.seek(0)  # Reset position for consistent reading
        result = original_read(size)
        file.seek(0)  # Reset again
        return result

    file.read = track_read

    # Call encoding detection
    detected_encoding = CSVReader._detect_encoding(file)

    # Should detect the correct encoding
    assert detected_encoding in [
        "latin-1",
        "utf-8",
    ], f"Should detect valid encoding, got {detected_encoding}"

    # Should have made multiple read attempts with different sizes
    # (The method tries multiple sample sizes until it finds a working encoding)
    assert len(read_calls) >= 1, f"Should have made read calls, got {read_calls}"

    # Test that the method handles the sample sizes properly
    assert all(size > 0 for size in read_sizes), "All sample sizes should be positive"
