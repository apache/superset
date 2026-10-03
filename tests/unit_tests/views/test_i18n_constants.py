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
from collections import Counter
from collections.abc import Iterator
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


def _iter_eager_gettext_calls(
    node: ast.AST, bindings: dict[str, str]
) -> Iterator[ast.Call]:
    """Inspect nested values while respecting explicitly deferred expressions."""
    if isinstance(node, ast.Lambda):
        # Defaults execute when the lambda is created; its body does not.
        default: ast.expr | None
        for default in (*node.args.defaults, *node.args.kw_defaults):
            if default is not None:
                yield from _iter_eager_gettext_calls(default, bindings)
        return
    if isinstance(node, ast.GeneratorExp):
        # Only the outer iterable is evaluated when a generator is created.
        yield from _iter_eager_gettext_calls(node.generators[0].iter, bindings)
        return
    if isinstance(node, ast.Call) and _is_eager_gettext_call(node.func, bindings):
        yield node
    child: ast.AST
    for child in ast.iter_child_nodes(node):
        yield from _iter_eager_gettext_calls(child, bindings)


def _find_eager_gettext_calls(source: str) -> list[ast.Call]:
    """Find eager calls in import-time assignment expressions, not deferred bodies.

    This bounded tripwire is not an interprocedural evaluator: it does not follow
    wrapper functions or infer that a consumer immediately invokes a callback.
    """
    offenders: list[ast.Call] = []

    def visit(node: ast.AST, bindings: dict[str, str]) -> None:
        """Track imports through executable blocks, excluding function bodies."""
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            return
        if isinstance(node, ast.ClassDef):
            bindings = bindings.copy()
        _record_gettext_import(node, bindings)
        if isinstance(node, (ast.Assign, ast.AnnAssign)):
            if node.value is not None:
                offenders.extend(_iter_eager_gettext_calls(node.value, bindings))
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
        (
            "from flask_babel import gettext as tr\n"
            'FIELD = fields.String(metadata={"description": tr("Username")})',
            [2],
        ),
        ('from flask_babel import gettext as tr\nLABELS = [tr("one")]', [2]),
        ('from flask_babel import gettext as tr\nLABELS = {"one": tr("one")}', [2]),
        ('from flask_babel import gettext as tr\nLABEL = lambda: tr("one")', []),
        ("from flask_babel import gettext as tr\nLABELS = (tr(x) for x in names)", []),
        ("from flask_babel import gettext as tr\nLABELS = [tr(x) for x in names]", [2]),
        ('from flask_babel import gettext as tr\nLABEL = lambda x=tr("x"): x', [2]),
        ('from flask_babel import gettext as tr\nLABELS = (x for x in tr("x"))', [2]),
    ],
)
def test_eager_gettext_assignment_classifier(source: str, expected: list[int]) -> None:
    """Distinguish import-time eager assignments from lazy and deferred calls."""
    assert [call.lineno for call in _find_eager_gettext_calls(source)] == expected


