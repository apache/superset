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
from typing import Any, Optional
from unittest import mock


def _fake_app(config: Optional[dict[str, Any]] = None) -> mock.MagicMock:
    """Build a stand-in for ``current_app`` with a controllable config dict."""
    base: dict[str, Any] = {"WEBDRIVER_TYPE": "chrome"}
    if config:
        base.update(config)
    app = mock.MagicMock()
    app.config = base
    return app


def test_cache_warmup_unknown_strategy(app_context: None) -> None:
    """An unknown strategy name returns an explanatory message and warms nothing."""
    from superset.tasks.cache import cache_warmup

    with mock.patch("superset.tasks.cache.WebDriverSelenium") as mock_wd:
        result = cache_warmup("does_not_exist")

    assert result == "No strategy does_not_exist found!"
    mock_wd.assert_not_called()


def test_cache_warmup_missing_config(app_context: None) -> None:
    """Without SUPERSET_CACHE_WARMUP_USER the task fails fast before any WebDriver."""
    from superset.tasks.cache import cache_warmup

    with (
        mock.patch(
            "superset.tasks.cache.current_app",
            _fake_app({"SUPERSET_CACHE_WARMUP_USER": None}),
        ),
        mock.patch("superset.tasks.cache.WebDriverSelenium") as mock_wd,
    ):
        result = cache_warmup("dummy")

    assert isinstance(result, str)
    assert "SUPERSET_CACHE_WARMUP_USER is not configured" in result
    mock_wd.assert_not_called()


def test_cache_warmup_user_not_found(app_context: None) -> None:
    """A configured-but-missing warmup user fails fast before any WebDriver."""
    from superset.tasks.cache import cache_warmup

    with (
        mock.patch(
            "superset.tasks.cache.current_app",
            _fake_app({"SUPERSET_CACHE_WARMUP_USER": "bot"}),
        ),
        mock.patch("superset.tasks.cache.security_manager") as mock_sm,
        mock.patch("superset.tasks.cache.WebDriverSelenium") as mock_wd,
    ):
        mock_sm.find_user = mock.MagicMock(return_value=None)
        result = cache_warmup("dummy")

    assert isinstance(result, str)
    assert "not found" in result
    mock_sm.find_user.assert_called_once_with(username="bot")
    mock_wd.assert_not_called()


def test_cache_warmup_happy_path(app_context: None) -> None:
    """Each URL is screenshotted as the configured user and the driver is destroyed."""
    from superset.tasks.cache import cache_warmup

    urls = ["http://localhost/dash/1", "http://localhost/dash/2"]
    user = mock.MagicMock()

    with (
        mock.patch(
            "superset.tasks.cache.current_app",
            _fake_app({"SUPERSET_CACHE_WARMUP_USER": "bot"}),
        ),
        mock.patch("superset.tasks.cache.security_manager") as mock_sm,
        mock.patch("superset.tasks.cache.WebDriverSelenium") as mock_wd,
        mock.patch("superset.tasks.cache.DummyStrategy.get_urls", return_value=urls),
    ):
        mock_sm.find_user = mock.MagicMock(return_value=user)
        driver = mock_wd.return_value
        result = cache_warmup("dummy")

    assert result == {"success": urls, "errors": []}
    mock_wd.assert_called_once_with("chrome", user=user)
    assert driver.get_screenshot.call_count == len(urls)
    driver.destroy.assert_called_once_with()


def test_cache_warmup_collects_errors_and_destroys(app_context: None) -> None:
    """A failing URL is recorded as an error and cleanup still runs in finally."""
    from superset.tasks.cache import cache_warmup

    urls = ["http://localhost/dash/ok", "http://localhost/dash/boom"]
    user = mock.MagicMock()

    def side_effect(url: str, _element: str) -> None:
        if url.endswith("boom"):
            raise Exception("screenshot failed")

    with (
        mock.patch(
            "superset.tasks.cache.current_app",
            _fake_app({"SUPERSET_CACHE_WARMUP_USER": "bot"}),
        ),
        mock.patch("superset.tasks.cache.security_manager") as mock_sm,
        mock.patch("superset.tasks.cache.WebDriverSelenium") as mock_wd,
        mock.patch("superset.tasks.cache.DummyStrategy.get_urls", return_value=urls),
    ):
        mock_sm.find_user = mock.MagicMock(return_value=user)
        driver = mock_wd.return_value
        driver.get_screenshot.side_effect = side_effect
        result = cache_warmup("dummy")

    assert result == {
        "success": ["http://localhost/dash/ok"],
        "errors": ["http://localhost/dash/boom"],
    }
    driver.destroy.assert_called_once_with()
