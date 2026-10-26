"""Every write path the review gate binds to, and how.

One entry per path. Each closure reproduces exactly what the host build
calls at that site; the host's own test suite
(``tests/unit_tests/change_management``) is the contract they are checked
against.

Eighteen entries is the honest cost of having no declared seam. Each is a
separate chance to drift from the host, and a binding that fails to resolve
logs a warning and leaves that path UNGATED rather than failing silently --
a gap you can see beats a gate you only believe in.
"""

from __future__ import annotations

from typing import Any

from asset_approval.changes import changed_fields, EXEMPT_FIELDS
from superset.utils import json
from asset_approval.gate import (
    COMMAND_KEY,
    combine_config_diffs,
    combine_key_values,
    gate_delete,
    gate_write,
    refuse_import_overwrite,
    refuse_unreviewable_write,
    RESTORE_VERSION_COMMAND,
    UPSERT_EMBEDDED_COMMAND,
)
from asset_approval.install import gate_method, gate_run, REVIEW_COMMANDS
from asset_approval.types import AssetType


def _payload(command: Any) -> dict[str, Any]:
    return getattr(command, "_captured_payload", {}) or {}


def install_review_commands() -> None:
    """Put ``review_command`` on the classes replay reads it back from."""
    from importlib import import_module

    for (module_path, class_name), kind in REVIEW_COMMANDS.items():
        try:
            cls = getattr(import_module(module_path), class_name)
        except (ImportError, AttributeError):
            continue
        if getattr(cls, "review_command", None) is None:
            cls.review_command = kind


