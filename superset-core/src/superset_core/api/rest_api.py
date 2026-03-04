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
REST API functions and decorators for superset-core.

Provides dependency-injected REST API utility functions and decorators that will be
replaced by host implementations during initialization.

Usage:
    from superset_core.api.rest_api import api

    # Unified decorator for both host and extension APIs
    @api(
        id="main_api",
        name="Main API",
        description="Primary endpoints"
    )
    class MyAPI(RestApi):
        pass
"""

from typing import Callable, TypeVar

from flask_appbuilder.api import BaseApi

# Type variable for decorated API classes
T = TypeVar("T", bound=type["RestApi"])


class RestApi(BaseApi):
    """
    Base REST API class for Superset with browser login support.

    This class extends Flask-AppBuilder's BaseApi and enables browser-based
    authentication by default.
    """

    allow_browser_login = True


def api(
    id: str,
    name: str,
    description: str | None = None,
    resource_name: str | None = None,
) -> Callable[[T], T]:
    """
    Unified API decorator for both host and extension APIs.

    Automatically detects context:
    - Host context: /api/v1/{resource_name}/
    - Extension context: /extensions/{publisher}/{name}/{resource_name}/

    Host implementations will replace this function during initialization
    with a concrete implementation providing actual functionality.

    Args:
        id: Unique API identifier (e.g., "main_api", "analytics_api")
        name: Human-readable display name (e.g., "Main API")
        description: Optional description for documentation
        resource_name: Optional additional path segment for API grouping

    Returns:
        Decorated API class with automatic path configuration

    Raises:
        NotImplementedError: If called before host implementation is initialized

    Example:
        @api(
            id="main_api",
            name="Main API",
            description="Primary extension endpoints"
        )
        class MyExtensionAPI(RestApi):
            @expose("/hello", methods=("GET",))
            @protect()
            def hello(self) -> Response:
                # Available at: /extensions/acme/tools/hello (extension context)
                # Available at: /api/v1/hello (host context)
                return self.response(200, result={"message": "hello"})

        @api(
            id="analytics_api",
            name="Analytics API",
            resource_name="analytics"
        )
        class AnalyticsAPI(RestApi):
            @expose("/insights", methods=("GET",))
            @protect()
            def insights(self) -> Response:
                # Available at: /extensions/acme/tools/analytics/insights (extension)
                # Available at: /api/v1/analytics/insights (host)
                return self.response(200, result={})
    """
    raise NotImplementedError(
        "API decorator not initialized. "
        "This decorator should be replaced during Superset startup."
    )


__all__ = ["RestApi", "api"]
