# This file is dual licensed under the terms of the Apache License, Version
# 2.0, and the BSD License. See the LICENSE file in the root of this repository
# for complete details.

from __future__ import absolute_import, division, print_function

import collections
import os
import threading
import types
import warnings

from cryptography.exceptions import InternalError
from cryptography.hazmat.bindings._openssl import ffi, lib
from cryptography.hazmat.bindings.openssl._conditional import CONDITIONAL_NAMES

_OpenSSLError = collections.namedtuple("_OpenSSLError",
                                       ["code", "lib", "func", "reason"])
_OpenSSLErrorWithText = collections.namedtuple(
    "_OpenSSLErrorWithText", ["code", "lib", "func", "reason", "reason_text"]
)


def _consume_errors(lib):
    errors = []
    while True:
        code = lib.ERR_get_error()
        if code == 0:
            break

        err_lib = lib.ERR_GET_LIB(code)
        err_func = lib.ERR_GET_FUNC(code)
        err_reason = lib.ERR_GET_REASON(code)

        errors.append(_OpenSSLError(code, err_lib, err_func, err_reason))

    return errors


def _openssl_assert(lib, ok):
    if not ok:
        errors = _consume_errors(lib)
        errors_with_text = []
        for err in errors:
            err_text_reason = ffi.string(
                lib.ERR_error_string(err.code, ffi.NULL)
            )
            errors_with_text.append(
                _OpenSSLErrorWithText(
                    err.code, err.lib, err.func, err.reason, err_text_reason
                )
            )

        raise InternalError(
            "Unknown OpenSSL error. This error is commonly encountered when "
            "another library is not cleaning up the OpenSSL error stack. If "
            "you are using cryptography with another library that uses "
            "OpenSSL try disabling it before reporting a bug. Otherwise "
            "please file an issue at https://github.com/pyca/cryptography/"
            "issues with information on how to reproduce "
            "this. ({0!r})".format(errors_with_text),
            errors_with_text
        )


def ffi_callback(signature, name, **kwargs):
    """Callback dispatcher

    The ffi_callback() dispatcher keeps callbacks compatible between dynamic
    and static callbacks.
    """
    def wrapper(func):
        if lib.Cryptography_STATIC_CALLBACKS:
            # def_extern() returns a decorator that sets the internal
            # function pointer and returns the original function unmodified.
            ffi.def_extern(name=name, **kwargs)(func)
            callback = getattr(lib, name)
        else:
            # callback() wraps the function in a cdata function.
            callback = ffi.callback(signature, **kwargs)(func)
        return callback
    return wrapper


def build_conditional_library(lib, conditional_names):
    conditional_lib = types.ModuleType("lib")
    excluded_names = set()
    for condition, names in conditional_names.items():
        if not getattr(lib, condition):
            excluded_names |= set(names)

    for attr in dir(lib):
        if attr not in excluded_names:
            setattr(conditional_lib, attr, getattr(lib, attr))

    return conditional_lib


class Binding(object):
    """
    OpenSSL API wrapper.
    """
    lib = None
    ffi = ffi
    _lib_loaded = False
    _init_lock = threading.Lock()
    _lock_init_lock = threading.Lock()

    def __init__(self):
        self._ensure_ffi_initialized()

    @classmethod
    def _register_osrandom_engine(cls):
        _openssl_assert(cls.lib, cls.lib.ERR_peek_error() == 0)
        cls._osrandom_engine_id = cls.lib.Cryptography_osrandom_engine_id
        cls._osrandom_engine_name = cls.lib.Cryptography_osrandom_engine_name
        result = cls.lib.Cryptography_add_osrandom_engine()
        _openssl_assert(cls.lib, result in (1, 2))

    @classmethod
    def _ensure_ffi_initialized(cls):
        with cls._init_lock:
            if not cls._lib_loaded:
                cls.lib = build_conditional_library(lib, CONDITIONAL_NAMES)
                cls._lib_loaded = True
                # initialize the SSL library
                cls.lib.SSL_library_init()
                # adds all ciphers/digests for EVP
                cls.lib.OpenSSL_add_all_algorithms()
                # loads error strings for libcrypto and libssl functions
                cls.lib.SSL_load_error_strings()
                cls._register_osrandom_engine()

    @classmethod
    def init_static_locks(cls):
        with cls._lock_init_lock:
            cls._ensure_ffi_initialized()
            # Use Python's implementation if available, importing _ssl triggers
            # the setup for this.
            __import__("_ssl")

            if cls.lib.CRYPTO_get_locking_callback() != cls.ffi.NULL:
                return

            # If nothing else has setup a locking callback already, we set up
            # our own
            res = lib._setup_ssl_threads()
            _openssl_assert(cls.lib, res == 1)


def _verify_openssl_version(version):
    if version < 0x10001000:
        if os.environ.get("CRYPTOGRAPHY_ALLOW_OPENSSL_100"):
            warnings.warn(
                "OpenSSL version 1.0.0 is no longer supported by the OpenSSL "
                "project, please upgrade. The next version of cryptography "
                "will completely remove support for it.",
                DeprecationWarning
            )
        else:
            raise RuntimeError(
                "You are linking against OpenSSL 1.0.0, which is no longer "
                "support by the OpenSSL project. You need to upgrade to a "
                "newer version of OpenSSL."
            )


# OpenSSL is not thread safe until the locks are initialized. We call this
# method in module scope so that it executes with the import lock. On
# Pythons < 3.4 this import lock is a global lock, which can prevent a race
# condition registering the OpenSSL locks. On Python 3.4+ the import lock
# is per module so this approach will not work.
Binding.init_static_locks()

_verify_openssl_version(Binding.lib.SSLeay())
