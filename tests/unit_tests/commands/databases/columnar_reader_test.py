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
import tempfile
from typing import Any
from zipfile import ZipFile

import numpy as np
import pytest
from werkzeug.datastructures import FileStorage

from superset.commands.database.exceptions import DatabaseUploadFailed
from superset.commands.database.uploaders.columnar_reader import (
    ColumnarReader,
    ColumnarReaderOptions,
)
from tests.unit_tests.fixtures.common import create_columnar_file

COLUMNAR_DATA: dict[str, list[Any]] = {
    "Name": ["name1", "name2", "name3"],
    "Age": [30, 25, 20],
    "City": ["city1", "city2", "city3"],
    "Birth": ["1990-02-01", "1995-02-01", "2000-02-01"],
}

COLUMNAR_WITH_NULLS: dict[str, list[Any]] = {
    "Name": ["name1", "name2", "name3"],
    "Age": [None, 25, 20],
    "City": ["city1", None, "city3"],
    "Birth": ["1990-02-01", "1995-02-01", "2000-02-01"],
}


COLUMNAR_WITH_FLOATS: dict[str, list[Any]] = {
    "Name": ["name1", "name2", "name3"],
    "Age": [30.1, 25.1, 20.1],
    "City": ["city1", "city2", "city3"],
    "Birth": ["1990-02-01", "1995-02-01", "2000-02-01"],
}


