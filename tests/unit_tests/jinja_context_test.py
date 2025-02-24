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
from __future__ import annotations

from typing import Any

import pytest
from freezegun import freeze_time
from jinja2 import DebugUndefined
from jinja2.sandbox import SandboxedEnvironment
from pytest_mock import MockerFixture
from sqlalchemy.dialects import mysql
from sqlalchemy.dialects.postgresql import dialect

from superset import app
from superset.commands.dataset.exceptions import DatasetNotFoundError
from superset.connectors.sqla.models import SqlaTable, SqlMetric, TableColumn
from superset.exceptions import SupersetTemplateException
from superset.jinja_context import (
    dataset_macro,
    ExtraCache,
    get_template_processor,
    metric_macro,
    safe_proxy,
    TimeFilter,
    WhereInMacro,
)
from superset.models.core import Database
from superset.models.slice import Slice
from superset.utils import json


def test_filter_values_adhoc_filters() -> None:
    """
    Test the ``filter_values`` macro with ``adhoc_filters``.
    """
    with app.test_request_context(
        data={
            "form_data": json.dumps(
                {
                    "adhoc_filters": [
                        {
                            "clause": "WHERE",
                            "comparator": "foo",
                            "expressionType": "SIMPLE",
                            "operator": "in",
                            "subject": "name",
                        }
                    ],
                }
            )
        }
    ):
        cache = ExtraCache()
        assert cache.filter_values("name") == ["foo"]
        assert cache.applied_filters == ["name"]

    with app.test_request_context(
        data={
            "form_data": json.dumps(
                {
                    "adhoc_filters": [
                        {
                            "clause": "WHERE",
                            "comparator": ["foo", "bar"],
                            "expressionType": "SIMPLE",
                            "operator": "in",
                            "subject": "name",
                        }
                    ],
                }
            )
        }
    ):
        cache = ExtraCache()
        assert cache.filter_values("name") == ["foo", "bar"]
        assert cache.applied_filters == ["name"]


def test_filter_values_extra_filters() -> None:
    """
    Test the ``filter_values`` macro with ``extra_filters``.
    """
    with app.test_request_context(
        data={
            "form_data": json.dumps(
                {"extra_filters": [{"col": "name", "op": "in", "val": "foo"}]}
            )
        }
    ):
        cache = ExtraCache()
        assert cache.filter_values("name") == ["foo"]
        assert cache.applied_filters == ["name"]


def test_filter_values_default() -> None:
    """
    Test the ``filter_values`` macro with a default value.
    """
    cache = ExtraCache()
    assert cache.filter_values("name", "foo") == ["foo"]
    assert cache.removed_filters == []


def test_filter_values_remove_not_present() -> None:
    """
    Test the ``filter_values`` macro without a match and ``remove_filter`` set to True.
    """
    cache = ExtraCache()
    assert cache.filter_values("name", remove_filter=True) == []
    assert cache.removed_filters == []


def test_filter_values_no_default() -> None:
    """
    Test calling the ``filter_values`` macro without a match.
    """
    cache = ExtraCache()
    assert cache.filter_values("name") == []


def test_get_filters_adhoc_filters() -> None:
    """
    Test the ``get_filters`` macro.
    """
    with app.test_request_context(
        data={
            "form_data": json.dumps(
                {
                    "adhoc_filters": [
                        {
                            "clause": "WHERE",
                            "comparator": "foo",
                            "expressionType": "SIMPLE",
                            "operator": "in",
                            "subject": "name",
                        }
                    ],
                }
            )
        }
    ):
        cache = ExtraCache()
        assert cache.get_filters("name") == [
            {"op": "IN", "col": "name", "val": ["foo"]}
        ]

        assert cache.removed_filters == []
        assert cache.applied_filters == ["name"]

    with app.test_request_context(
        data={
            "form_data": json.dumps(
                {
                    "adhoc_filters": [
                        {
                            "clause": "WHERE",
                            "comparator": ["foo", "bar"],
                            "expressionType": "SIMPLE",
                            "operator": "in",
                            "subject": "name",
                        }
                    ],
                }
            )
        }
    ):
        cache = ExtraCache()
        assert cache.get_filters("name") == [
            {"op": "IN", "col": "name", "val": ["foo", "bar"]}
        ]
        assert cache.removed_filters == []

    with app.test_request_context(
        data={
            "form_data": json.dumps(
                {
                    "adhoc_filters": [
                        {
                            "clause": "WHERE",
                            "comparator": ["foo", "bar"],
                            "expressionType": "SIMPLE",
                            "operator": "in",
                            "subject": "name",
                        }
                    ],
                }
            )
        }
    ):
        cache = ExtraCache()
        assert cache.get_filters("name", remove_filter=True) == [
            {"op": "IN", "col": "name", "val": ["foo", "bar"]}
        ]
        assert cache.removed_filters == ["name"]
        assert cache.applied_filters == ["name"]


