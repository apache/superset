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

import pandas as pd
import pyarrow as pa
import pytest  # noqa: F401

from superset.utils import csv


def test_escape_value():
    result = csv.escape_value("value")
    assert result == "value"

    result = csv.escape_value("-10")
    assert result == "-10"

    result = csv.escape_value("@value")
    assert result == "'@value"

    result = csv.escape_value("+value")
    assert result == "'+value"

    result = csv.escape_value("-value")
    assert result == "'-value"

    result = csv.escape_value("=value")
    assert result == "'=value"

    result = csv.escape_value("|value")
    assert result == r"'\|value"

    result = csv.escape_value("%value")
    assert result == "'%value"

    result = csv.escape_value("=cmd|' /C calc'!A0")
    assert result == r"'=cmd\|' /C calc'!A0"

    result = csv.escape_value('""=10+2')
    assert result == '\'""=10+2'

    result = csv.escape_value(" =10+2")
    assert result == "' =10+2"


def test_df_to_escaped_csv():
    df = pd.DataFrame(
        data={
            "value": [
                "a",
                "col_a",
                "=func()",
                "-10",
                "=cmd|' /C calc'!A0",
                '""=b',
                " =a",
                "\x00",
            ]
        }
    )

    escaped_csv_str = csv.df_to_escaped_csv(
        df,
        encoding="utf8",
        index=False,
        header=False,
    )

    escaped_csv_rows = [row.split(",") for row in escaped_csv_str.strip().split("\n")]

    assert escaped_csv_rows == [
        ["a"],
        ["col_a"],
        ["'=func()"],
        ["-10"],
        [r"'=cmd\\|' /C calc'!A0"],
        ['"\'""""=b"'],
        ["' =a"],
        ["\x00"],
    ]

    df = pa.array([1, None]).to_pandas(integer_object_nulls=True).to_frame()
    assert csv.df_to_escaped_csv(df, encoding="utf8", index=False) == '0\n1\n""\n'
