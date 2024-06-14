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
from unittest import mock

import pytest
from flask.ctx import AppContext
from pytest_mock import MockerFixture

import superset.utils.database
from superset.exceptions import SupersetTemplateException
from superset.jinja_context import get_template_processor


def test_process_template(app_context: AppContext) -> None:
    maindb = superset.utils.database.get_example_database()
    template = "SELECT '{{ 1+1 }}'"
    tp = get_template_processor(database=maindb)
    assert tp.process_template(template) == "SELECT '2'"


def test_get_template_kwarg(app_context: AppContext) -> None:
    maindb = superset.utils.database.get_example_database()
    template = "{{ foo }}"
    tp = get_template_processor(database=maindb, foo="bar")
    assert tp.process_template(template) == "bar"


def test_template_kwarg(app_context: AppContext) -> None:
    maindb = superset.utils.database.get_example_database()
    template = "{{ foo }}"
    tp = get_template_processor(database=maindb)
    assert tp.process_template(template, foo="bar") == "bar"


def test_get_template_kwarg_dict(app_context: AppContext) -> None:
    maindb = superset.utils.database.get_example_database()
    template = "{{ foo.bar }}"
    tp = get_template_processor(database=maindb, foo={"bar": "baz"})
    assert tp.process_template(template) == "baz"


def test_template_kwarg_dict(app_context: AppContext) -> None:
    maindb = superset.utils.database.get_example_database()
    template = "{{ foo.bar }}"
    tp = get_template_processor(database=maindb)
    assert tp.process_template(template, foo={"bar": "baz"}) == "baz"


def test_get_template_kwarg_lambda(app_context: AppContext) -> None:
    maindb = superset.utils.database.get_example_database()
    template = "{{ foo() }}"
    tp = get_template_processor(database=maindb, foo=lambda: "bar")
    with pytest.raises(SupersetTemplateException):
        tp.process_template(template)


def test_template_kwarg_lambda(app_context: AppContext) -> None:
    maindb = superset.utils.database.get_example_database()
    template = "{{ foo() }}"
    tp = get_template_processor(database=maindb)
    with pytest.raises(SupersetTemplateException):
        tp.process_template(template, foo=lambda: "bar")


def test_get_template_kwarg_module(app_context: AppContext) -> None:
    maindb = superset.utils.database.get_example_database()
    template = "{{ dt(2017, 1, 1).isoformat() }}"
    tp = get_template_processor(database=maindb, dt=datetime)
    with pytest.raises(SupersetTemplateException):
        tp.process_template(template)


def test_template_kwarg_module(app_context: AppContext) -> None:
    maindb = superset.utils.database.get_example_database()
    template = "{{ dt(2017, 1, 1).isoformat() }}"
    tp = get_template_processor(database=maindb)
    with pytest.raises(SupersetTemplateException):
        tp.process_template(template, dt=datetime)


def test_get_template_kwarg_nested_module(app_context: AppContext) -> None:
    maindb = superset.utils.database.get_example_database()
    template = "{{ foo.dt }}"
    tp = get_template_processor(database=maindb, foo={"dt": datetime})
    with pytest.raises(SupersetTemplateException):
        tp.process_template(template)


def test_template_kwarg_nested_module(app_context: AppContext) -> None:
    maindb = superset.utils.database.get_example_database()
    template = "{{ foo.dt }}"
    tp = get_template_processor(database=maindb)
    with pytest.raises(SupersetTemplateException):
        tp.process_template(template, foo={"bar": datetime})


def test_template_hive(app_context: AppContext, mocker: MockerFixture) -> None:
    lp_mock = mocker.patch(
        "superset.jinja_context.HiveTemplateProcessor.latest_partition"
    )
    lp_mock.return_value = "the_latest"
    database = mock.Mock()
    database.backend = "hive"
    template = "{{ hive.latest_partition('my_table') }}"
    tp = get_template_processor(database=database)
    assert tp.process_template(template) == "the_latest"


