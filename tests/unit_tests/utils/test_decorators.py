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


import logging
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
    @decorators.logs_context()
    def myfunc(*args, **kwargs) -> str:
        return "test"

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

    ### should not add any data to the global.logs_context scope
    flask_g_mock.logs_context = {}
    myfunc(1, 1)
    assert flask_g_mock.logs_context == {}

    ### should add dashboard_id to the global.logs_context scope
    flask_g_mock.logs_context = {}
    myfunc(1, 1, dashboard_id=1)
    assert flask_g_mock.logs_context == {"dashboard_id": 1}

    ### should add slice_id to the global.logs_context scope
    flask_g_mock.logs_context = {}
    myfunc(1, 1, slice_id=1)
    assert flask_g_mock.logs_context == {"slice_id": 1}

    ### should add execution_id to the global.logs_context scope
    flask_g_mock.logs_context = {}
    myfunc(1, 1, execution_id=1)
    assert flask_g_mock.logs_context == {"execution_id": 1}

    ### should add all three to the global.logs_context scope
    flask_g_mock.logs_context = {}
    myfunc(1, 1, dashboard_id=1, slice_id=1, execution_id=1)
    assert flask_g_mock.logs_context == {
        "dashboard_id": 1,
        "slice_id": 1,
        "execution_id": 1,
    }

    ### should overwrite existing values in the global.logs_context scope
    flask_g_mock.logs_context = {"dashboard_id": 2, "slice_id": 2, "execution_id": 2}
    myfunc(1, 1, dashboard_id=3, slice_id=3, execution_id=3)
    assert flask_g_mock.logs_context == {
        "dashboard_id": 3,
        "slice_id": 3,
        "execution_id": 3,
    }

    ### Test when g.logs_context already exists
    flask_g_mock.logs_context = {"slice_id": 2, "dashboard_id": 2}
    args = (3, 4)
    kwargs = {"slice_id": 3, "dashboard_id": 3}
    myfunc(*args, **kwargs)
    assert flask_g_mock.logs_context == {"slice_id": 3, "dashboard_id": 3}

    ### Test when kwargs contain additional keys
    flask_g_mock.logs_context = {}
    args = (1, 2)
    kwargs = {
        "slice_id": 1,
        "dashboard_id": 1,
        "dataset_id": 1,
        "execution_id": 1,
        "report_schedule_id": 1,
        "extra_key": 1,
    }
    myfunc(*args, **kwargs)
    assert flask_g_mock.logs_context == {
        "slice_id": 1,
        "dashboard_id": 1,
        "dataset_id": 1,
        "execution_id": 1,
        "report_schedule_id": 1,
    }

    ### should not add a value that does not exist in the global.logs_context scope
    flask_g_mock.logs_context = {}
    myfunc_with_dissallowed_kwargs()
    assert flask_g_mock.logs_context == {}

    ### should be able to add values to the decorator function directly
    flask_g_mock.logs_context = {}
    myfunc_with_kwargs()
    assert flask_g_mock.logs_context["dashboard_id"] == 1
    assert flask_g_mock.logs_context["slice_id"] == 1
    assert isinstance(flask_g_mock.logs_context["execution_id"], uuid.UUID)

    ### should be able to add values to the decorator function directly
    # and it will overwrite any kwargs passed into the decorated function
    flask_g_mock.logs_context = {}
    myfunc_with_kwargs(execution_id=4)

    assert flask_g_mock.logs_context["dashboard_id"] == 1
    assert flask_g_mock.logs_context["slice_id"] == 1
    assert isinstance(flask_g_mock.logs_context["execution_id"], uuid.UUID)

    ### should be able to pass a callable context to the decorator
    flask_g_mock.logs_context = {}
    myfunc_with_context(chart_id=1)
    assert flask_g_mock.logs_context == {"slice_id": 1}

    ### Test when context_func returns additional keys
    # it should use the context_func values
    flask_g_mock.logs_context = {}
    args = (1, 2)
    kwargs = {"slice_id": 1, "dashboard_id": 1}

    @decorators.logs_context(
        context_func=lambda *args, **kwargs: {
            "slice_id": 2,
            "dashboard_id": 2,
            "dataset_id": 2,
            "execution_id": 2,
            "report_schedule_id": 2,
            "extra_key": 2,
        }
    )
    def myfunc_with_extra_keys_context(*args, **kwargs) -> str:
        return "test"

    myfunc_with_extra_keys_context(
        *args,
        **kwargs,
    )
    assert flask_g_mock.logs_context == {
        "slice_id": 2,
        "dashboard_id": 2,
        "dataset_id": 2,
        "execution_id": 2,
        "report_schedule_id": 2,
    }

    ### Test when context_func does not return a dictionary
    flask_g_mock.logs_context = {}

    @decorators.logs_context(context_func=lambda: "foo")  # type: ignore
    def myfunc_with_bad_return_value() -> str:
        return "test"

    myfunc_with_bad_return_value()
    assert flask_g_mock.logs_context == {}

    ### Test when context_func is not callable
    flask_g_mock.logs_context = {}

    @decorators.logs_context(context_func="foo")  # type: ignore
    def context_func_not_callable() -> str:
        return "test"

    context_func_not_callable()
    assert flask_g_mock.logs_context == {}


class ListHandler(logging.Handler):
    """
    Simple logging handler that stores records in a list.
    """

    def __init__(self, *args: Any, **kwargs: Any):
        super().__init__(*args, **kwargs)
        self.log_records: list[logging.LogRecord] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.log_records.append(record)

    def reset(self) -> None:
        self.log_records = []


def test_suppress_logging() -> None:
    """
    Test the `suppress_logging` decorator.
    """
    handler = ListHandler()
    logger = logging.getLogger("test-logger")
    logger.setLevel(logging.INFO)
    logger.addHandler(handler)

    def func() -> None:
        logger.error("error")
        logger.critical("critical")

    func()
    assert len(handler.log_records) == 2

    handler.log_records = []
    decorated = decorators.suppress_logging("test-logger")(func)
    decorated()
    assert len(handler.log_records) == 1
    assert handler.log_records[0].levelname == "CRITICAL"

    handler.log_records = []
    decorated = decorators.suppress_logging("test-logger", logging.CRITICAL + 1)(func)
    decorated()
    assert len(handler.log_records) == 0
