# This file is dual licensed under the terms of the Apache License, Version
# 2.0, and the BSD License. See the LICENSE file in the root of this repository
# for complete details.

from __future__ import absolute_import, division, print_function

from cryptography import utils
from cryptography.hazmat.primitives.asymmetric import dh


def _dh_cdata_to_parameters(dh_cdata, backend):
    lib = backend._lib
    ffi = backend._ffi

    param_cdata = lib.DHparams_dup(dh_cdata)
    backend.openssl_assert(param_cdata != ffi.NULL)
    param_cdata = ffi.gc(param_cdata, lib.DH_free)

    return _DHParameters(backend, param_cdata)


@utils.register_interface(dh.DHParametersWithSerialization)
class _DHParameters(object):
    def __init__(self, backend, dh_cdata):
        self._backend = backend
        self._dh_cdata = dh_cdata

    def parameter_numbers(self):
        p = self._backend._ffi.new("BIGNUM **")
        g = self._backend._ffi.new("BIGNUM **")
        self._backend._lib.DH_get0_pqg(self._dh_cdata,
                                       p, self._backend._ffi.NULL, g)
        self._backend.openssl_assert(p[0] != self._backend._ffi.NULL)
        self._backend.openssl_assert(g[0] != self._backend._ffi.NULL)
        return dh.DHParameterNumbers(
            p=self._backend._bn_to_int(p[0]),
            g=self._backend._bn_to_int(g[0])
        )

    def generate_private_key(self):
        return self._backend.generate_dh_private_key(self)


def _handle_dh_compute_key_error(errors, backend):
    lib = backend._lib

    backend.openssl_assert(errors[0][1:] == (
        lib.ERR_LIB_DH,
        lib.DH_F_COMPUTE_KEY,
        lib.DH_R_INVALID_PUBKEY
    ))

    raise ValueError("Public key value is invalid for this exchange.")


def _get_dh_num_bits(backend, dh_cdata):
    p = backend._ffi.new("BIGNUM **")
    backend._lib.DH_get0_pqg(dh_cdata, p,
                             backend._ffi.NULL,
                             backend._ffi.NULL)
    backend.openssl_assert(p[0] != backend._ffi.NULL)
    return backend._lib.BN_num_bits(p[0])


@utils.register_interface(dh.DHPrivateKeyWithSerialization)
class _DHPrivateKey(object):
    def __init__(self, backend, dh_cdata):
        self._backend = backend
        self._dh_cdata = dh_cdata
        self._key_size_bytes = self._backend._lib.DH_size(dh_cdata)

    @property
    def key_size(self):
        return _get_dh_num_bits(self._backend, self._dh_cdata)

    def private_numbers(self):
        p = self._backend._ffi.new("BIGNUM **")
        g = self._backend._ffi.new("BIGNUM **")
        self._backend._lib.DH_get0_pqg(self._dh_cdata,
                                       p, self._backend._ffi.NULL, g)
        self._backend.openssl_assert(p[0] != self._backend._ffi.NULL)
        self._backend.openssl_assert(g[0] != self._backend._ffi.NULL)
        pub_key = self._backend._ffi.new("BIGNUM **")
        priv_key = self._backend._ffi.new("BIGNUM **")
        self._backend._lib.DH_get0_key(self._dh_cdata, pub_key, priv_key)
        self._backend.openssl_assert(pub_key[0] != self._backend._ffi.NULL)
        self._backend.openssl_assert(priv_key[0] != self._backend._ffi.NULL)
        return dh.DHPrivateNumbers(
            public_numbers=dh.DHPublicNumbers(
                parameter_numbers=dh.DHParameterNumbers(
                    p=self._backend._bn_to_int(p[0]),
                    g=self._backend._bn_to_int(g[0])
                ),
                y=self._backend._bn_to_int(pub_key[0])
            ),
            x=self._backend._bn_to_int(priv_key[0])
        )

    def exchange(self, peer_public_key):

        buf = self._backend._ffi.new("unsigned char[]", self._key_size_bytes)
        pub_key = self._backend._ffi.new("BIGNUM **")
        self._backend._lib.DH_get0_key(peer_public_key._dh_cdata, pub_key,
                                       self._backend._ffi.NULL)
        self._backend.openssl_assert(pub_key[0] != self._backend._ffi.NULL)
        res = self._backend._lib.DH_compute_key(
            buf,
            pub_key[0],
            self._dh_cdata
        )

        if res == -1:
            errors = self._backend._consume_errors()
            return _handle_dh_compute_key_error(errors, self._backend)
        else:
            self._backend.openssl_assert(res >= 1)

            key = self._backend._ffi.buffer(buf)[:res]
            pad = self._key_size_bytes - len(key)

            if pad > 0:
                key = (b"\x00" * pad) + key

            return key

    def public_key(self):
        dh_cdata = self._backend._lib.DHparams_dup(self._dh_cdata)
        self._backend.openssl_assert(dh_cdata != self._backend._ffi.NULL)
        dh_cdata = self._backend._ffi.gc(
            dh_cdata, self._backend._lib.DH_free
        )

        pub_key = self._backend._ffi.new("BIGNUM **")
        self._backend._lib.DH_get0_key(self._dh_cdata,
                                       pub_key, self._backend._ffi.NULL)
        self._backend.openssl_assert(pub_key[0] != self._backend._ffi.NULL)
        pub_key_dup = self._backend._lib.BN_dup(pub_key[0])
        self._backend.openssl_assert(pub_key_dup != self._backend._ffi.NULL)

        res = self._backend._lib.DH_set0_key(dh_cdata,
                                             pub_key_dup,
                                             self._backend._ffi.NULL)
        self._backend.openssl_assert(res == 1)

        return _DHPublicKey(self._backend, dh_cdata)

    def parameters(self):
        return _dh_cdata_to_parameters(self._dh_cdata, self._backend)


@utils.register_interface(dh.DHPublicKeyWithSerialization)
class _DHPublicKey(object):
    def __init__(self, backend, dh_cdata):
        self._backend = backend
        self._dh_cdata = dh_cdata
        self._key_size_bits = _get_dh_num_bits(self._backend, self._dh_cdata)

    @property
    def key_size(self):
        return self._key_size_bits

    def public_numbers(self):
        p = self._backend._ffi.new("BIGNUM **")
        g = self._backend._ffi.new("BIGNUM **")
        self._backend._lib.DH_get0_pqg(self._dh_cdata,
                                       p, self._backend._ffi.NULL, g)
        self._backend.openssl_assert(p[0] != self._backend._ffi.NULL)
        self._backend.openssl_assert(g[0] != self._backend._ffi.NULL)
        pub_key = self._backend._ffi.new("BIGNUM **")
        self._backend._lib.DH_get0_key(self._dh_cdata,
                                       pub_key, self._backend._ffi.NULL)
        self._backend.openssl_assert(pub_key[0] != self._backend._ffi.NULL)
        return dh.DHPublicNumbers(
            parameter_numbers=dh.DHParameterNumbers(
                p=self._backend._bn_to_int(p[0]),
                g=self._backend._bn_to_int(g[0])
            ),
            y=self._backend._bn_to_int(pub_key[0])
        )

    def parameters(self):
        return _dh_cdata_to_parameters(self._dh_cdata, self._backend)
