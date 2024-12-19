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
from datetime import datetime
from typing import Any, Optional
from unittest import mock

import pytest
import pytz
from pyhive.sqlalchemy_presto import PrestoDialect
from sqlalchemy import column, sql, text, types
from sqlalchemy.engine.url import make_url

from superset.sql_parse import Table
from superset.utils.core import GenericDataType
from tests.unit_tests.db_engine_specs.utils import (
    assert_column_spec,
    assert_convert_dttm,
)


@pytest.mark.parametrize(
    "target_type,dttm,expected_result",
    [
        ("VARCHAR", datetime(2022, 1, 1), None),
        ("DATE", datetime(2022, 1, 1), "DATE '2022-01-01'"),
        (
            "TIMESTAMP",
            datetime(2022, 1, 1, 1, 23, 45, 600000),
            "TIMESTAMP '2022-01-01 01:23:45.600000'",
        ),
        (
            "TIMESTAMP WITH TIME ZONE",
            datetime(2022, 1, 1, 1, 23, 45, 600000),
            "TIMESTAMP '2022-01-01 01:23:45.600000'",
        ),
        (
            "TIMESTAMP WITH TIME ZONE",
            datetime(2022, 1, 1, 1, 23, 45, 600000, tzinfo=pytz.UTC),
            "TIMESTAMP '2022-01-01 01:23:45.600000+00:00'",
        ),
    ],
)
def test_convert_dttm(
    target_type: str,
    dttm: datetime,
    expected_result: Optional[str],
) -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec as spec  # noqa: N813

    assert_convert_dttm(spec, target_type, expected_result, dttm)


@pytest.mark.parametrize(
    "native_type,sqla_type,attrs,generic_type,is_dttm",
    [
        ("varchar(255)", types.VARCHAR, {"length": 255}, GenericDataType.STRING, False),
        ("varchar", types.String, None, GenericDataType.STRING, False),
        ("char(255)", types.CHAR, {"length": 255}, GenericDataType.STRING, False),
        ("char", types.String, None, GenericDataType.STRING, False),
        ("integer", types.Integer, None, GenericDataType.NUMERIC, False),
        ("time", types.Time, None, GenericDataType.TEMPORAL, True),
        ("timestamp", types.TIMESTAMP, None, GenericDataType.TEMPORAL, True),
    ],
)
def test_get_column_spec(
    native_type: str,
    sqla_type: type[types.TypeEngine],
    attrs: Optional[dict[str, Any]],
    generic_type: GenericDataType,
    is_dttm: bool,
) -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec as spec  # noqa: N813

    assert_column_spec(spec, native_type, sqla_type, attrs, generic_type, is_dttm)


def test_get_schema_from_engine_params() -> None:
    """
    Test the ``get_schema_from_engine_params`` method.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    assert (
        PrestoEngineSpec.get_schema_from_engine_params(
            make_url("presto://localhost:8080/hive/default"),
            {},
        )
        == "default"
    )

    assert (
        PrestoEngineSpec.get_schema_from_engine_params(
            make_url("presto://localhost:8080/hive"),
            {},
        )
        is None
    )


@mock.patch("superset.db_engine_specs.presto.PrestoEngineSpec.latest_partition")
@pytest.mark.parametrize(
    ["column_type", "column_value", "expected_value"],
    [
        ("DATE", "2023-05-01", "DATE '2023-05-01'"),
        ("TIMESTAMP", "2023-05-01", "TIMESTAMP '2023-05-01'"),
        ("VARCHAR", "2023-05-01", "'2023-05-01'"),
        ("INT", 1234, "1234"),
    ],
)
def test_where_latest_partition(
    mock_latest_partition,
    column_type: str,
    column_value: Any,
    expected_value: str,
) -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec

    mock_latest_partition.return_value = (["partition_key"], [column_value])

    assert (
        str(
            PrestoEngineSpec.where_latest_partition(  # type: ignore
                database=mock.MagicMock(),
                table=Table("table"),
                query=sql.select(text("* FROM table")),
                columns=[
                    {
                        "column_name": "partition_key",
                        "name": "partition_key",
                        "type": column_type,
                        "is_dttm": False,
                    }
                ],
            ).compile(
                dialect=PrestoDialect(),
                compile_kwargs={"literal_binds": True},
            )
        )
        == f"""SELECT * FROM table \nWHERE "partition_key" = {expected_value}"""  # noqa: S608
    )


def test_adjust_engine_params_fully_qualified() -> None:
    """
    Test the ``adjust_engine_params`` method when the URL has catalog and schema.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    url = make_url("presto://localhost:8080/hive/default")

    uri = PrestoEngineSpec.adjust_engine_params(url, {})[0]
    assert str(uri) == "presto://localhost:8080/hive/default"

    uri = PrestoEngineSpec.adjust_engine_params(
        url,
        {},
        schema="new_schema",
    )[0]
    assert str(uri) == "presto://localhost:8080/hive/new_schema"

    uri = PrestoEngineSpec.adjust_engine_params(
        url,
        {},
        catalog="new_catalog",
    )[0]
    assert str(uri) == "presto://localhost:8080/new_catalog/default"

    uri = PrestoEngineSpec.adjust_engine_params(
        url,
        {},
        catalog="new_catalog",
        schema="new_schema",
    )[0]
    assert str(uri) == "presto://localhost:8080/new_catalog/new_schema"


