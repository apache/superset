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
import os
from dataclasses import dataclass
from typing import Any, Optional
from unittest.mock import MagicMock, patch

import numpy as np
import pandas as pd
import pytest
from flask import current_app
from pandas.api.types import is_datetime64_dtype
from pytest_mock import MockerFixture

from superset.exceptions import SupersetException
from superset.utils.core import (
    cast_to_boolean,
    check_is_safe_zip,
    DateColumn,
    generic_find_constraint_name,
    generic_find_fk_constraint_name,
    get_datasource_full_name,
    get_query_source_from_request,
    get_stacktrace,
    get_user_agent,
    is_test,
    merge_extra_filters,
    merge_request_params,
    normalize_dttm_col,
    parse_boolean_string,
    parse_js_uri_path_item,
    QueryObjectFilterClause,
    QuerySource,
    remove_extra_adhoc_filters,
)
from tests.conftest import with_config

ADHOC_FILTER: QueryObjectFilterClause = {
    "col": "foo",
    "op": "==",
    "val": "bar",
}

EXTRA_FILTER: QueryObjectFilterClause = {
    "col": "foo",
    "op": "==",
    "val": "bar",
    "isExtra": True,
}


@dataclass
class MockZipInfo:
    file_size: int
    compress_size: int


@pytest.mark.parametrize(
    "original,expected",
    [
        ({"foo": "bar"}, {"foo": "bar"}),
        (
            {"foo": "bar", "adhoc_filters": [ADHOC_FILTER]},
            {"foo": "bar", "adhoc_filters": [ADHOC_FILTER]},
        ),
        (
            {"foo": "bar", "adhoc_filters": [EXTRA_FILTER]},
            {"foo": "bar", "adhoc_filters": []},
        ),
        (
            {
                "foo": "bar",
                "adhoc_filters": [ADHOC_FILTER, EXTRA_FILTER],
            },
            {"foo": "bar", "adhoc_filters": [ADHOC_FILTER]},
        ),
        (
            {
                "foo": "bar",
                "adhoc_filters_b": [ADHOC_FILTER, EXTRA_FILTER],
            },
            {"foo": "bar", "adhoc_filters_b": [ADHOC_FILTER]},
        ),
        (
            {
                "foo": "bar",
                "custom_adhoc_filters": [
                    ADHOC_FILTER,
                    EXTRA_FILTER,
                ],
            },
            {
                "foo": "bar",
                "custom_adhoc_filters": [
                    ADHOC_FILTER,
                    EXTRA_FILTER,
                ],
            },
        ),
    ],
)
def test_remove_extra_adhoc_filters(
    original: dict[str, Any], expected: dict[str, Any]
) -> None:
    remove_extra_adhoc_filters(original)
    assert expected == original


def test_is_test():
    orig_value = os.getenv("SUPERSET_TESTENV")

    os.environ["SUPERSET_TESTENV"] = "true"
    assert is_test()
    os.environ["SUPERSET_TESTENV"] = "false"
    assert not is_test()
    os.environ["SUPERSET_TESTENV"] = ""
    assert not is_test()

    if orig_value is not None:
        os.environ["SUPERSET_TESTENV"] = orig_value


@pytest.mark.parametrize(
    "test_input,expected",
    [
        ("y", True),
        ("Y", True),
        ("yes", True),
        ("True", True),
        ("t", True),
        ("true", True),
        ("On", True),
        ("on", True),
        ("1", True),
        ("n", False),
        ("N", False),
        ("no", False),
        ("False", False),
        ("f", False),
        ("false", False),
        ("Off", False),
        ("off", False),
        ("0", False),
        ("foo", False),
        (None, False),
    ],
)
def test_parse_boolean_string(test_input: Optional[str], expected: bool):
    assert parse_boolean_string(test_input) == expected


def test_int_values():
    assert cast_to_boolean(1) is True
    assert cast_to_boolean(0) is False
    assert cast_to_boolean(-1) is True
    assert cast_to_boolean(42) is True
    assert cast_to_boolean(0) is False


def test_float_values():
    assert cast_to_boolean(0.5) is True
    assert cast_to_boolean(3.14) is True
    assert cast_to_boolean(-2.71) is True
    assert cast_to_boolean(0.0) is False


