"""check unused import
"""
# pylint: disable=no-absolute-import

from __future__ import print_function

import os
import sys

class NonRegr(object):
    """???"""
    def __init__(self):
        print('initialized')

    def sys(self):
        """should not get sys from there..."""
        print(self, sys)

    def dummy(self, truc):
        """yo"""
        return self, truc

    def blop(self):
        """yo"""
        print(self, 'blip')
