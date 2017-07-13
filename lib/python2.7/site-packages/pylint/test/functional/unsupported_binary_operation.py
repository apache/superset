"""Test for unsupported-binary-operation."""
# pylint: disable=missing-docstring,too-few-public-methods,pointless-statement
# pylint: disable=expression-not-assigned, invalid-name


import collections


1 + "a" # [unsupported-binary-operation]
1 - [] # [unsupported-binary-operation]
1 * {} # [unsupported-binary-operation]
1 / collections # [unsupported-binary-operation]
1 ** (lambda x: x) # [unsupported-binary-operation]
{} * {} # [unsupported-binary-operation]
{} - {} # [unsupported-binary-operation]
{} | {} # [unsupported-binary-operation]
{} >> {} # [unsupported-binary-operation]
[] + () # [unsupported-binary-operation]
() + [] # [unsupported-binary-operation]
[] * 2.0 # [unsupported-binary-operation]
() * 2.0 # [unsupported-binary-operation]
2.0 >> 2.0 # [unsupported-binary-operation]
class A(object):
    pass
class B(object):
    pass
A() + B() # [unsupported-binary-operation]
class A1(object):
    def __add__(self, other):
        return NotImplemented

A1() + A1() # [unsupported-binary-operation]

class A2(object):
    def __add__(self, other):
        return NotImplemented
class B2(object):
    def __radd__(self, other):
        return NotImplemented
A2() + B2() # [unsupported-binary-operation]

class Parent(object):
    pass
class Child(Parent):
    def __add__(self, other):
        return NotImplemented
Child() + Parent() # [unsupported-binary-operation]
class A3(object):
    def __add__(self, other):
        return NotImplemented
class B3(A3):
    def __radd__(self, other):
        return NotImplemented
A3() + B3() # [unsupported-binary-operation]
# Augmented
FFF = 1
FFF += A() # [unsupported-binary-operation]
TTT = 1
TTT += [] # [unsupported-binary-operation]


# Don't emit for this case since we don't know what unknown is.
from unknown import Unknown
class Base(Unknown):
    pass
Base() * 23
