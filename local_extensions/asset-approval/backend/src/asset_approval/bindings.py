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

import functools
import inspect
import logging
from dataclasses import dataclass
from importlib import import_module
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
    ctor_signature,
    has_ever_been_published,
    KWARGS_KEY,
    mark_published,
    remember_signature,
    refuse_import_overwrite,
    refuse_unreviewable_write,
    RESTORE_COMMAND,
    RESTORE_VERSION_COMMAND,
    UPSERT_EMBEDDED_COMMAND,
)
from asset_approval.install import (
    BindingDefect,
    BindingReport,
    gate_method,
    gate_run,
    rebind_registered_routes,
    REVIEW_COMMANDS,
)

try:
    from asset_approval.install import verify_installation
except ImportError:  # install.verify_bindings has not been split yet
    from asset_approval.install import verify_bindings as verify_installation
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
class Uncovered:
    """A branch of a gated write path that the gate does not reach.

    ``GATED`` used to be all a path could say, so a gate that holds the
    ``overwrite`` branch of a save and returns early on every other one was
    reported exactly like a gate that holds the lot. Four rows were filed
    against a path the report called fully covered. A gap is now something a
    path *declares*, with the reason and the row it is filed under, and
    verification fails on one that is not declared.

    The declaration is checked against the path's ``probes`` when the branch
    has one: a probe runs the question the real gate asks of a synthetic call
    down that branch and answers whether the gate takes hold of it. A declared
    gap whose probe now says "held" is stale and fails, so closing a gap means
    deleting its declaration; and a probed branch the gate does not hold that
    nobody declared fails too. A branch with no probe is a statement of fact
    that verification lists but cannot check.
    """

    branch: str
    why: str
    tracked: str


@dataclass(frozen=True)
class WritePath:
    """One governed write path, and how the gate reaches it.

    ``via`` is how the host exposes the write: ``"run"`` for a command,
    whose ``run`` is wrapped, or ``"method"`` for a write that has no
    command in the host build and can only be reached at the method the
    API calls inline.

    ``args`` names the parameters of the command (or method) that the gate
    accounts for -- identities and request bodies, and anything the gate
    reads and captures itself. A command that takes a parameter not named
    here is a write the gate does not know it has, which is how
    ``delete_metric_ids`` and ``preserve_existing_metrics`` came to act on a
    dataset with nothing captured. Verification compares it to the real
    signature, so the next keyword someone adds fails there instead of
    becoming a new escape. Commands bound with ``capture`` have the rest
    captured by default and need name only what comes before it.

    ``uncovered`` and ``probes`` are described on :class:`Uncovered`:
    ``probes`` is every branch of the write that can be exercised, by the name
    ``uncovered`` uses for it, each answering whether the gate takes hold of it.
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
    args: tuple[str, ...] = ()
    uncovered: tuple[Uncovered, ...] = ()
    probes: tuple[tuple[str, Callable[[], bool]], ...] = ()

    @property
    def target(self) -> str:
        return f"{self.class_name}.{self.attr}"


#: How many leading constructor parameters are the asset's identity and the
#: request body rather than arguments: ``(model_id, data)`` on every update
#: command. The body is captured on its own, so everything after them is a
#: keyword the command takes.
IDENTITY_PARAMETERS = 2


def _payload(command: Any) -> dict[str, Any]:
    return getattr(command, "_captured_payload", {}) or {}


#: The attribute the constructor wrapper leaves the call's arguments on.
_ARGUMENTS_ATTR = "_captured_arguments"


def capture_arguments(command_cls: Any) -> None:
    """Snapshot what a command was constructed with, beyond its id and body.

    The gate used to read the one or two arguments it knew about off the
    command's own attributes, which only works for the ones someone
    remembered to look for and that the command happens to keep. This takes
    them from the call itself: every argument the caller passed, by name.
    Wrapped once (the marker), and before ``install.capture_payload`` wraps
    the same constructor, so :func:`~asset_approval.gate.remember_signature`
    can still read the real parameters.
    """
    remember_signature(command_cls)
    original_init = command_cls.__init__
    if getattr(original_init, "__asset_approval_arguments__", False):
        return
    signature = ctor_signature(command_cls)

    @functools.wraps(original_init)
    def patched_init(self: Any, *args: Any, **kwargs: Any) -> None:
        original_init(self, *args, **kwargs)
        try:
            bound = signature.bind(self, *args, **kwargs)
        except TypeError:
            # The original constructor accepted the call, so a mismatch is
            # this module's signature being stale, not the caller's error.
            return
        names = list(signature.parameters)[1 + IDENTITY_PARAMETERS :]
        setattr(
            self,
            _ARGUMENTS_ATTR,
            {n: v for n, v in bound.arguments.items() if n in names},
        )

    patched_init.__asset_approval_arguments__ = True  # type: ignore[attr-defined]
    command_cls.__init__ = patched_init


def _nothing(value: Any) -> bool:
    """Whether a keyword's value is the same as not passing it at all."""
    return value is None or value is False or value == "" or (
        isinstance(value, (list, tuple, set, frozenset, dict)) and not value
    )


