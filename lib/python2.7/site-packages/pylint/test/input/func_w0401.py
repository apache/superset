"""test cyclic import
"""
# pylint: disable=no-absolute-import
from __future__ import print_function

from . import w0401_cycle

if w0401_cycle:
    print(w0401_cycle)
