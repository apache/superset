""" Tests for old style classes. """
# pylint: disable=no-init, too-few-public-methods, invalid-name, metaclass-assignment

class Old: # [old-style-class]
    """ old style class """

class Child(Old):
    """ Old style class, but don't emit for it. """

class NotOldStyle2:
    """ Because I have a metaclass at class level. """
    __metaclass__ = type

# pylint: disable=redefined-builtin
__metaclass__ = type

class NotOldStyle:
    """ Because I have a metaclass at global level. """
