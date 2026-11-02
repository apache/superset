"""Every write path the review gate binds to, and how.

``WRITE_PATHS`` is the declaration: one entry per path, naming the target,
what the gate does with it and why. ``install_bindings`` drives off that
table and nothing else, so the table cannot describe a binding that does
not run, and ``install.verify_bindings`` checks the running process against
it. Each closure reproduces exactly what the host build calls at that site;
the host's own test suite (``tests/unit_tests/change_management``) is the
contract they are checked against.

Twenty-five entries -- twenty-four bound, one declared exempt -- is the
honest cost of having no declared seam. The number is the table's length,
not a figure maintained by hand: the docstrings used to say "eighteen",
which was wrong by six, and nothing could tell because there was no
denominator to count against. Each entry is a separate chance to drift from
the host, and a binding that fails to resolve logs a warning and leaves that
path UNGATED rather than failing silently -- a gap you can see beats a gate
you only believe in. Verification now turns that gap into a withheld
promise, so core refuses the write instead.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Callable

from asset_approval.changes import (
    changed_fields,
    config_diff_changes_nothing,
    EXEMPT_FIELDS,
    columns_only_resynced,
    extra_is_only_certification,
)
from superset.utils import json
from asset_approval.gate import (
    COMMAND_KEY,
    combine_config_diffs,
    combine_key_values,
    gate_delete,
    gate_write,
    has_ever_been_published,
    mark_published,
    refuse_import_overwrite,
    refuse_unreviewable_write,
    RESTORE_COMMAND,
    RESTORE_VERSION_COMMAND,
    UPSERT_EMBEDDED_COMMAND,
)
from asset_approval.install import (
    gate_method,
    gate_run,
    rebind_registered_routes,
    REVIEW_COMMANDS,
    verify_bindings,
)
from asset_approval.types import AssetType

logger = logging.getLogger(__name__)

#: What the gate does with a declared path.
#:
#: ``GATED``   the write is captured as a change request and applied on
#:             approval.
#: ``REFUSED`` the write cannot be replayed faithfully, so it is refused
#:             outright with a message naming the reviewable route.
#: ``EXEMPT``  the write is deliberately left unbound and applies directly.
#:             Declared all the same, so "we chose not to gate this" is
#:             visible next to the paths that are gated, and so verification
#:             can tell an exemption from an oversight.
GATED = "gated"
REFUSED = "refused"
EXEMPT = "exempt"


@dataclass(frozen=True)
class WritePath:
    """One governed write path, and how the gate reaches it.

    ``via`` is how the host exposes the write: ``"run"`` for a command,
    whose ``run`` is wrapped, or ``"method"`` for a write that has no
    command in the host build and can only be reached at the method the
    API calls inline.
    """

    module_path: str
    class_name: str
    attr: str
    disposition: str
    reason: str
    gate: Callable[..., Any] | None = None
    via: str = "run"
    capture: bool = False
    validate_first: bool = True

    @property
    def target(self) -> str:
        return f"{self.class_name}.{self.attr}"


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


def _tell_core_the_promise_is_kept() -> None:
    """Register this gate with core, so core stops refusing writes.

    ``CHANGE_MANAGEMENT`` promises review, but core has no way to know
    whether anything is enforcing it: an extension that fails to import is
    logged and skipped, and every edit then went live unreviewed (QA-12).
    Core now refuses writes while the flag is on and no gate has said it is
    here. This is the gate saying so, from the function that installs it --
    not from the entrypoint, because the tests build their app without one
    and would otherwise be refused too.
    """
    from superset.change_management import register_write_gate

    register_write_gate("preset.asset-approval")


def _app_if_any() -> Any | None:
    """The app being booted into, when there is one.

    The entrypoint imports this inside the application context, so there is.
    The extension's own tests bind without one, and there the route half of
    verification has nothing to look at and is skipped.
    """
    from flask import current_app, has_app_context

    if not has_app_context():
        return None
    return current_app._get_current_object()  # noqa: SLF001


def _keep_the_promise_only_if_the_gate_is_whole() -> None:
    """Tell core the gate is here, but only once it has been checked.

    The promise used to be unconditional: ``install_bindings`` said "a gate
    is installed" before it had installed anything, and core's fail-closed
    guard took that at face value. So a build where a binding had drifted
    off its target served a gate with a hole in it, and the hole was exactly
    the thing core's guard exists to refuse. That is how four rows came to
    be marked Fixed while the write path was still open, S-01 among them.

    The safe failure here is refusing writes. Withholding the promise makes
    core answer every governed write 503 with ``CHANGE_MANAGEMENT_UNENFORCED``
    -- loud, operator-visible, and nothing goes live unreviewed. Serving a
    partly bound gate is the unsafe one, because it looks like it worked.

    Defects are logged individually at error level; an operator reading the
    log needs to know which path, not just that there was one.
    """
    report = verify_bindings(_app_if_any())
    if report.ok:
        _tell_core_the_promise_is_kept()
        return
    for defect in report.defects:
        logger.error("asset-approval: write path NOT bound -- %s", defect)
    logger.error(
        "asset-approval: %d of %d declared write paths verified, %d defect(s); "
        "the gate has NOT registered with core, so governed writes will be "
        "refused until this is repaired",
        report.verified,
        report.declared,
        len(report.defects),
    )


def install_bindings() -> None:
    """Bind every path ``WRITE_PATHS`` declares, then check the result.

    Driven off the table rather than written out, so the declaration and
    what actually runs are the same thing. An ``EXEMPT`` path carries no
    gate and is deliberately skipped here; it is in the table so that the
    choice is visible and so verification can tell it from an oversight.
    """
    for path in WRITE_PATHS:
        if path.gate is None:
            continue
        if path.via == "method":
            gate_method(path.module_path, path.class_name, path.attr, path.gate)
        else:
            gate_run(
                path.module_path,
                path.class_name,
                path.gate,
                capture=path.capture,
                validate_first=path.validate_first,
            )

    app = _app_if_any()
    if app is not None:
        # Flask-AppBuilder built its views before extensions loaded, so a
        # route onto a gated method is already holding the ungated original
        # (S-01). Repaired here, ahead of verification, because a route still
        # holding an original is a defect and would otherwise withhold the
        # promise over damage we know how to repair. The entrypoint calls
        # this again; it is idempotent, and the repair is logged per
        # endpoint either way.
        rebound = rebind_registered_routes(app)
        if rebound:
            # Logged from here because the entrypoint's own count now reads
            # zero: by the time it calls this, the repair has happened.
            logger.info(
                "asset-approval: %d route(s) rebound before verification: %s",
                len(rebound),
                ", ".join(rebound),
            )
    _keep_the_promise_only_if_the_gate_is_whole()


def _gate_config_diff(metadata_key: str) -> Any:
    """Gate a sub-command whose body is a diff of one ``json_metadata`` list.

    A diff that asks for nothing the configuration does not already say is
    not a change to review, and capturing it locked the dashboard over a
    save the author never made (R4-08). The equivalent check for full-state
    bodies lives in the gate; a diff can only be measured where the key it
    describes is known, which is here.
    """

    def gate(command: Any) -> None:
        payload = _payload(command)
        if config_diff_changes_nothing(
            getattr(command._model, "json_metadata", None),
            payload,
            metadata_key=metadata_key,
        ):
            return
        gate_write(
            AssetType.DASHBOARD,
            command._model.id,
            payload,
            command_args={COMMAND_KEY: command.review_command},
            combine=combine_config_diffs,
        )

    return gate


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
    if not changed:
        # Nothing moved at all. The gate's own empty-change check owns that
        # case; calling it exempt here would answer a different question.
        return False
    if "extra" in changed and extra_is_only_certification(asset, payload):
        changed.discard("extra")
    if "columns" in changed and columns_only_resynced(asset, payload):
        changed.discard("columns")
    return changed <= EXEMPT_FIELDS


def _gate_dashboard_update(command: Any) -> None:
    """Gate a dashboard edit, unless nobody can see the dashboard yet.

    SOW 5.1: a dashboard is created as a draft, and making it visible
    through the Draft/Published toggle is an edit that requires approval.
    The converse is what makes the rule workable -- while it is still a
    draft no viewer can reach it, so there is nothing for review to
    protect, and gating every save would mean building a dashboard one
    approval at a time.

    So: changes to a dashboard that has never been published apply
    directly, and the transition that first exposes it to viewers is
    captured like any other governed write.

    "Never published", not "not published right now". The Draft flag is one
    an editor can clear themselves, so reading it live let them unpublish,
    edit under the exemption, and publish again -- and the approver saw only
    the flag moving, with the content behind it never shown (QA-18). The
    flag says where the dashboard is; the mark says where it has been, and
    only the second one answers "can a viewer have seen this".
    """
    model = command._model
    payload = _payload(command)

    if _only_exempt(model, payload):
        return

    published_now = bool(getattr(model, "published", False))
    publishing = payload.get("published") is True and not published_now

    if published_now:
        # Seen published, so the exemption can never apply again. Recorded
        # on the way past rather than only when review publishes it, so a
        # dashboard already published when the extension was installed is
        # picked up by its first write -- including an unpublish.
        mark_published(AssetType.DASHBOARD, model.id)

    if not published_now and not publishing:
        if not has_ever_been_published(AssetType.DASHBOARD, model.id):
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


#: What a bundle prefix is called in a refusal. The model class behind a
#: prefix is not always named after it -- ``charts/`` lands on ``Slice`` --
#: and the message names what the person importing recognises.
_KIND_BY_PREFIX = {
    "databases/": "database",
    "datasets/": "dataset",
    "charts/": "chart",
    "dashboards/": "dashboard",
    "queries/": "saved query",
}


def _prefix_models() -> dict[str, Any]:
    """Core's own map of bundle prefix to the model that prefix lands on.

    Borrowed rather than restated, so the gate cannot fall behind a prefix
    core starts shipping.
    """
    from superset.commands.importers.v1.assets import ImportAssetsCommand

    return dict(ImportAssetsCommand._MODEL_BY_PREFIX)  # noqa: SLF001


def _bundle_uuids(
    contents: dict[str, Any], prefixes: list[str]
) -> dict[str, list[str]]:
    """The uuids the bundle carries under each prefix, read from the archive.

    Read from ``contents`` rather than from ``command._configs``: the import
    gates are bound with ``validate_first=False``, and ``validate()`` is what
    fills ``_configs`` in. A gate that read them saw an empty bundle on every
    call, so it could only ever decide on the overwrite flag.

    Only the files under a prefix that is in scope are parsed, so the work is
    the part of the bundle the refusal actually depends on.
    """
    import yaml

    found: dict[str, list[str]] = {prefix: [] for prefix in prefixes}
    for file_name, content in (contents or {}).items():
        prefix = next((p for p in found if file_name.startswith(p)), None)
        if prefix is None:
            continue
        try:
            config = yaml.safe_load(content)
        except (yaml.YAMLError, AttributeError, TypeError):
            # A bundle this malformed is ``validate()``'s to reject, with its
            # own message. The gate declines to turn it into a refusal about
            # review.
            continue
        uuid = config.get("uuid") if isinstance(config, dict) else None
        if uuid:
            found[prefix].append(str(uuid))
    return found


def _refuse_if_bundle_lands_on_a_live_asset(
    command: Any, prefixes: list[str]
) -> None:
    """Refuse only for the assets this import would actually replace.

    The host's own validation already refuses an ``overwrite=False`` bundle
    whose assets exist, with its own message. What review adds is the other
    half: with ``overwrite`` on, the import would replace live assets without
    anyone reviewing the replacement.

    So the refusal is scoped to the collisions the bundle really has. A
    bundle of entirely new assets is not a governed write, whatever its
    overwrite flag says -- which is what makes a first-time import work at
    all, including ``superset import-dashboards``, whose CLI hardcodes
    ``overwrite=True`` and had no way to reach an empty instance (S-06).
    """
    from superset import db

    models = _prefix_models()
    uuids_by_prefix = _bundle_uuids(getattr(command, "contents", None) or {}, prefixes)
    for prefix in prefixes:
        uuids = uuids_by_prefix.get(prefix) or []
        model_cls = models.get(prefix)
        if not uuids or model_cls is None:
            continue
        existing = (
            db.session.query(model_cls.uuid)
            .filter(model_cls.uuid.in_(uuids))
            .first()
        )
        if existing is not None:
            refuse_import_overwrite(
                _KIND_BY_PREFIX.get(prefix, model_cls.__name__.lower())
            )


def _assets_import_gate(command: Any) -> None:
    """An asset bundle replaces everything in it, so every prefix is in scope."""
    if not getattr(command, "overwrite", True):
        return
    _refuse_if_bundle_lands_on_a_live_asset(command, list(_prefix_models()))


def _import_gate(kind: str) -> Any:
    """Gate one kind's importer, scoped to what that importer replaces."""

    def gate(command: Any) -> None:
        if not getattr(command, "overwrite", False):
            return
        # ``overwrite`` replaces the models under the command's own prefix.
        # The assets they are built on -- the bundled charts, datasets and
        # databases -- are replaced only when ``overwrite_all`` is set as
        # well, which is the importer's own rule: ``overwrite_assets =
        # overwrite and kwargs.get("overwrite_all", False)``.
        prefixes = (
            list(_prefix_models())
            if getattr(command, "overwrite_all", False)
            else [getattr(command, "prefix", "") or f"{kind}s/"]
        )
        _refuse_if_bundle_lands_on_a_live_asset(command, prefixes)

    return gate


