"""Sub-package containing the matrix class and related functions.

"""
from __future__ import division, absolute_import, print_function

from .defmatrix import *

__all__ = defmatrix.__all__

from numpy.testing.nosetester import _numpy_tester
test = _numpy_tester().test
bench = _numpy_tester().bench
