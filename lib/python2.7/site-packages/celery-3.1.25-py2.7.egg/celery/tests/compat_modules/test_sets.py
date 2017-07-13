from __future__ import absolute_import

import anyjson
import warnings

from celery import uuid
from celery.result import TaskSetResult
from celery.task import Task
from celery.canvas import Signature

from celery.tests.tasks.test_result import make_mock_group
from celery.tests.case import AppCase, Mock, patch


class SetsCase(AppCase):

    def setup(self):
        with warnings.catch_warnings(record=True):
            from celery.task import sets
            self.sets = sets
            self.subtask = sets.subtask
            self.TaskSet = sets.TaskSet

        class MockTask(Task):
            app = self.app
            name = 'tasks.add'

            def run(self, x, y, **kwargs):
                return x + y

            @classmethod
            def apply_async(cls, args, kwargs, **options):
                return (args, kwargs, options)

            @classmethod
            def apply(cls, args, kwargs, **options):
                return (args, kwargs, options)
        self.MockTask = MockTask


class test_TaskSetResult(AppCase):

    def setup(self):
        self.size = 10
        self.ts = TaskSetResult(uuid(), make_mock_group(self.app, self.size))

    def test_total(self):
        self.assertEqual(self.ts.total, self.size)

    def test_compat_properties(self):
        self.assertEqual(self.ts.taskset_id, self.ts.id)
        self.ts.taskset_id = 'foo'
        self.assertEqual(self.ts.taskset_id, 'foo')

    def test_compat_subtasks_kwarg(self):
        x = TaskSetResult(uuid(), subtasks=[1, 2, 3])
        self.assertEqual(x.results, [1, 2, 3])

    def test_itersubtasks(self):
        it = self.ts.itersubtasks()

        for i, t in enumerate(it):
            self.assertEqual(t.get(), i)


class test_App(AppCase):

    def test_TaskSet(self):
        with warnings.catch_warnings(record=True):
            ts = self.app.TaskSet()
            self.assertListEqual(ts.tasks, [])
            self.assertIs(ts.app, self.app)


class test_subtask(SetsCase):

    def test_behaves_like_type(self):
        s = self.subtask('tasks.add', (2, 2), {'cache': True},
                         {'routing_key': 'CPU-bound'})
        self.assertDictEqual(self.subtask(s), s)

    def test_task_argument_can_be_task_cls(self):
        s = self.subtask(self.MockTask, (2, 2))
        self.assertEqual(s.task, self.MockTask.name)

    def test_apply_async(self):
        s = self.MockTask.subtask(
            (2, 2), {'cache': True}, {'routing_key': 'CPU-bound'},
        )
        args, kwargs, options = s.apply_async()
        self.assertTupleEqual(args, (2, 2))
        self.assertDictEqual(kwargs, {'cache': True})
        self.assertDictEqual(options, {'routing_key': 'CPU-bound'})

    def test_delay_argmerge(self):
        s = self.MockTask.subtask(
            (2, ), {'cache': True}, {'routing_key': 'CPU-bound'},
        )
        args, kwargs, options = s.delay(10, cache=False, other='foo')
        self.assertTupleEqual(args, (10, 2))
        self.assertDictEqual(kwargs, {'cache': False, 'other': 'foo'})
        self.assertDictEqual(options, {'routing_key': 'CPU-bound'})

    def test_apply_async_argmerge(self):
        s = self.MockTask.subtask(
            (2, ), {'cache': True}, {'routing_key': 'CPU-bound'},
        )
        args, kwargs, options = s.apply_async((10, ),
                                              {'cache': False, 'other': 'foo'},
                                              routing_key='IO-bound',
                                              exchange='fast')

        self.assertTupleEqual(args, (10, 2))
        self.assertDictEqual(kwargs, {'cache': False, 'other': 'foo'})
        self.assertDictEqual(options, {'routing_key': 'IO-bound',
                                       'exchange': 'fast'})

    def test_apply_argmerge(self):
        s = self.MockTask.subtask(
            (2, ), {'cache': True}, {'routing_key': 'CPU-bound'},
        )
        args, kwargs, options = s.apply((10, ),
                                        {'cache': False, 'other': 'foo'},
                                        routing_key='IO-bound',
                                        exchange='fast')

        self.assertTupleEqual(args, (10, 2))
        self.assertDictEqual(kwargs, {'cache': False, 'other': 'foo'})
        self.assertDictEqual(
            options, {'routing_key': 'IO-bound', 'exchange': 'fast'},
        )

    def test_is_JSON_serializable(self):
        s = self.MockTask.subtask(
            (2, ), {'cache': True}, {'routing_key': 'CPU-bound'},
        )
        # tuples are not preserved, but this doesn't matter.
        s.args = list(s.args)
        self.assertEqual(s, self.subtask(anyjson.loads(anyjson.dumps(s))))

    def test_repr(self):
        s = self.MockTask.subtask((2, ), {'cache': True})
        self.assertIn('2', repr(s))
        self.assertIn('cache=True', repr(s))

    def test_reduce(self):
        s = self.MockTask.subtask((2, ), {'cache': True})
        cls, args = s.__reduce__()
        self.assertDictEqual(dict(cls(*args)), dict(s))


