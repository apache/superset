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
Tests for ``scripts/translations/unflag_pseudo_format.py``.

The defect these prove against: labels such as ``"% of"`` parse as a valid
%-format directive with a space flag (``% o``), so Babel flags them
python-format, and ``msgfmt --check`` then rejects a translation such as the
German ``"% von"`` (``% v`` is no conversion character). The fix detects these
strings instead of listing them, so the detection itself is what is pinned
here: which strings it unflags, which it must leave alone, and that the rewrite
touches nothing but ``#,`` lines.

The script is not installed as a package, so it is loaded via importlib from
its filesystem path.
"""

import importlib.util
import shutil
import subprocess
from pathlib import Path

import pytest

_SCRIPT_PATH = (
    Path(__file__).resolve().parents[4]
    / "scripts"
    / "translations"
    / "unflag_pseudo_format.py"
)
_spec = importlib.util.spec_from_file_location("unflag_pseudo_format", _SCRIPT_PATH)
assert _spec is not None, f"Could not load {_SCRIPT_PATH}"
assert _spec.loader is not None, f"No loader on spec for {_SCRIPT_PATH}"
unflag = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(unflag)


@pytest.mark.parametrize(
    ("ids", "expected"),
    [
        # Accidental: every directive is a space flag plus a conversion char.
        (["% of"], True),
        (["% calculation"], True),
        (["% of column total"], True),
        (["Value: type the numbers below. % of column is unavailable."], True),
        # Real placeholders never carry the space flag.
        (["%(rows)d rows returned"], False),
        (["%s"], False),
        (["Showing %s of %s"], False),
        # A string mixing both kinds stays flagged.
        (["%(count)s rows, % of total"], False),
        # A plural entry is judged on msgid and msgid_plural together.
        (["%(num)d item", "%(num)d items"], False),
        (["% of", "%(num)d of"], False),
        # `%%` is only written in a string that is %-formatted, so it keeps
        # the flag even next to an accidental directive.
        (["100%% done"], False),
        (["%%"], False),
        (["% of 100%%"], False),
        # No directive at all.
        (["Percentage"], False),
        ([""], False),
    ],
)
def test_is_pseudo_format(ids: list[str], expected: bool) -> None:
    assert unflag.is_pseudo_format(ids) is expected


# Every shape the rewrite must tell apart, in one catalog: labels whose only
# "directives" are accidental, the same accident inside a msgid that pybabel
# folds across lines, a flag line with other flags on it, a context, and
# strings that really are formatted.
_CATALOG = """\
msgid ""
msgstr ""
"Content-Type: text/plain; charset=utf-8\\n"
"Plural-Forms: nplurals=2; plural=(n != 1);\\n"

#, python-format
msgid "% of"
msgstr "% von"

#. i18n: the funnel chart's percentage mode
#, fuzzy, python-format
msgid "% calculation"
msgstr "% Berechnung"

#, python-format
msgctxt "pivot"
msgid "% of row total"
msgstr "% der Zeilensumme"

#, python-format
msgid ""
"Value: type the exact numbers used for coloring below. % of column is "
"unavailable with Server pagination enabled."
msgstr ""
"Wert: genaue Zahlen eingeben. % von Spalte ist bei serverseitiger "
"Paginierung nicht verfügbar."

#, python-format
msgid "%(rows)d rows returned"
msgstr "%(rows)d Zeilen zurückgegeben"

#, python-format
msgid "%(count)s rows, % of total"
msgstr "%(count)s Zeilen, % vom Gesamt"

#, python-format
msgid "%(num)d item"
msgid_plural "%(num)d items"
msgstr[0] "%(num)d Element"
msgstr[1] "%(num)d Elemente"

#, python-format
msgid "% of one"
msgid_plural "%(num)d of many"
msgstr[0] "%(num)d von einem"
msgstr[1] "%(num)d von vielen"

#, python-format
msgid "100%% done"
msgstr "100%% erledigt"

msgid "% unflagged label"
msgstr "% Etikett"
"""

_ACCIDENTAL = (
    "% of",
    "% calculation",
    "% of row total",
    "Value: type the exact numbers used for coloring below. % of column is "
    "unavailable with Server pagination enabled.",
)
_REAL = (
    "%(rows)d rows returned",
    "%(count)s rows, % of total",
    "%(num)d item",
    "% of one",
    "100%% done",
)


def _flags_by_msgid(text: str) -> dict[str, list[str]]:
    """Map each entry's msgid to the tokens of its `#,` line."""
    flags: dict[str, list[str]] = {}
    for block in text.split("\n\n"):
        lines = block.splitlines()
        flag_line = next((line for line in lines if line.startswith("#,")), "#,")
        msgid: list[str] = []
        in_msgid = False
        for line in lines:
            if line.startswith("msgid "):
                msgid, in_msgid = [line[len("msgid ") :].strip()[1:-1]], True
            elif line.startswith('"') and in_msgid:
                msgid.append(line.strip()[1:-1])
            else:
                in_msgid = False
        flags["".join(msgid)] = [t.strip() for t in flag_line[2:].split(",") if t]
    return flags