def test_template_spark(app_context: AppContext, mocker: MockerFixture) -> None:
    lp_mock = mocker.patch(
        "superset.jinja_context.SparkTemplateProcessor.latest_partition"
    )
    lp_mock.return_value = "the_latest"
    database = mock.Mock()
    database.backend = "spark"
    template = "{{ spark.latest_partition('my_table') }}"
    tp = get_template_processor(database=database)
    assert tp.process_template(template) == "the_latest"

    # Backwards compatibility if migrating from Hive.
    template = "{{ hive.latest_partition('my_table') }}"
    tp = get_template_processor(database=database)
    assert tp.process_template(template) == "the_latest"


def test_template_trino(app_context: AppContext, mocker: MockerFixture) -> None:
    lp_mock = mocker.patch(
        "superset.jinja_context.TrinoTemplateProcessor.latest_partition"
    )
    lp_mock.return_value = "the_latest"
    database = mock.Mock()
    database.backend = "trino"
    template = "{{ trino.latest_partition('my_table') }}"
    tp = get_template_processor(database=database)
    assert tp.process_template(template) == "the_latest"

    # Backwards compatibility if migrating from Presto.
    template = "{{ presto.latest_partition('my_table') }}"
    tp = get_template_processor(database=database)
    assert tp.process_template(template) == "the_latest"


def test_template_context_addons(
    app_context: AppContext, mocker: MockerFixture
) -> None:
    addons_mock = mocker.patch("superset.jinja_context.context_addons")
    addons_mock.return_value = {"datetime": datetime}
    maindb = superset.utils.database.get_example_database()
    template = "SELECT '{{ datetime(2017, 1, 1).isoformat() }}'"
    tp = get_template_processor(database=maindb)
    assert tp.process_template(template) == "SELECT '2017-01-01T00:00:00'"


def test_custom_process_template(
    app_context: AppContext, mocker: MockerFixture
) -> None:
    """Test macro defined in custom template processor works."""

    mock_dt = mocker.patch(
        "tests.integration_tests.superset_test_custom_template_processors.datetime"
    )
    mock_dt.utcnow = mock.Mock(return_value=datetime(1970, 1, 1))
    database = mock.Mock()
    database.backend = "db_for_macros_testing"
    tp = get_template_processor(database=database)

    template = "SELECT '$DATE()'"
    assert tp.process_template(template) == f"SELECT '1970-01-01'"  # noqa: F541

    template = "SELECT '$DATE(1, 2)'"
    assert tp.process_template(template) == "SELECT '1970-01-02'"


def test_custom_get_template_kwarg(app_context: AppContext) -> None:
    """Test macro passed as kwargs when getting template processor
    works in custom template processor."""
    database = mock.Mock()
    database.backend = "db_for_macros_testing"
    template = "$foo()"
    tp = get_template_processor(database=database, foo=lambda: "bar")
    assert tp.process_template(template) == "bar"


def test_custom_template_kwarg(app_context: AppContext) -> None:
    """Test macro passed as kwargs when processing template
    works in custom template processor."""
    database = mock.Mock()
    database.backend = "db_for_macros_testing"
    template = "$foo()"
    tp = get_template_processor(database=database)
    assert tp.process_template(template, foo=lambda: "bar") == "bar"


def test_custom_template_processors_overwrite(app_context: AppContext) -> None:
    """Test template processor for presto gets overwritten by custom one."""
    database = mock.Mock()
    database.backend = "db_for_macros_testing"
    tp = get_template_processor(database=database)

    template = "SELECT '{{ datetime(2017, 1, 1).isoformat() }}'"
    assert tp.process_template(template) == template

    template = "SELECT '{{ DATE(1, 2) }}'"
    assert tp.process_template(template) == template


def test_custom_template_processors_ignored(app_context: AppContext) -> None:
    """Test custom template processor is ignored for a difference backend
    database."""
    maindb = superset.utils.database.get_example_database()
    template = "SELECT '$DATE()'"
    tp = get_template_processor(database=maindb)
    assert tp.process_template(template) == template