# Existing import-time translation debt, not whole-module exemptions. Each
# normalized call expression has an occurrence budget; another call, even in an
# already-listed file, fails the fence. Remove entries as debt is fixed rather
# than mass-converting schema metadata whose lazy-string consumers need review.
_EAGER_CONSTANT_ALLOWLIST: dict[str, dict[str, int]] = {
    "charts/schemas.py": {
        "_('`window` must be between 1 and 10000')": 1,
        "_('`confidence_interval` must be between 0 and 1 (exclusive)')": 1,
        (
            "_('lower percentile must be greater than 0 and less "
            "than 100. Must be lower than upper percentile.')"
        ): 1,
        (
            "_('upper percentile must be greater than 0 and less "
            "than 100. Must be higher than lower percentile.')"
        ): 1,
        "_('`width` must be greater or equal to 0')": 1,
        "_('`row_limit` must be greater than or equal to 0')": 1,
        "_('`row_offset` must be greater than or equal to 0')": 1,
        "_('orderby column must be populated')": 1,
    },
    "custom_database_errors.py": {
        "__('This is custom error message for a')": 1,
        "__('This is custom error message for b')": 1,
    },
    "db_engine_specs/athena.py": {
        (
            "__('Please check your query for syntax errors at or "
            'near "%(syntax_error)s". Then, try running your quer'
            "y again.')"
        ): 1,
    },
    "db_engine_specs/base.py": {
        "__('Username')": 1,
        "__('Password')": 1,
        "__('Hostname or IP address')": 1,
        "__('Database port')": 1,
        "__('Database name')": 1,
        "__('Additional parameters')": 1,
        "__('Use an encrypted connection to the database')": 1,
        "__('Use an ssh tunnel connection to the database')": 1,
    },
    "db_engine_specs/bigquery.py": {
        (
            "__('Unable to connect. Verify that the following rol"
            'es are set on the service account: "BigQuery Data Vi'
            'ewer", "BigQuery Metadata Viewer", "BigQuery Job Use'
            'r" and the following permissions are set "bigquery.r'
            'eadsessions.create", "bigquery.readsessions.getData"'
            "')"
        ): 1,
        (
            '__(\'The table "%(table)s" does not exist. A valid ta'
            "ble must be used to run this query.')"
        ): 1,
        (
            "__('We can\\'t seem to resolve column \"%(column)s\" at"
            " line %(location)s.')"
        ): 1,
        (
            '__(\'The schema "%(schema)s" does not exist. A valid '
            "schema must be used to run this query.')"
        ): 1,
        (
            "__('Please check your query for syntax errors at or "
            'near "%(syntax_error)s". Then, try running your quer'
            "y again.')"
        ): 1,
    },
    "db_engine_specs/clickhouse.py": {
        "__('Username')": 1,
        "__('Password')": 1,
        "__('Hostname or IP address')": 1,
        "__('Database port')": 1,
        "__('Database name')": 1,
        "__('Use an encrypted connection to the database')": 1,
        "__('Additional parameters')": 1,
        "__('Use an ssh tunnel connection to the database')": 1,
    },
    "db_engine_specs/couchbase.py": {
        "__('Username')": 1,
        "__('Password')": 1,
        "__('Hostname or IP address')": 1,
        "__('Database name')": 1,
        "__('Database port')": 1,
        "__('Use an encrypted connection to the database')": 1,
        "__('Additional parameters')": 1,
    },
    "db_engine_specs/databend.py": {
        "__('Username')": 1,
        "__('Password')": 1,
        "__('Hostname or IP address')": 1,
        "__('Database port')": 1,
        "__('Database name')": 1,
        "__('Use an encrypted connection to the database')": 1,
        "__('Additional parameters')": 1,
    },
    "db_engine_specs/databricks.py": {
        "__('Database port')": 1,
        "__('Use an encrypted connection to the database')": 1,
    },
    "db_engine_specs/datastore.py": {
        (
            "__('Unable to connect. Verify that the following rol"
            'es are set on the service account: "Cloud Datastore '
            'Viewer", "Cloud Datastore User", "Cloud Datastore Cr'
            "eator\"')"
        ): 1,
        (
            '__(\'The table "%(table)s" does not exist. A valid ta'
            "ble must be used to run this query.')"
        ): 1,
        (
            "__('We can\\'t seem to resolve column \"%(column)s\" at"
            " line %(location)s.')"
        ): 1,
        (
            '__(\'The schema "%(schema)s" does not exist. A valid '
            "schema must be used to run this query.')"
        ): 1,
        (
            "__('Please check your query for syntax errors at or "
            'near "%(syntax_error)s". Then, try running your quer'
            "y again.')"
        ): 1,
    },
    "db_engine_specs/doris.py": {
        ("__('Either the username \"%(username)s\" or the password is incorrect.')"): 1,
        "__('Unknown Doris server host \"%(hostname)s\".')": 1,
        ("__('The host \"%(hostname)s\" might be down and can\\'t be reached.')"): 1,
        "__('Unable to connect to database \"%(database)s\".')": 1,
        (
            "__('Please check your query for syntax errors near \""
            '%(server_error)s". Then, try running your query agai'
            "n.')"
        ): 1,
    },
    "db_engine_specs/duckdb.py": {
        "__('MotherDuck token')": 1,
        "__('Database name')": 1,
        "__('Additional parameters')": 1,
        "__('We can\\'t seem to resolve the column \"%(column_name)s\"')": 1,
    },
    "db_engine_specs/gsheets.py": {
        (
            "__('Please check your query for syntax errors near \""
            '%(server_error)s". Then, try running your query agai'
            "n.')"
        ): 1,
    },
    "db_engine_specs/mssql.py": {
        (
            '__(\'Either the username "%(username)s", password, or'
            ' database name "%(database)s" is incorrect.\')'
        ): 1,
        "__('The hostname \"%(hostname)s\" cannot be resolved.')": 1,
        ("__('Port %(port)s on hostname \"%(hostname)s\" refused the connection.')"): 1,
        (
            "__('The host \"%(hostname)s\" might be down, and can\\'"
            "t be reached on port %(port)s.')"
        ): 1,
    },
    "db_engine_specs/mysql.py": {
        ("__('Either the username \"%(username)s\" or the password is incorrect.')"): 1,
        "__('Unknown MySQL server host \"%(hostname)s\".')": 1,
        ("__('The host \"%(hostname)s\" might be down and can\\'t be reached.')"): 1,
        "__('Unable to connect to database \"%(database)s\".')": 1,
        (
            "__('Please check your query for syntax errors near \""
            '%(server_error)s". Then, try running your query agai'
            "n.')"
        ): 1,
    },
    "db_engine_specs/oceanbase.py": {
        ("__('Either the username \"%(username)s\" or the password is incorrect.')"): 1,
        "__('Unknown OceanBase server host \"%(hostname)s\".')": 1,
        ("__('The host \"%(hostname)s\" might be down and can\\'t be reached.')"): 1,
        "__('Unable to connect to database \"%(database)s\".')": 1,
        (
            "__('Please check your query for syntax errors near \""
            '%(server_error)s". Then, try running your query agai'
            "n.')"
        ): 1,
    },
    "db_engine_specs/ocient.py": {
        "__('The username \"%(username)s\" does not exist.')": 1,
        (
            "__('The user/password combination is not valid (Inco"
            "rrect password for user).')"
        ): 1,
        "__('Could not connect to database: \"%(database)s\"')": 1,
        "__('Could not resolve hostname: \"%(host)s\".')": 1,
        "__('Port out of range 0-65535')": 1,
        (
            '__("Invalid Connection String: Expecting String of t'
            "he form 'ocient://user:pass@host:port/database'.\")"
        ): 1,
        (
            '__(\'Syntax Error: %(qualifier)s input "%(input)s" ex'
            "pecting \"%(expected)s')"
        ): 1,
        "__('Table or View \"%(table)s\" does not exist.')": 1,
        "__('Invalid reference to column: \"%(column)s\"')": 1,
    },
    "db_engine_specs/postgres.py": {
        "__('The username \"%(username)s\" does not exist.')": 1,
        ("__('The password provided for username \"%(username)s\" is incorrect.')"): 1,
        "__('Please re-enter the password.')": 1,
        "__('The hostname \"%(hostname)s\" cannot be resolved.')": 1,
        ("__('Port %(port)s on hostname \"%(hostname)s\" refused the connection.')"): 1,
        (
            "__('The host \"%(hostname)s\" might be down, and can\\'"
            "t be reached on port %(port)s.')"
        ): 1,
        "__('Unable to connect to database \"%(database)s\".')": 1,
        (
            "__('We can\\'t seem to resolve the column \"%(column_n"
            "ame)s\" at line %(location)s.')"
        ): 1,
        (
            "__('Please check your query for syntax errors at or "
            'near "%(syntax_error)s". Then, try running your quer'
            "y again.')"
        ): 1,
        "__('Database port')": 1,
    },
    "db_engine_specs/presto.py": {
        (
            "__('We can\\'t seem to resolve the column \"%(column_n"
            "ame)s\" at line %(location)s.')"
        ): 1,
        (
            '__(\'The table "%(table_name)s" does not exist. A val'
            "id table must be used to run this query.')"
        ): 1,
        (
            '__(\'The schema "%(schema_name)s" does not exist. A v'
            "alid schema must be used to run this query.')"
        ): 1,
        ("__('Either the username \"%(username)s\" or the password is incorrect.')"): 1,
        "__('Unexpected HTTP 401 response. Check your credentials.')": 1,
        "__('The hostname \"%(hostname)s\" cannot be resolved.')": 1,
        (
            "__('The host \"%(hostname)s\" might be down, and can\\'"
            "t be reached on port %(port)s.')"
        ): 1,
        ("__('Port %(port)s on hostname \"%(hostname)s\" refused the connection.')"): 1,
        "__('Unable to connect to catalog named \"%(catalog_name)s\".')": 1,
    },
    "db_engine_specs/redshift.py": {
        ("__('Either the username \"%(username)s\" or the password is incorrect.')"): 1,
        "__('The hostname \"%(hostname)s\" cannot be resolved.')": 1,
        ("__('Port %(port)s on hostname \"%(hostname)s\" refused the connection.')"): 1,
        (
            "__('The host \"%(hostname)s\" might be down, and can\\'"
            "t be reached on port %(port)s.')"
        ): 1,
        (
            "__('We were unable to connect to your database named"
            ' "%(database)s". Please verify your database name an'
            "d try again.')"
        ): 1,
    },
    "db_engine_specs/snowflake.py": {
        "__('%(object)s does not exist in this database.')": 1,
        (
            "__('Please check your query for syntax errors at or "
            'near "%(syntax_error)s". Then, try running your quer'
            "y again.')"
        ): 1,
    },
    "db_engine_specs/sqlite.py": {
        "__('We can\\'t seem to resolve the column \"%(column_name)s\"')": 1,
    },
    "db_engine_specs/starrocks.py": {
        ("__('Either the username \"%(username)s\" or the password is incorrect.')"): 1,
        "__('Unable to connect to database \"%(database)s\".')": 1,
    },
    "reports/schemas.py": {
        "_('Value must be greater than 0')": 5,
        "_('Custom width of the screenshot in pixels')": 2,
        "_('Enable automatic retries on report failure')": 2,
        "_('Maximum number of retry attempts (1–10)')": 2,
        "_('Must be between 1 and 10')": 2,
        (
            "_('Send the failed report to all recipients after retries are exhausted')"
        ): 2,
        "_('Notify report owners on each retry attempt')": 2,
        "_('Notify report recipients on each retry attempt')": 2,
        "_('Value must be 0 or greater')": 1,
        "_('UUID to track the execution status')": 1,
        "_('Success message')": 1,
    },
}


