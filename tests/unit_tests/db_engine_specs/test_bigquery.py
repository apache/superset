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

from pybigquery.sqlalchemy_bigquery import BigQueryDialect
from pytest_mock import MockFixture
from sqlalchemy import select
from sqlalchemy.sql import sqltypes


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

    assert json.loads(BigQueryEngineSpec.unmask_encrypted_extra(old, new)) == {
        "credentials_info": {
            "project_id": "yellow-unicorn-314419",
            "private_key": "SECRET",
        },
    }
