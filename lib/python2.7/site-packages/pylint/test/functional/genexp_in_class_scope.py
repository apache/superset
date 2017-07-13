# pylint: disable=W0232,R0903, missing-docstring
"""Class scope must be handled correctly in genexps"""

class MyClass(object):
    var1 = []
    var2 = list(value*2 for value in var1)
