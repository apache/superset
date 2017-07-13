# -*- coding: utf-8 -*-
from __future__ import absolute_import, unicode_literals

from contextlib import contextmanager
from functools import wraps
try:
    from urllib import addinfourl
except ImportError:  # py3k
    from urllib.request import addinfourl  # noqa

from anyjson import dumps
from kombu.utils.encoding import from_utf8

from celery.five import WhateverIO, items
from celery.task import http
from celery.tests.case import AppCase, Case


@contextmanager
def mock_urlopen(response_method):

    urlopen = http.urlopen

    @wraps(urlopen)
    def _mocked(url, *args, **kwargs):
        response_data, headers = response_method(url)
        return addinfourl(WhateverIO(response_data), headers, url)

    http.urlopen = _mocked

    try:
        yield True
    finally:
        http.urlopen = urlopen


def _response(res):
    return lambda r: (res, [])


def success_response(value):
    return _response(dumps({'status': 'success', 'retval': value}))


def fail_response(reason):
    return _response(dumps({'status': 'failure', 'reason': reason}))


def unknown_response():
    return _response(dumps({'status': 'u.u.u.u', 'retval': True}))


class test_encodings(Case):

    def test_utf8dict(self):
        uk = 'foobar'
        d = {'følelser ær langé': 'ærbadægzaååÆØÅ',
             from_utf8(uk): from_utf8('xuzzybaz')}

        for key, value in items(http.utf8dict(items(d))):
            self.assertIsInstance(key, str)
            self.assertIsInstance(value, str)


class test_MutableURL(Case):

    def test_url_query(self):
        url = http.MutableURL('http://example.com?x=10&y=20&z=Foo')
        self.assertDictContainsSubset({'x': '10',
                                       'y': '20',
                                       'z': 'Foo'}, url.query)
        url.query['name'] = 'George'
        url = http.MutableURL(str(url))
        self.assertDictContainsSubset({'x': '10',
                                       'y': '20',
                                       'z': 'Foo',
                                       'name': 'George'}, url.query)

    def test_url_keeps_everything(self):
        url = 'https://e.com:808/foo/bar#zeta?x=10&y=20'
        url = http.MutableURL(url)

        self.assertEqual(
            str(url).split('?')[0],
            'https://e.com:808/foo/bar#zeta',
        )

    def test___repr__(self):
        url = http.MutableURL('http://e.com/foo/bar')
        self.assertTrue(repr(url).startswith('<MutableURL: http://e.com'))

    def test_set_query(self):
        url = http.MutableURL('http://e.com/foo/bar/?x=10')
        url.query = {'zzz': 'xxx'}
        url = http.MutableURL(str(url))
        self.assertEqual(url.query, {'zzz': 'xxx'})


class test_HttpDispatch(AppCase):

    def test_dispatch_success(self):
        with mock_urlopen(success_response(100)):
            d = http.HttpDispatch('http://example.com/mul', 'GET', {
                'x': 10, 'y': 10})
            self.assertEqual(d.dispatch(), 100)

    def test_dispatch_failure(self):
        with mock_urlopen(fail_response('Invalid moon alignment')):
            d = http.HttpDispatch('http://example.com/mul', 'GET', {
                'x': 10, 'y': 10})
            with self.assertRaises(http.RemoteExecuteError):
                d.dispatch()

    def test_dispatch_empty_response(self):
        with mock_urlopen(_response('')):
            d = http.HttpDispatch('http://example.com/mul', 'GET', {
                'x': 10, 'y': 10})
            with self.assertRaises(http.InvalidResponseError):
                d.dispatch()

    def test_dispatch_non_json(self):
        with mock_urlopen(_response("{'#{:'''")):
            d = http.HttpDispatch('http://example.com/mul', 'GET', {
                'x': 10, 'y': 10})
            with self.assertRaises(http.InvalidResponseError):
                d.dispatch()

    def test_dispatch_unknown_status(self):
        with mock_urlopen(unknown_response()):
            d = http.HttpDispatch('http://example.com/mul', 'GET', {
                'x': 10, 'y': 10})
            with self.assertRaises(http.UnknownStatusError):
                d.dispatch()

    def test_dispatch_POST(self):
        with mock_urlopen(success_response(100)):
            d = http.HttpDispatch('http://example.com/mul', 'POST', {
                'x': 10, 'y': 10})
            self.assertEqual(d.dispatch(), 100)


class test_URL(AppCase):

    def test_URL_get_async(self):
        self.app.conf.CELERY_ALWAYS_EAGER = True
        with mock_urlopen(success_response(100)):
            d = http.URL(
                'http://example.com/mul', app=self.app,
            ).get_async(x=10, y=10)
            self.assertEqual(d.get(), 100)

    def test_URL_post_async(self):
        self.app.conf.CELERY_ALWAYS_EAGER = True
        with mock_urlopen(success_response(100)):
            d = http.URL(
                'http://example.com/mul', app=self.app,
            ).post_async(x=10, y=10)
            self.assertEqual(d.get(), 100)
