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
import time

import django.utils.encoding

LOG = logging.getLogger(__name__)
REST_RESPONSE_SIZE = 2000
WARN_LEVEL_CALL_DURATION_MS = 5000
INFO_LEVEL_CALL_DURATION_MS = 1000

def smart_unicode(s, strings_only=False, errors='strict', encoding='utf-8'):
  """
  Wrapper around Django's version, while supplying our configured encoding.
  Decode char array to unicode.
  """
  return django.utils.encoding.smart_text(
        s, encoding , strings_only, errors)

class Resource(object):
  """
  Encapsulates a resource, and provides actions to invoke on it.
  """
  def __init__(self, client, relpath="", urlencode=True):
    """
    @param client: A Client object.
    @param relpath: The relative path of the resource.
    @param urlencode: percent encode paths.
    """
    self._client = client
    self._path = relpath.strip('/')
    self._urlencode = urlencode

  @property
  def base_url(self):
    return self._client.base_url

  def _join_uri(self, relpath):
    if relpath is None:
      return self._path
    return self._path + posixpath.normpath('/' + relpath)

  def _format_response(self, resp):
    """
    Decide whether the body should be a json dict or string
    """

    if resp.headers.get('location') and resp.headers.get('location').startswith('http://localhost:8080/'):
      return resp.headers.get('location').split('sessions/')[1]

    if len(resp.content) != 0 and resp.headers.get('content-type') and \
          'application/json' in resp.headers.get('content-type'):
      try:
        return resp.json()
      except Exception as ex:
        self._client.logger.exception('JSON decode error: %s' % resp.content)
        raise ex
    else:
      return resp.content

  def invoke(self, method, relpath=None, params=None, data=None, headers=None, files=None, allow_redirects=False, clear_cookies=False, log_response=True):
    resp = self._invoke(method=method,
                        relpath=relpath,
                        params=params,
                        data=data,
                        headers=headers,
                        files=files,
                        allow_redirects=allow_redirects,
                        clear_cookies=clear_cookies,
                        log_response=log_response)

    return self._format_response(resp)

  def _invoke(self, method, relpath=None, params=None, data=None, headers=None, files=None, allow_redirects=False, clear_cookies=False, log_response=True):
    """
    Invoke an API method.
    @return: Raw body or JSON dictionary (if response content type is JSON).
    """
    path = self._join_uri(relpath)
    start_time = time.time()
    resp = self._client.execute(method,
                                path,
                                params=params,
                                data=data,
                                headers=headers,
                                files=files,
                                allow_redirects=allow_redirects,
                                urlencode=self._urlencode,
                                clear_cookies=clear_cookies)

    if log_response:
      log_length = REST_RESPONSE_SIZE
      duration = time.time() - start_time
      message = "%s %s Got response%s: %s%s" % (
          method,
          smart_unicode(path, errors='ignore'),
          ' in %dms' % (duration * 1000),
          smart_unicode(resp.content[:log_length or None], errors='replace'),
          log_length and len(resp.content) > log_length and "..." or ""
      )
      self._client.logger.disabled = 0
      log_if_slow_call(duration=duration, message=message, logger=self._client.logger)

    return resp


  def get(self, relpath=None, params=None, headers=None, clear_cookies=False):
    """
    Invoke the GET method on a resource.
    @param relpath: Optional. A relative path to this resource's path.
    @param params: Key-value data.
    @param clear_cookies: Optional. A flag to force any session cookies to be reset on the request.

    @return: A dictionary of the JSON result.
    """
    return self.invoke("GET", relpath, params, headers=headers, allow_redirects=True, clear_cookies=clear_cookies)


  def delete(self, relpath=None, params=None, headers=None, clear_cookies=False):
    """
    Invoke the DELETE method on a resource.
    @param relpath: Optional. A relative path to this resource's path.
    @param params: Key-value data.
    @param headers: Optional. Base set of headers.
    @param clear_cookies: Optional. A flag to force any session cookies to be reset on the request.

    @return: A dictionary of the JSON result.
    """
    return self.invoke("DELETE", relpath, params, headers=headers, clear_cookies=clear_cookies)


  def post(self, relpath=None, params=None, data=None, contenttype=None, headers=None, files=None, allow_redirects=False,
           clear_cookies=False, log_response=True):
    """
    Invoke the POST method on a resource.
    @param relpath: Optional. A relative path to this resource's path.
    @param params: Key-value data.
    @param data: Optional. Body of the request.
    @param contenttype: Optional.
    @param headers: Optional. Base set of headers.
    @param allow_redirects: Optional. Allow request to automatically resolve redirects.
    @param clear_cookies: Optional. A flag to force any session cookies to be reset on the request.

    @return: A dictionary of the JSON result.
    """
    return self.invoke("POST", relpath, params, data, headers=self._make_headers(contenttype, headers), files=files,
                       allow_redirects=allow_redirects, clear_cookies=clear_cookies, log_response=log_response)


  def put(self, relpath=None, params=None, data=None, contenttype=None, allow_redirects=False, clear_cookies=False, headers=None):
    """
    Invoke the PUT method on a resource.
    @param relpath: Optional. A relative path to this resource's path.
    @param params: Key-value data.
    @param data: Optional. Body of the request.
    @param contenttype: Optional.
    @param allow_redirects: Optional. Allow request to automatically resolve redirects.
    @param clear_cookies: Optional. A flag to force any session cookies to be reset on the request.

    @return: A dictionary of the JSON result.
    """
    return self.invoke("PUT", relpath, params, data, headers=self._make_headers(contenttype, headers),
                       allow_redirects=allow_redirects, clear_cookies=clear_cookies)


  def _make_headers(self, contenttype=None, headers=None):
    if headers is None:
      headers = {}

    if contenttype:
      headers.update({'Content-Type': contenttype})

    return headers

  def resolve_redirect_url(self, method="GET", relpath=None, params=None, data=None, headers=None, files=None, allow_redirects=True, clear_cookies=False, log_response=True):
    resp = self._invoke(method=method,
                        relpath=relpath,
                        params=params,
                        data=data,
                        headers=headers,
                        files=files,
                        allow_redirects=allow_redirects,
                        clear_cookies=clear_cookies,
                        log_response=log_response)

    return resp.url.encode("utf-8")


# Same in thrift_util.py for not losing the trace class
def log_if_slow_call(duration, message, logger):
  if duration >= WARN_LEVEL_CALL_DURATION_MS / 1000 :
    logger.warn('SLOW: %.2f - %s' % (duration, message))
  elif duration >= INFO_LEVEL_CALL_DURATION_MS / 1000 :
    logger.info('SLOW: %.2f - %s' % (duration, message))
  else:
    logger.debug(message)
