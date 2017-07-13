from __future__ import absolute_import

from contextlib import contextmanager

from celery import states
from celery.exceptions import IncompleteStream, TimeoutError
from celery.five import range
from celery.result import (
    AsyncResult,
    EagerResult,
    TaskSetResult,
    result_from_tuple,
)
from celery.utils import uuid
from celery.utils.serialization import pickle

from celery.tests.case import AppCase, Mock, depends_on_current_app, patch


def mock_task(name, state, result):
    return dict(id=uuid(), name=name, state=state, result=result)


def save_result(app, task):
    traceback = 'Some traceback'
    if task['state'] == states.SUCCESS:
        app.backend.mark_as_done(task['id'], task['result'])
    elif task['state'] == states.RETRY:
        app.backend.mark_as_retry(
            task['id'], task['result'], traceback=traceback,
        )
    else:
        app.backend.mark_as_failure(
            task['id'], task['result'], traceback=traceback,
        )


def make_mock_group(app, size=10):
    tasks = [mock_task('ts%d' % i, states.SUCCESS, i) for i in range(size)]
    [save_result(app, task) for task in tasks]
    return [app.AsyncResult(task['id']) for task in tasks]


class test_AsyncResult(AppCase):

    def setup(self):
        self.task1 = mock_task('task1', states.SUCCESS, 'the')
        self.task2 = mock_task('task2', states.SUCCESS, 'quick')
        self.task3 = mock_task('task3', states.FAILURE, KeyError('brown'))
        self.task4 = mock_task('task3', states.RETRY, KeyError('red'))

        for task in (self.task1, self.task2, self.task3, self.task4):
            save_result(self.app, task)

        @self.app.task(shared=False)
        def mytask():
            pass
        self.mytask = mytask

    def test_compat_properties(self):
        x = self.app.AsyncResult('1')
        self.assertEqual(x.task_id, x.id)
        x.task_id = '2'
        self.assertEqual(x.id, '2')

    def test_children(self):
        x = self.app.AsyncResult('1')
        children = [EagerResult(str(i), i, states.SUCCESS) for i in range(3)]
        x._cache = {'children': children, 'status': states.SUCCESS}
        x.backend = Mock()
        self.assertTrue(x.children)
        self.assertEqual(len(x.children), 3)

    def test_propagates_for_parent(self):
        x = self.app.AsyncResult(uuid())
        x.backend = Mock(name='backend')
        x.backend.get_task_meta.return_value = {}
        x.backend.wait_for.return_value = {
            'status': states.SUCCESS, 'result': 84,
        }
        x.parent = EagerResult(uuid(), KeyError('foo'), states.FAILURE)
        with self.assertRaises(KeyError):
            x.get(propagate=True)
        self.assertFalse(x.backend.wait_for.called)

        x.parent = EagerResult(uuid(), 42, states.SUCCESS)
        self.assertEqual(x.get(propagate=True), 84)
        self.assertTrue(x.backend.wait_for.called)

    def test_get_children(self):
        tid = uuid()
        x = self.app.AsyncResult(tid)
        child = [self.app.AsyncResult(uuid()).as_tuple()
                 for i in range(10)]
        x._cache = {'children': child}
        self.assertTrue(x.children)
        self.assertEqual(len(x.children), 10)

        x._cache = {'status': states.SUCCESS}
        x.backend._cache[tid] = {'result': None}
        self.assertIsNone(x.children)

    def test_build_graph_get_leaf_collect(self):
        x = self.app.AsyncResult('1')
        x.backend._cache['1'] = {'status': states.SUCCESS, 'result': None}
        c = [EagerResult(str(i), i, states.SUCCESS) for i in range(3)]
        x.iterdeps = Mock()
        x.iterdeps.return_value = (
            (None, x),
            (x, c[0]),
            (c[0], c[1]),
            (c[1], c[2])
        )
        x.backend.READY_STATES = states.READY_STATES
        self.assertTrue(x.graph)

        self.assertIs(x.get_leaf(), 2)

        it = x.collect()
        self.assertListEqual(list(it), [
            (x, None),
            (c[0], 0),
            (c[1], 1),
            (c[2], 2),
        ])

    def test_iterdeps(self):
        x = self.app.AsyncResult('1')
        c = [EagerResult(str(i), i, states.SUCCESS) for i in range(3)]
        x._cache = {'status': states.SUCCESS, 'result': None, 'children': c}
        for child in c:
            child.backend = Mock()
            child.backend.get_children.return_value = []
        it = x.iterdeps()
        self.assertListEqual(list(it), [
            (None, x),
            (x, c[0]),
            (x, c[1]),
            (x, c[2]),
        ])
        x._cache = None
        x.ready = Mock()
        x.ready.return_value = False
        with self.assertRaises(IncompleteStream):
            list(x.iterdeps())
        list(x.iterdeps(intermediate=True))

    def test_eq_not_implemented(self):
        self.assertFalse(self.app.AsyncResult('1') == object())

    @depends_on_current_app
    def test_reduce(self):
        a1 = self.app.AsyncResult('uuid', task_name=self.mytask.name)
        restored = pickle.loads(pickle.dumps(a1))
        self.assertEqual(restored.id, 'uuid')
        self.assertEqual(restored.task_name, self.mytask.name)

        a2 = self.app.AsyncResult('uuid')
        self.assertEqual(pickle.loads(pickle.dumps(a2)).id, 'uuid')

    def test_successful(self):
        ok_res = self.app.AsyncResult(self.task1['id'])
        nok_res = self.app.AsyncResult(self.task3['id'])
        nok_res2 = self.app.AsyncResult(self.task4['id'])

        self.assertTrue(ok_res.successful())
        self.assertFalse(nok_res.successful())
        self.assertFalse(nok_res2.successful())

        pending_res = self.app.AsyncResult(uuid())
        self.assertFalse(pending_res.successful())

    def test_str(self):
        ok_res = self.app.AsyncResult(self.task1['id'])
        ok2_res = self.app.AsyncResult(self.task2['id'])
        nok_res = self.app.AsyncResult(self.task3['id'])
        self.assertEqual(str(ok_res), self.task1['id'])
        self.assertEqual(str(ok2_res), self.task2['id'])
        self.assertEqual(str(nok_res), self.task3['id'])

        pending_id = uuid()
        pending_res = self.app.AsyncResult(pending_id)
        self.assertEqual(str(pending_res), pending_id)

    def test_repr(self):
        ok_res = self.app.AsyncResult(self.task1['id'])
        ok2_res = self.app.AsyncResult(self.task2['id'])
        nok_res = self.app.AsyncResult(self.task3['id'])
        self.assertEqual(repr(ok_res), '<AsyncResult: %s>' % (
            self.task1['id']))
        self.assertEqual(repr(ok2_res), '<AsyncResult: %s>' % (
            self.task2['id']))
        self.assertEqual(repr(nok_res), '<AsyncResult: %s>' % (
            self.task3['id']))

        pending_id = uuid()
        pending_res = self.app.AsyncResult(pending_id)
        self.assertEqual(repr(pending_res), '<AsyncResult: %s>' % (
            pending_id))

    def test_hash(self):
        self.assertEqual(hash(self.app.AsyncResult('x0w991')),
                         hash(self.app.AsyncResult('x0w991')))
        self.assertNotEqual(hash(self.app.AsyncResult('x0w991')),
                            hash(self.app.AsyncResult('x1w991')))

    def test_get_traceback(self):
        ok_res = self.app.AsyncResult(self.task1['id'])
        nok_res = self.app.AsyncResult(self.task3['id'])
        nok_res2 = self.app.AsyncResult(self.task4['id'])
        self.assertFalse(ok_res.traceback)
        self.assertTrue(nok_res.traceback)
        self.assertTrue(nok_res2.traceback)

        pending_res = self.app.AsyncResult(uuid())
        self.assertFalse(pending_res.traceback)

    def test_get(self):
        ok_res = self.app.AsyncResult(self.task1['id'])
        ok2_res = self.app.AsyncResult(self.task2['id'])
        nok_res = self.app.AsyncResult(self.task3['id'])
        nok2_res = self.app.AsyncResult(self.task4['id'])

        self.assertEqual(ok_res.get(), 'the')
        self.assertEqual(ok2_res.get(), 'quick')
        with self.assertRaises(KeyError):
            nok_res.get()
        self.assertTrue(nok_res.get(propagate=False))
        self.assertIsInstance(nok2_res.result, KeyError)
        self.assertEqual(ok_res.info, 'the')

    def test_get_timeout(self):
        res = self.app.AsyncResult(self.task4['id'])  # has RETRY state
        with self.assertRaises(TimeoutError):
            res.get(timeout=0.001)

        pending_res = self.app.AsyncResult(uuid())
        with patch('celery.result.time') as _time:
            with self.assertRaises(TimeoutError):
                pending_res.get(timeout=0.001, interval=0.001)
                _time.sleep.assert_called_with(0.001)

    def test_get_timeout_longer(self):
        res = self.app.AsyncResult(self.task4['id'])  # has RETRY state
        with patch('celery.result.time') as _time:
            with self.assertRaises(TimeoutError):
                res.get(timeout=1, interval=1)
                _time.sleep.assert_called_with(1)

    def test_ready(self):
        oks = (self.app.AsyncResult(self.task1['id']),
               self.app.AsyncResult(self.task2['id']),
               self.app.AsyncResult(self.task3['id']))
        self.assertTrue(all(result.ready() for result in oks))
        self.assertFalse(self.app.AsyncResult(self.task4['id']).ready())

        self.assertFalse(self.app.AsyncResult(uuid()).ready())


