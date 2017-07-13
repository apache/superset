""" Checks assigning attributes not found in class slots
will trigger assigning-non-slot warning.
"""
# pylint: disable=too-few-public-methods, no-init, missing-docstring, no-absolute-import, import-error
from collections import deque

from missing import Unknown

class Empty(object):
    """ empty """

class Bad(object):
    """ missing not in slots. """

    __slots__ = ['member']

    def __init__(self):
        self.missing = 42 # [assigning-non-slot]

class Bad2(object):
    """ missing not in slots """
    __slots__ = [deque.__name__, 'member']

    def __init__(self):
        self.deque = 42
        self.missing = 42 # [assigning-non-slot]

class Bad3(Bad):
    """ missing not found in slots """

    __slots__ = ['component']

    def __init__(self):
        self.component = 42
        self.member = 24
        self.missing = 42 # [assigning-non-slot]
        super(Bad3, self).__init__()

class Good(Empty):
    """ missing not in slots, but Empty doesn't
    specify __slots__.
    """
    __slots__ = ['a']

    def __init__(self):
        self.missing = 42

class Good2(object):
    """ Using __dict__ in slots will be safe. """

    __slots__ = ['__dict__', 'comp']

    def __init__(self):
        self.comp = 4
        self.missing = 5

class PropertyGood(object):
    """ Using properties is safe. """

    __slots__ = ['tmp', '_value']

    @property
    def test(self):
        return self._value

    @test.setter
    def test(self, value):
        # pylint: disable=attribute-defined-outside-init
        self._value = value

    def __init__(self):
        self.test = 42

class PropertyGood2(object):
    """ Using properties in the body of the class is safe. """
    __slots__ = ['_value']

    def _getter(self):
        return self._value

    def _setter(self, value):
        # pylint: disable=attribute-defined-outside-init
        self._value = value

    test = property(_getter, _setter)

    def __init__(self):
        self.test = 24

class UnicodeSlots(object):
    """Using unicode objects in __slots__ is okay.

    On Python 3.3 onward, u'' is equivalent to '',
    so this test should be safe for both versions.
    """
    __slots__ = (u'first', u'second')

    def __init__(self):
        self.first = 42
        self.second = 24


class DataDescriptor(object):
    def __init__(self, name, default=''):
        self.__name = name
        self.__default = default

    def __get__(self, inst, cls):
        return getattr(inst, self.__name, self.__default)

    def __set__(self, inst, value):
        setattr(inst, self.__name, value)


class NonDataDescriptor(object):
    def __get__(self, inst, cls):
        return 42


class SlotsWithDescriptor(object):
    __slots__ = ['_err']
    data_descriptor = DataDescriptor('_err')
    non_data_descriptor = NonDataDescriptor()
    missing_descriptor = Unknown()


def dont_emit_for_descriptors():
    inst = SlotsWithDescriptor()
    # This should not emit, because attr is
    # a data descriptor
    inst.data_descriptor = 'foo'
    inst.non_data_descriptor = 'lala' # [assigning-non-slot]
    return
