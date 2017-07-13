# -*- coding: utf-8 -*-
"""
kombu.utils.encoding
~~~~~~~~~~~~~~~~~~~~~

Utilities to encode text, and to safely emit text from running
applications without crashing with the infamous :exc:`UnicodeDecodeError`
exception.

"""
from __future__ import absolute_import

import sys
import traceback

from kombu.five import text_t

is_py3k = sys.version_info >= (3, 0)

#: safe_str takes encoding from this file by default.
#: :func:`set_default_encoding_file` can used to set the
#: default output file.
default_encoding_file = None


def set_default_encoding_file(file):
    global default_encoding_file
    default_encoding_file = file


def get_default_encoding_file():
    return default_encoding_file


if sys.platform.startswith('java'):     # pragma: no cover

    def default_encoding(file=None):
        return 'utf-8'
else:

    def default_encoding(file=None):  # noqa
        file = file or get_default_encoding_file()
        return getattr(file, 'encoding', None) or sys.getfilesystemencoding()

if is_py3k:  # pragma: no cover

    def str_to_bytes(s):
        if isinstance(s, str):
            return s.encode()
        return s

    def bytes_to_str(s):
        if isinstance(s, bytes):
            return s.decode()
        return s

    def from_utf8(s, *args, **kwargs):
        return s

    def ensure_bytes(s):
        if not isinstance(s, bytes):
            return str_to_bytes(s)
        return s

    def default_encode(obj):
        return obj

    str_t = str

else:

    def str_to_bytes(s):                # noqa
        if isinstance(s, unicode):
            return s.encode()
        return s

    def bytes_to_str(s):                # noqa
        return s

    def from_utf8(s, *args, **kwargs):  # noqa
        return s.encode('utf-8', *args, **kwargs)

    def default_encode(obj, file=None):            # noqa
        return unicode(obj, default_encoding(file))

    str_t = unicode
    ensure_bytes = str_to_bytes


try:
    bytes_t = bytes
except NameError:  # pragma: no cover
    bytes_t = str  # noqa


def safe_str(s, errors='replace'):
    s = bytes_to_str(s)
    if not isinstance(s, (text_t, bytes)):
        return safe_repr(s, errors)
    return _safe_str(s, errors)


if is_py3k:

    def _safe_str(s, errors='replace', file=None):
        if isinstance(s, str):
            return s
        try:
            return str(s)
        except Exception as exc:
            return '<Unrepresentable {0!r}: {1!r} {2!r}>'.format(
                type(s), exc, '\n'.join(traceback.format_stack()))
else:
    def _safe_str(s, errors='replace', file=None):  # noqa
        encoding = default_encoding(file)
        try:
            if isinstance(s, unicode):
                return s.encode(encoding, errors)
            return unicode(s, encoding, errors)
        except Exception as exc:
            return '<Unrepresentable {0!r}: {1!r} {2!r}>'.format(
                type(s), exc, '\n'.join(traceback.format_stack()))


def safe_repr(o, errors='replace'):
    try:
        return repr(o)
    except Exception:
        return _safe_str(o, errors)
