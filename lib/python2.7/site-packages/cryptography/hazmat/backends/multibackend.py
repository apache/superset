# This file is dual licensed under the terms of the Apache License, Version
# 2.0, and the BSD License. See the LICENSE file in the root of this repository
# for complete details.

from __future__ import absolute_import, division, print_function

from cryptography import utils
from cryptography.exceptions import UnsupportedAlgorithm, _Reasons
from cryptography.hazmat.backends.interfaces import (
    CMACBackend, CipherBackend, DERSerializationBackend, DHBackend,
    DSABackend, EllipticCurveBackend, HMACBackend, HashBackend,
    PBKDF2HMACBackend, PEMSerializationBackend, RSABackend, ScryptBackend,
    X509Backend
)


@utils.register_interface(CMACBackend)
@utils.register_interface(CipherBackend)
@utils.register_interface(DERSerializationBackend)
@utils.register_interface(HashBackend)
@utils.register_interface(HMACBackend)
@utils.register_interface(PBKDF2HMACBackend)
@utils.register_interface(RSABackend)
@utils.register_interface(DSABackend)
@utils.register_interface(EllipticCurveBackend)
@utils.register_interface(PEMSerializationBackend)
@utils.register_interface(X509Backend)
@utils.register_interface(DHBackend)
@utils.register_interface(ScryptBackend)
class MultiBackend(object):
    name = "multibackend"

    def __init__(self, backends):
        if len(backends) == 0:
            raise ValueError(
                "Multibackend cannot be initialized with no backends. If you "
                "are seeing this error when trying to use default_backend() "
                "please try uninstalling and reinstalling cryptography."
            )

        self._backends = backends

    def _filtered_backends(self, interface):
        for b in self._backends:
            if isinstance(b, interface):
                yield b

    def cipher_supported(self, cipher, mode):
        return any(
            b.cipher_supported(cipher, mode)
            for b in self._filtered_backends(CipherBackend)
        )

    def create_symmetric_encryption_ctx(self, cipher, mode):
        for b in self._filtered_backends(CipherBackend):
            try:
                return b.create_symmetric_encryption_ctx(cipher, mode)
            except UnsupportedAlgorithm:
                pass
        raise UnsupportedAlgorithm(
            "cipher {0} in {1} mode is not supported by this backend.".format(
                cipher.name, mode.name if mode else mode),
            _Reasons.UNSUPPORTED_CIPHER
        )

    def create_symmetric_decryption_ctx(self, cipher, mode):
        for b in self._filtered_backends(CipherBackend):
            try:
                return b.create_symmetric_decryption_ctx(cipher, mode)
            except UnsupportedAlgorithm:
                pass
        raise UnsupportedAlgorithm(
            "cipher {0} in {1} mode is not supported by this backend.".format(
                cipher.name, mode.name if mode else mode),
            _Reasons.UNSUPPORTED_CIPHER
        )

    def hash_supported(self, algorithm):
        return any(
            b.hash_supported(algorithm)
            for b in self._filtered_backends(HashBackend)
        )

    def create_hash_ctx(self, algorithm):
        for b in self._filtered_backends(HashBackend):
            try:
                return b.create_hash_ctx(algorithm)
            except UnsupportedAlgorithm:
                pass
        raise UnsupportedAlgorithm(
            "{0} is not a supported hash on this backend.".format(
                algorithm.name),
            _Reasons.UNSUPPORTED_HASH
        )

    def hmac_supported(self, algorithm):
        return any(
            b.hmac_supported(algorithm)
            for b in self._filtered_backends(HMACBackend)
        )

    def create_hmac_ctx(self, key, algorithm):
        for b in self._filtered_backends(HMACBackend):
            try:
                return b.create_hmac_ctx(key, algorithm)
            except UnsupportedAlgorithm:
                pass
        raise UnsupportedAlgorithm(
            "{0} is not a supported hash on this backend.".format(
                algorithm.name),
            _Reasons.UNSUPPORTED_HASH
        )

    def pbkdf2_hmac_supported(self, algorithm):
        return any(
            b.pbkdf2_hmac_supported(algorithm)
            for b in self._filtered_backends(PBKDF2HMACBackend)
        )

    def derive_pbkdf2_hmac(self, algorithm, length, salt, iterations,
                           key_material):
        for b in self._filtered_backends(PBKDF2HMACBackend):
            try:
                return b.derive_pbkdf2_hmac(
                    algorithm, length, salt, iterations, key_material
                )
            except UnsupportedAlgorithm:
                pass
        raise UnsupportedAlgorithm(
            "{0} is not a supported hash on this backend.".format(
                algorithm.name),
            _Reasons.UNSUPPORTED_HASH
        )

    def generate_rsa_private_key(self, public_exponent, key_size):
        for b in self._filtered_backends(RSABackend):
            return b.generate_rsa_private_key(public_exponent, key_size)
        raise UnsupportedAlgorithm("RSA is not supported by the backend.",
                                   _Reasons.UNSUPPORTED_PUBLIC_KEY_ALGORITHM)

    def generate_rsa_parameters_supported(self, public_exponent, key_size):
        for b in self._filtered_backends(RSABackend):
            return b.generate_rsa_parameters_supported(
                public_exponent, key_size
            )
        raise UnsupportedAlgorithm("RSA is not supported by the backend.",
                                   _Reasons.UNSUPPORTED_PUBLIC_KEY_ALGORITHM)

    def rsa_padding_supported(self, padding):
        for b in self._filtered_backends(RSABackend):
            return b.rsa_padding_supported(padding)
        raise UnsupportedAlgorithm("RSA is not supported by the backend.",
                                   _Reasons.UNSUPPORTED_PUBLIC_KEY_ALGORITHM)

    def load_rsa_private_numbers(self, numbers):
        for b in self._filtered_backends(RSABackend):
            return b.load_rsa_private_numbers(numbers)

        raise UnsupportedAlgorithm("RSA is not supported by the backend",
                                   _Reasons.UNSUPPORTED_PUBLIC_KEY_ALGORITHM)

    def load_rsa_public_numbers(self, numbers):
        for b in self._filtered_backends(RSABackend):
            return b.load_rsa_public_numbers(numbers)

        raise UnsupportedAlgorithm("RSA is not supported by the backend",
                                   _Reasons.UNSUPPORTED_PUBLIC_KEY_ALGORITHM)

    def generate_dsa_parameters(self, key_size):
        for b in self._filtered_backends(DSABackend):
            return b.generate_dsa_parameters(key_size)
        raise UnsupportedAlgorithm("DSA is not supported by the backend.",
                                   _Reasons.UNSUPPORTED_PUBLIC_KEY_ALGORITHM)

    def generate_dsa_private_key(self, parameters):
        for b in self._filtered_backends(DSABackend):
            return b.generate_dsa_private_key(parameters)
        raise UnsupportedAlgorithm("DSA is not supported by the backend.",
                                   _Reasons.UNSUPPORTED_PUBLIC_KEY_ALGORITHM)

    def generate_dsa_private_key_and_parameters(self, key_size):
        for b in self._filtered_backends(DSABackend):
            return b.generate_dsa_private_key_and_parameters(key_size)
        raise UnsupportedAlgorithm("DSA is not supported by the backend.",
                                   _Reasons.UNSUPPORTED_PUBLIC_KEY_ALGORITHM)

    def dsa_hash_supported(self, algorithm):
        for b in self._filtered_backends(DSABackend):
            return b.dsa_hash_supported(algorithm)
        raise UnsupportedAlgorithm("DSA is not supported by the backend.",
                                   _Reasons.UNSUPPORTED_PUBLIC_KEY_ALGORITHM)

    def dsa_parameters_supported(self, p, q, g):
        for b in self._filtered_backends(DSABackend):
            return b.dsa_parameters_supported(p, q, g)
        raise UnsupportedAlgorithm("DSA is not supported by the backend.",
                                   _Reasons.UNSUPPORTED_PUBLIC_KEY_ALGORITHM)

    def load_dsa_public_numbers(self, numbers):
        for b in self._filtered_backends(DSABackend):
            return b.load_dsa_public_numbers(numbers)
        raise UnsupportedAlgorithm("DSA is not supported by the backend.",
                                   _Reasons.UNSUPPORTED_PUBLIC_KEY_ALGORITHM)

    def load_dsa_private_numbers(self, numbers):
        for b in self._filtered_backends(DSABackend):
            return b.load_dsa_private_numbers(numbers)
        raise UnsupportedAlgorithm("DSA is not supported by the backend.",
                                   _Reasons.UNSUPPORTED_PUBLIC_KEY_ALGORITHM)

    def load_dsa_parameter_numbers(self, numbers):
        for b in self._filtered_backends(DSABackend):
            return b.load_dsa_parameter_numbers(numbers)
        raise UnsupportedAlgorithm("DSA is not supported by the backend.",
                                   _Reasons.UNSUPPORTED_PUBLIC_KEY_ALGORITHM)

    def cmac_algorithm_supported(self, algorithm):
        return any(
            b.cmac_algorithm_supported(algorithm)
            for b in self._filtered_backends(CMACBackend)
        )

    def create_cmac_ctx(self, algorithm):
        for b in self._filtered_backends(CMACBackend):
            try:
                return b.create_cmac_ctx(algorithm)
            except UnsupportedAlgorithm:
                pass
        raise UnsupportedAlgorithm("This backend does not support CMAC.",
                                   _Reasons.UNSUPPORTED_CIPHER)

    def elliptic_curve_supported(self, curve):
        return any(
            b.elliptic_curve_supported(curve)
            for b in self._filtered_backends(EllipticCurveBackend)
        )

    def elliptic_curve_signature_algorithm_supported(
        self, signature_algorithm, curve
    ):
        return any(
            b.elliptic_curve_signature_algorithm_supported(
                signature_algorithm, curve
            )
            for b in self._filtered_backends(EllipticCurveBackend)
        )

    def generate_elliptic_curve_private_key(self, curve):
        for b in self._filtered_backends(EllipticCurveBackend):
            try:
                return b.generate_elliptic_curve_private_key(curve)
            except UnsupportedAlgorithm:
                continue

        raise UnsupportedAlgorithm(
            "This backend does not support this elliptic curve.",
            _Reasons.UNSUPPORTED_ELLIPTIC_CURVE
        )

    def load_elliptic_curve_private_numbers(self, numbers):
        for b in self._filtered_backends(EllipticCurveBackend):
            try:
                return b.load_elliptic_curve_private_numbers(numbers)
            except UnsupportedAlgorithm:
                continue

        raise UnsupportedAlgorithm(
            "This backend does not support this elliptic curve.",
            _Reasons.UNSUPPORTED_ELLIPTIC_CURVE
        )

    def load_elliptic_curve_public_numbers(self, numbers):
        for b in self._filtered_backends(EllipticCurveBackend):
            try:
                return b.load_elliptic_curve_public_numbers(numbers)
            except UnsupportedAlgorithm:
                continue

        raise UnsupportedAlgorithm(
            "This backend does not support this elliptic curve.",
            _Reasons.UNSUPPORTED_ELLIPTIC_CURVE
        )

    def derive_elliptic_curve_private_key(self, private_value, curve):
        for b in self._filtered_backends(EllipticCurveBackend):
            try:
                return b.derive_elliptic_curve_private_key(private_value,
                                                           curve)
            except UnsupportedAlgorithm:
                continue

        raise UnsupportedAlgorithm(
            "This backend does not support this elliptic curve.",
            _Reasons.UNSUPPORTED_ELLIPTIC_CURVE
        )

    def elliptic_curve_exchange_algorithm_supported(self, algorithm, curve):
        return any(
            b.elliptic_curve_exchange_algorithm_supported(algorithm, curve)
            for b in self._filtered_backends(EllipticCurveBackend)
        )

    def load_pem_private_key(self, data, password):
        for b in self._filtered_backends(PEMSerializationBackend):
            return b.load_pem_private_key(data, password)

        raise UnsupportedAlgorithm(
            "This backend does not support this key serialization.",
            _Reasons.UNSUPPORTED_SERIALIZATION
        )

    def load_pem_public_key(self, data):
        for b in self._filtered_backends(PEMSerializationBackend):
            return b.load_pem_public_key(data)

        raise UnsupportedAlgorithm(
            "This backend does not support this key serialization.",
            _Reasons.UNSUPPORTED_SERIALIZATION
        )

    def load_der_private_key(self, data, password):
        for b in self._filtered_backends(DERSerializationBackend):
            return b.load_der_private_key(data, password)

        raise UnsupportedAlgorithm(
            "This backend does not support this key serialization.",
            _Reasons.UNSUPPORTED_SERIALIZATION
        )

    def load_der_public_key(self, data):
        for b in self._filtered_backends(DERSerializationBackend):
            return b.load_der_public_key(data)

        raise UnsupportedAlgorithm(
            "This backend does not support this key serialization.",
            _Reasons.UNSUPPORTED_SERIALIZATION
        )

    def load_pem_x509_certificate(self, data):
        for b in self._filtered_backends(X509Backend):
            return b.load_pem_x509_certificate(data)

        raise UnsupportedAlgorithm(
            "This backend does not support X.509.",
            _Reasons.UNSUPPORTED_X509
        )

    def load_der_x509_certificate(self, data):
        for b in self._filtered_backends(X509Backend):
            return b.load_der_x509_certificate(data)

        raise UnsupportedAlgorithm(
            "This backend does not support X.509.",
            _Reasons.UNSUPPORTED_X509
        )

    def load_pem_x509_crl(self, data):
        for b in self._filtered_backends(X509Backend):
            return b.load_pem_x509_crl(data)

        raise UnsupportedAlgorithm(
            "This backend does not support X.509.",
            _Reasons.UNSUPPORTED_X509
        )

    def load_der_x509_crl(self, data):
        for b in self._filtered_backends(X509Backend):
            return b.load_der_x509_crl(data)

        raise UnsupportedAlgorithm(
            "This backend does not support X.509.",
            _Reasons.UNSUPPORTED_X509
        )

    def load_der_x509_csr(self, data):
        for b in self._filtered_backends(X509Backend):
            return b.load_der_x509_csr(data)

        raise UnsupportedAlgorithm(
            "This backend does not support X.509.",
            _Reasons.UNSUPPORTED_X509
        )

    def load_pem_x509_csr(self, data):
        for b in self._filtered_backends(X509Backend):
            return b.load_pem_x509_csr(data)

        raise UnsupportedAlgorithm(
            "This backend does not support X.509.",
            _Reasons.UNSUPPORTED_X509
        )

    def create_x509_csr(self, builder, private_key, algorithm):
        for b in self._filtered_backends(X509Backend):
            return b.create_x509_csr(builder, private_key, algorithm)

        raise UnsupportedAlgorithm(
            "This backend does not support X.509.",
            _Reasons.UNSUPPORTED_X509
        )

    def create_x509_certificate(self, builder, private_key, algorithm):
        for b in self._filtered_backends(X509Backend):
            return b.create_x509_certificate(builder, private_key, algorithm)

        raise UnsupportedAlgorithm(
            "This backend does not support X.509.",
            _Reasons.UNSUPPORTED_X509
        )

    def create_x509_crl(self, builder, private_key, algorithm):
        for b in self._filtered_backends(X509Backend):
            return b.create_x509_crl(builder, private_key, algorithm)

        raise UnsupportedAlgorithm(
            "This backend does not support X.509.",
            _Reasons.UNSUPPORTED_X509
        )

    def create_x509_revoked_certificate(self, builder):
        for b in self._filtered_backends(X509Backend):
            return b.create_x509_revoked_certificate(builder)

        raise UnsupportedAlgorithm(
            "This backend does not support X.509.",
            _Reasons.UNSUPPORTED_X509
        )

    def generate_dh_parameters(self, generator, key_size):
        for b in self._filtered_backends(DHBackend):
            return b.generate_dh_parameters(generator, key_size)

        raise UnsupportedAlgorithm(
            "This backend does not support Diffie-Hellman",
            _Reasons.UNSUPPORTED_DIFFIE_HELLMAN
        )

    def load_dh_parameter_numbers(self, numbers):
        for b in self._filtered_backends(DHBackend):
            return b.load_dh_parameter_numbers(numbers)

        raise UnsupportedAlgorithm(
            "This backend does not support Diffie-Hellman",
            _Reasons.UNSUPPORTED_DIFFIE_HELLMAN
        )

    def generate_dh_private_key(self, parameters):
        for b in self._filtered_backends(DHBackend):
            return b.generate_dh_private_key(parameters)

        raise UnsupportedAlgorithm(
            "This backend does not support Diffie-Hellman",
            _Reasons.UNSUPPORTED_DIFFIE_HELLMAN
        )

    def load_dh_private_numbers(self, numbers):
        for b in self._filtered_backends(DHBackend):
            return b.load_dh_private_numbers(numbers)

        raise UnsupportedAlgorithm(
            "This backend does not support Diffie-Hellman",
            _Reasons.UNSUPPORTED_DIFFIE_HELLMAN
        )

    def load_dh_public_numbers(self, numbers):
        for b in self._filtered_backends(DHBackend):
            return b.load_dh_public_numbers(numbers)

        raise UnsupportedAlgorithm(
            "This backend does not support Diffie-Hellman",
            _Reasons.UNSUPPORTED_DIFFIE_HELLMAN
        )

    def generate_dh_private_key_and_parameters(self, generator, key_size):
        for b in self._filtered_backends(DHBackend):
            return b.generate_dh_private_key_and_parameters(generator,
                                                            key_size)

        raise UnsupportedAlgorithm(
            "This backend does not support Diffie-Hellman",
            _Reasons.UNSUPPORTED_DIFFIE_HELLMAN
        )

    def dh_parameters_supported(self, p, g):
        for b in self._filtered_backends(DHBackend):
            return b.dh_parameters_supported(p, g)

        raise UnsupportedAlgorithm(
            "This backend does not support Diffie-Hellman",
            _Reasons.UNSUPPORTED_DIFFIE_HELLMAN
        )

    def x509_name_bytes(self, name):
        for b in self._filtered_backends(X509Backend):
            return b.x509_name_bytes(name)

        raise UnsupportedAlgorithm(
            "This backend does not support X.509.",
            _Reasons.UNSUPPORTED_X509
        )

    def derive_scrypt(self, key_material, salt, length, n, r, p):
        for b in self._filtered_backends(ScryptBackend):
            return b.derive_scrypt(key_material, salt, length, n, r, p)
        raise UnsupportedAlgorithm("This backend does not support scrypt.")
