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
Browser pooling for MCP screenshot service.

Playwright manages its own long-lived browser instance via the
_PlaywrightBrowserManager in superset.utils.webdriver (one browser per worker
process, isolated contexts per screenshot). This module re-exports the pool
accessor interface so callers that were previously using the Selenium-based
WebDriverPool can be updated without touching import sites.
"""

import logging

logger = logging.getLogger(__name__)


class WebDriverPool:
    """
    Stub retained for import compatibility. Screenshot generation now delegates
    entirely to WebDriverPlaywright, which uses the process-scoped Playwright
    browser manager. This class is no longer functional and will be removed in
    a future release.
    """

    def get_stats(self) -> dict[str, object]:
        return {"status": "playwright_managed"}

    def shutdown(self) -> None:
        pass


def get_webdriver_pool() -> WebDriverPool:
    """Return a stub pool. Playwright manages its own browser lifecycle."""
    return WebDriverPool()


def shutdown_webdriver_pool() -> None:
    """No-op: Playwright browser cleanup is handled by atexit in webdriver.py."""
