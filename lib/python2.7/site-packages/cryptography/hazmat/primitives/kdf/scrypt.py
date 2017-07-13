# This file is dual licensed under the terms of the Apache License, Version
# 2.0, and the BSD License. See the LICENSE file in the root of this repository
# for complete details.

from __future__ import absolute_import, division, print_function

from cryptography import utils
from cryptography.exceptions import (
    AlreadyFinalized, InvalidKey, UnsupportedAlgorithm, _Reasons
)
from cryptography.hazmat.backends.interfaces import ScryptBackend
from cryptography.hazmat.primitives import constant_time
from cryptography.hazmat.primitives.kdf import KeyDerivationFunction


@utils.register_interface(KeyDerivationFunction)
class Scrypt(object):
    def __init__(self, salt, length, n, r, p, backend):
        if not isinstance(backend, ScryptBackend):
            raise UnsupportedAlgorithm(
                "Backend object does not implement ScryptBackend.",
                _Reasons.BACKEND_MISSING_INTERFACE
            )

        self._length = length
        if not isinstance(salt, bytes):
            raise TypeError("salt must be bytes.")

        if n < 2 or (n & (n - 1)) != 0:
            raise ValueError("n must be greater than 1 and be a power of 2.")

        if r < 1:
            raise ValueError("r must be greater than or equal to 1.")

        if p < 1:
            raise ValueError("p must be greater than or equal to 1.")

        self._used = False
        self._salt = salt
        self._n = n
        self._r = r
        self._p = p
        self._backend = backend

    def derive(self, key_material):
        if self._used:
            raise AlreadyFinalized("Scrypt instances can only be used once.")
        self._used = True

        if not isinstance(key_material, bytes):
            raise TypeError("key_material must be bytes.")
        return self._backend.derive_scrypt(
            key_material, self._salt, self._length, self._n, self._r, self._p
        )

    def verify(self, key_material, expected_key):
        derived_key = self.derive(key_material)
        if not constant_time.bytes_eq(derived_key, expected_key):
            raise InvalidKey("Keys do not match.")
