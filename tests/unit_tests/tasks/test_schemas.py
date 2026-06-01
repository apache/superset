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
from types import SimpleNamespace

from flask import current_app
from pytest_mock import MockerFixture

from superset.tasks.schemas import TaskResponseSchema


def _task_with_error_properties() -> SimpleNamespace:
    return SimpleNamespace(
        properties_dict={
            "is_abortable": True,
            "progress_percent": 1.0,
            "error_message": "boom",
            "exception_type": "KeyError",
            "stack_trace": 'Traceback (most recent call last):\n  File "/app/x.py"',
        }
    )


def test_get_properties_hides_debug_fields_by_default(app_context: None) -> None:
    """
    By default (SHOW_STACKTRACE disabled) the serialized task properties must
    not disclose the stack trace or the raw exception class name (CWE-209),
    while still returning consumer-safe fields like error_message.
    """
    properties = TaskResponseSchema().get_properties(_task_with_error_properties())

    assert "stack_trace" not in properties
    assert "exception_type" not in properties
    # consumer-safe fields are preserved
    assert properties["error_message"] == "boom"
    assert properties["is_abortable"] is True
    assert properties["progress_percent"] == 1.0


def test_get_properties_exposes_debug_fields_when_show_stacktrace(
    app_context: None, mocker: MockerFixture
) -> None:
    """
    When SHOW_STACKTRACE is explicitly enabled, the debugging fields are
    returned (parity with how Superset surfaces stack traces elsewhere).
    """
    mocker.patch.dict(current_app.config, {"SHOW_STACKTRACE": True})

    properties = TaskResponseSchema().get_properties(_task_with_error_properties())

    assert properties["exception_type"] == "KeyError"
    assert str(properties["stack_trace"]).startswith("Traceback")
