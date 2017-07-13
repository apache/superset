# pylint: disable=missing-docstring

class Aaaa(object): # [too-many-public-methods]

    def __init__(self):
        pass

    def meth1(self):
        """hehehe"""

    def meth2(self):
        """hehehe"""

    def meth3(self):
        """hehehe"""

    def meth4(self):
        """hehehe"""

    def meth5(self):
        """hehehe"""

    def meth6(self):
        """hehehe"""

    def meth7(self):
        """hehehe"""

    def meth8(self):
        """hehehe"""

    def meth9(self):
        """hehehe"""

    def meth10(self):
        """hehehe"""

    def meth11(self):
        """hehehe"""

    def meth12(self):
        """hehehe"""

    def meth13(self):
        """hehehe"""

    def meth14(self):
        """hehehe"""

    def meth15(self):
        """hehehe"""

    def meth16(self):
        """hehehe"""

    def meth17(self):
        """hehehe"""

    def meth18(self):
        """hehehe"""

    def meth19(self):
        """hehehe"""

    def meth20(self):
        """hehehe"""

    def meth21(self):
        """hehehe"""

    def _dontcount(self):
        """not public"""

class BBB(Aaaa):
    """Don't emit for methods defined in the parent."""
    def meth1(self):
        """trop"""
    def meth2(self):
        """tzop"""
