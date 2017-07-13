from __future__ import absolute_import

from functools import wraps

from kombu.pidbox import Mailbox

from celery.app import control
from celery.exceptions import DuplicateNodenameWarning
from celery.utils import uuid
from celery.tests.case import AppCase


class MockMailbox(Mailbox):
    sent = []

    def _publish(self, command, *args, **kwargs):
        self.__class__.sent.append(command)

    def close(self):
        pass

    def _collect(self, *args, **kwargs):
        pass


class Control(control.Control):
    Mailbox = MockMailbox


def with_mock_broadcast(fun):

    @wraps(fun)
    def _resets(*args, **kwargs):
        MockMailbox.sent = []
        try:
            return fun(*args, **kwargs)
        finally:
            MockMailbox.sent = []
    return _resets


class test_flatten_reply(AppCase):

    def test_flatten_reply(self):
        reply = [
            {'foo@example.com': {'hello': 10}},
            {'foo@example.com': {'hello': 20}},
            {'bar@example.com': {'hello': 30}}
        ]
        with self.assertWarns(DuplicateNodenameWarning) as w:
            nodes = control.flatten_reply(reply)

        self.assertIn(
            'Received multiple replies from node name: foo@example.com.',
            str(w.warning)
        )
        self.assertIn('foo@example.com', nodes)
        self.assertIn('bar@example.com', nodes)


class test_inspect(AppCase):

    def setup(self):
        self.c = Control(app=self.app)
        self.prev, self.app.control = self.app.control, self.c
        self.i = self.c.inspect()

    def test_prepare_reply(self):
        self.assertDictEqual(self.i._prepare([{'w1': {'ok': 1}},
                                              {'w2': {'ok': 1}}]),
                             {'w1': {'ok': 1}, 'w2': {'ok': 1}})

        i = self.c.inspect(destination='w1')
        self.assertEqual(i._prepare([{'w1': {'ok': 1}}]),
                         {'ok': 1})

    @with_mock_broadcast
    def test_active(self):
        self.i.active()
        self.assertIn('dump_active', MockMailbox.sent)

    @with_mock_broadcast
    def test_clock(self):
        self.i.clock()
        self.assertIn('clock', MockMailbox.sent)

    @with_mock_broadcast
    def test_conf(self):
        self.i.conf()
        self.assertIn('dump_conf', MockMailbox.sent)

    @with_mock_broadcast
    def test_hello(self):
        self.i.hello('george@vandelay.com')
        self.assertIn('hello', MockMailbox.sent)

    @with_mock_broadcast
    def test_memsample(self):
        self.i.memsample()
        self.assertIn('memsample', MockMailbox.sent)

    @with_mock_broadcast
    def test_memdump(self):
        self.i.memdump()
        self.assertIn('memdump', MockMailbox.sent)

    @with_mock_broadcast
    def test_objgraph(self):
        self.i.objgraph()
        self.assertIn('objgraph', MockMailbox.sent)

    @with_mock_broadcast
    def test_scheduled(self):
        self.i.scheduled()
        self.assertIn('dump_schedule', MockMailbox.sent)

    @with_mock_broadcast
    def test_reserved(self):
        self.i.reserved()
        self.assertIn('dump_reserved', MockMailbox.sent)

    @with_mock_broadcast
    def test_stats(self):
        self.i.stats()
        self.assertIn('stats', MockMailbox.sent)

    @with_mock_broadcast
    def test_revoked(self):
        self.i.revoked()
        self.assertIn('dump_revoked', MockMailbox.sent)

    @with_mock_broadcast
    def test_tasks(self):
        self.i.registered()
        self.assertIn('dump_tasks', MockMailbox.sent)

    @with_mock_broadcast
    def test_ping(self):
        self.i.ping()
        self.assertIn('ping', MockMailbox.sent)

    @with_mock_broadcast
    def test_active_queues(self):
        self.i.active_queues()
        self.assertIn('active_queues', MockMailbox.sent)

    @with_mock_broadcast
    def test_report(self):
        self.i.report()
        self.assertIn('report', MockMailbox.sent)


class test_Broadcast(AppCase):

    def setup(self):
        self.control = Control(app=self.app)
        self.app.control = self.control

        @self.app.task(shared=False)
        def mytask():
            pass
        self.mytask = mytask

    def test_purge(self):
        self.control.purge()

    @with_mock_broadcast
    def test_broadcast(self):
        self.control.broadcast('foobarbaz', arguments=[])
        self.assertIn('foobarbaz', MockMailbox.sent)

    @with_mock_broadcast
    def test_broadcast_limit(self):
        self.control.broadcast(
            'foobarbaz1', arguments=[], limit=None, destination=[1, 2, 3],
        )
        self.assertIn('foobarbaz1', MockMailbox.sent)

    @with_mock_broadcast
    def test_broadcast_validate(self):
        with self.assertRaises(ValueError):
            self.control.broadcast('foobarbaz2',
                                   destination='foo')

    @with_mock_broadcast
    def test_rate_limit(self):
        self.control.rate_limit(self.mytask.name, '100/m')
        self.assertIn('rate_limit', MockMailbox.sent)

    @with_mock_broadcast
    def test_time_limit(self):
        self.control.time_limit(self.mytask.name, soft=10, hard=20)
        self.assertIn('time_limit', MockMailbox.sent)

    @with_mock_broadcast
    def test_add_consumer(self):
        self.control.add_consumer('foo')
        self.assertIn('add_consumer', MockMailbox.sent)

    @with_mock_broadcast
    def test_cancel_consumer(self):
        self.control.cancel_consumer('foo')
        self.assertIn('cancel_consumer', MockMailbox.sent)

    @with_mock_broadcast
    def test_enable_events(self):
        self.control.enable_events()
        self.assertIn('enable_events', MockMailbox.sent)

    @with_mock_broadcast
    def test_disable_events(self):
        self.control.disable_events()
        self.assertIn('disable_events', MockMailbox.sent)

    @with_mock_broadcast
    def test_revoke(self):
        self.control.revoke('foozbaaz')
        self.assertIn('revoke', MockMailbox.sent)

    @with_mock_broadcast
    def test_ping(self):
        self.control.ping()
        self.assertIn('ping', MockMailbox.sent)

    @with_mock_broadcast
    def test_election(self):
        self.control.election('some_id', 'topic', 'action')
        self.assertIn('election', MockMailbox.sent)

    @with_mock_broadcast
    def test_pool_grow(self):
        self.control.pool_grow(2)
        self.assertIn('pool_grow', MockMailbox.sent)

    @with_mock_broadcast
    def test_pool_shrink(self):
        self.control.pool_shrink(2)
        self.assertIn('pool_shrink', MockMailbox.sent)

    @with_mock_broadcast
    def test_revoke_from_result(self):
        self.app.AsyncResult('foozbazzbar').revoke()
        self.assertIn('revoke', MockMailbox.sent)

    @with_mock_broadcast
    def test_revoke_from_resultset(self):
        r = self.app.GroupResult(uuid(),
                                 [self.app.AsyncResult(x)
                                  for x in [uuid() for i in range(10)]])
        r.revoke()
        self.assertIn('revoke', MockMailbox.sent)
