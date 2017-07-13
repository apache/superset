# pylint: disable=R0903
"""
False positive case of E1101:

The error is triggered when the attribute set in the base class is
modified with augmented assignment in a derived class.

http://www.logilab.org/ticket/9588
"""
__revision__ = 0

class BaseClass(object):
    "The base class"
    def __init__(self):
        "Set an attribute."
        self.e1101 = 1

class FalsePositiveClass(BaseClass):
    "The first derived class which triggers the false positive"
    def __init__(self):
        "Augmented assignment triggers E1101."
        BaseClass.__init__(self)
        self.e1101 += 1

    def countup(self):
        "Consequently this also triggers E1101."
        self.e1101 += 1

class NegativeClass(BaseClass):
    "The second derived class, which does not trigger the error E1101"
    def __init__(self):
        "Ordinary assignment is OK."
        BaseClass.__init__(self)
        self.e1101 = self.e1101 + 1

    def countup(self):
        "No problem."
        self.e1101 += 1
