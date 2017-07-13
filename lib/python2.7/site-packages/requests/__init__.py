# -*- coding: utf-8 -*-

#   __
#  /__)  _  _     _   _ _/   _
# / (   (- (/ (/ (- _)  /  _)
#          /

"""
Requests HTTP Library
~~~~~~~~~~~~~~~~~~~~~

Requests is an HTTP library, written in Python, for human beings. Basic GET
usage:

   >>> import requests
   >>> r = requests.get('https://www.python.org')
   >>> r.status_code
   200
   >>> 'Python is a programming language' in r.content
   True

... or POST:

   >>> payload = dict(key1='value1', key2='value2')
   >>> r = requests.post('http://httpbin.org/post', data=payload)
   >>> print(r.text)
   {
     ...
     "form": {
       "key2": "value2",
       "key1": "value1"
     },
     ...
   }

The other HTTP methods are supported - see `requests.api`. Full documentation
is at <http://python-requests.org>.

:copyright: (c) 2017 by Kenneth Reitz.
:license: Apache 2.0, see LICENSE for more details.
"""

from .__version__ import __title__, __description__, __url__, __version__
from .__version__ import __build__, __author__, __author_email__, __license__
from .__version__ import __copyright__, __cake__

# Check urllib3 for compatibility.
import urllib3
urllib3_version = urllib3.__version__.split('.')
# Sometimes, urllib3 only reports its version as 16.1.
if len(urllib3_version) == 2:
    urllib3_version.append('0')
major, minor, patch = urllib3_version
major, minor, patch = int(major), int(minor), int(patch)
# urllib3 >= 1.21.1, < 1.22
try:
    assert major == 1
    assert minor >= 21
    assert minor <= 22
except AssertionError:
    raise RuntimeError('Requests dependency \'urllib3\' must be version >= 1.21.1, < 1.22!')


# Check chardet for compatibility.
import chardet
major, minor, patch = chardet.__version__.split('.')[:3]
major, minor, patch = int(major), int(minor), int(patch)
# chardet >= 3.0.2, < 3.1.0
try:
    assert major == 3
    assert minor < 1
    assert patch >= 2
except AssertionError:
    raise RuntimeError('Requests dependency \'chardet\' must be version >= 3.0.2, < 3.1.0!')

# Attempt to enable urllib3's SNI support, if possible
try:
    from urllib3.contrib import pyopenssl
    pyopenssl.inject_into_urllib3()
except ImportError:
    pass

import warnings

# urllib3's DependencyWarnings should be silenced.
from urllib3.exceptions import DependencyWarning
warnings.simplefilter('ignore', DependencyWarning)

from . import utils
from . import packages
from .models import Request, Response, PreparedRequest
from .api import request, get, head, post, patch, put, delete, options
from .sessions import session, Session
from .status_codes import codes
from .exceptions import (
    RequestException, Timeout, URLRequired,
    TooManyRedirects, HTTPError, ConnectionError,
    FileModeWarning, ConnectTimeout, ReadTimeout
)

# Set default logging handler to avoid "No handler found" warnings.
import logging
try:  # Python 2.7+
    from logging import NullHandler
except ImportError:
    class NullHandler(logging.Handler):
        def emit(self, record):
            pass

logging.getLogger(__name__).addHandler(NullHandler())

# FileModeWarnings go off per the default.
warnings.simplefilter('default', FileModeWarning, append=True)
