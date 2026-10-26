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

import logging
from typing import Any

from flask_appbuilder.models.sqla import Model

from asset_approval.exceptions import (
    ChangeManagementException,
    ChangeRequestNotFoundError,
    ReplayFailedError,
)
from asset_approval.gate import (
    COMMAND_KEY,
    replaying,
    RESTORE_COMMAND,
    RESTORE_VERSION_COMMAND,
    UPSERT_EMBEDDED_COMMAND,
)
from asset_approval.changes import EXEMPT_FIELDS
from asset_approval.models import ChangeRequest
from asset_approval.types import AssetType, Operation

logger = logging.getLogger(__name__)


def load_asset(asset_type: AssetType, asset_id: int) -> Any | None:
    """The live asset a change request targets."""
    # pylint: disable=import-outside-toplevel
    if asset_type == AssetType.DASHBOARD:
        from superset.daos.dashboard import DashboardDAO

        return DashboardDAO.find_by_id(asset_id)
    if asset_type == AssetType.CHART:
        from superset.daos.chart import ChartDAO

        return ChartDAO.find_by_id(asset_id)
    from superset.daos.dataset import DatasetDAO

    return DatasetDAO.find_by_id(asset_id)


def build_delete_command(change_request: ChangeRequest) -> Any:
    """Reconstruct the delete the author asked for.

    Deletes are captured one asset per request even though the commands take
    a list, so each approval deletes exactly the asset that was reviewed --
    approving one of a batch must not take the other three with it.
    """
    # pylint: disable=import-outside-toplevel
    asset_type = AssetType(change_request.asset_type)
    ids = [change_request.asset_id]

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
        return UpdateDashboardCommand(asset_id, body)
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
    # Exempt fields are dropped before replay. They apply immediately, so
    # the request's copy of them is a snapshot from whenever the author
    # saved -- writing it back would undo anything done to them since, and
    # did: adding an editor during a review was silently removed when the
    # review was approved (129071). What was never under review is not the
    # approval's to publish.
    body = {
        field: value
        for field, value in change_request.payload_dict.items()
        if field not in EXEMPT_FIELDS
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

        return UpdateChartCommand(
            change_request.asset_id,
            body,
            normalization_changes=args.get("normalization_changes"),
        )

    from superset.commands.dataset.update import UpdateDatasetCommand

    # ``override_columns`` decides whether the update replaces the dataset's
    # column set. Defaulting it to False rather than dropping it keeps an
    # approval applying the change that was actually reviewed.
    override_columns = bool(args.get("override_columns", False))
    update = UpdateDatasetCommand(
        change_request.asset_id,
        body,
        override_columns=override_columns,
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
    """

    def __init__(self, dataset_id: int, update: Any):
        self._dataset_id = dataset_id
        self._update = update

    def run(self) -> Model:
        # pylint: disable=import-outside-toplevel
        from superset.commands.dataset.refresh import RefreshDatasetCommand

        model = self._update.run()
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
    """Run the author's original command, with the gate suspended.

    Suspension is essential: without it the replay would itself be captured
    as a new change request and the approval would never land. The
    suspension is scoped to this call and restored even if the command
    raises, so a failed approval cannot leave the gate off.
    """
    command = build_command(change_request)
    with replaying():
        return command.run()
