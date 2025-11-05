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

# flake8: noqa: E501

from typing import Any, Iterator
from unittest.mock import MagicMock

import pytest
from pandas import DataFrame
from pytest_mock import MockerFixture

from superset.semantic_layers.snowflake import (
    SnowflakeConfiguration,
    SnowflakeSemanticView,
)
from superset.semantic_layers.types import (
    AdhocFilter,
    DATE,
    Dimension,
    Filter,
    INTEGER,
    Metric,
    NUMBER,
    Operator,
    OrderDirection,
    PredicateType,
    SemanticRequest,
    STRING,
)


@pytest.fixture
def configuration() -> SnowflakeConfiguration:
    return SnowflakeConfiguration.model_validate(
        {
            "account_identifier": "abcdefg-hij01234",
            "role": "ACCOUNTADMIN",
            "warehouse": "COMPUTE_WH",
            "database": "SAMPLE_DATA",
            "schema": "TPCDS_SF10TCL",
            "auth": {
                "auth_type": "user_password",
                "username": "SNOWFLAKE_USER",
                "password": "SNOWFLAKE_PASSWORD",
            },
            "allow_changing_database": True,
            "allow_changing_schema": True,
        }
    )


# These fixtures reproduce the semantic view from
# https://quickstarts.snowflake.com/guide/snowflake-semantic-view/index.html
@pytest.fixture
def dimension_rows() -> list[dict[str, str]]:
    return [
        dict(
            zip(
                ["object_name", "property", "property_value"],
                row,
                strict=False,
            )
        )
        for row in [
            ("BIRTHYEAR", "TABLE", "CUSTOMER"),
            ("BIRTHYEAR", "EXPRESSION", "C_BIRTH_YEAR"),
            ("BIRTHYEAR", "DATA_TYPE", "NUMBER(38,0)"),
            ("COUNTRY", "TABLE", "CUSTOMER"),
            ("COUNTRY", "EXPRESSION", "C_BIRTH_COUNTRY"),
            ("COUNTRY", "DATA_TYPE", "VARCHAR(20)"),
            ("C_CUSTOMER_SK", "TABLE", "CUSTOMER"),
            ("C_CUSTOMER_SK", "EXPRESSION", "c_customer_sk"),
            ("C_CUSTOMER_SK", "DATA_TYPE", "NUMBER(38,0)"),
            ("DATE", "TABLE", "DATE"),
            ("DATE", "EXPRESSION", "D_DATE"),
            ("DATE", "DATA_TYPE", "DATE"),
            ("D_DATE_SK", "TABLE", "DATE"),
            ("D_DATE_SK", "EXPRESSION", "d_date_sk"),
            ("D_DATE_SK", "DATA_TYPE", "NUMBER(38,0)"),
            ("MONTH", "TABLE", "DATE"),
            ("MONTH", "EXPRESSION", "D_MOY"),
            ("MONTH", "DATA_TYPE", "NUMBER(38,0)"),
            ("WEEK", "TABLE", "DATE"),
            ("WEEK", "EXPRESSION", "D_WEEK_SEQ"),
            ("WEEK", "DATA_TYPE", "NUMBER(38,0)"),
            ("YEAR", "TABLE", "DATE"),
            ("YEAR", "EXPRESSION", "D_YEAR"),
            ("YEAR", "DATA_TYPE", "NUMBER(38,0)"),
            ("CD_DEMO_SK", "TABLE", "DEMO"),
            ("CD_DEMO_SK", "EXPRESSION", "cd_demo_sk"),
            ("CD_DEMO_SK", "DATA_TYPE", "NUMBER(38,0)"),
            ("CREDIT_RATING", "TABLE", "DEMO"),
            ("CREDIT_RATING", "EXPRESSION", "CD_CREDIT_RATING"),
            ("CREDIT_RATING", "DATA_TYPE", "VARCHAR(10)"),
            ("MARITAL_STATUS", "TABLE", "DEMO"),
            ("MARITAL_STATUS", "EXPRESSION", "CD_MARITAL_STATUS"),
            ("MARITAL_STATUS", "DATA_TYPE", "VARCHAR(1)"),
            ("BRAND", "TABLE", "ITEM"),
            ("BRAND", "EXPRESSION", "I_BRAND"),
            ("BRAND", "DATA_TYPE", "VARCHAR(50)"),
            ("CATEGORY", "TABLE", "ITEM"),
            ("CATEGORY", "EXPRESSION", "I_CATEGORY"),
            ("CATEGORY", "DATA_TYPE", "VARCHAR(50)"),
            ("CLASS", "TABLE", "ITEM"),
            ("CLASS", "EXPRESSION", "I_CLASS"),
            ("CLASS", "DATA_TYPE", "VARCHAR(50)"),
            ("I_ITEM_SK", "TABLE", "ITEM"),
            ("I_ITEM_SK", "EXPRESSION", "i_item_sk"),
            ("I_ITEM_SK", "DATA_TYPE", "NUMBER(38,0)"),
            ("MARKET", "TABLE", "STORE"),
            ("MARKET", "EXPRESSION", "S_MARKET_ID"),
            ("MARKET", "DATA_TYPE", "NUMBER(38,0)"),
            ("SQUAREFOOTAGE", "TABLE", "STORE"),
            ("SQUAREFOOTAGE", "EXPRESSION", "S_FLOOR_SPACE"),
            ("SQUAREFOOTAGE", "DATA_TYPE", "NUMBER(38,0)"),
            ("STATE", "TABLE", "STORE"),
            ("STATE", "EXPRESSION", "S_STATE"),
            ("STATE", "DATA_TYPE", "VARCHAR(2)"),
            ("STORECOUNTRY", "TABLE", "STORE"),
            ("STORECOUNTRY", "EXPRESSION", "S_COUNTRY"),
            ("STORECOUNTRY", "DATA_TYPE", "VARCHAR(20)"),
            ("S_STORE_SK", "TABLE", "STORE"),
            ("S_STORE_SK", "EXPRESSION", "s_store_sk"),
            ("S_STORE_SK", "DATA_TYPE", "NUMBER(38,0)"),
            ("SS_CDEMO_SK", "TABLE", "STORESALES"),
            ("SS_CDEMO_SK", "EXPRESSION", "ss_cdemo_sk"),
            ("SS_CDEMO_SK", "DATA_TYPE", "NUMBER(38,0)"),
            ("SS_CUSTOMER_SK", "TABLE", "STORESALES"),
            ("SS_CUSTOMER_SK", "EXPRESSION", "ss_customer_sk"),
            ("SS_CUSTOMER_SK", "DATA_TYPE", "NUMBER(38,0)"),
            ("SS_ITEM_SK", "TABLE", "STORESALES"),
            ("SS_ITEM_SK", "EXPRESSION", "ss_item_sk"),
            ("SS_ITEM_SK", "DATA_TYPE", "NUMBER(38,0)"),
            ("SS_SOLD_DATE_SK", "TABLE", "STORESALES"),
            ("SS_SOLD_DATE_SK", "EXPRESSION", "ss_sold_date_sk"),
            ("SS_SOLD_DATE_SK", "DATA_TYPE", "NUMBER(38,0)"),
            ("SS_STORE_SK", "TABLE", "STORESALES"),
            ("SS_STORE_SK", "EXPRESSION", "ss_store_sk"),
            ("SS_STORE_SK", "DATA_TYPE", "NUMBER(38,0)"),
        ]
    ]