class test_ResultSet(AppCase):

    def test_resultset_repr(self):
        self.assertTrue(repr(self.app.ResultSet(
            [self.app.AsyncResult(t) for t in ['1', '2', '3']])))

    def test_eq_other(self):
        self.assertFalse(self.app.ResultSet([1, 3, 3]) == 1)
        self.assertTrue(self.app.ResultSet([1]) == self.app.ResultSet([1]))

    def test_get(self):
        x = self.app.ResultSet([self.app.AsyncResult(t) for t in [1, 2, 3]])
        b = x.results[0].backend = Mock()
        b.supports_native_join = False
        x.join_native = Mock()
        x.join = Mock()
        x.get()
        self.assertTrue(x.join.called)
        b.supports_native_join = True
        x.get()
        self.assertTrue(x.join_native.called)

    def test_get_empty(self):
        x = self.app.ResultSet([])
        self.assertIsNone(x.supports_native_join)
        x.join = Mock(name='join')
        x.get()
        self.assertTrue(x.join.called)

    def test_add(self):
        x = self.app.ResultSet([1])
        x.add(2)
        self.assertEqual(len(x), 2)
        x.add(2)
        self.assertEqual(len(x), 2)

    @contextmanager
    def dummy_copy(self):
        with patch('celery.result.copy') as copy:

            def passt(arg):
                return arg
            copy.side_effect = passt

            yield

    def test_iterate_respects_subpolling_interval(self):
        r1 = self.app.AsyncResult(uuid())
        r2 = self.app.AsyncResult(uuid())
        backend = r1.backend = r2.backend = Mock()
        backend.subpolling_interval = 10

        ready = r1.ready = r2.ready = Mock()

        def se(*args, **kwargs):
            ready.side_effect = KeyError()
            return False
        ready.return_value = False
        ready.side_effect = se

        x = self.app.ResultSet([r1, r2])
        with self.dummy_copy():
            with patch('celery.result.time') as _time:
                with self.assertPendingDeprecation():
                    with self.assertRaises(KeyError):
                        list(x.iterate())
                _time.sleep.assert_called_with(10)

            backend.subpolling_interval = 0
            with patch('celery.result.time') as _time:
                with self.assertPendingDeprecation():
                    with self.assertRaises(KeyError):
                        ready.return_value = False
                        ready.side_effect = se
                        list(x.iterate())
                    self.assertFalse(_time.sleep.called)

    def test_times_out(self):
        r1 = self.app.AsyncResult(uuid)
        r1.ready = Mock()
        r1.ready.return_value = False
        x = self.app.ResultSet([r1])
        with self.dummy_copy():
            with patch('celery.result.time'):
                with self.assertPendingDeprecation():
                    with self.assertRaises(TimeoutError):
                        list(x.iterate(timeout=1))

    def test_add_discard(self):
        x = self.app.ResultSet([])
        x.add(self.app.AsyncResult('1'))
        self.assertIn(self.app.AsyncResult('1'), x.results)
        x.discard(self.app.AsyncResult('1'))
        x.discard(self.app.AsyncResult('1'))
        x.discard('1')
        self.assertNotIn(self.app.AsyncResult('1'), x.results)

        x.update([self.app.AsyncResult('2')])

    def test_clear(self):
        x = self.app.ResultSet([])
        r = x.results
        x.clear()
        self.assertIs(x.results, r)