def install_bindings() -> None:
    # ---- dashboards ----------------------------------------------------
    gate_run(
        "superset.commands.dashboard.update",
        "UpdateDashboardCommand",
        _gate_dashboard_update,
        capture=True,
    )
    # The native-filter and chart-customization sub-commands inherit the
    # capture above but gate on a diff body, which folds into an open draft
    # instead of replacing it.
    for class_name in (
        "UpdateDashboardNativeFiltersCommand",
        "UpdateDashboardChartCustomizationsCommand",
    ):
        gate_run(
            "superset.commands.dashboard.update",
            class_name,
            lambda c: gate_write(
                AssetType.DASHBOARD,
                c._model.id,
                _payload(c),
                command_args={COMMAND_KEY: c.review_command},
                combine=combine_config_diffs,
            ),
        )
    gate_run(
        "superset.commands.dashboard.update",
        "UpdateDashboardColorsConfigCommand",
        lambda c: (
            gate_write(
                AssetType.DASHBOARD,
                c._model.id,
                _payload(c),
                command_args={
                    COMMAND_KEY: c.review_command,
                    "mark_updated": getattr(c, "_mark_updated", True),
                },
                combine=combine_key_values,
            )
            if getattr(c, "_mark_updated", True)
            else refuse_unreviewable_write(
                "Updating dashboard colors in the background",
                "Change colors in the dashboard's properties and save, so "
                "the change can be reviewed.",
            )
        ),
    )
    gate_run(
        "superset.commands.dashboard.delete",
        "DeleteDashboardCommand",
        lambda c: gate_delete(
            AssetType.DASHBOARD, [m.id for m in (c._models or [])]
        ),
    )
    gate_run(
        "superset.commands.dashboard.delete",
        "DeleteEmbeddedDashboardCommand",
        lambda c: gate_write(
            AssetType.DASHBOARD,
            c._dashboard.id,
            {},
            command_args={COMMAND_KEY: c.review_command},
        ),
    )
    # Setting a dashboard's embedded config has no command in the host
    # build: the API loads the dashboard and calls the DAO inline. The DAO
    # is the only seam, so the gate reads the call's arguments directly.
    gate_method(
        "superset.daos.dashboard",
        "EmbeddedDashboardDAO",
        "upsert",
        _gate_embedded_upsert,
    )

    # ---- charts --------------------------------------------------------
    gate_run(
        "superset.commands.chart.update",
        "UpdateChartCommand",
        lambda c: None
        if _only_exempt(c._model, _payload(c))
        else gate_write(
            AssetType.CHART,
            c._model.id,
            _payload(c),
            command_args={
                "normalization_changes": getattr(c, "_normalization_changes", None)
            },
        ),
        capture=True,
    )
    gate_run(
        "superset.commands.chart.delete",
        "DeleteChartCommand",
        lambda c: gate_delete(AssetType.CHART, [m.id for m in (c._models or [])]),
    )

    # ---- datasets ------------------------------------------------------
    gate_run(
        "superset.commands.dataset.update",
        "UpdateDatasetCommand",
        lambda c: None
        if _only_exempt(c._model, _payload(c))
        else gate_write(
            AssetType.DATASET,
            c._model.id,
            _payload(c),
            command_args={"override_columns": getattr(c, "override_columns", False)},
        ),
        capture=True,
    )
    gate_run(
        "superset.commands.dataset.delete",
        "DeleteDatasetCommand",
        lambda c: gate_delete(AssetType.DATASET, [m.id for m in (c._models or [])]),
    )
    # "Sync columns from source" is exempt (SOW 5.2, criterion 5): it does
    # not author a change, it re-reads what the database already says. It
    # was refused with a 422, which left no way to do it at all while
    # review was on (129073). Left unbound, so it applies immediately.
    gate_run(
        "superset.commands.dataset.columns.delete",
        "DeleteDatasetColumnCommand",
        lambda c: refuse_unreviewable_write(
            "Deleting a dataset column",
            "Remove the column in the dataset editor and save, so the change "
            "can be reviewed.",
        ),
    )
    gate_run(
        "superset.commands.dataset.metrics.delete",
        "DeleteDatasetMetricCommand",
        lambda c: refuse_unreviewable_write(
            "Deleting a dataset metric",
            "Remove the metric in the dataset editor and save, so the change "
            "can be reviewed.",
        ),
    )

    # ---- the legacy datasource save -------------------------------------
    # `POST /datasource/save/` writes a whole datasource dict straight onto
    # the model, with no command to bind, so a reviewed dataset could be
    # changed outright (S-01, QA run 1). It is deprecated in favour of
    # `PUT /api/v1/dataset/<id>`, which is gated, and nothing in the
    # frontend calls it -- so refusing closes the hole without taking away
    # a route anyone uses.
    #
    # Refused rather than captured on purpose: its body is a full datasource
    # dict, not the dataset command's, so a captured request could not be
    # replayed faithfully and would fail at approval instead of here.
    gate_method(
        "superset.views.datasource.views",
        "Datasource",
        "save",
        lambda *_args, **_kwargs: refuse_unreviewable_write(
            "Saving a dataset through the legacy endpoint",
            "Save the dataset from its editor, or through "
            "PUT /api/v1/dataset/<id>, so the change can be reviewed.",
        ),
    )

    # ---- Explore's legacy save ------------------------------------------
    # No command of its own: the view writes through the DAO inline, so the
    # view method is the only seam before the write happens.
    gate_method(
        "superset.views.core",
        "Superset",
        "save_or_overwrite_slice",
        _gate_legacy_slice_save,
    )

    # ---- version restore -----------------------------------------------
    gate_run(
        "superset.commands.version_restore",
        "BaseRestoreVersionCommand",
        _gate_version_restore,
        validate_first=False,
    )

    # ---- imports -------------------------------------------------------
    # Bound ahead of ``run``, not inside ``_import`` where the overwrite
    # actually happens, because every importer's ``run`` wraps its body in
    # "import failed for an unknown reason". Refusing from inside would be
    # swallowed by that, and the person importing would be told nothing
    # about review. Refusing first costs the ordering the other paths have
    # (validate, then gate): an overwriting import is refused before the
    # bundle is validated. The refusal discloses only that review is on,
    # which the asset's own banner already does.
    for module_path, class_name, kind in (
        ("superset.commands.dashboard.importers.v1", "ImportDashboardsCommand", "dashboard"),
        ("superset.commands.chart.importers.v1", "ImportChartsCommand", "chart"),
        ("superset.commands.dataset.importers.v1", "ImportDatasetsCommand", "dataset"),
    ):
        gate_run(
            module_path,
            class_name,
            _import_gate(kind),
            validate_first=False,
        )
    # An asset bundle is refused only where it would actually overwrite
    # something: a bundle of entirely new assets is not a governed write,
    # whatever its overwrite flag says.
    gate_run(
        "superset.commands.importers.v1.assets",
        "ImportAssetsCommand",
        _assets_import_gate,
        validate_first=False,
    )

    # ---- dataset datetime formats --------------------------------------
    # No command: the API detects and stores formats inline, so the view
    # method is the only seam. Not currently served (it is absent from
    # ``include_route_methods``), guarded for whenever it is.
    gate_method(
        "superset.datasets.api",
        "DatasetRestApi",
        "detect_datetime_formats",
        lambda *_args, **_kwargs: refuse_unreviewable_write(
            "Detecting and storing datetime formats",
            "Set the formats in the dataset editor and save, so the change "
            "can be reviewed.",
        ),
    )




