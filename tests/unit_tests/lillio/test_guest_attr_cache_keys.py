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
import runpy
from pathlib import Path
from types import SimpleNamespace
from typing import Any

from flask import Flask, g
from jinja2.sandbox import SandboxedEnvironment


class _FakeGuestUser:
    is_guest_user = True

    def __init__(self, guest_token: dict[str, Any]) -> None:
        self.guest_token = guest_token


class _ExplodingProxy:
    """Simulates flask_login's current_user LocalProxy raising a non-
    AttributeError (e.g. "working outside of request context") on access,
    which getattr(..., default) does NOT swallow on its own."""

    def __getattr__(self, name: str) -> Any:
        raise RuntimeError("working outside of request context")


def _load_lillio_config(monkeypatch: Any) -> dict[str, Any]:
    monkeypatch.setenv("REDIS_HOST", "cache.example")
    monkeypatch.setenv("REDIS_PASSWORD", "secret")
    monkeypatch.setenv("GLOBAL_ASYNC_QUERIES_JWT_SECRET", "jwt-secret")
    monkeypatch.setenv("SUPERSET__GUEST_TOKEN_JWT_SECRET", "guest-jwt-secret")
    monkeypatch.setenv("SMTP_USER", "smtp-user")
    monkeypatch.setenv("SMTP_PASSWORD", "smtp-password")
    return runpy.run_path(
        str(Path(__file__).parents[3] / "docker/lillio/superset_config.py")
    )


def _render(template_src: str, context_addons: dict[str, Any]) -> tuple[str, list[Any]]:
    """
    Render a template the same way Superset's Jinja engine does: the addon
    function(s) under test and `cache_key_wrapper` live side by side in the
    same template context, and `cache_key_wrapper` collects values into a
    list that Superset later folds into the query's cache key.
    """
    extra_cache_keys: list[Any] = []

    def cache_key_wrapper(key: Any) -> Any:
        extra_cache_keys.append(key)
        return key

    env = SandboxedEnvironment()
    template = env.from_string(template_src)
    rendered = template.render(
        {**context_addons, "cache_key_wrapper": cache_key_wrapper}
    )
    return rendered, extra_cache_keys


def test_guest_attr_registers_value_in_cache_key(monkeypatch) -> None:
    config = _load_lillio_config(monkeypatch)
    monkeypatch.setattr(
        "flask_login.current_user",
        _FakeGuestUser({"user": {"center_ids": [3, 7, 12]}}),
    )

    rendered, extra_cache_keys = _render(
        "{{ guest_attr('center_ids', [-1]) | join(', ') }}",
        {"guest_attr": config["guest_attr"]},
    )

    assert rendered == "3, 7, 12"
    assert extra_cache_keys == [(3, 7, 12)]


def test_guest_attr_falls_back_to_default_for_non_guest(monkeypatch) -> None:
    config = _load_lillio_config(monkeypatch)
    monkeypatch.setattr(
        "flask_login.current_user", SimpleNamespace(is_guest_user=False)
    )

    rendered, extra_cache_keys = _render(
        "{{ guest_attr('center_ids', [-1]) | join(', ') }}",
        {"guest_attr": config["guest_attr"]},
    )

    assert rendered == "-1"
    assert extra_cache_keys == [(-1,)]


def test_guest_attr_swallows_errors_and_still_returns_default(
    monkeypatch,
) -> None:
    config = _load_lillio_config(monkeypatch)
    # is_guest_user True but no .guest_token attribute -> AttributeError, caught
    monkeypatch.setattr("flask_login.current_user", SimpleNamespace(is_guest_user=True))

    rendered, extra_cache_keys = _render(
        "{{ guest_attr('center_ids', [-1]) | join(', ') }}",
        {"guest_attr": config["guest_attr"]},
    )

    assert rendered == "-1"
    assert extra_cache_keys == [(-1,)]


