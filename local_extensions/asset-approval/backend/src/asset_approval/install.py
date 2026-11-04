"""Binding the review gate to Superset's write paths from outside Superset.

The host offers no seam for this. Nothing in ``superset_core`` lets an
extension observe, let alone refuse, a write: the only lifecycle callbacks
it exposes are for background tasks. So this module wraps the commands
directly, in the process, at import time.

That is monkeypatching and it is named as such. It works because an
extension's backend is imported into the running app
(``init_extensions`` -> ``eager_import``), which gives it the same reach the
Preset shell already takes. What it costs is a binding per write path that
breaks silently if the host moves a signature. How many there are is not a
number to carry in prose: it is whatever ``bindings.WRITE_PATHS`` declares,
which is the table ``install_bindings`` drives off and ``verify_bindings``
checks.

Every wrapper has the same shape, because every call site in the host build
has the same shape: validate first, so a caller with no rights still gets
the plain permission denial, then gate, then the original body. The host
validates again inside its own ``run``; that repeated lookup is the price
of not reaching into command internals.

A declared write-guard contribution in the framework would replace this
entire module with one manifest entry. Until then, this is the evidence of
what that contribution has to be able to express.
"""

from __future__ import annotations

import functools
import inspect
import logging
from copy import deepcopy
from dataclasses import dataclass
from functools import lru_cache
from importlib import import_module
from typing import Any, Callable, Iterable, Sequence

logger = logging.getLogger(__name__)

#: Set on the wrapped commands so replay can rebuild the right one. The host
#: build declares these as class attributes; an extension has to put them
#: there itself, and ``replay`` reads them back.
REVIEW_COMMANDS: dict[tuple[str, str], str] = {
    ("superset.commands.dashboard.update", "UpdateDashboardNativeFiltersCommand"): "native_filters",
    ("superset.commands.dashboard.update", "UpdateDashboardChartCustomizationsCommand"): "chart_customizations",
    ("superset.commands.dashboard.update", "UpdateDashboardColorsConfigCommand"): "colors",
    ("superset.commands.dashboard.delete", "DeleteEmbeddedDashboardCommand"): "delete_embedded",
}

_patched: list[str] = []

#: ``(class name, attribute, original function, patched function)`` for every
#: method gate, so ``rebind_registered_routes`` can find a route still holding
#: the original. See that function for why one is needed.
_method_gates: list[tuple[str, str, Any, Any]] = []


def _gate_applies() -> bool:
    """Whether to consult the gate for this call at all.

    With review off the wrapper has to be completely transparent, not
    merely harmless: the closures read a command's state as they build
    the gate's arguments, and on an unvalidated command there is none to
    read. During an approved replay the same holds -- the gate would
    no-op, but pre-validating would still cost a second permission check
    on a write already reviewed.

    The module is imported on use rather than at module scope so that
    patching ``gate.is_enabled`` is seen here too.
    """
    gate = import_module("asset_approval.gate")
    return gate.is_enabled() and not gate.is_replaying()


def _as_declared(host_cls: Any, attr: str, func: Callable[..., Any]) -> Any:
    """Re-wrap ``func`` the way the host declared the method it replaces.

    A DAO's ``upsert`` is a ``staticmethod`` and an API's view method is a
    plain one; putting a bare function where a ``staticmethod`` was would
    silently turn the class into the first argument.
    """
    for klass in host_cls.__mro__:
        if attr in klass.__dict__:
            declared = klass.__dict__[attr]
            if isinstance(declared, staticmethod):
                return staticmethod(func)
            if isinstance(declared, classmethod):
                return classmethod(func)
            break
    return func


def _already_gated(func: Any) -> bool:
    """Whether this callable is a wrapper installed earlier.

    Binding is idempotent because it has to be: the entrypoint binds at
    import time, which happens once, while the app it binds into can be
    built more than once in the same process -- every test module gets a
    fresh app. Wrapping a wrapper would gate the same write twice and
    capture it twice.
    """
    return bool(getattr(func, "__asset_approval_gate__", False))


@lru_cache(maxsize=None)
def _revalidates_on_the_class(command_cls: type) -> bool:
    """Whether this command's ``run`` calls ``super().validate()``.

    An instance attribute shadows ``self.validate()`` and nothing else.
    ``super().validate()`` resolves on the MRO, walks straight past the
    shadow, and validates a second time -- which is only a problem because
    validating is not idempotent.

    Read off the source rather than kept as a list of class names, so a
    command that starts doing this is covered the day it does.
    """
    try:
        source = inspect.getsource(command_cls.run)
    except (OSError, TypeError):  # a C function, or no source on disk
        return False
    return "super().validate()" in source


