from __future__ import absolute_import
from __future__ import unicode_literals

import pickle
import sys

from functools import wraps

from kombu import version_info_t
from kombu import utils
from kombu.utils.text import version_string_as_tuple
from kombu.five import string_t

from kombu.tests.case import (
    Case, Mock, patch,
    redirect_stdouts, mask_modules, module_exists, skip_if_module,
)

if sys.version_info >= (3, 0):
    from io import StringIO, BytesIO
else:
    from StringIO import StringIO, StringIO as BytesIO  # noqa


class OldString(object):

    def __init__(self, value):
        self.value = value

    def __str__(self):
        return self.value

    def split(self, *args, **kwargs):
        return self.value.split(*args, **kwargs)

    def rsplit(self, *args, **kwargs):
        return self.value.rsplit(*args, **kwargs)


class test_kombu_module(Case):

    def test_dir(self):
        import kombu
        self.assertTrue(dir(kombu))


class test_utils(Case):

    def test_maybe_list(self):
        self.assertEqual(utils.maybe_list(None), [])
        self.assertEqual(utils.maybe_list(1), [1])
        self.assertEqual(utils.maybe_list([1, 2, 3]), [1, 2, 3])

    def test_fxrange_no_repeatlast(self):
        self.assertEqual(list(utils.fxrange(1.0, 3.0, 1.0)),
                         [1.0, 2.0, 3.0])

    def test_fxrangemax(self):
        self.assertEqual(list(utils.fxrangemax(1.0, 3.0, 1.0, 30.0)),
                         [1.0, 2.0, 3.0, 3.0, 3.0, 3.0,
                          3.0, 3.0, 3.0, 3.0, 3.0])
        self.assertEqual(list(utils.fxrangemax(1.0, None, 1.0, 30.0)),
                         [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0])

    def test_reprkwargs(self):
        self.assertTrue(utils.reprkwargs({'foo': 'bar', 1: 2, 'k': 'v'}))

    def test_reprcall(self):
        self.assertTrue(
            utils.reprcall('add', (2, 2), {'copy': True}),
        )


class test_UUID(Case):

    def test_uuid4(self):
        self.assertNotEqual(utils.uuid4(),
                            utils.uuid4())

    def test_uuid(self):
        i1 = utils.uuid()
        i2 = utils.uuid()
        self.assertIsInstance(i1, str)
        self.assertNotEqual(i1, i2)

    @skip_if_module('__pypy__')
    def test_uuid_without_ctypes(self):
        old_utils = sys.modules.pop('kombu.utils')

        @mask_modules('ctypes')
        def with_ctypes_masked():
            from kombu.utils import ctypes, uuid

            self.assertIsNone(ctypes)
            tid = uuid()
            self.assertTrue(tid)
            self.assertIsInstance(tid, string_t)

        try:
            with_ctypes_masked()
        finally:
            sys.modules['celery.utils'] = old_utils


class test_Misc(Case):

    def test_kwdict(self):

        def f(**kwargs):
            return kwargs

        kw = {'foo': 'foo',
              'bar': 'bar'}
        self.assertTrue(f(**utils.kwdict(kw)))


class MyStringIO(StringIO):

    def close(self):
        pass


class MyBytesIO(BytesIO):

    def close(self):
        pass


class test_emergency_dump_state(Case):

    @redirect_stdouts
    def test_dump(self, stdout, stderr):
        fh = MyBytesIO()

        utils.emergency_dump_state({'foo': 'bar'}, open_file=lambda n, m: fh)
        self.assertDictEqual(pickle.loads(fh.getvalue()), {'foo': 'bar'})
        self.assertTrue(stderr.getvalue())
        self.assertFalse(stdout.getvalue())

    @redirect_stdouts
    def test_dump_second_strategy(self, stdout, stderr):
        fh = MyStringIO()

        def raise_something(*args, **kwargs):
            raise KeyError('foo')

        utils.emergency_dump_state(
            {'foo': 'bar'},
            open_file=lambda n, m: fh, dump=raise_something
        )
        self.assertIn('foo', fh.getvalue())
        self.assertIn('bar', fh.getvalue())
        self.assertTrue(stderr.getvalue())
        self.assertFalse(stdout.getvalue())


def insomnia(fun):

    @wraps(fun)
    def _inner(*args, **kwargs):
        def mysleep(i):
            pass

        prev_sleep = utils.sleep
        utils.sleep = mysleep
        try:
            return fun(*args, **kwargs)
        finally:
            utils.sleep = prev_sleep

    return _inner


