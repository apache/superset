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
from typing import Any

import pytest
from sqlalchemy.dialects.postgresql import dialect

from superset import app
from superset.exceptions import SupersetTemplateException
from superset.jinja_context import ExtraCache, safe_proxy


def test_filter_values_default() -> None:
    cache = ExtraCache()
    assert cache.filter_values("name", "foo") == ["foo"]
    assert cache.removed_filters == []


def test_filter_values_remove_not_present() -> None:
    cache = ExtraCache()
    assert cache.filter_values("name", remove_filter=True) == []
    assert cache.removed_filters == []


def test_get_filters_remove_not_present() -> None:
    cache = ExtraCache()
    assert cache.get_filters("name", remove_filter=True) == []
    assert cache.removed_filters == []


def test_filter_values_no_default() -> None:
    cache = ExtraCache()
    assert cache.filter_values("name") == []


def test_filter_values_adhoc_filters() -> None:
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


def test_get_filters_adhoc_filters() -> None:
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


def test_filter_values_extra_filters() -> None:
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


def test_url_param_default() -> None:
    with app.test_request_context():
        cache = ExtraCache()
        assert cache.url_param("foo", "bar") == "bar"


def test_url_param_no_default() -> None:
    with app.test_request_context():
        cache = ExtraCache()
        assert cache.url_param("foo") is None


def test_url_param_query() -> None:
    with app.test_request_context(query_string={"foo": "bar"}):
        cache = ExtraCache()
        assert cache.url_param("foo") == "bar"


def test_url_param_form_data() -> None:
    with app.test_request_context(
        query_string={"form_data": json.dumps({"url_params": {"foo": "bar"}})}
    ):
        cache = ExtraCache()
        assert cache.url_param("foo") == "bar"


def test_url_param_escaped_form_data() -> None:
    with app.test_request_context(
        query_string={"form_data": json.dumps({"url_params": {"foo": "O'Brien"}})}
    ):
        cache = ExtraCache(dialect=dialect())
        assert cache.url_param("foo") == "O''Brien"


def test_url_param_escaped_default_form_data() -> None:
    with app.test_request_context(
        query_string={"form_data": json.dumps({"url_params": {"foo": "O'Brien"}})}
    ):
        cache = ExtraCache(dialect=dialect())
        assert cache.url_param("bar", "O'Malley") == "O''Malley"


def test_url_param_unescaped_form_data() -> None:
    with app.test_request_context(
        query_string={"form_data": json.dumps({"url_params": {"foo": "O'Brien"}})}
    ):
        cache = ExtraCache(dialect=dialect())
        assert cache.url_param("foo", escape_result=False) == "O'Brien"


def test_url_param_unescaped_default_form_data() -> None:
    with app.test_request_context(
        query_string={"form_data": json.dumps({"url_params": {"foo": "O'Brien"}})}
    ):
        cache = ExtraCache(dialect=dialect())
        assert cache.url_param("bar", "O'Malley", escape_result=False) == "O'Malley"


def test_safe_proxy_primitive() -> None:
    def func(input_: Any) -> Any:
        return input_

    assert safe_proxy(func, "foo") == "foo"


def test_safe_proxy_dict() -> None:
    def func(input_: Any) -> Any:
        return input_

    assert safe_proxy(func, {"foo": "bar"}) == {"foo": "bar"}


def test_safe_proxy_lambda() -> None:
    def func(input_: Any) -> Any:
        return input_

    with pytest.raises(SupersetTemplateException):
        safe_proxy(func, lambda: "bar")


def test_safe_proxy_nested_lambda() -> None:
    def func(input_: Any) -> Any:
        return input_

    with pytest.raises(SupersetTemplateException):
        safe_proxy(func, {"foo": lambda: "bar"})
