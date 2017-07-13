from __future__ import absolute_import

import os
import base64

from kombu.serialization import registry

from celery.exceptions import SecurityError
from celery.security.serialization import SecureSerializer, register_auth
from celery.security.certificate import Certificate, CertStore
from celery.security.key import PrivateKey

from . import CERT1, CERT2, KEY1, KEY2
from .case import SecurityCase


class test_SecureSerializer(SecurityCase):

    def _get_s(self, key, cert, certs):
        store = CertStore()
        for c in certs:
            store.add_cert(Certificate(c))
        return SecureSerializer(PrivateKey(key), Certificate(cert), store)

    def test_serialize(self):
        s = self._get_s(KEY1, CERT1, [CERT1])
        self.assertEqual(s.deserialize(s.serialize('foo')), 'foo')

    def test_deserialize(self):
        s = self._get_s(KEY1, CERT1, [CERT1])
        self.assertRaises(SecurityError, s.deserialize, 'bad data')

    def test_unmatched_key_cert(self):
        s = self._get_s(KEY1, CERT2, [CERT1, CERT2])
        self.assertRaises(SecurityError,
                          s.deserialize, s.serialize('foo'))

    def test_unknown_source(self):
        s1 = self._get_s(KEY1, CERT1, [CERT2])
        s2 = self._get_s(KEY1, CERT1, [])
        self.assertRaises(SecurityError,
                          s1.deserialize, s1.serialize('foo'))
        self.assertRaises(SecurityError,
                          s2.deserialize, s2.serialize('foo'))

    def test_self_send(self):
        s1 = self._get_s(KEY1, CERT1, [CERT1])
        s2 = self._get_s(KEY1, CERT1, [CERT1])
        self.assertEqual(s2.deserialize(s1.serialize('foo')), 'foo')

    def test_separate_ends(self):
        s1 = self._get_s(KEY1, CERT1, [CERT2])
        s2 = self._get_s(KEY2, CERT2, [CERT1])
        self.assertEqual(s2.deserialize(s1.serialize('foo')), 'foo')

    def test_register_auth(self):
        register_auth(KEY1, CERT1, '')
        self.assertIn('application/data', registry._decoders)

    def test_lots_of_sign(self):
        for i in range(1000):
            rdata = base64.urlsafe_b64encode(os.urandom(265))
            s = self._get_s(KEY1, CERT1, [CERT1])
            self.assertEqual(s.deserialize(s.serialize(rdata)), rdata)
