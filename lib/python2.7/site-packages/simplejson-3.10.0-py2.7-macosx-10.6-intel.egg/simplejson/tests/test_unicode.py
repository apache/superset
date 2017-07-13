import sys
import codecs
from unittest import TestCase

import simplejson as json
from simplejson.compat import unichr, text_type, b, u, BytesIO

class TestUnicode(TestCase):
    def test_encoding1(self):
        encoder = json.JSONEncoder(encoding='utf-8')
        u = u'\N{GREEK SMALL LETTER ALPHA}\N{GREEK CAPITAL LETTER OMEGA}'
        s = u.encode('utf-8')
        ju = encoder.encode(u)
        js = encoder.encode(s)
        self.assertEqual(ju, js)

    def test_encoding2(self):
        u = u'\N{GREEK SMALL LETTER ALPHA}\N{GREEK CAPITAL LETTER OMEGA}'
        s = u.encode('utf-8')
        ju = json.dumps(u, encoding='utf-8')
        js = json.dumps(s, encoding='utf-8')
        self.assertEqual(ju, js)

    def test_encoding3(self):
        u = u'\N{GREEK SMALL LETTER ALPHA}\N{GREEK CAPITAL LETTER OMEGA}'
        j = json.dumps(u)
        self.assertEqual(j, '"\\u03b1\\u03a9"')

    def test_encoding4(self):
        u = u'\N{GREEK SMALL LETTER ALPHA}\N{GREEK CAPITAL LETTER OMEGA}'
        j = json.dumps([u])
        self.assertEqual(j, '["\\u03b1\\u03a9"]')

    def test_encoding5(self):
        u = u'\N{GREEK SMALL LETTER ALPHA}\N{GREEK CAPITAL LETTER OMEGA}'
        j = json.dumps(u, ensure_ascii=False)
        self.assertEqual(j, u'"' + u + u'"')

    def test_encoding6(self):
        u = u'\N{GREEK SMALL LETTER ALPHA}\N{GREEK CAPITAL LETTER OMEGA}'
        j = json.dumps([u], ensure_ascii=False)
        self.assertEqual(j, u'["' + u + u'"]')

    def test_big_unicode_encode(self):
        u = u'\U0001d120'
        self.assertEqual(json.dumps(u), '"\\ud834\\udd20"')
        self.assertEqual(json.dumps(u, ensure_ascii=False), u'"\U0001d120"')

    def test_big_unicode_decode(self):
        u = u'z\U0001d120x'
        self.assertEqual(json.loads('"' + u + '"'), u)
        self.assertEqual(json.loads('"z\\ud834\\udd20x"'), u)

    def test_unicode_decode(self):
        for i in range(0, 0xd7ff):
            u = unichr(i)
            #s = '"\\u{0:04x}"'.format(i)
            s = '"\\u%04x"' % (i,)
            self.assertEqual(json.loads(s), u)

    def test_object_pairs_hook_with_unicode(self):
        s = u'{"xkd":1, "kcw":2, "art":3, "hxm":4, "qrt":5, "pad":6, "hoy":7}'
        p = [(u"xkd", 1), (u"kcw", 2), (u"art", 3), (u"hxm", 4),
             (u"qrt", 5), (u"pad", 6), (u"hoy", 7)]
        self.assertEqual(json.loads(s), eval(s))
        self.assertEqual(json.loads(s, object_pairs_hook=lambda x: x), p)
        od = json.loads(s, object_pairs_hook=json.OrderedDict)
        self.assertEqual(od, json.OrderedDict(p))
        self.assertEqual(type(od), json.OrderedDict)
        # the object_pairs_hook takes priority over the object_hook
        self.assertEqual(json.loads(s,
                                    object_pairs_hook=json.OrderedDict,
                                    object_hook=lambda x: None),
                         json.OrderedDict(p))


    def test_default_encoding(self):
        self.assertEqual(json.loads(u'{"a": "\xe9"}'.encode('utf-8')),
            {'a': u'\xe9'})

    def test_unicode_preservation(self):
        self.assertEqual(type(json.loads(u'""')), text_type)
        self.assertEqual(type(json.loads(u'"a"')), text_type)
        self.assertEqual(type(json.loads(u'["a"]')[0]), text_type)

    def test_ensure_ascii_false_returns_unicode(self):
        # http://code.google.com/p/simplejson/issues/detail?id=48
        self.assertEqual(type(json.dumps([], ensure_ascii=False)), text_type)
        self.assertEqual(type(json.dumps(0, ensure_ascii=False)), text_type)
        self.assertEqual(type(json.dumps({}, ensure_ascii=False)), text_type)
        self.assertEqual(type(json.dumps("", ensure_ascii=False)), text_type)

    def test_ensure_ascii_false_bytestring_encoding(self):
        # http://code.google.com/p/simplejson/issues/detail?id=48
        doc1 = {u'quux': b('Arr\xc3\xaat sur images')}
        doc2 = {u'quux': u('Arr\xeat sur images')}
        doc_ascii = '{"quux": "Arr\\u00eat sur images"}'
        doc_unicode = u'{"quux": "Arr\xeat sur images"}'
        self.assertEqual(json.dumps(doc1), doc_ascii)
        self.assertEqual(json.dumps(doc2), doc_ascii)
        self.assertEqual(json.dumps(doc1, ensure_ascii=False), doc_unicode)
        self.assertEqual(json.dumps(doc2, ensure_ascii=False), doc_unicode)

    def test_ensure_ascii_linebreak_encoding(self):
        # http://timelessrepo.com/json-isnt-a-javascript-subset
        s1 = u'\u2029\u2028'
        s2 = s1.encode('utf8')
        expect = '"\\u2029\\u2028"'
        self.assertEqual(json.dumps(s1), expect)
        self.assertEqual(json.dumps(s2), expect)
        self.assertEqual(json.dumps(s1, ensure_ascii=False), expect)
        self.assertEqual(json.dumps(s2, ensure_ascii=False), expect)

    def test_invalid_escape_sequences(self):
        # incomplete escape sequence
        self.assertRaises(json.JSONDecodeError, json.loads, '"\\u')
        self.assertRaises(json.JSONDecodeError, json.loads, '"\\u1')
        self.assertRaises(json.JSONDecodeError, json.loads, '"\\u12')
        self.assertRaises(json.JSONDecodeError, json.loads, '"\\u123')
        self.assertRaises(json.JSONDecodeError, json.loads, '"\\u1234')
        # invalid escape sequence
        self.assertRaises(json.JSONDecodeError, json.loads, '"\\u123x"')
        self.assertRaises(json.JSONDecodeError, json.loads, '"\\u12x4"')
        self.assertRaises(json.JSONDecodeError, json.loads, '"\\u1x34"')
        self.assertRaises(json.JSONDecodeError, json.loads, '"\\ux234"')
        if sys.maxunicode > 65535:
            # invalid escape sequence for low surrogate
            self.assertRaises(json.JSONDecodeError, json.loads, '"\\ud800\\u"')
            self.assertRaises(json.JSONDecodeError, json.loads, '"\\ud800\\u0"')
            self.assertRaises(json.JSONDecodeError, json.loads, '"\\ud800\\u00"')
            self.assertRaises(json.JSONDecodeError, json.loads, '"\\ud800\\u000"')
            self.assertRaises(json.JSONDecodeError, json.loads, '"\\ud800\\u000x"')
            self.assertRaises(json.JSONDecodeError, json.loads, '"\\ud800\\u00x0"')
            self.assertRaises(json.JSONDecodeError, json.loads, '"\\ud800\\u0x00"')
            self.assertRaises(json.JSONDecodeError, json.loads, '"\\ud800\\ux000"')

    def test_ensure_ascii_still_works(self):
        # in the ascii range, ensure that everything is the same
        for c in map(unichr, range(0, 127)):
            self.assertEqual(
                json.dumps(c, ensure_ascii=False),
                json.dumps(c))
        snowman = u'\N{SNOWMAN}'
        self.assertEqual(
            json.dumps(c, ensure_ascii=False),
            '"' + c + '"')

    def test_strip_bom(self):
        content = u"\u3053\u3093\u306b\u3061\u308f"
        json_doc = codecs.BOM_UTF8 + b(json.dumps(content))
        self.assertEqual(json.load(BytesIO(json_doc)), content)
        for doc in json_doc, json_doc.decode('utf8'):
            self.assertEqual(json.loads(doc), content)
