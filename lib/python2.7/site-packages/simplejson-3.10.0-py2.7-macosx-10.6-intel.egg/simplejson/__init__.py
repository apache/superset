r"""JSON (JavaScript Object Notation) <http://json.org> is a subset of
JavaScript syntax (ECMA-262 3rd edition) used as a lightweight data
interchange format.

:mod:`simplejson` exposes an API familiar to users of the standard library
:mod:`marshal` and :mod:`pickle` modules. It is the externally maintained
version of the :mod:`json` library contained in Python 2.6, but maintains
compatibility back to Python 2.5 and (currently) has significant performance
advantages, even without using the optional C extension for speedups.

Encoding basic Python object hierarchies::

    >>> import simplejson as json
    >>> json.dumps(['foo', {'bar': ('baz', None, 1.0, 2)}])
    '["foo", {"bar": ["baz", null, 1.0, 2]}]'
    >>> print(json.dumps("\"foo\bar"))
    "\"foo\bar"
    >>> print(json.dumps(u'\u1234'))
    "\u1234"
    >>> print(json.dumps('\\'))
    "\\"
    >>> print(json.dumps({"c": 0, "b": 0, "a": 0}, sort_keys=True))
    {"a": 0, "b": 0, "c": 0}
    >>> from simplejson.compat import StringIO
    >>> io = StringIO()
    >>> json.dump(['streaming API'], io)
    >>> io.getvalue()
    '["streaming API"]'

Compact encoding::

    >>> import simplejson as json
    >>> obj = [1,2,3,{'4': 5, '6': 7}]
    >>> json.dumps(obj, separators=(',',':'), sort_keys=True)
    '[1,2,3,{"4":5,"6":7}]'

Pretty printing::

    >>> import simplejson as json
    >>> print(json.dumps({'4': 5, '6': 7}, sort_keys=True, indent='    '))
    {
        "4": 5,
        "6": 7
    }

Decoding JSON::

    >>> import simplejson as json
    >>> obj = [u'foo', {u'bar': [u'baz', None, 1.0, 2]}]
    >>> json.loads('["foo", {"bar":["baz", null, 1.0, 2]}]') == obj
    True
    >>> json.loads('"\\"foo\\bar"') == u'"foo\x08ar'
    True
    >>> from simplejson.compat import StringIO
    >>> io = StringIO('["streaming API"]')
    >>> json.load(io)[0] == 'streaming API'
    True

Specializing JSON object decoding::

    >>> import simplejson as json
    >>> def as_complex(dct):
    ...     if '__complex__' in dct:
    ...         return complex(dct['real'], dct['imag'])
    ...     return dct
    ...
    >>> json.loads('{"__complex__": true, "real": 1, "imag": 2}',
    ...     object_hook=as_complex)
    (1+2j)
    >>> from decimal import Decimal
    >>> json.loads('1.1', parse_float=Decimal) == Decimal('1.1')
    True

Specializing JSON object encoding::

    >>> import simplejson as json
    >>> def encode_complex(obj):
    ...     if isinstance(obj, complex):
    ...         return [obj.real, obj.imag]
    ...     raise TypeError(repr(o) + " is not JSON serializable")
    ...
    >>> json.dumps(2 + 1j, default=encode_complex)
    '[2.0, 1.0]'
    >>> json.JSONEncoder(default=encode_complex).encode(2 + 1j)
    '[2.0, 1.0]'
    >>> ''.join(json.JSONEncoder(default=encode_complex).iterencode(2 + 1j))
    '[2.0, 1.0]'


Using simplejson.tool from the shell to validate and pretty-print::

    $ echo '{"json":"obj"}' | python -m simplejson.tool
    {
        "json": "obj"
    }
    $ echo '{ 1.2:3.4}' | python -m simplejson.tool
    Expecting property name: line 1 column 3 (char 2)
"""
from __future__ import absolute_import
__version__ = '3.10.0'
__all__ = [
    'dump', 'dumps', 'load', 'loads',
    'JSONDecoder', 'JSONDecodeError', 'JSONEncoder',
    'OrderedDict', 'simple_first',
]

