# This file is dual licensed under the terms of the Apache License, Version
# 2.0, and the BSD License. See the LICENSE file in the root of this repository
# for complete details.

from __future__ import absolute_import, division, print_function

import math

from cryptography import utils
from cryptography.exceptions import (
    InvalidSignature, UnsupportedAlgorithm, _Reasons
)
from cryptography.hazmat.backends.openssl.utils import (
    _calculate_digest_and_algorithm
)
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import (
    AsymmetricSignatureContext, AsymmetricVerificationContext, rsa
)
from cryptography.hazmat.primitives.asymmetric.padding import (
    AsymmetricPadding, MGF1, OAEP, PKCS1v15, PSS, calculate_max_pss_salt_length
)
from cryptography.hazmat.primitives.asymmetric.rsa import (
    RSAPrivateKeyWithSerialization, RSAPublicKeyWithSerialization
)


def _get_rsa_pss_salt_length(pss, key, hash_algorithm):
    salt = pss._salt_length

    if salt is MGF1.MAX_LENGTH or salt is PSS.MAX_LENGTH:
        return calculate_max_pss_salt_length(key, hash_algorithm)
    else:
        return salt


def _enc_dec_rsa(backend, key, data, padding):
    if not isinstance(padding, AsymmetricPadding):
        raise TypeError("Padding must be an instance of AsymmetricPadding.")

    if isinstance(padding, PKCS1v15):
        padding_enum = backend._lib.RSA_PKCS1_PADDING
    elif isinstance(padding, OAEP):
        padding_enum = backend._lib.RSA_PKCS1_OAEP_PADDING

        if not isinstance(padding._mgf, MGF1):
            raise UnsupportedAlgorithm(
                "Only MGF1 is supported by this backend.",
                _Reasons.UNSUPPORTED_MGF
            )

        if not backend.rsa_padding_supported(padding):
            raise UnsupportedAlgorithm(
                "This combination of padding and hash algorithm is not "
                "supported by this backend.",
                _Reasons.UNSUPPORTED_PADDING
            )

        if padding._label is not None and padding._label != b"":
            raise ValueError("This backend does not support OAEP labels.")

    else:
        raise UnsupportedAlgorithm(
            "{0} is not supported by this backend.".format(
                padding.name
            ),
            _Reasons.UNSUPPORTED_PADDING
        )

    return _enc_dec_rsa_pkey_ctx(backend, key, data, padding_enum, padding)


def _enc_dec_rsa_pkey_ctx(backend, key, data, padding_enum, padding):
    if isinstance(key, _RSAPublicKey):
        init = backend._lib.EVP_PKEY_encrypt_init
        crypt = backend._lib.EVP_PKEY_encrypt
    else:
        init = backend._lib.EVP_PKEY_decrypt_init
        crypt = backend._lib.EVP_PKEY_decrypt

    pkey_ctx = backend._lib.EVP_PKEY_CTX_new(
        key._evp_pkey, backend._ffi.NULL
    )
    backend.openssl_assert(pkey_ctx != backend._ffi.NULL)
    pkey_ctx = backend._ffi.gc(pkey_ctx, backend._lib.EVP_PKEY_CTX_free)
    res = init(pkey_ctx)
    backend.openssl_assert(res == 1)
    res = backend._lib.EVP_PKEY_CTX_set_rsa_padding(
        pkey_ctx, padding_enum)
    backend.openssl_assert(res > 0)
    buf_size = backend._lib.EVP_PKEY_size(key._evp_pkey)
    backend.openssl_assert(buf_size > 0)
    if (
        isinstance(padding, OAEP) and
        backend._lib.Cryptography_HAS_RSA_OAEP_MD
    ):
        mgf1_md = backend._lib.EVP_get_digestbyname(
            padding._mgf._algorithm.name.encode("ascii"))
        backend.openssl_assert(mgf1_md != backend._ffi.NULL)
        res = backend._lib.EVP_PKEY_CTX_set_rsa_mgf1_md(pkey_ctx, mgf1_md)
        backend.openssl_assert(res > 0)
        oaep_md = backend._lib.EVP_get_digestbyname(
            padding._algorithm.name.encode("ascii"))
        backend.openssl_assert(oaep_md != backend._ffi.NULL)
        res = backend._lib.EVP_PKEY_CTX_set_rsa_oaep_md(pkey_ctx, oaep_md)
        backend.openssl_assert(res > 0)

    outlen = backend._ffi.new("size_t *", buf_size)
    buf = backend._ffi.new("unsigned char[]", buf_size)
    res = crypt(pkey_ctx, buf, outlen, data, len(data))
    if res <= 0:
        _handle_rsa_enc_dec_error(backend, key)

    return backend._ffi.buffer(buf)[:outlen[0]]


