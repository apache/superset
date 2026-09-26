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

"""Dashboard-to-chart access inheritance, exercised against real rows.

``get_inherited_slice_ids_subquery`` backs the promiscuous-viewer branches of
``raise_for_access``. The ``published`` gate applies to the viewers leg only,
mirroring the dashboard read gate: editors are admitted regardless of
publication state, viewers only for a published dashboard. Gating editors too
let an editor open their own unpublished dashboard while every chart on it
lost ``form_data`` — the dashboard rendered empty for its own editor.

Each test executes the generated SQL against in-memory rows, so a regression
in the join or the gate fails here.
"""

from __future__ import annotations

from contextlib import contextmanager
from types import SimpleNamespace
from typing import Iterator

import pytest
from flask import current_app, g
from sqlalchemy.orm.session import Session


@pytest.fixture
def inheritance_fixtures(app_context: None, session: Session) -> SimpleNamespace:
    """Four dashboards covering the editor/viewer x published/draft matrix."""
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


def _inherited_slice_ids(session: Session, user_id: int) -> set[int]:
    from superset.subjects.utils import get_inherited_slice_ids_subquery

    return {
        row[0] for row in session.execute(get_inherited_slice_ids_subquery(user_id))
    }


def _inherited_datasource_ids(
    session: Session, user_id: int, datasource_type: str
) -> set[int]:
    from superset.subjects.utils import get_inherited_datasource_ids_subquery

    return {
        row[0]
        for row in session.execute(
            get_inherited_datasource_ids_subquery(user_id, datasource_type)
        )
    }


def test_editor_inherits_charts_of_published_and_unpublished_dashboards(
    inheritance_fixtures: SimpleNamespace,
) -> None:
    """An editor inherits every member chart regardless of publication state.

    The unpublished case is the regression: the dashboard read gate admits
    editors without a ``published`` check, so gating inheritance on it stripped
    ``form_data`` from every chart of a dashboard its own editor could open.
    """
    fx = inheritance_fixtures

    assert _inherited_slice_ids(fx.session, fx.editor_user.id) == {
        fx.editor_published_slice.id,
        fx.editor_draft_slice.id,
    }


def test_viewer_inherits_only_published_dashboard_charts(
    inheritance_fixtures: SimpleNamespace,
) -> None:
    """A viewer inherits charts of published dashboards only."""
    fx = inheritance_fixtures

    assert _inherited_slice_ids(fx.session, fx.viewer_user.id) == {
        fx.viewer_published_slice.id
    }


def test_unrelated_user_inherits_nothing(
    inheritance_fixtures: SimpleNamespace,
) -> None:
    """A user who is neither editor nor viewer inherits no charts."""
    fx = inheritance_fixtures

    assert _inherited_slice_ids(fx.session, fx.stranger_user.id) == set()


def test_charts_of_other_dashboards_are_not_inherited(
    inheritance_fixtures: SimpleNamespace,
) -> None:
    """Inheritance is scoped to the user's own dashboards."""
    fx = inheritance_fixtures

    for user in (fx.editor_user, fx.viewer_user):
        assert fx.unrelated_slice.id not in _inherited_slice_ids(fx.session, user.id)


def test_inherited_datasources_follow_the_same_gate(
    inheritance_fixtures: SimpleNamespace,
) -> None:
    """Datasets inherit through the charts, so the editor reaches the table and
    an unrelated user does not."""
    fx = inheritance_fixtures

    assert _inherited_datasource_ids(fx.session, fx.editor_user.id, "table") == {
        fx.table.id
    }
    assert _inherited_datasource_ids(fx.session, fx.stranger_user.id, "table") == set()


def test_inherited_datasources_are_type_scoped(
    inheritance_fixtures: SimpleNamespace,
) -> None:
    """Datasource ids are only unique within a type, so a mismatched type must
    not match the table-backed member chart."""
    fx = inheritance_fixtures

    assert (
        _inherited_datasource_ids(fx.session, fx.editor_user.id, "semantic_view")
        == set()
    )


# ---------------------------------------------------------------------------
# can_inherit_access_via_dashboard / can_drill_dataset_via_dashboard_access
#
# Exercised through the real security manager against the rows above, with the
# acting user in ``g`` as a request would set it.
# ---------------------------------------------------------------------------


def test_editor_inherits_access_to_unpublished_dashboard(
    inheritance_fixtures: SimpleNamespace, promiscuous: None
) -> None:
    """The regression madhushreeag reported: an editor opens their unpublished
    dashboard, so inheritance must hold there too."""
    from superset import security_manager

    fx = inheritance_fixtures
    with acting_as(fx.editor_user):
        assert security_manager.can_inherit_access_via_dashboard(fx.editor_draft)
        assert security_manager.can_inherit_access_via_dashboard(fx.editor_published)


def test_viewer_inherits_published_dashboard_only(
    inheritance_fixtures: SimpleNamespace, promiscuous: None
) -> None:
    """A viewer inherits a published dashboard but not an unpublished one."""
    from superset import security_manager

    fx = inheritance_fixtures
    with acting_as(fx.viewer_user):
        assert security_manager.can_inherit_access_via_dashboard(fx.viewer_published)
        assert not security_manager.can_inherit_access_via_dashboard(fx.viewer_draft)


def test_stranger_inherits_nothing(
    inheritance_fixtures: SimpleNamespace, promiscuous: None
) -> None:
    """A user with no editor/viewer grant inherits no dashboard access."""
    from superset import security_manager

    fx = inheritance_fixtures
    with acting_as(fx.stranger_user):
        assert not security_manager.can_inherit_access_via_dashboard(fx.unrelated)
        assert not security_manager.can_inherit_access_via_dashboard(
            fx.editor_published
        )


def test_no_inheritance_without_promiscuous_mode(
    inheritance_fixtures: SimpleNamespace, monkeypatch: pytest.MonkeyPatch
) -> None:
    """With VIEWER_PROMISCUOUS_MODE off, dashboard access is not inherited."""
    from superset import feature_flag_manager, security_manager

    monkeypatch.setitem(current_app.config, "VIEWER_PROMISCUOUS_MODE", False)
    monkeypatch.setitem(
        feature_flag_manager._feature_flags,  # pylint: disable=protected-access
        "ENABLE_VIEWERS",
        True,
    )

    fx = inheritance_fixtures
    with acting_as(fx.editor_user):
        assert not security_manager.can_inherit_access_via_dashboard(fx.editor_draft)


def test_drill_requires_datasource_membership(
    inheritance_fixtures: SimpleNamespace, promiscuous: None
) -> None:
    """Drill adds a membership guard on top of inheritance, because the drill
    endpoints resolve the datasource from an untrusted request parameter."""
    from superset import security_manager
    from superset.connectors.sqla.models import SqlaTable

    fx = inheritance_fixtures
    non_member = SqlaTable(
        id=999,
        table_name="not_on_the_dashboard",
        database_id=10,
        perm="[examples].[not_on_the_dashboard](id:999)",
    )
    fx.session.add(non_member)
    fx.session.flush()

    with acting_as(fx.editor_user):
        assert security_manager.can_drill_dataset_via_dashboard_access(
            fx.table, fx.editor_draft
        )
        assert not security_manager.can_drill_dataset_via_dashboard_access(
            non_member, fx.editor_draft
        )
