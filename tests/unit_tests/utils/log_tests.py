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
from datetime import datetime, timezone
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
_Canvas = type("Canvas", (), {})
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
        # canvas routes identify themselves by pk, uuid or slug
        (_Canvas, {"pk": 11}, {"canvas_id": 11}),
        (_Canvas, {"id_or_uuid": "11"}, {"canvas_id": 11}),
        (_Canvas, {"uuid_str": "11"}, {"canvas_id": 11}),
        (_Dashboard, {"rison": [1, 2, 3]}, {"dashboard_ids": [1, 2, 3]}),
        (_Slice, {"rison": [5]}, {"slice_ids": [5]}),
        (_Canvas, {"rison": [4, 6]}, {"canvas_ids": [4, 6]}),
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
        deleted_at=datetime.now(timezone.utc),
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
    # ``canvas_id`` travels as a keyword argument rather than widening the
    # abstract ``log()`` signature, so it is passed even on a dashboard route.
    assert not payload["canvas_id"]
    assert payload["records"][0]["dashboard_id"] == 42
    assert payload["records"][0]["pk"] == "42"


def test_log_this_with_context_derives_object_id_despite_outer_decorator(
    app_context: None, mocker: MockerFixture
) -> None:
    """``DashboardRestApi.get`` sits behind ``with_dashboard``, which calls the
    logged view positionally (``f(self, dash)``) after resolving the id,
    leaving the logger's own ``kwargs`` empty. The id must still come from
    ``request.view_args``, with no ``add_extra_log_payload`` call in the view.
    """
    mock_log = mocker.patch.object(DBEventLogger, "log")
    logger = DBEventLogger()

    class FakeDashboardRestApi:  # pylint: disable=too-few-public-methods
        datamodel = SimpleNamespace(obj=_Dashboard)

        @logger.log_this_with_context(action="DashboardRestApi.get")
        def get(self, dash_id: int) -> str:
            return f"got {dash_id}"

    def with_dashboard(f: Any) -> Any:
        def wraps(self: Any, id_or_slug: str) -> Any:
            return f(self, int(id_or_slug))

        return wraps

    FakeDashboardRestApi.get = with_dashboard(FakeDashboardRestApi.get)  # type: ignore[method-assign]

    with current_app.test_request_context("/api/v1/dashboard/42", method="GET"):
        assert FakeDashboardRestApi().get("42") == "got 42"

    payload = mock_log.call_args[1]
    assert payload["dashboard_id"] == 42


def test_log_this_with_context_derives_canvas_id(
    app_context: None, mocker: MockerFixture
) -> None:
    """A canvas route fills ``canvas_id`` the way a dashboard route fills
    ``dashboard_id``, with no per-endpoint plumbing."""
    mock_log = mocker.patch.object(DBEventLogger, "log")
    logger = DBEventLogger()

    class FakeCanvasRestApi:  # pylint: disable=too-few-public-methods
        datamodel = SimpleNamespace(obj=_Canvas)

        @logger.log_this_with_context(action="CanvasRestApi.get_definition")
        def get_definition(self, id_or_uuid: str) -> str:
            return f"got {id_or_uuid}"

    with current_app.test_request_context("/api/v1/canvas/7/definition", method="GET"):
        assert FakeCanvasRestApi().get_definition(id_or_uuid="7") == "got 7"

    payload = mock_log.call_args[1]
    assert payload["canvas_id"] == 7
    assert not payload["dashboard_id"]
    assert not payload["slice_id"]


def test_log_accepts_a_logger_that_never_heard_of_canvas(
    app_context: None,
) -> None:
    """Back-compat guarantee for ``EVENT_LOGGER`` subclasses.

    ``canvas_id`` is passed as a keyword argument rather than added to the
    abstract ``log()`` signature, so a logger written before the column existed
    keeps working untouched. If this breaks, every downstream custom logger
    breaks on upgrade.
    """
    from superset.utils.log import AbstractEventLogger

    seen: list[dict[str, Any]] = []

    class LegacyEventLogger(AbstractEventLogger):
        # Deliberately declares no ``canvas_id`` parameter, exactly as a
        # third-party logger predating the column would not.
        def log(  # pylint: disable=too-many-arguments
            self,
            user_id: int | None,
            action: str,
            dashboard_id: int | None,
            duration_ms: int | None,
            slice_id: int | None,
            referrer: str | None,
            *args: Any,
            **kwargs: Any,
        ) -> None:
            seen.append({"action": action, "kwargs": kwargs})

    logger = LegacyEventLogger()

    class FakeCanvasRestApi:  # pylint: disable=too-few-public-methods
        datamodel = SimpleNamespace(obj=_Canvas)

        @logger.log_this_with_context(action="CanvasRestApi.put")
        def put(self, pk: int) -> str:
            return f"updated {pk}"

    with current_app.test_request_context("/api/v1/canvas/3", method="PUT"):
        assert FakeCanvasRestApi().put(pk="3") == "updated 3"

    assert len(seen) == 1
    assert seen[0]["action"] == "CanvasRestApi.put"
    # It lands in ``**kwargs``, which is why nothing had to change.
    assert seen[0]["kwargs"]["canvas_id"] == 3


def test_db_event_logger_labels_each_record_with_its_own_canvas(
    app_context: None, mocker: MockerFixture
) -> None:
    """A beacon batch names one ``canvas_id`` for the request, taken from its
    first event. A batch that spans a canvas switch carries the right id on
    each record, so the record's wins and the request's only fills a gap."""
    from superset import db

    saved = mocker.patch.object(db.session, "bulk_save_objects")
    mocker.patch.object(db.session, "commit")

    DBEventLogger().log(
        None,
        "canvas_edit_layout",
        None,
        None,
        None,
        None,
        records=[{"canvas_id": 4}, {"canvas_id": 9}, {"op": "place"}],
        canvas_id=4,
    )

    assert [log.canvas_id for log in saved.call_args.args[0]] == [4, 9, 4]
