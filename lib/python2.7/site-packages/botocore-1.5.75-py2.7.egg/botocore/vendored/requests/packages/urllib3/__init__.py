"""
urllib3 - Thread-safe connection pooling and re-using.
"""

__author__ = 'Andrey Petrov (andrey.petrov@shazow.net)'
__license__ = 'MIT'
__version__ = '1.10.4'


from .connectionpool import (
    HTTPConnectionPool,
    HTTPSConnectionPool,
    connection_from_url
)

from . import exceptions
from .filepost import encode_multipart_formdata
from .poolmanager import PoolManager, ProxyManager, proxy_from_url
from .response import HTTPResponse
from .util.request import make_headers
from .util.url import get_host
from .util.timeout import Timeout
from .util.retry import Retry


# Set default logging handler to avoid "No handler found" warnings.
import logging
try:  # Python 2.7+
    from logging import NullHandler
except ImportError:
    class NullHandler(logging.Handler):
        def emit(self, record):
            pass

logging.getLogger(__name__).addHandler(NullHandler())

def add_stderr_logger(level=logging.DEBUG):
    """
    Helper for quickly adding a StreamHandler to the logger. Useful for
    debugging.

    Returns the handler after adding it.
    """
    # This method needs to be in this __init__.py to get the __name__ correct
    # even if urllib3 is vendored within another package.
    logger = logging.getLogger(__name__)
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter('%(asctime)s %(levelname)s %(message)s'))
    logger.addHandler(handler)
    logger.setLevel(level)
    logger.debug('Added a stderr logging handler to logger: %s' % __name__)
    return handler

# ... Clean up.
del NullHandler


import warnings
# SecurityWarning's always go off by default.
warnings.simplefilter('always', exceptions.SecurityWarning, append=True)
# InsecurePlatformWarning's don't vary between requests, so we keep it default.
warnings.simplefilter('default', exceptions.InsecurePlatformWarning,
                      append=True)

def disable_warnings(category=exceptions.HTTPWarning):
    """
    Helper for quickly disabling all urllib3 warnings.
    """
    warnings.simplefilter('ignore', category)
