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
    "dashboard_overrides,secret_key,execute_as,has_initiator,use_custom_digest,expected_result",
    [
        (
            None,
            "my_secret",
            [ExecutorType.SELENIUM],
            False,
            False,
            "9dfd9e0685911ca56f041e57b63bd950",
        ),
        (
            None,
            "my_secret",
            [ExecutorType.INITIATOR],
            True,
            False,
            "7c9bccb14f0bac455c5cd0181d9c61a1",
        ),
        (
            None,
            "my_other_secret",
            [ExecutorType.INITIATOR],
            True,
            False,
            "3fe8f5fc9fa81c78d064e2b11ba4aaa8",
        ),
        (
            {
                "position_json": {"b": "c"},
            },
            "my_secret",
            [ExecutorType.INITIATOR],
            True,
            False,
            "bf9401fd23f778c0026e9b614b81736f",
        ),
        (
            {
                "css": "background-color: darkblue;",
            },
            "my_secret",
            [ExecutorType.INITIATOR],
            True,
            False,
            "8752d66b796f8e9f81a083b681bdefe9",
        ),
        (
            {
                "json_metadata": {"d": "e"},
            },
            "my_secret",
            [ExecutorType.INITIATOR],
            True,
            False,
            "62e1f5bff56c57614c31beb83d67c492",
        ),
        (
            None,
            "my_secret",
            [ExecutorType.INITIATOR],
            True,
            True,
            "1.initiator.1",
        ),
        (
            None,
            "my_secret",
            [ExecutorType.INITIATOR],
            False,
            False,
            ExecutorNotFoundError(),
        ),
    ],
)
def test_dashboard_digest(
    dashboard_overrides: Optional[Dict[str, Any]],
    secret_key: str,
    execute_as: List[ExecutorType],
    has_initiator: bool,
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
    if has_initiator:
        user = User(id=1, username="1")
    func = CUSTOM_DASHBOARD_FUNC if use_custom_digest else None

    with patch.dict(
        app.config,
        {
            "SECRET_KEY": secret_key,
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
    "chart_overrides,secret_key,execute_as,has_initiator,use_custom_digest,expected_result",
    [
        (
            None,
            "my_secret",
            [ExecutorType.SELENIUM],
            False,
            False,
            "47d852b5c4df211c115905617bb722c1",
        ),
        (
            None,
            "my_secret",
            [ExecutorType.INITIATOR],
            True,
            False,
            "97b78018f0eac76156bb54d3051faed0",
        ),
        (
            None,
            "my_other_secret",
            [ExecutorType.INITIATOR],
            True,
            False,
            "9558cafa50981d550019c854f553b393",
        ),
        (
            None,
            "my_secret",
            [ExecutorType.INITIATOR],
            True,
            True,
            "2.initiator.1",
        ),
        (
            None,
            "my_secret",
            [ExecutorType.INITIATOR],
            False,
            False,
            ExecutorNotFoundError(),
        ),
    ],
)
def test_chart_digest(
    chart_overrides: Optional[Dict[str, Any]],
    secret_key: str,
    execute_as: List[ExecutorType],
    has_initiator: bool,
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
    if has_initiator:
        user = User(id=1, username="1")
    func = CUSTOM_CHART_FUNC if use_custom_digest else None

    with patch.dict(
        app.config,
        {
            "SECRET_KEY": secret_key,
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