class MockAsyncResultFailure(AsyncResult):

    @property
    def result(self):
        return KeyError('baz')

    @property
    def state(self):
        return states.FAILURE

    def get(self, propagate=True, **kwargs):
        if propagate:
            raise self.result
        return self.result


class MockAsyncResultSuccess(AsyncResult):
    forgotten = False

    def forget(self):
        self.forgotten = True

    @property
    def result(self):
        return 42

    @property
    def state(self):
        return states.SUCCESS

    def get(self, **kwargs):
        return self.result


class SimpleBackend(object):
        ids = []

        def __init__(self, ids=[]):
            self.ids = ids

        def get_many(self, *args, **kwargs):
            return ((id, {'result': i, 'status': states.SUCCESS})
                    for i, id in enumerate(self.ids))


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


class test_GroupResult(AppCase):

    def setup(self):
        self.size = 10
        self.ts = self.app.GroupResult(
            uuid(), make_mock_group(self.app, self.size),
        )

    @depends_on_current_app
    def test_is_pickleable(self):
        ts = self.app.GroupResult(uuid(), [self.app.AsyncResult(uuid())])
        self.assertEqual(pickle.loads(pickle.dumps(ts)), ts)
        ts2 = self.app.GroupResult(uuid(), [self.app.AsyncResult(uuid())])
        self.assertEqual(pickle.loads(pickle.dumps(ts2)), ts2)

    def test_len(self):
        self.assertEqual(len(self.ts), self.size)

    def test_eq_other(self):
        self.assertFalse(self.ts == 1)

    @depends_on_current_app
    def test_reduce(self):
        self.assertTrue(pickle.loads(pickle.dumps(self.ts)))

    def test_iterate_raises(self):
        ar = MockAsyncResultFailure(uuid(), app=self.app)
        ts = self.app.GroupResult(uuid(), [ar])
        with self.assertPendingDeprecation():
            it = ts.iterate()
        with self.assertRaises(KeyError):
            next(it)

    def test_forget(self):
        subs = [MockAsyncResultSuccess(uuid(), app=self.app),
                MockAsyncResultSuccess(uuid(), app=self.app)]
        ts = self.app.GroupResult(uuid(), subs)
        ts.forget()
        for sub in subs:
            self.assertTrue(sub.forgotten)

    def test_getitem(self):
        subs = [MockAsyncResultSuccess(uuid(), app=self.app),
                MockAsyncResultSuccess(uuid(), app=self.app)]
        ts = self.app.GroupResult(uuid(), subs)
        self.assertIs(ts[0], subs[0])

    def test_save_restore(self):
        subs = [MockAsyncResultSuccess(uuid(), app=self.app),
                MockAsyncResultSuccess(uuid(), app=self.app)]
        ts = self.app.GroupResult(uuid(), subs)
        ts.save()
        with self.assertRaises(AttributeError):
            ts.save(backend=object())
        self.assertEqual(self.app.GroupResult.restore(ts.id).subtasks,
                         ts.subtasks)
        ts.delete()
        self.assertIsNone(self.app.GroupResult.restore(ts.id))
        with self.assertRaises(AttributeError):
            self.app.GroupResult.restore(ts.id, backend=object())

    def test_join_native(self):
        backend = SimpleBackend()
        subtasks = [self.app.AsyncResult(uuid(), backend=backend)
                    for i in range(10)]
        ts = self.app.GroupResult(uuid(), subtasks)
        ts.app.backend = backend
        backend.ids = [subtask.id for subtask in subtasks]
        res = ts.join_native()
        self.assertEqual(res, list(range(10)))

    def test_join_native_raises(self):
        ts = self.app.GroupResult(uuid(), [self.app.AsyncResult(uuid())])
        ts.iter_native = Mock()
        ts.iter_native.return_value = iter([
            (uuid(), {'status': states.FAILURE, 'result': KeyError()})
        ])
        with self.assertRaises(KeyError):
            ts.join_native(propagate=True)

    def test_failed_join_report(self):
        res = Mock()
        ts = self.app.GroupResult(uuid(), [res])
        res.state = states.FAILURE
        res.backend.is_cached.return_value = True
        self.assertIs(next(ts._failed_join_report()), res)
        res.backend.is_cached.return_value = False
        with self.assertRaises(StopIteration):
            next(ts._failed_join_report())

    def test_repr(self):
        self.assertTrue(repr(
            self.app.GroupResult(uuid(), [self.app.AsyncResult(uuid())])
        ))

    def test_children_is_results(self):
        ts = self.app.GroupResult(uuid(), [self.app.AsyncResult(uuid())])
        self.assertIs(ts.children, ts.results)

    def test_iter_native(self):
        backend = SimpleBackend()
        subtasks = [self.app.AsyncResult(uuid(), backend=backend)
                    for i in range(10)]
        ts = self.app.GroupResult(uuid(), subtasks)
        ts.app.backend = backend
        backend.ids = [subtask.id for subtask in subtasks]
        self.assertEqual(len(list(ts.iter_native())), 10)

    def test_iterate_yields(self):
        ar = MockAsyncResultSuccess(uuid(), app=self.app)
        ar2 = MockAsyncResultSuccess(uuid(), app=self.app)
        ts = self.app.GroupResult(uuid(), [ar, ar2])
        with self.assertPendingDeprecation():
            it = ts.iterate()
        self.assertEqual(next(it), 42)
        self.assertEqual(next(it), 42)

    def test_iterate_eager(self):
        ar1 = EagerResult(uuid(), 42, states.SUCCESS)
        ar2 = EagerResult(uuid(), 42, states.SUCCESS)
        ts = self.app.GroupResult(uuid(), [ar1, ar2])
        with self.assertPendingDeprecation():
            it = ts.iterate()
        self.assertEqual(next(it), 42)
        self.assertEqual(next(it), 42)

    def test_join_timeout(self):
        ar = MockAsyncResultSuccess(uuid(), app=self.app)
        ar2 = MockAsyncResultSuccess(uuid(), app=self.app)
        ar3 = self.app.AsyncResult(uuid())
        ts = self.app.GroupResult(uuid(), [ar, ar2, ar3])
        with self.assertRaises(TimeoutError):
            ts.join(timeout=0.0000001)

        ar4 = self.app.AsyncResult(uuid())
        ar4.get = Mock()
        ts2 = self.app.GroupResult(uuid(), [ar4])
        self.assertTrue(ts2.join(timeout=0.1))

    def test_iter_native_when_empty_group(self):
        ts = self.app.GroupResult(uuid(), [])
        self.assertListEqual(list(ts.iter_native()), [])

    def test_iterate_simple(self):
        with self.assertPendingDeprecation():
            it = self.ts.iterate()
        results = sorted(list(it))
        self.assertListEqual(results, list(range(self.size)))

    def test___iter__(self):
        self.assertListEqual(list(iter(self.ts)), self.ts.results)

    def test_join(self):
        joined = self.ts.join()
        self.assertListEqual(joined, list(range(self.size)))

    def test_successful(self):
        self.assertTrue(self.ts.successful())

    def test_failed(self):
        self.assertFalse(self.ts.failed())

    def test_waiting(self):
        self.assertFalse(self.ts.waiting())

    def test_ready(self):
        self.assertTrue(self.ts.ready())

    def test_completed_count(self):
        self.assertEqual(self.ts.completed_count(), len(self.ts))


