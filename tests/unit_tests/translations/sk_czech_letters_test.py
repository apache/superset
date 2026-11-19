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
Regression test for https://github.com/apache/superset/issues/45377.

The letters ``ě``, ``ř`` and ``ů`` are used in Czech but don't exist in
Slovak, so a Slovak ``msgstr`` containing any of them is a Czech translation
(or a Czech/Slovak mix) that leaked into the ``sk`` catalog. Such entries
should be left empty, so the UI falls back to English, until a Slovak
translation is provided.
"""

import re
from pathlib import Path

import polib  # type: ignore[import-untyped]

_SK_CATALOG = (
    Path(__file__).resolve().parents[3]
    / "superset"
    / "translations"
    / "sk"
    / "LC_MESSAGES"
    / "messages.po"
)
_CZECH_ONLY_RE = re.compile("[ěřůĚŘŮ]")


def test_sk_catalog_has_no_czech_only_letters() -> None:
    catalog = polib.pofile(str(_SK_CATALOG))

    offending = [
        entry.msgid
        for entry in catalog
        if not entry.obsolete
        and any(
            _CZECH_ONLY_RE.search(msgstr)
            for msgstr in (
                entry.msgstr_plural.values() if entry.msgstr_plural else [entry.msgstr]
            )
        )
    ]

    assert not offending, (
        f"{len(offending)} sk translation(s) contain Czech-only letters "
        f"(ě/ř/ů), e.g. {offending[:5]!r} -- these are Czech, not Slovak"
    )
