from __future__ import absolute_import

from celery.contrib.abortable import AbortableTask, AbortableAsyncResult
from celery.tests.case import AppCase


class test_AbortableTask(AppCase):

    def setup(self):

        @self.app.task(base=AbortableTask, shared=False)
        def abortable():
            return True
        self.abortable = abortable

    def test_async_result_is_abortable(self):
        result = self.abortable.apply_async()
        tid = result.id
        self.assertIsInstance(
            self.abortable.AsyncResult(tid), AbortableAsyncResult,
        )

    def test_is_not_aborted(self):
        self.abortable.push_request()
        try:
            result = self.abortable.apply_async()
            tid = result.id
            self.assertFalse(self.abortable.is_aborted(task_id=tid))
        finally:
            self.abortable.pop_request()

    def test_is_aborted_not_abort_result(self):
        self.abortable.AsyncResult = self.app.AsyncResult
        self.abortable.push_request()
        try:
            self.abortable.request.id = 'foo'
            self.assertFalse(self.abortable.is_aborted())
        finally:
            self.abortable.pop_request()

    def test_abort_yields_aborted(self):
        self.abortable.push_request()
        try:
            result = self.abortable.apply_async()
            result.abort()
            tid = result.id
            self.assertTrue(self.abortable.is_aborted(task_id=tid))
        finally:
            self.abortable.pop_request()
