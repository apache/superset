"""
kombu.serialization
===================

Serialization utilities.

"""
from __future__ import absolute_import

import codecs
import os
import sys

import pickle as pypickle
try:
    import cPickle as cpickle
except ImportError:  # pragma: no cover
    cpickle = None  # noqa

from collections import namedtuple
from contextlib import contextmanager

from .exceptions import (
    ContentDisallowed, DecodeError, EncodeError, SerializerNotInstalled
)
from .five import BytesIO, reraise, text_t
from .utils import entrypoints
from .utils.encoding import str_to_bytes, bytes_t

__all__ = ['pickle', 'loads', 'dumps', 'register', 'unregister']
SKIP_DECODE = frozenset(['binary', 'ascii-8bit'])
TRUSTED_CONTENT = frozenset(['application/data', 'application/text'])

if sys.platform.startswith('java'):  # pragma: no cover

    def _decode(t, coding):
        return codecs.getdecoder(coding)(t)[0]
else:
    _decode = codecs.decode

pickle = cpickle or pypickle
pickle_load = pickle.load

#: Kombu requires Python 2.5 or later so we use protocol 2 by default.
#: There's a new protocol (3) but this is only supported by Python 3.
pickle_protocol = int(os.environ.get('PICKLE_PROTOCOL', 2))

codec = namedtuple('codec', ('content_type', 'content_encoding', 'encoder'))


@contextmanager
def _reraise_errors(wrapper,
                    include=(Exception, ), exclude=(SerializerNotInstalled, )):
    try:
        yield
    except exclude:
        raise
    except include as exc:
        reraise(wrapper, wrapper(exc), sys.exc_info()[2])


def pickle_loads(s, load=pickle_load):
    # used to support buffer objects
    return load(BytesIO(s))


def parenthesize_alias(first, second):
    return '%s (%s)' % (first, second) if first else second


class SerializerRegistry(object):
    """The registry keeps track of serialization methods."""

    def __init__(self):
        self._encoders = {}
        self._decoders = {}
        self._default_encode = None
        self._default_content_type = None
        self._default_content_encoding = None
        self._disabled_content_types = set()
        self.type_to_name = {}
        self.name_to_type = {}

    def register(self, name, encoder, decoder, content_type,
                 content_encoding='utf-8'):
        if encoder:
            self._encoders[name] = codec(
                content_type, content_encoding, encoder,
            )
        if decoder:
            self._decoders[content_type] = decoder
        self.type_to_name[content_type] = name
        self.name_to_type[name] = content_type

    def enable(self, name):
        if '/' not in name:
            name = self.name_to_type[name]
        self._disabled_content_types.discard(name)

    def disable(self, name):
        if '/' not in name:
            name = self.name_to_type[name]
        self._disabled_content_types.add(name)

    def unregister(self, name):
        try:
            content_type = self.name_to_type[name]
            self._decoders.pop(content_type, None)
            self._encoders.pop(name, None)
            self.type_to_name.pop(content_type, None)
            self.name_to_type.pop(name, None)
        except KeyError:
            raise SerializerNotInstalled(
                'No encoder/decoder installed for {0}'.format(name))

    def _set_default_serializer(self, name):
        """
        Set the default serialization method used by this library.

        :param name: The name of the registered serialization method.
            For example, `json` (default), `pickle`, `yaml`, `msgpack`,
            or any custom methods registered using :meth:`register`.

        :raises SerializerNotInstalled: If the serialization method
            requested is not available.
        """
        try:
            (self._default_content_type, self._default_content_encoding,
             self._default_encode) = self._encoders[name]
        except KeyError:
            raise SerializerNotInstalled(
                'No encoder installed for {0}'.format(name))

    def dumps(self, data, serializer=None):
        if serializer == 'raw':
            return raw_encode(data)
        if serializer and not self._encoders.get(serializer):
            raise SerializerNotInstalled(
                'No encoder installed for {0}'.format(serializer))

        # If a raw string was sent, assume binary encoding
        # (it's likely either ASCII or a raw binary file, and a character
        # set of 'binary' will encompass both, even if not ideal.
        if not serializer and isinstance(data, bytes_t):
            # In Python 3+, this would be "bytes"; allow binary data to be
            # sent as a message without getting encoder errors
            return 'application/data', 'binary', data

        # For Unicode objects, force it into a string
        if not serializer and isinstance(data, text_t):
            with _reraise_errors(EncodeError, exclude=()):
                payload = data.encode('utf-8')
            return 'text/plain', 'utf-8', payload

        if serializer:
            content_type, content_encoding, encoder = \
                self._encoders[serializer]
        else:
            encoder = self._default_encode
            content_type = self._default_content_type
            content_encoding = self._default_content_encoding

        with _reraise_errors(EncodeError):
            payload = encoder(data)
        return content_type, content_encoding, payload
    encode = dumps  # XXX compat

    def loads(self, data, content_type, content_encoding,
              accept=None, force=False, _trusted_content=TRUSTED_CONTENT):
        content_type = content_type or 'application/data'
        if accept is not None:
            if content_type not in _trusted_content \
                    and content_type not in accept:
                raise self._for_untrusted_content(content_type, 'untrusted')
        else:
            if content_type in self._disabled_content_types and not force:
                raise self._for_untrusted_content(content_type, 'disabled')
        content_encoding = (content_encoding or 'utf-8').lower()

        if data:
            decode = self._decoders.get(content_type)
            if decode:
                with _reraise_errors(DecodeError):
                    return decode(data)
            if content_encoding not in SKIP_DECODE and \
                    not isinstance(data, text_t):
                with _reraise_errors(DecodeError):
                    return _decode(data, content_encoding)
        return data
    decode = loads  # XXX compat

    def _for_untrusted_content(self, ctype, why):
        return ContentDisallowed(
            'Refusing to deserialize {0} content of type {1}'.format(
                why,
                parenthesize_alias(self.type_to_name.get(ctype, ctype), ctype),
            ),
        )


