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
"""Applying an approved change by replaying it.

The approval does not write the asset itself. It re-invokes the very command
the author originally called, with the body they submitted and the arguments
that command takes outside the body. Whatever Superset does on an update --
tag diffing, native filter reconciliation, metadata merging, versioning
capture -- happens exactly as it would have, because it *is* that code path
running.

This is what keeps the feature correct across upgrades. A design that stored
a finished copy of the asset and installed it would have to track every
change to every update command forever; this one tracks none of them.
"""

from __future__ import annotations

import inspect
import logging
from typing import Any

from flask_appbuilder.models.sqla import Model

from asset_approval.exceptions import (
    ChangeManagementException,
    ChangeRequestNotFoundError,
    ReplayFailedError,
)
from asset_approval.gate import (
    captured_arguments,
    captured_exempt_fields,
    COMMAND_KEY,
    ctor_signature,
    replaying,
    RESTORE_COMMAND,
    RESTORE_VERSION_COMMAND,
    UPSERT_EMBEDDED_COMMAND,
)
from asset_approval.changes import EXEMPT_FIELDS
from superset.utils.core import override_user
from asset_approval.models import ChangeRequest
from asset_approval.types import AssetType, Operation

logger = logging.getLogger(__name__)


def is_restore(change_request: ChangeRequest) -> bool:
    """Whether the request asks for a soft-deleted asset to come back.

    Not an :class:`Operation` of its own: a restore is captured as an
    ordinary update carrying the command to replay, so the operation
    column cannot answer this.
    """
    return change_request.command_args.get(COMMAND_KEY) == RESTORE_COMMAND


def load_asset(
    asset_type: AssetType, asset_id: int, include_deleted: bool = False
) -> Any | None:
    """The live asset a change request targets.

    ``include_deleted`` is for a restore, where the asset being
    soft-deleted is the request's whole premise. The ordinary lookup
    hides soft-deleted rows, so every lifecycle call against such a
    request answered 404 -- it could not be submitted, approved,
    withdrawn or even discarded, leaving a row nobody could act on or
    clear away (R3-01).

    The two bypasses are the ones ``BaseRestoreCommand`` uses to find the
    row it restores, and for its reasons:
    ``skip_visibility_filter`` is what makes a soft-deleted row visible
    at all, and ``skip_base_filter`` keeps an editor's own trash
    reachable when the entity's RBAC filter has no editorship leg. Who
    may act is decided separately -- ``is_strict_editor`` and
    ``can_approve`` -- so widening the lookup widens nothing else.
    """
    # pylint: disable=import-outside-toplevel
    deleted_too: dict[str, Any] = (
        {"skip_base_filter": True, "skip_visibility_filter": True}
        if include_deleted
        else {}
    )
    if asset_type == AssetType.DASHBOARD:
        from superset.daos.dashboard import DashboardDAO

        return DashboardDAO.find_by_id(asset_id, **deleted_too)
    if asset_type == AssetType.CHART:
        from superset.daos.chart import ChartDAO

        return ChartDAO.find_by_id(asset_id, **deleted_too)
    from superset.daos.dataset import DatasetDAO

    return DatasetDAO.find_by_id(asset_id, **deleted_too)


#: Captured arguments that are not constructor keywords of the command but
#: things the same write does around it, and what does them. The legacy chart
#: save is one request that updates the chart *and* attaches it to a dashboard;
#: the second half has no command, so it is replayed here (B7).
AROUND_THE_COMMAND = ("save_to_dashboard_id", "new_dashboard_name")


def _refuse_unreplayed_arguments(args: dict[str, Any], what: str) -> None:
    """Refuse to approve a capture whose arguments nothing here can hand back.

    The alternative is the defect this exists to end: approving "Changes
    approved and published" over a write that quietly did less than the
    reviewer was shown. Refusing leaves the request pending and says why.
    """
    if captured_arguments(args):
        raise ChangeManagementException(
            f"This {what} was captured with arguments "
            f"({', '.join(sorted(captured_arguments(args)))}) that approval "
            "cannot hand back to it, so it was not applied. Nothing was changed."
        )


