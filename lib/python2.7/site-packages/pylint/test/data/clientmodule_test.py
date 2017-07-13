""" docstring for file clientmodule.py """
from data.suppliermodule_test import Interface, DoNothing

class Ancestor(object):
    """ Ancestor method """
    __implements__ = (Interface,)
    cls_member = DoNothing()

    def __init__(self, value):
        local_variable = 0
        self.attr = 'this method shouldn\'t have a docstring'
        self.__value = value

    def get_value(self):
        """ nice docstring ;-) """
        return self.__value

    def set_value(self, value):
        self.__value = value
        return 'this method shouldn\'t have a docstring'

class Specialization(Ancestor):
    TYPE = 'final class'
    top = 'class'

    def __init__(self, value, _id):
        Ancestor.__init__(self, value)
        self._id = _id
        self.relation = DoNothing()