def _validate_once(command: Any) -> None:
    """Validate ahead of the gate, and let the host's own call stand down.

    The gate has to run after the command's authorization checks, or a
    caller with no rights would be told their change is awaiting review
    instead of being refused. The host then validates again inside
    ``run``, and validating twice is not the same as validating once:
    ``validate`` rewrites ``_properties`` in place -- resolving editor ids
    into ``Subject`` objects, popping tags and ``database_id`` -- so the
    second pass reads its own output, and it re-runs the permission
    lookups, which the host's own tests count.

    So it is validated once, here, and the instance's ``validate`` is
    replaced with one that returns that same result. The host's ``run``
    then proceeds on exactly the state its own call would have left.
    Commands are built per request and run once, so shadowing the method
    on the instance ends with the object.

    Two commands defeat that shadow by calling ``super().validate()`` --
    the native-filter and chart-customization updates. For them the second
    pass read the first pass's output and handed already-resolved
    ``Subject`` objects back to the resolver, so an author who opened the
    filter modal and saved without editing anything got a 422 and a
    ``can't adapt type 'Subject'`` in the log. Nothing was lost, because
    the write was a no-op either way, but the author was shown an error
    for doing nothing. They are given back the request they arrived with
    instead, and allowed to validate again from it: wasteful, and correct,
    which is the trade the fallback below already accepts.
    """
    if _revalidates_on_the_class(type(command)):
        try:
            untouched = deepcopy(getattr(command, "_properties", None))
        except Exception:  # noqa: BLE001 -- not copyable, so not restorable
            untouched = None
        command.validate()
        if untouched is not None:
            command._properties = untouched
        return

    result = command.validate()

    def already_validated(*_args: Any, **_kwargs: Any) -> Any:
        return result

    try:
        command.validate = already_validated
    except AttributeError:
        # A command that will not take an instance attribute validates
        # twice, as it did before. Correct, just wasteful.
        logger.debug(
            "asset-approval: %s validates twice", type(command).__name__
        )


def _resolve(module_path: str, class_name: str) -> Any | None:
    try:
        return getattr(import_module(module_path), class_name)
    except (ImportError, AttributeError):
        logger.warning(
            "asset-approval: %s.%s not found; that write path is UNGATED",
            module_path,
            class_name,
        )
        return None


def capture_payload(command_cls: Any) -> None:
    """Snapshot the request body before the command consumes it.

    ``validate`` folds subjects in and ``run`` pops tags and re-serializes
    position_json, so a copy taken later is not the request the author made
    -- and replay has to re-invoke this command with exactly that request.
    """
    original_init = command_cls.__init__

    def patched_init(self, *args: Any, **kwargs: Any) -> None:
        original_init(self, *args, **kwargs)
        data = args[1] if len(args) > 1 else kwargs.get("data")
        if isinstance(data, dict):
            self._captured_payload = dict(data)
        elif not hasattr(self, "_captured_payload"):
            self._captured_payload = {}

    command_cls.__init__ = patched_init


def gate_run(
    module_path: str,
    class_name: str,
    gate: Callable[[Any], None],
    *,
    capture: bool = False,
    validate_first: bool = True,
    permit: bool = True,
    after: Callable[[Any, Any], None] | None = None,
) -> None:
    """Run ``gate`` between the command's validation and its body.

    ``validate_first`` is off for the importers, whose ``run`` validates a
    bundle rather than an asset and whose refusal depends only on whether
    the import would overwrite.

    ``permit``: whether the body, once the gate has looked at the write and
    returned without capturing it, runs inside :func:`gate.permitted`. That is
    what "a declared gate is on the stack" means to the deny-by-default
    guard. It is off for a path whose gate returning means *not applicable*
    rather than *approved* (an importer that finds no collision, a creation),
    so the guard keeps watching what those go on to write.

    ``after`` is called with the command and what ``run`` returned, outside
    the permit, and may raise a review signal: a creation has already
    happened by then, which is the point.
    """
    command_cls = _resolve(module_path, class_name)
    if command_cls is None:
        return

    if _already_gated(command_cls.run):
        return

    if capture:
        capture_payload(command_cls)

    original_run = command_cls.run

    def patched_run(self: Any, *args: Any, **kwargs: Any) -> Any:
        if not _gate_applies():
            return original_run(self, *args, **kwargs)
        if validate_first:
            _validate_once(self)
        gate(self)
        if permit:
            with import_module("asset_approval.gate").permitted(
                f"{class_name}.run"
            ):
                result = original_run(self, *args, **kwargs)
        else:
            result = original_run(self, *args, **kwargs)
        if after is not None:
            after(self, result)
        return result

    functools.update_wrapper(patched_run, original_run)
    patched_run.__asset_approval_gate__ = True  # type: ignore[attr-defined]
    command_cls.run = patched_run
    _patched.append(f"{class_name}.run")


