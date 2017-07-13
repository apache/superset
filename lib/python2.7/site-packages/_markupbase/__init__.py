from __future__ import absolute_import
import sys
__future_module__ = True

if sys.version_info[0] < 3:
    from markupbase import *
else:
    raise ImportError('This package should not be accessible on Python 3. '
                      'Either you are trying to run from the python-future src folder '
                      'or your installation of python-future is corrupted.')
