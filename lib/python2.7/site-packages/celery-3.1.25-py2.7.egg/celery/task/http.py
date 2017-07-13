# -*- coding: utf-8 -*-
"""
    celery.task.http
    ~~~~~~~~~~~~~~~~

    Webhook task implementation.

"""
from __future__ import absolute_import

import anyjson
import sys

try:
    from urllib.parse import parse_qsl, urlencode, urlparse   # Py3
except ImportError:  # pragma: no cover
    from urllib import urlencode              # noqa
    from urlparse import urlparse, parse_qsl  # noqa

from celery import shared_task, __version__ as celery_version
from celery.five import items, reraise
from celery.utils.log import get_task_logger

__all__ = ['InvalidResponseError', 'RemoteExecuteError', 'UnknownStatusError',
           'HttpDispatch', 'dispatch', 'URL']

GET_METHODS = frozenset(['GET', 'HEAD'])
logger = get_task_logger(__name__)


if sys.version_info[0] == 3:  # pragma: no cover

    from urllib.request import Request, urlopen

    def utf8dict(tup):
        if not isinstance(tup, dict):
            return dict(tup)
        return tup

else:

    from urllib2 import Request, urlopen  # noqa

    def utf8dict(tup):  # noqa
        """With a dict's items() tuple return a new dict with any utf-8
        keys/values encoded."""
        return dict(
            (k.encode('utf-8'),
             v.encode('utf-8') if isinstance(v, unicode) else v)  # noqa
            for k, v in tup)


class InvalidResponseError(Exception):
    """The remote server gave an invalid response."""


class RemoteExecuteError(Exception):
    """The remote task gave a custom error."""


class UnknownStatusError(InvalidResponseError):
    """The remote server gave an unknown status."""


def extract_response(raw_response, loads=anyjson.loads):
    """Extract the response text from a raw JSON response."""
    if not raw_response:
        raise InvalidResponseError('Empty response')
    try:
        payload = loads(raw_response)
    except ValueError as exc:
        reraise(InvalidResponseError, InvalidResponseError(
            str(exc)), sys.exc_info()[2])

    status = payload['status']
    if status == 'success':
        return payload['retval']
    elif status == 'failure':
        raise RemoteExecuteError(payload.get('reason'))
    else:
        raise UnknownStatusError(str(status))


class MutableURL(object):
    """Object wrapping a Uniform Resource Locator.

    Supports editing the query parameter list.
    You can convert the object back to a string, the query will be
    properly urlencoded.

    Examples

        >>> url = URL('http://www.google.com:6580/foo/bar?x=3&y=4#foo')
        >>> url.query
        {'x': '3', 'y': '4'}
        >>> str(url)
        'http://www.google.com:6580/foo/bar?y=4&x=3#foo'
        >>> url.query['x'] = 10
        >>> url.query.update({'George': 'Costanza'})
        >>> str(url)
        'http://www.google.com:6580/foo/bar?y=4&x=10&George=Costanza#foo'

    """
    def __init__(self, url):
        self.parts = urlparse(url)
        self.query = dict(parse_qsl(self.parts[4]))

    def __str__(self):
        scheme, netloc, path, params, query, fragment = self.parts
        query = urlencode(utf8dict(items(self.query)))
        components = [scheme + '://', netloc, path or '/',
                      ';{0}'.format(params) if params else '',
                      '?{0}'.format(query) if query else '',
                      '#{0}'.format(fragment) if fragment else '']
        return ''.join(c for c in components if c)

    def __repr__(self):
        return '<{0}: {1}>'.format(type(self).__name__, self)


class HttpDispatch(object):
    """Make task HTTP request and collect the task result.

    :param url: The URL to request.
    :param method: HTTP method used. Currently supported methods are `GET`
        and `POST`.
    :param task_kwargs: Task keyword arguments.
    :param logger: Logger used for user/system feedback.

    """
    user_agent = 'celery/{version}'.format(version=celery_version)
    timeout = 5

    def __init__(self, url, method, task_kwargs, **kwargs):
        self.url = url
        self.method = method
        self.task_kwargs = task_kwargs
        self.logger = kwargs.get('logger') or logger

    def make_request(self, url, method, params):
        """Perform HTTP request and return the response."""
        request = Request(url, params)
        for key, val in items(self.http_headers):
            request.add_header(key, val)
        response = urlopen(request)  # user catches errors.
        return response.read()

    def dispatch(self):
        """Dispatch callback and return result."""
        url = MutableURL(self.url)
        params = None
        if self.method in GET_METHODS:
            url.query.update(self.task_kwargs)
        else:
            params = urlencode(utf8dict(items(self.task_kwargs)))
        raw_response = self.make_request(str(url), self.method, params)
        return extract_response(raw_response)

    @property
    def http_headers(self):
        headers = {'User-Agent': self.user_agent}
        return headers


@shared_task(name='celery.http_dispatch', bind=True,
             url=None, method=None, accept_magic_kwargs=False)
def dispatch(self, url=None, method='GET', **kwargs):
    """Task dispatching to an URL.

    :keyword url: The URL location of the HTTP callback task.
    :keyword method: Method to use when dispatching the callback. Usually
        `GET` or `POST`.
    :keyword \*\*kwargs: Keyword arguments to pass on to the HTTP callback.

    .. attribute:: url

        If this is set, this is used as the default URL for requests.
        Default is to require the user of the task to supply the url as an
        argument, as this attribute is intended for subclasses.

    .. attribute:: method

        If this is set, this is the default method used for requests.
        Default is to require the user of the task to supply the method as an
        argument, as this attribute is intended for subclasses.

    """
    return HttpDispatch(
        url or self.url, method or self.method, kwargs,
    ).dispatch()


class URL(MutableURL):
    """HTTP Callback URL

    Supports requesting an URL asynchronously.

    :param url: URL to request.
    :keyword dispatcher: Class used to dispatch the request.
        By default this is :func:`dispatch`.

    """
    dispatcher = None

    def __init__(self, url, dispatcher=None, app=None):
        super(URL, self).__init__(url)
        self.app = app
        self.dispatcher = dispatcher or self.dispatcher
        if self.dispatcher is None:
            # Get default dispatcher
            self.dispatcher = (
                self.app.tasks['celery.http_dispatch'] if self.app
                else dispatch
            )

    def get_async(self, **kwargs):
        return self.dispatcher.delay(str(self), 'GET', **kwargs)

    def post_async(self, **kwargs):
        return self.dispatcher.delay(str(self), 'POST', **kwargs)
