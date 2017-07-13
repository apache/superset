from __future__ import absolute_import

from celery.canvas import (
    Signature,
    chain,
    group,
    chord,
    signature,
    xmap,
    xstarmap,
    chunks,
    _maybe_group,
    maybe_signature,
)
from celery.result import EagerResult

from celery.tests.case import AppCase, Mock

SIG = Signature({'task': 'TASK',
                 'args': ('A1', ),
                 'kwargs': {'K1': 'V1'},
                 'options': {'task_id': 'TASK_ID'},
                 'subtask_type': ''})


class CanvasCase(AppCase):

    def setup(self):

        @self.app.task(shared=False)
        def add(x, y):
            return x + y
        self.add = add

        @self.app.task(shared=False)
        def mul(x, y):
            return x * y
        self.mul = mul

        @self.app.task(shared=False)
        def div(x, y):
            return x / y
        self.div = div


class test_Signature(CanvasCase):

    def test_getitem_property_class(self):
        self.assertTrue(Signature.task)
        self.assertTrue(Signature.args)
        self.assertTrue(Signature.kwargs)
        self.assertTrue(Signature.options)
        self.assertTrue(Signature.subtask_type)

    def test_getitem_property(self):
        self.assertEqual(SIG.task, 'TASK')
        self.assertEqual(SIG.args, ('A1', ))
        self.assertEqual(SIG.kwargs, {'K1': 'V1'})
        self.assertEqual(SIG.options, {'task_id': 'TASK_ID'})
        self.assertEqual(SIG.subtask_type, '')

    def test_link_on_scalar(self):
        x = Signature('TASK', link=Signature('B'))
        self.assertTrue(x.options['link'])
        x.link(Signature('C'))
        self.assertIsInstance(x.options['link'], list)
        self.assertIn(Signature('B'), x.options['link'])
        self.assertIn(Signature('C'), x.options['link'])

    def test_replace(self):
        x = Signature('TASK', ('A'), {})
        self.assertTupleEqual(x.replace(args=('B', )).args, ('B', ))
        self.assertDictEqual(
            x.replace(kwargs={'FOO': 'BAR'}).kwargs,
            {'FOO': 'BAR'},
        )
        self.assertDictEqual(
            x.replace(options={'task_id': '123'}).options,
            {'task_id': '123'},
        )

    def test_set(self):
        self.assertDictEqual(
            Signature('TASK', x=1).set(task_id='2').options,
            {'x': 1, 'task_id': '2'},
        )

    def test_link(self):
        x = signature(SIG)
        x.link(SIG)
        x.link(SIG)
        self.assertIn(SIG, x.options['link'])
        self.assertEqual(len(x.options['link']), 1)

    def test_link_error(self):
        x = signature(SIG)
        x.link_error(SIG)
        x.link_error(SIG)
        self.assertIn(SIG, x.options['link_error'])
        self.assertEqual(len(x.options['link_error']), 1)

    def test_flatten_links(self):
        tasks = [self.add.s(2, 2), self.mul.s(4), self.div.s(2)]
        tasks[0].link(tasks[1])
        tasks[1].link(tasks[2])
        self.assertEqual(tasks[0].flatten_links(), tasks)

    def test_OR(self):
        x = self.add.s(2, 2) | self.mul.s(4)
        self.assertIsInstance(x, chain)
        y = self.add.s(4, 4) | self.div.s(2)
        z = x | y
        self.assertIsInstance(y, chain)
        self.assertIsInstance(z, chain)
        self.assertEqual(len(z.tasks), 4)
        with self.assertRaises(TypeError):
            x | 10
        ax = self.add.s(2, 2) | (self.add.s(4) | self.add.s(8))
        self.assertIsInstance(ax, chain)
        self.assertEqual(len(ax.tasks), 3, 'consolidates chain to chain')

    def test_INVERT(self):
        x = self.add.s(2, 2)
        x.apply_async = Mock()
        x.apply_async.return_value = Mock()
        x.apply_async.return_value.get = Mock()
        x.apply_async.return_value.get.return_value = 4
        self.assertEqual(~x, 4)
        self.assertTrue(x.apply_async.called)

    def test_merge_immutable(self):
        x = self.add.si(2, 2, foo=1)
        args, kwargs, options = x._merge((4, ), {'bar': 2}, {'task_id': 3})
        self.assertTupleEqual(args, (2, 2))
        self.assertDictEqual(kwargs, {'foo': 1})
        self.assertDictEqual(options, {'task_id': 3})

    def test_set_immutable(self):
        x = self.add.s(2, 2)
        self.assertFalse(x.immutable)
        x.set(immutable=True)
        self.assertTrue(x.immutable)
        x.set(immutable=False)
        self.assertFalse(x.immutable)

    def test_election(self):
        x = self.add.s(2, 2)
        x.freeze('foo')
        x.type.app.control = Mock()
        r = x.election()
        self.assertTrue(x.type.app.control.election.called)
        self.assertEqual(r.id, 'foo')

    def test_AsyncResult_when_not_registered(self):
        s = signature('xxx.not.registered', app=self.app)
        self.assertTrue(s.AsyncResult)

    def test_apply_async_when_not_registered(self):
        s = signature('xxx.not.registered', app=self.app)
        self.assertTrue(s._apply_async)


