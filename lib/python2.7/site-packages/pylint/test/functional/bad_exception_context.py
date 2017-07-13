"""Check that raise ... from .. uses a proper exception context """

# pylint: disable=unreachable, import-error, multiple-imports

import socket, unknown

__revision__ = 0

class ExceptionSubclass(Exception):
    """ subclass """

def test():
    """ docstring """
    raise IndexError from 1 # [bad-exception-context]
    raise IndexError from None
    raise IndexError from ZeroDivisionError
    raise IndexError from object() # [bad-exception-context]
    raise IndexError from ExceptionSubclass
    raise IndexError from socket.error
    raise IndexError() from None
    raise IndexError() from ZeroDivisionError
    raise IndexError() from ZeroDivisionError()
    raise IndexError() from object() # [bad-exception-context]
    raise IndexError() from unknown
