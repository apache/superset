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
from datetime import datetime
from types import SimpleNamespace
from typing import Any

import pytest
from flask import current_app
from pytest_mock import MockerFixture
from sqlalchemy.orm.session import Session

from superset.utils.log import (
    DBEventLogger,
    get_logger_from_status,
    get_object_ids_from_view_args,
)


def test_log_from_status_exception() -> None:
    (func, log_level) = get_logger_from_status(500)
    assert func.__name__ == "exception"
    assert log_level == "exception"


def test_log_from_status_warning() -> None:
    (func, log_level) = get_logger_from_status(422)
    assert func.__name__ == "warning"
    assert log_level == "warning"


def test_log_from_status_info() -> None:
    (func, log_level) = get_logger_from_status(300)
    assert func.__name__ == "info"
    assert log_level == "info"


# Stand-ins for the models behind ``DashboardRestApi`` / ``ChartRestApi``
# ``datamodel``: the helper only inspects the class name, so no ORM is needed.
_Dashboard = type("Dashboard", (), {})
_Slice = type("Slice", (), {})
# A model that ``logs`` has no id column for.
_Database = type("Database", (), {})


def _view_for(model: type) -> SimpleNamespace:
    """Build the minimal REST API shape the event logger inspects."""
    return SimpleNamespace(datamodel=SimpleNamespace(obj=model))


@pytest.mark.parametrize(
    "model,view_args,expected",
    [
        (_Dashboard, {"pk": 42}, {"dashboard_id": 42}),
        (_Dashboard, {"pk": "42"}, {"dashboard_id": 42}),
        (_Dashboard, {"id_or_slug": "7"}, {"dashboard_id": 7}),
        (_Slice, {"pk": "3"}, {"slice_id": 3}),
        (_Slice, {"id_or_uuid": 3}, {"slice_id": 3}),
        (_Dashboard, {"rison": [1, 2, 3]}, {"dashboard_ids": [1, 2, 3]}),
        (_Slice, {"rison": [5]}, {"slice_ids": [5]}),
        # rison payloads that are not a list of ids (list endpoints, thumbnails)
        (_Dashboard, {"rison": {"columns": ["id"]}}, {}),
        (_Dashboard, {"rison": []}, {}),
        (_Dashboard, {"rison": [1, "a"]}, {}),
        # routes with no object identifier at all (create, import, list)
        (_Dashboard, {}, {}),
        # a route parameter takes precedence over a rison list
        (_Dashboard, {"pk": 9, "rison": [1, 2]}, {"dashboard_id": 9}),
        # models without a ``logs`` column never contribute ids
        (_Database, {"pk": 1}, {}),
        (_Database, {"rison": [1, 2]}, {}),
    ],
)
def test_get_object_ids_from_view_args(
    model: type, view_args: dict[str, Any], expected: dict[str, Any]
) -> None:
    assert get_object_ids_from_view_args(_view_for(model), view_args) == expected


def test_get_object_ids_from_view_args_without_datamodel() -> None:
    """Plain views and free functions decorated with the logger are ignored."""
    assert get_object_ids_from_view_args(None, {"pk": 1}) == {}
    assert get_object_ids_from_view_args(object(), {"pk": 1}) == {}


def test_get_object_ids_from_view_args_resolves_slug_and_uuid(
    session: Session,
) -> None:
    """Slug and UUID routes resolve to the integer id, even when archived."""
    from superset.models.core import FavStar  # noqa: F401
    from superset.models.dashboard import Dashboard

    Dashboard.metadata.create_all(session.get_bind())  # pylint: disable=no-member
    dashboard = Dashboard(
        id=100,
        dashboard_title="audited",
        slug="audited-slug",
        uuid=uuid.uuid4(),
        deleted_at=datetime.now(),
    )
    session.add(dashboard)
    session.commit()

    view = _view_for(Dashboard)
    assert get_object_ids_from_view_args(view, {"id_or_slug": "audited-slug"}) == {
        "dashboard_id": 100
    }
    assert get_object_ids_from_view_args(view, {"uuid": str(dashboard.uuid)}) == {
        "dashboard_id": 100
    }
    assert get_object_ids_from_view_args(view, {"uuid_str": str(uuid.uuid4())}) == {}
    assert get_object_ids_from_view_args(view, {"id_or_slug": "missing"}) == {}


def test_log_this_with_context_derives_object_id_from_route(
    app_context: None, mocker: MockerFixture
) -> None:
    """``log_this_with_context`` fills ``dashboard_id`` from the route's pk."""
    mock_log = mocker.patch.object(DBEventLogger, "log")
    logger = DBEventLogger()

    class FakeDashboardRestApi:  # pylint: disable=too-few-public-methods
        datamodel = SimpleNamespace(obj=_Dashboard)

        @logger.log_this_with_context(action="DashboardRestApi.delete")
        def delete(self, pk: int) -> str:
            return f"deleted {pk}"

    with current_app.test_request_context("/api/v1/dashboard/42", method="DELETE"):
        assert FakeDashboardRestApi().delete(pk="42") == "deleted 42"

    payload = mock_log.call_args[1]
    assert payload["dashboard_id"] == 42
    # ``to_int`` turns a missing id into 0; the DB logger stores that as NULL.
    assert not payload["slice_id"]
    assert payload["records"][0]["dashboard_id"] == 42
    assert payload["records"][0]["pk"] == "42"