def _write(tmp_path: Path) -> Path:
    po = tmp_path / "messages.po"
    po.write_text(_CATALOG, encoding="utf-8")
    return po


def test_unflag_file_unflags_only_accidental_directives(tmp_path: Path) -> None:
    po = _write(tmp_path)

    changed = unflag.unflag_file(po)

    flags = _flags_by_msgid(po.read_text(encoding="utf-8"))
    assert changed == len(_ACCIDENTAL)
    for msgid in _ACCIDENTAL:
        assert "python-format" not in flags[msgid], (
            f"{msgid!r} is not a format string and must lose its python-format "
            f"flag, got {flags[msgid]}"
        )
        assert "no-python-format" in flags[msgid], (
            f"{msgid!r} must be marked no-python-format so tools stop treating "
            f"it as a format string, got {flags[msgid]}"
        )
    for msgid in _REAL:
        assert flags[msgid] == ["python-format"], (
            f"{msgid!r} is a real format string and must keep its flag "
            f"untouched, got {flags[msgid]}"
        )
    assert flags["% calculation"] == ["fuzzy", "no-python-format"], (
        "other flags on the line must survive the rewrite"
    )
    assert flags["% unflagged label"] == [], (
        "an entry without a flag line must not gain one"
    )


def test_unflag_file_rewrites_only_flag_lines_and_is_idempotent(
    tmp_path: Path,
) -> None:
    """The step runs on every babel_update: it must not reflow or keep churning."""
    po = _write(tmp_path)

    unflag.unflag_file(po)
    once = po.read_text(encoding="utf-8")

    assert unflag.unflag_file(po) == 0, "a second run must find nothing to change"
    assert po.read_text(encoding="utf-8") == once
    before = [line for line in _CATALOG.splitlines() if not line.startswith("#,")]
    after = [line for line in once.splitlines() if not line.startswith("#,")]
    assert after == before, (
        "only `#,` lines may change; anything else alters the canonical "
        "wrapping that babel_update produces"
    )


def test_unflag_file_leaves_a_file_without_matches_untouched(tmp_path: Path) -> None:
    po = tmp_path / "messages.po"
    text = '#, python-format\nmsgid "%s rows"\nmsgstr "%s Zeilen"\n'
    po.write_text(text, encoding="utf-8")
    mtime = po.stat().st_mtime_ns

    assert unflag.unflag_file(po) == 0
    assert po.read_text(encoding="utf-8") == text
    assert po.stat().st_mtime_ns == mtime, "a file with nothing to fix is not rewritten"


def test_unflagged_catalog_passes_msgfmt_check(tmp_path: Path) -> None:
    """The point of the script: msgfmt --check fatals before it, passes after."""
    found = shutil.which("msgfmt")
    if found is None:
        pytest.skip("gettext's msgfmt is not installed on this machine")
    assert found is not None  # pytest.skip does not return
    msgfmt: str = found
    po = _write(tmp_path)

    def check() -> subprocess.CompletedProcess[str]:
        return subprocess.run(  # noqa: S603
            [msgfmt, "--check", "-o", "/dev/null", str(po)],
            capture_output=True,
            text=True,
            check=False,
        )

    before = check()
    assert before.returncode != 0, (
        "the fixture should reproduce the fatal msgfmt raises on `% von`; "
        f"if it no longer does, this test proves nothing. stderr={before.stderr}"
    )

    unflag.unflag_file(po)

    after = check()
    assert after.returncode == 0, (
        f"msgfmt --check still fails after unflagging: {after.stderr}"
    )


def test_main_defaults_to_the_template_and_every_catalog() -> None:
    paths = unflag.default_paths()

    assert paths[0].name == "messages.pot"
    assert all(p.name == "messages.po" for p in paths[1:])
    assert len(paths) > 1, "the repo's catalogs should be found"


def test_main_reports_what_it_changed(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    po = _write(tmp_path)

    unflag.main([str(po)])

    assert capsys.readouterr().out.strip() == (
        f"Unflagged {len(_ACCIDENTAL)} pseudo-format entries across 1 files."
    )