class test_pending_AsyncResult(AppCase):

    def setup(self):
        self.task = self.app.AsyncResult(uuid())

    def test_result(self):
        self.assertIsNone(self.task.result)


class test_failed_AsyncResult(test_GroupResult):

    def setup(self):
        self.size = 11
        subtasks = make_mock_group(self.app, 10)
        failed = mock_task('ts11', states.FAILURE, KeyError('Baz'))
        save_result(self.app, failed)
        failed_res = self.app.AsyncResult(failed['id'])
        self.ts = self.app.GroupResult(uuid(), subtasks + [failed_res])

    def test_completed_count(self):
        self.assertEqual(self.ts.completed_count(), len(self.ts) - 1)

    def test_iterate_simple(self):
        with self.assertPendingDeprecation():
            it = self.ts.iterate()

        def consume():
            return list(it)

        with self.assertRaises(KeyError):
            consume()

    def test_join(self):
        with self.assertRaises(KeyError):
            self.ts.join()

    def test_successful(self):
        self.assertFalse(self.ts.successful())

    def test_failed(self):
        self.assertTrue(self.ts.failed())


class test_pending_Group(AppCase):

    def setup(self):
        self.ts = self.app.GroupResult(
            uuid(), [self.app.AsyncResult(uuid()),
                     self.app.AsyncResult(uuid())])

    def test_completed_count(self):
        self.assertEqual(self.ts.completed_count(), 0)

    def test_ready(self):
        self.assertFalse(self.ts.ready())

    def test_waiting(self):
        self.assertTrue(self.ts.waiting())

    def x_join(self):
        with self.assertRaises(TimeoutError):
            self.ts.join(timeout=0.001)

    def x_join_longer(self):
        with self.assertRaises(TimeoutError):
            self.ts.join(timeout=1)