def test_string_values():
    assert cast_to_boolean("true") is True
    assert cast_to_boolean("TruE") is True
    assert cast_to_boolean("false") is False
    assert cast_to_boolean("FaLsE") is False
    assert cast_to_boolean("") is False


def test_none_value():
    assert cast_to_boolean(None) is None


def test_boolean_values():
    assert cast_to_boolean(True) is True
    assert cast_to_boolean(False) is False


def test_other_values():
    assert cast_to_boolean([]) is False
    assert cast_to_boolean({}) is False
    assert cast_to_boolean(object()) is False


def test_normalize_dttm_col() -> None:
    """
    Tests for the ``normalize_dttm_col`` function.

    In particular, this covers a regression when Pandas was upgraded from 1.5.3 to
    2.0.3 and the behavior of ``pd.to_datetime`` changed.
    """
    df = pd.DataFrame({"__time": ["2017-07-01T00:00:00.000Z"]})
    assert (
        df.to_markdown()
        == """
|    | __time                   |
|---:|:-------------------------|
|  0 | 2017-07-01T00:00:00.000Z |
    """.strip()
    )

    # in 1.5.3 this would return a datetime64[ns] dtype, but in 2.0.3 we had to
    # add ``exact=False`` since there is a leftover after parsing the format
    dttm_cols = (DateColumn("__time", "%Y-%m-%d"),)

    # the function modifies the dataframe in place
    normalize_dttm_col(df, dttm_cols)

    assert df["__time"].astype(str).tolist() == ["2017-07-01"]


def test_normalize_dttm_col_epoch_seconds() -> None:
    """Test conversion of epoch seconds."""
    df = pd.DataFrame(
        {
            "epoch_col": [
                1577836800,
                1609459200,
                1640995200,
            ]  # 2020-01-01, 2021-01-01, 2022-01-01
        }
    )
    dttm_cols = (DateColumn(col_label="epoch_col", timestamp_format="epoch_s"),)

    normalize_dttm_col(df, dttm_cols)

    assert is_datetime64_dtype(df["epoch_col"])
    assert df["epoch_col"][0].strftime("%Y-%m-%d") == "2020-01-01"
    assert df["epoch_col"][1].strftime("%Y-%m-%d") == "2021-01-01"
    assert df["epoch_col"][2].strftime("%Y-%m-%d") == "2022-01-01"


def test_normalize_dttm_col_epoch_milliseconds() -> None:
    """Test conversion of epoch milliseconds."""
    df = pd.DataFrame(
        {
            "epoch_ms_col": [
                1577836800000,
                1609459200000,
                1640995200000,
            ]  # 2020-01-01, 2021-01-01, 2022-01-01
        }
    )
    dttm_cols = (DateColumn(col_label="epoch_ms_col", timestamp_format="epoch_ms"),)

    normalize_dttm_col(df, dttm_cols)

    assert is_datetime64_dtype(df["epoch_ms_col"])
    assert df["epoch_ms_col"][0].strftime("%Y-%m-%d") == "2020-01-01"
    assert df["epoch_ms_col"][1].strftime("%Y-%m-%d") == "2021-01-01"
    assert df["epoch_ms_col"][2].strftime("%Y-%m-%d") == "2022-01-01"


def test_normalize_dttm_col_formatted_date() -> None:
    """Test conversion of formatted date strings."""
    df = pd.DataFrame({"date_col": ["2020-01-01", "2021-01-01", "2022-01-01"]})
    dttm_cols = (DateColumn(col_label="date_col", timestamp_format="%Y-%m-%d"),)

    normalize_dttm_col(df, dttm_cols)

    assert is_datetime64_dtype(df["date_col"])
    assert df["date_col"][0].strftime("%Y-%m-%d") == "2020-01-01"
    assert df["date_col"][1].strftime("%Y-%m-%d") == "2021-01-01"
    assert df["date_col"][2].strftime("%Y-%m-%d") == "2022-01-01"


def test_normalize_dttm_col_with_offset() -> None:
    """Test with hour offset."""
    df = pd.DataFrame({"date_col": ["2020-01-01", "2021-01-01", "2022-01-01"]})
    dttm_cols = (
        DateColumn(col_label="date_col", timestamp_format="%Y-%m-%d", offset=3),
    )

    normalize_dttm_col(df, dttm_cols)

    assert is_datetime64_dtype(df["date_col"])
    assert df["date_col"][0].strftime("%Y-%m-%d %H:%M:%S") == "2020-01-01 03:00:00"
    assert df["date_col"][1].strftime("%Y-%m-%d %H:%M:%S") == "2021-01-01 03:00:00"
    assert df["date_col"][2].strftime("%Y-%m-%d %H:%M:%S") == "2022-01-01 03:00:00"