def test_get_filters_remove_not_present() -> None:
    """
    Test the ``get_filters`` macro without a match and ``remove_filter`` set to True.
    """
    cache = ExtraCache()
    assert cache.get_filters("name", remove_filter=True) == []
    assert cache.removed_filters == []


def test_url_param_query() -> None:
    """
    Test the ``url_param`` macro.
    """
    with app.test_request_context(query_string={"foo": "bar"}):
        cache = ExtraCache()
        assert cache.url_param("foo") == "bar"


def test_url_param_default() -> None:
    """
    Test the ``url_param`` macro with a default value.
    """
    with app.test_request_context():
        cache = ExtraCache()
        assert cache.url_param("foo", "bar") == "bar"


def test_url_param_no_default() -> None:
    """
    Test the ``url_param`` macro without a match.
    """
    with app.test_request_context():
        cache = ExtraCache()
        assert cache.url_param("foo") is None


def test_url_param_form_data() -> None:
    """
    Test the ``url_param`` with ``url_params`` in ``form_data``.
    """
    with app.test_request_context(
        query_string={"form_data": json.dumps({"url_params": {"foo": "bar"}})}
    ):
        cache = ExtraCache()
        assert cache.url_param("foo") == "bar"


def test_url_param_escaped_form_data() -> None:
    """
    Test the ``url_param`` with ``url_params`` in ``form_data`` returning
    an escaped value with a quote.
    """
    with app.test_request_context(
        query_string={"form_data": json.dumps({"url_params": {"foo": "O'Brien"}})}
    ):
        cache = ExtraCache(dialect=dialect())
        assert cache.url_param("foo") == "O''Brien"


def test_url_param_escaped_default_form_data() -> None:
    """
    Test the ``url_param`` with default value containing an escaped quote.
    """
    with app.test_request_context(
        query_string={"form_data": json.dumps({"url_params": {"foo": "O'Brien"}})}
    ):
        cache = ExtraCache(dialect=dialect())
        assert cache.url_param("bar", "O'Malley") == "O''Malley"


def test_url_param_unescaped_form_data() -> None:
    """
    Test the ``url_param`` with ``url_params`` in ``form_data`` returning
    an un-escaped value with a quote.
    """
    with app.test_request_context(
        query_string={"form_data": json.dumps({"url_params": {"foo": "O'Brien"}})}
    ):
        cache = ExtraCache(dialect=dialect())
        assert cache.url_param("foo", escape_result=False) == "O'Brien"


def test_url_param_unescaped_default_form_data() -> None:
    """
    Test the ``url_param`` with default value containing an un-escaped quote.
    """
    with app.test_request_context(
        query_string={"form_data": json.dumps({"url_params": {"foo": "O'Brien"}})}
    ):
        cache = ExtraCache(dialect=dialect())
        assert cache.url_param("bar", "O'Malley", escape_result=False) == "O'Malley"


def test_safe_proxy_primitive() -> None:
    """
    Test the ``safe_proxy`` helper with a function returning a ``str``.
    """

    def func(input_: Any) -> Any:
        return input_

    assert safe_proxy(func, "foo") == "foo"


def test_safe_proxy_dict() -> None:
    """
    Test the ``safe_proxy`` helper with a function returning a ``dict``.
    """

    def func(input_: Any) -> Any:
        return input_

    assert safe_proxy(func, {"foo": "bar"}) == {"foo": "bar"}


def test_safe_proxy_lambda() -> None:
    """
    Test the ``safe_proxy`` helper with a function returning a ``lambda``.
    Should raise ``SupersetTemplateException``.
    """

    def func(input_: Any) -> Any:
        return input_

    with pytest.raises(SupersetTemplateException):
        safe_proxy(func, lambda: "bar")


def test_safe_proxy_nested_lambda() -> None:
    """
    Test the ``safe_proxy`` helper with a function returning a ``dict``
    containing ``lambda`` value. Should raise ``SupersetTemplateException``.
    """

    def func(input_: Any) -> Any:
        return input_

    with pytest.raises(SupersetTemplateException):
        safe_proxy(func, {"foo": lambda: "bar"})