def test_adjust_engine_params_catalog_only() -> None:
    """
    Test the ``adjust_engine_params`` method when the URL has only the catalog.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec

    url = make_url("presto://localhost:8080/hive")

    uri = PrestoEngineSpec.adjust_engine_params(url, {})[0]
    assert str(uri) == "presto://localhost:8080/hive"

    uri = PrestoEngineSpec.adjust_engine_params(
        url,
        {},
        schema="new_schema",
    )[0]
    assert str(uri) == "presto://localhost:8080/hive/new_schema"

    uri = PrestoEngineSpec.adjust_engine_params(
        url,
        {},
        catalog="new_catalog",
    )[0]
    assert str(uri) == "presto://localhost:8080/new_catalog"

    uri = PrestoEngineSpec.adjust_engine_params(
        url,
        {},
        catalog="new_catalog",
        schema="new_schema",
    )[0]
    assert str(uri) == "presto://localhost:8080/new_catalog/new_schema"


def test_get_default_catalog() -> None:
    """
    Test the ``get_default_catalog`` method.
    """
    from superset.db_engine_specs.presto import PrestoEngineSpec
    from superset.models.core import Database

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="presto://localhost:8080/hive",
    )
    assert PrestoEngineSpec.get_default_catalog(database) == "hive"

    database = Database(
        database_name="my_db",
        sqlalchemy_uri="presto://localhost:8080/hive/default",
    )
    assert PrestoEngineSpec.get_default_catalog(database) == "hive"


@pytest.mark.parametrize(
    "time_grain,expected_result",
    [
        ("PT1S", "date_trunc('second', CAST(col AS TIMESTAMP))"),
        (
            "PT5S",
            "date_trunc('second', CAST(col AS TIMESTAMP)) - interval '1' second * (second(CAST(col AS TIMESTAMP)) % 5)",  # noqa: E501
        ),
        (
            "PT30S",
            "date_trunc('second', CAST(col AS TIMESTAMP)) - interval '1' second * (second(CAST(col AS TIMESTAMP)) % 30)",  # noqa: E501
        ),
        ("PT1M", "date_trunc('minute', CAST(col AS TIMESTAMP))"),
        (
            "PT5M",
            "date_trunc('minute', CAST(col AS TIMESTAMP)) - interval '1' minute * (minute(CAST(col AS TIMESTAMP)) % 5)",  # noqa: E501
        ),
        (
            "PT10M",
            "date_trunc('minute', CAST(col AS TIMESTAMP)) - interval '1' minute * (minute(CAST(col AS TIMESTAMP)) % 10)",  # noqa: E501
        ),
        (
            "PT15M",
            "date_trunc('minute', CAST(col AS TIMESTAMP)) - interval '1' minute * (minute(CAST(col AS TIMESTAMP)) % 15)",  # noqa: E501
        ),
        (
            "PT0.5H",
            "date_trunc('minute', CAST(col AS TIMESTAMP)) - interval '1' minute * (minute(CAST(col AS TIMESTAMP)) % 30)",  # noqa: E501
        ),
        ("PT1H", "date_trunc('hour', CAST(col AS TIMESTAMP))"),
        (
            "PT6H",
            "date_trunc('hour', CAST(col AS TIMESTAMP)) - interval '1' hour * (hour(CAST(col AS TIMESTAMP)) % 6)",  # noqa: E501
        ),
        ("P1D", "date_trunc('day', CAST(col AS TIMESTAMP))"),
        ("P1W", "date_trunc('week', CAST(col AS TIMESTAMP))"),
        ("P1M", "date_trunc('month', CAST(col AS TIMESTAMP))"),
        ("P3M", "date_trunc('quarter', CAST(col AS TIMESTAMP))"),
        ("P1Y", "date_trunc('year', CAST(col AS TIMESTAMP))"),
        (
            "1969-12-28T00:00:00Z/P1W",
            "date_trunc('week', CAST(col AS TIMESTAMP) + interval '1' day) - interval '1' day",  # noqa: E501
        ),
        ("1969-12-29T00:00:00Z/P1W", "date_trunc('week', CAST(col AS TIMESTAMP))"),
        (
            "P1W/1970-01-03T00:00:00Z",
            "date_trunc('week', CAST(col AS TIMESTAMP) + interval '1' day) + interval '5' day",  # noqa: E501
        ),
        (
            "P1W/1970-01-04T00:00:00Z",
            "date_trunc('week', CAST(col AS TIMESTAMP)) + interval '6' day",
        ),
    ],
)
def test_timegrain_expressions(time_grain: str, expected_result: str) -> None:
    from superset.db_engine_specs.presto import PrestoEngineSpec as spec  # noqa: N813

    actual = str(
        spec.get_timestamp_expr(col=column("col"), pdf=None, time_grain=time_grain)
    )
    assert actual == expected_result
