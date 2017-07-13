# This file is dual licensed under the terms of the Apache License, Version
# 2.0, and the BSD License. See the LICENSE file in the root of this repository
# for complete details.

from __future__ import absolute_import, division, print_function

import six

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric.utils import Prehashed


def _truncate_digest(digest, order_bits):
    digest_len = len(digest)

    if 8 * digest_len > order_bits:
        digest_len = (order_bits + 7) // 8
        digest = digest[:digest_len]

    if 8 * digest_len > order_bits:
        rshift = 8 - (order_bits & 0x7)
        assert 0 < rshift < 8

        mask = 0xFF >> rshift << rshift

        # Set the bottom rshift bits to 0
        digest = digest[:-1] + six.int2byte(six.indexbytes(digest, -1) & mask)

    return digest


def _calculate_digest_and_algorithm(backend, data, algorithm):
    if not isinstance(algorithm, Prehashed):
        hash_ctx = hashes.Hash(algorithm, backend)
        hash_ctx.update(data)
        data = hash_ctx.finalize()
    else:
        algorithm = algorithm._algorithm

    if len(data) != algorithm.digest_size:
        raise ValueError(
            "The provided data must be the same length as the hash "
            "algorithm's digest size."
        )

    return (data, algorithm)
