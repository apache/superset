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
"""REST API for the review workflow.

The four list views are the ones the SOW asked for (SOW 5.6) -- awaiting my
review, my drafts, changes I submitted, recently decided -- but reached
through a ``show`` parameter rather than a new top-level menu, so the bell,
the Home tab and the Approvals page can all deep-link to the same endpoint
(Decision 7).
"""

from __future__ import annotations

import logging
from typing import Any

from flask import request
from flask_appbuilder.api import expose, protect, safe
from sqlalchemy import or_

from superset import db
from asset_approval import lifecycle
from asset_approval.eligibility import (
    can_approve,
    eligible_approvers,
    is_strict_editor,
)
from asset_approval.exceptions import (
    AuthorNoLongerEditorError,
    ApprovalForbiddenError,
    ChangeManagementException,
    ChangeRequestNotFoundError,
    InvalidTransitionError,
    NoEligibleApproverError,
    ReplayFailedError,
    ReviewedVersionStaleError,
    ReviewNoteRequiredError,
    StaleBaselineError,
)
from asset_approval.gate import (
    COMMAND_KEY,
    find_open_request,
    is_enabled,
    RESTORE_VERSION_COMMAND,
)
from asset_approval.changes import changed_fields, changed_keys, layout_summary
from asset_approval.models import ChangeRequest
from asset_approval.replay import is_restore, load_asset
from asset_approval.types import (
    AssetType,
    ChangeStatus,
    OPEN_STATUSES,
    Operation,
)
from superset.superset_typing import FlaskResponse
from superset.utils import json
from superset.utils.core import get_user_id
from superset.views.base_api import BaseSupersetApi, statsd_metrics

logger = logging.getLogger(__name__)

#: Activity older than this is not shown (Decision 8: a native 30-day
#: changelog, not an unbounded feed).
ACTIVITY_WINDOW_DAYS = 30


def _user_brief(user: Any) -> dict[str, Any] | None:
    if user is None:
        return None
    return {
        "id": user.id,
        "username": getattr(user, "username", None),
        "first_name": getattr(user, "first_name", None),
        "last_name": getattr(user, "last_name", None),
    }


def _asset_title(asset: Any) -> str | None:
    for attr in ("dashboard_title", "slice_name", "table_name"):
        if (value := getattr(asset, attr, None)) is not None:
            return value
    return None


#: Fields whose values are too large or too structural to show as a
#: before/after pair. The reviewer is told they changed and looks at the
#: result in place; dumping a position_json blob into a side panel would be
#: noise, not review.
OPAQUE_FIELDS = frozenset(
    {
        "position_json",
        "json_metadata",
        "params",
        "query_context",
        "css",
    }
)


def _same(current: Any, proposed: Any) -> bool:
    """Whether a submitted value is the one already stored.

    Compared leniently on purpose. Values round-trip through JSON and the
    ORM, so a stored ``None`` arrives as ``""`` and a structural field
    arrives as text whose key order may differ from the stored copy. Both
    are the same value to a reviewer, and treating them as different is
    what produced the noise this exists to remove.
    """
    if current is None and proposed in (None, "", [], {}):
        return True
    if isinstance(current, str) and isinstance(proposed, str):
        if current == proposed:
            return True
        try:
            return json.loads(current) == json.loads(proposed)
        except (ValueError, TypeError):
            return False
    if isinstance(proposed, list) and isinstance(current, list):
        # Relationship lists (editors, tags) arrive as ids; the stored side
        # is model objects. Compare by id where both sides offer one.
        def ids(items: Any) -> list[Any]:
            return [
                i.get("id") if isinstance(i, dict) else getattr(i, "id", i)
                for i in items
            ]

        return ids(current) == ids(proposed)
    return bool(current == proposed)


def _readable(value: Any) -> Any:
    """A value fit to show in a side panel, or None if it is not."""
    if value is None or isinstance(value, (bool, int, float)):
        return value
    if isinstance(value, str):
        return value if len(value) <= 300 else None
    return None


#: Dashboard sub-commands whose captured body is a config diff, and the
#: ``json_metadata`` entry each one rewrites.
DIFF_COMMAND_FIELDS = {
    "native_filters": "native_filter_configuration",
    "chart_customizations": "chart_customization_config",
}