@pytest.fixture
def metric_rows() -> list[dict[str, str]]:
    return [
        dict(
            zip(
                ["object_name", "property", "property_value"],
                row,
                strict=False,
            )
        )
        for row in [
            ("TOTALCOST", "TABLE", "STORESALES"),
            ("TOTALCOST", "EXPRESSION", "SUM(item.cost)"),
            ("TOTALCOST", "DATA_TYPE", "NUMBER(19,2)"),
            ("TOTALSALESPRICE", "TABLE", "STORESALES"),
            ("TOTALSALESPRICE", "EXPRESSION", "SUM(SS_SALES_PRICE)"),
            ("TOTALSALESPRICE", "DATA_TYPE", "NUMBER(19,2)"),
            ("TOTALSALESQUANTITY", "TABLE", "STORESALES"),
            ("TOTALSALESQUANTITY", "EXPRESSION", "SUM(SS_QUANTITY)"),
            ("TOTALSALESQUANTITY", "DATA_TYPE", "NUMBER(38,0)"),
        ]
    ]


@pytest.fixture
def connection(mocker: MockerFixture) -> Iterator[MagicMock]:
    """
    Mock the Snowflake connect function to return a mock connection.
    """
    # Patch connect in both places where it's imported
    connect = mocker.patch("superset.semantic_layers.snowflake.semantic_view.connect")
    mocker.patch(
        "superset.semantic_layers.snowflake.semantic_layer.connect", new=connect
    )
    with connect() as connection:
        yield connection