class test_retry_over_time(Case):

    def setUp(self):
        self.index = 0

    class Predicate(Exception):
        pass

    def myfun(self):
        if self.index < 9:
            raise self.Predicate()
        return 42

    def errback(self, exc, intervals, retries):
        interval = next(intervals)
        sleepvals = (None, 2.0, 4.0, 6.0, 8.0, 10.0, 12.0, 14.0, 16.0, 16.0)
        self.index += 1
        self.assertEqual(interval, sleepvals[self.index])
        return interval

    @insomnia
    def test_simple(self):
        prev_count, utils.count = utils.count, Mock()
        try:
            utils.count.return_value = list(range(1))
            x = utils.retry_over_time(self.myfun, self.Predicate,
                                      errback=None, interval_max=14)
            self.assertIsNone(x)
            utils.count.return_value = list(range(10))
            cb = Mock()
            x = utils.retry_over_time(self.myfun, self.Predicate,
                                      errback=self.errback, callback=cb,
                                      interval_max=14)
            self.assertEqual(x, 42)
            self.assertEqual(self.index, 9)
            cb.assert_called_with()
        finally:
            utils.count = prev_count

    @insomnia
    def test_retry_once(self):
        with self.assertRaises(self.Predicate):
            utils.retry_over_time(
                self.myfun, self.Predicate,
                max_retries=1, errback=self.errback, interval_max=14,
            )
        self.assertEqual(self.index, 1)
        # no errback
        with self.assertRaises(self.Predicate):
            utils.retry_over_time(
                self.myfun, self.Predicate,
                max_retries=1, errback=None, interval_max=14,
            )

    @insomnia
    def test_retry_always(self):
        Predicate = self.Predicate

        class Fun(object):

            def __init__(self):
                self.calls = 0

            def __call__(self, *args, **kwargs):
                try:
                    if self.calls >= 10:
                        return 42
                    raise Predicate()
                finally:
                    self.calls += 1
        fun = Fun()

        self.assertEqual(
            utils.retry_over_time(
                fun, self.Predicate,
                max_retries=0, errback=None, interval_max=14,
            ),
            42,
        )
        self.assertEqual(fun.calls, 11)


class test_cached_property(Case):

    def test_deleting(self):

        class X(object):
            xx = False

            @utils.cached_property
            def foo(self):
                return 42

            @foo.deleter  # noqa
            def foo(self, value):
                self.xx = value

        x = X()
        del(x.foo)
        self.assertFalse(x.xx)
        x.__dict__['foo'] = 'here'
        del(x.foo)
        self.assertEqual(x.xx, 'here')

    def test_when_access_from_class(self):

        class X(object):
            xx = None

            @utils.cached_property
            def foo(self):
                return 42

            @foo.setter  # noqa
            def foo(self, value):
                self.xx = 10

        desc = X.__dict__['foo']
        self.assertIs(X.foo, desc)

        self.assertIs(desc.__get__(None), desc)
        self.assertIs(desc.__set__(None, 1), desc)
        self.assertIs(desc.__delete__(None), desc)
        self.assertTrue(desc.setter(1))

        x = X()
        x.foo = 30
        self.assertEqual(x.xx, 10)

        del(x.foo)


class test_symbol_by_name(Case):

    def test_instance_returns_instance(self):
        instance = object()
        self.assertIs(utils.symbol_by_name(instance), instance)

    def test_returns_default(self):
        default = object()
        self.assertIs(
            utils.symbol_by_name('xyz.ryx.qedoa.weq:foz', default=default),
            default,
        )

    def test_no_default(self):
        with self.assertRaises(ImportError):
            utils.symbol_by_name('xyz.ryx.qedoa.weq:foz')

    def test_imp_reraises_ValueError(self):
        imp = Mock()
        imp.side_effect = ValueError()
        with self.assertRaises(ValueError):
            utils.symbol_by_name('kombu.Connection', imp=imp)

    def test_package(self):
        from kombu.entity import Exchange
        self.assertIs(
            utils.symbol_by_name('.entity:Exchange', package='kombu'),
            Exchange,
        )
        self.assertTrue(utils.symbol_by_name(':Consumer', package='kombu'))


class test_ChannelPromise(Case):

    def test_repr(self):
        obj = Mock(name='cb')
        self.assertIn(
            'promise',
            repr(utils.ChannelPromise(obj)),
        )
        self.assertFalse(obj.called)


class test_entrypoints(Case):

    @mask_modules('pkg_resources')
    def test_without_pkg_resources(self):
        self.assertListEqual(list(utils.entrypoints('kombu.test')), [])

    @module_exists('pkg_resources')
    def test_with_pkg_resources(self):
        with patch('pkg_resources.iter_entry_points', create=True) as iterep:
            eps = iterep.return_value = [Mock(), Mock()]

            self.assertTrue(list(utils.entrypoints('kombu.test')))
            iterep.assert_called_with('kombu.test')
            eps[0].load.assert_called_with()
            eps[1].load.assert_called_with()


class test_shufflecycle(Case):

    def test_shuffles(self):
        prev_repeat, utils.repeat = utils.repeat, Mock()
        try:
            utils.repeat.return_value = list(range(10))
            values = set(['A', 'B', 'C'])
            cycle = utils.shufflecycle(values)
            seen = set()
            for i in range(10):
                next(cycle)
            utils.repeat.assert_called_with(None)
            self.assertTrue(seen.issubset(values))
            with self.assertRaises(StopIteration):
                next(cycle)
                next(cycle)
        finally:
            utils.repeat = prev_repeat


class test_version_string_as_tuple(Case):

    def test_versions(self):
        self.assertTupleEqual(
            version_string_as_tuple('3'),
            version_info_t(3, 0, 0, '', ''),
        )
        self.assertTupleEqual(
            version_string_as_tuple('3.3'),
            version_info_t(3, 3, 0, '', ''),
        )
        self.assertTupleEqual(
            version_string_as_tuple('3.3.1'),
            version_info_t(3, 3, 1, '', ''),
        )
        self.assertTupleEqual(
            version_string_as_tuple('3.3.1a3'),
            version_info_t(3, 3, 1, 'a3', ''),
        )
        self.assertTupleEqual(
            version_string_as_tuple('3.3.1a3-40c32'),
            version_info_t(3, 3, 1, 'a3', '40c32'),
        )
        self.assertEqual(
            version_string_as_tuple('3.3.1.a3.40c32'),
            version_info_t(3, 3, 1, 'a3', '40c32'),
        )