def _metadata_reader(asset: Any) -> Any:
    """``field -> value`` over a dashboard's stored ``json_metadata``."""
    try:
        metadata = json.loads(getattr(asset, "json_metadata", None) or "{}")
    except (ValueError, TypeError):
        metadata = {}
    if not isinstance(metadata, dict):
        metadata = {}
    return metadata.get


def _describe_command(
    change_request: ChangeRequest, asset: Any, kind: str | None
) -> list[dict[str, Any]] | None:
    """Changes for captures whose body is not fields of the asset.

    ``None`` when the body *is* asset fields and the generic field-by-field
    comparison applies.
    """
    if kind is not None and kind in DIFF_COMMAND_FIELDS:
        # The body is a {modified, deleted, reordered} diff, not fields of
        # the asset; what it changes is one structural metadata entry.
        return [{"field": DIFF_COMMAND_FIELDS[kind], "opaque": True}]

    if kind == RESTORE_VERSION_COMMAND:
        number = change_request.command_args.get("version_number")
        target = (
            f"Version {number}"
            if number is not None
            else change_request.payload_dict.get("version_uuid")
        )
        return [{"field": "version", "before": None, "after": target}]
    if kind in ("embedded", "delete_embedded"):
        embedded = (getattr(asset, "embedded", None) or [None])[0]
        before = getattr(embedded, "allow_domain_list", None) if embedded else None
        if kind == "delete_embedded":
            return [{"field": "embedding", "before": "Enabled", "after": "Disabled"}]
        domains = change_request.payload_dict.get("allowed_domains") or []
        return [
            {
                "field": "embedding_allowed_domains",
                "before": before if embedded else "Not embedded",
                "after": ",".join(domains),
            }
        ]
    return None


def describe_changes(
    change_request: ChangeRequest, asset: Any
) -> list[dict[str, Any]]:
    """What each changed field is now, and what it would become.

    The stored payload is a field-level request body, not a snapshot, so a
    before/after pair is what the data actually supports -- and for the
    fields a person can read, it is also what answers "what am I
    approving?" better than a rendered diff would.

    A delete has no fields: the change is the asset itself.
    """
    if Operation(change_request.operation) is Operation.DELETE:
        return []

    kind = change_request.command_args.get(COMMAND_KEY)
    if (described := _describe_command(change_request, asset, kind)) is not None:
        return described

    current_of = _metadata_reader(asset) if kind == "colors" else None

    changes = []
    for field, proposed in sorted(change_request.payload_dict.items()):
        if current_of is not None:
            # Color writes set keys inside json_metadata, not columns.
            current = current_of(field)
        else:
            current = getattr(asset, field, None) if asset is not None else None

        # A dashboard save resends the whole properties payload, so most of
        # what arrives is the field's existing value coming back unchanged.
        # Listing those as changes buried a one-field edit in ten rows and
        # told the reviewer "10 changes" for a renamed title -- which is
        # worse than unhelpful, because it teaches them not to trust the
        # count. Only fields that actually differ are reported.
        if _same(current, proposed):
            continue

        if field in OPAQUE_FIELDS:
            # Still opaque as a value -- these columns are far too big to
            # show -- but say what moved inside them. "Changed" alone left
            # the reviewer nothing to decide on (129075).
            entry: dict[str, Any] = {"field": field, "opaque": True}
            if field == "position_json":
                if summary := layout_summary(current, proposed):
                    entry["layout"] = summary
            elif keys := changed_keys(current, proposed):
                entry["keys"] = keys
            changes.append(entry)
            continue
        before, after = _readable(current), _readable(proposed)
        if before is None and after is None:
            changes.append({"field": field, "opaque": True})
            continue
        changes.append({"field": field, "before": before, "after": after})
    return changes


