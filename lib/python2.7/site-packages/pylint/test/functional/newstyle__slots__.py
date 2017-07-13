# pylint: disable=R0903
"""test __slots__ on old style class"""


class NewStyleClass(object):
    """correct usage"""
    __slots__ = ('a', 'b')


class OldStyleClass:  # <3.0:[old-style-class,slots-on-old-class]
    """bad usage"""
    __slots__ = ('a', 'b')

    def __init__(self):
        pass

__slots__ = 'hop'
