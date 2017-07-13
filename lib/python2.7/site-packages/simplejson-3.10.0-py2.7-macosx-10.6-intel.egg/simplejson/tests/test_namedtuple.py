from __future__ import absolute_import
import unittest
import simplejson as json
from simplejson.compat import StringIO

try:
    from collections import namedtuple
except ImportError:
    class Value(tuple):
        def __new__(cls, *args):
            return tuple.__new__(cls, args)

        def _asdict(self):
            return {'value': self[0]}
    class Point(tuple):
        def __new__(cls, *args):
            return tuple.__new__(cls, args)

        def _asdict(self):
            return {'x': self[0], 'y': self[1]}
else:
    Value = namedtuple('Value', ['value'])
    Point = namedtuple('Point', ['x', 'y'])

class DuckValue(object):
    def __init__(self, *args):
        self.value = Value(*args)

    def _asdict(self):
        return self.value._asdict()

class DuckPoint(object):
    def __init__(self, *args):
        self.point = Point(*args)

    def _asdict(self):
        return self.point._asdict()

class DeadDuck(object):
    _asdict = None

class DeadDict(dict):
    _asdict = None

CONSTRUCTORS = [
    lambda v: v,
    lambda v: [v],
    lambda v: [{'key': v}],
]

class TestNamedTuple(unittest.TestCase):
    def test_namedtuple_dumps(self):
        for v in [Value(1), Point(1, 2), DuckValue(1), DuckPoint(1, 2)]:
            d = v._asdict()
            self.assertEqual(d, json.loads(json.dumps(v)))
            self.assertEqual(
                d,
                json.loads(json.dumps(v, namedtuple_as_object=True)))
            self.assertEqual(d, json.loads(json.dumps(v, tuple_as_array=False)))
            self.assertEqual(
                d,
                json.loads(json.dumps(v, namedtuple_as_object=True,
                                      tuple_as_array=False)))

    def test_namedtuple_dumps_false(self):
        for v in [Value(1), Point(1, 2)]:
            l = list(v)
            self.assertEqual(
                l,
                json.loads(json.dumps(v, namedtuple_as_object=False)))
            self.assertRaises(TypeError, json.dumps, v,
                tuple_as_array=False, namedtuple_as_object=False)

    def test_namedtuple_dump(self):
        for v in [Value(1), Point(1, 2), DuckValue(1), DuckPoint(1, 2)]:
            d = v._asdict()
            sio = StringIO()
            json.dump(v, sio)
            self.assertEqual(d, json.loads(sio.getvalue()))
            sio = StringIO()
            json.dump(v, sio, namedtuple_as_object=True)
            self.assertEqual(
                d,
                json.loads(sio.getvalue()))
            sio = StringIO()
            json.dump(v, sio, tuple_as_array=False)
            self.assertEqual(d, json.loads(sio.getvalue()))
            sio = StringIO()
            json.dump(v, sio, namedtuple_as_object=True,
                      tuple_as_array=False)
            self.assertEqual(
                d,
                json.loads(sio.getvalue()))

    def test_namedtuple_dump_false(self):
        for v in [Value(1), Point(1, 2)]:
            l = list(v)
            sio = StringIO()
            json.dump(v, sio, namedtuple_as_object=False)
            self.assertEqual(
                l,
                json.loads(sio.getvalue()))
            self.assertRaises(TypeError, json.dump, v, StringIO(),
                tuple_as_array=False, namedtuple_as_object=False)

    def test_asdict_not_callable_dump(self):
        for f in CONSTRUCTORS:
            self.assertRaises(TypeError,
                json.dump, f(DeadDuck()), StringIO(), namedtuple_as_object=True)
            sio = StringIO()
            json.dump(f(DeadDict()), sio, namedtuple_as_object=True)
            self.assertEqual(
                json.dumps(f({})),
                sio.getvalue())

    def test_asdict_not_callable_dumps(self):
        for f in CONSTRUCTORS:
            self.assertRaises(TypeError,
                json.dumps, f(DeadDuck()), namedtuple_as_object=True)
            self.assertEqual(
                json.dumps(f({})),
                json.dumps(f(DeadDict()), namedtuple_as_object=True))
