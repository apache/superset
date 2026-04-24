import logging
from typing import Any, Optional, TYPE_CHECKING

from flask import abort, redirect, request, session
from flask_login import current_user, logout_user

from superset.security import SupersetSecurityManager
from superset.security.manager import SupersetSecurityManager  # noqa: F811

logger = logging.getLogger(__name__)

if TYPE_CHECKING:
    from flask_appbuilder import AppBuilder


class SessionValidationSecurityManager(SupersetSecurityManager):
    def __init__(self, appbuilder: "AppBuilder") -> None:
        super().__init__(appbuilder)
        logger.debug("Initializing SessionValidationSecurityManager")

        # Register a hook that runs before every request
        @appbuilder.app.before_request
        def enforce_password_sync() -> Optional[Any]:
            # 1. Define paths that never need a DB check
            exempt_prefixes: tuple[str, ...] = (
                "/static/",
                "/health",
                "/ping",
                "/login",
                "/logout",
                "/swagger",
                "/api/v1/assets",  # Public assets via API
            )

            exempt_files: tuple[str, ...] = ("/favicon.ico", "/robots.txt")

            # 2. Check if current path is in exemptions
            if request.path.startswith(exempt_prefixes) or request.path in exempt_files:
                logger.debug("Skipping password sync for static or swagger path")
                return None
            logger.debug("Running enforce_password_sync for path: %s", request.path)

            # 3. Only process users who are logged in and use password authentication
            if current_user.is_authenticated and getattr(
                current_user, "password", None
            ):
                current_db_hash: str = current_user.password
                session_hash: Optional[str] = session.get("session_pwd_hash")

                if not session_hash:
                    # Initial login: Save the current hash to the session
                    session["session_pwd_hash"] = current_db_hash
                    logger.info(
                        "Session password hash set for user [%s]", current_user.username
                    )
                elif session_hash != current_db_hash:
                    # Mismatch detected! The password was changed.
                    logger.warning(
                        "Password hash mismatch for user [%s]. Logging out to enforce password sync.",  # noqa: E501
                        current_user.username,
                    )
                    logout_user()
                    session.clear()

                    # 2. Handle API vs Page Navigation
                    # If it's an API request (common in Superset), return 401
                    if (
                        request.path.startswith("/api/v1/")
                        or request.headers.get("X-Requested-With") == "XMLHttpRequest"
                    ):
                        abort(401)
                    return redirect("/login")
            else:
                logger.debug(
                    "User not authenticated or does not have a password attribute"
                )
            return None
