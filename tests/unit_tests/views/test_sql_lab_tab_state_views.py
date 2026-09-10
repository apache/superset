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
"""
Behavioral tests for ``superset.views.sql_lab.views.TabStateView``.

These tests call the undecorated view methods directly (via
``__wrapped__``, which ``flask_appbuilder.has_access_api`` preserves through
``functools.update_wrapper``) so that the business logic of each method can
be exercised against an in-memory database without needing a fully
authenticated HTTP session. Only the ownership-check logic inside the view
methods themselves is under test here.
"""

import pytest
from flask import current_app
from sqlalchemy.orm.session import Session

from superset.models.sql_lab import Query, TabState
from superset.views.sql_lab.views import TabStateView


@pytest.fixture(autouse=True)
def tab_state_tables(session: Session) -> None:
    """``TabState`` and ``Query`` share the declarative metadata."""
    TabState.metadata.create_all(session.get_bind())  # pylint: disable=no-member


def _add_query(
    session: Session,
    *,
    client_id: str,
    user_id: int | None,
    sql_editor_id: str,
    sql: str = "SELECT 1",
) -> Query:
    query = Query(
        client_id=client_id,
        database_id=1,
        user_id=user_id,
        sql_editor_id=sql_editor_id,
        sql=sql,
    )
    session.add(query)
    session.flush()
    return query


def _create_tab_state_and_query(
    session: Session,
    *,
    owner_id: int,
    latest_query_client_id: str,
) -> tuple[TabState, Query]:
    tab_state = TabState(
        user_id=owner_id,
        label="unrelated tab",
        active=True,
        database_id=1,
        latest_query_id=latest_query_client_id,
    )
    session.add(tab_state)
    session.flush()

    query = _add_query(
        session,
        client_id=latest_query_client_id,
        user_id=owner_id,
        sql_editor_id=str(tab_state.id),
    )

    return tab_state, query


def test_delete_query_rejects_update_from_non_owning_user(
    session: Session, mocker
) -> None:
    """
    ``delete_query`` checks tab ownership via ``_get_tab_user_id`` before
    touching the owning ``TabState.latest_query_id`` pointer (used to keep
    the tab's "last run query" reference consistent), matching every other
    mutating method on this view. A caller who is not the tab's owner is
    rejected before either the ``TabState`` update or the ``Query`` row
    deletion happens.
    """
    owner_id = 2
    other_user_id = 1

    tab_state, query = _create_tab_state_and_query(
        session, owner_id=owner_id, latest_query_client_id="owner-query-1"
    )
    session.commit()

    # Act as a different, unrelated user.
    mocker.patch("superset.views.sql_lab.views.get_user_id", return_value=other_user_id)

    view = TabStateView()
    response = TabStateView.delete_query.__wrapped__(
        view, tab_state.id, "owner-query-1"
    )

    assert response.status_code == 403

    session.expire_all()
    refreshed_tab_state = session.query(TabState).filter_by(id=tab_state.id).one()
    # The pointer is untouched -- the ownership check rejects the request
    # before the TabState update runs.
    assert refreshed_tab_state.latest_query_id == "owner-query-1"

    # The owner's Query row is left in place too.
    still_present = session.query(Query).filter_by(client_id="owner-query-1").first()
    assert still_present is not None
    assert still_present.id == query.id


def test_put_rejects_update_from_non_owning_user(session: Session, mocker) -> None:
    """
    Sibling method ``put`` performs the ownership check that ``delete_query``
    omits: it looks up the tab's owner via ``_get_tab_user_id`` and returns
    403 before touching the row when the caller does not own the tab. This
    is included for contrast with ``delete_query`` above -- the guard exists
    elsewhere in this class, it's just missing on the ``delete_query`` path.
    """
    owner_id = 2
    other_user_id = 1

    tab_state, _query = _create_tab_state_and_query(
        session, owner_id=owner_id, latest_query_client_id="owner-query-1"
    )
    session.commit()

    mocker.patch("superset.views.sql_lab.views.get_user_id", return_value=other_user_id)

    view = TabStateView()
    response = TabStateView.put.__wrapped__(view, tab_state.id)

    assert response.status_code == 403


def test_put_ignores_columns_outside_the_allowlist(session: Session, mocker) -> None:
    """
    ``put`` writes only the client-updatable columns; identity columns such
    as ``user_id`` are not accepted from the request body, so the tab state
    stays bound to its creating user while allowed fields still apply.
    """
    owner_id = 2
    tab_state, _query = _create_tab_state_and_query(
        session, owner_id=owner_id, latest_query_client_id="owner-query-1"
    )
    session.commit()

    mocker.patch("superset.views.sql_lab.views.get_user_id", return_value=owner_id)

    view = TabStateView()
    with current_app.test_request_context(
        method="PUT", data={"label": '"renamed"', "user_id": "1"}
    ):
        TabStateView.put.__wrapped__(view, tab_state.id)

    session.expire_all()
    refreshed = session.query(TabState).filter_by(id=tab_state.id).one()
    assert refreshed.label == "renamed"
    assert refreshed.user_id == owner_id


