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
from flask_babel.speaklater import LazyString
from pytest_mock import MockerFixture

from superset.sqllab.query_render import PARAMETER_MISSING_ERR
from superset.views.core import DATASOURCE_MISSING_ERR


@pytest.mark.parametrize("constant", [DATASOURCE_MISSING_ERR, PARAMETER_MISSING_ERR])
def test_module_constants_are_lazy(constant: object) -> None:
    """The constants must be LazyString, not import-time-resolved str."""
    assert isinstance(constant, LazyString)


def test_constant_resolves_through_the_live_translation_lookup(
    mocker: MockerFixture,
) -> None:
    """str(constant) consults the active translation machinery per call.

    Stubbing flask-babel's domain proves every render goes through the
    lookup — an eager constant would have been frozen to a plain str
    before the stub existed and could never produce the sentinel. Runs on
    every backend, unlike a compiled-catalog-dependent locale pin."""
    domain = mocker.Mock()
    domain.gettext.side_effect = lambda s, **kw: f"[[{s}]]"
    mocker.patch("flask_babel.get_domain", return_value=domain)

    assert str(DATASOURCE_MISSING_ERR) == (
        "[[The data source seems to have been deleted]]"
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
