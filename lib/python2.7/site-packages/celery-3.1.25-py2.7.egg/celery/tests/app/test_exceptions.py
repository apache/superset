from __future__ import absolute_import

import pickle

from datetime import datetime

from celery.exceptions import Reject, Retry

from celery.tests.case import AppCase


class test_Retry(AppCase):

    def test_when_datetime(self):
        x = Retry('foo', KeyError(), when=datetime.utcnow())
        self.assertTrue(x.humanize())

    def test_pickleable(self):
        x = Retry('foo', KeyError(), when=datetime.utcnow())
        self.assertTrue(pickle.loads(pickle.dumps(x)))


class test_Reject(AppCase):

    def test_attrs(self):
        x = Reject('foo', requeue=True)
        self.assertEqual(x.reason, 'foo')
        self.assertTrue(x.requeue)

    def test_repr(self):
        self.assertTrue(repr(Reject('foo', True)))

    def test_pickleable(self):
        x = Retry('foo', True)
        self.assertTrue(pickle.loads(pickle.dumps(x)))
