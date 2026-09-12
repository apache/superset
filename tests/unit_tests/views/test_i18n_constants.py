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

import ast
import pathlib
from unittest.mock import Mock

import pytest
from flask_babel.speaklater import LazyString
from pytest_mock import MockerFixture

from superset.errors import SupersetErrorType
from superset.exceptions import CertificateException
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
    domain: Mock = mocker.Mock()
    domain.gettext.side_effect = lambda s, **kw: f"[[{s}]]"
    mocker.patch("flask_babel.get_domain", return_value=domain)

    assert str(DATASOURCE_MISSING_ERR) == (
        "[[The data source seems to have been deleted]]"
    )


@pytest.mark.parametrize("message", ["", "Custom certificate error"])
def test_certificate_error_translates_default_at_construction(
    mocker: MockerFixture, message: str
) -> None:
    """Translate default instance messages while preserving explicit error details."""
    translate: Mock = mocker.patch(
        "superset.exceptions._", return_value="Translated certificate error"
    )
    cause: Exception = ValueError("Invalid PEM")
    error: CertificateException = CertificateException(
        message, cause, SupersetErrorType.GENERIC_BACKEND_ERROR
    )
    expected: str = message or "Translated certificate error"
    assert str(error) == expected
    assert error.to_dict()["message"] == expected
    assert error.exception is cause
    assert error.error_type == SupersetErrorType.GENERIC_BACKEND_ERROR
    if message:
        translate.assert_not_called()
    else:
        translate.assert_called_once_with("Invalid certificate")


def _is_eager_gettext_call(node: ast.expr, bindings: dict[str, str]) -> bool:
    """Recognize calls to imported eager Babel functions or module attributes."""
    eager_names: set[str] = {"gettext", "ngettext", "pgettext", "npgettext"}
    if isinstance(node, ast.Name):
        return bindings.get(node.id) in eager_names
    return (
        isinstance(node, ast.Attribute)
        and isinstance(node.value, ast.Name)
        and bindings.get(node.value.id) == "flask_babel"
        and node.attr in eager_names
    )


def _record_gettext_import(node: ast.AST, bindings: dict[str, str]) -> None:
    """Resolve Babel import aliases to their original function or module names."""
    alias: ast.alias
    if isinstance(node, ast.ImportFrom):
        if node.module == "flask_babel" and node.level == 0:
            for alias in node.names:
                bindings[alias.asname or alias.name] = alias.name
    elif isinstance(node, ast.Import):
        for alias in node.names:
            if alias.name == "flask_babel":
                bindings[alias.asname or alias.name] = "flask_babel"


def _find_eager_gettext_assignments(source: str) -> list[int]:
    """Return line numbers of direct eager gettext assignments at import time."""
    offenders: list[int] = []

    def visit(node: ast.AST, bindings: dict[str, str]) -> None:
        """Track imports through executable blocks, excluding function bodies."""
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            return
        if isinstance(node, ast.ClassDef):
            bindings = bindings.copy()
        _record_gettext_import(node, bindings)
        if isinstance(node, (ast.Assign, ast.AnnAssign)):
            if isinstance(node.value, ast.Call) and _is_eager_gettext_call(
                node.value.func, bindings
            ):
                offenders.append(node.lineno)
        child: ast.AST
        for child in ast.iter_child_nodes(node):
            visit(child, bindings)

    visit(ast.parse(source), {})
    return offenders


