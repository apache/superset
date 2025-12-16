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
from __future__ import annotations

import dataclasses
import functools
import logging
import secrets
import typing
from typing import Any, Callable, cast

from flask import (
    Flask,
    request,
    Response,
)
from flask_wtf.csrf import CSRFError
from jinja2 import Environment, PackageLoader
from sqlalchemy import exc
from werkzeug.exceptions import HTTPException

from superset.commands.exceptions import CommandException, CommandInvalidError
from superset.errors import ErrorLevel, SupersetError, SupersetErrorType
from superset.exceptions import (
    SupersetErrorException,
    SupersetErrorsException,
    SupersetException,
    SupersetSecurityException,
)
from superset.superset_typing import FlaskResponse
from superset.utils import core as utils, json
from superset.utils.log import get_logger_from_status
from superset.views.utils import redirect_to_login

if typing.TYPE_CHECKING:
    from superset.views.base import BaseSupersetView


logger = logging.getLogger(__name__)

JSON_MIMETYPE = "application/json; charset=utf-8"

# Set up Jinja2 environment for Cloudflare error template
_cf_env = Environment(
    loader=PackageLoader("superset", "templates"),
    autoescape=True,
)
_cf_template = _cf_env.get_template("cloudflare_error.html")

# Error code to title mapping for Cloudflare-style error pages
CLOUDFLARE_ERROR_TITLES: dict[int, str] = {
    400: "Bad Request",
    401: "Access Denied",
    403: "Access Denied",
    404: "Web page is not found",
    405: "Method Not Allowed",
    408: "Request Timeout",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Temporarily Unavailable",
    504: "Gateway Timeout",
}

# What happened descriptions for each error code
CLOUDFLARE_WHAT_HAPPENED: dict[int, str] = {
    400: """The server could not understand your request due to invalid syntax.
            Please check your request and try again.""",
    401: """This page requires authentication. You need to log in to access
            this resource.""",
    403: """You don't have permission to access this resource. The owner of
            this website has banned your access based on your credentials.""",
    404: """The page you requested could not be found. It may have been moved,
            deleted, or never existed in the first place.""",
    405: """The request method is not supported for the requested resource.""",
    408: """The server timed out waiting for your request. Please try again.""",
    429: """You've made too many requests in a short period of time.
            Please slow down and try again later.""",
    500: """There is an unknown connection issue between Superset and the
            origin web server. As a result, the web page can not be displayed.""",
    502: """Superset was unable to get a valid response from the upstream server.""",
    503: """The server is temporarily unable to handle your request due to
            maintenance or capacity problems. Please try again later.""",
    504: """Superset was unable to get a response from the upstream server
            in time.""",
}


def render_cloudflare_error_page(
    error_code: int,
    error_message: str | None = None,
) -> str:
    """
    Render a Cloudflare-style error page for the given error code.

    Args:
        error_code: HTTP status code
        error_message: Optional custom error message to display

    Returns:
        Rendered HTML string for the error page
    """
    from datetime import datetime, timezone

    # Generate ray ID and get client IP
    ray_id = request.headers.get("Cf-Ray", secrets.token_hex(8))[:16]
    client_ip = request.headers.get("X-Forwarded-For", request.remote_addr or "Unknown")
    utc_now = datetime.now(timezone.utc)
    time_str = utc_now.strftime("%Y-%m-%d %H:%M:%S UTC")

    title = CLOUDFLARE_ERROR_TITLES.get(error_code, "Error")
    what_happened = error_message or CLOUDFLARE_WHAT_HAPPENED.get(
        error_code,
        "An unexpected error occurred while processing your request.",
    )

    # Determine status indicators based on error type
    host = request.host or "superset.io"
    if error_code >= 500:
        # Server errors: browser and Cloudflare OK, host has issue
        browser_status = {"status": "ok"}
        cloudflare_status = {"status": "ok", "location": "San Francisco"}
        host_status = {"status": "error", "location": host}
    elif error_code in (401, 403):
        # Auth errors: browser has issue (needs auth)
        browser_status = {"status": "error"}
        cloudflare_status = {"status": "ok", "location": "San Francisco"}
        host_status = {"status": "ok", "location": host}
    else:
        # Client errors (404, etc): browser has issue
        browser_status = {"status": "error"}
        cloudflare_status = {"status": "ok", "location": "San Francisco"}
        host_status = {"status": "ok", "location": host}

    params = {
        "html_title": f"superset.io | {error_code}: {title}",
        "title": title,
        "error_code": error_code,
        "time": time_str,
        "ray_id": ray_id,
        "client_ip": client_ip,
        "browser_status": browser_status,
        "cloudflare_status": cloudflare_status,
        "host_status": host_status,
        "what_happened": f"<p>{what_happened}</p>",
        "what_can_i_do": """
            <h5>If you are a visitor of this website:</h5>
            <p>Please try again in a few minutes. If you continue to see this
            error, you can contact the site administrator.</p>
            <h5>If you are the owner of this website:</h5>
            <p>Check your Superset logs for more information about this error.
            You may need to restart the service or check your database
            connections.</p>
        """,
        "perf_sec_by": {
            "text": "Performance & security by",
            "link_text": "Apache Superset",
            "link_url": "https://superset.apache.org",
        },
    }

    return _cf_template.render(params=params)


def get_error_level_from_status(
    status_code: int,
) -> ErrorLevel:
    if status_code < 400:
        return ErrorLevel.INFO
    if status_code < 500:
        return ErrorLevel.WARNING
    return ErrorLevel.ERROR


