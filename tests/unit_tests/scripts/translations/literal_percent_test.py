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
"""Tests for ``scripts/translations/literal_percent.py``.

The script is not installed as a package, so it is loaded via importlib from
its filesystem path. Babel flags any msgid containing ``% `` plus a conversion
letter as python-format, which made labels like "% of row total" and tooltips
mentioning "% of column" unusable with msgfmt once translated. The check used
to be a hardcoded list of three labels, so every new label slipped past it.
"""

import importlib.util
import shutil
from pathlib import Path

import pytest

_REPO_ROOT = Path(__file__).resolve().parents[4]
_SCRIPT_PATH = _REPO_ROOT / "scripts" / "translations" / "literal_percent.py"
_spec = importlib.util.spec_from_file_location("literal_percent", _SCRIPT_PATH)
assert _spec is not None, f"Could not load {_SCRIPT_PATH}"
assert _spec.loader is not None, f"No loader on spec for {_SCRIPT_PATH}"
literal_percent = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(literal_percent)

_TRANSLATIONS_DIR = _REPO_ROOT / "superset" / "translations"


@pytest.mark.parametrize(
    "msgid",
    [
        "% calculation",
        "% of",
        "% of row total",
        "Up to 50% off",
        "Value: type the numbers below. % of column: type a percentage.",
    ],
)
def test_is_literal_percent_accepts_percent_followed_by_a_word(msgid: str) -> None:
    assert literal_percent.is_literal_percent(msgid)


@pytest.mark.parametrize(
    "msgid",
    [
        # No directive at all: nothing to strip.
        "Color range (0% to 100%)",
        "plain text",
        # Real placeholders, alone or next to literal text.
        "%(count)s rows",
        "%s % of total",
        "%(name)s: % of total",
        # A bare space-flag directive is not followed by a word.
        "% d",
        # An escaped "%%" means the string is %-formatted.
        "Up 50%% today",
        "50%% of rows",
        # Not a "% word" pattern, so out of this check's scope.
        "Contains text (ILIKE %x%)",
    ],
)
def test_is_literal_percent_rejects_real_or_missing_directives(msgid: str) -> None:
    assert not literal_percent.is_literal_percent(msgid)


def test_is_literal_percent_checks_the_plural_too() -> None:
    assert literal_percent.is_literal_percent("% of row", "% of rows")
    assert not literal_percent.is_literal_percent("% of row", "%(count)s rows")


def _write(tmp_path: Path, text: str) -> Path:
    path = tmp_path / "messages.po"
    path.write_text(text, encoding="utf-8")
    return path


def test_fix_flags_rewrites_single_line_and_wrapped_msgids(tmp_path: Path) -> None:
    path = _write(
        tmp_path,
        'msgid ""\nmsgstr ""\n\n'
        '#, python-format\nmsgid "% of row total"\nmsgstr ""\n\n'
        "#, fuzzy, python-format\n"
        'msgid ""\n'
        '"Value: type the exact numbers used for coloring below. % of column "\n'
        '"is unavailable with Server pagination enabled."\n'
        'msgstr "Valeur"\n',
    )

    assert literal_percent.fix_flags(path)

    assert path.read_text(encoding="utf-8") == (
        'msgid ""\nmsgstr ""\n\n'
        '#, no-python-format\nmsgid "% of row total"\nmsgstr ""\n\n'
        "#, fuzzy, no-python-format\n"
        'msgid ""\n'
        '"Value: type the exact numbers used for coloring below. % of column "\n'
        '"is unavailable with Server pagination enabled."\n'
        'msgstr "Valeur"\n'
    )


def test_fix_flags_handles_context_and_plural_entries(tmp_path: Path) -> None:
    path = _write(
        tmp_path,
        "#, python-format\n"
        'msgctxt "table"\n'
        'msgid "% of row"\n'
        'msgid_plural "% of rows"\n'
        'msgstr[0] ""\n'
        'msgstr[1] ""\n',
    )

    assert literal_percent.fix_flags(path)

    assert path.read_text(encoding="utf-8").startswith("#, no-python-format\n")


def test_fix_flags_leaves_real_placeholders_alone(tmp_path: Path) -> None:
    text = (
        '#, python-format\nmsgid "%(name)s: % of total"\nmsgstr ""\n\n'
        "#, python-format\n"
        'msgid "% of row"\n'
        'msgid_plural "%(count)s rows"\n'
        'msgstr[0] ""\n'
        'msgstr[1] ""\n'
    )
    path = _write(tmp_path, text)

    assert not literal_percent.fix_flags(path)
    assert path.read_text(encoding="utf-8") == text


def test_fix_flags_is_idempotent(tmp_path: Path) -> None:
    path = _write(tmp_path, '#, python-format\nmsgid "% of"\nmsgstr ""\n')

    assert literal_percent.fix_flags(path)
    fixed = path.read_text(encoding="utf-8")

    assert not literal_percent.fix_flags(path)
    assert path.read_text(encoding="utf-8") == fixed


def test_committed_catalogs_have_no_literal_percent_python_format(
    tmp_path: Path,
) -> None:
    """A label babel flagged python-format by accident has slipped through."""
    paths = [
        _TRANSLATIONS_DIR / "messages.pot",
        *sorted(_TRANSLATIONS_DIR.glob("*/LC_MESSAGES/messages.po")),
    ]
    stale = []
    for path in paths:
        copy = tmp_path / f"{path.parent.parent.name}-{path.name}"
        shutil.copy(path, copy)
        if literal_percent.fix_flags(copy):
            stale.append(str(path.relative_to(_REPO_ROOT)))

    assert not stale, (
        f"{stale} flag literal '%' text python-format; run "
        "scripts/translations/babel_update.sh, or "
        "scripts/translations/literal_percent.py on its own"
    )