def gate_function(module_path: str, func_name: str, gate: Callable[..., None]) -> None:
    """Run ``gate`` before a module-level function (the importers)."""
    try:
        module = import_module(module_path)
    except ImportError:
        logger.warning("asset-approval: %s not importable; UNGATED", module_path)
        return

    original = getattr(module, func_name, None)
    if original is None:
        logger.warning("asset-approval: %s.%s missing; UNGATED", module_path, func_name)
        return
    if _already_gated(original):
        return

    def patched(*args: Any, **kwargs: Any) -> Any:
        if _gate_applies():
            gate(*args, **kwargs)
        return original(*args, **kwargs)

    functools.update_wrapper(patched, original)
    patched.__asset_approval_gate__ = True  # type: ignore[attr-defined]
    setattr(module, func_name, patched)
    _patched.append(f"{module_path}.{func_name}")


def gate_method(
    module_path: str,
    class_name: str,
    attr: str,
    gate: Callable[..., None],
    permit: bool = True,
) -> None:
    """Run ``gate`` before a static method on a host class (the DAOs).

    Some governed writes have no command of their own in the host build:
    the embedded-config upsert happens inline in the dashboard API, which
    calls straight into the DAO. There is nothing to wrap but the DAO, so
    the gate sees the call's own arguments rather than a command instance.
    """
    host_cls = _resolve(module_path, class_name)
    if host_cls is None:
        return

    original = getattr(host_cls, attr, None)
    if original is None:
        logger.warning(
            "asset-approval: %s.%s missing; that write path is UNGATED",
            class_name,
            attr,
        )
        return
    if _already_gated(original):
        return

    def patched(*args: Any, **kwargs: Any) -> Any:
        if not _gate_applies():
            return original(*args, **kwargs)
        gate(*args, **kwargs)
        if not permit:
            return original(*args, **kwargs)
        with import_module("asset_approval.gate").permitted(
            f"{class_name}.{attr}"
        ):
            return original(*args, **kwargs)

    functools.update_wrapper(patched, original)
    patched.__asset_approval_gate__ = True  # type: ignore[attr-defined]
    setattr(host_cls, attr, _as_declared(host_cls, attr, patched))
    _patched.append(f"{class_name}.{attr}")
    _method_gates.append((class_name, attr, original, patched))


def _permitting(original: Callable[..., Any], reason: str) -> Callable[..., Any]:
    """``original``, run inside :func:`gate.permitted` and nothing else."""

    @functools.wraps(original)
    def permitted_call(*args: Any, **kwargs: Any) -> Any:
        with import_module("asset_approval.gate").permitted(reason):
            return original(*args, **kwargs)

    permitted_call.__asset_approval_permit__ = True  # type: ignore[attr-defined]
    return permitted_call


def permit_run(module_path: str, class_name: str, attr: str = "run") -> None:
    """Let a declared internal writer through the deny-by-default guard.

    For a path that is not someone editing an asset and so has no gate to
    declare -- today the dataset resync, which re-reads what the source
    already says, and the operator's force-purge. Deliberately a different
    marker from a gate's: ``verify_installation`` still reports an exempt path
    that grew a *gate* as drift, and reports one declared to be permitted that
    is not as a defect, because it would then be refused.
    """
    host_cls = _resolve(module_path, class_name)
    if host_cls is None:
        return
    original = getattr(host_cls, attr, None)
    if original is None or getattr(original, "__asset_approval_permit__", False):
        return
    setattr(
        host_cls,
        attr,
        _as_declared(host_cls, attr, _permitting(original, f"{class_name}.{attr}")),
    )
    _patched.append(f"{class_name}.{attr} (permitted)")


def permit_function(module_path: str, func_name: str) -> None:
    """:func:`permit_run` for a module-level function."""
    try:
        module = import_module(module_path)
    except ImportError:
        logger.warning("asset-approval: %s not importable; UNPERMITTED", module_path)
        return
    original = getattr(module, func_name, None)
    if original is None or getattr(original, "__asset_approval_permit__", False):
        return
    setattr(module, func_name, _permitting(original, func_name))
    _patched.append(f"{func_name} (permitted)")