def _json_safe(name: str, value: Any) -> Any:
    """A keyword's value as the JSON a capture is stored in.

    A value that cannot be stored cannot be replayed, and a capture that
    approval cannot reproduce is the defect this exists to end. So it is
    refused up front, at the author, rather than discovered at approval.
    """
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, (set, frozenset)):
        return sorted((_json_safe(name, item) for item in value), key=repr)
    if isinstance(value, (list, tuple)):
        return [_json_safe(name, item) for item in value]
    if isinstance(value, dict):
        return {str(k): _json_safe(name, v) for k, v in value.items()}
    refuse_unreviewable_write(
        f"A save that passes {name!r}",
        "Make the change through the editor and save, so it can be reviewed.",
    )
    return None  # review off: the gate never gets here, nothing is stored


def _arguments_of(
    command: Any, *, already_captured: tuple[str, ...] = ()
) -> dict[str, Any]:
    """The ``command_args`` entry for the keywords this command was given.

    Everything the caller passed that differs from the keyword's own default,
    unless the gate captures it elsewhere (``already_captured``). Not a list
    of the keywords someone knew about: a keyword that is not here has to be
    named in ``already_captured`` to be left out, so a new one is captured
    until somebody decides otherwise.
    """
    given = getattr(command, _ARGUMENTS_ATTR, None) or {}
    parameters = ctor_signature(type(command)).parameters
    captured: dict[str, Any] = {}
    for name, value in given.items():
        if name in already_captured:
            continue
        default = getattr(parameters.get(name), "default", inspect.Parameter.empty)
        if default is inspect.Parameter.empty:
            default = None
        if value == default or (_nothing(value) and _nothing(default)):
            continue
        captured[name] = _json_safe(name, value)
    return {KWARGS_KEY: captured} if captured else {}


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
    # Said every boot, and not as an error: a declared gap is known and filed,
    # which is why it does not withhold the promise. It is logged so that a
    # gate which is installed and whole is not mistaken for one that is
    # complete.
    for gap in getattr(report, "partial", ()):
        logger.warning("asset-approval: write path only partly gated -- %s", gap)
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
            if path.capture:
                try:
                    capture_arguments(
                        getattr(import_module(path.module_path), path.class_name)
                    )
                except (ImportError, AttributeError):
                    pass  # ``gate_run`` logs the unresolved path
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
    arguments = _arguments_of(command)

    if not arguments and _only_exempt(model, payload):
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

    # ``fold_fields``: a second save that posts only some of the fields (the
    # Properties dialog never carries ``position_json``) is a statement about
    # those fields. Without it the second save replaced the whole draft and
    # the response still said "Changes updated in your existing draft" (B3).
    # And refined, because the layout is not where that sentence suggests:
    # the dashboard save carries it *inside* ``json_metadata``, so folding by
    # field alone would still replace it.
    gate_write(
        AssetType.DASHBOARD,
        model.id,
        payload,
        command_args=arguments or None,
        fold_fields=_keep_the_layout_the_draft_holds,
    )


