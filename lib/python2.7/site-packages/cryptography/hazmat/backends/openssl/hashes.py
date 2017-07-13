# This file is dual licensed under the terms of the Apache License, Version
# 2.0, and the BSD License. See the LICENSE file in the root of this repository
# for complete details.

from __future__ import absolute_import, division, print_function


from cryptography import utils
from cryptography.exceptions import UnsupportedAlgorithm, _Reasons
from cryptography.hazmat.primitives import hashes


@utils.register_interface(hashes.HashContext)
class _HashContext(object):
    def __init__(self, backend, algorithm, ctx=None):
        self._algorithm = algorithm

        self._backend = backend

        if ctx is None:
            ctx = self._backend._lib.Cryptography_EVP_MD_CTX_new()
            ctx = self._backend._ffi.gc(
                ctx, self._backend._lib.Cryptography_EVP_MD_CTX_free
            )
            name = self._backend._build_openssl_digest_name(algorithm)
            evp_md = self._backend._lib.EVP_get_digestbyname(name)
            if evp_md == self._backend._ffi.NULL:
                raise UnsupportedAlgorithm(
                    "{0} is not a supported hash on this backend.".format(
                        name),
                    _Reasons.UNSUPPORTED_HASH
                )
            res = self._backend._lib.EVP_DigestInit_ex(ctx, evp_md,
                                                       self._backend._ffi.NULL)
            self._backend.openssl_assert(res != 0)

        self._ctx = ctx

    algorithm = utils.read_only_property("_algorithm")

    def copy(self):
        copied_ctx = self._backend._lib.Cryptography_EVP_MD_CTX_new()
        copied_ctx = self._backend._ffi.gc(
            copied_ctx, self._backend._lib.Cryptography_EVP_MD_CTX_free
        )
        res = self._backend._lib.EVP_MD_CTX_copy_ex(copied_ctx, self._ctx)
        self._backend.openssl_assert(res != 0)
        return _HashContext(self._backend, self.algorithm, ctx=copied_ctx)

    def update(self, data):
        res = self._backend._lib.EVP_DigestUpdate(self._ctx, data, len(data))
        self._backend.openssl_assert(res != 0)

    def finalize(self):
        buf = self._backend._ffi.new("unsigned char[]",
                                     self._backend._lib.EVP_MAX_MD_SIZE)
        outlen = self._backend._ffi.new("unsigned int *")
        res = self._backend._lib.EVP_DigestFinal_ex(self._ctx, buf, outlen)
        self._backend.openssl_assert(res != 0)
        self._backend.openssl_assert(outlen[0] == self.algorithm.digest_size)
        return self._backend._ffi.buffer(buf)[:outlen[0]]
