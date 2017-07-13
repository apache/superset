# pylint: disable=too-few-public-methods,print-statement
"""check method hidding ancestor attribute
"""
from __future__ import print_function

class Abcd(object):
    """dummy"""
    def __init__(self):
        self.abcd = 1

class Cdef(Abcd):
    """dummy"""
    def abcd(self): # [method-hidden]
        """test
        """
        print(self)