def test_normalize_dttm_col_with_time_shift() -> None:
    """Test with time shift."""
    df = pd.DataFrame({"date_col": ["2020-01-01", "2021-01-01", "2022-01-01"]})
    dttm_cols = (
        DateColumn(
            col_label="date_col", timestamp_format="%Y-%m-%d", time_shift="1 day"
        ),
    )

    normalize_dttm_col(df, dttm_cols)

    assert is_datetime64_dtype(df["date_col"])
    assert df["date_col"][0].strftime("%Y-%m-%d") == "2020-01-02"
    assert df["date_col"][1].strftime("%Y-%m-%d") == "2021-01-02"
    assert df["date_col"][2].strftime("%Y-%m-%d") == "2022-01-02"


def test_normalize_dttm_col_with_offset_and_time_shift() -> None:
    """Test with both offset and time shift."""
    df = pd.DataFrame({"date_col": ["2020-01-01", "2021-01-01", "2022-01-01"]})
    dttm_cols = (
        DateColumn(
            col_label="date_col",
            timestamp_format="%Y-%m-%d",
            offset=3,
            time_shift="1 hour",
        ),
    )

    normalize_dttm_col(df, dttm_cols)

    assert is_datetime64_dtype(df["date_col"])
    assert df["date_col"][0].strftime("%Y-%m-%d %H:%M:%S") == "2020-01-01 04:00:00"
    assert df["date_col"][1].strftime("%Y-%m-%d %H:%M:%S") == "2021-01-01 04:00:00"
    assert df["date_col"][2].strftime("%Y-%m-%d %H:%M:%S") == "2022-01-01 04:00:00"


def test_normalize_dttm_col_invalid_date_coerced() -> None:
    """Test that invalid dates are coerced to NaT."""
    df = pd.DataFrame({"date_col": ["2020-01-01", "invalid_date", "2022-01-01"]})
    dttm_cols = (DateColumn(col_label="date_col", timestamp_format="%Y-%m-%d"),)

    normalize_dttm_col(df, dttm_cols)

    assert is_datetime64_dtype(df["date_col"])
    assert df["date_col"][0].strftime("%Y-%m-%d") == "2020-01-01"
    assert pd.isna(df["date_col"][1])
    assert df["date_col"][2].strftime("%Y-%m-%d") == "2022-01-01"


def test_normalize_dttm_col_invalid_epoch_coerced() -> None:
    """Test that invalid epoch values are coerced to NaT."""
    df = pd.DataFrame(
        {"epoch_col": [1577836800, np.nan, 1640995200]}  # 2020-01-01, NaN, 2022-01-01
    )
    dttm_cols = (DateColumn(col_label="epoch_col", timestamp_format="epoch_s"),)

    normalize_dttm_col(df, dttm_cols)

    assert is_datetime64_dtype(df["epoch_col"])
    assert df["epoch_col"][0].strftime("%Y-%m-%d") == "2020-01-01"
    assert pd.isna(df["epoch_col"][1])
    assert df["epoch_col"][2].strftime("%Y-%m-%d") == "2022-01-01"


def test_normalize_dttm_col_non_existing_column() -> None:
    """Test handling of non-existing columns."""
    df = pd.DataFrame({"existing_col": [1, 2, 3]})
    dttm_cols = (DateColumn(col_label="non_existing_col", timestamp_format="%Y-%m-%d"),)

    # Should not raise any exception
    normalize_dttm_col(df, dttm_cols)

    # DataFrame should remain unchanged
    assert list(df.columns) == ["existing_col"]
    assert df["existing_col"].tolist() == [1, 2, 3]