def _keep_the_layout_the_draft_holds(
    draft: dict[str, Any], body: dict[str, Any], merged: dict[str, Any]
) -> dict[str, Any]:
    """Correct the plain field-by-field fold for a dashboard's layout.

    The shipped layout save does not send ``position_json``; it sends the
    layout as ``positions`` inside ``json_metadata``, and the server pulls it
    out into the column. The Properties dialog sends nine fields and a
    ``json_metadata`` with no layout in it. Folded field by field, that second
    ``json_metadata`` replaces the first and the author's layout edit is gone,
    which is the defect B3 describes -- by a different route than the one it
    is usually described by, and one that adding ``fold_fields`` alone does
    not close.

    The rule is what the two saves in order would do. Applying a
    ``json_metadata`` merges its keys over what is stored, so a key the later
    save leaves out keeps the earlier one's value, and a layout is replaced
    only by a later save that states one. A later ``position_json`` of its own
    states one; a ``json_metadata`` that is empty states none at all.
    """
    layout = "positions"
    if "json_metadata" not in body:
        # Untouched by this save, so the draft's stands -- unless a raw layout
        # arrived, which would otherwise be overridden by the one in there.
        if "position_json" in body:
            return _without_layout(merged, layout)
        return merged
    if not body["json_metadata"]:
        # Empty is "leave the metadata alone" to the command, so the draft's
        # metadata, layout included, is still what the dashboard will hold.
        if "json_metadata" in draft:
            merged["json_metadata"] = draft["json_metadata"]
        return merged
    drafted, incoming = _metadata_object(draft.get("json_metadata")), _metadata_object(
        body["json_metadata"]
    )
    if (
        drafted is None
        or incoming is None
        or incoming.get(layout) is not None
        or "position_json" in body
        or drafted.get(layout) is None
    ):
        return merged
    carried = {**incoming, layout: drafted[layout]}
    merged["json_metadata"] = (
        carried if isinstance(body["json_metadata"], dict) else json.dumps(carried)
    )
    return merged


def _metadata_object(value: Any) -> dict[str, Any] | None:
    """A ``json_metadata`` value as an object, or ``None`` if it is not one."""
    if isinstance(value, dict):
        return value
    try:
        parsed = json.loads(value) if isinstance(value, str) and value else None
    except (ValueError, TypeError):
        return None
    return parsed if isinstance(parsed, dict) else None


def _without_layout(merged: dict[str, Any], layout: str) -> dict[str, Any]:
    metadata = _metadata_object(merged.get("json_metadata"))
    if metadata is None or layout not in metadata:
        return merged
    stripped = {k: v for k, v in metadata.items() if k != layout}
    merged["json_metadata"] = (
        stripped if isinstance(merged["json_metadata"], dict) else json.dumps(stripped)
    )
    return merged


def _legacy_save_is_held(action: str | None, slc: Any) -> bool:
    """Whether the gate takes hold of this legacy save at all.

    Pulled out of the gate so that verification asks the question the gate
    itself asks, rather than a second copy of it: the ``WritePath`` probes
    call this with each ``action`` and report what comes back.
    """
    return action == "overwrite" and slc is not None and bool(getattr(slc, "id", None))


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

    if not _legacy_save_is_held(action, slc):
        # Not covered, and declared as such on the ``WritePath``: ``saveas``
        # creates a chart and may attach it to a published dashboard (A4).
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
    # ``fold_fields`` for the same reason the command path takes it: this
    # body is the same shape, it reaches the same ``gate_write``, and
    # without it this would be the one chart path that still replaces an
    # open draft wholesale.
    #
    # The dashboard the save names is part of the write. The view attaches the
    # chart to it after the update, which changes that dashboard for its
    # viewers (129069), and a gate that held the rename and forgot the attach
    # let the author be told "Changes saved", the reviewer be shown a rename
    # with no mention of a dashboard, and the join row never be written (B7).
    # Carried with the capture, shown to the reviewer from there, and done on
    # approval (``replay.ChartSaveWithDashboard``).
    gate_write(
        AssetType.CHART,
        slc.id,
        {k: v for k, v in payload.items() if v is not None},
        command_args=_dashboard_the_save_names(request.args),
        fold_fields=True,
    )


