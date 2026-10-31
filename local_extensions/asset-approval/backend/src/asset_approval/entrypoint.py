"""Extension entrypoint. Importing this module installs the feature.

The host imports it once during ``init_extensions``, inside the application
context, which is the only reach an extension gets today -- and, as it
turns out, enough for the whole backend.

Four steps:

1. The ``change_requests`` table, created if absent. The extension owns its
   schema; it has no migration chain of its own, so a column added later is
   handled here rather than by an Alembic revision.
2. ``review_command`` on the classes replay reads it back from.
3. The eighteen write-path bindings (see ``bindings``).
4. The REST API, the Approvals pages, and the HTTP translation of the
   gate's signals.

What is NOT here, and cannot be until the framework offers view locations
outside SQL Lab: the banner, the review panel, the Show changes switch, the
bell, the list tags and the Home section. Those remain host code and are
the entire remaining ask.
"""

import logging
from typing import Any

from flask import current_app, jsonify

logger = logging.getLogger(__name__)

EXTENSION_ID = "preset.asset-approval"


def _create_schema() -> None:
    from superset import db

    from asset_approval.models import ChangeRequest, PublishedAsset

    ChangeRequest.__table__.create(bind=db.engine, checkfirst=True)

    # `published_assets` answers "has a viewer ever been able to see this",
    # which the Draft flag cannot (see PublishedAsset).
    PublishedAsset.__table__.create(bind=db.engine, checkfirst=True)
    try:
        _backfill_published_dashboards()
    except Exception:  # noqa: BLE001
        # install_bindings has core refuse every governed write until a gate
        # registers, so an exception escaping init() is an authoring outage
        # rather than a weaker exemption. Degrade, do not fail.
        logger.warning(
            "Could not record already-published dashboards", exc_info=True
        )


def _backfill_published_dashboards() -> None:
    """Record the dashboards this instance can still prove were published.

    Runs on every boot, not only the one that creates the table. A publish
    that happened out of band -- an import, a script, a direct write --
    leaves no gated write behind to record it, so the exemption would
    re-open for that dashboard the moment someone unpublished it. A sweep
    at boot closes that by itself instead of waiting for a release.

    Two sources, because the live flag only answers for dashboards that are
    published *now*. The versioned shadow table also holds the ones
    published and later unpublished, for as long as the host keeps them,
    which is the only way a dashboard unpublished before this extension was
    installed can be recovered at all. Outside that window there is no
    evidence anywhere, and it stays exempt until it is published again.

    Idempotent: it inserts the difference, so two workers booting together
    race only on the unique constraint.
    """
    from datetime import datetime, timezone

    from sqlalchemy import insert, select
    from sqlalchemy.exc import IntegrityError

    from superset import db
    from superset.models.dashboard import Dashboard

    from asset_approval.models import PublishedAsset
    from asset_approval.types import AssetType

    marks = PublishedAsset.__table__
    dashboards = Dashboard.__table__
    with db.engine.connect() as connection:
        known = {
            row.asset_id
            for row in connection.execute(
                select(marks.c.asset_id).where(
                    marks.c.asset_type == AssetType.DASHBOARD.value
                )
            )
        }
        candidates = {
            row.id
            for row in connection.execute(
                select(dashboards.c.id).where(dashboards.c.published.is_(True))
            )
        }
        candidates |= _published_in_version_history(connection)

    missing = sorted(candidates - known)
    if not missing:
        return

    now = datetime.now(timezone.utc)
    try:
        with db.engine.begin() as connection:
            connection.execute(
                insert(marks),
                [
                    {
                        "asset_type": AssetType.DASHBOARD.value,
                        "asset_id": asset_id,
                        "first_seen_at": now,
                    }
                    for asset_id in missing
                ],
            )
    except IntegrityError:
        # Another worker booted alongside this one and got there first.
        logger.debug("Publish marks already written by another worker")
        return
    logger.info("Recorded %d dashboards as already published", len(missing))


def _published_in_version_history(connection: Any) -> set[int]:
    """Dashboard ids the version history still remembers as published.

    Best effort, deliberately: versioning can be switched off, its tables
    can be absent, and it prunes on a retention window. A miss costs one
    dashboard staying exempt until it is next published, so a failure here
    is logged and swallowed rather than allowed to stop the install.
    """
    try:
        from sqlalchemy import select
        from sqlalchemy_continuum import version_class

        from superset.models.dashboard import Dashboard

        shadow = version_class(Dashboard).__table__
        return {
            row.id
            for row in connection.execute(
                select(shadow.c.id).where(shadow.c.published.is_(True)).distinct()
            )
        }
    except Exception:  # noqa: BLE001
        logger.warning(
            "Could not read dashboard version history for publish marks; "
            "a dashboard unpublished before install may stay exempt",
            exc_info=True,
        )
        return set()