def serialize(change_request: ChangeRequest, asset: Any = None) -> dict[str, Any]:
    """One change request, as the UI needs it."""
    return {
        "id": change_request.id,
        "asset_type": change_request.asset_type,
        "asset_id": change_request.asset_id,
        "asset_title": _asset_title(asset) if asset is not None else None,
        "status": change_request.status,
        "is_open": change_request.is_open,
        "note": change_request.note,
        "review_note": change_request.review_note,
        "author": _user_brief(change_request.author),
        "requested_approver": _user_brief(change_request.requested_approver),
        "reviewer": _user_brief(change_request.reviewer),
        "created_on": change_request.created_on.isoformat()
        if change_request.created_on
        else None,
        "changed_on": change_request.changed_on.isoformat()
        if change_request.changed_on
        else None,
        "submitted_at": change_request.submitted_at.isoformat()
        if change_request.submitted_at
        else None,
        "decided_at": change_request.decided_at.isoformat()
        if change_request.decided_at
        else None,
        # What this change actually alters about the live asset, not which
        # keys the body happens to carry. Superset re-serializes `params`
        # and `json_metadata` on every save, so the keys told a reviewer
        # that those had "Changed" when the author had renamed a chart
        # (129075). Compared against the asset as it stands now, so a
        # reviewer reading this is reading the decision in front of them.
        # The token an approver quotes back when they press Approve, so a
        # request that moved since they loaded it is refused (129070).
        "revision": lifecycle.revision_of(change_request),
        "changed_fields": changed_fields(
            _asset_for_diff(change_request), change_request.payload_dict
        ),
        # The raw request body. The UI lays it over the live asset to show
        # the dashboard as approving would leave it -- the same composition
        # the command performs, so the preview is the outcome rather than a
        # separate rendering of it. Only ever returned to people already
        # entitled to see the change (the endpoints gate on editorship).
        "proposed": change_request.payload_dict,
        "operation": change_request.operation,
        # Which command approving replays: null for the asset's main update,
        # otherwise e.g. "native_filters". ``proposed`` is that command's
        # body, so a client must not lay it over the asset unless this is
        # null.
        "command": change_request.command_args.get(COMMAND_KEY),
        "changes": describe_changes(change_request, asset),
        "dataset_detail": dataset_detail(change_request, asset)
        if asset is not None
        else None,
        # The dataset this chart is built on, when it has a change waiting
        # of its own. Approving this one first can publish a chart against
        # columns that do not exist yet (QA-09).
        "pending_dependency": pending_dependency(change_request, asset)
        if asset is not None
        else None,
    }


def _may_see(change_request: ChangeRequest, asset: Any, user_id: int | None) -> bool:
    """Whether this user may read this change request at all.

    Its author, or a strict editor of the asset -- never a viewer, and never
    an administrator on the strength of the role alone (no admin bypass in
    V1, see :mod:`asset_approval.eligibility`). Viewers see no
    workflow UI (SOW 5.5, Visa Q6), so they must not see it through the API.
    """
    if user_id is None:
        return False
    if change_request.author_fk == user_id:
        return True
    return is_strict_editor(asset, user_id)


