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
"""How the host merges the CSP sources that extensions declare."""

from __future__ import annotations

import copy
import logging
import re
from collections.abc import Iterator
from typing import Any

import pytest
import superset_core.extensions.csp as core_csp
from flask import Flask
from flask_talisman import Talisman
from pytest_mock import MockerFixture
from superset_core.extensions.csp import CSP_DIRECTIVES, CspSources
from superset_core.extensions.types import Manifest

from superset import config as superset_config, talisman
from superset.extensions import csp
from superset.extensions.context import ConcreteExtensionContext, use_context

SANDBOX = "https://*.sandbox.example"
FRAMES: CspSources = {"frame-src": [SANDBOX]}

# Talisman is on by default; this module checks how the app is wired with it.
pytestmark = pytest.mark.parametrize("app", [{"TALISMAN_ENABLED": True}], indirect=True)


@pytest.fixture(autouse=True)
def _no_declarations() -> Iterator[None]:
    """Each test starts, and leaves the process, with nothing declared."""
    csp.clear_csp_sources()
    csp._refuse.cache_clear()  # noqa: SLF001
    csp._report_failure.cache_clear()  # noqa: SLF001
    yield
    csp.clear_csp_sources()
    csp._refuse.cache_clear()  # noqa: SLF001
    csp._report_failure.cache_clear()  # noqa: SLF001


def test_the_host_implements_add_csp_sources() -> None:
    assert core_csp.add_csp_sources is csp.add_csp_sources


def test_every_directive_extensions_may_add_to_has_its_fallbacks() -> None:
    assert set(csp.DIRECTIVE_FALLBACKS) == CSP_DIRECTIVES


def test_a_source_joins_its_directive() -> None:
    policy = "default-src 'self'; frame-src 'self' https://maps.example"
    assert csp.merge_policy(policy, FRAMES) == (
        f"default-src 'self'; frame-src 'self' https://maps.example {SANDBOX}"
    )


def test_a_policy_that_allows_every_source_already_is_kept_as_it_is() -> None:
    policy = "default-src 'self';  frame-src 'self' HTTPS://*.Sandbox.Example ;"
    assert csp.merge_policy(policy, FRAMES) is policy


def test_a_missing_directive_starts_from_default_src() -> None:
    """frame-src falls back to default-src; 'self' stays allowed in frames."""
    policy = "default-src 'self'; img-src 'self' data:"
    assert csp.merge_policy(policy, FRAMES) == (
        f"default-src 'self'; img-src 'self' data:; frame-src 'self' {SANDBOX}"
    )


def test_frame_src_starts_from_child_src_before_default_src() -> None:
    policy = "default-src 'self'; child-src https://maps.example"
    assert csp.merge_policy(policy, FRAMES) == (
        f"{policy}; frame-src https://maps.example {SANDBOX}"
    )


def test_a_directive_nothing_restricts_stays_out() -> None:
    """Adding frame-src would block the frames that the policy allows."""
    policy = "script-src 'self'; img-src 'self'"
    assert csp.merge_policy(policy, FRAMES) is policy


def test_a_source_replaces_none() -> None:
    assert csp.merge_policy("default-src 'none'", FRAMES) == (
        f"default-src 'none'; frame-src {SANDBOX}"
    )
    assert csp.merge_policy("frame-src 'none'", FRAMES) == f"frame-src {SANDBOX}"


def test_the_first_of_duplicate_directives_gets_the_source() -> None:
    """A browser reads only the first occurrence of a directive."""
    policy = "frame-src 'self'; frame-src https://maps.example"
    assert csp.merge_policy(policy, FRAMES) == (
        f"frame-src 'self' {SANDBOX}; frame-src https://maps.example"
    )


def test_each_policy_in_a_header_gets_the_source() -> None:
    policy = "default-src 'self', frame-src https://maps.example"
    assert csp.merge_policy(policy, FRAMES) == (
        f"default-src 'self'; frame-src 'self' {SANDBOX}, "
        f"frame-src https://maps.example {SANDBOX}"
    )


def test_other_directives_keep_their_sources_and_nonces() -> None:
    policy = "script-src 'self' 'strict-dynamic' 'nonce-abc'; default-src 'self'"
    merged = csp.merge_policy(policy, {"frame-src": [SANDBOX], "img-src": [SANDBOX]})
    assert merged == (f"{policy}; frame-src 'self' {SANDBOX}; img-src 'self' {SANDBOX}")


def test_declarations_add_up_without_duplicates() -> None:
    csp.add_csp_sources(lambda: FRAMES)
    csp.add_csp_sources(
        lambda: {
            "frame-src": ["https://*.SANDBOX.example", "https://maps.example"],
            "img-src": ["https://tiles.example"],
        }
    )
    assert csp.declared_csp_sources() == {
        "frame-src": [SANDBOX, "https://maps.example"],
        "img-src": ["https://tiles.example"],
    }


def test_nothing_is_declared_by_default() -> None:
    assert csp.declared_csp_sources() == {}


def test_declarations_are_read_each_time() -> None:
    """So that a source can follow a provider registered after startup."""
    sources: dict[str, list[str]] = {}
    csp.add_csp_sources(lambda: sources)
    assert csp.declared_csp_sources() == {}
    sources["frame-src"] = [SANDBOX]
    assert csp.declared_csp_sources() == FRAMES


