from __future__ import absolute_import

from celery import group, chord
from celery.app import builtins
from celery.canvas import Signature
from celery.five import range
from celery._state import _task_stack
from celery.tests.case import AppCase, Mock, patch


class BuiltinsCase(AppCase):

    def setup(self):
        @self.app.task(shared=False)
        def xsum(x):
            return sum(x)
        self.xsum = xsum

        @self.app.task(shared=False)
        def add(x, y):
            return x + y
        self.add = add


class test_backend_cleanup(BuiltinsCase):

    def test_run(self):
        self.app.backend.cleanup = Mock()
        self.app.backend.cleanup.__name__ = 'cleanup'
        cleanup_task = builtins.add_backend_cleanup_task(self.app)
        cleanup_task()
        self.assertTrue(self.app.backend.cleanup.called)


class test_map(BuiltinsCase):

    def test_run(self):

        @self.app.task(shared=False)
        def map_mul(x):
            return x[0] * x[1]

        res = self.app.tasks['celery.map'](
            map_mul, [(2, 2), (4, 4), (8, 8)],
        )
        self.assertEqual(res, [4, 16, 64])


class test_starmap(BuiltinsCase):

    def test_run(self):

        @self.app.task(shared=False)
        def smap_mul(x, y):
            return x * y

        res = self.app.tasks['celery.starmap'](
            smap_mul, [(2, 2), (4, 4), (8, 8)],
        )
        self.assertEqual(res, [4, 16, 64])


class test_chunks(BuiltinsCase):

    @patch('celery.canvas.chunks.apply_chunks')
    def test_run(self, apply_chunks):

        @self.app.task(shared=False)
        def chunks_mul(l):
            return l

        self.app.tasks['celery.chunks'](
            chunks_mul, [(2, 2), (4, 4), (8, 8)], 1,
        )
        self.assertTrue(apply_chunks.called)


class test_group(BuiltinsCase):

    def setup(self):
        self.task = builtins.add_group_task(self.app)()
        super(test_group, self).setup()

    def test_apply_async_eager(self):
        self.task.apply = Mock()
        self.app.conf.CELERY_ALWAYS_EAGER = True
        self.task.apply_async()
        self.assertTrue(self.task.apply.called)

    def test_apply(self):
        x = group([self.add.s(4, 4), self.add.s(8, 8)])
        x.name = self.task.name
        res = x.apply()
        self.assertEqual(res.get(), [8, 16])

    def test_apply_async(self):
        x = group([self.add.s(4, 4), self.add.s(8, 8)])
        x.apply_async()

    def test_apply_empty(self):
        x = group(app=self.app)
        x.apply()
        res = x.apply_async()
        self.assertTrue(res)
        self.assertFalse(res.results)

    def test_apply_async_with_parent(self):
        _task_stack.push(self.add)
        try:
            self.add.push_request(called_directly=False)
            try:
                assert not self.add.request.children
                x = group([self.add.s(4, 4), self.add.s(8, 8)])
                res = x()
                self.assertTrue(self.add.request.children)
                self.assertIn(res, self.add.request.children)
                self.assertEqual(len(self.add.request.children), 1)
            finally:
                self.add.pop_request()
        finally:
            _task_stack.pop()


class test_chain(BuiltinsCase):

    def setup(self):
        BuiltinsCase.setup(self)
        self.task = builtins.add_chain_task(self.app)()

    def test_apply_async(self):
        c = self.add.s(2, 2) | self.add.s(4) | self.add.s(8)
        result = c.apply_async()
        self.assertTrue(result.parent)
        self.assertTrue(result.parent.parent)
        self.assertIsNone(result.parent.parent.parent)

    def test_group_to_chord(self):
        c = (
            group(self.add.s(i, i) for i in range(5)) |
            self.add.s(10) |
            self.add.s(20) |
            self.add.s(30)
        )
        tasks, _ = c.type.prepare_steps((), c.tasks)
        self.assertIsInstance(tasks[0], chord)
        self.assertTrue(tasks[0].body.options['link'])
        self.assertTrue(tasks[0].body.options['link'][0].options['link'])

        c2 = self.add.s(2, 2) | group(self.add.s(i, i) for i in range(10))
        tasks2, _ = c2.type.prepare_steps((), c2.tasks)
        self.assertIsInstance(tasks2[1], group)

    def test_apply_options(self):

        class static(Signature):

            def clone(self, *args, **kwargs):
                return self

        def s(*args, **kwargs):
            return static(self.add, args, kwargs, type=self.add)

        c = s(2, 2) | s(4, 4) | s(8, 8)
        r1 = c.apply_async(task_id='some_id')
        self.assertEqual(r1.id, 'some_id')

        c.apply_async(group_id='some_group_id')
        self.assertEqual(c.tasks[-1].options['group_id'], 'some_group_id')

        c.apply_async(chord='some_chord_id')
        self.assertEqual(c.tasks[-1].options['chord'], 'some_chord_id')

        c.apply_async(link=[s(32)])
        self.assertListEqual(c.tasks[-1].options['link'], [s(32)])

        c.apply_async(link_error=[s('error')])
        for task in c.tasks:
            self.assertListEqual(task.options['link_error'], [s('error')])


class test_chord(BuiltinsCase):

    def setup(self):
        self.task = builtins.add_chord_task(self.app)()
        super(test_chord, self).setup()

    def test_apply_async(self):
        x = chord([self.add.s(i, i) for i in range(10)], body=self.xsum.s())
        r = x.apply_async()
        self.assertTrue(r)
        self.assertTrue(r.parent)

    def test_run_header_not_group(self):
        self.task([self.add.s(i, i) for i in range(10)], self.xsum.s())

    def test_forward_options(self):
        body = self.xsum.s()
        x = chord([self.add.s(i, i) for i in range(10)], body=body)
        x._type = Mock()
        x._type.app.conf.CELERY_ALWAYS_EAGER = False
        x.apply_async(group_id='some_group_id')
        self.assertTrue(x._type.called)
        resbody = x._type.call_args[0][1]
        self.assertEqual(resbody.options['group_id'], 'some_group_id')
        x2 = chord([self.add.s(i, i) for i in range(10)], body=body)
        x2._type = Mock()
        x2._type.app.conf.CELERY_ALWAYS_EAGER = False
        x2.apply_async(chord='some_chord_id')
        self.assertTrue(x2._type.called)
        resbody = x2._type.call_args[0][1]
        self.assertEqual(resbody.options['chord'], 'some_chord_id')

    def test_apply_eager(self):
        self.app.conf.CELERY_ALWAYS_EAGER = True
        x = chord([self.add.s(i, i) for i in range(10)], body=self.xsum.s())
        r = x.apply_async()
        self.assertEqual(r.get(), 90)
