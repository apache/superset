# This file is dual licensed under the terms of the Apache License, Version
# 2.0, and the BSD License. See the LICENSE file in the root of this repository
# for complete details.

from __future__ import absolute_import, division, print_function

import base64
import calendar
import collections
import contextlib
import itertools
import sys
from contextlib import contextmanager

import six

from cryptography import utils, x509
from cryptography.exceptions import UnsupportedAlgorithm, _Reasons
from cryptography.hazmat.backends.interfaces import (
    CMACBackend, CipherBackend, DERSerializationBackend, DHBackend, DSABackend,
    EllipticCurveBackend, HMACBackend, HashBackend, PBKDF2HMACBackend,
    PEMSerializationBackend, RSABackend, ScryptBackend, X509Backend
)
from cryptography.hazmat.backends.openssl.ciphers import (
    _AESCTRCipherContext, _CipherContext
)
from cryptography.hazmat.backends.openssl.cmac import _CMACContext
from cryptography.hazmat.backends.openssl.dh import (
    _DHParameters, _DHPrivateKey, _DHPublicKey
)
from cryptography.hazmat.backends.openssl.dsa import (
    _DSAParameters, _DSAPrivateKey, _DSAPublicKey
)
from cryptography.hazmat.backends.openssl.ec import (
    _EllipticCurvePrivateKey, _EllipticCurvePublicKey
)
from cryptography.hazmat.backends.openssl.encode_asn1 import (
    _CRL_ENTRY_EXTENSION_ENCODE_HANDLERS,
    _CRL_EXTENSION_ENCODE_HANDLERS, _EXTENSION_ENCODE_HANDLERS,
    _encode_asn1_int_gc, _encode_asn1_str_gc, _encode_name_gc, _txt2obj_gc,
)
from cryptography.hazmat.backends.openssl.hashes import _HashContext
from cryptography.hazmat.backends.openssl.hmac import _HMACContext
from cryptography.hazmat.backends.openssl.rsa import (
    _RSAPrivateKey, _RSAPublicKey
)
from cryptography.hazmat.backends.openssl.x509 import (
    _Certificate, _CertificateRevocationList,
    _CertificateSigningRequest, _RevokedCertificate
)
from cryptography.hazmat.bindings._openssl import ffi as _ffi
from cryptography.hazmat.bindings.openssl import binding
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import dsa, ec, rsa
from cryptography.hazmat.primitives.asymmetric.padding import (
    MGF1, OAEP, PKCS1v15, PSS
)
from cryptography.hazmat.primitives.ciphers.algorithms import (
    AES, ARC4, Blowfish, CAST5, Camellia, IDEA, SEED, TripleDES
)
from cryptography.hazmat.primitives.ciphers.modes import (
    CBC, CFB, CFB8, CTR, ECB, GCM, OFB
)


_MemoryBIO = collections.namedtuple("_MemoryBIO", ["bio", "char_ptr"])


class _PasswordUserdata(object):
    def __init__(self, password):
        self.password = password
        self.called = 0
        self.exception = None


@binding.ffi_callback("int (char *, int, int, void *)",
                      name="Cryptography_pem_password_cb")
def _pem_password_cb(buf, size, writing, userdata_handle):
    """
    A pem_password_cb function pointer that copied the password to
    OpenSSL as required and returns the number of bytes copied.

    typedef int pem_password_cb(char *buf, int size,
                                int rwflag, void *userdata);

    Useful for decrypting PKCS8 files and so on.

    The userdata pointer must point to a cffi handle of a
    _PasswordUserdata instance.
    """
    ud = _ffi.from_handle(userdata_handle)
    ud.called += 1

    if not ud.password:
        ud.exception = TypeError(
            "Password was not given but private key is encrypted."
        )
        return -1
    elif len(ud.password) < size:
        pw_buf = _ffi.buffer(buf, size)
        pw_buf[:len(ud.password)] = ud.password
        return len(ud.password)
    else:
        ud.exception = ValueError(
            "Passwords longer than {0} bytes are not supported "
            "by this backend.".format(size - 1)
        )
        return 0