class ChangeRequestRestApi(BaseSupersetApi):
    resource_name = "change_request"
    allow_browser_login = True
    class_permission_name = "ChangeRequest"
    openapi_spec_tag = "Change Requests"
    method_permission_name = {
        "list_requests": "read",
        "get_request": "read",
        "for_asset": "read",
        "open_for_type": "read",
        "pending_count": "read",
        "enabled": "read",
        "submit": "write",
        # The two reviewer actions carry a permission of their own, so an
        # operator can say who may approve without also deciding who may
        # submit, withdraw or discard (SOW 5.4, S-05). FAB creates
        # ``can_approve`` on ChangeRequest from this mapping; see
        # ``entrypoint._align_approval_permission`` for who holds it.
        "approve": "approve",
        "request_changes": "approve",
        # Author and editor actions. ``withdraw`` is the author's own
        # (lifecycle.withdraw), and SOW 5.3 lets any editor ``discard`` so
        # one abandoned draft cannot block an asset.
        "withdraw": "write",
        "discard": "write",
    }

    # ------------------------------------------------------------------ reads

    @expose("/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def list_requests(self) -> FlaskResponse:
        """The four SOW views, selected by ``?show=``.

        ``for_me`` is the only one that drives the notification count, so it
        is the only one that excludes the viewer's own work: a request you
        submitted is never a request that needs you (Decision 9).

        Whatever the view, a row is only returned to someone entitled to see
        that request: its author, or a strict editor of the asset (the same
        test ``get_request`` applies). ``can_read`` on ChangeRequest is a
        route permission every role may hold; it is not a licence to read
        other people's pending work on assets the reader has no say over.
        """
        if not is_enabled():
            return self.response(200, result=[], count=0)

        show = request.args.get("show", "for_me")
        user_id = get_user_id()
        query = db.session.query(ChangeRequest)

        if show == "submitted_by_me":
            query = query.filter(ChangeRequest.author_fk == user_id)
        elif show == "recently_decided":
            query = query.filter(
                ChangeRequest.status.in_(
                    [ChangeStatus.APPROVED.value, ChangeStatus.DISCARDED.value]
                ),
                or_(
                    ChangeRequest.author_fk == user_id,
                    ChangeRequest.reviewer_fk == user_id,
                ),
            ).order_by(ChangeRequest.decided_at.desc())
        elif show == "all_pending":
            query = query.filter(
                ChangeRequest.status == ChangeStatus.PENDING.value
            )
        else:  # for_me
            query = query.filter(
                ChangeRequest.status == ChangeStatus.PENDING.value,
                ChangeRequest.author_fk != user_id,
            )

        results = []
        for change_request in query.all():
            asset = load_asset(
                AssetType(change_request.asset_type), change_request.asset_id
            )
            if asset is None:
                continue
            # Never list a request on an asset this user has no say over.
            approvable = can_approve(change_request, asset, user_id)
            if show == "for_me":
                if not approvable:
                    continue
            elif not _may_see(change_request, asset, user_id):
                continue
            # Carried per row, not just used as a filter: the list writes each
            # status from the reader's point of view -- "Needs your review"
            # against "Awaiting review" -- and offers Review or Open
            # accordingly, which it cannot decide without this. It is already
            # computed for `for_me`, and `_may_see` has loaded the same asset.
            payload = serialize(change_request, asset)
            payload["can_approve"] = approvable
            payload["is_author"] = change_request.author_fk == user_id
            results.append(payload)

        return self.response(200, result=results, count=len(results))

    @expose("/<int:pk>", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def get_request(self, pk: int) -> FlaskResponse:
        """One change request, with who may act on it."""
        try:
            change_request = lifecycle.find(pk)
        except ChangeRequestNotFoundError:
            return self.response_404()

        asset = load_asset(
            AssetType(change_request.asset_type), change_request.asset_id
        )
        if asset is None:
            return self.response_404()

        user_id = get_user_id()
        if not _may_see(change_request, asset, user_id):
            # Viewers see no workflow UI at all (SOW 5.5, Visa Q6), so they
            # must not be able to read one through the API either.
            return self.response_403()

        payload = serialize(change_request, asset)
        payload["can_approve"] = can_approve(change_request, asset, user_id)
        payload["is_author"] = change_request.author_fk == user_id
        payload["eligible_approvers"] = [
            _user_brief(u)
            for u in eligible_approvers(asset, exclude_user_id=change_request.author_fk)
        ]
        return self.response(200, result=payload)

    @expose("/asset/<asset_type>/<int:asset_id>", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def for_asset(self, asset_type: str, asset_id: int) -> FlaskResponse:
        """The asset's open request, if it has one.

        What the banner on a dashboard is built from. Returns an empty
        result rather than 404 when there is nothing open, because "no
        pending change" is the normal case, not an error.
        """
        if not is_enabled():
            return self.response(200, result=None)
        try:
            kind = AssetType(asset_type)
        except ValueError:
            return self.response_400(message=f"Unknown asset type {asset_type!r}.")

        change_request = (
            db.session.query(ChangeRequest)
            .filter(
                ChangeRequest.asset_type == kind.value,
                ChangeRequest.asset_id == asset_id,
                ChangeRequest.status.in_([s.value for s in OPEN_STATUSES]),
            )
            .one_or_none()
        )
        if change_request is None:
            return self.response(200, result=None)

        asset = load_asset(kind, asset_id)
        user_id = get_user_id()
        if asset is None or not _may_see(change_request, asset, user_id):
            # A viewer gets the same answer as if nothing were pending.
            return self.response(200, result=None)

        payload = serialize(change_request, asset)
        payload["can_approve"] = can_approve(change_request, asset, user_id)
        payload["is_author"] = change_request.author_fk == user_id
        # The banner names who can approve, so the author is not left
        # guessing who to chase. Excludes the author, who never can.
        payload["eligible_approvers"] = [
            _user_brief(u)
            for u in eligible_approvers(
                asset, exclude_user_id=change_request.author_fk
            )
        ]
        return self.response(200, result=payload)

    @expose("/open/<asset_type>", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def open_for_type(self, asset_type: str) -> FlaskResponse:
        """Every open change on one asset kind, as {asset_id: status}.

        Built for list pages, which need to tag many rows at once. Asking
        the per-asset endpoint once per row would turn one list into fifty
        requests.

        Only rows this user may know about are returned: an editor of the
        asset, or its author. A viewer gets an empty map, which renders as
        no tags at all -- the same thing they would see with the feature off
        (SOW 5.5, Visa Q6).
        """
        if not is_enabled():
            return self.response(200, result={})
        try:
            kind = AssetType(asset_type)
        except ValueError:
            return self.response_400(message=f"Unknown asset type {asset_type!r}.")

        user_id = get_user_id()
        result: dict[str, str] = {}
        for change_request in (
            db.session.query(ChangeRequest)
            .filter(
                ChangeRequest.asset_type == kind.value,
                ChangeRequest.status.in_([s.value for s in OPEN_STATUSES]),
            )
            .all()
        ):
            asset = load_asset(kind, change_request.asset_id)
            if asset is None:
                continue
            if not _may_see(change_request, asset, user_id):
                continue
            result[str(change_request.asset_id)] = change_request.status
        return self.response(200, result=result)

    @expose("/enabled", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def enabled(self) -> FlaskResponse:
        """Whether review is required on this instance (SOW 5.7).

        Read by the Change review page, which describes the behaviour the
        flag turns on and so needs to say truthfully whether it is on. The
        flag is process-static, so this is a report, not a control.
        """
        return self.response(200, result={"enabled": is_enabled()})

    @expose("/count", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    def pending_count(self) -> FlaskResponse:
        """The bell's red number.

        Only what needs *this* person: reviews waiting on them, plus their
        own changes that came back. Hidden at zero, never a badge for things
        they merely participated in (Decision 9).
        """
        if not is_enabled():
            return self.response(200, result={"needs_me": 0, "returned": 0})

        user_id = get_user_id()
        needs_me = 0
        for change_request in (
            db.session.query(ChangeRequest)
            .filter(
                ChangeRequest.status == ChangeStatus.PENDING.value,
                ChangeRequest.author_fk != user_id,
            )
            .all()
        ):
            asset = load_asset(
                AssetType(change_request.asset_type), change_request.asset_id
            )
            if asset is not None and can_approve(change_request, asset, user_id):
                needs_me += 1

        returned = (
            db.session.query(ChangeRequest)
            .filter(
                ChangeRequest.status == ChangeStatus.CHANGES_REQUESTED.value,
                ChangeRequest.author_fk == user_id,
            )
            .count()
        )
        return self.response(
            200, result={"needs_me": needs_me, "returned": returned}
        )

    # ----------------------------------------------------------------- writes

    @expose("/<int:pk>/submit", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def submit(self, pk: int) -> FlaskResponse:
        # ``silent`` because every field here is optional: a client that
        # approves or submits with no body at all is making a legitimate
        # request, and Flask's strict parse would answer 400 before the
        # authorization check ever ran -- turning "you may not approve your
        # own change" into a malformed-request error.
        body = request.get_json(silent=True) or {}
        return self._act(
            lambda: lifecycle.submit(
                pk,
                note=body.get("note"),
                requested_approver_id=body.get("requested_approver_id"),
            ),
            "Review requested.",
            reload_pk=pk,
        )

    @expose("/<int:pk>/approve", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def approve(self, pk: int) -> FlaskResponse:
        body = request.get_json(silent=True) or {}
        return self._act(
            lambda: lifecycle.approve(
                pk,
                note=body.get("note"),
                # What the approver's page was showing. Sent back so a
                # change that moved underneath them is refused rather than
                # published unread (129070).
                seen_revision=body.get("seen_revision"),
            ),
            "Changes approved and published.",
            reload_pk=pk,
        )

    @expose("/<int:pk>/request_changes", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def request_changes(self, pk: int) -> FlaskResponse:
        body = request.get_json(silent=True) or {}
        return self._act(
            lambda: lifecycle.request_changes(pk, body.get("review_note", "")),
            "Changes requested.",
            reload_pk=pk,
        )

    @expose("/<int:pk>/withdraw", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def withdraw(self, pk: int) -> FlaskResponse:
        return self._act(
            lambda: lifecycle.withdraw(pk),
            "Request withdrawn. Your changes are editable again.",
            reload_pk=pk,
        )

    @expose("/<int:pk>/discard", methods=("POST",))
    @protect()
    @safe
    @statsd_metrics
    def discard(self, pk: int) -> FlaskResponse:
        return self._act(
            lambda: lifecycle.discard(pk), "Changes discarded.", reload_pk=pk
        )

    # ----------------------------------------------------------------- shared

    def _act(
        self, action: Any, message: str, reload_pk: int | None = None
    ) -> FlaskResponse:
        """Run a lifecycle action and map its refusals onto status codes.

        Every refusal the workflow can raise is answered here rather than in
        each endpoint, so the five actions cannot drift apart in how they
        report the same problem.
        """
        try:
            action()
        except ChangeRequestNotFoundError:
            return self.response_404()
        except ApprovalForbiddenError as ex:
            return self.response(403, message=str(ex))
        except (ReviewNoteRequiredError, NoEligibleApproverError) as ex:
            return self.response(422, message=str(ex))
        except (
            AuthorNoLongerEditorError,
            InvalidTransitionError,
            ReviewedVersionStaleError,
            StaleBaselineError,
        ) as ex:
            # Conflicts rather than bad requests: the call was fine, either
            # the request or the asset under it had already moved on.
            return self.response(409, message=str(ex))
        except ReplayFailedError as ex:
            return self.response(ex.status, message=str(ex))
        except ChangeManagementException as ex:
            logger.exception("Change request action failed")
            return self.response(500, message=str(ex))

        pk = reload_pk
        try:
            change_request = lifecycle.find(pk) if pk else None
        except ChangeRequestNotFoundError:
            change_request = None
        result = (
            serialize(
                change_request,
                load_asset(
                    AssetType(change_request.asset_type), change_request.asset_id
                ),
            )
            if change_request
            else None
        )
        return self.response(200, message=message, result=result)


#: Column and metric fields worth comparing. The rest are bookkeeping that
#: a reviewer deciding about a dataset definition does not need.
COLUMN_FIELDS = ("type", "expression", "description", "is_dttm", "filterable", "groupby")
METRIC_FIELDS = ("expression", "metric_type", "description", "d3format", "verbose_name")


def _by_key(items: Any, key: str) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for item in items or []:
        if isinstance(item, dict):
            name = item.get(key)
        else:
            name = getattr(item, key, None)
        if name:
            out[str(name)] = item
    return out


def _asset_for_diff(change_request: Any) -> Any:
    """The live asset a change is measured against, or None if unreadable."""
    try:
        return load_asset(
            AssetType(change_request.asset_type),
            change_request.asset_id,
            include_deleted=is_restore(change_request),
        )
    except Exception:  # noqa: BLE001 -- a diff must never break the listing
        logger.warning(
            "asset-approval: could not load %s %s to diff against",
            change_request.asset_type,
            change_request.asset_id,
            exc_info=True,
        )
        return None


def _field_of(item: Any, field: str) -> Any:
    return item.get(field) if isinstance(item, dict) else getattr(item, field, None)


def _diff_named(
    current: Any, proposed: Any, key: str, fields: tuple[str, ...]
) -> dict[str, list[dict[str, Any]]]:
    """Added / changed / removed, by name.

    Named rather than positional because that is how a person reads a
    dataset: they care that `revenue` changed, not that row 7 did.
    """
    before, after = _by_key(current, key), _by_key(proposed, key)
    added = [{"name": n} for n in sorted(set(after) - set(before))]
    removed = [{"name": n} for n in sorted(set(before) - set(after))]
    changed = []
    for name in sorted(set(before) & set(after)):
        deltas = [
            {
                "field": f,
                "before": _field_of(before[name], f),
                "after": _field_of(after[name], f),
            }
            for f in fields
            if _field_of(before[name], f) != _field_of(after[name], f)
        ]
        if deltas:
            changed.append({"name": name, "fields": deltas})
    return {"added": added, "changed": changed, "removed": removed}


def dataset_impact(asset: Any) -> dict[str, int]:
    """How far a dataset change reaches.

    dbt Cloud shows downstream impact on a model change and Matt's
    prototype called it "Potential impact"; the SOW asks for the same here.
    Approving a dataset edit is approving it for every chart built on it,
    and the reviewer should be told how many that is before they do.
    """
    from superset.models.slice import Slice  # pylint: disable=import-outside-toplevel

    charts = (
        db.session.query(Slice)
        .filter(
            Slice.datasource_id == asset.id,
            Slice.datasource_type == "table",
        )
        .all()
    )
    dashboard_ids = {d.id for chart in charts for d in (chart.dashboards or [])}
    return {"charts": len(charts), "dashboards": len(dashboard_ids)}


def pending_dependency(
    change_request: ChangeRequest, asset: Any
) -> dict[str, Any] | None:
    """The chart's dataset, when it has a change of its own still open.

    Approving replays the author's body over whatever is live, so a chart
    approved before the dataset change it was written against publishes a
    chart referencing columns or metrics that do not exist yet. Viewers get
    a broken chart and nothing warned the approver (QA-09).

    A warning, not a refusal. The one-open-change-per-asset rule means two
    editors can hold the chart and the dataset separately, so enforcing an
    order would deadlock the pair; and SOW 5.3 scopes that rule to a single
    asset, so a cross-asset ordering is a wider change than this is. The
    approver is told and decides.

    ``None`` when there is nothing to say, which is the common case.
    """
    if AssetType(change_request.asset_type) is not AssetType.CHART:
        return None
    if asset is None:
        return None
    # Charts can also sit on a semantic view, which has no change requests
    # of its own; ``dataset_impact`` guards the same way.
    if getattr(asset, "datasource_type", None) != "table":
        return None
    datasource_id = getattr(asset, "datasource_id", None)
    if datasource_id is None:
        return None

    open_request = find_open_request(AssetType.DATASET, datasource_id)
    if open_request is None:
        return None
    return {
        "asset_type": AssetType.DATASET.value,
        "asset_id": datasource_id,
        "change_request_id": open_request.id,
        "status": open_request.status,
        "author": _user_brief(open_request.author),
        "title": _asset_title(getattr(asset, "datasource", None)),
    }


def dataset_detail(
    change_request: ChangeRequest, asset: Any
) -> dict[str, Any] | None:
    """A dataset reviewed as a definition, not as rendered charts.

    Visa Q11: datasets are reviewed as a diff of columns, metrics and SQL,
    and charts are deliberately not re-rendered against the draft. A dataset
    change is a change to a contract, and the contract is what to look at.
    """
    if AssetType(change_request.asset_type) is not AssetType.DATASET:
        return None
    if Operation(change_request.operation) is Operation.DELETE:
        return {"impact": dataset_impact(asset)}

    body = change_request.payload_dict
    detail: dict[str, Any] = {"impact": dataset_impact(asset)}

    if "sql" in body:
        detail["sql"] = {
            "before": getattr(asset, "sql", None),
            "after": body.get("sql"),
        }
    if "columns" in body:
        detail["columns"] = _diff_named(
            getattr(asset, "columns", []), body["columns"], "column_name", COLUMN_FIELDS
        )
    if "metrics" in body:
        detail["metrics"] = _diff_named(
            getattr(asset, "metrics", []), body["metrics"], "metric_name", METRIC_FIELDS
        )
    return detail
