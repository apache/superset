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
"""Integration tests for the `/explore/` redirect contract.

Pins the lifted ``get_explore_redirect_url`` helper (``views/utils.py``)
plus its two sanctioned callers (``ExploreView.root`` in ``views/explore.py``
and ``Superset.explore`` GET in ``views/core.py``). Each test maps to a
failure mode the helper or its callers must close:

- Malformed/invalid ``datasource`` no longer surfaces as 500.
- Non-numeric ``?slice_id=`` no longer raises ``ValueError``.
- Cache-write failure renders SPA instead of 302-looping.
- ``form_data`` ``slice_id`` wins over query ``slice_id`` (precedence pin).
- Loop guard via ``(endpoint, sorted_query_items)`` equality.
- ``ExploreView.root`` owns the bare ``/explore/`` rule (registration order).
- The sanctioned callers set is exactly ``{explore.py, core.py}``;
  a third caller fails the static assertion.
"""

import ast
from pathlib import Path
from unittest import mock
from urllib.parse import quote

import pytest
from flask import current_app

from superset.utils import json
from tests.integration_tests.base_tests import SupersetTestCase
from tests.integration_tests.constants import ADMIN_USERNAME
from tests.integration_tests.fixtures.energy_dashboard import (
    load_energy_table_data,  # noqa: F401
    load_energy_table_with_slice,  # noqa: F401
)

REPO_ROOT = Path(__file__).resolve().parents[3]


