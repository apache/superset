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
from unittest.mock import MagicMock

from flask import current_app
from pytest_mock import MockerFixture
from sqlalchemy import false

from superset.tasks.filters import TaskFilter


def test_task_filter_fails_closed_for_request_without_user_id(
    mocker: MockerFixture,
    app_context: None,
) -> None:
    """
    A request-bound principal without a user id (anonymous or guest user)
    must not receive the unfiltered task list.
    """
    mocker.patch("superset.tasks.filters.get_user_id", return_value=None)
    task_filter = TaskFilter("id", MagicMock())
    query = MagicMock()

    with current_app.test_request_context("/api/v1/task/"):
        filtered = task_filter.apply(query, None)

    assert filtered is not query
    query.filter.assert_called_once()
    (predicate,) = query.filter.call_args.args
    assert str(predicate) == str(false())