class test_TaskSet(SetsCase):

    def test_task_arg_can_be_iterable__compat(self):
        ts = self.TaskSet([self.MockTask.subtask((i, i))
                           for i in (2, 4, 8)], app=self.app)
        self.assertEqual(len(ts), 3)

    def test_respects_ALWAYS_EAGER(self):
        app = self.app

        class MockTaskSet(self.TaskSet):
            applied = 0

            def apply(self, *args, **kwargs):
                self.applied += 1

        ts = MockTaskSet(
            [self.MockTask.subtask((i, i)) for i in (2, 4, 8)],
            app=self.app,
        )
        app.conf.CELERY_ALWAYS_EAGER = True
        ts.apply_async()
        self.assertEqual(ts.applied, 1)
        app.conf.CELERY_ALWAYS_EAGER = False

        with patch('celery.task.sets.get_current_worker_task') as gwt:
            parent = gwt.return_value = Mock()
            ts.apply_async()
            self.assertTrue(parent.add_trail.called)

    def test_apply_async(self):
        applied = [0]

        class mocksubtask(Signature):

            def apply_async(self, *args, **kwargs):
                applied[0] += 1

        ts = self.TaskSet([mocksubtask(self.MockTask, (i, i))
                           for i in (2, 4, 8)], app=self.app)
        ts.apply_async()
        self.assertEqual(applied[0], 3)

        class Publisher(object):

            def send(self, *args, **kwargs):
                pass

        ts.apply_async(publisher=Publisher())

        # setting current_task

        @self.app.task(shared=False)
        def xyz():
            pass

        from celery._state import _task_stack
        xyz.push_request()
        _task_stack.push(xyz)
        try:
            ts.apply_async(publisher=Publisher())
        finally:
            _task_stack.pop()
            xyz.pop_request()

    def test_apply(self):

        applied = [0]

        class mocksubtask(Signature):

            def apply(self, *args, **kwargs):
                applied[0] += 1

        ts = self.TaskSet([mocksubtask(self.MockTask, (i, i))
                           for i in (2, 4, 8)], app=self.app)
        ts.apply()
        self.assertEqual(applied[0], 3)

    def test_set_app(self):
        ts = self.TaskSet([], app=self.app)
        ts.app = 42
        self.assertEqual(ts.app, 42)

    def test_set_tasks(self):
        ts = self.TaskSet([], app=self.app)
        ts.tasks = [1, 2, 3]
        self.assertEqual(ts, [1, 2, 3])

    def test_set_Publisher(self):
        ts = self.TaskSet([], app=self.app)
        ts.Publisher = 42
        self.assertEqual(ts.Publisher, 42)