def _gate_restore(command: Any) -> None:
    """Capture an un-archive as a change request.

    ``validate`` is run here rather than by ``gate_run`` because it is the
    only thing that resolves the uuid the caller passed to an asset -- and
    a restore of something that is not there, or that the caller may not
    touch, must raise the command's own error rather than become a change
    request nobody can approve.
    """
    from asset_approval.models import asset_type_for

    entity = command.validate()
    asset_type = asset_type_for(entity)
    if asset_type is None:
        return
    gate_write(
        asset_type,
        entity.id,
        {"uuid": str(command._model_uuid)},
        command_args={COMMAND_KEY: RESTORE_COMMAND},
    )


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


def _refuse_dataset_column_delete(*_args: Any, **_kwargs: Any) -> None:
    refuse_unreviewable_write(
        "Deleting a dataset column",
        "Remove the column in the dataset editor and save, so the change "
        "can be reviewed.",
    )


def _refuse_dataset_metric_delete(*_args: Any, **_kwargs: Any) -> None:
    refuse_unreviewable_write(
        "Deleting a dataset metric",
        "Remove the metric in the dataset editor and save, so the change "
        "can be reviewed.",
    )


def _refuse_legacy_datasource_save(*_args: Any, **_kwargs: Any) -> None:
    refuse_unreviewable_write(
        "Saving a dataset through the legacy endpoint",
        "Save the dataset from its editor, or through "
        "PUT /api/v1/dataset/<id>, so the change can be reviewed.",
    )