def install_http() -> None:
    """Translate the gate's signals into responses, app-wide.

    Public because the extension's own tests have to call it: the test app
    is built by Superset's conftest, not by ``init_extensions``, so nothing
    else would install these.

    Two mechanisms, because one is not enough. An error handler per signal
    covers every write path at once -- including any the host adds later --
    wherever the signal reaches Flask. On most of the asset APIs it does
    not: Flask-AppBuilder's ``safe`` decorator wraps them, catches
    ``Exception`` and answers "Fatal error" with a 500, so the handler is
    never consulted and the author is told their save failed after the
    change request was committed. The second mechanism takes over the one
    call ``safe`` makes to decide that -- ``response_500`` -- and answers
    from the exception still being handled. Both read the body and status
    from one builder.
    """
    import sys

    from flask_appbuilder.api import BaseApi

    from asset_approval.exceptions import (
        AssetLockedError,
        ChangeManagementException,
        ChangeRequestCreated,
        ImportOverwriteRefusedError,
        UnattributableWriteRefusedError,
        UnreviewableWriteRefusedError,
    )
    from asset_approval.http import signal_response

    app = current_app._get_current_object()  # pylint: disable=protected-access
    if getattr(app, "_asset_approval_http", False):
        return
    app._asset_approval_http = True  # pylint: disable=protected-access

    def answer(ex: ChangeManagementException):  # type: ignore[no-untyped-def]
        body, status = signal_response(ex)
        return jsonify(body), status

    for signal in (
        ChangeRequestCreated,
        AssetLockedError,
        UnattributableWriteRefusedError,
        UnreviewableWriteRefusedError,
        ImportOverwriteRefusedError,
    ):
        app.register_error_handler(signal, answer)

    if not getattr(BaseApi.response_500, "__asset_approval__", False):
        original_response_500 = BaseApi.response_500

        def response_500(self, message=None):  # type: ignore[no-untyped-def]
            # Still inside ``safe``'s except block, so the exception it
            # decided to call this for is the live one.
            ex = sys.exc_info()[1]
            if isinstance(ex, ChangeManagementException):
                body, status = signal_response(ex)
                return self.response(status, **body)
            return original_response_500(self, message=message)

        response_500.__asset_approval__ = True  # type: ignore[attr-defined]
        BaseApi.response_500 = response_500  # type: ignore[assignment]




# The helper that lived here created the `menu_access` permission for the
# Settings entry and granted it to Admin: `add_view` built the entry but not
# the permission that lets anyone see it. A contributed page declares its
# navigation entry in the manifest and the host handles both.


#: The permission the Approvals page declares in extension.json.
PAGE_PERMISSION = "can_review"

#: The permission that has always decided who belongs in the workflow.
WORKFLOW_PERMISSION = ("can_read", "ChangeRequest")

#: Config key naming the roles whose members may approve a change. Absent, or
#: ``None``, leaves whatever ``superset init``'s own role sync produced, which
#: is the behaviour the instance already had.
APPROVER_ROLES_CONFIG = "ASSET_APPROVAL_APPROVER_ROLES"

#: The roles ``sync_role_definitions`` rebuilds on every ``superset init``.
#: Only these have the approval right taken back off them when it is not in
#: the configured list: a role an operator created is theirs, and nothing
#: here should revoke a grant they made deliberately.
BUILTIN_ROLES = frozenset({"Admin", "Alpha", "Gamma", "sql_lab", "Public"})


def _align_approval_permission() -> None:
    """Make the approval right match the operator's written decision.

    FAB creates ``can_approve`` on ChangeRequest from the route mapping, and
    ``superset init``'s role sync then hands it to Admin, Alpha and Gamma --
    the denylist's default, and exactly the set that already held
    ``can_write``. So on an instance that configures nothing, who can approve
    does not change: this only makes the right nameable, where before it was
    folded into ``can_write`` along with submit, withdraw and discard (S-05).

    ``ASSET_APPROVAL_APPROVER_ROLES`` is how an instance says otherwise. Given
    a list of role names, the permission is granted to those roles and taken
    back off the builtin roles that are not in it. Re-run on every boot
    because that is also the only way a deliberate revoke survives: the next
    ``superset init`` rebuilds the builtin roles from the denylist and would
    otherwise hand the right straight back.

    Holding the permission is necessary and not sufficient. An approver still
    has to be a strict editor of the asset and not its author
    (:mod:`asset_approval.eligibility`), and there is still no administrator
    bypass in V1 (Visa Q1, SOW 9.3).
    """
    from superset.extensions import security_manager

    from asset_approval.eligibility import APPROVAL_PERMISSION

    configured = current_app.config.get(APPROVER_ROLES_CONFIG)
    if configured is None:
        return

    try:
        pvm = security_manager.find_permission_view_menu(*APPROVAL_PERMISSION)
        if pvm is None:
            logger.warning(
                "%s: %s on %s does not exist yet, so %s cannot be applied; "
                "run `superset init`",
                EXTENSION_ID,
                *APPROVAL_PERMISSION,
                APPROVER_ROLES_CONFIG,
            )
            return
        wanted = {str(name).strip() for name in configured if str(name).strip()}
        for role in security_manager.get_all_roles():
            holds = pvm in role.permissions
            if role.name in wanted and not holds:
                security_manager.add_permission_role(role, pvm)
                logger.info(
                    "%s: granted the approval right to %r", EXTENSION_ID, role.name
                )
            elif role.name not in wanted and holds and role.name in BUILTIN_ROLES:
                security_manager.del_permission_role(role, pvm)
                logger.info(
                    "%s: took the approval right off %r", EXTENSION_ID, role.name
                )
    except Exception:  # pylint: disable=broad-except
        # Same reasoning as the page grant below: a read-only or unmigrated
        # metadata database must not stop the extension loading. The right
        # stays as the last successful sync left it, which is a documented
        # state rather than an outage.
        logger.warning(
            "%s: could not apply %s; who may approve is unchanged",
            EXTENSION_ID,
            APPROVER_ROLES_CONFIG,
            exc_info=True,
        )