def _dashboard_the_save_names(args: Any) -> dict[str, Any] | None:
    """The ``command_args`` for the dashboard a legacy save attaches to, if any.

    Checked here with the view's own rules, as the author, because the gate
    runs *before* the view and so before its checks: a capture that approval
    cannot carry out (the dashboard is gone, or the author cannot edit it)
    would sit pending on the chart's only open slot, and returning to let the
    view answer would let it overwrite the chart first. Refusing is the
    answer the author gets either way; this one says so before anything moved.
    """
    from superset import db, security_manager
    from superset.models.dashboard import Dashboard

    target = args.get("save_to_dashboard_id")
    new_name = args.get("new_dashboard_name")
    if target:
        try:
            dashboard = (
                db.session.query(Dashboard).filter_by(id=int(target)).one_or_none()
            )
        except (TypeError, ValueError):
            dashboard = None
        if dashboard is None or not security_manager.is_editor(dashboard):
            refuse_unreviewable_write(
                "Saving a chart to a dashboard you cannot edit",
                "Ask an editor of that dashboard to add the chart.",
            )
            return None
        return {KWARGS_KEY: {"save_to_dashboard_id": dashboard.id}}
    if new_name:
        if not security_manager.can_access("can_write", "Dashboard"):
            refuse_unreviewable_write(
                "Saving a chart to a new dashboard you cannot create",
                "Ask someone who can create dashboards to do it.",
            )
            return None
        return {KWARGS_KEY: {"new_dashboard_name": str(new_name)}}
    return None


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


def _bundle_configs(
    contents: dict[str, Any], prefixes: list[str]
) -> dict[str, list[dict[str, Any]]]:
    """The configs the bundle carries under each prefix, read from the archive.

    Whole configs rather than just their uuids, because a uuid is not the
    only thing an import binds an asset by -- see
    ``_refuse_if_bundle_lands_on_a_live_asset``.

    Read from ``contents`` rather than from ``command._configs``: the import
    gates are bound with ``validate_first=False``, and ``validate()`` is what
    fills ``_configs`` in. A gate that read them saw an empty bundle on every
    call, so it could only ever decide on the overwrite flag.

    Only the files under a prefix that is in scope are parsed, so the work is
    the part of the bundle the refusal actually depends on.
    """
    import yaml

    found: dict[str, list[dict[str, Any]]] = {prefix: [] for prefix in prefixes}
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
        if isinstance(config, dict):
            found[prefix].append(config)
    return found


def _resolved_for_identity(config: dict[str, Any]) -> dict[str, Any] | None:
    """The config as the importer will hold it when it resolves identity.

    A dataset is identified by ``(database_id, table_name, schema, catalog)``,
    but a bundle names its database by uuid and this gate runs before the
    importer has resolved one to the other. Left unresolved, ``database_id``
    drops out of the predicate and the check would match a table name in
    *any* database -- refusing first-time imports that collide by name alone,
    which is the opposite of S-06.

    ``None`` means this config cannot land on an existing row at all: its
    database is not here yet, so no dataset inside it is either.
    """
    from superset import db
    from superset.models.core import Database

    if "database_uuid" not in config or config.get("database_id") is not None:
        return config
    database_id = (
        db.session.query(Database.id)
        .filter_by(uuid=config["database_uuid"])
        .scalar()
    )
    if database_id is None:
        return None
    return {**config, "database_id": database_id}


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
    from superset.commands.importers.v1.utils import (
        find_existing_by_import_identity,
    )

    models = _prefix_models()
    configs_by_prefix = _bundle_configs(
        getattr(command, "contents", None) or {}, prefixes
    )
    for prefix in prefixes:
        configs = configs_by_prefix.get(prefix) or []
        model_cls = models.get(prefix)
        if not configs or model_cls is None:
            continue

        uuids = [str(config["uuid"]) for config in configs if config.get("uuid")]
        lands = bool(
            uuids
            and db.session.query(model_cls.uuid)
            .filter(model_cls.uuid.in_(uuids))
            .first()
            is not None
        )

        if not lands:
            # A uuid miss is not proof the bundle lands on nothing. The host
            # matches an incoming asset on a disjunction of *every* unique
            # constraint the model declares, so a config carrying a fresh
            # uuid is still matched-and-updated onto a live row through one
            # of the others: a dashboard by its slug, a dataset by its
            # table name within a database.
            #
            # Gating on the uuid alone therefore let exactly that import
            # through ungated, and it replaced the live asset with nobody
            # reviewing the replacement (R5-03). The host ships the lookup
            # that resolves the identity it will really bind, built from the
            # model's own constraint metadata, so the gate asks it rather
            # than keeping a copy of the rules that can drift.
            for config in configs:
                resolved = _resolved_for_identity(config)
                if resolved is None:
                    continue
                if find_existing_by_import_identity(model_cls, resolved) is not None:
                    lands = True
                    break

        if lands:
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
    """Gate a chart edit, folding it onto whatever the author already has open.

    ``fold_fields`` because this one command takes both shapes of body.
    Explore posts every control, so its body asserts the whole chart and
    replacing each field it names is right; the chart Properties dialog
    posts eight fields and the REST and MCP clients post whatever they like,
    and those say nothing at all about the fields they leave out. Replacing
    the stored payload with one of those discarded a captured ``params``
    edit the moment the author renamed the chart.

    Not ``combine``: it would also switch off ``comparable`` in the gate,
    and with it the empty-change test (129076), the baseline (QA-24) and
    R4-01 for every chart.
    """
    # ``normalization_changes`` is version-history bookkeeping, not part of
    # what the save does, and keeps the key the fold already knows it by.
    # Every *other* keyword the command was given is captured and replayed.
    arguments = _arguments_of(command, already_captured=("normalization_changes",))
    if not arguments and _only_exempt(command._model, _payload(command)):
        return
    gate_write(
        AssetType.CHART,
        command._model.id,
        _payload(command),
        command_args={
            "normalization_changes": getattr(
                command, "_normalization_changes", None
            ),
            **arguments,
        },
        fold_fields=True,
    )


