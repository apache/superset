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
REST API decorators and base classes for superset-core.

Provides decorator stubs that will be replaced by host implementations
during initialization.

Usage:
    from superset_core.api import RestApi, api, extension_api

    # For host application APIs
    @api
    class MyAPI(RestApi):
        @expose("/endpoint", methods=["GET"])
        def get_data(self):
            return self.response(200, result={})

    # For extension APIs (auto-discovered, registered under /extensions/)
    @extension_api(id="my_api", name="My Extension API")
    class MyExtensionAPI(RestApi):
        @expose("/endpoint", methods=["GET"])
        def get_data(self):
            return self.response(200, result={})
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, TypeVar

from flask_appbuilder.api import BaseApi

T = TypeVar("T", bound=type)


# =============================================================================
# Metadata dataclass - attached to decorated classes for discovery
# =============================================================================


@dataclass
class RestApiMetadata:
    """
    Metadata stored on classes decorated with @extension_api.

    Attached to classes as __rest_api_metadata__ for build-time discovery.
    Includes auto-inferred Flask-AppBuilder configuration fields.
    """

    id: str
    name: str
    description: str | None = None
    base_path: str = ""  # Defaults to /{id}
    module: str = ""  # Format: "package.module.ClassName"

    # Auto-inferred Flask-AppBuilder fields
    resource_name: str = ""  # Used for URL generation and permissions
    openapi_spec_tag: str = ""  # Used for OpenAPI documentation grouping
    class_permission_name: str = ""  # Used for RBAC permissions


# =============================================================================
# Base class
# =============================================================================


class RestApi(BaseApi):
    """
    Base REST API class for Superset with browser login support.

    This class extends Flask-AppBuilder's BaseApi and enables browser-based
    authentication by default.
    """

    allow_browser_login = True


# =============================================================================
# Decorator stubs - replaced by host application during initialization
# =============================================================================


def api(cls: T) -> T:
    """
    Decorator to register a REST API with the host application.

    This is a stub that raises NotImplementedError until the host application
    initializes the concrete implementation via dependency injection.

    Usage:
        @api
        class MyAPI(RestApi):
            @expose("/endpoint", methods=["GET"])
            def get_data(self):
                return self.response(200, result={})

    Args:
        cls: The API class to register

    Returns:
        The decorated class

    Raises:
        NotImplementedError: Before host implementation is initialized
    """
    raise NotImplementedError(
        "REST API decorator not initialized. "
        "This decorator should be replaced during Superset startup."
    )


def extension_api(
    id: str,  # noqa: A002
    name: str,
    description: str | None = None,
    base_path: str | None = None,
    resource_name: str | None = None,
    openapi_spec_tag: str | None = None,
    class_permission_name: str | None = None,
) -> Callable[[T], T]:
    """
    Decorator to mark a class as an extension REST API.

    This is a stub that raises NotImplementedError until the host application
    initializes the concrete implementation via dependency injection.

    In BUILD mode, stores metadata for discovery without registration.

    Auto-infers Flask-AppBuilder fields from decorator parameters:
    - resource_name: defaults to id (lowercase)
    - openapi_spec_tag: defaults to name
    - class_permission_name: defaults to resource_name
    - base_path: defaults to /{id}

    Extension APIs are:
    - Auto-discovered at build time
    - Registered under /api/v1/extensions/{id}/
    - Subject to manifest validation for security

    Usage:
        @extension_api(id="my_api", name="My Extension API")
        class MyExtensionAPI(RestApi):
            # These are auto-set by the decorator:
            # resource_name = "my_api"
            # openapi_spec_tag = "My Extension API"
            # class_permission_name = "my_api"

            @expose("/endpoint", methods=["GET"])
            def get_data(self):
                return self.response(200, result={})

    Args:
        id: Unique identifier for this API (used in URL path and resource_name)
        name: Human-readable name for the API (used for openapi_spec_tag)
        description: Description of the API (defaults to class docstring)
        base_path: Base URL path (defaults to /{id})
        resource_name: Override resource_name (defaults to id)
        openapi_spec_tag: Override OpenAPI tag (defaults to name)
        class_permission_name: Override permission name (defaults to resource_name)

    Returns:
        Decorator that attaches __rest_api_metadata__ and auto-configures
        Flask-AppBuilder fields

    Raises:
        NotImplementedError: Before host implementation is initialized (except in
        BUILD mode)
    """

    def decorator(cls: T) -> T:
        # Auto-infer Flask-AppBuilder fields
        inferred_resource_name = resource_name or id.lower()
        inferred_openapi_spec_tag = openapi_spec_tag or name
        inferred_class_permission_name = class_permission_name or inferred_resource_name
        inferred_base_path = base_path or f"/{id}"

        # Set Flask-AppBuilder attributes on the class
        cls.resource_name = inferred_resource_name  # type: ignore[attr-defined]
        cls.openapi_spec_tag = inferred_openapi_spec_tag  # type: ignore[attr-defined]
        cls.class_permission_name = inferred_class_permission_name  # type: ignore[attr-defined]

        # Try to get context for BUILD mode detection
        try:
            from superset_core.extensions.context import get_context

            ctx = get_context()

            # In BUILD mode, store metadata for discovery
            if ctx.is_build_mode:
                api_description = description
                if api_description is None and cls.__doc__:
                    api_description = cls.__doc__.strip().split("\n")[0]

                metadata = RestApiMetadata(
                    id=id,
                    name=name,
                    description=api_description,
                    base_path=inferred_base_path,
                    module=f"{cls.__module__}.{cls.__name__}",
                    resource_name=inferred_resource_name,
                    openapi_spec_tag=inferred_openapi_spec_tag,
                    class_permission_name=inferred_class_permission_name,
                )
                cls.__rest_api_metadata__ = metadata  # type: ignore[attr-defined]
                return cls
        except ImportError:
            # Context not available - fall through to error
            pass

        # Default behavior: raise error for host to replace
        raise NotImplementedError(
            "Extension REST API decorator not initialized. "
            "This decorator should be replaced during Superset startup."
        )

    return decorator


__all__ = [
    "RestApi",
    "RestApiMetadata",
    "api",
    "extension_api",
]