def test_guest_attr_uses_celery_task_user_from_flask_g(monkeypatch) -> None:
    """Celery restores the guest on ``g.user`` without a request context."""
    config = _load_lillio_config(monkeypatch)
    monkeypatch.setattr("flask_login.current_user", _ExplodingProxy())

    app = Flask(__name__)
    with app.app_context():
        g.user = _FakeGuestUser({"user": {"center_ids": [21]}})
        rendered, extra_cache_keys = _render(
            "{{ guest_attr('center_ids', [-1]) | join(', ') }}",
            {"guest_attr": config["guest_attr"]},
        )

    assert rendered == "21"
    assert extra_cache_keys == [(21,)]


def test_guest_attr_differs_by_guest_so_caches_dont_collide(
    monkeypatch,
) -> None:
    """
    Regression test for PDE-3676: two guests with different `center_ids` must
    produce different cache key contributions, or Superset's chart data cache
    (DATA_CACHE_CONFIG) serves whichever guest populated the cache first to
    every other guest, regardless of their own `center_ids`.
    """
    config = _load_lillio_config(monkeypatch)

    monkeypatch.setattr(
        "flask_login.current_user", _FakeGuestUser({"user": {"center_ids": [1]}})
    )
    _, keys_a = _render(
        "{{ guest_attr('center_ids', [-1]) | join(', ') }}",
        {"guest_attr": config["guest_attr"]},
    )

    monkeypatch.setattr(
        "flask_login.current_user", _FakeGuestUser({"user": {"center_ids": [2]}})
    )
    _, keys_b = _render(
        "{{ guest_attr('center_ids', [-1]) | join(', ') }}",
        {"guest_attr": config["guest_attr"]},
    )

    assert keys_a != keys_b


def test_guest_attr_cache_key_is_hashable(monkeypatch) -> None:
    """
    Regression test for the "unhashable type: 'list'" error: extra cache key
    entries must be hashable, since Superset dedupes them with
    `list(set(extra_cache_keys))` (SqlaTable.get_extra_cache_keys).
    """
    config = _load_lillio_config(monkeypatch)
    monkeypatch.setattr(
        "flask_login.current_user",
        _FakeGuestUser({"user": {"center_ids": [4, 5, 6]}}),
    )

    _, extra_cache_keys = _render(
        "{{ guest_attr('center_ids', [-1]) | join(', ') }}",
        {"guest_attr": config["guest_attr"]},
    )

    deduped = list(set(extra_cache_keys))  # must not raise TypeError
    assert deduped == [(4, 5, 6)]


def test_guest_attr_works_without_cache_key_wrapper_in_context(
    monkeypatch,
) -> None:
    """
    Defensive: guest_attr must not blow up if rendered outside Superset's
    Jinja context, where `cache_key_wrapper` isn't defined.
    """
    config = _load_lillio_config(monkeypatch)
    monkeypatch.setattr(
        "flask_login.current_user", _FakeGuestUser({"user": {"center_ids": [9]}})
    )

    env = SandboxedEnvironment()
    template = env.from_string("{{ guest_attr('center_ids', [-1]) | join(', ') }}")
    rendered = template.render({"guest_attr": config["guest_attr"]})

    assert rendered == "9"


def test_get_user_attribute_registers_value_in_cache_key(monkeypatch) -> None:
    config = _load_lillio_config(monkeypatch)
    monkeypatch.setattr(
        "flask_login.current_user", SimpleNamespace(email="alice@example.com")
    )

    rendered, extra_cache_keys = _render(
        "{{ get_user_attribute('email', 'nobody@example.com') }}",
        {"get_user_attribute": config["get_user_attribute"]},
    )

    assert rendered == "alice@example.com"
    assert extra_cache_keys == ["alice@example.com"]


def test_get_user_attribute_falls_back_to_default_on_error(
    monkeypatch,
) -> None:
    config = _load_lillio_config(monkeypatch)
    monkeypatch.setattr("flask_login.current_user", _ExplodingProxy())

    rendered, extra_cache_keys = _render(
        "{{ get_user_attribute('email', 'nobody@example.com') }}",
        {"get_user_attribute": config["get_user_attribute"]},
    )

    assert rendered == "nobody@example.com"
    assert extra_cache_keys == ["nobody@example.com"]
