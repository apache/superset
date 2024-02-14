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
# pylint: disable=invalid-name, unused-argument

import json

import pytest
from pytest_mock import MockFixture
from sqlalchemy.dialects import mysql

from superset.commands.dataset.exceptions import DatasetNotFoundError
from superset.jinja_context import dataset_macro, WhereInMacro


def test_where_in() -> None:
    """
    Test the ``where_in`` Jinja2 filter.
    """
    where_in = WhereInMacro(mysql.dialect())
    assert where_in([1, "b", 3]) == "(1, 'b', 3)"
    assert where_in([1, "b", 3], '"') == (
        "(1, 'b', 3)\n-- WARNING: the `mark` parameter was removed from the "
        "`where_in` macro for security reasons\n"
    )
    assert where_in(["O'Malley's"]) == "('O''Malley''s')"


def test_dataset_macro(mocker: MockFixture) -> None:
    """
    Test the ``dataset_macro`` macro.
    """
    # pylint: disable=import-outside-toplevel
    from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
    from superset.models.core import Database

    columns = [
        TableColumn(column_name="ds", is_dttm=1, type="TIMESTAMP"),
        TableColumn(column_name="num_boys", type="INTEGER"),
        TableColumn(column_name="revenue", type="INTEGER"),
        TableColumn(column_name="expenses", type="INTEGER"),
        TableColumn(
            column_name="profit", type="INTEGER", expression="revenue-expenses"
        ),
    ]
    metrics = [
        SqlMetric(metric_name="cnt", expression="COUNT(*)"),
    ]

    dataset = SqlaTable(
        table_name="old_dataset",
        columns=columns,
        metrics=metrics,
        main_dttm_col="ds",
        default_endpoint="https://www.youtube.com/watch?v=dQw4w9WgXcQ",  # not used
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
        offset=-8,
        description="This is the description",
        is_featured=1,
        cache_timeout=3600,
        schema="my_schema",
        sql=None,
        params=json.dumps(
            {
                "remote_id": 64,
                "database_name": "examples",
                "import_time": 1606677834,
            }
        ),
        perm=None,
        filter_select_enabled=1,
        fetch_values_predicate="foo IN (1, 2)",
        is_sqllab_view=0,  # no longer used?
        template_params=json.dumps({"answer": "42"}),
        schema_perm=None,
        extra=json.dumps({"warning_markdown": "*WARNING*"}),
    )
    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")
    DatasetDAO.find_by_id.return_value = dataset

    assert (
        dataset_macro(1)
        == """(
SELECT ds AS ds,
       num_boys AS num_boys,
       revenue AS revenue,
       expenses AS expenses,
       revenue-expenses AS profit
FROM my_schema.old_dataset
) AS dataset_1"""
    )

    assert (
        dataset_macro(1, include_metrics=True)
        == """(
SELECT ds AS ds,
       num_boys AS num_boys,
       revenue AS revenue,
       expenses AS expenses,
       revenue-expenses AS profit,
       COUNT(*) AS cnt
FROM my_schema.old_dataset
GROUP BY ds,
         num_boys,
         revenue,
         expenses,
         revenue-expenses
) AS dataset_1"""
    )

    assert (
        dataset_macro(1, include_metrics=True, columns=["ds"])
        == """(
SELECT ds AS ds,
       COUNT(*) AS cnt
FROM my_schema.old_dataset
GROUP BY ds
) AS dataset_1"""
    )

    DatasetDAO.find_by_id.return_value = None
    with pytest.raises(DatasetNotFoundError) as excinfo:
        dataset_macro(1)
    assert str(excinfo.value) == "Dataset 1 not found!"


def test_dataset_macro_mutator_with_comments(mocker: MockFixture) -> None:
    """
    Test ``dataset_macro`` when the mutator adds comment.
    """

    def mutator(sql: str) -> str:
        """
        A simple mutator that wraps the query in comments.
        """
        return f"-- begin\n{sql}\n-- end"

    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")
    DatasetDAO.find_by_id().get_query_str_extended().sql = mutator("SELECT 1")
    assert (
        dataset_macro(1)
        == """(
-- begin
SELECT 1
-- end
) AS dataset_1"""
    )
