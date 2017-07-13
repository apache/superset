# pylint: disable=R0903, metaclass-assignment
"""test attribute access on metaclass"""


from __future__ import print_function

class Meta(type):
    """the meta class"""
    def __init__(cls, name, bases, dictionary):
        super(Meta, cls).__init__(name, bases, dictionary)
        print(cls, cls._meta_args)
        delattr(cls, '_meta_args')

class Test(object):
    """metaclassed class"""
    __metaclass__ = Meta
    _meta_args = ('foo', 'bar')

    def __init__(self):
        print('__init__', self)
