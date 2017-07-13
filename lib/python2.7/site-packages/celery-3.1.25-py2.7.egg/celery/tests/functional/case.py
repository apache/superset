from __future__ import absolute_import

import atexit
import logging
import os
import signal
import socket
import sys
import traceback

from itertools import count
from time import time

from celery import current_app
from celery.exceptions import TimeoutError
from celery.app.control import flatten_reply
from celery.utils.imports import qualname

from celery.tests.case import Case

HOSTNAME = socket.gethostname()


def say(msg):
    sys.stderr.write('%s\n' % msg)


def try_while(fun, reason='Timed out', timeout=10, interval=0.5):
    time_start = time()
    for iterations in count(0):
        if time() - time_start >= timeout:
            raise TimeoutError()
        ret = fun()
        if ret:
            return ret


class Worker(object):
    started = False
    worker_ids = count(1)
    _shutdown_called = False

    def __init__(self, hostname, loglevel='error', app=None):
        self.hostname = hostname
        self.loglevel = loglevel
        self.app = app or current_app._get_current_object()

    def start(self):
        if not self.started:
            self._fork_and_exec()
            self.started = True

    def _fork_and_exec(self):
        pid = os.fork()
        if pid == 0:
            self.app.worker_main(['worker', '--loglevel=INFO',
                                  '-n', self.hostname,
                                  '-P', 'solo'])
            os._exit(0)
        self.pid = pid

    def ping(self, *args, **kwargs):
        return self.app.control.ping(*args, **kwargs)

    def is_alive(self, timeout=1):
        r = self.ping(destination=[self.hostname], timeout=timeout)
        return self.hostname in flatten_reply(r)

    def wait_until_started(self, timeout=10, interval=0.5):
        try_while(
            lambda: self.is_alive(interval),
            "Worker won't start (after %s secs.)" % timeout,
            interval=interval, timeout=timeout,
        )
        say('--WORKER %s IS ONLINE--' % self.hostname)

    def ensure_shutdown(self, timeout=10, interval=0.5):
        os.kill(self.pid, signal.SIGTERM)
        try_while(
            lambda: not self.is_alive(interval),
            "Worker won't shutdown (after %s secs.)" % timeout,
            timeout=10, interval=0.5,
        )
        say('--WORKER %s IS SHUTDOWN--' % self.hostname)
        self._shutdown_called = True

    def ensure_started(self):
        self.start()
        self.wait_until_started()

    @classmethod
    def managed(cls, hostname=None, caller=None):
        hostname = hostname or socket.gethostname()
        if caller:
            hostname = '.'.join([qualname(caller), hostname])
        else:
            hostname += str(next(cls.worker_ids()))
        worker = cls(hostname)
        worker.ensure_started()
        stack = traceback.format_stack()

        @atexit.register
        def _ensure_shutdown_once():
            if not worker._shutdown_called:
                say('-- Found worker not stopped at shutdown: %s\n%s' % (
                    worker.hostname,
                    '\n'.join(stack)))
                worker.ensure_shutdown()

        return worker


class WorkerCase(Case):
    hostname = HOSTNAME
    worker = None

    @classmethod
    def setUpClass(cls):
        logging.getLogger('amqp').setLevel(logging.ERROR)
        cls.worker = Worker.managed(cls.hostname, caller=cls)

    @classmethod
    def tearDownClass(cls):
        cls.worker.ensure_shutdown()

    def assertWorkerAlive(self, timeout=1):
        self.assertTrue(self.worker.is_alive)

    def inspect(self, timeout=1):
        return self.app.control.inspect([self.worker.hostname],
                                        timeout=timeout)

    def my_response(self, response):
        return flatten_reply(response)[self.worker.hostname]

    def is_accepted(self, task_id, interval=0.5):
        active = self.inspect(timeout=interval).active()
        if active:
            for task in active[self.worker.hostname]:
                if task['id'] == task_id:
                    return True
        return False

    def is_reserved(self, task_id, interval=0.5):
        reserved = self.inspect(timeout=interval).reserved()
        if reserved:
            for task in reserved[self.worker.hostname]:
                if task['id'] == task_id:
                    return True
        return False

    def is_scheduled(self, task_id, interval=0.5):
        schedule = self.inspect(timeout=interval).scheduled()
        if schedule:
            for item in schedule[self.worker.hostname]:
                if item['request']['id'] == task_id:
                    return True
        return False

    def is_received(self, task_id, interval=0.5):
        return (self.is_reserved(task_id, interval) or
                self.is_scheduled(task_id, interval) or
                self.is_accepted(task_id, interval))

    def ensure_accepted(self, task_id, interval=0.5, timeout=10):
        return try_while(lambda: self.is_accepted(task_id, interval),
                         'Task not accepted within timeout',
                         interval=0.5, timeout=10)

    def ensure_received(self, task_id, interval=0.5, timeout=10):
        return try_while(lambda: self.is_received(task_id, interval),
                         'Task not receied within timeout',
                         interval=0.5, timeout=10)

    def ensure_scheduled(self, task_id, interval=0.5, timeout=10):
        return try_while(lambda: self.is_scheduled(task_id, interval),
                         'Task not scheduled within timeout',
                         interval=0.5, timeout=10)
