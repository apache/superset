from __future__ import absolute_import

from celery.exceptions import SecurityError
from celery.security.key import PrivateKey

from . import CERT1, KEY1, KEY2
from .case import SecurityCase


class test_PrivateKey(SecurityCase):

    def test_valid_private_key(self):
        PrivateKey(KEY1)
        PrivateKey(KEY2)

    def test_invalid_private_key(self):
        self.assertRaises((SecurityError, TypeError), PrivateKey, None)
        self.assertRaises(SecurityError, PrivateKey, '')
        self.assertRaises(SecurityError, PrivateKey, 'foo')
        self.assertRaises(SecurityError, PrivateKey, KEY1[:20] + KEY1[21:])
        self.assertRaises(SecurityError, PrivateKey, CERT1)

    def test_sign(self):
        pkey = PrivateKey(KEY1)
        pkey.sign('test', 'sha1')
        self.assertRaises(ValueError, pkey.sign, 'test', 'unknown')