class test_EagerResult(AppCase):

    def setup(self):

        @self.app.task(shared=False)
        def raising(x, y):
            raise KeyError(x, y)
        self.raising = raising

    def test_wait_raises(self):
        res = self.raising.apply(args=[3, 3])
        with self.assertRaises(KeyError):
            res.wait()
        self.assertTrue(res.wait(propagate=False))

    def test_wait(self):
        res = EagerResult('x', 'x', states.RETRY)
        res.wait()
        self.assertEqual(res.state, states.RETRY)
        self.assertEqual(res.status, states.RETRY)

    def test_forget(self):
        res = EagerResult('x', 'x', states.RETRY)
        res.forget()

    def test_revoke(self):
        res = self.raising.apply(args=[3, 3])
        self.assertFalse(res.revoke())


class test_tuples(AppCase):

    def test_AsyncResult(self):
        x = self.app.AsyncResult(uuid())
        self.assertEqual(x, result_from_tuple(x.as_tuple(), self.app))
        self.assertEqual(x, result_from_tuple(x, self.app))

    def test_with_parent(self):
        x = self.app.AsyncResult(uuid())
        x.parent = self.app.AsyncResult(uuid())
        y = result_from_tuple(x.as_tuple(), self.app)
        self.assertEqual(y, x)
        self.assertEqual(y.parent, x.parent)
        self.assertIsInstance(y.parent, AsyncResult)

    def test_compat(self):
        uid = uuid()
        x = result_from_tuple([uid, []], app=self.app)
        self.assertEqual(x.id, uid)

    def test_GroupResult(self):
        x = self.app.GroupResult(
            uuid(), [self.app.AsyncResult(uuid()) for _ in range(10)],
        )
        self.assertEqual(x, result_from_tuple(x.as_tuple(), self.app))
        self.assertEqual(x, result_from_tuple(x, self.app))
