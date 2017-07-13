from __future__ import absolute_import

import pickle
import sys

from billiard.einfo import ExceptionInfo
from time import time

from celery.datastructures import (
    LimitedSet,
    AttributeDict,
    DictAttribute,
    ConfigurationView,
    DependencyGraph,
)
from celery.five import items

from celery.tests.case import Case, Mock, WhateverIO, SkipTest, patch


class Object(object):
    pass


class test_DictAttribute(Case):

    def test_get_set_keys_values_items(self):
        x = DictAttribute(Object())
        x['foo'] = 'The quick brown fox'
        self.assertEqual(x['foo'], 'The quick brown fox')
        self.assertEqual(x['foo'], x.obj.foo)
        self.assertEqual(x.get('foo'), 'The quick brown fox')
        self.assertIsNone(x.get('bar'))
        with self.assertRaises(KeyError):
            x['bar']
        x.foo = 'The quick yellow fox'
        self.assertEqual(x['foo'], 'The quick yellow fox')
        self.assertIn(
            ('foo', 'The quick yellow fox'),
            list(x.items()),
        )
        self.assertIn('foo', list(x.keys()))
        self.assertIn('The quick yellow fox', list(x.values()))

    def test_setdefault(self):
        x = DictAttribute(Object())
        self.assertEqual(x.setdefault('foo', 'NEW'), 'NEW')
        self.assertEqual(x.setdefault('foo', 'XYZ'), 'NEW')

    def test_contains(self):
        x = DictAttribute(Object())
        x['foo'] = 1
        self.assertIn('foo', x)
        self.assertNotIn('bar', x)

    def test_items(self):
        obj = Object()
        obj.attr1 = 1
        x = DictAttribute(obj)
        x['attr2'] = 2
        self.assertEqual(x['attr1'], 1)
        self.assertEqual(x['attr2'], 2)


class test_ConfigurationView(Case):

    def setUp(self):
        self.view = ConfigurationView({'changed_key': 1,
                                       'both': 2},
                                      [{'default_key': 1,
                                       'both': 1}])

    def test_setdefault(self):
        self.assertEqual(self.view.setdefault('both', 36), 2)
        self.assertEqual(self.view.setdefault('new', 36), 36)

    def test_get(self):
        self.assertEqual(self.view.get('both'), 2)
        sp = object()
        self.assertIs(self.view.get('nonexisting', sp), sp)

    def test_update(self):
        changes = dict(self.view.changes)
        self.view.update(a=1, b=2, c=3)
        self.assertDictEqual(self.view.changes,
                             dict(changes, a=1, b=2, c=3))

    def test_contains(self):
        self.assertIn('changed_key', self.view)
        self.assertIn('default_key', self.view)
        self.assertNotIn('new', self.view)

    def test_repr(self):
        self.assertIn('changed_key', repr(self.view))
        self.assertIn('default_key', repr(self.view))

    def test_iter(self):
        expected = {'changed_key': 1,
                    'default_key': 1,
                    'both': 2}
        self.assertDictEqual(dict(items(self.view)), expected)
        self.assertItemsEqual(list(iter(self.view)),
                              list(expected.keys()))
        self.assertItemsEqual(list(self.view.keys()), list(expected.keys()))
        self.assertItemsEqual(
            list(self.view.values()),
            list(expected.values()),
        )
        self.assertIn('changed_key', list(self.view.keys()))
        self.assertIn(2, list(self.view.values()))
        self.assertIn(('both', 2), list(self.view.items()))

    def test_add_defaults_dict(self):
        defaults = {'foo': 10}
        self.view.add_defaults(defaults)
        self.assertEqual(self.view.foo, 10)

    def test_add_defaults_object(self):
        defaults = Object()
        defaults.foo = 10
        self.view.add_defaults(defaults)
        self.assertEqual(self.view.foo, 10)

    def test_clear(self):
        self.view.clear()
        self.assertEqual(self.view.both, 1)
        self.assertNotIn('changed_key', self.view)

    def test_bool(self):
        self.assertTrue(bool(self.view))
        self.view._order[:] = []
        self.assertFalse(bool(self.view))

    def test_len(self):
        self.assertEqual(len(self.view), 3)
        self.view.KEY = 33
        self.assertEqual(len(self.view), 4)
        self.view.clear()
        self.assertEqual(len(self.view), 2)

    def test_isa_mapping(self):
        from collections import Mapping
        self.assertTrue(issubclass(ConfigurationView, Mapping))

    def test_isa_mutable_mapping(self):
        from collections import MutableMapping
        self.assertTrue(issubclass(ConfigurationView, MutableMapping))


class test_ExceptionInfo(Case):

    def test_exception_info(self):

        try:
            raise LookupError('The quick brown fox jumps...')
        except Exception:
            einfo = ExceptionInfo()
            self.assertEqual(str(einfo), einfo.traceback)
            self.assertIsInstance(einfo.exception, LookupError)
            self.assertTupleEqual(
                einfo.exception.args, ('The quick brown fox jumps...', ),
            )
            self.assertTrue(einfo.traceback)

            r = repr(einfo)
            self.assertTrue(r)