def _gate_chart_delete(command: Any) -> None:
    gate_delete(AssetType.CHART, [m.id for m in (command._models or [])])


def _gate_dataset_update(command: Any) -> None:
    """Gate a dataset edit: its body, and every keyword it was given.

    The keywords matter here more than anywhere. ``delete_metric_ids`` is a
    write whose body is empty, so there is no diff for anything to hold
    (A12); ``preserve_existing_metrics`` decides whether the metrics list in
    the body replaces the dataset's metrics or adds to them, and a replay
    without it deleted every metric the author never mentioned (B2);
    ``override_columns`` decides whether the columns are replaced and
    refreshed. All three, and any keyword added later, are captured by
    :func:`_arguments_of` and handed back on approval.

    ``fold_fields`` because the dataset editor posts the fields of the tab
    the author was on, and a second save is a statement about those, not a
    replacement for the first (B3). Two saves with different keywords are
    not folded -- see :func:`~asset_approval.gate._same_kind`.
    """
    arguments = _arguments_of(command)
    if not arguments and _only_exempt(command._model, _payload(command)):
        return
    gate_write(
        AssetType.DATASET,
        command._model.id,
        _payload(command),
        command_args=arguments or None,
        fold_fields=True,
    )


def _gate_dataset_delete(command: Any) -> None:
    gate_delete(AssetType.DATASET, [m.id for m in (command._models or [])])


class _ExistingChart:
    """A stand-in for a saved chart, which is all a probe needs of one."""

    id = 1


def _saving_as(action: str) -> Callable[[], bool]:
    """A probe: does the legacy-save gate take hold of this ``action``?"""
    return lambda: _legacy_save_is_held(action, _ExistingChart())


