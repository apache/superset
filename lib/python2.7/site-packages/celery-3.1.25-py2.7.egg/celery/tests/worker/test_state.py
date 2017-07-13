from __future__ import absolute_import

import pickle

from time import time

from celery.datastructures import LimitedSet
from celery.exceptions import WorkerShutdown, WorkerTerminate
from celery.worker import state

from celery.tests.case import AppCase, Mock, patch


class StateResetCase(AppCase):

    def setup(self):
        self.reset_state()

    def teardown(self):
        self.reset_state()

    def reset_state(self):
        state.active_requests.clear()
        state.revoked.clear()
        state.total_count.clear()


class MockShelve(dict):
    filename = None
    in_sync = False
    closed = False

    def open(self, filename, **kwargs):
        self.filename = filename
        return self

    def sync(self):
        self.in_sync = True

    def close(self):
        self.closed = True


class MyPersistent(state.Persistent):
    storage = MockShelve()


class test_maybe_shutdown(AppCase):

    def teardown(self):
        state.should_stop = False
        state.should_terminate = False

    def test_should_stop(self):
        state.should_stop = True
        with self.assertRaises(WorkerShutdown):
            state.maybe_shutdown()

    def test_should_terminate(self):
        state.should_terminate = True
        with self.assertRaises(WorkerTerminate):
            state.maybe_shutdown()


class test_Persistent(StateResetCase):

    def setup(self):
        self.reset_state()
        self.p = MyPersistent(state, filename='celery-state')

    def test_close_twice(self):
        self.p._is_open = False
        self.p.close()

    def test_constructor(self):
        self.assertDictEqual(self.p.db, {})
        self.assertEqual(self.p.db.filename, self.p.filename)

    def test_save(self):
        self.p.db['foo'] = 'bar'
        self.p.save()
        self.assertTrue(self.p.db.in_sync)
        self.assertTrue(self.p.db.closed)

    def add_revoked(self, *ids):
        for id in ids:
            self.p.db.setdefault('revoked', LimitedSet()).add(id)

    def test_merge(self, data=['foo', 'bar', 'baz']):
        self.add_revoked(*data)
        self.p.merge()
        for item in data:
            self.assertIn(item, state.revoked)

    def test_merge_dict(self):
        self.p.clock = Mock()
        self.p.clock.adjust.return_value = 626
        d = {'revoked': {'abc': time()}, 'clock': 313}
        self.p._merge_with(d)
        self.p.clock.adjust.assert_called_with(313)
        self.assertEqual(d['clock'], 626)
        self.assertIn('abc', state.revoked)

    def test_sync_clock_and_purge(self):
        passthrough = Mock()
        passthrough.side_effect = lambda x: x
        with patch('celery.worker.state.revoked') as revoked:
            d = {'clock': 0}
            self.p.clock = Mock()
            self.p.clock.forward.return_value = 627
            self.p._dumps = passthrough
            self.p.compress = passthrough
            self.p._sync_with(d)
            revoked.purge.assert_called_with()
            self.assertEqual(d['clock'], 627)
            self.assertNotIn('revoked', d)
            self.assertIs(d['zrevoked'], revoked)

    def test_sync(self, data1=['foo', 'bar', 'baz'],
                  data2=['baz', 'ini', 'koz']):
        self.add_revoked(*data1)
        for item in data2:
            state.revoked.add(item)
        self.p.sync()

        self.assertTrue(self.p.db['zrevoked'])
        pickled = self.p.decompress(self.p.db['zrevoked'])
        self.assertTrue(pickled)
        saved = pickle.loads(pickled)
        for item in data2:
            self.assertIn(item, saved)


class SimpleReq(object):

    def __init__(self, name):
        self.name = name


class test_state(StateResetCase):

    def test_accepted(self, requests=[SimpleReq('foo'),
                                      SimpleReq('bar'),
                                      SimpleReq('baz'),
                                      SimpleReq('baz')]):
        for request in requests:
            state.task_accepted(request)
        for req in requests:
            self.assertIn(req, state.active_requests)
        self.assertEqual(state.total_count['foo'], 1)
        self.assertEqual(state.total_count['bar'], 1)
        self.assertEqual(state.total_count['baz'], 2)

    def test_ready(self, requests=[SimpleReq('foo'),
                                   SimpleReq('bar')]):
        for request in requests:
            state.task_accepted(request)
        self.assertEqual(len(state.active_requests), 2)
        for request in requests:
            state.task_ready(request)
        self.assertEqual(len(state.active_requests), 0)
