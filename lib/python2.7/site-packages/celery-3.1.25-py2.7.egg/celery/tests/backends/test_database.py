from __future__ import absolute_import, unicode_literals

from datetime import datetime

from pickle import loads, dumps

from celery import states
from celery.exceptions import ImproperlyConfigured
from celery.utils import uuid

from celery.tests.case import (
    AppCase,
    SkipTest,
    depends_on_current_app,
    mask_modules,
    skip_if_pypy,
    skip_if_jython,
)

try:
    import sqlalchemy  # noqa
except ImportError:
    DatabaseBackend = Task = TaskSet = retry = None  # noqa
else:
    from celery.backends.database import DatabaseBackend, retry
    from celery.backends.database.models import Task, TaskSet


class SomeClass(object):

    def __init__(self, data):
        self.data = data


class test_DatabaseBackend(AppCase):

    @skip_if_pypy
    @skip_if_jython
    def setup(self):
        if DatabaseBackend is None:
            raise SkipTest('sqlalchemy not installed')
        self.uri = 'sqlite:///test.db'

    def test_retry_helper(self):
        from celery.backends.database import DatabaseError

        calls = [0]

        @retry
        def raises():
            calls[0] += 1
            raise DatabaseError(1, 2, 3)

        with self.assertRaises(DatabaseError):
            raises(max_retries=5)
        self.assertEqual(calls[0], 5)

    def test_missing_SQLAlchemy_raises_ImproperlyConfigured(self):
        with mask_modules('sqlalchemy'):
            from celery.backends.database import _sqlalchemy_installed
            with self.assertRaises(ImproperlyConfigured):
                _sqlalchemy_installed()

    def test_missing_dburi_raises_ImproperlyConfigured(self):
        self.app.conf.CELERY_RESULT_DBURI = None
        with self.assertRaises(ImproperlyConfigured):
            DatabaseBackend(app=self.app)

    def test_missing_task_id_is_PENDING(self):
        tb = DatabaseBackend(self.uri, app=self.app)
        self.assertEqual(tb.get_status('xxx-does-not-exist'), states.PENDING)

    def test_missing_task_meta_is_dict_with_pending(self):
        tb = DatabaseBackend(self.uri, app=self.app)
        self.assertDictContainsSubset({
            'status': states.PENDING,
            'task_id': 'xxx-does-not-exist-at-all',
            'result': None,
            'traceback': None
        }, tb.get_task_meta('xxx-does-not-exist-at-all'))

    def test_mark_as_done(self):
        tb = DatabaseBackend(self.uri, app=self.app)

        tid = uuid()

        self.assertEqual(tb.get_status(tid), states.PENDING)
        self.assertIsNone(tb.get_result(tid))

        tb.mark_as_done(tid, 42)
        self.assertEqual(tb.get_status(tid), states.SUCCESS)
        self.assertEqual(tb.get_result(tid), 42)

    def test_is_pickled(self):
        tb = DatabaseBackend(self.uri, app=self.app)

        tid2 = uuid()
        result = {'foo': 'baz', 'bar': SomeClass(12345)}
        tb.mark_as_done(tid2, result)
        # is serialized properly.
        rindb = tb.get_result(tid2)
        self.assertEqual(rindb.get('foo'), 'baz')
        self.assertEqual(rindb.get('bar').data, 12345)

    def test_mark_as_started(self):
        tb = DatabaseBackend(self.uri, app=self.app)
        tid = uuid()
        tb.mark_as_started(tid)
        self.assertEqual(tb.get_status(tid), states.STARTED)

    def test_mark_as_revoked(self):
        tb = DatabaseBackend(self.uri, app=self.app)
        tid = uuid()
        tb.mark_as_revoked(tid)
        self.assertEqual(tb.get_status(tid), states.REVOKED)

    def test_mark_as_retry(self):
        tb = DatabaseBackend(self.uri, app=self.app)
        tid = uuid()
        try:
            raise KeyError('foo')
        except KeyError as exception:
            import traceback
            trace = '\n'.join(traceback.format_stack())
            tb.mark_as_retry(tid, exception, traceback=trace)
            self.assertEqual(tb.get_status(tid), states.RETRY)
            self.assertIsInstance(tb.get_result(tid), KeyError)
            self.assertEqual(tb.get_traceback(tid), trace)

    def test_mark_as_failure(self):
        tb = DatabaseBackend(self.uri, app=self.app)

        tid3 = uuid()
        try:
            raise KeyError('foo')
        except KeyError as exception:
            import traceback
            trace = '\n'.join(traceback.format_stack())
            tb.mark_as_failure(tid3, exception, traceback=trace)
            self.assertEqual(tb.get_status(tid3), states.FAILURE)
            self.assertIsInstance(tb.get_result(tid3), KeyError)
            self.assertEqual(tb.get_traceback(tid3), trace)

    def test_forget(self):
        tb = DatabaseBackend(self.uri, backend='memory://', app=self.app)
        tid = uuid()
        tb.mark_as_done(tid, {'foo': 'bar'})
        tb.mark_as_done(tid, {'foo': 'bar'})
        x = self.app.AsyncResult(tid, backend=tb)
        x.forget()
        self.assertIsNone(x.result)

    def test_process_cleanup(self):
        tb = DatabaseBackend(self.uri, app=self.app)
        tb.process_cleanup()

    @depends_on_current_app
    def test_reduce(self):
        tb = DatabaseBackend(self.uri, app=self.app)
        self.assertTrue(loads(dumps(tb)))

    def test_save__restore__delete_group(self):
        tb = DatabaseBackend(self.uri, app=self.app)

        tid = uuid()
        res = {'something': 'special'}
        self.assertEqual(tb.save_group(tid, res), res)

        res2 = tb.restore_group(tid)
        self.assertEqual(res2, res)

        tb.delete_group(tid)
        self.assertIsNone(tb.restore_group(tid))

        self.assertIsNone(tb.restore_group('xxx-nonexisting-id'))

    def test_cleanup(self):
        tb = DatabaseBackend(self.uri, app=self.app)
        for i in range(10):
            tb.mark_as_done(uuid(), 42)
            tb.save_group(uuid(), {'foo': 'bar'})
        s = tb.ResultSession()
        for t in s.query(Task).all():
            t.date_done = datetime.now() - tb.expires * 2
        for t in s.query(TaskSet).all():
            t.date_done = datetime.now() - tb.expires * 2
        s.commit()
        s.close()

        tb.cleanup()

    def test_Task__repr__(self):
        self.assertIn('foo', repr(Task('foo')))

    def test_TaskSet__repr__(self):
        self.assertIn('foo', repr(TaskSet('foo', None)))
