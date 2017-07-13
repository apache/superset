from __future__ import absolute_import

from celery.utils.threads import (
    _LocalStack,
    _FastLocalStack,
    LocalManager,
    Local,
    bgThread,
)

from celery.tests.case import Case, override_stdouts, patch


class test_bgThread(Case):

    def test_crash(self):

        class T(bgThread):

            def body(self):
                raise KeyError()

        with patch('os._exit') as _exit:
            with override_stdouts():
                _exit.side_effect = ValueError()
                t = T()
                with self.assertRaises(ValueError):
                    t.run()
                _exit.assert_called_with(1)

    def test_interface(self):
        x = bgThread()
        with self.assertRaises(NotImplementedError):
            x.body()


class test_Local(Case):

    def test_iter(self):
        x = Local()
        x.foo = 'bar'
        ident = x.__ident_func__()
        self.assertIn((ident, {'foo': 'bar'}), list(iter(x)))

        delattr(x, 'foo')
        self.assertNotIn((ident, {'foo': 'bar'}), list(iter(x)))
        with self.assertRaises(AttributeError):
            delattr(x, 'foo')

        self.assertIsNotNone(x(lambda: 'foo'))


class test_LocalStack(Case):

    def test_stack(self):
        x = _LocalStack()
        self.assertIsNone(x.pop())
        x.__release_local__()
        ident = x.__ident_func__
        x.__ident_func__ = ident

        with self.assertRaises(RuntimeError):
            x()[0]

        x.push(['foo'])
        self.assertEqual(x()[0], 'foo')
        x.pop()
        with self.assertRaises(RuntimeError):
            x()[0]


class test_FastLocalStack(Case):

    def test_stack(self):
        x = _FastLocalStack()
        x.push(['foo'])
        x.push(['bar'])
        self.assertEqual(x.top, ['bar'])
        self.assertEqual(len(x), 2)
        x.pop()
        self.assertEqual(x.top, ['foo'])
        x.pop()
        self.assertIsNone(x.top)


class test_LocalManager(Case):

    def test_init(self):
        x = LocalManager()
        self.assertListEqual(x.locals, [])
        self.assertTrue(x.ident_func)

        def ident():
            return 1

        loc = Local()
        x = LocalManager([loc], ident_func=ident)
        self.assertListEqual(x.locals, [loc])
        x = LocalManager(loc, ident_func=ident)
        self.assertListEqual(x.locals, [loc])
        self.assertIs(x.ident_func, ident)
        self.assertIs(x.locals[0].__ident_func__, ident)
        self.assertEqual(x.get_ident(), 1)

        with patch('celery.utils.threads.release_local') as release:
            x.cleanup()
            release.assert_called_with(loc)

        self.assertTrue(repr(x))
