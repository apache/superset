"""Common test support for all numpy test scripts.

This single module should provide all the common functionality for numpy tests
in a single location, so that test scripts can just import it and work right
away.

"""
from __future__ import division, absolute_import, print_function

from unittest import TestCase

from . import decorators as dec
from .nosetester import run_module_suite, NoseTester as Tester
from .utils import *
test = nosetester._numpy_tester().test
