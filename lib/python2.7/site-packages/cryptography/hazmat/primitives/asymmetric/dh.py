# This file is dual licensed under the terms of the Apache License, Version
# 2.0, and the BSD License. See the LICENSE file in the root of this repository
# for complete details.

from __future__ import absolute_import, division, print_function

import abc

import six

from cryptography import utils


def generate_parameters(generator, key_size, backend):
    return backend.generate_dh_parameters(generator, key_size)


class DHPrivateNumbers(object):
    def __init__(self, x, public_numbers):
        if not isinstance(x, six.integer_types):
            raise TypeError("x must be an integer.")

        if not isinstance(public_numbers, DHPublicNumbers):
            raise TypeError("public_numbers must be an instance of "
                            "DHPublicNumbers.")

        self._x = x
        self._public_numbers = public_numbers

    def __eq__(self, other):
        if not isinstance(other, DHPrivateNumbers):
            return NotImplemented

        return (
            self._x == other._x and
            self._public_numbers == other._public_numbers
        )

    def __ne__(self, other):
        return not self == other

    def private_key(self, backend):
        return backend.load_dh_private_numbers(self)

    public_numbers = utils.read_only_property("_public_numbers")
    x = utils.read_only_property("_x")


class DHPublicNumbers(object):
    def __init__(self, y, parameter_numbers):
        if not isinstance(y, six.integer_types):
            raise TypeError("y must be an integer.")

        if not isinstance(parameter_numbers, DHParameterNumbers):
            raise TypeError(
                "parameters must be an instance of DHParameterNumbers.")

        self._y = y
        self._parameter_numbers = parameter_numbers

    def __eq__(self, other):
        if not isinstance(other, DHPublicNumbers):
            return NotImplemented

        return (
            self._y == other._y and
            self._parameter_numbers == other._parameter_numbers
        )

    def __ne__(self, other):
        return not self == other

    def public_key(self, backend):
        return backend.load_dh_public_numbers(self)

    y = utils.read_only_property("_y")
    parameter_numbers = utils.read_only_property("_parameter_numbers")


class DHParameterNumbers(object):
    def __init__(self, p, g):
        if (
            not isinstance(p, six.integer_types) or
            not isinstance(g, six.integer_types)
        ):
            raise TypeError("p and g must be integers")

        if g not in (2, 5):
            raise ValueError("DH generator must be 2 or 5")

        self._p = p
        self._g = g

    def __eq__(self, other):
        if not isinstance(other, DHParameterNumbers):
            return NotImplemented

        return (
            self._p == other._p and
            self._g == other._g
        )

    def __ne__(self, other):
        return not self == other

    def parameters(self, backend):
        return backend.load_dh_parameter_numbers(self)

    p = utils.read_only_property("_p")
    g = utils.read_only_property("_g")


@six.add_metaclass(abc.ABCMeta)
class DHParameters(object):
    @abc.abstractmethod
    def generate_private_key(self):
        """
        Generates and returns a DHPrivateKey.
        """


@six.add_metaclass(abc.ABCMeta)
class DHParametersWithSerialization(DHParameters):
    @abc.abstractmethod
    def parameter_numbers(self):
        """
        Returns a DHParameterNumbers.
        """


@six.add_metaclass(abc.ABCMeta)
class DHPrivateKey(object):
    @abc.abstractproperty
    def key_size(self):
        """
        The bit length of the prime modulus.
        """

    @abc.abstractmethod
    def public_key(self):
        """
        The DHPublicKey associated with this private key.
        """

    @abc.abstractmethod
    def parameters(self):
        """
        The DHParameters object associated with this private key.
        """


@six.add_metaclass(abc.ABCMeta)
class DHPrivateKeyWithSerialization(DHPrivateKey):
    @abc.abstractmethod
    def private_numbers(self):
        """
        Returns a DHPrivateNumbers.
        """

    @abc.abstractmethod
    def exchange(self, peer_public_key):
        """
        Given peer's DHPublicKey, carry out the key exchange and
        return shared key as bytes.
        """


@six.add_metaclass(abc.ABCMeta)
class DHPublicKey(object):
    @abc.abstractproperty
    def key_size(self):
        """
        The bit length of the prime modulus.
        """

    @abc.abstractmethod
    def parameters(self):
        """
        The DHParameters object associated with this public key.
        """


@six.add_metaclass(abc.ABCMeta)
class DHPublicKeyWithSerialization(DHPublicKey):
    @abc.abstractmethod
    def public_numbers(self):
        """
        Returns a DHPublicNumbers.
        """