__author__ = 'Bob Ippolito <bob@redivi.com>'

from decimal import Decimal

from .scanner import JSONDecodeError
from .decoder import JSONDecoder
from .encoder import JSONEncoder, JSONEncoderForHTML, RawJSON
def _import_OrderedDict():
    import collections
    try:
        return collections.OrderedDict
    except AttributeError:
        from . import ordered_dict
        return ordered_dict.OrderedDict
OrderedDict = _import_OrderedDict()

def _import_c_make_encoder():
    try:
        from ._speedups import make_encoder
        return make_encoder
    except ImportError:
        return None

_default_encoder = JSONEncoder(
    skipkeys=False,
    ensure_ascii=True,
    check_circular=True,
    allow_nan=True,
    indent=None,
    separators=None,
    encoding='utf-8',
    default=None,
    use_decimal=True,
    namedtuple_as_object=True,
    tuple_as_array=True,
    iterable_as_array=False,
    bigint_as_string=False,
    item_sort_key=None,
    for_json=False,
    ignore_nan=False,
    int_as_string_bitcount=None,
)

def dump(obj, fp, skipkeys=False, ensure_ascii=True, check_circular=True,
         allow_nan=True, cls=None, indent=None, separators=None,
         encoding='utf-8', default=None, use_decimal=True,
         namedtuple_as_object=True, tuple_as_array=True,
         bigint_as_string=False, sort_keys=False, item_sort_key=None,
         for_json=False, ignore_nan=False, int_as_string_bitcount=None,
         iterable_as_array=False, **kw):
    """Serialize ``obj`` as a JSON formatted stream to ``fp`` (a
    ``.write()``-supporting file-like object).

    If *skipkeys* is true then ``dict`` keys that are not basic types
    (``str``, ``unicode``, ``int``, ``long``, ``float``, ``bool``, ``None``)
    will be skipped instead of raising a ``TypeError``.

    If *ensure_ascii* is false, then the some chunks written to ``fp``
    may be ``unicode`` instances, subject to normal Python ``str`` to
    ``unicode`` coercion rules. Unless ``fp.write()`` explicitly
    understands ``unicode`` (as in ``codecs.getwriter()``) this is likely
    to cause an error.

    If *check_circular* is false, then the circular reference check
    for container types will be skipped and a circular reference will
    result in an ``OverflowError`` (or worse).

    If *allow_nan* is false, then it will be a ``ValueError`` to
    serialize out of range ``float`` values (``nan``, ``inf``, ``-inf``)
    in strict compliance of the original JSON specification, instead of using
    the JavaScript equivalents (``NaN``, ``Infinity``, ``-Infinity``). See
    *ignore_nan* for ECMA-262 compliant behavior.

    If *indent* is a string, then JSON array elements and object members
    will be pretty-printed with a newline followed by that string repeated
    for each level of nesting. ``None`` (the default) selects the most compact
    representation without any newlines. For backwards compatibility with
    versions of simplejson earlier than 2.1.0, an integer is also accepted
    and is converted to a string with that many spaces.

    If specified, *separators* should be an
    ``(item_separator, key_separator)`` tuple.  The default is ``(', ', ': ')``
    if *indent* is ``None`` and ``(',', ': ')`` otherwise.  To get the most
    compact JSON representation, you should specify ``(',', ':')`` to eliminate
    whitespace.

    *encoding* is the character encoding for str instances, default is UTF-8.

    *default(obj)* is a function that should return a serializable version
    of obj or raise ``TypeError``. The default simply raises ``TypeError``.

    If *use_decimal* is true (default: ``True``) then decimal.Decimal
    will be natively serialized to JSON with full precision.

    If *namedtuple_as_object* is true (default: ``True``),
    :class:`tuple` subclasses with ``_asdict()`` methods will be encoded
    as JSON objects.

    If *tuple_as_array* is true (default: ``True``),
    :class:`tuple` (and subclasses) will be encoded as JSON arrays.

    If *iterable_as_array* is true (default: ``False``),
    any object not in the above table that implements ``__iter__()``
    will be encoded as a JSON array.

    If *bigint_as_string* is true (default: ``False``), ints 2**53 and higher
    or lower than -2**53 will be encoded as strings. This is to avoid the
    rounding that happens in Javascript otherwise. Note that this is still a
    lossy operation that will not round-trip correctly and should be used
    sparingly.

    If *int_as_string_bitcount* is a positive number (n), then int of size
    greater than or equal to 2**n or lower than or equal to -2**n will be
    encoded as strings.

    If specified, *item_sort_key* is a callable used to sort the items in
    each dictionary. This is useful if you want to sort items other than
    in alphabetical order by key. This option takes precedence over
    *sort_keys*.

    If *sort_keys* is true (default: ``False``), the output of dictionaries
    will be sorted by item.

    If *for_json* is true (default: ``False``), objects with a ``for_json()``
    method will use the return value of that method for encoding as JSON
    instead of the object.

    If *ignore_nan* is true (default: ``False``), then out of range
    :class:`float` values (``nan``, ``inf``, ``-inf``) will be serialized as
    ``null`` in compliance with the ECMA-262 specification. If true, this will
    override *allow_nan*.

    To use a custom ``JSONEncoder`` subclass (e.g. one that overrides the
    ``.default()`` method to serialize additional types), specify it with
    the ``cls`` kwarg. NOTE: You should use *default* or *for_json* instead
    of subclassing whenever possible.

    """
    # cached encoder
    if (not skipkeys and ensure_ascii and
        check_circular and allow_nan and
        cls is None and indent is None and separators is None and
        encoding == 'utf-8' and default is None and use_decimal
        and namedtuple_as_object and tuple_as_array and not iterable_as_array
        and not bigint_as_string and not sort_keys
        and not item_sort_key and not for_json
        and not ignore_nan and int_as_string_bitcount is None
        and not kw
    ):
        iterable = _default_encoder.iterencode(obj)
    else:
        if cls is None:
            cls = JSONEncoder
        iterable = cls(skipkeys=skipkeys, ensure_ascii=ensure_ascii,
            check_circular=check_circular, allow_nan=allow_nan, indent=indent,
            separators=separators, encoding=encoding,
            default=default, use_decimal=use_decimal,
            namedtuple_as_object=namedtuple_as_object,
            tuple_as_array=tuple_as_array,
            iterable_as_array=iterable_as_array,
            bigint_as_string=bigint_as_string,
            sort_keys=sort_keys,
            item_sort_key=item_sort_key,
            for_json=for_json,
            ignore_nan=ignore_nan,
            int_as_string_bitcount=int_as_string_bitcount,
            **kw).iterencode(obj)
    # could accelerate with writelines in some versions of Python, at
    # a debuggability cost
    for chunk in iterable:
        fp.write(chunk)