def _unexpected_eager_calls(source: str, allowed: dict[str, int]) -> list[ast.Call]:
    """Return calls beyond the explicitly recorded existing-debt budget."""
    remaining: Counter[str] = Counter(allowed)
    unexpected: list[ast.Call] = []
    call: ast.Call
    for call in _find_eager_gettext_calls(source):
        signature: str = ast.unparse(call)
        if remaining[signature] > 0:
            remaining[signature] -= 1
        else:
            unexpected.append(call)
    return unexpected


def test_eager_call_debt_does_not_exempt_new_calls() -> None:
    """Debt exempts only recorded occurrences, not a module or new messages."""
    source: str = (
        "from flask_babel import gettext as tr\n"
        'OLD = {"label": tr("known")}\n'
        'DUPLICATE = [tr("known")]\n'
        'NEW = field(description=tr("new"))\n'
    )
    assert [
        call.lineno for call in _unexpected_eager_calls(source, {"tr('known')": 1})
    ] == [3, 4]
    assert len(_unexpected_eager_calls(source, {})) == 3
    assert (
        _unexpected_eager_calls(source.split("DUPLICATE")[0], {"tr('known')": 1}) == []
    )


def test_no_module_level_eager_gettext_constants() -> None:
    """Reject import-time eager gettext constants throughout the Superset package.

    Would be a linter rule in a perfect world (standard ``# noqa``-style
    opt-out, no runtime tree walk); until a custom pylint checker exists
    the allowlist above is the opt-out, unparseable files are skipped
    rather than failing an unrelated i18n test, and the full-package walk
    is bounded (~1s measured)."""
    import superset

    offenders: list[str] = []
    skipped: list[str] = []
    package_root: pathlib.Path = pathlib.Path(superset.__file__).parent
    path: pathlib.Path
    source: str
    for path in package_root.rglob("*.py"):
        source = path.read_text(errors="ignore")
        try:
            calls: list[ast.Call] = _unexpected_eager_calls(
                source,
                _EAGER_CONSTANT_ALLOWLIST.get(str(path.relative_to(package_root)), {}),
            )
        except SyntaxError:
            skipped.append(str(path))
            continue
        call: ast.Call
        for call in calls:
            offenders.append(f"{path}:{call.lineno}: {ast.unparse(call)}")
    assert not offenders, (
        f"module-level eager gettext constants at: {offenders} "
        f"(allowlist: tests/unit_tests/views/test_i18n_constants.py; "
        f"unparseable files skipped: {skipped or 'none'})"
    )


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

    msgid: str = "The data source seems to have been deleted"
    translated: str = "Die Datenquelle scheint geloescht worden zu sein"
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
