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
"""sc-120052: error-response bodies must carry their message.

``json_error_response`` used to set ``payload["error"]`` only for exact
``str`` arguments; a flask-babel ``lazy_gettext`` proxy (LazyString) failed
that isinstance check and the body silently degraded to ``{}`` while the
status still said "denied". Five live call sites in ``superset/views``
shipped empty 403/404 bodies that way. Pins: the helper now coerces
string-like proxies, and a binding-aware source scan keeps lazy ``_()``
out of error bodies at the call sites (the eager alias stays preferred —
the coercion is the safety net, not the convention).
"""

import ast
import pathlib
from typing import cast

import pytest
from flask import Response
from flask_babel import lazy_gettext

from superset.utils import json


def test_json_error_response_carries_lazy_string_message(app_context) -> None:
    """A LazyString body must not degrade to {} (the sc-120052 bug)."""
    from superset.views.error_handling import json_error_response

    resp = cast(
        Response,
        json_error_response(lazy_gettext("permalink state not found"), status=404),
    )

    body = json.loads(resp.get_data(as_text=True))
    assert body.get("error") == "permalink state not found"
    assert resp.status_code == 404


def test_json_error_response_still_carries_plain_str(app_context) -> None:
    from superset.views.error_handling import json_error_response

    resp = cast(Response, json_error_response("nope", status=403))

    assert json.loads(resp.get_data(as_text=True)).get("error") == "nope"


_LAZY_GETTEXT_FUNCS = frozenset(
    {"lazy_gettext", "lazy_ngettext", "lazy_pgettext", "lazy_npgettext"}
)


def _lazy_bindings(tree: ast.Module) -> tuple[set[str], set[str]]:
    """Names bound to lazy Babel functions, and flask_babel module aliases."""
    lazy_names: set[str] = set()
    module_aliases: set[str] = set()
    node: ast.AST
    alias: ast.alias
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            if node.module == "flask_babel" and node.level == 0:
                for alias in node.names:
                    if alias.name in _LAZY_GETTEXT_FUNCS:
                        lazy_names.add(alias.asname or alias.name)
        elif isinstance(node, ast.Import):
            for alias in node.names:
                if alias.name == "flask_babel":
                    module_aliases.add(alias.asname or alias.name)
    return lazy_names, module_aliases


def _lazy_calls_into_json_error_response(source: str) -> list[int]:
    """Line numbers of ``json_error_response(...)`` calls whose argument
    expressions contain a call to a lazily-bound Babel function.

    Binding-aware (aliases, bare ``lazy_gettext(...)``, and
    ``flask_babel.lazy_gettext(...)`` module-attribute calls all
    resolve), and it walks the whole argument subtree, so nesting and
    f-string-free wrapping are caught. Variable indirection
    (``msg = _(...)`` passed by name) is out of scope for a static scan
    -- the runtime coercion in ``json_error_response`` (pinned by the
    behavioral tests above) is the guard for every shape.
    """
    tree = ast.parse(source)
    lazy_names, module_aliases = _lazy_bindings(tree)
    if not lazy_names and not module_aliases:
        return []

    def is_lazy_call(node: ast.AST) -> bool:
        if not isinstance(node, ast.Call):
            return False
        func = node.func
        if isinstance(func, ast.Name):
            return func.id in lazy_names
        return (
            isinstance(func, ast.Attribute)
            and func.attr in _LAZY_GETTEXT_FUNCS
            and isinstance(func.value, ast.Name)
            and func.value.id in module_aliases
        )

    offenders: list[int] = []
    node: ast.AST
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.Call)
            and (
                (
                    isinstance(node.func, ast.Name)
                    and node.func.id == "json_error_response"
                )
                or (
                    isinstance(node.func, ast.Attribute)
                    and node.func.attr == "json_error_response"
                )
            )
            and any(
                is_lazy_call(sub)
                for arg in node.args + [kw.value for kw in node.keywords]
                for sub in ast.walk(arg)
            )
        ):
            offenders.append(node.lineno)
    return offenders


def test_no_lazy_gettext_reaches_json_error_response() -> None:
    """Binding-aware AST tripwire for the call-site convention.

    An error body built by passing a lazy gettext call into
    ``json_error_response`` is the sc-120052 bug shape. The helper now
    coerces (see the tests above), so this scan guards the CONVENTION
    rather than correctness — if it fires, switch the site to the eager
    ``__()`` alias. Unparseable files are skipped rather than failing an
    unrelated i18n test.
    """
    import superset

    offenders: list[str] = []
    package_root = pathlib.Path(superset.__file__).parent
    for path in package_root.rglob("*.py"):
        source = path.read_text(errors="ignore")
        if "json_error_response" not in source:
            continue
        try:
            lines = _lazy_calls_into_json_error_response(source)
        except SyntaxError:
            continue
        for line in lines:
            offenders.append(f"{path}:{line}")
    assert not offenders, f"lazy gettext passed to json_error_response at: {offenders}"


@pytest.mark.parametrize(
    ("source", "expected"),
    [
        (
            'from flask_babel import lazy_gettext as _\njson_error_response(_("x"))',
            [2],
        ),
        (
            'from flask_babel import lazy_gettext as __\njson_error_response(__("x"))',
            [2],
        ),
        (
            "from flask_babel import lazy_gettext\n"
            'json_error_response(lazy_gettext("x"))',
            [2],
        ),
        (
            'import flask_babel as fb\njson_error_response(fb.lazy_gettext("x"))',
            [2],
        ),
        (
            "from flask_babel import lazy_gettext as _\n"
            'json_error_response(utils.error_msg_from_exception(_("x")))',
            [2],
        ),
        (
            "from flask_babel import lazy_gettext as _\n"
            'json_error_response(msg="x", status=400)',
            [],
        ),
        (
            'from flask_babel import gettext as __\njson_error_response(__("x"))',
            [],
        ),
        (
            'x = """json_error_response(_("x"))"""\n'
            "from flask_babel import lazy_gettext as _",
            [],
        ),
    ],
)
def test_lazy_call_site_classifier(source: str, expected: list[int]) -> None:
    """The classifier's corners: aliases, bare and module-attr calls,
    nesting, keyword args, eager bindings ignored, docstring text inert."""
    assert _lazy_calls_into_json_error_response(source) == expected
