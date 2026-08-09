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

from sqlalchemy.orm.session import Session

from superset.models.sql_lab import Query, TabState
from superset.views.sql_lab.views import TabStateView


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

    query = Query(
        client_id=latest_query_client_id,
        database_id=1,
        user_id=owner_id,
        sql_editor_id=str(tab_state.id),
        sql="SELECT 1",
    )
    session.add(query)
    session.flush()

    return tab_state, query


def test_delete_query_updates_another_users_tab_state_pointer(
    session: Session, mocker
) -> None:
    """
    ``delete_query`` scopes the ``Query`` row deletion to
    ``Query.user_id == get_user_id()``, but the preceding update of the
    owning ``TabState.latest_query_id`` pointer (used to keep the tab's
    "last run query" reference consistent) is filtered only by
    ``TabState.id`` and the current value of ``latest_query_id`` -- not by
    the tab's ``user_id``. A caller who is not the tab's owner can still
    trigger that update as long as they supply the tab's id and the
    client_id currently stored in ``latest_query_id``.
    """
    TabState.metadata.create_all(session.get_bind())  # pylint: disable=no-member

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

    assert response.status_code == 200

    session.expire_all()
    refreshed_tab_state = session.query(TabState).filter_by(id=tab_state.id).one()
    # The pointer was mutated even though `other_user_id` does not own the
    # tab and no ownership check was performed before the update.
    assert refreshed_tab_state.latest_query_id != "owner-query-1"

    # The Query row deletion is correctly scoped to the caller's own user_id,
    # so the owner's Query row is left in place -- only the TabState update
    # is unguarded.
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
    TabState.metadata.create_all(session.get_bind())  # pylint: disable=no-member

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
