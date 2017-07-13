"""Test that inheriting from something which is not
a class emits a warning. """

# pylint: disable=no-init, import-error, invalid-name, using-constant-test
# pylint: disable=missing-docstring, too-few-public-methods, no-absolute-import

from missing import Missing

if 1:
    Ambiguous = None
else:
    Ambiguous = int

class Empty(object):
    """ Empty class. """

def return_class():
    """ Return a class. """
    return Good3

class Bad(1): # [inherit-non-class]
    """ Can't inherit from instance. """

class Bad1(lambda abc: 42): # [inherit-non-class]
    """ Can't inherit from lambda. """

class Bad2(object()): # [inherit-non-class]
    """ Can't inherit from an instance of object. """

class Bad3(return_class): # [inherit-non-class]
    """ Can't inherit from function. """

class Bad4(Empty()): # [inherit-non-class]
    """ Can't inherit from instance. """

class Good(object):
    pass

class Good1(int):
    pass

class Good2(type):
    pass

class Good3(type(int)):
    pass

class Good4(return_class()):
    pass

class Good5(Good4, int, object):
    pass

class Good6(Ambiguous):
    """ Inherits from something ambiguous.

    This could emit a warning when we will have
    flow detection.
    """

class Unknown(Missing):
    pass

class Unknown1(Good5 if True else Bad1):
    pass


class NotInheritableBool(bool): # [inherit-non-class]
    pass


class NotInheritableRange(range): # [inherit-non-class]
    pass


class NotInheritableSlice(slice): # [inherit-non-class]
    pass


class NotInheritableMemoryView(memoryview): # [inherit-non-class]
    pass