#: What every importer shares: the refusal fires only for a bundle that lands
#: on a live asset, so one that creates new assets is not touched at all.
_IMPORT_CREATES = Uncovered(
    "an import whose assets do not exist yet",
    "Scoped to collisions so a first-time import still works (S-06), which "
    "means a bundle carrying published: true creates a live, published "
    "dashboard with its charts and no request is ever made. The gate cannot "
    "represent a creation (D1), so there is no row to add.",
    "A6, D1",
)

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
        args=("model_id", "data"),
    ),
    WritePath(
        "superset.commands.dashboard.update",
        "UpdateDashboardNativeFiltersCommand",
        "run",
        GATED,
        "Native filters arrive as a diff of one json_metadata list, which "
        "folds into an open draft instead of replacing it (R4-08).",
        _gate_config_diff("native_filter_configuration"),
        args=("model_id", "data"),
    ),
    WritePath(
        "superset.commands.dashboard.update",
        "UpdateDashboardChartCustomizationsCommand",
        "run",
        GATED,
        "Chart customizations arrive as a diff, as native filters do.",
        _gate_config_diff("chart_customization_config"),
        args=("model_id", "data"),
    ),
    WritePath(
        "superset.commands.dashboard.update",
        "UpdateDashboardColorsConfigCommand",
        "run",
        GATED,
        "A colour change an author made is captured; the same command run "
        "in the background is refused, having no author to attribute it to.",
        _gate_dashboard_colors,
        args=("model_id", "data", "mark_updated"),
    ),
    WritePath(
        "superset.commands.dashboard.delete",
        "DeleteDashboardCommand",
        "run",
        GATED,
        "Deleting takes the dashboard away from viewers, so it is reviewed "
        "like any other change to what they see.",
        _gate_dashboard_delete,
        args=("model_ids",),
    ),
    WritePath(
        "superset.commands.dashboard.delete",
        "DeleteEmbeddedDashboardCommand",
        "run",
        GATED,
        "Revoking an embedded config changes who can reach the dashboard.",
        _gate_embedded_delete,
        args=("dashboard",),
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
        args=("dashboard", "allowed_domains"),
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
        args=("model_id", "data"),
    ),
    WritePath(
        "superset.commands.chart.delete",
        "DeleteChartCommand",
        "run",
        GATED,
        "Deleting takes the chart away from viewers.",
        _gate_chart_delete,
        args=("model_ids",),
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
        args=("model_id", "data"),
    ),
    WritePath(
        "superset.commands.dataset.delete",
        "DeleteDatasetCommand",
        "run",
        GATED,
        "Deleting a dataset breaks every chart built on it.",
        _gate_dataset_delete,
        args=("model_ids",),
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
        "nothing held (129068). The view method is the only seam. PARTIAL: "
        "only the overwrite branch is held -- see ``uncovered``.",
        _gate_legacy_slice_save,
        via="method",
        probes=(
            ("action=overwrite", _saving_as("overwrite")),
            ("action=saveas", _saving_as("saveas")),
        ),
        uncovered=(
            Uncovered(
                "action=saveas",
                "Creates a chart, and with save_to_dashboard_id or "
                "new_dashboard_name attaches it to the dashboard named, "
                "published or not. The gate returns early unless the action "
                "is overwrite, and a creation is not something it can "
                "represent (D1).",
                "A4, A5, D1",
            ),
        ),
        args=(
            "slc",
            "slice_add_perm",
            "slice_overwrite_perm",
            "slice_download_perm",
            "datasource_id",
            "datasource_type",
            "datasource_name",
            "query_context",
        ),
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
        args=("entity_uuid", "version_uuid"),
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
        args=("model_uuid",),
    ),
    WritePath(
        "superset.commands.chart.restore",
        "RestoreChartCommand",
        "run",
        GATED,
        "Un-archiving puts the chart back in front of viewers (QA-17).",
        _gate_restore,
        validate_first=False,
        args=("model_uuid",),
    ),
    WritePath(
        "superset.commands.dataset.restore",
        "RestoreDatasetCommand",
        "run",
        GATED,
        "Un-archiving puts the dataset back in front of viewers (QA-17).",
        _gate_restore,
        validate_first=False,
        args=("model_uuid",),
    ),
    # ---- imports -------------------------------------------------------
    # Bound ahead of ``run``, not inside ``_import`` where the overwrite
    # actually happens, because every importer's ``run`` wraps its body in
    # "import failed for an unknown reason". Refusing from inside would be
    # swallowed by that, and the person importing would be told nothing
    # about review. Refusing first costs the ordering the other paths have
    # (validate, then gate), which is why the gates read the configs out of
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
        uncovered=(_IMPORT_CREATES,),
    ),
    WritePath(
        "superset.commands.chart.importers.v1",
        "ImportChartsCommand",
        "run",
        REFUSED,
        "As the dashboard importer above.",
        _import_gate("chart"),
        validate_first=False,
        uncovered=(_IMPORT_CREATES,),
    ),
    WritePath(
        "superset.commands.dataset.importers.v1",
        "ImportDatasetsCommand",
        "run",
        REFUSED,
        "As the dashboard importer above.",
        _import_gate("dataset"),
        validate_first=False,
        uncovered=(_IMPORT_CREATES,),
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
        uncovered=(_IMPORT_CREATES,),
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


# ---- what the gate covers, as opposed to whether it is installed ---------


@dataclass(frozen=True)
class PartialCoverage:
    """A declared gap in a gated path, as verification reports it."""

    target: str
    branch: str
    why: str
    tracked: str
    probed: bool

    def __str__(self) -> str:
        checked = "probed" if self.probed else "not probed"
        return f"{self.target} [{self.branch}] ({self.tracked}; {checked})"


@dataclass(frozen=True)
class CoverageReport(BindingReport):
    """``BindingReport``, plus what the gated paths do not cover.

    ``ok`` keeps its meaning -- everything declared is bound as declared, and
    every gap is declared -- and so can be true while writes still escape
    review through a gap somebody has written down. That is exactly the case
    the old report could not tell apart from a clean one, so it gets a name:
    ``complete`` is true only when there is nothing to declare.
    """

    partial: tuple[PartialCoverage, ...] = ()

    @property
    def complete(self) -> bool:
        return self.ok and not self.partial

    def summary(self) -> str:
        paths = {gap.target for gap in self.partial}
        return (
            f"declared={self.declared} verified={self.verified} "
            f"partial={len(paths)} gaps={len(self.partial)} "
            f"defects={len(self.defects)} ok={self.ok} complete={self.complete}"
        )


def _all_subclasses(cls: type) -> list[type]:
    found: list[type] = []
    pending = list(cls.__subclasses__())
    while pending:
        sub = pending.pop()
        if sub not in found:
            found.append(sub)
            pending.extend(sub.__subclasses__())
    return found


def _resolve_host(path: WritePath) -> Any | None:
    try:
        return getattr(import_module(path.module_path), path.class_name, None)
    except ImportError:
        return None


def _hidden_behind_before_request(host: Any, attr: str) -> bool:
    """Whether Flask-AppBuilder wraps this method's route in a hook.

    A ``before_request`` on a view or API class makes FAB register a closure
    over the handler instead of the handler, and the closure holds the
    ungated original where ``install.rebind_registered_routes`` and the route
    check cannot see it. It is S-01's shape, and the only reason it is not
    open today is that none of the classes this gate binds by method carries
    one. Read off the class dictionaries so no descriptor is run.
    """
    for klass in getattr(host, "__mro__", ()):
        for value in vars(klass).values():
            if getattr(value, "_before_request_hook", False) is not True:
                continue
            only = getattr(value, "_before_request_only", None)
            if only is None or attr in only:
                return True
    return False


def _method_parameters(host: Any, attr: str) -> list[inspect.Parameter]:
    function = inspect.unwrap(getattr(host, attr))
    return [
        parameter
        for name, parameter in inspect.signature(function).parameters.items()
        if name != "self"
    ]


def _unaccounted_arguments(path: WritePath, host: Any) -> list[str]:
    """Parameters the gate neither names nor captures by default."""
    if path.via == "method":
        parameters = _method_parameters(host, path.attr)
    else:
        parameters = [
            parameter
            for name, parameter in ctor_signature(host).parameters.items()
            if name != "self"
        ]
    variadic = [
        p.name
        for p in parameters
        if p.kind in (inspect.Parameter.VAR_POSITIONAL, inspect.Parameter.VAR_KEYWORD)
    ]
    if variadic:
        # Anything can arrive through these and nothing can be audited.
        return variadic
    names = [parameter.name for parameter in parameters]
    accounted = set(path.args)
    if path.capture and path.via == "run":
        accounted |= set(names)  # identity by position, the rest captured
    return [name for name in names if name not in accounted]


def _coverage_of(  # noqa: C901
    path: WritePath,
) -> tuple[list[BindingDefect], list[PartialCoverage]]:
    """What one path's gate covers, against what the path says it covers."""
    defects: list[BindingDefect] = []
    declared = {gap.branch: gap for gap in path.uncovered}
    probes = dict(path.probes)

    for name, probe in probes.items():
        try:
            held = bool(probe())
        except Exception as ex:  # noqa: BLE001 -- a broken probe is a finding
            defects.append(
                BindingDefect(path.target, f"the probe for {name!r} failed: {ex!r}")
            )
            continue
        if held and name in declared:
            defects.append(
                BindingDefect(
                    path.target,
                    f"{name!r} is declared uncovered but the gate now holds it; "
                    "drop the declaration",
                )
            )
        elif not held and name not in declared:
            defects.append(
                BindingDefect(
                    path.target,
                    f"{name!r} is not covered by the gate and is not declared "
                    "uncovered; that branch of the write path is UNGATED",
                )
            )

    host = _resolve_host(path)
    if host is not None and path.gate is not None:
        if path.disposition == GATED:
            try:
                unaccounted = _unaccounted_arguments(path, host)
            except (TypeError, ValueError, AttributeError):
                unaccounted = []
            if unaccounted:
                defects.append(
                    BindingDefect(
                        path.target,
                        f"takes {', '.join(unaccounted)}, which the gate neither "
                        "names nor captures; a write that acts through it is "
                        "UNGATED",
                    )
                )
        if (
            path.via == "method"
            and "route: before_request" not in declared
            and _hidden_behind_before_request(host, path.attr)
        ):
            defects.append(
                BindingDefect(
                    path.target,
                    f"{path.class_name} carries a before_request hook, so its "
                    "route holds a closure over the original and cannot be "
                    "rebound or verified; that route is UNGATED",
                )
            )
        if path.via == "run":
            defects.extend(_unguarded_subclasses(path, host))

    partial = [
        PartialCoverage(
            path.target, gap.branch, gap.why, gap.tracked, gap.branch in probes
        )
        for gap in path.uncovered
    ]
    return defects, partial


def _unguarded_subclasses(path: WritePath, host: Any) -> list[BindingDefect]:
    """Host subclasses that replace ``run`` without going through the gated one.

    The gate wraps ``host.run``. A subclass that defines its own ``run`` and
    does not call ``super().run()`` never reaches it, and unless that
    subclass is itself a declared path it is a write the table does not
    mention.
    """
    declared = {(p.module_path, p.class_name) for p in WRITE_PATHS}
    found: list[BindingDefect] = []
    for sub in _all_subclasses(host):
        if "run" not in vars(sub) or not sub.__module__.startswith("superset."):
            continue
        if (sub.__module__, sub.__name__) in declared:
            continue
        try:
            delegates = "super().run(" in inspect.getsource(vars(sub)["run"])
        except (OSError, TypeError):
            delegates = False
        if not delegates:
            found.append(
                BindingDefect(
                    f"{sub.__name__}.run",
                    f"overrides {path.class_name}.run without calling it, so the "
                    "gate bound there is bypassed; that write is UNGATED",
                )
            )
    return found


def verify_bindings(app: Any | None = None, declared: Any = None) -> CoverageReport:
    """Check the gate is installed as declared **and** says what it covers.

    ``install.verify_bindings`` answers the first: is something wrapped where
    the table says. It could not answer the second, because a path had no way
    to say "gated, but only on the overwrite branch" and the check asked only
    whether *a* wrapper was present -- so ``save_or_overwrite_slice`` reported
    clean while two filed defects sat on a branch it returns early on.

    This runs that check and adds the second:

    * every probed branch of a path is either held, or declared uncovered
      (and a declared gap the gate has since closed is stale and fails);
    * every parameter of a gated command is accounted for, so a keyword added
      to a command is a failure here until it is captured or named;
    * a method-gated route is not hidden behind a ``before_request`` closure;
    * a host subclass does not replace ``run`` without delegating.

    Declared gaps do not fail the run -- they are listed, counted and make
    ``complete`` false -- because they are known and filed; an undeclared one
    does, because that is the report over-reporting again.
    """
    base = verify_installation(app, declared)
    paths = list(WRITE_PATHS if declared is None else declared)
    defects = list(base.defects)
    partial: list[PartialCoverage] = []
    for path in paths:
        found, gaps = _coverage_of(path)
        defects.extend(found)
        partial.extend(gaps)
    broken = {defect.target for defect in defects}
    verified = sum(1 for path in paths if path.target not in broken)
    return CoverageReport(
        declared=len(paths),
        verified=verified,
        defects=tuple(defects),
        partial=tuple(partial),
    )
