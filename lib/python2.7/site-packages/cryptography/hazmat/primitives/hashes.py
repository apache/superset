# This file is dual licensed under the terms of the Apache License, Version
# 2.0, and the BSD License. See the LICENSE file in the root of this repository
# for complete details.

from __future__ import absolute_import, division, print_function

import abc

import six

from cryptography import utils
from cryptography.exceptions import (
    AlreadyFinalized, UnsupportedAlgorithm, _Reasons
)
from cryptography.hazmat.backends.interfaces import HashBackend


@six.add_metaclass(abc.ABCMeta)
class HashAlgorithm(object):
    @abc.abstractproperty
    def name(self):
        """
        A string naming this algorithm (e.g. "sha256", "md5").
        """

    @abc.abstractproperty
    def digest_size(self):
        """
        The size of the resulting digest in bytes.
        """

    @abc.abstractproperty
    def block_size(self):
        """
        The internal block size of the hash algorithm in bytes.
        """


@six.add_metaclass(abc.ABCMeta)
class HashContext(object):
    @abc.abstractproperty
    def algorithm(self):
        """
        A HashAlgorithm that will be used by this context.
        """

    @abc.abstractmethod
    def update(self, data):
        """
        Processes the provided bytes through the hash.
        """

    @abc.abstractmethod
    def finalize(self):
        """
        Finalizes the hash context and returns the hash digest as bytes.
        """

    @abc.abstractmethod
    def copy(self):
        """
        Return a HashContext that is a copy of the current context.
        """


@utils.register_interface(HashContext)
class Hash(object):
    def __init__(self, algorithm, backend, ctx=None):
        if not isinstance(backend, HashBackend):
            raise UnsupportedAlgorithm(
                "Backend object does not implement HashBackend.",
                _Reasons.BACKEND_MISSING_INTERFACE
            )

        if not isinstance(algorithm, HashAlgorithm):
            raise TypeError("Expected instance of hashes.HashAlgorithm.")
        self._algorithm = algorithm

        self._backend = backend

        if ctx is None:
            self._ctx = self._backend.create_hash_ctx(self.algorithm)
        else:
            self._ctx = ctx

    algorithm = utils.read_only_property("_algorithm")

    def update(self, data):
        if self._ctx is None:
            raise AlreadyFinalized("Context was already finalized.")
        if not isinstance(data, bytes):
            raise TypeError("data must be bytes.")
        self._ctx.update(data)

    def copy(self):
        if self._ctx is None:
            raise AlreadyFinalized("Context was already finalized.")
        return Hash(
            self.algorithm, backend=self._backend, ctx=self._ctx.copy()
        )

    def finalize(self):
        if self._ctx is None:
            raise AlreadyFinalized("Context was already finalized.")
        digest = self._ctx.finalize()
        self._ctx = None
        return digest


@utils.register_interface(HashAlgorithm)
class SHA1(object):
    name = "sha1"
    digest_size = 20
    block_size = 64


@utils.register_interface(HashAlgorithm)
class SHA224(object):
    name = "sha224"
    digest_size = 28
    block_size = 64


@utils.register_interface(HashAlgorithm)
class SHA256(object):
    name = "sha256"
    digest_size = 32
    block_size = 64


@utils.register_interface(HashAlgorithm)
class SHA384(object):
    name = "sha384"
    digest_size = 48
    block_size = 128


@utils.register_interface(HashAlgorithm)
class SHA512(object):
    name = "sha512"
    digest_size = 64
    block_size = 128


@utils.register_interface(HashAlgorithm)
class RIPEMD160(object):
    name = "ripemd160"
    digest_size = 20
    block_size = 64


@utils.register_interface(HashAlgorithm)
class Whirlpool(object):
    name = "whirlpool"
    digest_size = 64
    block_size = 64


@utils.register_interface(HashAlgorithm)
class MD5(object):
    name = "md5"
    digest_size = 16
    block_size = 64


@utils.register_interface(HashAlgorithm)
class BLAKE2b(object):
    name = "blake2b"
    _max_digest_size = 64
    _min_digest_size = 1
    block_size = 128

    def __init__(self, digest_size):
        if (
            digest_size > self._max_digest_size or
            digest_size < self._min_digest_size
        ):
            raise ValueError("Digest size must be {0}-{1}".format(
                self._min_digest_size, self._max_digest_size)
            )

        self._digest_size = digest_size

    digest_size = utils.read_only_property("_digest_size")


@utils.register_interface(HashAlgorithm)
class BLAKE2s(object):
    name = "blake2s"
    block_size = 64
    _max_digest_size = 32
    _min_digest_size = 1

    def __init__(self, digest_size):
        if (
            digest_size > self._max_digest_size or
            digest_size < self._min_digest_size
        ):
            raise ValueError("Digest size must be {0}-{1}".format(
                self._min_digest_size, self._max_digest_size)
            )

        self._digest_size = digest_size

    digest_size = utils.read_only_property("_digest_size")
