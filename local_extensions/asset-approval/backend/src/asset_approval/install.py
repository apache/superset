"""Binding the review gate to Superset's write paths from outside Superset.

The host offers no seam for this. Nothing in ``superset_core`` lets an
extension observe, let alone refuse, a write: the only lifecycle callbacks
it exposes are for background tasks. So this module wraps the commands
directly, in the process, at import time.

That is monkeypatching and it is named as such. It works because an
extension's backend is imported into the running app
(``init_extensions`` -> ``eager_import``), which gives it the same reach the
Preset shell already takes. What it costs is a binding per write path that
breaks silently if the host moves a signature -- eighteen of them here.

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
import logging
from importlib import import_module
from typing import Any, Callable

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
    """
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
) -> None:
    """Run ``gate`` between the command's validation and its body.

    ``validate_first`` is off for the importers, whose ``run`` validates a
    bundle rather than an asset and whose refusal depends only on whether
    the import would overwrite.
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
        if _gate_applies():
            if validate_first:
                _validate_once(self)
            gate(self)
        return original_run(self, *args, **kwargs)

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
        if _gate_applies():
            gate(*args, **kwargs)
        return original(*args, **kwargs)

    functools.update_wrapper(patched, original)
    patched.__asset_approval_gate__ = True  # type: ignore[attr-defined]
    setattr(host_cls, attr, _as_declared(host_cls, attr, patched))
    _patched.append(f"{class_name}.{attr}")
    _method_gates.append((class_name, attr, original, patched))


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
