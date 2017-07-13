# pylint: disable=missing-docstring, too-few-public-methods, import-error,unused-argument

import abc

import six
from unknown import Unknown


class InvalidAsMetaclass(object):
    pass


class ValidAsMetaclass(type):
    pass


@six.add_metaclass(type)
class FirstGood(object):
    pass


@six.add_metaclass(abc.ABCMeta)
class SecondGood(object):
    pass


@six.add_metaclass(Unknown)
class ThirdGood(object):
    pass


@six.add_metaclass(ValidAsMetaclass)
class FourthGood(object):
    pass
