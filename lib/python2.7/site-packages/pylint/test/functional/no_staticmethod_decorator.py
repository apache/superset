"""Checks static methods are declared with a decorator if within the class
scope and if static method's argument is a member of the class
"""

# pylint: disable=too-few-public-methods, using-constant-test, no-method-argument

class MyClass(object):
    """Some class"""
    def __init__(self):
        pass

    def smethod():
        """static method-to-be"""
    smethod = staticmethod(smethod) # [no-staticmethod-decorator]

    if True:
        smethod = staticmethod(smethod)  # [no-staticmethod-decorator]

    @staticmethod
    def my_second_method():
        """correct static method definition"""

    def other_method():
        """some method"""
    smethod2 = staticmethod(other_method)  # [no-staticmethod-decorator]

def helloworld():
    """says hello"""


MyClass.new_static_method = staticmethod(helloworld)

class MyOtherClass(object):
    """Some other class"""
    _make = staticmethod(tuple.__new__)
