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
Flask-AppBuilder compatibility patch for rate limiting.

Fixes AttributeError where Flask-AppBuilder's auth_rate_limit property
can return None, causing Flask-Limiter to fail during app initialization.
"""

import logging
from typing import Any

logger = logging.getLogger(__name__)


def _apply_auth_rate_limit_patch() -> None:
    """
    Patch Flask-AppBuilder's auth_rate_limit property to never return None.

    Flask-Limiter expects a string or callable, but gets None when
    appbuilder.get_app is not fully initialized during register_views().
    """
    try:
        import flask_appbuilder.security.manager

        @property  # type: ignore
        def safe_auth_rate_limit(self: Any) -> str:
            """Auth rate limit that always returns a valid string."""
            try:
                if (
                    not hasattr(self, "appbuilder")
                    or self.appbuilder is None
                    or self.appbuilder.get_app is None
                ):
                    return "5 per second"

                rate_limit = self.appbuilder.get_app.config.get(
                    "AUTH_RATE_LIMIT", "5 per second"
                )
                return (
                    rate_limit()
                    if callable(rate_limit)
                    else (rate_limit or "5 per second")
                )

            except Exception:
                return "5 per second"

        # Apply the patch
        flask_appbuilder.security.manager.BaseSecurityManager.auth_rate_limit = (
            safe_auth_rate_limit
        )
        logger.debug("Applied Flask-AppBuilder auth_rate_limit compatibility patch")

    except Exception as e:
        logger.warning(f"Failed to apply Flask-AppBuilder patch: {e}")


# Apply patch on import
_apply_auth_rate_limit_patch()