@pytest.mark.parametrize(
    "file, options, expected_cols, expected_values",
    [
        (
            create_columnar_file(COLUMNAR_DATA),
            ColumnarReaderOptions(),
            ["Name", "Age", "City", "Birth"],
            [
                ["name1", 30, "city1", "1990-02-01"],
                ["name2", 25, "city2", "1995-02-01"],
                ["name3", 20, "city3", "2000-02-01"],
            ],
        ),
        (
            create_columnar_file(COLUMNAR_DATA),
            ColumnarReaderOptions(
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
            create_columnar_file(COLUMNAR_DATA),
            ColumnarReaderOptions(
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
            create_columnar_file(COLUMNAR_WITH_NULLS),
            ColumnarReaderOptions(),
            ["Name", "Age", "City", "Birth"],
            [
                ["name1", np.nan, "city1", "1990-02-01"],
                ["name2", 25, None, "1995-02-01"],
                ["name3", 20, "city3", "2000-02-01"],
            ],
        ),
        (
            create_columnar_file(COLUMNAR_WITH_FLOATS),
            ColumnarReaderOptions(),
            ["Name", "Age", "City", "Birth"],
            [
                ["name1", 30.1, "city1", "1990-02-01"],
                ["name2", 25.1, "city2", "1995-02-01"],
                ["name3", 20.1, "city3", "2000-02-01"],
            ],
        ),
    ],
)
def test_columnar_reader_file_to_dataframe(
    file, options, expected_cols, expected_values
):
    reader = ColumnarReader(
        options=options,
    )
    df = reader.file_to_dataframe(file)
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
    reader = ColumnarReader(
        options=ColumnarReaderOptions(columns_read=["xpto"]),
    )
    with pytest.raises(DatabaseUploadFailed) as ex:
        reader.file_to_dataframe(create_columnar_file(COLUMNAR_DATA))
    assert (
        str(ex.value)
        == (
            "Parsing error: No match for FieldRef.Name(xpto) in Name: string\n"
            "Age: int64\n"
            "City: string\n"
            "Birth: string\n"
            "__fragment_index: int32\n"
            "__batch_index: int32\n"
            "__last_in_fragment: bool\n"
            "__filename: string"
        )
        != (
            "Parsing error: Usecols do not match columns, columns expected but not found: "  # noqa: E501
            "['xpto'] (sheet: 0)"
        )
    )


def test_columnar_reader_invalid_file():
    reader = ColumnarReader(
        options=ColumnarReaderOptions(),
    )
    with pytest.raises(DatabaseUploadFailed) as ex:
        reader.file_to_dataframe(FileStorage(io.BytesIO(b"c1"), "test.parquet"))
    assert str(ex.value) == (
        "Parsing error: Could not open Parquet input source '<Buffer>': Parquet file "
        "size is 2 bytes, smaller than the minimum file footer (8 bytes)"
    )


def test_columnar_reader_zip():
    reader = ColumnarReader(
        options=ColumnarReaderOptions(),
    )
    file1 = create_columnar_file(COLUMNAR_DATA, "test1.parquet")
    file2 = create_columnar_file(COLUMNAR_DATA, "test2.parquet")

    with tempfile.NamedTemporaryFile(delete=False) as tmp_file1:
        tmp_file1.write(file1.read())
        tmp_file1.seek(0)

    with tempfile.NamedTemporaryFile(delete=False) as tmp_file2:
        tmp_file2.write(file2.read())
        tmp_file2.seek(0)

    with tempfile.NamedTemporaryFile(delete=False) as tmp_zip:
        with ZipFile(tmp_zip, "w") as zip_file:
            zip_file.write(tmp_file1.name, "test1.parquet")
            zip_file.write(tmp_file2.name, "test2.parquet")
        tmp_zip.seek(0)  # Reset file pointer to beginning
        df = reader.file_to_dataframe(FileStorage(tmp_zip, "test.zip"))
    assert df.columns.tolist() == ["Name", "Age", "City", "Birth"]
    assert df.values.tolist() == [
        ["name1", 30, "city1", "1990-02-01"],
        ["name2", 25, "city2", "1995-02-01"],
        ["name3", 20, "city3", "2000-02-01"],
        ["name1", 30, "city1", "1990-02-01"],
        ["name2", 25, "city2", "1995-02-01"],
        ["name3", 20, "city3", "2000-02-01"],
    ]


def test_columnar_reader_bad_parquet_in_zip():
    reader = ColumnarReader(
        options=ColumnarReaderOptions(),
    )
    with tempfile.NamedTemporaryFile(delete=False) as tmp_zip:
        with ZipFile(tmp_zip, "w") as zip_file:
            zip_file.writestr("test1.parquet", b"bad parquet file")
            zip_file.writestr("test2.parquet", b"bad parquet file")
        tmp_zip.seek(0)  # Reset file pointer to beginning
        with pytest.raises(DatabaseUploadFailed) as ex:
            reader.file_to_dataframe(FileStorage(tmp_zip, "test.zip"))
        assert str(ex.value) == (
            "Parsing error: Could not open Parquet input source '<Buffer>': "
            "Parquet magic bytes not found in footer. "
            "Either the file is corrupted or this is not a parquet file."
        )


def test_columnar_reader_bad_zip():
    reader = ColumnarReader(
        options=ColumnarReaderOptions(),
    )
    with pytest.raises(DatabaseUploadFailed) as ex:
        reader.file_to_dataframe(FileStorage(io.BytesIO(b"bad zip file"), "test.zip"))
    assert str(ex.value) == "Not a valid ZIP file"


def test_columnar_reader_metadata():
    reader = ColumnarReader(
        options=ColumnarReaderOptions(),
    )
    file = create_columnar_file(COLUMNAR_DATA)
    metadata = reader.file_metadata(file)
    column_names = sorted(metadata["items"][0]["column_names"])
    assert column_names == ["Age", "Birth", "City", "Name"]
    assert metadata["items"][0]["sheet_name"] is None


def test_columnar_reader_metadata_invalid_file():
    reader = ColumnarReader(
        options=ColumnarReaderOptions(),
    )
    with pytest.raises(DatabaseUploadFailed) as ex:
        reader.file_metadata(FileStorage(io.BytesIO(b"c1"), "test.parquet"))
    assert str(ex.value) == (
        "Parsing error: Parquet file size is 2 bytes, "
        "smaller than the minimum file footer (8 bytes)"
    )
