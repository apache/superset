from __future__ import absolute_import

from collections import defaultdict
from contextlib import contextmanager

from kombu.utils.limits import TokenBucket

from celery.worker import state
from celery.utils.timeutils import rate

from celery.tests.case import AppCase, Mock, patch, body_from_sig


class test_default_strategy(AppCase):

    def setup(self):
        @self.app.task(shared=False)
        def add(x, y):
            return x + y

        self.add = add

    class Context(object):

        def __init__(self, sig, s, reserved, consumer, message, body):
            self.sig = sig
            self.s = s
            self.reserved = reserved
            self.consumer = consumer
            self.message = message
            self.body = body

        def __call__(self, **kwargs):
            return self.s(
                self.message, self.body,
                self.message.ack, self.message.reject, [], **kwargs
            )

        def was_reserved(self):
            return self.reserved.called

        def was_rate_limited(self):
            assert not self.was_reserved()
            return self.consumer._limit_task.called

        def was_scheduled(self):
            assert not self.was_reserved()
            assert not self.was_rate_limited()
            return self.consumer.timer.call_at.called

        def event_sent(self):
            return self.consumer.event_dispatcher.send.call_args

        def get_request(self):
            if self.was_reserved():
                return self.reserved.call_args[0][0]
            if self.was_rate_limited():
                return self.consumer._limit_task.call_args[0][0]
            if self.was_scheduled():
                return self.consumer.timer.call_at.call_args[0][0]
            raise ValueError('request not handled')

    @contextmanager
    def _context(self, sig,
                 rate_limits=True, events=True, utc=True, limit=None):
        self.assertTrue(sig.type.Strategy)

        reserved = Mock()
        consumer = Mock()
        consumer.task_buckets = defaultdict(lambda: None)
        if limit:
            bucket = TokenBucket(rate(limit), capacity=1)
            consumer.task_buckets[sig.task] = bucket
        consumer.disable_rate_limits = not rate_limits
        consumer.event_dispatcher.enabled = events
        s = sig.type.start_strategy(self.app, consumer, task_reserved=reserved)
        self.assertTrue(s)

        message = Mock()
        body = body_from_sig(self.app, sig, utc=utc)

        yield self.Context(sig, s, reserved, consumer, message, body)

    def test_when_logging_disabled(self):
        with patch('celery.worker.strategy.logger') as logger:
            logger.isEnabledFor.return_value = False
            with self._context(self.add.s(2, 2)) as C:
                C()
                self.assertFalse(logger.info.called)

    def test_task_strategy(self):
        with self._context(self.add.s(2, 2)) as C:
            C()
            self.assertTrue(C.was_reserved())
            req = C.get_request()
            C.consumer.on_task_request.assert_called_with(req)
            self.assertTrue(C.event_sent())

    def test_when_events_disabled(self):
        with self._context(self.add.s(2, 2), events=False) as C:
            C()
            self.assertTrue(C.was_reserved())
            self.assertFalse(C.event_sent())

    def test_eta_task(self):
        with self._context(self.add.s(2, 2).set(countdown=10)) as C:
            C()
            self.assertTrue(C.was_scheduled())
            C.consumer.qos.increment_eventually.assert_called_with()

    def test_eta_task_utc_disabled(self):
        with self._context(self.add.s(2, 2).set(countdown=10), utc=False) as C:
            C()
            self.assertTrue(C.was_scheduled())
            C.consumer.qos.increment_eventually.assert_called_with()

    def test_when_rate_limited(self):
        task = self.add.s(2, 2)
        with self._context(task, rate_limits=True, limit='1/m') as C:
            C()
            self.assertTrue(C.was_rate_limited())

    def test_when_rate_limited__limits_disabled(self):
        task = self.add.s(2, 2)
        with self._context(task, rate_limits=False, limit='1/m') as C:
            C()
            self.assertTrue(C.was_reserved())

    def test_when_revoked(self):
        task = self.add.s(2, 2)
        task.freeze()
        state.revoked.add(task.id)
        try:
            with self._context(task) as C:
                C()
                with self.assertRaises(ValueError):
                    C.get_request()
        finally:
            state.revoked.discard(task.id)
