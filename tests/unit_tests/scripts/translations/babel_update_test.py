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
"""
Tests for the .pot normalization step in ``scripts/translations/babel_update.sh``.

The defect these prove against: the step was written with ``--sort-by-msgid``,
which is not a msgcat option. gettext rejected the call with ``unrecognized
option``, and because the script has no ``set -e`` the failure was non-fatal — so
the normalization silently never ran and ``pybabel update`` continued on an
unnormalized template. Measured on the template at the time of the fix: 1294
width-wrapped lines, 1 location comment and 7 msgid sort inversions that the
flags were supposed to have removed.

``check_translation_regression.py`` cannot catch this class: it compares .po
translation *counts*, which are unchanged by losing ``--no-wrap`` or by
continuing past a failed normalization.

Two guarantees are pinned here, and both are asserted against the real script
rather than a copy of its logic:

1. **The normalization does what it claims** — sorted, unwrapped, location-free.
   The msgcat command is *parsed out of the script* so that a regression in the
   script fails this test. A test carrying its own copy of the command would go
   on passing while the script broke, which is the exact shape of the original
   bug.
2. **A failed normalization stops the script** before ``pybabel update`` can
   publish catalogs built from an unnormalized template.
"""

import re
import shutil
import stat
import subprocess
from pathlib import Path

import pytest

_SCRIPT_PATH = (
    Path(__file__).resolve().parents[4] / "scripts" / "translations" / "babel_update.sh"
)

# Long enough that gettext folds it on width alone, which is what --no-wrap
# governs. Declared once so the fixture and the assertion cannot drift apart.
_LONG_MSGID = (
    "a very long message that gettext would rather fold across several "
    "physical lines because it exceeds the default wrapping width of the tool"
)

# An unsorted, width-wrapped, location-carrying template — every property the
# normalization is meant to fix, in one fixture.
_UGLY_POT = f"""\
# Translations template for Superset.
msgid ""
msgstr ""
"Content-Type: text/plain; charset=utf-8\\n"

#: superset/zebra.py:1
msgid "zebra"
msgstr ""

#: superset/views/core.py:42
#: superset/views/dashboard.py:7
msgid ""
"{_LONG_MSGID[:66]}"
"{_LONG_MSGID[66:]}"
msgstr ""

#: superset/apple.py:9
msgid "apple"
msgstr ""
"""


def _script_text() -> str:
    return _SCRIPT_PATH.read_text(encoding="utf-8")


def _msgcat_line() -> str:
    """The script's msgcat invocation, as the script actually spells it."""
    calls = [
        stripped
        for line in _script_text().splitlines()
        if (stripped := line.strip()).startswith("msgcat ")
    ]
    assert calls, (
        "no msgcat invocation found in babel_update.sh — the .pot normalization "
        "step is missing entirely"
    )
    return calls[0]


def test_the_normalization_step_exists_and_uses_real_msgcat_flags() -> None:
    """Guards the original typo and the two flags whose loss is invisible."""
    line = _msgcat_line()

    assert "--sort-output" in line, (
        "the .pot normalization must sort with `--sort-output`. `--sort-by-msgid` "
        "is not a msgcat option and gettext rejects the whole call, which is how "
        "this step came to be a silent no-op."
    )
    assert "--sort-by-msgid" not in line, (
        "`--sort-by-msgid` is not a msgcat option — see `msgcat --help`"
    )
    for flag in ("--no-wrap", "--no-location"):
        assert flag in line, (
            f"the .pot normalization must pass {flag}; losing it changes the "
            "template's shape without changing any translation count, so no "
            "other check in the repo would notice"
        )


def test_a_failed_normalization_is_fatal() -> None:
    """`|| exit 1` — without it, a broken msgcat is a silent no-op."""
    assert re.search(r"\|\|\s*exit\s+1\s*$", _msgcat_line()), (
        "the msgcat call must end with `|| exit 1`. This script has no `set -e`, "
        "so an unguarded failure here is ignored and `pybabel update` proceeds "
        "on an unnormalized template."
    )


def test_normalization_precedes_pybabel_update() -> None:
    """Order matters: normalizing after the update pass would not help."""
    text = _script_text()
    msgcat_at = text.index(_msgcat_line())
    update_at = text.index("pybabel update")
    assert msgcat_at < update_at, (
        "the .pot must be normalized BEFORE `pybabel update` reads it — the "
        "update pass propagates the template into every language catalog"
    )


