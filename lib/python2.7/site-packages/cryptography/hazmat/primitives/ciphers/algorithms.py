# This file is dual licensed under the terms of the Apache License, Version
# 2.0, and the BSD License. See the LICENSE file in the root of this repository
# for complete details.

from __future__ import absolute_import, division, print_function

from cryptography import utils
from cryptography.hazmat.primitives.ciphers import (
    BlockCipherAlgorithm, CipherAlgorithm
)


def _verify_key_size(algorithm, key):
    # Verify that the key size matches the expected key size
    if len(key) * 8 not in algorithm.key_sizes:
        raise ValueError("Invalid key size ({0}) for {1}.".format(
            len(key) * 8, algorithm.name
        ))
    return key


@utils.register_interface(BlockCipherAlgorithm)
@utils.register_interface(CipherAlgorithm)
class AES(object):
    name = "AES"
    block_size = 128
    key_sizes = frozenset([128, 192, 256])

    def __init__(self, key):
        self.key = _verify_key_size(self, key)

    @property
    def key_size(self):
        return len(self.key) * 8


@utils.register_interface(BlockCipherAlgorithm)
@utils.register_interface(CipherAlgorithm)
class Camellia(object):
    name = "camellia"
    block_size = 128
    key_sizes = frozenset([128, 192, 256])

    def __init__(self, key):
        self.key = _verify_key_size(self, key)

    @property
    def key_size(self):
        return len(self.key) * 8


@utils.register_interface(BlockCipherAlgorithm)
@utils.register_interface(CipherAlgorithm)
class TripleDES(object):
    name = "3DES"
    block_size = 64
    key_sizes = frozenset([64, 128, 192])

    def __init__(self, key):
        if len(key) == 8:
            key += key + key
        elif len(key) == 16:
            key += key[:8]
        self.key = _verify_key_size(self, key)

    @property
    def key_size(self):
        return len(self.key) * 8


@utils.register_interface(BlockCipherAlgorithm)
@utils.register_interface(CipherAlgorithm)
class Blowfish(object):
    name = "Blowfish"
    block_size = 64
    key_sizes = frozenset(range(32, 449, 8))

    def __init__(self, key):
        self.key = _verify_key_size(self, key)

    @property
    def key_size(self):
        return len(self.key) * 8


@utils.register_interface(BlockCipherAlgorithm)
@utils.register_interface(CipherAlgorithm)
class CAST5(object):
    name = "CAST5"
    block_size = 64
    key_sizes = frozenset(range(40, 129, 8))

    def __init__(self, key):
        self.key = _verify_key_size(self, key)

    @property
    def key_size(self):
        return len(self.key) * 8


@utils.register_interface(CipherAlgorithm)
class ARC4(object):
    name = "RC4"
    key_sizes = frozenset([40, 56, 64, 80, 128, 160, 192, 256])

    def __init__(self, key):
        self.key = _verify_key_size(self, key)

    @property
    def key_size(self):
        return len(self.key) * 8


@utils.register_interface(CipherAlgorithm)
class IDEA(object):
    name = "IDEA"
    block_size = 64
    key_sizes = frozenset([128])

    def __init__(self, key):
        self.key = _verify_key_size(self, key)

    @property
    def key_size(self):
        return len(self.key) * 8


@utils.register_interface(BlockCipherAlgorithm)
@utils.register_interface(CipherAlgorithm)
class SEED(object):
    name = "SEED"
    block_size = 128
    key_sizes = frozenset([128])

    def __init__(self, key):
        self.key = _verify_key_size(self, key)

    @property
    def key_size(self):
        return len(self.key) * 8
