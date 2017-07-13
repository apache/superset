import unittest
from simplejson.compat import StringIO

import simplejson as json

def iter_dumps(obj, **kw):
    return ''.join(json.JSONEncoder(**kw).iterencode(obj))

def sio_dump(obj, **kw):
    sio = StringIO()
    json.dumps(obj, **kw)
    return sio.getvalue()

class TestIterable(unittest.TestCase):
    def test_iterable(self):
        for l in ([], [1], [1, 2], [1, 2, 3]):
            for opts in [{}, {'indent': 2}]:
                for dumps in (json.dumps, iter_dumps, sio_dump):
                    expect = dumps(l, **opts)
                    default_expect = dumps(sum(l), **opts)
                    # Default is False
                    self.assertRaises(TypeError, dumps, iter(l), **opts)
                    self.assertRaises(TypeError, dumps, iter(l), iterable_as_array=False, **opts)
                    self.assertEqual(expect, dumps(iter(l), iterable_as_array=True, **opts))
                    # Ensure that the "default" gets called
                    self.assertEqual(default_expect, dumps(iter(l), default=sum, **opts))
                    self.assertEqual(default_expect, dumps(iter(l), iterable_as_array=False, default=sum, **opts))
                    # Ensure that the "default" does not get called
                    self.assertEqual(
                        expect,
                        dumps(iter(l), iterable_as_array=True, default=sum, **opts))