def test_normalize_dttm_col_multiple_columns() -> None:
    """Test normalizing multiple datetime columns."""
    df = pd.DataFrame(
        {
            "date_col1": ["2020-01-01", "2021-01-01", "2022-01-01"],
            "date_col2": ["01/01/2020", "01/01/2021", "01/01/2022"],
        }
    )
    dttm_cols = (
        DateColumn(col_label="date_col1", timestamp_format="%Y-%m-%d"),
        DateColumn(col_label="date_col2", timestamp_format="%m/%d/%Y"),
    )

    normalize_dttm_col(df, dttm_cols)

    assert is_datetime64_dtype(df["date_col1"])
    assert is_datetime64_dtype(df["date_col2"])
    assert df["date_col1"][0].strftime("%Y-%m-%d") == "2020-01-01"
    assert df["date_col2"][0].strftime("%Y-%m-%d") == "2020-01-01"


def test_normalize_dttm_col_already_datetime_series() -> None:
    """Test handling of already datetime series with epoch format."""
    # Create a DataFrame with timestamp strings
    df = pd.DataFrame(
        {
            "ts_col": [
                "2020-01-01 00:00:00",
                "2021-01-01 00:00:00",
                "2022-01-01 00:00:00",
            ]
        }
    )
    dttm_cols = (DateColumn(col_label="ts_col", timestamp_format="epoch_s"),)

    normalize_dttm_col(df, dttm_cols)

    assert is_datetime64_dtype(df["ts_col"])
    assert df["ts_col"][0].strftime("%Y-%m-%d") == "2020-01-01"
    assert df["ts_col"][1].strftime("%Y-%m-%d") == "2021-01-01"
    assert df["ts_col"][2].strftime("%Y-%m-%d") == "2022-01-01"


def test_check_if_safe_zip_success(app_context: None) -> None:
    """
    Test if ZIP files are safe
    """
    ZipFile = MagicMock()  # noqa: N806
    ZipFile.infolist.return_value = [
        MockZipInfo(file_size=1000, compress_size=10),
        MockZipInfo(file_size=1000, compress_size=10),
        MockZipInfo(file_size=1000, compress_size=10),
        MockZipInfo(file_size=1000, compress_size=10),
        MockZipInfo(file_size=1000, compress_size=10),
    ]
    check_is_safe_zip(ZipFile)


def test_check_if_safe_zip_high_rate(app_context: None) -> None:
    """
    Test if ZIP files is not highly compressed
    """
    ZipFile = MagicMock()  # noqa: N806
    ZipFile.infolist.return_value = [
        MockZipInfo(file_size=1000, compress_size=1),
        MockZipInfo(file_size=1000, compress_size=1),
        MockZipInfo(file_size=1000, compress_size=1),
        MockZipInfo(file_size=1000, compress_size=1),
        MockZipInfo(file_size=1000, compress_size=1),
    ]
    with pytest.raises(SupersetException):
        check_is_safe_zip(ZipFile)


def test_check_if_safe_zip_hidden_bomb(app_context: None) -> None:
    """
    Test if ZIP file does not contain a big file highly compressed
    """
    ZipFile = MagicMock()  # noqa: N806
    ZipFile.infolist.return_value = [
        MockZipInfo(file_size=1000, compress_size=100),
        MockZipInfo(file_size=1000, compress_size=100),
        MockZipInfo(file_size=1000, compress_size=100),
        MockZipInfo(file_size=1000, compress_size=100),
        MockZipInfo(file_size=1000 * (1024 * 1024), compress_size=100),
    ]
    with pytest.raises(SupersetException):
        check_is_safe_zip(ZipFile)


def test_generic_constraint_name_exists():
    # Create a mock SQLAlchemy database object
    database_mock = MagicMock()

    # Define the table name and constraint details
    table_name = "my_table"
    columns = {"column1", "column2"}
    referenced_table_name = "other_table"
    constraint_name = "my_constraint"

    # Create a mock table object with the same structure
    table_mock = MagicMock()
    table_mock.name = table_name
    table_mock.columns = [MagicMock(name=col) for col in columns]

    # Create a mock for the referred_table with a name attribute
    referred_table_mock = MagicMock()
    referred_table_mock.name = referenced_table_name

    # Create a mock for the foreign key constraint with a name attribute
    foreign_key_constraint_mock = MagicMock()
    foreign_key_constraint_mock.name = constraint_name
    foreign_key_constraint_mock.referred_table = referred_table_mock
    foreign_key_constraint_mock.column_keys = list(columns)

    # Set the foreign key constraint mock as part of the table's constraints
    table_mock.foreign_key_constraints = [foreign_key_constraint_mock]

    # Configure the autoload behavior for the database mock
    database_mock.metadata = MagicMock()
    database_mock.metadata.tables = {table_name: table_mock}

    # Mock the sa.Table creation with autoload
    with patch("superset.utils.core.sa.Table") as table_creation_mock:
        table_creation_mock.return_value = table_mock

        result = generic_find_constraint_name(
            table_name, columns, referenced_table_name, database_mock
        )

    assert result == constraint_name


