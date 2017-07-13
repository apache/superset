# This file is dual licensed under the terms of the Apache License, Version
# 2.0, and the BSD License. See the LICENSE file in the root of this repository
# for complete details.

from __future__ import absolute_import, division, print_function

from cryptography import utils
from cryptography.exceptions import InvalidTag, UnsupportedAlgorithm, _Reasons
from cryptography.hazmat.primitives import ciphers
from cryptography.hazmat.primitives.ciphers import modes


@utils.register_interface(ciphers.CipherContext)
@utils.register_interface(ciphers.AEADCipherContext)
@utils.register_interface(ciphers.AEADEncryptionContext)
class _CipherContext(object):
    _ENCRYPT = 1
    _DECRYPT = 0

    def __init__(self, backend, cipher, mode, operation):
        self._backend = backend
        self._cipher = cipher
        self._mode = mode
        self._operation = operation
        self._tag = None

        if isinstance(self._cipher, ciphers.BlockCipherAlgorithm):
            self._block_size_bytes = self._cipher.block_size // 8
        else:
            self._block_size_bytes = 1

        ctx = self._backend._lib.EVP_CIPHER_CTX_new()
        ctx = self._backend._ffi.gc(
            ctx, self._backend._lib.EVP_CIPHER_CTX_free
        )

        registry = self._backend._cipher_registry
        try:
            adapter = registry[type(cipher), type(mode)]
        except KeyError:
            raise UnsupportedAlgorithm(
                "cipher {0} in {1} mode is not supported "
                "by this backend.".format(
                    cipher.name, mode.name if mode else mode),
                _Reasons.UNSUPPORTED_CIPHER
            )

        evp_cipher = adapter(self._backend, cipher, mode)
        if evp_cipher == self._backend._ffi.NULL:
            raise UnsupportedAlgorithm(
                "cipher {0} in {1} mode is not supported "
                "by this backend.".format(
                    cipher.name, mode.name if mode else mode),
                _Reasons.UNSUPPORTED_CIPHER
            )

        if isinstance(mode, modes.ModeWithInitializationVector):
            iv_nonce = mode.initialization_vector
        elif isinstance(mode, modes.ModeWithNonce):
            iv_nonce = mode.nonce
        else:
            iv_nonce = self._backend._ffi.NULL
        # begin init with cipher and operation type
        res = self._backend._lib.EVP_CipherInit_ex(ctx, evp_cipher,
                                                   self._backend._ffi.NULL,
                                                   self._backend._ffi.NULL,
                                                   self._backend._ffi.NULL,
                                                   operation)
        self._backend.openssl_assert(res != 0)
        # set the key length to handle variable key ciphers
        res = self._backend._lib.EVP_CIPHER_CTX_set_key_length(
            ctx, len(cipher.key)
        )
        self._backend.openssl_assert(res != 0)
        if isinstance(mode, modes.GCM):
            res = self._backend._lib.EVP_CIPHER_CTX_ctrl(
                ctx, self._backend._lib.EVP_CTRL_GCM_SET_IVLEN,
                len(iv_nonce), self._backend._ffi.NULL
            )
            self._backend.openssl_assert(res != 0)
            if operation == self._DECRYPT:
                res = self._backend._lib.EVP_CIPHER_CTX_ctrl(
                    ctx, self._backend._lib.EVP_CTRL_GCM_SET_TAG,
                    len(mode.tag), mode.tag
                )
                self._backend.openssl_assert(res != 0)

        # pass key/iv
        res = self._backend._lib.EVP_CipherInit_ex(
            ctx,
            self._backend._ffi.NULL,
            self._backend._ffi.NULL,
            cipher.key,
            iv_nonce,
            operation
        )
        self._backend.openssl_assert(res != 0)
        # We purposely disable padding here as it's handled higher up in the
        # API.
        self._backend._lib.EVP_CIPHER_CTX_set_padding(ctx, 0)
        self._ctx = ctx

    def update(self, data):
        buf = self._backend._ffi.new("unsigned char[]",
                                     len(data) + self._block_size_bytes - 1)
        outlen = self._backend._ffi.new("int *")
        res = self._backend._lib.EVP_CipherUpdate(self._ctx, buf, outlen, data,
                                                  len(data))
        self._backend.openssl_assert(res != 0)
        return self._backend._ffi.buffer(buf)[:outlen[0]]

    def finalize(self):
        # OpenSSL 1.0.1 on Ubuntu 12.04 (and possibly other distributions)
        # appears to have a bug where you must make at least one call to update
        # even if you are only using authenticate_additional_data or the
        # GCM tag will be wrong. An (empty) call to update resolves this
        # and is harmless for all other versions of OpenSSL.
        if isinstance(self._mode, modes.GCM):
            self.update(b"")

        buf = self._backend._ffi.new("unsigned char[]", self._block_size_bytes)
        outlen = self._backend._ffi.new("int *")
        res = self._backend._lib.EVP_CipherFinal_ex(self._ctx, buf, outlen)
        if res == 0:
            errors = self._backend._consume_errors()

            if not errors and isinstance(self._mode, modes.GCM):
                raise InvalidTag

            self._backend.openssl_assert(
                errors[0][1:] == (
                    self._backend._lib.ERR_LIB_EVP,
                    self._backend._lib.EVP_F_EVP_ENCRYPTFINAL_EX,
                    self._backend._lib.EVP_R_DATA_NOT_MULTIPLE_OF_BLOCK_LENGTH
                ) or errors[0][1:] == (
                    self._backend._lib.ERR_LIB_EVP,
                    self._backend._lib.EVP_F_EVP_DECRYPTFINAL_EX,
                    self._backend._lib.EVP_R_DATA_NOT_MULTIPLE_OF_BLOCK_LENGTH
                )
            )
            raise ValueError(
                "The length of the provided data is not a multiple of "
                "the block length."
            )

        if (isinstance(self._mode, modes.GCM) and
           self._operation == self._ENCRYPT):
            tag_buf = self._backend._ffi.new(
                "unsigned char[]", self._block_size_bytes
            )
            res = self._backend._lib.EVP_CIPHER_CTX_ctrl(
                self._ctx, self._backend._lib.EVP_CTRL_GCM_GET_TAG,
                self._block_size_bytes, tag_buf
            )
            self._backend.openssl_assert(res != 0)
            self._tag = self._backend._ffi.buffer(tag_buf)[:]

        res = self._backend._lib.EVP_CIPHER_CTX_cleanup(self._ctx)
        self._backend.openssl_assert(res == 1)
        return self._backend._ffi.buffer(buf)[:outlen[0]]

    def authenticate_additional_data(self, data):
        outlen = self._backend._ffi.new("int *")
        res = self._backend._lib.EVP_CipherUpdate(
            self._ctx, self._backend._ffi.NULL, outlen, data, len(data)
        )
        self._backend.openssl_assert(res != 0)

    tag = utils.read_only_property("_tag")


@utils.register_interface(ciphers.CipherContext)
class _AESCTRCipherContext(object):
    """
    This is needed to provide support for AES CTR mode in OpenSSL 1.0.0. It can
    be removed when we drop 1.0.0 support (RHEL 6.4 is the only thing that
    ships it).
    """
    def __init__(self, backend, cipher, mode):
        self._backend = backend

        self._key = self._backend._ffi.new("AES_KEY *")
        res = self._backend._lib.AES_set_encrypt_key(
            cipher.key, len(cipher.key) * 8, self._key
        )
        self._backend.openssl_assert(res == 0)
        self._ecount = self._backend._ffi.new("unsigned char[]", 16)
        self._nonce = self._backend._ffi.new("unsigned char[16]", mode.nonce)
        self._num = self._backend._ffi.new("unsigned int *", 0)

    def update(self, data):
        buf = self._backend._ffi.new("unsigned char[]", len(data))
        self._backend._lib.AES_ctr128_encrypt(
            data, buf, len(data), self._key, self._nonce,
            self._ecount, self._num
        )
        return self._backend._ffi.buffer(buf)[:]

    def finalize(self):
        self._key = None
        self._ecount = None
        self._nonce = None
        self._num = None
        return b""