def test_user_macros(mocker: MockerFixture):
    """
    Test all user macros:
        - ``current_user_id``
        - ``current_username``
        - ``current_user_email``
    """
    mock_g = mocker.patch("superset.utils.core.g")
    mock_cache_key_wrapper = mocker.patch(
        "superset.jinja_context.ExtraCache.cache_key_wrapper"
    )
    mock_g.user.id = 1
    mock_g.user.username = "my_username"
    mock_g.user.email = "my_email@test.com"
    cache = ExtraCache()
    assert cache.current_user_id() == 1
    assert cache.current_username() == "my_username"
    assert cache.current_user_email() == "my_email@test.com"
    assert mock_cache_key_wrapper.call_count == 3


def test_user_macros_without_cache_key_inclusion(mocker: MockerFixture):
    """
    Test all user macros with ``add_to_cache_keys`` set to ``False``.
    """
    mock_g = mocker.patch("superset.utils.core.g")
    mock_cache_key_wrapper = mocker.patch(
        "superset.jinja_context.ExtraCache.cache_key_wrapper"
    )
    mock_g.user.id = 1
    mock_g.user.username = "my_username"
    mock_g.user.email = "my_email@test.com"
    cache = ExtraCache()
    assert cache.current_user_id(False) == 1
    assert cache.current_username(False) == "my_username"
    assert cache.current_user_email(False) == "my_email@test.com"
    assert mock_cache_key_wrapper.call_count == 0


def test_user_macros_without_user_info(mocker: MockerFixture):
    """
    Test all user macros when no user info is available.
    """
    mock_g = mocker.patch("superset.utils.core.g")
    mock_g.user = None
    cache = ExtraCache()
    assert cache.current_user_id() == None  # noqa: E711
    assert cache.current_username() == None  # noqa: E711
    assert cache.current_user_email() == None  # noqa: E711


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


def test_dataset_macro(mocker: MockerFixture) -> None:
    """
    Test the ``dataset_macro`` macro.
    """
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
        return_value=[],
    )

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
    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")  # noqa: N806
    DatasetDAO.find_by_id.return_value = dataset
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
        return_value=[],
    )

    space = " "

    assert (
        dataset_macro(1)
        == f"""(
SELECT ds AS ds, num_boys AS num_boys, revenue AS revenue, expenses AS expenses, revenue-expenses AS profit{space}
FROM my_schema.old_dataset
) AS dataset_1"""  # noqa: S608, E501
    )

    assert (
        dataset_macro(1, include_metrics=True)
        == f"""(
SELECT ds AS ds, num_boys AS num_boys, revenue AS revenue, expenses AS expenses, revenue-expenses AS profit, COUNT(*) AS cnt{space}
FROM my_schema.old_dataset GROUP BY ds, num_boys, revenue, expenses, revenue-expenses
) AS dataset_1"""  # noqa: S608, E501
    )

    assert (
        dataset_macro(1, include_metrics=True, columns=["ds"])
        == f"""(
SELECT ds AS ds, COUNT(*) AS cnt{space}
FROM my_schema.old_dataset GROUP BY ds
) AS dataset_1"""  # noqa: S608
    )

    DatasetDAO.find_by_id.return_value = None
    with pytest.raises(DatasetNotFoundError) as excinfo:
        dataset_macro(1)
    assert str(excinfo.value) == "Dataset 1 not found!"


def test_dataset_macro_mutator_with_comments(mocker: MockerFixture) -> None:
    """
    Test ``dataset_macro`` when the mutator adds comment.
    """

    def mutator(sql: str) -> str:
        """
        A simple mutator that wraps the query in comments.
        """
        return f"-- begin\n{sql}\n-- end"

    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")  # noqa: N806
    DatasetDAO.find_by_id().get_query_str_extended().sql = mutator("SELECT 1")
    assert (
        dataset_macro(1)
        == """(
-- begin
SELECT 1
-- end
) AS dataset_1"""
    )


def test_metric_macro_with_dataset_id(mocker: MockerFixture) -> None:
    """
    Test the ``metric_macro`` when passing a dataset ID.
    """
    mock_get_form_data = mocker.patch("superset.views.utils.get_form_data")
    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")  # noqa: N806
    DatasetDAO.find_by_id.return_value = SqlaTable(
        table_name="test_dataset",
        metrics=[
            SqlMetric(metric_name="count", expression="COUNT(*)"),
        ],
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
        schema="my_schema",
        sql=None,
    )
    env = SandboxedEnvironment(undefined=DebugUndefined)
    assert metric_macro(env, {}, "count", 1) == "COUNT(*)"
    mock_get_form_data.assert_not_called()


