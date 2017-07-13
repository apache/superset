from __future__ import absolute_import

import pytz

from datetime import datetime, date, time, timedelta

from kombu import Queue

from celery.utils import (
    chunks,
    is_iterable,
    cached_property,
    warn_deprecated,
    worker_direct,
    gen_task_name,
    jsonify,
)
from celery.tests.case import Case, Mock, patch


def double(x):
    return x * 2


class test_worker_direct(Case):

    def test_returns_if_queue(self):
        q = Queue('foo')
        self.assertIs(worker_direct(q), q)


class test_gen_task_name(Case):

    def test_no_module(self):
        app = Mock()
        app.name == '__main__'
        self.assertTrue(gen_task_name(app, 'foo', 'axsadaewe'))


class test_jsonify(Case):

    def test_simple(self):
        self.assertTrue(jsonify(Queue('foo')))
        self.assertTrue(jsonify(['foo', 'bar', 'baz']))
        self.assertTrue(jsonify({'foo': 'bar'}))
        self.assertTrue(jsonify(datetime.utcnow()))
        self.assertTrue(jsonify(datetime.utcnow().replace(tzinfo=pytz.utc)))
        self.assertTrue(jsonify(datetime.utcnow().replace(microsecond=0)))
        self.assertTrue(jsonify(date(2012, 1, 1)))
        self.assertTrue(jsonify(time(hour=1, minute=30)))
        self.assertTrue(jsonify(time(hour=1, minute=30, microsecond=3)))
        self.assertTrue(jsonify(timedelta(seconds=30)))
        self.assertTrue(jsonify(10))
        self.assertTrue(jsonify(10.3))
        self.assertTrue(jsonify('hello'))

        with self.assertRaises(ValueError):
            jsonify(object())


class test_chunks(Case):

    def test_chunks(self):

        # n == 2
        x = chunks(iter([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 2)
        self.assertListEqual(
            list(x),
            [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9], [10]],
        )

        # n == 3
        x = chunks(iter([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 3)
        self.assertListEqual(
            list(x),
            [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10]],
        )

        # n == 2 (exact)
        x = chunks(iter([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), 2)
        self.assertListEqual(
            list(x),
            [[0, 1], [2, 3], [4, 5], [6, 7], [8, 9]],
        )


class test_utils(Case):

    def test_is_iterable(self):
        for a in 'f', ['f'], ('f', ), {'f': 'f'}:
            self.assertTrue(is_iterable(a))
        for b in object(), 1:
            self.assertFalse(is_iterable(b))

    def test_cached_property(self):

        def fun(obj):
            return fun.value

        x = cached_property(fun)
        self.assertIs(x.__get__(None), x)
        self.assertIs(x.__set__(None, None), x)
        self.assertIs(x.__delete__(None), x)

    @patch('warnings.warn')
    def test_warn_deprecated(self, warn):
        warn_deprecated('Foo')
        self.assertTrue(warn.called)
