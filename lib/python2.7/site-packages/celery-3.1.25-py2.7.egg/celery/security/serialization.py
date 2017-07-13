# -*- coding: utf-8 -*-
"""
    celery.security.serialization
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

    Secure serializer.

"""
from __future__ import absolute_import

import base64

from kombu.serialization import registry, dumps, loads
from kombu.utils.encoding import bytes_to_str, str_to_bytes, ensure_bytes

from .certificate import Certificate, FSCertStore
from .key import PrivateKey
from .utils import reraise_errors

__all__ = ['SecureSerializer', 'register_auth']


def b64encode(s):
    return bytes_to_str(base64.b64encode(str_to_bytes(s)))


def b64decode(s):
    return base64.b64decode(str_to_bytes(s))


class SecureSerializer(object):

    def __init__(self, key=None, cert=None, cert_store=None,
                 digest='sha1', serializer='json'):
        self._key = key
        self._cert = cert
        self._cert_store = cert_store
        self._digest = digest
        self._serializer = serializer

    def serialize(self, data):
        """serialize data structure into string"""
        assert self._key is not None
        assert self._cert is not None
        with reraise_errors('Unable to serialize: {0!r}', (Exception, )):
            content_type, content_encoding, body = dumps(
                bytes_to_str(data), serializer=self._serializer)
            # What we sign is the serialized body, not the body itself.
            # this way the receiver doesn't have to decode the contents
            # to verify the signature (and thus avoiding potential flaws
            # in the decoding step).
            body = ensure_bytes(body)
            return self._pack(body, content_type, content_encoding,
                              signature=self._key.sign(body, self._digest),
                              signer=self._cert.get_id())

    def deserialize(self, data):
        """deserialize data structure from string"""
        assert self._cert_store is not None
        with reraise_errors('Unable to deserialize: {0!r}', (Exception, )):
            payload = self._unpack(data)
            signature, signer, body = (payload['signature'],
                                       payload['signer'],
                                       payload['body'])
            self._cert_store[signer].verify(body, signature, self._digest)
        return loads(bytes_to_str(body), payload['content_type'],
                     payload['content_encoding'], force=True)

    def _pack(self, body, content_type, content_encoding, signer, signature,
              sep=str_to_bytes('\x00\x01')):
        fields = sep.join(
            ensure_bytes(s) for s in [signer, signature, content_type,
                                      content_encoding, body]
        )
        return b64encode(fields)

    def _unpack(self, payload, sep=str_to_bytes('\x00\x01')):
        raw_payload = b64decode(ensure_bytes(payload))
        first_sep = raw_payload.find(sep)

        signer = raw_payload[:first_sep]
        signer_cert = self._cert_store[signer]

        sig_len = signer_cert._cert.get_pubkey().bits() >> 3
        signature = raw_payload[
            first_sep + len(sep):first_sep + len(sep) + sig_len
        ]
        end_of_sig = first_sep + len(sep) + sig_len + len(sep)

        v = raw_payload[end_of_sig:].split(sep)

        return {
            'signer': signer,
            'signature': signature,
            'content_type': bytes_to_str(v[0]),
            'content_encoding': bytes_to_str(v[1]),
            'body': bytes_to_str(v[2]),
        }


def register_auth(key=None, cert=None, store=None, digest='sha1',
                  serializer='json'):
    """register security serializer"""
    s = SecureSerializer(key and PrivateKey(key),
                         cert and Certificate(cert),
                         store and FSCertStore(store),
                         digest=digest, serializer=serializer)
    registry.register('auth', s.serialize, s.deserialize,
                      content_type='application/data',
                      content_encoding='utf-8')