def test_generic_constraint_name_not_found():
    # Create a mock SQLAlchemy database object
    database_mock = MagicMock()

    # Define the table name and constraint details
    table_name = "my_table"
    columns = {"column1", "column2"}
    referenced_table_name = "other_table"

    # Create a mock table object with the same structure but no matching constraint
    table_mock = MagicMock()
    table_mock.name = table_name
    table_mock.columns = [MagicMock(name=col) for col in columns]
    table_mock.foreign_key_constraints = []

    # Configure the autoload behavior for the database mock
    database_mock.metadata = MagicMock()
    database_mock.metadata.tables = {table_name: table_mock}

    result = generic_find_constraint_name(
        table_name, columns, referenced_table_name, database_mock
    )

    assert result is None


def test_generic_find_fk_constraint_exists():
    insp_mock = MagicMock()
    table_name = "my_table"
    columns = {"column1", "column2"}
    referenced_table_name = "other_table"
    constraint_name = "my_constraint"

    # Create a mock for the foreign key constraint as a dictionary
    constraint_mock = {
        "name": constraint_name,
        "referred_table": referenced_table_name,
        "referred_columns": list(columns),
    }

    # Configure the Inspector mock to return the list of foreign key constraints
    insp_mock.get_foreign_keys.return_value = [constraint_mock]

    result = generic_find_fk_constraint_name(
        table_name, columns, referenced_table_name, insp_mock
    )

    assert result == constraint_name


def test_generic_find_fk_constraint_none_exist():
    insp_mock = MagicMock()
    table_name = "my_table"
    columns = {"column1", "column2"}
    referenced_table_name = "other_table"

    # Configure the Inspector mock to return the list of foreign key constraints
    insp_mock.get_foreign_keys.return_value = []

    result = generic_find_fk_constraint_name(
        table_name, columns, referenced_table_name, insp_mock
    )

    assert result is None


def test_get_datasource_full_name():
    """
    Test the `get_datasource_full_name` function.

    This is used to build permissions, so it doesn't really return the datasource full
    name. Instead, it returns a fully qualified table name that includes the database
    name and schema, with each part wrapped in square brackets.
    """
    assert (
        get_datasource_full_name("db", "table", "catalog", "schema")
        == "[db].[catalog].[schema].[table]"
    )

    assert get_datasource_full_name("db", "table", None, None) == "[db].[table]"

    assert (
        get_datasource_full_name("db", "table", None, "schema")
        == "[db].[schema].[table]"
    )

    assert (
        get_datasource_full_name("db", "table", "catalog", None)
        == "[db].[catalog].[table]"
    )


@pytest.mark.parametrize(
    "referrer,expected",
    [
        (None, None),
        ("https://mysuperset.com/abc", None),
        ("https://mysuperset.com/superset/dashboard/", QuerySource.DASHBOARD),
        ("https://mysuperset.com/explore/", QuerySource.CHART),
        ("https://mysuperset.com/sqllab/", QuerySource.SQL_LAB),
    ],
)
def test_get_query_source_from_request(
    referrer: str | None,
    expected: QuerySource | None,
    mocker: MockerFixture,
    app_context: None,
) -> None:
    if referrer:
        # Use has_request_context to mock request when not in a request context
        with mocker.patch("flask.has_request_context", return_value=True):
            request_mock = mocker.MagicMock()
            request_mock.referrer = referrer
            mocker.patch("superset.utils.core.request", request_mock)
            assert get_query_source_from_request() == expected
    else:
        # When no referrer, test without request context
        with mocker.patch("flask.has_request_context", return_value=False):
            assert get_query_source_from_request() == expected


@with_config({"USER_AGENT_FUNC": None})
def test_get_user_agent(mocker: MockerFixture, app_context: None) -> None:
    database_mock = mocker.MagicMock()
    database_mock.database_name = "mydb"

    assert get_user_agent(database_mock, QuerySource.DASHBOARD) == "Apache Superset", (
        "The default user agent should be returned"
    )


