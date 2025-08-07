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
            with patch("importlib.util") as mock_util:
                # Test 1: FF enabled, pyarrow available, no unsupported options
                mock_flag.return_value = True
                mock_pd.__version__ = "2.0.0"
                mock_pd.read_csv = MagicMock(return_value=pd.DataFrame({"col1": [1]}))
                mock_util.find_spec = MagicMock(return_value=True)

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
