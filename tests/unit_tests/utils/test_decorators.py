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


import uuid
from contextlib import nullcontext
from inspect import isclass
from typing import Any, Optional
from unittest.mock import call, Mock, patch

import pytest

from superset import app
from superset.utils import decorators
from superset.utils.backports import StrEnum


class ResponseValues(StrEnum):
    FAIL = "fail"
    WARN = "warn"
    OK = "ok"


def test_debounce() -> None:
    mock = Mock()

    @decorators.debounce()
    def myfunc(arg1: int, arg2: int, kwarg1: str = "abc", kwarg2: int = 2) -> int:
        mock(arg1, kwarg1)
        return arg1 + arg2 + kwarg2

    # should be called only once when arguments don't change
    myfunc(1, 1)
    myfunc(1, 1)
    result = myfunc(1, 1)
    mock.assert_called_once_with(1, "abc")
    assert result == 4

    # kwarg order shouldn't matter
    myfunc(1, 0, kwarg2=2, kwarg1="haha")
    result = myfunc(1, 0, kwarg1="haha", kwarg2=2)
    mock.assert_has_calls([call(1, "abc"), call(1, "haha")])
    assert result == 3


@pytest.mark.parametrize(
    "response_value, expected_exception, expected_result",
    [
        (ResponseValues.OK, None, "custom.prefix.ok"),
        (ResponseValues.FAIL, ValueError, "custom.prefix.error"),
        (ResponseValues.WARN, FileNotFoundError, "custom.prefix.warn"),
    ],
)
def test_statsd_gauge(
    response_value: str, expected_exception: Optional[Exception], expected_result: str
) -> None:
    @decorators.statsd_gauge("custom.prefix")
    def my_func(response: ResponseValues, *args: Any, **kwargs: Any) -> str:
        if response == ResponseValues.FAIL:
            raise ValueError("Error")
        if response == ResponseValues.WARN:
            raise FileNotFoundError("Not found")
        return "OK"

    with patch.object(app.config["STATS_LOGGER"], "gauge") as mock:
        cm = (
            pytest.raises(expected_exception)
            if isclass(expected_exception) and issubclass(expected_exception, Exception)
            else nullcontext()
        )

        with cm:
            my_func(response_value, 1, 2)
            mock.assert_called_once_with(expected_result, 1)


@patch("superset.utils.decorators.g")
def test_context_decorator(flask_g_mock) -> None:
    flask_g_mock.logs_context = {}

    @decorators.logs_context()
    def myfunc(*args, **kwargs) -> str:
        return "test"

    # should be able to add values to the decorator function directly
    @decorators.logs_context(slice_id=1, dashboard_id=1, execution_id=uuid.uuid4())
    def myfunc_with_kwargs(*args, **kwargs) -> str:
        return "test"

    @decorators.logs_context(bad_context=1)
    def myfunc_with_dissallowed_kwargs(*args, **kwargs) -> str:
        return "test"

    @decorators.logs_context(
        context_func=lambda *args, **kwargs: {"slice_id": kwargs["chart_id"]}
    )
    def myfunc_with_context(*args, **kwargs) -> str:
        return "test"

    # should not add any data to the global.logs_context scope
    myfunc(1, 1)
    assert flask_g_mock.logs_context == {}

    # should add dashboard_id to the global.logs_context scope
    myfunc(1, 1, dashboard_id=1)
    assert flask_g_mock.logs_context == {"dashboard_id": 1}
    # reset logs_context
    flask_g_mock.logs_context = {}

    # should add slice_id to the global.logs_context scope
    myfunc(1, 1, slice_id=1)
    assert flask_g_mock.logs_context == {"slice_id": 1}
    # reset logs_context
    flask_g_mock.logs_context = {}

    # should add execution_id to the global.logs_context scope
    myfunc(1, 1, execution_id=1)
    assert flask_g_mock.logs_context == {"execution_id": 1}
    # reset logs_context
    flask_g_mock.logs_context = {}

    # should add all three to the global.logs_context scope
    myfunc(1, 1, dashboard_id=1, slice_id=1, execution_id=1)
    assert flask_g_mock.logs_context == {
        "dashboard_id": 1,
        "slice_id": 1,
        "execution_id": 1,
    }
    # reset logs_context
    flask_g_mock.logs_context = {}

    # should overwrite existing values in the global.logs_context scope
    flask_g_mock.logs_context = {"dashboard_id": 2, "slice_id": 2, "execution_id": 2}
    myfunc(1, 1, dashboard_id=3, slice_id=3, execution_id=3)
    assert flask_g_mock.logs_context == {
        "dashboard_id": 3,
        "slice_id": 3,
        "execution_id": 3,
    }
    # reset logs_context
    flask_g_mock.logs_context = {}

    # should not add a value that does not exist in the global.logs_context scope
    myfunc_with_dissallowed_kwargs()
    assert flask_g_mock.logs_context == {}
    # reset logs_context
    flask_g_mock.logs_context = {}

    # should be able to add values to the decorator function directly
    myfunc_with_kwargs()
    assert flask_g_mock.logs_context["dashboard_id"] == 1
    assert flask_g_mock.logs_context["slice_id"] == 1
    assert isinstance(flask_g_mock.logs_context["execution_id"], uuid.UUID)
    # reset logs_context
    flask_g_mock.logs_context = {}

    # should be able to add values to the decorator function directly
    # and it will overwrite any kwargs passed into the decorated function
    myfunc_with_kwargs(execution_id=4)

    assert flask_g_mock.logs_context["dashboard_id"] == 1
    assert flask_g_mock.logs_context["slice_id"] == 1
    assert isinstance(flask_g_mock.logs_context["execution_id"], uuid.UUID)
    # reset logs_context
    flask_g_mock.logs_context = {}

    # should be able to pass a callable context to the decorator
    myfunc_with_context(chart_id=1)
    assert flask_g_mock.logs_context == {"slice_id": 1}
    # reset logs_context
    flask_g_mock.logs_context = {}