#: Global registry of serializers/deserializers.
registry = SerializerRegistry()


"""
.. function:: dumps(data, serializer=default_serializer)

    Serialize a data structure into a string suitable for sending
    as an AMQP message body.

    :param data: The message data to send. Can be a list,
        dictionary or a string.

    :keyword serializer: An optional string representing
        the serialization method you want the data marshalled
        into. (For example, `json`, `raw`, or `pickle`).

        If :const:`None` (default), then json will be used, unless
        `data` is a :class:`str` or :class:`unicode` object. In this
        latter case, no serialization occurs as it would be
        unnecessary.

        Note that if `serializer` is specified, then that
        serialization method will be used even if a :class:`str`
        or :class:`unicode` object is passed in.

    :returns: A three-item tuple containing the content type
        (e.g., `application/json`), content encoding, (e.g.,
        `utf-8`) and a string containing the serialized
        data.

    :raises SerializerNotInstalled: If the serialization method
            requested is not available.
"""
dumps = encode = registry.encode   # XXX encode is a compat alias

"""
.. function:: loads(data, content_type, content_encoding):

    Deserialize a data stream as serialized using `dumps`
    based on `content_type`.

    :param data: The message data to deserialize.

    :param content_type: The content-type of the data.
        (e.g., `application/json`).

    :param content_encoding: The content-encoding of the data.
        (e.g., `utf-8`, `binary`, or `us-ascii`).

    :returns: The unserialized data.

"""
loads = decode = registry.decode  # XXX decode is a compat alias


"""
.. function:: register(name, encoder, decoder, content_type,
                       content_encoding='utf-8'):
    Register a new encoder/decoder.

    :param name: A convenience name for the serialization method.

    :param encoder: A method that will be passed a python data structure
        and should return a string representing the serialized data.
        If :const:`None`, then only a decoder will be registered. Encoding
        will not be possible.

    :param decoder: A method that will be passed a string representing
        serialized data and should return a python data structure.
        If :const:`None`, then only an encoder will be registered.
        Decoding will not be possible.

    :param content_type: The mime-type describing the serialized
        structure.

    :param content_encoding: The content encoding (character set) that
        the `decoder` method will be returning. Will usually be
        `utf-8`, `us-ascii`, or `binary`.

"""
register = registry.register


"""
.. function:: unregister(name):
    Unregister registered encoder/decoder.

    :param name: Registered serialization method name.

"""
unregister = registry.unregister


def raw_encode(data):
    """Special case serializer."""
    content_type = 'application/data'
    payload = data
    if isinstance(payload, text_t):
        content_encoding = 'utf-8'
        with _reraise_errors(EncodeError, exclude=()):
            payload = payload.encode(content_encoding)
    else:
        content_encoding = 'binary'
    return content_type, content_encoding, payload