def _handle_rsa_enc_dec_error(backend, key):
    errors = backend._consume_errors()
    assert errors
    assert errors[0].lib == backend._lib.ERR_LIB_RSA
    if isinstance(key, _RSAPublicKey):
        assert (errors[0].reason ==
                backend._lib.RSA_R_DATA_TOO_LARGE_FOR_KEY_SIZE)
        raise ValueError(
            "Data too long for key size. Encrypt less data or use a "
            "larger key size."
        )
    else:
        decoding_errors = [
            backend._lib.RSA_R_BLOCK_TYPE_IS_NOT_01,
            backend._lib.RSA_R_BLOCK_TYPE_IS_NOT_02,
            backend._lib.RSA_R_OAEP_DECODING_ERROR,
            # Though this error looks similar to the
            # RSA_R_DATA_TOO_LARGE_FOR_KEY_SIZE, this occurs on decrypts,
            # rather than on encrypts
            backend._lib.RSA_R_DATA_TOO_LARGE_FOR_MODULUS,
        ]
        if backend._lib.Cryptography_HAS_RSA_R_PKCS_DECODING_ERROR:
            decoding_errors.append(backend._lib.RSA_R_PKCS_DECODING_ERROR)

        assert errors[0].reason in decoding_errors
        raise ValueError("Decryption failed.")


def _rsa_sig_determine_padding(backend, key, padding, algorithm):
    if not isinstance(padding, AsymmetricPadding):
        raise TypeError("Expected provider of AsymmetricPadding.")

    pkey_size = backend._lib.EVP_PKEY_size(key._evp_pkey)
    backend.openssl_assert(pkey_size > 0)

    if isinstance(padding, PKCS1v15):
        padding_enum = backend._lib.RSA_PKCS1_PADDING
    elif isinstance(padding, PSS):
        if not isinstance(padding._mgf, MGF1):
            raise UnsupportedAlgorithm(
                "Only MGF1 is supported by this backend.",
                _Reasons.UNSUPPORTED_MGF
            )

        # Size of key in bytes - 2 is the maximum
        # PSS signature length (salt length is checked later)
        if pkey_size - algorithm.digest_size - 2 < 0:
            raise ValueError("Digest too large for key size. Use a larger "
                             "key or different digest.")

        if not backend._pss_mgf1_hash_supported(padding._mgf._algorithm):
            raise UnsupportedAlgorithm(
                "When OpenSSL is older than 1.0.1 then only SHA1 is "
                "supported with MGF1.",
                _Reasons.UNSUPPORTED_HASH
            )

        padding_enum = backend._lib.RSA_PKCS1_PSS_PADDING
    else:
        raise UnsupportedAlgorithm(
            "{0} is not supported by this backend.".format(padding.name),
            _Reasons.UNSUPPORTED_PADDING
        )

    return padding_enum


