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
from __future__ import annotations

from contextlib import nullcontext
from typing import Any, Dict, List, Optional, TYPE_CHECKING, Union
from unittest.mock import patch

import pytest
from flask_appbuilder.security.sqla.models import User

from superset.tasks.exceptions import ExecutorNotFoundError
from superset.tasks.types import ExecutorType
from superset.utils.core import override_user

if TYPE_CHECKING:
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice

_DEFAULT_DASHBOARD_KWARGS = {
    "id": 1,
    "position_json": '{"a": "b"}',
    "css": "background-color: lightblue;",
    "json_metadata": '{"c": "d"}',
}

_DEFAULT_CHART_KWARGS = {
    "id": 2,
    "params": {"a": "b"},
}


def CUSTOM_DASHBOARD_FUNC(
    dashboard: Dashboard,
    executor_type: ExecutorType,
    executor: str,
) -> str:
    return f"{dashboard.id}.{executor_type.value}.{executor}"


def CUSTOM_CHART_FUNC(
    chart: Slice,
    executor_type: ExecutorType,
    executor: str,
) -> str:
    return f"{chart.id}.{executor_type.value}.{executor}"


@pytest.mark.parametrize(
    "dashboard_overrides,execute_as,has_current_user,use_custom_digest,expected_result",
    [
        (
            None,
            [ExecutorType.SELENIUM],
            False,
            False,
            "0f94edd2d7dfd71724ce8236c05a6bf5",
        ),
        (
            None,
            [ExecutorType.CURRENT_USER],
            True,
            False,
            "6b05b0eff27796f266e538a26a155cf7",
        ),
        (
            {
                "position_json": {"b": "c"},
            },
            [ExecutorType.CURRENT_USER],
            True,
            False,
            "c9c06fd8058f8b1d3bb84e2699aaae0f",
        ),
        (
            {
                "css": "background-color: darkblue;",
            },
            [ExecutorType.CURRENT_USER],
            True,
            False,
            "be15e84a631755e537bd2706beeae70a",
        ),
        (
            {
                "json_metadata": {"d": "e"},
            },
            [ExecutorType.CURRENT_USER],
            True,
            False,
            "9996e1f6cf8ebbf2aebe2938a7d59a0e",
        ),
        (
            None,
            [ExecutorType.CURRENT_USER],
            True,
            True,
            "1.current_user.1",
        ),
        (
            None,
            [ExecutorType.CURRENT_USER],
            False,
            False,
            ExecutorNotFoundError(),
        ),
    ],
)
def test_dashboard_digest(
    dashboard_overrides: Optional[Dict[str, Any]],
    execute_as: List[ExecutorType],
    has_current_user: bool,
    use_custom_digest: bool,
    expected_result: Union[str, Exception],
) -> None:
    from superset import app
    from superset.models.dashboard import Dashboard
    from superset.thumbnails.digest import get_dashboard_digest

    kwargs = {
        **_DEFAULT_DASHBOARD_KWARGS,
        **(dashboard_overrides or {}),
    }
    dashboard = Dashboard(**kwargs)
    user: Optional[User] = None
    if has_current_user:
        user = User(id=1, username="1")
    func = CUSTOM_DASHBOARD_FUNC if use_custom_digest else None

    with patch.dict(
        app.config,
        {
            "THUMBNAIL_EXECUTE_AS": execute_as,
            "THUMBNAIL_DASHBOARD_DIGEST_FUNC": func,
        },
    ), override_user(user):
        cm = (
            pytest.raises(type(expected_result))
            if isinstance(expected_result, Exception)
            else nullcontext()
        )
        with cm:
            assert get_dashboard_digest(dashboard=dashboard) == expected_result


@pytest.mark.parametrize(
    "chart_overrides,execute_as,has_current_user,use_custom_digest,expected_result",
    [
        (
            None,
            [ExecutorType.SELENIUM],
            False,
            False,
            "47d852b5c4df211c115905617bb722c1",
        ),
        (
            None,
            [ExecutorType.CURRENT_USER],
            True,
            False,
            "4f8109d3761e766e650af514bb358f10",
        ),
        (
            None,
            [ExecutorType.CURRENT_USER],
            True,
            True,
            "2.current_user.1",
        ),
        (
            None,
            [ExecutorType.CURRENT_USER],
            False,
            False,
            ExecutorNotFoundError(),
        ),
    ],
)
def test_chart_digest(
    chart_overrides: Optional[Dict[str, Any]],
    execute_as: List[ExecutorType],
    has_current_user: bool,
    use_custom_digest: bool,
    expected_result: Union[str, Exception],
) -> None:
    from superset import app
    from superset.models.slice import Slice
    from superset.thumbnails.digest import get_chart_digest

    kwargs = {
        **_DEFAULT_CHART_KWARGS,
        **(chart_overrides or {}),
    }
    chart = Slice(**kwargs)
    user: Optional[User] = None
    if has_current_user:
        user = User(id=1, username="1")
    func = CUSTOM_CHART_FUNC if use_custom_digest else None

    with patch.dict(
        app.config,
        {
            "THUMBNAIL_EXECUTE_AS": execute_as,
            "THUMBNAIL_CHART_DIGEST_FUNC": func,
        },
    ), override_user(user):
        cm = (
            pytest.raises(type(expected_result))
            if isinstance(expected_result, Exception)
            else nullcontext()
        )
        with cm:
            assert get_chart_digest(chart=chart) == expected_result