class test_xmap_xstarmap(CanvasCase):

    def test_apply(self):
        for type, attr in [(xmap, 'map'), (xstarmap, 'starmap')]:
            args = [(i, i) for i in range(10)]
            s = getattr(self.add, attr)(args)
            s.type = Mock()

            s.apply_async(foo=1)
            s.type.apply_async.assert_called_with(
                (), {'task': self.add.s(), 'it': args}, foo=1,
            )

            self.assertEqual(type.from_dict(dict(s)), s)
            self.assertTrue(repr(s))


class test_chunks(CanvasCase):

    def test_chunks(self):
        x = self.add.chunks(range(100), 10)
        self.assertEqual(
            dict(chunks.from_dict(dict(x), app=self.app)), dict(x),
        )

        self.assertTrue(x.group())
        self.assertEqual(len(x.group().tasks), 10)

        x.group = Mock()
        gr = x.group.return_value = Mock()

        x.apply_async()
        gr.apply_async.assert_called_with((), {})

        x()
        gr.assert_called_with()

        self.app.conf.CELERY_ALWAYS_EAGER = True
        chunks.apply_chunks(app=self.app, **x['kwargs'])


class test_chain(CanvasCase):

    def test_repr(self):
        x = self.add.s(2, 2) | self.add.s(2)
        self.assertEqual(
            repr(x), '%s(2, 2) | %s(2)' % (self.add.name, self.add.name),
        )

    def test_reverse(self):
        x = self.add.s(2, 2) | self.add.s(2)
        self.assertIsInstance(signature(x), chain)
        self.assertIsInstance(signature(dict(x)), chain)

    def test_always_eager(self):
        self.app.conf.CELERY_ALWAYS_EAGER = True
        self.assertEqual(~(self.add.s(4, 4) | self.add.s(8)), 16)

    def test_apply(self):
        x = chain(self.add.s(4, 4), self.add.s(8), self.add.s(10))
        res = x.apply()
        self.assertIsInstance(res, EagerResult)
        self.assertEqual(res.get(), 26)

        self.assertEqual(res.parent.get(), 16)
        self.assertEqual(res.parent.parent.get(), 8)
        self.assertIsNone(res.parent.parent.parent)

    def test_empty_chain_returns_none(self):
        self.assertIsNone(chain(app=self.app)())
        self.assertIsNone(chain(app=self.app).apply_async())

    def test_call_no_tasks(self):
        x = chain()
        self.assertFalse(x())

    def test_call_with_tasks(self):
        x = self.add.s(2, 2) | self.add.s(4)
        x.apply_async = Mock()
        x(2, 2, foo=1)
        x.apply_async.assert_called_with((2, 2), {'foo': 1})

    def test_from_dict_no_args__with_args(self):
        x = dict(self.add.s(2, 2) | self.add.s(4))
        x['args'] = None
        self.assertIsInstance(chain.from_dict(x), chain)
        x['args'] = (2, )
        self.assertIsInstance(chain.from_dict(x), chain)

    def test_accepts_generator_argument(self):
        x = chain(self.add.s(i) for i in range(10))
        self.assertTrue(x.tasks[0].type, self.add)
        self.assertTrue(x.type)