def _only_exempt(asset: Any, payload: dict[str, Any]) -> bool:
    """Whether this write touches nothing a viewer would see.

    A payload carrying an exempt field *and* a governed one is still
    governed: the exemption is per-write, not per-field, and letting the
    governed half through because it travelled with a tag would be a hole
    rather than a convenience.

    Measured against the live asset, not against which keys the body
    carries. A properties dialog posts every field it shows, so editing
    only the editors list still arrives with the title and description
    alongside -- which read as governed fields and held a change the SOW
    exempts, on all three asset types (129073).
    """
    changed = set(changed_fields(asset, payload))
    return bool(changed) and changed <= EXEMPT_FIELDS


def _gate_dashboard_update(command: Any) -> None:
    """Gate a dashboard edit, unless nobody can see the dashboard yet.

    SOW 5.1: a dashboard is created as a draft, and making it visible
    through the Draft/Published toggle is an edit that requires approval.
    The converse is what makes the rule workable -- while it is still a
    draft no viewer can reach it, so there is nothing for review to
    protect, and gating every save would mean building a dashboard one
    approval at a time.

    So: changes to an unpublished dashboard apply directly, and the
    transition that first exposes it to viewers is captured like any other
    governed write.
    """
    model = command._model
    payload = _payload(command)

    if _only_exempt(model, payload):
        return

    published_now = bool(getattr(model, "published", False))
    publishing = payload.get("published") is True and not published_now

    if not published_now and not publishing:
        return

    gate_write(AssetType.DASHBOARD, model.id, payload)


def _gate_legacy_slice_save(
    slc: Any,
    _slice_add_perm: bool = False,
    _slice_overwrite_perm: bool = False,
    _slice_download_perm: bool = False,
    datasource_id: int | None = None,
    datasource_type: str | None = None,
    _datasource_name: str | None = None,
    query_context: str | None = None,
) -> None:
    """Gate Explore's legacy save, which bypasses the chart command entirely.

    ``/superset/explore/?action=overwrite`` writes through ``ChartDAO``
    inline, so none of the command bindings see it and an editor could
    change a reviewed chart with nothing held (129068). The same call also
    attaches the chart to a dashboard when ``save_to_dashboard_id`` is set,
    which changes that dashboard for its viewers (129069).

    Gated here rather than at the DAO because the DAO is shared with the
    command that is already bound, and because only the request knows which
    of the two things this call is doing.
    """
    from flask import request

    from superset.utils import core as utils
    from superset.views.utils import get_form_data

    action = request.args.get("action")

    # NOTE: ``save_to_dashboard_id`` on this same call attaches the chart to
    # a dashboard, which changes that dashboard for its viewers (129069).
    # It is deliberately NOT captured here: replaying it means re-attaching
    # a chart to a dashboard, which no command expresses, and capturing a
    # request that approval cannot apply would turn a visible bug into a
    # silent one. That one needs its own command before it can be gated.

    if action != "overwrite" or slc is None or not getattr(slc, "id", None):
        return

    form_data = get_form_data()[0]
    utils.remove_extra_adhoc_filters(form_data)
    payload: dict[str, Any] = {
        "slice_name": request.args.get("slice_name"),
        "params": json.dumps(form_data, indent=2, sort_keys=True),
        "viz_type": form_data.get("viz_type"),
        "query_context": query_context,
    }
    if datasource_id is not None:
        payload["datasource_id"] = datasource_id
    if datasource_type is not None:
        payload["datasource_type"] = datasource_type
    gate_write(
        AssetType.CHART,
        slc.id,
        {k: v for k, v in payload.items() if v is not None},
    )