def _rsa_sig_sign(backend, padding, padding_enum, algorithm, private_key,
                  data):
    evp_md = backend._lib.EVP_get_digestbyname(
        algorithm.name.encode("ascii"))
    backend.openssl_assert(evp_md != backend._ffi.NULL)

    pkey_ctx = backend._lib.EVP_PKEY_CTX_new(
        private_key._evp_pkey, backend._ffi.NULL
    )
    backend.openssl_assert(pkey_ctx != backend._ffi.NULL)
    pkey_ctx = backend._ffi.gc(pkey_ctx, backend._lib.EVP_PKEY_CTX_free)
    res = backend._lib.EVP_PKEY_sign_init(pkey_ctx)
    backend.openssl_assert(res == 1)
    res = backend._lib.EVP_PKEY_CTX_set_signature_md(
        pkey_ctx, evp_md)
    backend.openssl_assert(res > 0)

    res = backend._lib.EVP_PKEY_CTX_set_rsa_padding(
        pkey_ctx, padding_enum)
    backend.openssl_assert(res > 0)
    if isinstance(padding, PSS):
        res = backend._lib.EVP_PKEY_CTX_set_rsa_pss_saltlen(
            pkey_ctx,
            _get_rsa_pss_salt_length(
                padding,
                private_key,
                algorithm,
            )
        )
        backend.openssl_assert(res > 0)

        if backend._lib.Cryptography_HAS_MGF1_MD:
            # MGF1 MD is configurable in OpenSSL 1.0.1+
            mgf1_md = backend._lib.EVP_get_digestbyname(
                padding._mgf._algorithm.name.encode("ascii"))
            backend.openssl_assert(
                mgf1_md != backend._ffi.NULL
            )
            res = backend._lib.EVP_PKEY_CTX_set_rsa_mgf1_md(
                pkey_ctx, mgf1_md
            )
            backend.openssl_assert(res > 0)

    buflen = backend._ffi.new("size_t *")
    res = backend._lib.EVP_PKEY_sign(
        pkey_ctx,
        backend._ffi.NULL,
        buflen,
        data,
        len(data)
    )
    backend.openssl_assert(res == 1)
    buf = backend._ffi.new("unsigned char[]", buflen[0])
    res = backend._lib.EVP_PKEY_sign(
        pkey_ctx, buf, buflen, data, len(data))
    if res != 1:
        errors = backend._consume_errors()
        assert errors[0].lib == backend._lib.ERR_LIB_RSA
        reason = None
        if (errors[0].reason ==
                backend._lib.RSA_R_DATA_TOO_LARGE_FOR_KEY_SIZE):
            reason = ("Salt length too long for key size. Try using "
                      "MAX_LENGTH instead.")
        else:
            assert (errors[0].reason ==
                    backend._lib.RSA_R_DIGEST_TOO_BIG_FOR_RSA_KEY)
            reason = "Digest too large for key size. Use a larger key."
        assert reason is not None
        raise ValueError(reason)

    return backend._ffi.buffer(buf)[:]


def _rsa_sig_verify(backend, padding, padding_enum, algorithm, public_key,
                    signature, data):
    evp_md = backend._lib.EVP_get_digestbyname(
        algorithm.name.encode("ascii"))
    backend.openssl_assert(evp_md != backend._ffi.NULL)

    pkey_ctx = backend._lib.EVP_PKEY_CTX_new(
        public_key._evp_pkey, backend._ffi.NULL
    )
    backend.openssl_assert(pkey_ctx != backend._ffi.NULL)
    pkey_ctx = backend._ffi.gc(pkey_ctx, backend._lib.EVP_PKEY_CTX_free)
    res = backend._lib.EVP_PKEY_verify_init(pkey_ctx)
    backend.openssl_assert(res == 1)
    res = backend._lib.EVP_PKEY_CTX_set_signature_md(
        pkey_ctx, evp_md)
    backend.openssl_assert(res > 0)

    res = backend._lib.EVP_PKEY_CTX_set_rsa_padding(
        pkey_ctx, padding_enum)
    backend.openssl_assert(res > 0)
    if isinstance(padding, PSS):
        res = backend._lib.EVP_PKEY_CTX_set_rsa_pss_saltlen(
            pkey_ctx,
            _get_rsa_pss_salt_length(
                padding,
                public_key,
                algorithm,
            )
        )
        backend.openssl_assert(res > 0)
        if backend._lib.Cryptography_HAS_MGF1_MD:
            # MGF1 MD is configurable in OpenSSL 1.0.1+
            mgf1_md = backend._lib.EVP_get_digestbyname(
                padding._mgf._algorithm.name.encode("ascii"))
            backend.openssl_assert(
                mgf1_md != backend._ffi.NULL
            )
            res = backend._lib.EVP_PKEY_CTX_set_rsa_mgf1_md(
                pkey_ctx, mgf1_md
            )
            backend.openssl_assert(res > 0)

    res = backend._lib.EVP_PKEY_verify(
        pkey_ctx,
        signature,
        len(signature),
        data,
        len(data)
    )
    # The previous call can return negative numbers in the event of an
    # error. This is not a signature failure but we need to fail if it
    # occurs.
    backend.openssl_assert(res >= 0)
    if res == 0:
        errors = backend._consume_errors()
        assert errors
        raise InvalidSignature