@pytest.mark.parametrize(
    ("source", "expected"),
    [
        ('from flask_babel import gettext as __\nERR = __("missing")', [2]),
        ('from flask_babel import lazy_gettext as __\nERR = __("missing")', []),
        (
            "from flask_babel import gettext as __\n"
            'def render():\n    err = __("missing")',
            [],
        ),
        ('from flask_babel import gettext as __\nERR: str = __("missing")', [2]),
        ('from flask_babel import gettext\nERR = gettext("missing")', [2]),
        ('from flask_babel import ngettext as tr\nERR = tr("one", "many", 2)', [2]),
        ('from flask_babel import pgettext as tr\nERR = tr("ctx", "missing")', [2]),
        (
            "from flask_babel import npgettext as tr\n"
            'ERR = tr("ctx", "one", "many", 2)',
            [2],
        ),
        ('import flask_babel\nERR = flask_babel.gettext("missing")', [2]),
        ('import flask_babel as fb\nERR = fb.gettext("missing")', [2]),
        ('import flask_babel as fb\nERR = fb.lazy_gettext("missing")', []),
        (
            "from flask_babel import gettext as __\n"
            '"""Example:\nERR = __("missing")\n"""',
            [],
        ),
        (
            "from flask_babel import gettext as __\n"
            'class Errors:\n    ERR = __("missing")',
            [3],
        ),
        (
            "from flask_babel import gettext as __\n"
            'if enabled:\n    ERR = __("missing")',
            [3],
        ),
        (
            "from flask_babel import gettext as __\n"
            'try:\n    ERR = __("missing")\n'
            'except Exception:\n    ERR = __("fallback")\n'
            'else:\n    ERR = __("else")\n'
            'finally:\n    ERR = __("finally")',
            [3, 5, 7, 9],
        ),
        (
            "with context():\n    from flask_babel import gettext as __\n"
            '    ERR = __("missing")',
            [3],
        ),
        (
            "async def render():\n    from flask_babel import gettext as __\n"
            '    err = __("missing")',
            [],
        ),
        (
            "from flask_babel import gettext as __\nclass Errors:\n"
            "    from flask_babel import lazy_gettext as __\n"
            '    ERR = __("missing")\nERR = __("missing")',
            [5],
        ),
        ('from flask_babel import lazy_ngettext as gettext\nERR = gettext("x")', []),
        ('from flask_babel import lazy_pgettext as gettext\nERR = gettext("x")', []),
    ],
)
def test_eager_gettext_assignment_classifier(source: str, expected: list[int]) -> None:
    """Distinguish import-time eager assignments from lazy and deferred calls."""
    assert _find_eager_gettext_assignments(source) == expected


def test_no_module_level_eager_gettext_constants() -> None:
    """Reject import-time eager gettext constants throughout the Superset package."""
    import superset

    offenders: list[str] = []
    package_root: pathlib.Path = pathlib.Path(superset.__file__).parent
    path: pathlib.Path
    source: str
    line: int
    for path in package_root.rglob("*.py"):
        source = path.read_text(errors="ignore")
        for line in _find_eager_gettext_assignments(source):
            offenders.append(f"{path}:{line}")
    assert not offenders, f"module-level eager gettext constants at: {offenders}"


def test_constant_renders_in_the_locale_of_each_request(
    tmp_path: pathlib.Path,
) -> None:
    """Two requests with different locales render the SAME constant differently.

    Stronger than the ``get_domain`` stub above: this proves per-request
    locale SELECTION end to end through real Babel machinery — a compiled
    catalog on disk, flask-babel's locale selector (it performs no
    Accept-Language negotiation without one, mirroring how Superset
    installs its own), and the LazyString deferring resolution to each
    request. An eager constant would render identically in both requests.
    """
    from babel.messages.catalog import Catalog
    from babel.messages.mofile import write_mo
    from flask import Flask, request
    from flask_babel import Babel

    msgid = "The data source seems to have been deleted"
    translated = "Die Datenquelle scheint geloescht worden zu sein"
    catalog: Catalog = Catalog(locale="de")
    catalog.add(msgid, translated)
    mo_dir: pathlib.Path = tmp_path / "de" / "LC_MESSAGES"
    mo_dir.mkdir(parents=True)
    with (mo_dir / "messages.mo").open("wb") as buf:
        write_mo(buf, catalog)

    app: Flask = Flask(__name__)
    app.config["BABEL_TRANSLATION_DIRECTORIES"] = str(tmp_path)
    Babel(app, locale_selector=lambda: request.headers.get("X-Locale", "en"))

    with app.test_request_context(headers={"X-Locale": "de"}):
        assert str(DATASOURCE_MISSING_ERR) == translated
    with app.test_request_context(headers={"X-Locale": "en"}):
        assert str(DATASOURCE_MISSING_ERR) == msgid
