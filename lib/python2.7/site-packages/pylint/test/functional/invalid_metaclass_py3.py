# pylint: disable=missing-docstring, too-few-public-methods, import-error,unused-argument

from unknown import Unknown


def valid_metaclass_1(name, _, attrs):
    return type


def valid_metaclass_2(_name, _bases, _attrs):
    return Unknown


class GoodMetaclass(metaclass=valid_metaclass_1):
    pass


class SecondGoodMetaclass(metaclass=valid_metaclass_2):
    pass
