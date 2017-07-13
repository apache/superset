from __future__ import absolute_import

# some of these are tested in test_worker, so I've only written tests
# here to complete coverage.  Should move everyting to this module at some
# point [-ask]

from celery.worker.components import (
    Queues,
    Pool,
)

from celery.tests.case import AppCase, Mock


class test_Queues(AppCase):

    def test_create_when_eventloop(self):
        w = Mock()
        w.use_eventloop = w.pool_putlocks = w.pool_cls.uses_semaphore = True
        q = Queues(w)
        q.create(w)
        self.assertIs(w.process_task, w._process_task_sem)


class test_Pool(AppCase):

    def test_close_terminate(self):
        w = Mock()
        comp = Pool(w)
        pool = w.pool = Mock()
        comp.close(w)
        pool.close.assert_called_with()
        comp.terminate(w)
        pool.terminate.assert_called_with()

        w.pool = None
        comp.close(w)
        comp.terminate(w)
