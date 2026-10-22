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
"""Put the review flow into a state someone can walk through.

Run it to set the environment up the first time, and again whenever a run
has left the queue in a state you no longer want. It is idempotent: it
creates what is missing, leaves what is already right alone, and finishes
with exactly one change waiting for a reviewer.

    docker compose -p asset-approval-qa exec superset-light \
        python /app/local_extensions/asset-approval/qa/seed.py

Two users, because the point of maker-checker is that an author cannot
approve their own work: the gate looks for a *second* editor of the asset,
so one account can never demonstrate the flow.
"""

from __future__ import annotations

import sys

from superset.app import create_app

MAKER = "maker"
CHECKER = "checker"
VIEWER = "viewer"
PASSWORD = "general"  # noqa: S105 -- a local QA fixture, never a deployment
ROLE = "Alpha"

# The viewer exists to prove the feature's central claim -- that a change
# under review is invisible until it is approved. Gamma alone cannot read the
# example data, so the dashboards render empty and prove nothing; the extra
# permission is what lets this account actually SEE the live version it is
# supposed to be still seeing.
# Gamma is what makes the account usable at all -- the data-access role
# below carries one grant and nothing else, so on its own it cannot even
# read a dashboard, and the viewer could not sign in to be a viewer.
VIEWER_BASE_ROLE = "Gamma"
VIEWER_ROLE = "Viewer (data access)"
VIEWER_PERMISSION = ("all_datasource_access", "all_datasource_access")

# The example dashboard the walkthrough edits. Shipped by `superset load-examples`,
# so it is the same object in every environment built from the README.
DASHBOARD_TITLE = "USA Births Names"
PROPOSED_TITLE = "USA Births Names (Q4)"

# A second dashboard with ONE editor, so the "nobody can approve this yet"
# path has something to happen on. Every other seeded asset has two, which
# is the happy path and can never reach that state.
SOLO_DASHBOARD_TITLE = "Sales Dashboard"

app = create_app()
# The seed drives the app through its own HTTP API rather than writing rows:
# a change request has to be *made* by a write passing through the gate, and
# going around that would seed a shape the application never produces.
app.config["WTF_CSRF_ENABLED"] = False


def ensure_viewer_role():
    """Gamma plus the one grant that lets this account read the examples."""
    from superset import db
    from superset.extensions import security_manager

    role = security_manager.find_role(VIEWER_ROLE)
    if not role:
        role = security_manager.add_role(VIEWER_ROLE)
    grant = security_manager.find_permission_view_menu(*VIEWER_PERMISSION)
    if grant and grant not in role.permissions:
        security_manager.add_permission_role(role, grant)
        db.session.commit()
    return role


def grant_extra_role(user, role_name: str) -> None:
    """A second role alongside the first, added once."""
    from superset import db
    from superset.extensions import security_manager

    role = security_manager.find_role(role_name)
    if role and role not in user.roles:
        user.roles.append(role)
        db.session.commit()


def ensure_user(username: str, role_name: str = ROLE):
    """The QA account, created once and reused after that."""
    from superset.extensions import security_manager

    if user := security_manager.find_user(username=username):
        return user
    role = security_manager.find_role(role_name)
    user = security_manager.add_user(
        username=username,
        first_name=username.capitalize(),
        last_name="(QA)",
        email=f"{username}@example.invalid",
        role=role,
        password=PASSWORD,
    )
    if not user:
        sys.exit(f"could not create {username}")
    print(f"created {username} ({role_name})")
    return user


def grant_editorship(model, user_ids: list[int]) -> None:
    """Make these users editors of an asset, which is what lets them review it.

    Editorship is a subject on the asset, not a role: a reviewer has to be an
    editor of *this* object. Admin's blanket access deliberately does not
    count -- see `eligibility.is_strict_editor`.
    """
    from superset import db
    from superset.subjects.utils import get_or_create_user_subject

    existing = {s.user_id for s in model.editors}
    for user_id in user_ids:
        if user_id in existing:
            continue
        if subject := get_or_create_user_subject(user_id):
            model.editors.append(subject)
    db.session.commit()


def set_sole_editor(model, user_id: int) -> None:
    """Exactly one editor, whoever else was there before.

    Adding an editor is not enough: anyone else already holding this asset
    gives the author an approver, and then the state this is here to produce
    -- an author with nobody to send to -- cannot be reached. The seed claims
    this asset has one editor, so it has to make that true rather than hope.
    """
    from superset import db
    from superset.subjects.utils import get_or_create_user_subject

    subject = get_or_create_user_subject(user_id)
    if subject is None:
        return
    model.editors = [subject]
    db.session.commit()


