# pylint: disable=missing-docstring
from __future__ import print_function

class Aaaa(object): # [too-few-public-methods]

    def __init__(self):
        pass

    def meth1(self):
        print(self)

    def _dontcount(self):
        print(self)


# Don't emit for these cases.
class Klass(object):
    """docstring"""

    def meth1(self):
        """first"""

    def meth2(self):
        """second"""


class EnoughPublicMethods(Klass):
    """We shouldn't emit too-few-public-methods for this."""