@pytest.fixture
def semantic_view(
    mocker: MockerFixture,
    connection: MagicMock,
    configuration: SnowflakeConfiguration,
    dimension_rows: list[dict[str, str]],
    metric_rows: list[dict[str, str]],
) -> SnowflakeSemanticView:
    """
    Mock the SnowflakeSemanticView to return predefined dimensions and metrics.
    """
    connection.cursor().execute().fetchall.side_effect = [
        dimension_rows,
        metric_rows,
    ]

    return SnowflakeSemanticView("TPCDS_SEMANTIC_VIEW_SM", configuration)


def test_get_dimensions(
    mocker: MockerFixture,
    connection: MagicMock,
    semantic_view: SnowflakeSemanticView,
) -> None:
    """
    Test dimension retrieval and parsing from Snowflake semantic layer.
    """
    assert semantic_view.dimensions == {
        Dimension(
            id="CUSTOMER.C_CUSTOMER_SK",
            name="C_CUSTOMER_SK",
            type=INTEGER,
            definition=None,
            description="c_customer_sk",
            grain=None,
        ),
        Dimension(
            id="STORE.SQUAREFOOTAGE",
            name="SQUAREFOOTAGE",
            type=INTEGER,
            definition=None,
            description="S_FLOOR_SPACE",
            grain=None,
        ),
        Dimension(
            id="ITEM.BRAND",
            name="BRAND",
            type=STRING,
            definition=None,
            description="I_BRAND",
            grain=None,
        ),
        Dimension(
            id="ITEM.CATEGORY",
            name="CATEGORY",
            type=STRING,
            definition=None,
            description="I_CATEGORY",
            grain=None,
        ),
        Dimension(
            id="STORE.S_STORE_SK",
            name="S_STORE_SK",
            type=INTEGER,
            definition=None,
            description="s_store_sk",
            grain=None,
        ),
        Dimension(
            id="STORESALES.SS_CUSTOMER_SK",
            name="SS_CUSTOMER_SK",
            type=INTEGER,
            definition=None,
            description="ss_customer_sk",
            grain=None,
        ),
        Dimension(
            id="DATE.DATE",
            name="DATE",
            type=DATE,
            definition=None,
            description="D_DATE",
            grain=None,
        ),
        Dimension(
            id="DEMO.CD_DEMO_SK",
            name="CD_DEMO_SK",
            type=INTEGER,
            definition=None,
            description="cd_demo_sk",
            grain=None,
        ),
        Dimension(
            id="DATE.MONTH",
            name="MONTH",
            type=INTEGER,
            definition=None,
            description="D_MOY",
            grain=None,
        ),
        Dimension(
            id="STORE.MARKET",
            name="MARKET",
            type=INTEGER,
            definition=None,
            description="S_MARKET_ID",
            grain=None,
        ),
        Dimension(
            id="STORESALES.SS_ITEM_SK",
            name="SS_ITEM_SK",
            type=INTEGER,
            definition=None,
            description="ss_item_sk",
            grain=None,
        ),
        Dimension(
            id="STORE.STORECOUNTRY",
            name="STORECOUNTRY",
            type=STRING,
            definition=None,
            description="S_COUNTRY",
            grain=None,
        ),
        Dimension(
            id="ITEM.CLASS",
            name="CLASS",
            type=STRING,
            definition=None,
            description="I_CLASS",
            grain=None,
        ),
        Dimension(
            id="CUSTOMER.COUNTRY",
            name="COUNTRY",
            type=STRING,
            definition=None,
            description="C_BIRTH_COUNTRY",
            grain=None,
        ),
        Dimension(
            id="DEMO.CREDIT_RATING",
            name="CREDIT_RATING",
            type=STRING,
            definition=None,
            description="CD_CREDIT_RATING",
            grain=None,
        ),
        Dimension(
            id="DATE.WEEK",
            name="WEEK",
            type=INTEGER,
            definition=None,
            description="D_WEEK_SEQ",
            grain=None,
        ),
        Dimension(
            id="DATE.D_DATE_SK",
            name="D_DATE_SK",
            type=INTEGER,
            definition=None,
            description="d_date_sk",
            grain=None,
        ),
        Dimension(
            id="STORESALES.SS_SOLD_DATE_SK",
            name="SS_SOLD_DATE_SK",
            type=INTEGER,
            definition=None,
            description="ss_sold_date_sk",
            grain=None,
        ),
        Dimension(
            id="CUSTOMER.BIRTHYEAR",
            name="BIRTHYEAR",
            type=INTEGER,
            definition=None,
            description="C_BIRTH_YEAR",
            grain=None,
        ),
        Dimension(
            id="DEMO.MARITAL_STATUS",
            name="MARITAL_STATUS",
            type=STRING,
            definition=None,
            description="CD_MARITAL_STATUS",
            grain=None,
        ),
        Dimension(
            id="STORESALES.SS_CDEMO_SK",
            name="SS_CDEMO_SK",
            type=INTEGER,
            definition=None,
            description="ss_cdemo_sk",
            grain=None,
        ),
        Dimension(
            id="DATE.YEAR",
            name="YEAR",
            type=INTEGER,
            definition=None,
            description="D_YEAR",
            grain=None,
        ),
        Dimension(
            id="ITEM.I_ITEM_SK",
            name="I_ITEM_SK",
            type=INTEGER,
            definition=None,
            description="i_item_sk",
            grain=None,
        ),
        Dimension(
            id="STORESALES.SS_STORE_SK",
            name="SS_STORE_SK",
            type=INTEGER,
            definition=None,
            description="ss_store_sk",
            grain=None,
        ),
        Dimension(
            id="STORE.STATE",
            name="STATE",
            type=STRING,
            definition=None,
            description="S_STATE",
            grain=None,
        ),
    }

    connection.cursor().execute.assert_any_call(
        """
DESC SEMANTIC VIEW "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
    ->> SELECT "object_name", "property", "property_value"
        FROM $1
        WHERE
            "object_kind" = 'DIMENSION' AND
            "property" IN ('COMMENT', 'DATA_TYPE', 'EXPRESSION', 'TABLE');
        """.strip()
    )


