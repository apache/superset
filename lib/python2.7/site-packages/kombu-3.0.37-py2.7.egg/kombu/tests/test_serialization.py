#!/usr/bin/python
# -*- coding: utf-8 -*-
from __future__ import absolute_import, unicode_literals

import sys

from base64 import b64decode

from kombu.exceptions import ContentDisallowed, EncodeError, DecodeError
from kombu.five import text_t, bytes_t
from kombu.serialization import (
    registry, register, SerializerNotInstalled,
    raw_encode, register_yaml, register_msgpack,
    dumps, loads, pickle, pickle_protocol,
    unregister, register_pickle, enable_insecure_serializers,
    disable_insecure_serializers,
)
from kombu.utils.encoding import str_to_bytes

from .case import Case, call, mask_modules, patch, skip_if_not_module

# For content_encoding tests
unicode_string = 'abcdé\u8463'
unicode_string_as_utf8 = unicode_string.encode('utf-8')
latin_string = 'abcdé'
latin_string_as_latin1 = latin_string.encode('latin-1')
latin_string_as_utf8 = latin_string.encode('utf-8')


# For serialization tests
py_data = {
    'string': 'The quick brown fox jumps over the lazy dog',
    'int': 10,
    'float': 3.14159265,
    'unicode': 'Thé quick brown fox jumps over thé lazy dog',
    'list': ['george', 'jerry', 'elaine', 'cosmo'],
}

# JSON serialization tests
json_data = """\
{"int": 10, "float": 3.1415926500000002, \
"list": ["george", "jerry", "elaine", "cosmo"], \
"string": "The quick brown fox jumps over the lazy \
dog", "unicode": "Th\\u00e9 quick brown fox jumps over \
th\\u00e9 lazy dog"}\
"""

# Pickle serialization tests
pickle_data = pickle.dumps(py_data, protocol=pickle_protocol)

# YAML serialization tests
yaml_data = """\
float: 3.1415926500000002
int: 10
list: [george, jerry, elaine, cosmo]
string: The quick brown fox jumps over the lazy dog
unicode: "Th\\xE9 quick brown fox jumps over th\\xE9 lazy dog"
"""


msgpack_py_data = dict(py_data)
msgpack_py_data['unicode'] = 'Th quick brown fox jumps over th lazy dog'
# Unicode chars are lost in transmit :(
msgpack_data = b64decode(str_to_bytes("""\
haNpbnQKpWZsb2F0y0AJIftTyNTxpGxpc3SUpmdlb3JnZaVqZXJyeaZlbGFpbmWlY29zbW+mc3Rya\
W5n2gArVGhlIHF1aWNrIGJyb3duIGZveCBqdW1wcyBvdmVyIHRoZSBsYXp5IGRvZ6d1bmljb2Rl2g\
ApVGggcXVpY2sgYnJvd24gZm94IGp1bXBzIG92ZXIgdGggbGF6eSBkb2c=\
"""))


def say(m):
    sys.stderr.write('%s\n' % (m, ))


registry.register('testS', lambda s: s, lambda s: 'decoded',
                  'application/testS', 'utf-8')


