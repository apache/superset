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

from flask import current_app, jsonify

logger = logging.getLogger(__name__)

EXTENSION_ID = "preset.asset-approval"


def _create_schema() -> None:
    from sqlalchemy import inspect

    from superset import db

    from asset_approval.models import ChangeRequest, PublishedAsset

    ChangeRequest.__table__.create(bind=db.engine, checkfirst=True)

    # `published_assets` answers "has a viewer ever been able to see this",
    # which the Draft flag cannot (see PublishedAsset). On the boot that
    # creates it there is a history to recover: every dashboard published
    # right now has, by definition, been published, and recording that here
    # keeps the exemption from re-opening for all of them at once.
    first_time = not inspect(db.engine).has_table(PublishedAsset.__tablename__)
    PublishedAsset.__table__.create(bind=db.engine, checkfirst=True)
    if first_time:
        _backfill_published_dashboards()


def _backfill_published_dashboards() -> None:
    """Record every dashboard that is published at the moment of install.

    Without this, the first boot after upgrading would treat every existing
    published dashboard as never-published the moment someone unpublished
    it, which is the hole this table exists to close.

    Only dashboards published *now* can be recovered. One that was
    published and then unpublished before this ran leaves no trace to read,
    and stays exempt until it is published again.
    """
    from datetime import datetime, timezone

    from superset import db
    from superset.models.dashboard import Dashboard

    from asset_approval.models import PublishedAsset
    from asset_approval.types import AssetType

    now = datetime.now(timezone.utc)
    published = db.session.query(Dashboard.id).filter(Dashboard.published.is_(True))
    marks = [
        PublishedAsset(
            asset_type=AssetType.DASHBOARD.value, asset_id=row.id, first_seen_at=now
        )
        for row in published
    ]
    if not marks:
        return
    db.session.add_all(marks)
    db.session.commit()
    logger.info("Recorded %d dashboards as already published", len(marks))


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

    from asset_approval.gate import is_enabled

    from asset_approval.api import ChangeRequestRestApi

    appbuilder.add_api(ChangeRequestRestApi)
    _grant_page_permission_to_the_workflow()

    # Settings -> Manage -> Change review (mock S1, mock 16c). The page is
    # read-only, but an administrator still has to be able to find out
    # whether review is on, and a page reachable only by typing its URL
    # does not answer that. Hidden when the flag is off, because there is
    # nothing to report then.


def init() -> None:
    from asset_approval.bindings import install_bindings, install_review_commands
    from asset_approval.install import patched_targets

    _create_schema()
    install_review_commands()
    install_bindings()
    install_http()
    install_views()
    logger.info(
        "%s installed: %d write paths bound", EXTENSION_ID, len(patched_targets())
    )


init()