def dumps(obj, skipkeys=False, ensure_ascii=True, check_circular=True,
          allow_nan=True, cls=None, indent=None, separators=None,
          encoding='utf-8', default=None, use_decimal=True,
          namedtuple_as_object=True, tuple_as_array=True,
          bigint_as_string=False, sort_keys=False, item_sort_key=None,
          for_json=False, ignore_nan=False, int_as_string_bitcount=None,
          iterable_as_array=False, **kw):
    """Serialize ``obj`` to a JSON formatted ``str``.

    If ``skipkeys`` is false then ``dict`` keys that are not basic types
    (``str``, ``unicode``, ``int``, ``long``, ``float``, ``bool``, ``None``)
    will be skipped instead of raising a ``TypeError``.

    If ``ensure_ascii`` is false, then the return value will be a
    ``unicode`` instance subject to normal Python ``str`` to ``unicode``
    coercion rules instead of being escaped to an ASCII ``str``.

    If ``check_circular`` is false, then the circular reference check
    for container types will be skipped and a circular reference will
    result in an ``OverflowError`` (or worse).

    If ``allow_nan`` is false, then it will be a ``ValueError`` to
    serialize out of range ``float`` values (``nan``, ``inf``, ``-inf``) in
    strict compliance of the JSON specification, instead of using the
    JavaScript equivalents (``NaN``, ``Infinity``, ``-Infinity``).

    If ``indent`` is a string, then JSON array elements and object members
    will be pretty-printed with a newline followed by that string repeated
    for each level of nesting. ``None`` (the default) selects the most compact
    representation without any newlines. For backwards compatibility with
    versions of simplejson earlier than 2.1.0, an integer is also accepted
    and is converted to a string with that many spaces.

    If specified, ``separators`` should be an
    ``(item_separator, key_separator)`` tuple.  The default is ``(', ', ': ')``
    if *indent* is ``None`` and ``(',', ': ')`` otherwise.  To get the most
    compact JSON representation, you should specify ``(',', ':')`` to eliminate
    whitespace.

    ``encoding`` is the character encoding for str instances, default is UTF-8.

    ``default(obj)`` is a function that should return a serializable version
    of obj or raise TypeError. The default simply raises TypeError.

    If *use_decimal* is true (default: ``True``) then decimal.Decimal
    will be natively serialized to JSON with full precision.

    If *namedtuple_as_object* is true (default: ``True``),
    :class:`tuple` subclasses with ``_asdict()`` methods will be encoded
    as JSON objects.

    If *tuple_as_array* is true (default: ``True``),
    :class:`tuple` (and subclasses) will be encoded as JSON arrays.

    If *iterable_as_array* is true (default: ``False``),
    any object not in the above table that implements ``__iter__()``
    will be encoded as a JSON array.

    If *bigint_as_string* is true (not the default), ints 2**53 and higher
    or lower than -2**53 will be encoded as strings. This is to avoid the
    rounding that happens in Javascript otherwise.

    If *int_as_string_bitcount* is a positive number (n), then int of size
    greater than or equal to 2**n or lower than or equal to -2**n will be
    encoded as strings.

    If specified, *item_sort_key* is a callable used to sort the items in
    each dictionary. This is useful if you want to sort items other than
    in alphabetical order by key. This option takes precendence over
    *sort_keys*.

    If *sort_keys* is true (default: ``False``), the output of dictionaries
    will be sorted by item.

    If *for_json* is true (default: ``False``), objects with a ``for_json()``
    method will use the return value of that method for encoding as JSON
    instead of the object.

    If *ignore_nan* is true (default: ``False``), then out of range
    :class:`float` values (``nan``, ``inf``, ``-inf``) will be serialized as
    ``null`` in compliance with the ECMA-262 specification. If true, this will
    override *allow_nan*.

    To use a custom ``JSONEncoder`` subclass (e.g. one that overrides the
    ``.default()`` method to serialize additional types), specify it with
    the ``cls`` kwarg. NOTE: You should use *default* instead of subclassing
    whenever possible.

    """
    # cached encoder
    if (not skipkeys and ensure_ascii and
        check_circular and allow_nan and
        cls is None and indent is None and separators is None and
        encoding == 'utf-8' and default is None and use_decimal
        and namedtuple_as_object and tuple_as_array and not iterable_as_array
        and not bigint_as_string and not sort_keys
        and not item_sort_key and not for_json
        and not ignore_nan and int_as_string_bitcount is None
        and not kw
    ):
        return _default_encoder.encode(obj)
    if cls is None:
        cls = JSONEncoder
    return cls(
        skipkeys=skipkeys, ensure_ascii=ensure_ascii,
        check_circular=check_circular, allow_nan=allow_nan, indent=indent,
        separators=separators, encoding=encoding, default=default,
        use_decimal=use_decimal,
        namedtuple_as_object=namedtuple_as_object,
        tuple_as_array=tuple_as_array,
        iterable_as_array=iterable_as_array,
        bigint_as_string=bigint_as_string,
        sort_keys=sort_keys,
        item_sort_key=item_sort_key,
        for_json=for_json,
        ignore_nan=ignore_nan,
        int_as_string_bitcount=int_as_string_bitcount,
        **kw).encode(obj)


