"""check unused import for metaclasses
"""
# pylint: disable=too-few-public-methods,wrong-import-position,ungrouped-imports
__revision__ = 1
import abc
import sys
from abc import ABCMeta
from abc import ABCMeta as SomethingElse

class Meta(metaclass=abc.ABCMeta):
    """ Test """
    def __init__(self):
        self.data = sys.executable
        self.test = abc

class Meta2(metaclass=ABCMeta):
    """ Test """

class Meta3(metaclass=SomethingElse):
    """ test """
