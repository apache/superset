# This file is dual licensed under the terms of the Apache License, Version
# 2.0, and the BSD License. See the LICENSE file in the root of this repository
# for complete details.

from __future__ import absolute_import, division, print_function

import abc

import six

from cryptography import utils


@six.add_metaclass(abc.ABCMeta)
class Mode(object):
    @abc.abstractproperty
    def name(self):
        """
        A string naming this mode (e.g. "ECB", "CBC").
        """

    @abc.abstractmethod
    def validate_for_algorithm(self, algorithm):
        """
        Checks that all the necessary invariants of this (mode, algorithm)
        combination are met.
        """


@six.add_metaclass(abc.ABCMeta)
class ModeWithInitializationVector(object):
    @abc.abstractproperty
    def initialization_vector(self):
        """
        The value of the initialization vector for this mode as bytes.
        """


@six.add_metaclass(abc.ABCMeta)
class ModeWithNonce(object):
    @abc.abstractproperty
    def nonce(self):
        """
        The value of the nonce for this mode as bytes.
        """


@six.add_metaclass(abc.ABCMeta)
class ModeWithAuthenticationTag(object):
    @abc.abstractproperty
    def tag(self):
        """
        The value of the tag supplied to the constructor of this mode.
        """


def _check_iv_length(self, algorithm):
    if len(self.initialization_vector) * 8 != algorithm.block_size:
        raise ValueError("Invalid IV size ({0}) for {1}.".format(
            len(self.initialization_vector), self.name
        ))


@utils.register_interface(Mode)
@utils.register_interface(ModeWithInitializationVector)
class CBC(object):
    name = "CBC"

    def __init__(self, initialization_vector):
        if not isinstance(initialization_vector, bytes):
            raise TypeError("initialization_vector must be bytes")

        self._initialization_vector = initialization_vector

    initialization_vector = utils.read_only_property("_initialization_vector")
    validate_for_algorithm = _check_iv_length


@utils.register_interface(Mode)
class ECB(object):
    name = "ECB"

    def validate_for_algorithm(self, algorithm):
        pass


@utils.register_interface(Mode)
@utils.register_interface(ModeWithInitializationVector)
class OFB(object):
    name = "OFB"

    def __init__(self, initialization_vector):
        if not isinstance(initialization_vector, bytes):
            raise TypeError("initialization_vector must be bytes")

        self._initialization_vector = initialization_vector

    initialization_vector = utils.read_only_property("_initialization_vector")
    validate_for_algorithm = _check_iv_length


@utils.register_interface(Mode)
@utils.register_interface(ModeWithInitializationVector)
class CFB(object):
    name = "CFB"

    def __init__(self, initialization_vector):
        if not isinstance(initialization_vector, bytes):
            raise TypeError("initialization_vector must be bytes")

        self._initialization_vector = initialization_vector

    initialization_vector = utils.read_only_property("_initialization_vector")
    validate_for_algorithm = _check_iv_length


@utils.register_interface(Mode)
@utils.register_interface(ModeWithInitializationVector)
class CFB8(object):
    name = "CFB8"

    def __init__(self, initialization_vector):
        if not isinstance(initialization_vector, bytes):
            raise TypeError("initialization_vector must be bytes")

        self._initialization_vector = initialization_vector

    initialization_vector = utils.read_only_property("_initialization_vector")
    validate_for_algorithm = _check_iv_length


@utils.register_interface(Mode)
@utils.register_interface(ModeWithNonce)
class CTR(object):
    name = "CTR"

    def __init__(self, nonce):
        if not isinstance(nonce, bytes):
            raise TypeError("nonce must be bytes")

        self._nonce = nonce

    nonce = utils.read_only_property("_nonce")

    def validate_for_algorithm(self, algorithm):
        if len(self.nonce) * 8 != algorithm.block_size:
            raise ValueError("Invalid nonce size ({0}) for {1}.".format(
                len(self.nonce), self.name
            ))


@utils.register_interface(Mode)
@utils.register_interface(ModeWithInitializationVector)
@utils.register_interface(ModeWithAuthenticationTag)
class GCM(object):
    name = "GCM"
    _MAX_ENCRYPTED_BYTES = (2 ** 39 - 256) // 8
    _MAX_AAD_BYTES = (2 ** 64) // 8

    def __init__(self, initialization_vector, tag=None, min_tag_length=16):
        # len(initialization_vector) must in [1, 2 ** 64), but it's impossible
        # to actually construct a bytes object that large, so we don't check
        # for it
        if min_tag_length < 4:
            raise ValueError("min_tag_length must be >= 4")
        if tag is not None and len(tag) < min_tag_length:
            raise ValueError(
                "Authentication tag must be {0} bytes or longer.".format(
                    min_tag_length)
            )

        if not isinstance(initialization_vector, bytes):
            raise TypeError("initialization_vector must be bytes")

        if tag is not None and not isinstance(tag, bytes):
            raise TypeError("tag must be bytes or None")

        self._initialization_vector = initialization_vector
        self._tag = tag

    tag = utils.read_only_property("_tag")
    initialization_vector = utils.read_only_property("_initialization_vector")

    def validate_for_algorithm(self, algorithm):
        pass
