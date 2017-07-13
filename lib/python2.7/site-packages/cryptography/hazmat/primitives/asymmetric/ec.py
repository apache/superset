# This file is dual licensed under the terms of the Apache License, Version
# 2.0, and the BSD License. See the LICENSE file in the root of this repository
# for complete details.

from __future__ import absolute_import, division, print_function

import abc

import six

from cryptography import utils


@six.add_metaclass(abc.ABCMeta)
class EllipticCurve(object):
    @abc.abstractproperty
    def name(self):
        """
        The name of the curve. e.g. secp256r1.
        """

    @abc.abstractproperty
    def key_size(self):
        """
        The bit length of the base point of the curve.
        """


@six.add_metaclass(abc.ABCMeta)
class EllipticCurveSignatureAlgorithm(object):
    @abc.abstractproperty
    def algorithm(self):
        """
        The digest algorithm used with this signature.
        """


@six.add_metaclass(abc.ABCMeta)
class EllipticCurvePrivateKey(object):
    @abc.abstractmethod
    def signer(self, signature_algorithm):
        """
        Returns an AsymmetricSignatureContext used for signing data.
        """

    @abc.abstractmethod
    def exchange(self, algorithm, peer_public_key):
        """
        Performs a key exchange operation using the provided algorithm with the
        provided peer's public key.
        """

    @abc.abstractmethod
    def public_key(self):
        """
        The EllipticCurvePublicKey for this private key.
        """

    @abc.abstractproperty
    def curve(self):
        """
        The EllipticCurve that this key is on.
        """

    @abc.abstractproperty
    def sign(self, data, signature_algorithm):
        """
        Signs the data
        """


@six.add_metaclass(abc.ABCMeta)
class EllipticCurvePrivateKeyWithSerialization(EllipticCurvePrivateKey):
    @abc.abstractmethod
    def private_numbers(self):
        """
        Returns an EllipticCurvePrivateNumbers.
        """

    @abc.abstractmethod
    def private_bytes(self, encoding, format, encryption_algorithm):
        """
        Returns the key serialized as bytes.
        """


@six.add_metaclass(abc.ABCMeta)
class EllipticCurvePublicKey(object):
    @abc.abstractmethod
    def verifier(self, signature, signature_algorithm):
        """
        Returns an AsymmetricVerificationContext used for signing data.
        """

    @abc.abstractproperty
    def curve(self):
        """
        The EllipticCurve that this key is on.
        """

    @abc.abstractmethod
    def public_numbers(self):
        """
        Returns an EllipticCurvePublicNumbers.
        """

    @abc.abstractmethod
    def public_bytes(self, encoding, format):
        """
        Returns the key serialized as bytes.
        """

    @abc.abstractmethod
    def verify(self, signature, data, signature_algorithm):
        """
        Verifies the signature of the data.
        """


EllipticCurvePublicKeyWithSerialization = EllipticCurvePublicKey


@utils.register_interface(EllipticCurve)
class SECT571R1(object):
    name = "sect571r1"
    key_size = 571


@utils.register_interface(EllipticCurve)
class SECT409R1(object):
    name = "sect409r1"
    key_size = 409


@utils.register_interface(EllipticCurve)
class SECT283R1(object):
    name = "sect283r1"
    key_size = 283


@utils.register_interface(EllipticCurve)
class SECT233R1(object):
    name = "sect233r1"
    key_size = 233


@utils.register_interface(EllipticCurve)
class SECT163R2(object):
    name = "sect163r2"
    key_size = 163


@utils.register_interface(EllipticCurve)
class SECT571K1(object):
    name = "sect571k1"
    key_size = 571


@utils.register_interface(EllipticCurve)
class SECT409K1(object):
    name = "sect409k1"
    key_size = 409


@utils.register_interface(EllipticCurve)
class SECT283K1(object):
    name = "sect283k1"
    key_size = 283


@utils.register_interface(EllipticCurve)
class SECT233K1(object):
    name = "sect233k1"
    key_size = 233


@utils.register_interface(EllipticCurve)
class SECT163K1(object):
    name = "sect163k1"
    key_size = 163


@utils.register_interface(EllipticCurve)
class SECP521R1(object):
    name = "secp521r1"
    key_size = 521


@utils.register_interface(EllipticCurve)
class SECP384R1(object):
    name = "secp384r1"
    key_size = 384


@utils.register_interface(EllipticCurve)
class SECP256R1(object):
    name = "secp256r1"
    key_size = 256


@utils.register_interface(EllipticCurve)
class SECP256K1(object):
    name = "secp256k1"
    key_size = 256


@utils.register_interface(EllipticCurve)
class SECP224R1(object):
    name = "secp224r1"
    key_size = 224


@utils.register_interface(EllipticCurve)
class SECP192R1(object):
    name = "secp192r1"
    key_size = 192


