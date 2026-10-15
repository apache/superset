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
Regression test for https://github.com/apache/superset/issues/44551.

``superset/sql_lab.py`` formats the SQL Lab progress message with
``block_num``/``block_count`` keyword arguments (see ``sql_lab.py`` around the
``"Running block %(block_num)s out of %(block_count)s"`` call). If a
translation's ``msgstr`` references a placeholder name that isn't one of
those two keywords, ``flask_babel.gettext`` raises a ``KeyError`` when
formatting it, and every SQL Lab query fails in that locale.
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
_MSGID = "Running block %(block_num)s out of %(block_count)s"
_PLACEHOLDER_RE = re.compile(r"%\((\w+)\)s")


def _placeholder_names(text: str) -> set[str]:
    return set(_PLACEHOLDER_RE.findall(text))


def test_sk_progress_message_placeholders_match_source() -> None:
    catalog = polib.pofile(str(_SK_CATALOG))
    entry = catalog.find(_MSGID)

    assert entry is not None, f"msgid not found in sk catalog: {_MSGID!r}"

    source_placeholders = _placeholder_names(entry.msgid)
    translated_placeholders = _placeholder_names(entry.msgstr)

    assert translated_placeholders <= source_placeholders, (
        "sk translation references placeholder(s) "
        f"{translated_placeholders - source_placeholders} that are not in the "
        f"English source {source_placeholders} -- formatting this msgstr with "
        "the block_num/block_count kwargs sql_lab.py actually passes raises "
        "KeyError and fails every SQL Lab query in the sk locale"
    )