def test_metric_macro_recursive(mocker: MockerFixture) -> None:
    """
    Test the ``metric_macro`` when the definition is recursive.
    """
    database = Database(id=1, database_name="my_database", sqlalchemy_uri="sqlite://")
    dataset = SqlaTable(
        id=1,
        metrics=[
            SqlMetric(metric_name="a", expression="COUNT(*)"),
            SqlMetric(metric_name="b", expression="{{ metric('a') }}"),
            SqlMetric(metric_name="c", expression="{{ metric('b') }}"),
        ],
        table_name="test_dataset",
        database=database,
        schema="my_schema",
        sql=None,
    )

    mock_g = mocker.patch("superset.jinja_context.g")
    mock_g.form_data = {"datasource": {"id": 1}}
    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")  # noqa: N806
    DatasetDAO.find_by_id.return_value = dataset

    processor = get_template_processor(database=database)
    assert processor.process_template("{{ metric('c', 1) }}") == "COUNT(*)"


def test_metric_macro_expansion(mocker: MockerFixture) -> None:
    """
    Test that the ``metric_macro`` expands other macros.
    """
    database = Database(id=1, database_name="my_database", sqlalchemy_uri="sqlite://")
    dataset = SqlaTable(
        id=1,
        metrics=[
            SqlMetric(metric_name="a", expression="{{ current_user_id() }}"),
            SqlMetric(metric_name="b", expression="{{ metric('a') }}"),
            SqlMetric(metric_name="c", expression="{{ metric('b') }}"),
        ],
        table_name="test_dataset",
        database=database,
        schema="my_schema",
        sql=None,
    )

    mocker.patch("superset.jinja_context.get_user_id", return_value=42)
    mock_g = mocker.patch("superset.jinja_context.g")
    mock_g.form_data = {"datasource": {"id": 1}}
    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")  # noqa: N806
    DatasetDAO.find_by_id.return_value = dataset

    processor = get_template_processor(database=database)
    assert processor.process_template("{{ metric('c') }}") == "42"


def test_metric_macro_recursive_compound(mocker: MockerFixture) -> None:
    """
    Test the ``metric_macro`` when the definition is compound.
    """
    database = Database(id=1, database_name="my_database", sqlalchemy_uri="sqlite://")
    dataset = SqlaTable(
        id=1,
        metrics=[
            SqlMetric(metric_name="a", expression="SUM(*)"),
            SqlMetric(metric_name="b", expression="COUNT(*)"),
            SqlMetric(
                metric_name="c",
                expression="{{ metric('a') }} / {{ metric('b') }}",
            ),
        ],
        table_name="test_dataset",
        database=database,
        schema="my_schema",
        sql=None,
    )

    mock_g = mocker.patch("superset.jinja_context.g")
    mock_g.form_data = {"datasource": {"id": 1}}
    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")  # noqa: N806
    DatasetDAO.find_by_id.return_value = dataset

    processor = get_template_processor(database=database)
    assert processor.process_template("{{ metric('c') }}") == "SUM(*) / COUNT(*)"


def test_metric_macro_recursive_cyclic(mocker: MockerFixture) -> None:
    """
    Test the ``metric_macro`` when the definition is cyclic.

    In this case it should stop, and not go into an infinite loop.
    """
    database = Database(id=1, database_name="my_database", sqlalchemy_uri="sqlite://")
    dataset = SqlaTable(
        id=1,
        metrics=[
            SqlMetric(metric_name="a", expression="{{ metric('c') }}"),
            SqlMetric(metric_name="b", expression="{{ metric('a') }}"),
            SqlMetric(metric_name="c", expression="{{ metric('b') }}"),
        ],
        table_name="test_dataset",
        database=database,
        schema="my_schema",
        sql=None,
    )

    mock_g = mocker.patch("superset.jinja_context.g")
    mock_g.form_data = {"datasource": {"id": 1}}
    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")  # noqa: N806
    DatasetDAO.find_by_id.return_value = dataset

    processor = get_template_processor(database=database)
    with pytest.raises(SupersetTemplateException) as excinfo:
        processor.process_template("{{ metric('c') }}")
    assert str(excinfo.value) == "Infinite recursion detected in template"