def register_json():
    """Register a encoder/decoder for JSON serialization."""
    from anyjson import loads as json_loads, dumps as json_dumps

    def _loads(obj):
        if isinstance(obj, bytes_t):
            obj = obj.decode('utf-8')
        return json_loads(obj)

    registry.register('json', json_dumps, _loads,
                      content_type='application/json',
                      content_encoding='utf-8')


def register_yaml():
    """Register a encoder/decoder for YAML serialization.

    It is slower than JSON, but allows for more data types
    to be serialized. Useful if you need to send data such as dates"""
    try:
        import yaml
        registry.register('yaml', yaml.safe_dump, yaml.safe_load,
                          content_type='application/x-yaml',
                          content_encoding='utf-8')
    except ImportError:

        def not_available(*args, **kwargs):
            """In case a client receives a yaml message, but yaml
            isn't installed."""
            raise SerializerNotInstalled(
                'No decoder installed for YAML. Install the PyYAML library')
        registry.register('yaml', None, not_available, 'application/x-yaml')


if sys.version_info[0] == 3:  # pragma: no cover

    def unpickle(s):
        return pickle_loads(str_to_bytes(s))

else:
    unpickle = pickle_loads  # noqa


def register_pickle():
    """The fastest serialization method, but restricts
    you to python clients."""

    def pickle_dumps(obj, dumper=pickle.dumps):
        return dumper(obj, protocol=pickle_protocol)

    registry.register('pickle', pickle_dumps, unpickle,
                      content_type='application/x-python-serialize',
                      content_encoding='binary')


def register_msgpack():
    """See http://msgpack.sourceforge.net/"""
    pack = unpack = None
    try:
        import msgpack
        if msgpack.version >= (0, 4):
            from msgpack import packb, unpackb

            def pack(s):
                return packb(s, use_bin_type=True)

            def unpack(s):
                return unpackb(s, encoding='utf-8')
        else:
            def version_mismatch(*args, **kwargs):
                raise SerializerNotInstalled(
                    'msgpack requires msgpack-python >= 0.4.0')
            pack = unpack = version_mismatch
    except (ImportError, ValueError):
        def not_available(*args, **kwargs):
            raise SerializerNotInstalled(
                'No decoder installed for msgpack. '
                'Please install the msgpack-python library')
        pack = unpack = not_available
    registry.register(
        'msgpack', pack, unpack,
        content_type='application/x-msgpack',
        content_encoding='binary',
    )

# Register the base serialization methods.
register_json()
register_pickle()
register_yaml()
register_msgpack()

# Default serializer is 'json'
registry._set_default_serializer('json')


_setupfuns = {
    'json': register_json,
    'pickle': register_pickle,
    'yaml': register_yaml,
    'msgpack': register_msgpack,
    'application/json': register_json,
    'application/x-yaml': register_yaml,
    'application/x-python-serialize': register_pickle,
    'application/x-msgpack': register_msgpack,
}


def enable_insecure_serializers(choices=['pickle', 'yaml', 'msgpack']):
    """Enable serializers that are considered to be unsafe.

    Will enable ``pickle``, ``yaml`` and ``msgpack`` by default,
    but you can also specify a list of serializers (by name or content type)
    to enable.

    """
    for choice in choices:
        try:
            registry.enable(choice)
        except KeyError:
            pass


def disable_insecure_serializers(allowed=['json']):
    """Disable untrusted serializers.

    Will disable all serializers except ``json``
    or you can specify a list of deserializers to allow.

    .. note::

        Producers will still be able to serialize data
        in these formats, but consumers will not accept
        incoming data using the untrusted content types.

    """
    for name in registry._decoders:
        registry.disable(name)
    if allowed is not None:
        for name in allowed:
            registry.enable(name)


# Insecure serializers are disabled by default since v3.0
disable_insecure_serializers()

# Load entrypoints from installed extensions
for ep, args in entrypoints('kombu.serializers'):  # pragma: no cover
    register(ep.name, *args)


def prepare_accept_content(l, name_to_type=registry.name_to_type):
    if l is not None:
        return set(n if '/' in n else name_to_type[n] for n in l)
    return l