def json_error_response(
    error_details: str | SupersetError | list[SupersetError] | None = None,
    status: int = 500,
    payload: dict[str, Any] | None = None,
) -> FlaskResponse:
    payload = payload or {}

    if isinstance(error_details, list):
        payload["errors"] = [dataclasses.asdict(error) for error in error_details]
    elif isinstance(error_details, SupersetError):
        payload["errors"] = [dataclasses.asdict(error_details)]
    elif isinstance(error_details, str):
        payload["error"] = error_details

    return Response(
        json.dumps(payload, default=json.json_iso_dttm_ser, ignore_nan=True),
        status=status,
        mimetype=JSON_MIMETYPE,
    )


def handle_api_exception(
    f: Callable[..., FlaskResponse],
) -> Callable[..., FlaskResponse]:
    """
    A decorator to catch superset exceptions. Use it after the @api decorator above
    so superset exception handler is triggered before the handler for generic
    exceptions.
    """

    def wraps(self: BaseSupersetView, *args: Any, **kwargs: Any) -> FlaskResponse:
        try:
            return f(self, *args, **kwargs)
        except SupersetSecurityException as ex:
            logger.warning("SupersetSecurityException", exc_info=True)
            return json_error_response([ex.error], status=ex.status, payload=ex.payload)
        except SupersetErrorsException as ex:
            logger.warning(ex, exc_info=True)
            return json_error_response(ex.errors, status=ex.status)
        except SupersetErrorException as ex:
            logger.warning("SupersetErrorException", exc_info=True)
            return json_error_response([ex.error], status=ex.status)
        except SupersetException as ex:
            logger_func, _ = get_logger_from_status(ex.status)
            logger_func(ex.message, exc_info=True)
            return json_error_response(
                utils.error_msg_from_exception(ex), status=ex.status
            )
        except HTTPException as ex:
            logger.exception(ex)
            return json_error_response(
                utils.error_msg_from_exception(ex), status=cast(int, ex.code)
            )
        except (exc.IntegrityError, exc.DatabaseError, exc.DataError) as ex:
            logger.exception(ex)
            return json_error_response(utils.error_msg_from_exception(ex), status=422)
        except Exception as ex:  # pylint: disable=broad-except
            logger.exception(ex)
            return json_error_response(utils.error_msg_from_exception(ex))

    return functools.update_wrapper(wraps, f)


def set_app_error_handlers(app: Flask) -> None:  # noqa: C901
    """
    Set up error handlers for the Flask app
    Refer to SIP-40 and SIP-41 for more details on the error handling strategy
    """

    @app.errorhandler(SupersetErrorException)
    def show_superset_error(ex: SupersetErrorException) -> FlaskResponse:
        logger.warning("SupersetErrorException", exc_info=True)
        return json_error_response([ex.error], status=ex.status)

    @app.errorhandler(SupersetErrorsException)
    def show_superset_errors(ex: SupersetErrorsException) -> FlaskResponse:
        logger.warning("SupersetErrorsException", exc_info=True)
        return json_error_response(ex.errors, status=ex.status)

    @app.errorhandler(CSRFError)
    def refresh_csrf_token(ex: CSRFError) -> FlaskResponse:
        """Redirect to login if the CSRF token is expired"""
        logger.warning("Refresh CSRF token error", exc_info=True)

        if request.is_json:
            return show_http_exception(ex)

        return redirect_to_login()

    @app.errorhandler(HTTPException)
    def show_http_exception(ex: HTTPException) -> FlaskResponse:
        logger.warning("HTTPException", exc_info=True)
        error_code = ex.code or 500

        if "text/html" in request.accept_mimetypes:
            return Response(
                render_cloudflare_error_page(
                    error_code, utils.error_msg_from_exception(ex)
                ),
                status=error_code,
                mimetype="text/html",
            )

        return json_error_response(
            [
                SupersetError(
                    message=utils.error_msg_from_exception(ex),
                    error_type=SupersetErrorType.GENERIC_BACKEND_ERROR,
                    level=ErrorLevel.ERROR,
                ),
            ],
            status=error_code,
        )

    @app.errorhandler(CommandException)
    def show_command_errors(ex: CommandException) -> FlaskResponse:
        """
        Temporary handler for CommandException; if an API raises a
        CommandException it should be fixed to map it to SupersetErrorException
        or SupersetErrorsException, with a specific status code and error type
        """
        logger.warning("CommandException", exc_info=True)

        if "text/html" in request.accept_mimetypes:
            return Response(
                render_cloudflare_error_page(ex.status, ex.message),
                status=ex.status,
                mimetype="text/html",
            )

        extra = ex.normalized_messages() if isinstance(ex, CommandInvalidError) else {}
        return json_error_response(
            [
                SupersetError(
                    message=ex.message,
                    error_type=SupersetErrorType.GENERIC_COMMAND_ERROR,
                    level=get_error_level_from_status(ex.status),
                    extra=extra,
                ),
            ],
            status=ex.status,
        )

    @app.errorhandler(Exception)
    @app.errorhandler(500)
    def show_unexpected_exception(ex: Exception) -> FlaskResponse:
        """Catch-all, to ensure all errors from the backend conform to SIP-40"""
        logger.warning("Exception", exc_info=True)
        logger.exception(ex)

        if "text/html" in request.accept_mimetypes:
            return Response(
                render_cloudflare_error_page(500, utils.error_msg_from_exception(ex)),
                status=500,
                mimetype="text/html",
            )

        return json_error_response(
            [
                SupersetError(
                    message=utils.error_msg_from_exception(ex),
                    error_type=SupersetErrorType.GENERIC_BACKEND_ERROR,
                    level=ErrorLevel.ERROR,
                ),
            ],
        )
