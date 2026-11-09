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

"""``VIEWER_PROMISCUOUS_MODE`` dashboard grants, exercised against real rows.

The grant follows the legacy ``DASHBOARD_RBAC`` model: listed viewers of a
published dashboard may read its member charts and their datasources, but only
on requests bound to that dashboard. Editors get nothing beyond their regular
access, and nothing outside a dashboard-bound request counts the grant, so it
can't become lasting access to a chart or datasource.
"""

from __future__ import annotations

from contextlib import contextmanager
from types import SimpleNamespace
from typing import Any, Iterator

import pytest
from flask import current_app, g
from sqlalchemy.orm.session import Session


@pytest.fixture
def inheritance_fixtures(app_context: None, session: Session) -> SimpleNamespace:
    """Four dashboards covering the editor/viewer x published/draft matrix, plus
    a chart on no dashboard that the editor edits and the viewer is listed on."""
    # pylint: disable=import-outside-toplevel
    from flask_appbuilder.security.sqla.models import User

    from superset.connectors.sqla.models import SqlaTable
    from superset.models.core import Database
    from superset.models.dashboard import Dashboard
    from superset.models.slice import Slice
    from superset.subjects.models import Subject
    from superset.subjects.types import SubjectType

    engine = session.get_bind()
    Dashboard.metadata.create_all(engine)  # pylint: disable=no-member

    database = Database(id=10, database_name="examples", sqlalchemy_uri="sqlite://")
    session.add(database)
    session.flush()

    table = SqlaTable(
        id=1,
        table_name="birth_names",
        database_id=database.id,
        perm="[examples].[birth_names](id:1)",
    )
    session.add(table)
    session.flush()

    def make_slice(name: str) -> Slice:
        return Slice(
            slice_name=name,
            datasource_id=table.id,
            datasource_type="table",
            datasource_name="birth_names",
            viz_type="table",
        )

    editor_published_slice = make_slice("editor published chart")
    editor_draft_slice = make_slice("editor draft chart")
    viewer_published_slice = make_slice("viewer published chart")
    viewer_draft_slice = make_slice("viewer draft chart")
    unrelated_slice = make_slice("unrelated chart")
    session.add_all(
        [
            editor_published_slice,
            editor_draft_slice,
            viewer_published_slice,
            viewer_draft_slice,
            unrelated_slice,
        ]
    )
    session.flush()

    def make_user(id_: int, username: str) -> User:
        return User(
            id=id_,
            username=username,
            first_name=username,
            last_name="user",
            email=f"{username}@example.com",
        )

    editor_user = make_user(1, "editor")
    viewer_user = make_user(2, "viewer")
    stranger_user = make_user(3, "stranger")
    session.add_all([editor_user, viewer_user, stranger_user])
    session.flush()

    def make_subject(user: User) -> Subject:
        subject = Subject(
            label=user.username,
            type=SubjectType.USER,
            user_id=user.id,
        )
        session.add(subject)
        session.flush()
        return subject

    editor_subject = make_subject(editor_user)
    viewer_subject = make_subject(viewer_user)

    shared_slice = make_slice("shared chart")
    shared_slice.editors = [editor_subject]
    shared_slice.viewers = [viewer_subject]
    session.add(shared_slice)
    session.flush()

    editor_published = Dashboard(
        dashboard_title="editor published",
        slug="editor-published",
        published=True,
        slices=[editor_published_slice],
        editors=[editor_subject],
    )
    editor_draft = Dashboard(
        dashboard_title="editor draft",
        slug="editor-draft",
        published=False,
        slices=[editor_draft_slice],
        editors=[editor_subject],
    )
    viewer_published = Dashboard(
        dashboard_title="viewer published",
        slug="viewer-published",
        published=True,
        slices=[viewer_published_slice],
        viewers=[viewer_subject],
    )
    viewer_draft = Dashboard(
        dashboard_title="viewer draft",
        slug="viewer-draft",
        published=False,
        slices=[viewer_draft_slice],
        viewers=[viewer_subject],
    )
    unrelated = Dashboard(
        dashboard_title="unrelated",
        slug="unrelated",
        published=True,
        slices=[unrelated_slice],
    )
    session.add_all(
        [editor_published, editor_draft, viewer_published, viewer_draft, unrelated]
    )
    session.flush()

    return SimpleNamespace(
        session=session,
        table=table,
        editor_user=editor_user,
        viewer_user=viewer_user,
        stranger_user=stranger_user,
        editor_published=editor_published,
        editor_draft=editor_draft,
        viewer_published=viewer_published,
        viewer_draft=viewer_draft,
        unrelated=unrelated,
        editor_published_slice=editor_published_slice,
        editor_draft_slice=editor_draft_slice,
        viewer_published_slice=viewer_published_slice,
        viewer_draft_slice=viewer_draft_slice,
        unrelated_slice=unrelated_slice,
        shared_slice=shared_slice,
    )


