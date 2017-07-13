"""
kombu.compression
=================

Compression utilities.

"""
from __future__ import absolute_import

from kombu.utils.encoding import ensure_bytes

import zlib

_aliases = {}
_encoders = {}
_decoders = {}

__all__ = ['register', 'encoders', 'get_encoder',
           'get_decoder', 'compress', 'decompress']


def register(encoder, decoder, content_type, aliases=[]):
    """Register new compression method.

    :param encoder: Function used to compress text.
    :param decoder: Function used to decompress previously compressed text.
    :param content_type: The mime type this compression method identifies as.
    :param aliases: A list of names to associate with this compression method.

    """
    _encoders[content_type] = encoder
    _decoders[content_type] = decoder
    _aliases.update((alias, content_type) for alias in aliases)


def encoders():
    """Return a list of available compression methods."""
    return list(_encoders)


def get_encoder(t):
    """Get encoder by alias name."""
    t = _aliases.get(t, t)
    return _encoders[t], t


def get_decoder(t):
    """Get decoder by alias name."""
    return _decoders[_aliases.get(t, t)]


def compress(body, content_type):
    """Compress text.

    :param body: The text to compress.
    :param content_type: mime-type of compression method to use.

    """
    encoder, content_type = get_encoder(content_type)
    return encoder(ensure_bytes(body)), content_type


def decompress(body, content_type):
    """Decompress compressed text.

    :param body: Previously compressed text to uncompress.
    :param content_type: mime-type of compression method used.

    """
    return get_decoder(content_type)(body)


register(zlib.compress,
         zlib.decompress,
         'application/x-gzip', aliases=['gzip', 'zlib'])
try:
    import bz2
except ImportError:
    pass  # Jython?
else:
    register(bz2.compress,
             bz2.decompress,
             'application/x-bz2', aliases=['bzip2', 'bzip'])
