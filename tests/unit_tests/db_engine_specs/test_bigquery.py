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

# pylint: disable=line-too-long, import-outside-toplevel, protected-access, invalid-name

import json
from datetime import datetime
from typing import Optional

import pytest
from pytest_mock import MockFixture
from sqlalchemy import select
from sqlalchemy.sql import sqltypes
from sqlalchemy_bigquery import BigQueryDialect

from tests.unit_tests.db_engine_specs.utils import assert_convert_dttm
from tests.unit_tests.fixtures.common import dttm


def test_get_fields() -> None:
    """
    Test the custom ``_get_fields`` method.

    The method adds custom labels (aliases) to the columns to prevent
    collision when referencing record fields. Eg, if we had these two
    columns:

        name STRING
        project STRUCT<name STRING>

    One could write this query:

        SELECT
            `name`,
            `project`.`name`
        FROM
            the_table

    But then both columns would get aliased as "name".

    The custom method will replace the fields so that the final query
    looks like this:

        SELECT
            `name` AS `name`,
            `project`.`name` AS project__name
        FROM
            the_table

    """
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    columns = [{"name": "limit"}, {"name": "name"}, {"name": "project.name"}]
    fields = BigQueryEngineSpec._get_fields(columns)

    query = select(fields)
    assert str(query.compile(dialect=BigQueryDialect())) == (
        "SELECT `limit` AS `limit`, `name` AS `name`, "
        "`project`.`name` AS `project__name`"
    )


def test_select_star(mocker: MockFixture) -> None:
    """
    Test the ``select_star`` method.

    The method removes pseudo-columns from structures inside arrays. While these
    pseudo-columns show up as "columns" for metadata reasons, we can't select them
    in the query, as opposed to fields from non-array structures.
    """
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    cols = [
        {
            "name": "trailer",
            "type": sqltypes.ARRAY(sqltypes.JSON()),
            "nullable": True,
            "comment": None,
            "default": None,
            "precision": None,
            "scale": None,
            "max_length": None,
        },
        {
            "name": "trailer.key",
            "type": sqltypes.String(),
            "nullable": True,
            "comment": None,
            "default": None,
            "precision": None,
            "scale": None,
            "max_length": None,
        },
        {
            "name": "trailer.value",
            "type": sqltypes.String(),
            "nullable": True,
            "comment": None,
            "default": None,
            "precision": None,
            "scale": None,
            "max_length": None,
        },
        {
            "name": "trailer.email",
            "type": sqltypes.String(),
            "nullable": True,
            "comment": None,
            "default": None,
            "precision": None,
            "scale": None,
            "max_length": None,
        },
    ]

    # mock the database so we can compile the query
    database = mocker.MagicMock()
    database.compile_sqla_query = lambda query: str(
        query.compile(dialect=BigQueryDialect())
    )

    engine = mocker.MagicMock()
    engine.dialect = BigQueryDialect()

    sql = BigQueryEngineSpec.select_star(
        database=database,
        table_name="my_table",
        engine=engine,
        schema=None,
        limit=100,
        show_cols=True,
        indent=True,
        latest_partition=False,
        cols=cols,
    )
    assert (
        sql
        == """SELECT `trailer` AS `trailer`
FROM `my_table`
LIMIT :param_1"""
    )


def test_get_parameters_from_uri_serializable() -> None:
    """
    Test that the result from ``get_parameters_from_uri`` is JSON serializable.
    """
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    parameters = BigQueryEngineSpec.get_parameters_from_uri(
        "bigquery://dbt-tutorial-347100/",
        {"access_token": "TOP_SECRET"},
    )
    assert parameters == {"access_token": "TOP_SECRET", "query": {}}
    assert json.loads(json.dumps(parameters)) == parameters


def test_unmask_encrypted_extra() -> None:
    """
    Test that the private key can be reused from the previous ``encrypted_extra``.
    """
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    old = json.dumps(
        {
            "credentials_info": {
                "project_id": "black-sanctum-314419",
                "private_key": "SECRET",
            },
        }
    )
    new = json.dumps(
        {
            "credentials_info": {
                "project_id": "yellow-unicorn-314419",
                "private_key": "XXXXXXXXXX",
            },
        }
    )

    assert json.loads(str(BigQueryEngineSpec.unmask_encrypted_extra(old, new))) == {
        "credentials_info": {
            "project_id": "yellow-unicorn-314419",
            "private_key": "SECRET",
        },
    }