def test_a_refused_source_is_left_out_and_logged_once(
    caplog: pytest.LogCaptureFixture,
) -> None:
    manifest = Manifest(publisher="acme", name="demo", displayName="Demo")
    with use_context(ConcreteExtensionContext(manifest)):
        csp.add_csp_sources(
            lambda: {"frame-src": ["*", SANDBOX], "script-src": [SANDBOX]}
        )

    with caplog.at_level(logging.WARNING, logger=csp.__name__):
        assert csp.declared_csp_sources() == FRAMES
        assert csp.declared_csp_sources() == FRAMES

    refusals = [record.getMessage() for record in caplog.records]
    assert len(refusals) == 2
    assert all("extension acme.demo" in message for message in refusals)
    assert "'*' to 'frame-src'" in refusals[0]
    assert "to 'script-src'" in refusals[1]


@pytest.mark.parametrize(
    "answer",
    [
        ["https://sandbox.example"],
        {"frame-src": "https://sandbox.example"},
        {"frame-src": None},
    ],
)
def test_an_answer_of_the_wrong_shape_adds_nothing(answer: Any) -> None:
    csp.add_csp_sources(lambda: answer)
    assert csp.declared_csp_sources() == {}


def test_a_declaration_that_raises_adds_nothing_but_spares_the_others(
    caplog: pytest.LogCaptureFixture,
) -> None:
    def broken() -> CspSources:
        raise RuntimeError("the provider is down")

    csp.add_csp_sources(broken)
    csp.add_csp_sources(lambda: FRAMES)
    with caplog.at_level(logging.ERROR, logger=csp.__name__):
        assert csp.declared_csp_sources() == FRAMES
        assert csp.declared_csp_sources() == FRAMES

    # Logged once, with its traceback, rather than on every response.
    [failure] = caplog.records
    assert "the sources of the host failed" in failure.getMessage()
    assert "the provider is down" in failure.getMessage()
    assert failure.exc_info is not None


def test_a_declaration_is_a_function() -> None:
    sources: Any = FRAMES
    with pytest.raises(TypeError, match="takes a function"):
        csp.add_csp_sources(sources)


def _nonce_free(policy: str) -> str:
    return re.sub(r"'nonce-[^']*'", "'nonce'", policy)


def _talisman_app(*, merge: str, report_only: bool = False) -> Flask:
    """A bare Flask app with Talisman, configured as Superset is by default."""
    options: dict[str, Any] = copy.deepcopy(superset_config.TALISMAN_CONFIG)
    if report_only:
        options["content_security_policy_report_only"] = True
        options["content_security_policy_report_uri"] = "/csp-report"
    app = Flask(__name__)
    if merge == "before":
        csp.init_app(app)
    Talisman().init_app(app, **options)
    if merge == "after":
        csp.init_app(app)

    @app.route("/")
    def page() -> str:
        return "<p>A page</p>"

    return app


def test_with_nothing_declared_the_policy_stays_as_talisman_sets_it(
    mocker: MockerFixture,
) -> None:
    rewrite = mocker.patch.object(csp, "merge_policy")
    merged = _talisman_app(merge="before").test_client().get("/")
    plain = _talisman_app(merge="never").test_client().get("/")
    # The header is never rewritten, so it is Talisman's byte for byte.
    rewrite.assert_not_called()
    header = "Content-Security-Policy"
    assert header in plain.headers
    assert _nonce_free(merged.headers[header]) == _nonce_free(plain.headers[header])


def test_superset_pages_allow_a_declared_frame_source() -> None:
    csp.add_csp_sources(lambda: FRAMES)
    merged = _talisman_app(merge="before").test_client().get("/")
    plain = _talisman_app(merge="never").test_client().get("/")
    header = "Content-Security-Policy"
    # The default config has no frame-src, so frames fall back to default-src.
    assert _nonce_free(merged.headers[header]) == (
        _nonce_free(plain.headers[header]) + f"; frame-src 'self' {SANDBOX}"
    )


def test_a_report_only_policy_gets_the_sources_too() -> None:
    csp.add_csp_sources(lambda: FRAMES)
    response = _talisman_app(merge="before", report_only=True).test_client().get("/")
    assert "Content-Security-Policy" not in response.headers
    assert response.headers["Content-Security-Policy-Report-Only"].endswith(
        f"; report-uri /csp-report; frame-src 'self' {SANDBOX}"
    )


def test_merging_before_talisman_has_set_the_policy_adds_nothing() -> None:
    """Why init_app must run before Talisman's: hooks run in reverse."""
    csp.add_csp_sources(lambda: FRAMES)
    response = _talisman_app(merge="after").test_client().get("/")
    assert SANDBOX not in response.headers["Content-Security-Policy"]


def test_without_a_policy_nothing_is_added_or_asked_for() -> None:
    """With Talisman off there is no policy to widen, nor one to start."""
    asked: list[bool] = []

    def sources() -> CspSources:
        asked.append(True)
        return FRAMES

    csp.add_csp_sources(sources)
    app = Flask(__name__)
    csp.init_app(app)
    app.add_url_rule("/", "page", lambda: "<p>A page</p>")

    response = app.test_client().get("/")

    assert "Content-Security-Policy" not in response.headers
    assert asked == []


def test_superset_merges_after_talisman(app: Flask, client: Any) -> None:
    """The app's own wiring: the merge runs once Talisman has set the policy."""
    hooks = app.after_request_funcs[None]
    assert hooks.index(csp.merge_declared_sources) < hooks.index(
        talisman._set_response_headers  # noqa: SLF001
    )

    csp.add_csp_sources(lambda: FRAMES)
    response = client.get("/health")

    assert f"frame-src 'self' {SANDBOX}" in response.headers["Content-Security-Policy"]
