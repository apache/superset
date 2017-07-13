# This file is dual licensed under the terms of the Apache License, Version
# 2.0, and the BSD License. See the LICENSE file in the root of this repository
# for complete details.

from __future__ import absolute_import, division, print_function

import struct

from cryptography.hazmat.primitives.ciphers import Cipher
from cryptography.hazmat.primitives.ciphers.algorithms import AES
from cryptography.hazmat.primitives.ciphers.modes import ECB
from cryptography.hazmat.primitives.constant_time import bytes_eq


def aes_key_wrap(wrapping_key, key_to_wrap, backend):
    if len(wrapping_key) not in [16, 24, 32]:
        raise ValueError("The wrapping key must be a valid AES key length")

    if len(key_to_wrap) < 16:
        raise ValueError("The key to wrap must be at least 16 bytes")

    if len(key_to_wrap) % 8 != 0:
        raise ValueError("The key to wrap must be a multiple of 8 bytes")

    # RFC 3394 Key Wrap - 2.2.1 (index method)
    encryptor = Cipher(AES(wrapping_key), ECB(), backend).encryptor()
    a = b"\xa6\xa6\xa6\xa6\xa6\xa6\xa6\xa6"
    r = [key_to_wrap[i:i + 8] for i in range(0, len(key_to_wrap), 8)]
    n = len(r)
    for j in range(6):
        for i in range(n):
            # every encryption operation is a discrete 16 byte chunk (because
            # AES has a 128-bit block size) and since we're using ECB it is
            # safe to reuse the encryptor for the entire operation
            b = encryptor.update(a + r[i])
            # pack/unpack are safe as these are always 64-bit chunks
            a = struct.pack(
                ">Q", struct.unpack(">Q", b[:8])[0] ^ ((n * j) + i + 1)
            )
            r[i] = b[-8:]

    assert encryptor.finalize() == b""

    return a + b"".join(r)


def aes_key_unwrap(wrapping_key, wrapped_key, backend):
    if len(wrapped_key) < 24:
        raise ValueError("Must be at least 24 bytes")

    if len(wrapped_key) % 8 != 0:
        raise ValueError("The wrapped key must be a multiple of 8 bytes")

    if len(wrapping_key) not in [16, 24, 32]:
        raise ValueError("The wrapping key must be a valid AES key length")

    # Implement RFC 3394 Key Unwrap - 2.2.2 (index method)
    decryptor = Cipher(AES(wrapping_key), ECB(), backend).decryptor()
    aiv = b"\xa6\xa6\xa6\xa6\xa6\xa6\xa6\xa6"

    r = [wrapped_key[i:i + 8] for i in range(0, len(wrapped_key), 8)]
    a = r.pop(0)
    n = len(r)
    for j in reversed(range(6)):
        for i in reversed(range(n)):
            # pack/unpack are safe as these are always 64-bit chunks
            atr = struct.pack(
                ">Q", struct.unpack(">Q", a)[0] ^ ((n * j) + i + 1)
            ) + r[i]
            # every decryption operation is a discrete 16 byte chunk so
            # it is safe to reuse the decryptor for the entire operation
            b = decryptor.update(atr)
            a = b[:8]
            r[i] = b[-8:]

    assert decryptor.finalize() == b""

    if not bytes_eq(a, aiv):
        raise InvalidUnwrap()

    return b"".join(r)


class InvalidUnwrap(Exception):
    pass
