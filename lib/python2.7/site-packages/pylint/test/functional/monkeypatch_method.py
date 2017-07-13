# pylint: disable=missing-docstring,too-few-public-methods
'''Test that a function is considered a method when looked up through a class.'''

class Clazz(object):
    'test class'

    def __init__(self, value):
        self.value = value

def func(arg1, arg2):
    'function that will be used as a method'
    return arg1.value + arg2

Clazz.method = func

VAR = Clazz(1).method(2)