class test_LimitedSet(Case):

    def setUp(self):
        if sys.platform == 'win32':
            raise SkipTest('Not working on Windows')

    def test_add(self):
        if sys.platform == 'win32':
            raise SkipTest('Not working properly on Windows')
        s = LimitedSet(maxlen=2)
        s.add('foo')
        s.add('bar')
        for n in 'foo', 'bar':
            self.assertIn(n, s)
        s.add('baz')
        for n in 'bar', 'baz':
            self.assertIn(n, s)
        self.assertNotIn('foo', s)

    def test_purge(self):
        s = LimitedSet(maxlen=None)
        [s.add(i) for i in range(10)]
        s.maxlen = 2
        s.purge(1)
        self.assertEqual(len(s), 9)
        s.purge(None)
        self.assertEqual(len(s), 2)

        # expired
        s = LimitedSet(maxlen=None, expires=1)
        [s.add(i) for i in range(10)]
        s.maxlen = 2
        s.purge(1, now=lambda: time() + 100)
        self.assertEqual(len(s), 9)
        s.purge(None, now=lambda: time() + 100)
        self.assertEqual(len(s), 2)

        # not expired
        s = LimitedSet(maxlen=None, expires=1)
        [s.add(i) for i in range(10)]
        s.maxlen = 2
        s.purge(1, now=lambda: time() - 100)
        self.assertEqual(len(s), 10)
        s.purge(None, now=lambda: time() - 100)
        self.assertEqual(len(s), 10)

        s = LimitedSet(maxlen=None)
        [s.add(i) for i in range(10)]
        s.maxlen = 2
        with patch('celery.datastructures.heappop') as hp:
            hp.side_effect = IndexError()
            s.purge()
            hp.assert_called_with(s._heap)
        with patch('celery.datastructures.heappop') as hp:
            s._data = dict((i * 2, i * 2) for i in range(10))
            s.purge()
            self.assertEqual(hp.call_count, 10)

    def test_pickleable(self):
        s = LimitedSet(maxlen=2)
        s.add('foo')
        s.add('bar')
        self.assertEqual(pickle.loads(pickle.dumps(s)), s)

    def test_iter(self):
        if sys.platform == 'win32':
            raise SkipTest('Not working on Windows')
        s = LimitedSet(maxlen=3)
        items = ['foo', 'bar', 'baz', 'xaz']
        for item in items:
            s.add(item)
        l = list(iter(s))
        for item in items[1:]:
            self.assertIn(item, l)
        self.assertNotIn('foo', l)
        self.assertListEqual(l, items[1:], 'order by insertion time')

    def test_repr(self):
        s = LimitedSet(maxlen=2)
        items = 'foo', 'bar'
        for item in items:
            s.add(item)
        self.assertIn('LimitedSet(', repr(s))

    def test_discard(self):
        s = LimitedSet(maxlen=2)
        s.add('foo')
        s.discard('foo')
        self.assertNotIn('foo', s)
        self.assertEqual(len(s._data), 0)
        self.assertEqual(len(s._heap), 0)
        s.discard('foo')

    def test_clear(self):
        s = LimitedSet(maxlen=2)
        s.add('foo')
        s.add('bar')
        self.assertEqual(len(s), 2)
        s.clear()
        self.assertFalse(s)

    def test_update(self):
        s1 = LimitedSet(maxlen=2)
        s1.add('foo')
        s1.add('bar')

        s2 = LimitedSet(maxlen=2)
        s2.update(s1)
        self.assertItemsEqual(list(s2), ['foo', 'bar'])

        s2.update(['bla'])
        self.assertItemsEqual(list(s2), ['bla', 'bar'])

        s2.update(['do', 're'])
        self.assertItemsEqual(list(s2), ['do', 're'])

    def test_as_dict(self):
        s = LimitedSet(maxlen=2)
        s.add('foo')
        self.assertIsInstance(s.as_dict(), dict)


class test_AttributeDict(Case):

    def test_getattr__setattr(self):
        x = AttributeDict({'foo': 'bar'})
        self.assertEqual(x['foo'], 'bar')
        with self.assertRaises(AttributeError):
            x.bar
        x.bar = 'foo'
        self.assertEqual(x['bar'], 'foo')


class test_DependencyGraph(Case):

    def graph1(self):
        return DependencyGraph([
            ('A', []),
            ('B', []),
            ('C', ['A']),
            ('D', ['C', 'B']),
        ])

    def test_repr(self):
        self.assertTrue(repr(self.graph1()))

    def test_topsort(self):
        order = self.graph1().topsort()
        # C must start before D
        self.assertLess(order.index('C'), order.index('D'))
        # and B must start before D
        self.assertLess(order.index('B'), order.index('D'))
        # and A must start before C
        self.assertLess(order.index('A'), order.index('C'))

    def test_edges(self):
        self.assertItemsEqual(
            list(self.graph1().edges()),
            ['C', 'D'],
        )

    def test_connect(self):
        x, y = self.graph1(), self.graph1()
        x.connect(y)

    def test_valency_of_when_missing(self):
        x = self.graph1()
        self.assertEqual(x.valency_of('foobarbaz'), 0)

    def test_format(self):
        x = self.graph1()
        x.formatter = Mock()
        obj = Mock()
        self.assertTrue(x.format(obj))
        x.formatter.assert_called_with(obj)
        x.formatter = None
        self.assertIs(x.format(obj), obj)

    def test_items(self):
        self.assertDictEqual(
            dict(items(self.graph1())),
            {'A': [], 'B': [], 'C': ['A'], 'D': ['C', 'B']},
        )

    def test_repr_node(self):
        x = self.graph1()
        self.assertTrue(x.repr_node('fasdswewqewq'))

    def test_to_dot(self):
        s = WhateverIO()
        self.graph1().to_dot(s)
        self.assertTrue(s.getvalue())
