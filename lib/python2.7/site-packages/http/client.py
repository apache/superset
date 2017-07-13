from __future__ import absolute_import
import sys

assert sys.version_info[0] < 3

from httplib import *
from httplib import HTTPMessage

# These constants aren't included in __all__ in httplib.py:

from httplib import (HTTP_PORT,
                     HTTPS_PORT,

                     _CS_IDLE,
                     _CS_REQ_STARTED,
                     _CS_REQ_SENT,

                     CONTINUE,
                     SWITCHING_PROTOCOLS,
                     PROCESSING,

                     OK,
                     CREATED,
                     ACCEPTED,
                     NON_AUTHORITATIVE_INFORMATION,
                     NO_CONTENT,
                     RESET_CONTENT,
                     PARTIAL_CONTENT,
                     MULTI_STATUS,
                     IM_USED,

                     MULTIPLE_CHOICES,
                     MOVED_PERMANENTLY,
                     FOUND,
                     SEE_OTHER,
                     NOT_MODIFIED,
                     USE_PROXY,
                     TEMPORARY_REDIRECT,

                     BAD_REQUEST,
                     UNAUTHORIZED,
                     PAYMENT_REQUIRED,
                     FORBIDDEN,
                     NOT_FOUND,
                     METHOD_NOT_ALLOWED,
                     NOT_ACCEPTABLE,
                     PROXY_AUTHENTICATION_REQUIRED,
                     REQUEST_TIMEOUT,
                     CONFLICT,
                     GONE,
                     LENGTH_REQUIRED,
                     PRECONDITION_FAILED,
                     REQUEST_ENTITY_TOO_LARGE,
                     REQUEST_URI_TOO_LONG,
                     UNSUPPORTED_MEDIA_TYPE,
                     REQUESTED_RANGE_NOT_SATISFIABLE,
                     EXPECTATION_FAILED,
                     UNPROCESSABLE_ENTITY,
                     LOCKED,
                     FAILED_DEPENDENCY,
                     UPGRADE_REQUIRED,

                     INTERNAL_SERVER_ERROR,
                     NOT_IMPLEMENTED,
                     BAD_GATEWAY,
                     SERVICE_UNAVAILABLE,
                     GATEWAY_TIMEOUT,
                     HTTP_VERSION_NOT_SUPPORTED,
                     INSUFFICIENT_STORAGE,
                     NOT_EXTENDED,

                     MAXAMOUNT,
                    )

# These are not available on Python 2.6.x:
try:
    from httplib import LineTooLong, LineAndFileWrapper
except ImportError:
    pass

# These may not be available on all versions of Python 2.6.x or 2.7.x
try:
    from httplib import (
                         _MAXLINE,
                         _MAXHEADERS,
                         _is_legal_header_name,
                         _is_illegal_header_value,
                         _METHODS_EXPECTING_BODY
                        )
except ImportError:
    pass