@pytest.fixture
def promiscuous(monkeypatch: pytest.MonkeyPatch) -> None:
    """Enable the deployment flag and config the inheritance is gated on."""
    from superset import feature_flag_manager

    monkeypatch.setitem(current_app.config, "VIEWER_PROMISCUOUS_MODE", True)
    flags = feature_flag_manager._feature_flags  # pylint: disable=protected-access
    monkeypatch.setitem(flags, "ENABLE_VIEWERS", True)
    monkeypatch.setitem(flags, "EMBEDDED_SUPERSET", False)


@contextmanager
def acting_as(user: object) -> Iterator[None]:
    """Run the block as ``user``, the way a request would."""
    previous = getattr(g, "user", None)
    g.user = user
    try:
        yield
    finally:
        g.user = previous


def _chart_request(chart: Any, datasource: Any) -> Any:
    """A chart-data request for ``chart`` on its own, outside any dashboard."""
    return SimpleNamespace(datasource=datasource, form_data={"slice_id": chart.id})


def _bound_to(dashboard: Any, chart: Any, datasource: Any) -> Any:
    """A chart-data request for ``chart`` as rendered on ``dashboard``."""
    return SimpleNamespace(
        datasource=datasource,
        form_data={"dashboardId": dashboard.id, "slice_id": chart.id},
    )


def test_viewer_reads_a_published_dashboard_only_through_its_requests(
    inheritance_fixtures: SimpleNamespace, promiscuous: None
) -> None:
    """A listed viewer of a published dashboard reads its member charts' data
    on requests bound to it, and nothing else: not the charts or the dataset
    themselves, not a chart off the dashboard, not an unpublished dashboard.
    A chart's listed viewer likewise reads that chart's data, and no other's."""
    from superset import security_manager
    from superset.exceptions import SupersetSecurityException

    fx = inheritance_fixtures
    with acting_as(fx.viewer_user):
        assert security_manager.has_promiscuous_dashboard_access(fx.viewer_published)
        assert not security_manager.has_promiscuous_dashboard_access(fx.viewer_draft)

        security_manager.raise_for_access(
            query_context=_bound_to(
                fx.viewer_published, fx.viewer_published_slice, fx.table
            )
        )
        assert security_manager.can_drill_dataset_via_dashboard_access(
            fx.table, fx.viewer_published
        )

        assert security_manager.has_promiscuous_chart_access(fx.shared_slice)
        security_manager.raise_for_access(
            query_context=_chart_request(fx.shared_slice, fx.table)
        )

        for denied in (
            {"query_context": _chart_request(fx.unrelated_slice, fx.table)},
            {"chart": fx.viewer_published_slice},
            {"datasource": fx.table},
            {
                "query_context": _bound_to(
                    fx.viewer_published, fx.unrelated_slice, fx.table
                )
            },
            {
                "query_context": _bound_to(
                    fx.viewer_draft, fx.viewer_draft_slice, fx.table
                )
            },
        ):
            with pytest.raises(SupersetSecurityException):
                security_manager.raise_for_access(**denied)


