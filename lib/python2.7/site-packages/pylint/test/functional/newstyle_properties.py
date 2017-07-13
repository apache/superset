# pylint: disable=too-few-public-methods
"""Test properties on old style classes and property.setter/deleter usage"""


def getter(self):
    """interesting"""
    return self

class CorrectClass(object):
    """correct usage"""
    method = property(getter, doc='hop')

class OldStyleClass:  # <3.0:[old-style-class]
    """bad usage"""
    method = property(getter, doc='hop')  # <3.0:[property-on-old-class]

    def __init__(self):
        pass


def decorator(func):
    """Redefining decorator."""
    def wrapped(self):
        """Wrapper function."""
        return func(self)
    return wrapped


class SomeClass(object):
    """another docstring"""

    def __init__(self):
        self._prop = None

    @property
    def prop(self):
        """I'm the 'prop' property."""
        return self._prop

    @prop.setter
    def prop(self, value):
        """I'm the 'prop' property."""
        self._prop = value

    @prop.deleter
    def prop(self):
        """I'm the 'prop' property."""
        del self._prop

    @decorator
    def noregr(self):
        """Just a normal method with a decorator."""
        return self.prop