def _revived(value: Any, parameter: inspect.Parameter) -> Any:
    """A captured argument as its command expects to receive it.

    Capture stores JSON, which has no set, and a command that takes one
    (``delete_metric_ids``) reads membership off it, so the list it came
    back as is turned into what it was.
    """
    annotation = str(parameter.annotation).lower()
    if isinstance(value, list) and ("set[" in annotation or annotation == "set"):
        return set(value)
    return value


def _split_arguments(
    command_cls: Any, args: dict[str, Any], around: tuple[str, ...] = ()
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Captured arguments, split into the command's keywords and the rest.

    ``(keywords for the constructor, arguments for what the write does around
    it)``. An argument that is neither is refused. Reading the constructor
    rather than a list of known names is what makes a keyword added to the
    command tomorrow replay without anyone remembering to teach this module.
    """
    captured = captured_arguments(args)
    if not captured:
        return {}, {}
    parameters = ctor_signature(command_cls).parameters
    keywords: dict[str, Any] = {}
    outside: dict[str, Any] = {}
    for name, value in captured.items():
        parameter = parameters.get(name)
        if parameter is not None and parameter.kind in (
            inspect.Parameter.POSITIONAL_OR_KEYWORD,
            inspect.Parameter.KEYWORD_ONLY,
        ):
            keywords[name] = _revived(value, parameter)
        elif name in around:
            outside[name] = value
        else:
            raise ChangeManagementException(
                f"{command_cls.__name__} was captured with {name!r}, which it "
                "no longer takes and approval cannot apply on its own. "
                "Nothing was changed."
            )
    return keywords, outside


def build_delete_command(change_request: ChangeRequest) -> Any:
    """Reconstruct the delete the author asked for.

    Deletes are captured one asset per request even though the commands take
    a list, so each approval deletes exactly the asset that was reviewed --
    approving one of a batch must not take the other three with it.
    """
    # pylint: disable=import-outside-toplevel
    asset_type = AssetType(change_request.asset_type)
    ids = [change_request.asset_id]
    _refuse_unreplayed_arguments(change_request.command_args, "delete")

    if asset_type == AssetType.DASHBOARD:
        from superset.commands.dashboard.delete import DeleteDashboardCommand

        return DeleteDashboardCommand(ids)
    if asset_type == AssetType.CHART:
        from superset.commands.chart.delete import DeleteChartCommand

        return DeleteChartCommand(ids)
    from superset.commands.dataset.delete import DeleteDatasetCommand

    return DeleteDatasetCommand(ids)


class EmbeddedUpsertReplay:
    """The embedded-config upsert, shaped like a command so replay can run it.

    Every other governed write has a host command to re-invoke. This one
    does not, so the extension supplies the missing object: the same two
    DAO arguments the dashboard API passes. It deliberately does NOT
    perform the API's commit -- an approval is one transaction, and
    committing inside it published the embedded config while the request it
    came from was still pending, so a later failure left the two disagreeing
    (QA-26). ``approve`` commits once, for the replay and the decision
    together. The gate is suspended for the whole replay, so calling the
    wrapped DAO here does not re-capture the change.
    """

    def __init__(self, dashboard: Model, allowed_domains: list[str]) -> None:
        self._dashboard = dashboard
        self._allowed_domains = allowed_domains

    def run(self) -> Any:
        # pylint: disable=import-outside-toplevel
        from superset.daos.dashboard import EmbeddedDashboardDAO

        return EmbeddedDashboardDAO.upsert(self._dashboard, self._allowed_domains)


def build_dashboard_command(
    asset_id: int, body: dict[str, Any], args: dict[str, Any]
) -> Any:
    """The dashboard command a capture came from.

    A dashboard is written through its main update and through narrower
    endpoints (native filters, chart customizations, colors, embedding),
    each with its own command and body shape. The capture records which one, so
    the approval runs that same command rather than feeding a filter diff
    to the properties update.
    """
    # pylint: disable=import-outside-toplevel
    from superset.commands.dashboard.delete import DeleteEmbeddedDashboardCommand
    from superset.commands.dashboard.update import (
        UpdateDashboardChartCustomizationsCommand,
        UpdateDashboardColorsConfigCommand,
        UpdateDashboardCommand,
        UpdateDashboardNativeFiltersCommand,
    )

    kind = args.get(COMMAND_KEY)
    if kind is None:
        keywords, _ = _split_arguments(UpdateDashboardCommand, args)
        return UpdateDashboardCommand(asset_id, body, **keywords)
    _refuse_unreplayed_arguments(args, "dashboard change")
    if kind in (UPSERT_EMBEDDED_COMMAND, DeleteEmbeddedDashboardCommand.review_command):
        dashboard = load_asset(AssetType.DASHBOARD, asset_id)
        if dashboard is None:
            raise ChangeManagementException(
                f"Dashboard {asset_id} was not found for this change request."
            )
        if kind == UPSERT_EMBEDDED_COMMAND:
            return EmbeddedUpsertReplay(dashboard, body.get("allowed_domains") or [])
        return DeleteEmbeddedDashboardCommand(dashboard)
    if kind == UpdateDashboardNativeFiltersCommand.review_command:
        return UpdateDashboardNativeFiltersCommand(asset_id, body)
    if kind == UpdateDashboardChartCustomizationsCommand.review_command:
        return UpdateDashboardChartCustomizationsCommand(asset_id, body)
    if kind == UpdateDashboardColorsConfigCommand.review_command:
        # Only ``mark_updated=True`` writes are ever captured; the
        # ``False`` form commits mid-command and is refused at the gate.
        return UpdateDashboardColorsConfigCommand(asset_id, body, mark_updated=True)
    # An unknown kind must not fall back to some other command: approving
    # would then apply a change different from the one reviewed.
    raise ChangeManagementException(
        f"Unknown dashboard command {kind!r} in change request."
    )


def build_command(change_request: ChangeRequest) -> Any:
    """Reconstruct the command the author ran, argument for argument."""
    # pylint: disable=import-outside-toplevel
    if Operation(change_request.operation) is Operation.DELETE:
        return build_delete_command(change_request)

    asset_type = AssetType(change_request.asset_type)
    # Exempt fields are dropped before replay -- unless this very write
    # changed them. They apply immediately, so the request's copy of one is a
    # snapshot from whenever the author saved, and writing it back would undo
    # anything done to it since: adding an editor during a review was silently
    # removed when the review was approved (129071). What was never under
    # review is not the approval's to publish.
    #
    # But a snapshot is only what an exempt field is when it merely rode along
    # with the form. Saved together with a governed field and *changed*, the
    # gate held it with the rest, nothing else will ever apply it, and the
    # reviewer was shown it with a before and after -- so dropping it approved
    # a change that then did not happen (B4). Capture is per write, so which
    # exempt fields a write owns is decided at capture and recorded on the
    # request; a request that predates the record owns none, as it always did.
    owned = set(captured_exempt_fields(change_request.command_args) or ())
    body = {
        field: value
        for field, value in change_request.payload_dict.items()
        if field not in EXEMPT_FIELDS or field in owned
    }
    args = change_request.command_args

    if args.get(COMMAND_KEY) == RESTORE_VERSION_COMMAND:
        return build_restore_version_command(change_request, body)

    if args.get(COMMAND_KEY) == RESTORE_COMMAND:
        return build_restore_command(change_request, body)

    if asset_type == AssetType.DASHBOARD:
        return build_dashboard_command(change_request.asset_id, body, args)

    if args.get(COMMAND_KEY) is not None:
        # Charts and datasets have no other captured commands; see
        # ``build_dashboard_command`` for why an unknown kind is refused.
        raise ChangeManagementException(
            f"Unknown {asset_type.value} command {args[COMMAND_KEY]!r} "
            "in change request."
        )

    if asset_type == AssetType.CHART:
        from superset.commands.chart.update import UpdateChartCommand

        keywords, around = _split_arguments(
            UpdateChartCommand, args, AROUND_THE_COMMAND
        )
        keywords.setdefault("normalization_changes", args.get("normalization_changes"))
        chart_update = UpdateChartCommand(change_request.asset_id, body, **keywords)
        if not around:
            return chart_update
        return ChartSaveWithDashboard(chart_update, around)

    from superset.commands.dataset.update import UpdateDatasetCommand

    # ``override_columns`` decides whether the update replaces the dataset's
    # column set. Defaulting it to False rather than dropping it keeps an
    # approval applying the change that was actually reviewed. Read from the
    # captured keywords first; a request from before keywords were captured
    # as a set carries it under a key of its own.
    keywords, _ = _split_arguments(UpdateDatasetCommand, args)
    override_columns = bool(
        keywords.pop("override_columns", args.get("override_columns", False))
    )
    update = UpdateDatasetCommand(
        change_request.asset_id,
        body,
        override_columns=override_columns,
        **keywords,
    )
    if not override_columns:
        return update
    return DatasetSaveWithRefresh(change_request.asset_id, update)


class DatasetSaveWithRefresh:
    """An ``override_columns`` dataset save, as the dataset API performs it.

    ``PUT /api/v1/dataset/<pk>?override_columns=true`` runs the update and
    then ``RefreshDatasetCommand``, which re-reads the columns from the
    source. Replaying the update alone would approve a different change
    than the one the author's save makes, so the refresh is replayed too.

    Unlike the direct save -- two commits, so a failed refresh leaves the
    update applied -- both run inside the approval's transaction. A refresh
    that fails therefore leaves the request pending and the dataset
    untouched, rather than marking the change approved over half of it.

    That atomicity is kept, and it is why this does not simply commit between
    the two as the route does (B6). What the route's first commit gives the
    refresh is not durability but a fresh session: it expires everything, so
    the dataset's ``columns`` are read back from the database. Without that
    the dataset still holds the collection it loaded before the update, a
    column the update *added* is not in it, and the refresh -- which drops
    every column the source does not list -- reassigns a collection that never
    contained it. The column survives approval where the direct save removes
    it. Flushing the update and expiring the session gives the refresh the
    same view the route's commit does, in the same transaction.
    """

    def __init__(self, dataset_id: int, update: Any):
        self._dataset_id = dataset_id
        self._update = update

    def run(self) -> Model:
        # pylint: disable=import-outside-toplevel
        from superset import db
        from superset.commands.dataset.refresh import RefreshDatasetCommand

        model = self._update.run()
        db.session.flush()
        db.session.expire_all()
        try:
            RefreshDatasetCommand(self._dataset_id).run()
        except ChangeManagementException:
            raise
        except Exception as ex:  # pylint: disable=broad-except
            # Nested in the approval's transaction, the refresh's own
            # ``on_error`` wrapping does not run, so whatever the source
            # raised arrives here unwrapped.
            raise ReplayFailedError(
                "The dataset change could not be approved because its columns "
                "could not be refreshed from the source. Nothing was changed."
            ) from ex
        return model


class ChartSaveWithDashboard:
    """The legacy Explore save, which updates a chart and then places it.

    ``save_to_dashboard_id`` and ``new_dashboard_name`` ride on the same
    request as the save, and the view does what they say after the chart is
    written: it attaches the chart to that dashboard, or builds a new one
    around it. The gate holds the whole request, so approving has to do both,
    or the reviewer approves a rename and is told "published" over a write
    that never attached anything (B7).

    The checks are the view's, run as the author (the replay is): the author
    must still be able to edit the dashboard they named, or create one.
    """

    def __init__(self, update: Any, around: dict[str, Any]):
        self._update = update
        self._around = around

    def run(self) -> Model:
        # pylint: disable=import-outside-toplevel
        from superset import db, security_manager
        from superset.models.dashboard import Dashboard

        chart = self._update.run()
        dashboard: Dashboard | None = None
        target = self._around.get("save_to_dashboard_id")
        new_name = self._around.get("new_dashboard_name")
        if target:
            dashboard = (
                db.session.query(Dashboard).filter_by(id=int(target)).one_or_none()
            )
            if dashboard is None or not security_manager.is_editor(dashboard):
                raise ReplayFailedError(
                    "The chart could not be added to the dashboard it was saved "
                    "to: the author can no longer edit it. Nothing was changed."
                )
        elif new_name:
            from superset.subjects.utils import (
                get_default_viewers_for_new_asset,
                get_user_subject,
            )
            from superset.utils.core import get_user_id

            if not security_manager.can_access("can_write", "Dashboard"):
                raise ReplayFailedError(
                    "The chart could not be added to a new dashboard: the "
                    "author can no longer create one. Nothing was changed."
                )
            author = get_user_id()
            subject = get_user_subject(author) if author else None
            dashboard = Dashboard(
                dashboard_title=new_name,
                editors=[subject] if subject else [],
                viewers=get_default_viewers_for_new_asset(author),
            )
            db.session.add(dashboard)
        if dashboard is not None and chart not in dashboard.slices:
            dashboard.slices.append(chart)
        return chart


def build_restore_command(change_request: ChangeRequest, body: dict[str, Any]) -> Any:
    """The un-archive the author asked for, for any asset kind.

    The uuid comes from the capture rather than from the live asset,
    because a soft-deleted row is exactly what the command expects to be
    handed and exactly what ``load_asset`` may not return.
    """
    # pylint: disable=import-outside-toplevel
    from superset.commands.chart.restore import RestoreChartCommand
    from superset.commands.dashboard.restore import RestoreDashboardCommand
    from superset.commands.dataset.restore import RestoreDatasetCommand

    command_cls = {
        AssetType.DASHBOARD: RestoreDashboardCommand,
        AssetType.CHART: RestoreChartCommand,
        AssetType.DATASET: RestoreDatasetCommand,
    }[AssetType(change_request.asset_type)]
    return command_cls(body["uuid"])


def build_restore_version_command(
    change_request: ChangeRequest, body: dict[str, Any]
) -> Any:
    """The version restore the author asked for, for any asset kind."""
    # pylint: disable=import-outside-toplevel
    from uuid import UUID

    from superset.commands.chart.restore_version import RestoreChartVersionCommand
    from superset.commands.dashboard.restore_version import (
        RestoreDashboardVersionCommand,
    )
    from superset.commands.dataset.restore_version import (
        RestoreDatasetVersionCommand,
    )

    asset_type = AssetType(change_request.asset_type)
    asset = load_asset(asset_type, change_request.asset_id)
    if asset is None:
        raise ChangeRequestNotFoundError(change_request.id)
    command_cls = {
        AssetType.DASHBOARD: RestoreDashboardVersionCommand,
        AssetType.CHART: RestoreChartVersionCommand,
        AssetType.DATASET: RestoreDatasetVersionCommand,
    }[asset_type]
    return command_cls(UUID(str(asset.uuid)), UUID(body["version_uuid"]))


def apply_change(change_request: ChangeRequest) -> Model:
    """Run the author's original command, as the author, gate suspended.

    Suspension is essential: without it the replay would itself be captured
    as a new change request and the approval would never land. The
    suspension is scoped to this call and restored even if the command
    raises, so a failed approval cannot leave the gate off.

    So is the identity. The command reads the current user to stamp
    `changed_by` and to write the version-history entry, and the request
    running it belongs to the approver -- so every approved save was
    credited to whoever pressed Approve, and the author's name was nowhere
    in the history of their own edit (QA-16). The approval is recorded on
    the change request, which is where the approver belongs; the save is
    the author's work and is attributed to them.
    """
    command = build_command(change_request)
    with replaying(), override_user(change_request.author):
        from superset import (  # pylint: disable=import-outside-toplevel
            db,
        )

        result = command.run()
        # The audit columns are filled at flush time from whoever is current,
        # and a command that only stages its work leaves that flush to the
        # request -- by which point the override is gone and the approver's
        # name is on the author's work. An approved delete was recorded as
        # "Archived by Priya Shah" when Alex had asked for it; the same
        # mistake QA-16 fixed for version history, one layer down. Flushing
        # here takes the stamp while the author is still the current user.
        db.session.flush()
        return result
