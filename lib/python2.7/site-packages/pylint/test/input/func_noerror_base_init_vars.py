# pylint:disable=R0201, print-statement, too-few-public-methods
"""Checks that class variables are seen as inherited !
"""
__revision__ = ''

class BaseClass(object):
    """A simple base class
    """

    def __init__(self):
        self.base_var = {}

    def met(self):
        """yo"""
    def meeting(self, with_):
        """ye"""
        return with_
class MyClass(BaseClass):
    """Inherits from BaseClass
    """

    def __init__(self):
        BaseClass.__init__(self)
        self.var = {}

    def met(self):
        """Checks that base_var is not seen as defined outsite '__init__'
        """
        self.var[1] = 'one'
        self.base_var[1] = 'one'
        return self.base_var, self.var

if __name__ == '__main__':
    OBJ = MyClass()
    OBJ.met()