_default_decoder = JSONDecoder(encoding=None, object_hook=None,
                               object_pairs_hook=None)


def load(fp, encoding=None, cls=None, object_hook=None, parse_float=None,
        parse_int=None, parse_constant=None, object_pairs_hook=None,
        use_decimal=False, namedtuple_as_object=True, tuple_as_array=True,
        **kw):
    """Deserialize ``fp`` (a ``.read()``-supporting file-like object containing
    a JSON document) to a Python object.

    *encoding* determines the encoding used to interpret any
    :class:`str` objects decoded by this instance (``'utf-8'`` by
    default).  It has no effect when decoding :class:`unicode` objects.

    Note that currently only encodings that are a superset of ASCII work,
    strings of other encodings should be passed in as :class:`unicode`.

    *object_hook*, if specified, will be called with the result of every
    JSON object decoded and its return value will be used in place of the
    given :class:`dict`.  This can be used to provide custom
    deserializations (e.g. to support JSON-RPC class hinting).

    *object_pairs_hook* is an optional function that will be called with
    the result of any object literal decode with an ordered list of pairs.
    The return value of *object_pairs_hook* will be used instead of the
    :class:`dict`.  This feature can be used to implement custom decoders
    that rely on the order that the key and value pairs are decoded (for
    example, :func:`collections.OrderedDict` will remember the order of
    insertion). If *object_hook* is also defined, the *object_pairs_hook*
    takes priority.

    *parse_float*, if specified, will be called with the string of every
    JSON float to be decoded.  By default, this is equivalent to
    ``float(num_str)``. This can be used to use another datatype or parser
    for JSON floats (e.g. :class:`decimal.Decimal`).

    *parse_int*, if specified, will be called with the string of every
    JSON int to be decoded.  By default, this is equivalent to
    ``int(num_str)``.  This can be used to use another datatype or parser
    for JSON integers (e.g. :class:`float`).

    *parse_constant*, if specified, will be called with one of the
    following strings: ``'-Infinity'``, ``'Infinity'``, ``'NaN'``.  This
    can be used to raise an exception if invalid JSON numbers are
    encountered.

    If *use_decimal* is true (default: ``False``) then it implies
    parse_float=decimal.Decimal for parity with ``dump``.

    To use a custom ``JSONDecoder`` subclass, specify it with the ``cls``
    kwarg. NOTE: You should use *object_hook* or *object_pairs_hook* instead
    of subclassing whenever possible.

    """
    return loads(fp.read(),
        encoding=encoding, cls=cls, object_hook=object_hook,
        parse_float=parse_float, parse_int=parse_int,
        parse_constant=parse_constant, object_pairs_hook=object_pairs_hook,
        use_decimal=use_decimal, **kw)