def test_get_metrics(
    mocker: MockerFixture,
    connection: MagicMock,
    semantic_view: SnowflakeSemanticView,
) -> None:
    """
    Test metric retrieval and parsing from Snowflake semantic layer.
    """
    assert semantic_view.metrics == {
        Metric(
            id="STORESALES.TOTALCOST",
            name="TOTALCOST",
            type=NUMBER,
            definition="SUM(item.cost)",
            description=None,
        ),
        Metric(
            id="STORESALES.TOTALSALESQUANTITY",
            name="TOTALSALESQUANTITY",
            type=INTEGER,
            definition="SUM(SS_QUANTITY)",
            description=None,
        ),
        Metric(
            id="STORESALES.TOTALSALESPRICE",
            name="TOTALSALESPRICE",
            type=NUMBER,
            definition="SUM(SS_SALES_PRICE)",
            description=None,
        ),
    }

    connection.cursor().execute.assert_any_call(
        """
DESC SEMANTIC VIEW "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
    ->> SELECT "object_name", "property", "property_value"
        FROM $1
        WHERE
            "object_kind" = 'METRIC' AND
            "property" IN ('COMMENT', 'DATA_TYPE', 'EXPRESSION', 'TABLE');
        """.strip()
    )


def test_get_values(
    mocker: MockerFixture,
    connection: MagicMock,
    semantic_view: SnowflakeSemanticView,
) -> None:
    connection.cursor().execute().fetch_pandas_all.return_value = DataFrame(
        {
            "CATEGORY": [
                "Music",
                "Women",
                "Home",
                "Children",
                "Men",
                "Electronics",
                "Sports",
                "Shoes",
                "Jewelry",
                "Books",
                None,
            ]
        }
    )

    dimension = Dimension(
        id="ITEM.CATEGORY",
        name="CATEGORY",
        type=STRING,
        description=None,
        definition="I_CATEGORY",
        grain=None,
    )

    result = semantic_view.get_values(dimension)

    assert result.requests == [
        SemanticRequest(
            type="snowflake",
            definition="""
SELECT "CATEGORY"
FROM SEMANTIC_VIEW(
    "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
    DIMENSIONS ITEM.CATEGORY

)
            """.strip(),
        )
    ]
    assert result.results["CATEGORY"].tolist() == [
        "Music",
        "Women",
        "Home",
        "Children",
        "Men",
        "Electronics",
        "Sports",
        "Shoes",
        "Jewelry",
        "Books",
        None,
    ]


