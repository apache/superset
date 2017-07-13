import unittest

from simplejson.compat import StringIO
import simplejson as json

class TestTuples(unittest.TestCase):
    def test_tuple_array_dumps(self):
        t = (1, 2, 3)
        expect = json.dumps(list(t))
        # Default is True
        self.assertEqual(expect, json.dumps(t))
        self.assertEqual(expect, json.dumps(t, tuple_as_array=True))
        self.assertRaises(TypeError, json.dumps, t, tuple_as_array=False)
        # Ensure that the "default" does not get called
        self.assertEqual(expect, json.dumps(t, default=repr))
        self.assertEqual(expect, json.dumps(t, tuple_as_array=True,
                                            default=repr))
        # Ensure that the "default" gets called
        self.assertEqual(
            json.dumps(repr(t)),
            json.dumps(t, tuple_as_array=False, default=repr))

    def test_tuple_array_dump(self):
        t = (1, 2, 3)
        expect = json.dumps(list(t))
        # Default is True
        sio = StringIO()
        json.dump(t, sio)
        self.assertEqual(expect, sio.getvalue())
        sio = StringIO()
        json.dump(t, sio, tuple_as_array=True)
        self.assertEqual(expect, sio.getvalue())
        self.assertRaises(TypeError, json.dump, t, StringIO(),
                          tuple_as_array=False)
        # Ensure that the "default" does not get called
        sio = StringIO()
        json.dump(t, sio, default=repr)
        self.assertEqual(expect, sio.getvalue())
        sio = StringIO()
        json.dump(t, sio, tuple_as_array=True, default=repr)
        self.assertEqual(expect, sio.getvalue())
        # Ensure that the "default" gets called
        sio = StringIO()
        json.dump(t, sio, tuple_as_array=False, default=repr)
        self.assertEqual(
            json.dumps(repr(t)),
            sio.getvalue())
