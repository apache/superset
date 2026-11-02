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
""""Is every governed write path actually bound right now?"

Nothing could answer that from the code. ``patched_targets()`` recorded the
``setattr`` calls that succeeded, so a path nobody attempted to bind, and a
path rebound away afterwards, both read exactly like one that worked -- no
denominator, and its only reader a log line. Four rows in this epic were
marked Fixed while the behaviour was still broken, all with the same shape:
the fix went on the path the test exercised and the product used a different
one. S-01 was the worst of them.

``bindings.WRITE_PATHS`` is the denominator and ``install.verify_bindings``
is the question asked of the running process. These tests check both, and
the S-01 one reproduces the production order -- register the route first,
patch second -- because that is the order the rest of the suite has
backwards.
"""

from __future__ import annotations

from importlib import import_module
from typing import Any

import pytest
from asset_approval import bindings, install
from asset_approval.bindings import EXEMPT, GATED, REFUSED, WRITE_PATHS
from asset_approval.install import (
    BindingDefect,
    BindingReport,
    gate_method,
    verify_bindings,
)

from superset import change_management


class _App:
    """Only the attribute verification and rebinding read."""

    def __init__(self) -> None:
        self.view_functions: dict[str, Any] = {}


# ---- the declared table -------------------------------------------------


def test_the_table_is_not_empty() -> None:
    assert len(WRITE_PATHS) > 0


def _resolves(path: Any) -> bool:
    try:
        host = getattr(import_module(path.module_path), path.class_name, None)
    except ImportError:
        return False
    return host is not None and getattr(host, path.attr, None) is not None


def test_every_declared_path_resolves() -> None:
    """A target the host has renamed is a defect, not a warning nobody reads.

    This is the check that has a denominator: it fails for a path that was
    never attempted, which is the case ``patched_targets()`` could not see.
    """
    assert [path.target for path in WRITE_PATHS if not _resolves(path)] == []


def test_every_entry_carries_a_disposition_and_a_reason() -> None:
    """The table is read by people as well as by ``install_bindings``."""
    for path in WRITE_PATHS:
        assert path.disposition in {GATED, REFUSED, EXEMPT}, path.target
        assert path.reason.strip(), path.target


def test_an_exempt_path_is_declared_without_a_gate() -> None:
    """Exempt means deliberately unbound, which is why it carries no closure.

    Declared all the same, so "we chose not to gate this" sits beside the
    paths that are gated instead of living only in a comment (129073).
    """
    exempt = [path for path in WRITE_PATHS if path.disposition == EXEMPT]
    assert exempt, "the dataset resync exemption is no longer declared"
    assert [path.target for path in exempt if path.gate is not None] == []


def test_every_governed_path_carries_a_gate() -> None:
    governed = [path for path in WRITE_PATHS if path.disposition != EXEMPT]
    assert [path.target for path in governed if path.gate is None] == []


def test_the_table_is_what_install_bindings_binds() -> None:
    """The conftest has already installed them, from this table.

    If the table could describe a binding that does not run, it would be one
    more thing to believe rather than check, which is the whole defect being
    closed here.
    """
    report = verify_bindings()

    assert [str(defect) for defect in report.defects] == []
    assert report.declared == len(WRITE_PATHS)
    assert report.verified == report.declared
    assert report.ok is True


# ---- verification -------------------------------------------------------


@pytest.fixture
def routed(monkeypatch: pytest.MonkeyPatch) -> Any:
    """A routed host class, reachable the way a declared path names one.

    A fresh class and a fresh registry per test: ``gate_method`` mutates the
    class it is given and the registries are process-wide, so a leftover
    wrapper would make the next test's "never bound" case look bound.
    """
    monkeypatch.setattr(install, "_method_gates", [])
    monkeypatch.setattr(install, "_patched", [])

    class Routed:
        def save(self) -> str:
            return "written"

    monkeypatch.setattr(install, "_resolve", lambda _p, _c: Routed)
    monkeypatch.setattr(install, "_gate_applies", lambda: True)
    # The declared path names its target by module and class, so it has to
    # be findable by name for the duration of this test.
    monkeypatch.setitem(globals(), "Routed", Routed)
    return Routed


def _declared(disposition: str = REFUSED) -> Any:
    """One declared path pointing at the ``routed`` fixture's class."""
    return bindings.WritePath(
        module_path=__name__,
        class_name="Routed",
        attr="save",
        disposition=disposition,
        reason="a stand-in for a routed write path",
        gate=None if disposition == EXEMPT else (lambda *_a, **_k: None),
        via="method",
    )


def test_a_clean_install_reports_no_defects(routed: Any) -> None:
    gate_method("m", "Routed", "save", lambda *_a, **_k: None)

    report = verify_bindings(_App(), [_declared()])

    assert report.defects == ()
    assert (report.declared, report.verified) == (1, 1)


def test_a_path_that_was_never_bound_is_a_defect(routed: Any) -> None:
    """The case with no denominator: nothing was attempted, so nothing failed.

    ``patched_targets()`` is empty here and reports no trouble at all.
    """
    report = verify_bindings(_App(), [_declared()])

    assert install.patched_targets() == []
    assert len(report.defects) == 1
    assert "UNGATED" in report.defects[0].reason
    assert report.verified == 0
    assert report.ok is False


