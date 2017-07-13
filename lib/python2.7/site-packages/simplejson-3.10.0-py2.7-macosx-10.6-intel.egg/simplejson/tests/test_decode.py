from __future__ import absolute_import
import decimal
from unittest import TestCase

import simplejson as json
from simplejson.compat import StringIO
from simplejson import OrderedDict

class TestDecode(TestCase):
    if not hasattr(TestCase, 'assertIs'):
        def assertIs(self, a, b):
            self.assertTrue(a is b, '%r is %r' % (a, b))

    def test_decimal(self):
        rval = json.loads('1.1', parse_float=decimal.Decimal)
        self.assertTrue(isinstance(rval, decimal.Decimal))
        self.assertEqual(rval, decimal.Decimal('1.1'))

    def test_float(self):
        rval = json.loads('1', parse_int=float)
        self.assertTrue(isinstance(rval, float))
        self.assertEqual(rval, 1.0)

    def test_decoder_optimizations(self):
        # Several optimizations were made that skip over calls to
        # the whitespace regex, so this test is designed to try and
        # exercise the uncommon cases. The array cases are already covered.
        rval = json.loads('{   "key"    :    "value"    ,  "k":"v"    }')
        self.assertEqual(rval, {"key":"value", "k":"v"})

    def test_empty_objects(self):
        s = '{}'
        self.assertEqual(json.loads(s), eval(s))
        s = '[]'
        self.assertEqual(json.loads(s), eval(s))
        s = '""'
        self.assertEqual(json.loads(s), eval(s))

    def test_object_pairs_hook(self):
        s = '{"xkd":1, "kcw":2, "art":3, "hxm":4, "qrt":5, "pad":6, "hoy":7}'
        p = [("xkd", 1), ("kcw", 2), ("art", 3), ("hxm", 4),
             ("qrt", 5), ("pad", 6), ("hoy", 7)]
        self.assertEqual(json.loads(s), eval(s))
        self.assertEqual(json.loads(s, object_pairs_hook=lambda x: x), p)
        self.assertEqual(json.load(StringIO(s),
                                   object_pairs_hook=lambda x: x), p)
        od = json.loads(s, object_pairs_hook=OrderedDict)
        self.assertEqual(od, OrderedDict(p))
        self.assertEqual(type(od), OrderedDict)
        # the object_pairs_hook takes priority over the object_hook
        self.assertEqual(json.loads(s,
                                    object_pairs_hook=OrderedDict,
                                    object_hook=lambda x: None),
                         OrderedDict(p))

    def check_keys_reuse(self, source, loads):
        rval = loads(source)
        (a, b), (c, d) = sorted(rval[0]), sorted(rval[1])
        self.assertIs(a, c)
        self.assertIs(b, d)

    def test_keys_reuse_str(self):
        s = u'[{"a_key": 1, "b_\xe9": 2}, {"a_key": 3, "b_\xe9": 4}]'.encode('utf8')
        self.check_keys_reuse(s, json.loads)

    def test_keys_reuse_unicode(self):
        s = u'[{"a_key": 1, "b_\xe9": 2}, {"a_key": 3, "b_\xe9": 4}]'
        self.check_keys_reuse(s, json.loads)

    def test_empty_strings(self):
        self.assertEqual(json.loads('""'), "")
        self.assertEqual(json.loads(u'""'), u"")
        self.assertEqual(json.loads('[""]'), [""])
        self.assertEqual(json.loads(u'[""]'), [u""])

    def test_raw_decode(self):
        cls = json.decoder.JSONDecoder
        self.assertEqual(
            ({'a': {}}, 9),
            cls().raw_decode("{\"a\": {}}"))
        # http://code.google.com/p/simplejson/issues/detail?id=85
        self.assertEqual(
            ({'a': {}}, 9),
            cls(object_pairs_hook=dict).raw_decode("{\"a\": {}}"))
        # https://github.com/simplejson/simplejson/pull/38
        self.assertEqual(
            ({'a': {}}, 11),
            cls().raw_decode(" \n{\"a\": {}}"))

    def test_bounds_checking(self):
        # https://github.com/simplejson/simplejson/issues/98
        j = json.decoder.JSONDecoder()
        for i in [4, 5, 6, -1, -2, -3, -4, -5, -6]:
            self.assertRaises(ValueError, j.scan_once, '1234', i)
            self.assertRaises(ValueError, j.raw_decode, '1234', i)
        x, y = sorted(['128931233', '472389423'], key=id)
        diff = id(x) - id(y)
        self.assertRaises(ValueError, j.scan_once, y, diff)
        self.assertRaises(ValueError, j.raw_decode, y, i)