def test_put_writes_nothing_for_a_payload_of_only_denied_columns(
    session: Session, mocker
) -> None:
    """
    A payload made up entirely of non-updatable columns is accepted but
    changes none of them, rather than erroring or falling through to a write.
    """
    owner_id = 2
    tab_state, _query = _create_tab_state_and_query(
        session, owner_id=owner_id, latest_query_client_id="owner-query-1"
    )
    session.commit()

    mocker.patch("superset.views.sql_lab.views.get_user_id", return_value=owner_id)

    view = TabStateView()
    with current_app.test_request_context(method="PUT", data={"user_id": "1"}):
        response = TabStateView.put.__wrapped__(view, tab_state.id)

    assert response.status_code == 200

    session.expire_all()
    refreshed = session.query(TabState).filter_by(id=tab_state.id).one()
    assert refreshed.user_id == owner_id
    assert refreshed.label == "unrelated tab"


def test_put_leaves_the_active_flag_to_the_activate_endpoint(
    session: Session, mocker
) -> None:
    """
    ``activate`` keeps exactly one of a user's tabs active by rewriting the
    flag across all of their rows, so ``put`` does not accept ``active``.
    Sending it leaves the stored flag alone while allowed fields still apply.
    """
    owner_id = 2
    tab_state, _query = _create_tab_state_and_query(
        session, owner_id=owner_id, latest_query_client_id="owner-query-1"
    )
    tab_state.active = False
    session.commit()

    mocker.patch("superset.views.sql_lab.views.get_user_id", return_value=owner_id)

    view = TabStateView()
    with current_app.test_request_context(
        method="PUT", data={"active": "true", "label": '"renamed"'}
    ):
        TabStateView.put.__wrapped__(view, tab_state.id)

    session.expire_all()
    refreshed = session.query(TabState).filter_by(id=tab_state.id).one()
    assert refreshed.active is False
    assert refreshed.label == "renamed"


def test_put_only_accepts_latest_query_id_owned_by_caller(
    session: Session, mocker
) -> None:
    """
    A ``latest_query_id`` is stored only when it references the caller's own
    query. A client_id belonging to another user is dropped, so the tab's
    pointer keeps referencing the caller's own query.
    """
    owner_id = 2
    other_user_id = 1
    tab_state, _query = _create_tab_state_and_query(
        session, owner_id=owner_id, latest_query_client_id="owner-query-1"
    )
    _add_query(
        session,
        client_id="foreign-query-1",
        user_id=other_user_id,
        sql_editor_id="999",
        sql="SELECT secret",
    )
    session.commit()

    mocker.patch("superset.views.sql_lab.views.get_user_id", return_value=owner_id)

    view = TabStateView()
    with current_app.test_request_context(
        method="PUT", data={"latest_query_id": '"foreign-query-1"'}
    ):
        TabStateView.put.__wrapped__(view, tab_state.id)

    session.expire_all()
    refreshed = session.query(TabState).filter_by(id=tab_state.id).one()
    assert refreshed.latest_query_id == "owner-query-1"


@pytest.mark.parametrize(
    "query_owner_id,expected_status,rebound",
    [
        pytest.param(1, 404, False, id="another_users_query_is_left_alone"),
        pytest.param(2, 200, True, id="own_query_is_rebound"),
        pytest.param(None, 200, True, id="unowned_query_is_rebound"),
    ],
)
def test_migrate_query_scopes_the_rebind_to_the_caller(
    session: Session,
    mocker,
    query_owner_id: int | None,
    expected_status: int,
    rebound: bool,
) -> None:
    """
    ``migrate_query`` rebinds a query to a tab only when the caller owns that
    query or nobody does. A client_id owned by another user is left untouched
    and the caller gets a 404 rather than a success it would apply locally.
    """
    owner_id = 2
    tab_state, _query = _create_tab_state_and_query(
        session, owner_id=owner_id, latest_query_client_id="owner-query-1"
    )
    _add_query(
        session,
        client_id="target-query",
        user_id=query_owner_id,
        sql_editor_id="88",
    )
    session.commit()

    mocker.patch("superset.views.sql_lab.views.get_user_id", return_value=owner_id)

    view = TabStateView()
    with current_app.test_request_context(
        method="POST", data={"queryId": '"target-query"'}
    ):
        response = TabStateView.migrate_query.__wrapped__(view, tab_state.id)

    assert response.status_code == expected_status

    session.expire_all()
    target = session.query(Query).filter_by(client_id="target-query").one()
    assert target.sql_editor_id == (str(tab_state.id) if rebound else "88")
