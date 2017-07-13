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
            try:
                methods = self._backend._hash_mapping[self.algorithm.name]
            except KeyError:
                raise UnsupportedAlgorithm(
                    "{0} is not a supported hash on this backend.".format(
                        algorithm.name),
                    _Reasons.UNSUPPORTED_HASH
                )
            ctx = self._backend._ffi.new(methods.ctx)
            res = methods.hash_init(ctx)
            assert res == 1

        self._ctx = ctx

    algorithm = utils.read_only_property("_algorithm")

    def copy(self):
        methods = self._backend._hash_mapping[self.algorithm.name]
        new_ctx = self._backend._ffi.new(methods.ctx)
        # CommonCrypto has no APIs for copying hashes, so we have to copy the
        # underlying struct.
        new_ctx[0] = self._ctx[0]

        return _HashContext(self._backend, self.algorithm, ctx=new_ctx)

    def update(self, data):
        methods = self._backend._hash_mapping[self.algorithm.name]
        res = methods.hash_update(self._ctx, data, len(data))
        assert res == 1

    def finalize(self):
        methods = self._backend._hash_mapping[self.algorithm.name]
        buf = self._backend._ffi.new("unsigned char[]",
                                     self.algorithm.digest_size)
        res = methods.hash_final(buf, self._ctx)
        assert res == 1
        return self._backend._ffi.buffer(buf)[:]
