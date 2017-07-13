from __future__ import absolute_import

from datetime import datetime, timedelta

from kombu import Queue

from celery import Task

from celery.exceptions import Retry
from celery.five import items, range, string_t
from celery.result import EagerResult
from celery.utils import uuid
from celery.utils.timeutils import parse_iso8601

from celery.tests.case import AppCase, depends_on_current_app, patch


def return_True(*args, **kwargs):
    # Task run functions can't be closures/lambdas, as they're pickled.
    return True


def raise_exception(self, **kwargs):
    raise Exception('%s error' % self.__class__)


class MockApplyTask(Task):
    abstract = True
    applied = 0

    def run(self, x, y):
        return x * y

    def apply_async(self, *args, **kwargs):
        self.applied += 1


class TasksCase(AppCase):

    def setup(self):
        self.mytask = self.app.task(shared=False)(return_True)

        @self.app.task(bind=True, count=0, shared=False)
        def increment_counter(self, increment_by=1):
            self.count += increment_by or 1
            return self.count
        self.increment_counter = increment_counter

        @self.app.task(shared=False)
        def raising():
            raise KeyError('foo')
        self.raising = raising

        @self.app.task(bind=True, max_retries=3, iterations=0, shared=False)
        def retry_task(self, arg1, arg2, kwarg=1, max_retries=None, care=True):
            self.iterations += 1
            rmax = self.max_retries if max_retries is None else max_retries

            assert repr(self.request)
            retries = self.request.retries
            if care and retries >= rmax:
                return arg1
            else:
                raise self.retry(countdown=0, max_retries=rmax)
        self.retry_task = retry_task

        @self.app.task(bind=True, max_retries=3, iterations=0, shared=False)
        def retry_task_noargs(self, **kwargs):
            self.iterations += 1

            if self.request.retries >= 3:
                return 42
            else:
                raise self.retry(countdown=0)
        self.retry_task_noargs = retry_task_noargs

        @self.app.task(bind=True, max_retries=3, iterations=0,
                       base=MockApplyTask, shared=False)
        def retry_task_mockapply(self, arg1, arg2, kwarg=1):
            self.iterations += 1

            retries = self.request.retries
            if retries >= 3:
                return arg1
            raise self.retry(countdown=0)
        self.retry_task_mockapply = retry_task_mockapply

        @self.app.task(bind=True, max_retries=3, iterations=0, shared=False)
        def retry_task_customexc(self, arg1, arg2, kwarg=1, **kwargs):
            self.iterations += 1

            retries = self.request.retries
            if retries >= 3:
                return arg1 + kwarg
            else:
                try:
                    raise MyCustomException('Elaine Marie Benes')
                except MyCustomException as exc:
                    kwargs.update(kwarg=kwarg)
                    raise self.retry(countdown=0, exc=exc)
        self.retry_task_customexc = retry_task_customexc


class MyCustomException(Exception):
    """Random custom exception."""


class test_task_retries(TasksCase):

    def test_retry(self):
        self.retry_task.max_retries = 3
        self.retry_task.iterations = 0
        self.retry_task.apply([0xFF, 0xFFFF])
        self.assertEqual(self.retry_task.iterations, 4)

        self.retry_task.max_retries = 3
        self.retry_task.iterations = 0
        self.retry_task.apply([0xFF, 0xFFFF], {'max_retries': 10})
        self.assertEqual(self.retry_task.iterations, 11)

    def test_retry_no_args(self):
        self.retry_task_noargs.max_retries = 3
        self.retry_task_noargs.iterations = 0
        self.retry_task_noargs.apply(propagate=True).get()
        self.assertEqual(self.retry_task_noargs.iterations, 4)

    def test_retry_kwargs_can_be_empty(self):
        self.retry_task_mockapply.push_request()
        try:
            with self.assertRaises(Retry):
                import sys
                try:
                    sys.exc_clear()
                except AttributeError:
                    pass
                self.retry_task_mockapply.retry(args=[4, 4], kwargs=None)
        finally:
            self.retry_task_mockapply.pop_request()

    def test_retry_not_eager(self):
        self.retry_task_mockapply.push_request()
        try:
            self.retry_task_mockapply.request.called_directly = False
            exc = Exception('baz')
            try:
                self.retry_task_mockapply.retry(
                    args=[4, 4], kwargs={'task_retries': 0},
                    exc=exc, throw=False,
                )
                self.assertTrue(self.retry_task_mockapply.applied)
            finally:
                self.retry_task_mockapply.applied = 0

            try:
                with self.assertRaises(Retry):
                    self.retry_task_mockapply.retry(
                        args=[4, 4], kwargs={'task_retries': 0},
                        exc=exc, throw=True)
                self.assertTrue(self.retry_task_mockapply.applied)
            finally:
                self.retry_task_mockapply.applied = 0
        finally:
            self.retry_task_mockapply.pop_request()

    def test_retry_with_kwargs(self):
        self.retry_task_customexc.max_retries = 3
        self.retry_task_customexc.iterations = 0
        self.retry_task_customexc.apply([0xFF, 0xFFFF], {'kwarg': 0xF})
        self.assertEqual(self.retry_task_customexc.iterations, 4)

    def test_retry_with_custom_exception(self):
        self.retry_task_customexc.max_retries = 2
        self.retry_task_customexc.iterations = 0
        result = self.retry_task_customexc.apply(
            [0xFF, 0xFFFF], {'kwarg': 0xF},
        )
        with self.assertRaises(MyCustomException):
            result.get()
        self.assertEqual(self.retry_task_customexc.iterations, 3)

    def test_max_retries_exceeded(self):
        self.retry_task.max_retries = 2
        self.retry_task.iterations = 0
        result = self.retry_task.apply([0xFF, 0xFFFF], {'care': False})
        with self.assertRaises(self.retry_task.MaxRetriesExceededError):
            result.get()
        self.assertEqual(self.retry_task.iterations, 3)

        self.retry_task.max_retries = 1
        self.retry_task.iterations = 0
        result = self.retry_task.apply([0xFF, 0xFFFF], {'care': False})
        with self.assertRaises(self.retry_task.MaxRetriesExceededError):
            result.get()
        self.assertEqual(self.retry_task.iterations, 2)