@utils.register_interface(AsymmetricSignatureContext)
class _RSASignatureContext(object):
    def __init__(self, backend, private_key, padding, algorithm):
        self._backend = backend
        self._private_key = private_key

        self._padding_enum = _rsa_sig_determine_padding(
            backend, private_key, padding, algorithm
        )
        self._padding = padding
        self._algorithm = algorithm
        self._hash_ctx = hashes.Hash(self._algorithm, self._backend)

    def update(self, data):
        self._hash_ctx.update(data)

    def finalize(self):
        return _rsa_sig_sign(
            self._backend,
            self._padding,
            self._padding_enum,
            self._algorithm,
            self._private_key,
            self._hash_ctx.finalize()
        )


@utils.register_interface(AsymmetricVerificationContext)
class _RSAVerificationContext(object):
    def __init__(self, backend, public_key, signature, padding, algorithm):
        self._backend = backend
        self._public_key = public_key
        self._signature = signature
        self._padding = padding

        self._padding_enum = _rsa_sig_determine_padding(
            backend, public_key, padding, algorithm
        )

        padding = padding
        self._algorithm = algorithm
        self._hash_ctx = hashes.Hash(self._algorithm, self._backend)

    def update(self, data):
        self._hash_ctx.update(data)

    def verify(self):
        return _rsa_sig_verify(
            self._backend,
            self._padding,
            self._padding_enum,
            self._algorithm,
            self._public_key,
            self._signature,
            self._hash_ctx.finalize()
        )


@utils.register_interface(RSAPrivateKeyWithSerialization)
class _RSAPrivateKey(object):
    def __init__(self, backend, rsa_cdata, evp_pkey):
        self._backend = backend
        self._rsa_cdata = rsa_cdata
        self._evp_pkey = evp_pkey

        n = self._backend._ffi.new("BIGNUM **")
        self._backend._lib.RSA_get0_key(
            self._rsa_cdata, n, self._backend._ffi.NULL,
            self._backend._ffi.NULL
        )
        self._backend.openssl_assert(n[0] != self._backend._ffi.NULL)
        self._key_size = self._backend._lib.BN_num_bits(n[0])

    key_size = utils.read_only_property("_key_size")

    def signer(self, padding, algorithm):
        return _RSASignatureContext(self._backend, self, padding, algorithm)

    def decrypt(self, ciphertext, padding):
        key_size_bytes = int(math.ceil(self.key_size / 8.0))
        if key_size_bytes != len(ciphertext):
            raise ValueError("Ciphertext length must be equal to key size.")

        return _enc_dec_rsa(self._backend, self, ciphertext, padding)

    def public_key(self):
        ctx = self._backend._lib.RSAPublicKey_dup(self._rsa_cdata)
        self._backend.openssl_assert(ctx != self._backend._ffi.NULL)
        ctx = self._backend._ffi.gc(ctx, self._backend._lib.RSA_free)
        res = self._backend._lib.RSA_blinding_on(ctx, self._backend._ffi.NULL)
        self._backend.openssl_assert(res == 1)
        evp_pkey = self._backend._rsa_cdata_to_evp_pkey(ctx)
        return _RSAPublicKey(self._backend, ctx, evp_pkey)

    def private_numbers(self):
        n = self._backend._ffi.new("BIGNUM **")
        e = self._backend._ffi.new("BIGNUM **")
        d = self._backend._ffi.new("BIGNUM **")
        p = self._backend._ffi.new("BIGNUM **")
        q = self._backend._ffi.new("BIGNUM **")
        dmp1 = self._backend._ffi.new("BIGNUM **")
        dmq1 = self._backend._ffi.new("BIGNUM **")
        iqmp = self._backend._ffi.new("BIGNUM **")
        self._backend._lib.RSA_get0_key(self._rsa_cdata, n, e, d)
        self._backend.openssl_assert(n[0] != self._backend._ffi.NULL)
        self._backend.openssl_assert(e[0] != self._backend._ffi.NULL)
        self._backend.openssl_assert(d[0] != self._backend._ffi.NULL)
        self._backend._lib.RSA_get0_factors(self._rsa_cdata, p, q)
        self._backend.openssl_assert(p[0] != self._backend._ffi.NULL)
        self._backend.openssl_assert(q[0] != self._backend._ffi.NULL)
        self._backend._lib.RSA_get0_crt_params(
            self._rsa_cdata, dmp1, dmq1, iqmp
        )
        self._backend.openssl_assert(dmp1[0] != self._backend._ffi.NULL)
        self._backend.openssl_assert(dmq1[0] != self._backend._ffi.NULL)
        self._backend.openssl_assert(iqmp[0] != self._backend._ffi.NULL)
        return rsa.RSAPrivateNumbers(
            p=self._backend._bn_to_int(p[0]),
            q=self._backend._bn_to_int(q[0]),
            d=self._backend._bn_to_int(d[0]),
            dmp1=self._backend._bn_to_int(dmp1[0]),
            dmq1=self._backend._bn_to_int(dmq1[0]),
            iqmp=self._backend._bn_to_int(iqmp[0]),
            public_numbers=rsa.RSAPublicNumbers(
                e=self._backend._bn_to_int(e[0]),
                n=self._backend._bn_to_int(n[0]),
            )
        )

    def private_bytes(self, encoding, format, encryption_algorithm):
        return self._backend._private_key_bytes(
            encoding,
            format,
            encryption_algorithm,
            self._evp_pkey,
            self._rsa_cdata
        )

    def sign(self, data, padding, algorithm):
        padding_enum = _rsa_sig_determine_padding(
            self._backend, self, padding, algorithm
        )
        data, algorithm = _calculate_digest_and_algorithm(
            self._backend, data, algorithm
        )
        return _rsa_sig_sign(
            self._backend, padding, padding_enum,
            algorithm, self, data
        )