class TestExploreRedirect(SupersetTestCase):
    """Pins for ``get_explore_redirect_url`` and its sanctioned callers."""

    def test_explore_root_owns_bare_path(self):
        """``ExploreView.root`` wins the ``/explore/`` GET rule.

        Load-bearing because the deprecated ``Superset.explore`` view also
        registers ``/explore/`` (``views/core.py:445``) and the cache-and-
        redirect contract depends on ``ExploreView.root`` being the first
        match. The url_map enumerates rules in registration order; whoever
        wins shapes which view's body runs and which `request.endpoint`
        value the helper's loop guard compares against.
        """
        adapter = current_app.url_map.bind("")
        endpoint, _ = adapter.match("/explore/", method="GET")
        assert endpoint == "ExploreView.root"

    @pytest.mark.usefixtures("load_energy_table_with_slice")
    @mock.patch("superset.commands.explore.form_data.create.CreateFormDataCommand.run")
    def test_explore_root_redirects_with_datasource(self, mock_run: mock.Mock):
        """Happy path: ``form_data`` with a valid ``datasource`` → 302."""
        mock_run.return_value = "random_key"
        self.login(ADMIN_USERNAME)
        form_data = {"slice_id": 1, "viz_type": "line", "datasource": "1__table"}
        rv = self.client.get(f"/explore/?form_data={quote(json.dumps(form_data))}")
        assert rv.status_code == 302
        assert rv.headers["Location"] == "/explore/?form_data_key=random_key"

    def test_explore_root_non_dict_form_data_renders_spa(self):
        """Non-dict ``form_data=42`` returns 200 instead of 500."""
        self.login(ADMIN_USERNAME)
        rv = self.client.get("/explore/?form_data=42")
        assert rv.status_code == 200

    def test_explore_root_no_datasource_renders_spa(self):
        """No ``datasource`` (e.g. legacy ``slice_url`` payload) → SPA."""
        self.login(ADMIN_USERNAME)
        form_data = {"slice_id": 1}
        rv = self.client.get(f"/explore/?form_data={quote(json.dumps(form_data))}")
        assert rv.status_code == 200

    def test_explore_root_datasource_no_double_underscore(self):
        """Shape: ``datasource="1"`` (no ``__type``) → 200, not 500.

        HEAD raised ``ValueError: not enough values to unpack`` inside
        ``datasource.split("__")`` and surfaced as 500. The lifted helper
        guards on ``len(parts) != 2`` and falls through to the SPA.
        """
        self.login(ADMIN_USERNAME)
        form_data = {"datasource": "1"}
        rv = self.client.get(f"/explore/?form_data={quote(json.dumps(form_data))}")
        assert rv.status_code == 200

    def test_explore_root_datasource_non_string(self):
        """A non-string ``datasource`` value
        (number, list, dict, bool) used to raise ``AttributeError: ... has
        no attribute 'split'`` inside ``datasource.split("__")`` and
        surface as 500.

        The lifted helper now type-guards ``isinstance(datasource, str)``
        before the split and falls through to the SPA on any non-string
        shape.
        """
        # ``@pytest.mark.parametrize`` is a no-op on ``unittest.TestCase``
        # subclasses (see pytest docs on unittest interop), so we inline
        # the cases as a ``subTest`` loop to keep per-shape reporting.
        self.login(ADMIN_USERNAME)
        for datasource_value in (123, ["1__table"], {"id": 1, "type": "table"}, True):
            with self.subTest(datasource_value=datasource_value):
                form_data = {"datasource": datasource_value}
                rv = self.client.get(
                    f"/explore/?form_data={quote(json.dumps(form_data))}"
                )
                assert rv.status_code == 200

    def test_explore_root_datasource_invalid_enum(self):
        """Enum: ``datasource="1__bogus"`` → 200, not 500.

        HEAD raised ``ValueError`` from ``DatasourceType("bogus")``; the
        narrow ``try/except ValueError`` around the enum coercion falls
        through to the SPA.
        """
        self.login(ADMIN_USERNAME)
        form_data = {"datasource": "1__bogus"}
        rv = self.client.get(f"/explore/?form_data={quote(json.dumps(form_data))}")
        assert rv.status_code == 200

    @pytest.mark.usefixtures("load_energy_table_with_slice")
    @mock.patch("superset.commands.explore.form_data.create.CreateFormDataCommand.run")
    def test_explore_root_combined_invalid_slice_id(self, mock_run: mock.Mock):
        """``?slice_id=abc`` combined with valid ``form_data`` → 302.

        HEAD raised ``ValueError: invalid literal for int()`` on the eager
        ``int(request.args.get("slice_id", 0))`` even when the slice_id
        wasn't going to be used. The helper now consults form_data first
        and uses Flask's typed parse (returns None on failure) for the
        fallback, collapsed to 0 with ``or 0``.
        """
        mock_run.return_value = "random_key"
        self.login(ADMIN_USERNAME)
        form_data = {"datasource": "1__table"}
        rv = self.client.get(
            f"/explore/?slice_id=abc&form_data={quote(json.dumps(form_data))}"
        )
        assert rv.status_code == 302

    @pytest.mark.usefixtures("load_energy_table_with_slice")
    @mock.patch("superset.commands.explore.form_data.create.CreateFormDataCommand")
    def test_explore_root_slice_id_non_int(self, mock_command_cls: mock.Mock):
        """A non-int, non-None
        ``form_data.slice_id`` (string, list, dict, bool) used to survive
        the ``is None`` guard and reach ``CommandParameters(chart_id=...)``,
        500ing downstream when the cache write tried to coerce it.

        The tightened ``isinstance(slice_id, int)`` guard (excluding
        ``bool`` because it is a subclass of ``int``) treats any non-int
        shape the same as missing: fall back to the typed query parse
        (or 0). Chart ID lands as the integer fallback, not the malformed
        value.
        """
        # ``@pytest.mark.parametrize`` is a no-op on ``unittest.TestCase``
        # subclasses (see pytest docs on unittest interop), so we inline
        # the cases as a ``subTest`` loop to keep per-shape reporting.
        self.login(ADMIN_USERNAME)
        for slice_id_value in ("abc", [1, 2], {"id": 1}, True):
            with self.subTest(slice_id_value=slice_id_value):
                mock_command_cls.reset_mock()
                mock_command_cls.return_value.run.return_value = "random_key"
                form_data = {"slice_id": slice_id_value, "datasource": "1__table"}
                rv = self.client.get(
                    f"/explore/?form_data={quote(json.dumps(form_data))}"
                )
                assert rv.status_code == 302
                # ``CreateFormDataCommand(parameters)`` is called positionally
                # with a ``CommandParameters`` dataclass; assert against
                # ``args[0]`` (matches the sibling precedence test at L210).
                assert mock_command_cls.call_args.args[0].chart_id == 0

    @pytest.mark.usefixtures("load_energy_table_with_slice")
    @mock.patch("superset.commands.explore.form_data.create.CreateFormDataCommand")
    def test_explore_slice_id_precedence_form_data_wins(
        self, mock_command_cls: mock.Mock
    ):
        """form_data slice_id wins over query slice_id (precedence pin).

        Pre-lift the static method used
        ``parsed_form_data.get("slice_id", int(request.args.get("slice_id", 0)))``
        — form_data won when present. The lifted helper preserves that
        precedence: form_data first, query second.
        """
        mock_command_cls.return_value.run.return_value = "random_key"
        self.login(ADMIN_USERNAME)
        form_data = {"slice_id": 42, "datasource": "1__table"}
        self.client.get(
            f"/explore/?slice_id=99&form_data={quote(json.dumps(form_data))}"
        )
        # ``CreateFormDataCommand(parameters)`` is called positionally with a
        # ``CommandParameters`` dataclass; assert against ``args[0]`` not kwargs.
        assert mock_command_cls.call_args.args[0].chart_id == 42

    @pytest.mark.usefixtures("load_energy_table_with_slice")
    @mock.patch("superset.commands.explore.form_data.create.CreateFormDataCommand.run")
    def test_explore_cache_failure_renders_spa(self, mock_run: mock.Mock):
        """Cache-write ``ValueError`` falls through to SPA (loop guard).

        ``CreateFormDataCommand`` raises ``ValueError`` when the cache
        layer fails; the lifted helper catches narrowly and returns
        ``None`` so the view renders the SPA instead of 302-looping.
        """
        mock_run.side_effect = ValueError("cache down")
        self.login(ADMIN_USERNAME)
        form_data = {"datasource": "1__table"}
        rv = self.client.get(f"/explore/?form_data={quote(json.dumps(form_data))}")
        assert rv.status_code == 200

    @pytest.mark.usefixtures("load_energy_table_with_slice")
    @mock.patch("superset.commands.explore.form_data.create.CreateFormDataCommand.run")
    def test_explore_loop_guard_endpoint_equal(self, mock_run: mock.Mock):
        """If the would-be redirect target matches the request, render SPA.

        ``CreateFormDataCommand.run`` returning an empty string means the
        helper computes a target URL identical to the current request
        (no ``form_data_key`` swap). Without the ``(endpoint, sorted
        query items)`` guard the view would 302-loop to itself.
        """
        mock_run.return_value = ""
        self.login(ADMIN_USERNAME)
        form_data = {"datasource": "1__table"}
        rv = self.client.get(f"/explore/?form_data={quote(json.dumps(form_data))}")
        assert rv.status_code == 200

    @pytest.mark.usefixtures("load_energy_table_with_slice")
    @mock.patch("superset.commands.explore.form_data.create.CreateFormDataCommand.run")
    def test_explore_reserved_url_for_kwargs_stripped(self, mock_run: mock.Mock):
        """Query keys colliding with ``url_for``'s own parameters must not
        steer URL building: ``_external``/``_scheme`` would mint an absolute
        URL with an attacker-chosen scheme, ``_anchor`` injects a fragment,
        and ``endpoint`` raises TypeError on the duplicated positional
        argument (500). All five reserved names are dropped from the
        redirect target.
        """
        mock_run.return_value = "random_key"
        self.login(ADMIN_USERNAME)
        form_data = {"datasource": "1__table"}
        rv = self.client.get(
            f"/explore/?form_data={quote(json.dumps(form_data))}"
            "&_external=1&_scheme=ftp&_anchor=evil&_method=POST&endpoint=x"
        )
        assert rv.status_code == 302
        assert rv.headers["Location"] == "/explore/?form_data_key=random_key"

    @pytest.mark.usefixtures("load_energy_table_with_slice")
    @mock.patch("superset.commands.explore.form_data.create.CreateFormDataCommand.run")
    def test_superset_explore_typed_entry_redirect_when_form_data_present(
        self, mock_run: mock.Mock
    ):
        """Typed-entry GET (``/explore/<dst>/<int:dsid>/``) honours the helper.

        Pins the second sanctioned caller — the deprecated
        ``Superset.explore`` GET branch routes through the same helper
        so the datasource and slice_id guards apply identically.
        """
        mock_run.return_value = "random_key"
        self.login(ADMIN_USERNAME)
        form_data = {"datasource": "1__table"}
        rv = self.client.get(
            f"/explore/table/1/?form_data={quote(json.dumps(form_data))}"
        )
        assert rv.status_code == 302

    def test_superset_explore_typed_entry_renders_spa_without_form_data(self):
        """Typed-entry GET without ``form_data`` renders the SPA.

        Pre-lift, ``Superset.explore`` GET always called
        ``Superset.get_redirect_url`` and unconditionally redirected to
        whatever it returned — when ``form_data`` was absent the old
        helper returned `url_for("ExploreView.root")` (i.e. ``/explore/``),
        but the typed-entry request was at ``/explore/<dst>/<int:dsid>/``,
        so the redirect was a different URL: the SPA loaded under the
        wrong route. The lifted helper returns ``None`` when ``form_data``
        is absent and the caller falls through to ``render_app_template``.
        """
        self.login(ADMIN_USERNAME)
        rv = self.client.get("/explore/table/1/")
        assert rv.status_code == 200

    def test_get_explore_redirect_url_sanctioned_callers(self):
        """Exactly two files call the helper; a third must update this test.

        Pins the sanctioned-callers invariant via a source-tree scan so a
        third caller landing without an explicit update fails CI. Mirrors
        the ``applicationRoot()`` and ``DIRECT_DOM_NAV_SANCTIONED`` patterns
        from the frontend L2 scanners.
        """
        # Scan the AST rather than raw text: only executable call sites count,
        # so a mention of the helper in a comment, docstring, or string literal
        # is not mistaken for a caller. This also excludes the definition site
        # by shape instead of by path — `def get_explore_redirect_url` parses to
        # a FunctionDef, not a Call — which keeps `views/utils.py` itself in
        # scope. Skipping that module wholesale would hide a genuine new call
        # added inside it, the exact thing this scan exists to catch.
        callers: set[str] = set()
        for path in (REPO_ROOT / "superset").rglob("*.py"):
            tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
            for node in ast.walk(tree):
                if not isinstance(node, ast.Call):
                    continue
                func = node.func
                if isinstance(func, ast.Name):
                    called = func.id
                elif isinstance(func, ast.Attribute):
                    called = func.attr
                else:
                    continue
                if called == "get_explore_redirect_url":
                    callers.add(str(path.relative_to(REPO_ROOT)).replace("\\", "/"))
                    break
        assert callers == {
            "superset/views/explore.py",
            "superset/views/core.py",
        }, (
            "Sanctioned callers of `get_explore_redirect_url` changed. "
            "Update this assertion "
            f"if the new caller is legitimate. Found: {sorted(callers)}"
        )
