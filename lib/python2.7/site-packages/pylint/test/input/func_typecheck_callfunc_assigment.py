
"""check assignment to function call where the function doesn't return

    'E1111': ('Assigning to function call which doesn\'t return',
              'Used when an assignment is done on a function call but the \
              infered function doesn\'t return anything.'),
    'W1111': ('Assigning to function call which only returns None',
              'Used when an assignment is done on a function call but the \
              infered function returns nothing but None.'),

"""
from __future__ import generators, print_function

def func_no_return():
    """function without return"""
    print('dougloup')

A = func_no_return()


def func_return_none():
    """function returning none"""
    print('dougloup')
    return None

A = func_return_none()


def func_implicit_return_none():
    """Function returning None from bare return statement."""
    return

A = func_implicit_return_none()


def func_return_none_and_smth():
    """function returning none and something else"""
    print('dougloup')
    if 2 or 3:
        return None
    return 3

A = func_return_none_and_smth()

def generator():
    """no problemo"""
    yield 2

A = generator()

class Abstract(object):
    """bla bla"""

    def abstract_method(self):
        """use to return something in concrete implementation"""
        raise NotImplementedError

    def use_abstract(self):
        """should not issue E1111"""
        var = self.abstract_method()
        print(var)
