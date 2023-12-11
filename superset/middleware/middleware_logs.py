import logging
from flask_http_middleware import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class LogRoutersMiddleware(BaseHTTPMiddleware):
    def __init__(self):
        super().__init__()

    def dispatch(self, request, call_next):
        logger.info(f"url: {request.url},"
                    f" endpoint: {request.endpoint},"
                    f" path: {request.path}")
        return call_next(request)