_CURVE_TYPES = {
    "prime192v1": SECP192R1,
    "prime256v1": SECP256R1,

    "secp192r1": SECP192R1,
    "secp224r1": SECP224R1,
    "secp256r1": SECP256R1,
    "secp384r1": SECP384R1,
    "secp521r1": SECP521R1,
    "secp256k1": SECP256K1,

    "sect163k1": SECT163K1,
    "sect233k1": SECT233K1,
    "sect283k1": SECT283K1,
    "sect409k1": SECT409K1,
    "sect571k1": SECT571K1,

    "sect163r2": SECT163R2,
    "sect233r1": SECT233R1,
    "sect283r1": SECT283R1,
    "sect409r1": SECT409R1,
    "sect571r1": SECT571R1,
}


@utils.register_interface(EllipticCurveSignatureAlgorithm)
class ECDSA(object):
    def __init__(self, algorithm):
        self._algorithm = algorithm

    algorithm = utils.read_only_property("_algorithm")


def generate_private_key(curve, backend):
    return backend.generate_elliptic_curve_private_key(curve)


def derive_private_key(private_value, curve, backend):
    if not isinstance(private_value, six.integer_types):
        raise TypeError("private_value must be an integer type.")

    if private_value <= 0:
        raise ValueError("private_value must be a positive integer.")

    if not isinstance(curve, EllipticCurve):
        raise TypeError("curve must provide the EllipticCurve interface.")

    return backend.derive_elliptic_curve_private_key(private_value, curve)


class EllipticCurvePublicNumbers(object):
    def __init__(self, x, y, curve):
        if (
            not isinstance(x, six.integer_types) or
            not isinstance(y, six.integer_types)
        ):
            raise TypeError("x and y must be integers.")

        if not isinstance(curve, EllipticCurve):
            raise TypeError("curve must provide the EllipticCurve interface.")

        self._y = y
        self._x = x
        self._curve = curve

    def public_key(self, backend):
        return backend.load_elliptic_curve_public_numbers(self)

    def encode_point(self):
        # key_size is in bits. Convert to bytes and round up
        byte_length = (self.curve.key_size + 7) // 8
        return (
            b'\x04' + utils.int_to_bytes(self.x, byte_length) +
            utils.int_to_bytes(self.y, byte_length)
        )

    @classmethod
    def from_encoded_point(cls, curve, data):
        if not isinstance(curve, EllipticCurve):
            raise TypeError("curve must be an EllipticCurve instance")

        if data.startswith(b'\x04'):
            # key_size is in bits. Convert to bytes and round up
            byte_length = (curve.key_size + 7) // 8
            if len(data) == 2 * byte_length + 1:
                x = utils.int_from_bytes(data[1:byte_length + 1], 'big')
                y = utils.int_from_bytes(data[byte_length + 1:], 'big')
                return cls(x, y, curve)
            else:
                raise ValueError('Invalid elliptic curve point data length')
        else:
            raise ValueError('Unsupported elliptic curve point type')

    curve = utils.read_only_property("_curve")
    x = utils.read_only_property("_x")
    y = utils.read_only_property("_y")

    def __eq__(self, other):
        if not isinstance(other, EllipticCurvePublicNumbers):
            return NotImplemented

        return (
            self.x == other.x and
            self.y == other.y and
            self.curve.name == other.curve.name and
            self.curve.key_size == other.curve.key_size
        )

    def __ne__(self, other):
        return not self == other

    def __hash__(self):
        return hash((self.x, self.y, self.curve.name, self.curve.key_size))

    def __repr__(self):
        return (
            "<EllipticCurvePublicNumbers(curve={0.curve.name}, x={0.x}, "
            "y={0.y}>".format(self)
        )


class EllipticCurvePrivateNumbers(object):
    def __init__(self, private_value, public_numbers):
        if not isinstance(private_value, six.integer_types):
            raise TypeError("private_value must be an integer.")

        if not isinstance(public_numbers, EllipticCurvePublicNumbers):
            raise TypeError(
                "public_numbers must be an EllipticCurvePublicNumbers "
                "instance."
            )

        self._private_value = private_value
        self._public_numbers = public_numbers

    def private_key(self, backend):
        return backend.load_elliptic_curve_private_numbers(self)

    private_value = utils.read_only_property("_private_value")
    public_numbers = utils.read_only_property("_public_numbers")

    def __eq__(self, other):
        if not isinstance(other, EllipticCurvePrivateNumbers):
            return NotImplemented

        return (
            self.private_value == other.private_value and
            self.public_numbers == other.public_numbers
        )

    def __ne__(self, other):
        return not self == other

    def __hash__(self):
        return hash((self.private_value, self.public_numbers))


class ECDH(object):
    pass