def install_flush_guard() -> None:
    """Bind the deny-by-default guard to the SQLAlchemy ``Session`` class.

    The class, not ``db.session``: every session the process makes is subject
    to it, so a tool holding a bare session is no different from a command.
    Idempotent, as every binding here has to be.
    """
    from sqlalchemy import event
    from sqlalchemy.orm import Session

    gate = import_module("asset_approval.gate")
    for name, listener in gate.GUARD_LISTENERS:
        if not event.contains(Session, name, listener):
            event.listen(Session, name, listener)
    # Said every boot, so an operator reading the log can tell a guard that is
    # on from one that was switched off (or one whose flag is misspelt).
    if gate.unlisted_writes_allowed():
        logger.warning(
            "asset-approval config: FEATURE_FLAGS[%r] = True, so the "
            "deny-by-default guard is OFF: only writes the gate names are held",
            gate.ALLOW_UNLISTED_FLAG,
        )
    else:
        logger.info(
            "asset-approval config: FEATURE_FLAGS[%r] is not set, so a write to "
            "a governed asset that no gate declared is refused",
            gate.ALLOW_UNLISTED_FLAG,
        )


def flush_guard_defects() -> list["BindingDefect"]:
    """Listeners the guard needs that are not bound right now."""
    from sqlalchemy import event
    from sqlalchemy.orm import Session

    return [
        BindingDefect(
            "deny-by-default guard",
            f"the {name} listener is not bound to the Session; an unlisted "
            "write to a governed asset is UNGUARDED",
        )
        for name, listener in import_module("asset_approval.gate").GUARD_LISTENERS
        if not event.contains(Session, name, listener)
    ]


def rebind_registered_routes(app: Any) -> list[str]:
    """Repoint Flask routes that captured a method before we gated it.

    Patching a class is enough for anything resolved at call time, which is
    every command and DAO here. It is not enough for a method Flask-AppBuilder
    has already turned into a route: ``BaseView.create_blueprint`` does
    ``attr = getattr(self, attr_name)`` and registers that **bound method
    object**, and ``init_views()`` runs before
    ``init_all_dependencies_and_extensions()``. By the time an extension
    patches the class, the route is holding the original and keeps calling it.

    ``POST /datasource/save/`` was bound this way (S-01). The gate installed,
    ``patched_targets()`` reported it, the class attribute really was wrapped
    -- and the route wrote a governed dataset with no review, because the
    route was not looking at the class attribute any more.

    The tests did not catch it because the suite installs the bindings before
    it builds the app, which is the opposite of the production order.

    Returns the endpoints it repaired, for the log line.
    """
    rebound: list[str] = []
    view_functions = getattr(app, "view_functions", {})
    for endpoint, view in list(view_functions.items()):
        underlying = getattr(view, "__func__", None)
        instance = getattr(view, "__self__", None)
        if underlying is None or instance is None:
            # Not a bound method: either a plain function route or one
            # Flask-AppBuilder wrapped in before-request hooks, which closes
            # over the handler where we cannot reach it.
            continue
        for class_name, attr, original, patched in _method_gates:
            if underlying is not original:
                continue
            view_functions[endpoint] = _rebound(patched, instance)
            rebound.append(endpoint)
            logger.info(
                "asset-approval: rebound %s -- the route held the ungated "
                "%s.%s",
                endpoint,
                class_name,
                attr,
            )
            break
    return rebound


def _rebound(patched: Callable[..., Any], instance: Any) -> Callable[..., Any]:
    """``patched`` bound to the view instance the route was registered with."""

    @functools.wraps(patched)
    def call(*args: Any, **kwargs: Any) -> Any:
        return patched(instance, *args, **kwargs)

    call.__asset_approval_gate__ = True  # type: ignore[attr-defined]
    return call


def patched_targets() -> list[str]:
    return list(_patched)


@dataclass(frozen=True)
class BindingDefect:
    """One declared write path that is not bound the way it is declared."""

    target: str
    reason: str

    def __str__(self) -> str:
        return f"{self.target}: {self.reason}"


@dataclass(frozen=True)
class BindingReport:
    """What verification found, counted against a declared denominator.

    ``patched_targets()`` could not answer "is every governed write path
    bound right now?" because it only records the ``setattr`` calls that
    succeeded: a path nobody tried to bind, and a path rebound away
    afterwards, both read as fine. This has a denominator -- the declared
    table -- so a missing path is a defect rather than an absence.
    """

    declared: int
    verified: int
    defects: tuple[BindingDefect, ...]

    @property
    def ok(self) -> bool:
        return not self.defects


def _declared_paths() -> Sequence[Any]:
    """``bindings.WRITE_PATHS``, imported late to keep the two modules apart.

    ``bindings`` imports this module, so the table cannot be imported at
    module scope here.
    """
    from asset_approval.bindings import WRITE_PATHS

    return WRITE_PATHS