def test_metric_macro_recursive_infinite(mocker: MockerFixture) -> None:
    """
    Test the ``metric_macro`` when the definition is cyclic.

    In this case it should stop, and not go into an infinite loop.
    """
    database = Database(id=1, database_name="my_database", sqlalchemy_uri="sqlite://")
    dataset = SqlaTable(
        id=1,
        metrics=[
            SqlMetric(metric_name="a", expression="{{ metric('a') }}"),
        ],
        table_name="test_dataset",
        database=database,
        schema="my_schema",
        sql=None,
    )

    mock_g = mocker.patch("superset.jinja_context.g")
    mock_g.form_data = {"datasource": {"id": 1}}
    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")  # noqa: N806
    DatasetDAO.find_by_id.return_value = dataset

    processor = get_template_processor(database=database)
    with pytest.raises(SupersetTemplateException) as excinfo:
        processor.process_template("{{ metric('a') }}")
    assert str(excinfo.value) == "Infinite recursion detected in template"


def test_metric_macro_with_dataset_id_invalid_key(mocker: MockerFixture) -> None:
    """
    Test the ``metric_macro`` when passing a dataset ID and an invalid key.
    """
    mock_get_form_data = mocker.patch("superset.views.utils.get_form_data")
    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")  # noqa: N806
    DatasetDAO.find_by_id.return_value = SqlaTable(
        table_name="test_dataset",
        metrics=[
            SqlMetric(metric_name="count", expression="COUNT(*)"),
        ],
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
        schema="my_schema",
        sql=None,
    )
    env = SandboxedEnvironment(undefined=DebugUndefined)
    with pytest.raises(SupersetTemplateException) as excinfo:
        metric_macro(env, {}, "blah", 1)
    assert str(excinfo.value) == "Metric ``blah`` not found in test_dataset."
    mock_get_form_data.assert_not_called()


def test_metric_macro_invalid_dataset_id(mocker: MockerFixture) -> None:
    """
    Test the ``metric_macro`` when specifying a dataset that doesn't exist.
    """
    mock_get_form_data = mocker.patch("superset.views.utils.get_form_data")
    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")  # noqa: N806
    DatasetDAO.find_by_id.return_value = None
    env = SandboxedEnvironment(undefined=DebugUndefined)
    with pytest.raises(DatasetNotFoundError) as excinfo:
        metric_macro(env, {}, "macro_key", 100)
    assert str(excinfo.value) == "Dataset ID 100 not found."
    mock_get_form_data.assert_not_called()


def test_metric_macro_no_dataset_id_no_context(mocker: MockerFixture) -> None:
    """
    Test the ``metric_macro`` when not specifying a dataset ID and it's
    not available in the context.
    """
    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")  # noqa: N806
    mock_g = mocker.patch("superset.jinja_context.g")
    mock_g.form_data = {}
    env = SandboxedEnvironment(undefined=DebugUndefined)
    with app.test_request_context():
        with pytest.raises(SupersetTemplateException) as excinfo:
            metric_macro(env, {}, "macro_key")
        assert str(excinfo.value) == (
            "Please specify the Dataset ID for the ``macro_key`` metric in the Jinja macro."  # noqa: E501
        )
        DatasetDAO.find_by_id.assert_not_called()


def test_metric_macro_no_dataset_id_with_context_missing_info(
    mocker: MockerFixture,
) -> None:
    """
    Test the ``metric_macro`` when not specifying a dataset ID and request
    has context but no dataset/chart ID.
    """
    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")  # noqa: N806
    mock_g = mocker.patch("superset.jinja_context.g")
    mock_g.form_data = {"queries": []}

    env = SandboxedEnvironment(undefined=DebugUndefined)
    with app.test_request_context(
        data={
            "form_data": json.dumps(
                {
                    "adhoc_filters": [
                        {
                            "clause": "WHERE",
                            "comparator": "foo",
                            "expressionType": "SIMPLE",
                            "operator": "in",
                            "subject": "name",
                        }
                    ],
                }
            ),
        }
    ):
        with pytest.raises(SupersetTemplateException) as excinfo:
            metric_macro(env, {}, "macro_key")
        assert str(excinfo.value) == (
            "Please specify the Dataset ID for the ``macro_key`` metric in the Jinja macro."  # noqa: E501
        )
        DatasetDAO.find_by_id.assert_not_called()


