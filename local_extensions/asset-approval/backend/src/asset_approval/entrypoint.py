"""Extension entrypoint. Importing this module installs the feature.

The host imports it once during ``init_extensions``, inside the application
context, which is the only reach an extension gets today -- and, as it
turns out, enough for the whole backend.

Four steps:

1. The ``change_requests`` table, created if absent. The extension owns its
   schema; it has no migration chain of its own, so a column added later is
   handled here rather than by an Alembic revision.
2. ``review_command`` on the classes replay reads it back from.
3. The write-path bindings, declared in ``bindings.WRITE_PATHS`` and
   verified at install so the count cannot drift from what is bound.
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



def _anonymous_role_name() -> str:
    """The role every signed-out visitor carries."""
    return str(current_app.config.get("AUTH_ROLE_PUBLIC") or "Public")


def belongs_to_the_workflow(role: Any) -> bool:
    """Whether this role stands for people, rather than for nobody.

    Everything below hands rights to "whoever already holds X". That reads
    the permission tables, and ``PUBLIC_ROLE_LIKE`` -- a documented way to
    let signed-out visitors see dashboards -- copies a whole role onto the
    anonymous one. On such an instance the anonymous role held ``can_write``
    on ChangeRequest, so it was seeded the approval right and handed the
    Approvals page along with it.

    Nothing could be approved with it: the route still needs a user id, a
    strict editorship and an author who is somebody else, and
    ``can_approve`` refuses a guest outright. But an approval permission
    sitting on the anonymous role is the wrong answer to give a control
    review, and a review queue is not a page to offer someone who has not
    signed in.
    """
    return getattr(role, "name", None) != _anonymous_role_name()





#: The roles the host's own ``sync_role_definitions`` puts the review API's
#: permissions on, beside the administrator. The anonymous role is
#: deliberately absent: see ``belongs_to_the_workflow``.
WORKFLOW_ROLES = ("Alpha", "Gamma")


def _workflow_role_names() -> tuple[str, ...]:
    """The roles to seed, with the administrator under its configured name.

    ``AUTH_ROLE_ADMIN`` renames the administrator, and the host reads it
    rather than assuming "Admin". Hardcoding the name here skipped the grant
    on such an instance without saying so.
    """
    admin = str(current_app.config.get("AUTH_ROLE_ADMIN") or "Admin")
    return (admin, *WORKFLOW_ROLES)


def _api_permissions() -> list[str]:
    """The permissions the review API is actually protected by.

    Derived from the route mapping rather than listed again, so adding a
    route under a new permission name cannot leave that permission
    uncreated.
    """
    from asset_approval.api import ChangeRequestRestApi

    return sorted(
        {
            f"can_{name}"
            for name in ChangeRequestRestApi.method_permission_name.values()
        }
    )


def _ensure_the_api_permissions_exist() -> None:
    """Create the review API's permissions, and seed the roles that hold them.

    Superset builds its AppBuilder with ``update_perms=False``, so
    registering an API does not create the permissions that protect it.
    ``superset init`` creates them, and nothing else does. Install the
    extension after init has already run and no such permission exists, so
    every route under ``@protect()`` answers 403.

    That failure is silent in the worst way. The gate consults the feature
    flag and not any permission, so the write is still captured: the row
    lands in ``change_requests`` and the author is told their change was
    saved for review. Every read then 403s, and the frontend turns a failed
    read into "no open change", so there is no banner and no Request
    review. Submit, approve and discard are 403 as well, so nobody can move
    the edit forward, while another editor is correctly refused because the
    asset is locked. The edit is stranded rather than lost, and rerunning
    ``superset init`` releases it (sc-131031).

    The host already solves this shape for an extension's *pages*:
    ``ensure_page_permissions`` exists precisely because an extension can be
    installed long after init. Its API permissions were never given the same
    treatment, and this is that.

    ``add_permission_view_menu`` rather than ``add_permissions_view``: the
    latter treats the list it is given as the complete set and deletes any
    permission on the view menu that is missing from it, which would drop a
    permission an operator or a later version had added.

    Seeding a role happens only while nobody holds the permission. Once any
    role does, the arrangement is the operator's: narrowing it to one role,
    or moving it to a role of their own, survives every restart.

    The one case it cannot read is a revocation from *every* role, which is
    indistinguishable from never having been created, so the next boot seeds
    it again. An operator who means to switch the review API off has
    ``CHANGE_MANAGEMENT`` and ``EXTENSIONS_SYNC_PAGE_PERMISSIONS`` for that,
    and both are honoured above.

    ``EXTENSIONS_SYNC_PAGE_PERMISSIONS`` turns the whole thing off, because
    that is the switch an operator uses to say an extension may not write
    permissions at boot -- they provision them out of band, or the metadata
    database is not writable then. The host's page helper checks it, and an
    earlier version of this function did not, so setting it bought the
    pages' silence and not the API's.
    """
    from superset import db
    from superset.extensions import security_manager

    if not current_app.config.get("EXTENSIONS_SYNC_PAGE_PERMISSIONS", True):
        logger.info(
            "%s: EXTENSIONS_SYNC_PAGE_PERMISSIONS is off, so the review "
            "API's permissions are left to the operator",
            EXTENSION_ID,
        )
        return

    for name in _api_permissions():
        try:
            security_manager.add_permission_view_menu(name, WORKFLOW_PERMISSION[1])
            pvm = security_manager.find_permission_view_menu(
                name, WORKFLOW_PERMISSION[1]
            )
            if pvm is None:
                continue
            if any(belongs_to_the_workflow(role) for role in pvm.role):
                continue
            for role_name in _workflow_role_names():
                role = security_manager.find_role(role_name)
                if role is None or pvm in role.permissions:
                    continue
                security_manager.add_permission_role(role, pvm)
                # Checked rather than assumed: ``add_permission_role``
                # swallows its own failures and rolls back, so logging
                # "granted" on the strength of having called it reported a
                # grant that a lost race or a failed commit had undone --
                # and this log is how an operator confirms the seeding ran.
                if pvm in role.permissions:
                    logger.info(
                        "%s: granted %r on %s to %r",
                        EXTENSION_ID,
                        name,
                        WORKFLOW_PERMISSION[1],
                        role_name,
                    )
                else:
                    logger.warning(
                        "%s: could not grant %r on %s to %r; another worker "
                        "may hold it, or the write was rolled back",
                        EXTENSION_ID,
                        name,
                        WORKFLOW_PERMISSION[1],
                        role_name,
                    )
        except Exception:  # pylint: disable=broad-except
            # A read-only or unmigrated metadata database must not stop the
            # extension loading. Review is then unreachable until
            # ``superset init`` runs, which is the behaviour this replaces
            # rather than a regression.
            #
            # Rolled back first: a failed statement leaves the session
            # unusable, and everything after this would then fail for a
            # reason that has nothing to do with its own work.
            try:
                db.session.rollback()
            except Exception:  # pylint: disable=broad-except
                # Nothing left to do about it, and the warning below is the
                # message that matters to an operator.
                logger.debug(
                    "%s: rollback after a failed permission write also failed",
                    EXTENSION_ID,
                    exc_info=True,
                )
            logger.warning(
                "%s: could not ensure %r on %s; review stays unreachable "
                "until `superset init` runs",
                EXTENSION_ID,
                name,
                WORKFLOW_PERMISSION[1],
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
            if not belongs_to_the_workflow(role):
                continue
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


def _take_the_workflow_off_the_anonymous_role() -> None:
    """Revoke what an earlier boot handed the anonymous role.

    The seed runs only while nobody holds the approval right, so an instance
    that was already seeded keeps the grant on its anonymous role however
    many times it restarts. Skipping it from now on fixes new installs and
    leaves existing ones exactly as they were, which is the half-fix this
    epic has been bitten by twice.

    Only the permissions this extension owns. ``can_write`` on ChangeRequest
    reaches the anonymous role through ``PUBLIC_ROLE_LIKE`` and ``superset
    init``, and taking it off here would be a tug of war with the host on
    every boot.

    ``can_approve`` is in the list because an instance that ran the
    short-lived build where approving was a role-level right may still carry
    the row. Approving is editorship now, so nothing reads it; leaving a
    dead approval permission sitting on the anonymous role is exactly the
    sort of thing a control review asks about.
    """
    from superset.constants import EXTENSION_VIEW_MENU_PREFIX
    from superset.extensions import security_manager

    try:
        anonymous = security_manager.find_role(_anonymous_role_name())
        if anonymous is None:
            return
        ours = [
            security_manager.find_permission_view_menu(
                "can_approve", "ChangeRequest"
            ),
            security_manager.find_permission_view_menu(
                PAGE_PERMISSION, f"{EXTENSION_VIEW_MENU_PREFIX}{EXTENSION_ID}"
            ),
        ]
        for pvm in ours:
            if pvm is not None and pvm in anonymous.permissions:
                security_manager.del_permission_role(anonymous, pvm)
                logger.info(
                    "%s: took %r off %r -- a signed-out visitor is not part "
                    "of the review workflow",
                    EXTENSION_ID,
                    pvm.permission.name,
                    anonymous.name,
                )
    except Exception:  # pylint: disable=broad-except
        logger.warning(
            "%s: could not clear the review permissions off the anonymous "
            "role; revoke them by hand",
            EXTENSION_ID,
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
    # Before the page grant: that reads ``can_read`` on ChangeRequest to work
    # out who belongs in the workflow, so without this it finds nothing and
    # the Approvals page silently stays Admin-only too (sc-131031).
    _ensure_the_api_permissions_exist()
    _grant_page_permission_to_the_workflow()
    _take_the_workflow_off_the_anonymous_role()

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


def _log_effective_configuration() -> None:
    """Report what the three settings this extension reads resolved to.

    None of them is declared in ``superset/config.py`` -- two are the
    extension's own and core should not know about them -- and all three are
    read with ``.get``. So an operator who writes
    ``ASSET_APPROVAL_APPROVER_ROLE`` for the plural, or puts the key in the
    wrong file, gets the default and is told nothing at any point. On a
    bank's install that is believing you have excluded your service accounts
    when you have not. The boot log is the only place that can say
    otherwise, so it says it plainly: the effective value, and whether it
    was set or defaulted.

    "set" means what the reader means by it. For the role list that is
    ``is not None``, because ``None`` is how it spells "unset"; for the flag
    it is the key being present in ``FEATURE_FLAGS``, since the extension's
    flag has no entry in ``DEFAULT_FEATURE_FLAGS`` and absent therefore
    reads as off.
    """
    from asset_approval.eligibility import MACHINE_USER_ROLES_CONFIG, machine_user_roles
    from asset_approval.gate import FEATURE_FLAG, is_enabled

    config = current_app.config

    def named(key: str) -> str:
        return f"{EXTENSION_ID} config: {key} ="

    flags = config.get("FEATURE_FLAGS") or {}
    logger.info(
        "%s %s (%s)",
        named(f"FEATURE_FLAGS[{FEATURE_FLAG!r}]"),
        is_enabled(),
        "set" if FEATURE_FLAG in flags else "defaulted, so review is off",
    )

    logger.info(
        "%s %s (%s)",
        named(MACHINE_USER_ROLES_CONFIG),
        sorted(machine_user_roles()),
        "set"
        if config.get(MACHINE_USER_ROLES_CONFIG) is not None
        else "defaulted, so no role is treated as service accounts",
    )

    # The mistyped key this log exists for. A near miss is silently a default
    # everywhere else, and naming it is the difference between an operator
    # finding their typo at boot and finding it in an audit.
    unknown = sorted(
        key
        for key in config
        if key.startswith("ASSET_APPROVAL_")
        and key != MACHINE_USER_ROLES_CONFIG
    )
    if unknown:
        logger.warning(
            "%s: %s is not read by this extension; the only setting it reads "
            "is %s. Check the spelling",
            EXTENSION_ID,
            ", ".join(unknown),
            MACHINE_USER_ROLES_CONFIG,
        )


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
    # After install_views, because the alignment it runs is what the
    # approver-roles line describes the outcome of. Guarded like everything
    # else here: a setting given a shape the readers cannot take (a bare
    # number for a role list) must not turn reporting it into an outage.
    try:
        _log_effective_configuration()
    except Exception:  # pylint: disable=broad-except
        logger.warning(
            "%s: could not report the effective configuration",
            EXTENSION_ID,
            exc_info=True,
        )


init()