def _refuse_datetime_format_detection(*_args: Any, **_kwargs: Any) -> None:
    refuse_unreviewable_write(
        "Detecting and storing datetime formats",
        "Set the formats in the dataset editor and save, so the change "
        "can be reviewed.",
    )


def _gate_dashboard_colors(command: Any) -> None:
    """Gate a colours change, unless nobody asked for it to be visible.

    The same command runs on a background recolour, which no author made and
    no approver could recognise; that one is refused rather than captured.
    """
    if not getattr(command, "_mark_updated", True):
        refuse_unreviewable_write(
            "Updating dashboard colors in the background",
            "Change colors in the dashboard's properties and save, so "
            "the change can be reviewed.",
        )
        return
    gate_write(
        AssetType.DASHBOARD,
        command._model.id,
        _payload(command),
        command_args={
            COMMAND_KEY: command.review_command,
            "mark_updated": getattr(command, "_mark_updated", True),
        },
        combine=combine_key_values,
    )


def _gate_dashboard_delete(command: Any) -> None:
    gate_delete(AssetType.DASHBOARD, [m.id for m in (command._models or [])])


def _gate_embedded_delete(command: Any) -> None:
    gate_write(
        AssetType.DASHBOARD,
        command._dashboard.id,
        {},
        command_args={COMMAND_KEY: command.review_command},
    )