def test_metric_macro_no_dataset_id_with_context_datasource_id(
    mocker: MockerFixture,
) -> None:
    """
    Test the ``metric_macro`` when not specifying a dataset ID and it's
    available in the context (url_params.datasource_id).
    """
    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")  # noqa: N806
    DatasetDAO.find_by_id.return_value = SqlaTable(
        table_name="test_dataset",
        metrics=[
            SqlMetric(metric_name="macro_key", expression="COUNT(*)"),
        ],
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
        schema="my_schema",
        sql=None,
    )
    mock_g = mocker.patch("superset.jinja_context.g")
    mock_g.form_data = {}

    # Getting the data from the request context
    env = SandboxedEnvironment(undefined=DebugUndefined)
    with app.test_request_context(
        data={
            "form_data": json.dumps(
                {
                    "queries": [
                        {
                            "url_params": {
                                "datasource_id": 1,
                            }
                        }
                    ],
                }
            )
        }
    ):
        assert metric_macro(env, {}, "macro_key") == "COUNT(*)"

    # Getting data from g's form_data
    mock_g.form_data = {
        "queries": [
            {
                "url_params": {
                    "datasource_id": 1,
                }
            }
        ],
    }
    with app.test_request_context():
        assert metric_macro(env, {}, "macro_key") == "COUNT(*)"


def test_metric_macro_no_dataset_id_with_context_datasource_id_none(
    mocker: MockerFixture,
) -> None:
    """
    Test the ``metric_macro`` when not specifying a dataset ID and it's
    set to None in the context (url_params.datasource_id).
    """
    mock_g = mocker.patch("superset.jinja_context.g")
    mock_g.form_data = {}

    # Getting the data from the request context
    env = SandboxedEnvironment(undefined=DebugUndefined)
    with app.test_request_context(
        data={
            "form_data": json.dumps(
                {
                    "queries": [
                        {
                            "url_params": {
                                "datasource_id": None,
                            }
                        }
                    ],
                }
            )
        }
    ):
        with pytest.raises(SupersetTemplateException) as excinfo:
            metric_macro(env, {}, "macro_key")
        assert str(excinfo.value) == (
            "Please specify the Dataset ID for the ``macro_key`` metric in the Jinja macro."  # noqa: E501
        )

    # Getting data from g's form_data
    mock_g.form_data = {
        "queries": [
            {
                "url_params": {
                    "datasource_id": None,
                }
            }
        ],
    }
    with app.test_request_context():
        with pytest.raises(SupersetTemplateException) as excinfo:
            metric_macro(env, {}, "macro_key")
        assert str(excinfo.value) == (
            "Please specify the Dataset ID for the ``macro_key`` metric in the Jinja macro."  # noqa: E501
        )


def test_metric_macro_no_dataset_id_with_context_chart_id(
    mocker: MockerFixture,
) -> None:
    """
    Test the ``metric_macro`` when not specifying a dataset ID and context
    includes an existing chart ID (url_params.slice_id).
    """
    ChartDAO = mocker.patch("superset.daos.chart.ChartDAO")  # noqa: N806
    ChartDAO.find_by_id.return_value = Slice(
        datasource_id=1,
    )
    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")  # noqa: N806
    DatasetDAO.find_by_id.return_value = SqlaTable(
        table_name="test_dataset",
        metrics=[
            SqlMetric(metric_name="macro_key", expression="COUNT(*)"),
        ],
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
        schema="my_schema",
        sql=None,
    )

    mock_g = mocker.patch("superset.jinja_context.g")
    mock_g.form_data = {}

    # Getting the data from the request context
    env = SandboxedEnvironment(undefined=DebugUndefined)
    with app.test_request_context(
        data={
            "form_data": json.dumps(
                {
                    "queries": [
                        {
                            "url_params": {
                                "slice_id": 1,
                            }
                        }
                    ],
                }
            )
        }
    ):
        assert metric_macro(env, {}, "macro_key") == "COUNT(*)"

    # Getting data from g's form_data
    mock_g.form_data = {
        "queries": [
            {
                "url_params": {
                    "slice_id": 1,
                }
            }
        ],
    }
    with app.test_request_context():
        assert metric_macro(env, {}, "macro_key") == "COUNT(*)"