@utils.register_interface(CipherBackend)
@utils.register_interface(CMACBackend)
@utils.register_interface(DERSerializationBackend)
@utils.register_interface(DHBackend)
@utils.register_interface(DSABackend)
@utils.register_interface(EllipticCurveBackend)
@utils.register_interface(HashBackend)
@utils.register_interface(HMACBackend)
@utils.register_interface(PBKDF2HMACBackend)
@utils.register_interface(RSABackend)
@utils.register_interface(PEMSerializationBackend)
@utils.register_interface(X509Backend)
@utils.register_interface_if(
    binding.Binding().lib.Cryptography_HAS_SCRYPT, ScryptBackend
)
class Backend(object):
    """
    OpenSSL API binding interfaces.
    """
    name = "openssl"

    def __init__(self):
        self._binding = binding.Binding()
        self._ffi = self._binding.ffi
        self._lib = self._binding.lib

        # Set the default string mask for encoding ASN1 strings to UTF8. This
        # is the default for newer OpenSSLs for several years and is
        # recommended in RFC 2459.
        res = self._lib.ASN1_STRING_set_default_mask_asc(b"utf8only")
        self.openssl_assert(res == 1)

        self._cipher_registry = {}
        self._register_default_ciphers()
        self.activate_osrandom_engine()

    def openssl_assert(self, ok):
        return binding._openssl_assert(self._lib, ok)

    def activate_builtin_random(self):
        # Obtain a new structural reference.
        e = self._lib.ENGINE_get_default_RAND()
        if e != self._ffi.NULL:
            self._lib.ENGINE_unregister_RAND(e)
            # Reset the RNG to use the new engine.
            self._lib.RAND_cleanup()
            # decrement the structural reference from get_default_RAND
            res = self._lib.ENGINE_finish(e)
            self.openssl_assert(res == 1)

    @contextlib.contextmanager
    def _get_osurandom_engine(self):
        # Fetches an engine by id and returns it. This creates a structural
        # reference.
        e = self._lib.ENGINE_by_id(self._binding._osrandom_engine_id)
        self.openssl_assert(e != self._ffi.NULL)
        # Initialize the engine for use. This adds a functional reference.
        res = self._lib.ENGINE_init(e)
        self.openssl_assert(res == 1)

        try:
            yield e
        finally:
            # Decrement the structural ref incremented by ENGINE_by_id.
            res = self._lib.ENGINE_free(e)
            self.openssl_assert(res == 1)
            # Decrement the functional ref incremented by ENGINE_init.
            res = self._lib.ENGINE_finish(e)
            self.openssl_assert(res == 1)

    def activate_osrandom_engine(self):
        # Unregister and free the current engine.
        self.activate_builtin_random()
        with self._get_osurandom_engine() as e:
            # Set the engine as the default RAND provider.
            res = self._lib.ENGINE_set_default_RAND(e)
            self.openssl_assert(res == 1)
        # Reset the RNG to use the new engine.
        self._lib.RAND_cleanup()

    def osrandom_engine_implementation(self):
        buf = self._ffi.new("char[]", 64)
        with self._get_osurandom_engine() as e:
            res = self._lib.ENGINE_ctrl_cmd(e, b"get_implementation",
                                            len(buf), buf,
                                            self._ffi.NULL, 0)
            self.openssl_assert(res > 0)
        return self._ffi.string(buf).decode('ascii')

    def openssl_version_text(self):
        """
        Friendly string name of the loaded OpenSSL library. This is not
        necessarily the same version as it was compiled against.

        Example: OpenSSL 1.0.1e 11 Feb 2013
        """
        return self._ffi.string(
            self._lib.OpenSSL_version(self._lib.OPENSSL_VERSION)
        ).decode("ascii")

    def create_hmac_ctx(self, key, algorithm):
        return _HMACContext(self, key, algorithm)

    def _build_openssl_digest_name(self, algorithm):
        if algorithm.name == "blake2b" or algorithm.name == "blake2s":
            alg = "{0}{1}".format(
                algorithm.name, algorithm.digest_size * 8
            ).encode("ascii")
        else:
            alg = algorithm.name.encode("ascii")

        return alg

    def hash_supported(self, algorithm):
        name = self._build_openssl_digest_name(algorithm)
        digest = self._lib.EVP_get_digestbyname(name)
        return digest != self._ffi.NULL

    def hmac_supported(self, algorithm):
        return self.hash_supported(algorithm)

    def create_hash_ctx(self, algorithm):
        return _HashContext(self, algorithm)

    def cipher_supported(self, cipher, mode):
        if self._evp_cipher_supported(cipher, mode):
            return True
        elif isinstance(mode, CTR) and isinstance(cipher, AES):
            return True
        else:
            return False

    def _evp_cipher_supported(self, cipher, mode):
        try:
            adapter = self._cipher_registry[type(cipher), type(mode)]
        except KeyError:
            return False
        evp_cipher = adapter(self, cipher, mode)
        return self._ffi.NULL != evp_cipher

    def register_cipher_adapter(self, cipher_cls, mode_cls, adapter):
        if (cipher_cls, mode_cls) in self._cipher_registry:
            raise ValueError("Duplicate registration for: {0} {1}.".format(
                cipher_cls, mode_cls)
            )
        self._cipher_registry[cipher_cls, mode_cls] = adapter

    def _register_default_ciphers(self):
        for mode_cls in [CBC, CTR, ECB, OFB, CFB, CFB8, GCM]:
            self.register_cipher_adapter(
                AES,
                mode_cls,
                GetCipherByName("{cipher.name}-{cipher.key_size}-{mode.name}")
            )
        for mode_cls in [CBC, CTR, ECB, OFB, CFB]:
            self.register_cipher_adapter(
                Camellia,
                mode_cls,
                GetCipherByName("{cipher.name}-{cipher.key_size}-{mode.name}")
            )
        for mode_cls in [CBC, CFB, CFB8, OFB]:
            self.register_cipher_adapter(
                TripleDES,
                mode_cls,
                GetCipherByName("des-ede3-{mode.name}")
            )
        self.register_cipher_adapter(
            TripleDES,
            ECB,
            GetCipherByName("des-ede3")
        )
        for mode_cls in [CBC, CFB, OFB, ECB]:
            self.register_cipher_adapter(
                Blowfish,
                mode_cls,
                GetCipherByName("bf-{mode.name}")
            )
        for mode_cls in [CBC, CFB, OFB, ECB]:
            self.register_cipher_adapter(
                SEED,
                mode_cls,
                GetCipherByName("seed-{mode.name}")
            )
        for cipher_cls, mode_cls in itertools.product(
            [CAST5, IDEA],
            [CBC, OFB, CFB, ECB],
        ):
            self.register_cipher_adapter(
                cipher_cls,
                mode_cls,
                GetCipherByName("{cipher.name}-{mode.name}")
            )
        self.register_cipher_adapter(
            ARC4,
            type(None),
            GetCipherByName("rc4")
        )

    def create_symmetric_encryption_ctx(self, cipher, mode):
        if (isinstance(mode, CTR) and isinstance(cipher, AES) and
                not self._evp_cipher_supported(cipher, mode)):
            # This is needed to provide support for AES CTR mode in OpenSSL
            # 1.0.0. It can be removed when we drop 1.0.0 support (RHEL 6.4).
            return _AESCTRCipherContext(self, cipher, mode)
        else:
            return _CipherContext(self, cipher, mode, _CipherContext._ENCRYPT)

    def create_symmetric_decryption_ctx(self, cipher, mode):
        if (isinstance(mode, CTR) and isinstance(cipher, AES) and
                not self._evp_cipher_supported(cipher, mode)):
            # This is needed to provide support for AES CTR mode in OpenSSL
            # 1.0.0. It can be removed when we drop 1.0.0 support (RHEL 6.4).
            return _AESCTRCipherContext(self, cipher, mode)
        else:
            return _CipherContext(self, cipher, mode, _CipherContext._DECRYPT)

    def pbkdf2_hmac_supported(self, algorithm):
        return self.hmac_supported(algorithm)

    def derive_pbkdf2_hmac(self, algorithm, length, salt, iterations,
                           key_material):
        buf = self._ffi.new("unsigned char[]", length)
        evp_md = self._lib.EVP_get_digestbyname(
            algorithm.name.encode("ascii"))
        self.openssl_assert(evp_md != self._ffi.NULL)
        res = self._lib.PKCS5_PBKDF2_HMAC(
            key_material,
            len(key_material),
            salt,
            len(salt),
            iterations,
            evp_md,
            length,
            buf
        )
        self.openssl_assert(res == 1)
        return self._ffi.buffer(buf)[:]

    def _consume_errors(self):
        return binding._consume_errors(self._lib)

    def _bn_to_int(self, bn):
        assert bn != self._ffi.NULL

        if six.PY3:
            # Python 3 has constant time from_bytes, so use that.
            bn_num_bytes = self._lib.BN_num_bytes(bn)
            bin_ptr = self._ffi.new("unsigned char[]", bn_num_bytes)
            bin_len = self._lib.BN_bn2bin(bn, bin_ptr)
            # A zero length means the BN has value 0
            self.openssl_assert(bin_len >= 0)
            return int.from_bytes(self._ffi.buffer(bin_ptr)[:bin_len], "big")
        else:
            # Under Python 2 the best we can do is hex()
            hex_cdata = self._lib.BN_bn2hex(bn)
            self.openssl_assert(hex_cdata != self._ffi.NULL)
            hex_str = self._ffi.string(hex_cdata)
            self._lib.OPENSSL_free(hex_cdata)
            return int(hex_str, 16)

    def _int_to_bn(self, num, bn=None):
        """
        Converts a python integer to a BIGNUM. The returned BIGNUM will not
        be garbage collected (to support adding them to structs that take
        ownership of the object). Be sure to register it for GC if it will
        be discarded after use.
        """
        assert bn is None or bn != self._ffi.NULL

        if bn is None:
            bn = self._ffi.NULL

        if six.PY3:
            # Python 3 has constant time to_bytes, so use that.

            binary = num.to_bytes(int(num.bit_length() / 8.0 + 1), "big")
            bn_ptr = self._lib.BN_bin2bn(binary, len(binary), bn)
            self.openssl_assert(bn_ptr != self._ffi.NULL)
            return bn_ptr

        else:
            # Under Python 2 the best we can do is hex()

            hex_num = hex(num).rstrip("L").lstrip("0x").encode("ascii") or b"0"
            bn_ptr = self._ffi.new("BIGNUM **")
            bn_ptr[0] = bn
            res = self._lib.BN_hex2bn(bn_ptr, hex_num)
            self.openssl_assert(res != 0)
            self.openssl_assert(bn_ptr[0] != self._ffi.NULL)
            return bn_ptr[0]

    def generate_rsa_private_key(self, public_exponent, key_size):
        rsa._verify_rsa_parameters(public_exponent, key_size)

        rsa_cdata = self._lib.RSA_new()
        self.openssl_assert(rsa_cdata != self._ffi.NULL)
        rsa_cdata = self._ffi.gc(rsa_cdata, self._lib.RSA_free)

        bn = self._int_to_bn(public_exponent)
        bn = self._ffi.gc(bn, self._lib.BN_free)

        res = self._lib.RSA_generate_key_ex(
            rsa_cdata, key_size, bn, self._ffi.NULL
        )
        self.openssl_assert(res == 1)
        evp_pkey = self._rsa_cdata_to_evp_pkey(rsa_cdata)

        return _RSAPrivateKey(self, rsa_cdata, evp_pkey)

    def generate_rsa_parameters_supported(self, public_exponent, key_size):
        return (public_exponent >= 3 and public_exponent & 1 != 0 and
                key_size >= 512)

    def load_rsa_private_numbers(self, numbers):
        rsa._check_private_key_components(
            numbers.p,
            numbers.q,
            numbers.d,
            numbers.dmp1,
            numbers.dmq1,
            numbers.iqmp,
            numbers.public_numbers.e,
            numbers.public_numbers.n
        )
        rsa_cdata = self._lib.RSA_new()
        self.openssl_assert(rsa_cdata != self._ffi.NULL)
        rsa_cdata = self._ffi.gc(rsa_cdata, self._lib.RSA_free)
        p = self._int_to_bn(numbers.p)
        q = self._int_to_bn(numbers.q)
        d = self._int_to_bn(numbers.d)
        dmp1 = self._int_to_bn(numbers.dmp1)
        dmq1 = self._int_to_bn(numbers.dmq1)
        iqmp = self._int_to_bn(numbers.iqmp)
        e = self._int_to_bn(numbers.public_numbers.e)
        n = self._int_to_bn(numbers.public_numbers.n)
        res = self._lib.RSA_set0_factors(rsa_cdata, p, q)
        self.openssl_assert(res == 1)
        res = self._lib.RSA_set0_key(rsa_cdata, n, e, d)
        self.openssl_assert(res == 1)
        res = self._lib.RSA_set0_crt_params(rsa_cdata, dmp1, dmq1, iqmp)
        self.openssl_assert(res == 1)
        res = self._lib.RSA_blinding_on(rsa_cdata, self._ffi.NULL)
        self.openssl_assert(res == 1)
        evp_pkey = self._rsa_cdata_to_evp_pkey(rsa_cdata)

        return _RSAPrivateKey(self, rsa_cdata, evp_pkey)

    def load_rsa_public_numbers(self, numbers):
        rsa._check_public_key_components(numbers.e, numbers.n)
        rsa_cdata = self._lib.RSA_new()
        self.openssl_assert(rsa_cdata != self._ffi.NULL)
        rsa_cdata = self._ffi.gc(rsa_cdata, self._lib.RSA_free)
        e = self._int_to_bn(numbers.e)
        n = self._int_to_bn(numbers.n)
        res = self._lib.RSA_set0_key(rsa_cdata, n, e, self._ffi.NULL)
        self.openssl_assert(res == 1)
        evp_pkey = self._rsa_cdata_to_evp_pkey(rsa_cdata)

        return _RSAPublicKey(self, rsa_cdata, evp_pkey)

    def _create_evp_pkey_gc(self):
        evp_pkey = self._lib.EVP_PKEY_new()
        self.openssl_assert(evp_pkey != self._ffi.NULL)
        evp_pkey = self._ffi.gc(evp_pkey, self._lib.EVP_PKEY_free)
        return evp_pkey

    def _rsa_cdata_to_evp_pkey(self, rsa_cdata):
        evp_pkey = self._create_evp_pkey_gc()
        res = self._lib.EVP_PKEY_set1_RSA(evp_pkey, rsa_cdata)
        self.openssl_assert(res == 1)
        return evp_pkey

    def _bytes_to_bio(self, data):
        """
        Return a _MemoryBIO namedtuple of (BIO, char*).

        The char* is the storage for the BIO and it must stay alive until the
        BIO is finished with.
        """
        data_char_p = self._ffi.new("char[]", data)
        bio = self._lib.BIO_new_mem_buf(
            data_char_p, len(data)
        )
        self.openssl_assert(bio != self._ffi.NULL)

        return _MemoryBIO(self._ffi.gc(bio, self._lib.BIO_free), data_char_p)

    def _create_mem_bio_gc(self):
        """
        Creates an empty memory BIO.
        """
        bio_method = self._lib.BIO_s_mem()
        self.openssl_assert(bio_method != self._ffi.NULL)
        bio = self._lib.BIO_new(bio_method)
        self.openssl_assert(bio != self._ffi.NULL)
        bio = self._ffi.gc(bio, self._lib.BIO_free)
        return bio

    def _read_mem_bio(self, bio):
        """
        Reads a memory BIO. This only works on memory BIOs.
        """
        buf = self._ffi.new("char **")
        buf_len = self._lib.BIO_get_mem_data(bio, buf)
        self.openssl_assert(buf_len > 0)
        self.openssl_assert(buf[0] != self._ffi.NULL)
        bio_data = self._ffi.buffer(buf[0], buf_len)[:]
        return bio_data

    def _evp_pkey_to_private_key(self, evp_pkey):
        """
        Return the appropriate type of PrivateKey given an evp_pkey cdata
        pointer.
        """

        key_type = self._lib.EVP_PKEY_id(evp_pkey)

        if key_type == self._lib.EVP_PKEY_RSA:
            rsa_cdata = self._lib.EVP_PKEY_get1_RSA(evp_pkey)
            self.openssl_assert(rsa_cdata != self._ffi.NULL)
            rsa_cdata = self._ffi.gc(rsa_cdata, self._lib.RSA_free)
            return _RSAPrivateKey(self, rsa_cdata, evp_pkey)
        elif key_type == self._lib.EVP_PKEY_DSA:
            dsa_cdata = self._lib.EVP_PKEY_get1_DSA(evp_pkey)
            self.openssl_assert(dsa_cdata != self._ffi.NULL)
            dsa_cdata = self._ffi.gc(dsa_cdata, self._lib.DSA_free)
            return _DSAPrivateKey(self, dsa_cdata, evp_pkey)
        elif (self._lib.Cryptography_HAS_EC == 1 and
              key_type == self._lib.EVP_PKEY_EC):
            ec_cdata = self._lib.EVP_PKEY_get1_EC_KEY(evp_pkey)
            self.openssl_assert(ec_cdata != self._ffi.NULL)
            ec_cdata = self._ffi.gc(ec_cdata, self._lib.EC_KEY_free)
            return _EllipticCurvePrivateKey(self, ec_cdata, evp_pkey)
        else:
            raise UnsupportedAlgorithm("Unsupported key type.")

    def _evp_pkey_to_public_key(self, evp_pkey):
        """
        Return the appropriate type of PublicKey given an evp_pkey cdata
        pointer.
        """

        key_type = self._lib.EVP_PKEY_id(evp_pkey)

        if key_type == self._lib.EVP_PKEY_RSA:
            rsa_cdata = self._lib.EVP_PKEY_get1_RSA(evp_pkey)
            self.openssl_assert(rsa_cdata != self._ffi.NULL)
            rsa_cdata = self._ffi.gc(rsa_cdata, self._lib.RSA_free)
            return _RSAPublicKey(self, rsa_cdata, evp_pkey)
        elif key_type == self._lib.EVP_PKEY_DSA:
            dsa_cdata = self._lib.EVP_PKEY_get1_DSA(evp_pkey)
            self.openssl_assert(dsa_cdata != self._ffi.NULL)
            dsa_cdata = self._ffi.gc(dsa_cdata, self._lib.DSA_free)
            return _DSAPublicKey(self, dsa_cdata, evp_pkey)
        elif (self._lib.Cryptography_HAS_EC == 1 and
              key_type == self._lib.EVP_PKEY_EC):
            ec_cdata = self._lib.EVP_PKEY_get1_EC_KEY(evp_pkey)
            self.openssl_assert(ec_cdata != self._ffi.NULL)
            ec_cdata = self._ffi.gc(ec_cdata, self._lib.EC_KEY_free)
            return _EllipticCurvePublicKey(self, ec_cdata, evp_pkey)
        else:
            raise UnsupportedAlgorithm("Unsupported key type.")

    def _pem_password_cb(self, password):
        """
        Generate a pem_password_cb function pointer that copied the password to
        OpenSSL as required and returns the number of bytes copied.

        typedef int pem_password_cb(char *buf, int size,
                                    int rwflag, void *userdata);

        Useful for decrypting PKCS8 files and so on.

        Returns a tuple of (cdata function pointer, userdata).
        """
        # Forward compatibility for new static callbacks:
        # _pem_password_cb is not a nested function because closures don't
        # work well with static callbacks. Static callbacks are registered
        # globally. The backend is passed in as userdata argument.

        userdata = _PasswordUserdata(password=password)
        return _pem_password_cb, userdata

    def _oaep_hash_supported(self, algorithm):
        if self._lib.Cryptography_HAS_RSA_OAEP_MD:
            return isinstance(
                algorithm, (
                    hashes.SHA1,
                    hashes.SHA224,
                    hashes.SHA256,
                    hashes.SHA384,
                    hashes.SHA512,
                )
            )
        else:
            return isinstance(algorithm, hashes.SHA1)

    def _pss_mgf1_hash_supported(self, algorithm):
        if self._lib.Cryptography_HAS_MGF1_MD:
            return self.hash_supported(algorithm)
        else:
            return isinstance(algorithm, hashes.SHA1)

    def rsa_padding_supported(self, padding):
        if isinstance(padding, PKCS1v15):
            return True
        elif isinstance(padding, PSS) and isinstance(padding._mgf, MGF1):
            return self._pss_mgf1_hash_supported(padding._mgf._algorithm)
        elif isinstance(padding, OAEP) and isinstance(padding._mgf, MGF1):
            return (
                self._oaep_hash_supported(padding._mgf._algorithm) and
                self._oaep_hash_supported(padding._algorithm)
            )
        else:
            return False

    def generate_dsa_parameters(self, key_size):
        if key_size not in (1024, 2048, 3072):
            raise ValueError("Key size must be 1024 or 2048 or 3072 bits.")

        ctx = self._lib.DSA_new()
        self.openssl_assert(ctx != self._ffi.NULL)
        ctx = self._ffi.gc(ctx, self._lib.DSA_free)

        res = self._lib.DSA_generate_parameters_ex(
            ctx, key_size, self._ffi.NULL, 0,
            self._ffi.NULL, self._ffi.NULL, self._ffi.NULL
        )

        self.openssl_assert(res == 1)

        return _DSAParameters(self, ctx)

    def generate_dsa_private_key(self, parameters):
        ctx = self._lib.DSAparams_dup(parameters._dsa_cdata)
        self.openssl_assert(ctx != self._ffi.NULL)
        ctx = self._ffi.gc(ctx, self._lib.DSA_free)
        self._lib.DSA_generate_key(ctx)
        evp_pkey = self._dsa_cdata_to_evp_pkey(ctx)

        return _DSAPrivateKey(self, ctx, evp_pkey)

    def generate_dsa_private_key_and_parameters(self, key_size):
        parameters = self.generate_dsa_parameters(key_size)
        return self.generate_dsa_private_key(parameters)

    def _dsa_cdata_set_values(self, dsa_cdata, p, q, g, pub_key, priv_key):
        res = self._lib.DSA_set0_pqg(dsa_cdata, p, q, g)
        self.openssl_assert(res == 1)
        res = self._lib.DSA_set0_key(dsa_cdata, pub_key, priv_key)
        self.openssl_assert(res == 1)

    def load_dsa_private_numbers(self, numbers):
        dsa._check_dsa_private_numbers(numbers)
        parameter_numbers = numbers.public_numbers.parameter_numbers

        dsa_cdata = self._lib.DSA_new()
        self.openssl_assert(dsa_cdata != self._ffi.NULL)
        dsa_cdata = self._ffi.gc(dsa_cdata, self._lib.DSA_free)

        p = self._int_to_bn(parameter_numbers.p)
        q = self._int_to_bn(parameter_numbers.q)
        g = self._int_to_bn(parameter_numbers.g)
        pub_key = self._int_to_bn(numbers.public_numbers.y)
        priv_key = self._int_to_bn(numbers.x)
        self._dsa_cdata_set_values(dsa_cdata, p, q, g, pub_key, priv_key)

        evp_pkey = self._dsa_cdata_to_evp_pkey(dsa_cdata)

        return _DSAPrivateKey(self, dsa_cdata, evp_pkey)

    def load_dsa_public_numbers(self, numbers):
        dsa._check_dsa_parameters(numbers.parameter_numbers)
        dsa_cdata = self._lib.DSA_new()
        self.openssl_assert(dsa_cdata != self._ffi.NULL)
        dsa_cdata = self._ffi.gc(dsa_cdata, self._lib.DSA_free)

        p = self._int_to_bn(numbers.parameter_numbers.p)
        q = self._int_to_bn(numbers.parameter_numbers.q)
        g = self._int_to_bn(numbers.parameter_numbers.g)
        pub_key = self._int_to_bn(numbers.y)
        priv_key = self._ffi.NULL
        self._dsa_cdata_set_values(dsa_cdata, p, q, g, pub_key, priv_key)

        evp_pkey = self._dsa_cdata_to_evp_pkey(dsa_cdata)

        return _DSAPublicKey(self, dsa_cdata, evp_pkey)

    def load_dsa_parameter_numbers(self, numbers):
        dsa._check_dsa_parameters(numbers)
        dsa_cdata = self._lib.DSA_new()
        self.openssl_assert(dsa_cdata != self._ffi.NULL)
        dsa_cdata = self._ffi.gc(dsa_cdata, self._lib.DSA_free)

        p = self._int_to_bn(numbers.p)
        q = self._int_to_bn(numbers.q)
        g = self._int_to_bn(numbers.g)
        res = self._lib.DSA_set0_pqg(dsa_cdata, p, q, g)
        self.openssl_assert(res == 1)

        return _DSAParameters(self, dsa_cdata)

    def _dsa_cdata_to_evp_pkey(self, dsa_cdata):
        evp_pkey = self._create_evp_pkey_gc()
        res = self._lib.EVP_PKEY_set1_DSA(evp_pkey, dsa_cdata)
        self.openssl_assert(res == 1)
        return evp_pkey

    def dsa_hash_supported(self, algorithm):
        return self.hash_supported(algorithm)

    def dsa_parameters_supported(self, p, q, g):
        return True

    def cmac_algorithm_supported(self, algorithm):
        return (
            self._lib.Cryptography_HAS_CMAC == 1 and
            self.cipher_supported(
                algorithm, CBC(b"\x00" * algorithm.block_size)
            )
        )

    def create_cmac_ctx(self, algorithm):
        return _CMACContext(self, algorithm)

    def create_x509_csr(self, builder, private_key, algorithm):
        if not isinstance(algorithm, hashes.HashAlgorithm):
            raise TypeError('Algorithm must be a registered hash algorithm.')

        if self._lib.CRYPTOGRAPHY_OPENSSL_LESS_THAN_101:
            if isinstance(private_key, _DSAPrivateKey):
                raise NotImplementedError(
                    "Certificate signing requests aren't implemented for DSA"
                    " keys on OpenSSL versions less than 1.0.1."
                )
            if isinstance(private_key, _EllipticCurvePrivateKey):
                raise NotImplementedError(
                    "Certificate signing requests aren't implemented for EC"
                    " keys on OpenSSL versions less than 1.0.1."
                )

        # Resolve the signature algorithm.
        evp_md = self._lib.EVP_get_digestbyname(
            algorithm.name.encode('ascii')
        )
        self.openssl_assert(evp_md != self._ffi.NULL)

        # Create an empty request.
        x509_req = self._lib.X509_REQ_new()
        self.openssl_assert(x509_req != self._ffi.NULL)
        x509_req = self._ffi.gc(x509_req, self._lib.X509_REQ_free)

        # Set x509 version.
        res = self._lib.X509_REQ_set_version(x509_req, x509.Version.v1.value)
        self.openssl_assert(res == 1)

        # Set subject name.
        res = self._lib.X509_REQ_set_subject_name(
            x509_req, _encode_name_gc(self, builder._subject_name)
        )
        self.openssl_assert(res == 1)

        # Set subject public key.
        public_key = private_key.public_key()
        res = self._lib.X509_REQ_set_pubkey(
            x509_req, public_key._evp_pkey
        )
        self.openssl_assert(res == 1)

        # Add extensions.
        sk_extension = self._lib.sk_X509_EXTENSION_new_null()
        self.openssl_assert(sk_extension != self._ffi.NULL)
        sk_extension = self._ffi.gc(
            sk_extension, self._lib.sk_X509_EXTENSION_free
        )
        # gc is not necessary for CSRs, as sk_X509_EXTENSION_free
        # will release all the X509_EXTENSIONs.
        self._create_x509_extensions(
            extensions=builder._extensions,
            handlers=_EXTENSION_ENCODE_HANDLERS,
            x509_obj=sk_extension,
            add_func=self._lib.sk_X509_EXTENSION_insert,
            gc=False
        )
        res = self._lib.X509_REQ_add_extensions(x509_req, sk_extension)
        self.openssl_assert(res == 1)

        # Sign the request using the requester's private key.
        res = self._lib.X509_REQ_sign(
            x509_req, private_key._evp_pkey, evp_md
        )
        if res == 0:
            errors = self._consume_errors()
            self.openssl_assert(errors[0][1] == self._lib.ERR_LIB_RSA)
            self.openssl_assert(
                errors[0][3] == self._lib.RSA_R_DIGEST_TOO_BIG_FOR_RSA_KEY
            )
            raise ValueError("Digest too big for RSA key")

        return _CertificateSigningRequest(self, x509_req)

    def create_x509_certificate(self, builder, private_key, algorithm):
        if not isinstance(builder, x509.CertificateBuilder):
            raise TypeError('Builder type mismatch.')
        if not isinstance(algorithm, hashes.HashAlgorithm):
            raise TypeError('Algorithm must be a registered hash algorithm.')

        if self._lib.CRYPTOGRAPHY_OPENSSL_LESS_THAN_101:
            if isinstance(private_key, _DSAPrivateKey):
                raise NotImplementedError(
                    "Certificate signatures aren't implemented for DSA"
                    " keys on OpenSSL versions less than 1.0.1."
                )
            if isinstance(private_key, _EllipticCurvePrivateKey):
                raise NotImplementedError(
                    "Certificate signatures aren't implemented for EC"
                    " keys on OpenSSL versions less than 1.0.1."
                )

        # Resolve the signature algorithm.
        evp_md = self._lib.EVP_get_digestbyname(
            algorithm.name.encode('ascii')
        )
        self.openssl_assert(evp_md != self._ffi.NULL)

        # Create an empty certificate.
        x509_cert = self._lib.X509_new()
        x509_cert = self._ffi.gc(x509_cert, backend._lib.X509_free)

        # Set the x509 version.
        res = self._lib.X509_set_version(x509_cert, builder._version.value)
        self.openssl_assert(res == 1)

        # Set the subject's name.
        res = self._lib.X509_set_subject_name(
            x509_cert, _encode_name_gc(self, builder._subject_name)
        )
        self.openssl_assert(res == 1)

        # Set the subject's public key.
        res = self._lib.X509_set_pubkey(
            x509_cert, builder._public_key._evp_pkey
        )
        self.openssl_assert(res == 1)

        # Set the certificate serial number.
        serial_number = _encode_asn1_int_gc(self, builder._serial_number)
        res = self._lib.X509_set_serialNumber(x509_cert, serial_number)
        self.openssl_assert(res == 1)

        # Set the "not before" time.
        res = self._lib.ASN1_TIME_set(
            self._lib.X509_get_notBefore(x509_cert),
            calendar.timegm(builder._not_valid_before.timetuple())
        )
        if res == self._ffi.NULL:
            self._raise_time_set_error()

        # Set the "not after" time.
        res = self._lib.ASN1_TIME_set(
            self._lib.X509_get_notAfter(x509_cert),
            calendar.timegm(builder._not_valid_after.timetuple())
        )
        if res == self._ffi.NULL:
            self._raise_time_set_error()

        # Add extensions.
        self._create_x509_extensions(
            extensions=builder._extensions,
            handlers=_EXTENSION_ENCODE_HANDLERS,
            x509_obj=x509_cert,
            add_func=self._lib.X509_add_ext,
            gc=True
        )

        # Set the issuer name.
        res = self._lib.X509_set_issuer_name(
            x509_cert, _encode_name_gc(self, builder._issuer_name)
        )
        self.openssl_assert(res == 1)

        # Sign the certificate with the issuer's private key.
        res = self._lib.X509_sign(
            x509_cert, private_key._evp_pkey, evp_md
        )
        if res == 0:
            errors = self._consume_errors()
            self.openssl_assert(errors[0][1] == self._lib.ERR_LIB_RSA)
            self.openssl_assert(
                errors[0][3] == self._lib.RSA_R_DIGEST_TOO_BIG_FOR_RSA_KEY
            )
            raise ValueError("Digest too big for RSA key")

        return _Certificate(self, x509_cert)

    def _raise_time_set_error(self):
        errors = self._consume_errors()
        self.openssl_assert(errors[0][1] == self._lib.ERR_LIB_ASN1)
        self.openssl_assert(
            errors[0][3] == self._lib.ASN1_R_ERROR_GETTING_TIME
        )
        raise ValueError(
            "Invalid time. This error can occur if you set a time too far in "
            "the future on Windows."
        )

    def create_x509_crl(self, builder, private_key, algorithm):
        if not isinstance(builder, x509.CertificateRevocationListBuilder):
            raise TypeError('Builder type mismatch.')
        if not isinstance(algorithm, hashes.HashAlgorithm):
            raise TypeError('Algorithm must be a registered hash algorithm.')

        if self._lib.CRYPTOGRAPHY_OPENSSL_LESS_THAN_101:
            if isinstance(private_key, _DSAPrivateKey):
                raise NotImplementedError(
                    "CRL signatures aren't implemented for DSA"
                    " keys on OpenSSL versions less than 1.0.1."
                )
            if isinstance(private_key, _EllipticCurvePrivateKey):
                raise NotImplementedError(
                    "CRL signatures aren't implemented for EC"
                    " keys on OpenSSL versions less than 1.0.1."
                )

        evp_md = self._lib.EVP_get_digestbyname(
            algorithm.name.encode('ascii')
        )
        self.openssl_assert(evp_md != self._ffi.NULL)

        # Create an empty CRL.
        x509_crl = self._lib.X509_CRL_new()
        x509_crl = self._ffi.gc(x509_crl, backend._lib.X509_CRL_free)

        # Set the x509 CRL version. We only support v2 (integer value 1).
        res = self._lib.X509_CRL_set_version(x509_crl, 1)
        self.openssl_assert(res == 1)

        # Set the issuer name.
        res = self._lib.X509_CRL_set_issuer_name(
            x509_crl, _encode_name_gc(self, builder._issuer_name)
        )
        self.openssl_assert(res == 1)

        # Set the last update time.
        last_update = self._lib.ASN1_TIME_set(
            self._ffi.NULL, calendar.timegm(builder._last_update.timetuple())
        )
        self.openssl_assert(last_update != self._ffi.NULL)
        last_update = self._ffi.gc(last_update, self._lib.ASN1_TIME_free)
        res = self._lib.X509_CRL_set_lastUpdate(x509_crl, last_update)
        self.openssl_assert(res == 1)

        # Set the next update time.
        next_update = self._lib.ASN1_TIME_set(
            self._ffi.NULL, calendar.timegm(builder._next_update.timetuple())
        )
        self.openssl_assert(next_update != self._ffi.NULL)
        next_update = self._ffi.gc(next_update, self._lib.ASN1_TIME_free)
        res = self._lib.X509_CRL_set_nextUpdate(x509_crl, next_update)
        self.openssl_assert(res == 1)

        # Add extensions.
        self._create_x509_extensions(
            extensions=builder._extensions,
            handlers=_CRL_EXTENSION_ENCODE_HANDLERS,
            x509_obj=x509_crl,
            add_func=self._lib.X509_CRL_add_ext,
            gc=True
        )

        # add revoked certificates
        for revoked_cert in builder._revoked_certificates:
            # Duplicating because the X509_CRL takes ownership and will free
            # this memory when X509_CRL_free is called.
            revoked = self._lib.Cryptography_X509_REVOKED_dup(
                revoked_cert._x509_revoked
            )
            self.openssl_assert(revoked != self._ffi.NULL)
            res = self._lib.X509_CRL_add0_revoked(x509_crl, revoked)
            self.openssl_assert(res == 1)

        res = self._lib.X509_CRL_sign(
            x509_crl, private_key._evp_pkey, evp_md
        )
        if res == 0:
            errors = self._consume_errors()
            self.openssl_assert(errors[0][1] == self._lib.ERR_LIB_RSA)
            self.openssl_assert(
                errors[0][3] == self._lib.RSA_R_DIGEST_TOO_BIG_FOR_RSA_KEY
            )
            raise ValueError("Digest too big for RSA key")

        return _CertificateRevocationList(self, x509_crl)

    def _create_x509_extensions(self, extensions, handlers, x509_obj,
                                add_func, gc):
        for i, extension in enumerate(extensions):
            x509_extension = self._create_x509_extension(
                handlers, extension
            )
            self.openssl_assert(x509_extension != self._ffi.NULL)

            if gc:
                x509_extension = self._ffi.gc(
                    x509_extension, self._lib.X509_EXTENSION_free
                )
            res = add_func(x509_obj, x509_extension, i)
            self.openssl_assert(res >= 1)

    def _create_x509_extension(self, handlers, extension):
        if isinstance(extension.value, x509.UnrecognizedExtension):
            obj = _txt2obj_gc(self, extension.oid.dotted_string)
            value = _encode_asn1_str_gc(
                self, extension.value.value, len(extension.value.value)
            )
            return self._lib.X509_EXTENSION_create_by_OBJ(
                self._ffi.NULL,
                obj,
                1 if extension.critical else 0,
                value
            )
        else:
            try:
                encode = handlers[extension.oid]
            except KeyError:
                raise NotImplementedError(
                    'Extension not supported: {0}'.format(extension.oid)
                )

            ext_struct = encode(self, extension.value)
            nid = self._lib.OBJ_txt2nid(
                extension.oid.dotted_string.encode("ascii")
            )
            backend.openssl_assert(nid != self._lib.NID_undef)
            return self._lib.X509V3_EXT_i2d(
                nid, 1 if extension.critical else 0, ext_struct
            )

    def create_x509_revoked_certificate(self, builder):
        if not isinstance(builder, x509.RevokedCertificateBuilder):
            raise TypeError('Builder type mismatch.')

        x509_revoked = self._lib.X509_REVOKED_new()
        self.openssl_assert(x509_revoked != self._ffi.NULL)
        x509_revoked = self._ffi.gc(x509_revoked, self._lib.X509_REVOKED_free)
        serial_number = _encode_asn1_int_gc(self, builder._serial_number)
        res = self._lib.X509_REVOKED_set_serialNumber(
            x509_revoked, serial_number
        )
        self.openssl_assert(res == 1)
        rev_date = self._lib.ASN1_TIME_set(
            self._ffi.NULL,
            calendar.timegm(builder._revocation_date.timetuple())
        )
        self.openssl_assert(rev_date != self._ffi.NULL)
        rev_date = self._ffi.gc(rev_date, self._lib.ASN1_TIME_free)
        res = self._lib.X509_REVOKED_set_revocationDate(x509_revoked, rev_date)
        self.openssl_assert(res == 1)
        # add CRL entry extensions
        self._create_x509_extensions(
            extensions=builder._extensions,
            handlers=_CRL_ENTRY_EXTENSION_ENCODE_HANDLERS,
            x509_obj=x509_revoked,
            add_func=self._lib.X509_REVOKED_add_ext,
            gc=True
        )
        return _RevokedCertificate(self, None, x509_revoked)

    def load_pem_private_key(self, data, password):
        return self._load_key(
            self._lib.PEM_read_bio_PrivateKey,
            self._evp_pkey_to_private_key,
            data,
            password,
        )

    def load_pem_public_key(self, data):
        mem_bio = self._bytes_to_bio(data)
        evp_pkey = self._lib.PEM_read_bio_PUBKEY(
            mem_bio.bio, self._ffi.NULL, self._ffi.NULL, self._ffi.NULL
        )
        if evp_pkey != self._ffi.NULL:
            evp_pkey = self._ffi.gc(evp_pkey, self._lib.EVP_PKEY_free)
            return self._evp_pkey_to_public_key(evp_pkey)
        else:
            # It's not a (RSA/DSA/ECDSA) subjectPublicKeyInfo, but we still
            # need to check to see if it is a pure PKCS1 RSA public key (not
            # embedded in a subjectPublicKeyInfo)
            self._consume_errors()
            res = self._lib.BIO_reset(mem_bio.bio)
            self.openssl_assert(res == 1)
            rsa_cdata = self._lib.PEM_read_bio_RSAPublicKey(
                mem_bio.bio, self._ffi.NULL, self._ffi.NULL, self._ffi.NULL
            )
            if rsa_cdata != self._ffi.NULL:
                rsa_cdata = self._ffi.gc(rsa_cdata, self._lib.RSA_free)
                evp_pkey = self._rsa_cdata_to_evp_pkey(rsa_cdata)
                return _RSAPublicKey(self, rsa_cdata, evp_pkey)
            else:
                self._handle_key_loading_error()

    def load_der_private_key(self, data, password):
        # OpenSSL has a function called d2i_AutoPrivateKey that in theory
        # handles this automatically, however it doesn't handle encrypted
        # private keys. Instead we try to load the key two different ways.
        # First we'll try to load it as a traditional key.
        bio_data = self._bytes_to_bio(data)
        key = self._evp_pkey_from_der_traditional_key(bio_data, password)
        if key:
            return self._evp_pkey_to_private_key(key)
        else:
            # Finally we try to load it with the method that handles encrypted
            # PKCS8 properly.
            return self._load_key(
                self._lib.d2i_PKCS8PrivateKey_bio,
                self._evp_pkey_to_private_key,
                data,
                password,
            )

    def _evp_pkey_from_der_traditional_key(self, bio_data, password):
        key = self._lib.d2i_PrivateKey_bio(bio_data.bio, self._ffi.NULL)
        if key != self._ffi.NULL:
            key = self._ffi.gc(key, self._lib.EVP_PKEY_free)
            if password is not None:
                raise TypeError(
                    "Password was given but private key is not encrypted."
                )

            return key
        else:
            self._consume_errors()
            return None

    def load_der_public_key(self, data):
        mem_bio = self._bytes_to_bio(data)
        evp_pkey = self._lib.d2i_PUBKEY_bio(mem_bio.bio, self._ffi.NULL)
        if evp_pkey != self._ffi.NULL:
            evp_pkey = self._ffi.gc(evp_pkey, self._lib.EVP_PKEY_free)
            return self._evp_pkey_to_public_key(evp_pkey)
        else:
            # It's not a (RSA/DSA/ECDSA) subjectPublicKeyInfo, but we still
            # need to check to see if it is a pure PKCS1 RSA public key (not
            # embedded in a subjectPublicKeyInfo)
            self._consume_errors()
            res = self._lib.BIO_reset(mem_bio.bio)
            self.openssl_assert(res == 1)
            rsa_cdata = self._lib.d2i_RSAPublicKey_bio(
                mem_bio.bio, self._ffi.NULL
            )
            if rsa_cdata != self._ffi.NULL:
                rsa_cdata = self._ffi.gc(rsa_cdata, self._lib.RSA_free)
                evp_pkey = self._rsa_cdata_to_evp_pkey(rsa_cdata)
                return _RSAPublicKey(self, rsa_cdata, evp_pkey)
            else:
                self._handle_key_loading_error()

    def load_pem_x509_certificate(self, data):
        mem_bio = self._bytes_to_bio(data)
        x509 = self._lib.PEM_read_bio_X509(
            mem_bio.bio, self._ffi.NULL, self._ffi.NULL, self._ffi.NULL
        )
        if x509 == self._ffi.NULL:
            self._consume_errors()
            raise ValueError("Unable to load certificate")

        x509 = self._ffi.gc(x509, self._lib.X509_free)
        return _Certificate(self, x509)

    def load_der_x509_certificate(self, data):
        mem_bio = self._bytes_to_bio(data)
        x509 = self._lib.d2i_X509_bio(mem_bio.bio, self._ffi.NULL)
        if x509 == self._ffi.NULL:
            self._consume_errors()
            raise ValueError("Unable to load certificate")

        x509 = self._ffi.gc(x509, self._lib.X509_free)
        return _Certificate(self, x509)

    def load_pem_x509_crl(self, data):
        mem_bio = self._bytes_to_bio(data)
        x509_crl = self._lib.PEM_read_bio_X509_CRL(
            mem_bio.bio, self._ffi.NULL, self._ffi.NULL, self._ffi.NULL
        )
        if x509_crl == self._ffi.NULL:
            self._consume_errors()
            raise ValueError("Unable to load CRL")

        x509_crl = self._ffi.gc(x509_crl, self._lib.X509_CRL_free)
        return _CertificateRevocationList(self, x509_crl)

    def load_der_x509_crl(self, data):
        mem_bio = self._bytes_to_bio(data)
        x509_crl = self._lib.d2i_X509_CRL_bio(mem_bio.bio, self._ffi.NULL)
        if x509_crl == self._ffi.NULL:
            self._consume_errors()
            raise ValueError("Unable to load CRL")

        x509_crl = self._ffi.gc(x509_crl, self._lib.X509_CRL_free)
        return _CertificateRevocationList(self, x509_crl)

    def load_pem_x509_csr(self, data):
        mem_bio = self._bytes_to_bio(data)
        x509_req = self._lib.PEM_read_bio_X509_REQ(
            mem_bio.bio, self._ffi.NULL, self._ffi.NULL, self._ffi.NULL
        )
        if x509_req == self._ffi.NULL:
            self._consume_errors()
            raise ValueError("Unable to load request")

        x509_req = self._ffi.gc(x509_req, self._lib.X509_REQ_free)
        return _CertificateSigningRequest(self, x509_req)

    def load_der_x509_csr(self, data):
        mem_bio = self._bytes_to_bio(data)
        x509_req = self._lib.d2i_X509_REQ_bio(mem_bio.bio, self._ffi.NULL)
        if x509_req == self._ffi.NULL:
            self._consume_errors()
            raise ValueError("Unable to load request")

        x509_req = self._ffi.gc(x509_req, self._lib.X509_REQ_free)
        return _CertificateSigningRequest(self, x509_req)

    def _load_key(self, openssl_read_func, convert_func, data, password):
        mem_bio = self._bytes_to_bio(data)

        password_cb, userdata = self._pem_password_cb(password)
        userdata_handle = self._ffi.new_handle(userdata)

        evp_pkey = openssl_read_func(
            mem_bio.bio,
            self._ffi.NULL,
            password_cb,
            userdata_handle,
        )

        if evp_pkey == self._ffi.NULL:
            if userdata.exception is not None:
                errors = self._consume_errors()
                self.openssl_assert(errors)
                raise userdata.exception
            else:
                self._handle_key_loading_error()

        evp_pkey = self._ffi.gc(evp_pkey, self._lib.EVP_PKEY_free)

        if password is not None and userdata.called == 0:
            raise TypeError(
                "Password was given but private key is not encrypted.")

        assert (
            (password is not None and userdata.called == 1) or
            password is None
        )

        return convert_func(evp_pkey)

    def _handle_key_loading_error(self):
        errors = self._consume_errors()

        if not errors:
            raise ValueError("Could not unserialize key data.")

        elif errors[0][1:] in (
            (
                self._lib.ERR_LIB_EVP,
                self._lib.EVP_F_EVP_DECRYPTFINAL_EX,
                self._lib.EVP_R_BAD_DECRYPT
            ),
            (
                self._lib.ERR_LIB_PKCS12,
                self._lib.PKCS12_F_PKCS12_PBE_CRYPT,
                self._lib.PKCS12_R_PKCS12_CIPHERFINAL_ERROR,
            )
        ):
            raise ValueError("Bad decrypt. Incorrect password?")

        elif errors[0][1:] in (
            (
                self._lib.ERR_LIB_PEM,
                self._lib.PEM_F_PEM_GET_EVP_CIPHER_INFO,
                self._lib.PEM_R_UNSUPPORTED_ENCRYPTION
            ),

            (
                self._lib.ERR_LIB_EVP,
                self._lib.EVP_F_EVP_PBE_CIPHERINIT,
                self._lib.EVP_R_UNKNOWN_PBE_ALGORITHM
            )
        ):
            raise UnsupportedAlgorithm(
                "PEM data is encrypted with an unsupported cipher",
                _Reasons.UNSUPPORTED_CIPHER
            )

        elif any(
            error[1:] == (
                self._lib.ERR_LIB_EVP,
                self._lib.EVP_F_EVP_PKCS82PKEY,
                self._lib.EVP_R_UNSUPPORTED_PRIVATE_KEY_ALGORITHM
            )
            for error in errors
        ):
            raise UnsupportedAlgorithm(
                "Unsupported public key algorithm.",
                _Reasons.UNSUPPORTED_PUBLIC_KEY_ALGORITHM
            )

        else:
            assert errors[0][1] in (
                self._lib.ERR_LIB_EVP,
                self._lib.ERR_LIB_PEM,
                self._lib.ERR_LIB_ASN1,
            )
            raise ValueError("Could not unserialize key data.")

    def elliptic_curve_supported(self, curve):
        if self._lib.Cryptography_HAS_EC != 1:
            return False

        try:
            curve_nid = self._elliptic_curve_to_nid(curve)
        except UnsupportedAlgorithm:
            curve_nid = self._lib.NID_undef

        ctx = self._lib.EC_GROUP_new_by_curve_name(curve_nid)

        if ctx == self._ffi.NULL:
            errors = self._consume_errors()
            self.openssl_assert(
                curve_nid == self._lib.NID_undef or
                errors[0][1:] == (
                    self._lib.ERR_LIB_EC,
                    self._lib.EC_F_EC_GROUP_NEW_BY_CURVE_NAME,
                    self._lib.EC_R_UNKNOWN_GROUP
                )
            )
            return False
        else:
            self.openssl_assert(curve_nid != self._lib.NID_undef)
            self._lib.EC_GROUP_free(ctx)
            return True

    def elliptic_curve_signature_algorithm_supported(
        self, signature_algorithm, curve
    ):
        if self._lib.Cryptography_HAS_EC != 1:
            return False

        # We only support ECDSA right now.
        if not isinstance(signature_algorithm, ec.ECDSA):
            return False

        return self.elliptic_curve_supported(curve)

    def generate_elliptic_curve_private_key(self, curve):
        """
        Generate a new private key on the named curve.
        """

        if self.elliptic_curve_supported(curve):
            curve_nid = self._elliptic_curve_to_nid(curve)

            ec_cdata = self._lib.EC_KEY_new_by_curve_name(curve_nid)
            self.openssl_assert(ec_cdata != self._ffi.NULL)
            ec_cdata = self._ffi.gc(ec_cdata, self._lib.EC_KEY_free)

            res = self._lib.EC_KEY_generate_key(ec_cdata)
            self.openssl_assert(res == 1)

            res = self._lib.EC_KEY_check_key(ec_cdata)
            self.openssl_assert(res == 1)

            evp_pkey = self._ec_cdata_to_evp_pkey(ec_cdata)

            return _EllipticCurvePrivateKey(self, ec_cdata, evp_pkey)
        else:
            raise UnsupportedAlgorithm(
                "Backend object does not support {0}.".format(curve.name),
                _Reasons.UNSUPPORTED_ELLIPTIC_CURVE
            )

    def load_elliptic_curve_private_numbers(self, numbers):
        public = numbers.public_numbers

        curve_nid = self._elliptic_curve_to_nid(public.curve)

        ec_cdata = self._lib.EC_KEY_new_by_curve_name(curve_nid)
        self.openssl_assert(ec_cdata != self._ffi.NULL)
        ec_cdata = self._ffi.gc(ec_cdata, self._lib.EC_KEY_free)

        ec_cdata = self._ec_key_set_public_key_affine_coordinates(
            ec_cdata, public.x, public.y)

        res = self._lib.EC_KEY_set_private_key(
            ec_cdata, self._int_to_bn(numbers.private_value))
        self.openssl_assert(res == 1)
        evp_pkey = self._ec_cdata_to_evp_pkey(ec_cdata)

        return _EllipticCurvePrivateKey(self, ec_cdata, evp_pkey)

    def load_elliptic_curve_public_numbers(self, numbers):
        curve_nid = self._elliptic_curve_to_nid(numbers.curve)

        ec_cdata = self._lib.EC_KEY_new_by_curve_name(curve_nid)
        self.openssl_assert(ec_cdata != self._ffi.NULL)
        ec_cdata = self._ffi.gc(ec_cdata, self._lib.EC_KEY_free)

        ec_cdata = self._ec_key_set_public_key_affine_coordinates(
            ec_cdata, numbers.x, numbers.y)
        evp_pkey = self._ec_cdata_to_evp_pkey(ec_cdata)

        return _EllipticCurvePublicKey(self, ec_cdata, evp_pkey)

    def derive_elliptic_curve_private_key(self, private_value, curve):
        curve_nid = self._elliptic_curve_to_nid(curve)

        ec_cdata = self._lib.EC_KEY_new_by_curve_name(curve_nid)
        self.openssl_assert(ec_cdata != self._ffi.NULL)
        ec_cdata = self._ffi.gc(ec_cdata, self._lib.EC_KEY_free)

        set_func, get_func, group = (
            self._ec_key_determine_group_get_set_funcs(ec_cdata)
        )

        point = self._lib.EC_POINT_new(group)
        self.openssl_assert(point != self._ffi.NULL)
        point = self._ffi.gc(point, self._lib.EC_POINT_free)

        value = self._int_to_bn(private_value)
        value = self._ffi.gc(value, self._lib.BN_free)

        with self._tmp_bn_ctx() as bn_ctx:
            res = self._lib.EC_POINT_mul(group, point, value, self._ffi.NULL,
                                         self._ffi.NULL, bn_ctx)
            self.openssl_assert(res == 1)

            bn_x = self._lib.BN_CTX_get(bn_ctx)
            bn_y = self._lib.BN_CTX_get(bn_ctx)

            res = get_func(group, point, bn_x, bn_y, bn_ctx)
            self.openssl_assert(res == 1)

        res = self._lib.EC_KEY_set_public_key(ec_cdata, point)
        self.openssl_assert(res == 1)
        res = self._lib.EC_KEY_set_private_key(
            ec_cdata, self._int_to_bn(private_value))
        self.openssl_assert(res == 1)

        evp_pkey = self._ec_cdata_to_evp_pkey(ec_cdata)

        return _EllipticCurvePrivateKey(self, ec_cdata, evp_pkey)

    def elliptic_curve_exchange_algorithm_supported(self, algorithm, curve):
        return (
            self.elliptic_curve_supported(curve) and
            self._lib.Cryptography_HAS_ECDH == 1 and
            isinstance(algorithm, ec.ECDH)
        )

    def _ec_cdata_to_evp_pkey(self, ec_cdata):
        evp_pkey = self._create_evp_pkey_gc()
        res = self._lib.EVP_PKEY_set1_EC_KEY(evp_pkey, ec_cdata)
        self.openssl_assert(res == 1)
        return evp_pkey

    def _elliptic_curve_to_nid(self, curve):
        """
        Get the NID for a curve name.
        """

        curve_aliases = {
            "secp192r1": "prime192v1",
            "secp256r1": "prime256v1"
        }

        curve_name = curve_aliases.get(curve.name, curve.name)

        curve_nid = self._lib.OBJ_sn2nid(curve_name.encode())
        if curve_nid == self._lib.NID_undef:
            raise UnsupportedAlgorithm(
                "{0} is not a supported elliptic curve".format(curve.name),
                _Reasons.UNSUPPORTED_ELLIPTIC_CURVE
            )
        return curve_nid

    @contextmanager
    def _tmp_bn_ctx(self):
        bn_ctx = self._lib.BN_CTX_new()
        self.openssl_assert(bn_ctx != self._ffi.NULL)
        bn_ctx = self._ffi.gc(bn_ctx, self._lib.BN_CTX_free)
        self._lib.BN_CTX_start(bn_ctx)
        try:
            yield bn_ctx
        finally:
            self._lib.BN_CTX_end(bn_ctx)

    def _ec_key_determine_group_get_set_funcs(self, ctx):
        """
        Given an EC_KEY determine the group and what methods are required to
        get/set point coordinates.
        """
        self.openssl_assert(ctx != self._ffi.NULL)

        nid_two_field = self._lib.OBJ_sn2nid(b"characteristic-two-field")
        self.openssl_assert(nid_two_field != self._lib.NID_undef)

        group = self._lib.EC_KEY_get0_group(ctx)
        self.openssl_assert(group != self._ffi.NULL)

        method = self._lib.EC_GROUP_method_of(group)
        self.openssl_assert(method != self._ffi.NULL)

        nid = self._lib.EC_METHOD_get_field_type(method)
        self.openssl_assert(nid != self._lib.NID_undef)

        if nid == nid_two_field and self._lib.Cryptography_HAS_EC2M:
            set_func = self._lib.EC_POINT_set_affine_coordinates_GF2m
            get_func = self._lib.EC_POINT_get_affine_coordinates_GF2m
        else:
            set_func = self._lib.EC_POINT_set_affine_coordinates_GFp
            get_func = self._lib.EC_POINT_get_affine_coordinates_GFp

        assert set_func and get_func

        return set_func, get_func, group

    def _ec_key_set_public_key_affine_coordinates(self, ctx, x, y):
        """
        This is a port of EC_KEY_set_public_key_affine_coordinates that was
        added in 1.0.1.

        Sets the public key point in the EC_KEY context to the affine x and y
        values.
        """

        if x < 0 or y < 0:
            raise ValueError(
                "Invalid EC key. Both x and y must be non-negative."
            )

        set_func, get_func, group = (
            self._ec_key_determine_group_get_set_funcs(ctx)
        )

        point = self._lib.EC_POINT_new(group)
        self.openssl_assert(point != self._ffi.NULL)
        point = self._ffi.gc(point, self._lib.EC_POINT_free)

        bn_x = self._int_to_bn(x)
        bn_y = self._int_to_bn(y)

        with self._tmp_bn_ctx() as bn_ctx:
            check_x = self._lib.BN_CTX_get(bn_ctx)
            check_y = self._lib.BN_CTX_get(bn_ctx)

            res = set_func(group, point, bn_x, bn_y, bn_ctx)
            if res != 1:
                self._consume_errors()
                raise ValueError("EC point not on curve")

            res = get_func(group, point, check_x, check_y, bn_ctx)
            self.openssl_assert(res == 1)

            res = self._lib.BN_cmp(bn_x, check_x)
            if res != 0:
                self._consume_errors()
                raise ValueError("Invalid EC Key X point.")
            res = self._lib.BN_cmp(bn_y, check_y)
            if res != 0:
                self._consume_errors()
                raise ValueError("Invalid EC Key Y point.")

        res = self._lib.EC_KEY_set_public_key(ctx, point)
        self.openssl_assert(res == 1)

        res = self._lib.EC_KEY_check_key(ctx)
        if res != 1:
            self._consume_errors()
            raise ValueError("Invalid EC key.")

        return ctx

    def _private_key_bytes(self, encoding, format, encryption_algorithm,
                           evp_pkey, cdata):
        if not isinstance(format, serialization.PrivateFormat):
            raise TypeError(
                "format must be an item from the PrivateFormat enum"
            )

        if not isinstance(encryption_algorithm,
                          serialization.KeySerializationEncryption):
            raise TypeError(
                "Encryption algorithm must be a KeySerializationEncryption "
                "instance"
            )

        if isinstance(encryption_algorithm, serialization.NoEncryption):
            password = b""
            passlen = 0
            evp_cipher = self._ffi.NULL
        elif isinstance(encryption_algorithm,
                        serialization.BestAvailableEncryption):
            # This is a curated value that we will update over time.
            evp_cipher = self._lib.EVP_get_cipherbyname(
                b"aes-256-cbc"
            )
            password = encryption_algorithm.password
            passlen = len(password)
            if passlen > 1023:
                raise ValueError(
                    "Passwords longer than 1023 bytes are not supported by "
                    "this backend"
                )
        else:
            raise ValueError("Unsupported encryption type")

        key_type = self._lib.EVP_PKEY_id(evp_pkey)
        if encoding is serialization.Encoding.PEM:
            if format is serialization.PrivateFormat.PKCS8:
                write_bio = self._lib.PEM_write_bio_PKCS8PrivateKey
                key = evp_pkey
            else:
                assert format is serialization.PrivateFormat.TraditionalOpenSSL
                if key_type == self._lib.EVP_PKEY_RSA:
                    write_bio = self._lib.PEM_write_bio_RSAPrivateKey
                elif key_type == self._lib.EVP_PKEY_DSA:
                    write_bio = self._lib.PEM_write_bio_DSAPrivateKey
                else:
                    assert self._lib.Cryptography_HAS_EC == 1
                    assert key_type == self._lib.EVP_PKEY_EC
                    write_bio = self._lib.PEM_write_bio_ECPrivateKey

                key = cdata
        elif encoding is serialization.Encoding.DER:
            if format is serialization.PrivateFormat.TraditionalOpenSSL:
                if not isinstance(
                    encryption_algorithm, serialization.NoEncryption
                ):
                    raise ValueError(
                        "Encryption is not supported for DER encoded "
                        "traditional OpenSSL keys"
                    )

                return self._private_key_bytes_traditional_der(key_type, cdata)
            else:
                assert format is serialization.PrivateFormat.PKCS8
                write_bio = self._lib.i2d_PKCS8PrivateKey_bio
                key = evp_pkey
        else:
            raise TypeError("encoding must be an item from the Encoding enum")

        bio = self._create_mem_bio_gc()
        res = write_bio(
            bio,
            key,
            evp_cipher,
            password,
            passlen,
            self._ffi.NULL,
            self._ffi.NULL
        )
        self.openssl_assert(res == 1)
        return self._read_mem_bio(bio)

    def _private_key_bytes_traditional_der(self, key_type, cdata):
        if key_type == self._lib.EVP_PKEY_RSA:
            write_bio = self._lib.i2d_RSAPrivateKey_bio
        elif (self._lib.Cryptography_HAS_EC == 1 and
              key_type == self._lib.EVP_PKEY_EC):
            write_bio = self._lib.i2d_ECPrivateKey_bio
        else:
            self.openssl_assert(key_type == self._lib.EVP_PKEY_DSA)
            write_bio = self._lib.i2d_DSAPrivateKey_bio

        bio = self._create_mem_bio_gc()
        res = write_bio(bio, cdata)
        self.openssl_assert(res == 1)
        return self._read_mem_bio(bio)

    def _public_key_bytes(self, encoding, format, key, evp_pkey, cdata):
        if not isinstance(encoding, serialization.Encoding):
            raise TypeError("encoding must be an item from the Encoding enum")

        if (
            format is serialization.PublicFormat.OpenSSH or
            encoding is serialization.Encoding.OpenSSH
        ):
            if (
                format is not serialization.PublicFormat.OpenSSH or
                encoding is not serialization.Encoding.OpenSSH
            ):
                raise ValueError(
                    "OpenSSH format must be used with OpenSSH encoding"
                )
            return self._openssh_public_key_bytes(key)
        elif format is serialization.PublicFormat.SubjectPublicKeyInfo:
            if encoding is serialization.Encoding.PEM:
                write_bio = self._lib.PEM_write_bio_PUBKEY
            else:
                assert encoding is serialization.Encoding.DER
                write_bio = self._lib.i2d_PUBKEY_bio

            key = evp_pkey
        elif format is serialization.PublicFormat.PKCS1:
            # Only RSA is supported here.
            assert self._lib.EVP_PKEY_id(evp_pkey) == self._lib.EVP_PKEY_RSA
            if encoding is serialization.Encoding.PEM:
                write_bio = self._lib.PEM_write_bio_RSAPublicKey
            else:
                assert encoding is serialization.Encoding.DER
                write_bio = self._lib.i2d_RSAPublicKey_bio

            key = cdata
        else:
            raise TypeError(
                "format must be an item from the PublicFormat enum"
            )

        bio = self._create_mem_bio_gc()
        res = write_bio(bio, key)
        self.openssl_assert(res == 1)
        return self._read_mem_bio(bio)

    def _openssh_public_key_bytes(self, key):
        if isinstance(key, rsa.RSAPublicKey):
            public_numbers = key.public_numbers()
            return b"ssh-rsa " + base64.b64encode(
                serialization._ssh_write_string(b"ssh-rsa") +
                serialization._ssh_write_mpint(public_numbers.e) +
                serialization._ssh_write_mpint(public_numbers.n)
            )
        elif isinstance(key, dsa.DSAPublicKey):
            public_numbers = key.public_numbers()
            parameter_numbers = public_numbers.parameter_numbers
            return b"ssh-dss " + base64.b64encode(
                serialization._ssh_write_string(b"ssh-dss") +
                serialization._ssh_write_mpint(parameter_numbers.p) +
                serialization._ssh_write_mpint(parameter_numbers.q) +
                serialization._ssh_write_mpint(parameter_numbers.g) +
                serialization._ssh_write_mpint(public_numbers.y)
            )
        else:
            assert isinstance(key, ec.EllipticCurvePublicKey)
            public_numbers = key.public_numbers()
            try:
                curve_name = {
                    ec.SECP256R1: b"nistp256",
                    ec.SECP384R1: b"nistp384",
                    ec.SECP521R1: b"nistp521",
                }[type(public_numbers.curve)]
            except KeyError:
                raise ValueError(
                    "Only SECP256R1, SECP384R1, and SECP521R1 curves are "
                    "supported by the SSH public key format"
                )
            return b"ecdsa-sha2-" + curve_name + b" " + base64.b64encode(
                serialization._ssh_write_string(b"ecdsa-sha2-" + curve_name) +
                serialization._ssh_write_string(curve_name) +
                serialization._ssh_write_string(public_numbers.encode_point())
            )

    def generate_dh_parameters(self, generator, key_size):
        if key_size < 512:
            raise ValueError("DH key_size must be at least 512 bits")

        if generator not in (2, 5):
            raise ValueError("DH generator must be 2 or 5")

        dh_param_cdata = self._lib.DH_new()
        self.openssl_assert(dh_param_cdata != self._ffi.NULL)
        dh_param_cdata = self._ffi.gc(dh_param_cdata, self._lib.DH_free)

        res = self._lib.DH_generate_parameters_ex(
            dh_param_cdata,
            key_size,
            generator,
            self._ffi.NULL
        )
        self.openssl_assert(res == 1)

        return _DHParameters(self, dh_param_cdata)

    def generate_dh_private_key(self, parameters):
        dh_key_cdata = self._lib.DHparams_dup(parameters._dh_cdata)
        self.openssl_assert(dh_key_cdata != self._ffi.NULL)
        dh_key_cdata = self._ffi.gc(dh_key_cdata, self._lib.DH_free)

        res = self._lib.DH_generate_key(dh_key_cdata)
        self.openssl_assert(res == 1)

        return _DHPrivateKey(self, dh_key_cdata)

    def generate_dh_private_key_and_parameters(self, generator, key_size):
        return self.generate_dh_private_key(
            self.generate_dh_parameters(generator, key_size))

    def load_dh_private_numbers(self, numbers):
        parameter_numbers = numbers.public_numbers.parameter_numbers

        dh_cdata = self._lib.DH_new()
        self.openssl_assert(dh_cdata != self._ffi.NULL)
        dh_cdata = self._ffi.gc(dh_cdata, self._lib.DH_free)

        p = self._int_to_bn(parameter_numbers.p)
        g = self._int_to_bn(parameter_numbers.g)
        pub_key = self._int_to_bn(numbers.public_numbers.y)
        priv_key = self._int_to_bn(numbers.x)

        res = self._lib.DH_set0_pqg(dh_cdata, p, self._ffi.NULL, g)
        self.openssl_assert(res == 1)

        res = self._lib.DH_set0_key(dh_cdata, pub_key, priv_key)
        self.openssl_assert(res == 1)

        codes = self._ffi.new("int[]", 1)
        res = self._lib.DH_check(dh_cdata, codes)
        self.openssl_assert(res == 1)

        if codes[0] != 0:
            raise ValueError("DH private numbers did not pass safety checks.")

        return _DHPrivateKey(self, dh_cdata)

    def load_dh_public_numbers(self, numbers):
        dh_cdata = self._lib.DH_new()
        self.openssl_assert(dh_cdata != self._ffi.NULL)
        dh_cdata = self._ffi.gc(dh_cdata, self._lib.DH_free)

        parameter_numbers = numbers.parameter_numbers

        p = self._int_to_bn(parameter_numbers.p)
        g = self._int_to_bn(parameter_numbers.g)
        pub_key = self._int_to_bn(numbers.y)

        res = self._lib.DH_set0_pqg(dh_cdata, p, self._ffi.NULL, g)
        self.openssl_assert(res == 1)

        res = self._lib.DH_set0_key(dh_cdata, pub_key, self._ffi.NULL)
        self.openssl_assert(res == 1)

        return _DHPublicKey(self, dh_cdata)

    def load_dh_parameter_numbers(self, numbers):
        dh_cdata = self._lib.DH_new()
        self.openssl_assert(dh_cdata != self._ffi.NULL)
        dh_cdata = self._ffi.gc(dh_cdata, self._lib.DH_free)

        p = self._int_to_bn(numbers.p)
        g = self._int_to_bn(numbers.g)

        res = self._lib.DH_set0_pqg(dh_cdata, p, self._ffi.NULL, g)
        self.openssl_assert(res == 1)

        return _DHParameters(self, dh_cdata)

    def dh_parameters_supported(self, p, g):
        dh_cdata = self._lib.DH_new()
        self.openssl_assert(dh_cdata != self._ffi.NULL)
        dh_cdata = self._ffi.gc(dh_cdata, self._lib.DH_free)

        p = self._int_to_bn(p)
        g = self._int_to_bn(g)

        res = self._lib.DH_set0_pqg(dh_cdata, p, self._ffi.NULL, g)
        self.openssl_assert(res == 1)

        codes = self._ffi.new("int[]", 1)
        res = self._lib.DH_check(dh_cdata, codes)
        self.openssl_assert(res == 1)

        return codes[0] == 0

    def x509_name_bytes(self, name):
        x509_name = _encode_name_gc(self, name)
        pp = self._ffi.new("unsigned char **")
        res = self._lib.i2d_X509_NAME(x509_name, pp)
        self.openssl_assert(pp[0] != self._ffi.NULL)
        pp = self._ffi.gc(
            pp, lambda pointer: self._lib.OPENSSL_free(pointer[0])
        )
        self.openssl_assert(res > 0)
        return self._ffi.buffer(pp[0], res)[:]

    def derive_scrypt(self, key_material, salt, length, n, r, p):
        buf = self._ffi.new("unsigned char[]", length)
        res = self._lib.EVP_PBE_scrypt(key_material, len(key_material), salt,
                                       len(salt), n, r, p, sys.maxsize // 2,
                                       buf, length)
        self.openssl_assert(res == 1)
        return self._ffi.buffer(buf)[:]


class GetCipherByName(object):
    def __init__(self, fmt):
        self._fmt = fmt

    def __call__(self, backend, cipher, mode):
        cipher_name = self._fmt.format(cipher=cipher, mode=mode).lower()
        return backend._lib.EVP_get_cipherbyname(cipher_name.encode("ascii"))


backend = Backend()