def _gate_chart_update(command: Any) -> None:
    if _only_exempt(command._model, _payload(command)):
        return
    gate_write(
        AssetType.CHART,
        command._model.id,
        _payload(command),
        command_args={
            "normalization_changes": getattr(
                command, "_normalization_changes", None
            )
        },
    )


def _gate_chart_delete(command: Any) -> None:
    gate_delete(AssetType.CHART, [m.id for m in (command._models or [])])


def _gate_dataset_update(command: Any) -> None:
    if _only_exempt(command._model, _payload(command)):
        return
    gate_write(
        AssetType.DATASET,
        command._model.id,
        _payload(command),
        command_args={
            "override_columns": getattr(command, "override_columns", False)
        },
    )


def _gate_dataset_delete(command: Any) -> None:
    gate_delete(AssetType.DATASET, [m.id for m in (command._models or [])])


#: Every write path the gate is responsible for, and its disposition.
#:
#: This is the denominator. ``install_bindings`` binds exactly what is here,
#: ``install.verify_bindings`` checks the process against it, and the promise
#: to core is only made when that check is clean. Before the table there was
#: no way to answer "is every governed write path bound right now?" --
#: ``patched_targets()`` recorded the ``setattr`` calls that succeeded, so a
#: path nobody attempted read the same as one that worked. That is the shape
#: S-01 hid in.
#:
#: The reasons are kept here rather than at the call site because a reviewer
#: asking "what is governed, and what did we decide not to govern?" should
#: get the answer from one list.
WRITE_PATHS: tuple[WritePath, ...] = (
    # ---- dashboards ----------------------------------------------------
    WritePath(
        "superset.commands.dashboard.update",
        "UpdateDashboardCommand",
        "run",
        GATED,
        "The ordinary dashboard save. Exempt while the dashboard has never "
        "been published, because no viewer can reach a draft (SOW 5.1).",
        _gate_dashboard_update,
        capture=True,
    ),
    WritePath(
        "superset.commands.dashboard.update",
        "UpdateDashboardNativeFiltersCommand",
        "run",
        GATED,
        "Native filters arrive as a diff of one json_metadata list, which "
        "folds into an open draft instead of replacing it (R4-08).",
        _gate_config_diff("native_filter_configuration"),
    ),
    WritePath(
        "superset.commands.dashboard.update",
        "UpdateDashboardChartCustomizationsCommand",
        "run",
        GATED,
        "Chart customizations arrive as a diff, as native filters do.",
        _gate_config_diff("chart_customization_config"),
    ),
    WritePath(
        "superset.commands.dashboard.update",
        "UpdateDashboardColorsConfigCommand",
        "run",
        GATED,
        "A colour change an author made is captured; the same command run "
        "in the background is refused, having no author to attribute it to.",
        _gate_dashboard_colors,
    ),
    WritePath(
        "superset.commands.dashboard.delete",
        "DeleteDashboardCommand",
        "run",
        GATED,
        "Deleting takes the dashboard away from viewers, so it is reviewed "
        "like any other change to what they see.",
        _gate_dashboard_delete,
    ),
    WritePath(
        "superset.commands.dashboard.delete",
        "DeleteEmbeddedDashboardCommand",
        "run",
        GATED,
        "Revoking an embedded config changes who can reach the dashboard.",
        _gate_embedded_delete,
    ),
    WritePath(
        "superset.daos.dashboard",
        "EmbeddedDashboardDAO",
        "upsert",
        GATED,
        "Embedding hands the dashboard to an audience outside Superset's "
        "access control. No command in the host build: the API calls the "
        "DAO inline, so the DAO is the only seam.",
        _gate_embedded_upsert,
        via="method",
    ),
    # ---- charts --------------------------------------------------------
    WritePath(
        "superset.commands.chart.update",
        "UpdateChartCommand",
        "run",
        GATED,
        "The ordinary chart save.",
        _gate_chart_update,
        capture=True,
    ),
    WritePath(
        "superset.commands.chart.delete",
        "DeleteChartCommand",
        "run",
        GATED,
        "Deleting takes the chart away from viewers.",
        _gate_chart_delete,
    ),
    # ---- datasets ------------------------------------------------------
    WritePath(
        "superset.commands.dataset.update",
        "UpdateDatasetCommand",
        "run",
        GATED,
        "The ordinary dataset save, including the editor's column and "
        "metric edits.",
        _gate_dataset_update,
        capture=True,
    ),
    WritePath(
        "superset.commands.dataset.delete",
        "DeleteDatasetCommand",
        "run",
        GATED,
        "Deleting a dataset breaks every chart built on it.",
        _gate_dataset_delete,
    ),
    WritePath(
        "superset.commands.dataset.columns.delete",
        "DeleteDatasetColumnCommand",
        "run",
        REFUSED,
        "A column delete on its own carries nothing an approval could "
        "replay; the dataset editor's save is the reviewable route.",
        _refuse_dataset_column_delete,
    ),
    WritePath(
        "superset.commands.dataset.metrics.delete",
        "DeleteDatasetMetricCommand",
        "run",
        REFUSED,
        "As the column delete above.",
        _refuse_dataset_metric_delete,
    ),
    WritePath(
        "superset.commands.dataset.refresh",
        "RefreshDatasetCommand",
        "run",
        EXEMPT,
        "Sync columns from source does not author a change, it re-reads "
        "what the database already says (SOW 5.2, criterion 5). Refusing it "
        "left no way to do it at all while review was on (129073), so it is "
        "deliberately unbound and applies directly.",
    ),
    # ---- the legacy datasource save -------------------------------------
    WritePath(
        "superset.views.datasource.views",
        "Datasource",
        "save",
        REFUSED,
        "POST /datasource/save/ writes a whole datasource dict onto the "
        "model with no command to bind, so a reviewed dataset could be "
        "changed outright (S-01). Refused rather than captured because its "
        "body is not the dataset command's and could not be replayed. "
        "Deprecated in favour of the gated PUT /api/v1/dataset/<id>, and "
        "nothing in the frontend calls it. This is the path whose route "
        "held the ungated original -- see install.rebind_registered_routes.",
        _refuse_legacy_datasource_save,
        via="method",
    ),
    # ---- Explore's legacy save ------------------------------------------
    WritePath(
        "superset.views.core",
        "Superset",
        "save_or_overwrite_slice",
        GATED,
        "Explore's ?action=overwrite writes through ChartDAO inline, so no "
        "command binding sees it and a reviewed chart could be changed with "
        "nothing held (129068). The view method is the only seam.",
        _gate_legacy_slice_save,
        via="method",
    ),
    # ---- version restore -----------------------------------------------
    WritePath(
        "superset.commands.version_restore",
        "BaseRestoreVersionCommand",
        "run",
        GATED,
        "Restoring republishes old content to viewers, so it is a governed "
        "write like any other.",
        _gate_version_restore,
        validate_first=False,
    ),
    # ---- un-archive ----------------------------------------------------
    # The delete that archived the asset went through review; restoring it
    # put it back in front of viewers on one editor's say-so (QA-17).
    WritePath(
        "superset.commands.dashboard.restore",
        "RestoreDashboardCommand",
        "run",
        GATED,
        "Un-archiving puts the dashboard back in front of viewers (QA-17).",
        _gate_restore,
        validate_first=False,
    ),
    WritePath(
        "superset.commands.chart.restore",
        "RestoreChartCommand",
        "run",
        GATED,
        "Un-archiving puts the chart back in front of viewers (QA-17).",
        _gate_restore,
        validate_first=False,
    ),
    WritePath(
        "superset.commands.dataset.restore",
        "RestoreDatasetCommand",
        "run",
        GATED,
        "Un-archiving puts the dataset back in front of viewers (QA-17).",
        _gate_restore,
        validate_first=False,
    ),
    # ---- imports -------------------------------------------------------
    # Bound ahead of ``run``, not inside ``_import`` where the overwrite
    # actually happens, because every importer's ``run`` wraps its body in
    # "import failed for an unknown reason". Refusing from inside would be
    # swallowed by that, and the person importing would be told nothing
    # about review. Refusing first costs the ordering the other paths have
    # (validate, then gate), which is why the gates read the uuids out of
    # ``contents`` themselves rather than from ``_configs``.
    WritePath(
        "superset.commands.dashboard.importers.v1",
        "ImportDashboardsCommand",
        "run",
        REFUSED,
        "An overwriting import replaces live dashboards with no reviewer "
        "seeing the replacement. Scoped to the collisions the bundle really "
        "has, so a first-time import still works (S-06).",
        _import_gate("dashboard"),
        validate_first=False,
    ),
    WritePath(
        "superset.commands.chart.importers.v1",
        "ImportChartsCommand",
        "run",
        REFUSED,
        "As the dashboard importer above.",
        _import_gate("chart"),
        validate_first=False,
    ),
    WritePath(
        "superset.commands.dataset.importers.v1",
        "ImportDatasetsCommand",
        "run",
        REFUSED,
        "As the dashboard importer above.",
        _import_gate("dataset"),
        validate_first=False,
    ),
    WritePath(
        "superset.commands.importers.v1.assets",
        "ImportAssetsCommand",
        "run",
        REFUSED,
        "An asset bundle replaces everything in it, so every prefix is in "
        "scope.",
        _assets_import_gate,
        validate_first=False,
    ),
    # ---- dataset datetime formats --------------------------------------
    WritePath(
        "superset.datasets.api",
        "DatasetRestApi",
        "detect_datetime_formats",
        REFUSED,
        "No command: the API detects and stores formats inline, so the view "
        "method is the only seam. Not currently served (it is absent from "
        "include_route_methods), bound for whenever it is.",
        _refuse_datetime_format_detection,
        via="method",
    ),
)