def _grant_page_permission_to_the_workflow() -> None:
    """Give the Approvals page to whoever may already read change requests.

    The page used to be a view of this extension's own, permissioned as a
    ChangeRequest read -- so every role in the workflow could open it, which
    is Admin, Alpha and Gamma on a stock install.

    As a contributed page it has a permission of its own, and the host grants
    that to Admin and no one else: the host cannot know who an extension
    means its page for. Left alone the move would quietly narrow the page
    from everyone in the workflow to administrators, and an approver would
    get 403 on the list of things waiting for them.

    So the extension says what the host cannot: whoever may read a change
    request may open the page that lists them. Roles are read live rather
    than hardcoded, so an operator who grants the read to a role of their own
    gets the page with it.
    """
    from superset.constants import EXTENSION_VIEW_MENU_PREFIX
    from superset.extensions import security_manager

    try:
        workflow = security_manager.find_permission_view_menu(*WORKFLOW_PERMISSION)
        page = security_manager.find_permission_view_menu(
            PAGE_PERMISSION, f"{EXTENSION_VIEW_MENU_PREFIX}{EXTENSION_ID}"
        )
        if workflow is None or page is None:
            return
        for role in list(workflow.role):
            if page not in role.permissions:
                security_manager.add_permission_role(role, page)
                logger.info(
                    "%s: granted %r on the Approvals page to %r",
                    EXTENSION_ID,
                    PAGE_PERMISSION,
                    role.name,
                )
    except Exception:  # pylint: disable=broad-except
        # A read-only metadata database, or one not yet migrated, must not
        # stop the rest of the extension loading. The page stays reachable
        # for Admin and an operator can grant the rest by hand.
        logger.warning(
            "%s: could not align the Approvals page permission with %r; "
            "approvers may get 403 until it is granted",
            EXTENSION_ID,
            WORKFLOW_PERMISSION,
            exc_info=True,
        )


def install_views() -> None:
    """Register the review API and the approvals pages.

    Public for the same reason as ``install_http``: a test app is built
    without ``init_extensions``, and Superset's own app fixture clears
    ``appbuilder.baseviews``, so these have to be added again per app.
    """
    from flask_babel import lazy_gettext as __

    from superset.extensions import appbuilder

    from asset_approval.api import ChangeRequestRestApi

    appbuilder.add_api(ChangeRequestRestApi)
    _grant_page_permission_to_the_workflow()
    # After add_api, which is what creates ``can_approve`` in the first place.
    _align_approval_permission()

    # Settings -> Manage -> Change review (mock S1, mock 16c). The page is
    # read-only, but an administrator still has to be able to find out
    # whether review is on, and a page reachable only by typing its URL
    # does not answer that.
    #
    # Both contributed pages declare ``featureFlag`` and ``permission`` in
    # extension.json rather than being registered from here: the host hides
    # a page whose flag is off and refuses one the user has no permission
    # for, so there is nothing left for this function to do about either
    # (QA-23).


def init() -> None:
    from asset_approval.bindings import install_bindings, install_review_commands
    from asset_approval.install import patched_targets, rebind_registered_routes

    _create_schema()
    install_review_commands()
    install_bindings()
    # Views are built before extensions load, so a route that is a gated
    # method is already holding the ungated one. Patching the class does not
    # reach it; this does (S-01).
    rebound = rebind_registered_routes(current_app._get_current_object())  # pylint: disable=protected-access  # noqa: E501
    install_http()
    install_views()
    logger.info(
        "%s installed: %d write paths bound, %d route(s) rebound",
        EXTENSION_ID,
        len(patched_targets()),
        len(rebound),
    )


init()
