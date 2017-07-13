# This file is dual licensed under the terms of the Apache License, Version
# 2.0, and the BSD License. See the LICENSE file in the root of this repository
# for complete details.

from __future__ import absolute_import, division, print_function

from cryptography import utils
from cryptography.exceptions import (
    InvalidSignature, UnsupportedAlgorithm, _Reasons
)
from cryptography.hazmat.backends.openssl.utils import (
    _calculate_digest_and_algorithm, _truncate_digest
)
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import (
    AsymmetricSignatureContext, AsymmetricVerificationContext, ec
)


def _truncate_digest_for_ecdsa(ec_key_cdata, digest, backend):
    """
    This function truncates digests that are longer than a given elliptic
    curve key's length so they can be signed. Since elliptic curve keys are
    much shorter than RSA keys many digests (e.g. SHA-512) may require
    truncation.
    """

    _lib = backend._lib
    _ffi = backend._ffi

    group = _lib.EC_KEY_get0_group(ec_key_cdata)

    with backend._tmp_bn_ctx() as bn_ctx:
        order = _lib.BN_CTX_get(bn_ctx)
        backend.openssl_assert(order != _ffi.NULL)

        res = _lib.EC_GROUP_get_order(group, order, bn_ctx)
        backend.openssl_assert(res == 1)

        order_bits = _lib.BN_num_bits(order)

    return _truncate_digest(digest, order_bits)


def _check_signature_algorithm(signature_algorithm):
    if not isinstance(signature_algorithm, ec.ECDSA):
        raise UnsupportedAlgorithm(
            "Unsupported elliptic curve signature algorithm.",
            _Reasons.UNSUPPORTED_PUBLIC_KEY_ALGORITHM)


def _ec_key_curve_sn(backend, ec_key):
    group = backend._lib.EC_KEY_get0_group(ec_key)
    backend.openssl_assert(group != backend._ffi.NULL)

    nid = backend._lib.EC_GROUP_get_curve_name(group)
    # The following check is to find EC keys with unnamed curves and raise
    # an error for now.
    if nid == backend._lib.NID_undef:
        raise NotImplementedError(
            "ECDSA certificates with unnamed curves are unsupported "
            "at this time"
        )

    curve_name = backend._lib.OBJ_nid2sn(nid)
    backend.openssl_assert(curve_name != backend._ffi.NULL)

    sn = backend._ffi.string(curve_name).decode('ascii')
    return sn


def _mark_asn1_named_ec_curve(backend, ec_cdata):
    """
    Set the named curve flag on the EC_KEY. This causes OpenSSL to
    serialize EC keys along with their curve OID which makes
    deserialization easier.
    """

    backend._lib.EC_KEY_set_asn1_flag(
        ec_cdata, backend._lib.OPENSSL_EC_NAMED_CURVE
    )


def _sn_to_elliptic_curve(backend, sn):
    try:
        return ec._CURVE_TYPES[sn]()
    except KeyError:
        raise UnsupportedAlgorithm(
            "{0} is not a supported elliptic curve".format(sn),
            _Reasons.UNSUPPORTED_ELLIPTIC_CURVE
        )


def _ecdsa_sig_sign(backend, private_key, data):
    max_size = backend._lib.ECDSA_size(private_key._ec_key)
    backend.openssl_assert(max_size > 0)

    sigbuf = backend._ffi.new("unsigned char[]", max_size)
    siglen_ptr = backend._ffi.new("unsigned int[]", 1)
    res = backend._lib.ECDSA_sign(
        0, data, len(data), sigbuf, siglen_ptr, private_key._ec_key
    )
    backend.openssl_assert(res == 1)
    return backend._ffi.buffer(sigbuf)[:siglen_ptr[0]]


def _ecdsa_sig_verify(backend, public_key, signature, data):
    res = backend._lib.ECDSA_verify(
        0, data, len(data), signature, len(signature), public_key._ec_key
    )
    if res != 1:
        backend._consume_errors()
        raise InvalidSignature
    return True


@utils.register_interface(AsymmetricSignatureContext)
class _ECDSASignatureContext(object):
    def __init__(self, backend, private_key, algorithm):
        self._backend = backend
        self._private_key = private_key
        self._digest = hashes.Hash(algorithm, backend)

    def update(self, data):
        self._digest.update(data)

    def finalize(self):
        digest = self._digest.finalize()

        digest = _truncate_digest_for_ecdsa(
            self._private_key._ec_key, digest, self._backend
        )
        return _ecdsa_sig_sign(self._backend, self._private_key, digest)


@utils.register_interface(AsymmetricVerificationContext)
class _ECDSAVerificationContext(object):
    def __init__(self, backend, public_key, signature, algorithm):
        self._backend = backend
        self._public_key = public_key
        self._signature = signature
        self._digest = hashes.Hash(algorithm, backend)

    def update(self, data):
        self._digest.update(data)

    def verify(self):
        digest = self._digest.finalize()
        digest = _truncate_digest_for_ecdsa(
            self._public_key._ec_key, digest, self._backend
        )
        return _ecdsa_sig_verify(
            self._backend, self._public_key, self._signature, digest
        )


