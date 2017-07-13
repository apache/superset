"""Checks class methods are declared with a decorator if within the class
scope and if classmethod's argument is a member of the class
"""

# pylint: disable=too-few-public-methods, using-constant-test, no-self-argument

class MyClass(object):
    """Some class"""
    def __init__(self):
        pass

    def cmethod(cls):
        """class method-to-be"""
    cmethod = classmethod(cmethod)  # [no-classmethod-decorator]

    if True:
        cmethod = classmethod(cmethod)  # [no-classmethod-decorator]

    @classmethod
    def my_second_method(cls):
        """correct class method definition"""

    def other_method(cls):
        """some method"""
    cmethod2 = classmethod(other_method)  # [no-classmethod-decorator]

def helloworld():
    """says hello"""


MyClass.new_class_method = classmethod(helloworld)

class MyOtherClass(object):
    """Some other class"""
    _make = classmethod(tuple.__new__)
