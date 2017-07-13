# pylint: disable=missing-docstring

import socket

RETRYABLE_EXCEPTIONS = (socket.error,)


def exception_handler():
    try:
        yield 1
    except RETRYABLE_EXCEPTIONS + tuple():
        yield 2