class test_Serialization(Case):

    def test_disable(self):
        disabled = registry._disabled_content_types
        try:
            registry.disable('testS')
            self.assertIn('application/testS', disabled)
            disabled.clear()

            registry.disable('application/testS')
            self.assertIn('application/testS', disabled)
        finally:
            disabled.clear()

    def test_enable(self):
        registry._disabled_content_types.add('application/json')
        registry.enable('json')
        self.assertNotIn('application/json', registry._disabled_content_types)
        registry._disabled_content_types.add('application/json')
        registry.enable('application/json')
        self.assertNotIn('application/json', registry._disabled_content_types)

    def test_loads_when_disabled(self):
        disabled = registry._disabled_content_types
        try:
            registry.disable('testS')

            with self.assertRaises(SerializerNotInstalled):
                loads('xxd', 'application/testS', 'utf-8', force=False)

            ret = loads('xxd', 'application/testS', 'utf-8', force=True)
            self.assertEqual(ret, 'decoded')
        finally:
            disabled.clear()

    def test_loads_when_data_is_None(self):
        loads(None, 'application/testS', 'utf-8')

    def test_content_type_decoding(self):
        self.assertEqual(
            unicode_string,
            loads(unicode_string_as_utf8,
                  content_type='plain/text', content_encoding='utf-8'),
        )
        self.assertEqual(
            latin_string,
            loads(latin_string_as_latin1,
                  content_type='application/data', content_encoding='latin-1'),
        )

    def test_content_type_binary(self):
        self.assertIsInstance(
            loads(unicode_string_as_utf8,
                  content_type='application/data', content_encoding='binary'),
            bytes_t,
        )

        self.assertEqual(
            unicode_string_as_utf8,
            loads(unicode_string_as_utf8,
                  content_type='application/data', content_encoding='binary'),
        )

    def test_content_type_encoding(self):
        # Using the 'raw' serializer
        self.assertEqual(
            unicode_string_as_utf8,
            dumps(unicode_string, serializer='raw')[-1],
        )
        self.assertEqual(
            latin_string_as_utf8,
            dumps(latin_string, serializer='raw')[-1],
        )
        # And again w/o a specific serializer to check the
        # code where we force unicode objects into a string.
        self.assertEqual(
            unicode_string_as_utf8,
            dumps(unicode_string)[-1],
        )
        self.assertEqual(
            latin_string_as_utf8,
            dumps(latin_string)[-1],
        )

    def test_enable_insecure_serializers(self):
        with patch('kombu.serialization.registry') as registry:
            enable_insecure_serializers()
            registry.assert_has_calls([
                call.enable('pickle'), call.enable('yaml'),
                call.enable('msgpack'),
            ])
            registry.enable.side_effect = KeyError()
            enable_insecure_serializers()

        with patch('kombu.serialization.registry') as registry:
            enable_insecure_serializers(['msgpack'])
            registry.assert_has_calls([call.enable('msgpack')])

    def test_disable_insecure_serializers(self):
        with patch('kombu.serialization.registry') as registry:
            registry._decoders = ['pickle', 'yaml', 'doomsday']
            disable_insecure_serializers(allowed=['doomsday'])
            registry.disable.assert_has_calls([call('pickle'), call('yaml')])
            registry.enable.assert_has_calls([call('doomsday')])
            disable_insecure_serializers(allowed=None)
            registry.disable.assert_has_calls([
                call('pickle'), call('yaml'), call('doomsday')
            ])

    def test_reraises_EncodeError(self):
        with self.assertRaises(EncodeError):
            dumps([object()], serializer='json')

    def test_reraises_DecodeError(self):
        with self.assertRaises(DecodeError):
            loads(object(), content_type='application/json',
                  content_encoding='utf-8')

    def test_json_loads(self):
        self.assertEqual(
            py_data,
            loads(json_data,
                  content_type='application/json', content_encoding='utf-8'),
        )

    def test_json_dumps(self):
        self.assertEqual(
            loads(
                dumps(py_data, serializer='json')[-1],
                content_type='application/json',
                content_encoding='utf-8',
            ),
            loads(
                json_data,
                content_type='application/json',
                content_encoding='utf-8',
            ),
        )

    @skip_if_not_module('msgpack', (ImportError, ValueError))
    def test_msgpack_loads(self):
        register_msgpack()
        res = loads(msgpack_data,
                    content_type='application/x-msgpack',
                    content_encoding='binary')
        if sys.version_info[0] < 3:
            for k, v in res.items():
                if isinstance(v, text_t):
                    res[k] = v.encode()
                if isinstance(v, (list, tuple)):
                    res[k] = [i.encode() for i in v]
        self.assertEqual(
            msgpack_py_data,
            res,
        )

    @skip_if_not_module('msgpack', (ImportError, ValueError))
    def test_msgpack_dumps(self):
        register_msgpack()
        self.assertEqual(
            loads(
                dumps(msgpack_py_data, serializer='msgpack')[-1],
                content_type='application/x-msgpack',
                content_encoding='binary',
            ),
            loads(
                msgpack_data,
                content_type='application/x-msgpack',
                content_encoding='binary',
            ),
        )

    @skip_if_not_module('yaml')
    def test_yaml_loads(self):
        register_yaml()
        self.assertEqual(
            py_data,
            loads(yaml_data,
                  content_type='application/x-yaml',
                  content_encoding='utf-8'),
        )

    @skip_if_not_module('yaml')
    def test_yaml_dumps(self):
        register_yaml()
        self.assertEqual(
            loads(
                dumps(py_data, serializer='yaml')[-1],
                content_type='application/x-yaml',
                content_encoding='utf-8',
            ),
            loads(
                yaml_data,
                content_type='application/x-yaml',
                content_encoding='utf-8',
            ),
        )

    def test_pickle_loads(self):
        self.assertEqual(
            py_data,
            loads(pickle_data,
                  content_type='application/x-python-serialize',
                  content_encoding='binary'),
        )

    def test_pickle_dumps(self):
        self.assertEqual(
            pickle.loads(pickle_data),
            pickle.loads(dumps(py_data, serializer='pickle')[-1]),
        )

    def test_register(self):
        register(None, None, None, None)

    def test_unregister(self):
        with self.assertRaises(SerializerNotInstalled):
            unregister('nonexisting')
        dumps('foo', serializer='pickle')
        unregister('pickle')
        with self.assertRaises(SerializerNotInstalled):
            dumps('foo', serializer='pickle')
        register_pickle()

    def test_set_default_serializer_missing(self):
        with self.assertRaises(SerializerNotInstalled):
            registry._set_default_serializer('nonexisting')

    def test_dumps_missing(self):
        with self.assertRaises(SerializerNotInstalled):
            dumps('foo', serializer='nonexisting')

    def test_dumps__no_serializer(self):
        ctyp, cenc, data = dumps(str_to_bytes('foo'))
        self.assertEqual(ctyp, 'application/data')
        self.assertEqual(cenc, 'binary')

    def test_loads__trusted_content(self):
        loads('tainted', 'application/data', 'binary', accept=[])
        loads('tainted', 'application/text', 'utf-8', accept=[])

    def test_loads__not_accepted(self):
        with self.assertRaises(ContentDisallowed):
            loads('tainted', 'application/x-evil', 'binary', accept=[])
        with self.assertRaises(ContentDisallowed):
            loads('tainted', 'application/x-evil', 'binary',
                  accept=['application/x-json'])
        self.assertTrue(
            loads('tainted', 'application/x-doomsday', 'binary',
                  accept=['application/x-doomsday'])
        )

    def test_raw_encode(self):
        self.assertTupleEqual(
            raw_encode('foo'.encode('utf-8')),
            ('application/data', 'binary', 'foo'.encode('utf-8')),
        )

    @mask_modules('yaml')
    def test_register_yaml__no_yaml(self):
        register_yaml()
        with self.assertRaises(SerializerNotInstalled):
            loads('foo', 'application/x-yaml', 'utf-8')

    @mask_modules('msgpack')
    def test_register_msgpack__no_msgpack(self):
        register_msgpack()
        with self.assertRaises(SerializerNotInstalled):
            loads('foo', 'application/x-msgpack', 'utf-8')