def test_unmask_encrypted_extra_when_empty() -> None:
    """
    Test that a None value works for ``encrypted_extra``.
    """
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    old = None
    new = json.dumps(
        {
            "credentials_info": {
                "project_id": "yellow-unicorn-314419",
                "private_key": "XXXXXXXXXX",
            },
        }
    )

    assert json.loads(str(BigQueryEngineSpec.unmask_encrypted_extra(old, new))) == {
        "credentials_info": {
            "project_id": "yellow-unicorn-314419",
            "private_key": "XXXXXXXXXX",
        },
    }


def test_unmask_encrypted_extra_when_new_is_empty() -> None:
    """
    Test that a None value works for ``encrypted_extra``.
    """
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    old = json.dumps(
        {
            "credentials_info": {
                "project_id": "black-sanctum-314419",
                "private_key": "SECRET",
            },
        }
    )
    new = None

    assert BigQueryEngineSpec.unmask_encrypted_extra(old, new) is None


def test_mask_encrypted_extra_when_empty() -> None:
    """
    Test that the encrypted extra will return a none value if the field is empty.
    """
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    assert BigQueryEngineSpec.mask_encrypted_extra(None) is None


def test_parse_error_message() -> None:
    """
    Test that we parse a received message and just extract the useful information.

    Example errors:
    bigquery error: 400 Syntax error:  Table \"case_detail_all_suites\" must be qualified with a dataset (e.g. dataset.table).

    (job ID: ddf30b05-44e8-4fbf-aa29-40bfccaed886)
                                                -----Query Job SQL Follows-----
    |    .    |    .    |    .    |\n   1:select * from case_detail_all_suites\n   2:LIMIT 1001\n    |    .    |    .    |    .    |
    """
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    message = 'bigquery error: 400 Syntax error: Table "case_detail_all_suites" must be qualified with a dataset (e.g. dataset.table).\n\n(job ID: ddf30b05-44e8-4fbf-aa29-40bfccaed886)\n\n     -----Query Job SQL Follows-----     \n\n    |    .    |    .    |    .    |\n   1:select * from case_detail_all_suites\n   2:LIMIT 1001\n    |    .    |    .    |    .    |'
    expected_result = 'bigquery error: 400 Syntax error: Table "case_detail_all_suites" must be qualified with a dataset (e.g. dataset.table).'
    assert (
        str(BigQueryEngineSpec.parse_error_exception(Exception(message)))
        == expected_result
    )


def test_parse_error_raises_exception() -> None:
    """
    Test that we handle any exception we might get from calling the parse_error_exception method.

    Example errors:
    400 Syntax error: Expected "(" or keyword UNNEST but got "@" at [4:80]
    bigquery error: 400 Table \"case_detail_all_suites\" must be qualified with a dataset (e.g. dataset.table).
    """
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec

    message = 'bigquery error: 400 Syntax error: Table "case_detail_all_suites" must be qualified with a dataset (e.g. dataset.table).'
    message_2 = "6"
    expected_result = 'bigquery error: 400 Syntax error: Table "case_detail_all_suites" must be qualified with a dataset (e.g. dataset.table).'
    assert (
        str(BigQueryEngineSpec.parse_error_exception(Exception(message)))
        == expected_result
    )
    assert str(BigQueryEngineSpec.parse_error_exception(Exception(message_2))) == "6"


@pytest.mark.parametrize(
    "target_type,expected_result",
    [
        ("Date", "CAST('2019-01-02' AS DATE)"),
        ("DateTime", "CAST('2019-01-02T03:04:05.678900' AS DATETIME)"),
        ("TimeStamp", "CAST('2019-01-02T03:04:05.678900' AS TIMESTAMP)"),
        ("Time", "CAST('03:04:05.678900' AS TIME)"),
        ("UnknownType", None),
    ],
)
def test_convert_dttm(
    target_type: str, expected_result: Optional[str], dttm: datetime
) -> None:
    """
    DB Eng Specs (bigquery): Test conversion to date time
    """
    from superset.db_engine_specs.bigquery import BigQueryEngineSpec as spec

    assert_convert_dttm(spec, target_type, expected_result, dttm)