def test_a_target_the_host_renamed_is_a_defect(
    routed: Any,  # noqa: ARG001  -- the fixture isolates the registries
) -> None:
    declared = bindings.WritePath(
        module_path=__name__,
        class_name="NotThere",
        attr="save",
        disposition=REFUSED,
        reason="a target the host has moved",
        gate=lambda *_a, **_k: None,
        via="method",
    )

    report = verify_bindings(_App(), [declared])

    assert len(report.defects) == 1
    assert "not in" in report.defects[0].reason


def test_an_exemption_that_has_grown_a_gate_is_a_defect(routed: Any) -> None:
    """Drift towards a gate matters as much as drift away from one.

    Refusing the dataset resync left no way to do it at all while review was
    on (129073), so an exemption that has quietly become a gate is a defect
    in its own right.
    """
    gate_method("m", "Routed", "save", lambda *_a, **_k: None)

    report = verify_bindings(_App(), [_declared(EXEMPT)])

    assert len(report.defects) == 1
    assert "declared exempt" in report.defects[0].reason


def test_a_route_still_holding_a_replaced_original_is_a_defect(
    routed: Any,
) -> None:
    """S-01, read backwards -- the check that would have caught it at boot.

    Production order, which the suite's conftest has the wrong way round:
    Flask-AppBuilder registers the bound method during ``init_views()``, then
    the extension patches the class. The class patch never reaches the route,
    and every class-side check passes while the route writes a governed
    dataset unreviewed.
    """
    app = _App()
    # Flask-AppBuilder registers the bound method, now.
    app.view_functions["Datasource.save"] = routed().save

    gate_method("m", "Routed", "save", lambda *_a, **_k: None)

    report = verify_bindings(app, [_declared()])

    # The class side is clean, which is exactly how S-01 passed as Fixed.
    assert report.verified == 1
    assert [defect.target for defect in report.defects] == ["Datasource.save"]
    assert "still points at the ungated" in report.defects[0].reason


def test_rebinding_the_route_clears_the_defect(routed: Any) -> None:
    app = _App()
    app.view_functions["Datasource.save"] = routed().save
    gate_method("m", "Routed", "save", lambda *_a, **_k: None)

    install.rebind_registered_routes(app)

    assert verify_bindings(app, [_declared()]).defects == ()


def test_a_route_onto_an_unrelated_method_is_not_a_defect(routed: Any) -> None:
    class Sibling:
        def save(self) -> str:
            return "other"

    app = _App()
    app.view_functions["Sibling.save"] = Sibling().save
    gate_method("m", "Routed", "save", lambda *_a, **_k: None)

    assert verify_bindings(app, [_declared()]).defects == ()


def test_verification_without_an_app_checks_the_classes_only() -> None:
    """The extension's own tests bind outside an app, so there are no routes."""
    report = verify_bindings(None, [])

    assert (report.declared, report.verified, report.defects) == (0, 0, ())


# ---- the promise to core ------------------------------------------------


@pytest.fixture
def unpromised(monkeypatch: pytest.MonkeyPatch) -> None:
    """Core back to knowing of no gate, as it is before the extension loads."""
    monkeypatch.setattr(change_management, "_gate", None)


def _reports(report: BindingReport, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(bindings, "verify_bindings", lambda _app=None: report)


def test_the_promise_is_not_made_when_there_are_defects(
    monkeypatch: pytest.MonkeyPatch, unpromised: None
) -> None:
    """A gate with a hole in it must not pass for a gate.

    Core's fail-closed guard takes the promise at face value and lets every
    governed write through once it is made. Withholding it means core
    answers 503 ``CHANGE_MANAGEMENT_UNENFORCED`` instead, which is the safe
    failure: loud, and nothing goes live unreviewed (QA-12).
    """
    _reports(
        BindingReport(
            declared=1,
            verified=0,
            defects=(BindingDefect("Datasource.save", "UNGATED"),),
        ),
        monkeypatch,
    )

    bindings._keep_the_promise_only_if_the_gate_is_whole()  # noqa: SLF001

    assert change_management.is_write_gate_installed() is False


def test_the_defects_are_logged_rather_than_raised(
    monkeypatch: pytest.MonkeyPatch,
    unpromised: None,
    caplog: pytest.LogCaptureFixture,
) -> None:
    """Raising would be swallowed: ``init_extensions`` logs and skips.

    That is the failure mode core's guard exists for, so the extension has to
    stay loaded and let core refuse the writes.
    """
    _reports(
        BindingReport(
            declared=2,
            verified=1,
            defects=(BindingDefect("Datasource.save", "UNGATED"),),
        ),
        monkeypatch,
    )

    with caplog.at_level("ERROR"):
        bindings._keep_the_promise_only_if_the_gate_is_whole()  # noqa: SLF001

    assert "Datasource.save" in caplog.text
    assert "1 of 2 declared write paths verified" in caplog.text


def test_the_promise_is_made_when_verification_is_clean(
    monkeypatch: pytest.MonkeyPatch, unpromised: None
) -> None:
    _reports(BindingReport(declared=1, verified=1, defects=()), monkeypatch)

    bindings._keep_the_promise_only_if_the_gate_is_whole()  # noqa: SLF001

    assert change_management.is_write_gate_installed() is True


def test_the_set_this_build_ships_with_verifies() -> None:
    """If this fails, some governed write path is open right now.

    Every other test in this directory would then be measuring a gate that
    is not fully installed, which is how four rows came to be marked Fixed.
    """
    assert verify_bindings().ok is True
    assert change_management.is_write_gate_installed() is True
