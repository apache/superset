import logging
import unittest
from traceback import format_tb
from nose.pyversion import is_base_exception

log = logging.getLogger(__name__)


__all__ = ['Failure']


class Failure(unittest.TestCase):
    """Unloadable or unexecutable test.

    A Failure case is placed in a test suite to indicate the presence of a
    test that could not be loaded or executed. A common example is a test
    module that fails to import.
    
    """
    __test__ = False # do not collect
    def __init__(self, exc_class, exc_val, tb=None, address=None):
        log.debug("A failure! %s %s %s", exc_class, exc_val, format_tb(tb))
        self.exc_class = exc_class
        self.exc_val = exc_val
        self.tb = tb
        self._address = address
        unittest.TestCase.__init__(self)

    def __str__(self):
        return "Failure: %s (%s)" % (
            getattr(self.exc_class, '__name__', self.exc_class), self.exc_val)

    def address(self):
        return self._address
    
    def runTest(self):
        if self.tb is not None:
            if is_base_exception(self.exc_val):
                raise self.exc_val, None, self.tb
            raise self.exc_class, self.exc_val, self.tb
        else:
            raise self.exc_class(self.exc_val)