class test_canvas_utils(TasksCase):

    def test_si(self):
        self.assertTrue(self.retry_task.si())
        self.assertTrue(self.retry_task.si().immutable)

    def test_chunks(self):
        self.assertTrue(self.retry_task.chunks(range(100), 10))

    def test_map(self):
        self.assertTrue(self.retry_task.map(range(100)))

    def test_starmap(self):
        self.assertTrue(self.retry_task.starmap(range(100)))

    def test_on_success(self):
        self.retry_task.on_success(1, 1, (), {})


class test_tasks(TasksCase):

    def now(self):
        return self.app.now()

    @depends_on_current_app
    def test_unpickle_task(self):
        import pickle

        @self.app.task(shared=True)
        def xxx():
            pass
        self.assertIs(pickle.loads(pickle.dumps(xxx)), xxx.app.tasks[xxx.name])

    def test_AsyncResult(self):
        task_id = uuid()
        result = self.retry_task.AsyncResult(task_id)
        self.assertEqual(result.backend, self.retry_task.backend)
        self.assertEqual(result.id, task_id)

    def assertNextTaskDataEqual(self, consumer, presult, task_name,
                                test_eta=False, test_expires=False, **kwargs):
        next_task = consumer.queues[0].get(accept=['pickle'])
        task_data = next_task.decode()
        self.assertEqual(task_data['id'], presult.id)
        self.assertEqual(task_data['task'], task_name)
        task_kwargs = task_data.get('kwargs', {})
        if test_eta:
            self.assertIsInstance(task_data.get('eta'), string_t)
            to_datetime = parse_iso8601(task_data.get('eta'))
            self.assertIsInstance(to_datetime, datetime)
        if test_expires:
            self.assertIsInstance(task_data.get('expires'), string_t)
            to_datetime = parse_iso8601(task_data.get('expires'))
            self.assertIsInstance(to_datetime, datetime)
        for arg_name, arg_value in items(kwargs):
            self.assertEqual(task_kwargs.get(arg_name), arg_value)

    def test_incomplete_task_cls(self):

        class IncompleteTask(Task):
            app = self.app
            name = 'c.unittest.t.itask'

        with self.assertRaises(NotImplementedError):
            IncompleteTask().run()

    def test_task_kwargs_must_be_dictionary(self):
        with self.assertRaises(ValueError):
            self.increment_counter.apply_async([], 'str')

    def test_task_args_must_be_list(self):
        with self.assertRaises(ValueError):
            self.increment_counter.apply_async('str', {})

    def test_regular_task(self):
        self.assertIsInstance(self.mytask, Task)
        self.assertTrue(self.mytask.run())
        self.assertTrue(
            callable(self.mytask), 'Task class is callable()',
        )
        self.assertTrue(self.mytask(), 'Task class runs run() when called')

        with self.app.connection_or_acquire() as conn:
            consumer = self.app.amqp.TaskConsumer(conn)
            with self.assertRaises(NotImplementedError):
                consumer.receive('foo', 'foo')
            consumer.purge()
            self.assertIsNone(consumer.queues[0].get())
            self.app.amqp.TaskConsumer(conn, queues=[Queue('foo')])

            # Without arguments.
            presult = self.mytask.delay()
            self.assertNextTaskDataEqual(consumer, presult, self.mytask.name)

            # With arguments.
            presult2 = self.mytask.apply_async(
                kwargs=dict(name='George Costanza'),
            )
            self.assertNextTaskDataEqual(
                consumer, presult2, self.mytask.name, name='George Costanza',
            )

            # send_task
            sresult = self.app.send_task(self.mytask.name,
                                         kwargs=dict(name='Elaine M. Benes'))
            self.assertNextTaskDataEqual(
                consumer, sresult, self.mytask.name, name='Elaine M. Benes',
            )

            # With eta.
            presult2 = self.mytask.apply_async(
                kwargs=dict(name='George Costanza'),
                eta=self.now() + timedelta(days=1),
                expires=self.now() + timedelta(days=2),
            )
            self.assertNextTaskDataEqual(
                consumer, presult2, self.mytask.name,
                name='George Costanza', test_eta=True, test_expires=True,
            )

            # With countdown.
            presult2 = self.mytask.apply_async(
                kwargs=dict(name='George Costanza'), countdown=10, expires=12,
            )
            self.assertNextTaskDataEqual(
                consumer, presult2, self.mytask.name,
                name='George Costanza', test_eta=True, test_expires=True,
            )

            # Discarding all tasks.
            consumer.purge()
            self.mytask.apply_async()
            self.assertEqual(consumer.purge(), 1)
            self.assertIsNone(consumer.queues[0].get())

            self.assertFalse(presult.successful())
            self.mytask.backend.mark_as_done(presult.id, result=None)
            self.assertTrue(presult.successful())

    def test_repr_v2_compat(self):
        self.mytask.__v2_compat__ = True
        self.assertIn('v2 compatible', repr(self.mytask))

    def test_apply_with_self(self):

        @self.app.task(__self__=42, shared=False)
        def tawself(self):
            return self

        self.assertEqual(tawself.apply().get(), 42)

        self.assertEqual(tawself(), 42)

    def test_context_get(self):
        self.mytask.push_request()
        try:
            request = self.mytask.request
            request.foo = 32
            self.assertEqual(request.get('foo'), 32)
            self.assertEqual(request.get('bar', 36), 36)
            request.clear()
        finally:
            self.mytask.pop_request()

    def test_task_class_repr(self):
        self.assertIn('class Task of', repr(self.mytask.app.Task))
        self.mytask.app.Task._app = None
        self.assertIn('unbound', repr(self.mytask.app.Task, ))

    def test_bind_no_magic_kwargs(self):
        self.mytask.accept_magic_kwargs = None
        self.mytask.bind(self.mytask.app)

    def test_annotate(self):
        with patch('celery.app.task.resolve_all_annotations') as anno:
            anno.return_value = [{'FOO': 'BAR'}]

            @self.app.task(shared=False)
            def task():
                pass
            task.annotate()
            self.assertEqual(task.FOO, 'BAR')

    def test_after_return(self):
        self.mytask.push_request()
        try:
            self.mytask.request.chord = self.mytask.s()
            self.mytask.after_return('SUCCESS', 1.0, 'foobar', (), {}, None)
            self.mytask.request.clear()
        finally:
            self.mytask.pop_request()

    def test_send_task_sent_event(self):
        with self.app.connection() as conn:
            self.app.conf.CELERY_SEND_TASK_SENT_EVENT = True
            self.assertTrue(self.app.amqp.TaskProducer(conn).send_sent_event)

    def test_update_state(self):

        @self.app.task(shared=False)
        def yyy():
            pass

        yyy.push_request()
        try:
            tid = uuid()
            yyy.update_state(tid, 'FROBULATING', {'fooz': 'baaz'})
            self.assertEqual(yyy.AsyncResult(tid).status, 'FROBULATING')
            self.assertDictEqual(yyy.AsyncResult(tid).result, {'fooz': 'baaz'})

            yyy.request.id = tid
            yyy.update_state(state='FROBUZATING', meta={'fooz': 'baaz'})
            self.assertEqual(yyy.AsyncResult(tid).status, 'FROBUZATING')
            self.assertDictEqual(yyy.AsyncResult(tid).result, {'fooz': 'baaz'})
        finally:
            yyy.pop_request()

    def test_repr(self):

        @self.app.task(shared=False)
        def task_test_repr():
            pass

        self.assertIn('task_test_repr', repr(task_test_repr))

    def test_has___name__(self):

        @self.app.task(shared=False)
        def yyy2():
            pass

        self.assertTrue(yyy2.__name__)


class test_apply_task(TasksCase):

    def test_apply_throw(self):
        with self.assertRaises(KeyError):
            self.raising.apply(throw=True)

    def test_apply_with_CELERY_EAGER_PROPAGATES_EXCEPTIONS(self):
        self.app.conf.CELERY_EAGER_PROPAGATES_EXCEPTIONS = True
        with self.assertRaises(KeyError):
            self.raising.apply()

    def test_apply(self):
        self.increment_counter.count = 0

        e = self.increment_counter.apply()
        self.assertIsInstance(e, EagerResult)
        self.assertEqual(e.get(), 1)

        e = self.increment_counter.apply(args=[1])
        self.assertEqual(e.get(), 2)

        e = self.increment_counter.apply(kwargs={'increment_by': 4})
        self.assertEqual(e.get(), 6)

        self.assertTrue(e.successful())
        self.assertTrue(e.ready())
        self.assertTrue(repr(e).startswith('<EagerResult:'))

        f = self.raising.apply()
        self.assertTrue(f.ready())
        self.assertFalse(f.successful())
        self.assertTrue(f.traceback)
        with self.assertRaises(KeyError):
            f.get()
