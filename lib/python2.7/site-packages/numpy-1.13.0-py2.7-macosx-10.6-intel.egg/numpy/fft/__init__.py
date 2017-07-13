from __future__ import division, absolute_import, print_function

# To get sub-modules
from .info import __doc__

from .fftpack import *
from .helper import *

from numpy.testing.nosetester import _numpy_tester
test = _numpy_tester().test
bench = _numpy_tester().bench
