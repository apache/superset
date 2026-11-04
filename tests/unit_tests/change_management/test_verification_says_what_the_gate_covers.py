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
""" "Is it gated?" and "what does the gate cover?" are different questions.

``verify_bindings`` printed ``declared=25 verified=25 ok=True`` with no defects
while ``save_or_overwrite_slice`` was listed as plainly ``gated`` and its gate
returned early on every action but ``overwrite``. Two filed defects sat on the
branch it skipped. The check asked whether *something* was wrapped; a
``WritePath`` had no way to say "only this much", so there was nothing for the
check to compare against.

The report is the instrument QA is shown, so these hold it to the thing it is
for: an honest answer, in both directions. A gap that nobody declared fails the
run; a gap that somebody declared is listed, counted, and makes the run
``complete=False`` instead of passing for clean; and a declaration the gate has
since outgrown fails too, so the list can only shrink by being fixed.
"""

from __future__ import annotations

import contextlib
import gc
from collections.abc import Iterator
from typing import Any, Callable

import pytest
from asset_approval import bindings, install
from asset_approval.bindings import (
    GATED,
    Uncovered,
    verify_bindings,
    WRITE_PATHS,
    WritePath,
)
from asset_approval.install import gate_method


class _App:
    def __init__(self) -> None:
        self.view_functions: dict[str, Any] = {}


# ---- the table this build ships --------------------------------------------


def test_the_legacy_chart_save_has_no_declared_gap_left() -> None:
    """A4 is closed: saveas onto a dashboard viewers can reach is held."""
    report = verify_bindings()

    assert [
        gap for gap in report.partial if gap.target == "Superset.save_or_overwrite_slice"
    ] == []


def test_the_gate_really_holds_overwrite_and_really_holds_saveas_onto_a_live_dashboard() -> None:
    """The measurement behind the removal of the declaration, not the removal."""
    path = next(p for p in WRITE_PATHS if p.attr == "save_or_overwrite_slice")
    held = {name: probe() for name, probe in path.probes}

    assert held == {
        "action=overwrite": True,
        "action=saveas onto a dashboard viewers can reach": True,
    }


def test_the_build_ships_with_no_declared_gap_and_says_so() -> None:
    report = verify_bindings()

    assert report.defects == ()
    assert report.ok is True
    assert report.complete is True
    assert report.partial == ()


def test_the_summary_says_how_much_is_partial() -> None:
    summary = verify_bindings().summary()

    assert f"declared={len(WRITE_PATHS)}" in summary
    assert "ok=True" in summary
    assert "complete=True" in summary
    assert "partial=0" in summary


def test_the_importers_that_can_publish_a_dashboard_probe_that_they_cannot() -> None:
    importers = [
        p
        for p in WRITE_PATHS
        if "importers" in p.module_path
        and p.class_name in {"ImportDashboardsCommand", "ImportAssetsCommand"}
    ]

    assert len(importers) == 2
    assert [p.target for p in importers if not p.probes] == []
    assert all(probe() for p in importers for _name, probe in p.probes)


def test_the_promise_to_core_is_made_from_the_coverage_aware_report() -> None:
    import inspect

    source = inspect.getsource(bindings._keep_the_promise_only_if_the_gate_is_whole)

    assert "verify_bindings(" in source
    assert "verify_installation" not in source


# ---- an undeclared gap fails the run ---------------------------------------


@pytest.fixture
def routed(monkeypatch: pytest.MonkeyPatch) -> Any:
    monkeypatch.setattr(install, "_method_gates", [])
    monkeypatch.setattr(install, "_patched", [])

    class Routed:
        def save(self, chart: object, flag: bool = False) -> str:
            return "written"

    monkeypatch.setattr(install, "_resolve", lambda _p, _c: Routed)
    monkeypatch.setattr(install, "_gate_applies", lambda: True)
    monkeypatch.setitem(globals(), "Routed", Routed)
    gate_method("m", "Routed", "save", lambda *_a, **_k: None)
    return Routed


def _path(**over: Any) -> WritePath:
    fields: dict[str, Any] = {
        "module_path": __name__,
        "class_name": "Routed",
        "attr": "save",
        "disposition": GATED,
        "reason": "a stand-in",
        "gate": lambda *_a, **_k: None,
        "via": "method",
        "args": ("chart", "flag"),
    }
    fields.update(over)
    return WritePath(**fields)


def test_a_branch_the_gate_does_not_hold_and_nobody_declared_fails_the_run(
    routed: Any,
) -> None:
    path = _path(probes=(("saving as", lambda: False),))

    report = verify_bindings(_App(), [path])

    assert report.ok is False
    assert report.verified == 0
    assert "UNGATED" in report.defects[0].reason
    assert "saving as" in report.defects[0].reason


def test_a_branch_the_gate_holds_passes(routed: Any) -> None:
    path = _path(probes=(("saving as", lambda: True),))

    report = verify_bindings(_App(), [path])

    assert report.ok is True
    assert report.complete is True


def test_the_same_branch_declared_is_listed_instead(routed: Any) -> None:
    path = _path(
        probes=(("saving as", lambda: False),),
        uncovered=(Uncovered("saving as", "never gated", "A4"),),
    )

    report = verify_bindings(_App(), [path])

    assert report.ok is True
    assert report.complete is False
    assert [(g.branch, g.tracked, g.probed) for g in report.partial] == [
        ("saving as", "A4", True)
    ]