@with_config(
    {
        "USER_AGENT_FUNC": lambda database,
        source: f"{database.database_name} {source.name}"
    }
)
def test_get_user_agent_custom(mocker: MockerFixture, app_context: None) -> None:
    database_mock = mocker.MagicMock()
    database_mock.database_name = "mydb"

    assert get_user_agent(database_mock, QuerySource.DASHBOARD) == "mydb DASHBOARD", (
        "the custom user agent function result should have been returned"
    )


def test_merge_extra_filters():
    # does nothing if no extra filters
    form_data = {"A": 1, "B": 2, "c": "test"}
    expected = {**form_data, "adhoc_filters": [], "applied_time_extras": {}}
    merge_extra_filters(form_data)
    assert form_data == expected
    # empty extra_filters
    form_data = {"A": 1, "B": 2, "c": "test", "extra_filters": []}
    expected = {
        "A": 1,
        "B": 2,
        "c": "test",
        "adhoc_filters": [],
        "applied_time_extras": {},
    }
    merge_extra_filters(form_data)
    assert form_data == expected
    # copy over extra filters into empty filters
    form_data = {
        "extra_filters": [
            {"col": "a", "op": "in", "val": "someval"},
            {"col": "B", "op": "==", "val": ["c1", "c2"]},
        ]
    }
    expected = {
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": "someval",
                "expressionType": "SIMPLE",
                "filterOptionName": "90cfb3c34852eb3bc741b0cc20053b46",
                "isExtra": True,
                "operator": "in",
                "subject": "a",
            },
            {
                "clause": "WHERE",
                "comparator": ["c1", "c2"],
                "expressionType": "SIMPLE",
                "filterOptionName": "6c178d069965f1c02640661280415d96",
                "isExtra": True,
                "operator": "==",
                "subject": "B",
            },
        ],
        "applied_time_extras": {},
    }
    merge_extra_filters(form_data)
    assert form_data == expected
    # adds extra filters to existing filters
    form_data = {
        "extra_filters": [
            {"col": "a", "op": "in", "val": "someval"},
            {"col": "B", "op": "==", "val": ["c1", "c2"]},
        ],
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": ["G1", "g2"],
                "expressionType": "SIMPLE",
                "operator": "!=",
                "subject": "D",
            }
        ],
    }
    expected = {
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": ["G1", "g2"],
                "expressionType": "SIMPLE",
                "operator": "!=",
                "subject": "D",
            },
            {
                "clause": "WHERE",
                "comparator": "someval",
                "expressionType": "SIMPLE",
                "filterOptionName": "90cfb3c34852eb3bc741b0cc20053b46",
                "isExtra": True,
                "operator": "in",
                "subject": "a",
            },
            {
                "clause": "WHERE",
                "comparator": ["c1", "c2"],
                "expressionType": "SIMPLE",
                "filterOptionName": "6c178d069965f1c02640661280415d96",
                "isExtra": True,
                "operator": "==",
                "subject": "B",
            },
        ],
        "applied_time_extras": {},
    }
    merge_extra_filters(form_data)
    assert form_data == expected
    # adds extra filters to existing filters and sets time options
    form_data = {
        "extra_filters": [
            {"col": "__time_range", "op": "in", "val": "1 year ago :"},
            {"col": "__time_col", "op": "in", "val": "birth_year"},
            {"col": "__time_grain", "op": "in", "val": "years"},
            {"col": "A", "op": "like", "val": "hello"},
        ]
    }
    expected = {
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": "hello",
                "expressionType": "SIMPLE",
                "filterOptionName": "e3cbdd92a2ae23ca92c6d7fca42e36a6",
                "isExtra": True,
                "operator": "like",
                "subject": "A",
            }
        ],
        "time_range": "1 year ago :",
        "granularity_sqla": "birth_year",
        "time_grain_sqla": "years",
        "applied_time_extras": {
            "__time_range": "1 year ago :",
            "__time_col": "birth_year",
            "__time_grain": "years",
        },
    }
    merge_extra_filters(form_data)
    assert form_data == expected


