from __future__ import absolute_import

from celery import bootsteps

from celery.tests.case import AppCase, Mock, patch


class test_StepFormatter(AppCase):

    def test_get_prefix(self):
        f = bootsteps.StepFormatter()
        s = Mock()
        s.last = True
        self.assertEqual(f._get_prefix(s), f.blueprint_prefix)

        s2 = Mock()
        s2.last = False
        s2.conditional = True
        self.assertEqual(f._get_prefix(s2), f.conditional_prefix)

        s3 = Mock()
        s3.last = s3.conditional = False
        self.assertEqual(f._get_prefix(s3), '')

    def test_node(self):
        f = bootsteps.StepFormatter()
        f.draw_node = Mock()
        step = Mock()
        step.last = False
        f.node(step, x=3)
        f.draw_node.assert_called_with(step, f.node_scheme, {'x': 3})

        step.last = True
        f.node(step, x=3)
        f.draw_node.assert_called_with(step, f.blueprint_scheme, {'x': 3})

    def test_edge(self):
        f = bootsteps.StepFormatter()
        f.draw_edge = Mock()
        a, b = Mock(), Mock()
        a.last = True
        f.edge(a, b, x=6)
        f.draw_edge.assert_called_with(a, b, f.edge_scheme, {
            'x': 6, 'arrowhead': 'none', 'color': 'darkseagreen3',
        })

        a.last = False
        f.edge(a, b, x=6)
        f.draw_edge.assert_called_with(a, b, f.edge_scheme, {
            'x': 6,
        })


class test_Step(AppCase):

    class Def(bootsteps.StartStopStep):
        name = 'test_Step.Def'

    def setup(self):
        self.steps = []

    def test_blueprint_name(self, bp='test_blueprint_name'):

        class X(bootsteps.Step):
            blueprint = bp
            name = 'X'
        self.assertEqual(X.name, 'X')

        class Y(bootsteps.Step):
            name = '%s.Y' % bp
        self.assertEqual(Y.name, '%s.Y' % bp)

    def test_init(self):
        self.assertTrue(self.Def(self))

    def test_create(self):
        self.Def(self).create(self)

    def test_include_if(self):
        x = self.Def(self)
        x.enabled = True
        self.assertTrue(x.include_if(self))

        x.enabled = False
        self.assertFalse(x.include_if(self))

    def test_instantiate(self):
        self.assertIsInstance(self.Def(self).instantiate(self.Def, self),
                              self.Def)

    def test_include_when_enabled(self):
        x = self.Def(self)
        x.create = Mock()
        x.create.return_value = 'George'
        self.assertTrue(x.include(self))

        self.assertEqual(x.obj, 'George')
        x.create.assert_called_with(self)

    def test_include_when_disabled(self):
        x = self.Def(self)
        x.enabled = False
        x.create = Mock()

        self.assertFalse(x.include(self))
        self.assertFalse(x.create.call_count)

    def test_repr(self):
        x = self.Def(self)
        self.assertTrue(repr(x))


class test_ConsumerStep(AppCase):

    def test_interface(self):
        step = bootsteps.ConsumerStep(self)
        with self.assertRaises(NotImplementedError):
            step.get_consumers(self)

    def test_start_stop_shutdown(self):
        consumer = Mock()
        self.connection = Mock()

        class Step(bootsteps.ConsumerStep):

            def get_consumers(self, c):
                return [consumer]

        step = Step(self)
        self.assertEqual(step.get_consumers(self), [consumer])

        step.start(self)
        consumer.consume.assert_called_with()
        step.stop(self)
        consumer.cancel.assert_called_with()

        step.shutdown(self)
        consumer.channel.close.assert_called_with()

    def test_start_no_consumers(self):
        self.connection = Mock()

        class Step(bootsteps.ConsumerStep):

            def get_consumers(self, c):
                return ()

        step = Step(self)
        step.start(self)


class test_StartStopStep(AppCase):

    class Def(bootsteps.StartStopStep):
        name = 'test_StartStopStep.Def'

    def setup(self):
        self.steps = []

    def test_start__stop(self):
        x = self.Def(self)
        x.create = Mock()

        # include creates the underlying object and sets
        # its x.obj attribute to it, as well as appending
        # it to the parent.steps list.
        x.include(self)
        self.assertTrue(self.steps)
        self.assertIs(self.steps[0], x)

        x.start(self)
        x.obj.start.assert_called_with()

        x.stop(self)
        x.obj.stop.assert_called_with()

        x.obj = None
        self.assertIsNone(x.start(self))

    def test_include_when_disabled(self):
        x = self.Def(self)
        x.enabled = False
        x.include(self)
        self.assertFalse(self.steps)

    def test_terminate(self):
        x = self.Def(self)
        x.create = Mock()

        x.include(self)
        delattr(x.obj, 'terminate')
        x.terminate(self)
        x.obj.stop.assert_called_with()


