import logging
from typing import Any, Callable

from flask import Request, Response
from flask_http_middleware import BaseHTTPMiddleware
from flask_login import current_user

from superset.utils import json

logger = logging.getLogger(__name__)


class LoggerMiddleware(BaseHTTPMiddleware):
    def __init__(self) -> None:
        pass

    def _get_request_body(self, request: Request) -> dict[str, Any]:
        """Extract request body safely."""
        try:
            return request.get_json(silent=True) or {}
        except Exception:  # pylint: disable=broad-except
            return {}

    def _get_response_body(self, response: Response) -> dict[str, Any]:
        """Extract response body safely."""
        try:
            return json.loads(response.get_data(as_text=True)) or {}
        except Exception:  # pylint: disable=broad-except
            return {}

    def dispatch(
        self, request: Request, call_next: Callable[[Request], Response]
    ) -> Response:
        response = call_next(request)

        if 400 <= response.status_code < 600:
            logger.error(
                "Error response - status: %s",
                response.status_code,
                extra={
                    "method": request.method,
                    "url": request.url,
                    "status_code": response.status_code,
                    "is_authenticated": current_user.is_authenticated,
                    "request": {
                        "body": self._get_request_body(request),
                        "args": dict(request.args),
                    },
                    "response": {"body": self._get_response_body(response)},
                },
                exc_info=True,
            )

        return response