def test_get_values_with_filters(
    mocker: MockerFixture,
    connection: MagicMock,
    semantic_view: SnowflakeSemanticView,
) -> None:
    connection.cursor().execute().fetch_pandas_all.return_value = DataFrame(
        {
            "CATEGORY": [
                "Music",
                "Women",
                "Home",
                "Children",
                "Men",
                "Electronics",
                "Sports",
                "Shoes",
                "Jewelry",
            ]
        }
    )

    dimension = Dimension(
        id="ITEM.CATEGORY",
        name="CATEGORY",
        type=STRING,
        description=None,
        definition="I_CATEGORY",
        grain=None,
    )
    filters: set[Filter | AdhocFilter] = {
        Filter(PredicateType.WHERE, dimension, Operator.NOT_EQUALS, "Books"),
        Filter(PredicateType.WHERE, dimension, Operator.IS_NOT_NULL, None),
    }

    result = semantic_view.get_values(dimension, filters)

    assert result.requests == [
        SemanticRequest(
            type="snowflake",
            definition="""
SELECT "CATEGORY"
FROM SEMANTIC_VIEW(
    "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
    DIMENSIONS ITEM.CATEGORY
    WHERE ("CATEGORY" != 'Books') AND ("CATEGORY" IS NOT NULL)
)
            """.strip(),
        )
    ]
    assert result.results["CATEGORY"].tolist() == [
        "Music",
        "Women",
        "Home",
        "Children",
        "Men",
        "Electronics",
        "Sports",
        "Shoes",
        "Jewelry",
    ]


@pytest.mark.parametrize(
    "metrics, dimensions, filters, order, limit, offset, sql",
    [
        (
            ["TOTALSALESPRICE"],
            [],
            {
                AdhocFilter(PredicateType.WHERE, "Year = '2002'"),
                AdhocFilter(PredicateType.WHERE, "Month = '12'"),
            },
            None,
            10,
            10,
            """
SELECT * FROM SEMANTIC_VIEW(
    "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"

    METRICS STORESALES.TOTALSALESPRICE AS "STORESALES.TOTALSALESPRICE"
    WHERE (Month = '12') AND (Year = '2002')
)

LIMIT 10
OFFSET 10
            """,
        ),
        (
            [],
            ["CATEGORY"],
            {
                AdhocFilter(PredicateType.WHERE, "Year = '2002'"),
                AdhocFilter(PredicateType.WHERE, "Month = '12'"),
            },
            None,
            20,
            None,
            """
SELECT * FROM SEMANTIC_VIEW(
    "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
    DIMENSIONS ITEM.CATEGORY AS "ITEM.CATEGORY"

    WHERE (Month = '12') AND (Year = '2002')
)

LIMIT 20
            """,
        ),
        (
            ["TOTALSALESPRICE"],
            ["CATEGORY"],
            {
                AdhocFilter(PredicateType.WHERE, "Year = '2002'"),
                AdhocFilter(PredicateType.WHERE, "Month = '12'"),
            },
            [
                ("TOTALSALESPRICE", OrderDirection.DESC),
                ("CATEGORY", OrderDirection.ASC),
            ],
            10,
            10,
            """
SELECT * FROM SEMANTIC_VIEW(
    "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
    DIMENSIONS ITEM.CATEGORY AS "ITEM.CATEGORY"
    METRICS STORESALES.TOTALSALESPRICE AS "STORESALES.TOTALSALESPRICE"
    WHERE (Month = '12') AND (Year = '2002')
)
ORDER BY "STORESALES.TOTALSALESPRICE" DESC, "ITEM.CATEGORY" ASC
LIMIT 10
OFFSET 10
            """,
        ),
    ],
)
def test_get_query(
    semantic_view: SnowflakeSemanticView,
    metrics: list[str],
    dimensions: list[str],
    filters: set[Filter | AdhocFilter] | None,
    order: list[tuple[str, OrderDirection]] | None,
    limit: int | None,
    offset: int | None,
    sql: str,
) -> None:
    """
    Tests for query generation.
    """
    metric_map = {metric.name: metric for metric in semantic_view.metrics}
    dimension_map = {dim.name: dim for dim in semantic_view.dimensions}
    element_map: dict[str, Metric | Dimension] = {**metric_map, **dimension_map}

    result_sql, _ = semantic_view._get_query(
        [metric_map[name] for name in metrics],
        [dimension_map[name] for name in dimensions],
        filters,
        [(element_map[name], direction) for name, direction in (order or [])],
        limit,
        offset,
    )

    assert result_sql.strip() == sql.strip()