def test_merge_extra_filters_ignores_empty_filters():
    form_data = {
        "extra_filters": [
            {"col": "a", "op": "in", "val": ""},
            {"col": "B", "op": "==", "val": []},
        ]
    }
    expected = {"adhoc_filters": [], "applied_time_extras": {}}
    merge_extra_filters(form_data)
    assert form_data == expected


def test_merge_extra_filters_ignores_nones():
    form_data = {
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": "",
                "expressionType": "SIMPLE",
                "operator": "in",
                "subject": None,
            }
        ],
        "extra_filters": [{"col": "B", "op": "==", "val": []}],
    }
    expected = {
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": "",
                "expressionType": "SIMPLE",
                "operator": "in",
                "subject": None,
            }
        ],
        "applied_time_extras": {},
    }
    merge_extra_filters(form_data)
    assert form_data == expected


def test_merge_extra_filters_ignores_equal_filters():
    form_data = {
        "extra_filters": [
            {"col": "a", "op": "in", "val": "someval"},
            {"col": "B", "op": "==", "val": ["c1", "c2"]},
            {"col": "c", "op": "in", "val": ["c1", 1, None]},
        ],
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": "someval",
                "expressionType": "SIMPLE",
                "operator": "in",
                "subject": "a",
            },
            {
                "clause": "WHERE",
                "comparator": ["c1", "c2"],
                "expressionType": "SIMPLE",
                "operator": "==",
                "subject": "B",
            },
            {
                "clause": "WHERE",
                "comparator": ["c1", 1, None],
                "expressionType": "SIMPLE",
                "operator": "in",
                "subject": "c",
            },
        ],
    }
    expected = {
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": "someval",
                "expressionType": "SIMPLE",
                "operator": "in",
                "subject": "a",
            },
            {
                "clause": "WHERE",
                "comparator": ["c1", "c2"],
                "expressionType": "SIMPLE",
                "operator": "==",
                "subject": "B",
            },
            {
                "clause": "WHERE",
                "comparator": ["c1", 1, None],
                "expressionType": "SIMPLE",
                "operator": "in",
                "subject": "c",
            },
        ],
        "applied_time_extras": {},
    }
    merge_extra_filters(form_data)
    assert form_data == expected


def test_merge_extra_filters_merges_different_val_types():
    form_data = {
        "extra_filters": [
            {"col": "a", "op": "in", "val": ["g1", "g2"]},
            {"col": "B", "op": "==", "val": ["c1", "c2"]},
        ],
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": "someval",
                "expressionType": "SIMPLE",
                "operator": "in",
                "subject": "a",
            },
            {
                "clause": "WHERE",
                "comparator": ["c1", "c2"],
                "expressionType": "SIMPLE",
                "operator": "==",
                "subject": "B",
            },
        ],
    }
    expected = {
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": "someval",
                "expressionType": "SIMPLE",
                "operator": "in",
                "subject": "a",
            },
            {
                "clause": "WHERE",
                "comparator": ["c1", "c2"],
                "expressionType": "SIMPLE",
                "operator": "==",
                "subject": "B",
            },
            {
                "clause": "WHERE",
                "comparator": ["g1", "g2"],
                "expressionType": "SIMPLE",
                "filterOptionName": "c11969c994b40a83a4ae7d48ff1ea28e",
                "isExtra": True,
                "operator": "in",
                "subject": "a",
            },
        ],
        "applied_time_extras": {},
    }
    merge_extra_filters(form_data)
    assert form_data == expected
    form_data = {
        "extra_filters": [
            {"col": "a", "op": "in", "val": "someval"},
            {"col": "B", "op": "==", "val": ["c1", "c2"]},
        ],
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": ["g1", "g2"],
                "expressionType": "SIMPLE",
                "operator": "in",
                "subject": "a",
            },
            {
                "clause": "WHERE",
                "comparator": ["c1", "c2"],
                "expressionType": "SIMPLE",
                "operator": "==",
                "subject": "B",
            },
        ],
    }
    expected = {
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": ["g1", "g2"],
                "expressionType": "SIMPLE",
                "operator": "in",
                "subject": "a",
            },
            {
                "clause": "WHERE",
                "comparator": ["c1", "c2"],
                "expressionType": "SIMPLE",
                "operator": "==",
                "subject": "B",
            },
            {
                "clause": "WHERE",
                "comparator": "someval",
                "expressionType": "SIMPLE",
                "filterOptionName": "90cfb3c34852eb3bc741b0cc20053b46",
                "isExtra": True,
                "operator": "in",
                "subject": "a",
            },
        ],
        "applied_time_extras": {},
    }
    merge_extra_filters(form_data)
    assert form_data == expected