def loads(s, encoding=None, cls=None, object_hook=None, parse_float=None,
        parse_int=None, parse_constant=None, object_pairs_hook=None,
        use_decimal=False, **kw):
    """Deserialize ``s`` (a ``str`` or ``unicode`` instance containing a JSON
    document) to a Python object.

    *encoding* determines the encoding used to interpret any
    :class:`str` objects decoded by this instance (``'utf-8'`` by
    default).  It has no effect when decoding :class:`unicode` objects.

    Note that currently only encodings that are a superset of ASCII work,
    strings of other encodings should be passed in as :class:`unicode`.

    *object_hook*, if specified, will be called with the result of every
    JSON object decoded and its return value will be used in place of the
    given :class:`dict`.  This can be used to provide custom
    deserializations (e.g. to support JSON-RPC class hinting).

    *object_pairs_hook* is an optional function that will be called with
    the result of any object literal decode with an ordered list of pairs.
    The return value of *object_pairs_hook* will be used instead of the
    :class:`dict`.  This feature can be used to implement custom decoders
    that rely on the order that the key and value pairs are decoded (for
    example, :func:`collections.OrderedDict` will remember the order of
    insertion). If *object_hook* is also defined, the *object_pairs_hook*
    takes priority.

    *parse_float*, if specified, will be called with the string of every
    JSON float to be decoded.  By default, this is equivalent to
    ``float(num_str)``. This can be used to use another datatype or parser
    for JSON floats (e.g. :class:`decimal.Decimal`).

    *parse_int*, if specified, will be called with the string of every
    JSON int to be decoded.  By default, this is equivalent to
    ``int(num_str)``.  This can be used to use another datatype or parser
    for JSON integers (e.g. :class:`float`).

    *parse_constant*, if specified, will be called with one of the
    following strings: ``'-Infinity'``, ``'Infinity'``, ``'NaN'``.  This
    can be used to raise an exception if invalid JSON numbers are
    encountered.

    If *use_decimal* is true (default: ``False``) then it implies
    parse_float=decimal.Decimal for parity with ``dump``.

    To use a custom ``JSONDecoder`` subclass, specify it with the ``cls``
    kwarg. NOTE: You should use *object_hook* or *object_pairs_hook* instead
    of subclassing whenever possible.

    """
    if (cls is None and encoding is None and object_hook is None and
            parse_int is None and parse_float is None and
            parse_constant is None and object_pairs_hook is None
            and not use_decimal and not kw):
        return _default_decoder.decode(s)
    if cls is None:
        cls = JSONDecoder
    if object_hook is not None:
        kw['object_hook'] = object_hook
    if object_pairs_hook is not None:
        kw['object_pairs_hook'] = object_pairs_hook
    if parse_float is not None:
        kw['parse_float'] = parse_float
    if parse_int is not None:
        kw['parse_int'] = parse_int
    if parse_constant is not None:
        kw['parse_constant'] = parse_constant
    if use_decimal:
        if parse_float is not None:
            raise TypeError("use_decimal=True implies parse_float=Decimal")
        kw['parse_float'] = Decimal
    return cls(encoding=encoding, **kw).decode(s)