class test_Blueprint(AppCase):

    class Blueprint(bootsteps.Blueprint):
        name = 'test_Blueprint'

    def test_steps_added_to_unclaimed(self):

        class tnA(bootsteps.Step):
            name = 'test_Blueprint.A'

        class tnB(bootsteps.Step):
            name = 'test_Blueprint.B'

        class xxA(bootsteps.Step):
            name = 'xx.A'

        class Blueprint(self.Blueprint):
            default_steps = [tnA, tnB]
        blueprint = Blueprint(app=self.app)

        self.assertIn(tnA, blueprint._all_steps())
        self.assertIn(tnB, blueprint._all_steps())
        self.assertNotIn(xxA, blueprint._all_steps())

    def test_init(self):
        blueprint = self.Blueprint(app=self.app)
        self.assertIs(blueprint.app, self.app)
        self.assertEqual(blueprint.name, 'test_Blueprint')

    def test_close__on_close_is_None(self):
        blueprint = self.Blueprint(app=self.app)
        blueprint.on_close = None
        blueprint.send_all = Mock()
        blueprint.close(1)
        blueprint.send_all.assert_called_with(
            1, 'close', 'closing', reverse=False,
        )

    def test_send_all_with_None_steps(self):
        parent = Mock()
        blueprint = self.Blueprint(app=self.app)
        parent.steps = [None, None, None]
        blueprint.send_all(parent, 'close', 'Closing', reverse=False)

    def test_join_raises_IGNORE_ERRORS(self):
        prev, bootsteps.IGNORE_ERRORS = bootsteps.IGNORE_ERRORS, (KeyError, )
        try:
            blueprint = self.Blueprint(app=self.app)
            blueprint.shutdown_complete = Mock()
            blueprint.shutdown_complete.wait.side_effect = KeyError('luke')
            blueprint.join(timeout=10)
            blueprint.shutdown_complete.wait.assert_called_with(timeout=10)
        finally:
            bootsteps.IGNORE_ERRORS = prev

    def test_connect_with(self):

        class b1s1(bootsteps.Step):
            pass

        class b1s2(bootsteps.Step):
            last = True

        class b2s1(bootsteps.Step):
            pass

        class b2s2(bootsteps.Step):
            last = True

        b1 = self.Blueprint([b1s1, b1s2], app=self.app)
        b2 = self.Blueprint([b2s1, b2s2], app=self.app)
        b1.apply(Mock())
        b2.apply(Mock())
        b1.connect_with(b2)

        self.assertIn(b1s1, b1.graph)
        self.assertIn(b2s1, b1.graph)
        self.assertIn(b2s2, b1.graph)

        self.assertTrue(repr(b1s1))
        self.assertTrue(str(b1s1))

    def test_topsort_raises_KeyError(self):

        class Step(bootsteps.Step):
            requires = ('xyxxx.fsdasewe.Unknown', )

        b = self.Blueprint([Step], app=self.app)
        b.steps = b.claim_steps()
        with self.assertRaises(ImportError):
            b._finalize_steps(b.steps)
        Step.requires = ()

        b.steps = b.claim_steps()
        b._finalize_steps(b.steps)

        with patch('celery.bootsteps.DependencyGraph') as Dep:
            g = Dep.return_value = Mock()
            g.topsort.side_effect = KeyError('foo')
            with self.assertRaises(KeyError):
                b._finalize_steps(b.steps)

    def test_apply(self):

        class MyBlueprint(bootsteps.Blueprint):
            name = 'test_apply'

            def modules(self):
                return ['A', 'B']

        class B(bootsteps.Step):
            name = 'test_apply.B'

        class C(bootsteps.Step):
            name = 'test_apply.C'
            requires = [B]

        class A(bootsteps.Step):
            name = 'test_apply.A'
            requires = [C]

        class D(bootsteps.Step):
            name = 'test_apply.D'
            last = True

        x = MyBlueprint([A, D], app=self.app)
        x.apply(self)

        self.assertIsInstance(x.order[0], B)
        self.assertIsInstance(x.order[1], C)
        self.assertIsInstance(x.order[2], A)
        self.assertIsInstance(x.order[3], D)
        self.assertIn(A, x.types)
        self.assertIs(x[A.name], x.order[2])

    def test_find_last_but_no_steps(self):

        class MyBlueprint(bootsteps.Blueprint):
            name = 'qwejwioqjewoqiej'

        x = MyBlueprint(app=self.app)
        x.apply(self)
        self.assertIsNone(x._find_last())
