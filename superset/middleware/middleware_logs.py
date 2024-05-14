import logging
from flask_http_middleware import BaseHTTPMiddleware
from flask_login import current_user
from flask.globals import g

logger = logging.getLogger(__name__)


class LogRoutersMiddleware(BaseHTTPMiddleware):
    def __init__(self):
        super().__init__()

    def dispatch(self, request, call_next):
        return call_next(request)