def _toggle_speedups(enabled):
    from . import decoder as dec
    from . import encoder as enc
    from . import scanner as scan
    c_make_encoder = _import_c_make_encoder()
    if enabled:
        dec.scanstring = dec.c_scanstring or dec.py_scanstring
        enc.c_make_encoder = c_make_encoder
        enc.encode_basestring_ascii = (enc.c_encode_basestring_ascii or
            enc.py_encode_basestring_ascii)
        scan.make_scanner = scan.c_make_scanner or scan.py_make_scanner
    else:
        dec.scanstring = dec.py_scanstring
        enc.c_make_encoder = None
        enc.encode_basestring_ascii = enc.py_encode_basestring_ascii
        scan.make_scanner = scan.py_make_scanner
    dec.make_scanner = scan.make_scanner
    global _default_decoder
    _default_decoder = JSONDecoder(
        encoding=None,
        object_hook=None,
        object_pairs_hook=None,
    )
    global _default_encoder
    _default_encoder = JSONEncoder(
       skipkeys=False,
       ensure_ascii=True,
       check_circular=True,
       allow_nan=True,
       indent=None,
       separators=None,
       encoding='utf-8',
       default=None,
   )

def simple_first(kv):
    """Helper function to pass to item_sort_key to sort simple
    elements to the top, then container elements.
    """
    return (isinstance(kv[1], (list, dict, tuple)), kv[0])
