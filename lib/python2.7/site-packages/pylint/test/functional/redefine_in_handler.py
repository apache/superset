"""Test for W0623, overwriting names in exception handlers."""
# pylint: disable=broad-except,bare-except,print-statement,no-absolute-import,duplicate-except
# pylint: disable=invalid-name, unused-variable
import exceptions

__revision__ = ''

class MyError(Exception):
    """Special exception class."""
    pass


def some_function():
    """A function."""
    exc = None

    try:
        {}["a"]
    except KeyError, exceptions.RuntimeError: # [redefine-in-handler]
        pass
    except KeyError, OSError: # [redefine-in-handler]
        pass
    except KeyError, MyError: # [redefine-in-handler]
        pass
    except KeyError, exc: # this is fine
        print exc
    except KeyError, exc1: # this is fine
        print exc1
    except KeyError, FOO: # C0103
        print FOO

    try:
        pass
    except KeyError, exc1: # this is fine
        print exc1

class MyOtherError(Exception):
    """Special exception class."""
    pass


exc3 = None

try:
    pass
except KeyError, exceptions.RuntimeError: # [redefine-in-handler]
    pass
except KeyError, exceptions.RuntimeError.args: # [redefine-in-handler]
    pass
except KeyError, OSError: # [redefine-in-handler]
    pass
except KeyError, MyOtherError: # [redefine-in-handler]
    pass
except KeyError, exc3: # this is fine
    print exc3
except KeyError, exc4: # this is fine
    print exc4
except KeyError, OOPS: # C0103
    print OOPS

try:
    pass
except KeyError, exc4: # this is fine
    print exc4
except IOError, exc5: # this is fine
    print exc5
except MyOtherError, exc5: # this is fine
    print exc5