def test_metric_macro_no_dataset_id_with_context_slice_id_none(
    mocker: MockerFixture,
) -> None:
    """
    Test the ``metric_macro`` when not specifying a dataset ID and context
    includes slice_id set to None (url_params.slice_id).
    """
    mock_g = mocker.patch("superset.jinja_context.g")
    mock_g.form_data = {}

    # Getting the data from the request context
    env = SandboxedEnvironment(undefined=DebugUndefined)
    with app.test_request_context(
        data={
            "form_data": json.dumps(
                {
                    "queries": [
                        {
                            "url_params": {
                                "slice_id": None,
                            }
                        }
                    ],
                }
            )
        }
    ):
        with pytest.raises(SupersetTemplateException) as excinfo:
            metric_macro(env, {}, "macro_key")
        assert str(excinfo.value) == (
            "Please specify the Dataset ID for the ``macro_key`` metric in the Jinja macro."  # noqa: E501
        )

    # Getting data from g's form_data
    mock_g.form_data = {
        "queries": [
            {
                "url_params": {
                    "slice_id": None,
                }
            }
        ],
    }
    with app.test_request_context():
        with pytest.raises(SupersetTemplateException) as excinfo:
            metric_macro(env, {}, "macro_key")
        assert str(excinfo.value) == (
            "Please specify the Dataset ID for the ``macro_key`` metric in the Jinja macro."  # noqa: E501
        )


def test_metric_macro_no_dataset_id_with_context_deleted_chart(
    mocker: MockerFixture,
) -> None:
    """
    Test the ``metric_macro`` when not specifying a dataset ID and context
    includes a deleted chart ID.
    """
    ChartDAO = mocker.patch("superset.daos.chart.ChartDAO")  # noqa: N806
    ChartDAO.find_by_id.return_value = None
    mock_g = mocker.patch("superset.jinja_context.g")
    mock_g.form_data = {}

    # Getting the data from the request context
    env = SandboxedEnvironment(undefined=DebugUndefined)
    with app.test_request_context(
        data={
            "form_data": json.dumps(
                {
                    "queries": [
                        {
                            "url_params": {
                                "slice_id": 1,
                            }
                        }
                    ],
                }
            )
        }
    ):
        with pytest.raises(SupersetTemplateException) as excinfo:
            metric_macro(env, {}, "macro_key")
        assert str(excinfo.value) == (
            "Please specify the Dataset ID for the ``macro_key`` metric in the Jinja macro."  # noqa: E501
        )

    # Getting data from g's form_data
    mock_g.form_data = {
        "queries": [
            {
                "url_params": {
                    "slice_id": 1,
                }
            }
        ],
    }
    with app.test_request_context():
        with pytest.raises(SupersetTemplateException) as excinfo:
            metric_macro(env, {}, "macro_key")
        assert str(excinfo.value) == (
            "Please specify the Dataset ID for the ``macro_key`` metric in the Jinja macro."  # noqa: E501
        )


def test_metric_macro_no_dataset_id_available_in_request_form_data(
    mocker: MockerFixture,
) -> None:
    """
    Test the ``metric_macro`` when not specifying a dataset ID and context
    includes an existing dataset ID (datasource.id).
    """
    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")  # noqa: N806
    DatasetDAO.find_by_id.return_value = SqlaTable(
        table_name="test_dataset",
        metrics=[
            SqlMetric(metric_name="macro_key", expression="COUNT(*)"),
        ],
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
        schema="my_schema",
        sql=None,
    )

    mock_g = mocker.patch("superset.jinja_context.g")
    mock_g.form_data = {}

    # Getting the data from the request context
    env = SandboxedEnvironment(undefined=DebugUndefined)
    with app.test_request_context(
        data={
            "form_data": json.dumps(
                {
                    "datasource": {
                        "id": 1,
                    },
                }
            )
        }
    ):
        assert metric_macro(env, {}, "macro_key") == "COUNT(*)"

    # Getting data from g's form_data
    mock_g.form_data = {
        "datasource": "1__table",
    }

    with app.test_request_context():
        assert metric_macro(env, {}, "macro_key") == "COUNT(*)"


