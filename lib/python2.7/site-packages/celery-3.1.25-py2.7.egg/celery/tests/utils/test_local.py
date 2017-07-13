from __future__ import absolute_import, unicode_literals

import sys

from celery.five import string, long_t
from celery.local import (
    Proxy,
    PromiseProxy,
    maybe_evaluate,
    try_import,
)
from celery.tests.case import Case, Mock

PY3 = sys.version_info[0] == 3


class test_try_import(Case):

    def test_imports(self):
        self.assertTrue(try_import(__name__))

    def test_when_default(self):
        default = object()
        self.assertIs(try_import('foobar.awqewqe.asdwqewq', default), default)


class test_Proxy(Case):

    def test_std_class_attributes(self):
        self.assertEqual(Proxy.__name__, 'Proxy')
        self.assertEqual(Proxy.__module__, 'celery.local')
        self.assertIsInstance(Proxy.__doc__, str)

    def test_name(self):

        def real():
            """real function"""
            return 'REAL'

        x = Proxy(lambda: real, name='xyz')
        self.assertEqual(x.__name__, 'xyz')

        y = Proxy(lambda: real)
        self.assertEqual(y.__name__, 'real')

        self.assertEqual(x.__doc__, 'real function')

        self.assertEqual(x.__class__, type(real))
        self.assertEqual(x.__dict__, real.__dict__)
        self.assertEqual(repr(x), repr(real))
        self.assertTrue(x.__module__)

    def test_get_current_local(self):
        x = Proxy(lambda: 10)
        object.__setattr__(x, '_Proxy_local', Mock())
        self.assertTrue(x._get_current_object())

    def test_bool(self):

        class X(object):

            def __bool__(self):
                return False
            __nonzero__ = __bool__

        x = Proxy(lambda: X())
        self.assertFalse(x)

    def test_slots(self):

        class X(object):
            __slots__ = ()

        x = Proxy(X)
        with self.assertRaises(AttributeError):
            x.__dict__

    def test_unicode(self):

        class X(object):

            def __unicode__(self):
                return 'UNICODE'
            __str__ = __unicode__

            def __repr__(self):
                return 'REPR'

        x = Proxy(lambda: X())
        self.assertEqual(string(x), 'UNICODE')
        del(X.__unicode__)
        del(X.__str__)
        self.assertEqual(string(x), 'REPR')

    def test_dir(self):

        class X(object):

            def __dir__(self):
                return ['a', 'b', 'c']

        x = Proxy(lambda: X())
        self.assertListEqual(dir(x), ['a', 'b', 'c'])

        class Y(object):

            def __dir__(self):
                raise RuntimeError()
        y = Proxy(lambda: Y())
        self.assertListEqual(dir(y), [])

    def test_getsetdel_attr(self):

        class X(object):
            a = 1
            b = 2
            c = 3

            def __dir__(self):
                return ['a', 'b', 'c']

        v = X()

        x = Proxy(lambda: v)
        self.assertListEqual(x.__members__, ['a', 'b', 'c'])
        self.assertEqual(x.a, 1)
        self.assertEqual(x.b, 2)
        self.assertEqual(x.c, 3)

        setattr(x, 'a', 10)
        self.assertEqual(x.a, 10)

        del(x.a)
        self.assertEqual(x.a, 1)

    def test_dictproxy(self):
        v = {}
        x = Proxy(lambda: v)
        x['foo'] = 42
        self.assertEqual(x['foo'], 42)
        self.assertEqual(len(x), 1)
        self.assertIn('foo', x)
        del(x['foo'])
        with self.assertRaises(KeyError):
            x['foo']
        self.assertTrue(iter(x))

    def test_listproxy(self):
        v = []
        x = Proxy(lambda: v)
        x.append(1)
        x.extend([2, 3, 4])
        self.assertEqual(x[0], 1)
        self.assertEqual(x[:-1], [1, 2, 3])
        del(x[-1])
        self.assertEqual(x[:-1], [1, 2])
        x[0] = 10
        self.assertEqual(x[0], 10)
        self.assertIn(10, x)
        self.assertEqual(len(x), 3)
        self.assertTrue(iter(x))
        x[0:2] = [1, 2]
        del(x[0:2])
        self.assertTrue(str(x))
        if sys.version_info[0] < 3:
            self.assertEqual(x.__cmp__(object()), -1)

    def test_complex_cast(self):

        class O(object):

            def __complex__(self):
                return complex(10.333)

        o = Proxy(O)
        self.assertEqual(o.__complex__(), complex(10.333))

    def test_index(self):

        class O(object):

            def __index__(self):
                return 1

        o = Proxy(O)
        self.assertEqual(o.__index__(), 1)

    def test_coerce(self):

        class O(object):

            def __coerce__(self, other):
                return self, other

        o = Proxy(O)
        self.assertTrue(o.__coerce__(3))

    def test_int(self):
        self.assertEqual(Proxy(lambda: 10) + 1, Proxy(lambda: 11))
        self.assertEqual(Proxy(lambda: 10) - 1, Proxy(lambda: 9))
        self.assertEqual(Proxy(lambda: 10) * 2, Proxy(lambda: 20))
        self.assertEqual(Proxy(lambda: 10) ** 2, Proxy(lambda: 100))
        self.assertEqual(Proxy(lambda: 20) / 2, Proxy(lambda: 10))
        self.assertEqual(Proxy(lambda: 20) // 2, Proxy(lambda: 10))
        self.assertEqual(Proxy(lambda: 11) % 2, Proxy(lambda: 1))
        self.assertEqual(Proxy(lambda: 10) << 2, Proxy(lambda: 40))
        self.assertEqual(Proxy(lambda: 10) >> 2, Proxy(lambda: 2))
        self.assertEqual(Proxy(lambda: 10) ^ 7, Proxy(lambda: 13))
        self.assertEqual(Proxy(lambda: 10) | 40, Proxy(lambda: 42))
        self.assertEqual(~Proxy(lambda: 10), Proxy(lambda: -11))
        self.assertEqual(-Proxy(lambda: 10), Proxy(lambda: -10))
        self.assertEqual(+Proxy(lambda: -10), Proxy(lambda: -10))
        self.assertTrue(Proxy(lambda: 10) < Proxy(lambda: 20))
        self.assertTrue(Proxy(lambda: 20) > Proxy(lambda: 10))
        self.assertTrue(Proxy(lambda: 10) >= Proxy(lambda: 10))
        self.assertTrue(Proxy(lambda: 10) <= Proxy(lambda: 10))
        self.assertTrue(Proxy(lambda: 10) == Proxy(lambda: 10))
        self.assertTrue(Proxy(lambda: 20) != Proxy(lambda: 10))
        self.assertTrue(Proxy(lambda: 100).__divmod__(30))
        self.assertTrue(Proxy(lambda: 100).__truediv__(30))
        self.assertTrue(abs(Proxy(lambda: -100)))

        x = Proxy(lambda: 10)
        x -= 1
        self.assertEqual(x, 9)
        x = Proxy(lambda: 9)
        x += 1
        self.assertEqual(x, 10)
        x = Proxy(lambda: 10)
        x *= 2
        self.assertEqual(x, 20)
        x = Proxy(lambda: 20)
        x /= 2
        self.assertEqual(x, 10)
        x = Proxy(lambda: 10)
        x %= 2
        self.assertEqual(x, 0)
        x = Proxy(lambda: 10)
        x <<= 3
        self.assertEqual(x, 80)
        x = Proxy(lambda: 80)
        x >>= 4
        self.assertEqual(x, 5)
        x = Proxy(lambda: 5)
        x ^= 1
        self.assertEqual(x, 4)
        x = Proxy(lambda: 4)
        x **= 4
        self.assertEqual(x, 256)
        x = Proxy(lambda: 256)
        x //= 2
        self.assertEqual(x, 128)
        x = Proxy(lambda: 128)
        x |= 2
        self.assertEqual(x, 130)
        x = Proxy(lambda: 130)
        x &= 10
        self.assertEqual(x, 2)

        x = Proxy(lambda: 10)
        self.assertEqual(type(x.__float__()), float)
        self.assertEqual(type(x.__int__()), int)
        if not PY3:
            self.assertEqual(type(x.__long__()), long_t)
        self.assertTrue(hex(x))
        self.assertTrue(oct(x))

    def test_hash(self):

        class X(object):

            def __hash__(self):
                return 1234

        self.assertEqual(hash(Proxy(lambda: X())), 1234)

    def test_call(self):

        class X(object):

            def __call__(self):
                return 1234

        self.assertEqual(Proxy(lambda: X())(), 1234)

    def test_context(self):

        class X(object):
            entered = exited = False

            def __enter__(self):
                self.entered = True
                return 1234

            def __exit__(self, *exc_info):
                self.exited = True

        v = X()
        x = Proxy(lambda: v)
        with x as val:
            self.assertEqual(val, 1234)
        self.assertTrue(x.entered)
        self.assertTrue(x.exited)

    def test_reduce(self):

        class X(object):

            def __reduce__(self):
                return 123

        x = Proxy(lambda: X())
        self.assertEqual(x.__reduce__(), 123)


class test_PromiseProxy(Case):

    def test_only_evaluated_once(self):

        class X(object):
            attr = 123
            evals = 0

            def __init__(self):
                self.__class__.evals += 1

        p = PromiseProxy(X)
        self.assertEqual(p.attr, 123)
        self.assertEqual(p.attr, 123)
        self.assertEqual(X.evals, 1)

    def test_callbacks(self):
        source = Mock(name='source')
        p = PromiseProxy(source)
        cbA = Mock(name='cbA')
        cbB = Mock(name='cbB')
        cbC = Mock(name='cbC')
        p.__then__(cbA, p)
        p.__then__(cbB, p)
        self.assertFalse(p.__evaluated__())
        self.assertTrue(object.__getattribute__(p, '__pending__'))

        self.assertTrue(repr(p))
        self.assertTrue(p.__evaluated__())
        with self.assertRaises(AttributeError):
            object.__getattribute__(p, '__pending__')
        cbA.assert_called_with(p)
        cbB.assert_called_with(p)

        self.assertTrue(p.__evaluated__())
        p.__then__(cbC, p)
        cbC.assert_called_with(p)

        with self.assertRaises(AttributeError):
            object.__getattribute__(p, '__pending__')

    def test_maybe_evaluate(self):
        x = PromiseProxy(lambda: 30)
        self.assertFalse(x.__evaluated__())
        self.assertEqual(maybe_evaluate(x), 30)
        self.assertEqual(maybe_evaluate(x), 30)

        self.assertEqual(maybe_evaluate(30), 30)
        self.assertTrue(x.__evaluated__())
