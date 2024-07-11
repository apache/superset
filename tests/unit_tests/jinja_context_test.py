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

from typing import Any

import pytest
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
    metric_macro,
    safe_proxy,
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
    mocker.patch(
        "superset.models.helpers.security_manager.get_rls_filters",
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
    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")
    DatasetDAO.find_by_id.return_value = dataset
    mocker.patch(
        "superset.connectors.sqla.models.security_manager.get_guest_rls_filters",
        return_value=[],
    )
    mocker.patch(
        "superset.models.helpers.security_manager.get_guest_rls_filters",
        return_value=[],
    )

    assert (
        dataset_macro(1)
        == """(
SELECT
  ds AS ds,
  num_boys AS num_boys,
  revenue AS revenue,
  expenses AS expenses,
  revenue - expenses AS profit
FROM my_schema.old_dataset
) AS dataset_1"""
    )

    assert (
        dataset_macro(1, include_metrics=True)
        == """(
SELECT
  ds AS ds,
  num_boys AS num_boys,
  revenue AS revenue,
  expenses AS expenses,
  revenue - expenses AS profit,
  COUNT(*) AS cnt
FROM my_schema.old_dataset
GROUP BY
  ds,
  num_boys,
  revenue,
  expenses,
  revenue - expenses
) AS dataset_1"""
    )

    assert (
        dataset_macro(1, include_metrics=True, columns=["ds"])
        == """(
SELECT
  ds AS ds,
  COUNT(*) AS cnt
FROM my_schema.old_dataset
GROUP BY
  ds
) AS dataset_1"""
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


def test_metric_macro_with_dataset_id(mocker: MockerFixture) -> None:
    """
    Test the ``metric_macro`` when passing a dataset ID.
    """
    mock_get_form_data = mocker.patch("superset.views.utils.get_form_data")
    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")
    DatasetDAO.find_by_id.return_value = SqlaTable(
        table_name="test_dataset",
        metrics=[
            SqlMetric(metric_name="count", expression="COUNT(*)"),
        ],
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
        schema="my_schema",
        sql=None,
    )
    assert metric_macro("count", 1) == "COUNT(*)"
    mock_get_form_data.assert_not_called()


def test_metric_macro_with_dataset_id_invalid_key(mocker: MockerFixture) -> None:
    """
    Test the ``metric_macro`` when passing a dataset ID and an invalid key.
    """
    mock_get_form_data = mocker.patch("superset.views.utils.get_form_data")
    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")
    DatasetDAO.find_by_id.return_value = SqlaTable(
        table_name="test_dataset",
        metrics=[
            SqlMetric(metric_name="count", expression="COUNT(*)"),
        ],
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
        schema="my_schema",
        sql=None,
    )
    with pytest.raises(SupersetTemplateException) as excinfo:
        metric_macro("blah", 1)
    assert str(excinfo.value) == "Metric ``blah`` not found in test_dataset."
    mock_get_form_data.assert_not_called()


def test_metric_macro_invalid_dataset_id(mocker: MockerFixture) -> None:
    """
    Test the ``metric_macro`` when specifying a dataset that doesn't exist.
    """
    mock_get_form_data = mocker.patch("superset.views.utils.get_form_data")
    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")
    DatasetDAO.find_by_id.return_value = None
    with pytest.raises(DatasetNotFoundError) as excinfo:
        metric_macro("macro_key", 100)
    assert str(excinfo.value) == "Dataset ID 100 not found."
    mock_get_form_data.assert_not_called()


def test_metric_macro_no_dataset_id_no_context(mocker: MockerFixture) -> None:
    """
    Test the ``metric_macro`` when not specifying a dataset ID and it's
    not available in the context.
    """
    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")
    mock_get_form_data = mocker.patch("superset.views.utils.get_form_data")
    mock_get_form_data.return_value = [None, None]
    with pytest.raises(SupersetTemplateException) as excinfo:
        metric_macro("macro_key")
    assert str(excinfo.value) == (
        "Please specify the Dataset ID for the ``macro_key`` metric in the Jinja macro."
    )
    mock_get_form_data.assert_called_once()
    DatasetDAO.find_by_id.assert_not_called()


def test_metric_macro_no_dataset_id_with_context_missing_info(
    mocker: MockerFixture,
) -> None:
    """
    Test the ``metric_macro`` when not specifying a dataset ID and request
    has context but no dataset/chart ID.
    """
    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")
    mock_get_form_data = mocker.patch("superset.views.utils.get_form_data")
    mock_get_form_data.return_value = [
        {
            "url_params": {},
        },
        None,
    ]
    with pytest.raises(SupersetTemplateException) as excinfo:
        metric_macro("macro_key")
    assert str(excinfo.value) == (
        "Please specify the Dataset ID for the ``macro_key`` metric in the Jinja macro."
    )
    mock_get_form_data.assert_called_once()
    DatasetDAO.find_by_id.assert_not_called()


def test_metric_macro_no_dataset_id_with_context_datasource_id(
    mocker: MockerFixture,
) -> None:
    """
    Test the ``metric_macro`` when not specifying a dataset ID and it's
    available in the context (url_params.datasource_id).
    """
    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")
    DatasetDAO.find_by_id.return_value = SqlaTable(
        table_name="test_dataset",
        metrics=[
            SqlMetric(metric_name="macro_key", expression="COUNT(*)"),
        ],
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
        schema="my_schema",
        sql=None,
    )
    mock_get_form_data = mocker.patch("superset.views.utils.get_form_data")
    mock_get_form_data.return_value = [
        {
            "url_params": {
                "datasource_id": 1,
            }
        },
        None,
    ]
    assert metric_macro("macro_key") == "COUNT(*)"
    mock_get_form_data.assert_called_once()
    DatasetDAO.find_by_id.assert_called_once_with(1)


def test_metric_macro_no_dataset_id_with_context_datasource_id_none(
    mocker: MockerFixture,
) -> None:
    """
    Test the ``metric_macro`` when not specifying a dataset ID and it's
    set to None in the context (url_params.datasource_id).
    """
    ChartDAO = mocker.patch("superset.daos.chart.ChartDAO")
    ChartDAO.find_by_id.return_value = None
    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")
    mock_get_form_data = mocker.patch("superset.views.utils.get_form_data")
    mock_get_form_data.return_value = [
        {
            "url_params": {
                "datasource_id": None,
            }
        },
        None,
    ]

    with pytest.raises(SupersetTemplateException) as excinfo:
        metric_macro("macro_key")
    assert str(excinfo.value) == (
        "Please specify the Dataset ID for the ``macro_key`` metric in the Jinja macro."
    )
    mock_get_form_data.assert_called_once()
    DatasetDAO.find_by_id.assert_not_called()


def test_metric_macro_no_dataset_id_with_context_chart_id(
    mocker: MockerFixture,
) -> None:
    """
    Test the ``metric_macro`` when not specifying a dataset ID and context
    includes an existing chart ID (url_params.slice_id).
    """
    ChartDAO = mocker.patch("superset.daos.chart.ChartDAO")
    ChartDAO.find_by_id.return_value = Slice(
        datasource_id=1,
    )
    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")
    DatasetDAO.find_by_id.return_value = SqlaTable(
        table_name="test_dataset",
        metrics=[
            SqlMetric(metric_name="macro_key", expression="COUNT(*)"),
        ],
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
        schema="my_schema",
        sql=None,
    )
    mock_get_form_data = mocker.patch("superset.views.utils.get_form_data")
    mock_get_form_data.return_value = [
        {
            "slice_id": 1,
        },
        None,
    ]
    assert metric_macro("macro_key") == "COUNT(*)"
    mock_get_form_data.assert_called_once()
    DatasetDAO.find_by_id.assert_called_once_with(1)


def test_metric_macro_no_dataset_id_with_context_slice_id_none(
    mocker: MockerFixture,
) -> None:
    """
    Test the ``metric_macro`` when not specifying a dataset ID and context
    includes slice_id set to None (url_params.slice_id).
    """
    ChartDAO = mocker.patch("superset.daos.chart.ChartDAO")
    ChartDAO.find_by_id.return_value = None
    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")
    mock_get_form_data = mocker.patch("superset.views.utils.get_form_data")
    mock_get_form_data.return_value = [
        {
            "slice_id": None,
        },
        None,
    ]

    with pytest.raises(SupersetTemplateException) as excinfo:
        metric_macro("macro_key")
    assert str(excinfo.value) == (
        "Please specify the Dataset ID for the ``macro_key`` metric in the Jinja macro."
    )
    mock_get_form_data.assert_called_once()
    DatasetDAO.find_by_id.assert_not_called()


def test_metric_macro_no_dataset_id_with_context_chart(mocker: MockerFixture) -> None:
    """
    Test the ``metric_macro`` when not specifying a dataset ID and context
    includes an existing chart (get_form_data()[1]).
    """
    ChartDAO = mocker.patch("superset.daos.chart.ChartDAO")
    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")
    DatasetDAO.find_by_id.return_value = SqlaTable(
        table_name="test_dataset",
        metrics=[
            SqlMetric(metric_name="macro_key", expression="COUNT(*)"),
        ],
        database=Database(database_name="my_database", sqlalchemy_uri="sqlite://"),
        schema="my_schema",
        sql=None,
    )
    mock_get_form_data = mocker.patch("superset.views.utils.get_form_data")
    mock_get_form_data.return_value = [
        {
            "slice_id": 1,
        },
        Slice(datasource_id=1),
    ]
    assert metric_macro("macro_key") == "COUNT(*)"
    mock_get_form_data.assert_called_once()
    DatasetDAO.find_by_id.assert_called_once_with(1)
    ChartDAO.find_by_id.assert_not_called()


def test_metric_macro_no_dataset_id_with_context_deleted_chart(
    mocker: MockerFixture,
) -> None:
    """
    Test the ``metric_macro`` when not specifying a dataset ID and context
    includes a deleted chart ID.
    """
    ChartDAO = mocker.patch("superset.daos.chart.ChartDAO")
    ChartDAO.find_by_id.return_value = None
    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")
    mock_get_form_data = mocker.patch("superset.views.utils.get_form_data")
    mock_get_form_data.return_value = [
        {
            "slice_id": 1,
        },
        None,
    ]

    with pytest.raises(SupersetTemplateException) as excinfo:
        metric_macro("macro_key")
    assert str(excinfo.value) == (
        "Please specify the Dataset ID for the ``macro_key`` metric in the Jinja macro."
    )
    mock_get_form_data.assert_called_once()
    DatasetDAO.find_by_id.assert_not_called()


def test_metric_macro_no_dataset_id_with_context_chart_no_datasource_id(
    mocker: MockerFixture,
) -> None:
    """
    Test the ``metric_macro`` when not specifying a dataset ID and context
    includes an existing chart (get_form_data()[1]) with no dataset ID.
    """
    ChartDAO = mocker.patch("superset.daos.chart.ChartDAO")
    ChartDAO.find_by_id.return_value = None
    DatasetDAO = mocker.patch("superset.daos.dataset.DatasetDAO")
    mock_get_form_data = mocker.patch("superset.views.utils.get_form_data")
    mock_get_form_data.return_value = [
        {},
        Slice(
            datasource_id=None,
        ),
    ]

    with pytest.raises(SupersetTemplateException) as excinfo:
        metric_macro("macro_key")
    assert str(excinfo.value) == (
        "Please specify the Dataset ID for the ``macro_key`` metric in the Jinja macro."
    )
    mock_get_form_data.assert_called_once()
    DatasetDAO.find_by_id.assert_not_called()