@pytest.mark.parametrize(
    "description,args,kwargs,sqlalchemy_uri,queries,time_filter,removed_filters,applied_filters",
    [
        (
            "Missing time_range and filter will return a No filter result",
            [],
            {"target_type": "TIMESTAMP"},
            "postgresql://mydb",
            [{}],
            TimeFilter(
                from_expr=None,
                to_expr=None,
                time_range="No filter",
            ),
            [],
            [],
        ),
        (
            "Missing time range and filter with default value will return a result with the defaults",  # noqa: E501
            [],
            {"default": "Last week", "target_type": "TIMESTAMP"},
            "postgresql://mydb",
            [{}],
            TimeFilter(
                from_expr="TO_TIMESTAMP('2024-08-27 00:00:00.000000', 'YYYY-MM-DD HH24:MI:SS.US')",  # noqa: E501
                to_expr="TO_TIMESTAMP('2024-09-03 00:00:00.000000', 'YYYY-MM-DD HH24:MI:SS.US')",  # noqa: E501
                time_range="Last week",
            ),
            [],
            [],
        ),
        (
            "Time range is extracted with the expected format, and default is ignored",
            [],
            {"default": "Last month", "target_type": "TIMESTAMP"},
            "postgresql://mydb",
            [{"time_range": "Last week"}],
            TimeFilter(
                from_expr="TO_TIMESTAMP('2024-08-27 00:00:00.000000', 'YYYY-MM-DD HH24:MI:SS.US')",  # noqa: E501
                to_expr="TO_TIMESTAMP('2024-09-03 00:00:00.000000', 'YYYY-MM-DD HH24:MI:SS.US')",  # noqa: E501
                time_range="Last week",
            ),
            [],
            [],
        ),
        (
            "Filter is extracted with the native format of the column (TIMESTAMP)",
            ["dttm"],
            {},
            "postgresql://mydb",
            [
                {
                    "filters": [
                        {
                            "col": "dttm",
                            "op": "TEMPORAL_RANGE",
                            "val": "Last week",
                        },
                    ],
                }
            ],
            TimeFilter(
                from_expr="TO_TIMESTAMP('2024-08-27 00:00:00.000000', 'YYYY-MM-DD HH24:MI:SS.US')",  # noqa: E501
                to_expr="TO_TIMESTAMP('2024-09-03 00:00:00.000000', 'YYYY-MM-DD HH24:MI:SS.US')",  # noqa: E501
                time_range="Last week",
            ),
            [],
            ["dttm"],
        ),
        (
            "Filter is extracted with the native format of the column (DATE)",
            ["dt"],
            {"remove_filter": True},
            "postgresql://mydb",
            [
                {
                    "filters": [
                        {
                            "col": "dt",
                            "op": "TEMPORAL_RANGE",
                            "val": "Last week",
                        },
                    ],
                }
            ],
            TimeFilter(
                from_expr="TO_DATE('2024-08-27', 'YYYY-MM-DD')",
                to_expr="TO_DATE('2024-09-03', 'YYYY-MM-DD')",
                time_range="Last week",
            ),
            ["dt"],
            ["dt"],
        ),
        (
            "Filter is extracted with the overridden format (TIMESTAMP to DATE)",
            ["dttm"],
            {"target_type": "DATE", "remove_filter": True},
            "trino://mydb",
            [
                {
                    "filters": [
                        {
                            "col": "dttm",
                            "op": "TEMPORAL_RANGE",
                            "val": "Last month",
                        },
                    ],
                }
            ],
            TimeFilter(
                from_expr="DATE '2024-08-03'",
                to_expr="DATE '2024-09-03'",
                time_range="Last month",
            ),
            ["dttm"],
            ["dttm"],
        ),
        (
            "Filter is formatted with the custom format, ignoring target_type",
            ["dttm"],
            {"target_type": "DATE", "strftime": "%Y%m%d", "remove_filter": True},
            "trino://mydb",
            [
                {
                    "filters": [
                        {
                            "col": "dttm",
                            "op": "TEMPORAL_RANGE",
                            "val": "Last month",
                        },
                    ],
                }
            ],
            TimeFilter(
                from_expr="20240803",
                to_expr="20240903",
                time_range="Last month",
            ),
            ["dttm"],
            ["dttm"],
        ),
    ],
)
def test_get_time_filter(
    description: str,
    args: list[Any],
    kwargs: dict[str, Any],
    sqlalchemy_uri: str,
    queries: list[Any] | None,
    time_filter: TimeFilter,
    removed_filters: list[str],
    applied_filters: list[str],
) -> None:
    """
    Test the ``get_time_filter`` macro.
    """
    columns = [
        TableColumn(column_name="dt", is_dttm=1, type="DATE"),
        TableColumn(column_name="dttm", is_dttm=1, type="TIMESTAMP"),
    ]

    database = Database(database_name="my_database", sqlalchemy_uri=sqlalchemy_uri)
    table = SqlaTable(
        table_name="my_dataset",
        columns=columns,
        main_dttm_col="dt",
        database=database,
    )

    with (
        freeze_time("2024-09-03"),
        app.test_request_context(
            json={"queries": queries},
        ),
    ):
        cache = ExtraCache(
            database=database,
            table=table,
        )

        assert cache.get_time_filter(*args, **kwargs) == time_filter, description
        assert cache.removed_filters == removed_filters
        assert cache.applied_filters == applied_filters
