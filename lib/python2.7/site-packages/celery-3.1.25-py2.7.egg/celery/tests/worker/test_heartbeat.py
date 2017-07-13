from __future__ import absolute_import

from celery.worker.heartbeat import Heart
from celery.tests.case import AppCase


class MockDispatcher(object):
    heart = None
    next_iter = 0

    def __init__(self):
        self.sent = []
        self.on_enabled = set()
        self.on_disabled = set()
        self.enabled = True

    def send(self, msg, **_fields):
        self.sent.append(msg)
        if self.heart:
            if self.next_iter > 10:
                self.heart._shutdown.set()
            self.next_iter += 1


class MockDispatcherRaising(object):

    def send(self, msg):
        if msg == 'worker-offline':
            raise Exception('foo')


class MockTimer(object):

    def call_repeatedly(self, secs, fun, args=(), kwargs={}):

        class entry(tuple):
            canceled = False

            def cancel(self):
                self.canceled = True

        return entry((secs, fun, args, kwargs))

    def cancel(self, entry):
        entry.cancel()


class test_Heart(AppCase):

    def test_start_stop(self):
        timer = MockTimer()
        eventer = MockDispatcher()
        h = Heart(timer, eventer, interval=1)
        h.start()
        self.assertTrue(h.tref)
        h.stop()
        self.assertIsNone(h.tref)
        h.stop()

    def test_start_when_disabled(self):
        timer = MockTimer()
        eventer = MockDispatcher()
        eventer.enabled = False
        h = Heart(timer, eventer)
        h.start()
        self.assertFalse(h.tref)

    def test_stop_when_disabled(self):
        timer = MockTimer()
        eventer = MockDispatcher()
        eventer.enabled = False
        h = Heart(timer, eventer)
        h.stop()