def test_merge_extra_filters_adds_unequal_lists():
    form_data = {
        "extra_filters": [
            {"col": "a", "op": "in", "val": ["g1", "g2", "g3"]},
            {"col": "B", "op": "==", "val": ["c1", "c2", "c3"]},
        ],
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": ["g1", "g2"],
                "expressionType": "SIMPLE",
                "operator": "in",
                "subject": "a",
            },
            {
                "clause": "WHERE",
                "comparator": ["c1", "c2"],
                "expressionType": "SIMPLE",
                "operator": "==",
                "subject": "B",
            },
        ],
    }
    expected = {
        "adhoc_filters": [
            {
                "clause": "WHERE",
                "comparator": ["g1", "g2"],
                "expressionType": "SIMPLE",
                "operator": "in",
                "subject": "a",
            },
            {
                "clause": "WHERE",
                "comparator": ["c1", "c2"],
                "expressionType": "SIMPLE",
                "operator": "==",
                "subject": "B",
            },
            {
                "clause": "WHERE",
                "comparator": ["g1", "g2", "g3"],
                "expressionType": "SIMPLE",
                "filterOptionName": "21cbb68af7b17e62b3b2f75e2190bfd7",
                "isExtra": True,
                "operator": "in",
                "subject": "a",
            },
            {
                "clause": "WHERE",
                "comparator": ["c1", "c2", "c3"],
                "expressionType": "SIMPLE",
                "filterOptionName": "0a8dcb928f1f4bba97643c6e68d672f1",
                "isExtra": True,
                "operator": "==",
                "subject": "B",
            },
        ],
        "applied_time_extras": {},
    }
    merge_extra_filters(form_data)
    assert form_data == expected


def test_merge_extra_filters_when_applied_time_extras_predefined():
    form_data = {"applied_time_extras": {"__time_range": "Last week"}}
    merge_extra_filters(form_data)

    assert form_data == {
        "applied_time_extras": {"__time_range": "Last week"},
        "adhoc_filters": [],
    }


def test_merge_request_params_when_url_params_undefined():
    form_data = {"since": "2000", "until": "now"}
    url_params = {"form_data": form_data, "dashboard_ids": "(1,2,3,4,5)"}
    merge_request_params(form_data, url_params)
    assert "url_params" in form_data.keys()
    assert "dashboard_ids" in form_data["url_params"]
    assert "form_data" not in form_data.keys()


def test_merge_request_params_when_url_params_predefined():
    form_data = {
        "since": "2000",
        "until": "now",
        "url_params": {"abc": "123", "dashboard_ids": "(1,2,3)"},
    }
    url_params = {"form_data": form_data, "dashboard_ids": "(1,2,3,4,5)"}
    merge_request_params(form_data, url_params)
    assert "url_params" in form_data.keys()
    assert "abc" in form_data["url_params"]
    assert url_params["dashboard_ids"] == form_data["url_params"]["dashboard_ids"]


def test_parse_js_uri_path_items_eval_undefined():
    assert parse_js_uri_path_item("undefined", eval_undefined=True) is None
    assert parse_js_uri_path_item("null", eval_undefined=True) is None
    assert "undefined" == parse_js_uri_path_item("undefined")
    assert "null" == parse_js_uri_path_item("null")


def test_parse_js_uri_path_items_unquote():
    assert "slashed/name" == parse_js_uri_path_item("slashed%2fname")
    assert "slashed%2fname" == parse_js_uri_path_item("slashed%2fname", unquote=False)


def test_parse_js_uri_path_items_item_optional():
    assert parse_js_uri_path_item(None) is None
    assert parse_js_uri_path_item("item") is not None


def test_get_stacktrace():
    current_app.config["SHOW_STACKTRACE"] = True
    try:
        raise Exception("NONONO!")
    except Exception:
        stacktrace = get_stacktrace()
        assert "NONONO" in stacktrace

    current_app.config["SHOW_STACKTRACE"] = False
    try:
        raise Exception("NONONO!")
    except Exception:
        stacktrace = get_stacktrace()
        assert stacktrace is None