@utils.register_interface(ec.EllipticCurvePrivateKeyWithSerialization)
class _EllipticCurvePrivateKey(object):
    def __init__(self, backend, ec_key_cdata, evp_pkey):
        self._backend = backend
        _mark_asn1_named_ec_curve(backend, ec_key_cdata)
        self._ec_key = ec_key_cdata
        self._evp_pkey = evp_pkey

        sn = _ec_key_curve_sn(backend, ec_key_cdata)
        self._curve = _sn_to_elliptic_curve(backend, sn)

    curve = utils.read_only_property("_curve")

    def signer(self, signature_algorithm):
        _check_signature_algorithm(signature_algorithm)
        return _ECDSASignatureContext(
            self._backend, self, signature_algorithm.algorithm
        )

    def exchange(self, algorithm, peer_public_key):
        if not (
            self._backend.elliptic_curve_exchange_algorithm_supported(
                algorithm, self.curve
            )
        ):
            raise UnsupportedAlgorithm(
                "This backend does not support the ECDH algorithm.",
                _Reasons.UNSUPPORTED_EXCHANGE_ALGORITHM
            )

        if peer_public_key.curve.name != self.curve.name:
            raise ValueError(
                "peer_public_key and self are not on the same curve"
            )

        group = self._backend._lib.EC_KEY_get0_group(self._ec_key)
        z_len = (self._backend._lib.EC_GROUP_get_degree(group) + 7) // 8
        self._backend.openssl_assert(z_len > 0)
        z_buf = self._backend._ffi.new("uint8_t[]", z_len)
        peer_key = self._backend._lib.EC_KEY_get0_public_key(
            peer_public_key._ec_key
        )

        r = self._backend._lib.ECDH_compute_key(
            z_buf, z_len, peer_key, self._ec_key, self._backend._ffi.NULL
        )
        self._backend.openssl_assert(r > 0)
        return self._backend._ffi.buffer(z_buf)[:z_len]

    def public_key(self):
        group = self._backend._lib.EC_KEY_get0_group(self._ec_key)
        self._backend.openssl_assert(group != self._backend._ffi.NULL)

        curve_nid = self._backend._lib.EC_GROUP_get_curve_name(group)

        public_ec_key = self._backend._lib.EC_KEY_new_by_curve_name(curve_nid)
        self._backend.openssl_assert(public_ec_key != self._backend._ffi.NULL)
        public_ec_key = self._backend._ffi.gc(
            public_ec_key, self._backend._lib.EC_KEY_free
        )

        point = self._backend._lib.EC_KEY_get0_public_key(self._ec_key)
        self._backend.openssl_assert(point != self._backend._ffi.NULL)

        res = self._backend._lib.EC_KEY_set_public_key(public_ec_key, point)
        self._backend.openssl_assert(res == 1)

        evp_pkey = self._backend._ec_cdata_to_evp_pkey(public_ec_key)

        return _EllipticCurvePublicKey(self._backend, public_ec_key, evp_pkey)

    def private_numbers(self):
        bn = self._backend._lib.EC_KEY_get0_private_key(self._ec_key)
        private_value = self._backend._bn_to_int(bn)
        return ec.EllipticCurvePrivateNumbers(
            private_value=private_value,
            public_numbers=self.public_key().public_numbers()
        )

    def private_bytes(self, encoding, format, encryption_algorithm):
        return self._backend._private_key_bytes(
            encoding,
            format,
            encryption_algorithm,
            self._evp_pkey,
            self._ec_key
        )

    def sign(self, data, signature_algorithm):
        _check_signature_algorithm(signature_algorithm)
        data, algorithm = _calculate_digest_and_algorithm(
            self._backend, data, signature_algorithm._algorithm
        )
        data = _truncate_digest_for_ecdsa(
            self._ec_key, data, self._backend
        )
        return _ecdsa_sig_sign(self._backend, self, data)


@utils.register_interface(ec.EllipticCurvePublicKeyWithSerialization)
class _EllipticCurvePublicKey(object):
    def __init__(self, backend, ec_key_cdata, evp_pkey):
        self._backend = backend
        _mark_asn1_named_ec_curve(backend, ec_key_cdata)
        self._ec_key = ec_key_cdata
        self._evp_pkey = evp_pkey

        sn = _ec_key_curve_sn(backend, ec_key_cdata)
        self._curve = _sn_to_elliptic_curve(backend, sn)

    curve = utils.read_only_property("_curve")

    def verifier(self, signature, signature_algorithm):
        if not isinstance(signature, bytes):
            raise TypeError("signature must be bytes.")

        _check_signature_algorithm(signature_algorithm)
        return _ECDSAVerificationContext(
            self._backend, self, signature, signature_algorithm.algorithm
        )

    def public_numbers(self):
        set_func, get_func, group = (
            self._backend._ec_key_determine_group_get_set_funcs(self._ec_key)
        )
        point = self._backend._lib.EC_KEY_get0_public_key(self._ec_key)
        self._backend.openssl_assert(point != self._backend._ffi.NULL)

        with self._backend._tmp_bn_ctx() as bn_ctx:
            bn_x = self._backend._lib.BN_CTX_get(bn_ctx)
            bn_y = self._backend._lib.BN_CTX_get(bn_ctx)

            res = get_func(group, point, bn_x, bn_y, bn_ctx)
            self._backend.openssl_assert(res == 1)

            x = self._backend._bn_to_int(bn_x)
            y = self._backend._bn_to_int(bn_y)

        return ec.EllipticCurvePublicNumbers(
            x=x,
            y=y,
            curve=self._curve
        )

    def public_bytes(self, encoding, format):
        if format is serialization.PublicFormat.PKCS1:
            raise ValueError(
                "EC public keys do not support PKCS1 serialization"
            )

        return self._backend._public_key_bytes(
            encoding,
            format,
            self,
            self._evp_pkey,
            None
        )

    def verify(self, signature, data, signature_algorithm):
        _check_signature_algorithm(signature_algorithm)
        data, algorithm = _calculate_digest_and_algorithm(
            self._backend, data, signature_algorithm._algorithm
        )
        data = _truncate_digest_for_ecdsa(
            self._ec_key, data, self._backend
        )
        return _ecdsa_sig_verify(self._backend, self, signature, data)
