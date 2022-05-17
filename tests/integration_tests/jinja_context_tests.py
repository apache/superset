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
import json
from datetime import datetime
from typing import Any
from unittest import mock

import pytest
from sqlalchemy.dialects.postgresql import dialect

import superset.utils.database
import tests.integration_tests.test_app
from superset import app
from superset.exceptions import SupersetTemplateException
from superset.jinja_context import ExtraCache, get_template_processor, safe_proxy
from superset.utils import core as utils
from tests.integration_tests.base_tests import SupersetTestCase


class TestJinja2Context(SupersetTestCase):
    def test_filter_values_default(self) -> None:
        with app.test_request_context():
            cache = ExtraCache()
            self.assertEqual(cache.filter_values("name", "foo"), ["foo"])
            self.assertEqual(cache.removed_filters, list())

    def test_filter_values_remove_not_present(self) -> None:
        with app.test_request_context():
            cache = ExtraCache()
            self.assertEqual(cache.filter_values("name", remove_filter=True), [])
            self.assertEqual(cache.removed_filters, list())

    def test_get_filters_remove_not_present(self) -> None:
        with app.test_request_context():
            cache = ExtraCache()
            self.assertEqual(cache.get_filters("name", remove_filter=True), [])
            self.assertEqual(cache.removed_filters, list())

    def test_filter_values_no_default(self) -> None:
        with app.test_request_context():
            cache = ExtraCache()
            self.assertEqual(cache.filter_values("name"), [])

    def test_filter_values_adhoc_filters(self) -> None:
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
            self.assertEqual(cache.filter_values("name"), ["foo"])
            self.assertEqual(cache.applied_filters, ["name"])

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
            self.assertEqual(cache.filter_values("name"), ["foo", "bar"])
            self.assertEqual(cache.applied_filters, ["name"])

    def test_get_filters_adhoc_filters(self) -> None:
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
            self.assertEqual(
                cache.get_filters("name"), [{"op": "IN", "col": "name", "val": ["foo"]}]
            )
            self.assertEqual(cache.removed_filters, list())
            self.assertEqual(cache.applied_filters, ["name"])

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
            self.assertEqual(
                cache.get_filters("name"),
                [{"op": "IN", "col": "name", "val": ["foo", "bar"]}],
            )
            self.assertEqual(cache.removed_filters, list())

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
            self.assertEqual(
                cache.get_filters("name", remove_filter=True),
                [{"op": "IN", "col": "name", "val": ["foo", "bar"]}],
            )
            self.assertEqual(cache.removed_filters, ["name"])
            self.assertEqual(cache.applied_filters, ["name"])

    def test_filter_values_extra_filters(self) -> None:
        with app.test_request_context(
            data={
                "form_data": json.dumps(
                    {"extra_filters": [{"col": "name", "op": "in", "val": "foo"}]}
                )
            }
        ):
            cache = ExtraCache()
            self.assertEqual(cache.filter_values("name"), ["foo"])
            self.assertEqual(cache.applied_filters, ["name"])

    def test_url_param_default(self) -> None:
        with app.test_request_context():
            cache = ExtraCache()
            self.assertEqual(cache.url_param("foo", "bar"), "bar")

    def test_url_param_no_default(self) -> None:
        with app.test_request_context():
            cache = ExtraCache()
            self.assertEqual(cache.url_param("foo"), None)

    def test_url_param_query(self) -> None:
        with app.test_request_context(query_string={"foo": "bar"}):
            cache = ExtraCache()
            self.assertEqual(cache.url_param("foo"), "bar")

    def test_url_param_form_data(self) -> None:
        with app.test_request_context(
            query_string={"form_data": json.dumps({"url_params": {"foo": "bar"}})}
        ):
            cache = ExtraCache()
            self.assertEqual(cache.url_param("foo"), "bar")

    def test_url_param_escaped_form_data(self) -> None:
        with app.test_request_context(
            query_string={"form_data": json.dumps({"url_params": {"foo": "O'Brien"}})}
        ):
            cache = ExtraCache(dialect=dialect())
            self.assertEqual(cache.url_param("foo"), "O''Brien")

    def test_url_param_escaped_default_form_data(self) -> None:
        with app.test_request_context(
            query_string={"form_data": json.dumps({"url_params": {"foo": "O'Brien"}})}
        ):
            cache = ExtraCache(dialect=dialect())
            self.assertEqual(cache.url_param("bar", "O'Malley"), "O''Malley")

    def test_url_param_unescaped_form_data(self) -> None:
        with app.test_request_context(
            query_string={"form_data": json.dumps({"url_params": {"foo": "O'Brien"}})}
        ):
            cache = ExtraCache(dialect=dialect())
            self.assertEqual(cache.url_param("foo", escape_result=False), "O'Brien")

    def test_url_param_unescaped_default_form_data(self) -> None:
        with app.test_request_context(
            query_string={"form_data": json.dumps({"url_params": {"foo": "O'Brien"}})}
        ):
            cache = ExtraCache(dialect=dialect())
            self.assertEqual(
                cache.url_param("bar", "O'Malley", escape_result=False), "O'Malley"
            )

    def test_safe_proxy_primitive(self) -> None:
        def func(input: Any) -> Any:
            return input

        return_value = safe_proxy(func, "foo")
        self.assertEqual("foo", return_value)

    def test_safe_proxy_dict(self) -> None:
        def func(input: Any) -> Any:
            return input

        return_value = safe_proxy(func, {"foo": "bar"})
        self.assertEqual({"foo": "bar"}, return_value)

    def test_safe_proxy_lambda(self) -> None:
        def func(input: Any) -> Any:
            return input

        with pytest.raises(SupersetTemplateException):
            safe_proxy(func, lambda: "bar")

    def test_safe_proxy_nested_lambda(self) -> None:
        def func(input: Any) -> Any:
            return input

        with pytest.raises(SupersetTemplateException):
            safe_proxy(func, {"foo": lambda: "bar"})

    def test_process_template(self) -> None:
        maindb = superset.utils.database.get_example_database()
        sql = "SELECT '{{ 1+1 }}'"
        tp = get_template_processor(database=maindb)
        rendered = tp.process_template(sql)
        self.assertEqual("SELECT '2'", rendered)

    def test_get_template_kwarg(self) -> None:
        maindb = superset.utils.database.get_example_database()
        s = "{{ foo }}"
        tp = get_template_processor(database=maindb, foo="bar")
        rendered = tp.process_template(s)
        self.assertEqual("bar", rendered)

    def test_template_kwarg(self) -> None:
        maindb = superset.utils.database.get_example_database()
        s = "{{ foo }}"
        tp = get_template_processor(database=maindb)
        rendered = tp.process_template(s, foo="bar")
        self.assertEqual("bar", rendered)

    def test_get_template_kwarg_dict(self) -> None:
        maindb = superset.utils.database.get_example_database()
        s = "{{ foo.bar }}"
        tp = get_template_processor(database=maindb, foo={"bar": "baz"})
        rendered = tp.process_template(s)
        self.assertEqual("baz", rendered)

    def test_template_kwarg_dict(self) -> None:
        maindb = superset.utils.database.get_example_database()
        s = "{{ foo.bar }}"
        tp = get_template_processor(database=maindb)
        rendered = tp.process_template(s, foo={"bar": "baz"})
        self.assertEqual("baz", rendered)

    def test_get_template_kwarg_lambda(self) -> None:
        maindb = superset.utils.database.get_example_database()
        s = "{{ foo() }}"
        tp = get_template_processor(database=maindb, foo=lambda: "bar")
        with pytest.raises(SupersetTemplateException):
            tp.process_template(s)

    def test_template_kwarg_lambda(self) -> None:
        maindb = superset.utils.database.get_example_database()
        s = "{{ foo() }}"
        tp = get_template_processor(database=maindb)
        with pytest.raises(SupersetTemplateException):
            tp.process_template(s, foo=lambda: "bar")

    def test_get_template_kwarg_module(self) -> None:
        maindb = superset.utils.database.get_example_database()
        s = "{{ dt(2017, 1, 1).isoformat() }}"
        tp = get_template_processor(database=maindb, dt=datetime)
        with pytest.raises(SupersetTemplateException):
            tp.process_template(s)

    def test_template_kwarg_module(self) -> None:
        maindb = superset.utils.database.get_example_database()
        s = "{{ dt(2017, 1, 1).isoformat() }}"
        tp = get_template_processor(database=maindb)
        with pytest.raises(SupersetTemplateException):
            tp.process_template(s, dt=datetime)

    def test_get_template_kwarg_nested_module(self) -> None:
        maindb = superset.utils.database.get_example_database()
        s = "{{ foo.dt }}"
        tp = get_template_processor(database=maindb, foo={"dt": datetime})
        with pytest.raises(SupersetTemplateException):
            tp.process_template(s)

    def test_template_kwarg_nested_module(self) -> None:
        maindb = superset.utils.database.get_example_database()
        s = "{{ foo.dt }}"
        tp = get_template_processor(database=maindb)
        with pytest.raises(SupersetTemplateException):
            tp.process_template(s, foo={"bar": datetime})

    @mock.patch("superset.jinja_context.HiveTemplateProcessor.latest_partition")
    def test_template_hive(self, lp_mock) -> None:
        lp_mock.return_value = "the_latest"
        db = mock.Mock()
        db.backend = "hive"
        s = "{{ hive.latest_partition('my_table') }}"
        tp = get_template_processor(database=db)
        rendered = tp.process_template(s)
        self.assertEqual("the_latest", rendered)

    @mock.patch("superset.jinja_context.context_addons")
    def test_template_context_addons(self, addons_mock) -> None:
        addons_mock.return_value = {"datetime": datetime}
        maindb = superset.utils.database.get_example_database()
        s = "SELECT '{{ datetime(2017, 1, 1).isoformat() }}'"
        tp = get_template_processor(database=maindb)
        rendered = tp.process_template(s)
        self.assertEqual("SELECT '2017-01-01T00:00:00'", rendered)

    @mock.patch(
        "tests.integration_tests.superset_test_custom_template_processors.datetime"
    )
    def test_custom_process_template(self, mock_dt) -> None:
        """Test macro defined in custom template processor works."""
        mock_dt.utcnow = mock.Mock(return_value=datetime(1970, 1, 1))
        db = mock.Mock()
        db.backend = "db_for_macros_testing"
        tp = get_template_processor(database=db)

        sql = "SELECT '$DATE()'"
        rendered = tp.process_template(sql)
        self.assertEqual("SELECT '{}'".format("1970-01-01"), rendered)

        sql = "SELECT '$DATE(1, 2)'"
        rendered = tp.process_template(sql)
        self.assertEqual("SELECT '{}'".format("1970-01-02"), rendered)

    def test_custom_get_template_kwarg(self) -> None:
        """Test macro passed as kwargs when getting template processor
        works in custom template processor."""
        db = mock.Mock()
        db.backend = "db_for_macros_testing"
        s = "$foo()"
        tp = get_template_processor(database=db, foo=lambda: "bar")
        rendered = tp.process_template(s)
        self.assertEqual("bar", rendered)

    def test_custom_template_kwarg(self) -> None:
        """Test macro passed as kwargs when processing template
        works in custom template processor."""
        db = mock.Mock()
        db.backend = "db_for_macros_testing"
        s = "$foo()"
        tp = get_template_processor(database=db)
        rendered = tp.process_template(s, foo=lambda: "bar")
        self.assertEqual("bar", rendered)

    def test_custom_template_processors_overwrite(self) -> None:
        """Test template processor for presto gets overwritten by custom one."""
        db = mock.Mock()
        db.backend = "db_for_macros_testing"
        tp = get_template_processor(database=db)

        sql = "SELECT '{{ datetime(2017, 1, 1).isoformat() }}'"
        rendered = tp.process_template(sql)
        self.assertEqual(sql, rendered)

        sql = "SELECT '{{ DATE(1, 2) }}'"
        rendered = tp.process_template(sql)
        self.assertEqual(sql, rendered)

    def test_custom_template_processors_ignored(self) -> None:
        """Test custom template processor is ignored for a difference backend
        database."""
        maindb = superset.utils.database.get_example_database()
        sql = "SELECT '$DATE()'"
        tp = get_template_processor(database=maindb)
        rendered = tp.process_template(sql)
        assert sql == rendered
