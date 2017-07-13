# This file is dual licensed under the terms of the Apache License, Version
# 2.0, and the BSD License. See the LICENSE file in the root of this repository
# for complete details.

from __future__ import absolute_import, division, print_function

from cryptography import utils
from cryptography.exceptions import (
    InvalidTag, UnsupportedAlgorithm, _Reasons
)
from cryptography.hazmat.primitives import ciphers, constant_time
from cryptography.hazmat.primitives.ciphers import modes
from cryptography.hazmat.primitives.ciphers.modes import (
    CFB, CFB8, CTR, OFB
)


@utils.register_interface(ciphers.CipherContext)
class _CipherContext(object):
    def __init__(self, backend, cipher, mode, operation):
        self._backend = backend
        self._cipher = cipher
        self._mode = mode
        self._operation = operation
        # There is a bug in CommonCrypto where block ciphers do not raise
        # kCCAlignmentError when finalizing if you supply non-block aligned
        # data. To work around this we need to keep track of the block
        # alignment ourselves, but only for alg+mode combos that require
        # block alignment. OFB, CFB, and CTR make a block cipher algorithm
        # into a stream cipher so we don't need to track them (and thus their
        # block size is effectively 1 byte just like OpenSSL/CommonCrypto
        # treat RC4 and other stream cipher block sizes).
        # This bug has been filed as rdar://15589470
        self._bytes_processed = 0
        if (isinstance(cipher, ciphers.BlockCipherAlgorithm) and not
                isinstance(mode, (OFB, CFB, CFB8, CTR))):
            self._byte_block_size = cipher.block_size // 8
        else:
            self._byte_block_size = 1

        registry = self._backend._cipher_registry
        try:
            cipher_enum, mode_enum = registry[type(cipher), type(mode)]
        except KeyError:
            raise UnsupportedAlgorithm(
                "cipher {0} in {1} mode is not supported "
                "by this backend.".format(
                    cipher.name, mode.name if mode else mode),
                _Reasons.UNSUPPORTED_CIPHER
            )

        ctx = self._backend._ffi.new("CCCryptorRef *")
        ctx = self._backend._ffi.gc(ctx, self._backend._release_cipher_ctx)

        if isinstance(mode, modes.ModeWithInitializationVector):
            iv_nonce = mode.initialization_vector
        elif isinstance(mode, modes.ModeWithNonce):
            iv_nonce = mode.nonce
        else:
            iv_nonce = self._backend._ffi.NULL

        if isinstance(mode, CTR):
            mode_option = self._backend._lib.kCCModeOptionCTR_BE
        else:
            mode_option = 0

        res = self._backend._lib.CCCryptorCreateWithMode(
            operation,
            mode_enum, cipher_enum,
            self._backend._lib.ccNoPadding, iv_nonce,
            cipher.key, len(cipher.key),
            self._backend._ffi.NULL, 0, 0, mode_option, ctx)
        self._backend._check_cipher_response(res)

        self._ctx = ctx

    def update(self, data):
        # Count bytes processed to handle block alignment.
        self._bytes_processed += len(data)
        buf = self._backend._ffi.new(
            "unsigned char[]", len(data) + self._byte_block_size - 1)
        outlen = self._backend._ffi.new("size_t *")
        res = self._backend._lib.CCCryptorUpdate(
            self._ctx[0], data, len(data), buf,
            len(data) + self._byte_block_size - 1, outlen)
        self._backend._check_cipher_response(res)
        return self._backend._ffi.buffer(buf)[:outlen[0]]

    def finalize(self):
        # Raise error if block alignment is wrong.
        if self._bytes_processed % self._byte_block_size:
            raise ValueError(
                "The length of the provided data is not a multiple of "
                "the block length."
            )
        buf = self._backend._ffi.new("unsigned char[]", self._byte_block_size)
        outlen = self._backend._ffi.new("size_t *")
        res = self._backend._lib.CCCryptorFinal(
            self._ctx[0], buf, len(buf), outlen)
        self._backend._check_cipher_response(res)
        self._backend._release_cipher_ctx(self._ctx)
        return self._backend._ffi.buffer(buf)[:outlen[0]]


@utils.register_interface(ciphers.AEADCipherContext)
@utils.register_interface(ciphers.AEADEncryptionContext)
class _GCMCipherContext(object):
    def __init__(self, backend, cipher, mode, operation):
        self._backend = backend
        self._cipher = cipher
        self._mode = mode
        self._operation = operation
        self._tag = None

        registry = self._backend._cipher_registry
        try:
            cipher_enum, mode_enum = registry[type(cipher), type(mode)]
        except KeyError:
            raise UnsupportedAlgorithm(
                "cipher {0} in {1} mode is not supported "
                "by this backend.".format(
                    cipher.name, mode.name if mode else mode),
                _Reasons.UNSUPPORTED_CIPHER
            )

        ctx = self._backend._ffi.new("CCCryptorRef *")
        ctx = self._backend._ffi.gc(ctx, self._backend._release_cipher_ctx)

        self._ctx = ctx

        res = self._backend._lib.CCCryptorCreateWithMode(
            operation,
            mode_enum, cipher_enum,
            self._backend._lib.ccNoPadding,
            self._backend._ffi.NULL,
            cipher.key, len(cipher.key),
            self._backend._ffi.NULL, 0, 0, 0, self._ctx)
        self._backend._check_cipher_response(res)

        res = self._backend._lib.CCCryptorGCMAddIV(
            self._ctx[0],
            mode.initialization_vector,
            len(mode.initialization_vector)
        )
        self._backend._check_cipher_response(res)
        # CommonCrypto has a bug where calling update without at least one
        # call to authenticate_additional_data will result in null byte output
        # for ciphertext. The following empty byte string call prevents the
        # issue, which is present in at least 10.8 and 10.9.
        # Filed as rdar://18314544
        self.authenticate_additional_data(b"")

    def update(self, data):
        buf = self._backend._ffi.new("unsigned char[]", len(data))
        args = (self._ctx[0], data, len(data), buf)
        if self._operation == self._backend._lib.kCCEncrypt:
            res = self._backend._lib.CCCryptorGCMEncrypt(*args)
        else:
            res = self._backend._lib.CCCryptorGCMDecrypt(*args)

        self._backend._check_cipher_response(res)
        return self._backend._ffi.buffer(buf)[:]

    def finalize(self):
        # CommonCrypto has a yet another bug where you must make at least one
        # call to update. If you pass just AAD and call finalize without a call
        # to update you'll get null bytes for tag. The following update call
        # prevents this issue, which is present in at least 10.8 and 10.9.
        # Filed as rdar://18314580
        self.update(b"")
        tag_size = self._cipher.block_size // 8
        tag_buf = self._backend._ffi.new("unsigned char[]", tag_size)
        tag_len = self._backend._ffi.new("size_t *", tag_size)
        res = self._backend._lib.CCCryptorGCMFinal(
            self._ctx[0], tag_buf, tag_len
        )
        self._backend._check_cipher_response(res)
        self._backend._release_cipher_ctx(self._ctx)
        self._tag = self._backend._ffi.buffer(tag_buf)[:]
        if (self._operation == self._backend._lib.kCCDecrypt and
                not constant_time.bytes_eq(
                    self._tag[:len(self._mode.tag)], self._mode.tag
                )):
            raise InvalidTag
        return b""

    def authenticate_additional_data(self, data):
        res = self._backend._lib.CCCryptorGCMAddAAD(
            self._ctx[0], data, len(data)
        )
        self._backend._check_cipher_response(res)

    tag = utils.read_only_property("_tag")
