from __future__ import absolute_import
import sys

if sys.version_info[0] < 3:
    from Tkinter import *
    from Tkinter import (_cnfmerge, _default_root, _flatten, _join, _setit,
                         _splitdict, _stringify, _support_default_root, _test,
                         _tkinter)
else:
    raise ImportError('This package should not be accessible on Python 3. '
                      'Either you are trying to run from the python-future src folder '
                      'or your installation of python-future is corrupted.')