@pytest.mark.parametrize(
    "metrics, dimensions, filters, order, limit, offset, group_limit_config, sql",
    [
        # Test 1: Basic group limit without group_others
        (
            ["TOTALSALESPRICE"],
            ["YEAR", "CATEGORY"],
            {
                AdhocFilter(PredicateType.WHERE, "Year = '2002'"),
                AdhocFilter(PredicateType.WHERE, "Month = '12'"),
            },
            None,
            None,
            None,
            {
                "dimensions": ["CATEGORY"],
                "top": 3,
                "metric": "TOTALSALESPRICE",
                "direction": OrderDirection.DESC,
                "group_others": False,
                "filters": None,
            },
            """
WITH top_groups AS (
    SELECT "ITEM.CATEGORY"
    FROM SEMANTIC_VIEW(
        "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
        DIMENSIONS ITEM.CATEGORY AS "ITEM.CATEGORY"
        METRICS STORESALES.TOTALSALESPRICE
            AS "STORESALES.TOTALSALESPRICE"
        WHERE (Month = '12') AND (Year = '2002')
    )
    ORDER BY
        "STORESALES.TOTALSALESPRICE" DESC
    LIMIT 3
)
            SELECT * FROM SEMANTIC_VIEW(
                "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
                DIMENSIONS DATE.YEAR AS "DATE.YEAR", ITEM.CATEGORY AS "ITEM.CATEGORY"
                METRICS STORESALES.TOTALSALESPRICE AS "STORESALES.TOTALSALESPRICE"
                WHERE (Month = '12') AND (Year = '2002')
            ) AS subquery
            WHERE "ITEM.CATEGORY" IN (SELECT "ITEM.CATEGORY" FROM top_groups)
            """,
        ),
        # Test 2: Group limit with group_others
        (
            ["TOTALSALESPRICE"],
            ["YEAR", "CATEGORY"],
            {
                AdhocFilter(PredicateType.WHERE, "Year = '2002'"),
                AdhocFilter(PredicateType.WHERE, "Month = '12'"),
            },
            None,
            None,
            None,
            {
                "dimensions": ["CATEGORY"],
                "top": 3,
                "metric": "TOTALSALESPRICE",
                "direction": OrderDirection.DESC,
                "group_others": True,
                "filters": None,
            },
            """
WITH top_groups AS (
    SELECT "ITEM.CATEGORY"
    FROM SEMANTIC_VIEW(
        "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
        DIMENSIONS ITEM.CATEGORY AS "ITEM.CATEGORY"
        METRICS STORESALES.TOTALSALESPRICE
            AS "STORESALES.TOTALSALESPRICE"
        WHERE (Month = '12') AND (Year = '2002')
    )
    ORDER BY
        "STORESALES.TOTALSALESPRICE" DESC
    LIMIT 3
),
            raw_data AS (
    SELECT * FROM SEMANTIC_VIEW(
        "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
        DIMENSIONS DATE.YEAR AS "DATE.YEAR", ITEM.CATEGORY AS "ITEM.CATEGORY"
        METRICS STORESALES.TOTALSALESPRICE AS "STORESALES.TOTALSALESPRICE"
        WHERE (Month = '12') AND (Year = '2002')
    )
)
            SELECT
                CASE
            WHEN "ITEM.CATEGORY" IN (SELECT "ITEM.CATEGORY" FROM top_groups) THEN "ITEM.CATEGORY"
            ELSE CAST('Other' AS VARCHAR)
        END AS "ITEM.CATEGORY",
    "DATE.YEAR" AS "DATE.YEAR",
    SUM("STORESALES.TOTALSALESPRICE") AS "STORESALES.TOTALSALESPRICE"
            FROM raw_data
            GROUP BY CASE
            WHEN "ITEM.CATEGORY" IN (SELECT "ITEM.CATEGORY" FROM top_groups) THEN "ITEM.CATEGORY"
            ELSE CAST('Other' AS VARCHAR)
        END, "DATE.YEAR"
            """,
        ),
        # Test 3: Group limit with custom filters (different from main query)
        (
            ["TOTALSALESPRICE"],
            ["YEAR", "CATEGORY"],
            {
                AdhocFilter(PredicateType.WHERE, "Year = '2002'"),
                AdhocFilter(PredicateType.WHERE, "Month = '12'"),
            },
            None,
            None,
            None,
            {
                "dimensions": ["CATEGORY"],
                "top": 5,
                "metric": "TOTALSALESPRICE",
                "direction": OrderDirection.DESC,
                "group_others": False,
                "filters": {AdhocFilter(PredicateType.WHERE, "Year = '2001'")},
            },
            """
WITH top_groups AS (
    SELECT "ITEM.CATEGORY"
    FROM SEMANTIC_VIEW(
        "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
        DIMENSIONS ITEM.CATEGORY AS "ITEM.CATEGORY"
        METRICS STORESALES.TOTALSALESPRICE
            AS "STORESALES.TOTALSALESPRICE"
        WHERE (Year = '2001')
    )
    ORDER BY
        "STORESALES.TOTALSALESPRICE" DESC
    LIMIT 5
)
            SELECT * FROM SEMANTIC_VIEW(
                "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
                DIMENSIONS DATE.YEAR AS "DATE.YEAR", ITEM.CATEGORY AS "ITEM.CATEGORY"
                METRICS STORESALES.TOTALSALESPRICE AS "STORESALES.TOTALSALESPRICE"
                WHERE (Month = '12') AND (Year = '2002')
            ) AS subquery
            WHERE "ITEM.CATEGORY" IN (SELECT "ITEM.CATEGORY" FROM top_groups)
            """,
        ),
        # Test 4: Group limit with ASC direction
        (
            ["TOTALSALESPRICE"],
            ["CATEGORY"],
            None,
            None,
            10,
            None,
            {
                "dimensions": ["CATEGORY"],
                "top": 5,
                "metric": "TOTALSALESPRICE",
                "direction": OrderDirection.ASC,
                "group_others": False,
                "filters": None,
            },
            """
WITH top_groups AS (
    SELECT "ITEM.CATEGORY"
    FROM SEMANTIC_VIEW(
        "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
        DIMENSIONS ITEM.CATEGORY AS "ITEM.CATEGORY"
        METRICS STORESALES.TOTALSALESPRICE
            AS "STORESALES.TOTALSALESPRICE"

    )
    ORDER BY
        "STORESALES.TOTALSALESPRICE" ASC
    LIMIT 5
)
            SELECT * FROM SEMANTIC_VIEW(
                "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
                DIMENSIONS ITEM.CATEGORY AS "ITEM.CATEGORY"
                METRICS STORESALES.TOTALSALESPRICE AS "STORESALES.TOTALSALESPRICE"

            ) AS subquery
            WHERE "ITEM.CATEGORY" IN (SELECT "ITEM.CATEGORY" FROM top_groups)

            LIMIT 10
            """,
        ),
        # Test 5: Group limit with order clause
        (
            ["TOTALSALESPRICE"],
            ["YEAR", "CATEGORY"],
            {AdhocFilter(PredicateType.WHERE, "Year = '2002'")},
            [
                ("YEAR", OrderDirection.DESC),
                ("TOTALSALESPRICE", OrderDirection.ASC),
            ],
            None,
            None,
            {
                "dimensions": ["CATEGORY"],
                "top": 10,
                "metric": "TOTALSALESPRICE",
                "direction": OrderDirection.DESC,
                "group_others": False,
                "filters": None,
            },
            """
WITH top_groups AS (
    SELECT "ITEM.CATEGORY"
    FROM SEMANTIC_VIEW(
        "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
        DIMENSIONS ITEM.CATEGORY AS "ITEM.CATEGORY"
        METRICS STORESALES.TOTALSALESPRICE
            AS "STORESALES.TOTALSALESPRICE"
        WHERE (Year = '2002')
    )
    ORDER BY
        "STORESALES.TOTALSALESPRICE" DESC
    LIMIT 10
)
            SELECT * FROM SEMANTIC_VIEW(
                "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
                DIMENSIONS DATE.YEAR AS "DATE.YEAR", ITEM.CATEGORY AS "ITEM.CATEGORY"
                METRICS STORESALES.TOTALSALESPRICE AS "STORESALES.TOTALSALESPRICE"
                WHERE (Year = '2002')
            ) AS subquery
            WHERE "ITEM.CATEGORY" IN (SELECT "ITEM.CATEGORY" FROM top_groups)
            ORDER BY "DATE.YEAR" DESC, "STORESALES.TOTALSALESPRICE" ASC
            """,
        ),
        # Test 6: Group limit with limit and offset
        (
            ["TOTALSALESPRICE"],
            ["CATEGORY"],
            None,
            None,
            20,
            5,
            {
                "dimensions": ["CATEGORY"],
                "top": 3,
                "metric": "TOTALSALESPRICE",
                "direction": OrderDirection.DESC,
                "group_others": False,
                "filters": None,
            },
            """
WITH top_groups AS (
    SELECT "ITEM.CATEGORY"
    FROM SEMANTIC_VIEW(
        "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
        DIMENSIONS ITEM.CATEGORY AS "ITEM.CATEGORY"
        METRICS STORESALES.TOTALSALESPRICE
            AS "STORESALES.TOTALSALESPRICE"

    )
    ORDER BY
        "STORESALES.TOTALSALESPRICE" DESC
    LIMIT 3
)
            SELECT * FROM SEMANTIC_VIEW(
                "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
                DIMENSIONS ITEM.CATEGORY AS "ITEM.CATEGORY"
                METRICS STORESALES.TOTALSALESPRICE AS "STORESALES.TOTALSALESPRICE"

            ) AS subquery
            WHERE "ITEM.CATEGORY" IN (SELECT "ITEM.CATEGORY" FROM top_groups)

            LIMIT 20
            OFFSET 5
            """,
        ),
        # Test 7: Group limit with metric=None (order by dimension instead)
        (
            ["TOTALSALESPRICE"],
            ["CATEGORY"],
            None,
            None,
            10,
            None,
            {
                "dimensions": ["CATEGORY"],
                "top": 5,
                "metric": None,
                "direction": OrderDirection.ASC,
                "group_others": False,
                "filters": None,
            },
            """
WITH top_groups AS (
    SELECT "ITEM.CATEGORY"
    FROM SEMANTIC_VIEW(
        "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
        DIMENSIONS ITEM.CATEGORY AS "ITEM.CATEGORY"

    )
    ORDER BY
        "ITEM.CATEGORY" ASC
    LIMIT 5
)
            SELECT * FROM SEMANTIC_VIEW(
                "SAMPLE_DATA"."TPCDS_SF10TCL"."TPCDS_SEMANTIC_VIEW_SM"
                DIMENSIONS ITEM.CATEGORY AS "ITEM.CATEGORY"
                METRICS STORESALES.TOTALSALESPRICE AS "STORESALES.TOTALSALESPRICE"

            ) AS subquery
            WHERE "ITEM.CATEGORY" IN (SELECT "ITEM.CATEGORY" FROM top_groups)

            LIMIT 10
            """,
        ),
    ],
)
def test_get_query_with_group_limit(
    semantic_view: SnowflakeSemanticView,
    metrics: list[str],
    dimensions: list[str],
    filters: set[Filter | AdhocFilter] | None,
    order: list[tuple[str, OrderDirection]] | None,
    limit: int | None,
    offset: int | None,
    group_limit_config: dict[str, Any],
    sql: str,
) -> None:
    """
    Tests for query generation with GroupLimit.
    """
    from superset.semantic_layers.types import GroupLimit

    metric_map = {metric.name: metric for metric in semantic_view.metrics}
    dimension_map = {dim.name: dim for dim in semantic_view.dimensions}
    element_map: dict[str, Metric | Dimension] = {**metric_map, **dimension_map}

    # Build GroupLimit object from config
    group_limit = GroupLimit(
        dimensions=[dimension_map[name] for name in group_limit_config["dimensions"]],
        top=group_limit_config["top"],
        metric=(
            metric_map[group_limit_config["metric"]]
            if group_limit_config["metric"]
            else None
        ),
        direction=group_limit_config["direction"],
        group_others=group_limit_config["group_others"],
        filters=group_limit_config["filters"],
    )

    result_sql, _ = semantic_view._get_query(
        [metric_map[name] for name in metrics],
        [dimension_map[name] for name in dimensions],
        filters,
        [(element_map[name], direction) for name, direction in (order or [])],
        limit,
        offset,
        group_limit=group_limit,
    )

    assert result_sql == sql.strip()
