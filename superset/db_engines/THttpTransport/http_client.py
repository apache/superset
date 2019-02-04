# Licensed to Cloudera, Inc. under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  Cloudera, Inc. licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import logging
import posixpath
import requests
import threading
import urllib

from django.utils.encoding import iri_to_uri, smart_str
from django.utils.http import urlencode


from requests import exceptions
from requests.auth import HTTPBasicAuth, HTTPDigestAuth
from requests_kerberos import HTTPKerberosAuth, REQUIRED, OPTIONAL, DISABLED
from urllib3.util import parse_url

__docformat__ = "epytext"

LOG = logging.getLogger(__name__)

CACHE_SESSION = {}
CACHE_SESSION_LOCK = threading.Lock()
REST_CONN_TIMEOUT = 120

def get_request_session(url, logger):
  global CACHE_SESSION, CACHE_SESSION_LOCK
  if CACHE_SESSION.get(url) is None:
    with CACHE_SESSION_LOCK:
      CACHE_SESSION[url] = requests.Session()
      logger.debug("Setting request Session")
      CACHE_SESSION[url].mount(url, requests.adapters.HTTPAdapter(pool_connections=50, pool_maxsize=50))
      logger.debug("Setting session adapter for %s" % url)

  return CACHE_SESSION

class RestException(Exception):
  """
  Any error result from the Rest API is converted into this exception type.
  """
  def __init__(self, error):
    Exception.__init__(self, error)
    self._error = error
    self._code = None
    self._message = str(error)
    self._headers = {}

    # Get more information if urllib2.HTTPError.
    try:
      self._code = error.response.status_code
      self._headers = error.response.headers
      self._message = self._message + '\n' + self._error.response.text
    except AttributeError:
      pass

  def __str__(self):
    res = self._message or ""
    if self._code is not None:
      res += " (error %s)" % self._code
    return res

  def get_parent_ex(self):
    if isinstance(self._error, Exception):
      return self._error
    return None

  @property
  def code(self):
    return self._code

  @property
  def message(self):
    return self._message


class HttpClient(object):
  """
  Basic HTTP client tailored for rest APIs.
  """
  def __init__(self, base_url, exc_class=None, logger=None):
    """
    @param base_url: The base url to the API.
    @param exc_class: An exception class to handle non-200 results.
    """
    self._base_url = base_url.rstrip('/')
    self._exc_class = exc_class or RestException
    self._logger = logger or LOG
    self._short_url = self._extract_netloc(self._base_url)
    self._session = get_request_session(self._short_url, self._logger).get(self._short_url)
    self._cookies = None

  def _extract_netloc(self, base_url):
    parsed_uri = parse_url(base_url)
    short_url = '%(scheme)s://%(netloc)s' % {'scheme': parsed_uri.scheme, 'netloc': parsed_uri.netloc}
    return short_url

  def set_kerberos_auth(self,mutual_authentication,
            service, delegate, force_preemptive,
            principal, hostname_override,
            sanitize_mutual_error_response, send_cbt):
    """Set up kerberos auth for the client, based on the current ticket."""
   
    mutual_authentication_val = OPTIONAL

    if mutual_authentication == 'OPTIONAL':
      mutual_authentication_val = OPTIONAL
    elif mutual_authentication == 'REQUIRED':
      mutual_authentication_val = REQUIRED
    elif mutual_authentication == 'DISABLED':
      mutual_authentication_val = DISABLED
  
    self._session.auth = HTTPKerberosAuth(mutual_authentication= mutual_authentication_val, service = service, delegate = delegate, force_preemptive = force_preemptive,
            principal = principal,hostname_override =  hostname_override,
            sanitize_mutual_error_response = sanitize_mutual_error_response, send_cbt = send_cbt)

    return self

  def set_basic_auth(self, username, password):
    self._session.auth = HTTPBasicAuth(username, password)
    return self

  def set_digest_auth(self, username, password):
    self._session.auth = HTTPDigestAuth(username, password)
    return self

  def set_headers(self, headers):
    """
    Add headers to the request
    @param headers: A dictionary with the key value pairs for the headers
    @return: The current object
    """
    self._session.headers.update(headers)
    return self


  @property
  def base_url(self):
    return self._base_url

  @property
  def logger(self):
    return self._logger

  def set_verify(self, verify=True):
    self._session.verify = verify
    return self
      
  def _get_headers(self, headers):
    if headers:
      self._session.headers.update(headers)
    return self._session.headers.copy()

  def execute(self, http_method, path, params=None, data=None, headers=None, allow_redirects=False, urlencode=True,
              files=None, clear_cookies=False, timeout= REST_CONN_TIMEOUT):
    """
    Submit an HTTP request.
    @param http_method: GET, POST, PUT, DELETE
    @param path: The path of the resource. Unsafe characters will be quoted.
    @param params: Key-value parameter data.
    @param data: The data to attach to the body of the request.
    @param headers: The headers to set for this request.
    @param allow_redirects: requests should automatically resolve redirects.
    @param urlencode: percent encode paths.
    @param files: for posting Multipart-Encoded files
    @param clear_cookies: flag to force clear any cookies set in the current session

    @return: The result of urllib2.urlopen()
    """
    # Prepare URL and params
    if urlencode:
      path = urllib.parse.quote(smart_str(path))
    url = self._make_url(path, params)
    if http_method in ("GET", "DELETE"):
      if data is not None:
        self.logger.warn("GET and DELETE methods do not pass any data. Path '%s'" % path)
        data = None

    request_kwargs = {'allow_redirects': allow_redirects, 'timeout': timeout}
    if headers:
      request_kwargs['headers'] = headers
    if data:
      request_kwargs['data'] = data
    if files:
      request_kwargs['files'] = files

    if self._cookies and not clear_cookies:
      request_kwargs['cookies'] = self._cookies

    if clear_cookies:
      self._session.cookies.clear()

    try:
      resp = getattr(self._session, http_method.lower())(url, **request_kwargs)
      if resp.status_code >= 300:
        resp.raise_for_status()
        raise exceptions.HTTPError(response=resp)
      # Cache request cookie for the next http_client call.
      self._cookies = resp.cookies
      return resp
    except (exceptions.ConnectionError,
            exceptions.HTTPError,
            exceptions.RequestException,
            exceptions.URLRequired,
            exceptions.TooManyRedirects) as ex :
      raise self._exc_class(ex)

  def _make_url(self, path, params):
    res = self._base_url
    if path:
      res += posixpath.normpath('/' + path.lstrip('/'))
    if params:
      param_str = urlencode(params)
      res += '?' + param_str
    return iri_to_uri(res)