@pytest.mark.skipif(
    shutil.which("msgcat") is None,
    reason="gettext's msgcat is not installed on this runner",
)
def test_normalization_sorts_unwraps_and_drops_locations(tmp_path: Path) -> None:
    """Run the script's own msgcat command against an ugly fixture."""
    src = tmp_path / "messages.pot"
    out = tmp_path / "normalized.pot"
    src.write_text(_UGLY_POT, encoding="utf-8")

    msgcat = shutil.which("msgcat")
    assert msgcat, "guaranteed present by the skipif above"

    # Reuse the script's flags verbatim; only the paths are ours.
    flags = [token for token in _msgcat_line().split() if token.startswith("--")]
    proc = subprocess.run(  # noqa: S603
        [msgcat, *flags, str(src), "-o", str(out)],
        capture_output=True,
        text=True,
        check=False,
    )
    assert proc.returncode == 0, f"msgcat failed: {proc.stderr}"

    normalized = out.read_text(encoding="utf-8")

    assert "#:" not in normalized, (
        f"--no-location should have removed every `#:` comment:\n{normalized}"
    )

    # --no-wrap suppresses *width-driven* folding, which is what the fixture's
    # long msgid provokes. (Continuation lines after an embedded \n are
    # legitimate and --no-wrap does not affect them, so this asserts on the one
    # message whose folding was purely a width decision.)
    assert f'msgid "{_LONG_MSGID}"' in normalized, (
        "--no-wrap should have kept the long msgid on a single physical line, "
        f"but it is still folded:\n{normalized}"
    )

    msgids = [
        m.group(1) for m in re.finditer(r'^msgid "(.+)"$', normalized, re.MULTILINE)
    ]
    assert msgids == sorted(msgids), (
        f"--sort-output should have sorted the msgids, got {msgids}"
    )
    assert "apple" in msgids, f"normalization dropped a message, got {msgids}"
    assert "zebra" in msgids, f"normalization dropped a message, got {msgids}"


def test_a_failing_msgcat_stops_the_script_before_pybabel_update(
    tmp_path: Path,
) -> None:
    """End-to-end on the real script, with pybabel and msgcat stubbed.

    Proves the *behaviour* the `|| exit 1` assertion above only proves
    textually: inject a failing msgcat and confirm the script exits non-zero
    having never reached the update pass. Needs neither babel nor gettext.
    """
    root = tmp_path / "repo"
    (root / "scripts" / "translations").mkdir(parents=True)
    (root / "superset" / "translations").mkdir(parents=True)

    # ROOT_DIR is derived from BASH_SOURCE/../.., so the copy's location makes
    # tmp_path/repo the script's idea of the repo root. Nothing real is touched.
    script = root / "scripts" / "translations" / "babel_update.sh"
    shutil.copy(_SCRIPT_PATH, script)
    shutil.copy(
        _SCRIPT_PATH.parent / "apply_do_not_translate.py",
        root / "scripts" / "translations" / "apply_do_not_translate.py",
    )

    log = tmp_path / "calls.log"
    stub_dir = tmp_path / "bin"
    stub_dir.mkdir()

    # pybabel: records its subcommand; `extract` also produces a template so the
    # script has something to normalize.
    (stub_dir / "pybabel").write_text(
        "#!/bin/bash\n"
        f'echo "pybabel $1" >> "{log}"\n'
        'if [ "$1" = "extract" ]; then\n'
        "  while [ $# -gt 0 ]; do\n"
        '    if [ "$1" = "-o" ]; then printf \'msgid ""\\nmsgstr ""\\n\' > "$2"; fi\n'
        "    shift\n"
        "  done\n"
        "fi\n"
        "exit 0\n",
        encoding="utf-8",
    )
    # msgcat: the injected failure, exactly as gettext behaves on a bad flag.
    (stub_dir / "msgcat").write_text(
        "#!/bin/bash\n"
        f'echo "msgcat" >> "{log}"\n'
        'echo "msgcat: unrecognized option" >&2\n'
        "exit 1\n",
        encoding="utf-8",
    )
    for stub in ("pybabel", "msgcat"):
        path = stub_dir / stub
        path.chmod(path.stat().st_mode | stat.S_IEXEC)

    bash = shutil.which("bash")
    assert bash, "bash is required to run the script under test"

    proc = subprocess.run(  # noqa: S603
        [bash, str(script)],
        capture_output=True,
        text=True,
        check=False,
        env={"PATH": f"{stub_dir}:/usr/bin:/bin", "HOME": str(tmp_path)},
    )

    calls = log.read_text(encoding="utf-8") if log.exists() else ""

    assert proc.returncode != 0, (
        "a failed .pot normalization must make the script exit non-zero; it "
        f"returned {proc.returncode}. stdout={proc.stdout!r} stderr={proc.stderr!r}"
    )
    assert "msgcat" in calls, f"the script never called msgcat. calls={calls!r}"
    assert "pybabel update" not in calls, (
        "the script continued into `pybabel update` after the normalization "
        "failed — that is the original bug, which published catalogs built from "
        f"an unnormalized template. calls={calls!r}"
    )
