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
"""sc-120397: module-level user-facing constants must be LAZY gettext.

A module-level constant is evaluated once at import time, outside any
request, so eager ``__()`` freezes it in the default locale for every
user forever. The convention (paired with sc-120052's inverse): eager
``__()`` for strings built inside request handlers; lazy ``_()`` for
module-scope constants, coerced with ``str()`` at the point of use.
"""

import pathlib
import re

import pytest
from flask_babel import force_locale
from flask_babel.speaklater import LazyString

from superset.sqllab.query_render import PARAMETER_MISSING_ERR
from superset.views.core import DATASOURCE_MISSING_ERR

_FR_MO = (
    pathlib.Path(__file__).parents[3]
    / "superset"
    / "translations"
    / "fr"
    / "LC_MESSAGES"
    / "messages.mo"
)


@pytest.mark.parametrize("constant", [DATASOURCE_MISSING_ERR, PARAMETER_MISSING_ERR])
def test_module_constants_are_lazy(constant: object) -> None:
    """The constants must be LazyString, not import-time-resolved str."""
    assert isinstance(constant, LazyString)


@pytest.mark.skipif(
    not _FR_MO.exists(),
    reason="fr catalog not compiled in this checkout; the LazyString pin above "
    "still guards the laziness",
)
def test_constant_translates_per_request_locale(app_context: None) -> None:
    """The same constant renders per-locale — the point of being lazy."""
    with force_locale("fr"):
        assert str(DATASOURCE_MISSING_ERR) == (
            "La source de données semble avoir été effacée"
        )
    with force_locale("en"):
        assert str(DATASOURCE_MISSING_ERR) == (
            "The data source seems to have been deleted"
        )


def test_no_module_level_eager_gettext_constants() -> None:
    """Inverse-convention tripwire (pairs with sc-120052's lazy-in-request
    scan): in any module binding ``__`` to eager gettext, no module-level
    ``NAME = __(...)`` constant may exist — it would freeze in the default
    locale at import. If this fires, make the constant lazy ``_()`` and
    coerce with ``str()`` at the point of use."""
    import superset

    pattern = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*\s*=\s*__\(", re.M)
    offenders: list[str] = []
    package_root = pathlib.Path(superset.__file__).parent
    for path in package_root.rglob("*.py"):
        source = path.read_text(errors="ignore")
        if "gettext as __" not in source:
            continue
        for match in pattern.finditer(source):
            line = source.count("\n", 0, match.start()) + 1
            offenders.append(f"{path}:{line}")
    assert not offenders, f"module-level eager gettext constants at: {offenders}"