class test_group(CanvasCase):

    def test_repr(self):
        x = group([self.add.s(2, 2), self.add.s(4, 4)])
        self.assertEqual(repr(x), repr(x.tasks))

    def test_reverse(self):
        x = group([self.add.s(2, 2), self.add.s(4, 4)])
        self.assertIsInstance(signature(x), group)
        self.assertIsInstance(signature(dict(x)), group)

    def test_maybe_group_sig(self):
        self.assertListEqual(
            _maybe_group(self.add.s(2, 2)), [self.add.s(2, 2)],
        )

    def test_from_dict(self):
        x = group([self.add.s(2, 2), self.add.s(4, 4)])
        x['args'] = (2, 2)
        self.assertTrue(group.from_dict(dict(x)))
        x['args'] = None
        self.assertTrue(group.from_dict(dict(x)))

    def test_call_empty_group(self):
        x = group(app=self.app)
        self.assertFalse(len(x()))
        x.delay()
        x.apply_async()
        x()

    def test_skew(self):
        g = group([self.add.s(i, i) for i in range(10)])
        g.skew(start=1, stop=10, step=1)
        for i, task in enumerate(g.tasks):
            self.assertEqual(task.options['countdown'], i + 1)

    def test_iter(self):
        g = group([self.add.s(i, i) for i in range(10)])
        self.assertListEqual(list(iter(g)), g.tasks)


class test_chord(CanvasCase):

    def test_reverse(self):
        x = chord([self.add.s(2, 2), self.add.s(4, 4)], body=self.mul.s(4))
        self.assertIsInstance(signature(x), chord)
        self.assertIsInstance(signature(dict(x)), chord)

    def test_clone_clones_body(self):
        x = chord([self.add.s(2, 2), self.add.s(4, 4)], body=self.mul.s(4))
        y = x.clone()
        self.assertIsNot(x.kwargs['body'], y.kwargs['body'])
        y.kwargs.pop('body')
        z = y.clone()
        self.assertIsNone(z.kwargs.get('body'))

    def test_links_to_body(self):
        x = chord([self.add.s(2, 2), self.add.s(4, 4)], body=self.mul.s(4))
        x.link(self.div.s(2))
        self.assertFalse(x.options.get('link'))
        self.assertTrue(x.kwargs['body'].options['link'])

        x.link_error(self.div.s(2))
        self.assertFalse(x.options.get('link_error'))
        self.assertTrue(x.kwargs['body'].options['link_error'])

        self.assertTrue(x.tasks)
        self.assertTrue(x.body)

    def test_repr(self):
        x = chord([self.add.s(2, 2), self.add.s(4, 4)], body=self.mul.s(4))
        self.assertTrue(repr(x))
        x.kwargs['body'] = None
        self.assertIn('without body', repr(x))


class test_maybe_signature(CanvasCase):

    def test_is_None(self):
        self.assertIsNone(maybe_signature(None, app=self.app))

    def test_is_dict(self):
        self.assertIsInstance(
            maybe_signature(dict(self.add.s()), app=self.app), Signature,
        )

    def test_when_sig(self):
        s = self.add.s()
        self.assertIs(maybe_signature(s, app=self.app), s)
