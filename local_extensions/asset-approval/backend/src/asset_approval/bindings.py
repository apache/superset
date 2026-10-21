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
        if _only_exempt(_payload(c))
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
        if _only_exempt(_payload(c))
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
    gate_run(
        "superset.commands.dataset.refresh",
        "RefreshDatasetCommand",
        lambda c: refuse_unreviewable_write(
            "Refreshing a dataset's columns",
            "Sync columns from source in the dataset editor and save, so the "
            "change can be reviewed.",
        ),
    )
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


#: Changes SOW 5.2 exempts from review, because none of them alter what a
#: viewer sees: who may edit the asset, and the metadata around it.
#:
#: The editors list matters most. SOW 5.4 tells an author with no eligible
#: approver to add another editor so they can submit -- and if that edit
#: were itself captured, it would need an approver to apply, which is the
#: very thing they do not have. Gating it makes a single-editor asset
#: permanently unchangeable.
EXEMPT_FIELDS = frozenset(
    {
        "editors",
        "viewers",
        "owners",
        "tags",
        "certified_by",
        "certification_details",
        "description",
    }
)


def _only_exempt(payload: dict[str, Any]) -> bool:
    """Whether this write touches nothing a viewer would see.

    A payload carrying an exempt field *and* a governed one is still
    governed: the exemption is per-write, not per-field, and letting the
    governed half through because it travelled with a tag would be a hole
    rather than a convenience.
    """
    keys = {key for key, value in payload.items() if value is not None}
    return bool(keys) and keys <= EXEMPT_FIELDS


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

    if _only_exempt(payload):
        return

    published_now = bool(getattr(model, "published", False))
    publishing = payload.get("published") is True and not published_now

    if not published_now and not publishing:
        return

    gate_write(AssetType.DASHBOARD, model.id, payload)


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
