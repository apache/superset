# pylint: disable=too-few-public-methods, print-statement
"""test access to __name__ gives undefined member on new/old class instances
but not on new/old class object
"""
from __future__ import print_function

class Aaaa:  # <3.0:[old-style-class]
    """old class"""
    def __init__(self):
        print(self.__name__)  # [no-member]
        print(self.__class__.__name__)

class NewClass(object):
    """new class"""

    def __new__(cls, *args, **kwargs):
        print('new', cls.__name__)
        return object.__new__(cls, *args, **kwargs)

    def __init__(self):
        print('init', self.__name__)  # [no-member]