def test_editors_strangers_guests_and_flag_off_get_no_grant(
    inheritance_fixtures: SimpleNamespace,
    promiscuous: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Editors keep their regular access only, even on their own published
    dashboard or chart; strangers and embedded guests get nothing; and the
    grant is off without ``VIEWER_PROMISCUOUS_MODE``."""
    from superset import security_manager
    from superset.exceptions import SupersetSecurityException

    fx = inheritance_fixtures
    with acting_as(fx.editor_user):
        assert not security_manager.has_promiscuous_dashboard_access(
            fx.editor_published
        )
        with pytest.raises(SupersetSecurityException):
            security_manager.raise_for_access(
                query_context=_bound_to(
                    fx.editor_published, fx.editor_published_slice, fx.table
                )
            )
        assert not security_manager.can_drill_dataset_via_dashboard_access(
            fx.table, fx.editor_published
        )
        assert not security_manager.has_promiscuous_chart_access(fx.shared_slice)
        with pytest.raises(SupersetSecurityException):
            security_manager.raise_for_access(
                query_context=_chart_request(fx.shared_slice, fx.table)
            )

    with acting_as(fx.stranger_user):
        assert not security_manager.has_promiscuous_dashboard_access(fx.unrelated)

    with acting_as(fx.viewer_user):
        monkeypatch.setattr(security_manager, "is_guest_user", lambda: True)
        assert not security_manager.has_promiscuous_dashboard_access(
            fx.viewer_published
        )
        assert not security_manager.has_promiscuous_chart_access(fx.shared_slice)
        monkeypatch.setattr(security_manager, "is_guest_user", lambda: False)

        monkeypatch.setitem(current_app.config, "VIEWER_PROMISCUOUS_MODE", False)
        assert not security_manager.has_promiscuous_dashboard_access(
            fx.viewer_published
        )
        assert not security_manager.has_promiscuous_chart_access(fx.shared_slice)


def test_carrying_charts_or_filter_targets_onto_a_dashboard_takes_access(
    inheritance_fixtures: SimpleNamespace, promiscuous: None
) -> None:
    """The promiscuous grant lets a dashboard's viewers read its charts and
    native-filter targets, and an editor can add themselves as a viewer. So
    whatever a dashboard newly gains must be readable by the editor in their own
    right: a copy's charts (with or without duplicating them) and filter
    targets, and a new filter target saved through the dashboard or the filters
    API. Targets the dashboard already had stay accepted."""
    from flask_appbuilder.security.sqla.models import Role

    from superset import security_manager
    from superset.commands.dashboard.exceptions import DashboardLayoutInvalidError
    from superset.connectors.sqla.models import SqlaTable
    from superset.daos.dashboard import DashboardDAO
    from superset.utils import json

    fx = inheritance_fixtures
    unreadable = SqlaTable(
        id=3, table_name="unreadable", database_id=10, perm="[examples].[x](id:3)"
    )
    fx.session.add(unreadable)
    fx.session.flush()

    def native_filters(datasource_id: int) -> list[dict[str, Any]]:
        return [
            {
                "id": "NATIVE_FILTER-1",
                "targets": [{"datasetId": datasource_id, "column": {"name": "x"}}],
            }
        ]

    layout = {
        "positions": {
            "CHART-1": {
                "type": "CHART",
                "id": "CHART-1",
                "children": [],
                "meta": {"chartId": fx.editor_published_slice.id},
            }
        }
    }

    def copy_editor_published(
        metadata: dict[str, Any] | None = None, **data: Any
    ) -> Any:
        return DashboardDAO.copy_dashboard(
            fx.editor_published,
            {
                "dashboard_title": "copy",
                "json_metadata": json.dumps(metadata or {}),
                **data,
            },
        )

    with acting_as(fx.editor_user):
        # Without a layout, with one, and duplicating the layout's charts.
        for metadata, data in (
            (None, {}),
            (layout, {}),
            (layout, {"duplicate_slices": True}),
        ):
            with pytest.raises(DashboardLayoutInvalidError):
                copy_editor_published(metadata, **data)

        grant = security_manager.add_permission_view_menu(
            "datasource_access", fx.table.perm
        )
        fx.editor_user.roles = [Role(name="dataset reader", permissions=[grant])]
        fx.session.flush()
        copy = copy_editor_published()
        assert {chart.id for chart in copy.slices} == {fx.editor_published_slice.id}

        with pytest.raises(DashboardLayoutInvalidError) as refused:
            DashboardDAO.set_dash_metadata(
                fx.editor_published,
                {"native_filter_configuration": native_filters(unreadable.id)},
            )
        assert str(unreadable.id) in str(refused.value.normalized_messages())
        with pytest.raises(DashboardLayoutInvalidError):
            DashboardDAO.update_native_filters_config(
                fx.editor_published, {"modified": native_filters(unreadable.id)}
            )
        DashboardDAO.set_dash_metadata(
            fx.editor_published,
            {"native_filter_configuration": native_filters(fx.table.id)},
        )

        # A target the dashboard already has is accepted on save, but a copy
        # would carry it over, so the copy needs access to it.
        fx.editor_published.json_metadata = json.dumps(
            {"native_filter_configuration": native_filters(unreadable.id)}
        )
        DashboardDAO.set_dash_metadata(
            fx.editor_published,
            {"native_filter_configuration": native_filters(unreadable.id)},
        )
        with pytest.raises(DashboardLayoutInvalidError):
            copy_editor_published()


def test_operator_override_with_the_original_signature_keeps_working(
    inheritance_fixtures: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Internal checks call ``raise_for_access`` with its original arguments, so
    an operator override that has that signature and delegates to the stock
    method still serves an ordinary chart check, even with viewers off."""
    from unittest.mock import patch

    from superset import feature_flag_manager, security_manager
    from superset.security.manager import SupersetSecurityManager

    monkeypatch.setitem(
        feature_flag_manager._feature_flags,  # pylint: disable=protected-access
        "ENABLE_VIEWERS",
        False,
    )
    stock = SupersetSecurityManager.raise_for_access

    def raise_for_access(  # pylint: disable=too-many-arguments
        self: SupersetSecurityManager,
        dashboard: Any = None,
        chart: Any = None,
        database: Any = None,
        datasource: Any = None,
        query: Any = None,
        query_context: Any = None,
        table: Any = None,
        sql: Any = None,
        catalog: Any = None,
        schema: Any = None,
        template_params: Any = None,
        force_dataset_match: bool = False,
        allow_query_authorship_bypass: bool = False,
        allow_editorship: bool = True,
    ) -> None:
        stock(
            self,
            dashboard=dashboard,
            chart=chart,
            database=database,
            datasource=datasource,
            query=query,
            query_context=query_context,
            table=table,
            sql=sql,
            catalog=catalog,
            schema=schema,
            template_params=template_params,
            force_dataset_match=force_dataset_match,
            allow_query_authorship_bypass=allow_query_authorship_bypass,
            allow_editorship=allow_editorship,
        )

    from flask_appbuilder.security.sqla.models import Role

    fx = inheritance_fixtures
    grant = security_manager.add_permission_view_menu(
        "datasource_access", fx.table.perm
    )
    fx.stranger_user.roles = [Role(name="dataset reader", permissions=[grant])]
    fx.session.flush()

    with (
        acting_as(fx.stranger_user),
        patch.object(SupersetSecurityManager, "raise_for_access", raise_for_access),
    ):
        # The chart has no viewers, so access comes from the dataset grant
        # through the chart fallback.
        assert security_manager.can_access_chart(fx.unrelated_slice)