@utils.register_interface(RSAPublicKeyWithSerialization)
class _RSAPublicKey(object):
    def __init__(self, backend, rsa_cdata, evp_pkey):
        self._backend = backend
        self._rsa_cdata = rsa_cdata
        self._evp_pkey = evp_pkey

        n = self._backend._ffi.new("BIGNUM **")
        self._backend._lib.RSA_get0_key(
            self._rsa_cdata, n, self._backend._ffi.NULL,
            self._backend._ffi.NULL
        )
        self._backend.openssl_assert(n[0] != self._backend._ffi.NULL)
        self._key_size = self._backend._lib.BN_num_bits(n[0])

    key_size = utils.read_only_property("_key_size")

    def verifier(self, signature, padding, algorithm):
        if not isinstance(signature, bytes):
            raise TypeError("signature must be bytes.")

        return _RSAVerificationContext(
            self._backend, self, signature, padding, algorithm
        )

    def encrypt(self, plaintext, padding):
        return _enc_dec_rsa(self._backend, self, plaintext, padding)

    def public_numbers(self):
        n = self._backend._ffi.new("BIGNUM **")
        e = self._backend._ffi.new("BIGNUM **")
        self._backend._lib.RSA_get0_key(
            self._rsa_cdata, n, e, self._backend._ffi.NULL
        )
        self._backend.openssl_assert(n[0] != self._backend._ffi.NULL)
        self._backend.openssl_assert(e[0] != self._backend._ffi.NULL)
        return rsa.RSAPublicNumbers(
            e=self._backend._bn_to_int(e[0]),
            n=self._backend._bn_to_int(n[0]),
        )

    def public_bytes(self, encoding, format):
        return self._backend._public_key_bytes(
            encoding,
            format,
            self,
            self._evp_pkey,
            self._rsa_cdata
        )

    def verify(self, signature, data, padding, algorithm):
        padding_enum = _rsa_sig_determine_padding(
            self._backend, self, padding, algorithm
        )
        data, algorithm = _calculate_digest_and_algorithm(
            self._backend, data, algorithm
        )
        return _rsa_sig_verify(
            self._backend, padding, padding_enum, algorithm, self,
            signature, data
        )