def _gate_embedded_upsert(
    dashboard: Any, allowed_domains: Any, *_args: Any, **_kwargs: Any
) -> None:
    """Capture an embedded-config change for review.

    Embedding a dashboard hands it to an audience outside Superset's own
    access control, so it is a governed write. The allowed-domain list is
    the whole request, and replay re-applies it through the same DAO.
    """
    gate_write(
        AssetType.DASHBOARD,
        dashboard.id,
        {"allowed_domains": list(allowed_domains or [])},
        command_args={COMMAND_KEY: UPSERT_EMBEDDED_COMMAND},
    )


def _assets_import_gate(command: Any) -> None:
    """Refuse a bundle import that would overwrite a governed asset.

    The host's own validation already refuses an ``overwrite=False``
    bundle whose assets exist, with its own message. What review adds is
    the other half: with ``overwrite`` on, the import would replace live
    assets without anyone reviewing the replacement. So the refusal fires
    only for the assets the bundle would actually land on, and names the
    kind it found, rather than refusing every bundle outright.
    """
    if not getattr(command, "overwrite", True):
        return

    from superset import db

    for prefix, entries in command._bundle_entries_by_prefix().items():
        if not entries:
            continue
        model_cls = command._MODEL_BY_PREFIX[prefix]
        existing = (
            db.session.query(model_cls.uuid)
            .filter(model_cls.uuid.in_([uuid for _, uuid in entries]))
            .first()
        )
        if existing is not None:
            refuse_import_overwrite(model_cls.__name__.lower())


def _import_gate(kind: str) -> Any:
    def gate(command: Any) -> None:
        if getattr(command, "overwrite", False) or getattr(
            command, "overwrite_all", False
        ):
            refuse_import_overwrite(kind)

    return gate


def _gate_version_restore(command: Any) -> None:
    """Capture a version restore as a change request.

    Restoring republishes old content to viewers, so it is a governed write
    like any other. The payload is the version being restored, which is all
    replay needs to perform it.
    """
    from superset.commands import version_restore

    from asset_approval.models import asset_type_for

    entity = command.validate()
    asset_type = asset_type_for(entity)
    if asset_type is None:
        return
    # Resolved here as well as in the command, because the reviewer is
    # shown which version is being restored and the number is not part of
    # the request. Read through the module so the host's own indirection
    # still applies.
    resolved = version_restore.resolve_version(
        command.model_cls, command._uuid, command._version_uuid, entity=entity
    )
    if resolved is None:
        # No such version. The command raises its own not-found; capturing
        # a restore that cannot happen would put an unapprovable request on
        # the asset and lock it against every other edit.
        return
    version_number, _transaction_id = resolved
    gate_write(
        asset_type,
        entity.id,
        {"version_uuid": str(command._version_uuid)},
        command_args={
            COMMAND_KEY: RESTORE_VERSION_COMMAND,
            "version_number": version_number,
        },
    )