def verify_installation(
    app: Any | None = None, declared: Iterable[Any] | None = None
) -> BindingReport:
    """Check that every declared write path is bound the way it is declared.

    Reports rather than raises. A defect means some governed write is
    unprotected, and the caller's answer to that is to withhold the promise
    to core so writes are refused -- not to abort the import, which the host
    logs and skips, leaving the feature on with nothing behind it (QA-12).

    Three checks, the third being the one that matters:

    * the target still resolves, so a class the host renamed is a defect
      rather than a warning nobody reads;
    * what sits on the class is the gate's wrapper and not the original,
      and an ``EXEMPT`` path is *not* wrapped, since an exemption that
      quietly became a gate is also a drift;
    * no route in ``app.view_functions`` still points at a function the gate
      replaced. This is S-01 read backwards. There the class really was
      patched and the route was not, so every class-side check passed while
      ``POST /datasource/save/`` wrote a reviewed dataset outright. Walking
      the routes and matching against what we replaced would have caught it
      at boot, which nothing could do before.
    """
    paths = list(_declared_paths() if declared is None else declared)
    defects: list[BindingDefect] = []
    verified = 0

    for path in paths:
        defect = _verify_one(path)
        if defect is None:
            verified += 1
        else:
            defects.append(defect)

    defects.extend(_route_defects(app))
    if declared is None:
        defects.extend(flush_guard_defects())

    return BindingReport(
        declared=len(paths), verified=verified, defects=tuple(defects)
    )


def _verify_one(path: Any) -> BindingDefect | None:
    """Whether one declared path is installed as its disposition says."""
    target = path.target
    try:
        module = import_module(path.module_path)
    except (ImportError, AttributeError):
        # The same pair ``_resolve`` treats as "the host has moved this",
        # so a path reads the same here as it did when it was bound.
        return BindingDefect(target, f"{path.module_path} is not importable")

    host = getattr(module, path.class_name, None)
    if host is None:
        return BindingDefect(
            target, f"{path.class_name} is not in {path.module_path}"
        )

    # A module-level function is its own installed object.
    installed = host if getattr(path, "via", "run") == "function" else (
        getattr(host, path.attr, None)
    )
    if installed is None:
        return BindingDefect(target, f"{path.class_name} has no {path.attr}")

    gated = _already_gated(installed)
    if path.gate is None:
        if getattr(path, "permits_writes", False):
            if not getattr(installed, "__asset_approval_permit__", False):
                return BindingDefect(
                    target,
                    "declared as a permitted internal writer but nothing "
                    "permits it; the deny-by-default guard will refuse its "
                    "writes",
                )
            return None
        # Declared exempt, so nothing should be wrapped. An exemption that
        # has grown a gate refuses a write the SOW says is allowed, which is
        # how the dataset resync became unreachable (129073).
        if gated:
            return BindingDefect(
                target, "declared exempt but a gate is installed on it"
            )
        return None

    if not gated:
        return BindingDefect(
            target,
            f"declared {path.disposition} but the original is still "
            "installed; that write path is UNGATED",
        )
    return None


def _route_defects(app: Any | None) -> list[BindingDefect]:
    """Routes still holding a function the gate replaced (the S-01 shape)."""
    if app is None:
        return []
    defects: list[BindingDefect] = []
    for endpoint, view in list(getattr(app, "view_functions", {}).items()):
        underlying = getattr(view, "__func__", None)
        if underlying is None:
            continue
        for class_name, attr, original, _patched in _method_gates:
            if underlying is original:
                defects.append(
                    BindingDefect(
                        endpoint,
                        f"the route still points at the ungated "
                        f"{class_name}.{attr}",
                    )
                )
                break
    return defects


def verify_bindings(
    app: Any | None = None, declared: Iterable[Any] | None = None
) -> Any:
    """The coverage-aware report, under the name everything already calls.

    :func:`verify_installation` above answers "is each declared path bound
    the way it says", which is necessary and not sufficient: it asks whether
    *something* wraps the target, never what the wrapper covers. So it
    printed ``declared=25 verified=25 ok=True`` while
    ``Superset.save_or_overwrite_slice`` was gated on its ``overwrite``
    branch alone and the four importers held nothing on a first-time import
    -- five paths the report called clean (D3).

    ``bindings.verify_bindings`` is the instrument that knows about partial
    coverage. This name delegates to it so that running the obvious thing
    tells the truth, rather than leaving a clean-looking report answering to
    the name a reader would reach for first.
    """
    from asset_approval.bindings import verify_bindings as _coverage_aware

    return _coverage_aware(app, declared)
