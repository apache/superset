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
Regression test for https://github.com/apache/superset/issues/45986.

The ``pt`` and ``pt_BR`` catalogs had 64 entries where a ``%s`` placeholder
was glued to the neighbouring words (``definida para%ssegundos``) or moved
to the end of the phrase. Portuguese separates words with spaces, so a
``%s`` that touches a letter on a side where the English source has a space
is a rendering bug ("…definida para30segundos").

The check is only meaningful for languages that separate words with spaces,
which is why it is limited to the Portuguese catalogs.
"""

import re
from pathlib import Path

import polib  # type: ignore[import-untyped]
import pytest

_TRANSLATIONS = Path(__file__).resolve().parents[3] / "superset" / "translations"
_GLUED_BEFORE = re.compile(r"\w%s")
_GLUED_AFTER = re.compile(r"%s\w")


def _glued_placeholders(language: str) -> list[tuple[str, str]]:
    catalog = polib.pofile(
        str(_TRANSLATIONS / language / "LC_MESSAGES" / "messages.po")
    )
    problems = []
    for entry in catalog:
        if entry.obsolete or not entry.msgid or entry.msgid_plural:
            continue
        if not entry.msgstr:
            continue
        for pattern in (_GLUED_BEFORE, _GLUED_AFTER):
            if pattern.search(entry.msgstr) and not pattern.search(entry.msgid):
                problems.append((entry.msgid, entry.msgstr))
                break
    return problems


@pytest.mark.parametrize("language", ["pt", "pt_BR"])
def test_pt_placeholders_are_separated_from_words(language: str) -> None:
    problems = _glued_placeholders(language)
    assert not problems, (
        f"{len(problems)} {language} translation(s) glue a %s placeholder to "
        "a word where the English source has a space:\n"
        + "\n".join(f"  {msgid!r} -> {msgstr!r}" for msgid, msgstr in problems)
    )