def login(username: str):
    client = app.test_client()
    response = client.post(
        "/login/",
        data={"username": username, "password": PASSWORD},
        follow_redirects=True,
    )
    if response.status_code != 200:
        sys.exit(f"{username} could not log in ({response.status_code})")
    return client


def main() -> None:
    with app.app_context():
        from superset import db
        from superset.connectors.sqla.models import SqlaTable
        from superset.models.dashboard import Dashboard
        from superset.models.slice import Slice

        maker = ensure_user(MAKER)
        checker = ensure_user(CHECKER)
        both = [maker.id, checker.id]

        # Deliberately an editor of nothing: a viewer must never be offered
        # as an approver, and the whole point of the account is what it does
        # NOT see while a change is in review.
        ensure_viewer_role()
        viewer = ensure_user(VIEWER, VIEWER_BASE_ROLE)
        grant_extra_role(viewer, VIEWER_ROLE)

        # Either title: an approved run leaves the dashboard carrying the
        # proposed one, and resetting after walking the flow is exactly when
        # this is run. Looking only for the original name would fail there,
        # at the moment it is most needed.
        dashboard = (
            db.session.query(Dashboard)
            .filter(Dashboard.dashboard_title.in_([DASHBOARD_TITLE, PROPOSED_TITLE]))
            .order_by(Dashboard.id)
            .first()
        )
        if not dashboard:
            sys.exit(
                f'no dashboard called "{DASHBOARD_TITLE}" -- load the examples '
                "first (see the README)"
            )
        dashboard_id = dashboard.id

        # A chart and a dataset too, so a reviewer can be found for all three
        # asset types the gate covers and not just the dashboard.
        for model in (
            dashboard,
            db.session.query(Slice).order_by(Slice.id).first(),
            db.session.query(SqlaTable).order_by(SqlaTable.id).first(),
        ):
            if model is not None:
                grant_editorship(model, both)

        # One asset with a single editor, so an author can reach the state
        # where there is no one to send the change to and the dialog has to
        # say so. `maker` alone, because `maker` is who the walkthrough is.
        solo = (
            db.session.query(Dashboard)
            .filter_by(dashboard_title=SOLO_DASHBOARD_TITLE)
            .first()
        )
        if solo is not None:
            set_sole_editor(solo, maker.id)

        # Start from nothing pending, and from the title the examples ship.
        from asset_approval.models import ChangeRequest

        db.session.query(ChangeRequest).delete()
        dashboard.dashboard_title = DASHBOARD_TITLE
        db.session.commit()

    headers = {"Referer": "http://localhost/"}

    # One change, made and submitted as the author, so the bell, the queue and
    # the dashboard's banner all have something to show on first login.
    maker_client = login(MAKER)
    saved = maker_client.put(
        f"/api/v1/dashboard/{dashboard_id}",
        json={"dashboard_title": PROPOSED_TITLE},
        headers=headers,
    )
    if saved.status_code != 202:
        sys.exit(
            f"the gate did not capture the edit (got {saved.status_code}, "
            "expected 202) -- is CHANGE_MANAGEMENT on?"
        )

    with app.app_context():
        from superset import db
        from asset_approval.models import ChangeRequest

        change = (
            db.session.query(ChangeRequest).order_by(ChangeRequest.id.desc()).first()
        )
        if not change:
            sys.exit("the edit was captured but no change request was written")
        change_id = change.id

    submitted = maker_client.post(
        f"/api/v1/change_request/{change_id}/submit",
        json={"note": "Renamed for the Q4 pack"},
        headers=headers,
    )
    if submitted.status_code >= 400:
        sys.exit(f"could not submit for review ({submitted.status_code})")

    checker_client = login(CHECKER)
    queue = checker_client.get("/api/v1/change_request/?show=for_me").get_json()
    bell = checker_client.get("/api/v1/change_request/count").get_json()["result"]

    print()
    print("Ready.")
    print(f"  logins       {MAKER} / {CHECKER} / {VIEWER}  (password: {PASSWORD})")
    print(f"  {VIEWER:12} sees only what is live -- editor of nothing")
    print(f"  no approver  {SOLO_DASHBOARD_TITLE}: {MAKER} is its only editor")
    print(f"  waiting      {queue['count']} change(s) for {CHECKER}")
    if queue["count"]:
        print(f"  on           {queue['result'][0]['asset_title']}")
    print(f"  bell         needs_me={bell['needs_me']} returned={bell['returned']}")


if __name__ == "__main__":
    main()