def test_a_declaration_the_gate_has_outgrown_fails_the_run(routed: Any) -> None:
    """Fixing a gap means deleting its declaration, or this fails."""
    path = _path(
        probes=(("saving as", lambda: True),),
        uncovered=(Uncovered("saving as", "was never gated", "A4"),),
    )

    report = verify_bindings(_App(), [path])

    assert report.ok is False
    assert "now holds it" in report.defects[0].reason


def test_a_declaration_with_no_probe_is_listed_and_marked_unchecked(
    routed: Any,
) -> None:
    path = _path(uncovered=(Uncovered("an import that creates", "D1", "A6"),))

    report = verify_bindings(_App(), [path])

    assert report.ok is True
    assert report.partial[0].probed is False
    assert "not probed" in str(report.partial[0])


def test_a_probe_that_breaks_is_a_finding_not_a_pass(routed: Any) -> None:
    def broken() -> bool:
        raise RuntimeError("the gate no longer takes this shape")

    report = verify_bindings(_App(), [_path(probes=(("saving as", broken),))])

    assert report.ok is False
    assert "probe" in report.defects[0].reason


# ---- a keyword the gate has not been told about ----------------------------


def test_a_parameter_the_gate_does_not_account_for_fails_the_run(routed: Any) -> None:
    """The next ``delete_metric_ids``: a command grew it, nobody told the gate."""
    report = verify_bindings(_App(), [_path(args=("chart",))])

    assert report.ok is False
    assert "flag" in report.defects[0].reason
    assert "neither names nor captures" in report.defects[0].reason


def test_a_command_bound_with_capture_accounts_for_its_keywords_by_default() -> None:
    """Capture is the other way of accounting for one, and the point of it."""

    class UpdateWidgetCommand:
        def __init__(self, model_id: int, data: dict, *, brand_new: bool = False): ...

        def run(self) -> None: ...

    bindings.capture_arguments(UpdateWidgetCommand)
    path = WritePath(
        __name__,
        "UpdateWidgetCommand",
        "run",
        GATED,
        "x",
        lambda c: None,
        capture=True,
        args=("model_id", "data"),
    )
    globals()["UpdateWidgetCommand"] = UpdateWidgetCommand

    defects, _ = bindings._coverage_of(path)

    assert defects == []


def test_the_commands_this_build_gates_have_no_unaccounted_parameters() -> None:
    defects = [
        defect
        for path in WRITE_PATHS
        for defect in bindings._coverage_of(path)[0]
        if "neither names nor captures" in defect.reason
    ]

    assert [str(d) for d in defects] == []


# ---- the latent route hole -------------------------------------------------


def test_a_route_hidden_behind_an_unscoped_before_request_fails_the_run(
    routed: Any,
) -> None:
    """The latent S-01: FAB registers a closure over the original handler.

    ``rebind_registered_routes`` and the route check both skip a view they
    cannot see through, so the class-side check passes while the route writes.
    Not open on any class this build binds by method; this is the check that
    says so, and the one that fires the day somebody adds a hook to one.
    """

    def hook(self: Any) -> None: ...

    hook._before_request_hook = True
    hook._before_request_only = None
    routed.ensure_something = hook

    report = verify_bindings(_App(), [_path()])

    assert report.ok is False
    assert "before_request" in report.defects[0].reason


def test_a_hook_scoped_to_other_handlers_does_not_hide_this_route(routed: Any) -> None:
    def hook(self: Any) -> None: ...

    hook._before_request_hook = True
    hook._before_request_only = ["thumbnail"]
    routed.ensure_something = hook

    assert verify_bindings(_App(), [_path()]).ok is True


def test_no_class_this_build_binds_by_method_carries_one() -> None:
    defects = [
        defect
        for path in WRITE_PATHS
        for defect in bindings._coverage_of(path)[0]
        if "before_request" in defect.reason
    ]

    assert defects == []


# ---- a subclass that replaces run ------------------------------------------


def _delete_chart_path() -> WritePath:
    return next(p for p in WRITE_PATHS if p.class_name == "DeleteChartCommand")


@contextlib.contextmanager
def _subclass_of_a_gated_command(name: str, run: Callable[..., Any]) -> Iterator[None]:
    """A host subclass that exists only for the length of the block.

    Subclasses are tracked weakly but live in reference cycles, so one left
    behind would be found by every later verification in the process.
    """
    from superset.commands.chart.delete import DeleteChartCommand

    sub = type(
        name,
        (DeleteChartCommand,),
        {"run": run, "__module__": f"superset.commands.chart.{name.lower()}"},
    )
    try:
        yield
    finally:
        del sub
        gc.collect()


def test_a_subclass_that_replaces_run_without_calling_it_is_a_hole() -> None:
    def run(self: Any) -> None:  # the gate bound on the parent never runs
        ...

    with _subclass_of_a_gated_command("QuickDelete", run):
        defects, _ = bindings._coverage_of(_delete_chart_path())

    assert [d.target for d in defects] == ["QuickDelete.run"]
    assert "UNGATED" in defects[0].reason


def test_a_subclass_that_delegates_to_the_gated_run_is_not() -> None:
    def run(self: Any) -> None:
        return super().run()  # type: ignore[misc]  # noqa: UP008

    with _subclass_of_a_gated_command("SlowDelete", run):
        defects, _ = bindings._coverage_of(_delete_chart_path())

    assert defects == []


def test_nothing_is_left_behind_by_those() -> None:
    assert bindings._coverage_of(_delete_chart_path())[0] == []
